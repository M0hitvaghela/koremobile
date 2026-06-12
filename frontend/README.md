# Koremobile — Frontend

**React 18 · TypeScript · Vite · TailwindCSS · Zustand**

The customer-facing storefront and admin dashboard for the Koremobile e-commerce platform.

---

## ⚡ Quick Start

```bash
# Install dependencies
npm install

# Copy environment file and configure
cp .env.example .env

# Start development server
npm run dev
```

App runs at: **http://localhost:5173**

> Make sure the backend is running at `http://localhost:8000` before starting the frontend.

---

## 📋 Prerequisites

- **Node.js** 18+
- **npm** 9+
- Backend server running (see `../backend/README.md`)

---

## 🔑 Environment Variables

```env
# URL of the running FastAPI backend
VITE_API_BASE_URL=http://localhost:8000/api/v1

# Cashfree environment: "sandbox" for testing, "production" for live
VITE_CASHFREE_ENV=sandbox
```

> If you open the app on `http://127.0.0.1:5173` instead of `localhost`, update `VITE_API_BASE_URL` to use `http://127.0.0.1:8000/api/v1` to avoid CORS issues.

---

## 📁 Project Structure

```
frontend/
├── public/
│   └── assets/
│       ├── images/
│       │   ├── banners/          # Hero section images (phones, laptops, accessories)
│       │   ├── brands/           # Brand logos
│       │   ├── categories/       # Category images
│       │   └── products/         # Static product images (by category subfolder)
│       ├── icons/                # Favicon & app icons
│       └── logos/                # Site logos
│
├── src/
│   ├── components/
│   │   ├── admin/
│   │   │   ├── ProductForm.tsx   # Shared form for Add/Edit product (complex)
│   │   │   └── StatsCard.tsx     # Metric card for admin dashboard
│   │   ├── auth/
│   │   │   └── ProtectedRoute.tsx # Route guard for auth-required pages
│   │   ├── checkout/
│   │   │   ├── AddressForm.tsx   # New address form during checkout
│   │   │   └── GujaratCascade.tsx # District → Taluka → Village cascaded dropdowns
│   │   ├── layout/
│   │   │   ├── Header.tsx        # Main navbar with cart, search, auth state
│   │   │   ├── Footer.tsx        # Site footer with links
│   │   │   ├── HeroBanner.tsx    # Auto-sliding hero carousel
│   │   │   ├── CategoryNav.tsx   # Horizontal category strip
│   │   │   ├── TrustBadges.tsx   # "Free delivery", "Warranty" badges strip
│   │   │   ├── MainLayout.tsx    # Shell for storefront pages
│   │   │   └── AdminLayout.tsx   # Shell for admin pages (sidebar nav)
│   │   ├── product/
│   │   │   ├── ProductCard.tsx   # Product grid/list card with add-to-cart
│   │   │   ├── ReviewModal.tsx   # Star rating + review submission modal
│   │   │   └── RecentlyViewed.tsx # Recently viewed products strip
│   │   └── ui/
│   │       ├── Badge.tsx         # Colored label badge
│   │       ├── Button.tsx        # Unified button variants
│   │       ├── Input.tsx         # Form input with label + error
│   │       ├── Logo.tsx          # Site logo component
│   │       ├── Modal.tsx         # Generic modal wrapper
│   │       ├── Skeleton.tsx      # Loading skeleton
│   │       ├── StarRating.tsx    # Read/write star rating
│   │       ├── StatusBadge.tsx   # Order/shipping status chip
│   │       └── Toast.tsx         # Toast notification system
│   │
│   ├── pages/
│   │   ├── Home.tsx              # Homepage (hero, featured, categories)
│   │   ├── ProductListing.tsx    # Filtered/sorted product grid
│   │   ├── ProductDetail.tsx     # Full product page with variants + reviews
│   │   ├── Cart.tsx              # Cart page
│   │   ├── Checkout.tsx          # Multi-step checkout (address → payment)
│   │   ├── OrderSuccess.tsx      # Post-payment confirmation page
│   │   ├── SharedWishlist.tsx    # Public shareable wishlist view
│   │   ├── auth/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── ForgotPassword.tsx
│   │   │   ├── AdminLogin.tsx
│   │   │   └── AdminForgotPassword.tsx
│   │   ├── user/
│   │   │   ├── UserLayout.tsx    # Sidebar shell for user account pages
│   │   │   ├── Profile.tsx
│   │   │   ├── Orders.tsx
│   │   │   ├── OrderDetail.tsx   # Full order detail with tracking timeline
│   │   │   ├── Addresses.tsx
│   │   │   ├── Sessions.tsx      # Active sessions management
│   │   │   └── Wishlist.tsx      # Saved wishlist with share link
│   │   └── admin/
│   │       ├── AdminDashboard.tsx    # Analytics charts + summary cards
│   │       ├── AdminProducts.tsx     # Product list with bulk actions
│   │       ├── AddProduct.tsx        # Add new product
│   │       ├── EditProduct.tsx       # Edit existing product
│   │       ├── AdminOrders.tsx       # Order list with filters
│   │       ├── AdminOrderDetail.tsx  # Full order detail + shipping actions
│   │       ├── AdminUsers.tsx        # User list
│   │       ├── AdminUserDetail.tsx   # User profile + order history
│   │       ├── AdminReviews.tsx      # Review moderation queue
│   │       ├── AdminSessions.tsx     # Admin session management
│   │       ├── AdminEmailLog.tsx     # Email delivery log + resend
│   │       └── AdminSettings.tsx     # Site configuration
│   │
│   ├── store/                    # Zustand global state
│   │   ├── authStore.ts          # Auth state, login/logout, token
│   │   ├── cartStore.ts          # Cart items, totals
│   │   ├── productsStore.ts      # Product list + filters
│   │   ├── ordersStore.ts        # User orders
│   │   ├── adminOrdersStore.ts   # Admin orders with pagination
│   │   ├── wishlistStore.ts      # Wishlist items
│   │   ├── addressStore.ts       # Saved addresses
│   │   ├── recentlyViewedStore.ts # Recently viewed products
│   │   ├── settingsStore.ts      # Site settings
│   │   └── toastStore.ts         # Toast notifications
│   │
│   ├── utils/                    # API client modules (one per domain)
│   │   ├── api.ts                # Axios instance with auth interceptor
│   │   ├── authApi.ts
│   │   ├── adminApi.ts
│   │   ├── productsApi.ts
│   │   ├── ordersApi.ts
│   │   ├── cartApi.ts
│   │   ├── wishlistApi.ts
│   │   ├── shippingApi.ts
│   │   ├── searchApi.ts
│   │   ├── sessionsApi.ts
│   │   ├── settingsApi.ts
│   │   ├── cashfree.ts           # Cashfree JS SDK wrapper
│   │   ├── generateInvoicePdf.ts # Client-side invoice PDF generation
│   │   ├── getImageUrl.ts        # Product image URL resolver
│   │   ├── gujaratData.ts        # Gujarat location helpers
│   │   └── formatPrice.ts        # INR currency formatter
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useProducts.ts
│   │   └── useOrders.ts
│   │
│   ├── types/
│   │   ├── product.ts
│   │   ├── order.ts
│   │   └── user.ts
│   │
│   └── data/
│       └── gujarat.json          # All Gujarat districts, talukas, villages (36K+ entries)
│
├── index.html                    # Vite entry HTML with SEO meta tags
├── tailwind.config.js
├── vite.config.ts
├── tsconfig.json
└── .env.example
```

