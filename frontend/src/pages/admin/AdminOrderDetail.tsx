import React, { useState, useEffect, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeftIcon, CheckIcon, ShoppingBagIcon, PackageIcon,
  TruckIcon, HomeIcon, MapPinIcon, CreditCardIcon, Loader2Icon,
  RefreshCwIcon, ExternalLinkIcon, PackageCheckIcon, PrinterIcon,
  FileTextIcon, TagIcon,
} from 'lucide-react';
import { useAdminOrdersStore, AdminOrderStatus } from '../../store/adminOrdersStore';
import { useToastStore } from '../../store/toastStore';
import { formatINR } from '../../utils/formatPrice';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Input, Select } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { getImageUrl } from '../../utils/getImageUrl';
import {
  adminGetRates, adminCreateShipment, adminGetLabel,
  adminSyncTracking, adminCancelShipment,
  CarrierRate, CreateShipmentPayload,
} from '../../utils/shippingApi';

/* ─────────────────────────────── constants ─────────────────────────────── */

const timelineSteps: { key: AdminOrderStatus; label: string; icon: typeof PackageIcon }[] = [
  { key: 'placed',     label: 'Placed',     icon: ShoppingBagIcon },
  { key: 'processing', label: 'Processing', icon: PackageIcon },
  { key: 'shipped',    label: 'Shipped',    icon: TruckIcon },
  { key: 'delivered',  label: 'Delivered',  icon: HomeIcon },
];

const statusIndex = (s: AdminOrderStatus): number => {
  const map: Record<AdminOrderStatus, number> = {
    placed: 0, processing: 1, shipped: 2, delivered: 3,
    cancelled: -1, return_requested: -1, returned: -1,
  };
  return map[s] ?? -1;
};

function getAllowedStatuses(order: {
  status: AdminOrderStatus;
  payment_method: string;
  payment_status: string;
}): AdminOrderStatus[] {
  const FLOW: AdminOrderStatus[] = ['placed', 'processing', 'shipped', 'delivered'];
  const current = order.status;
  if (current === 'cancelled' || current === 'returned') return [];
  if (current === 'return_requested') return ['returned', 'delivered'];
  const isOnline = order.payment_method === 'online';
  if (isOnline && (order.payment_status === 'pending' || order.payment_status === 'failed')) {
    return Array.from(new Set([current, 'cancelled'])) as AdminOrderStatus[];
  }
  const idx = FLOW.indexOf(current);
  if (idx === -1) return [];
  const next = FLOW[idx + 1];
  const allowed: AdminOrderStatus[] = [current];
  if (next) allowed.push(next);
  if (current === 'placed' || current === 'processing') allowed.push('cancelled');
  return Array.from(new Set(allowed)) as AdminOrderStatus[];
}

function itlStatusColor(code?: string): string {
  if (!code) return 'text-gray-400';
  if (code === 'DL') return 'text-emerald-400';
  if (code === 'CN') return 'text-red-400';
  if (code === 'RT') return 'text-orange-400';
  return 'text-blue-400';
}

/* ─────────────────────────────── sub-components ────────────────────────── */

/** Reusable section-card wrapper */
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`
      relative bg-adminSurf border border-adminBorder rounded-2xl overflow-hidden
      shadow-[0_4px_24px_rgba(0,0,0,0.3)] transition-all duration-200
      ${className}
    `}>
      {children}
    </div>
  );
}

