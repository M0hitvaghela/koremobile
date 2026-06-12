from __future__ import annotations

import re
import os
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_admin
from app.core.redis import cache_products
from app.models.product import Product, ProductVariant, ProductImage, ProductSpecification, ProductBadge
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate, VariantOut, SpecOut, BadgeOut
from app.services import image_service

router = APIRouter(prefix="/api/v1/admin/products", tags=["Admin Products"])
STATIC_PRODUCTS_DIR = Path(__file__).resolve().parents[5] / "static" / "products"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
STATIC_BASE_URL = "/static/products"


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text


async def _build_product_out(db: AsyncSession, product: Product) -> ProductOut:
    images = (
        await db.execute(
            select(ProductImage)
            .where(ProductImage.product_id == product.id)
            .order_by(ProductImage.display_order.asc())
        )
    ).scalars().all()

    variants = (
        await db.execute(
            select(ProductVariant)
            .where(ProductVariant.product_id == product.id)
            .order_by(ProductVariant.id.asc())
        )
    ).scalars().all()

    specs = (
        await db.execute(
            select(ProductSpecification)
            .where(ProductSpecification.product_id == product.id)
            .order_by(ProductSpecification.display_order.asc())
        )
    ).scalars().all()

    badges = (
        await db.execute(
            select(ProductBadge)
            .where(ProductBadge.product_id == product.id)
            .order_by(ProductBadge.display_order.asc(), ProductBadge.id.asc())
        )
    ).scalars().all()

    return ProductOut(
        id=product.id,
        name=product.name,
        slug=product.slug,
        brand=product.brand,
        category=product.category,
        description=product.description,
        images=[img.url for img in images],
        variants=[
            VariantOut(
                id=v.id,
                color=v.color,
                storage=v.storage,
                price=float(v.price),
                mrp=float(v.mrp),
                stock=v.stock,
                is_active=v.is_active,
            )
            for v in variants
        ],
        specifications=[
            SpecOut(
                id=s.id,
                spec_key=s.spec_key,
                spec_value=s.spec_value,
                display_order=s.display_order,
            )
            for s in specs
        ],
        badges=[
            BadgeOut(
                id=b.id,
                badge_key=b.badge_key,
                label=b.label_override,
                display_order=b.display_order,
            )
            for b in badges
        ],
        allow_cod=product.allow_cod,
        allow_online=product.allow_online,
        is_active=product.is_active,
        avg_rating=0.0,
        review_count=0,
        # ── GST fields ────────────────────────────────────────────────────────
        hsn_code=product.hsn_code,
        gst_rate=float(product.gst_rate) if product.gst_rate is not None else 18.0,
        # ─────────────────────────────────────────────────────────────────────
    )


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@router.get("", dependencies=[Depends(get_current_admin)])
async def admin_list_products(
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * limit

    # Get products with total stock
    stmt = (
        select(
            Product,
            func.coalesce(func.sum(ProductVariant.stock), 0).label("total_stock"),
        )
        .outerjoin(ProductVariant, ProductVariant.product_id == Product.id)
        .group_by(Product.id)
        .order_by(Product.created_at.desc())
        .offset(offset)
        .limit(limit)
    )

    rows = (await db.execute(stmt)).all()
    product_ids = [row[0].id for row in rows]

    # Batch-fetch variants for all products in one query
    variants_result = (await db.execute(
        select(ProductVariant)
        .where(ProductVariant.product_id.in_(product_ids))
        .order_by(ProductVariant.product_id, ProductVariant.id)
    )).scalars().all()

    # Batch-fetch first image per product
    images_result = (await db.execute(
        select(ProductImage)
        .where(ProductImage.product_id.in_(product_ids))
        .order_by(ProductImage.product_id, ProductImage.display_order)
    )).scalars().all()

    # Group by product_id
    from collections import defaultdict
    variants_map: dict = defaultdict(list)
    for v in variants_result:
        variants_map[v.product_id].append(v)

    images_map: dict = {}
    for img in images_result:
        if img.product_id not in images_map:
            images_map[img.product_id] = img.url  # only first image

    results = []
    for row in rows:
        product = row[0]
        pvariants = variants_map.get(product.id, [])
        results.append(
            {
                "id": product.id,
                "name": product.name,
                "slug": product.slug,
                "brand": product.brand,
                "category": product.category,
                "is_active": product.is_active,
                "allow_cod": product.allow_cod,
                "allow_online": product.allow_online,
                "gst_rate": float(product.gst_rate) if product.gst_rate is not None else 18.0,
                "hsn_code": product.hsn_code,
                "images": [images_map[product.id]] if product.id in images_map else [],
                "variants": [
                    {
                        "id": v.id,
                        "color": v.color,
                        "storage": v.storage,
                        "price": float(v.price),
                        "mrp": float(v.mrp),
                        "stock": v.stock,
                        "is_active": v.is_active,
                    }
                    for v in pvariants
                ],
            }
        )

    total = (await db.execute(select(func.count(Product.id)))).scalar_one()
    pages = max(1, (total + limit - 1) // limit)
    return {"products": results, "total": total, "page": page, "pages": pages}

@router.post("", dependencies=[Depends(get_current_admin)], response_model=ProductOut)
async def create_product(payload: ProductCreate, db: AsyncSession = Depends(get_db)):
    import uuid
    temp_slug = f"{slugify(payload.name)}-{uuid.uuid4().hex[:8]}"

    product = Product(
        name=payload.name,
        slug=temp_slug,
        brand=payload.brand,
        category=payload.category,
        description=payload.description,
        allow_cod=payload.allow_cod,
        allow_online=payload.allow_online,
        is_active=payload.is_active,
        # ── GST ──────────────────────────────────────────────────────────────
        hsn_code=payload.hsn_code,
        gst_rate=payload.gst_rate,
        # ─────────────────────────────────────────────────────────────────────
    )
    db.add(product)
    await db.flush()

    product.slug = f"{slugify(product.name)}-{product.id}"

    for variant in payload.variants:
        db.add(
            ProductVariant(
                product_id=product.id,
                color=variant.color,
                storage=variant.storage,
                price=variant.price,
                mrp=variant.mrp,
                stock=variant.stock,
                is_active=True,
            )
        )

    for spec in payload.specifications:
        db.add(
            ProductSpecification(
                product_id=product.id,
                spec_key=spec.spec_key,
                spec_value=spec.spec_value,
                display_order=spec.display_order,
            )
        )

    for badge in payload.badges:
        db.add(
            ProductBadge(
                product_id=product.id,
                badge_key=badge.badge_key,
                label_override=badge.label,
                display_order=badge.display_order,
            )
        )

    await db.commit()
    await db.refresh(product)

    await cache_products.delete_pattern("products:*")
    await cache_products.delete("categories:all")

    return await _build_product_out(db, product)


@router.get("/static-images", dependencies=[Depends(get_current_admin)])
async def list_static_images(
    request: Request,
    page: int = 1,
    limit: int = 60,
):
    if not STATIC_PRODUCTS_DIR.exists():
        return {"images": [], "count": 0, "total": 0, "page": 1, "pages": 1}

    page = max(1, page)
    limit = max(1, min(limit, 200))

    entries = [
        entry
        for entry in sorted(STATIC_PRODUCTS_DIR.iterdir())
        if entry.is_file() and entry.suffix.lower() in ALLOWED_EXTENSIONS
    ]
    total = len(entries)
    pages = max(1, (total + limit - 1) // limit)

    start = (page - 1) * limit
    end = start + limit
    page_entries = entries[start:end]

    base_url = str(request.base_url).rstrip("/")
    urls = [f"{base_url}{STATIC_BASE_URL}/{entry.name}" for entry in page_entries]

    return {"images": urls, "count": len(urls), "total": total, "page": page, "pages": pages}


@router.get("/{id}", dependencies=[Depends(get_current_admin)], response_model=ProductOut)
async def admin_get_product(id: int, db: AsyncSession = Depends(get_db)):
    product = (await db.scalars(select(Product).where(Product.id == id))).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return await _build_product_out(db, product)


@router.put("/{id}", dependencies=[Depends(get_current_admin)], response_model=ProductOut)
async def update_product(id: int, payload: ProductUpdate, db: AsyncSession = Depends(get_db)):
    product = (await db.scalars(select(Product).where(Product.id == id))).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # ── Basic fields ─────────────────────────────────────────────────────────
    if payload.name is not None:
        product.name = payload.name
        product.slug = f"{slugify(product.name)}-{product.id}"
    if payload.brand is not None:
        product.brand = payload.brand
    if payload.category is not None:
        product.category = payload.category
    if payload.description is not None:
        product.description = payload.description
    if payload.allow_cod is not None:
        product.allow_cod = payload.allow_cod
    if payload.allow_online is not None:
        product.allow_online = payload.allow_online
    if payload.is_active is not None:
        product.is_active = payload.is_active

    # ── GST fields ───────────────────────────────────────────────────────────
    if payload.hsn_code is not None:
        product.hsn_code = payload.hsn_code
    if payload.gst_rate is not None:
        product.gst_rate = payload.gst_rate
    # ─────────────────────────────────────────────────────────────────────────

    # ── Variants — smart upsert (NO hard delete) ─────────────────────────────
    if payload.variants is not None:
        existing_variants = (
            await db.execute(
                select(ProductVariant).where(ProductVariant.product_id == product.id)
            )
        ).scalars().all()
        existing_map = {v.id: v for v in existing_variants}
        seen_ids: set[int] = set()

        for variant_data in payload.variants:
            variant_id = getattr(variant_data, "id", None)

            if variant_id and variant_id in existing_map:
                v = existing_map[variant_id]
                v.color = variant_data.color
                v.storage = variant_data.storage
                v.price = variant_data.price
                v.mrp = variant_data.mrp
                v.stock = variant_data.stock
                v.is_active = True
                seen_ids.add(variant_id)
            else:
                new_v = ProductVariant(
                    product_id=product.id,
                    color=variant_data.color,
                    storage=variant_data.storage,
                    price=variant_data.price,
                    mrp=variant_data.mrp,
                    stock=variant_data.stock,
                    is_active=True,
                )
                db.add(new_v)
                await db.flush()
                seen_ids.add(new_v.id)

        for v in existing_variants:
            if v.id not in seen_ids:
                v.is_active = False

    # ── Specifications ────────────────────────────────────────────────────────
    if payload.specifications is not None:
        await db.execute(
            delete(ProductSpecification).where(ProductSpecification.product_id == product.id)
        )
        for spec in payload.specifications:
            db.add(
                ProductSpecification(
                    product_id=product.id,
                    spec_key=spec.spec_key,
                    spec_value=spec.spec_value,
                    display_order=spec.display_order,
                )
            )

    if payload.badges is not None:
        await db.execute(
            delete(ProductBadge).where(ProductBadge.product_id == product.id)
        )
        for badge in payload.badges:
            db.add(
                ProductBadge(
                    product_id=product.id,
                    badge_key=badge.badge_key,
                    label_override=badge.label,
                    display_order=badge.display_order,
                )
            )

    await db.commit()
    await db.refresh(product)

    await cache_products.delete_pattern("products:*")
    await cache_products.delete("categories:all")

    return await _build_product_out(db, product)


@router.delete("/{id}", dependencies=[Depends(get_current_admin)])
async def delete_product(id: int, db: AsyncSession = Depends(get_db)):
    product = (await db.scalars(select(Product).where(Product.id == id))).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    images = (
        await db.execute(select(ProductImage).where(ProductImage.product_id == product.id))
    ).scalars().all()
    for img in images:
        await image_service.delete_product_image(img.public_id or "")
    await db.execute(delete(ProductImage).where(ProductImage.product_id == product.id))

    product.is_active = False
    await db.commit()

    await cache_products.delete_pattern("products:*")
    await cache_products.delete("categories:all")

    return {"message": "Product deleted"}


@router.post("/{id}/images", dependencies=[Depends(get_current_admin)])
async def upload_product_image(
    id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    product = (await db.scalars(select(Product).where(Product.id == id))).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    upload = await image_service.upload_product_image(file)

    max_order = (
        await db.execute(
            select(func.max(ProductImage.display_order)).where(ProductImage.product_id == id)
        )
    ).scalar_one()
    next_order = (max_order or 0) + 1

    image = ProductImage(
        product_id=id,
        url=upload["url"],
        public_id=upload["public_id"],
        display_order=next_order,
    )
    db.add(image)
    await db.commit()
    await db.refresh(image)

    await cache_products.delete_pattern("products:*")
    return {"id": image.id, "url": image.url, "display_order": image.display_order}


@router.get("/{id}/images", dependencies=[Depends(get_current_admin)])
async def list_product_images(id: int, db: AsyncSession = Depends(get_db)):
    images = (
        await db.execute(
            select(ProductImage)
            .where(ProductImage.product_id == id)
            .order_by(ProductImage.display_order.asc())
        )
    ).scalars().all()
    return [{"id": img.id, "url": img.url, "display_order": img.display_order} for img in images]


@router.post("/{id}/images/link", dependencies=[Depends(get_current_admin)])
async def link_server_image(
    id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    product = (await db.scalars(select(Product).where(Product.id == id))).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    url = (payload.get("url") or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url is required")

    from urllib.parse import urlparse
    parsed = urlparse(url)
    relative_url = parsed.path if parsed.scheme else url

    filename = Path(relative_url).name
    file_path = STATIC_PRODUCTS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Image not found on disk: {filename}")

    existing = (await db.execute(
        select(ProductImage).where(
            ProductImage.product_id == id,
            ProductImage.url == relative_url,
        )
    )).scalars().first()
    if existing:
        return {"id": existing.id, "url": existing.url, "display_order": existing.display_order}

    max_order = (
        await db.execute(
            select(func.max(ProductImage.display_order)).where(ProductImage.product_id == id)
        )
    ).scalar_one()
    next_order = (max_order or 0) + 1

    public_id = file_path.stem
    image = ProductImage(
        product_id=id,
        url=relative_url,
        public_id=public_id,
        display_order=next_order,
    )
    db.add(image)
    await db.commit()
    await db.refresh(image)

    await cache_products.delete_pattern("products:*")
    return {"id": image.id, "url": image.url, "display_order": image.display_order}


@router.delete("/{id}/images/{image_id}", dependencies=[Depends(get_current_admin)])
async def delete_product_image(id: int, image_id: int, db: AsyncSession = Depends(get_db)):
    image = (
        await db.execute(
            select(ProductImage)
            .where(ProductImage.id == image_id, ProductImage.product_id == id)
        )
    ).scalars().first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    await image_service.delete_product_image(image.public_id or "")
    await db.execute(delete(ProductImage).where(ProductImage.id == image_id))

    images = (
        await db.execute(
            select(ProductImage)
            .where(ProductImage.product_id == id)
            .order_by(ProductImage.display_order.asc())
        )
    ).scalars().all()
    for idx, img in enumerate(images, start=1):
        img.display_order = idx

    await db.commit()
    await cache_products.delete_pattern("products:*")
    return {"message": "Image deleted"}


@router.delete("/{id}/images/{image_id}/unlink", dependencies=[Depends(get_current_admin)])
async def unlink_product_image(id: int, image_id: int, db: AsyncSession = Depends(get_db)):
    image = (
        await db.execute(
            select(ProductImage)
            .where(ProductImage.id == image_id, ProductImage.product_id == id)
        )
    ).scalars().first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    await db.execute(delete(ProductImage).where(ProductImage.id == image_id))

    remaining = (
        await db.execute(
            select(ProductImage)
            .where(ProductImage.product_id == id)
            .order_by(ProductImage.display_order.asc())
        )
    ).scalars().all()
    for idx, img in enumerate(remaining, start=1):
        img.display_order = idx

    await db.commit()
    await cache_products.delete_pattern("products:*")
    return {"message": "Image unlinked"}


@router.patch("/{id}/images/reorder", dependencies=[Depends(get_current_admin)])
async def reorder_images(id: int, payload: List[dict], db: AsyncSession = Depends(get_db)):
    product = (await db.scalars(select(Product).where(Product.id == id))).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    for item in payload:
        image_id = item.get("id")
        order = item.get("display_order")
        if image_id is None or order is None:
            continue
        await db.execute(
            ProductImage.__table__.update()
            .where(ProductImage.id == image_id)
            .values(display_order=order)
        )

    await db.commit()
    await cache_products.delete_pattern("products:*")
    return {"message": "Images reordered"}

@router.patch("/variants/{variant_id}/stock", dependencies=[Depends(get_current_admin)])
async def update_variant_stock(
    variant_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    variant = (await db.scalars(
        select(ProductVariant).where(ProductVariant.id == variant_id)
    )).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
 
    new_stock = payload.get("stock")
    if new_stock is None or not isinstance(new_stock, int) or new_stock < 0:
        raise HTTPException(status_code=400, detail="stock must be a non-negative integer")
 
    variant.stock = new_stock
    await db.commit()
    await cache_products.delete_pattern("products:*")
    return {"variant_id": variant_id, "stock": new_stock}