from __future__ import annotations

from sqlalchemy import Column, Integer, Text, Boolean, DateTime, ForeignKey, String
from sqlalchemy.sql import func
from app.core.database import Base


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    order_id = Column(Integer, nullable=True)

    rating = Column(Integer, nullable=False)        # 1-5
    title = Column(String(200), nullable=True)
    body = Column(Text, nullable=True)
    is_verified = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
