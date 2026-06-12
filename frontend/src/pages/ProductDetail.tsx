import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ChevronRightIcon, ShoppingCartIcon, ZapIcon, ShieldCheckIcon,
  ReceiptIcon, PackageCheckIcon, CheckIcon, TruckIcon,
  MinusIcon, PlusIcon, BanknoteIcon, CreditCardIcon, Loader2Icon, RotateCcwIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useProductsStore } from '../store/productsStore';
import { useCartStore } from '../store/cartStore';
import { useToastStore } from '../store/toastStore';
import { formatINR, calcDiscount, calcGstBreakdown } from '../utils/formatPrice';
import { StarRating } from '../components/ui/StarRating';
import { Badge } from '../components/ui/Badge';
import { lookupByPincode, isGujaratPincode, getDeliveryCache, setDeliveryCache, getCityCache, setCityCache } from '../utils/gujaratData';
import { api } from '../utils/api';
import { useSettingsStore } from '../store/settingsStore';
import { productsApi } from '../utils/productsApi';
import { ProductCard } from '../components/product/ProductCard';
import { Product } from '../types/product';
import { reviewsApi, ReviewSummary } from '../utils/ordersApi';
import { useRecentlyViewedStore } from '../store/recentlyViewedStore';
import { RecentlyViewed } from '../components/product/RecentlyViewed';

