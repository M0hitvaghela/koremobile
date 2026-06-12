from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field, computed_field

# ── Valid GST rates under Indian GST law ─────────────────────────────────────
GST_RATES = [0.0, 5.0, 12.0, 18.0, 28.0]


# ── Variant schemas ───────────────────────────────────────────────────────────

class VariantCreate(BaseModel):
    """Used when creating a brand-new product. No id needed."""
    color: str
    storage: str
    price: float = Field(..., gt=0)
    mrp: float = Field(..., gt=0)
    stock: int = Field(..., ge=0)


class VariantUpsert(BaseModel):
    """
    Used when updating a product's variants.
    - id present  → UPDATE that existing variant in place (safe for FK references)
    - id absent   → INSERT a new variant
    """
    id: Optional[int] = None
    color: str
    storage: str
    price: float = Field(..., gt=0)
    mrp: float = Field(..., gt=0)
    stock: int = Field(..., ge=0)


class VariantOut(BaseModel):
    id: int
    color: str
    storage: str
    price: float          # GST-inclusive selling price
    mrp: float            # GST-inclusive MRP
    stock: int
    is_active: bool

    @computed_field
    @property
    def discount_percent(self) -> int:
        if self.mrp <= 0:
            return 0
        return int(round((self.mrp - self.price) / self.mrp * 100))


# ── Spec schemas ──────────────────────────────────────────────────────────────

class SpecCreate(BaseModel):
    spec_key: str
    spec_value: str
    display_order: int = 0


class SpecOut(BaseModel):
    id: int
    spec_key: str
    spec_value: str
    display_order: int


# ── Badge schemas ─────────────────────────────────────────────────────────────

class BadgeCreate(BaseModel):
    badge_key: str
    label: Optional[str] = None
    display_order: int = 0


class BadgeOut(BaseModel):
    id: int
    badge_key: str
    label: Optional[str] = None
    display_order: int


# ── Product schemas ───────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    name: str = Field(..., min_length=3)
    brand: str
    category: str
    description: Optional[str] = None
    allow_cod: bool = True
    allow_online: bool = True
    is_active: bool = True
    # ── GST fields ────────────────────────────────────────────────────────────
    hsn_code: Optional[str] = Field(None, max_length=8, description="8-digit HSN code")
    gst_rate: float = Field(18.0, description="GST rate: 0, 5, 12, 18, or 28")
    # ─────────────────────────────────────────────────────────────────────────
    variants: List[VariantCreate] = Field(..., min_length=1)
    specifications: List[SpecCreate] = []
    badges: List[BadgeCreate] = []


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    allow_cod: Optional[bool] = None
    allow_online: Optional[bool] = None
    is_active: Optional[bool] = None
    # ── GST fields ────────────────────────────────────────────────────────────
    hsn_code: Optional[str] = Field(None, max_length=8)
    gst_rate: Optional[float] = None   # 0 | 5 | 12 | 18 | 28
    # ─────────────────────────────────────────────────────────────────────────
    variants: Optional[List[VariantUpsert]] = None
    specifications: Optional[List[SpecCreate]] = None
    badges: Optional[List[BadgeCreate]] = None


class ProductOut(BaseModel):
    id: int
    name: str
    slug: str
    brand: str
    category: str
    description: Optional[str] = None
    images: List[str]
    variants: List[VariantOut]
    specifications: List[SpecOut]
    badges: List[BadgeOut] = []
    allow_cod: bool
    allow_online: bool
    is_active: bool
    avg_rating: float = 0.0
    review_count: int = 0
    # ── GST fields ────────────────────────────────────────────────────────────
    hsn_code: Optional[str] = None
    gst_rate: float = 18.0
    # ─────────────────────────────────────────────────────────────────────────

    @computed_field
    @property
    def gst_label(self) -> str:
        """Human readable: 'GST 18%'"""
        rate = int(self.gst_rate) if self.gst_rate == int(self.gst_rate) else self.gst_rate
        return f"GST {rate}%"


class ProductListItem(BaseModel):
    id: int
    name: str
    slug: str
    brand: str
    category: str
    primary_image: Optional[str] = None
    min_price: float
    max_price: float
    min_mrp: float
    max_discount_percent: int
    is_active: bool
    allow_cod: bool
    allow_online: bool
    avg_rating: float
    review_count: int
    in_stock: bool
    # ── GST fields ────────────────────────────────────────────────────────────
    gst_rate: float = 18.0
    hsn_code: Optional[str] = None
    # ─────────────────────────────────────────────────────────────────────────


class ProductListResponse(BaseModel):
    products: List[ProductListItem]
    total: int
    page: int
    pages: int
