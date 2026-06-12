import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product } from '../types/product';

const MAX_ITEMS = 10;

interface RecentlyViewedStore {
  items: Product[];
  trackView: (product: Product) => void;
  clear: () => void;
}

export const useRecentlyViewedStore = create<RecentlyViewedStore>()(
  persist(
    (set, get) => ({
      items: [],

      trackView: (product: Product) => {
        const current = get().items;
        // Remove if already exists (move-to-front)
        const filtered = current.filter((p) => p.id !== product.id);
        // Prepend and cap at MAX_ITEMS
        set({ items: [product, ...filtered].slice(0, MAX_ITEMS) });
      },

      clear: () => set({ items: [] }),
    }),
    {
      name: 'recently-viewed',
      partialize: (state) => ({ items: state.items }),
    }
  )
);