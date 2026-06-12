import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2Icon, ChevronLeftIcon, ChevronRightIcon,
  SearchIcon, CheckSquareIcon, SquareIcon, ChevronDownIcon,
  FileTextIcon,
} from 'lucide-react';
import { useAdminOrdersStore, AdminOrderStatus } from '../../store/adminOrdersStore';
import { adminApi } from '../../utils/adminApi';
import { formatINR } from '../../utils/formatPrice';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useToastStore } from '../../store/toastStore';
import { adminGenerateManifest } from '../../utils/shippingApi';

const TABS: { label: string; value: string }[] = [
  { label: 'All',        value: 'all' },
  { label: 'Placed',     value: 'placed' },
  { label: 'Processing', value: 'processing' },
  { label: 'Shipped',    value: 'shipped' },
  { label: 'Delivered',  value: 'delivered' },
  { label: 'Cancelled',  value: 'cancelled' },
  { label: 'Returns',    value: 'return_requested' },
];

const BULK_STATUSES: AdminOrderStatus[] = ['processing', 'shipped', 'delivered', 'cancelled'];

export function AdminOrders() {
  const { orders, loading, total, page, pages, fetchOrders } = useAdminOrdersStore();
  const showToast = useToastStore((s) => s.showToast);

  const [tab, setTab]                 = useState('all');
  const [search, setSearch]           = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected]       = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus]   = useState<AdminOrderStatus>('processing');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showBulkMenu, setShowBulkMenu]     = useState(false);
  const [manifestLoading, setManifestLoading] = useState(false);

  useEffect(() => {
    setSelected(new Set());
    fetchOrders(1, tab, search);
  }, [tab, search]);

  const handlePageChange = (p: number) => {
    setSelected(new Set());
    fetchOrders(p, tab, search);
  };

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const allSelected = orders.length > 0 && orders.every((o) => selected.has(o.id));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(orders.map((o) => o.id)));
  };

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Bulk status update ────────────────────────────────────────────────────
  const handleBulkUpdate = async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    setShowBulkMenu(false);

    const ids = Array.from(selected);
    const results = await Promise.allSettled(
      ids.map((id) => adminApi.patch(`/admin/orders/${id}/status`, { status: bulkStatus }))
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed    = results.length - succeeded;

    await fetchOrders(page, tab, search);
    setSelected(new Set());
    setBulkLoading(false);

    if (failed === 0) showToast(`${succeeded} order${succeeded !== 1 ? 's' : ''} updated to "${bulkStatus}"`, 'success');
    else showToast(`${succeeded} updated, ${failed} failed (status not allowed)`, 'error');
  };

  // ── Print manifest for selected shipped orders ────────────────────────────
  const handlePrintManifest = async () => {
    if (selected.size === 0) {
      showToast('Select orders to print manifest', 'warning');
      return;
    }

    // Collect AWB numbers from selected orders that have an AWB
    const selectedOrders = orders.filter((o) => selected.has(o.id));
    const awbNumbers = selectedOrders
      .map((o) => (o as any).itl_awb_number as string | undefined)
      .filter(Boolean) as string[];

    if (awbNumbers.length === 0) {
      showToast('No selected orders have AWB numbers — create shipments first', 'error');
      return;
    }

    setManifestLoading(true);
    try {
      const res = await adminGenerateManifest(awbNumbers);
      window.open(res.manifest_url, '_blank');
      showToast(`Manifest opened for ${res.awb_count} shipment${res.awb_count !== 1 ? 's' : ''}`, 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to generate manifest', 'error');
    } finally {
      setManifestLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">Orders</h1>
          <p className="text-sm text-gray-400 mt-1">
            {loading ? 'Loading…' : `${total} total orders`}
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by order number, customer name or phone…"
          className="w-full bg-adminSurf border border-adminBorder rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-primary"
        />
        {searchInput && (
          <button onClick={() => setSearchInput('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs">
            ✕
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar -mb-px">
        {TABS.map((t) => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg whitespace-nowrap transition-colors ${
              tab === t.value
                ? 'bg-adminSurf text-white border border-adminBorder border-b-adminSurf'
                : 'text-gray-400 hover:text-white'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-xl px-4 py-2.5 flex-wrap">
          <span className="text-sm font-semibold text-primary">
            {selected.size} order{selected.size !== 1 ? 's' : ''} selected
          </span>
          <span className="text-gray-600 hidden sm:block">·</span>
          <span className="text-xs text-gray-400">Move to:</span>

          <div className="relative">
            <button onClick={() => setShowBulkMenu((v) => !v)}
              className="flex items-center gap-1.5 bg-adminSurf border border-adminBorder rounded-lg px-3 py-1.5 text-sm text-white font-semibold hover:border-primary transition-colors">
              {bulkStatus.replace('_', ' ')}
              <ChevronDownIcon size={12} />
            </button>
            {showBulkMenu && (
              <div className="absolute top-full mt-1 left-0 z-30 bg-adminSurf border border-adminBorder rounded-xl overflow-hidden shadow-xl min-w-[140px]">
                {BULK_STATUSES.map((s) => (
                  <button key={s} onClick={() => { setBulkStatus(s); setShowBulkMenu(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-white/5 transition-colors ${bulkStatus === s ? 'text-primary' : 'text-white'}`}>
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleBulkUpdate} disabled={bulkLoading}
            className="flex items-center gap-1.5 bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {bulkLoading ? <Loader2Icon size={13} className="animate-spin" /> : null}
            Apply
          </button>

          {/* ── Print Manifest button ── */}
          <button onClick={handlePrintManifest} disabled={manifestLoading}
            className="flex items-center gap-1.5 bg-adminSurf border border-adminBorder text-gray-300 rounded-lg px-4 py-1.5 text-sm font-semibold hover:border-primary hover:text-white disabled:opacity-50 transition-colors">
            {manifestLoading
              ? <Loader2Icon size={13} className="animate-spin" />
              : <FileTextIcon size={13} />
            }
            Print Manifest
          </button>

          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-500 hover:text-white">
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-adminSurf border border-adminBorder rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2Icon size={26} className="animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-adminBg/50">
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                  <th className="pl-4 pr-2 py-3 w-8">
                    <button onClick={toggleAll} className="text-gray-400 hover:text-white">
                      {allSelected
                        ? <CheckSquareIcon size={16} className="text-primary" />
                        : <SquareIcon size={16} />}
                    </button>
                  </th>
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">AWB</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-adminBorder">
                {orders.map((o) => (
                  <tr key={o.id}
                    className={`hover:bg-adminBg/30 transition-colors ${selected.has(o.id) ? 'bg-primary/5' : ''}`}>
                    <td className="pl-4 pr-2 py-3">
                      <button onClick={() => toggleOne(o.id)} className="text-gray-400 hover:text-white">
                        {selected.has(o.id)
                          ? <CheckSquareIcon size={16} className="text-primary" />
                          : <SquareIcon size={16} />}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-primary">{o.order_number}</td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {new Date(o.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-white">{o.address?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{o.item_count}</td>
                    <td className="px-4 py-3 font-semibold text-white">{formatINR(o.total)}</td>
                    <td className="px-4 py-3 text-gray-300 uppercase text-xs font-semibold">{o.payment_method}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3">
                      {(o as any).itl_awb_number
                        ? <span className="font-mono text-xs text-green-400">{(o as any).itl_awb_number}</span>
                        : <span className="text-xs text-gray-600">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/admin/orders/${o.id}`}
                        className="inline-block text-xs px-3 py-1 bg-primary text-white rounded font-semibold hover:bg-primary/90">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-500 text-sm">
                      {search ? `No orders found for "${search}"` : 'No orders in this status.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-adminBorder">
            <p className="text-xs text-gray-400">Page {page} of {pages} · {total} orders</p>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => handlePageChange(page - 1)}
                className="p-1.5 rounded text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeftIcon size={16} />
              </button>
              <button disabled={page >= pages} onClick={() => handlePageChange(page + 1)}
                className="p-1.5 rounded text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRightIcon size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}