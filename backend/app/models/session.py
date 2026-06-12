"""
models/session.py  —  ORM models for user & admin sessions
Place at:  app/models/session.py
"""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from app.core.database import Base

IST = ZoneInfo("Asia/Kolkata")


def _istnow() -> datetime:
    return datetime.now(IST).replace(tzinfo=None)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    jti         = Column(String(64), unique=True, nullable=False, index=True)
    device_info = Column(Text, nullable=True)
    ip_address  = Column(String(45), nullable=True)
    created_at  = Column(DateTime, default=_istnow)
    last_used   = Column(DateTime, default=_istnow, onupdate=_istnow)
    expires_at  = Column(DateTime, nullable=False)
    is_revoked  = Column(Boolean, default=False)


class AdminSession(Base):
    __tablename__ = "admin_sessions"

    id          = Column(Integer, primary_key=True, index=True)
    admin_id    = Column(Integer, ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False, index=True)
    jti         = Column(String(64), unique=True, nullable=False, index=True)
    device_info = Column(Text, nullable=True)
    ip_address  = Column(String(45), nullable=True)
    created_at  = Column(DateTime, default=_istnow)
    last_used   = Column(DateTime, default=_istnow, onupdate=_istnow)
    expires_at  = Column(DateTime, nullable=False)
    is_revoked  = Column(Boolean, default=False)