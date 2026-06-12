from __future__ import annotations

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
)
from sqlalchemy.sql import func
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(Text, nullable=True)
    email_hash = Column(String(64), nullable=True, index=True)
    phone = Column(Text, nullable=True)
    phone_hash = Column(String(64), nullable=True, index=True)
    hashed_password = Column(Text, nullable=True)
    auth_method = Column(String(10), nullable=False, default="email")
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # ── User blocking ─────────────────────────────────────────────────────────
    is_blocked     = Column(Boolean, default=False, nullable=False)
    blocked_reason = Column(Text, nullable=True)
    blocked_at     = Column(DateTime(timezone=False), nullable=True)
    blocked_by     = Column(Integer, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True)