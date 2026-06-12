from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.core.database import get_db
from app.models.admin_user import AdminUser
from app.models.session import AdminSession
from app.schemas.auth import (
    AdminLoginRequest,
    AdminTokenResponse,
    SessionOut,
    AdminOTPVerifyRequest,
    AdminForgotPasswordRequest,
    AdminResetPasswordRequest,
)
from app.core.security import verify_password, hash_password, create_admin_token, verify_token
from app.core import settings
from app.core.limiter import limiter, enforce_rate_limit
from app.core.dependencies import get_current_admin
from app.core.redis import cache_otp, session_store
from app.services import otp_service, email_service

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])

ADMIN_COOKIE_NAME = "koremobile-admin-session"
ADMIN_COOKIE_MAX_AGE = settings.ADMIN_TOKEN_EXPIRE_HOURS * 3600

# Redis key prefix for 2FA pending logins
_2FA_PREFIX = "admin_2fa:"


def _set_admin_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=ADMIN_COOKIE_NAME,
        value=token,
        max_age=ADMIN_COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=False,   # Set True in production
        path="/",
    )


def _device_info(request: Request) -> str:
    return request.headers.get("user-agent", "unknown")[:512]


def _ip_address(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _create_admin_session(
    db: AsyncSession, admin_id: int, jti: str, expires_at: datetime, request: Request
) -> None:
    session = AdminSession(
        admin_id    = admin_id,
        jti         = jti,
        device_info = _device_info(request),
        ip_address  = _ip_address(request),
        expires_at  = expires_at,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    await session_store.store_admin_session(
        session_id=session.id,
        admin_id=admin_id,
        jti=jti,
        device_info=session.device_info or "",
        ip_address=session.ip_address or "",
        expires_at=expires_at,
    )


# ============================================================================
# STEP 1 — LOGIN (username + password → sends 2FA OTP)
# ============================================================================

@router.post("/auth/login")
@limiter.limit("10/hour")
async def admin_login(
    request: Request,
    payload: AdminLoginRequest = Body(...),
    db: AsyncSession = Depends(get_db),
):
    await enforce_rate_limit(request, "admin:login", 10, 3600)
    """
    Step 1 of 2FA login.
    Validates username/password, then sends OTP to admin's email.
    Returns { otp_required: true, email: "m***@example.com" }
    """
    admin = (
        await db.scalars(
            select(AdminUser).where(
                (AdminUser.username == payload.username) | (AdminUser.email == payload.username)
            )
        )
    ).first()

    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if admin.locked_until and admin.locked_until > datetime.now(timezone.utc):
        raise HTTPException(status_code=403, detail="Account locked. Try later.")

    if not verify_password(payload.password, admin.hashed_password):
        admin.failed_attempts = (admin.failed_attempts or 0) + 1
        await db.commit()
        if (admin.failed_attempts or 0) >= 5:
            admin.locked_until = datetime.now(timezone.utc) + timedelta(minutes=30)
            await db.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Credentials valid — send 2FA OTP
    if not admin.email:
        raise HTTPException(status_code=400, detail="Admin has no email configured for 2FA")

    # Use a prefixed key so it doesn't collide with customer OTPs
    otp_key = f"{_2FA_PREFIX}{admin.email}"

    # Prevent OTP spam (90-second cooldown handled inside otp_service)
    if await otp_service.otp_recently_sent(admin.email):
        raise HTTPException(status_code=429, detail="OTP already sent. Please wait before retrying.")
    sent = await otp_service.send_email_otp(
        email=admin.email,
        name=admin.username,
        ip_address=_ip_address(request),
    )
    if not sent:
        raise HTTPException(status_code=500, detail="Failed to send OTP email")

    # Mask email for frontend display  e.g. m***@gmail.com
    user, domain = admin.email.split("@", 1)
    masked = user[0] + "***@" + domain

    return {"otp_required": True, "email": masked, "admin_identifier": admin.email}


# ============================================================================
# STEP 2 — VERIFY 2FA OTP → issue session token
# ============================================================================

@router.post("/auth/login/verify-otp", response_model=AdminTokenResponse)
@limiter.limit("10/hour")
async def admin_login_verify_otp(
    request: Request,
    response: Response,
    payload: AdminOTPVerifyRequest = Body(...),
    db: AsyncSession = Depends(get_db),
):
    await enforce_rate_limit(request, "admin:login_verify_otp", 10, 3600)
    """
    Step 2 of 2FA login.
    Verifies the OTP and issues admin session cookie.
    """
    admin = (
        await db.scalars(
            select(AdminUser).where(AdminUser.email == payload.email)
        )
    ).first()

    if not admin:
        raise HTTPException(status_code=401, detail="Invalid session")

    ok, err = await otp_service.verify_otp(payload.email, payload.otp)
    if not ok:
        raise HTTPException(status_code=401, detail=err or "Invalid or expired OTP")

    # OTP valid — complete login
    admin.failed_attempts = 0
    admin.last_login = datetime.now(timezone.utc)
    await db.commit()

    token, jti, expires_at = create_admin_token(admin.id, admin.username)
    await _create_admin_session(db, admin.id, jti, expires_at, request)
    _set_admin_cookie(response, token)

    return AdminTokenResponse(access_token=token)


# ============================================================================
# ADMIN FORGOT PASSWORD — Step 1: send OTP
# ============================================================================

@router.post("/auth/forgot-password")
@limiter.limit("5/hour")
async def admin_forgot_password(
    request: Request,
    payload: AdminForgotPasswordRequest = Body(...),
    db: AsyncSession = Depends(get_db),
):
    await enforce_rate_limit(request, "admin:forgot_password", 5, 3600)
    admin = (
        await db.scalars(
            select(AdminUser).where(AdminUser.email == payload.email)
        )
    ).first()

    # Always return success to avoid email enumeration
    if not admin or not admin.email:
        return {"message": "If that email is registered, an OTP will be sent"}

    if await otp_service.otp_recently_sent(admin.email):
        raise HTTPException(status_code=429, detail="OTP already sent. Please wait before retrying.")
    sent = await otp_service.send_email_otp(
        email=admin.email,
        name=admin.username,
        ip_address=_ip_address(request),
    )
    return {"message": "If that email is registered, an OTP will be sent"}


# ============================================================================
# ADMIN FORGOT PASSWORD — Step 2: verify OTP
# ============================================================================

@router.post("/auth/forgot-password/verify")
@limiter.limit("10/hour")
async def admin_forgot_password_verify(
    request: Request,
    payload: AdminOTPVerifyRequest = Body(...),
    db: AsyncSession = Depends(get_db),
):
    await enforce_rate_limit(request, "admin:forgot_password_verify", 10, 3600)
    admin = (
        await db.scalars(
            select(AdminUser).where(AdminUser.email == payload.email)
        )
    ).first()

    if not admin:
        raise HTTPException(status_code=400, detail="Invalid request")

    ok, err = await otp_service.verify_otp(payload.email, payload.otp)
    if not ok:
        raise HTTPException(status_code=400, detail=err or "Invalid or expired OTP")

    # Store a short-lived "verified" flag so reset step doesn't need OTP again
    verified_key = f"admin_pwd_verified:{payload.email}"
    await cache_otp.set(verified_key, "1", ttl=600)  # 10 min window

    return {"message": "OTP verified"}


# ============================================================================
# ADMIN FORGOT PASSWORD — Step 3: reset password
# ============================================================================

@router.post("/auth/forgot-password/reset")
@limiter.limit("5/hour")
async def admin_reset_password(
    request: Request,
    payload: AdminResetPasswordRequest = Body(...),
    db: AsyncSession = Depends(get_db),
):
    await enforce_rate_limit(request, "admin:reset_password", 5, 3600)
    admin = (
        await db.scalars(
            select(AdminUser).where(AdminUser.email == payload.email)
        )
    ).first()

    if not admin:
        raise HTTPException(status_code=400, detail="Invalid request")

    # Check the verified flag set by the verify-OTP step
    verified_key = f"admin_pwd_verified:{payload.email}"
    flag = await cache_otp.get(verified_key)
    if not flag:
        raise HTTPException(status_code=400, detail="OTP verification expired. Please restart.")

    admin.hashed_password = hash_password(payload.new_password)
    admin.failed_attempts = 0
    admin.locked_until = None
    await db.commit()

    # Clean up both the flag and any leftover OTP
    await cache_otp.delete(verified_key)
    await otp_service.invalidate_otp(payload.email)
    return {"message": "Password updated successfully"}


# ============================================================================
# LOGOUT
# ============================================================================

@router.post("/auth/logout")
async def admin_logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    token = request.cookies.get(ADMIN_COOKIE_NAME) or ""
    if token:
        payload = verify_token(token, settings.ADMIN_SECRET_KEY)
        if payload and (jti := payload.get("jti")):
            result = await db.execute(select(AdminSession).where(AdminSession.jti == jti))
            session = result.scalar_one_or_none()
            if session:
                session.is_revoked = True
                await db.commit()
            await session_store.revoke_admin_session(jti)

    response.delete_cookie(key=ADMIN_COOKIE_NAME, path="/")
    return {"message": "Admin logged out"}


# ============================================================================
# SESSION MANAGEMENT
# ============================================================================

@router.get("/auth/sessions", response_model=list[SessionOut])
async def list_admin_sessions(
    request: Request,
    current_admin: AdminUser = Depends(get_current_admin),
):
    token = request.cookies.get(ADMIN_COOKIE_NAME) or ""
    payload = verify_token(token, settings.ADMIN_SECRET_KEY)
    current_jti = payload.get("jti") if payload else None

    def _ts_to_dt(ts: str) -> datetime:
        try:
            return datetime.fromtimestamp(float(ts))
        except Exception:
            return datetime.utcnow()

    sessions = await session_store.list_admin_sessions(current_admin.id)
    return [
        SessionOut(
            id=int(s.get("id", 0) or 0),
            device_info=s.get("device_info") or None,
            ip_address=s.get("ip_address") or None,
            created_at=_ts_to_dt(s.get("created_at_ts", "0")),
            last_used=_ts_to_dt(s.get("last_used_ts", "0")),
            is_current=(s.get("jti") == current_jti),
        )
        for s in sessions
    ]


@router.delete("/auth/sessions/all")
async def admin_logout_all_devices(
    request: Request,
    response: Response,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(AdminSession)
        .where(AdminSession.admin_id == current_admin.id, AdminSession.is_revoked == False)
        .values(is_revoked=True)
    )
    await db.commit()
    await session_store.revoke_all_admin_sessions(current_admin.id)
    response.delete_cookie(key=ADMIN_COOKIE_NAME, path="/")
    return {"message": "Logged out from all devices"}


@router.delete("/auth/sessions/{session_id}")
async def revoke_admin_session(
    session_id: int,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AdminSession).where(
            AdminSession.id       == session_id,
            AdminSession.admin_id == current_admin.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.is_revoked = True
    await db.commit()
    await session_store.revoke_admin_session_by_id(session_id)
    return {"message": "Session revoked"}


# ============================================================================
# ME
# ============================================================================

@router.get("/auth/me")
async def admin_me(current_admin: AdminUser = Depends(get_current_admin)):
    return {
        "id": current_admin.id,
        "username": current_admin.username,
        "email": current_admin.email,
        "role": "admin",
        "last_login": current_admin.last_login,
    }