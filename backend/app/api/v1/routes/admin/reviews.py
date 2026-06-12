from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_admin
from app.core.redis import cache_reviews, cache_products
from app.models.review import Review
from app.models.blocked_review import BlockedReview
from app.models.user import User
from app.models.product import Product
from app.core.security import decrypt_field

router = APIRouter(prefix="/api/v1/admin/reviews", tags=["Admin Reviews"])

# ── Bad-word list (extend as needed) ──────────────────────────────────────────
BAD_WORDS: list[str] = [
    "fuck", "shit", "ass", "bastard", "bitch", "damn", "crap", "dick",
    "piss", "cock", "cunt", "whore", "slut", "nigger", "nigga", "faggot",
    "retard", "idiot", "stupid", "moron", "loser", "chutiya", "madarchod",
    "bhenchod", "gaandu", "harami", "randi", "saala", "bakwas", "bekar",
]

import re

def _contains_bad_word(text: str) -> bool:
    lower = text.lower()
    return any(re.search(rf'\b{re.escape(bw)}\b', lower) for bw in BAD_WORDS)


def _safe_decrypt(val: str | None) -> str:
    if not val:
        return "Customer"
    try:
        return decrypt_field(val)
    except Exception:
        return val


# ─────────────────────────────────────────────
# GET /admin/reviews — list all reviews
# ─────────────────────────────────────────────
@router.get("")
async def list_reviews(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    flagged: bool | None = Query(None),
    product_id: int | None = Query(None),
    rating: int | None = Query(None, ge=1, le=5),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin),
):
    stmt = select(Review).order_by(Review.created_at.desc())

    if product_id:
        stmt = stmt.where(Review.product_id == product_id)
    if rating:
        stmt = stmt.where(Review.rating == rating)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            or_(Review.title.ilike(like), Review.body.ilike(like))
        )

    reviews = (await db.execute(stmt)).scalars().all()

    user_ids = list({r.user_id for r in reviews})
    prod_ids = list({r.product_id for r in reviews})

    users = (await db.execute(
        select(User.id, User.name).where(User.id.in_(user_ids))
    )).all() if user_ids else []
    prods = (await db.execute(
        select(Product.id, Product.name).where(Product.id.in_(prod_ids))
    )).all() if prod_ids else []

    user_map = {u[0]: _safe_decrypt(u[1]) for u in users}
    prod_map = {p[0]: p[1] for p in prods}

    result = []
    for r in reviews:
        is_flagged = _contains_bad_word(r.title or "") or _contains_bad_word(r.body or "")
        if flagged is not None and is_flagged != flagged:
            continue
        result.append({
            "id": r.id,
            "product_id": r.product_id,
            "product_name": prod_map.get(r.product_id, "Unknown Product"),
            "user_id": r.user_id,
            "user_name": user_map.get(r.user_id, "Customer"),
            "rating": r.rating,
            "title": r.title or "",
            "body": r.body or "",
            "is_verified": r.is_verified,
            "is_flagged": is_flagged,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    total = len(result)
    offset = (page - 1) * per_page
    paginated = result[offset: offset + per_page]

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
        "flagged_count": sum(1 for r in result if r["is_flagged"]),
        "reviews": paginated,
    }


# ─────────────────────────────────────────────
# DELETE /admin/reviews/{review_id}
# Deletes the review AND writes to blocked_reviews
# so the user cannot re-submit for same order+product
# ─────────────────────────────────────────────
@router.delete("/{review_id}", status_code=204)
async def delete_review(
    review_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin),
):
    review = (await db.scalars(
        select(Review).where(Review.id == review_id)
    )).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    # Check if already blocked (admin deleted before, review somehow re-appeared)
    already_blocked = (await db.scalars(
        select(BlockedReview).where(
            BlockedReview.user_id == review.user_id,
            BlockedReview.product_id == review.product_id,
            BlockedReview.order_id == review.order_id,
        )
    )).first()

    # Write block record only if not already there
    if not already_blocked:
        block = BlockedReview(
            user_id=review.user_id,
            product_id=review.product_id,
            order_id=review.order_id,
            review_title=review.title,
            review_body=review.body,
            review_rating=review.rating,
            reason="Removed by admin - inappropriate content",
        )
        db.add(block)

    product_id = review.product_id
    product_slug = None
    product = (await db.scalars(select(Product).where(Product.id == product_id))).first()
    if product:
        product_slug = product.slug

    # Actually delete the review
    await db.delete(review)
    await db.commit()

    # Invalidate caches
    await cache_reviews.delete(f"reviews:product:{product_id}")
    if product_slug:
        await cache_products.delete(f"products:detail:{product_slug}")
    await cache_products.delete_pattern("products:list:*")


# ─────────────────────────────────────────────
# GET /admin/reviews/stats
# ─────────────────────────────────────────────
@router.get("/stats")
async def review_stats(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin),
):
    total = (await db.scalar(select(func.count(Review.id)))) or 0
    blocked_total = (await db.scalar(select(func.count(BlockedReview.id)))) or 0
    reviews = (await db.execute(select(Review))).scalars().all()
    flagged = sum(
        1 for r in reviews
        if _contains_bad_word(r.title or "") or _contains_bad_word(r.body or "")
    )
    avg = round(sum(r.rating for r in reviews) / len(reviews), 1) if reviews else 0.0
    return {
        "total": total,
        "flagged": flagged,
        "blocked_users": blocked_total,
        "avg_rating": avg,
    }