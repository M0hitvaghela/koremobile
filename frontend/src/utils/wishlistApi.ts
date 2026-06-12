import { api } from './api';

export interface WishlistProduct {
  id: number;
  slug: string;
  name: string;
  brand: string;
  category: string;
  primary_image?: string;
  min_price: number;
  min_mrp: number;
  max_discount_percent: number;
  in_stock: boolean;
  avg_rating: number;
  review_count: number;
}

export interface WishlistItem {
  id: number;
  product_id: number;
  added_at: string;
  product: WishlistProduct;
}

export interface WishlistData {
  id: number;
  user_id: number;
  share_token: string;
  share_url: string;
  title: string;
  is_public: boolean;
  item_count: number;
  items: WishlistItem[];
  created_at: string;
  updated_at: string;
}

export interface PublicWishlistData {
  share_token: string;
  title: string;
  item_count: number;
  items: WishlistItem[];
}

export const wishlistApi = {
  /** Get my wishlist (auto-creates on first call after login) */
  getMyWishlist: () =>
    api.get<WishlistData>('/wishlist').then((r) => r.data),

  /** Add product — returns updated wishlist */
  addItem: (productId: number) =>
    api.post<WishlistData>(`/wishlist/items/${productId}`).then((r) => r.data),

  /** Remove product — returns updated wishlist */
  removeItem: (productId: number) =>
    api.delete<WishlistData>(`/wishlist/items/${productId}`).then((r) => r.data),

  /** Clear all items */
  clearAll: () => api.delete('/wishlist'),

  /** Rename wishlist */
  updateTitle: (title: string) =>
    api.patch<WishlistData>('/wishlist/title', { title }).then((r) => r.data),

  /** Toggle public/private */
  updateVisibility: (is_public: boolean) =>
    api.patch<WishlistData>('/wishlist/visibility', { is_public }).then((r) => r.data),

  /** Public share — no auth needed */
  getShared: (shareToken: string) =>
    api.get<PublicWishlistData>(`/wishlist/share/${shareToken}`).then((r) => r.data),
};