---

## 🗺️ Route Map

### Public / Storefront
| Path | Component | Description |
|---|---|---|
| `/` | Home | Hero, featured products, categories |
| `/products` | ProductListing | Filtered product grid |
| `/products/:slug` | ProductDetail | Full product page |
| `/cart` | Cart | Shopping cart |
| `/checkout` | Checkout | Multi-step checkout |
| `/order-success` | OrderSuccess | Payment confirmation |
| `/wishlist/:shareToken` | SharedWishlist | Public wishlist view |

### Auth
| Path | Component |
|---|---|
| `/login` | Login |
| `/register` | Register |
| `/forgot-password` | ForgotPassword |
| `/admin/login` | AdminLogin |
| `/admin/forgot-password` | AdminForgotPassword |

### User Account (protected)
| Path | Component |
|---|---|
| `/account/profile` | Profile |
| `/account/orders` | Orders |
| `/account/orders/:id` | OrderDetail |
| `/account/addresses` | Addresses |
| `/account/sessions` | Sessions |
| `/account/wishlist` | Wishlist |

### Admin Dashboard (protected, admin token required)
| Path | Component |
|---|---|
| `/admin` | AdminDashboard |
| `/admin/products` | AdminProducts |
| `/admin/products/add` | AddProduct |
| `/admin/products/:id/edit` | EditProduct |
| `/admin/orders` | AdminOrders |
| `/admin/orders/:id` | AdminOrderDetail |
| `/admin/users` | AdminUsers |
| `/admin/users/:id` | AdminUserDetail |
| `/admin/reviews` | AdminReviews |
| `/admin/sessions` | AdminSessions |
| `/admin/email-log` | AdminEmailLog |
| `/admin/settings` | AdminSettings |

---

## 🧩 State Management

All global state is managed with **Zustand**. Each store is independent and persists relevant slices to `localStorage` where appropriate (cart, auth token, recently viewed).

| Store | Persisted | Contents |
|---|---|---|
| `authStore` | ✅ | token, user info, admin flag |
| `cartStore` | ✅ | cart items array |
| `recentlyViewedStore` | ✅ | last 10 viewed products |
| `productsStore` | ❌ | current page + filters |
| `wishlistStore` | ❌ | wishlist items |
| `toastStore` | ❌ | active toast messages |

---

## 🛠️ Available Scripts

```bash
npm run dev       # Start development server (HMR enabled)
npm run build     # TypeScript check + production build → dist/
npm run preview   # Preview production build locally
npm run lint      # ESLint check
```

---

## 📦 Key Dependencies

| Package | Purpose |
|---|---|
| `react` + `react-dom` | UI library |
| `react-router-dom` v6 | Client-side routing |
| `typescript` | Type safety |
| `vite` | Build tool + dev server |
| `tailwindcss` | Utility-first CSS |
| `zustand` | Global state management |
| `axios` | HTTP client with interceptors |
| `framer-motion` | Animations (page transitions, modal) |
| `recharts` | Admin dashboard charts |
| `lucide-react` | Icon library |
