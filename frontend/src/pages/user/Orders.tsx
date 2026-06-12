import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PackageIcon, ChevronRightIcon, Loader2Icon } from 'lucide-react';
import { useOrdersStore } from '../../store/ordersStore';
import { formatINR } from '../../utils/formatPrice';
import { StatusBadge } from '../../components/ui/StatusBadge';

export function Orders() {
  const { orders, loading, error, fetchOrders } = useOrdersStore();

  useEffect(() => { fetchOrders(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2Icon size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 text-sm">{error}</p>
        <button onClick={() => fetchOrders()} className="mt-4 text-primary underline text-sm">
          Retry
        </button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <PackageIcon size={44} className="mx-auto text-gray-300 mb-4" />
        <h3 className="font-heading font-bold text-lg text-ink mb-2">No orders yet</h3>
        <p className="text-muted text-sm mb-6">Once you place an order, it will appear here.</p>
        <Link
          to="/products"
          className="inline-block bg-primary text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-primary-600 transition-colors"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="font-heading font-bold text-base md:text-lg text-ink">My Orders</h2>

      {orders.map((order) => (
        <Link
          key={order.id}
          to={`/account/orders/${order.id}`}
          className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-3 md:p-4 hover:border-primary/40 hover:shadow-sm transition-all active:scale-[0.99]"
        >
          {/* Product image */}
          <div className="w-12 h-12 md:w-14 md:h-14 bg-bg rounded-lg shrink-0 overflow-hidden">
            {order.primary_image ? (
              <img src={order.primary_image} alt="" className="w-full h-full object-contain p-1" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <PackageIcon size={22} className="text-gray-300" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="font-semibold text-xs md:text-sm text-ink">{order.order_number}</span>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-[11px] md:text-xs text-muted">
              {order.item_count} item{order.item_count !== 1 ? 's' : ''} ·{' '}
              {new Date(order.created_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>
            <p className="text-sm font-bold text-ink mt-1">{formatINR(order.total)}</p>
          </div>

          <ChevronRightIcon size={16} className="text-muted shrink-0" />
        </Link>
      ))}
    </div>
  );
}