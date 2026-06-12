import { createApiClient, getApiBaseUrl } from './api';
import { getImageUrl } from './getImageUrl';

const DEFAULT_ADMIN_API_BASE_URL = getApiBaseUrl();

export function getAdminApiBaseUrl() {
  return import.meta.env.VITE_ADMIN_API_BASE_URL || DEFAULT_ADMIN_API_BASE_URL;
}

export const adminApi = createApiClient(getAdminApiBaseUrl());

// ── Payload types ─────────────────────────────────────────────────────────────

export interface VariantPayload {
  color: string;
  storage: string;
  price: number;
  mrp: number;
  stock: number;
}

export interface VariantUpsertPayload {
  id?: number;
  color: string;
  storage: string;
  price: number;
  mrp: number;
  stock: number;
}

export interface SpecPayload {
  spec_key: string;
  spec_value: string;
  display_order: number;
}

export interface BadgePayload {
  badge_key: string;
  label?: string;
  display_order: number;
}

export interface CreateProductPayload {
  name: string;
  brand: string;
  category: string;
  description?: string;
  allow_cod: boolean;
  allow_online: boolean;
  is_active: boolean;
  variants: VariantPayload[];
  specifications: SpecPayload[];
  badges?: BadgePayload[];
}

export interface UpdateProductPayload {
  name?: string;
  brand?: string;
  category?: string;
  description?: string;
  allow_cod?: boolean;
  allow_online?: boolean;
  is_active?: boolean;
  variants?: VariantUpsertPayload[];
  specifications?: SpecPayload[];
  badges?: BadgePayload[];
}

export interface ProductOutAPI {
  id: number;
  name: string;
  slug: string;
  brand: string;
  category: string;
  description?: string;
  images: string[];
  variants: {
    id: number;
    color: string;
    storage: string;
    price: number;
    mrp: number;
    stock: number;
    is_active: boolean;
  }[];
  specifications: {
    id: number;
    spec_key: string;
    spec_value: string;
    display_order: number;
  }[];
  badges?: {
    id: number;
    badge_key: string;
    label?: string | null;
    display_order: number;
  }[];
  allow_cod: boolean;
  allow_online: boolean;
  is_active: boolean;
  avg_rating: number;
  review_count: number;
}

export interface UploadedImageAPI {
  id: number;
  url: string;
  display_order: number;
}

export interface ImageWithId {
  id: number;
  url: string;
  display_order: number;
}

export const adminProductsApi = {
  create: async (payload: CreateProductPayload): Promise<ProductOutAPI> => {
    const res = await adminApi.post<ProductOutAPI>('/admin/products', payload);
    return res.data;
  },
  getById: async (id: number): Promise<ProductOutAPI> => {
    const res = await adminApi.get<ProductOutAPI>(`/admin/products/${id}`);
    return res.data;
  },
  update: async (id: number, payload: UpdateProductPayload): Promise<ProductOutAPI> => {
    const res = await adminApi.put<ProductOutAPI>(`/admin/products/${id}`, payload);
    return res.data;
  },
  delete: async (id: number): Promise<void> => {
    await adminApi.delete(`/admin/products/${id}`);
  },
  uploadImage: async (productId: number, file: File): Promise<UploadedImageAPI> => {
    const form = new FormData();
    form.append('file', file);
    const res = await adminApi.post<UploadedImageAPI>(
      `/admin/products/${productId}/images`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data;
  },
  deleteImage: async (productId: number, imageId: number): Promise<void> => {
    await adminApi.delete(`/admin/products/${productId}/images/${imageId}`);
  },
  unlinkImage: async (productId: number, imageId: number): Promise<void> => {
    await adminApi.delete(`/admin/products/${productId}/images/${imageId}/unlink`);
  },
  getImages: async (productId: number): Promise<ImageWithId[]> => {
    const res = await adminApi.get<ImageWithId[]>(`/admin/products/${productId}/images`);
    return res.data;
  },
  linkServerImage: async (productId: number, url: string): Promise<UploadedImageAPI> => {
    const res = await adminApi.post<UploadedImageAPI>(
      `/admin/products/${productId}/images/link`,
      { url }
    );
    return res.data;
  },
  reorderImages: async (
    productId: number,
    payload: Array<{ id: number; display_order: number }>
  ): Promise<void> => {
    await adminApi.patch(`/admin/products/${productId}/images/reorder`, payload);
  },
};

// ── Settings API ──────────────────────────────────────────────────────────────

export interface SettingsPayload {
  freeShippingThreshold: number;
  flatShippingFee: number;
  enableFreeShipping: boolean;
  defaultCodEnabled: boolean;
  defaultOnlineEnabled: boolean;
}

export const adminSettingsApi = {
  get: async (): Promise<SettingsPayload> => {
    const res = await adminApi.get<SettingsPayload>('/admin/settings');
    return res.data;
  },
  update: async (payload: SettingsPayload): Promise<void> => {
    await adminApi.put('/admin/settings', payload);
  },
};

// ── User Management API ───────────────────────────────────────────────────────

export interface AdminUserItem {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  auth_method: string;
  is_active: boolean;
  is_blocked: boolean;
  blocked_reason: string | null;
  blocked_at: string | null;
  created_at: string | null;
  total_orders: number;
  return_count: number;
}

export interface AdminUserDetail extends AdminUserItem {
  orders: {
    id: number;
    order_number: string;
    status: string;
    payment_method: string;
    payment_status: string;
    total: number;
    return_reason: string | null;
    created_at: string | null;
  }[];
}

export interface AdminUsersListResponse {
  users: AdminUserItem[];
  total: number;
  page: number;
  pages: number;
}

export const adminUsersApi = {
  list: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    blocked?: boolean;
  }): Promise<AdminUsersListResponse> => {
    const q = new URLSearchParams();
    if (params?.page)    q.set('page', String(params.page));
    if (params?.limit)   q.set('limit', String(params.limit));
    if (params?.search)  q.set('search', params.search);
    if (params?.blocked !== undefined) q.set('blocked', String(params.blocked));
    const res = await adminApi.get<AdminUsersListResponse>(`/admin/users?${q}`);
    return res.data;
  },

  getById: async (id: number): Promise<AdminUserDetail> => {
    const res = await adminApi.get<AdminUserDetail>(`/admin/users/${id}`);
    return res.data;
  },

  block: async (id: number, reason: string): Promise<void> => {
    await adminApi.post(`/admin/users/${id}/block`, { reason });
  },

  unblock: async (id: number): Promise<void> => {
    await adminApi.post(`/admin/users/${id}/unblock`, {});
  },
};
