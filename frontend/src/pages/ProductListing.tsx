import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilterIcon, XIcon, SlidersHorizontalIcon } from 'lucide-react';
import { ProductCard } from '../components/product/ProductCard';
import { ProductCardSkeletonGrid } from '../components/ui/Skeleton';
import { useProductsStore } from '../store/productsStore';
import { formatINR } from '../utils/formatPrice';
import { productsApi } from '../utils/productsApi';
import { Product } from '../types/product';

const CATEGORIES = ['Mobiles', 'Laptops', 'TVs', 'Tablets', 'Accessories'];
const BRANDS = ['Samsung', 'Apple', 'OnePlus', 'Realme', 'Mi', 'boAt', 'HP', 'Dell', 'Lenovo'];

const SEARCH_CATEGORY_ALIASES: Record<string, Product['category']> = {
  phone: 'Mobiles', phones: 'Mobiles', mobile: 'Mobiles', mobiles: 'Mobiles',
  smartphone: 'Mobiles', smartphones: 'Mobiles',
  tv: 'TVs', tvs: 'TVs', television: 'TVs', televisions: 'TVs', smarttv: 'TVs',
  laptop: 'Laptops', laptops: 'Laptops', notebook: 'Laptops', notebooks: 'Laptops',
  tablet: 'Tablets', tablets: 'Tablets',
  accessory: 'Accessories', accessories: 'Accessories',
  earphone: 'Accessories', earphones: 'Accessories',
  headphone: 'Accessories', headphones: 'Accessories',
  charger: 'Accessories', cable: 'Accessories', case: 'Accessories',
};

function categoryFromQuery(query: string): Product['category'] | undefined {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (SEARCH_CATEGORY_ALIASES[token]) return SEARCH_CATEGORY_ALIASES[token];
  }
  return undefined;
}

