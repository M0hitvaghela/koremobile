from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.redis import cache_reviews, cache_products, CacheTTL
from app.models.review import Review
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.models.blocked_review import BlockedReview
from app.schemas.review import CreateReviewRequest, ReviewOut, ReviewSummary

router = APIRouter(prefix="/api/v1/reviews", tags=["Reviews"])


# ─────────────────────────────────────────────
# GET /reviews/product/{product_id}
# ─────────────────────────────────────────────

@router.get("/product/{product_id}", response_model=ReviewSummary)
async def get_product_reviews(
    product_id: int,
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"reviews:product:{product_id}"
    cached = await cache_reviews.get(cache_key)
    if cached:
        return cached

    reviews = (await db.execute(
        select(Review).where(Review.product_id == product_id).order_by(Review.created_at.desc())
    )).scalars().all()

    if not reviews:
        summary = ReviewSummary(
            avg_rating=0.0,
            total_reviews=0,
            rating_breakdown={"1": 0, "2": 0, "3": 0, "4": 0, "5": 0},
            reviews=[],
        )
        await cache_reviews.set(cache_key, summary.model_dump(mode="json"), CacheTTL.REVIEWS)
        return summary

    # Build breakdown
    breakdown: dict[str, int] = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
    for r in reviews:
        key = str(r.rating)
        if key in breakdown:
            breakdown[key] += 1

    avg_rating = round(sum(r.rating for r in reviews) / len(reviews), 1)

    # Fetch user names
    from app.models.user import User
    user_ids = list({r.user_id for r in reviews})
    users = (await db.execute(
        select(User.id, User.name).where(User.id.in_(user_ids))
    )).all()
    user_name_map = {u[0]: u[1] for u in users}

    def _safe_name(uid: int) -> str:
        raw = user_name_map.get(uid, "Customer")
        try:
            from app.core.security import decrypt_field
            return decrypt_field(raw)
        except Exception:
            return raw or "Customer"

    reviews_out = [
        ReviewOut(
            id=r.id,
            product_id=r.product_id,
            user_id=r.user_id,
            rating=r.rating,
            title=r.title or "",
            body=r.body or "",
            is_verified=r.is_verified,
            user_name=_safe_name(r.user_id),
            created_at=r.created_at,
        )
        for r in reviews
    ]

    summary = ReviewSummary(
        avg_rating=avg_rating,
        total_reviews=len(reviews),
        rating_breakdown=breakdown,
        reviews=reviews_out,
    )
    await cache_reviews.set(cache_key, summary.model_dump(mode="json"), CacheTTL.REVIEWS)
    return summary


# ─────────────────────────────────────────────
# POST /reviews — Create review
# ─────────────────────────────────────────────

@router.post("", response_model=ReviewOut)
async def create_review(
    payload: CreateReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # ── Check if this user+product+order was blocked by admin ─────────────────
    blocked = (await db.scalars(
        select(BlockedReview).where(
            BlockedReview.user_id == current_user.id,
            BlockedReview.product_id == payload.product_id,
            BlockedReview.order_id == payload.order_id,
        )
    )).first()
    if blocked:
        raise HTTPException(
            status_code=403,
            detail="Your previous review for this product was removed by admin. You cannot submit another review for this order."
        )

    # Verify order exists, belongs to user, is delivered
    order = (await db.scalars(
        select(Order).where(
            Order.id == payload.order_id,
            Order.user_id == current_user.id,
        )
    )).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "delivered":
        raise HTTPException(status_code=400, detail="Can only review delivered orders")

    # Verify product was in that order
    order_item = (await db.scalars(
        select(OrderItem).where(
            OrderItem.order_id == payload.order_id,
            OrderItem.product_id == payload.product_id,
        )
    )).first()
    if not order_item:
        raise HTTPException(status_code=400, detail="Product was not part of this order")

    # Check no existing review for same order+product
    existing = (await db.scalars(
        select(Review).where(
            Review.user_id == current_user.id,
            Review.product_id == payload.product_id,
            Review.order_id == payload.order_id,
        )
    )).first()
    if existing:
        raise HTTPException(status_code=409, detail="Review already submitted for this product and order")

    review = Review(
        product_id=payload.product_id,
        user_id=current_user.id,
        order_id=payload.order_id,
        rating=payload.rating,
        title=payload.title,
        body=payload.body,
        is_verified=True,
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)

    # Invalidate product reviews cache and product detail cache
    await cache_reviews.delete(f"reviews:product:{payload.product_id}")
    product = (await db.scalars(select(Product).where(Product.id == payload.product_id))).first()
    if product:
        await cache_products.delete(f"products:detail:{product.slug}")
    await cache_products.delete_pattern("products:list:*")

    user_name = current_user.name or "Customer"
    try:
        from app.core.security import decrypt_field
        user_name = decrypt_field(user_name)
    except Exception:
        pass

    return ReviewOut(
        id=review.id,
        product_id=review.product_id,
        user_id=review.user_id,
        rating=review.rating,
        title=review.title or "",
        body=review.body or "",
        is_verified=review.is_verified,
        user_name=user_name,
        created_at=review.created_at,
    )