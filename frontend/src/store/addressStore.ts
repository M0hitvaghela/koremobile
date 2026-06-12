import { create } from 'zustand';
import { userApi, AddressOut, AddressPayload } from '../utils/ordersApi';

interface AddressStore {
  addresses: AddressOut[];
  loading: boolean;
  error: string | null;

  fetchAddresses: () => Promise<void>;
  addAddress: (payload: AddressPayload) => Promise<AddressOut | null>;
  updateAddress: (id: number, payload: AddressPayload) => Promise<AddressOut | null>;
  deleteAddress: (id: number) => Promise<boolean>;
  setDefault: (id: number) => Promise<boolean>;
  defaultAddress: () => AddressOut | undefined;
}

export const useAddressStore = create<AddressStore>((set, get) => ({
  addresses: [],
  loading: false,
  error: null,

  fetchAddresses: async () => {
    set({ loading: true, error: null });
    try {
      const data = await userApi.getAddresses();
      set({ addresses: data, loading: false });
    } catch {
      set({ error: 'Failed to load addresses', loading: false });
    }
  },

  addAddress: async (payload) => {
    try {
      const addr = await userApi.addAddress(payload);
      set({ addresses: [...get().addresses, addr] });
      return addr;
    } catch {
      return null;
    }
  },

  updateAddress: async (id, payload) => {
    try {
      const updated = await userApi.updateAddress(id, payload);
      set({
        addresses: get().addresses.map((a) => (a.id === id ? updated : a)),
      });
      return updated;
    } catch {
      return null;
    }
  },

  deleteAddress: async (id) => {
    try {
      await userApi.deleteAddress(id);
      set({ addresses: get().addresses.filter((a) => a.id !== id) });
      return true;
    } catch {
      return false;
    }
  },

  setDefault: async (id) => {
    try {
      await userApi.setDefaultAddress(id);
      set({
        addresses: get().addresses.map((a) => ({
          ...a,
          is_default: a.id === id,
        })),
      });
      return true;
    } catch {
      return false;
    }
  },

  defaultAddress: () => get().addresses.find((a) => a.is_default),
}));