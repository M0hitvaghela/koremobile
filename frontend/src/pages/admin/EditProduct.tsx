import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeftIcon } from 'lucide-react';
import { ProductForm, ProductFormSubmitData } from '../../components/admin/ProductForm';
import { useToastStore } from '../../store/toastStore';
import { adminProductsApi, ProductOutAPI } from '../../utils/adminApi';
import { useProductsStore } from '../../store/productsStore';
import type { Product } from '../../types/product';

// ─────────────────────────────────────────────
// Map backend ProductOutAPI → frontend Product
// ─────────────────────────────────────────────
function mapToProduct(p: ProductOutAPI): Product {
  return {
    id: String(p.id),
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    category: p.category as Product['category'],
    description: p.description,
    images: p.images,   // already normalized by adminProductsApi.getById
    variants: p.variants.map((v) => ({
      id: String(v.id),
      color: v.color,
      storage: v.storage,
      price: v.price,
      mrp: v.mrp,
      stock: v.stock,
    })),
    specifications: p.specifications.map((s) => ({
      key: s.spec_key,
      value: s.spec_value,
    })),
    badges: (p.badges || []).map((b) => ({
      key: b.badge_key,
      label: b.label || undefined,
    })),
    allow_cod: p.allow_cod,
    allow_online: p.allow_online,
    is_active: p.is_active,
    rating: p.avg_rating,
    review_count: p.review_count,
    created_at: '',
    // ── GST ────────────────────────────────────────────────────────
    gst_rate: (p as any).gst_rate ?? 18,
    hsn_code: (p as any).hsn_code ?? '',
    // ─────────────────────────────────────────────────────────────
  };
}

