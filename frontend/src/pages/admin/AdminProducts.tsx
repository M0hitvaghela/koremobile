import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, SearchIcon, PencilIcon, Trash2Icon, Loader2Icon } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';
import { adminApi, adminProductsApi } from '../../utils/adminApi';
import { formatINR } from '../../utils/formatPrice';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { getImageUrl } from '../../utils/getImageUrl';

interface AdminListVariant {
  id: number;
  color: string;
  storage: string;
  price: number;
  mrp: number;
  stock: number;
  is_active: boolean;
}

interface AdminListProduct {
  id: number;
  name: string;
  slug: string;
  brand: string;
  category: string;
  is_active: boolean;
  allow_cod: boolean;
  allow_online: boolean;
  gst_rate: number;
  hsn_code?: string | null;
  images: string[];
  variants: AdminListVariant[];
}

// ── Inline Stock Edit Modal ───────────────────────────────────────────────────

function StockEditModal({
  product,
  onClose,
  onSaved,
}: {
  product: AdminListProduct;
  onClose: () => void;
  onSaved: (productId: number, variantId: number, newStock: number) => void;
}) {
  const showToast = useToastStore((s) => s.showToast);
  const [stocks, setStocks] = useState<Record<number, string>>(
    Object.fromEntries(product.variants.map((v) => [v.id, String(v.stock)]))
  );
  const [saving, setSaving] = useState<number | null>(null);

  const handleSave = async (variantId: number) => {
    const val = parseInt(stocks[variantId], 10);
    if (isNaN(val) || val < 0) { showToast('Enter a valid stock number', 'error'); return; }
    setSaving(variantId);
    try {
      await adminApi.patch(`/admin/products/variants/${variantId}/stock`, { stock: val });
      onSaved(product.id, variantId, val);
      showToast('Stock updated', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail ?? 'Failed to update stock', 'error');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.75)',
               display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#0f1623', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16, padding: 24, width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ color: '#f9fafb', fontWeight: 700, fontSize: 16, margin: 0 }}>Edit Stock</h3>
            <p style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>{product.name}</p>
          </div>
          <button onClick={onClose} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {product.variants.map((v) => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12,
                                     background: 'rgba(255,255,255,0.04)',
                                     border: '1px solid rgba(255,255,255,0.08)',
                                     borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f9fafb' }}>
                  {[v.color, v.storage].filter(Boolean).join(' · ') || 'Default'}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                  ₹{v.price.toLocaleString('en-IN')}
                </div>
              </div>
              <input
                type="number" min={0}
                value={stocks[v.id]}
                onChange={(e) => setStocks((p) => ({ ...p, [v.id]: e.target.value }))}
                style={{ width: 70, padding: '6px 8px', borderRadius: 8,
                         background: '#0b1120', border: '1px solid rgba(255,255,255,0.15)',
                         color: '#f9fafb', fontSize: 14, fontWeight: 700,
                         textAlign: 'center', outline: 'none' }}
              />
              <button
                onClick={() => handleSave(v.id)}
                disabled={saving === v.id}
                style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                         background: saving === v.id ? 'rgba(40,116,240,0.4)' : '#2874F0',
                         color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {saving === v.id ? '…' : 'Save'}
              </button>
            </div>
          ))}
        </div>

        <button onClick={onClose}
          style={{ width: '100%', marginTop: 16, padding: 10, borderRadius: 10,
                   background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                   color: '#9ca3af', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Done
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Main Component
// ═════════════════════════════════════════════════════════════════════════════

export function AdminProducts() {
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.showToast);

  const [products, setProducts]       = useState<AdminListProduct[]>([]);
  const [loading, setLoading]         = useState(false);
  const [search, setSearch]           = useState('');
  const [category, setCategory]       = useState<string>('All');
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [stockEdit, setStockEdit]     = useState<AdminListProduct | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    adminApi
      .get<{ products: AdminListProduct[] }>('/admin/products?limit=200')
      .then((r) => setProducts(r.data.products ?? []))
      .catch(() => showToast('Failed to load products', 'error'))
      .finally(() => setLoading(false));
  }, []);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let r = products;
    if (search) {
      const s = search.toLowerCase();
      r = r.filter((p) => p.name.toLowerCase().includes(s) || p.brand.toLowerCase().includes(s));
    }
    if (category !== 'All') r = r.filter((p) => p.category === category);
    return r;
  }, [products, search, category]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (confirmDelete === null) return;
    setDeleting(true);
    try {
      await adminProductsApi.delete(confirmDelete);
      setProducts((prev) => prev.filter((p) => p.id !== confirmDelete));
      showToast('Product deleted', 'info');
      setConfirmDelete(null);
    } catch (err: any) {
      showToast(err?.response?.data?.detail ?? 'Failed to delete product', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // ── Stock saved callback ──────────────────────────────────────────────────
  const handleStockSaved = (productId: number, variantId: number, newStock: number) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? { ...p, variants: p.variants.map((v) => v.id === variantId ? { ...v, stock: newStock } : v) }
          : p
      )
    );
  };

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="bg-adminSurf border border-adminBorder rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading font-bold text-xl text-white">Products ({products.length})</h1>
          <p className="text-xs text-gray-400 mt-0.5">Manage your product catalog</p>
        </div>
        <Button variant="primary" leftIcon={<PlusIcon size={14} />} onClick={() => navigate('/admin/products/add')}>
          Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-adminSurf border border-adminBorder rounded-xl p-4 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px] relative">
          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full bg-adminBg border border-adminBorder rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-primary"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-adminBg border border-adminBorder rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary"
        >
          {['All', 'Mobiles', 'Laptops', 'TVs', 'Tablets', 'Accessories'].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-adminSurf border border-adminBorder rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-adminBg/50">
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price Range</th>
                <th className="px-4 py-3">GST</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-adminBorder">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                      <Loader2Icon size={16} className="animate-spin" /> Loading products…
                    </div>
                  </td>
                </tr>
              )}

              {!loading && filtered.map((p) => {
                const variants   = p.variants ?? [];
                const prices     = variants.length ? variants.map((v) => v.price) : [0];
                const minP       = Math.min(...prices);
                const maxP       = Math.max(...prices);
                const totalStock = variants.reduce((s, v) => s + (v.stock ?? 0), 0);
                const gstRate    = p.gst_rate ?? 18;
                const primaryImg = p.images?.[0] ? getImageUrl(p.images[0]) : null;

                return (
                  <tr key={p.id} className="hover:bg-adminBg/30">
                    {/* Product */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-adminBg rounded shrink-0 border border-adminBorder overflow-hidden">
                          {primaryImg
                            ? <img src={primaryImg} alt={p.name} className="w-full h-full object-contain p-0.5" />
                            : <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">No img</div>}
                        </div>
                        <div className="min-w-0">
                          <span className="text-white font-medium line-clamp-1 max-w-[200px] block">{p.name}</span>
                          {p.hsn_code && <span className="text-[11px] text-gray-500">HSN: {p.hsn_code}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{p.brand}</td>
                    <td className="px-4 py-3 text-gray-300">{p.category}</td>
                    {/* Price */}
                    <td className="px-4 py-3 text-white font-semibold">
                      {variants.length === 0 ? '—' : minP === maxP ? formatINR(minP) : `${formatINR(minP)} – ${formatINR(maxP)}`}
                    </td>
                    {/* GST */}
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        gstRate === 0 ? 'bg-gray-500/20 text-gray-400' :
                        gstRate === 28 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-blue-500/20 text-blue-300'}`}>
                        {gstRate}%
                      </span>
                    </td>
                    {/* Stock — click to edit inline */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => variants.length > 0 && setStockEdit(p)}
                        title={variants.length > 0 ? 'Click to edit stock' : 'No variants'}
                        className={`font-semibold underline decoration-dotted underline-offset-2 transition-opacity ${
                          variants.length === 0 ? 'cursor-default text-gray-600' :
                          totalStock === 0 ? 'text-red-400 hover:opacity-70 cursor-pointer' :
                          totalStock <= 5  ? 'text-yellow-400 hover:opacity-70 cursor-pointer' :
                          'text-white hover:opacity-70 cursor-pointer'
                        }`}
                      >
                        {totalStock}
                      </button>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        p.is_active ? 'bg-success/20 text-success' : 'bg-gray-500/20 text-gray-400'}`}>
                        {p.is_active ? 'Active' : 'Draft'}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => navigate(`/admin/products/${p.id}/edit`)}
                          className="p-1.5 rounded hover:bg-white/5 text-primary" aria-label="Edit">
                          <PencilIcon size={14} />
                        </button>
                        <button onClick={() => setConfirmDelete(p.id)}
                          className="p-1.5 rounded hover:bg-white/5 text-red-400" aria-label="Delete">
                          <Trash2Icon size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500 text-sm">
                    {products.length === 0 ? 'No products yet. Click "Add Product" to get started.' : 'No products match your filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation modal */}
      <Modal open={confirmDelete !== null} onClose={() => !deleting && setConfirmDelete(null)} title="Delete Product" dark>
        <p className="text-sm text-gray-300 mb-4">
          Are you sure you want to delete this product? This will also remove all product images. This action cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setConfirmDelete(null)} disabled={deleting}
            className="text-sm font-semibold text-gray-400 px-4 py-2 disabled:opacity-50">Cancel</button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </Modal>

      {/* Inline stock edit modal */}
      {stockEdit && (
        <StockEditModal
          product={stockEdit}
          onClose={() => setStockEdit(null)}
          onSaved={(pid, vid, stock) => {
            handleStockSaved(pid, vid, stock);
          }}
        />
      )}
    </div>
  );
}