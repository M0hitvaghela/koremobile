from __future__ import annotations

from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, String
from sqlalchemy.sql import func
from app.core.database import Base


class BlockedReview(Base):
    __tablename__ = "blocked_reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(Integer, nullable=False)
    review_title  = Column(String(200), nullable=True)
    review_body   = Column(Text, nullable=True)
    review_rating = Column(Integer, nullable=True)
    reason = Column(Text, nullable=True)           # optional admin note
    blocked_at = Column(DateTime(timezone=True), server_default=func.now())