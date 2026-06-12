from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, update, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.redis import cache_orders, cache_settings, cache_products, CacheTTL
from app.core.security import decrypt_field
from app.models.order import Order, OrderItem
from app.models.product import Product, ProductVariant, ProductImage
from app.schemas.order import (
    CreateOrderRequest, OrderOut, OrderItemOut,
    OrderListItem, CancelOrderRequest, ReturnOrderRequest,
    calc_gst_breakdown,
)
from app.services import payment_service
from app.services.email_service import send_order_confirmation_email

router = APIRouter(prefix="/api/v1/orders", tags=["Orders"])


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

async def _generate_order_number(db: AsyncSession) -> str:
    year = datetime.now(timezone.utc).year
    key = f"order_sequence_{year}"

    row = (await db.execute(
        text("SELECT value FROM site_settings WHERE key = :k FOR UPDATE"),
        {"k": key},
    )).first()

    if not row:
        seq = 1
        await db.execute(
            text("INSERT INTO site_settings (key, value) VALUES (:k, '1') ON CONFLICT (key) DO NOTHING"),
            {"k": key},
        )
    else:
        seq = int(row[0]) + 1
        await db.execute(
            text("UPDATE site_settings SET value = :v WHERE key = :k"),
            {"v": str(seq), "k": key},
        )

    return f"KM-{year}-{seq:04d}"


async def _get_shipping_settings(db: AsyncSession) -> tuple[bool, float, float]:
    cached = await cache_settings.get("settings:shipping")
    if cached:
        enabled = str(cached.get("free_shipping_enabled", "true")).lower() == "true"
        threshold = float(cached.get("free_shipping_threshold", 10000))
        flat_fee = float(cached.get("flat_shipping_fee", 50))
        return enabled, threshold, flat_fee

    rows = (await db.execute(
        text("SELECT key, value FROM site_settings WHERE key IN ('free_shipping_enabled','free_shipping_threshold','flat_shipping_fee')")
    )).all()
    settings_map = {r[0]: r[1] for r in rows}

    enabled = settings_map.get("free_shipping_enabled", "true").lower() == "true"
    threshold = float(settings_map.get("free_shipping_threshold", 10000))
    flat_fee = float(settings_map.get("flat_shipping_fee", 50))

    await cache_settings.set("settings:shipping", settings_map, CacheTTL.SETTINGS_TTL)
    return enabled, threshold, flat_fee


def _build_order_out(order: Order, items: list[OrderItem]) -> OrderOut:
    return OrderOut(
        id=order.id,
        order_number=order.order_number,
        status=order.status,
        payment_method=order.payment_method,
        payment_status=order.payment_status,
        items=[
            OrderItemOut(
                product_id=i.product_id,
                product_name=i.product_name,
                variant_label=i.variant_label,
                image_url=i.image_url,
                price=float(i.price),
                mrp=float(i.mrp),
                quantity=i.quantity,
                gst_rate=float(i.gst_rate or 0),
                hsn_code=i.hsn_code,
                base_price=float(i.base_price or 0),
                gst_amount=float(i.gst_amount or 0),
            )
            for i in items
        ],
        address=order.address_snapshot or {},
        subtotal=float(order.subtotal),
        shipping_fee=float(order.shipping_fee),
        total=float(order.total),
        taxable_amount=float(order.taxable_amount or 0),
        total_gst=float(order.total_gst or 0),
        tracking_number=order.tracking_number,
        cancel_reason=order.cancel_reason,
        return_reason=order.return_reason,
        cashfree_order_id=order.cashfree_order_id,
        # ── ITL fields ────────────────────────────────────────────────────────
        itl_awb_number=order.itl_awb_number,
        itl_logistic_name=order.itl_logistic_name,
        itl_tracking_url=order.itl_tracking_url,
        itl_current_status=order.itl_current_status,
        itl_current_status_code=order.itl_current_status_code,
        itl_expected_delivery_date=order.itl_expected_delivery_date,
        # ─────────────────────────────────────────────────────────────────────
        created_at=order.created_at,
    )


# ─────────────────────────────────────────────
# POST /orders — Create order
# ─────────────────────────────────────────────

