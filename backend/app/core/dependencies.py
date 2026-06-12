from __future__ import annotations

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional
from .config import settings
from .database import get_db
from .security import verify_token
from .redis import session_store

USER_MODEL = None
ADMIN_MODEL = None

COOKIE_NAME = "koremobile-session"
ADMIN_COOKIE_NAME = "koremobile-admin-session"


def set_models(user_model, admin_model):
    global USER_MODEL, ADMIN_MODEL
    USER_MODEL = user_model
    ADMIN_MODEL = admin_model


oauth2_user  = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login/email",  auto_error=False)
oauth2_admin = OAuth2PasswordBearer(tokenUrl="/api/v1/admin/auth/login",  auto_error=False)


def _extract_token(request: Request, bearer_token: Optional[str], cookie_name: str) -> Optional[str]:
    if bearer_token:
        return bearer_token
    return request.cookies.get(cookie_name) or None


async def _validate_user_session_jti(jti: str, db: AsyncSession) -> bool:
    return await session_store.validate_user_session(jti)


async def _validate_admin_session_jti(jti: str, db: AsyncSession) -> bool:
    return await session_store.validate_admin_session(jti)


# ============================================================================
# CURRENT USER DEPENDENCY
# ============================================================================

async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_user),
    db: AsyncSession = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    session_revoked_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Session has been revoked. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    resolved_token = _extract_token(request, token, COOKIE_NAME)
    if not resolved_token:
        raise credentials_exception

    payload = verify_token(resolved_token, settings.SECRET_KEY)
    if not payload:
        raise credentials_exception

    user_id: str = payload.get("sub")
    jti: str     = payload.get("jti")

    if not user_id:
        raise credentials_exception

    if jti and not await _validate_user_session_jti(jti, db):
        raise session_revoked_exception

    if not USER_MODEL:
        raise credentials_exception

    result = await db.execute(select(USER_MODEL).where(USER_MODEL.id == int(user_id)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")

    # ── Block check ───────────────────────────────────────────────────────────
    if user.is_blocked:
        reason = user.blocked_reason or "Account has been suspended"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your account has been blocked. Reason: {reason}",
        )

    return user


# ============================================================================
# CURRENT ADMIN DEPENDENCY
# ============================================================================

async def get_current_admin(
    request: Request,
    token: Optional[str] = Depends(oauth2_admin),
    db: AsyncSession = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid admin credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    session_revoked_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Admin session has been revoked. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    resolved_token = _extract_token(request, token, ADMIN_COOKIE_NAME)
    if not resolved_token:
        raise credentials_exception

    payload = verify_token(resolved_token, settings.ADMIN_SECRET_KEY)
    if not payload:
        raise credentials_exception

    admin_id: str = payload.get("sub")
    role: str     = payload.get("role")
    jti: str      = payload.get("jti")

    if not admin_id or role != "admin":
        raise credentials_exception

    if jti and not await _validate_admin_session_jti(jti, db):
        raise session_revoked_exception

    if not ADMIN_MODEL:
        raise credentials_exception

    result = await db.execute(select(ADMIN_MODEL).where(ADMIN_MODEL.id == int(admin_id)))
    admin = result.scalar_one_or_none()

    if not admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin not found")
    if not admin.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin account is inactive")

    return admin


# ============================================================================
# OPTIONAL USER DEPENDENCY
# ============================================================================

async def get_optional_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_user),
    db: AsyncSession = Depends(get_db),
) -> Optional[object]:
    resolved_token = _extract_token(request, token, COOKIE_NAME)
    if not resolved_token:
        return None

    payload = verify_token(resolved_token, settings.SECRET_KEY)
    if not payload:
        return None

    user_id: str = payload.get("sub")
    if not user_id or not USER_MODEL:
        return None

    try:
        result = await db.execute(select(USER_MODEL).where(USER_MODEL.id == int(user_id)))
        user = result.scalar_one_or_none()
        # Also return None if blocked — they can still browse but not checkout
        if not user or not user.is_active or user.is_blocked:
            return None
        return user
    except Exception:
        return None