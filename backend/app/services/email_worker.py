"""
Email queue worker for Koremobile.

Runs as a background asyncio task started at FastAPI startup.
Polls Redis list  "email:queue"  every 30 seconds.
Retries failed jobs up to MAX_RETRY (3) times.
Dead jobs (3 failures) are pushed to "email:failed" for inspection.

Redis key schema:
  email:queue   LIST  RPUSH to enqueue, BLPOP to dequeue
  email:failed  LIST  dead jobs (keep last 100)
"""

from __future__ import annotations

import asyncio
import json
import logging

logger = logging.getLogger("koremobile.email_worker")

QUEUE_KEY     = "email:queue"
FAILED_KEY    = "email:failed"
SENT_KEY      = "email:sent"
MAX_RETRY     = 3
LIST_MAX      = 100
POLL_INTERVAL = 30
FAILED_MAX_LEN = 100   # kept for clarity, same as LIST_MAX


async def _process_job(job: dict) -> bool:
    """Send one job. Returns True on success."""
    from app.services.email_service import send_queued_job
    try:
        return await send_queued_job(job)
    except Exception as exc:
        logger.error(f"[EmailWorker] Exception sending {job.get('type')} → {job.get('to')}: {exc}")
        return False


async def _requeue_or_fail(redis_client, job: dict) -> None:
    """Increment attempt counter. Re-enqueue or move to failed list."""
    job["attempt"] = job.get("attempt", 0) + 1

    if job["attempt"] < MAX_RETRY:
        # Put back at the front of the queue for the next poll
        await redis_client.lpush(QUEUE_KEY, json.dumps(job))
        logger.warning(
            f"[EmailWorker] Re-queued {job['type']} → {job['to']} "
            f"(attempt {job['attempt']}/{MAX_RETRY})"
        )
    else:
        # Dead — move to failed list, cap length
        await redis_client.rpush(FAILED_KEY, json.dumps(job))
        await redis_client.ltrim(FAILED_KEY, -FAILED_MAX_LEN, -1)
        logger.error(
            f"[EmailWorker] DEAD after {MAX_RETRY} attempts: "
            f"{job['type']} → {job['to']}"
        )


async def _drain_queue(redis_client) -> int:
    """Process all current items in queue. Returns count processed."""
    processed = 0
    while True:
        # Non-blocking pop from left
        raw = await redis_client.lpop(QUEUE_KEY)
        if raw is None:
            break   # queue empty

        try:
            job = json.loads(raw)
        except json.JSONDecodeError:
            logger.error(f"[EmailWorker] Bad JSON in queue: {raw[:100]}")
            continue

        attempt = job.get("attempt", 0)
        logger.info(
            f"[EmailWorker] Processing {job.get('type')} → {job.get('to')} "
            f"(attempt {attempt + 1}/{MAX_RETRY})"
        )

        success = await _process_job(job)

        if success:
            logger.info(f"[EmailWorker] ✓ Sent {job['type']} → {job['to']}")
            # Log to sent history, capped at LIST_MAX
            import datetime
            job_copy = {k: v for k, v in job.items() if k != "data"}
            job_copy["sent_at"] = datetime.datetime.utcnow().isoformat()
            await redis_client.rpush(SENT_KEY, json.dumps(job_copy))
            await redis_client.ltrim(SENT_KEY, -LIST_MAX, -1)
        else:
            await _requeue_or_fail(redis_client, job)

        processed += 1

    return processed


async def run_email_worker() -> None:
    """
    Main worker loop. Call once at FastAPI startup.
    Runs forever until the process exits.
    """
    from app.core.redis import cache_email

    logger.info("[EmailWorker] Started — polling every %ds", POLL_INTERVAL)

    while True:
        try:
            redis_client = cache_email.client
            count = await _drain_queue(redis_client)
            if count:
                logger.info(f"[EmailWorker] Processed {count} job(s)")
        except Exception as exc:
            logger.error(f"[EmailWorker] Loop error: {exc}")

        await asyncio.sleep(POLL_INTERVAL)