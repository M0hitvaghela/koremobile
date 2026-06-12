# ─────────────────────────────────────────────────────────────────────────────
# File: backend/app/api/v1/routes/admin/email_log.py
# ─────────────────────────────────────────────────────────────────────────────

from __future__ import annotations
import json
from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import get_current_admin
from app.core.redis import cache_email

router = APIRouter(prefix="/api/v1/admin/email-log", tags=["Admin Email Log"])

QUEUE_KEY  = "email:queue"
FAILED_KEY = "email:failed"
SENT_KEY   = "email:sent"

RESENDABLE_TYPES = {"order_confirmation", "payment_failed", "welcome"}


def _parse_entries(raw_list: list[str], status: str) -> list[dict]:
    entries = []
    for i, raw in enumerate(raw_list):
        try:
            job = json.loads(raw)
        except Exception:
            job = {}
        entries.append({
            "id": f"{status}-{i}",
            "type": job.get("type", "unknown"),
            "to": job.get("to", ""),
            "status": status,
            "attempt": job.get("attempt", 0),
            "created_at": job.get("created_at"),
            "error": job.get("error"),
            # include full data so resend can use it
            "data": job.get("data", {}),
        })
    return entries


@router.get("", dependencies=[Depends(get_current_admin)])
async def get_email_log():
    """
    Returns the current contents of email:queue and email:failed Redis lists.
    """
    try:
        redis = cache_email.client
        queue_raw  = await redis.lrange(QUEUE_KEY,  0, -1) or []
        failed_raw = await redis.lrange(FAILED_KEY, 0, -1) or []
        sent_raw   = await redis.lrange(SENT_KEY,   0, -1) or []

        return {
            "queue":  _parse_entries(queue_raw,  "queued"),
            "failed": _parse_entries(failed_raw, "failed"),
            "sent":   _parse_entries(sent_raw,   "sent"),
        }
    except Exception as exc:
        return {"queue": [], "failed": [], "sent": [], "error": str(exc)}


@router.post("/resend/{status}/{index}", dependencies=[Depends(get_current_admin)])
async def resend_email(status: str, index: int):
    """
    Manually resend a specific failed/queued email by its list index.
    Only order_confirmation and payment_failed types are allowed.
    OTP and welcome emails cannot be resent.
    """
    from app.services.email_service import send_queued_job

    if status not in ("failed", "queued"):
        raise HTTPException(status_code=400, detail="Invalid status. Use 'failed' or 'queued'.")

    redis = cache_email.client
    key = FAILED_KEY if status == "failed" else QUEUE_KEY

    raw_list = await redis.lrange(key, 0, -1) or []

    if index < 0 or index >= len(raw_list):
        raise HTTPException(status_code=404, detail="Email entry not found.")

    try:
        job = json.loads(raw_list[index])
    except Exception:
        raise HTTPException(status_code=400, detail="Corrupt job data in Redis.")

    email_type = job.get("type", "")

    if email_type not in RESENDABLE_TYPES:
        raise HTTPException(
            status_code=403,
            detail=f"'{email_type}' emails cannot be resent manually. Only order_confirmation and payment_failed are allowed."
        )

    # Reset attempt count so it sends fresh
    job["attempt"] = 0
    success = await send_queued_job(job)

    if not success:
        raise HTTPException(
            status_code=502,
            detail="SMTP send failed. Email has been re-queued for retry."
        )

    # On success — remove from the list (swap with temp key trick for Redis lists)
    # We remove by matching the exact raw string
    await redis.lrem(key, 1, raw_list[index])

    return {"message": f"Email resent successfully to {job.get('to')}"}


@router.delete("/failed", dependencies=[Depends(get_current_admin)])
async def clear_failed_emails():
    """Clear the dead-letter list."""
    await cache_email.client.delete(FAILED_KEY)
    return {"message": "Failed email list cleared"}