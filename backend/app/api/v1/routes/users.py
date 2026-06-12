from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update, delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import encrypt_field, decrypt_field, hash_for_search
from app.schemas.user import AddressCreate, AddressOut, ProfileUpdate, UserOut

router = APIRouter(prefix="/api/v1/users", tags=["Users"])


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _decrypt_address_row(row) -> AddressOut:
    """Decrypt sensitive address fields before returning."""
    def safe_decrypt(val):
        if not val:
            return val
        try:
            return decrypt_field(val)
        except Exception:
            return val

    return AddressOut(
        id=row["id"],
        label=row["label"] or "Home",
        name=safe_decrypt(row["name"]),
        phone=safe_decrypt(row["phone"]),
        house_no=row["house_no"],
        area=row["area"],
        village=row["village"],
        taluka=row["taluka"],
        district=row["district"],
        pincode=row["pincode"],
        state=row["state"] or "Gujarat",
        is_default=bool(row["is_default"]),
        gstin=safe_decrypt(row["gstin"]) if row.get("gstin") else None,
    )


# ─────────────────────────────────────────────
# Addresses
# ─────────────────────────────────────────────

@router.get("/addresses", response_model=List[AddressOut])
async def list_addresses(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    rows = (await db.execute(
        text("SELECT * FROM addresses WHERE user_id = :uid ORDER BY is_default DESC, id DESC"),
        {"uid": current_user.id},
    )).mappings().all()
    return [_decrypt_address_row(r) for r in rows]


@router.post("/addresses", response_model=AddressOut)
async def add_address(
    payload: AddressCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Count existing addresses
    count = (await db.execute(
        text("SELECT COUNT(*) FROM addresses WHERE user_id = :uid"),
        {"uid": current_user.id},
    )).scalar_one()
    is_default = count == 0  # First address is always default

    # Encrypt sensitive fields
    enc_name = encrypt_field(payload.name)
    enc_phone = encrypt_field(payload.phone)
    enc_gstin = encrypt_field(payload.gstin) if payload.gstin else None

    result = await db.execute(
        text("""
            INSERT INTO addresses (user_id, label, name, phone, house_no, area, village, taluka, district, pincode, state, is_default, gstin)
            VALUES (:uid, :label, :name, :phone, :house_no, :area, :village, :taluka, :district, :pincode, :state, :is_default, :gstin)
            RETURNING *
        """),
        {
            "uid": current_user.id,
            "label": payload.label,
            "name": enc_name,
            "phone": enc_phone,
            "house_no": payload.house_no,
            "area": payload.area,
            "village": payload.village,
            "taluka": payload.taluka,
            "district": payload.district,
            "pincode": payload.pincode,
            "state": payload.state,
            "is_default": is_default,
            "gstin": enc_gstin,
        },
    )
    row = result.mappings().first()
    await db.commit()
    return _decrypt_address_row(row)


@router.put("/addresses/{id}", response_model=AddressOut)
async def update_address(
    id: int,
    payload: AddressCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Verify ownership
    existing = (await db.execute(
        text("SELECT id FROM addresses WHERE id = :id AND user_id = :uid"),
        {"id": id, "uid": current_user.id},
    )).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Address not found")

    enc_name = encrypt_field(payload.name)
    enc_phone = encrypt_field(payload.phone)
    enc_gstin = encrypt_field(payload.gstin) if payload.gstin else None

    result = await db.execute(
        text("""
            UPDATE addresses
            SET label=:label, name=:name, phone=:phone, house_no=:house_no,
                area=:area, village=:village, taluka=:taluka, district=:district,
                pincode=:pincode, state=:state, gstin=:gstin
            WHERE id=:id AND user_id=:uid
            RETURNING *
        """),
        {
            "label": payload.label,
            "name": enc_name,
            "phone": enc_phone,
            "house_no": payload.house_no,
            "area": payload.area,
            "village": payload.village,
            "taluka": payload.taluka,
            "district": payload.district,
            "pincode": payload.pincode,
            "state": payload.state,
            "gstin": enc_gstin,
            "id": id,
            "uid": current_user.id,
        },
    )
    row = result.mappings().first()
    await db.commit()
    return _decrypt_address_row(row)


@router.delete("/addresses/{id}")
async def delete_address(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    row = (await db.execute(
        text("SELECT is_default FROM addresses WHERE id = :id AND user_id = :uid"),
        {"id": id, "uid": current_user.id},
    )).first()
    if not row:
        raise HTTPException(status_code=404, detail="Address not found")

    if row[0]:  # is_default
        count = (await db.execute(
            text("SELECT COUNT(*) FROM addresses WHERE user_id = :uid"),
            {"uid": current_user.id},
        )).scalar_one()
        if count > 1:
            raise HTTPException(status_code=400, detail="Cannot delete default address. Set another address as default first.")

    await db.execute(
        text("DELETE FROM addresses WHERE id = :id AND user_id = :uid"),
        {"id": id, "uid": current_user.id},
    )
    await db.commit()
    return {"message": "Address deleted"}


@router.patch("/addresses/{id}/default")
async def set_default_address(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Verify ownership
    existing = (await db.execute(
        text("SELECT id FROM addresses WHERE id = :id AND user_id = :uid"),
        {"id": id, "uid": current_user.id},
    )).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Address not found")

    # Clear all defaults for this user
    await db.execute(
        text("UPDATE addresses SET is_default=FALSE WHERE user_id=:uid"),
        {"uid": current_user.id},
    )
    # Set new default
    await db.execute(
        text("UPDATE addresses SET is_default=TRUE WHERE id=:id AND user_id=:uid"),
        {"id": id, "uid": current_user.id},
    )
    await db.commit()
    return {"message": "Default address updated"}


# ─────────────────────────────────────────────
# Profile
# ─────────────────────────────────────────────

@router.get("/profile", response_model=UserOut)
async def get_profile(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    def safe_decrypt(val):
        if not val:
            return val
        try:
            return decrypt_field(val)
        except Exception:
            return val

    return UserOut(
        id=current_user.id,
        name=current_user.name,
        email=safe_decrypt(current_user.email),
        phone=safe_decrypt(current_user.phone),
        is_verified=current_user.is_verified,
        auth_method=current_user.auth_method,
    )


@router.put("/profile", response_model=UserOut)
async def update_profile(
    payload: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from app.models.user import User

    user = (await db.scalars(select(User).where(User.id == current_user.id))).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.name is not None:
        user.name = payload.name

    if payload.email is not None:
        enc_email = encrypt_field(str(payload.email))
        email_hash = hash_for_search(str(payload.email))
        user.email = enc_email
        if hasattr(user, "email_hash"):
            user.email_hash = email_hash

    if payload.phone is not None:
        enc_phone = encrypt_field(payload.phone)
        phone_hash = hash_for_search(payload.phone)
        user.phone = enc_phone
        if hasattr(user, "phone_hash"):
            user.phone_hash = phone_hash

    await db.commit()
    await db.refresh(user)

    def safe_decrypt(val):
        if not val:
            return val
        try:
            return decrypt_field(val)
        except Exception:
            return val

    return UserOut(
        id=user.id,
        name=user.name,
        email=safe_decrypt(user.email),
        phone=safe_decrypt(user.phone),
        is_verified=user.is_verified,
        auth_method=user.auth_method,
    )