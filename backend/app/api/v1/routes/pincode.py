"""
Pincode serviceability check endpoint.
GET /api/v1/pincode/check?pincode=XXXXXX

- Only accepts Gujarat pincodes (36xxxx – 39xxxx)
- Delegates to ithink_service which handles ITL API call + Redis caching
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.core.limiter import enforce_rate_limit
from app.services.ithink_service import check_pincode_serviceability

router = APIRouter(prefix="/api/v1/pincode", tags=["Pincode"])

GUJARAT_PREFIXES = ("36", "37", "38", "39")
PINCODE_CHECK_LIMIT = 15  # allow 15 check per window (per IP) to prevent spam while staying user-friendly
PINCODE_CHECK_WINDOW_SECONDS = 600  # 10 minutes


class PincodeCheckResponse(BaseModel):
    pincode:     str
    deliverable: bool
    cod:         bool
    prepaid:     bool
    city:        str
    state:       str
    cached:      bool


@router.get("/check", response_model=PincodeCheckResponse)
async def check_pincode(pincode: str, request: Request):
    # 1. Format check
    if not pincode.isdigit() or len(pincode) != 6:
        raise HTTPException(status_code=400, detail="Pincode must be exactly 6 digits")

    # 2. Gujarat-only
    if not pincode.startswith(GUJARAT_PREFIXES):
        raise HTTPException(
            status_code=400,
            detail="We currently deliver only within Gujarat (pincodes 36xxxx – 39xxxx)"
        )

    # 3. Rate limit valid checks to prevent pincode spam while staying user-friendly.
    await enforce_rate_limit(
        request=request,
        scope="pincode:check",
        limit=PINCODE_CHECK_LIMIT,
        window_seconds=PINCODE_CHECK_WINDOW_SECONDS,
    )

    # 4. ithink_service handles Redis cache + ITL API call
    try:
        result = await check_pincode_serviceability(pincode)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Unable to verify pincode serviceability right now. Please try again later."
        )

    return PincodeCheckResponse(pincode=pincode, **result)