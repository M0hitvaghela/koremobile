import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { HeartIcon, ShoppingCartIcon, LockIcon } from 'lucide-react';
import { wishlistApi, PublicWishlistData } from '../utils/wishlistApi';
import { formatINR, calcDiscount } from '../utils/formatPrice';
import { getImageUrl } from '../utils/getImageUrl';
import { StarRating } from '../components/ui/StarRating';

export function SharedWishlist() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [data, setData] = useState<PublicWishlistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'not_found' | 'private' | null>(null);

  useEffect(() => {
    if (!shareToken) return;
    wishlistApi
      .getShared(shareToken)
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        const status = err?.response?.status;
        setError(status === 403 ? 'private' : 'not_found');
        setLoading(false);
      });
  }, [shareToken]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="h-8 w-56 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl aspect-square animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error === 'private') {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <LockIcon size={48} className="text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-ink mb-2">This wishlist is private</h2>
        <p className="text-sm text-muted mb-6">
          The owner has made this wishlist private. Ask them to enable sharing.
        </p>
        <Link to="/" className="text-cta font-semibold text-sm hover:underline">
          Go to Home
        </Link>
      </div>
    );
  }

  if (error === 'not_found' || !data) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <HeartIcon size={48} className="text-gray-200 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-ink mb-2">Wishlist not found</h2>
        <p className="text-sm text-muted mb-6">
          This link may be invalid or the wishlist may have been deleted.
        </p>
        <Link to="/" className="text-cta font-semibold text-sm hover:underline">
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <HeartIcon className="text-discount" size={22} fill="currentColor" />
        <h1 className="text-xl font-bold text-ink">{data.title}</h1>
      </div>
      <p className="text-sm text-muted mb-6">
        {data.item_count} item{data.item_count !== 1 ? 's' : ''} · Shared wishlist
      </p>

      {/* Empty */}
      {data.items.length === 0 && (
        <div className="py-16 text-center">
          <HeartIcon size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-muted text-sm">This wishlist has no items yet.</p>
        </div>
      )}

      {/* Grid */}
      {data.items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {data.items.map((item) => {
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
                  <Link
                    to={`/products/${p.slug}`}
                    className="mt-1 bg-cta text-white text-[10px] font-semibold py-1.5 rounded-md flex items-center justify-center gap-1 hover:bg-cta-dark transition-colors"
                  >
                    <ShoppingCartIcon size={11} />
                    View &amp; Buy
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer CTA */}
      <div className="mt-10 pt-6 border-t border-gray-100 text-center">
        <p className="text-sm text-muted mb-3">
          Want your own wishlist? Create a free account on Koremobile.
        </p>
        <Link
          to="/register"
          className="bg-cta text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-cta-dark transition-colors inline-block"
        >
          Create Account
        </Link>
      </div>
    </div>
  );
}