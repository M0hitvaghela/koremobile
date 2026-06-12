from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Request, Response
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_maker
from app.core.redis import cache_orders, cache_products
from app.models.order import Order, OrderItem
from app.models.user import User
from app.models.product import ProductVariant
from app.services import payment_service
from app.services.email_service import send_order_confirmation_email, send_order_payment_failed_email
from app.core.security import decrypt_field

router = APIRouter(prefix="/api/v1/webhooks", tags=["Webhooks"])
logger = logging.getLogger("koremobile.webhooks")


# ─────────────────────────────────────────────
# POST /webhooks/cashfree
# ─────────────────────────────────────────────

@router.post("/cashfree")
async def cashfree_webhook(request: Request):
    """
    Receive and process Cashfree payment webhooks.
    Always returns 200 to Cashfree even on internal errors.
    Signature verified before processing.
    """
    # 1. Read raw bytes BEFORE any parsing (required for signature verification)
    raw_body = await request.body()

    timestamp = request.headers.get("x-webhook-timestamp", "")
    signature = request.headers.get("x-webhook-signature", "")

    logger.info(f"[Webhook] Received | ts={timestamp} | sig={signature[:12]}...")

    # 2. Verify signature
    if timestamp and signature:
        valid = await payment_service.verify_webhook_signature(raw_body, timestamp, signature)
        if not valid:
            logger.warning("[Webhook] Invalid signature — rejecting")
            return Response(content='{"status":"invalid_signature"}', status_code=400)
    else:
        logger.warning("[Webhook] Missing signature headers — rejecting")
        return Response(content='{"status":"missing_headers"}', status_code=400)

    # 3. Parse JSON
    try:
        body = json.loads(raw_body)
    except json.JSONDecodeError:
        logger.error("[Webhook] Failed to parse JSON body")
        return Response(content='{"status":"ok"}', status_code=200)

    event_type = body.get("type", "")
    logger.info(f"[Webhook] Event type: {event_type}")

    # 4. Process events
    async with async_session_maker() as db:
        try:
            if event_type == "PAYMENT_SUCCESS_WEBHOOK":
                await _handle_payment_success(db, body)

            elif event_type == "PAYMENT_FAILED_WEBHOOK":
                await _handle_payment_failed(db, body)

            elif event_type == "REFUND_STATUS_WEBHOOK":
                await _handle_refund_status(db, body)

            else:
                logger.info(f"[Webhook] Unhandled event type: {event_type}")

        except Exception as exc:
            logger.exception(f"[Webhook] Processing error for {event_type}: {exc}")
            # Always return 200 to Cashfree

    return Response(content='{"status":"ok"}', status_code=200)


# ─────────────────────────────────────────────
# Event handlers
# ─────────────────────────────────────────────

async def _handle_payment_success(db: AsyncSession, body: dict) -> None:
    data = body.get("data", {})
    order_data = data.get("order", {})
    payment_data = data.get("payment", {})

    our_order_number = order_data.get("order_id", "")  # KM-2025-0001
    cf_payment_id = str(payment_data.get("cf_payment_id", ""))

    logger.info(f"[Webhook] PAYMENT_SUCCESS for order {our_order_number}")

    order = (await db.scalars(
        select(Order).where(Order.order_number == our_order_number)
    )).first()

    if not order:
        logger.warning(f"[Webhook] Order not found: {our_order_number}")
        return

    # Idempotency: skip if already paid
    if order.payment_status == "paid":
        logger.info(f"[Webhook] Order {our_order_number} already paid — skipping")
        return

    order.payment_status = "paid"
    order.status = "processing"
    order.cashfree_payment_id = cf_payment_id
    await db.commit()

    # Invalidate caches
    await cache_orders.delete(f"orders:detail:{order.user_id}:{order.id}")
    await cache_orders.delete(f"orders:list:{order.user_id}:1:10")
    logger.info(f"[Webhook] Order {our_order_number} → paid + processing")

    # ── Send order confirmation email ─────────────────────────────────────
    try:
        user = (await db.scalars(select(User).where(User.id == order.user_id))).first()
        if user:
            try:
                _email = decrypt_field(user.email or "") if user.email else ""
            except Exception:
                _email = user.email or ""
            if _email:
                items = (await db.execute(
                    select(OrderItem).where(OrderItem.order_id == order.id)
                )).scalars().all()
                import asyncio
                asyncio.create_task(send_order_confirmation_email(
                    name=user.name or "Customer",
                    email=_email,
                    order_number=our_order_number,
                    items=[
                        {"name": i.product_name, "qty": i.quantity, "price": float(i.price)}
                        for i in items
                    ],
                    total=float(order.total),
                ))
    except Exception as exc:
        logger.warning(f"[Webhook] Email send failed for {our_order_number}: {exc}")


async def _handle_payment_failed(db: AsyncSession, body: dict) -> None:
    data = body.get("data", {})
    order_data = data.get("order", {})
    our_order_number = order_data.get("order_id", "")

    logger.info(f"[Webhook] PAYMENT_FAILED for order {our_order_number}")

    order = (await db.scalars(
        select(Order).where(Order.order_number == our_order_number)
    )).first()
    if not order:
        return

    order.payment_status = "failed"

    # Restore stock
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

    await db.commit()
    await cache_products.delete_pattern("products:*")
    await cache_orders.delete(f"orders:detail:{order.user_id}:{order.id}")
    logger.info(f"[Webhook] Order {our_order_number} → payment failed, stock restored")

    # ── Send payment failed email ─────────────────────────────────────────
    try:
        user = (await db.scalars(select(User).where(User.id == order.user_id))).first()
        if user:
            try:
                _email = decrypt_field(user.email or "") if user.email else ""
            except Exception:
                _email = user.email or ""
            if _email:
                import asyncio
                asyncio.create_task(send_order_payment_failed_email(
                    name=user.name or "Customer",
                    email=_email,
                    order_number=our_order_number,
                ))
    except Exception as exc:
        logger.warning(f"[Webhook] Failed email send failed for {our_order_number}: {exc}")


async def _handle_refund_status(db: AsyncSession, body: dict) -> None:
    data = body.get("data", {})
    refund_status = data.get("refund", {}).get("refund_status", "")
    order_id_cf = data.get("order", {}).get("order_id", "")  # our order_number

    logger.info(f"[Webhook] REFUND_STATUS {refund_status} for {order_id_cf}")

    if refund_status != "SUCCESS":
        return

    order = (await db.scalars(
        select(Order).where(Order.order_number == order_id_cf)
    )).first()
    if order:
        order.payment_status = "refunded"
        await db.commit()
        await cache_orders.delete(f"orders:detail:{order.user_id}:{order.id}")
        logger.info(f"[Webhook] Order {order_id_cf} → refunded")