from __future__ import annotations

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.sql import func
from app.core.database import Base


class Wishlist(Base):
    """One wishlist per user. Auto-created on first item add."""
    __tablename__ = "wishlists"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    share_token = Column(String(32), nullable=False, unique=True)   # public URL slug
    title       = Column(String(120), default="My Wishlist", nullable=False)
    is_public   = Column(Boolean, default=True, nullable=False)     # share link enabled?
    created_at  = Column(DateTime(timezone=False), server_default=func.now())
    updated_at  = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now())


class WishlistItem(Base):
    """A single product inside a wishlist."""
    __tablename__ = "wishlist_items"

    id          = Column(Integer, primary_key=True, index=True)
    wishlist_id = Column(Integer, ForeignKey("wishlists.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id  = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    added_at    = Column(DateTime(timezone=False), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("wishlist_id", "product_id", name="wishlist_items_unique"),
    )