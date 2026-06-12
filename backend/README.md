# Koremobile — Backend

**FastAPI · PostgreSQL · Redis · Async Python**

A production-ready REST API for the Koremobile e-commerce platform, built async-first with FastAPI, SQLAlchemy 2.0, and Redis caching.

---

## ⚡ Quick Start

```bash
# 1. Create and activate virtual environment
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Fill in your credentials (see Environment Variables section below)

# 4. Generate encryption key
python generate_key.py
# Copy the ENCRYPTION_KEY value into your .env

# 5. Create the first admin account
python create_admin.py

# 6. Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Interactive API docs:** http://localhost:8000/docs  
**ReDoc:** http://localhost:8000/redoc  
**Health check:** http://localhost:8000/api/v1/health

---

## 📋 Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.11+ | |
| PostgreSQL | 14+ | Create a database named `koremobile_db` |
| Redis | 7+ | Running on `localhost:6379` |
| Twilio account | — | For SMS OTP |
| Cashfree account | — | For payments (sandbox available) |
| iThinkLogistics account | — | For shipping |
| Gmail account | — | For SMTP email delivery |

---

## 🗄️ Database Setup

**Option A — Restore from the included schema dump (recommended):**
```bash
createdb -U postgres koremobile_db
psql -U postgres -d koremobile_db -f schema.sql
```

**Option B — Let SQLAlchemy auto-create tables:**
Tables are created automatically when the server starts for the first time (via `init_db()` in `lifespan`). Use this for a fresh start without seed data.

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` and fill in every value:

