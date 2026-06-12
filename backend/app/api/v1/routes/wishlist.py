from __future__ import annotations

"""
Wishlist routes
───────────────
Auth-required  (cookie session — same pattern as users.py):
  GET    /api/v1/wishlist              → get my wishlist (create if missing)
  POST   /api/v1/wishlist/items/{product_id}   → add product
  DELETE /api/v1/wishlist/items/{product_id}   → remove product
  PATCH  /api/v1/wishlist/title        → rename wishlist
  PATCH  /api/v1/wishlist/visibility   → toggle public / private
  DELETE /api/v1/wishlist              → clear all items

Public (no auth):
  GET    /api/v1/wishlist/share/{share_token}  → view shared wishlist
"""

import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.config import settings
from app.core.redis import cache_wishlist, CacheTTL
from app.schemas.wishlist import (
    WishlistOut,
    WishlistItemOut,
    WishlistProductOut,
    PublicWishlistOut,
    WishlistTitleUpdate,
    WishlistVisibilityUpdate,
)

router = APIRouter(prefix="/api/v1/wishlist", tags=["Wishlist"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_share_token() -> str:
    """Generate a 24-char URL-safe random token."""
    return secrets.token_urlsafe(18)[:24]


def _share_url(token: str) -> str:
    return f"{settings.FRONTEND_URL}/wishlist/{token}"


def _wishlist_user_key(user_id: int) -> str:
    return f"wishlist:user:{user_id}"


def _wishlist_share_key(token: str) -> str:
    return f"wishlist:share:{token}"


async def _invalidate_wishlist_cache(user_id: int, share_token: str | None) -> None:
    await cache_wishlist.delete(_wishlist_user_key(user_id))
    if share_token:
        await cache_wishlist.delete(_wishlist_share_key(share_token))


async def _get_or_create_wishlist(user_id: int, db: AsyncSession) -> dict:
    """Return existing wishlist row or create a new one for the user."""
    row = (await db.execute(
        text("SELECT * FROM wishlists WHERE user_id = :uid"),
        {"uid": user_id},
    )).mappings().first()

    if row:
        return dict(row)

    token = _make_share_token()
    new_row = (await db.execute(
        text("""
            INSERT INTO wishlists (user_id, share_token, title, is_public)
            VALUES (:uid, :token, 'My Wishlist', TRUE)
            RETURNING *
        """),
        {"uid": user_id, "token": token},
    )).mappings().first()
    await db.commit()
    return dict(new_row)


async def _fetch_items(wishlist_id: int, db: AsyncSession) -> list:
    """
    Fetch all wishlist items with embedded product data in one query.
    Returns a list of dicts ready to be shaped into WishlistItemOut.
    """
    rows = (await db.execute(
        text("""
            SELECT
                wi.id              AS item_id,
                wi.product_id,
                wi.added_at,
                p.slug,
                p.name,
                p.brand,
                p.category,
                MIN(pv.price)                                   AS min_price,
                MIN(pv.mrp)                                     AS min_mrp,
                ROUND(
                    ((MIN(pv.mrp) - MIN(pv.price)) / NULLIF(MIN(pv.mrp), 0)) * 100, 0
                )                                               AS max_discount_percent,
                COALESCE(SUM(pv.stock) FILTER (WHERE pv.is_active), 0) > 0 AS in_stock,
                pi_first.url                                    AS primary_image,
                COALESCE(AVG(r.rating), 0)                      AS avg_rating,
                COUNT(DISTINCT r.id)                            AS review_count
            FROM wishlist_items wi
            JOIN products p ON p.id = wi.product_id AND p.is_active = TRUE
            LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.is_active = TRUE
            LEFT JOIN reviews r ON r.product_id = p.id
            LEFT JOIN LATERAL (
                SELECT url FROM product_images
                WHERE product_id = p.id
                ORDER BY display_order
                LIMIT 1
            ) pi_first ON TRUE
            WHERE wi.wishlist_id = :wid
            GROUP BY wi.id, wi.product_id, wi.added_at,
                     p.slug, p.name, p.brand, p.category, pi_first.url
            ORDER BY wi.added_at DESC
        """),
        {"wid": wishlist_id},
    )).mappings().all()

    result = []
    for r in rows:
        product = WishlistProductOut(
            id=r["product_id"],
            slug=r["slug"],
            name=r["name"],
            brand=r["brand"],
            category=r["category"],
            primary_image=r["primary_image"],
            min_price=float(r["min_price"] or 0),
            min_mrp=float(r["min_mrp"] or 0),
            max_discount_percent=float(r["max_discount_percent"] or 0),
            in_stock=bool(r["in_stock"]),
            avg_rating=round(float(r["avg_rating"] or 0), 1),
            review_count=int(r["review_count"] or 0),
        )
        result.append(WishlistItemOut(
            id=r["item_id"],
            product_id=r["product_id"],
            added_at=r["added_at"],
            product=product,
        ))
    return result

def _build_wishlist_out(wl: dict, items: list) -> WishlistOut:
    return WishlistOut(
        id=wl["id"],
        user_id=wl["user_id"],
        share_token=wl["share_token"],
        share_url=_share_url(wl["share_token"]),
        title=wl["title"],
        is_public=wl["is_public"],
        item_count=len(items),
        items=items,
        created_at=wl["created_at"],
        updated_at=wl["updated_at"],
    )


# ── Auth-required endpoints ───────────────────────────────────────────────────

@router.get("", response_model=WishlistOut)
async def get_my_wishlist(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get (or auto-create) the user's wishlist with all items."""
    cache_key = _wishlist_user_key(current_user.id)
    cached = await cache_wishlist.get(cache_key)
    if cached:
        return cached

    wl = await _get_or_create_wishlist(current_user.id, db)
    items = await _fetch_items(wl["id"], db)
    payload = _build_wishlist_out(wl, items)
    await cache_wishlist.set(cache_key, payload.model_dump(mode="json"), CacheTTL.WISHLIST)
    return payload


@router.post("/items/{product_id}", response_model=WishlistOut, status_code=status.HTTP_201_CREATED)
async def add_to_wishlist(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Add a product to wishlist. Idempotent — adding twice is fine."""
    # Verify product exists and is active
    product = (await db.execute(
        text("SELECT id FROM products WHERE id = :pid AND is_active = TRUE"),
        {"pid": product_id},
    )).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    wl = await _get_or_create_wishlist(current_user.id, db)

    # INSERT OR IGNORE duplicate
    await db.execute(
        text("""
            INSERT INTO wishlist_items (wishlist_id, product_id)
            VALUES (:wid, :pid)
            ON CONFLICT (wishlist_id, product_id) DO NOTHING
        """),
        {"wid": wl["id"], "pid": product_id},
    )
    # Touch updated_at on parent
    await db.execute(
        text("UPDATE wishlists SET updated_at = NOW() WHERE id = :wid"),
        {"wid": wl["id"]},
    )
    await db.commit()

    # Re-fetch fresh wishlist row (updated_at changed)
    wl = (await db.execute(
        text("SELECT * FROM wishlists WHERE id = :wid"), {"wid": wl["id"]}
    )).mappings().first()
    items = await _fetch_items(wl["id"], db)
    await _invalidate_wishlist_cache(current_user.id, wl["share_token"])
    return _build_wishlist_out(dict(wl), items)


@router.delete("/items/{product_id}", response_model=WishlistOut)
async def remove_from_wishlist(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Remove a product from wishlist."""
    wl = await _get_or_create_wishlist(current_user.id, db)

    await db.execute(
        text("""
            DELETE FROM wishlist_items
            WHERE wishlist_id = :wid AND product_id = :pid
        """),
        {"wid": wl["id"], "pid": product_id},
    )
    await db.execute(
        text("UPDATE wishlists SET updated_at = NOW() WHERE id = :wid"),
        {"wid": wl["id"]},
    )
    await db.commit()

    wl = (await db.execute(
        text("SELECT * FROM wishlists WHERE id = :wid"), {"wid": wl["id"]}
    )).mappings().first()
    items = await _fetch_items(wl["id"], db)
    await _invalidate_wishlist_cache(current_user.id, wl["share_token"])
    return _build_wishlist_out(dict(wl), items)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def clear_wishlist(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Remove all items from wishlist."""
    wl = await _get_or_create_wishlist(current_user.id, db)
    await db.execute(
        text("DELETE FROM wishlist_items WHERE wishlist_id = :wid"),
        {"wid": wl["id"]},
    )
    await db.execute(
        text("UPDATE wishlists SET updated_at = NOW() WHERE id = :wid"),
        {"wid": wl["id"]},
    )
    await db.commit()
    await _invalidate_wishlist_cache(current_user.id, wl["share_token"])


@router.patch("/title", response_model=WishlistOut)
async def update_wishlist_title(
    payload: WishlistTitleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Rename the wishlist (e.g. "Diwali Gifts 2025")."""
    wl = await _get_or_create_wishlist(current_user.id, db)
    await db.execute(
        text("UPDATE wishlists SET title = :title, updated_at = NOW() WHERE id = :wid"),
        {"title": payload.title, "wid": wl["id"]},
    )
    await db.commit()

    wl = (await db.execute(
        text("SELECT * FROM wishlists WHERE id = :wid"), {"wid": wl["id"]}
    )).mappings().first()
    items = await _fetch_items(wl["id"], db)
    await _invalidate_wishlist_cache(current_user.id, wl["share_token"])
    return _build_wishlist_out(dict(wl), items)


@router.patch("/visibility", response_model=WishlistOut)
async def update_wishlist_visibility(
    payload: WishlistVisibilityUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Toggle wishlist public (share link works) / private."""
    wl = await _get_or_create_wishlist(current_user.id, db)
    await db.execute(
        text("UPDATE wishlists SET is_public = :pub, updated_at = NOW() WHERE id = :wid"),
        {"pub": payload.is_public, "wid": wl["id"]},
    )
    await db.commit()

    wl = (await db.execute(
        text("SELECT * FROM wishlists WHERE id = :wid"), {"wid": wl["id"]}
    )).mappings().first()
    items = await _fetch_items(wl["id"], db)
    await _invalidate_wishlist_cache(current_user.id, wl["share_token"])
    return _build_wishlist_out(dict(wl), items)


# ── Public share endpoint (no auth) ──────────────────────────────────────────

@router.get("/share/{share_token}", response_model=PublicWishlistOut)
async def get_shared_wishlist(
    share_token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint — anyone with the share link can view a wishlist.
    Returns 404 if not found, 403 if owner made it private.
    """
    cache_key = _wishlist_share_key(share_token)
    cached = await cache_wishlist.get(cache_key)
    if cached:
        return cached

    wl = (await db.execute(
        text("SELECT * FROM wishlists WHERE share_token = :token"),
        {"token": share_token},
    )).mappings().first()

    if not wl:
        raise HTTPException(status_code=404, detail="Wishlist not found")

    if not wl["is_public"]:
        raise HTTPException(status_code=403, detail="This wishlist is private")

    items = await _fetch_items(wl["id"], db)
    payload = PublicWishlistOut(
        share_token=wl["share_token"],
        title=wl["title"],
        item_count=len(items),
        items=items,
    )
    await cache_wishlist.set(cache_key, payload.model_dump(mode="json"), CacheTTL.WISHLIST)
    return payload