export function EditProduct() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.showToast);
  const updateProduct = useProductsStore((s) => s.updateProduct);

  const [product, setProduct] = useState<Product | null>(null);
  const [imageIds, setImageIds] = useState<Record<string, number>>({});
  const [fetchLoading, setFetchLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);

  // ── Fetch product from backend (always fresh, no cache) ───────────────────
  useEffect(() => {
    if (!id) return;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      showToast('Invalid product ID', 'error');
      navigate('/admin/products');
      return;
    }

    setFetchLoading(true);
    adminProductsApi
      .getById(numId)
      .then(async (data) => {
        setProduct(mapToProduct(data));
        // Fetch image id map for unlink-on-remove tracking
        try {
          const imgs = await adminProductsApi.getImages(numId);
          const idMap: Record<string, number> = {};
          imgs.forEach((img) => { idMap[img.url] = img.id; });
          setImageIds(idMap);
        } catch { /* non-fatal */ }
      })
      .catch((err: any) => {
        const msg =
          typeof err?.response?.data?.detail === 'string'
            ? err.response.data.detail
            : 'Failed to load product';
        showToast(msg, 'error');
        navigate('/admin/products');
      })
      .finally(() => setFetchLoading(false));
  }, [id]);

  // ── Save handler ──────────────────────────────────────────────────────────
  const handleSubmit = async (data: ProductFormSubmitData, asDraft: boolean) => {
    if (!id || !product) return;
    const numId = parseInt(id, 10);
    setSaveLoading(true);

    try {
      // ── Step 1: Update product fields / variants / specs ──────────────────
      const updated = await adminProductsApi.update(numId, {
        name: data.name,
        brand: data.brand,
        category: data.category,
        description: data.description,
        allow_cod: data.allow_cod,
        allow_online: data.allow_online,
        is_active: asDraft ? false : data.is_active,
        // ── GST ────────────────────────────────────────────────────────
        gst_rate: data.gst_rate,
        hsn_code: data.hsn_code || undefined,
        // ─────────────────────────────────────────────────────────────
        variants: data.variants.map((v) => ({
          // ✅ FIX: include the variant's DB id so backend updates in place
          // instead of deleting + re-inserting (which broke order FK references).
          // v.id is a string like "12" for existing variants, or "" / undefined for new ones.
          id: v.id && !v.id.includes('-') ? parseInt(v.id, 10) : undefined,
          color: v.color,
          storage: v.storage,
          price: v.price,
          mrp: v.mrp,
          stock: v.stock,
        })),
        specifications: data.specifications.map((s, i) => ({
          spec_key: s.key,
          spec_value: s.value,
          display_order: i,
        })),
        badges: data.badges.map((b, i) => ({
          badge_key: b.key,
          label: b.label,
          display_order: i,
        })),
      });

      // ── Step 1b: Unlink removed images (DB row only, file stays on disk) ──
      for (const imageId of data.removedImageIds) {
        try {
          await adminProductsApi.unlinkImage(numId, imageId);
        } catch { /* best-effort */ }
      }

      // ── Step 2a: Upload newly picked local files ────────────────────────
      const newUploadedUrls: string[] = [];
      for (const file of data.newImageFiles) {
        try {
          const img = await adminProductsApi.uploadImage(numId, file);
          newUploadedUrls.push(img.url);
        } catch (imgErr: any) {
          const detail =
            typeof imgErr?.response?.data?.detail === 'string'
              ? imgErr.response.data.detail
              : 'One image failed to upload';
          showToast(detail, 'warning');
        }
      }

      // ── Step 2b: Link server-browser-picked images to this product ────────
      // These are files already on disk but not yet in product_images for this product.
      const linkedServerUrls: string[] = [];
      for (const url of data.serverImageUrls) {
        try {
          const img = await adminProductsApi.linkServerImage(numId, url);
          linkedServerUrls.push(img.url);
        } catch (imgErr: any) {
          showToast('Failed to link one server image', 'warning');
        }
      }

      // ── Step 3: Persist drag-reorder to DB ───────────────────────────────
      // data.existingImageUrls = relative paths in admin's desired order
      // newUploadedUrls = just uploaded, appended at positions the admin placed them
      //
      // We fetch the DB image list (with real ids), then match by URL to build
      // a reorder payload [{id, display_order}] and call the reorder endpoint.
      // Build desired order: existing (already linked) + server-linked + newly uploaded
      // The order matches how the admin dragged them in ProductForm
      const desiredOrder = [...data.existingImageUrls, ...linkedServerUrls, ...newUploadedUrls];
      try {
        const dbImages = await adminProductsApi.getImages(numId);
        // Build url→id map. DB urls are relative paths.
        const urlToId = new Map(dbImages.map((img) => [img.url, img.id]));
        const reorderPayload: Array<{ id: number; display_order: number }> = [];
        desiredOrder.forEach((url, idx) => {
          const dbId = urlToId.get(url);
          if (dbId !== undefined) {
            reorderPayload.push({ id: dbId, display_order: idx + 1 });
          }
        });
        if (reorderPayload.length > 0) {
          await adminProductsApi.reorderImages(numId, reorderPayload);
        }
      } catch {
        // Reorder is best-effort — don't fail the whole save
      }

      // ── Step 4: Sync local store ──────────────────────────────────────────
      const allImages = desiredOrder;

      const storeUpdates: Partial<Product> = {
        name: updated.name,
        slug: updated.slug,
        brand: updated.brand,
        category: updated.category as Product['category'],
        description: updated.description,
        images: allImages,
        variants: updated.variants.map((v) => ({
          id: String(v.id),
          color: v.color,
          storage: v.storage,
          price: v.price,
          mrp: v.mrp,
          stock: v.stock,
        })),
        specifications: updated.specifications.map((s) => ({
          key: s.spec_key,
          value: s.spec_value,
        })),
        badges: (updated.badges || []).map((b) => ({
          key: b.badge_key,
          label: b.label || undefined,
        })),
        allow_cod: updated.allow_cod,
        allow_online: updated.allow_online,
        is_active: updated.is_active,
        // ── GST ────────────────────────────────────────────────────────
        gst_rate: (updated as any).gst_rate ?? data.gst_rate,
        hsn_code: ((updated as any).hsn_code ?? data.hsn_code) || undefined,
        // ─────────────────────────────────────────────────────────────
      };

      updateProduct(String(numId), storeUpdates);
      showToast(`"${updated.name}" updated successfully`, 'success');
      navigate('/admin/products');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d: any) => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join(' | ')
        : typeof detail === 'string'
        ? detail
        : 'Failed to update product. Please try again.';
      showToast(msg, 'error');
      console.error('[EditProduct] API error:', err?.response?.data);
    } finally {
      setSaveLoading(false);
    }
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  if (fetchLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
        Loading product…
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12 text-gray-400">Product not found.</div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate('/admin/products')}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"
      >
        <ChevronLeftIcon size={16} /> Back to Products
      </button>

      <div>
        <h1 className="font-heading font-bold text-2xl text-white">
          Edit Product
        </h1>
        <p className="text-sm text-gray-400 mt-1">{product.name}</p>
      </div>

      <ProductForm
        initial={product}
        initialImageIds={imageIds}
        onSubmit={handleSubmit}
        loading={saveLoading}
      />
    </div>
  );
}