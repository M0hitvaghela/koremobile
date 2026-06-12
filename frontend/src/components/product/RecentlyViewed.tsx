import React, { useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, HistoryIcon } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { useRecentlyViewedStore } from '../../store/recentlyViewedStore';

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

interface RecentlyViewedProps {
  /** Exclude a product by id — used on ProductDetail to hide the current product */
  excludeId?: string;
}

export function RecentlyViewed({ excludeId }: RecentlyViewedProps) {
  const { items, clear } = useRecentlyViewedStore();

  const visible = excludeId ? items.filter((p) => p.id !== excludeId) : items;

  if (visible.length === 0) return null;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 md:py-8">
      {/* Header */}
      <div className="flex items-end justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-2">
          <HistoryIcon size={18} className="text-primary" />
          <div>
            <h2 className="font-heading font-bold text-lg md:text-2xl text-ink">Recently Viewed</h2>
            <p className="text-xs md:text-sm text-muted mt-0.5">Pick up where you left off</p>
          </div>
        </div>
        <button
          onClick={clear}
          className="text-xs text-muted hover:text-ink underline underline-offset-2 transition-colors shrink-0 ml-2"
        >
          Clear
        </button>
      </div>

      {/* Strip */}
      <HorizontalScroller ariaLabel="Recently viewed products">
        {visible.map((p) => (
          <div key={p.id} className="w-[160px] sm:w-[200px] md:w-[240px] shrink-0">
            <ProductCard product={p} />
          </div>
        ))}
      </HorizontalScroller>
    </div>
  );
}