import React, { useEffect, useState, useRef, Fragment, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import {
  SmartphoneIcon, LaptopIcon, TvIcon, TabletIcon, HeadphonesIcon,
  LayoutGridIcon, ChevronLeftIcon, ChevronRightIcon, FlameIcon,
} from 'lucide-react';
import { TrustBadges } from '../components/layout/TrustBadges';
import { ProductCardSkeleton, ProductCardSkeletonGrid } from '../components/ui/Skeleton';
import { useProductsStore } from '../store/productsStore';

const HeroBanner = lazy(() => import('../components/layout/HeroBanner').then(m => ({ default: m.HeroBanner })));
const ProductCard = lazy(() => import('../components/product/ProductCard').then(m => ({ default: m.ProductCard })));
const RecentlyViewed = lazy(() => import('../components/product/RecentlyViewed').then(m => ({ default: m.RecentlyViewed })));

const categories = [
  { label: 'Mobiles',      icon: SmartphoneIcon, bg: 'bg-primary-50',    color: '#2874F0', to: '/products?category=Mobiles' },
  { label: 'Laptops',      icon: LaptopIcon,      bg: 'bg-[#F0EBFF]',    color: '#7C3AED', to: '/products?category=Laptops' },
  { label: 'Smart TVs',    icon: TvIcon,          bg: 'bg-success-light', color: '#388E3C', to: '/products?category=TVs' },
  { label: 'Tablets',      icon: TabletIcon,      bg: 'bg-orange-50',    color: '#FB641B', to: '/products?category=Tablets' },
  { label: 'Accessories',  icon: HeadphonesIcon,  bg: 'bg-red-50',       color: '#E53E3E', to: '/products?category=Accessories' },
  { label: 'All Products', icon: LayoutGridIcon,  bg: 'bg-gray-100',     color: '#878787', to: '/products' },
];

const brands = ['Samsung', 'Apple', 'OnePlus', 'Realme', 'Mi', 'boAt', 'HP', 'Dell', 'Lenovo'];

function SectionHeader({ title, subtitle, linkTo }: { title: string; subtitle?: string; linkTo?: string }) {
  return (
    <div className="flex items-end justify-between mb-4 md:mb-6">
      <div>
        <h2 className="font-heading font-bold text-lg md:text-2xl text-ink">{title}</h2>
        {subtitle && <p className="text-xs md:text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {linkTo && (
        <Link to={linkTo} className="text-xs md:text-sm font-semibold text-primary hover:underline shrink-0 ml-2">
          View All →
        </Link>
      )}
    </div>
  );
}

function HorizontalScroller({ children, ariaLabel }: { children: React.ReactNode; ariaLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * 260, behavior: 'smooth' });
  return (
    <div className="relative" aria-label={ariaLabel}>
      <button
        onClick={() => scroll(-1)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 -translate-x-3 w-9 h-9 rounded-full bg-white shadow-cardHover items-center justify-center hover:scale-110 transition-transform hidden md:flex"
        aria-label="Scroll left"
      >
        <ChevronLeftIcon size={18} />
      </button>
      <div ref={ref} className="flex gap-3 md:gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-2">
        {children}
      </div>
      <button
        onClick={() => scroll(1)}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 translate-x-3 w-9 h-9 rounded-full bg-white shadow-cardHover items-center justify-center hover:scale-110 transition-transform hidden md:flex"
        aria-label="Scroll right"
      >
        <ChevronRightIcon size={18} />
      </button>
    </div>
  );
}

function DealCountdown() {
  const [time, setTime] = useState({ h: '00', m: '00', s: '00' });
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const diff = end.getTime() - now.getTime();
      setTime({
        h: String(Math.floor(diff / 3600000)).padStart(2, '0'),
        m: String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0'),
        s: String(Math.floor((diff % 60000) / 1000)).padStart(2, '0'),
      });
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-1.5 md:gap-2">
      {(['h', 'm', 's'] as const).map((unit, i) => (
        <Fragment key={unit}>
          <div className="bg-ink text-white rounded-lg px-2 py-1.5 md:px-3 md:py-2 min-w-[40px] md:min-w-[52px] text-center">
            <div className="font-bold text-base md:text-xl font-heading tabular-nums">{time[unit]}</div>
            <div className="text-[8px] md:text-[9px] text-gray-400 uppercase tracking-widest">
              {unit === 'h' ? 'Hr' : unit === 'm' ? 'Min' : 'Sec'}
            </div>
          </div>
          {i < 2 && <span className="text-ink font-bold text-sm">:</span>}
        </Fragment>
      ))}
    </div>
  );
}

function HeroBannerSkeleton() {
  return (
    <div className="w-full rounded-xl md:rounded-2xl bg-gray-100 animate-pulse">
      <div className="h-[200px] sm:h-[260px] md:h-[440px]" />
    </div>
  );
}

function ProductStripSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-3 md:gap-4 overflow-x-auto no-scrollbar pb-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[160px] sm:w-[200px] md:w-[240px] shrink-0">
          <ProductCardSkeleton />
        </div>
      ))}
    </div>
  );
}

function runIdle(cb: () => void) {
  const ric = (window as Window & { requestIdleCallback?: (fn: () => void) => number }).requestIdleCallback;
  if (ric) {
    ric(cb);
  } else {
    setTimeout(cb, 1200);
  }
}

export function Home() {
  const { products, loading, fetchFeatured } = useProductsStore();

  useEffect(() => {
    runIdle(() => fetchFeatured());
  }, [fetchFeatured]);

  const dealProducts = products.filter((p) => {
    const cheapest = [...p.variants].sort((a, b) => a.price - b.price)[0];
    if (!cheapest) return false;
    return (cheapest.mrp - cheapest.price) / (cheapest.mrp || 1) > 0.15;
  }).slice(0, 6);

  return (
    <div className="w-full">
      <TrustBadges />

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 md:py-6">
        <Suspense fallback={<HeroBannerSkeleton />}>
          <HeroBanner />
        </Suspense>
      </div>

      {/* Categories */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 md:py-8">
        <SectionHeader title="Shop by Category" subtitle="Find your perfect product" />
        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-4">
          {categories.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.label}
                className="transition-transform duration-200 hover:-translate-y-1"
              >
                <Link
                  to={c.to}
                  className="bg-white rounded-xl shadow-card hover:shadow-cardHover hover:-translate-y-1 transition-all p-2.5 md:p-5 flex flex-col items-center text-center group/cat"
                >
                  <div className={`w-10 h-10 md:w-16 md:h-16 rounded-full ${c.bg} flex items-center justify-center mb-1.5 md:mb-3 group-hover/cat:scale-110 transition-transform`}>
                    <Icon size={18} color={c.color} className="md:hidden" />
                    <Icon size={24} color={c.color} className="hidden md:block" />
                  </div>
                  <span className="font-semibold text-[11px] md:text-sm text-ink leading-tight">{c.label}</span>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* Featured */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 md:py-8">
        <SectionHeader title="Featured Products" subtitle="Handpicked for you" linkTo="/products" />
        {loading ? (
          <ProductCardSkeletonGrid count={6} />
        ) : products.length === 0 ? (
          <p className="text-muted text-sm text-center py-8">No products available yet.</p>
        ) : (
          <Suspense fallback={<ProductStripSkeleton count={6} />}>
            <HorizontalScroller ariaLabel="Featured products">
              {products.map((p) => (
                <div key={p.id} className="w-[160px] sm:w-[200px] md:w-[240px] shrink-0">
                  <ProductCard product={p} />
                </div>
              ))}
            </HorizontalScroller>
          </Suspense>
        )}
      </div>

      {/* Deal of the Day */}
      {dealProducts.length > 0 && (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 md:py-8">
          <div className="bg-white rounded-2xl shadow-card border-l-4 border-cta overflow-hidden">
            <div className="p-3 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 md:w-12 md:h-12 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                  <FlameIcon size={20} className="text-cta md:hidden" />
                  <FlameIcon size={24} className="text-cta hidden md:block" />
                </div>
                <div>
                  <h2 className="font-heading font-bold text-lg md:text-2xl text-ink">Deal of the Day</h2>
                  <p className="text-xs text-muted">Ends in:</p>
                </div>
              </div>
              <DealCountdown />
            </div>
            <div className="p-3 md:p-6">
              <Suspense fallback={<ProductStripSkeleton count={dealProducts.length} />}>
                <HorizontalScroller ariaLabel="Deals">
                  {dealProducts.map((p) => (
                    <div key={p.id} className="w-[160px] sm:w-[200px] md:w-[240px] shrink-0 relative">
                      <span className="absolute top-2 left-2 z-10 bg-cta text-white text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded shadow-md flex items-center gap-1">
                        <FlameIcon size={9} /> DEAL
                      </span>
                      <ProductCard product={p} />
                    </div>
                  ))}
                </HorizontalScroller>
              </Suspense>
            </div>
          </div>
        </div>
      )}

      {/* Recently Viewed */}
      <Suspense fallback={null}>
        <RecentlyViewed />
      </Suspense>

      {/* Brands */}
      <div className="bg-bg py-6 md:py-10 w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <h2 className="font-heading font-bold text-lg md:text-2xl text-ink text-center mb-4 md:mb-6">Top Brands</h2>
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
            {brands.map((b) => (
              <Link
                key={b}
                to={`/products?brand=${b}`}
                className="px-3 md:px-6 py-1.5 md:py-2 bg-white border border-gray-200 hover:border-primary hover:text-primary rounded-full text-xs md:text-sm font-semibold text-ink transition-colors"
              >
                {b}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}