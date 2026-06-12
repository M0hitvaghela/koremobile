from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import cache_settings, CacheTTL

router = APIRouter(prefix="/api/v1/settings", tags=["Settings"])

SETTING_KEYS = [
    "free_shipping_enabled",
    "free_shipping_threshold",
    "flat_shipping_fee",
    "default_cod_enabled",
    "default_online_enabled",
]

DEFAULT_SETTINGS = {
    "free_shipping_enabled": "true",
    "free_shipping_threshold": "10000",
    "flat_shipping_fee": "50",
    "default_cod_enabled": "true",
    "default_online_enabled": "true",
}


@router.get("")
async def get_public_settings(db: AsyncSession = Depends(get_db)):
    cache_key = "settings:public"
    cached = await cache_settings.get(cache_key)
    if cached:
        return cached

    rows = (await db.execute(
        text("SELECT key, value FROM site_settings WHERE key = ANY(:keys)"),
        {"keys": SETTING_KEYS},
    )).all()

    settings_map = {**DEFAULT_SETTINGS, **{r[0]: r[1] for r in rows}}
    payload = {
        "freeShippingThreshold": float(settings_map["free_shipping_threshold"]),
        "flatShippingFee": float(settings_map["flat_shipping_fee"]),
        "enableFreeShipping": settings_map["free_shipping_enabled"].lower() == "true",
        "defaultCodEnabled": settings_map["default_cod_enabled"].lower() == "true",
        "defaultOnlineEnabled": settings_map["default_online_enabled"].lower() == "true",
    }

    await cache_settings.set(cache_key, payload, CacheTTL.SETTINGS_TTL)
    return payload
