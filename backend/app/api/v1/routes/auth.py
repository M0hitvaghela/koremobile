from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import select, text
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import (
    hash_password,
    verify_password,
    encrypt_field,
    decrypt_field,
    create_user_token,
    hash_for_search,
)
from app.models.user import User
from app.models.session import UserSession
from app.schemas.auth import (
    RegisterEmailRequest,
    RegisterEmailOtpSendRequest,
    RegisterEmailOtpVerifyRequest,
    ForgotPasswordRequest,
    ForgotPasswordVerifyRequest,
    ResetPasswordRequest,
    RegisterOTPRequest,
    LoginEmailRequest,
    OTPSendRequest,
    OTPVerifyRequest,
    TokenResponse,
    UserOut,
    SessionOut,
)
from app.services import otp_service, email_service
from app.core.redis import cache_otp, CacheTTL, session_store
from app.core.limiter import limiter, enforce_rate_limit

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

COOKIE_NAME = "koremobile-session"
COOKIE_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_HOURS * 3600


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=False,   # Set True in production (HTTPS)
        path="/",
    )


def _device_info(request: Request) -> str:
    return request.headers.get("user-agent", "unknown")[:512]


def _ip_address(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _create_user_session(
    db: AsyncSession, user_id: int, jti: str, expires_at: datetime, request: Request
) -> None:
    session = UserSession(
        user_id     = user_id,
        jti         = jti,
        device_info = _device_info(request),
        ip_address  = _ip_address(request),
        expires_at  = expires_at,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    await session_store.store_user_session(
        session_id=session.id,
        user_id=user_id,
        jti=jti,
        device_info=session.device_info or "",
        ip_address=session.ip_address or "",
        expires_at=expires_at,
    )


# ============================================================================
# REGISTER
# ============================================================================

@limiter.limit("5/hour")
@router.post("/register/email", response_model=TokenResponse)
async def register_email(
    request: Request,
    response: Response,
    payload: RegisterEmailRequest,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    await enforce_rate_limit(request, "auth:register_email", 5, 3600)
    # ── email dedup ──────────────────────────────────────────────────────────
    email_hash = hash_for_search(payload.email)
    existing = await db.scalar(select(User.id).where(User.email_hash == email_hash))
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # ── phone dedup (only if provided) ──────────────────────────────────────
    phone_hash = None
    encrypted_phone = None
    if payload.phone:
        phone_hash = hash_for_search(payload.phone)
        phone_taken = await db.scalar(select(User.id).where(User.phone_hash == phone_hash))
        if phone_taken:
            raise HTTPException(status_code=400, detail="Phone already registered")
        encrypted_phone = encrypt_field(payload.phone)

    hashed = hash_password(payload.password)
    encrypted_email = encrypt_field(payload.email)

    user = User(
        name=payload.name,
        email=encrypted_email,
        email_hash=email_hash,
        phone=encrypted_phone,
        phone_hash=phone_hash,
        hashed_password=hashed,
        auth_method="email",
        is_verified=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    background.add_task(email_service.send_welcome_email, user.name, payload.email)

    token, jti, expires_at = create_user_token(user.id, payload.email)
    await _create_user_session(db, user.id, jti, expires_at, request)
    _set_auth_cookie(response, token)
    return TokenResponse(access_token=token, expires_in=COOKIE_MAX_AGE)


@limiter.limit("5/hour")
@router.post("/register/email/send-otp")
async def register_email_send_otp(
    request: Request, payload: RegisterEmailOtpSendRequest, db: AsyncSession = Depends(get_db)
):
    await enforce_rate_limit(request, "auth:register_email_send_otp", 5, 3600)
    email_hash = hash_for_search(payload.email)
    existing = await db.scalar(select(User.id).where(User.email_hash == email_hash))
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    if await otp_service.otp_recently_sent(payload.email):
        raise HTTPException(status_code=429, detail="OTP already sent. Please wait before retrying.")
    ok = await otp_service.send_email_otp(payload.email)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to send email OTP")
    return {"message": "OTP sent", "step": "verify_email"}


@limiter.limit("10/hour")
@router.post("/register/email/verify")
async def register_email_verify(request: Request, payload: RegisterEmailOtpVerifyRequest):
    await enforce_rate_limit(request, "auth:register_email_verify", 10, 3600)
    ok = await otp_service.verify_email_otp(payload.email, payload.otp)
    if not ok:
        raise HTTPException(status_code=401, detail="Invalid OTP")
    return {"message": "Email verified"}


@limiter.limit("5/hour")
@router.post("/password/forgot")
async def forgot_password(
    request: Request, payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)
):
    await enforce_rate_limit(request, "auth:forgot_password", 5, 3600)
    email_hash = hash_for_search(payload.email)
    user = (await db.scalars(select(User).where(User.email_hash == email_hash))).first()
    if not user:
        return {"message": "If the account exists, OTP has been sent"}

    if await otp_service.otp_recently_sent(payload.email):
        raise HTTPException(status_code=429, detail="OTP already sent. Please wait before retrying.")
    ok = await otp_service.send_email_otp(payload.email)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to send OTP")
    return {"message": "OTP sent"}


@limiter.limit("10/hour")
@router.post("/password/verify")
async def forgot_password_verify(request: Request, payload: ForgotPasswordVerifyRequest):
    await enforce_rate_limit(request, "auth:forgot_password_verify", 10, 3600)
    ok = await otp_service.verify_email_otp(payload.email, payload.otp)
    if not ok:
        raise HTTPException(status_code=401, detail="Invalid OTP")
    await cache_otp.set(f"pwd_reset_verified:{payload.email}", True, CacheTTL.OTP_TTL)
    return {"message": "OTP verified"}


@limiter.limit("10/hour")
@router.post("/password/reset")
async def reset_password(
    request: Request, payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
):
    await enforce_rate_limit(request, "auth:reset_password", 10, 3600)
    verified = await cache_otp.get(f"pwd_reset_verified:{payload.email}")
    if not verified:
        raise HTTPException(status_code=401, detail="OTP not verified")

    email_hash = hash_for_search(payload.email)
    user = (await db.scalars(select(User).where(User.email_hash == email_hash))).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(payload.new_password)
    user.is_verified = True
    await db.commit()
    await cache_otp.delete(f"pwd_reset_verified:{payload.email}")
    return {"message": "Password updated"}


@limiter.limit("5/hour")
@router.post("/register/otp")
async def register_otp(
    request: Request,
    payload: RegisterOTPRequest,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    await enforce_rate_limit(request, "auth:register_otp", 5, 3600)
    phone_hash = hash_for_search(payload.phone)
    existing = await db.scalar(select(User.id).where(User.phone_hash == phone_hash))
    if existing:
        raise HTTPException(status_code=400, detail="Phone already registered")

    encrypted_phone = encrypt_field(payload.phone)
    user = User(
        name=payload.name,
        phone=encrypted_phone,
        phone_hash=phone_hash,
        auth_method="otp",
        is_verified=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    if await otp_service.otp_recently_sent(payload.phone):
        raise HTTPException(status_code=429, detail="OTP already sent. Please wait before retrying.")
    background.add_task(otp_service.send_sms_otp, payload.phone, None)
    return {"message": "OTP sent", "step": "verify_otp"}


# ============================================================================
# LOGIN
# ============================================================================

@limiter.limit("10/hour")
@router.post("/login/email", response_model=TokenResponse)
async def login_email(
    request: Request,
    response: Response,
    payload: LoginEmailRequest,
    db: AsyncSession = Depends(get_db),
):
    await enforce_rate_limit(request, "auth:login_email", 10, 3600)
    email_hash = hash_for_search(payload.email)
    user = (await db.scalars(select(User).where(User.email_hash == email_hash))).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # ── Block check ───────────────────────────────────────────────────────────
    if user.is_blocked:
        reason = user.blocked_reason or "Account has been suspended"
        raise HTTPException(status_code=403, detail=f"Your account has been blocked. Reason: {reason}")

    token, jti, expires_at = create_user_token(user.id, payload.email)
    user.is_verified = True
    await db.commit()

    await _create_user_session(db, user.id, jti, expires_at, request)
    _set_auth_cookie(response, token)
    return TokenResponse(access_token=token, expires_in=COOKIE_MAX_AGE)


@limiter.limit("5/hour")
@router.post("/login/otp/send")
async def login_otp_send(
    request: Request, payload: OTPSendRequest, db: AsyncSession = Depends(get_db)
):
    await enforce_rate_limit(request, "auth:login_otp_send", 5, 3600)
    phone_hash = hash_for_search(payload.phone)
    user = (await db.scalars(select(User).where(User.phone_hash == phone_hash))).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if await otp_service.otp_recently_sent(payload.phone):
        raise HTTPException(status_code=429, detail="OTP already sent. Please wait before retrying.")
    ok = await otp_service.send_sms_otp(payload.phone, None)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to send OTP")
    return {"message": "OTP sent"}


@limiter.limit("5/hour")
@router.post("/login/otp/verify", response_model=TokenResponse)
async def login_otp_verify(
    request: Request,
    response: Response,
    payload: OTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    await enforce_rate_limit(request, "auth:login_otp_verify", 5, 3600)
    phone_hash = hash_for_search(payload.phone)
    user = (await db.scalars(select(User).where(User.phone_hash == phone_hash))).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    ok = await otp_service.verify_sms_otp(payload.phone, payload.otp)
    if not ok:
        raise HTTPException(status_code=401, detail="Invalid OTP")

    # ── Block check ───────────────────────────────────────────────────────────
    if user.is_blocked:
        reason = user.blocked_reason or "Account has been suspended"
        raise HTTPException(status_code=403, detail=f"Your account has been blocked. Reason: {reason}")

    user.is_verified = True
    await db.commit()

    email_plain = decrypt_field(user.email or "") if user.email else ""
    token, jti, expires_at = create_user_token(user.id, email_plain)

    await _create_user_session(db, user.id, jti, expires_at, request)
    _set_auth_cookie(response, token)
    return TokenResponse(access_token=token, expires_in=COOKIE_MAX_AGE)


# ============================================================================
# LOGOUT
# ============================================================================

@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    token = request.cookies.get(COOKIE_NAME) or ""
    if token:
        from app.core.security import verify_token
        payload = verify_token(token, settings.SECRET_KEY)
        if payload and (jti := payload.get("jti")):
            result = await db.execute(select(UserSession).where(UserSession.jti == jti))
            session = result.scalar_one_or_none()
            if session:
                session.is_revoked = True
                await db.commit()
            await session_store.revoke_user_session(jti)

    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"message": "Logged out"}


# ============================================================================
# SESSION MANAGEMENT
# ============================================================================

@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    token = request.cookies.get(COOKIE_NAME) or ""
    from app.core.security import verify_token
    payload = verify_token(token, settings.SECRET_KEY)
    current_jti = payload.get("jti") if payload else None

    def _ts_to_dt(ts: str) -> datetime:
        try:
            return datetime.fromtimestamp(float(ts))
        except Exception:
            return datetime.utcnow()

    sessions = await session_store.list_user_sessions(current_user.id)
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


@router.delete("/sessions/all")
async def logout_all_devices(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import update
    await db.execute(
        update(UserSession)
        .where(UserSession.user_id == current_user.id, UserSession.is_revoked == False)
        .values(is_revoked=True)
    )
    await db.commit()
    await session_store.revoke_all_user_sessions(current_user.id)
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"message": "Logged out from all devices"}


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserSession).where(
            UserSession.id      == session_id,
            UserSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.is_revoked = True
    await db.commit()
    await session_store.revoke_user_session_by_id(session_id)
    return {"message": "Session revoked"}


# ============================================================================
# ME
# ============================================================================

@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": decrypt_field(current_user.email) if current_user.email else None,
        "phone": decrypt_field(current_user.phone) if current_user.phone else None,
        "is_verified": current_user.is_verified,
        "auth_method": current_user.auth_method,
    }