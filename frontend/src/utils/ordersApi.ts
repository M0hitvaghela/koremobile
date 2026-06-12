import { api } from './api';
import { getImageUrl } from './getImageUrl';

// ─── Types ─────────────────────────────────────────────────

export interface CartItemPayload {
  product_id: number;
  variant_id: number;
  quantity: number;
}

export interface CreateOrderPayload {
  items: CartItemPayload[];
  address_id: number;
  payment_method: 'cod' | 'online';
}

export interface OrderItemOut {
  product_id: number;
  product_name: string;
  variant_label: string | null;
  image_url: string | null;
  price: number;
  mrp: number;
  quantity: number;
  subtotal: number;
}

export interface OrderOut {
  id: number;
  order_number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  items: OrderItemOut[];
  address: Record<string, string>;
  subtotal: number;
  shipping_fee: number;
  total: number;
  tracking_number?: string;
  cancel_reason?: string;
  return_reason?: string;
  cashfree_order_id?: string;
  created_at: string;
}

export interface OrderListItem {
  id: number;
  order_number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  total: number;
  item_count: number;
  primary_image?: string;
  created_at: string;
}

export interface OnlineOrderResponse {
  order_id: number;
  order_number: string;
  payment_session_id: string;
  total: number;
}

export interface AddressPayload {
  label?: string;
  name: string;
  phone: string;
  house_no: string;
  area: string;
  village: string;
  taluka: string;
  district: string;
  pincode: string;
  state?: string;
  gstin?: string;
}

export interface AddressOut extends AddressPayload {
  id: number;
  is_default: boolean;
  state: string;
  label: string;
}

export interface ReviewPayload {
  product_id: number;
  order_id: number;
  rating: number;
  title: string;
  body: string;
}

export interface ReviewOut {
  id: number;
  product_id: number;
  user_id: number;
  rating: number;
  title: string;
  body: string;
  is_verified: boolean;
  user_name: string;
  created_at: string;
}

export interface ReviewSummary {
  avg_rating: number;
  total_reviews: number;
  rating_breakdown: Record<string, number>;
  reviews: ReviewOut[];
}

export interface ProfileUpdatePayload {
  name?: string;
  email?: string;
  phone?: string;
}

export interface UserProfileOut {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  is_verified: boolean;
  auth_method: string;
}

// ─── Helpers ───────────────────────────────────────────────

/** Normalize image URLs in an OrderOut so they always point to the backend. */
function normalizeOrderImages(order: OrderOut): OrderOut {
  return {
    ...order,
    items: order.items.map((item) => ({
      ...item,
      // ✅ FIX: relative /static/... → full backend URL
      image_url: item.image_url ? getImageUrl(item.image_url) : null,
    })),
  };
}

function normalizeOrderListImages(order: OrderListItem): OrderListItem {
  return {
    ...order,
    primary_image: order.primary_image ? getImageUrl(order.primary_image) : undefined,
  };
}

// ─── Orders API ────────────────────────────────────────────

export const ordersApi = {
  create: async (payload: CreateOrderPayload) => {
    const res = await api.post('/orders', payload);
    return res.data as OrderOut | OnlineOrderResponse;
  },

  list: async (page = 1, limit = 10) => {
    const res = await api.get<OrderListItem[]>('/orders', { params: { page, limit } });
    // ✅ FIX: normalize primary_image URLs in list
    return res.data.map(normalizeOrderListImages);
  },

  get: async (id: number) => {
    const res = await api.get<OrderOut>(`/orders/${id}`);
    // ✅ FIX: normalize item image_url values
    return normalizeOrderImages(res.data);
  },

  cancel: async (id: number, reason: string) => {
    const res = await api.post(`/orders/${id}/cancel`, { reason });
    return res.data;
  },

  return: async (id: number, reason: string, description: string) => {
    const res = await api.post(`/orders/${id}/return`, { reason, description });
    return res.data;
  },
};

// ─── Reviews API ───────────────────────────────────────────

export const reviewsApi = {
  getByProduct: async (productId: number) => {
    const res = await api.get<ReviewSummary>(`/reviews/product/${productId}`);
    return res.data;
  },

  create: async (payload: ReviewPayload) => {
    const res = await api.post<ReviewOut>('/reviews', payload);
    return res.data;
  },
};

// ─── User API ──────────────────────────────────────────────

export const userApi = {
  getProfile: async () => {
    const res = await api.get<UserProfileOut>('/users/profile');
    return res.data;
  },

  updateProfile: async (payload: ProfileUpdatePayload) => {
    const res = await api.put<UserProfileOut>('/users/profile', payload);
    return res.data;
  },

  getAddresses: async () => {
    const res = await api.get<AddressOut[]>('/users/addresses');
    return res.data;
  },

  addAddress: async (payload: AddressPayload) => {
    const res = await api.post<AddressOut>('/users/addresses', payload);
    return res.data;
  },

  updateAddress: async (id: number, payload: AddressPayload) => {
    const res = await api.put<AddressOut>(`/users/addresses/${id}`, payload);
    return res.data;
  },

  deleteAddress: async (id: number) => {
    const res = await api.delete(`/users/addresses/${id}`);
    return res.data;
  },

  setDefaultAddress: async (id: number) => {
    const res = await api.patch(`/users/addresses/${id}/default`);
    return res.data;
  },
};