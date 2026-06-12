from __future__ import annotations

import os
import uuid
import asyncio
from pathlib import Path

from fastapi import UploadFile, HTTPException

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────

# Images saved here on disk.
# Make sure this folder exists (created automatically below).
UPLOAD_DIR = Path(__file__).resolve().parents[2] / "static" / "products"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Public URL prefix — must match where FastAPI mounts StaticFiles.
# e.g. http://127.0.0.1:8000/static/products/abc123.webp
STATIC_URL_PREFIX = "/static/products"

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _extension(content_type: str) -> str:
    return {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}.get(
        content_type, ".jpg"
    )


def _resize_image(content: bytes, content_type: str) -> bytes:
    """
    Resize to max 800px width while keeping aspect ratio.
    Uses Pillow. If Pillow is not installed just returns original bytes.
    """
    try:
        from PIL import Image
        import io

        img = Image.open(io.BytesIO(content))
        img = img.convert("RGB")
        max_width = 800
        if img.width > max_width:
            ratio = max_width / img.width
            new_size = (max_width, int(img.height * ratio))
            img = img.resize(new_size, Image.LANCZOS)

        buf = io.BytesIO()
        # Always save as JPEG for smaller size (good quality)
        img.save(buf, format="JPEG", quality=85, optimize=True)
        return buf.getvalue()
    except Exception:
        return content  # fall back to original if Pillow fails


# ─────────────────────────────────────────────
# Public API (same interface the route uses)
# ─────────────────────────────────────────────

async def upload_product_image(file: UploadFile) -> dict:
    """
    Validate, resize and save product image to local disk.
    Returns: {"url": "/static/products/abc.jpg", "public_id": "abc"}
    """
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only jpg, png, webp images are allowed",
        )

    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Max image size is 5MB")

    # Resize in a thread so we don't block the event loop
    resized = await asyncio.to_thread(_resize_image, content, file.content_type)

    # Generate a unique filename
    unique_id = uuid.uuid4().hex
    filename = f"{unique_id}.jpg"  # always saved as jpg after resize
    dest = UPLOAD_DIR / filename

    def _write():
        dest.write_bytes(resized)

    await asyncio.to_thread(_write)

    url = f"{STATIC_URL_PREFIX}/{filename}"
    return {"url": url, "public_id": unique_id}


async def delete_product_image(public_id: str) -> bool:
    """
    Delete image file from local disk by public_id (the uuid hex without extension).
    Returns True if deleted or not found. False on empty public_id.
    """
    if not public_id:
        return False

    # public_id is the uuid hex, file saved as <public_id>.jpg
    target = UPLOAD_DIR / f"{public_id}.jpg"

    def _delete():
        try:
            target.unlink(missing_ok=True)
            return True
        except Exception:
            return False

    return await asyncio.to_thread(_delete)