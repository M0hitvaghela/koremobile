<div align="center">

# 🛒 Koremobile

**A full-stack e-commerce platform for mobiles, laptops & accessories**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-5.0-DC382D?style=flat-square&logo=redis)](https://redis.io/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)

</div>

---

## 📖 Overview

Koremobile is a production-ready, full-stack e-commerce application built for selling consumer electronics. It features a React + TypeScript storefront, a FastAPI backend with async PostgreSQL and Redis caching, integrated OTP-based authentication, Cashfree payment gateway, iThinkLogistics shipping, and a fully-featured admin dashboard.

> **Built as a real-world portfolio project** demonstrating full-stack skills including REST API design, async Python, state management, payment/shipping integrations, and secure authentication flows.

---

## ✨ Features

### 🛍️ Customer Storefront
- **Home page** – Hero banner, featured products, category navigation, trust badges
- **Product listing** – Filter by category, brand, price range; sort by price/rating/newest
- **Product detail** – Image gallery, variant selection (color/storage), customer reviews, rating breakdown, pincode serviceability check, recently viewed
- **Cart** – Persistent cart with quantity management, coupon support
- **Checkout** – Multi-step flow with address selection/creation, Cashfree payment integration
- **Order tracking** – Real-time status, tracking number, invoice PDF download
- **Wishlist** – Save for later, publicly shareable wishlist links
- **User account** – Profile, saved addresses, order history, active sessions management

### 🔐 Authentication
- **Dual auth flows**: Email + OTP and Phone (SMS) + OTP
- **Password reset** via email or phone OTP
- **JWT-based sessions** with 24h access tokens and Redis session store
- **Multi-device sessions** with per-device revocation
- **Rate limiting** on all auth endpoints (slowapi)

### ⚙️ Admin Dashboard
- **Analytics overview** – Revenue charts, order volume, top products (Recharts)
- **Product management** – Create/edit/delete products, variants, multi-image upload/reorder
- **Order management** – View, update status, assign tracking, filter/search
- **Shipping (iThinkLogistics)** – Rate check, shipment creation, label generation, auto-sync cron
- **User management** – View profiles, block/unblock accounts
- **Review moderation** – Approve, reject, view reported reviews
- **Email log** – View sent/failed emails, resend failed
- **Session management** – Invalidate admin sessions
- **Settings** – Site-wide configuration

### ⚡ Performance & Infrastructure
- **Redis multi-DB caching** – Products (5 min), categories (1 hr), cart, sessions, OTP, rate limits — 11 isolated DBs
- **Async-first backend** – All DB and I/O operations are fully async (asyncpg + asyncio)
- **Background workers** – Email queue worker + ITL tracking sync cron run as asyncio tasks
- **Lazy-loaded pages** – React `lazy()` + `Suspense` for all routes
- **Zustand stores** – Lightweight global state for auth, cart, products, orders, wishlist

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, Zustand, React Router v6, Framer Motion, Recharts, Axios |
| **Backend** | FastAPI, Python 3.11+, Pydantic v2, Uvicorn |
| **Database** | PostgreSQL 17, SQLAlchemy 2.0 (async), asyncpg |
| **Cache / Sessions** | Redis 7+ (11 logical DBs) |
| **Auth** | JWT (python-jose), bcrypt (passlib), Fernet field encryption |
| **Payments** | Cashfree Payment Gateway |
| **Shipping** | iThinkLogistics (ITL) API |
| **SMS / OTP** | Twilio |
| **Email** | SMTP via Gmail (aiosmtplib), HTML email templates |
| **Images** | Local disk storage (Pillow), Cloudinary SDK included |

---

## 📁 Project Structure

```
koremobile/
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── api/v1/routes/      # All REST endpoints
│   │   │   ├── admin/          # Admin-only endpoints
│   │   │   └── *.py            # Public endpoints
│   │   ├── core/               # Config, DB, Redis, security
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   └── services/           # Business logic & third-party clients
│   ├── static/products/        # Uploaded product images
│   ├── schema.sql              # Full PostgreSQL schema dump
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/                   # React + TypeScript SPA
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── admin/          # Admin-specific components
│   │   │   ├── layout/         # Header, Footer, layouts
│   │   │   ├── product/        # ProductCard, ReviewModal, etc.
│   │   │   └── ui/             # Base UI primitives
│   │   ├── pages/              # Route-level page components
│   │   │   ├── admin/          # Admin dashboard pages
│   │   │   ├── auth/           # Login, Register, ForgotPassword
│   │   │   └── user/           # User account pages
│   │   ├── store/              # Zustand state stores
│   │   ├── utils/              # API clients (per-domain)
│   │   ├── hooks/              # Custom React hooks
│   │   ├── types/              # TypeScript interfaces
│   │   └── data/               # Static data (Gujarat locations JSON)
│   ├── public/assets/          # Static assets (banners, icons)
│   └── .env.example
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Python** 3.11+
- **Node.js** 18+
- **PostgreSQL** 14+ (a database named `koremobile_db`)
- **Redis** 7+ (running on default port `6379`)

### 1. Clone the repository

```bash
git clone https://github.com/M0hitvaghela/koremobile.git
cd koremobile
```

### 2. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env with your credentials (see backend/README.md for full details)
```

**Initialize the database:**
```bash
# Option A — use the provided schema dump
psql -U postgres -d koremobile_db -f schema.sql

# Option B — let SQLAlchemy auto-create tables on first run
# (tables are created automatically when the server starts)
```

**Generate encryption key:**
```bash
python generate_key.py
# Paste the output into ENCRYPTION_KEY in .env
```

**Create first admin user:**
```bash
python create_admin.py
```

**Start the backend:**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at: **http://localhost:8000/docs**

### 3. Frontend setup

```bash
cd frontend
npm install

cp .env.example .env
# Edit VITE_API_BASE_URL if your backend is not on localhost:8000
```

**Start the frontend:**
```bash
npm run dev
```

App runs at: **http://localhost:5173**

---

## 🌍 Environment Variables

See [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example) for all required variables with descriptions.

**Backend** requires: PostgreSQL, Redis, JWT secret keys, SMTP credentials, Twilio SID/token, Cashfree app ID/secret, iThinkLogistics access token + secret.

**Frontend** requires: `VITE_API_BASE_URL` pointing to the running backend.

---

## 📡 API Overview

The backend exposes a versioned REST API at `/api/v1/`. Full interactive docs at `/docs` (Swagger UI) and `/redoc`.

| Domain | Base Path |
|---|---|
| Auth (user) | `/api/v1/auth/` |
| Auth (admin) | `/api/v1/admin/auth/` |
| Products | `/api/v1/products/` |
| Admin Products | `/api/v1/admin/products/` |
| Orders | `/api/v1/orders/` |
| Admin Orders | `/api/v1/admin/orders/` |
| Cart | `/api/v1/cart/` |
| Wishlist | `/api/v1/wishlist/` |
| Reviews | `/api/v1/reviews/` |
| Users | `/api/v1/users/` |
| Search | `/api/v1/search/` |
| Shipping | `/api/v1/admin/shipping/` |
| Pincode | `/api/v1/pincode/` |
| Webhooks | `/api/v1/webhooks/` |

---

## 🗄️ Database Schema

Key tables: `users`, `admin_users`, `products`, `product_variants`, `product_images`, `orders`, `order_items`, `addresses`, `cart_items`, `wishlists`, `wishlist_items`, `reviews`, `otp_logs`, `sessions`, `email_queue`.

Full schema dump: [`backend/schema.sql`](backend/schema.sql)

---

## 🔒 Security Notes

- All passwords hashed with **bcrypt**
- Sensitive fields (phone, address details) encrypted at rest with **Fernet**
- JWT tokens stored in `Authorization` headers (not cookies)
- CORS restricted to configured origins
- Rate limiting on auth and OTP endpoints
- `.env` files excluded from version control

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).

---

<div align="center">
Built by <a href="https://github.com/M0hitvaghela">Mohit</a> · <a href="https://mohitstack.dev">mohitstack.dev</a>
</div>
