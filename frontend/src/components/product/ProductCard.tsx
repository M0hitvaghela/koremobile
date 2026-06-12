import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HeartIcon, ShoppingCartIcon } from 'lucide-react';
import { Product } from '../../types/product';
import { formatINR, calcDiscount } from '../../utils/formatPrice';
import { useCartStore } from '../../store/cartStore';
import { useWishlistStore } from '../../store/wishlistStore';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { StarRating } from '../ui/StarRating';
import { productsApi } from '../../utils/productsApi';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate();
  const addItem = useCartStore((s) => s.addItem);
  const { isWishlisted, toggle } = useWishlistStore();
  const isLoggedIn = useAuthStore((s) => !!s.user);   // ← read auth status
  const showToast = useToastStore((s) => s.showToast);
  const [adding, setAdding] = useState(false);

  const cheapest = [...product.variants].sort((a, b) => a.price - b.price)[0];
  const discount = calcDiscount(cheapest.mrp, cheapest.price);
  const wished = isWishlisted(String(product.id));

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (cheapest.stock === 0) {
      showToast('Out of stock', 'error');
      return;
    }
    if (adding) return;
    setAdding(true);
    try {
      let targetProduct = product;
      let targetVariant = cheapest;

      if (cheapest.id.endsWith('-v0')) {
        const full = await productsApi.getBySlug(product.slug);
        const realCheapest = [...full.variants].sort((a, b) => a.price - b.price)[0];
        if (!realCheapest) {
          showToast('No variants available', 'error');
          return;
        }
        targetProduct = full;
        targetVariant = realCheapest;
      }

      addItem(targetProduct, targetVariant, 1);
      showToast(`${product.name} added to cart`, 'success');
    } catch {
      showToast('Unable to add to cart', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toggle(String(product.id), isLoggedIn);
    showToast(wished ? 'Removed from wishlist' : 'Added to wishlist', 'info');
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="bg-white rounded-xl shadow-card hover:shadow-cardHover overflow-hidden cursor-pointer group h-full flex flex-col"
      onClick={() => navigate(`/products/${product.slug}`)}
    >
      {/* Image */}
      <div className="relative aspect-square bg-[#F7F8FA] overflow-hidden">
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-contain p-2 md:p-4 transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        {discount > 0 && (
          <span className="absolute top-2 left-2 bg-discount text-white text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-md">
            {discount}% OFF
          </span>
        )}
        {/* Wishlist button */}
        <button
          onClick={handleWishlist}
          className={`absolute top-2 right-2 w-7 h-7 md:w-9 md:h-9 rounded-full bg-white shadow-md flex items-center justify-center transition-all active:scale-95 md:opacity-0 md:group-hover:opacity-100 ${wished ? 'md:opacity-100 text-discount' : 'text-muted'}`}
          aria-label="Toggle wishlist"
        >
          <HeartIcon size={14} className="md:hidden" fill={wished ? 'currentColor' : 'none'} />
          <HeartIcon size={16} className="hidden md:block" fill={wished ? 'currentColor' : 'none'} />
        </button>
        {cheapest.stock === 0 && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-ink font-semibold text-xs md:text-sm px-3 py-1 rounded">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 md:p-4 flex-1 flex flex-col gap-1 md:gap-2">
        <span className="inline-block self-start text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-muted bg-gray-100 px-1.5 py-0.5 rounded">
          {product.brand}
        </span>
        <h3 className="font-medium text-[11px] md:text-sm text-ink line-clamp-2 leading-snug min-h-[30px] md:min-h-[40px]">
          {product.name}
        </h3>
        <StarRating rating={product.rating} showNumber reviewCount={product.review_count} />
        <div className="flex items-baseline gap-1.5 mt-auto">
          <span className="font-bold text-sm md:text-lg text-ink">
            {formatINR(cheapest.price)}
          </span>
          {cheapest.mrp > cheapest.price && (
            <span className="text-[10px] md:text-xs text-muted line-through">
              {formatINR(cheapest.mrp)}
            </span>
          )}
        </div>
        <button
          onClick={handleAddToCart}
          disabled={cheapest.stock === 0 || adding}
          className="mt-1 bg-cta text-white font-semibold text-[11px] md:text-sm py-2 md:py-2.5 rounded-md md:rounded-lg hover:bg-cta-dark active:scale-[0.97] transition-all flex items-center justify-center gap-1.5 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          <ShoppingCartIcon size={13} className="md:hidden" />
          <ShoppingCartIcon size={15} className="hidden md:block" />
          Add to Cart
        </button>
      </div>
    </motion.div>
  );
}