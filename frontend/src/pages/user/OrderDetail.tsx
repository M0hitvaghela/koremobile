import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeftIcon, TruckIcon, MapPinIcon, CreditCardIcon,
  RotateCcwIcon, Loader2Icon, StarIcon, DownloadIcon,
  PackageCheckIcon, ExternalLinkIcon,
} from 'lucide-react';
import { useOrdersStore } from '../../store/ordersStore';
import { useToastStore } from '../../store/toastStore';
import { formatINR } from '../../utils/formatPrice';
import { generateInvoicePdf } from '../../utils/generateInvoicePdf';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { ReviewModal } from '../../components/product/ReviewModal';
import { getOrderTracking, TrackingInfo, ScanEvent } from '../../utils/shippingApi';

// ── ITL status code → friendly colour ────────────────────────────────────────
function itlStatusColor(code?: string): string {
  if (!code) return 'text-gray-500';
  if (code === 'DL') return 'text-green-600';
  if (code === 'CN') return 'text-red-500';
  if (code === 'RT') return 'text-orange-500';
  return 'text-blue-600'; // UD = in transit
}

// ── Scan timeline entry ───────────────────────────────────────────────────────
function ScanRow({ scan }: { scan: ScanEvent }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex flex-col items-center shrink-0 pt-0.5">
        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
        <div className="w-px flex-1 bg-gray-200 mt-1" style={{ minHeight: 20 }} />
      </div>
      <div className="pb-3 flex-1 min-w-0">
        <p className="text-xs font-semibold text-ink leading-tight">{scan.status}</p>
        <p className="text-[11px] text-muted mt-0.5">{scan.scan_location}</p>
        {scan.remark && (
          <p className="text-[11px] text-muted italic">{scan.remark}</p>
        )}
        <p className="text-[10px] text-gray-400 mt-0.5">
          {new Date(scan.scan_date_time).toLocaleString('en-IN', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentOrder, loading, fetchOrder, returnOrder } = useOrdersStore();
  const showToast = useToastStore((s) => s.showToast);

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnDesc, setReturnDesc] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [reviewItem, setReviewItem] = useState<{ product_id: number; name: string } | null>(null);

  const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [showScans, setShowScans] = useState(false);

  useEffect(() => {
    if (id) fetchOrder(parseInt(id));
  }, [id]);

  // Auto-load tracking if order is shipped/delivered
  useEffect(() => {
    if (!currentOrder) return;
    const shouldLoad = ['shipped', 'delivered', 'processing'].includes(currentOrder.status);
    if (shouldLoad && currentOrder.itl_awb_number) {
      setTrackingLoading(true);
      getOrderTracking(currentOrder.id as unknown as number)
        .then(setTrackingInfo)
        .catch(() => {})
        .finally(() => setTrackingLoading(false));
    }
  }, [currentOrder?.id, currentOrder?.status]);

  if (loading || !currentOrder) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2Icon size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  const order = currentOrder;
  const canReturn = order.status === 'delivered';
  const isDelivered = order.status === 'delivered';

  const totalGst = (order as any).total_gst ?? 0;
  const totalCgst = (order as any).total_cgst ?? totalGst / 2;
  const totalSgst = (order as any).total_sgst ?? totalGst / 2;
  const taxableAmount = (order as any).taxable_amount ?? (order.subtotal - totalGst);

  const handleReturn = async () => {
    if (!returnReason) return showToast('Please select a reason', 'warning');
    setActionLoading(true);
    const ok = await returnOrder(order.id, returnReason, returnDesc);
    setActionLoading(false);
    setShowReturnModal(false);
    if (ok) showToast('Return request submitted', 'success');
    else showToast('Failed to submit return request', 'error');
  };

  return (
    <div className="space-y-3 md:space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/account/orders" className="text-muted hover:text-primary p-1 -ml-1 rounded-lg hover:bg-bg transition-colors">
          <ArrowLeftIcon size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="font-heading font-bold text-sm md:text-lg text-ink truncate">
            {order.order_number}
          </h2>
          <p className="text-[11px] md:text-xs text-muted">
            {new Date(order.created_at).toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <StatusBadge status={order.status as any} />
          {isDelivered && (
            <button
              onClick={() => generateInvoicePdf(order as any)}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary border border-primary rounded-lg px-2.5 py-1.5 hover:bg-primary/5 transition-colors"
              title="Download GST Invoice"
            >
              <DownloadIcon size={13} />
              <span className="hidden sm:inline">Invoice</span>
            </button>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl shadow-card p-4 md:p-5">
        <h3 className="font-semibold text-xs md:text-sm text-ink mb-3">Items Ordered</h3>
        <div className="space-y-3">
          {order.items.map((item, i) => {
            const itemGst = (item as any).gst_subtotal ?? 0;
            const itemBase = (item as any).taxable_subtotal ?? (item.price * item.quantity - itemGst);
            const gstRate = (item as any).gst_rate ?? 0;

            return (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-bg rounded-lg shrink-0 overflow-hidden">
                  {item.image_url
                    ? <img src={item.image_url} alt={item.product_name} className="w-full h-full object-contain p-1" />
                    : <div className="w-full h-full bg-gray-100 rounded-lg" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm font-medium text-ink line-clamp-2 leading-tight">
                    {item.product_name}
                  </p>
                  <p className="text-[11px] md:text-xs text-muted mt-0.5">
                    {item.variant_label} · Qty {item.quantity}
                  </p>
                  <p className="text-xs md:text-sm font-bold text-ink mt-0.5">
                    {formatINR(item.price * item.quantity)}
                  </p>
                  {gstRate > 0 && (
                    <p className="text-[10px] text-muted mt-0.5">
                      Taxable: {formatINR(parseFloat(itemBase.toFixed(2)))} + GST {gstRate}%: {formatINR(parseFloat(itemGst.toFixed(2)))}
                    </p>
                  )}
                  {(item as any).hsn_code && (
                    <p className="text-[10px] text-muted">HSN: {(item as any).hsn_code}</p>
                  )}
                </div>
                {order.status === 'delivered' && item.product_id && (
                  <button
                    onClick={() => setReviewItem({ product_id: item.product_id as unknown as number, name: item.product_name })}
                    className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0 py-1 px-2 rounded-lg hover:bg-primary/5 transition-colors"
                  >
                    <StarIcon size={12} /> Rate
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── iThinkLogistics Tracking ─────────────────────────────────────────── */}
      {(order.itl_awb_number || trackingLoading) && (
        <div className="bg-white rounded-xl shadow-card p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TruckIcon size={15} className="text-primary" />
              <h3 className="font-semibold text-xs md:text-sm text-ink">Shipment Tracking</h3>
            </div>
            {order.itl_tracking_url && (
              <a
                href={order.itl_tracking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                Track on ITL <ExternalLinkIcon size={11} />
              </a>
            )}
          </div>

          {trackingLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted py-2">
              <Loader2Icon size={14} className="animate-spin" /> Loading tracking…
            </div>
          ) : (
            <>
              {/* AWB + Logistics */}
              <div className="flex flex-wrap gap-3 text-xs mb-3">
                <div>
                  <span className="text-muted">AWB: </span>
                  <span className="font-mono font-semibold text-ink">{order.itl_awb_number}</span>
                </div>
                {order.itl_logistic_name && (
                  <div>
                    <span className="text-muted">Carrier: </span>
                    <span className="font-semibold text-ink capitalize">{order.itl_logistic_name}</span>
                  </div>
                )}
              </div>

              {/* Current Status */}
              {trackingInfo?.itl_current_status && (
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 mb-3">
                  <PackageCheckIcon size={14} className={itlStatusColor(trackingInfo.itl_current_status_code)} />
                  <div>
                    <p className={`text-xs font-semibold ${itlStatusColor(trackingInfo.itl_current_status_code)}`}>
                      {trackingInfo.itl_current_status}
                    </p>
                    {trackingInfo.itl_expected_delivery_date && (
                      <p className="text-[10px] text-muted">
                        Expected delivery:{' '}
                        {new Date(trackingInfo.itl_expected_delivery_date).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Scan timeline toggle */}
              {trackingInfo?.scan_details && trackingInfo.scan_details.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowScans((v) => !v)}
                    className="text-xs text-primary hover:underline mb-2"
                  >
                    {showScans ? 'Hide' : 'Show'} tracking history ({trackingInfo.scan_details.length} events)
                  </button>
                  {showScans && (
                    <div className="mt-2 border-l-2 border-gray-100 pl-2">
                      {[...trackingInfo.scan_details].reverse().map((scan, i) => (
                        <ScanRow key={i} scan={scan} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {/* ─────────────────────────────────────────────────────────────────────── */}

      {/* Address + Payment */}
      <div className="bg-white rounded-xl shadow-card p-4 md:p-5 grid sm:grid-cols-2 gap-4 md:gap-5">
        <div>
          <div className="flex items-center gap-1.5 text-muted text-[11px] md:text-xs mb-1.5">
            <MapPinIcon size={12} /> Delivery Address
          </div>
          <p className="font-medium text-xs md:text-sm text-ink">{order.address?.name}</p>
          <p className="text-[11px] md:text-xs text-muted leading-relaxed">{order.address?.phone}</p>
          <p className="text-[11px] md:text-xs text-muted leading-relaxed">
            {order.address?.house_no}, {order.address?.area}, {order.address?.village},{' '}
            {order.address?.district}, {order.address?.state} — {order.address?.pincode}
          </p>
          {order.address?.gstin && (
            <p className="text-[11px] md:text-xs text-muted mt-0.5">GSTIN: {order.address.gstin}</p>
          )}
        </div>
        <div className="border-t sm:border-t-0 sm:border-l border-gray-100 pt-3 sm:pt-0 sm:pl-4 md:sm:pl-5">
          <div className="flex items-center gap-1.5 text-muted text-[11px] md:text-xs mb-1.5">
            <CreditCardIcon size={12} /> Payment
          </div>
          <p className="font-medium text-xs md:text-sm text-ink capitalize">
            {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Online Payment'}
          </p>
          <p className="text-[11px] md:text-xs text-muted capitalize">
            Status: {order.payment_status}
          </p>
        </div>
      </div>

      {/* Price breakdown */}
      <div className="bg-white rounded-xl shadow-card p-4 md:p-5">
        <h3 className="font-semibold text-xs md:text-sm text-ink mb-3">Price Breakdown</h3>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-muted text-xs md:text-sm">
            <span>Subtotal</span><span>{formatINR(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted text-xs md:text-sm">
            <span>Shipping</span>
            <span className={order.shipping_fee === 0 ? 'text-success font-medium' : ''}>
              {order.shipping_fee === 0 ? 'FREE' : formatINR(order.shipping_fee)}
            </span>
          </div>

          {totalGst > 0 && (
            <div className="mt-2 bg-gray-50 rounded-lg p-2.5 space-y-1 border border-gray-100 text-[11px] md:text-xs">
              <p className="font-semibold text-ink">Tax Breakdown</p>
              <div className="flex justify-between text-muted">
                <span>Taxable amount (ex-GST)</span>
                <span>{formatINR(parseFloat(taxableAmount.toFixed(2)))}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>CGST</span>
                <span>{formatINR(parseFloat(totalCgst.toFixed(2)))}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>SGST</span>
                <span>{formatINR(parseFloat(totalSgst.toFixed(2)))}</span>
              </div>
              <div className="flex justify-between font-semibold text-ink border-t border-gray-200 pt-1">
                <span>Total GST</span>
                <span>{formatINR(parseFloat(totalGst.toFixed(2)))}</span>
              </div>
            </div>
          )}

          <div className="flex justify-between font-bold text-ink border-t border-gray-100 pt-2 text-sm md:text-base">
            <span>Total</span><span>{formatINR(order.total)}</span>
          </div>
        </div>

        {isDelivered && (
          <button
            onClick={() => generateInvoicePdf(order as any)}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-primary text-primary font-semibold text-xs md:text-sm hover:bg-primary/5 transition-colors"
          >
            <DownloadIcon size={14} /> Download GST Invoice (PDF)
          </button>
        )}
      </div>

      {/* Return status info */}
      {(order.status === 'return_requested' || order.status === 'returned') && order.return_reason && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 md:p-4">
          <p className="text-xs md:text-sm font-semibold text-orange-700 mb-1">
            {order.status === 'returned' ? '✓ Return Approved' : 'Return Request Pending Review'}
          </p>
          <p className="text-[11px] md:text-xs text-orange-600">{order.return_reason}</p>
        </div>
      )}

      {canReturn && (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowReturnModal(true)}
            className="flex items-center gap-1.5"
          >
            <RotateCcwIcon size={14} /> Request Return
          </Button>
        </div>
      )}

      {/* Return Modal */}
      <Modal isOpen={showReturnModal} onClose={() => setShowReturnModal(false)} title="Request Return">
        <div className="space-y-3">
          <p className="text-xs md:text-sm text-muted">
            Select reason for return (within 7 days of delivery)
          </p>
          <select
            className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
          >
            <option value="">Select a reason...</option>
            <option value="Defective product">Defective product</option>
            <option value="Wrong item delivered">Wrong item delivered</option>
            <option value="Product not as described">Product not as described</option>
            <option value="Changed my mind">Changed my mind</option>
            <option value="Other">Other</option>
          </select>
          <textarea
            className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            rows={3}
            placeholder="Additional details..."
            value={returnDesc}
            onChange={(e) => setReturnDesc(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowReturnModal(false)}>
              Back
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleReturn}
              disabled={actionLoading || !returnReason}
            >
              {actionLoading
                ? <Loader2Icon size={14} className="animate-spin" />
                : 'Submit Return'
              }
            </Button>
          </div>
        </div>
      </Modal>

      {reviewItem && (
        <ReviewModal
          isOpen={!!reviewItem}
          onClose={() => setReviewItem(null)}
          orderId={order.id}
          productId={reviewItem.product_id}
          productName={reviewItem.name}
        />
      )}
    </div>
  );
}