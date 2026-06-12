import { create } from 'zustand';
import { adminApi } from '../utils/adminApi';
import { getImageUrl } from '../utils/getImageUrl';

// ── Types ──────────────────────────────────────────────────────────────────

export type AdminOrderStatus =
  | 'placed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'return_requested'
  | 'returned';

export interface AdminOrderAddress {
  name: string;
  phone: string;
  house_no: string;
  area: string;
  village: string;
  taluka: string;
  district: string;
  pincode: string;
  state: string;
  gstin?: string;
}

export interface AdminOrderItem {
  product_name: string;
  variant_label: string;
  image_url: string | null;
  price: number;
  mrp: number;
  quantity: number;
}

export interface AdminOrderListItem {
  id: number;
  order_number: string;
  status: AdminOrderStatus;
  payment_method: string;
  payment_status: string;
  total: number;
  subtotal: number;
  shipping_fee: number;
  item_count: number;
  address: AdminOrderAddress;
  tracking_number: string | null;
  created_at: string;
}

export interface AdminOrderDetail extends AdminOrderListItem {
  items: AdminOrderItem[];
  cancel_reason: string | null;
  return_reason: string | null;
  cashfree_order_id: string | null;
}

export interface AdminOrderStats {
  total_orders: number;
  total_revenue: number;
  pending_count: number;
}

// ── Store ──────────────────────────────────────────────────────────────────

interface AdminOrdersStore {
  orders: AdminOrderListItem[];
  currentOrder: AdminOrderDetail | null;
  stats: AdminOrderStats | null;
  loading: boolean;
  detailLoading: boolean;
  total: number;
  page: number;
  pages: number;

  fetchOrders: (page?: number, status?: string, search?: string) => Promise<void>;
  fetchOrder: (id: number) => Promise<AdminOrderDetail | null>;
  fetchStats: () => Promise<void>;
  updateStatus: (id: number, status: AdminOrderStatus) => Promise<true | string>;
  updateTracking: (id: number, tracking: string) => Promise<boolean>;
}

function normalizeOrder<T extends { items?: AdminOrderItem[] }>(order: T): T {
  if (order.items) {
    return {
      ...order,
      items: order.items.map((i) => ({
        ...i,
        image_url: i.image_url ? getImageUrl(i.image_url) : null,
      })),
    };
  }
  return order;
}

export const useAdminOrdersStore = create<AdminOrdersStore>((set, get) => ({
  orders: [],
  currentOrder: null,
  stats: null,
  loading: false,
  detailLoading: false,
  total: 0,
  page: 1,
  pages: 1,

  fetchOrders: async (page = 1, status = 'all', search = '') => {
    set({ loading: true });
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(status && status !== 'all' ? { status } : {}),
        ...(search ? { search } : {}),          // ← NEW
      });
      const res = await adminApi.get<{
        orders: AdminOrderListItem[];
        total: number;
        page: number;
        pages: number;
      }>(`/admin/orders?${params}`);
      set({
        orders: res.data.orders,
        total: res.data.total,
        page: res.data.page,
        pages: res.data.pages,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },
  fetchOrder: async (id) => {
    set({ detailLoading: true });
    try {
      const res = await adminApi.get<AdminOrderDetail>(`/admin/orders/${id}`);
      const order = normalizeOrder(res.data);
      set({ currentOrder: order, detailLoading: false });
      return order;
    } catch {
      set({ detailLoading: false });
      return null;
    }
  },

  fetchStats: async () => {
    try {
      const res = await adminApi.get<AdminOrderStats>('/admin/orders/stats');
      set({ stats: res.data });
    } catch {
      // fail silently — dashboard still shows products count
    }
  },

  updateStatus: async (id, status) => {
    try {
      await adminApi.patch(`/admin/orders/${id}/status`, { status });
      set((s) => ({
        orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)),
        currentOrder:
          s.currentOrder?.id === id
            ? { ...s.currentOrder, status }
            : s.currentOrder,
      }));
      return true;
    } catch (err: any) {
      // Return backend error message if available
      const detail = err?.response?.data?.detail;
      return typeof detail === 'string' ? detail : 'Failed to update status';
    }
  },

  updateTracking: async (id, tracking_number) => {
    try {
      await adminApi.patch(`/admin/orders/${id}/tracking`, { tracking_number });
      set((s) => ({
        currentOrder:
          s.currentOrder?.id === id
            ? { ...s.currentOrder, tracking_number }
            : s.currentOrder,
      }));
      return true;
    } catch {
      return false;
    }
  },
}));