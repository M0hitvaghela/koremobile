import { create } from 'zustand';
import { Product } from '../types/product';
import { productsApi, ProductsFilter } from '../utils/productsApi';

interface ProductsStore {
  // data
  products: Product[];
  total: number;
  page: number;
  pages: number;
  loading: boolean;
  error: string | null;

  // mutations (admin use only)
  addProduct: (product: Product) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  // lookups
  getById: (id: string) => Product | undefined;
  getBySlug: (slug: string) => Product | undefined;

  // fetch actions
  fetchProducts: (filters?: ProductsFilter) => Promise<void>;
  fetchFeatured: () => Promise<void>;
  fetchBySlug: (slug: string) => Promise<Product | null>;
}

export const useProductsStore = create<ProductsStore>((set, get) => ({
  products: [],
  total: 0,
  page: 1,
  pages: 1,
  loading: false,
  error: null,

  // ── Admin mutations ──────────────────────────────────────────────────────
  addProduct: (product) => set({ products: [product, ...get().products] }),

  updateProduct: (id, updates) =>
    set({
      products: get().products.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }),

  deleteProduct: (id) =>
    set({ products: get().products.filter((p) => p.id !== id) }),

  // ── Lookups ──────────────────────────────────────────────────────────────
  getById: (id) => get().products.find((p) => p.id === id),
  getBySlug: (slug) => get().products.find((p) => p.slug === slug),

  // ── Fetch from backend ───────────────────────────────────────────────────
  fetchProducts: async (filters = {}) => {
    set({ loading: true, error: null });
    try {
      const data = await productsApi.list(filters);
      set({
        products: data.products,
        total: data.total,
        page: data.page,
        pages: data.pages,
        loading: false,
      });
    } catch {
      set({ error: 'Failed to load products', loading: false });
    }
  },

  fetchFeatured: async () => {
    set({ loading: true, error: null });
    try {
      const products = await productsApi.featured();
      set({ products, loading: false });
    } catch {
      set({ error: 'Failed to load featured products', loading: false });
    }
  },

  fetchBySlug: async (slug: string) => {
    try {
      // Check if we already have the full product loaded (with real variants)
      const existing = get().products.find((p) => p.slug === slug);
      // Only use cached version if it has real variant IDs (not placeholder `-v0` IDs)
      if (existing && existing.variants.length > 0 && !existing.variants[0].id.endsWith('-v0')) {
        return existing;
      }

      const product = await productsApi.getBySlug(slug);
      // Upsert into store
      set({
        products: get().products.some((p) => p.slug === slug)
          ? get().products.map((p) => (p.slug === slug ? product : p))
          : [...get().products, product],
      });
      return product;
    } catch {
      return null;
    }
  },
}));