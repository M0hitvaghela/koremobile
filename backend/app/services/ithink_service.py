"""
iThinkLogistics API v3 service.
Docs: https://docs.ithinklogistics.com/index/3
"""
from __future__ import annotations

import httpx
from datetime import date, datetime, timedelta
from typing import Any

from app.core.config import settings



def _base() -> str:
    return settings.ITL_BASE_URL.rstrip("/")

_TIMEOUT = 30
PINCODE_CACHE_TTL = 60 * 60 * 24 * 7  # 7 days

_ITL_HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/136.0.0.0 Safari/537.36"
    ),
}


def _auth() -> dict:
    return {
        "access_token": settings.ITL_ACCESS_TOKEN,
        "secret_key":   settings.ITL_SECRET_KEY,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Check Pincode Serviceability
# POST /api_v3/pincode/check.json
# ─────────────────────────────────────────────────────────────────────────────

async def check_pincode_serviceability(pincode: str) -> dict:
    from app.core.redis import cache_pincode  # lazy import avoids circular
    cache_key = f"pincode:serviceability:{pincode}"
    cached = await cache_pincode.get(cache_key)
    if cached is not None:
        cached["cached"] = True
        return cached

    payload = {"data": {"pincode": pincode, **_auth()}}
    url = f"{_base()}/api_v3/pincode/check.json"
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_ITL_HEADERS) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        raw = resp.json()

    result = _parse_pincode_response(pincode, raw)
    await cache_pincode.set(cache_key, result, PINCODE_CACHE_TTL)
    result["cached"] = False
    return result


def _parse_pincode_response(pincode: str, raw: dict) -> dict:
    if str(raw.get("status", "")).lower() != "success":
        return {"deliverable": False, "cod": False, "prepaid": False, "city": "", "state": ""}

    pincode_data: dict = raw.get("data", {}).get(pincode, {})
    if not pincode_data:
        return {"deliverable": False, "cod": False, "prepaid": False, "city": "", "state": ""}

    city  = pincode_data.get("city_name", "")
    state = pincode_data.get("state_name", "")
    cod_available = prepaid_available = False
    non_carrier_keys = {"remark", "state_name", "city_name", "city_id", "state_id"}

    for key, val in pincode_data.items():
        if key in non_carrier_keys or not isinstance(val, dict):
            continue
        if str(val.get("cod", "N")).upper() == "Y":
            cod_available = True
        if str(val.get("prepaid", "N")).upper() == "Y":
            prepaid_available = True

    return {
        "deliverable": cod_available or prepaid_available,
        "cod":         cod_available,
        "prepaid":     prepaid_available,
        "city":        city,
        "state":       state,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Get Shipping Rates
# POST /api_v3/rate/check.json
# Returns list of carriers with rate and delivery_tat
# ─────────────────────────────────────────────────────────────────────────────

async def get_rates(
    *,
    from_pincode: str,
    to_pincode: str,
    weight_kg: float,
    length_cm: float = 10.0,
    width_cm: float = 10.0,
    height_cm: float = 5.0,
    payment_method: str = "cod",   # "cod" or "prepaid"
    product_mrp: float = 0.0,
) -> list[dict]:
    """
    Fetch all available carrier rates from ITL.
    Returns list sorted by rate ascending:
    [
      {
        "logistic_name": "Xpressbees",
        "rate": 153.4,
        "delivery_tat": "1",
        "cod": "Y",
        "prepaid": "Y",
      },
      ...
    ]
    """
    payload = {
        "data": {
            "from_pincode":         from_pincode,
            "to_pincode":           to_pincode,
            "shipping_length_cms":  str(length_cm),
            "shipping_width_cms":   str(width_cm),
            "shipping_height_cms":  str(height_cm),
            "shipping_weight_kg":   str(weight_kg),
            "order_type":           "forward",
            "payment_method":       "COD" if payment_method == "cod" else "Prepaid",
            "product_mrp":          str(product_mrp),
            **_auth(),
        }
    }
    url = f"{_base()}/api_v3/rate/check.json"
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_ITL_HEADERS) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

    if str(data.get("status", "")).lower() != "success":
        raise ValueError(f"ITL rate check failed: {data.get('message', 'Unknown error')}")

    carriers_raw = data.get("data", {})
    carriers = []

    # ITL may return data as dict {"1": {...}, "2": {...}} or as list [{...}, {...}]
    if isinstance(carriers_raw, list):
        items_iter = carriers_raw
    elif isinstance(carriers_raw, dict):
        items_iter = list(carriers_raw.values())
    else:
        items_iter = []

    for v in items_iter:
        if isinstance(v, dict):
            carriers.append({
                "logistic_name":  v.get("logistic_name", ""),
                "rate":           float(v.get("rate", 0) or 0),
                "delivery_tat":   str(v.get("delivery_tat", "")),
                "cod":            v.get("cod", "N"),
                "prepaid":        v.get("prepaid", "Y"),
            })

    # Sort by rate ascending — cheapest first
    carriers.sort(key=lambda x: x["rate"])
    return carriers


