from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_admin
from app.core.redis import cache_orders
from app.models.order import Order, OrderItem
from app.schemas.order import OrderOut, OrderItemOut

router = APIRouter(prefix="/api/v1/admin/orders", tags=["Admin Orders"])


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
# GET /admin/orders — List all orders (paginated)
# ─────────────────────────────────────────────

@router.get("", dependencies=[Depends(get_current_admin)])
async def admin_list_orders(
    page: int = 1,
    limit: int = 20,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Order).order_by(Order.created_at.desc())
    count_query = select(func.count()).select_from(Order)

    if status and status != "all":
        query = query.where(Order.status == status)
        count_query = count_query.where(Order.status == status)

    if search and search.strip():
        s = search.strip()
        from sqlalchemy import or_, cast, String
        search_filter = or_(
            Order.order_number.ilike(f"%{s}%"),
            func.cast(Order.address_snapshot["name"], String).ilike(f"%{s}%"),
            func.cast(Order.address_snapshot["phone"], String).ilike(f"%{s}%"),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    total = (await db.execute(count_query)).scalar_one()
    offset = (page - 1) * limit
    orders = (await db.execute(query.offset(offset).limit(limit))).scalars().all()

    results = []
    for order in orders:
        items = (await db.execute(
            select(OrderItem).where(OrderItem.order_id == order.id)
        )).scalars().all()
        results.append({
            "id": order.id,
            "order_number": order.order_number,
            "status": order.status,
            "payment_method": order.payment_method,
            "payment_status": order.payment_status,
            "subtotal": float(order.subtotal),
            "shipping_fee": float(order.shipping_fee),
            "taxable_amount": float(order.taxable_amount or 0),
            "total_gst": float(order.total_gst or 0),
            "total": float(order.total),
            "item_count": len(items),
            "address": order.address_snapshot or {},
            "tracking_number": order.tracking_number,
            # ITL quick-view fields
            "itl_awb_number": order.itl_awb_number,
            "itl_current_status": order.itl_current_status,
            "itl_logistic_name": order.itl_logistic_name,
            "created_at": order.created_at.isoformat() if order.created_at else None,
        })

    pages = max(1, (total + limit - 1) // limit)
    return {"orders": results, "total": total, "page": page, "pages": pages}


# ─────────────────────────────────────────────
# GET /admin/orders/stats
# ─────────────────────────────────────────────

@router.get("/stats", dependencies=[Depends(get_current_admin)])
async def admin_order_stats(db: AsyncSession = Depends(get_db)):
    total_orders = (await db.execute(select(func.count()).select_from(Order))).scalar_one()

    revenue_row = (await db.execute(
        select(func.sum(Order.total)).where(Order.status != "cancelled")
    )).scalar_one()
    total_revenue = float(revenue_row or 0)

    gst_row = (await db.execute(
        select(func.sum(Order.total_gst)).where(Order.status != "cancelled")
    )).scalar_one()
    total_gst_collected = float(gst_row or 0)

    taxable_row = (await db.execute(
        select(func.sum(Order.taxable_amount)).where(Order.status != "cancelled")
    )).scalar_one()
    total_taxable = float(taxable_row or 0)

    pending_count = (await db.execute(
        select(func.count()).select_from(Order).where(
            Order.status.in_(["placed", "processing"])
        )
    )).scalar_one()

    return {
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "total_gst_collected": total_gst_collected,
        "total_taxable_revenue": total_taxable,
        "pending_count": pending_count,
    }


# ─────────────────────────────────────────────
# GET /admin/orders/{id}
# ─────────────────────────────────────────────

@router.get("/{id}", dependencies=[Depends(get_current_admin)])
async def admin_get_order(id: int, db: AsyncSession = Depends(get_db)):
    order = (await db.scalars(select(Order).where(Order.id == id))).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    items = (await db.execute(
        select(OrderItem).where(OrderItem.order_id == order.id)
    )).scalars().all()

    return _build_order_out(order, items)


# ─────────────────────────────────────────────
# PATCH /admin/orders/{id}/status
# ─────────────────────────────────────────────

@router.patch("/{id}/status", dependencies=[Depends(get_current_admin)])
async def admin_update_order_status(
    id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    order = (await db.scalars(select(Order).where(Order.id == id))).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    new_status = payload.get("status")
    VALID = {"placed", "processing", "shipped", "delivered", "cancelled", "returned"}
    if new_status not in VALID:
        raise HTTPException(status_code=400, detail=f"Invalid status: {new_status}")
    
    if new_status == "shipped" and not order.itl_awb_number:
        raise HTTPException(
            status_code=400,
            detail="Cannot mark as shipped — create ITL shipment first to get AWB number",
        )

    current = order.status
    payment_method = order.payment_method
    payment_status = order.payment_status
    ORDER_FLOW = ["placed", "processing", "shipped", "delivered"]
    FINAL = {"cancelled", "returned"}

    if current in FINAL:
        raise HTTPException(
            status_code=400,
            detail=f"Order is already '{current}' and cannot be changed"
        )

    if payment_method == "online" and payment_status in {"pending", "failed"}:
        if new_status not in {"cancelled", current}:
            raise HTTPException(
                status_code=400,
                detail="Online payment is pending/failed — only cancellation is allowed"
            )

    if current == "return_requested":
        if new_status not in {"returned", "delivered"}:
            raise HTTPException(
                status_code=400,
                detail="A return request can only be approved (returned) or rejected (delivered)"
            )
    elif new_status == "cancelled":
        if current not in ("placed", "processing"):
            raise HTTPException(
                status_code=400,
                detail="Orders can only be cancelled before they are shipped"
            )
    elif new_status == "returned":
        raise HTTPException(
            status_code=400,
            detail="Cannot mark as returned directly — must go through return request"
        )
    else:
        if current in ORDER_FLOW and new_status in ORDER_FLOW:
            current_idx = ORDER_FLOW.index(current)
            new_idx = ORDER_FLOW.index(new_status)
            if new_idx != current_idx and new_idx != current_idx + 1:
                raise HTTPException(
                    status_code=400,
                    detail=f"Orders must move step-by-step: '{current}' → next status"
                )

    order.status = new_status

    if new_status == "delivered" and payment_method == "cod":
        order.payment_status = "paid"

    await db.commit()
    await cache_orders.delete_pattern(f"orders:detail:*:{id}")
    await cache_orders.delete_pattern("orders:list:*")
    return {
        "message": "Status updated",
        "status": new_status,
        "payment_status": order.payment_status,
    }


# ─────────────────────────────────────────────
# PATCH /admin/orders/{id}/tracking
# (Manual tracking override — ITL sync is preferred)
# ─────────────────────────────────────────────

@router.patch("/{id}/tracking", dependencies=[Depends(get_current_admin)])
async def admin_update_tracking(
    id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    order = (await db.scalars(select(Order).where(Order.id == id))).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.tracking_number = payload.get("tracking_number", "")
    await db.commit()
    await cache_orders.delete_pattern(f"orders:detail:*:{id}")
    return {"message": "Tracking updated"}