export function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const fetchBySlug = useProductsStore((s) => s.fetchBySlug);
  const storeProduct = useProductsStore((s) => s.getBySlug(slug ?? ''));
  const addItem = useCartStore((s) => s.addItem);
  const showToast = useToastStore((s) => s.showToast);
  const trackView = useRecentlyViewedStore((s) => s.trackView);

  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [imageIdx, setImageIdx] = useState(0);
  const [tab, setTab] = useState<'specs' | 'desc' | 'reviews'>('specs');
  const [pincode, setPincode] = useState('');
  const [pincodeResult, setPincodeResult] = useState<string | null>(null);
  const [pincodeChecking, setPincodeChecking] = useState(false);
  const [pincodeOk, setPincodeOk] = useState<boolean | null>(null);
  const [pincodeRateLimitSeconds, setPincodeRateLimitSeconds] = useState(0);
  const [qty, setQty] = useState(1);
  const enableFreeShipping = useSettingsStore((s) => s.enableFreeShipping);
  const freeShippingThreshold = useSettingsStore((s) => s.freeShippingThreshold);
  const flatShippingFee = useSettingsStore((s) => s.flatShippingFee);
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);

  const [recoItems, setRecoItems] = useState<Product[]>([]);
  const [recoPage, setRecoPage] = useState(1);
  const [recoPages, setRecoPages] = useState(1);
  const [recoLoading, setRecoLoading] = useState(false);
  const [recoError, setRecoError] = useState(false);
  const recoRef = useRef<HTMLDivElement | null>(null);
  const [reviewsSummary, setReviewsSummary] = useState<ReviewSummary | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState(false);
  const [reviewsProductId, setReviewsProductId] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetchBySlug(slug).then((p) => {
      setLoading(false);
      if (!p) { setNotFound(true); return; }
      trackView(p);
    });
  }, [slug]);

  const product = useMemo(() => {
    if (!storeProduct) return null;
    if (storeProduct.variants.length === 0) return null;
    if (storeProduct.variants[0].id.endsWith('-v0')) return null;
    return storeProduct;
  }, [storeProduct]);

  const firstVariant = product?.variants[0];
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedStorage, setSelectedStorage] = useState<string>('');

  useEffect(() => {
    if (product && firstVariant) {
      setSelectedColor(firstVariant.color);
      setSelectedStorage(firstVariant.storage);
    }
  }, [product?.id]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  useEffect(() => {
    if (pincodeRateLimitSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setPincodeRateLimitSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pincodeRateLimitSeconds]);

  const loadRecommendations = useCallback(async (page: number) => {
    if (!product) return;
    setRecoLoading(true);
    setRecoError(false);
    try {
      const res = await productsApi.recommendations(product.slug, page, 12);
      setRecoItems((prev) => (page === 1 ? res.products : [...prev, ...res.products]));
      setRecoPage(res.page);
      setRecoPages(res.pages);
    } catch {
      setRecoError(true);
    } finally {
      setRecoLoading(false);
    }
  }, [product]);

  useEffect(() => {
    if (!product) return;
    setRecoItems([]); setRecoPage(1); setRecoPages(1);
    loadRecommendations(1);
  }, [product?.id, loadRecommendations]);

  useEffect(() => {
    const el = recoRef.current;
    if (!el || recoLoading || recoPage >= recoPages) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) loadRecommendations(recoPage + 1); },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [recoLoading, recoPage, recoPages, loadRecommendations]);

  useEffect(() => {
    if (!product?.id || tab !== 'reviews' || reviewsProductId === product.id) return;
    setReviewsLoading(true);
    setReviewsError(false);
    reviewsApi.getByProduct(Number(product.id))
      .then((data) => { setReviewsSummary(data); setReviewsProductId(product.id); })
      .catch(() => setReviewsError(true))
      .finally(() => setReviewsLoading(false));
  }, [product?.id, reviewsProductId, tab]);

  const colors = useMemo(() => {
    if (!product) return [];
    return Array.from(new Set(product.variants.map((v) => v.color)));
  }, [product]);

  const storages = useMemo(() => {
    if (!product) return [];
    return Array.from(new Set(product.variants.map((v) => v.storage)));
  }, [product]);

  const currentVariant = useMemo(() => {
    if (!product) return undefined;
    return (
      product.variants.find((v) => v.color === selectedColor && v.storage === selectedStorage) ||
      product.variants.find((v) => v.color === selectedColor) ||
      product.variants[0]
    );
  }, [product, selectedColor, selectedStorage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2Icon size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || (!loading && !product && storeProduct === undefined)) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="font-heading font-bold text-2xl">Product not found</h2>
        <Link to="/products" className="text-primary mt-4 inline-block">← Back to products</Link>
      </div>
    );
  }

  if (!product || !currentVariant) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2Icon size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  const v = currentVariant;
  const discount = calcDiscount(v.mrp, v.price);
  const save = v.mrp - v.price;

  // ── GST breakdown for current variant ────────────────────────────────────────
  const gstRate = product.gst_rate ?? 18;
  const gst = calcGstBreakdown(v.price, gstRate);
  // ─────────────────────────────────────────────────────────────────────────────

  const badgeIcons: Record<string, LucideIcon> = {
    warranty: ShieldCheckIcon,
    free_delivery: TruckIcon,
    gst_invoice: ReceiptIcon,
    genuine_product: PackageCheckIcon,
    secure_payments: ShieldCheckIcon,
    easy_returns: RotateCcwIcon,
    custom: CheckIcon,
  };

  const useDefaultBadges = !product.badges || product.badges.length === 0;
  const baseBadges = useDefaultBadges
    ? [
        { key: 'warranty', label: '1 Year Warranty' },
        { key: 'gst_invoice', label: 'GST Invoice Provided' },
        { key: 'genuine_product', label: 'Genuine Product' },
      ]
    : (product.badges || []);

  const showFreeDelivery =
    baseBadges.some((b) => b.key === 'free_delivery')
      ? true
      : enableFreeShipping && v.price >= freeShippingThreshold;

  const displayBadges = [...baseBadges];
  if (!displayBadges.some((b) => b.key === 'free_delivery') && showFreeDelivery) {
    displayBadges.push({ key: 'free_delivery', label: 'Free Delivery' });
  }

  const handleAdd = (buyNow = false) => {
    if (v.stock === 0) { showToast('Out of stock', 'error'); return; }
    addItem(product, v, qty);
    showToast(`${product.name} added to cart`, 'success');
    if (buyNow) navigate('/checkout');
  };

  const parseRetrySeconds = (err: any): number => {
    const retryAfterRaw = err?.response?.headers?.['retry-after'];
    const retryAfter = Number(retryAfterRaw);
    if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter;

    const detail = String(err?.response?.data?.detail ?? '');
    const match = detail.match(/(\d+)\s*s/i);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }

    return 60;
  };

  const getDeliveryFeeLabel = () => {
    if (enableFreeShipping && v.price >= freeShippingThreshold) {
      return ' · Free delivery';
    }

    return ` · Delivery ${formatINR(flatShippingFee)}`;
  };

  const checkPincode = async () => {
    if (!/^\d{6}$/.test(pincode)) {
      setPincodeResult('Please enter a valid 6-digit pincode');
      setPincodeOk(false);
      return;
    }

    // Gujarat-only restriction on frontend before even hitting API
    if (!isGujaratPincode(pincode)) {
      setPincodeResult('We currently deliver only within Gujarat (pincodes 36xxxx – 39xxxx).');
      setPincodeOk(false);
      return;
    }

    // Check in-memory cache first — no API call needed
    const cached = getDeliveryCache(pincode);
    if (cached !== undefined) {
      const location = getCityCache(pincode);
      const fee = getDeliveryFeeLabel();
      setPincodeRateLimitSeconds(0);
      setPincodeOk(cached.deliverable);
      setPincodeResult(cached.deliverable
        ? `✓ Delivery available${location ? ` to ${location}` : ''}${fee}`
        : 'Sorry, delivery is not available at this pincode.');
      return;
    }

    // Call backend API
    setPincodeChecking(true);
    setPincodeResult(null);
    setPincodeOk(null);
    try {
      const res = await api.get(`pincode/check?pincode=${pincode}`);
      const { deliverable, city, state } = res.data;
      setPincodeRateLimitSeconds(0);
      setDeliveryCache(pincode, { deliverable, cod: res.data.cod, prepaid: res.data.prepaid });
      setCityCache(pincode, city ? `${city}, ${state}` : '');
      const location = city ? ` to ${city}, ${state}` : '';
      const fee = deliverable ? getDeliveryFeeLabel() : '';
      setPincodeOk(deliverable);
      setPincodeResult(deliverable ? `✓ Delivery available${location}${fee}` : 'Sorry, delivery is not available at this pincode.');
    } catch (err: any) {
      if (err?.response?.status === 429) {
        const retrySeconds = parseRetrySeconds(err);
        setPincodeRateLimitSeconds(retrySeconds);
        setPincodeOk(false);
        setPincodeResult(`Too many pincode checks. Please retry in ${retrySeconds} seconds.`);
        return;
      }

      // Fallback: if API unreachable, use local gujarat.json data
      const matches = lookupByPincode(pincode);
      const deliverable = matches.length > 0;
      setDeliveryCache(pincode, { deliverable, cod: false, prepaid: deliverable });
      const location = matches.length > 0 ? ` to ${matches[0].taluka}, ${matches[0].district}` : '';
      const fee = deliverable ? getDeliveryFeeLabel() : '';
      setPincodeOk(deliverable);
      setPincodeResult(deliverable ? `✓ Delivery available${location}${fee}` : 'Sorry, delivery is not available at this pincode.');
    } finally {
      setPincodeChecking(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 md:py-6 w-full pb-24 md:pb-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-muted mb-3 flex-wrap">
        <Link to="/" className="hover:text-primary">Home</Link>
        <ChevronRightIcon size={11} />
        <Link to={`/products?category=${product.category}`} className="hover:text-primary">{product.category}</Link>
        <ChevronRightIcon size={11} />
        <span className="text-ink font-medium truncate max-w-[160px] sm:max-w-none">{product.name}</span>
      </nav>

      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="grid lg:grid-cols-[42%_58%] gap-0">
          {/* Left: Images */}
          <div className="p-3 md:p-6 lg:border-r border-gray-100">
            <div className="bg-[#F7F8FA] rounded-xl aspect-square overflow-hidden mb-3 group">
              <img
                src={product.images[imageIdx] || 'https://via.placeholder.com/400'}
                alt={product.name}
                className="w-full h-full object-contain p-3 md:p-6 transition-transform duration-500 group-hover:scale-110"
              />
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setImageIdx(i)}
                    className={`w-12 h-12 md:w-16 md:h-16 rounded-lg overflow-hidden border-2 shrink-0 bg-[#F7F8FA] transition-all
                      ${imageIdx === i ? 'border-primary' : 'border-transparent hover:border-gray-200'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-contain p-1" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Info */}
          <div className="p-3 md:p-6">
            <Badge variant="grey" size="md">{product.brand}</Badge>
            <h1 className="font-heading font-bold text-lg md:text-3xl text-ink mt-2 md:mt-3 leading-tight">
              {product.name}
            </h1>

            <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-2 md:mt-3">
              <div className="inline-flex items-center gap-1.5 bg-success text-white px-2 py-0.5 rounded text-xs font-bold">
                {product.rating.toFixed(1)} <StarRating rating={5} size="sm" />
              </div>
              <span className="text-xs text-muted">{product.review_count.toLocaleString('en-IN')} reviews</span>
              <Badge variant="success" size="sm">
                <CheckIcon size={10} className="mr-0.5" /> Verified Genuine · Sealed
              </Badge>
            </div>

            {/* ── Price + GST breakdown ───────────────────────────────────── */}
            <div className="bg-orange-50/40 rounded-xl p-3 md:p-4 mt-3 md:mt-5">
              <div className="text-xs text-muted">Special Price</div>
              <div className="flex items-baseline gap-2 md:gap-3 mt-1 flex-wrap">
                <span className="font-heading font-extrabold text-2xl md:text-4xl text-ink">{formatINR(v.price)}</span>
                {v.mrp > v.price && (
                  <>
                    <span className="text-sm md:text-base text-muted line-through">{formatINR(v.mrp)}</span>
                    <Badge variant="discount" size="md">{discount}% off</Badge>
                  </>
                )}
              </div>
              {save > 0 && (
                <p className="text-xs md:text-sm text-success font-semibold mt-1">You save {formatINR(save)}</p>
              )}

              {/* GST breakdown — shown only if rate > 0 */}
              {gstRate > 0 && (
                <div className="mt-2 pt-2 border-t border-orange-100/60 text-[10px] md:text-xs text-muted space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span>Price before GST ({gstRate}%)</span>
                    <span className="font-medium text-ink">{formatINR(gst.basePrice)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>CGST ({gstRate / 2}%) + SGST ({gstRate / 2}%)</span>
                    <span className="font-medium text-ink">{formatINR(gst.gstAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold text-ink">
                    <span>Total (incl. GST)</span>
                    <span>{formatINR(v.price)}</span>
                  </div>
                  {product.hsn_code && (
                    <p className="text-muted mt-0.5">HSN: {product.hsn_code}</p>
                  )}
                </div>
              )}
              {gstRate === 0 && (
                <p className="text-[10px] md:text-xs text-muted mt-1.5">
                  This item is GST exempt (0% GST).
                </p>
              )}
            </div>
            {/* ────────────────────────────────────────────────────────────── */}

            {/* Color */}
            {colors.length > 0 && (
              <div className="mt-4 md:mt-5">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-xs md:text-sm font-bold text-ink">Color:</span>
                  <span className="text-xs md:text-sm text-muted">{selectedColor}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setSelectedColor(c)}
                      className={`px-2.5 py-1.5 md:px-4 md:py-2 rounded-lg border-2 text-xs md:text-sm font-medium transition-all
                        ${selectedColor === c
                          ? 'border-primary bg-primary-50 text-primary'
                          : 'border-gray-200 text-ink hover:border-gray-300'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Storage */}
            {storages.length > 0 && (
              <div className="mt-3 md:mt-4">
                <div className="text-xs md:text-sm font-bold text-ink mb-2">Storage:</div>
                <div className="flex flex-wrap gap-2">
                  {storages.map((s) => {
                    const variantForStorage = product.variants.find(
                      (vv) => vv.color === selectedColor && vv.storage === s
                    );
                    const outOfStock = !variantForStorage || variantForStorage.stock === 0;
                    return (
                      <button
                        key={s}
                        onClick={() => !outOfStock && setSelectedStorage(s)}
                        disabled={outOfStock}
                        className={`px-2.5 py-1.5 md:px-4 md:py-2 rounded-lg border-2 text-xs md:text-sm font-medium transition-all
                          ${selectedStorage === s
                            ? 'border-primary bg-primary-50 text-primary'
                            : outOfStock
                            ? 'border-gray-200 text-gray-400 line-through cursor-not-allowed'
                            : 'border-gray-200 text-ink hover:border-gray-300'}`}
                      >
                        {s}{variantForStorage ? ` · ${formatINR(variantForStorage.price)}` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stock + Qty */}
            <div className="flex items-center gap-4 mt-3 md:mt-4 flex-wrap">
              <div>
                {v.stock > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-xs md:text-sm font-semibold text-success">
                    <CheckIcon size={13} /> In Stock{v.stock <= 10 && ` (${v.stock} left)`}
                  </span>
                ) : (
                  <span className="text-xs md:text-sm font-semibold text-red-500">Out of Stock</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs md:text-sm font-bold text-ink">Qty:</span>
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="w-8 h-8 hover:bg-gray-50 flex items-center justify-center"
                  >
                    <MinusIcon size={13} />
                  </button>
                  <span className="w-8 text-center font-semibold text-xs md:text-sm">{qty}</span>
                  <button
                    onClick={() => setQty(Math.min(v.stock, qty + 1))}
                    className="w-8 h-8 hover:bg-gray-50 flex items-center justify-center"
                  >
                    <PlusIcon size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* CTA — desktop only */}
            <div className="hidden md:flex gap-3 mt-6">
              <button
                onClick={() => handleAdd(false)}
                disabled={v.stock === 0}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-primary text-primary font-bold text-sm hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                <ShoppingCartIcon size={16} /> Add to Cart
              </button>
              {product.allow_online && (
                <button
                  onClick={() => handleAdd(true)}
                  disabled={v.stock === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-cta text-white font-bold text-sm hover:bg-cta-dark transition-colors disabled:opacity-50"
                >
                  <ZapIcon size={16} /> Buy Now
                </button>
              )}
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {displayBadges.map((b, idx) => {
                const Icon = badgeIcons[b.key] || CheckIcon;
                const label = b.label || b.key.replace(/_/g, ' ');
                return (
                  <div key={`${b.key}-${idx}`} className="flex items-center gap-1.5 text-[11px] md:text-xs text-muted">
                    <Icon size={13} className="text-success shrink-0" />
                    {label}
                  </div>
                );
              })}
            </div>

            {/* Payment methods */}
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] md:text-xs text-muted">
              {product.allow_cod && (
                <span className="flex items-center gap-1">
                  <BanknoteIcon size={12} className="text-success" /> Cash on Delivery
                </span>
              )}
              {product.allow_online && (
                <span className="flex items-center gap-1">
                  <CreditCardIcon size={12} className="text-primary" /> UPI / Cards / Net Banking
                </span>
              )}
            </div>

            {/* Pincode */}
            <div className="mt-4 flex gap-2">
              <input
                type="text" maxLength={6} value={pincode}
                onChange={(e) => {
                  setPincode(e.target.value.replace(/\D/, ''));
                  setPincodeResult(null);
                  setPincodeOk(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && checkPincode()}
                placeholder="Enter pincode (Gujarat only)"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs md:text-sm focus:border-primary outline-none"
              />
              <button
                onClick={checkPincode}
                disabled={pincodeChecking || pincode.length !== 6 || pincodeRateLimitSeconds > 0}
                className="px-3 md:px-4 py-2 text-xs md:text-sm text-primary font-semibold border border-primary rounded-lg hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {pincodeChecking
                  ? <><Loader2Icon size={13} className="animate-spin" /> Checking...</>
                  : pincodeRateLimitSeconds > 0
                  ? `Retry in ${pincodeRateLimitSeconds}s`
                  : 'Check'}
              </button>
            </div>
            {pincodeResult && (
              <p className={`text-[11px] md:text-xs mt-1.5 font-medium ${pincodeOk ? 'text-green-600' : 'text-red-500'}`}>
                {pincodeResult}
              </p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-t border-gray-100">
          <div className="flex overflow-x-auto no-scrollbar border-b border-gray-100">
            {(['specs', 'desc', 'reviews'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`shrink-0 px-4 md:px-6 py-3 text-xs md:text-sm font-semibold capitalize transition-colors whitespace-nowrap
                  ${tab === t ? 'text-primary border-b-2 border-primary' : 'text-muted hover:text-ink'}`}
              >
                {t === 'specs' ? 'Specifications' : t === 'desc' ? 'Description' : 'Reviews'}
              </button>
            ))}
          </div>

          <div className="p-3 md:p-6">
            {tab === 'specs' && (
              <div className="grid sm:grid-cols-2 gap-0 rounded-xl overflow-hidden border border-gray-100">
                {product.specifications.map((spec, i) => (
                  <div key={i} className={`flex gap-3 px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <span className="text-muted w-28 md:w-36 shrink-0">{spec.key}</span>
                    <span className="text-ink font-medium">{spec.value}</span>
                  </div>
                ))}
                {/* GST info row at end of specs */}
                {gstRate > 0 && (
                  <div className={`flex gap-3 px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm ${product.specifications.length % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <span className="text-muted w-28 md:w-36 shrink-0">GST Rate</span>
                    <span className="text-ink font-medium">{gstRate}%{product.hsn_code ? ` (HSN: ${product.hsn_code})` : ''}</span>
                  </div>
                )}
                {product.specifications.length === 0 && (
                  <p className="text-muted text-xs md:text-sm p-4">No specifications available.</p>
                )}
              </div>
            )}

            {tab === 'desc' && (
              <p className="text-xs md:text-sm text-ink leading-relaxed">
                {product.description || 'No description available.'}
              </p>
            )}

            {tab === 'reviews' && (
              <div className="space-y-4">
                {reviewsLoading && (
                  <div className="flex items-center gap-2 text-xs md:text-sm text-muted">
                    <Loader2Icon size={16} className="animate-spin text-primary" /> Loading reviews...
                  </div>
                )}
                {!reviewsLoading && reviewsError && (
                  <p className="text-xs md:text-sm text-red-500">Failed to load reviews. Please try again.</p>
                )}
                {!reviewsLoading && !reviewsError && reviewsSummary && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="text-3xl font-bold text-ink">{reviewsSummary.avg_rating.toFixed(1)}</div>
                      <div>
                        <StarRating rating={Math.round(reviewsSummary.avg_rating)} size="sm" />
                        <p className="text-xs text-muted">{reviewsSummary.total_reviews.toLocaleString('en-IN')} reviews</p>
                      </div>
                    </div>
                    {reviewsSummary.total_reviews === 0 && (
                      <p className="text-xs md:text-sm text-muted">No reviews yet.</p>
                    )}
                    {reviewsSummary.total_reviews > 0 && (
                      <div className="space-y-3">
                        {reviewsSummary.reviews.map((r) => (
                          <div key={r.id} className="border border-gray-100 rounded-xl p-3 md:p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-ink">{r.user_name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <StarRating rating={r.rating} size="sm" />
                                  <span className="text-xs text-muted">
                                    {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </span>
                                </div>
                              </div>
                              {r.is_verified && (
                                <span className="text-[10px] font-semibold text-success bg-success/10 px-2 py-1 rounded-full shrink-0">
                                  Verified
                                </span>
                              )}
                            </div>
                            {r.title && <p className="text-sm font-semibold text-ink mt-2">{r.title}</p>}
                            <p className="text-xs md:text-sm text-ink mt-1 leading-relaxed">{r.body}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recently Viewed */}
      <RecentlyViewed excludeId={product.id} />

      {/* Recommendations */}
      <div className="mt-6 md:mt-8">
        <h2 className="font-heading font-bold text-base md:text-lg text-ink mb-3 md:mb-4">Recommended for you</h2>
        {recoError && <p className="text-sm text-red-500">Failed to load recommendations.</p>}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 md:gap-4">
          {recoItems.map((p) => <ProductCard key={p.slug} product={p} />)}
        </div>
        {recoLoading && (
          <div className="flex items-center gap-2 mt-4 text-sm text-muted">
            <Loader2Icon size={16} className="animate-spin text-primary" /> Loading more...
          </div>
        )}
        {!recoLoading && recoItems.length === 0 && !recoError && (
          <p className="text-sm text-muted">No recommendations yet.</p>
        )}
        <div ref={recoRef} />
      </div>

      {/* Mobile sticky CTA bar */}
      <div className="fixed bottom-14 left-0 right-0 z-30 md:hidden bg-white border-t border-gray-200 px-3 py-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
        <div className="flex gap-2.5">
          <button
            onClick={() => handleAdd(false)}
            disabled={v.stock === 0}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-primary text-primary font-bold text-xs hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            <ShoppingCartIcon size={14} /> Add to Cart
          </button>
          {product.allow_online && (
            <button
              onClick={() => handleAdd(true)}
              disabled={v.stock === 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-cta text-white font-bold text-xs hover:bg-cta-dark transition-colors disabled:opacity-50"
            >
              <ZapIcon size={14} /> Buy Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}