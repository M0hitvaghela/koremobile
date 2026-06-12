import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, Trash2Icon, UploadCloudIcon, XIcon, ServerIcon, CheckIcon, RefreshCwIcon } from 'lucide-react';
import { Input, Select, Textarea } from '../ui/Input';
import { Button } from '../ui/Button';
import { Product, ProductVariant, ProductSpec, ProductBadge } from '../../types/product';
import { useToastStore } from '../../store/toastStore';
import { calcDiscount, formatINR } from '../../utils/formatPrice';
import { adminApi } from '../../utils/adminApi';
import { getImageUrl } from '../../utils/getImageUrl';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ProductFormSubmitData {
  name: string;
  brand: string;
  category: Product['category'];
  description: string;
  is_active: boolean;
  allow_cod: boolean;
  allow_online: boolean;
  // ── GST ──
  gst_rate: number;
  hsn_code: string;
  // ─────────
  variants: ProductVariant[];
  specifications: ProductSpec[];
  newImageFiles: File[];
  existingImageUrls: string[];
  serverImageUrls: string[];
  removedImageIds: number[];
  badges: ProductBadge[];
}

interface ProductFormProps {
  initial?: Product;
  initialImageIds?: Record<string, number>;
  onSubmit: (data: ProductFormSubmitData, asDraft: boolean) => void;
  loading?: boolean;
}

// ─────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────

const CATEGORIES: Product['category'][] = ['Mobiles', 'Laptops', 'TVs', 'Tablets', 'Accessories'];

// Default GST rate per category (Indian GST)
const CATEGORY_GST_DEFAULTS: Record<string, number> = {
  Mobiles: 18,
  Laptops: 18,
  TVs: 28,
  Tablets: 18,
  Accessories: 18,
};

const GST_RATES = [0, 5, 12, 18, 28];

const blankVariant = (): ProductVariant => ({
  id: 'v' + Date.now() + Math.random().toString(36).slice(2, 5),
  color: '',
  storage: '',
  price: 0,
  mrp: 0,
  stock: 0,
});

const blankSpec = (): ProductSpec => ({ key: '', value: '' });

const BADGE_PRESETS: Array<{ key: string; label: string; editable?: boolean }> = [
  { key: 'warranty', label: '1 Year Warranty', editable: true },
  { key: 'free_delivery', label: 'Free Delivery', editable: true },
  { key: 'gst_invoice', label: 'GST Invoice Provided' },
  { key: 'genuine_product', label: 'Genuine Product' },
  { key: 'secure_payments', label: '100% Secure Payments' },
  { key: 'easy_returns', label: 'Easy Returns' },
];

const SERVER_IMAGE_PAGE_SIZE = 60;

// ─────────────────────────────────────────────
// Server Image Browser Modal (unchanged)
// ─────────────────────────────────────────────

interface ServerImageBrowserProps {
  onClose: () => void;
  onSelect: (urls: string[]) => void;
  alreadySelected: string[];
  slotsLeft: number;
}

