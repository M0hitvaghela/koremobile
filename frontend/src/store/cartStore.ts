import { create } from 'zustand';
import { Product, ProductVariant } from '../types/product';
import { cartApi } from '../utils/cartApi';
import { useAuthStore } from './authStore';

export interface CartItem {
  product_id: string;
  variant_id: string;
  slug: string;
  name: string;
  brand: string;
  image: string;
  color: string;
  storage: string;
  price: number;
  mrp: number;
  qty: number;
  stock: number;
  allow_cod: boolean;
  gst_rate: number;   // ← added
}

interface CartStore {
  items: CartItem[];
  addItem: (product: Product, variant: ProductVariant, qty?: number) => void;
  removeItem: (variantId: string) => void;
  updateQty: (variantId: string, qty: number) => void;
  clearCart: () => void;
  clearLocal: () => void;
  hydrateFromServer: () => Promise<void>;
  totalItems: () => number;
  subtotal: () => number;
  mrpTotal: () => number;
  savings: () => number;
  allCodEligible: () => boolean;
}

const isUserAuthenticated = () => {
  const { isAuthenticated, user } = useAuthStore.getState();
  return isAuthenticated && user?.role === 'user';
};

const persistCart = async (items: CartItem[]) => {
  if (!isUserAuthenticated()) return;
  try {
    await cartApi.save(items);
  } catch {
    // Ignore persistence errors; local cart still works
  }
};

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (product, variant, qty = 1) => {
    const variantId = String(variant.id);
    const existing = get().items.find((i) => i.variant_id === variantId);
    if (existing) {
      const nextItems = get().items.map((i) =>
        i.variant_id === variantId
          ? { ...i, qty: Math.min(i.qty + qty, variant.stock) }
          : i
      );
      set({ items: nextItems });
      void persistCart(nextItems);
    } else {
      const nextItems = [
        ...get().items,
        {
          product_id: String(product.id),
          variant_id: variantId,
          slug: product.slug,
          name: product.name,
          brand: product.brand,
          image: product.images[0] ?? '',
          color: variant.color,
          storage: variant.storage,
          price: variant.price,
          mrp: variant.mrp,
          qty: Math.min(qty, variant.stock),
          stock: variant.stock,
          allow_cod: product.allow_cod,
          gst_rate: product.gst_rate ?? 18,   // ← added
        },
      ];
      set({ items: nextItems });
      void persistCart(nextItems);
    }
  },

  removeItem: (variantId) => {
    const nextItems = get().items.filter((i) => i.variant_id !== variantId);
    set({ items: nextItems });
    void persistCart(nextItems);
  },

  updateQty: (variantId, qty) => {
    const nextItems = get().items.map((i) =>
      i.variant_id === variantId
        ? { ...i, qty: Math.max(1, Math.min(qty, i.stock)) }
        : i
    );
    set({ items: nextItems });
    void persistCart(nextItems);
  },

  clearCart: () => {
    set({ items: [] });
    if (isUserAuthenticated()) {
      void cartApi.clear();
    }
  },

  clearLocal: () => set({ items: [] }),

  hydrateFromServer: async () => {
    if (!isUserAuthenticated()) return;
    try {
      const data = await cartApi.get();
      set({ items: data.items || [] });
    } catch {
      // Ignore; local cart still works
    }
  },

  totalItems: () => get().items.reduce((s, i) => s + i.qty, 0),
  subtotal: () => get().items.reduce((s, i) => s + i.price * i.qty, 0),
  mrpTotal: () => get().items.reduce((s, i) => s + i.mrp * i.qty, 0),
  savings: () => get().items.reduce((s, i) => s + (i.mrp - i.price) * i.qty, 0),
  allCodEligible: () => get().items.every((i) => i.allow_cod),
}));