```env
# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql+asyncpg://your_user:your_password@localhost/koremobile_db

# ── Cache ─────────────────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379/0

# ── Security ──────────────────────────────────────────────────────────────────
SECRET_KEY=          # Long random string for user JWT signing
ADMIN_SECRET_KEY=    # Separate key for admin JWT
ENCRYPTION_KEY=      # Output of generate_key.py (Fernet key)
ALGORITHM=HS256

ACCESS_TOKEN_EXPIRE_HOURS=24
ADMIN_TOKEN_EXPIRE_HOURS=12

# ── Email (SMTP via Gmail) ────────────────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_gmail_app_password   # Use an App Password, not your real password
OWNER_EMAIL=your_email@gmail.com

# ── SMS / OTP (Twilio) ────────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

# ── Payments (Cashfree) ───────────────────────────────────────────────────────
CASHFREE_APP_ID=your_app_id
CASHFREE_SECRET_KEY=your_secret_key
CASHFREE_ENV=sandbox        # Change to "production" when going live

# ── Shipping (iThinkLogistics) ────────────────────────────────────────────────
ITL_BASE_URL=https://pre-alpha.ithinklogistics.com   # Use https://my.ithinklogistics.com in production
ITL_ACCESS_TOKEN=your_itl_access_token
ITL_SECRET_KEY=your_itl_secret_key
ITL_PICKUP_ADDRESS_ID=your_id          # From ITL dashboard → Warehouses
ITL_RETURN_ADDRESS_ID=your_id
ITL_PICKUP_PINCODE=3600xx            # Your warehouse pincode

# ── Image Upload (Cloudinary — optional, local disk used by default) ──────────
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ── CORS & URLs ───────────────────────────────────────────────────────────────
SITE_URL=http://localhost:5173
BACKEND_URL=http://127.0.0.1:8000
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

> **Gmail App Password:** Go to Google Account → Security → 2-Step Verification → App passwords. Generate one and use it as `SMTP_PASSWORD`.

---

## 📁 Project Structure

```
backend/
├── app/
│   ├── main.py                         # FastAPI app, middleware, router registration
│   ├── core/
│   │   ├── config.py                   # Settings loaded from .env (Pydantic BaseSettings)
│   │   ├── database.py                 # Async SQLAlchemy engine + session factory
│   │   ├── redis.py                    # Redis manager (11 logical DBs)
│   │   ├── security.py                 # JWT, bcrypt, Fernet encryption
│   │   ├── dependencies.py             # FastAPI auth dependencies
│   │   └── limiter.py                  # Rate limiter (slowapi)
│   │
│   ├── models/                         # SQLAlchemy ORM models
│   │   ├── user.py                     # User, Address
│   │   ├── admin_user.py               # AdminUser
│   │   ├── product.py                  # Product, ProductVariant, ProductImage
│   │   ├── order.py                    # Order, OrderItem
│   │   ├── review.py                   # Review
│   │   ├── wishlist.py                 # Wishlist, WishlistItem
│   │   ├── session.py                  # UserSession, AdminSession
│   │   ├── otp_log.py                  # OtpLog
│   │   ├── search_history.py           # SearchHistory
│   │   └── blocked_review.py          # BlockedReview
│   │
│   ├── schemas/                        # Pydantic v2 request/response models
│   │   ├── auth.py
│   │   ├── product.py
│   │   ├── order.py
│   │   ├── user.py
│   │   ├── review.py
│   │   ├── search.py
│   │   └── wishlist.py
│   │
│   ├── services/                       # Business logic & third-party integrations
│   │   ├── email_service.py            # HTML email templates + sending
│   │   ├── email_worker.py             # Redis-backed async email queue worker
│   │   ├── ithink_service.py           # iThinkLogistics API client
│   │   ├── itl_cron.py                 # Auto-sync shipment tracking (cron)
│   │   ├── payment_service.py          # Cashfree payment session creation
│   │   ├── otp_service.py              # OTP generation + verification (email & SMS)
│   │   └── image_service.py            # Image upload, resize, local storage
│   │
│   └── api/v1/routes/
│       ├── auth.py                     # User auth (register, login, OTP, password reset)
│       ├── products.py                 # Product listing, detail, categories
│       ├── orders.py                   # Place order, order history, order detail
│       ├── cart.py                     # Cart CRUD
│       ├── wishlist.py                 # Wishlist CRUD + public share
│       ├── reviews.py                  # Submit/edit/delete reviews
│       ├── users.py                    # Profile, addresses
│       ├── search.py                   # Product search + history
│       ├── pincode.py                  # Pincode serviceability check
│       ├── settings.py                 # Public site settings
│       ├── webhooks.py                 # Cashfree webhook handler
│       └── admin/
│           ├── auth.py                 # Admin login, OTP, sessions
│           ├── products.py             # Product CRUD, image management
│           ├── orders.py               # Order management, status updates
│           ├── shipping.py             # ITL rates, shipment creation, label, sync
│           ├── reviews.py              # Review moderation
│           ├── users.py                # User list, block/unblock
│           ├── email_log.py            # Email log view + resend
│           └── settings.py             # Site settings management
│
├── static/products/                    # Uploaded product images (served at /static/products/)
├── schema.sql                          # Full PostgreSQL schema dump
├── create_admin.py                     # Script to create first admin user
├── generate_key.py                     # Script to generate Fernet ENCRYPTION_KEY
├── requirements.txt
└── .env.example
```

---

## 🌐 API Reference

Full interactive docs at `/docs`. Summary of all endpoint groups:

### Public Auth — `/api/v1/auth/`
| Method | Path | Description |
|---|---|---|
| POST | `/register/email` | Register with email + password |
| POST | `/register/email/send-otp` | Send email verification OTP |
| POST | `/register/email/verify` | Verify email OTP |
| POST | `/register/otp` | Register via phone OTP |
| POST | `/login/email` | Login with email + password |
| POST | `/login/otp/send` | Send SMS OTP for login |
| POST | `/login/otp/verify` | Verify SMS OTP, get token |
| POST | `/password/forgot` | Request password reset OTP |
| POST | `/password/verify` | Verify reset OTP |
| POST | `/password/reset` | Set new password |

### Admin Auth — `/api/v1/admin/auth/`
| Method | Path | Description |
|---|---|---|
| POST | `/login` | Admin login (email + password) |
| POST | `/login/verify-otp` | Verify admin OTP, get token |
| POST | `/forgot-password` | Admin password reset flow |
| GET | `/sessions` | List active admin sessions |
| DELETE | `/sessions/{id}` | Revoke specific session |
| POST | `/logout` | Logout current session |

### Products — `/api/v1/products/`
| Method | Path | Description |
|---|---|---|
| GET | `/` | Paginated product listing with filters |
| GET | `/featured` | Featured products for homepage |
| GET | `/categories` | List all categories |
| GET | `/{slug}` | Product detail by slug |
| GET | `/{slug}/recommendations` | Related products |

### Orders — `/api/v1/orders/`
| Method | Path | Description |
|---|---|---|
| POST | `/` | Place a new order |
| GET | `/` | User order history |
| GET | `/{id}` | Order detail |
| POST | `/{id}/cancel` | Cancel order |

### Admin Shipping — `/api/v1/admin/shipping/`
| Method | Path | Description |
|---|---|---|
| POST | `/{order_id}/rates` | Get ITL shipping rates |
| POST | `/{order_id}/create` | Create ITL shipment |
| GET | `/{order_id}/label` | Download shipping label |
| POST | `/{order_id}/sync` | Manually sync tracking status |
| POST | `/{order_id}/cancel` | Cancel shipment |
| POST | `/manifest` | Generate ITL manifest |

For all other endpoints see `/docs`.

---

## 🧠 Redis Architecture

The app uses 11 isolated Redis logical databases to avoid key collisions:

| DB | Purpose | TTL |
|---|---|---|
| 0 | Sessions (users) | 24 h |
| 1 | OTP codes | 10 min |
| 2 | Product cache | 5 min |
| 3 | Search history | — |
| 4 | Cart data | — |
| 5 | Order cache | 5 min |
| 6 | Site settings | 1 h |
| 7 | Review cache | 5 min |
| 8 | Rate limit counters | 1 min |
| 9 | Email queue | — |
| 10 | Pincode serviceability | 24 h |

---

## 🔄 Background Services

Two asyncio tasks start automatically at server startup:

**Email Queue Worker** (`services/email_worker.py`)  
Reads from Redis DB 9, sends emails via SMTP. Retries failed sends. Non-blocking — the API never waits for email delivery.

**ITL Tracking Sync** (`services/itl_cron.py`)  
Polls iThinkLogistics every 30 minutes for shipped orders and auto-updates tracking status in the database.

---

## 🔒 Security

- **Passwords:** bcrypt via passlib
- **Sensitive fields** (phone numbers, address details): Fernet symmetric encryption at rest
- **JWT tokens:** HS256, separate secrets for users and admins
- **Rate limiting:** slowapi — configurable per-endpoint limits
- **CORS:** Restricted to `ALLOWED_ORIGINS` in `.env`

---

## 🛠️ Development Tips

**Run with auto-reload:**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Flush all Redis data (dev only):**
```bash
redis-cli FLUSHALL
```

**Check API health:**
```bash
curl http://localhost:8000/api/v1/health
# {"status": "ok", "service": "koremobile-api", "version": "1.0.0"}
```

**View logs:**
Uvicorn logs print to stdout. Look for `✓` and `✗` prefixed lines on startup to confirm DB/Redis connections.
