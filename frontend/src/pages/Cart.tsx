import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBagIcon,
  Trash2Icon,
  MinusIcon,
  PlusIcon,
  ShieldCheckIcon,
} from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { useSettingsStore } from '../store/settingsStore';
import { useToastStore } from '../store/toastStore';
import { formatINR } from '../utils/formatPrice';

export function Cart() {
  const navigate = useNavigate();
  const { items, updateQty, removeItem, subtotal, mrpTotal, savings, totalItems } = useCartStore();
  const calcShipping = useSettingsStore((s) => s.calcShipping);
  const showToast = useToastStore((s) => s.showToast);

  const itemCount = totalItems();
  const subTotal = subtotal();
  const shipping = calcShipping(subTotal);
  const total = subTotal + shipping;
  const totalSavings = savings();

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 md:py-20 text-center">
        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-bg flex items-center justify-center mx-auto mb-4">
          <ShoppingBagIcon size={40} className="text-muted md:hidden" />
          <ShoppingBagIcon size={48} className="text-muted hidden md:block" />
        </div>
        <h2 className="font-heading font-bold text-xl md:text-2xl text-ink mb-2">Your cart is empty</h2>
        <p className="text-sm text-muted mb-6">Start shopping to add some items to your cart.</p>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600"
        >
          Start Shopping →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 md:py-6 w-full">
      <h1 className="font-heading font-bold text-xl md:text-2xl text-ink mb-4">
        My Cart <span className="text-muted font-normal text-base">({itemCount})</span>
      </h1>

      <div className="grid lg:grid-cols-[1fr_360px] gap-4 md:gap-6">
        {/* Items */}
        <div className="space-y-2.5 md:space-y-3">
          {items.map((item) => (
            <div key={item.variant_id} className="bg-white rounded-xl shadow-card p-3 md:p-4 flex gap-3 md:gap-4">
              <Link to={`/products/${item.slug}`} className="shrink-0">
                <div className="w-[72px] h-[72px] sm:w-20 sm:h-20 md:w-24 md:h-24 bg-[#F7F8FA] rounded-lg overflow-hidden">
                  <img src={item.image} alt={item.name} className="w-full h-full object-contain p-1.5 md:p-2" />
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <Link
                  to={`/products/${item.slug}`}
                  className="font-medium text-xs md:text-sm text-ink line-clamp-2 hover:text-primary leading-snug"
                >
                  {item.name}
                </Link>
                <p className="text-[10px] md:text-xs text-muted mt-0.5">
                  {item.color}{item.storage !== 'N/A' && ` · ${item.storage}`}
                </p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="font-bold text-sm md:text-base text-ink">{formatINR(item.price)}</span>
                  {item.mrp > item.price && (
                    <span className="text-[10px] md:text-xs text-muted line-through">{formatINR(item.mrp)}</span>
                  )}
                </div>
                {/* Controls row */}
                <div className="flex items-center justify-between mt-2.5">
                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                    <button
                      onClick={() => updateQty(item.variant_id, item.qty - 1)}
                      className="w-7 h-7 md:w-8 md:h-8 hover:bg-gray-50 flex items-center justify-center"
                      aria-label="Decrease quantity"
                    >
                      <MinusIcon size={11} />
                    </button>
                    <span className="w-7 md:w-8 text-center text-xs md:text-sm font-semibold">{item.qty}</span>
                    <button
                      onClick={() => updateQty(item.variant_id, item.qty + 1)}
                      className="w-7 h-7 md:w-8 md:h-8 hover:bg-gray-50 flex items-center justify-center"
                      aria-label="Increase quantity"
                    >
                      <PlusIcon size={11} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Line total — mobile */}
                    <span className="font-bold text-sm text-ink sm:hidden">{formatINR(item.price * item.qty)}</span>
                    <button
                      onClick={() => { removeItem(item.variant_id); showToast('Removed from cart', 'info'); }}
                      className="text-[11px] md:text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded font-semibold flex items-center gap-1"
                    >
                      <Trash2Icon size={11} />
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>
                </div>
              </div>
              {/* Line total — desktop */}
              <div className="text-right shrink-0 hidden sm:flex items-start">
                <span className="font-bold text-sm md:text-base text-ink">{formatINR(item.price * item.qty)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="lg:sticky lg:top-24 self-start space-y-3">
          <div className="bg-white rounded-xl shadow-card p-4 md:p-5">
            <h3 className="font-heading font-bold text-sm md:text-base text-ink mb-0.5">Price Details</h3>
            <p className="text-xs text-muted mb-3">{itemCount} item{itemCount > 1 && 's'}</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted text-xs md:text-sm">Price ({itemCount} item{itemCount > 1 && 's'})</span>
                <span className="text-ink text-xs md:text-sm">{formatINR(mrpTotal())}</span>
              </div>
              {totalSavings > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted text-xs md:text-sm">Discount</span>
                  <span className="text-success font-medium text-xs md:text-sm">- {formatINR(totalSavings)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted text-xs md:text-sm">Shipping</span>
                <span className={`text-xs md:text-sm ${shipping === 0 ? 'text-success font-semibold' : 'text-ink'}`}>
                  {shipping === 0 ? 'FREE' : formatINR(shipping)}
                </span>
              </div>
              <div className="border-t border-dashed border-gray-200 pt-2.5 flex justify-between">
                <span className="font-bold text-sm md:text-base text-ink">Total Amount</span>
                <span className="font-bold text-sm md:text-base text-ink">{formatINR(total)}</span>
              </div>
            </div>

            {totalSavings > 0 && (
              <div className="mt-3 bg-success-light text-success text-xs font-semibold rounded-lg p-2.5 text-center">
                You save {formatINR(totalSavings)} on this order
              </div>
            )}

            {/* ── GST note ──────────────────────────────────────────────── */}
            <p className="text-[10px] text-muted mt-1.5 text-center">
              All prices inclusive of GST
            </p>
            {/* ─────────────────────────────────────────────────────────── */}

            {/* Checkout — hidden on mobile (sticky bar below) */}
            <button
              onClick={() => navigate('/checkout')}
              className="hidden md:block w-full mt-4 bg-cta text-white font-bold py-3.5 rounded-xl hover:bg-cta-dark active:scale-[0.98] transition-all"
            >
              Proceed to Checkout
            </button>
            <Link
              to="/products"
              className="hidden md:block text-center mt-3 text-sm text-primary font-semibold hover:underline"
            >
              Continue Shopping
            </Link>
          </div>

          <div className="hidden md:flex bg-white rounded-xl shadow-card p-4 items-center gap-3">
            <ShieldCheckIcon size={28} className="text-success shrink-0" />
            <div className="text-xs text-muted">
              <span className="font-semibold text-ink block">Safe and secure payments</span>
              100% Authentic products
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky checkout bar */}
      <div className="fixed bottom-14 left-0 right-0 z-30 md:hidden bg-white border-t border-gray-200 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted">{itemCount} item{itemCount > 1 && 's'}</div>
            <div className="font-bold text-base text-ink">{formatINR(total)}</div>
          </div>
          <button
            onClick={() => navigate('/checkout')}
            className="bg-cta text-white font-bold px-6 py-2.5 rounded-xl hover:bg-cta-dark active:scale-[0.97] transition-all text-sm"
          >
            Checkout →
          </button>
        </div>
      </div>
    </div>
  );
}
