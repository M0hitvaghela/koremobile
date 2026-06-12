import { create } from 'zustand';
import { settingsApi } from '../utils/settingsApi';

type SettingsData = {
  freeShippingThreshold: number;
  flatShippingFee: number;
  enableFreeShipping: boolean;
  defaultCodEnabled: boolean;
  defaultOnlineEnabled: boolean;
  gstRate: number;
};

interface SettingsStore extends SettingsData {
  loading: boolean;
  update: (data: Partial<SettingsData>) => void;
  fetchSettings: () => Promise<void>;
  calcShipping: (subtotal: number) => number;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  // Defaults shown until first API response arrives
  freeShippingThreshold: 10000,
  flatShippingFee: 50,
  enableFreeShipping: true,
  defaultCodEnabled: true,
  defaultOnlineEnabled: true,
  gstRate: 18,
  loading: false,

  update: (data) => set((state) => ({ ...state, ...data })),

  fetchSettings: async () => {
    if (get().loading) return; // prevent duplicate calls
    set({ loading: true });
    try {
      const data = await settingsApi.get();
      set({ ...data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  calcShipping: (subtotal) => {
    const s = get();
    if (s.enableFreeShipping && subtotal >= s.freeShippingThreshold) return 0;
    return s.flatShippingFee;
  },
}));