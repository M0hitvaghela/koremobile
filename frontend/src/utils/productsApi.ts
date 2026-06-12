import { api } from './api';
import type { Product, ProductVariant, ProductSpec } from '../types/product';
import { getImageUrl } from './getImageUrl';

// ── Backend response shapes ───────────────────────────────────────────────────

interface VariantOut {
  id: number;
  color: string;
  storage: string;
  price: number;
  mrp: number;
  stock: number;
  is_active: boolean;
}

interface SpecOut {
  id: number;
  spec_key: string;
  spec_value: string;
  display_order: number;
}

interface BadgeOut {
  id: number;
  badge_key: string;
  label?: string | null;
  display_order: number;
}

interface ProductOut {
  id: number;
  name: string;
  slug: string;
  brand: string;
  category: string;
  description?: string;
  images: string[];
  variants: VariantOut[];
  specifications: SpecOut[];
  badges?: BadgeOut[];
  allow_cod: boolean;
  allow_online: boolean;
  is_active: boolean;
  avg_rating: number;
  review_count: number;
  gst_rate?: number;
  hsn_code?: string | null;
}

interface ProductListItem {
  id: number;
  name: string;
  slug: string;
  brand: string;
  category: string;
  primary_image?: string;
  min_price: number;
  max_price: number;
  min_mrp: number;
  max_discount_percent: number;
  is_active: boolean;
  allow_cod: boolean;
  allow_online: boolean;
  avg_rating: number;
  review_count: number;
  in_stock: boolean;
  gst_rate?: number;
  hsn_code?: string | null;
}

interface ProductListResponse {
  products: ProductListItem[];
  total: number;
  page: number;
  pages: number;
}

export interface ProductsFilter {
  page?: number;
  limit?: number;
  category?: string;
  brand?: string;
  search?: string;
  sort?: 'popular' | 'newest' | 'price_asc' | 'price_desc';
  min_price?: number;
  max_price?: number;
  in_stock?: boolean;
}

// ── Mappers: backend → frontend types ────────────────────────────────────────

function mapVariant(v: VariantOut): ProductVariant {
  return {
    id: String(v.id),
    color: v.color,
    storage: v.storage,
    price: v.price,
    mrp: v.mrp,
    stock: v.stock,
  };
}

function mapSpec(s: SpecOut): ProductSpec {
  return { key: s.spec_key, value: s.spec_value };
}

function mapProductOut(p: ProductOut): Product {
  return {
    id: String(p.id),
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    category: p.category as Product['category'],
    description: p.description,
    // ✅ FIX: convert relative /static/... paths to full backend URLs
    images: p.images.map(getImageUrl),
    variants: p.variants.map(mapVariant),
    specifications: p.specifications.map(mapSpec),
    badges: (p.badges || []).map((b) => ({ key: b.badge_key, label: b.label || undefined })),
    allow_cod: p.allow_cod,
    allow_online: p.allow_online,
    rating: p.avg_rating,
    review_count: p.review_count,
    is_active: p.is_active,
    created_at: '',
    gst_rate: (p.gst_rate ?? 18) as any,
    hsn_code: p.hsn_code ?? undefined,
  };
}

function mapListItem(p: ProductListItem): Product {
  return {
    id: String(p.id),
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    category: p.category as Product['category'],
    // ✅ FIX: convert relative path to full URL
    images: p.primary_image ? [getImageUrl(p.primary_image)] : [],
    variants: [
      {
        id: `${p.id}-v0`,
        color: '',
        storage: '',
        price: p.min_price,
        mrp: p.min_mrp,
        stock: p.in_stock ? 1 : 0,
      },
    ],
    specifications: [],
    badges: [],
    allow_cod: p.allow_cod,
    allow_online: p.allow_online,
    rating: p.avg_rating,
    review_count: p.review_count,
    is_active: p.is_active,
    created_at: '',
    gst_rate: (p.gst_rate ?? 18) as any,
    hsn_code: p.hsn_code ?? undefined,
  };
}

// ── API functions ─────────────────────────────────────────────────────────────

export const productsApi = {
  list: async (filters: ProductsFilter = {}): Promise<{ products: Product[]; total: number; page: number; pages: number }> => {
    const params: Record<string, unknown> = { page: 1, limit: 20, ...filters };
    Object.keys(params).forEach((k) => params[k] === undefined && delete params[k]);
    const res = await api.get<ProductListResponse>('/products', { params });
    return {
      products: res.data.products.map(mapListItem),
      total: res.data.total,
      page: res.data.page,
      pages: res.data.pages,
    };
  },

  featured: async (): Promise<Product[]> => {
    const res = await api.get<ProductListItem[]>('/products/featured');
    return res.data.map(mapListItem);
  },

  getBySlug: async (slug: string): Promise<Product> => {
    const res = await api.get<ProductOut>(`/products/${slug}`);
    return mapProductOut(res.data);
  },

  recommendations: async (
    slug: string,
    page = 1,
    limit = 12
  ): Promise<{ products: Product[]; total: number; page: number; pages: number }> => {
    const res = await api.get<ProductListResponse>(`/products/${slug}/recommendations`, {
      params: { page, limit },
    });
    return {
      products: res.data.products.map(mapListItem),
      total: res.data.total,
      page: res.data.page,
      pages: res.data.pages,
    };
  },
};