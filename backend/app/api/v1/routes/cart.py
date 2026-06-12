"""
Cart routes — server-side cart stored in Redis.

Key: cart:{user_id}
Value: JSON list of CartItem objects
TTL: 7 days (refreshed on every update)

SECURITY: price, mrp, stock, allow_cod are NEVER accepted from the client.
          They are always re-fetched from the DB on every save so Redis
          cannot hold stale or tampered pricing data.
"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.redis import cache_cart, CacheTTL
from app.models.product import Product, ProductVariant, ProductImage

router = APIRouter(prefix="/api/v1/cart", tags=["Cart"])

CART_TTL = CacheTTL.CART


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CartItemIn(BaseModel):
    """
    Only identity + quantity come from the client.
    Everything money-related (price, mrp, stock, allow_cod) is
    re-fetched from the database and never accepted from the request.
    """
    product_id: int
    variant_id: int
    qty: int = Field(..., ge=1, le=20)


class CartPayload(BaseModel):
    items: List[CartItemIn]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _cart_key(user_id: int) -> str:
    return f"cart:{user_id}"


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("")
async def get_cart(current_user=Depends(get_current_user)):
    """Return the current user's server-side cart."""
    key = _cart_key(current_user.id)
    data = await cache_cart.get(key)
    items = data if isinstance(data, list) else []
    return {"items": items}


@router.post("")
async def save_cart(
    payload: CartPayload,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Replace the server-side cart with the provided items.
    Prices, stock, and COD eligibility are sourced from the DB — never
    from the client payload — so Redis always holds accurate data.
    """
    if not payload.items:
        key = _cart_key(current_user.id)
        await cache_cart.delete(key)
        return {"status": "saved", "count": 0}

    # ── 1. Fetch all variants in one query ────────────────────────────────────
    variant_ids = [item.variant_id for item in payload.items]
    variants_rows = (await db.execute(
        select(ProductVariant).where(ProductVariant.id.in_(variant_ids))
    )).scalars().all()
    variant_map = {v.id: v for v in variants_rows}

    # ── 2. Fetch all products in one query ────────────────────────────────────
    product_ids = [item.product_id for item in payload.items]
    products_rows = (await db.execute(
        select(Product).where(Product.id.in_(product_ids))
    )).scalars().all()
    product_map = {p.id: p for p in products_rows}

    # ── 3. Fetch primary images in one query ──────────────────────────────────
    images_rows = (await db.execute(
        select(ProductImage.product_id, ProductImage.url)
        .where(ProductImage.product_id.in_(product_ids))
        .order_by(ProductImage.product_id, ProductImage.display_order.asc())
    )).all()
    # Keep only the first image per product
    image_map: dict[int, str] = {}
    for product_id, url in images_rows:
        if product_id not in image_map:
            image_map[product_id] = url

    # ── 4. Validate and build cart items with DB-sourced data ─────────────────
    items_data = []
    for item in payload.items:
        v = variant_map.get(item.variant_id)
        p = product_map.get(item.product_id)

        if not v:
            raise HTTPException(status_code=400, detail=f"Variant {item.variant_id} not found")
        if not v.is_active:
            raise HTTPException(status_code=400, detail=f"Variant {item.variant_id} is no longer available")
        if not p:
            raise HTTPException(status_code=400, detail=f"Product {item.product_id} not found")
        if not p.is_active:
            raise HTTPException(status_code=400, detail=f"Product '{p.name}' is no longer available")

        # Cap qty to available stock silently (don't error — just cap)
        safe_qty = min(item.qty, v.stock) if v.stock > 0 else 0

        items_data.append({
            "product_id": str(item.product_id),
            "variant_id": str(item.variant_id),
            "slug":       p.slug,
            "name":       p.name,
            "brand":      p.brand,
            "image":      image_map.get(item.product_id, ""),
            "color":      v.color,
            "storage":    v.storage,
            # ── Prices from DB, never from client ─────────────────────────────
            "price":      float(v.price),
            "mrp":        float(v.mrp),
            "stock":      v.stock,
            "allow_cod":  p.allow_cod,
            "gst_rate":   float(p.gst_rate) if p.gst_rate is not None else 18.0,
            # ─────────────────────────────────────────────────────────────────
            "qty":        safe_qty,
        })

    key = _cart_key(current_user.id)
    await cache_cart.set(key, items_data, CART_TTL)
    return {"status": "saved", "count": len(items_data)}


@router.delete("")
async def clear_cart(current_user=Depends(get_current_user)):
    """Clear the server-side cart."""
    key = _cart_key(current_user.id)
    await cache_cart.delete(key)
    return {"status": "cleared"}