/** Card header with accent left-border */
function CardHeader({
  icon: Icon,
  title,
  action,
  accent = false,
}: {
  icon?: typeof PackageIcon;
  title: string;
  action?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between px-5 py-4 border-b border-adminBorder/60 ${accent ? 'bg-gradient-to-r from-primary/5 to-transparent' : ''}`}>
      <div className="flex items-center gap-2.5">
        {Icon && <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon size={14} className="text-primary" />
        </div>}
        <h3 className="font-semibold text-[15px] text-white tracking-tight">{title}</h3>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

/** Small data row for info grids */
function DataRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 gap-3">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className={`text-xs font-medium text-gray-200 text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

/** Compact dimension input */
function DimInput({
  label, value, onChange, unit = 'cm',
}: {
  label: string; value: string; onChange: (v: string) => void; unit?: string;
}) {
  return (
    <div className="flex-1 min-w-0">
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">{label}</label>
      <div className="relative">
        <input
          type="number"
          min="0.1"
          step="0.1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="
            w-full bg-adminBg/80 border border-adminBorder rounded-xl
            pl-3 pr-8 py-2 text-sm text-white font-mono
            outline-none transition-all duration-150
            focus:border-primary focus:ring-1 focus:ring-primary/30
            placeholder-gray-600
          "
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 pointer-events-none">{unit}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────── main component ────────────────────────── */

export function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrder, detailLoading, fetchOrder, updateStatus, updateTracking } = useAdminOrdersStore();
  const showToast = useToastStore((s) => s.showToast);

  const [newStatus, setNewStatus]           = useState<AdminOrderStatus>('processing');
  const [tracking, setTracking]             = useState('');
  const [savingStatus, setSavingStatus]     = useState(false);
  const [savingTracking, setSavingTracking] = useState(false);
  const [processingReturn, setProcessingReturn] = useState(false);
  const [returnNote, setReturnNote]         = useState('');

  /* ITL state */
  const [weightKg, setWeightKg]   = useState('0.5');
  const [length, setLength]       = useState('10');
  const [width, setWidth]         = useState('10');
  const [height, setHeight]       = useState('5');
  const [ewayBill, setEwayBill]   = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState('');

  /* Rate state */
  const [carriers, setCarriers]         = useState<CarrierRate[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesFetched, setRatesFetched] = useState(false);

  /* ITL loading */
  const [itlCreating, setItlCreating]   = useState(false);
  const [itlSyncing, setItlSyncing]     = useState(false);
  const [itlCancelling, setItlCancelling] = useState(false);
  const [labelLoading, setLabelLoading] = useState(false);

  useEffect(() => { if (id) fetchOrder(Number(id)); }, [id]);

  useEffect(() => {
    if (currentOrder) {
      setNewStatus(currentOrder.status);
      setTracking(currentOrder.tracking_number ?? '');
    }
  }, [currentOrder]);

  /* ── loading skeleton ── */
  if (detailLoading || !currentOrder) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Loader2Icon size={22} className="animate-spin text-primary" />
        </div>
        <p className="text-sm text-gray-500 animate-pulse">Loading order details…</p>
      </div>
    );
  }

  /* ── derived values ── */
  const order   = currentOrder;
  const orderId = Number(order.id);
  const sIdx    = statusIndex(order.status);
  const isClosed = order.status === 'cancelled' || order.status === 'returned' || order.status === 'return_requested';

  const totalGst      = (order as any).total_gst      ?? 0;
  const totalCgst     = (order as any).total_cgst     ?? totalGst / 2;
  const totalSgst     = (order as any).total_sgst     ?? totalGst / 2;
  const taxableAmount = (order as any).taxable_amount ?? (order.subtotal - totalGst);

  const itlAwb         = (order as any).itl_awb_number          as string | undefined;
  const itlStatus      = (order as any).itl_current_status      as string | undefined;
  const itlStatusCode  = (order as any).itl_current_status_code as string | undefined;
  const itlLogistic    = (order as any).itl_logistic_name       as string | undefined;
  const itlTrackingUrl = (order as any).itl_tracking_url        as string | undefined;
  const itlEdd         = (order as any).itl_expected_delivery_date as string | null | undefined;
  const orderTotal     = Number(order.total ?? 0);
  const needsEwayBill  = orderTotal > 50000;

  /* ── handlers ── */
  const handleFetchRates = async () => {
    setRatesLoading(true); setRatesFetched(false);
    try {
      const res = await adminGetRates(orderId, parseFloat(weightKg)||0.5, parseFloat(length)||10, parseFloat(width)||10, parseFloat(height)||5);
      setCarriers(res.carriers); setRatesFetched(true);
      if (res.carriers.length > 0) setSelectedCarrier('');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to fetch rates', 'error');
    } finally { setRatesLoading(false); }
  };

  const handleCreateShipment = async () => {
    if (needsEwayBill && !ewayBill.trim()) {
      showToast('E-waybill number is required for orders above ₹50,000', 'error'); return;
    }
    setItlCreating(true);
    try {
      const payload: CreateShipmentPayload = {
        weight_kg: parseFloat(weightKg)||0.5, length: parseFloat(length)||10,
        width: parseFloat(width)||10, height: parseFloat(height)||5,
        logistics: selectedCarrier, eway_bill_number: ewayBill.trim(),
      };
      const res = await adminCreateShipment(orderId, payload);
      showToast(`Shipment created! AWB: ${res.itl_awb_number}`, 'success');
      fetchOrder(orderId);
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to create shipment', 'error');
    } finally { setItlCreating(false); }
  };

  const handlePrintLabel = async () => {
    setLabelLoading(true);
    try {
      const res = await adminGetLabel(orderId);
      window.open(res.label_url, '_blank');
      showToast('Label opened — print and stick on box', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to get label', 'error');
    } finally { setLabelLoading(false); }
  };

  const handleSyncTracking = async () => {
    setItlSyncing(true);
    try {
      const res = await adminSyncTracking(orderId);
      showToast(`Synced: ${res.current_status}`, 'success');
      fetchOrder(orderId);
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to sync tracking', 'error');
    } finally { setItlSyncing(false); }
  };

  const handleCancelShipment = async () => {
    if (!confirm('Cancel this shipment on iThinkLogistics?')) return;
    setItlCancelling(true);
    try {
      await adminCancelShipment(orderId);
      showToast('Shipment cancellation requested', 'success');
      fetchOrder(orderId);
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to cancel shipment', 'error');
    } finally { setItlCancelling(false); }
  };

  const handleUpdateStatus = async () => {
    setSavingStatus(true);
    const result = await updateStatus(order.id, newStatus);
    setSavingStatus(false);
    if (result === true) showToast('Status updated', 'success');
    else showToast(typeof result === 'string' ? result : 'Failed to update status', 'error');
  };

  const handleSaveTracking = async () => {
    setSavingTracking(true);
    const ok = await updateTracking(order.id, tracking);
    setSavingTracking(false);
    if (ok) showToast('Tracking saved', 'success');
    else showToast('Failed to save tracking', 'error');
  };

  /* ────────────────────────────── render ─────────────────────────────── */
  return (
    <div className="space-y-5 pb-10">

      {/* ── Topbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          onClick={() => navigate('/admin/orders')}
          className="group inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors w-fit"
        >
          <span className="w-7 h-7 rounded-lg bg-adminSurf border border-adminBorder flex items-center justify-center group-hover:border-primary/40 transition-all">
            <ChevronLeftIcon size={14} />
          </span>
          Back to Orders
        </button>

        {/* Order identity */}
        <div className="flex items-start sm:items-end flex-col sm:text-right gap-1">
          <div className="flex items-center gap-2.5">
            <span className="font-mono font-bold text-xl text-white tracking-tight">{order.order_number}</span>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-xs text-gray-500">
            Placed {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* ── Stat pills (mobile-friendly quick summary) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: 'Order Total',  value: formatINR(order.total),          color: 'text-emerald-400' },
          { label: 'Items',        value: `${order.items.length} item${order.items.length !== 1 ? 's' : ''}`, color: 'text-white' },
          { label: 'Payment',      value: order.payment_method === 'cod' ? 'COD' : 'Online', color: 'text-blue-400' },
          { label: 'Pay Status',   value: order.payment_status, color: order.payment_status === 'paid' ? 'text-emerald-400' : 'text-amber-400' },
        ].map((s) => (
          <div key={s.label} className="bg-adminSurf border border-adminBorder rounded-xl px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">{s.label}</p>
            <p className={`text-sm font-bold capitalize ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid lg:grid-cols-[1fr_380px] gap-5 items-start">

        {/* ════════════ LEFT COLUMN ════════════ */}
        <div className="space-y-5 min-w-0">

          {/* ── Timeline ── */}
          {!isClosed && (
            <Card>
              <CardHeader icon={TruckIcon} title="Order Timeline" accent />
              <div className="px-5 py-5">
                {/* Scrollable on very small screens */}
                <div className="overflow-x-auto -mx-1 px-1">
                  <div className="flex items-center min-w-[340px]">
                    {timelineSteps.map((step, i) => {
                      const Icon     = step.icon;
                      const isDone   = sIdx >= i;
                      const isCurrent = sIdx === i;
                      return (
                        <Fragment key={step.key}>
                          <div className="flex flex-col items-center shrink-0">
                            <div className={`
                              relative w-11 h-11 rounded-full flex items-center justify-center
                              transition-all duration-300
                              ${isDone
                                ? 'bg-primary shadow-[0_0_14px_rgba(99,102,241,0.35)] text-white'
                                : 'bg-adminBg border-2 border-adminBorder text-gray-600'}
                              ${isCurrent ? 'ring-2 ring-primary/30 ring-offset-1 ring-offset-adminSurf' : ''}
                            `}>
                              {isDone ? <CheckIcon size={16} strokeWidth={2.5} /> : <Icon size={14} />}
                              {isCurrent && (
                                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full border-2 border-adminSurf animate-pulse" />
                              )}
                            </div>
                            <span className={`text-[11px] mt-2 font-semibold tracking-wide ${isDone ? 'text-white' : 'text-gray-600'}`}>
                              {step.label}
                            </span>
                          </div>
                          {i < timelineSteps.length - 1 && (
                            <div className="flex-1 mx-1.5 h-px relative overflow-hidden">
                              <div className="absolute inset-0 bg-adminBorder" />
                              {sIdx > i && (
                                <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/60" />
                              )}
                            </div>
                          )}
                        </Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* ── Order Items ── */}
          <Card>
            <CardHeader icon={PackageIcon} title="Order Items" />
            <div className="p-4 space-y-2.5">
              {order.items.map((item, idx) => {
                const gstRate  = (item as any).gst_rate ?? 0;
                const itemGst  = (item as any).gst_subtotal ?? 0;
                const itemBase = (item as any).taxable_subtotal ?? (item.price * item.quantity - itemGst);
                const hsn      = (item as any).hsn_code;
                return (
                  <div key={idx} className="
                    group flex gap-3.5 items-start
                    bg-adminBg/60 hover:bg-adminBg/90
                    border border-adminBorder/60 hover:border-adminBorder
                    rounded-xl p-3.5 transition-all duration-150
                  ">
                    {/* Product image */}
                    <div className="w-[52px] h-[52px] shrink-0 rounded-lg bg-white border border-gray-200/10 overflow-hidden">
                      {item.image_url
                        ? <img src={getImageUrl(item.image_url)} alt={item.product_name} className="w-full h-full object-contain p-1" />
                        : <div className="w-full h-full bg-adminBorder/40 flex items-center justify-center"><PackageIcon size={18} className="text-gray-600" /></div>
                      }
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{item.product_name}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-[11px] text-gray-400 bg-adminBorder/50 px-2 py-0.5 rounded-full">{item.variant_label}</span>
                          <span className="text-[11px] text-gray-400">×{item.quantity}</span>
                          {hsn && <span className="text-[10px] text-gray-600 font-mono">HSN {hsn}</span>}
                        </div>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <p className="font-bold text-sm text-white">{formatINR(item.price * item.quantity)}</p>
                        {gstRate > 0 && (
                          <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                            ₹{parseFloat(itemBase.toFixed(2)).toLocaleString('en-IN')} + {gstRate}% GST
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Price summary */}
            <div className="border-t border-adminBorder mx-4 mb-4 pt-3 space-y-1">
              <DataRow label="Subtotal" value={formatINR(order.subtotal)} />
              <DataRow label="Shipping" value={order.shipping_fee === 0 ? <span className="text-emerald-400 font-semibold">FREE</span> : formatINR(order.shipping_fee)} />

              {totalGst > 0 && (
                <div className="mt-2 mb-2 bg-adminBg/70 rounded-xl border border-adminBorder p-3 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 pb-1">Tax Breakdown (GST)</p>
                  <DataRow label="Taxable (ex-GST)" value={formatINR(parseFloat(taxableAmount.toFixed(2)))} />
                  <DataRow label="CGST" value={formatINR(parseFloat(totalCgst.toFixed(2)))} />
                  <DataRow label="SGST" value={formatINR(parseFloat(totalSgst.toFixed(2)))} />
                  <div className="border-t border-adminBorder pt-1.5 mt-1">
                    <DataRow
                      label="Total GST"
                      value={<span className="text-white font-bold">{formatINR(parseFloat(totalGst.toFixed(2)))}</span>}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-adminBorder">
                <span className="text-sm font-bold text-gray-300">Order Total</span>
                <span className="text-lg font-bold text-white">{formatINR(order.total)}</span>
              </div>
            </div>
          </Card>

          {/* ── Address & Payment ── */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Delivery Address */}
            <Card>
              <CardHeader icon={MapPinIcon} title="Delivery Address" />
              <div className="p-4">
                <p className="font-bold text-sm text-white mb-2">{order.address.name}</p>
                <p className="text-xs text-gray-400 leading-[1.8]">
                  {order.address.house_no}, {order.address.area},<br />
                  {order.address.village}, {order.address.taluka},<br />
                  <span className="text-gray-300">{order.address.district} — {order.address.pincode}</span>
                </p>
                <div className="mt-3 pt-3 border-t border-adminBorder/60 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="text-sm">📞</span>
                    <span className="font-mono">{order.address.phone}</span>
                  </div>
                  {order.address.gstin && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <FileTextIcon size={11} />
                      <span className="font-mono text-[11px]">GSTIN: {order.address.gstin}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Payment */}
            <Card>
              <CardHeader icon={CreditCardIcon} title="Payment" />
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0
                    ${order.payment_method === 'cod' ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-blue-500/10 border border-blue-500/20'}
                  `}>
                    {order.payment_method === 'cod' ? '💵' : '💳'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Online Payment'}
                    </p>
                    <span className={`
                      inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border
                      ${order.payment_status === 'paid'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}
                    `}>
                      {order.payment_status}
                    </span>
                  </div>
                </div>
                {order.cashfree_order_id && (
                  <div className="bg-adminBg/60 rounded-lg px-3 py-2 border border-adminBorder/60">
                    <p className="text-[10px] text-gray-600 mb-0.5 uppercase tracking-wider">Cashfree Order ID</p>
                    <p className="text-xs text-gray-400 font-mono break-all">{order.cashfree_order_id}</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

        </div>{/* end LEFT column */}

        {/* ════════════ RIGHT COLUMN ════════════ */}
        <div className="space-y-4 lg:sticky lg:top-4">

          {/* ── iThinkLogistics Panel ── */}
          <Card>
            <CardHeader
              icon={TruckIcon}
              title="iThinkLogistics"
              accent
              action={
                itlAwb && itlTrackingUrl ? (
                  <a
                    href={itlTrackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/15 px-2.5 py-1 rounded-lg transition-all"
                  >
                    Track <ExternalLinkIcon size={10} />
                  </a>
                ) : null
              }
            />

            <div className="p-4">
              {itlAwb ? (
                /* ── AWB created — status view ── */
                <div className="space-y-3">
                  <div className="bg-adminBg/70 border border-adminBorder rounded-xl p-3.5 space-y-0.5">
                    <DataRow label="AWB Number" mono value={<span className="text-primary font-bold tracking-wide">{itlAwb}</span>} />
                    {itlLogistic && <DataRow label="Carrier" value={<span className="capitalize">{itlLogistic}</span>} />}
                    {itlStatus && (
                      <DataRow label="Status" value={
                        <span className={`font-bold ${itlStatusColor(itlStatusCode)}`}>{itlStatus}</span>
                      } />
                    )}
                    {itlEdd && (
                      <DataRow label="Est. Delivery" value={
                        new Date(itlEdd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      } />
                    )}
                  </div>

                  <Button variant="primary" fullWidth onClick={handlePrintLabel} disabled={labelLoading}>
                    {labelLoading
                      ? <><Loader2Icon size={13} className="animate-spin mr-1.5" />Getting label…</>
                      : <><PrinterIcon size={13} className="mr-1.5" />Print Shipping Label</>}
                  </Button>

                  <Button variant="dark" fullWidth onClick={handleSyncTracking} disabled={itlSyncing}>
                    {itlSyncing
                      ? <><Loader2Icon size={13} className="animate-spin mr-1.5" />Syncing…</>
                      : <><RefreshCwIcon size={12} className="mr-1.5" />Sync Tracking</>}
                  </Button>

                  {order.status !== 'delivered' && order.status !== 'cancelled' && (
                    <button
                      onClick={handleCancelShipment}
                      disabled={itlCancelling}
                      className="
                        w-full text-sm font-medium py-2.5 px-4 rounded-xl
                        border border-red-500/30 text-red-400
                        hover:bg-red-500/10 hover:border-red-500/50
                        disabled:opacity-40 disabled:cursor-not-allowed
                        transition-all duration-150
                      "
                    >
                      {itlCancelling ? 'Cancelling…' : 'Cancel Shipment on ITL'}
                    </button>
                  )}
                </div>
              ) : (
                /* ── No AWB — creation form ── */
                order.status !== 'cancelled' && order.status !== 'delivered' && (
                  <div className="space-y-4">
                    {/* E-waybill warning */}
                    {needsEwayBill && (
                      <div className="flex gap-2.5 items-start bg-amber-500/8 border border-amber-500/30 rounded-xl p-3">
                        <span className="text-amber-400 text-base mt-0.5 shrink-0">⚠️</span>
                        <div>
                          <p className="text-xs font-semibold text-amber-300 mb-0.5">E-waybill Required</p>
                          <p className="text-[11px] text-amber-300/70 leading-relaxed">
                            Order exceeds ₹50,000 — generate at ewaybillgst.gov.in
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Package dimensions */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2.5">
                        Package Dimensions
                      </p>
                      <div className="grid grid-cols-2 gap-2.5">
                        <DimInput label="Weight" value={weightKg} onChange={setWeightKg} unit="kg" />
                        <DimInput label="Length" value={length}   onChange={setLength}   unit="cm" />
                        <DimInput label="Width"  value={width}    onChange={setWidth}    unit="cm" />
                        <DimInput label="Height" value={height}   onChange={setHeight}   unit="cm" />
                      </div>
                      <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
                        Guide: Mobile ~0.3 kg · Tablet ~0.7 kg · Laptop ~2 kg
                      </p>
                    </div>

                    {/* E-waybill field */}
                    {needsEwayBill && (
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">
                          E-waybill Number *
                        </label>
                        <input
                          type="text"
                          value={ewayBill}
                          onChange={(e) => setEwayBill(e.target.value)}
                          placeholder="12-digit e-waybill number"
                          className="
                            w-full bg-adminBg/80 border border-amber-500/40 rounded-xl
                            px-3 py-2 text-sm text-white font-mono
                            outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-500/20
                            placeholder-gray-600 transition-all
                          "
                        />
                      </div>
                    )}

                    {/* Check rates */}
                    <Button variant="dark" fullWidth onClick={handleFetchRates} disabled={ratesLoading}>
                      {ratesLoading
                        ? <><Loader2Icon size={12} className="animate-spin mr-1.5" />Checking rates…</>
                        : <><TagIcon size={12} className="mr-1.5" />Check Carrier Rates</>}
                    </Button>

                    {/* Carrier selection */}
                    {ratesFetched && carriers.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                          Select Carrier
                        </p>

                        {/* Auto-assign */}
                        <button
                          onClick={() => setSelectedCarrier('')}
                          className={`
                            w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs transition-all duration-150
                            ${selectedCarrier === ''
                              ? 'border-primary bg-primary/10 ring-1 ring-primary/20'
                              : 'border-adminBorder hover:border-adminBorder/80 bg-adminBg/40'}
                          `}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center
                              ${selectedCarrier === '' ? 'border-primary' : 'border-gray-600'}`}>
                              {selectedCarrier === '' && <div className="w-1.5 h-1.5 bg-primary rounded-full" />}
                            </div>
                            <span className="font-semibold text-white">Auto-assign</span>
                          </div>
                          <span className="text-[10px] text-gray-500 bg-adminBg px-2 py-0.5 rounded-full border border-adminBorder">Recommended</span>
                        </button>

                        {carriers.map((c) => {
                          const isSelected = selectedCarrier === c.logistic_name.toLowerCase();
                          return (
                            <button
                              key={c.logistic_name}
                              onClick={() => setSelectedCarrier(c.logistic_name.toLowerCase())}
                              className={`
                                w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs transition-all duration-150
                                ${isSelected
                                  ? 'border-primary bg-primary/10 ring-1 ring-primary/20'
                                  : 'border-adminBorder hover:border-adminBorder/80 bg-adminBg/40'}
                              `}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0
                                  ${isSelected ? 'border-primary' : 'border-gray-600'}`}>
                                  {isSelected && <div className="w-1.5 h-1.5 bg-primary rounded-full" />}
                                </div>
                                <div className="text-left">
                                  <span className="font-bold capitalize text-white">{c.logistic_name}</span>
                                  <span className="ml-1.5 text-gray-500">{c.delivery_tat}d</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-emerald-400">₹{c.rate.toFixed(0)}</span>
                                <div className="flex gap-1 mt-0.5 justify-end">
                                  {c.cod === 'Y'     && <span className="bg-blue-500/15 text-blue-300 px-1.5 py-0.5 rounded text-[9px] font-semibold">COD</span>}
                                  {c.prepaid === 'Y' && <span className="bg-emerald-500/15 text-emerald-300 px-1.5 py-0.5 rounded text-[9px] font-semibold">Prepaid</span>}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {ratesFetched && carriers.length === 0 && (
                      <div className="flex items-start gap-2.5 bg-red-500/8 border border-red-500/25 rounded-xl p-3">
                        <span className="text-red-400 mt-0.5 shrink-0">✕</span>
                        <p className="text-xs text-red-400">No carriers available for this pincode / weight combination.</p>
                      </div>
                    )}

                    {/* Create shipment */}
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={handleCreateShipment}
                      disabled={itlCreating || (needsEwayBill && !ewayBill.trim())}
                    >
                      {itlCreating
                        ? <><Loader2Icon size={13} className="animate-spin mr-1.5" />Creating…</>
                        : <><PackageCheckIcon size={13} className="mr-1.5" />Create Shipment</>}
                    </Button>
                  </div>
                )
              )}
            </div>
          </Card>

          {/* ── Update Status ── */}
          <Card>
            <CardHeader icon={RefreshCwIcon} title="Update Status" />
            <div className="p-4 space-y-3">
              {order.status === 'cancelled' ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 bg-adminBg/60 rounded-xl px-3 py-3 border border-adminBorder/50">
                  <span className="text-red-400/60">✕</span>
                  Order is cancelled — no further updates allowed.
                </div>
              ) : (
                <Select dark value={newStatus} onChange={(e) => setNewStatus(e.target.value as AdminOrderStatus)}>
                  {getAllowedStatuses(order).map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
                    </option>
                  ))}
                </Select>
              )}
              {order.status !== 'cancelled' && (
                <Button variant="primary" fullWidth onClick={handleUpdateStatus} disabled={savingStatus}>
                  {savingStatus ? 'Saving…' : 'Update Status'}
                </Button>
              )}
            </div>
          </Card>

          {/* ── Manual Tracking Override ── */}
          <Card>
            <CardHeader icon={TagIcon} title="Manual Tracking" />
            <div className="p-4 space-y-3">
              <p className="text-[11px] text-gray-500 -mt-1">ITL sync is preferred — use this only as override.</p>
              <Input dark placeholder="Tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} />
              <Button variant="primary" fullWidth onClick={handleSaveTracking} disabled={savingTracking}>
                {savingTracking ? 'Saving…' : 'Save Tracking Number'}
              </Button>
            </div>
          </Card>

          {/* ── Return Request Panel ── */}
          {order.status === 'return_requested' && (
            <Card className="border-orange-500/30">
              {/* Gradient accent stripe */}
              <div className="h-0.5 bg-gradient-to-r from-orange-500/60 via-amber-500/40 to-transparent" />

              <div className="px-5 py-4 border-b border-orange-500/15 flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse shadow-[0_0_8px_rgba(251,146,60,0.6)]" />
                <h3 className="font-semibold text-[15px] text-orange-300 tracking-tight">Return Requested</h3>
              </div>

              <div className="p-4 space-y-3.5">
                <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-orange-400/60 mb-1.5">Customer Reason</p>
                  <p className="text-sm text-gray-200 leading-relaxed">
                    "{order.return_reason || 'No reason provided'}"
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">
                    Internal Note <span className="normal-case font-normal text-gray-600">(optional)</span>
                  </label>
                  <textarea
                    value={returnNote}
                    onChange={(e) => setReturnNote(e.target.value)}
                    placeholder="e.g. Item inspected, approved for refund…"
                    rows={2}
                    className="
                      w-full bg-adminBg/80 border border-adminBorder rounded-xl
                      px-3 py-2.5 text-sm text-white placeholder-gray-600
                      outline-none focus:border-primary focus:ring-1 focus:ring-primary/20
                      resize-none transition-all
                    "
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    disabled={processingReturn}
                    onClick={async () => {
                      setProcessingReturn(true);
                      const result = await updateStatus(order.id, 'returned');
                      setProcessingReturn(false);
                      if (result === true) showToast('Return approved', 'success');
                      else showToast(typeof result === 'string' ? result : 'Failed', 'error');
                    }}
                  >
                    {processingReturn ? 'Processing…' : '✓ Approve'}
                  </Button>
                  <Button
                    variant="dark"
                    size="sm"
                    fullWidth
                    disabled={processingReturn}
                    onClick={async () => {
                      setProcessingReturn(true);
                      const result = await updateStatus(order.id, 'delivered');
                      setProcessingReturn(false);
                      if (result === true) showToast('Return rejected', 'info');
                      else showToast(typeof result === 'string' ? result : 'Failed', 'error');
                    }}
                  >
                    ✕ Reject
                  </Button>
                </div>
              </div>
            </Card>
          )}

        </div>{/* end RIGHT column */}
      </div>
    </div>
  );
}