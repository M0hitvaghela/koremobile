from __future__ import annotations

from sqlalchemy import (
    Column, Integer, String, Text, Boolean,
    DateTime, ForeignKey, Numeric, JSON, Date,
)
from sqlalchemy.sql import func
from app.core.database import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(20), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)

    # Address snapshot stored as JSONB (already decrypted before storing)
    address_snapshot = Column(JSON, nullable=False)

    subtotal = Column(Numeric(10, 2), nullable=False)       # GST-inclusive subtotal
    shipping_fee = Column(Numeric(10, 2), default=0)

    # ── GST breakdown columns ─────────────────────────────────────────────────
    taxable_amount = Column(Numeric(10, 2), nullable=True)  # subtotal before GST
    total_gst = Column(Numeric(10, 2), default=0)           # total GST collected
    # ─────────────────────────────────────────────────────────────────────────

    total = Column(Numeric(10, 2), nullable=False)          # final payable (GST-inclusive)

    payment_method = Column(String(10), nullable=False)          # cod | online
    payment_status = Column(String(20), default="pending")       # pending | paid | failed | refund_pending | refunded
    status = Column(String(30), default="placed")                # placed | processing | shipped | delivered | cancelled | return_requested | returned

    cashfree_order_id = Column(Text, nullable=True)
    cashfree_payment_id = Column(Text, nullable=True)

    # ── iThinkLogistics shipping fields ───────────────────────────────────────
    itl_order_id = Column(Text, nullable=True)          # ITL's own order ref (refnum)
    itl_awb_number = Column(Text, nullable=True)        # Airway Bill number (waybill)
    itl_logistic_name = Column(String(50), nullable=True)   # delhivery, bluedart, etc.
    itl_tracking_url = Column(Text, nullable=True)      # ITL tracking page URL
    itl_label_url = Column(Text, nullable=True)         # Shipment label PDF URL
    itl_current_status = Column(String(50), nullable=True)  # In Transit, Delivered, etc.
    itl_current_status_code = Column(String(20), nullable=True)  # UD, DL, CN, RT
    itl_expected_delivery_date = Column(Date, nullable=True)
    itl_last_synced_at = Column(DateTime(timezone=False), nullable=True)
    itl_raw_response = Column(JSON, nullable=True)      # full last tracking payload
    # ─────────────────────────────────────────────────────────────────────────

    # Legacy plain tracking number (kept for backward compat / manual overrides)
    tracking_number = Column(Text, nullable=True)

    cancel_reason = Column(Text, nullable=True)
    return_reason = Column(Text, nullable=True)
    return_approved = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    variant_id = Column(Integer, ForeignKey("product_variants.id"), nullable=True)

    product_name = Column(Text, nullable=False)
    variant_label = Column(Text, nullable=True)   # e.g. "Black / 128GB"
    image_url = Column(Text, nullable=True)

    price = Column(Numeric(10, 2), nullable=False)       # GST-inclusive selling price (per unit)
    mrp = Column(Numeric(10, 2), nullable=False)         # GST-inclusive MRP (per unit)
    quantity = Column(Integer, nullable=False)

    # ── GST snapshot per line item ────────────────────────────────────────────
    gst_rate = Column(Numeric(4, 1), default=0)          # e.g. 18.0
    hsn_code = Column(String(8), nullable=True)          # snapshot of HSN at order time
    base_price = Column(Numeric(10, 2), nullable=True)   # price ex-GST per unit
    gst_amount = Column(Numeric(10, 2), default=0)       # GST per unit
    # ─────────────────────────────────────────────────────────────────────────