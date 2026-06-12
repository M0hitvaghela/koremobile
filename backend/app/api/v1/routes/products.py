from __future__ import annotations

import hashlib
import json
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, case, Integer, Table, Column, MetaData, Numeric, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import cache_products, CacheTTL
from app.models.product import Product, ProductImage, ProductVariant, ProductSpecification, ProductBadge
from app.schemas.product import ProductListItem, ProductListResponse, ProductOut, VariantOut, SpecOut, BadgeOut

router = APIRouter(prefix="/api/v1/products", tags=["Products"])


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _cache_key(prefix: str, params: dict) -> str:
    raw = json.dumps(params, sort_keys=True, default=str)
    digest = hashlib.sha256(raw.encode()).hexdigest()
    return f"{prefix}:{digest}"


def _normalize_search(search: str) -> tuple[str, list[str]]:
    term = re.sub(r"\s+", " ", search or "").strip()
    if not term:
        return "", []

    aliases = {
        "phone": "Mobiles",
        "phones": "Mobiles",
        "mobile": "Mobiles",
        "mobiles": "Mobiles",
        "smartphone": "Mobiles",
        "smartphones": "Mobiles",
        "tv": "TVs",
        "tvs": "TVs",
        "television": "TVs",
        "televisions": "TVs",
        "smarttv": "TVs",
        "laptop": "Laptops",
        "laptops": "Laptops",
        "notebook": "Laptops",
        "notebooks": "Laptops",
        "tablet": "Tablets",
        "tablets": "Tablets",
        "accessory": "Accessories",
        "accessories": "Accessories",
        "earphone": "Accessories",
        "earphones": "Accessories",
        "headphone": "Accessories",
        "headphones": "Accessories",
        "charger": "Accessories",
        "cable": "Accessories",
        "case": "Accessories",
    }

    tokens = re.split(r"\s+", term.lower())
    categories = sorted({aliases[t] for t in tokens if t in aliases})
    return term, categories


def _reviews_table():
    metadata = MetaData()
    return Table(
        "reviews",
        metadata,
        Column("product_id", Integer),
        Column("rating", Numeric(4, 2)),
    )


async def _fetch_product_images(db: AsyncSession, product_id: int) -> list[str]:
    rows = await db.execute(
        select(ProductImage.url)
        .where(ProductImage.product_id == product_id)
        .order_by(ProductImage.display_order.asc())
    )
    return [r[0] for r in rows.all()]


async def _fetch_variants(db: AsyncSession, product_id: int) -> list[VariantOut]:
    rows = await db.execute(
        select(ProductVariant)
        .where(ProductVariant.product_id == product_id)
        .order_by(ProductVariant.id.asc())
    )
    variants = []
    for row in rows.scalars().all():
        variants.append(
            VariantOut(
                id=row.id,
                color=row.color,
                storage=row.storage,
                price=float(row.price),
                mrp=float(row.mrp),
                stock=row.stock,
                is_active=row.is_active,
            )
        )
    return variants


async def _fetch_specs(db: AsyncSession, product_id: int) -> list[SpecOut]:
    rows = await db.execute(
        select(ProductSpecification)
        .where(ProductSpecification.product_id == product_id)
        .order_by(ProductSpecification.display_order.asc())
    )
    specs = []
    for row in rows.scalars().all():
        specs.append(
            SpecOut(
                id=row.id,
                spec_key=row.spec_key,
                spec_value=row.spec_value,
                display_order=row.display_order,
            )
        )
    return specs


async def _fetch_badges(db: AsyncSession, product_id: int) -> list[BadgeOut]:
    rows = await db.execute(
        select(ProductBadge)
        .where(ProductBadge.product_id == product_id)
        .order_by(ProductBadge.display_order.asc(), ProductBadge.id.asc())
    )
    badges = []
    for row in rows.scalars().all():
        badges.append(
            BadgeOut(
                id=row.id,
                badge_key=row.badge_key,
                label=row.label_override,
                display_order=row.display_order,
            )
        )
    return badges