function ServerImageBrowser({ onClose, onSelect, alreadySelected, slotsLeft }: ServerImageBrowserProps) {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const fetchImages = useCallback(async (pageToLoad: number, replace: boolean) => {
    if (replace) { setLoading(true); setError(''); } else setLoadingMore(true);
    try {
      const res = await adminApi.get<{ images: string[]; page?: number; pages?: number }>('/admin/products/static-images', {
        params: { page: pageToLoad, limit: SERVER_IMAGE_PAGE_SIZE },
      });
      const normalized = res.data.images.map(getImageUrl);
      setImages((prev) => {
        if (replace) return normalized;
        const seen = new Set(prev);
        const next = [...prev];
        for (const url of normalized) { if (!seen.has(url)) next.push(url); }
        return next;
      });
      setPage(res.data.page || pageToLoad);
      setPages(res.data.pages || pageToLoad);
    } catch {
      if (replace) setError('Failed to load server images');
    } finally {
      if (replace) setLoading(false); else setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchImages(1, true); }, [fetchImages]);

  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore || page >= pages) return;
    fetchImages(page + 1, false);
  }, [fetchImages, loading, loadingMore, page, pages]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const onScroll = () => {
      if (loading || loadingMore || page >= pages) return;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 160) handleLoadMore();
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [handleLoadMore, loading, loadingMore, page, pages]);

  const toggle = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) { next.delete(url); }
      else { if (next.size >= slotsLeft) return prev; next.add(url); }
      return next;
    });
  };

  const handleAdd = () => {
    if (selected.size === 0) return;
    onSelect(Array.from(selected));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-adminSurf border border-adminBorder rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-adminBorder flex-shrink-0">
          <div>
            <h2 className="font-heading font-bold text-white text-lg">Server Images</h2>
            <p className="text-xs text-gray-400 mt-0.5">Images already stored on server · Select up to {slotsLeft} more</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => fetchImages(1, true)} className="p-2 rounded-lg hover:bg-adminBg text-gray-400 hover:text-white transition-colors" title="Refresh">
              <RefreshCwIcon size={15} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-adminBg text-gray-400 hover:text-white">
              <XIcon size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4" ref={bodyRef}>
          {loading && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-adminBg animate-pulse" />
              ))}
            </div>
          )}
          {!loading && error && <div className="text-center py-10 text-red-400 text-sm">{error}</div>}
          {!loading && !error && images.length === 0 && <div className="text-center py-10 text-gray-500 text-sm">No images found on server.</div>}
          {!loading && !error && images.length > 0 && (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {images.map((url) => {
                  const urlPath = (() => { try { return new URL(url).pathname; } catch { return url; } })();
                  const isAlready = alreadySelected.includes(urlPath);
                  const isPicked = selected.has(url);
                  const disabled = isAlready || (!isPicked && selected.size >= slotsLeft);
                  return (
                    <button
                      key={url}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggle(url)}
                      className={[
                        'relative aspect-square rounded-xl overflow-hidden border-2 transition-all',
                        isPicked ? 'border-primary ring-2 ring-primary/40'
                          : isAlready ? 'border-green-500/50 opacity-50 cursor-not-allowed'
                          : disabled ? 'border-adminBorder opacity-40 cursor-not-allowed'
                          : 'border-adminBorder hover:border-gray-400 cursor-pointer',
                      ].join(' ')}
                    >
                      <img src={url} alt="" className="w-full h-full object-contain p-1 bg-adminBg" loading="lazy" />
                      {(isPicked || isAlready) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isAlready ? 'bg-green-500' : 'bg-primary'}`}>
                            <CheckIcon size={14} className="text-white" strokeWidth={3} />
                          </div>
                        </div>
                      )}
                      {isAlready && (
                        <span className="absolute bottom-0 inset-x-0 text-center text-[9px] font-bold text-white bg-green-600/80 py-0.5">IN USE</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {page < pages && (
                <div className="flex justify-center mt-4 text-xs text-gray-500">
                  {loadingMore ? 'Loading more...' : 'Scroll to load more'}
                </div>
              )}
            </>
          )}
        </div>
        <div className="px-5 py-4 border-t border-adminBorder flex items-center justify-between flex-shrink-0">
          <span className="text-sm text-gray-400">{selected.size > 0 ? `${selected.size} selected` : 'None selected'}</span>
          <div className="flex gap-3">
            <Button variant="dark" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleAdd} disabled={selected.size === 0}>
              Add {selected.size > 0 ? `${selected.size} Image${selected.size > 1 ? 's' : ''}` : 'Images'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export function ProductForm({ initial, initialImageIds, onSubmit, loading = false }: ProductFormProps) {
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.showToast);

  // Basic fields
  const [name, setName] = useState(initial?.name || '');
  const [brand, setBrand] = useState(initial?.brand || '');
  const [category, setCategory] = useState<Product['category']>(initial?.category || 'Mobiles');
  const [description, setDescription] = useState(initial?.description || '');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [allowCod, setAllowCod] = useState(initial?.allow_cod ?? true);
  const [allowOnline, setAllowOnline] = useState(initial?.allow_online ?? true);

  // ── GST fields ────────────────────────────────────────────────────────────
  const [gstRate, setGstRate] = useState<number>(
    (initial as any)?.gst_rate ?? CATEGORY_GST_DEFAULTS[initial?.category || 'Mobiles'] ?? 18
  );
  const [hsnCode, setHsnCode] = useState<string>((initial as any)?.hsn_code || '');
  // ─────────────────────────────────────────────────────────────────────────

  // Auto-update GST rate when category changes (only if user hasn't manually changed it)
  const [gstManuallySet, setGstManuallySet] = useState(false);
  useEffect(() => {
    if (!gstManuallySet && !initial) {
      setGstRate(CATEGORY_GST_DEFAULTS[category] ?? 18);
    }
  }, [category, gstManuallySet, initial]);

  // Images
  const [existingUrls, setExistingUrls] = useState<string[]>(initial?.images || []);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [serverUrls, setServerUrls] = useState<string[]>([]);
  const [showServerBrowser, setShowServerBrowser] = useState(false);
  const [removedImageIds, setRemovedImageIds] = useState<number[]>([]);
  const imageIdMap = initialImageIds || {};
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Variants and specs
  const [variants, setVariants] = useState<ProductVariant[]>(
    initial?.variants?.length ? initial.variants : [blankVariant()]
  );
  const [specs, setSpecs] = useState<ProductSpec[]>(
    initial?.specifications?.length ? initial.specifications : [blankSpec()]
  );
  const [badges, setBadges] = useState<ProductBadge[]>(initial?.badges || []);

  // ── Image handling ────────────────────────────────────────────────────────
  const totalImageCount = existingUrls.length + serverUrls.length + newPreviews.length;
  const slotsLeft = 8 - totalImageCount;

  const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFiles(Array.from(e.dataTransfer.files));
  };

  const handleFiles = (files: File[]) => {
    if (totalImageCount + files.length > 8) { showToast('Maximum 8 images allowed', 'warning'); return; }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    const valid = files.filter((f) => {
      if (!allowed.includes(f.type)) { showToast(`${f.name}: only jpg, png, webp allowed`, 'warning'); return false; }
      if (f.size > 5 * 1024 * 1024) { showToast(`${f.name}: max size is 5MB`, 'warning'); return false; }
      return true;
    });
    if (valid.length === 0) return;
    valid.forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => setNewPreviews((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(f);
    });
    setNewFiles((prev) => [...prev, ...valid]);
  };

  const removeExistingImage = (idx: number) => {
    const url = existingUrls[idx];
    const dbId = imageIdMap[url];
    if (dbId !== undefined) setRemovedImageIds((prev) => [...prev, dbId]);
    setExistingUrls(existingUrls.filter((_, i) => i !== idx));
  };
  const removeNewImage = (idx: number) => {
    setNewPreviews(newPreviews.filter((_, i) => i !== idx));
    setNewFiles(newFiles.filter((_, i) => i !== idx));
  };

  const toRelative = (url: string): string => {
    try { return new URL(url).pathname; } catch { return url; }
  };

  const allImages: Array<{ src: string; type: 'existing' | 'server' | 'new'; idx: number }> = [
    ...existingUrls.map((src, idx) => ({ src: getImageUrl(src), type: 'existing' as const, idx })),
    ...serverUrls.map((src, idx) => ({ src: getImageUrl(src), type: 'server' as const, idx })),
    ...newPreviews.map((src, idx) => ({ src, type: 'new' as const, idx })),
  ];

  const handleDragStart = (flatIdx: number) => setDragIndex(flatIdx);
  const handleDragEnter = (flatIdx: number) => setDragOverIndex(flatIdx);
  const handleDragEnd = () => {
    if (dragIndex === null || dragOverIndex === null || dragIndex === dragOverIndex) {
      setDragIndex(null); setDragOverIndex(null); return;
    }
    const reordered = [...allImages];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dragOverIndex, 0, moved);
    const newExisting: string[] = [];
    const newServer: string[] = [];
    const newPreviews2: string[] = [];
    const newFiles2: File[] = [];
    for (const item of reordered) {
      if (item.type === 'existing') newExisting.push(existingUrls[item.idx]);
      else if (item.type === 'server') newServer.push(serverUrls[item.idx]);
      else { newPreviews2.push(newPreviews[item.idx]); newFiles2.push(newFiles[item.idx]); }
    }
    setExistingUrls(newExisting);
    setServerUrls(newServer);
    setNewPreviews(newPreviews2);
    setNewFiles(newFiles2);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleRemoveFlat = (flatIdx: number) => {
    const item = allImages[flatIdx];
    if (item.type === 'existing') removeExistingImage(item.idx);
    else if (item.type === 'server') setServerUrls(serverUrls.filter((_, i) => i !== item.idx));
    else removeNewImage(item.idx);
  };

  const handleServerImagesSelected = (urls: string[]) => {
    const normalized = urls.map(toRelative);
    const allCurrentUrls = [...existingUrls.map(toRelative), ...serverUrls.map(toRelative)];
    const toAdd = normalized.filter((u) => !allCurrentUrls.includes(u));
    if (totalImageCount + toAdd.length > 8) { showToast('Adding these would exceed 8 images', 'warning'); return; }
    setServerUrls((prev) => [...prev, ...toAdd]);
  };

  const addCommonSpecs = () => {
    const existing = new Set(specs.map((s) => s.key.toLowerCase()));
    const common = ['RAM', 'Battery', 'Display', 'Processor']
      .filter((c) => !existing.has(c.toLowerCase()))
      .map((c) => ({ key: c, value: '' }));
    setSpecs([...specs.filter((s) => s.key || s.value), ...common]);
  };

  const toggleBadge = (key: string, defaultLabel: string) => {
    const exists = badges.find((b) => b.key === key);
    if (exists) { setBadges(badges.filter((b) => b.key !== key)); return; }
    setBadges([...badges, { key, label: defaultLabel }]);
  };

  const updateBadgeLabel = (key: string, label: string) => {
    setBadges(badges.map((b) => (b.key === key ? { ...b, label } : b)));
  };

  const addCustomBadge = () => setBadges([...badges, { key: 'custom', label: '' }]);

  const updateCustomBadge = (idx: number, label: string) => {
    setBadges(badges.map((b, i) => (i === idx ? { ...b, label } : b)));
  };

  const removeCustomBadge = (idx: number) => setBadges(badges.filter((_, i) => i !== idx));

  // ── Submit ────────────────────────────────────────────────────────────────
  const submit = (asDraft: boolean) => {
    if (!name.trim()) return showToast('Product name is required', 'error');
    if (!brand.trim()) return showToast('Brand is required', 'error');
    if (!description.trim()) return showToast('Description is required', 'error');
    if (variants.some((v) => !v.color.trim())) return showToast('Each variant must have a color', 'error');
    if (variants.some((v) => !v.storage.trim())) return showToast('Each variant must have a storage value', 'error');
    if (variants.some((v) => v.price <= 0)) return showToast('Each variant must have a valid price', 'error');
    if (variants.some((v) => v.mrp <= 0)) return showToast('Each variant must have a valid MRP', 'error');
    if (variants.some((v) => v.mrp < v.price)) return showToast('MRP must be ≥ price for each variant', 'error');

    onSubmit(
      {
        name: name.trim(),
        brand: brand.trim(),
        category,
        description: description.trim(),
        is_active: asDraft ? false : isActive,
        allow_cod: allowCod,
        allow_online: allowOnline,
        // ── GST ──────────────────────────────────────────────────────────
        gst_rate: gstRate,
        hsn_code: hsnCode.trim(),
        // ─────────────────────────────────────────────────────────────────
        variants,
        specifications: specs.filter((s) => s.key.trim() && s.value.trim()),
        newImageFiles: newFiles,
        existingImageUrls: existingUrls,
        serverImageUrls: serverUrls,
        removedImageIds,
        badges: badges.filter((b) => b.key !== 'custom' || (b.label && b.label.trim())),
      },
      asDraft
    );
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <>
      {showServerBrowser && (
        <ServerImageBrowser
          onClose={() => setShowServerBrowser(false)}
          onSelect={handleServerImagesSelected}
          alreadySelected={[...existingUrls, ...serverUrls].map((u) => { try { return new URL(u).pathname; } catch { return u; } })}
          slotsLeft={slotsLeft}
        />
      )}

      <div className="space-y-5">

        {/* ── Section 1: Basic Info ── */}
        <Section title="Basic Information">
          <div className="grid md:grid-cols-2 gap-4">
            <Input label="Product Name" required dark value={name} placeholder="e.g. Samsung Galaxy S24" onChange={(e) => setName(e.target.value)} />
            <Input label="Brand" required dark value={brand} placeholder="e.g. Samsung" onChange={(e) => setBrand(e.target.value)} />
          </div>
          <Select label="Category" required dark value={category} onChange={(e) => setCategory(e.target.value as Product['category'])}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Textarea label="Description" required dark rows={4} value={description} placeholder="Describe the product features..." onChange={(e) => setDescription(e.target.value)} />
          <div className="flex flex-wrap gap-4 pt-2">
            <Toggle label="Active" checked={isActive} onChange={setIsActive} />
            <Toggle label="Allow COD" checked={allowCod} onChange={setAllowCod} />
            <Toggle label="Allow Online Payment" checked={allowOnline} onChange={setAllowOnline} />
          </div>

          {/* ── GST Configuration ──────────────────────────────────────────── */}
          <div className="border-t border-adminBorder/50 pt-4 mt-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">GST Configuration</p>
            <div className="grid md:grid-cols-2 gap-4">
              {/* GST Rate */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  GST Rate <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {GST_RATES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => { setGstRate(r); setGstManuallySet(true); }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                        gstRate === r
                          ? 'bg-primary border-primary text-white'
                          : 'bg-adminBg border-adminBorder text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  {gstRate === 0 ? 'Exempt from GST'
                    : `CGST ${gstRate / 2}% + SGST ${gstRate / 2}% = ${gstRate}%`}
                </p>
              </div>

              {/* HSN Code */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">HSN Code</label>
                <input
                  type="text"
                  maxLength={8}
                  value={hsnCode}
                  onChange={(e) => setHsnCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 85171200"
                  className="w-full bg-adminBg border border-adminBorder rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-primary outline-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">8-digit HSN code (optional but recommended)</p>
              </div>
            </div>

            {/* GST preview — shows base price for first variant */}
            {variants[0]?.price > 0 && gstRate > 0 && (
              <div className="mt-3 bg-adminBg/60 border border-adminBorder rounded-lg p-3 text-xs text-gray-400">
                <p className="font-semibold text-gray-300 mb-1">GST Preview (first variant · {formatINR(variants[0].price)})</p>
                <div className="flex gap-4 flex-wrap">
                  <span>Base (ex-GST): <strong className="text-white">{formatINR(parseFloat((variants[0].price / (1 + gstRate / 100)).toFixed(2)))}</strong></span>
                  <span>GST ({gstRate}%): <strong className="text-white">{formatINR(parseFloat((variants[0].price - variants[0].price / (1 + gstRate / 100)).toFixed(2)))}</strong></span>
                  <span>Inclusive price: <strong className="text-white">{formatINR(variants[0].price)}</strong></span>
                </div>
              </div>
            )}
          </div>
          {/* ───────────────────────────────────────────────────────────────── */}
        </Section>

        {/* ── Section 2: Images ── */}
        <Section title={`Product Images (${totalImageCount}/8)`}>
          <div className="flex flex-wrap gap-2 mb-3">
            {totalImageCount < 8 && (
              <button
                type="button"
                onClick={() => document.getElementById('img-input')?.click()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-adminBg border border-adminBorder text-sm text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
              >
                <UploadCloudIcon size={15} /> Upload from device
              </button>
            )}
            {totalImageCount < 8 && (
              <button
                type="button"
                onClick={() => setShowServerBrowser(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-sm text-primary hover:bg-primary/20 transition-colors"
              >
                <ServerIcon size={15} /> Browse server images
              </button>
            )}
            <input id="img-input" type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={(e) => handleFiles(Array.from(e.target.files || []))} />
          </div>

          {totalImageCount < 8 && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleImageDrop}
              onClick={() => document.getElementById('img-input')?.click()}
              className="border-2 border-dashed border-adminBorder rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
            >
              <UploadCloudIcon size={28} className="mx-auto text-gray-500 mb-2" />
              <p className="text-sm text-gray-400">Drag & drop images here or click to upload</p>
              <p className="text-xs text-gray-600 mt-1">JPG, PNG, WEBP · Max 5MB · Up to 8 images</p>
            </div>
          )}

          {totalImageCount > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                {allImages.map((item, flatIdx) => (
                  <div
                    key={`${item.type}-${item.idx}`}
                    draggable
                    onDragStart={() => handleDragStart(flatIdx)}
                    onDragEnter={() => handleDragEnter(flatIdx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnd={handleDragEnd}
                    className={[
                      'relative aspect-square bg-adminBg rounded-lg overflow-hidden border transition-all cursor-grab active:cursor-grabbing select-none',
                      dragIndex === flatIdx ? 'opacity-40 border-primary scale-95'
                        : dragOverIndex === flatIdx ? 'border-primary ring-2 ring-primary/40'
                        : 'border-adminBorder',
                    ].join(' ')}
                  >
                    <img src={item.src} alt="" className="w-full h-full object-contain p-2" />
                    {flatIdx === 0 && (
                      <span className="absolute top-1 left-1 bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded">Main</span>
                    )}
                    {item.type === 'server' && flatIdx !== 0 && (
                      <span className="absolute top-1 left-1 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">Server</span>
                    )}
                    {item.type === 'new' && flatIdx !== 0 && (
                      <span className="absolute top-1 left-1 bg-cta text-white text-[9px] font-bold px-1.5 py-0.5 rounded">New</span>
                    )}
                    <span className="absolute bottom-1 right-1 text-gray-500 text-[9px]">⠿ drag</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFlat(flatIdx)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-500"
                    >
                      <XIcon size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="text-xs text-gray-500 mt-2">
            First image = main thumbnail. <span className="text-gray-400">Drag to reorder.</span>
          </p>
        </Section>

        {/* ── Section 3: Variants ── */}
        <Section title="Price Variants">
          <div className="space-y-3">
            {variants.map((v, i) => {
              const disc = calcDiscount(v.mrp, v.price);
              return (
                <div key={v.id} className="bg-adminBg/50 border border-adminBorder rounded-lg p-3">
                  <div className="grid grid-cols-2 md:grid-cols-7 gap-2 items-end">
                    <Input dark label={i === 0 ? 'Color' : undefined} placeholder="Color" value={v.color} onChange={(e) => updateVariant(setVariants, variants, i, { color: e.target.value })} />
                    <Input dark label={i === 0 ? 'Storage' : undefined} placeholder="e.g. 128GB" value={v.storage} onChange={(e) => updateVariant(setVariants, variants, i, { storage: e.target.value })} />
                    <Input dark label={i === 0 ? 'Price ₹ (incl. GST)' : undefined} type="number" min={0} value={v.price || ''} onChange={(e) => updateVariant(setVariants, variants, i, { price: +e.target.value })} />
                    <Input dark label={i === 0 ? 'MRP ₹ (incl. GST)' : undefined} type="number" min={0} value={v.mrp || ''} onChange={(e) => updateVariant(setVariants, variants, i, { mrp: +e.target.value })} />
                    <Input dark label={i === 0 ? 'Stock' : undefined} type="number" min={0} value={v.stock || ''} onChange={(e) => updateVariant(setVariants, variants, i, { stock: +e.target.value })} />
                    <div className={i === 0 ? 'pt-7' : ''}>
                      {disc > 0 ? (
                        <span className="inline-flex px-2 py-1 bg-cta text-white text-xs font-bold rounded">{disc}% off</span>
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </div>
                    <div className={i === 0 ? 'pt-7 flex justify-end' : 'flex justify-end'}>
                      <button
                        type="button"
                        onClick={() => setVariants(variants.filter((_, idx) => idx !== i))}
                        disabled={variants.length === 1}
                        className="p-2 rounded hover:bg-red-500/10 text-red-400 disabled:opacity-30"
                      >
                        <Trash2Icon size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setVariants([...variants, blankVariant()])}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <PlusIcon size={14} /> Add Variant
          </button>
        </Section>

        {/* ── Section 4: Specifications ── */}
        <Section title="Specifications">
          <div className="space-y-2">
            {specs.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
                <Input dark placeholder="Key (e.g. RAM)" value={s.key} onChange={(e) => setSpecs(specs.map((sp, idx) => idx === i ? { ...sp, key: e.target.value } : sp))} />
                <Input dark placeholder="Value (e.g. 8GB)" value={s.value} onChange={(e) => setSpecs(specs.map((sp, idx) => idx === i ? { ...sp, value: e.target.value } : sp))} />
                <button type="button" onClick={() => setSpecs(specs.filter((_, idx) => idx !== i))} disabled={specs.length === 1} className="px-3 rounded-lg hover:bg-red-500/10 text-red-400 disabled:opacity-30">
                  <Trash2Icon size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-3">
            <button type="button" onClick={() => setSpecs([...specs, blankSpec()])} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              <PlusIcon size={14} /> Add Specification
            </button>
            <button type="button" onClick={addCommonSpecs} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-400 hover:text-white">
              + Add Common Specs
            </button>
          </div>
        </Section>

        {/* ── Section 5: Product Badges ── */}
        <Section title="Product Badges">
          <div className="space-y-3">
            {BADGE_PRESETS.map((preset) => {
              const selected = badges.find((b) => b.key === preset.key);
              return (
                <div key={preset.key} className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-200">
                    <input type="checkbox" checked={!!selected} onChange={() => toggleBadge(preset.key, preset.label)} className="accent-primary" />
                    {preset.label}
                  </label>
                  {preset.editable && selected && (
                    <input
                      type="text"
                      value={selected.label || ''}
                      onChange={(e) => updateBadgeLabel(preset.key, e.target.value)}
                      placeholder="Custom label"
                      className="bg-adminBg border border-adminBorder rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Custom Badges</span>
              <button type="button" onClick={addCustomBadge} className="text-sm font-semibold text-primary hover:underline">
                + Add Custom Badge
              </button>
            </div>
            {badges
              .map((b, idx) => ({ badge: b, idx }))
              .filter((entry) => entry.badge.key === 'custom')
              .map(({ badge, idx }) => (
                <div key={`custom-${idx}`} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={badge.label || ''}
                    onChange={(e) => updateCustomBadge(idx, e.target.value)}
                    placeholder="Badge label"
                    className="flex-1 bg-adminBg border border-adminBorder rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                  />
                  <button type="button" onClick={() => removeCustomBadge(idx)} className="p-2 rounded hover:bg-red-500/10 text-red-400">
                    <Trash2Icon size={14} />
                  </button>
                </div>
              ))}
          </div>
        </Section>

        {/* ── Submit ── */}
        <div className="bg-adminSurf border border-adminBorder rounded-xl p-5 flex gap-3 flex-wrap">
          <Button variant="primary" size="lg" onClick={() => submit(false)} disabled={loading} className="flex-1 min-w-[200px]">
            {loading ? 'Saving…' : 'Save Product'}
          </Button>
          <Button variant="dark" size="lg" onClick={() => submit(true)} disabled={loading}>
            Save as Draft
          </Button>
          <Button variant="dark" size="lg" onClick={() => navigate('/admin/products')} disabled={loading}>
            Cancel
          </Button>
        </div>

      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function updateVariant(
  setter: React.Dispatch<React.SetStateAction<ProductVariant[]>>,
  list: ProductVariant[],
  i: number,
  patch: Partial<ProductVariant>
) {
  setter(list.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-adminSurf border border-adminBorder rounded-xl p-5 space-y-4">
      <h3 className="font-heading font-semibold text-base text-white">{title}</h3>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <span className="relative inline-block w-10 h-6">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <span className="absolute inset-0 bg-adminBg border border-adminBorder rounded-full peer-checked:bg-primary transition-colors" />
        <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
      </span>
      <span className="text-sm text-gray-200">{label}</span>
    </label>
  );
}
