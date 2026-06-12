"""
Admin shipping routes — iThinkLogistics integration.

Endpoints:
  POST /api/v1/admin/shipping/{order_id}/rates    → fetch carrier rates before creating
  POST /api/v1/admin/shipping/{order_id}/create   → create shipment on ITL
  GET  /api/v1/admin/shipping/{order_id}/label    → get label PDF URL
  POST /api/v1/admin/shipping/{order_id}/sync     → sync tracking from ITL
  POST /api/v1/admin/shipping/{order_id}/cancel   → cancel shipment on ITL
  POST /api/v1/admin/shipping/manifest            → print manifest for multiple AWBs
  GET  /api/v1/admin/shipping/pincode/{pincode}   → check serviceability
"""
from __future__ import annotations

from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_admin
from app.core.redis import cache_orders
from app.models.order import Order, OrderItem
from app.services import ithink_service

router = APIRouter(prefix="/api/v1/admin/shipping", tags=["Admin Shipping"])


# ── Request schemas ───────────────────────────────────────────────────────────

class RateCheckRequest(BaseModel):
    weight_kg:  float = 0.5
    length:     float = 10.0
    width:      float = 10.0
    height:     float = 5.0


class CreateShipmentRequest(BaseModel):
    weight_kg:        float = 0.5
    length:           float = 10.0
    width:            float = 10.0
    height:           float = 5.0
    logistics:        str   = ""    # "" = ITL auto-assigns; or "delhivery","xpressbees" etc.
    eway_bill_number: str   = ""    # Required by GST for orders > ₹50,000


class ManifestRequest(BaseModel):
    awb_numbers: list[str]   # list of AWB numbers to include in manifest


# ── Helper ────────────────────────────────────────────────────────────────────

async def _get_order(order_id: int, db: AsyncSession) -> Order:
    order = (await db.scalars(select(Order).where(Order.id == order_id))).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v1/admin/shipping/{order_id}/rates
