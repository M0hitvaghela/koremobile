from __future__ import annotations

from sqlalchemy import (
    Column,
    Integer,
    Text,
    Boolean,
    DateTime,
)
from sqlalchemy.sql import func
from app.core.database import Base


class OTPLog(Base):
    __tablename__ = "otp_log"

    id = Column(Integer, primary_key=True, index=True)
    identifier = Column(Text, nullable=False)  # phone or email
    otp_hash = Column(Text, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, default=False)
    attempts = Column(Integer, default=0)
    ip_address = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
