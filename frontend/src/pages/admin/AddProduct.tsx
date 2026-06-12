import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeftIcon } from 'lucide-react';
import { ProductForm, ProductFormSubmitData } from '../../components/admin/ProductForm';
import { useToastStore } from '../../store/toastStore';
import { adminProductsApi } from '../../utils/adminApi';
import { useProductsStore } from '../../store/productsStore';
import type { Product } from '../../types/product';

export function AddProduct() {
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.showToast);
  const addProduct = useProductsStore((s) => s.addProduct);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: ProductFormSubmitData, asDraft: boolean) => {
    setLoading(true);

    try {
      // ── Step 1: Create the product record (variants + specs) ──────────────
      const created = await adminProductsApi.create({
        name: data.name,
        brand: data.brand,
        category: data.category,
        description: data.description,
        allow_cod: data.allow_cod,
        allow_online: data.allow_online,
        is_active: asDraft ? false : data.is_active,
        // ── GST ──────────────────────────────────────────────────────────
        gst_rate: data.gst_rate,
        hsn_code: data.hsn_code || undefined,
        // ──────────────────────────────────────────────────────────────────
        variants: data.variants.map((v) => ({
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

      // ── Step 2a: Upload newly picked local files ────────────────────────
      const uploadedUrls: string[] = [];
      for (const file of data.newImageFiles) {
        try {
          const img = await adminProductsApi.uploadImage(created.id, file);
          uploadedUrls.push(img.url);
        } catch (imgErr: any) {
          const detail =
            typeof imgErr?.response?.data?.detail === 'string'
              ? imgErr.response.data.detail
              : 'One image failed to upload';
          showToast(detail, 'warning');
        }
      }

      // ── Step 2b: Link server-browser-picked images ───────────────────────
      const linkedServerUrls: string[] = [];
      for (const url of data.serverImageUrls) {
        try {
          const img = await adminProductsApi.linkServerImage(created.id, url);
          linkedServerUrls.push(img.url);
        } catch {
          showToast('Failed to link one server image', 'warning');
        }
      }

      // ── Step 3: Update local store so the list page refreshes immediately ─
      const storeProduct: Product = {
        id: String(created.id),
        slug: created.slug,
        name: created.name,
        brand: created.brand,
        category: created.category as Product['category'],
        description: created.description,
        images: [...uploadedUrls, ...linkedServerUrls],
        variants: created.variants.map((v) => ({
          id: String(v.id),
          color: v.color,
          storage: v.storage,
          price: v.price,
          mrp: v.mrp,
          stock: v.stock,
        })),
        specifications: created.specifications.map((s) => ({
          key: s.spec_key,
          value: s.spec_value,
        })),
        badges: data.badges,
        allow_cod: created.allow_cod,
        allow_online: created.allow_online,
        is_active: created.is_active,
        rating: created.avg_rating,
        review_count: created.review_count,
        created_at: new Date().toISOString(),
        // ── GST ────────────────────────────────────────────────────────
        gst_rate: (created as any).gst_rate ?? data.gst_rate,
        hsn_code: ((created as any).hsn_code ?? data.hsn_code) || undefined,
      };

      addProduct(storeProduct);
      showToast(`"${created.name}" added successfully`, 'success');
      navigate('/admin/products');
    } catch (err: any) {
      // Show backend validation errors nicely
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d: any) => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join(' | ')
        : typeof detail === 'string'
        ? detail
        : 'Failed to save product. Please try again.';
      showToast(msg, 'error');
      console.error('[AddProduct] API error:', err?.response?.data);
    } finally {
      setLoading(false);
    }
  };

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
          Add New Product
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Fill in product details below
        </p>
      </div>

      <ProductForm onSubmit={handleSubmit} loading={loading} />
    </div>
  );
}