from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_admin
from app.core.security import decrypt_field
from app.core.redis import session_store
from app.models.user import User
from app.models.order import Order
from app.models.session import UserSession
from app.schemas.user import AdminUserListItem, AdminUserDetail, BlockUserRequest

router = APIRouter(prefix="/api/v1/admin/users", tags=["Admin Users"])


def _decrypt_user(user: User) -> dict:
    """Decrypt encrypted fields for admin display."""
    return {
        "email": decrypt_field(user.email) if user.email else None,
        "phone": decrypt_field(user.phone) if user.phone else None,
    }


# ─────────────────────────────────────────────
# GET /admin/users — List all users (paginated)
# ─────────────────────────────────────────────

@router.get("", dependencies=[Depends(get_current_admin)])
async def admin_list_users(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    blocked: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(User).order_by(User.created_at.desc())
    count_query = select(func.count()).select_from(User)

    if blocked is not None:
        query = query.where(User.is_blocked == blocked)
        count_query = count_query.where(User.is_blocked == blocked)

    total = (await db.execute(count_query)).scalar_one()
    offset = (page - 1) * limit
    users = (await db.execute(query.offset(offset).limit(limit))).scalars().all()

    results = []
    for user in users:
        decrypted = _decrypt_user(user)

        # If searching, filter client-side on decrypted values (small dataset)
        if search:
            s = search.lower()
            name_match  = s in user.name.lower()
            email_match = decrypted["email"] and s in decrypted["email"].lower()
            phone_match = decrypted["phone"] and s in decrypted["phone"].lower()
            if not (name_match or email_match or phone_match):
                continue

        # Order counts
        total_orders = (await db.execute(
            select(func.count()).select_from(Order).where(Order.user_id == user.id)
        )).scalar_one()

        return_count = (await db.execute(
            select(func.count()).select_from(Order).where(
                Order.user_id == user.id,
                Order.status.in_(["return_requested", "returned"])
            )
        )).scalar_one()

        results.append({
            "id": user.id,
            "name": user.name,
            "email": decrypted["email"],
            "phone": decrypted["phone"],
            "auth_method": user.auth_method,
            "is_active": user.is_active,
            "is_blocked": user.is_blocked,
            "blocked_reason": user.blocked_reason,
            "blocked_at": user.blocked_at.isoformat() if user.blocked_at else None,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "total_orders": total_orders,
            "return_count": return_count,
        })

    pages = max(1, (total + limit - 1) // limit)
    return {"users": results, "total": total, "page": page, "pages": pages}


# ─────────────────────────────────────────────
# GET /admin/users/{id} — User detail + orders
# ─────────────────────────────────────────────

@router.get("/{user_id}", dependencies=[Depends(get_current_admin)])
async def admin_get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = (await db.scalars(select(User).where(User.id == user_id))).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    decrypted = _decrypt_user(user)

    total_orders = (await db.execute(
        select(func.count()).select_from(Order).where(Order.user_id == user_id)
    )).scalar_one()

    return_count = (await db.execute(
        select(func.count()).select_from(Order).where(
            Order.user_id == user_id,
            Order.status.in_(["return_requested", "returned"])
        )
    )).scalar_one()

    # Last 20 orders for this user
    orders_raw = (await db.execute(
        select(Order)
        .where(Order.user_id == user_id)
        .order_by(Order.created_at.desc())
        .limit(20)
    )).scalars().all()

    orders = [
        {
            "id": o.id,
            "order_number": o.order_number,
            "status": o.status,
            "payment_method": o.payment_method,
            "payment_status": o.payment_status,
            "total": float(o.total),
            "return_reason": o.return_reason,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in orders_raw
    ]

    return {
        "id": user.id,
        "name": user.name,
        "email": decrypted["email"],
        "phone": decrypted["phone"],
        "auth_method": user.auth_method,
        "is_active": user.is_active,
        "is_blocked": user.is_blocked,
        "blocked_reason": user.blocked_reason,
        "blocked_at": user.blocked_at.isoformat() if user.blocked_at else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "total_orders": total_orders,
        "return_count": return_count,
        "orders": orders,
    }


# ─────────────────────────────────────────────
# POST /admin/users/{id}/block
# ─────────────────────────────────────────────

@router.post("/{user_id}/block")
async def admin_block_user(
    user_id: int,
    payload: BlockUserRequest,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.scalars(select(User).where(User.id == user_id))).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_blocked:
        raise HTTPException(status_code=400, detail="User is already blocked")

    user.is_blocked     = True
    user.blocked_reason = payload.reason
    user.blocked_at     = datetime.utcnow()
    user.blocked_by     = admin.id

    # Revoke all active sessions so they get logged out immediately
    active_sessions = (await db.execute(
        select(UserSession).where(
            UserSession.user_id == user_id,
            UserSession.is_revoked == False,
        )
    )).scalars().all()
    for s in active_sessions:
        s.is_revoked = True

    await db.commit()
    await session_store.revoke_all_user_sessions(user_id)
    return {"message": f"User '{user.name}' has been blocked"}


# ─────────────────────────────────────────────
# POST /admin/users/{id}/unblock
# ─────────────────────────────────────────────

@router.post("/{user_id}/unblock")
async def admin_unblock_user(
    user_id: int,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.scalars(select(User).where(User.id == user_id))).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_blocked:
        raise HTTPException(status_code=400, detail="User is not blocked")

    user.is_blocked     = False
    user.blocked_reason = None
    user.blocked_at     = None
    user.blocked_by     = None

    await db.commit()
    return {"message": f"User '{user.name}' has been unblocked"}