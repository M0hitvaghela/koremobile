import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  SearchIcon,
  HeartIcon,
  ShoppingCartIcon,
  UserIcon,
  ChevronDownIcon,
  LogOutIcon,
  PackageIcon,
  MapPinIcon,
  LayoutDashboardIcon,
  PhoneIcon,
  ReceiptIcon,
  TruckIcon,
  BanknoteIcon,
  MenuIcon,
  XIcon,
  HomeIcon,
} from 'lucide-react';
import { Logo } from '../ui/Logo';
import { useCartStore } from '../../store/cartStore';
import { useWishlistStore } from '../../store/wishlistStore';
import { useAuth } from '../../hooks/useAuth';
import { useSettingsStore } from '../../store/settingsStore';
import { formatINR } from '../../utils/formatPrice';
import { searchApi, SearchSuggestions } from '../../utils/searchApi';

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestions>({ history: [], products: [] });
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const cartCount = useCartStore((s) => s.totalItems());
const wishlistCount = useWishlistStore((s) =>
  s.serverWishlist ? s.serverWishlist.item_count : s.guestItems.length
);
  const { user, isAuthenticated, logout } = useAuth();
  const freeShippingThreshold = useSettingsStore((s) => s.freeShippingThreshold);
  const flatShippingFee = useSettingsStore((s) => s.flatShippingFee);
  const enableFreeShipping = useSettingsStore((s) => s.enableFreeShipping);
  const defaultCodEnabled = useSettingsStore((s) => s.defaultCodEnabled);
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const shippingLabel = enableFreeShipping
    ? `Free Delivery above ${formatINR(freeShippingThreshold)}`
    : `Delivery ${formatINR(flatShippingFee)}`;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (
        searchRef.current && !searchRef.current.contains(e.target as Node) &&
        mobileSearchRef.current && !mobileSearchRef.current.contains(e.target as Node)
      ) {
        setSuggestOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (!suggestOpen && !search.trim()) return;
    const q = search.trim();
    const timer = setTimeout(() => {
      setSuggestLoading(true);
      setSuggestError(false);
      searchApi
        .suggestions(q)
        .then((data) => setSuggestions(data))
        .catch(() => setSuggestError(true))
        .finally(() => setSuggestLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [search, suggestOpen]);

  const handleSearch = () => {
    const q = search.trim();
    if (!q) return;
    searchApi.log(q).catch(() => undefined);
    setSuggestOpen(false);
    navigate(`/products?q=${encodeURIComponent(q)}`);
  };

  const handleHistoryClick = (q: string) => {
    setSearch(q);
    searchApi.log(q).catch(() => undefined);
    setSuggestOpen(false);
    navigate(`/products?q=${encodeURIComponent(q)}`);
  };

  const SuggestDropdown = () => (
    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-cardHover overflow-hidden">
      {suggestLoading && (
        <div className="px-4 py-3 text-xs text-muted">Loading suggestions…</div>
      )}
      {!suggestLoading && suggestError && (
        <div className="px-4 py-3 text-xs text-red-500">Failed to load suggestions</div>
      )}
      {!suggestLoading && !suggestError && (
        <>
          {suggestions.history.length > 0 && (
            <div className="py-2">
              <div className="px-4 pb-1 text-[11px] font-semibold text-muted uppercase tracking-wide">Recent Searches</div>
              {suggestions.history.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => handleHistoryClick(h)}
                  className="w-full text-left px-4 py-2 text-sm text-ink hover:bg-bg"
                >
                  {h}
                </button>
              ))}
            </div>
          )}
          {suggestions.products.length > 0 && (
            <div className={`py-2 ${suggestions.history.length > 0 ? 'border-t border-gray-100' : ''}`}>
              <div className="px-4 pb-1 text-[11px] font-semibold text-muted uppercase tracking-wide">Products</div>
              {suggestions.products.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => {
                    setSuggestOpen(false);
                    navigate(`/products/${p.slug}`);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-bg"
                >
                  <div className="w-9 h-9 bg-gray-100 rounded-md overflow-hidden shrink-0">
                    {p.image && (
                      <img src={p.image} alt={p.name} className="w-full h-full object-contain p-1" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm text-ink line-clamp-1">{p.name}</p>
                    <p className="text-xs text-muted">{p.brand}</p>
                  </div>
                  <span className="text-xs font-semibold text-ink">{formatINR(p.min_price)}</span>
                </button>
              ))}
            </div>
          )}
          {suggestions.history.length === 0 && suggestions.products.length === 0 && (
            <div className="px-4 py-3 text-xs text-muted">No suggestions yet.</div>
          )}
        </>
      )}
    </div>
  );

  return (
    <>
      {/* Topbar */}
      <div className="bg-primary text-white text-xs h-8 flex items-center w-full">
        <div className="max-w-7xl mx-auto px-4 w-full flex items-center justify-between">
          <div className="hidden md:flex items-center gap-6">
            <span className="flex items-center gap-1.5">
              <TruckIcon size={13} /> {shippingLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <BanknoteIcon size={13} /> {defaultCodEnabled ? 'Cash on Delivery' : 'Online Payments'}
            </span>
            <span className="flex items-center gap-1.5">
              <ReceiptIcon size={13} /> GST Invoice Provided
            </span>
          </div>
          {/* Mobile topbar: shipping only, compact */}
          <div className="md:hidden flex items-center gap-1 text-[11px] truncate">
            <TruckIcon size={11} className="shrink-0" />
            <span className="truncate">{shippingLabel}</span>
          </div>
          <a href="tel:+919876543210" className="flex items-center gap-1 hover:underline text-[11px] md:text-xs">
            <PhoneIcon size={12} /> <span className="hidden sm:inline">+91 98765 43210</span>
            <span className="sm:hidden">Call Us</span>
          </a>
        </div>
      </div>

      {/* Main header */}
      <header className="bg-white shadow-sm sticky top-0 z-40 w-full">
        {/* Row 1: Logo + Actions */}
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <div className="h-[56px] md:h-[70px] flex items-center gap-2 sm:gap-3">
            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded-lg hover:bg-bg -ml-1"
              aria-label="Open menu"
            >
              <MenuIcon size={22} className="text-ink" />
            </button>

            {/* Logo */}
            <Link to="/" className="shrink-0">
              <Logo size="md" />
            </Link>

            {/* Desktop search */}
            <div className="flex-1 max-w-2xl mx-auto hidden md:flex">
              <div ref={searchRef} className="relative w-full">
                <div className="flex w-full bg-bg rounded-lg overflow-hidden border border-transparent focus-within:border-primary transition-colors">
                  <div className="pl-3.5 flex items-center text-muted">
                    <SearchIcon size={18} />
                  </div>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={() => setSuggestOpen(true)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search mobiles, laptops, TVs..."
                    className="flex-1 bg-transparent px-3 py-2.5 outline-none text-sm placeholder-muted"
                  />
                  <button
                    onClick={handleSearch}
                    className="bg-primary text-white px-5 text-sm font-semibold hover:bg-primary-600 transition-colors"
                  >
                    Search
                  </button>
                </div>
                {suggestOpen && <SuggestDropdown />}
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1 sm:gap-2 ml-auto">
              {/* Auth — desktop */}
              {!isAuthenticated ? (
                <Link
                  to="/login"
                  className="hidden sm:inline-flex bg-primary text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-primary-600 transition-colors"
                >
                  Login
                </Link>
              ) : (
                <div className="relative hidden sm:block" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary-50 text-primary font-bold text-sm flex items-center justify-center">
                      {user?.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden sm:inline text-sm font-medium text-ink max-w-[80px] truncate">
                      {user?.name.split(' ')[0]}
                    </span>
                    <ChevronDownIcon size={14} className="text-muted hidden sm:inline" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-cardHover border border-gray-100 py-2 z-50">
                      <div className="px-4 py-2 border-b border-gray-100 mb-1">
                        <div className="text-sm font-semibold text-ink">{user?.name}</div>
                        <div className="text-xs text-muted truncate">{user?.email}</div>
                      </div>
                      {user?.role === 'admin' && (
                        <Link to="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2 text-sm text-ink hover:bg-bg">
                          <LayoutDashboardIcon size={16} /> Admin Panel
                        </Link>
                      )}
                      <Link to="/account/orders" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2 text-sm text-ink hover:bg-bg">
                        <PackageIcon size={16} /> My Orders
                      </Link>
                      <Link to="/account/addresses" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2 text-sm text-ink hover:bg-bg">
                        <MapPinIcon size={16} /> My Addresses
                      </Link>
                      <Link to="/account/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2 text-sm text-ink hover:bg-bg">
                        <UserIcon size={16} /> My Profile
                      </Link>
                      <button
                        onClick={() => { logout(); setMenuOpen(false); navigate('/'); }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 border-t border-gray-100 mt-1 pt-2"
                      >
                        <LogOutIcon size={16} /> Logout
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Wishlist — hidden on mobile (in bottom nav) */}
              <Link to="/account/wishlist" className="relative p-2 hover:bg-bg rounded-lg hidden sm:block">
                <HeartIcon size={22} className="text-ink" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-discount text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              {/* Cart */}
              <Link
                to="/cart"
                className="relative flex items-center gap-1.5 p-2 hover:bg-bg rounded-lg"
              >
                <ShoppingCartIcon size={22} className="text-ink" />
                <span className="hidden sm:inline text-sm font-semibold text-ink">Cart</span>
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-cta text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile search bar — row 2, only on mobile */}
        <div className="md:hidden px-3 pb-2.5">
          <div ref={mobileSearchRef} className="relative w-full">
            <div className="flex w-full bg-bg rounded-lg overflow-hidden border border-transparent focus-within:border-primary transition-colors">
              <div className="pl-3 flex items-center text-muted">
                <SearchIcon size={16} />
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSuggestOpen(true)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search mobiles, laptops, TVs..."
                className="flex-1 bg-transparent px-2.5 py-2 outline-none text-sm placeholder-muted"
              />
              <button
                onClick={handleSearch}
                className="bg-primary text-white px-4 text-sm font-semibold hover:bg-primary-600 transition-colors"
              >
                Search
              </button>
            </div>
            {suggestOpen && <SuggestDropdown />}
          </div>
        </div>
      </header>

      {/* Mobile drawer menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu overlay"
          />
          <div className="absolute left-0 top-0 h-full w-[80vw] max-w-[300px] bg-white shadow-2xl flex flex-col">
            {/* Drawer header */}
            <div className="h-[56px] px-4 flex items-center justify-between border-b border-gray-100 bg-primary">
              <Logo size="sm" variant="light" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/20"
                aria-label="Close menu"
              >
                <XIcon size={20} className="text-white" />
              </button>
            </div>

            {/* User section */}
            <div className="px-4 py-4 bg-primary-50 border-b border-gray-100">
              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-white font-bold text-base flex items-center justify-center shrink-0">
                    {user?.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink truncate">{user?.name}</div>
                    <div className="text-xs text-muted truncate">{user?.email}</div>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 text-center bg-primary text-white py-2 rounded-lg text-sm font-semibold"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 text-center border border-primary text-primary py-2 rounded-lg text-sm font-semibold"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              <nav className="py-2">
                {[
                  { to: '/', label: 'Home' },
                  { to: '/products', label: 'All Products' },
                  { to: '/products?category=Mobiles', label: 'Mobiles' },
                  { to: '/products?category=Laptops', label: 'Laptops' },
                  { to: '/products?category=TVs', label: 'Smart TVs' },
                  { to: '/products?category=Tablets', label: 'Tablets' },
                  { to: '/products?category=Accessories', label: 'Accessories' },
                ].map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center px-4 py-3 text-sm font-medium text-ink hover:bg-bg border-b border-gray-50"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              {isAuthenticated && (
                <div className="py-2 border-t border-gray-100">
                  {user?.role === 'admin' && (
                    <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-ink hover:bg-bg">
                      <LayoutDashboardIcon size={16} className="text-primary" /> Admin Dashboard
                    </Link>
                  )}
                  <Link to="/account/orders" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-ink hover:bg-bg">
                    <PackageIcon size={16} className="text-primary" /> My Orders
                  </Link>
                  <Link to="/account/addresses" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-ink hover:bg-bg">
                    <MapPinIcon size={16} className="text-primary" /> My Addresses
                  </Link>
                  <Link to="/account/profile" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-ink hover:bg-bg">
                    <UserIcon size={16} className="text-primary" /> My Profile
                  </Link>
                  <button
                    onClick={() => { logout(); setMobileMenuOpen(false); navigate('/'); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 border-t border-gray-100"
                  >
                    <LogOutIcon size={16} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom navigation bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
        <div className="grid grid-cols-4 h-14">
          <Link
            to="/"
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${location.pathname === '/' ? 'text-primary' : 'text-muted'}`}
          >
            <HomeIcon size={20} />
            Home
          </Link>
          <Link
            to="/products"
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${location.pathname === '/products' ? 'text-primary' : 'text-muted'}`}
          >
            <SearchIcon size={20} />
            Explore
          </Link>
          <Link
            to="/cart"
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors relative ${location.pathname === '/cart' ? 'text-primary' : 'text-muted'}`}
          >
            <div className="relative">
              <ShoppingCartIcon size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1.5 bg-cta text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5">
                  {cartCount}
                </span>
              )}
            </div>
            Cart
          </Link>
          <Link
            to={isAuthenticated ? '/account/profile' : '/login'}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${location.pathname.startsWith('/account') || location.pathname === '/login' ? 'text-primary' : 'text-muted'}`}
          >
            <UserIcon size={20} />
            Account
          </Link>
        </div>
      </div>
    </>
  );
}