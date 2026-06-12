from __future__ import annotations

import base64
import hashlib
import hmac
from typing import Optional

import httpx
from fastapi import HTTPException

from app.core.config import settings


# ─────────────────────────────────────────────
# Cashfree base URL
# ─────────────────────────────────────────────

def _base_url() -> str:
    if settings.CASHFREE_ENV == "production":
        return "https://api.cashfree.com/pg"
    return "https://sandbox.cashfree.com/pg"


def _headers() -> dict:
    return {
        "x-api-version": "2025-01-01",
        "x-client-id": settings.CASHFREE_APP_ID,
        "x-client-secret": settings.CASHFREE_SECRET_KEY,
        "Content-Type": "application/json",
    }


# ─────────────────────────────────────────────
# Create Cashfree Order
# ─────────────────────────────────────────────

async def create_cashfree_order(
    order_id: int,
    order_number: str,
    amount: float,
    customer_id: str,
    customer_name: str,
    customer_email: str,
    customer_phone: str,          # plain 10-digit phone (already decrypted)
) -> dict:
    """
    Create a Cashfree payment order.
    Returns {"cashfree_order_id": str, "payment_session_id": str}

    IMPORTANT URLs:
    - return_url  → frontend URL where user lands after payment (/order-success/:id)
    - notify_url  → BACKEND webhook endpoint Cashfree POSTs payment events to
                    This MUST be the backend URL, NOT the frontend URL.
                    In development use ngrok/localtunnel to expose localhost:8000.
    """
    frontend_url = getattr(settings, "SITE_URL", "http://localhost:5173")
    return_url = f"{frontend_url}/order-success/{order_id}"

    backend_url = getattr(settings, "BACKEND_URL", "http://127.0.0.1:8000")
    notify_url = f"{backend_url}/api/v1/webhooks/cashfree"

    payload = {
        "order_id": order_number,
        "order_amount": round(amount, 2),
        "order_currency": "INR",
        "customer_details": {
            "customer_id": str(customer_id),
            "customer_name": customer_name,
            "customer_email": customer_email,
            "customer_phone": f"+91{customer_phone}",
        },
        "order_meta": {
            "return_url": return_url,
            "notify_url": notify_url,
        },
    }

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            f"{_base_url()}/orders",
            json=payload,
            headers=_headers(),
        )

    if response.status_code not in (200, 201):
        print(f"[Cashfree] Create order failed: {response.status_code} {response.text}")
        raise HTTPException(
            status_code=500,
            detail="Payment gateway error. Please try again.",
        )

    data = response.json()
    return {
        "cashfree_order_id": data.get("cf_order_id") or data.get("order_id"),
        "payment_session_id": data.get("payment_session_id"),
    }


# ─────────────────────────────────────────────
# Verify webhook signature
# ─────────────────────────────────────────────

async def verify_webhook_signature(
    raw_body: bytes,
    timestamp: str,
    signature: str,
) -> bool:
    """
    Cashfree webhook signature verification.

    Formula (from Cashfree docs):
        signedPayload = timestamp_bytes + raw_body_bytes  (bytes concatenation)
        expectedSignature = Base64(HMAC-SHA256(secret, signedPayload))

    IMPORTANT: join as bytes directly — never decode raw_body to string
    and re-encode, as that can corrupt non-ASCII characters (Indian names,
    addresses etc.) and cause signature mismatch in production.
    """
    try:
        # ✅ Bytes concatenation — no decode/encode round trip
        signed_payload = timestamp.encode("utf-8") + raw_body

        computed = base64.b64encode(
            hmac.new(
                settings.CASHFREE_SECRET_KEY.encode("utf-8"),
                signed_payload,
                hashlib.sha256,
            ).digest()
        ).decode("utf-8")

        # ✅ Constant-time comparison — prevents timing attacks
        return hmac.compare_digest(computed, signature)

    except Exception as exc:
        print(f"[Cashfree] Signature verification error: {exc}")
        return False


# ─────────────────────────────────────────────
# Process Refund
# ─────────────────────────────────────────────

async def process_refund(
    cashfree_order_id: str,
    refund_amount: float,
    refund_id: str,                 # e.g. "REF-KM-2025-0001"
) -> bool:
    """
    Initiate refund for a Cashfree order.
    Returns True on success, False otherwise.
    """
    payload = {
        "refund_amount": round(refund_amount, 2),
        "refund_id": refund_id,
        "refund_note": "Customer cancellation refund",
        "refund_speed": "STANDARD",
    }

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            f"{_base_url()}/orders/{cashfree_order_id}/refunds",
            json=payload,
            headers=_headers(),
        )

    if response.status_code in (200, 201):
        print(f"[Cashfree] Refund initiated: {refund_id}")
        return True

    print(f"[Cashfree] Refund failed: {response.status_code} {response.text}")
    return False


# ─────────────────────────────────────────────
# Get payment status
# ─────────────────────────────────────────────

async def get_payment_status(cashfree_order_id: str) -> Optional[str]:
    """
    Get payment status for a Cashfree order.
    Returns payment status string or None.
    """
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{_base_url()}/orders/{cashfree_order_id}/payments",
            headers=_headers(),
        )

    if response.status_code != 200:
        return None

    payments = response.json()
    if isinstance(payments, list) and payments:
        return payments[0].get("payment_status")
    return None