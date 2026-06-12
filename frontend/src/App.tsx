import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { useAuthStore } from './store/authStore';
import { useCartStore } from './store/cartStore';
import { Home } from './pages/Home';

// ─── Lazy imports ─────────────────────────────────────────────────────────────

const ProductListing  = lazy(() => import('./pages/ProductListing').then(m => ({ default: m.ProductListing })));
const ProductDetail   = lazy(() => import('./pages/ProductDetail').then(m => ({ default: m.ProductDetail })));
const Cart            = lazy(() => import('./pages/Cart').then(m => ({ default: m.Cart })));
const Checkout        = lazy(() => import('./pages/Checkout').then(m => ({ default: m.Checkout })));
const OrderSuccess    = lazy(() => import('./pages/OrderSuccess').then(m => ({ default: m.OrderSuccess })));

// ── Wishlist (public share page — no auth needed) ─────────────────────────────
const SharedWishlist  = lazy(() => import('./pages/SharedWishlist').then(m => ({ default: m.SharedWishlist })));

const Login               = lazy(() => import('./pages/auth/Login').then(m => ({ default: m.Login })));
const Register            = lazy(() => import('./pages/auth/Register').then(m => ({ default: m.Register })));
const ForgotPassword      = lazy(() => import('./pages/auth/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const AdminLogin          = lazy(() => import('./pages/auth/AdminLogin').then(m => ({ default: m.AdminLogin })));
const AdminForgotPassword = lazy(() => import('./pages/auth/AdminForgotPassword').then(m => ({ default: m.AdminForgotPassword })));

const UserLayout  = lazy(() => import('./pages/user/UserLayout').then(m => ({ default: m.UserLayout })));
const Orders      = lazy(() => import('./pages/user/Orders').then(m => ({ default: m.Orders })));
const OrderDetail = lazy(() => import('./pages/user/OrderDetail').then(m => ({ default: m.OrderDetail })));
const Addresses   = lazy(() => import('./pages/user/Addresses').then(m => ({ default: m.Addresses })));
const Profile     = lazy(() => import('./pages/user/Profile').then(m => ({ default: m.Profile })));
const Sessions    = lazy(() => import('./pages/user/Sessions'));
const Wishlist    = lazy(() => import('./pages/user/Wishlist').then(m => ({ default: m.Wishlist })));  // ← NEW

const AdminDashboard  = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminProducts   = lazy(() => import('./pages/admin/AdminProducts').then(m => ({ default: m.AdminProducts })));
const AddProduct      = lazy(() => import('./pages/admin/AddProduct').then(m => ({ default: m.AddProduct })));
const EditProduct     = lazy(() => import('./pages/admin/EditProduct').then(m => ({ default: m.EditProduct })));
const AdminOrders     = lazy(() => import('./pages/admin/AdminOrders').then(m => ({ default: m.AdminOrders })));
const AdminOrderDetail= lazy(() => import('./pages/admin/AdminOrderDetail').then(m => ({ default: m.AdminOrderDetail })));
const AdminSettings   = lazy(() => import('./pages/admin/AdminSettings').then(m => ({ default: m.AdminSettings })));
const AdminReviews    = lazy(() => import('./pages/admin/AdminReviews').then(m => ({ default: m.AdminReviews })));
const AdminSessions   = lazy(() => import('./pages/admin/AdminSessions'));
const AdminUsers      = lazy(() => import('./pages/admin/AdminUsers').then(m => ({ default: m.AdminUsers })));
const AdminUserDetail = lazy(() => import('./pages/admin/AdminUserDetail').then(m => ({ default: m.AdminUserDetail })));
const AdminEmailLog   = lazy(() => import('./pages/admin/AdminEmailLog').then(m => ({ default: m.AdminEmailLog })));

const ToastContainer  = lazy(() => import('./components/ui/Toast').then(m => ({ default: m.ToastContainer })));

// ─── Loading fallback ─────────────────────────────────────────────────────────

function PageLoader() {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      fontFamily: 'sans-serif',
    }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        {[0, 1, 2].map(i => (
          <span
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#6366f1',
              display: 'inline-block',
              animation: 'kore-bounce 1s ease-in-out infinite',
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
      <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>Loading page…</p>
      <style>{`
        @keyframes kore-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
      `}</style>
    </div>
  );
}

interface EBState { hasError: boolean; message: string }

class PageErrorBoundary extends React.Component<
  { children: React.ReactNode },
  EBState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(err: Error): EBState {
    return { hasError: true, message: err?.message ?? 'Unknown error' };
  }
  componentDidCatch(err: Error, info: React.ErrorInfo) {
    console.error('[PageErrorBoundary]', err, info);
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'sans-serif',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16, lineHeight: 1 }}>📡</div>
        <h2 style={{ fontWeight: 600, fontSize: 18, color: '#111827', margin: '0 0 8px' }}>
          Something went wrong
        </h2>
        <p style={{ color: '#6b7280', fontSize: 14, maxWidth: 320, margin: '0 0 24px', lineHeight: 1.6 }}>
          This page could not load right now.
        </p>
        <button
          onClick={() => { this.setState({ hasError: false, message: '' }); window.location.reload(); }}
          style={{
            padding: '8px 20px', borderRadius: 8, border: '1px solid #d1d5db',
            background: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer', fontWeight: 500,
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <PageErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </PageErrorBoundary>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function runIdle(cb: () => void) {
  const ric = (window as Window & { requestIdleCallback?: (fn: () => void) => number }).requestIdleCallback;
  if (ric) {
    ric(cb);
  } else {
    setTimeout(cb, 1200);
  }
}

// ─── App ─────────────────────────────────────────────────────────────────────

export function App() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const hydrateCart = useCartStore((s) => s.hydrateFromServer);
  const clearLocalCart = useCartStore((s) => s.clearLocal);
  const [toastReady, setToastReady] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'user') {
      hydrateCart();
    } else {
      clearLocalCart();
    }
  }, [isAuthenticated, user?.role, hydrateCart, clearLocalCart]);

  useEffect(() => {
    const prefetchRoutes = () => {
      // Prefetch likely next routes in the background after first paint.
      void import('./pages/ProductListing');
      void import('./pages/ProductDetail');
      void import('./pages/Cart');
      void import('./pages/Checkout');
      void import('./pages/OrderSuccess');
      void import('./pages/auth/Login');
      void import('./pages/auth/Register');
      void import('./pages/auth/ForgotPassword');
      void import('./pages/SharedWishlist');
      void import('./pages/user/UserLayout');
      void import('./pages/user/Orders');
      void import('./pages/user/OrderDetail');
      void import('./pages/user/Addresses');
      void import('./pages/user/Profile');
      void import('./pages/user/Sessions');
      void import('./pages/user/Wishlist');
    };

    runIdle(prefetchRoutes);
  }, []);

  useEffect(() => {
    runIdle(() => setToastReady(true));
  }, []);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* ── Public / customer routes ── */}
        <Route element={<MainLayout />}>
          <Route path="/"                      element={<Page><Home /></Page>} />
          <Route path="/products"              element={<Page><ProductListing /></Page>} />
          <Route path="/products/:slug"        element={<Page><ProductDetail /></Page>} />
          <Route path="/cart"                  element={<Page><Cart /></Page>} />
          <Route path="/checkout"              element={<Page><Checkout /></Page>} />
          <Route path="/order-success/:id"     element={<Page><OrderSuccess /></Page>} />
          <Route path="/login"                 element={<Page><Login /></Page>} />
          <Route path="/register"              element={<Page><Register /></Page>} />
          <Route path="/forgot-password"       element={<Page><ForgotPassword /></Page>} />
          <Route path="/admin/login"           element={<Page><AdminLogin /></Page>} />
          <Route path="/admin/forgot-password" element={<Page><AdminForgotPassword /></Page>} />

          {/* ── Public shared wishlist (no auth needed) ── */}
          <Route path="/wishlist/:shareToken"  element={<Page><SharedWishlist /></Page>} />  {/* ← NEW */}

          {/* ── User account (protected) ── */}
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <Page><UserLayout /></Page>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/account/orders" replace />} />
            <Route path="orders"        element={<Page><Orders /></Page>} />
            <Route path="orders/:id"    element={<Page><OrderDetail /></Page>} />
            <Route path="addresses"     element={<Page><Addresses /></Page>} />
            <Route path="profile"       element={<Page><Profile /></Page>} />
            <Route path="sessions"      element={<Page><Sessions /></Page>} />
            <Route path="wishlist"      element={<Page><Wishlist /></Page>} />  {/* ← NEW */}
          </Route>
        </Route>

        {/* ── Admin panel ── */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index                         element={<Page><AdminDashboard /></Page>} />
          <Route path="products"               element={<Page><AdminProducts /></Page>} />
          <Route path="products/add"           element={<Page><AddProduct /></Page>} />
          <Route path="products/:id/edit"      element={<Page><EditProduct /></Page>} />
          <Route path="orders"                 element={<Page><AdminOrders /></Page>} />
          <Route path="orders/:id"             element={<Page><AdminOrderDetail /></Page>} />
          <Route path="reviews"                element={<Page><AdminReviews /></Page>} />
          <Route path="settings"               element={<Page><AdminSettings /></Page>} />
          <Route path="sessions"               element={<Page><AdminSessions /></Page>} />
          <Route path="users"                  element={<Page><AdminUsers /></Page>} />
          <Route path="users/:id"              element={<Page><AdminUserDetail /></Page>} />
          <Route path="email-log"              element={<Page><AdminEmailLog /></Page>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {toastReady && (
        <Suspense fallback={null}>
          <ToastContainer />
        </Suspense>
      )}
    </BrowserRouter>
  );
}