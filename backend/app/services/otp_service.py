"""
OTP Service — Redis-backed (Module 4+ upgrade).

All OTPs are stored in Redis with TTL.
No writes to otp_log PostgreSQL table.
The otp_log table can be kept for audit history if needed
but is no longer required for OTP validation.
"""
from __future__ import annotations

import random
import string

from app.core.redis import cache_otp, otp_store, CacheTTL
from app.services import email_service


def _generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


async def send_otp(
    identifier: str,            # email or phone
    ip_address: str = "",
    length: int = 6,
    ttl: int = CacheTTL.OTP_TTL,
) -> str:
    """
    Generate and store OTP in Redis.
    Returns the plain OTP (caller sends it via email/SMS).
    """
    cooldown_key = f"otp:cooldown:{identifier}"
    if await cache_otp.get(cooldown_key):
        return ""

    otp = _generate_otp(length)
    await otp_store.store_otp(identifier, otp, ip_address=ip_address, ttl=ttl)
    await cache_otp.set(cooldown_key, True, CacheTTL.OTP_COOLDOWN)
    return otp


async def verify_otp(
    identifier: str,
    otp: str,
    max_attempts: int = 5,
) -> tuple[bool, str]:
    """
    Verify OTP from Redis.
    Returns (True, "ok") or (False, error_message).
    """
    return await otp_store.verify_otp(identifier, otp, max_attempts=max_attempts)


async def invalidate_otp(identifier: str) -> None:
    """Explicitly invalidate an OTP (e.g. after password reset)."""
    await otp_store.invalidate_otp(identifier)


async def otp_recently_sent(identifier: str) -> bool:
    """Check if an OTP was already sent (to prevent spam)."""
    return await cache_otp.get(f"otp:cooldown:{identifier}") is not None


async def send_email_otp(
    email: str,
    name: str | None = None,
    ip_address: str = "",
) -> bool:
    """Generate OTP, store in Redis, and email it to the user."""
    otp = await send_otp(email, ip_address=ip_address)
    if not otp:
        return False
    display_name = name or "there"
    sent = await email_service.send_otp_email(email, otp, display_name)
    if not sent:
        await invalidate_otp(email)
    return sent


async def verify_email_otp(email: str, otp: str) -> bool:
    """Verify email OTP from Redis."""
    ok, _ = await verify_otp(email, otp)
    return ok


async def send_sms_otp(
    phone: str,
    name: str | None = None,
    ip_address: str = "",
) -> bool:
    """
    Generate OTP, store in Redis, and send via SMS.
    SMS integration can be added later (Twilio, etc.).
    """
    otp = await send_otp(phone, ip_address=ip_address)
    return bool(otp)


async def verify_sms_otp(phone: str, otp: str) -> bool:
    """Verify SMS OTP from Redis."""
    ok, _ = await verify_otp(phone, otp)
    return ok