@router.post("", response_model=None)
async def create_order(
    payload: CreateOrderRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # 1. Load variants and validate stock
    variant_ids = [item.variant_id for item in payload.items]
    variants_rows = (await db.execute(
        select(ProductVariant).where(ProductVariant.id.in_(variant_ids))
    )).scalars().all()
    variant_map = {v.id: v for v in variants_rows}

    for item in payload.items:
        v = variant_map.get(item.variant_id)
        if not v:
            raise HTTPException(status_code=400, detail=f"Variant {item.variant_id} not found")
        if v.stock < item.quantity:
            raise HTTPException(status_code=400, detail=f"'{v.color}/{v.storage}' is out of stock or insufficient stock")
        if not v.is_active:
            raise HTTPException(status_code=400, detail=f"Variant {item.variant_id} is not available")

    # 2. Load products
    product_ids = [item.product_id for item in payload.items]
    products_rows = (await db.execute(
        select(Product).where(Product.id.in_(product_ids))
    )).scalars().all()
    product_map = {p.id: p for p in products_rows}

    if payload.payment_method == "cod":
        for item in payload.items:
            p = product_map.get(item.product_id)
            if p and not p.allow_cod:
                raise HTTPException(status_code=400, detail=f"'{p.name}' does not support Cash on Delivery")
    elif payload.payment_method == "online":
        for item in payload.items:
            p = product_map.get(item.product_id)
            if p and not p.allow_online:
                raise HTTPException(status_code=400, detail=f"'{p.name}' does not support online payment")

    # 3. Load address from DB
    address_row = (await db.execute(
        text("SELECT * FROM addresses WHERE id = :aid AND user_id = :uid"),
        {"aid": payload.address_id, "uid": current_user.id},
    )).mappings().first()
    if not address_row:
        raise HTTPException(status_code=404, detail="Address not found")

    # 4. Build address snapshot
    def safe_decrypt(val: str | None) -> str:
        if not val:
            return ""
        try:
            return decrypt_field(val)
        except Exception:
            return val or ""

    address_snapshot = {
        "name": safe_decrypt(address_row["name"]),
        "phone": safe_decrypt(address_row["phone"]),
        "house_no": address_row["house_no"],
        "area": address_row["area"],
        "village": address_row["village"],
        "taluka": address_row["taluka"],
        "district": address_row["district"],
        "pincode": address_row["pincode"],
        "state": address_row["state"],
        "gstin": safe_decrypt(address_row["gstin"]) if address_row.get("gstin") else None,
    }

    # 5. Calculate totals with GST
    order_line_data = []
    subtotal = 0.0
    total_taxable = 0.0
    total_gst_collected = 0.0

    for item in payload.items:
        v = variant_map[item.variant_id]
        p = product_map.get(item.product_id)
        gst_rate = float(p.gst_rate) if p and p.gst_rate is not None else 18.0
        hsn_code = p.hsn_code if p else None

        line_price = float(v.price)
        base_price, gst_amount = calc_gst_breakdown(line_price, gst_rate)

        line_subtotal = round(line_price * item.quantity, 2)
        line_taxable = round(base_price * item.quantity, 2)
        line_gst = round(gst_amount * item.quantity, 2)

        subtotal += line_subtotal
        total_taxable += line_taxable
        total_gst_collected += line_gst

        order_line_data.append({
            "item": item,
            "variant": v,
            "product": p,
            "gst_rate": gst_rate,
            "hsn_code": hsn_code,
            "base_price": base_price,
            "gst_amount": gst_amount,
        })

    subtotal = round(subtotal, 2)
    total_taxable = round(total_taxable, 2)
    total_gst_collected = round(total_gst_collected, 2)

    enabled, threshold, flat_fee = await _get_shipping_settings(db)
    shipping_fee = 0.0 if (enabled and subtotal >= threshold) else flat_fee
    total = round(subtotal + shipping_fee, 2)

    order_number = await _generate_order_number(db)

    order = Order(
        order_number=order_number,
        user_id=current_user.id,
        address_snapshot=address_snapshot,
        subtotal=subtotal,
        shipping_fee=shipping_fee,
        taxable_amount=total_taxable,
        total_gst=total_gst_collected,
        total=total,
        payment_method=payload.payment_method,
        payment_status="pending",
        status="placed",
    )
    db.add(order)
    await db.flush()

    for line in order_line_data:
        item = line["item"]
        v = line["variant"]
        p = line["product"]

        primary_img = (await db.execute(
            select(ProductImage.url)
            .where(ProductImage.product_id == item.product_id)
            .order_by(ProductImage.display_order.asc())
            .limit(1)
        )).scalar_one_or_none()

        db.add(OrderItem(
            order_id=order.id,
            product_id=item.product_id,
            variant_id=item.variant_id,
            product_name=p.name if p else f"Product {item.product_id}",
            variant_label=f"{v.color} / {v.storage}",
            image_url=primary_img,
            price=float(v.price),
            mrp=float(v.mrp),
            quantity=item.quantity,
            gst_rate=line["gst_rate"],
            hsn_code=line["hsn_code"],
            base_price=line["base_price"],
            gst_amount=line["gst_amount"],
        ))

    for item in payload.items:
        result = await db.execute(
            update(ProductVariant)
            .where(
                ProductVariant.id == item.variant_id,
                ProductVariant.stock >= item.quantity,
            )
            .values(stock=ProductVariant.stock - item.quantity)
        )
        if result.rowcount == 0:
            await db.rollback()
            raise HTTPException(status_code=409, detail="Stock changed during checkout, please retry")

    if payload.payment_method == "cod":
        order.payment_status = "pending"
        order.status = "processing"
        await db.commit()
        await db.refresh(order)

        items_out = (await db.execute(
            select(OrderItem).where(OrderItem.order_id == order.id)
        )).scalars().all()

        await cache_products.delete_pattern("products:*")

        try:
            _cod_email = decrypt_field(current_user.email or "") if current_user.email else ""
        except Exception:
            _cod_email = current_user.email or ""
        if _cod_email:
            import asyncio
            asyncio.create_task(send_order_confirmation_email(
                name=current_user.name or "Customer",
                email=_cod_email,
                order_number=order_number,
                items=[
                    {"name": i.product_name, "qty": i.quantity, "price": float(i.price)}
                    for i in items_out
                ],
                total=float(order.total),
                payment_method="cod",
            ))

        return _build_order_out(order, items_out)

    # Online payment
    user_name = current_user.name or "Customer"
    user_email = ""
    user_phone = ""
    try:
        user_email = decrypt_field(current_user.email or "") if current_user.email else ""
    except Exception:
        user_email = current_user.email or ""
    try:
        user_phone = decrypt_field(current_user.phone or "") if current_user.phone else ""
    except Exception:
        user_phone = current_user.phone or ""

    try:
        cf_data = await payment_service.create_cashfree_order(
            order_id=order.id,
            order_number=order_number,
            amount=total,
            customer_id=str(current_user.id),
            customer_name=user_name,
            customer_email=user_email or "noreply@koremobile.in",
            customer_phone=user_phone or "9999999999",
        )
        order.cashfree_order_id = cf_data["cashfree_order_id"]
    except Exception as e:
        print(f"[Payment] Cashfree order creation failed: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Payment gateway unavailable. Please retry.")

    await db.commit()
    await db.refresh(order)
    await cache_products.delete_pattern("products:*")

    return {
        "order_id": order.id,
        "order_number": order_number,
        "payment_session_id": cf_data.get("payment_session_id"),
        "total": total,
    }


# ─────────────────────────────────────────────
# GET /orders — List user's orders
# ─────────────────────────────────────────────

@router.get("", response_model=List[OrderListItem])
async def list_orders(
    page: int = 1,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    cache_key = f"orders:list:{current_user.id}:{page}:{limit}"
    cached = await cache_orders.get(cache_key)
    if cached:
        return cached

    offset = (page - 1) * limit
    orders = (await db.execute(
        select(Order)
        .where(Order.user_id == current_user.id)
        .order_by(Order.created_at.desc())
        .offset(offset)
        .limit(limit)
    )).scalars().all()

    result = []
    for order in orders:
        items = (await db.execute(
            select(OrderItem).where(OrderItem.order_id == order.id)
        )).scalars().all()

        primary_image = items[0].image_url if items else None
        result.append(OrderListItem(
            id=order.id,
            order_number=order.order_number,
            status=order.status,
            payment_method=order.payment_method,
            payment_status=order.payment_status,
            total=float(order.total),
            item_count=len(items),
            primary_image=primary_image,
            created_at=order.created_at,
        ))

    serializable = [item.model_dump(mode="json") for item in result]
    await cache_orders.set(cache_key, serializable, CacheTTL.ORDERS_LIST)
    return result


# ─────────────────────────────────────────────
# GET /orders/{id}
# ─────────────────────────────────────────────

@router.get("/{id}", response_model=OrderOut)
async def get_order(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    cache_key = f"orders:detail:{current_user.id}:{id}"
    cached = await cache_orders.get(cache_key)
    if cached:
        items = cached.get("items") if isinstance(cached, dict) else None
        if isinstance(items, list) and all(isinstance(i, dict) and "product_id" in i for i in items):
            return cached

    order = (await db.scalars(
        select(Order).where(Order.id == id, Order.user_id == current_user.id)
    )).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    items = (await db.execute(
        select(OrderItem).where(OrderItem.order_id == order.id)
    )).scalars().all()

    out = _build_order_out(order, items)
    await cache_orders.set(cache_key, out.model_dump(mode="json"), CacheTTL.ORDER_DETAIL)
    return out


# ─────────────────────────────────────────────
# GET /orders/{id}/track
# Public tracking info for the user (no full raw response)
# ─────────────────────────────────────────────

@router.get("/{id}/track")
async def track_order(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    order = (await db.scalars(
        select(Order).where(Order.id == id, Order.user_id == current_user.id)
    )).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if not order.itl_awb_number:
        return {
            "has_shipment": False,
            "message": "Shipment not yet created",
        }

    # Return cached tracking data from DB (admin syncs it)
    scan_details = []
    raw = order.itl_raw_response or {}
    if isinstance(raw, dict):
        scan_details = raw.get("scan_details", [])

    return {
        "has_shipment": True,
        "itl_awb_number": order.itl_awb_number,
        "itl_logistic_name": order.itl_logistic_name,
        "itl_tracking_url": order.itl_tracking_url,
        "itl_current_status": order.itl_current_status,
        "itl_current_status_code": order.itl_current_status_code,
        "itl_expected_delivery_date": str(order.itl_expected_delivery_date) if order.itl_expected_delivery_date else None,
        "itl_last_synced_at": order.itl_last_synced_at.isoformat() if order.itl_last_synced_at else None,
        "scan_details": scan_details,
    }


# ─────────────────────────────────────────────
# POST /orders/{id}/cancel
# ─────────────────────────────────────────────

@router.post("/{id}/cancel")
async def cancel_order(
    id: int,
    payload: CancelOrderRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    order = (await db.scalars(
        select(Order).where(Order.id == id, Order.user_id == current_user.id)
    )).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status not in ("placed", "processing"):
        raise HTTPException(status_code=400, detail="Orders can only be cancelled before shipping")

    order.status = "cancelled"
    order.cancel_reason = payload.reason

    items = (await db.execute(
        select(OrderItem).where(OrderItem.order_id == order.id)
    )).scalars().all()
    for item in items:
        if item.variant_id:
            await db.execute(
                update(ProductVariant)
                .where(ProductVariant.id == item.variant_id)
                .values(stock=ProductVariant.stock + item.quantity)
            )

    if order.payment_status == "paid" and order.cashfree_order_id:
        order.payment_status = "refund_pending"
        refund_id = f"REF-{order.order_number}"
        await payment_service.process_refund(
            cashfree_order_id=order.cashfree_order_id,
            refund_amount=float(order.total),
            refund_id=refund_id,
        )

    await db.commit()
    await cache_orders.delete(f"orders:list:{current_user.id}:1:10")
    await cache_orders.delete(f"orders:detail:{current_user.id}:{id}")
    await cache_products.delete_pattern("products:*")
    return {"message": "Order cancelled successfully"}


# ─────────────────────────────────────────────
# POST /orders/{id}/return
# ─────────────────────────────────────────────

@router.post("/{id}/return")
async def return_order(
    id: int,
    payload: ReturnOrderRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    order = (await db.scalars(
        select(Order).where(Order.id == id, Order.user_id == current_user.id)
    )).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != "delivered":
        raise HTTPException(status_code=400, detail="Only delivered orders can be returned")

    if order.created_at:
        cutoff = order.created_at.replace(tzinfo=timezone.utc) + timedelta(days=7)
        if datetime.now(timezone.utc) > cutoff:
            raise HTTPException(status_code=400, detail="Return window expired (7 days)")

    order.status = "return_requested"
    order.return_reason = f"{payload.reason}: {payload.description}"
    await db.commit()
    await cache_orders.delete(f"orders:detail:{current_user.id}:{id}")
    return {"message": "Return request submitted. Admin will review."}