from passlib.context import CryptContext
from cryptography.fernet import Fernet
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from typing import Optional, Dict, Any, Tuple
from uuid import uuid4
from .config import settings
import hashlib


# ============================================================================
# PASSWORD HASHING (Bcrypt)
# ============================================================================

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a plain text password using bcrypt"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against bcrypt hash"""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


# ============================================================================
# FIELD ENCRYPTION (Fernet - symmetric encryption)
# ============================================================================

def get_cipher() -> Fernet:
    """Get Fernet cipher instance"""
    return Fernet(settings.ENCRYPTION_KEY.encode())


def encrypt_field(value: str) -> str:
    """Encrypt sensitive field (e.g., phone, GST number)"""
    try:
        cipher = get_cipher()
        encrypted = cipher.encrypt(value.encode())
        return encrypted.decode()
    except Exception:
        return value


def decrypt_field(value: str) -> str:
    """Decrypt sensitive field"""
    try:
        cipher = get_cipher()
        decrypted = cipher.decrypt(value.encode())
        return decrypted.decode()
    except Exception:
        return value


# ============================================================================
# JWT TOKEN GENERATION (User & Admin)
# ============================================================================

def create_user_token(user_id: int, email: str) -> Tuple[str, str, datetime]:
    """
    Create JWT token for regular user.
    Returns (token, jti, expires_at) — jti is stored in DB for session tracking/revocation.

    NOTE: Return signature changed from `str` to `Tuple[str, str, datetime]`.
    Update call sites:  token, jti, expires_at = create_user_token(...)
    """
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS)
    jti = str(uuid4())

    payload: Dict[str, Any] = {
        "sub": str(user_id),
        "email": email,
        "role": "user",
        "exp": expires,
        "iat": now,
        "jti": jti,
    }

    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return token, jti, expires.replace(tzinfo=None)


def create_admin_token(admin_id: int, username: str) -> Tuple[str, str, datetime]:
    """
    Create JWT token for admin user.
    Returns (token, jti, expires_at).
    """
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=settings.ADMIN_TOKEN_EXPIRE_HOURS)
    jti = str(uuid4())

    payload: Dict[str, Any] = {
        "sub": str(admin_id),
        "username": username,
        "role": "admin",
        "exp": expires,
        "iat": now,
        "jti": jti,
    }

    token = jwt.encode(payload, settings.ADMIN_SECRET_KEY, algorithm=settings.ALGORITHM)
    return token, jti, expires.replace(tzinfo=None)


# ============================================================================
# JWT TOKEN VERIFICATION
# ============================================================================

def verify_token(token: str, secret: str) -> Optional[Dict[str, Any]]:
    """Verify JWT token and return payload. Returns None if invalid or expired."""
    try:
        return jwt.decode(token, secret, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


def hash_for_search(value: str) -> str:
    """Return a lowercase SHA-256 hex digest for deterministic searching."""
    try:
        return hashlib.sha256(value.lower().encode()).hexdigest()
    except Exception:
        return ""