async def _fetch_review_stats(db: AsyncSession, product_id: int) -> tuple[float, int]:
    reviews = _reviews_table()
    stmt = (
        select(func.avg(reviews.c.rating), func.count())
        .where(reviews.c.product_id == product_id)
    )
    result = await db.execute(stmt)
    avg_rating, review_count = result.first() or (0, 0)
    return float(avg_rating or 0), int(review_count or 0)


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@router.get("", response_model=ProductListResponse)
async def list_products(
    category: Optional[str] = None,
    brand: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort: str = "popular",
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    in_stock: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
):
    params = {
        "category": category,
        "brand": brand,
        "min_price": min_price,
        "max_price": max_price,
        "sort": sort,
        "page": page,
        "limit": limit,
        "search": search,
        "in_stock": in_stock,
    }
    cache_key = _cache_key("products:list", params)
    cached = await cache_products.get(cache_key)
    if cached:
        return cached

    reviews = _reviews_table()
    review_sub = (
        select(
            reviews.c.product_id.label("product_id"),
            func.avg(reviews.c.rating).label("avg_rating"),
            func.count().label("review_count"),
        )
        .group_by(reviews.c.product_id)
        .subquery()
    )

    img_min = (
        select(
            ProductImage.product_id.label("product_id"),
            func.min(ProductImage.display_order).label("min_order"),
        )
        .group_by(ProductImage.product_id)
        .subquery()
    )

    primary_img = (
        select(ProductImage.product_id, ProductImage.url)
        .join(
            img_min,
            (ProductImage.product_id == img_min.c.product_id)
            & (ProductImage.display_order == img_min.c.min_order),
        )
        .subquery()
    )

    in_stock_expr = func.max(case((ProductVariant.stock > 0, 1), else_=0))
    max_discount_expr = func.max(
        (ProductVariant.mrp - ProductVariant.price)
        / func.nullif(ProductVariant.mrp, 0)
        * 100
    )

    stmt = (
        select(
            Product.id,
            Product.name,
            Product.slug,
            Product.brand,
            Product.category,
            Product.allow_cod,
            Product.allow_online,
            Product.is_active,
            Product.created_at,
            Product.gst_rate,
            Product.hsn_code,
            func.min(ProductVariant.price).label("min_price"),
            func.max(ProductVariant.price).label("max_price"),
            func.min(ProductVariant.mrp).label("min_mrp"),
            max_discount_expr.label("max_discount_percent"),
            in_stock_expr.label("in_stock"),
            func.coalesce(review_sub.c.avg_rating, 0).label("avg_rating"),
            func.coalesce(review_sub.c.review_count, 0).label("review_count"),
            primary_img.c.url.label("primary_image"),
        )
        .join(ProductVariant, ProductVariant.product_id == Product.id)
        .outerjoin(primary_img, primary_img.c.product_id == Product.id)
        .outerjoin(review_sub, review_sub.c.product_id == Product.id)
        .where(Product.is_active.is_(True))
        .group_by(
            Product.id,
            Product.name,
            Product.slug,
            Product.brand,
            Product.category,
            Product.allow_cod,
            Product.allow_online,
            Product.is_active,
            Product.created_at,
            Product.gst_rate,
            Product.hsn_code,
            primary_img.c.url,
            review_sub.c.avg_rating,
            review_sub.c.review_count,
        )
    )

    if category:
        stmt = stmt.where(Product.category == category)
    if brand:
        stmt = stmt.where(Product.brand == brand)
    if search:
        term, categories = _normalize_search(search)
        if term:
            like = f"%{term}%"
            filters = [
                Product.name.ilike(like),
                Product.brand.ilike(like),
                Product.category.ilike(like),
                Product.description.ilike(like),
            ]
            if categories:
                filters.append(Product.category.in_(categories))
            stmt = stmt.where(or_(*filters))

    if min_price is not None:
        stmt = stmt.having(func.min(ProductVariant.price) >= min_price)
    if max_price is not None:
        stmt = stmt.having(func.max(ProductVariant.price) <= max_price)
    if in_stock:
        stmt = stmt.having(in_stock_expr > 0)

    if sort == "price_asc":
        stmt = stmt.order_by(func.min(ProductVariant.price).asc())
    elif sort == "price_desc":
        stmt = stmt.order_by(func.min(ProductVariant.price).desc())
    elif sort == "newest":
        stmt = stmt.order_by(Product.created_at.desc())
    else:
        # default: popular = highest review_count
        stmt = stmt.order_by(func.coalesce(review_sub.c.review_count, 0).desc())

    # Count query (mirrors filters but without pagination)
    count_stmt = (
        select(func.count(func.distinct(Product.id)))
        .join(ProductVariant, ProductVariant.product_id == Product.id)
        .where(Product.is_active.is_(True))
    )
    if category:
        count_stmt = count_stmt.where(Product.category == category)
    if brand:
        count_stmt = count_stmt.where(Product.brand == brand)
    if search:
        term, categories = _normalize_search(search)
        if term:
            like = f"%{term}%"
            filters = [
                Product.name.ilike(like),
                Product.brand.ilike(like),
                Product.category.ilike(like),
                Product.description.ilike(like),
                ]
            if categories:
                filters.append(Product.category.in_(categories))
            count_stmt = count_stmt.where(or_(*filters))
    if min_price is not None:
        count_stmt = count_stmt.where(
            Product.id.in_(
                select(ProductVariant.product_id)
                .group_by(ProductVariant.product_id)
                .having(func.min(ProductVariant.price) >= min_price)
            )
        )
    if max_price is not None:
        count_stmt = count_stmt.where(
            Product.id.in_(
                select(ProductVariant.product_id)
                .group_by(ProductVariant.product_id)
                .having(func.max(ProductVariant.price) <= max_price)
            )
        )
    if in_stock:
        count_stmt = count_stmt.where(
            Product.id.in_(
                select(ProductVariant.product_id).where(ProductVariant.stock > 0)
            )
        )

    total = (await db.execute(count_stmt)).scalar_one()
    pages = max(1, (total + limit - 1) // limit)
    offset = (page - 1) * limit

    rows = await db.execute(stmt.offset(offset).limit(limit))
    products = []
    for row in rows.mappings().all():
        max_discount = int(round(float(row.max_discount_percent or 0)))
        products.append(
            ProductListItem(
                id=row.id,
                name=row.name,
                slug=row.slug,
                brand=row.brand,
                category=row.category,
                primary_image=row.primary_image,
                min_price=float(row.min_price or 0),
                max_price=float(row.max_price or 0),
                min_mrp=float(row.min_mrp or 0),
                max_discount_percent=max_discount,
                is_active=bool(row.is_active),
                allow_cod=bool(row.allow_cod),
                allow_online=bool(row.allow_online),
                avg_rating=float(row.avg_rating or 0),
                review_count=int(row.review_count or 0),
                in_stock=bool(row.in_stock),
                gst_rate=float(row.gst_rate) if row.gst_rate is not None else 18.0,
                hsn_code=row.hsn_code,
            )
        )

    response = ProductListResponse(products=products, total=total, page=page, pages=pages)
    await cache_products.set(cache_key, response.model_dump(), CacheTTL.PRODUCTS_LIST)
    return response


@router.get("/featured", response_model=list[ProductListItem])
async def featured_products(db: AsyncSession = Depends(get_db)):
    """Return 8 newest active products. Cached 5 minutes."""
    cache_key = "products:featured"
    cached = await cache_products.get(cache_key)
    if cached:
        return cached

    rows = await list_products(page=1, limit=8, sort="newest", db=db)
    await cache_products.set(cache_key, rows.model_dump()["products"], CacheTTL.FEATURED)
    return rows.products


@router.get("/categories", response_model=list[str])
async def categories(db: AsyncSession = Depends(get_db)):
    """Return distinct active product categories. Cached 1 hour."""
    cache_key = "categories:all"
    cached = await cache_products.get(cache_key)
    if cached:
        return cached

    rows = await db.execute(
        select(Product.category).where(Product.is_active.is_(True)).distinct()
    )
    categories_list = [r[0] for r in rows.all()]
    await cache_products.set(cache_key, categories_list, CacheTTL.CATEGORIES)
    return categories_list


@router.get("/{slug}", response_model=ProductOut)
async def product_detail(slug: str, db: AsyncSession = Depends(get_db)):
    """Return full product detail by slug. Cached 10 minutes."""
    cache_key = f"products:detail:{slug}"
    cached = await cache_products.get(cache_key)
    if cached:
        return cached

    product = (
        await db.scalars(
            select(Product).where(Product.slug == slug, Product.is_active.is_(True))
        )
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    images = await _fetch_product_images(db, product.id)
    variants = await _fetch_variants(db, product.id)
    specs = await _fetch_specs(db, product.id)
    badges = await _fetch_badges(db, product.id)
    avg_rating, review_count = await _fetch_review_stats(db, product.id)

    response = ProductOut(
        id=product.id,
        name=product.name,
        slug=product.slug,
        brand=product.brand,
        category=product.category,
        description=product.description,
        images=images,
        variants=variants,
        specifications=specs,
        badges=badges,
        allow_cod=product.allow_cod,
        allow_online=product.allow_online,
        is_active=product.is_active,
        avg_rating=avg_rating,
        review_count=review_count,
        gst_rate=float(product.gst_rate) if product.gst_rate is not None else 18.0,
        hsn_code=product.hsn_code,
    )
    await cache_products.set(cache_key, response.model_dump(), CacheTTL.PRODUCT_DETAIL)
    return response


@router.get("/{slug}/recommendations", response_model=ProductListResponse)
async def product_recommendations(
    slug: str,
    page: int = 1,
    limit: int = 12,
    db: AsyncSession = Depends(get_db),
):
    """Return mixed recommendations by brand/category for a product."""
    product = (
        await db.scalars(
            select(Product).where(Product.slug == slug, Product.is_active.is_(True))
        )
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    page = max(1, page)
    limit = max(1, min(limit, 24))

    cache_key = _cache_key("products:reco", {"slug": slug, "page": page, "limit": limit})
    cached = await cache_products.get(cache_key)
    if cached:
        return cached

    reviews = _reviews_table()
    review_sub = (
        select(
            reviews.c.product_id.label("product_id"),
            func.avg(reviews.c.rating).label("avg_rating"),
            func.count().label("review_count"),
        )
        .group_by(reviews.c.product_id)
        .subquery()
    )

    img_min = (
        select(
            ProductImage.product_id.label("product_id"),
            func.min(ProductImage.display_order).label("min_order"),
        )
        .group_by(ProductImage.product_id)
        .subquery()
    )

    primary_img = (
        select(ProductImage.product_id, ProductImage.url)
        .join(
            img_min,
            (ProductImage.product_id == img_min.c.product_id)
            & (ProductImage.display_order == img_min.c.min_order),
        )
        .subquery()
    )

    in_stock_expr = func.max(case((ProductVariant.stock > 0, 1), else_=0))
    max_discount_expr = func.max(
        (ProductVariant.mrp - ProductVariant.price)
        / func.nullif(ProductVariant.mrp, 0)
        * 100
    )

    brand_match = case((Product.brand == product.brand, 1), else_=0)

    stmt = (
        select(
            Product.id,
            Product.name,
            Product.slug,
            Product.brand,
            Product.category,
            Product.allow_cod,
            Product.allow_online,
            Product.is_active,
            Product.created_at,
            Product.gst_rate,
            Product.hsn_code,
            func.min(ProductVariant.price).label("min_price"),
            func.max(ProductVariant.price).label("max_price"),
            func.min(ProductVariant.mrp).label("min_mrp"),
            max_discount_expr.label("max_discount_percent"),
            in_stock_expr.label("in_stock"),
            func.coalesce(review_sub.c.avg_rating, 0).label("avg_rating"),
            func.coalesce(review_sub.c.review_count, 0).label("review_count"),
            primary_img.c.url.label("primary_image"),
            brand_match.label("brand_match"),
        )
        .join(ProductVariant, ProductVariant.product_id == Product.id)
        .outerjoin(primary_img, primary_img.c.product_id == Product.id)
        .outerjoin(review_sub, review_sub.c.product_id == Product.id)
        .where(Product.is_active.is_(True))
        .where(Product.slug != slug)
        .where(
            (Product.category == product.category)
            | (Product.brand == product.brand)
        )
        .group_by(
            Product.id,
            Product.name,
            Product.slug,
            Product.brand,
            Product.category,
            Product.allow_cod,
            Product.allow_online,
            Product.is_active,
            Product.created_at,
            Product.gst_rate,
            Product.hsn_code,
            primary_img.c.url,
            review_sub.c.avg_rating,
            review_sub.c.review_count,
            brand_match,
        )
        .order_by(brand_match.desc(), Product.created_at.desc())
    )

    count_stmt = (
        select(func.count(func.distinct(Product.id)))
        .join(ProductVariant, ProductVariant.product_id == Product.id)
        .where(Product.is_active.is_(True))
        .where(Product.slug != slug)
        .where(
            (Product.category == product.category)
            | (Product.brand == product.brand)
        )
    )

    total = (await db.execute(count_stmt)).scalar_one()
    pages = max(1, (total + limit - 1) // limit)
    offset = (page - 1) * limit

    rows = await db.execute(stmt.offset(offset).limit(limit))
    products = []
    for row in rows.mappings().all():
        max_discount = int(round(float(row.max_discount_percent or 0)))
        products.append(
            ProductListItem(
                id=row.id,
                name=row.name,
                slug=row.slug,
                brand=row.brand,
                category=row.category,
                primary_image=row.primary_image,
                min_price=float(row.min_price or 0),
                max_price=float(row.max_price or 0),
                min_mrp=float(row.min_mrp or 0),
                max_discount_percent=max_discount,
                is_active=bool(row.is_active),
                allow_cod=bool(row.allow_cod),
                allow_online=bool(row.allow_online),
                avg_rating=float(row.avg_rating or 0),
                review_count=int(row.review_count or 0),
                in_stock=bool(row.in_stock),
                gst_rate=float(row.gst_rate) if row.gst_rate is not None else 18.0,
                hsn_code=row.hsn_code,
            )
        )

    response = ProductListResponse(products=products, total=total, page=page, pages=pages)
    await cache_products.set(cache_key, response.model_dump(), CacheTTL.PRODUCTS_LIST)
    return response