# ─────────────────────────────────────────────────────────────────────────────
# Create Shipment
# POST /api_v3/order/add.json
# ─────────────────────────────────────────────────────────────────────────────

async def create_shipment(
    *,
    order_number: str,
    order_date: date,
    total_amount: float,
    payment_method: str,
    customer_name: str,
    customer_phone: str,
    customer_address: str,
    customer_address2: str = "",
    customer_city: str,
    customer_state: str,
    customer_pincode: str,
    customer_email: str = "",
    products: list[dict],
    weight_kg: float,
    length: float = 10.0,
    width: float = 10.0,
    height: float = 5.0,
    cod_amount: float = 0.0,
    shipping_charges: float = 0.0,
    logistics: str = "",           # "" = ITL auto-assigns; or "delhivery", "xpressbees" etc.
    eway_bill_number: str = "",    # Required by GST for orders > ₹50,000
) -> dict:
    payment_mode = "COD" if payment_method == "cod" else "Prepaid"

    payload = {
        "data": {
            "shipments": [
                {
                    "waybill": "",
                    "order": order_number,
                    "sub_order": "",
                    "order_date": order_date.strftime("%d-%m-%Y"),
                    "total_amount": str(total_amount),
                    "name": customer_name,
                    "add": customer_address,
                    "add2": customer_address2,
                    "add3": "",
                    "pin": customer_pincode,
                    "city": customer_city,
                    "state": customer_state,
                    "country": "India",
                    "phone": customer_phone,
                    "alt_phone": "",
                    "email": customer_email,
                    "is_billing_same_as_shipping": "yes",
                    "billing_name": customer_name,
                    "billing_add": customer_address,
                    "billing_add2": customer_address2,
                    "billing_add3": "",
                    "billing_pin": customer_pincode,
                    "billing_city": customer_city,
                    "billing_state": customer_state,
                    "billing_country": "India",
                    "billing_phone": customer_phone,
                    "billing_alt_phone": "",
                    "billing_email": customer_email,
                    "products": [
                        {
                            "product_name":     p.get("product_name", ""),
                            "product_sku":      p.get("product_sku", ""),
                            "product_quantity": str(p.get("product_quantity", 1)),
                            "product_price":    str(p.get("product_price", 0)),
                            "product_tax_rate": str(p.get("product_tax_rate", 0)),
                            "product_hsn_code": str(p.get("product_hsn_code", "")),
                            "product_discount": "0",
                        }
                        for p in products
                    ],
                    "shipment_length":       str(length),
                    "shipment_width":        str(width),
                    "shipment_height":       str(height),
                    "weight":                str(weight_kg),
                    "shipping_charges":      str(shipping_charges),
                    "giftwrap_charges":      "0",
                    "transaction_charges":   "0",
                    "total_discount":        "0",
                    "first_attemp_discount": "0",
                    "cod_charges":           "0",
                    "advance_amount":        "0",
                    "cod_amount":            str(cod_amount) if payment_mode == "COD" else "0",
                    "payment_mode":          payment_mode,
                    "reseller_name":         "",
                    "eway_bill_number":      eway_bill_number,
                    "gst_number":            "",
                    "what3words":            "",
                    "return_address_id":     str(settings.ITL_RETURN_ADDRESS_ID),
                }
            ],
            "pickup_address_id": str(settings.ITL_PICKUP_ADDRESS_ID),
            **_auth(),
            "logistics":  logistics,   # "" = auto-assign by ITL
            "s_type":     "",
            "order_type": "forward",
        }
    }

    url = f"{_base()}/api_v3/order/add.json"
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_ITL_HEADERS) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

    if str(data.get("status", "")).lower() != "success":
        msg = data.get("html_message") or data.get("message") or "ITL order creation failed"
        raise ValueError(f"iThinkLogistics: {msg}")

    result_map: dict[str, Any] = data.get("data", {})
    shipment_data: dict[str, Any] = {}
    for key in result_map:
        shipment_data = result_map[key]
        break

    if str(shipment_data.get("status", "")).lower() != "success":
        remark = shipment_data.get("remark", "Unknown error")
        raise ValueError(f"iThinkLogistics shipment error: {remark}")

    return {
        "itl_order_id":      str(shipment_data.get("refnum", order_number)),
        "itl_awb_number":    str(shipment_data.get("waybill", "")),
        "itl_logistic_name": str(shipment_data.get("logistic_name", "")),
        "itl_tracking_url":  str(shipment_data.get("tracking_url", "")),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Track Shipment
# POST /api_v3/order/track.json
# ─────────────────────────────────────────────────────────────────────────────

async def track_shipment(awb_number: str) -> dict:
    payload = {"data": {"awb_number_list": awb_number, **_auth()}}
    url = f"{_base()}/api_v3/order/track.json"
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_ITL_HEADERS) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

    if data.get("status_code") != 200:
        raise ValueError(f"ITL tracking request failed: {data}")

    tracking_map  = data.get("data", {})
    tracking_info = tracking_map.get(awb_number, {})

    if str(tracking_info.get("message", "")).lower() != "success":
        raise ValueError(f"ITL tracking not found for AWB: {awb_number}")

    return tracking_info


