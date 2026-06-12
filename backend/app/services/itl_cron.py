"""
ITL Auto-Sync Cron Job
Runs every 30 minutes in background.
Uses Get Airwaybill API to fetch all AWBs updated recently,
then syncs tracking for matching orders in our DB.

Registered in main.py lifespan startup.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_maker
from app.models.order import Order
from app.services import ithink_service

SYNC_INTERVAL_MINUTES = 30   # run every 30 minutes
AWB_WINDOW_MINUTES    = 30   # ITL max window per request


async def _sync_order_tracking(order: Order, db: AsyncSession) -> None:
    """Sync tracking for one order. Silently skips on error."""
    if not order.itl_awb_number:
        return
    try:
        tracking = await ithink_service.track_shipment(order.itl_awb_number)

        order.itl_current_status      = tracking.get("current_status")
        order.itl_current_status_code = tracking.get("current_status_code")
        order.itl_raw_response        = tracking
        order.itl_last_synced_at      = datetime.utcnow()

        edd = tracking.get("expected_delivery_date")
        if edd:
            try:
                from datetime import date
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
                print(f"[ITL Cron] Order {order.order_number} auto-marked delivered")

        elif current_status in ("Picked Up", "In Transit", "Reached At Destination",
                                "Out For Delivery", "Manifested"):
            if order.status == "processing":
                order.status = "shipped"
                print(f"[ITL Cron] Order {order.order_number} auto-marked shipped")

        elif status_code == "CN":
            if order.status not in ("cancelled", "delivered"):
                order.status = "cancelled"

    except Exception as e:
        print(f"[ITL Cron] Tracking error for AWB {order.itl_awb_number}: {e}")


async def run_itl_sync_once() -> None:
    """
    One sync cycle:
    1. Call ITL Get Airwaybill API to get all AWBs updated in last 30 mins
    2. Find matching orders in our DB
    3. Sync tracking for each
    """
    now   = datetime.utcnow()
    start = now - timedelta(minutes=AWB_WINDOW_MINUTES)

    try:
        updated_awbs = await ithink_service.get_updated_awbs(start, now)
    except Exception as e:
        print(f"[ITL Cron] Get AWB list error: {e}")
        return

    if not updated_awbs:
        return

    print(f"[ITL Cron] {len(updated_awbs)} AWBs updated — syncing...")

    async with async_session_maker() as db:
        try:
            # Find orders matching these AWBs
            orders = (await db.execute(
                select(Order).where(
                    Order.itl_awb_number.in_(updated_awbs),
                    Order.status.in_(["processing", "shipped"]),
                )
            )).scalars().all()

            if not orders:
                return

            for order in orders:
                await _sync_order_tracking(order, db)

            await db.commit()
            print(f"[ITL Cron] Synced {len(orders)} orders")

        except Exception as e:
            await db.rollback()
            print(f"[ITL Cron] DB error during sync: {e}")


async def run_itl_cron() -> None:
    """
    Infinite loop — runs sync every SYNC_INTERVAL_MINUTES.
    Started as asyncio task in main.py lifespan.
    """
    print(f"✓ ITL auto-sync cron started (every {SYNC_INTERVAL_MINUTES} min)")
    # Wait 60s on startup so DB/Redis are ready
    await asyncio.sleep(60)

    while True:
        try:
            await run_itl_sync_once()
        except Exception as e:
            print(f"[ITL Cron] Unexpected error: {e}")

        await asyncio.sleep(SYNC_INTERVAL_MINUTES * 60)