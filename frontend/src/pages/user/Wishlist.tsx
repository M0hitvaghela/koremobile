import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HeartIcon,
  Share2Icon,
  CheckIcon,
  Trash2Icon,
  EyeIcon,
  EyeOffIcon,
  PencilIcon,
  ShoppingCartIcon,
  PackageOpenIcon,
} from 'lucide-react';
import { useWishlistStore } from '../../store/wishlistStore';
import { useCartStore } from '../../store/cartStore';
import { useToastStore } from '../../store/toastStore';
import { formatINR, calcDiscount } from '../../utils/formatPrice';
import { getImageUrl } from '../../utils/getImageUrl';
import { StarRating } from '../../components/ui/StarRating';

export function Wishlist() {
  const {
    serverWishlist,
    isLoading,
    fetchWishlist,
    toggle,
    updateTitle,
    updateVisibility,
    clearWishlist,
  } = useWishlistStore();

  const addItem = useCartStore((s) => s.addItem);
  const showToast = useToastStore((s) => s.showToast);

  const [copied, setCopied] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  // ── Copy share link ────────────────────────────────────────────────────────
  const handleCopyLink = async () => {
    if (!serverWishlist?.share_url) return;
    try {
      await navigator.clipboard.writeText(serverWishlist.share_url);
      setCopied(true);
      showToast('Share link copied!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('Could not copy link', 'error');
    }
  };

  // ── Rename ─────────────────────────────────────────────────────────────────
  const handleTitleSave = async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed) return;
    await updateTitle(trimmed);
    setEditingTitle(false);
    showToast('Wishlist renamed', 'success');
  };

  // ── Remove single item ─────────────────────────────────────────────────────
  const handleRemove = async (productId: number) => {
    await toggle(String(productId), true);
    showToast('Removed from wishlist', 'info');
  };

  // ── Clear all ──────────────────────────────────────────────────────────────
  const handleClearAll = async () => {
    await clearWishlist();
    setConfirmClear(false);
    showToast('Wishlist cleared', 'info');
  };

  // ── Add to cart from wishlist ──────────────────────────────────────────────
  const handleAddToCart = (item: any) => {
    // We only have summary data here; navigate to PDP for variant selection
    showToast('Open product page to choose variant & add to cart', 'info');
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading && !serverWishlist) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl aspect-square animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const wl = serverWishlist;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <HeartIcon className="text-discount" size={22} fill="currentColor" />

        {editingTitle ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-lg font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-cta min-w-0 flex-1"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSave();
                if (e.key === 'Escape') setEditingTitle(false);
              }}
              autoFocus
            />
            <button
              onClick={handleTitleSave}
              className="text-cta hover:text-cta-dark transition-colors"
              title="Save"
            >
              <CheckIcon size={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-ink">
              {wl?.title ?? 'My Wishlist'}
            </h1>
            <button
              onClick={() => {
                setTitleDraft(wl?.title ?? 'My Wishlist');
                setEditingTitle(true);
              }}
              className="text-muted hover:text-ink transition-colors"
              title="Rename wishlist"
            >
              <PencilIcon size={14} />
            </button>
          </div>
        )}

        <span className="text-sm text-muted ml-auto">
          {wl?.item_count ?? 0} item{(wl?.item_count ?? 0) !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Share bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-6 p-3 bg-gray-50 rounded-xl border border-gray-200">
        {/* Visibility toggle */}
        <button
          onClick={() => updateVisibility(!(wl?.is_public ?? true))}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors"
          title={wl?.is_public ? 'Make private' : 'Make public'}
        >
          {wl?.is_public ? (
            <>
              <EyeIcon size={15} />
              <span>Public</span>
            </>
          ) : (
            <>
              <EyeOffIcon size={15} />
              <span>Private</span>
            </>
          )}
        </button>

        <div className="h-4 w-px bg-gray-300" />

        {/* Share URL */}
        {wl?.is_public && wl.share_url ? (
          <>
            <span className="text-xs text-muted truncate max-w-[180px] sm:max-w-xs font-mono">
              {wl.share_url}
            </span>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 text-sm font-medium text-cta hover:text-cta-dark transition-colors ml-auto"
            >
              {copied ? (
                <>
                  <CheckIcon size={14} />
                  Copied!
                </>
              ) : (
                <>
                  <Share2Icon size={14} />
                  Copy link
                </>
              )}
            </button>
          </>
        ) : (
          <span className="text-xs text-muted italic ml-1">
            Enable public to share this wishlist
          </span>
        )}
      </div>

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {(!wl || wl.items.length === 0) && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <HeartIcon size={48} className="text-gray-200 mb-4" />
          <p className="text-lg font-semibold text-ink mb-1">
            Your wishlist is empty
          </p>
          <p className="text-sm text-muted mb-6">
            Save products you love — share your list before Diwali or Navratri!
          </p>
          <Link
            to="/products"
            className="bg-cta text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-cta-dark transition-colors"
          >
            Browse Products
          </Link>
        </div>
      )}

      {/* ── Product grid ───────────────────────────────────────────────────── */}
      {wl && wl.items.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {wl.items.map((item) => {
              const p = item.product;
              const discount = calcDiscount(p.min_mrp, p.min_price);
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl shadow-card overflow-hidden flex flex-col group"
                >
                  {/* Image */}
                  <Link
                    to={`/products/${p.slug}`}
                    className="relative block aspect-square bg-[#F7F8FA] overflow-hidden"
                  >
                    <img
                      src={getImageUrl(p.primary_image ?? '')}
                      alt={p.name}
                      className="w-full h-full object-contain p-3 transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    {discount > 0 && (
                      <span className="absolute top-2 left-2 bg-discount text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                        {discount}% OFF
                      </span>
                    )}
                    {!p.in_stock && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="bg-white text-ink text-xs font-semibold px-2 py-1 rounded">
                          Out of Stock
                        </span>
                      </div>
                    )}
                  </Link>

                  {/* Info */}
                  <div className="p-2.5 flex flex-col gap-1 flex-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted">
                      {p.brand}
                    </span>
                    <Link
                      to={`/products/${p.slug}`}
                      className="text-[11px] font-medium text-ink line-clamp-2 leading-snug hover:text-cta transition-colors"
                    >
                      {p.name}
                    </Link>
                    <StarRating rating={p.avg_rating} reviewCount={p.review_count} />
                    <div className="flex items-baseline gap-1 mt-auto">
                      <span className="font-bold text-sm text-ink">
                        {formatINR(p.min_price)}
                      </span>
                      {p.min_mrp > p.min_price && (
                        <span className="text-[10px] text-muted line-through">
                          {formatINR(p.min_mrp)}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5 mt-1">
                      <Link
                        to={`/products/${p.slug}`}
                        className="flex-1 bg-cta text-white text-[10px] font-semibold py-1.5 rounded-md flex items-center justify-center gap-1 hover:bg-cta-dark transition-colors"
                      >
                        <ShoppingCartIcon size={11} />
                        Add to Cart
                      </Link>
                      <button
                        onClick={() => handleRemove(item.product_id)}
                        className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-muted hover:text-discount hover:border-discount transition-colors"
                        title="Remove"
                      >
                        <Trash2Icon size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Clear all */}
          <div className="mt-8 flex justify-end">
            {confirmClear ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted">Remove all items?</span>
                <button
                  onClick={handleClearAll}
                  className="text-sm font-semibold text-discount hover:underline"
                >
                  Yes, clear
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="text-sm text-muted hover:underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1.5 text-sm text-muted hover:text-discount transition-colors"
              >
                <Trash2Icon size={14} />
                Clear wishlist
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}