# ─────────────────────────────────────────────────────────────────────────────
# Cancel Shipment
# POST /api_v3/order/cancel.json
# ─────────────────────────────────────────────────────────────────────────────

async def cancel_shipment(awb_number: str) -> bool:
    payload = {"data": {"awb_numbers": awb_number, **_auth()}}
    url = f"{_base()}/api_v3/order/cancel.json"
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_ITL_HEADERS) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

    if str(data.get("status", "")).lower() != "success":
        msg = data.get("html_message") or data.get("message") or "Cancel failed"
        raise ValueError(f"ITL cancel error: {msg}")

    return True


# ─────────────────────────────────────────────────────────────────────────────
# Print Shipment Label
# POST /api_v3/shipping/label.json
# Returns PDF URL — admin opens and prints, sticks on box
# ─────────────────────────────────────────────────────────────────────────────

async def get_label_url(awb_number: str, page_size: str = "A4") -> str:
    """
    Get shipment label PDF URL for an AWB.
    Returns the PDF URL string.
    """
    payload = {
        "data": {
            "awb_numbers":           awb_number,
            "page_size":             page_size,
            "display_cod_prepaid":   "1",
            "display_shipper_mobile": "1",
            "display_shipper_address": "1",
            **_auth(),
        }
    }
    url = f"{_base()}/api_v3/shipping/label.json"
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_ITL_HEADERS) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

    if str(data.get("status", "")).lower() != "success":
        msg = data.get("message") or "Label generation failed"
        raise ValueError(f"ITL label error: {msg}")

    label_url = data.get("file_name", "")
    if not label_url:
        raise ValueError("ITL returned empty label URL")

    return label_url


# ─────────────────────────────────────────────────────────────────────────────
# Print Manifest
# POST /api_v3/shipping/manifest.json
# One PDF listing all AWBs — printed for carrier pickup
# ─────────────────────────────────────────────────────────────────────────────

async def get_manifest_url(awb_numbers: list[str]) -> str:
    """
    Generate manifest PDF for a list of AWB numbers.
    Returns the manifest PDF URL.
    AWB numbers are passed as comma-separated string.
    """
    payload = {
        "data": {
            "awb_numbers": ",".join(awb_numbers),
            **_auth(),
        }
    }
    url = f"{_base()}/api_v3/shipping/manifest.json"
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_ITL_HEADERS) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

    if str(data.get("status", "")).lower() != "success":
        msg = data.get("message") or "Manifest generation failed"
        raise ValueError(f"ITL manifest error: {msg}")

    manifest_url = data.get("file_name", "")
    if not manifest_url:
        raise ValueError("ITL returned empty manifest URL")

    return manifest_url


# ─────────────────────────────────────────────────────────────────────────────
# Get Airwaybill — used by cron job for auto-sync
# POST /api_v3/order/get_awb.json
# Fetches all AWBs with tracking updates in a time window (max 30 min window)
# ─────────────────────────────────────────────────────────────────────────────

async def get_updated_awbs(
    start_dt: datetime,
    end_dt: datetime,
) -> list[str]:
    """
    Fetch all AWB numbers that had tracking updates between start_dt and end_dt.
    Max window = 30 minutes (ITL limit).
    Returns list of AWB number strings.
    """
    payload = {
        "data": {
            "start_date_time": start_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "end_date_time":   end_dt.strftime("%Y-%m-%d %H:%M:%S"),
            **_auth(),
        }
    }
    url = f"{_base()}/api_v3/order/get_awb.json"
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_ITL_HEADERS) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

    if str(data.get("status", "")).lower() != "success":
        return []

    awb_list = data.get("Awb list", [])
    return [item["airway_bill_no"] for item in awb_list if "airway_bill_no" in item]