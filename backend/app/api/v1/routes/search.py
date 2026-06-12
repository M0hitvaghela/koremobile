"""
search.py  –  Redis-first search history + suggestions

Strategy
────────
• Search history lives in Redis as a sorted-set per user:
    Key  : search:history:{user_id}
    Score: unix timestamp  (higher = more recent)
    TTL  : 30 days (rolling)

• Every history write does two things concurrently:
    1. Upsert in Redis sorted-set  (instant, always succeeds)
    2. Upsert in PostgreSQL        (async background task, best-effort)

• GET /suggestions
    - History : Redis only  (no DB hit)
    - Products : list_products() with its own Redis cache

• POST /history
    - Writes to Redis immediately
    - Fires background DB upsert (no await → doesn't block response)
"""

from __future__ import annotations

import asyncio
import time
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_optional_user
from app.core.redis import cache_search, CacheTTL
from app.models.search_history import SearchHistory
from app.schemas.search import (
    SearchHistoryIn,
    SearchSuggestionsOut,
    SearchSuggestionProduct,
)
from app.api.v1.routes.products import list_products

router = APIRouter(prefix="/api/v1/search", tags=["Search"])

# ── Redis key helpers ──────────────────────────────────────────────────────────

HISTORY_KEY   = "search:history:{uid}"   # sorted-set
HISTORY_TTL   = CacheTTL.SEARCH_HISTORY  # 30 days
MAX_HISTORY   = 20                        # keep top 20 most-recent items


def _hkey(user_id: int) -> str:
    return HISTORY_KEY.format(uid=user_id)


# ── Background DB upsert ───────────────────────────────────────────────────────

async def _db_upsert_history(user_id: int, query: str) -> None:
    """
    Best-effort PostgreSQL upsert — keeps only last 10 rows per user.

    Redis is the live source of truth for suggestions.
    DB is only for recovery after a Redis restart/flush.
    Capping at 10 rows per user means the table stays bounded:
      10 rows × 100k users = 1M rows max, forever.
    """
    try:
        from app.core.database import async_session_maker
        async with async_session_maker() as db:
            # 1. Remove existing entry for same query (de-duplicate, case-insensitive)
            await db.execute(
                text(
                    "DELETE FROM search_history WHERE user_id = :uid AND lower(query) = lower(:q)"
                ),
                {"uid": user_id, "q": query},
            )
            # 2. Insert fresh row (gets a new created_at = now)
            await db.execute(
                text("INSERT INTO search_history (user_id, query) VALUES (:uid, :q)"),
                {"uid": user_id, "q": query},
            )
            # 3. Trim: delete anything beyond the 10 most-recent rows for this user
            await db.execute(
                text(
                    """
                    DELETE FROM search_history
                    WHERE user_id = :uid
                      AND id NOT IN (
                          SELECT id FROM search_history
                          WHERE user_id = :uid
                          ORDER BY created_at DESC
                          LIMIT 10
                      )
                    """
                ),
                {"uid": user_id},
            )
            await db.commit()
    except Exception:
        pass  # never surface to user


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/history", dependencies=[Depends(get_current_user)])
async def log_search_history(
    payload: SearchHistoryIn,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
):
    """
    Log a search query for the authenticated user.

    Flow:
      1. Validate & normalise query.
      2. Upsert into Redis sorted-set (score = now).
      3. Trim to MAX_HISTORY items.
      4. Schedule background DB write (non-blocking).
    """
    query = payload.query.strip()
    if len(query) < 2:
        return {"message": "ignored"}

    key   = _hkey(current_user.id)
    score = time.time()

    try:
        client = cache_search.client
        # Upsert: zadd with update flag replaces existing score for same member
        await client.zadd(key, {query: score}, xx=False)
        # Keep only the MAX_HISTORY most-recent (highest scores)
        await client.zremrangebyrank(key, 0, -(MAX_HISTORY + 1))
        await client.expire(key, HISTORY_TTL)
    except Exception:
        pass  # Redis failure is non-fatal

    # Persist to DB in background (fire-and-forget)
    background_tasks.add_task(_db_upsert_history, current_user.id, query)

    return {"message": "ok"}


@router.get("/suggestions", response_model=SearchSuggestionsOut)
async def get_search_suggestions(
    q: str = "",
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_optional_user),
):
    """
    Return personalised history (from Redis) + product matches.

    History  → Redis sorted-set, O(log N)   — no DB hit
    Products → list_products() which has its own Redis cache
    """
    # ── 1. History from Redis ──────────────────────────────────────────────────
    history: list[str] = []
    q_lower = q.strip().lower()

    if current_user:
        try:
            # zrevrange = most-recent first (highest score first)
            raw: list[str] = await cache_search.client.zrevrange(_hkey(current_user.id), 0, MAX_HISTORY - 1)

            seen: set[str] = set()
            for item in raw:
                norm = item.strip()
                if not norm or norm.lower() in seen:
                    continue
                # If user typed something, filter history to matching items first
                if q_lower and not norm.lower().startswith(q_lower):
                    continue
                seen.add(norm.lower())
                history.append(norm)
                if len(history) >= 8:
                    break

            # If query given but no prefix matches, fall back to all recent history
            if q_lower and not history:
                for item in raw:
                    norm = item.strip()
                    if not norm or norm.lower() in seen:
                        continue
                    seen.add(norm.lower())
                    history.append(norm)
                    if len(history) >= 5:
                        break
        except Exception:
            pass  # Redis failure → just return empty history

    # ── 2. Product suggestions ─────────────────────────────────────────────────
    products: list[SearchSuggestionProduct] = []
    query = q.strip()
    if query:
        res = await list_products(search=query, page=1, limit=6, db=db)

        # list_products() may return a Pydantic model OR a plain dict depending
        # on whether FastAPI has serialised it yet — handle both defensively.
        raw_products = res.products if hasattr(res, "products") else res.get("products", [])

        for p in raw_products:
            # Same dual-access: Pydantic model (.attr) or dict (["key"])
            def _get(obj, attr):
                return getattr(obj, attr) if hasattr(obj, attr) else obj.get(attr)

            products.append(
                SearchSuggestionProduct(
                    name=_get(p, "name"),
                    slug=_get(p, "slug"),
                    brand=_get(p, "brand"),
                    image=_get(p, "primary_image"),
                    min_price=_get(p, "min_price"),
                    max_price=_get(p, "max_price"),
                )
            )

    return SearchSuggestionsOut(history=history, products=products)