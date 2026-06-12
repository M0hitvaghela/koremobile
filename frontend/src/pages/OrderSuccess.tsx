import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  CheckIcon, TruckIcon, MapPinIcon, CreditCardIcon,
  Loader2Icon, PackageIcon, ArrowRightIcon,
} from 'lucide-react';
import { ordersApi, OrderOut } from '../utils/ordersApi';
import { formatINR } from '../utils/formatPrice';
import { getImageUrl } from '../utils/getImageUrl';

export function OrderSuccess() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!id) return;
    let attempts = 0;
    const MAX = 5;

    const fetchOrder = async () => {
      try {
        const o = await ordersApi.get(parseInt(id));
        setOrder(o);
        setLoading(false);
        setTimeout(() => setVisible(true), 50);
        if (o.payment_method === 'online' && o.payment_status === 'pending' && attempts < MAX) {
          attempts++;
          setTimeout(fetchOrder, 2000);
        }
      } catch {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2Icon size={40} className="animate-spin text-primary" />
        <p className="text-muted text-sm">Loading your order…</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <PackageIcon size={48} className="text-muted mx-auto mb-4" />
        <p className="text-muted">Order not found.</p>
        <Link to="/" className="text-primary mt-4 inline-block font-semibold">Go Home</Link>
      </div>
    );
  }

  const eta = new Date();
  eta.setDate(eta.getDate() + 5);
  const isOnlinePending = order.payment_method === 'online' && order.payment_status === 'pending';

  const fadeIn = (delay: string) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(12px)',
    transition: `opacity 0.4s ease ${delay}, transform 0.4s ease ${delay}`,
  });

  // GST values — backend computes these; fall back to 0 gracefully
  const totalGst = (order as any).total_gst ?? 0;
  const taxableAmount = (order as any).taxable_amount ?? (order.subtotal - totalGst);

  return (
    <div
      className="max-w-xl mx-auto px-3 sm:px-4 py-6 md:py-10 space-y-3 md:space-y-4 pb-20 md:pb-8"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity 0.5s ease, transform 0.5s ease' }}
    >
      {/* Success hero */}
      <div className="bg-white rounded-2xl shadow-card p-6 md:p-8 text-center">
        <div
          className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4"
          style={{ animation: visible ? 'pulse-ring 0.6s ease forwards' : 'none' }}
        >
          <div
            className="w-11 h-11 md:w-14 md:h-14 rounded-full bg-success flex items-center justify-center"
            style={{ transform: visible ? 'scale(1)' : 'scale(0)', transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s' }}
          >
            <CheckIcon size={24} className="text-white md:hidden" strokeWidth={3} />
            <CheckIcon size={30} className="text-white hidden md:block" strokeWidth={3} />
          </div>
        </div>

        <h1 className="font-heading font-extrabold text-xl md:text-2xl text-success" style={fadeIn('0.25s')}>
          Order Placed Successfully!
        </h1>
        <p className="text-xs md:text-sm text-muted mt-1.5" style={fadeIn('0.35s')}>
          Order:{' '}
          <span className="font-bold text-ink bg-gray-100 px-2 py-0.5 rounded-md font-mono">
            {order.order_number}
          </span>
        </p>
        <p className="text-xs md:text-sm text-ink mt-1.5" style={fadeIn('0.45s')}>
          Thank you, <strong>{order.address?.name?.split(' ')[0] ?? 'Customer'}!</strong> Your order is confirmed.
        </p>

        {isOnlinePending && (
          <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 text-xs text-yellow-800 flex items-center gap-2">
            <Loader2Icon size={13} className="animate-spin shrink-0" />
            Payment verification in progress. This page updates automatically.
          </div>
        )}
        {order.payment_status === 'paid' && (
          <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-2.5 text-xs text-green-800 font-medium">
            ✓ Payment confirmed
          </div>
        )}
        {order.payment_method === 'cod' && (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-800">
            💵 Pay {formatINR(order.total)} when your order arrives
          </div>
        )}
      </div>

      {/* Order items */}
      <div className="bg-white rounded-2xl shadow-card p-4 md:p-6" style={fadeIn('0.3s')}>
        <h3 className="font-heading font-bold text-sm md:text-base text-ink mb-3">Items Ordered</h3>

        <div className="space-y-2.5 mb-4">
          {order.items.map((item, i) => (
            <div key={i} className="flex gap-2.5 items-center">
              <div className="w-12 h-12 bg-bg rounded-lg shrink-0 overflow-hidden border border-gray-100">
                {item.image_url ? (
                  <img
                    src={getImageUrl(item.image_url)}
                    alt={item.product_name}
                    className="w-full h-full object-contain p-1"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <PackageIcon size={18} className="text-gray-300" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-ink line-clamp-1">{item.product_name}</p>
                <p className="text-[10px] md:text-xs text-muted">{item.variant_label} · Qty {item.quantity}</p>
              </div>
              <span className="text-xs md:text-sm font-semibold text-ink shrink-0">{formatINR(item.subtotal)}</span>
            </div>
          ))}
        </div>

        {/* Address & Payment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-gray-100 pt-3 text-xs md:text-sm">
          <div>
            <div className="flex items-center gap-1.5 text-muted text-[10px] md:text-xs mb-1">
              <MapPinIcon size={12} /> Delivery Address
            </div>
            <p className="font-medium text-ink text-xs md:text-sm">{order.address?.name}</p>
            <p className="text-[10px] md:text-xs text-muted leading-relaxed">
              {order.address?.house_no}, {order.address?.area}, {order.address?.village},{' '}
              {order.address?.district}, {order.address?.state} — {order.address?.pincode}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-muted text-[10px] md:text-xs mb-1">
              <CreditCardIcon size={12} /> Payment
            </div>
            <p className="font-medium text-ink text-xs md:text-sm capitalize">
              {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Online Payment'}
            </p>
            <p className="text-[10px] md:text-xs text-muted capitalize">
              Status:{' '}
              <span className={
                order.payment_status === 'paid' ? 'text-success font-semibold'
                  : order.payment_status === 'failed' ? 'text-red-500 font-semibold'
                  : 'text-yellow-600'
              }>
                {order.payment_status}
              </span>
            </p>
          </div>
        </div>

        {/* ── Price summary with GST ─────────────────────────────────────── */}
        <div className="border-t border-gray-100 mt-3 pt-2.5 space-y-1 text-xs md:text-sm">
          <div className="flex justify-between text-muted">
            <span>Subtotal</span><span>{formatINR(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Shipping</span>
            <span className={order.shipping_fee === 0 ? 'text-success font-medium' : ''}>
              {order.shipping_fee === 0 ? 'FREE' : formatINR(order.shipping_fee)}
            </span>
          </div>
          {/* GST breakdown */}
          {totalGst > 0 && (
            <div className="mt-1.5 bg-gray-50 rounded-lg p-2 space-y-0.5 border border-gray-100">
              <p className="text-[10px] font-semibold text-ink mb-0.5">Tax Breakdown</p>
              <div className="flex justify-between text-muted text-[10px]">
                <span>Taxable amount (ex-GST)</span>
                <span>{formatINR(parseFloat(taxableAmount.toFixed(2)))}</span>
              </div>
              <div className="flex justify-between text-muted text-[10px]">
                <span>Total GST (CGST + SGST)</span>
                <span>{formatINR(parseFloat(totalGst.toFixed(2)))}</span>
              </div>
            </div>
          )}
          <div className="flex justify-between font-bold text-ink border-t border-gray-100 pt-2">
            <span>Total</span><span>{formatINR(order.total)}</span>
          </div>
        </div>
        {/* ──────────────────────────────────────────────────────────────── */}

        {/* ETA */}
        <div className="bg-primary/5 rounded-lg p-2.5 mt-3 flex items-center gap-2 text-xs md:text-sm">
          <TruckIcon size={15} className="text-primary shrink-0" />
          <span className="text-ink">
            Estimated delivery:{' '}
            <strong>
              {eta.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
            </strong>
          </span>
        </div>
      </div>

      {/* CTA buttons */}
      <div className="flex flex-col sm:flex-row gap-2.5 md:gap-3" style={fadeIn('0.45s')}>
        <Link
          to={`/account/orders/${order.id}`}
          className="flex-1 bg-primary text-white font-bold py-3 md:py-3.5 rounded-xl hover:bg-primary-600 transition-colors text-center flex items-center justify-center gap-2 text-sm md:text-base"
        >
          Track My Order <ArrowRightIcon size={15} />
        </Link>
        <Link
          to="/products"
          className="flex-1 bg-white border border-gray-300 text-ink font-bold py-3 md:py-3.5 rounded-xl hover:border-primary hover:text-primary transition-colors text-center text-sm md:text-base"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
