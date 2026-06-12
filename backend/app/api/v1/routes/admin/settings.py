from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_admin
from app.core.redis import cache_settings

router = APIRouter(prefix="/api/v1/admin/settings", tags=["Admin Settings"])

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


async def _upsert_setting(db: AsyncSession, key: str, value: str):
    await db.execute(
        text("""
            INSERT INTO site_settings (key, value)
            VALUES (:k, :v)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        """),
        {"k": key, "v": value},
    )


# ─────────────────────────────────────────────
# GET /admin/settings
# ─────────────────────────────────────────────

@router.get("", dependencies=[Depends(get_current_admin)])
async def get_settings(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        text("SELECT key, value FROM site_settings WHERE key = ANY(:keys)"),
        {"keys": SETTING_KEYS},
    )).all()

    settings_map = {**DEFAULT_SETTINGS, **{r[0]: r[1] for r in rows}}

    return {
        "freeShippingThreshold": float(settings_map["free_shipping_threshold"]),
        "flatShippingFee": float(settings_map["flat_shipping_fee"]),
        "enableFreeShipping": settings_map["free_shipping_enabled"].lower() == "true",
        "defaultCodEnabled": settings_map["default_cod_enabled"].lower() == "true",
        "defaultOnlineEnabled": settings_map["default_online_enabled"].lower() == "true",
    }


# ─────────────────────────────────────────────
# PUT /admin/settings
# ─────────────────────────────────────────────

@router.put("", dependencies=[Depends(get_current_admin)])
async def update_settings(payload: dict, db: AsyncSession = Depends(get_db)):
    mapping = {
        "freeShippingThreshold": "free_shipping_threshold",
        "flatShippingFee": "flat_shipping_fee",
        "enableFreeShipping": "free_shipping_enabled",
        "defaultCodEnabled": "default_cod_enabled",
        "defaultOnlineEnabled": "default_online_enabled",
    }

    for frontend_key, db_key in mapping.items():
        if frontend_key in payload:
            val = payload[frontend_key]
            # Booleans → "true"/"false" strings
            if isinstance(val, bool):
                val = "true" if val else "false"
            await _upsert_setting(db, db_key, str(val))

    await db.commit()

    # Bust shipping cache so orders pick up new values immediately
    await cache_settings.delete("settings:shipping")
    await cache_settings.delete("settings:public")

    return {"message": "Settings saved"}