# Fetch available carriers + rates BEFORE creating shipment
# Admin sees cheapest/fastest options and picks one
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{order_id}/rates", dependencies=[Depends(get_current_admin)])
async def get_rates(
    order_id: int,
    body: RateCheckRequest,
    db: AsyncSession = Depends(get_db),
):
    order = await _get_order(order_id, db)
    addr  = order.address_snapshot or {}

    to_pincode   = addr.get("pincode", "")
    from_pincode = str(getattr(__import__('app.core.config', fromlist=['settings']).settings, 'ITL_PICKUP_PINCODE', ''))

    if not to_pincode:
        raise HTTPException(status_code=400, detail="Order has no delivery pincode")
    if not from_pincode:
        raise HTTPException(status_code=400, detail="ITL_PICKUP_PINCODE not set in .env")

    # Load items to get highest single item MRP
    # ITL expects single product MRP not order total — pass 0 to avoid validation errors
    product_mrp = 0.0

    try:
        carriers = await ithink_service.get_rates(
            from_pincode   = from_pincode,
            to_pincode     = to_pincode,
            weight_kg      = body.weight_kg,
            length_cm      = body.length,
            width_cm       = body.width,
            height_cm      = body.height,
            payment_method = order.payment_method,
            product_mrp    = product_mrp,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Rate check error: {exc}")

    return {
        "to_pincode":   to_pincode,
        "from_pincode": from_pincode,
        "weight_kg":    body.weight_kg,
        "carriers":     carriers,
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v1/admin/shipping/{order_id}/create
# Create shipment on ITL — saves AWB to order
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{order_id}/create", dependencies=[Depends(get_current_admin)])
async def create_shipment(
    order_id: int,
    body: CreateShipmentRequest = CreateShipmentRequest(),
    db: AsyncSession = Depends(get_db),
):
    order = await _get_order(order_id, db)

    if order.itl_awb_number:
        raise HTTPException(
            status_code=400,
            detail=f"Shipment already created. AWB: {order.itl_awb_number}",
        )
    if order.status not in ("processing", "placed"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot create shipment for order in status '{order.status}'",
        )

    # E-waybill required for orders > ₹50,000
    if float(order.total) > 50000 and not body.eway_bill_number.strip():
        raise HTTPException(
            status_code=400,
            detail="E-waybill number is required for orders above ₹50,000 (GST compliance)",
        )

    items_rows = (
        await db.execute(select(OrderItem).where(OrderItem.order_id == order.id))
    ).scalars().all()
    if not items_rows:
        raise HTTPException(status_code=400, detail="Order has no items")

    itl_products = [
        {
            "product_name":     i.product_name,
            "product_sku":      str(i.variant_id or i.product_id or ""),
            "product_quantity": i.quantity,
            "product_price":    float(i.price),
            "product_tax_rate": float(i.gst_rate or 0),
            "product_hsn_code": i.hsn_code or "",
        }
        for i in items_rows
    ]

    addr = order.address_snapshot or {}
    customer_address  = f"{addr.get('house_no', '')}, {addr.get('area', '')}".strip(", ")
    customer_address2 = f"{addr.get('village', '')}, {addr.get('taluka', '')}".strip(", ")
    cod_amount = float(order.total) if order.payment_method == "cod" else 0.0

    try:
        result = await ithink_service.create_shipment(
            order_number      = order.order_number,
            order_date        = order.created_at.date() if order.created_at else date.today(),
            total_amount      = float(order.total),
            payment_method    = order.payment_method,
            customer_name     = addr.get("name", ""),
            customer_phone    = addr.get("phone", ""),
            customer_address  = customer_address,
            customer_address2 = customer_address2,
            customer_city     = addr.get("district", ""),
            customer_state    = addr.get("state", "Gujarat"),
            customer_pincode  = addr.get("pincode", ""),
            products          = itl_products,
            weight_kg         = body.weight_kg,
            length            = body.length,
            width             = body.width,
            height            = body.height,
            cod_amount        = cod_amount,
            logistics         = body.logistics,
            eway_bill_number  = body.eway_bill_number,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"iThinkLogistics error: {exc}")

    # Save ITL fields
    order.itl_order_id      = result["itl_order_id"]
    order.itl_awb_number    = result["itl_awb_number"]
    order.itl_logistic_name = result["itl_logistic_name"]
    order.itl_tracking_url  = result["itl_tracking_url"]
    order.tracking_number   = result["itl_awb_number"]

    if order.status == "placed":
        order.status = "processing"

    await db.commit()
    await cache_orders.delete_pattern(f"orders:detail:*:{order_id}")
    await cache_orders.delete_pattern("orders:list:*")

    return {
        "message":           "Shipment created successfully",
        "itl_order_id":      result["itl_order_id"],
        "itl_awb_number":    result["itl_awb_number"],
        "itl_logistic_name": result["itl_logistic_name"],
        "itl_tracking_url":  result["itl_tracking_url"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/v1/admin/shipping/{order_id}/label
# Get shipment label PDF URL — admin opens and prints, sticks on box
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{order_id}/label", dependencies=[Depends(get_current_admin)])
async def get_label(order_id: int, db: AsyncSession = Depends(get_db)):
    order = await _get_order(order_id, db)

    if not order.itl_awb_number:
        raise HTTPException(status_code=400, detail="No AWB — create shipment first")

    try:
        label_url = await ithink_service.get_label_url(order.itl_awb_number)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Label generation error: {exc}")

    # Save label URL to order for future reference
    order.itl_label_url = label_url
    await db.commit()

    return {"label_url": label_url, "awb_number": order.itl_awb_number}


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v1/admin/shipping/{order_id}/sync
# Sync tracking from ITL — auto-updates order status
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{order_id}/sync", dependencies=[Depends(get_current_admin)])
async def sync_tracking(order_id: int, db: AsyncSession = Depends(get_db)):
    order = await _get_order(order_id, db)

    if not order.itl_awb_number:
        raise HTTPException(status_code=400, detail="No AWB number — create shipment first")

    try:
        tracking = await ithink_service.track_shipment(order.itl_awb_number)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"iThinkLogistics tracking error: {exc}")

    order.itl_current_status      = tracking.get("current_status")
    order.itl_current_status_code = tracking.get("current_status_code")
    order.itl_raw_response        = tracking
    order.itl_last_synced_at      = datetime.utcnow()

    edd = tracking.get("expected_delivery_date")
    if edd:
        try:
            order.itl_expected_delivery_date = date.fromisoformat(edd)
        except ValueError:
            pass

    status_code    = tracking.get("current_status_code", "")
    current_status = tracking.get("current_status", "")

    if status_code == "DL" and current_status == "Delivered":
        if order.status not in ("delivered", "return_requested", "returned", "cancelled"):
            order.status = "delivered"
            if order.payment_method == "cod":
                order.payment_status = "paid"
    elif status_code == "RT" or "RTO" in current_status:
        pass
    elif current_status in ("Picked Up", "In Transit", "Reached At Destination",
                            "Out For Delivery", "Manifested"):
        if order.status == "processing":
            order.status = "shipped"
    elif status_code == "CN":
        if order.status not in ("cancelled", "delivered"):
            order.status = "cancelled"

    await db.commit()
    await cache_orders.delete_pattern(f"orders:detail:*:{order_id}")
    await cache_orders.delete_pattern("orders:list:*")

    return {
        "message":                "Tracking synced",
        "current_status":         order.itl_current_status,
        "current_status_code":    order.itl_current_status_code,
        "expected_delivery_date": str(order.itl_expected_delivery_date) if order.itl_expected_delivery_date else None,
        "order_status":           order.status,
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v1/admin/shipping/{order_id}/cancel
# Cancel shipment on ITL
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{order_id}/cancel", dependencies=[Depends(get_current_admin)])
async def cancel_shipment(order_id: int, db: AsyncSession = Depends(get_db)):
    order = await _get_order(order_id, db)

    if not order.itl_awb_number:
        raise HTTPException(status_code=400, detail="No AWB number — nothing to cancel on ITL")
    if order.status in ("delivered", "returned"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel a {order.status} shipment")

    try:
        await ithink_service.cancel_shipment(order.itl_awb_number)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"iThinkLogistics cancel error: {exc}")

    order.itl_current_status      = "Cancelled"
    order.itl_current_status_code = "CN"
    await db.commit()
    await cache_orders.delete_pattern(f"orders:detail:*:{order_id}")

    return {"message": "Shipment cancellation requested on iThinkLogistics"}


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v1/admin/shipping/manifest
# Generate manifest PDF for multiple AWBs — print before carrier pickup
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/manifest", dependencies=[Depends(get_current_admin)])
async def generate_manifest(body: ManifestRequest):
    if not body.awb_numbers:
        raise HTTPException(status_code=400, detail="No AWB numbers provided")
    if len(body.awb_numbers) > 100:
        raise HTTPException(status_code=400, detail="Max 100 AWBs per manifest")

    try:
        manifest_url = await ithink_service.get_manifest_url(body.awb_numbers)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Manifest generation error: {exc}")

    return {"manifest_url": manifest_url, "awb_count": len(body.awb_numbers)}


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/v1/admin/shipping/pincode/{pincode}
# Check serviceability
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/pincode/{pincode}", dependencies=[Depends(get_current_admin)])
async def check_pincode(pincode: str):
    try:
        result = await ithink_service.check_pincode_serviceability(pincode)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Pincode check error: {exc}")
    return result