export function ProductListing() {
  const [params, setParams] = useSearchParams();
  const { products, loading, total, pages, fetchProducts } = useProductsStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [recoProducts, setRecoProducts] = useState<Product[]>([]);
  const [recoLoading, setRecoLoading] = useState(false);

  const categoryParam = params.get('category') ?? '';
  const queryParam = params.get('q') ?? '';
  const pageParam = Number(params.get('page') ?? 1);

  const [filters, setFilters] = useState({
    categories: categoryParam ? [categoryParam] : [] as string[],
    brands: [] as string[],
    priceMin: 0,
    priceMax: 100000,
    inStockOnly: false,
    sort: 'popular' as 'popular' | 'newest' | 'price_asc' | 'price_desc',
  });

  useEffect(() => {
    setFilters((f) => ({ ...f, categories: categoryParam ? [categoryParam] : [] }));
  }, [categoryParam]);

  useEffect(() => {
    fetchProducts({
      page: pageParam,
      limit: 20,
      category: filters.categories[0] ?? undefined,
      brand: filters.brands[0] ?? undefined,
      search: queryParam || undefined,
      sort: filters.sort,
      min_price: filters.priceMin > 0 ? filters.priceMin : undefined,
      max_price: filters.priceMax < 100000 ? filters.priceMax : undefined,
      in_stock: filters.inStockOnly || undefined,
    });
  }, [filters, queryParam, pageParam]);

  useEffect(() => {
    if (!queryParam) { setRecoProducts([]); return; }
    const category = categoryFromQuery(queryParam);
    setRecoLoading(true);
    productsApi
      .list({ page: 1, limit: 8, sort: 'popular', category })
      .then((res) => setRecoProducts(res.products))
      .finally(() => setRecoLoading(false));
  }, [queryParam]);

  const clearAll = () => {
    setFilters({ categories: [], brands: [], priceMin: 0, priceMax: 100000, inStockOnly: false, sort: 'popular' });
    setParams({});
  };

  const toggle = (key: 'categories' | 'brands', val: string) => {
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val],
    }));
  };

  const activeFilterCount =
    filters.categories.length + filters.brands.length +
    (filters.inStockOnly ? 1 : 0) +
    (filters.priceMax < 100000 ? 1 : 0);

  const FiltersPanel = (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-bold text-base text-ink">Filters</h3>
        <button onClick={clearAll} className="text-xs font-semibold text-primary hover:underline">
          Clear All
        </button>
      </div>
      <FilterBlock title="Category">
        {CATEGORIES.map((c) => (
          <Checkbox key={c} label={c} checked={filters.categories.includes(c)} onChange={() => toggle('categories', c)} />
        ))}
      </FilterBlock>
      <FilterBlock title="Brand">
        {BRANDS.map((b) => (
          <Checkbox key={b} label={b} checked={filters.brands.includes(b)} onChange={() => toggle('brands', b)} />
        ))}
      </FilterBlock>
      <FilterBlock title="Price Range">
        <div className="px-1">
          <div className="flex items-center justify-between text-xs text-ink mb-2">
            <span className="font-semibold">{formatINR(filters.priceMin)}</span>
            <span className="font-semibold">{formatINR(filters.priceMax)}</span>
          </div>
          <input
            type="range" min={0} max={100000} step={1000}
            value={filters.priceMax}
            onChange={(e) => setFilters((f) => ({ ...f, priceMax: Number(e.target.value) }))}
            className="w-full accent-primary"
          />
        </div>
      </FilterBlock>
      <FilterBlock title="Other">
        <Checkbox
          label="In Stock Only"
          checked={filters.inStockOnly}
          onChange={() => setFilters((f) => ({ ...f, inStockOnly: !f.inStockOnly }))}
        />
      </FilterBlock>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 md:py-6 w-full">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="min-w-0">
          <h1 className="font-heading font-bold text-base md:text-xl text-ink truncate">
            {filters.categories[0] ?? (queryParam ? `"${queryParam}"` : 'All Products')}
          </h1>
          {!loading && (
            <p className="text-xs text-muted mt-0.5">{total} products</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Sort — icon only on mobile, full on desktop */}
          <select
            value={filters.sort}
            onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as typeof filters.sort }))}
            className="text-xs md:text-sm border border-gray-200 rounded-lg px-2 md:px-3 py-2 text-ink outline-none focus:border-primary max-w-[130px] md:max-w-none"
          >
            <option value="popular">Popularity</option>
            <option value="newest">Newest</option>
            <option value="price_asc">Low to High</option>
            <option value="price_desc">High to Low</option>
          </select>
          {/* Filter button — mobile only */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden flex items-center gap-1.5 text-xs font-semibold text-ink border border-gray-200 rounded-lg px-2.5 py-2 relative"
          >
            <SlidersHorizontalIcon size={14} />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex gap-5 md:gap-6">
        {/* Sidebar — desktop */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="bg-white rounded-xl shadow-card p-4 sticky top-20">
            {FiltersPanel}
          </div>
        </aside>

        {/* Mobile filter drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
            <div className="absolute right-0 top-0 bottom-0 w-[75vw] max-w-[300px] bg-white shadow-2xl flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <span className="font-bold text-ink">Filters</span>
                <button onClick={() => setDrawerOpen(false)} className="p-1">
                  <XIcon size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {FiltersPanel}
              </div>
              <div className="p-4 border-t border-gray-100">
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold text-sm"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Products grid */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <ProductCardSkeletonGrid count={12} />
          ) : products.length === 0 ? (
            <>
              <div className="text-center py-16">
                <p className="text-muted text-base font-semibold">No products found</p>
                <button onClick={clearAll} className="mt-3 text-primary text-sm font-semibold hover:underline">
                  Clear filters
                </button>
              </div>
              {queryParam && (
                <div className="mt-4">
                  <h2 className="font-heading font-bold text-sm md:text-base text-ink mb-3">Recommended for you</h2>
                  {recoLoading ? (
                    <ProductCardSkeletonGrid count={8} />
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 md:gap-4">
                      {recoProducts.map((p) => <ProductCard key={`reco-${p.slug}`} product={p} />)}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 md:gap-4">
                {products.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>

              {queryParam && recoProducts.length > 0 && (
                <div className="mt-6 md:mt-8">
                  <h2 className="font-heading font-bold text-sm md:text-base text-ink mb-3">Recommended for you</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 md:gap-4">
                    {recoProducts.map((p) => <ProductCard key={`reco-${p.slug}`} product={p} />)}
                  </div>
                </div>
              )}

              {/* Pagination */}
              {pages > 1 && (
                <div className="flex justify-center flex-wrap gap-1.5 md:gap-2 mt-6 md:mt-8">
                  {Array.from({ length: pages }, (_, i) => i + 1).map((pg) => (
                    <button
                      key={pg}
                      onClick={() => {
                        const next = new URLSearchParams(params);
                        next.set('page', String(pg));
                        setParams(next);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`w-8 h-8 md:w-9 md:h-9 rounded-lg text-xs md:text-sm font-semibold transition-colors
                        ${pg === pageParam
                          ? 'bg-primary text-white'
                          : 'bg-white border border-gray-200 text-ink hover:border-primary hover:text-primary'}`}
                    >
                      {pg}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group py-0.5">
      <input type="checkbox" checked={checked} onChange={onChange} className="w-4 h-4 accent-primary rounded" />
      <span className="text-sm text-ink group-hover:text-primary transition-colors">{label}</span>
    </label>
  );
}