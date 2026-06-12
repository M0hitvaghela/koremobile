from __future__ import annotations

from datetime import datetime, date
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, computed_field


# ── GST calculation helper (prices are GST-inclusive) ────────────────────────

def calc_gst_breakdown(inclusive_price: float, gst_rate: float) -> tuple[float, float]:
    """
    Given a GST-inclusive price and rate, returns (base_price, gst_amount).
    """
    if gst_rate <= 0:
        return round(inclusive_price, 2), 0.0
    divisor = 1 + gst_rate / 100
    base = round(inclusive_price / divisor, 2)
    gst = round(inclusive_price - base, 2)
    return base, gst


# ─────────────────────────────────────────────
# Cart / Order creation
# ─────────────────────────────────────────────

class CartItem(BaseModel):
    product_id: int
    variant_id: int
    quantity: int = Field(..., ge=1, le=10)


class CreateOrderRequest(BaseModel):
    items: List[CartItem] = Field(..., min_length=1)
    address_id: int
    payment_method: Literal["cod", "online"]


# ─────────────────────────────────────────────
# Address snapshot (stored in JSONB)
# ─────────────────────────────────────────────

class AddressSnapshot(BaseModel):
    name: str
    phone: str
    house_no: str
    area: str
    village: str
    taluka: str
    district: str
    pincode: str
    state: str
    gstin: Optional[str] = None


# ─────────────────────────────────────────────
# Output schemas
# ─────────────────────────────────────────────

class OrderItemOut(BaseModel):
    product_id: int
    product_name: str
    variant_label: Optional[str] = None
    image_url: Optional[str] = None

    price: float
    mrp: float
    quantity: int

    gst_rate: float = 0.0
    hsn_code: Optional[str] = None
    base_price: float = 0.0
    gst_amount: float = 0.0

    @computed_field
    @property
    def subtotal(self) -> float:
        return round(self.price * self.quantity, 2)

    @computed_field
    @property
    def taxable_subtotal(self) -> float:
        return round(self.base_price * self.quantity, 2)

    @computed_field
    @property
    def gst_subtotal(self) -> float:
        return round(self.gst_amount * self.quantity, 2)

    @computed_field
    @property
    def cgst_amount(self) -> float:
        return round(self.gst_subtotal / 2, 2)

    @computed_field
    @property
    def sgst_amount(self) -> float:
        return round(self.gst_subtotal / 2, 2)

    @computed_field
    @property
    def gst_label(self) -> str:
        rate = int(self.gst_rate) if self.gst_rate == int(self.gst_rate) else self.gst_rate
        return f"GST {rate}%"


class OrderOut(BaseModel):
    id: int
    order_number: str
    status: str
    payment_method: str
    payment_status: str
    items: List[OrderItemOut]
    address: dict
    subtotal: float
    shipping_fee: float
    total: float

    taxable_amount: float = 0.0
    total_gst: float = 0.0

    tracking_number: Optional[str] = None
    cancel_reason: Optional[str] = None
    return_reason: Optional[str] = None
    cashfree_order_id: Optional[str] = None

    # ── iThinkLogistics fields ────────────────────────────────────────────────
    itl_awb_number: Optional[str] = None
    itl_logistic_name: Optional[str] = None
    itl_tracking_url: Optional[str] = None
    itl_current_status: Optional[str] = None
    itl_current_status_code: Optional[str] = None
    itl_expected_delivery_date: Optional[date] = None
    # ─────────────────────────────────────────────────────────────────────────

    created_at: datetime

    @computed_field
    @property
    def total_cgst(self) -> float:
        return round(self.total_gst / 2, 2)

    @computed_field
    @property
    def total_sgst(self) -> float:
        return round(self.total_gst / 2, 2)


class OrderListItem(BaseModel):
    id: int
    order_number: str
    status: str
    payment_method: str
    payment_status: str
    total: float
    item_count: int
    primary_image: Optional[str] = None
    created_at: datetime


# ─────────────────────────────────────────────
# Cancel / Return
# ─────────────────────────────────────────────

class CancelOrderRequest(BaseModel):
    reason: str = Field(..., min_length=10)


class ReturnOrderRequest(BaseModel):
    reason: str
    description: str