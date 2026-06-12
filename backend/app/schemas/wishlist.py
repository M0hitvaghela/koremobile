from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


# ── Item inside a wishlist response ──────────────────────────────────────────

class WishlistProductOut(BaseModel):
    """Minimal product data embedded inside wishlist response."""
    id: int
    slug: str
    name: str
    brand: str
    category: str
    primary_image: Optional[str] = None
    min_price: float
    min_mrp: float
    max_discount_percent: float
    in_stock: bool
    avg_rating: float
    review_count: int


class WishlistItemOut(BaseModel):
    id: int
    product_id: int
    added_at: datetime
    product: WishlistProductOut

    class Config:
        from_attributes = True


# ── Wishlist response ─────────────────────────────────────────────────────────

class WishlistOut(BaseModel):
    id: int
    user_id: int
    share_token: str
    share_url: str          # computed by route: FRONTEND_URL/wishlist/<share_token>
    title: str
    is_public: bool
    item_count: int
    items: List[WishlistItemOut]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Public (shared) wishlist — no user_id exposed ────────────────────────────

class PublicWishlistOut(BaseModel):
    share_token: str
    title: str
    item_count: int
    items: List[WishlistItemOut]


# ── Request bodies ────────────────────────────────────────────────────────────

class WishlistTitleUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)


class WishlistVisibilityUpdate(BaseModel):
    is_public: bool