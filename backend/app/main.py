from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core import settings, init_db, redis_manager, REDIS_DBS
from app.core.limiter import limiter
from app.core.dependencies import set_models
from app.models.user import User
from app.models.admin_user import AdminUser
from app.models.blocked_review import BlockedReview
from app.models.session import UserSession, AdminSession
from app.models.wishlist import Wishlist, WishlistItem

from app.api.v1.routes import auth as auth_routes
from app.api.v1.routes import products as product_routes
from app.api.v1.routes import orders as order_routes
from app.api.v1.routes import reviews as review_routes
from app.api.v1.routes import settings as public_settings_routes
from app.api.v1.routes import search as search_routes
from app.api.v1.routes import users as user_routes
from app.api.v1.routes import webhooks as webhook_routes
from app.api.v1.routes import cart as cart_routes
from app.api.v1.routes import pincode as pincode_routes
from app.api.v1.routes import wishlist as wishlist_routes

from app.api.v1.routes.admin import auth as admin_auth_routes
from app.api.v1.routes.admin import products as admin_product_routes
from app.api.v1.routes.admin import auth as admin_auth
from app.api.v1.routes.admin import products as admin_products
from app.api.v1.routes.admin import orders as admin_orders
from app.api.v1.routes.admin import settings as admin_settings
from app.api.v1.routes.admin import reviews as admin_reviews
from app.api.v1.routes.admin import users as admin_users
from app.api.v1.routes.admin import email_log as admin_email_log
from app.api.v1.routes.admin import shipping as admin_shipping

from app.services.email_worker import run_email_worker
from app.services.itl_cron import run_itl_cron          # ← ITL auto-sync cron

STATIC_DIR = Path(__file__).resolve().parents[1] / "static" / "products"
STATIC_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_db()
        print("✓ Database initialized")
    except Exception as e:
        print(f"✗ Database init failed: {e}")
    try:
        await redis_manager.connect(REDIS_DBS)
        print("✓ Redis connected")
    except Exception as e:
        print(f"✗ Redis failed: {e}")

    asyncio.create_task(run_email_worker())
    print("✓ Email worker started")

    asyncio.create_task(run_itl_cron())                  # ← Start ITL auto-sync
    print("✓ ITL auto-sync cron queued")

    yield
    try:
        await redis_manager.disconnect()
    except Exception:
        pass


app = FastAPI(
    title="Koremobile API",
    version="1.0.0",
    lifespan=lifespan,
    redirect_slashes=False,
)

set_models(User, AdminUser)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    expose_headers=["Set-Cookie"],
    max_age=3600,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.mount(
    "/static/products",
    StaticFiles(directory=str(STATIC_DIR)),
    name="product_images",
)


@app.get("/api/v1/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "koremobile-api", "version": "1.0.0"}


@app.get("/", tags=["Root"])
async def root():
    return {"message": "Koremobile API", "docs": "/docs"}


app.include_router(auth_routes.router)
app.include_router(admin_auth_routes.router)
app.include_router(product_routes.router)
app.include_router(admin_product_routes.router)
app.include_router(order_routes.router)
app.include_router(review_routes.router)
app.include_router(user_routes.router)
app.include_router(public_settings_routes.router)
app.include_router(search_routes.router)
app.include_router(pincode_routes.router)
app.include_router(admin_auth.router)
app.include_router(admin_products.router)
app.include_router(admin_orders.router)
app.include_router(admin_settings.router)
app.include_router(admin_reviews.router)
app.include_router(admin_shipping.router)
app.include_router(cart_routes.router)
app.include_router(webhook_routes.router)
app.include_router(admin_users.router)
app.include_router(admin_email_log.router)
app.include_router(wishlist_routes.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)