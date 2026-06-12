from __future__ import annotations

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Numeric
from sqlalchemy.sql import func
from app.core.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, index=True)
    brand = Column(String(120), nullable=False)
    category = Column(String(120), nullable=False, index=True)
    description = Column(Text, nullable=True)
    allow_cod = Column(Boolean, default=True)
    allow_online = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)

    # ── GST fields ────────────────────────────────────────────────────────────
    # HSN code for this product (8-digit code under Indian GST)
    hsn_code = Column(String(8), nullable=True)
    # GST rate applicable: 0, 5, 12, 18, or 28 (percent)
    # Default 18% covers Mobiles, Laptops, Accessories; TVs use 28%
    gst_rate = Column(Numeric(4, 1), default=18.0, nullable=False)
    # ─────────────────────────────────────────────────────────────────────────

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ProductImage(Base):
    __tablename__ = "product_images"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), index=True)
    url = Column(Text, nullable=False)
    public_id = Column(String(255), nullable=True)
    display_order = Column(Integer, default=0)


class ProductVariant(Base):
    __tablename__ = "product_variants"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), index=True)
    color = Column(String(80), nullable=False)
    storage = Column(String(80), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)   # GST-inclusive selling price
    mrp = Column(Numeric(10, 2), nullable=False)     # GST-inclusive MRP
    stock = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)


class ProductSpecification(Base):
    __tablename__ = "product_specifications"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), index=True)
    spec_key = Column(String(120), nullable=False)
    spec_value = Column(String(255), nullable=False)
    display_order = Column(Integer, default=0)


class ProductBadge(Base):
    __tablename__ = "product_badges"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), index=True)
    badge_key = Column(String(60), nullable=False)
    label_override = Column(String(120), nullable=True)
    display_order = Column(Integer, default=0)
