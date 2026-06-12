import { api } from './api';
import { getImageUrl } from './getImageUrl';
import type { CartItem } from '../store/cartStore';

interface CartResponse {
  items: CartItem[];
}

function normalizeItems(items: CartItem[]): CartItem[] {
  return items.map((item) => ({
    ...item,
    image: getImageUrl(item.image),
  }));
}

export const cartApi = {
  get: async (): Promise<CartResponse> => {
    const res = await api.get<CartResponse>('/cart');
    return { items: normalizeItems(res.data.items || []) };
  },

  save: async (items: CartItem[]) => {
    const payload = {
      items: items.map((i) => ({
        product_id: Number(i.product_id),
        variant_id: Number(i.variant_id),
        qty: Number(i.qty),
      })),
    };
    const res = await api.post('/cart', payload);
    return res.data;
  },

  clear: async () => {
    const res = await api.delete('/cart');
    return res.data;
  },
};
