import { create } from 'zustand';
import { ordersApi, OrderOut, OrderListItem } from '../utils/ordersApi';

interface OrdersStore {
  orders: OrderListItem[];
  currentOrder: OrderOut | null;
  loading: boolean;
  error: string | null;

  fetchOrders: (page?: number) => Promise<void>;
  fetchOrder: (id: number) => Promise<OrderOut | null>;
  cancelOrder: (id: number, reason: string) => Promise<boolean>;
  returnOrder: (id: number, reason: string, description: string) => Promise<boolean>;
  clearCurrentOrder: () => void;
}

export const useOrdersStore = create<OrdersStore>((set, get) => ({
  orders: [],
  currentOrder: null,
  loading: false,
  error: null,

  fetchOrders: async (page = 1) => {
    set({ loading: true, error: null });
    try {
      const data = await ordersApi.list(page);
      set({ orders: data, loading: false });
    } catch {
      set({ error: 'Failed to load orders', loading: false });
    }
  },

  fetchOrder: async (id) => {
    set({ loading: true, error: null });
    try {
      const order = await ordersApi.get(id);
      set({ currentOrder: order, loading: false });
      return order;
    } catch {
      set({ error: 'Order not found', loading: false });
      return null;
    }
  },

  cancelOrder: async (id, reason) => {
    try {
      await ordersApi.cancel(id, reason);
      // Refresh list
      await get().fetchOrders();
      if (get().currentOrder?.id === id) {
        await get().fetchOrder(id);
      }
      return true;
    } catch {
      return false;
    }
  },

  returnOrder: async (id, reason, description) => {
    try {
      await ordersApi.return(id, reason, description);
      if (get().currentOrder?.id === id) {
        await get().fetchOrder(id);
      }
      return true;
    } catch {
      return false;
    }
  },

  clearCurrentOrder: () => set({ currentOrder: null }),
}));