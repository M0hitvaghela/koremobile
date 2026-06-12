export type GstRate = 0 | 5 | 12 | 18 | 28;

export interface ProductVariant {
  id: string;
  color: string;
  storage: string;
  price: number;       // GST-inclusive selling price
  mrp: number;         // GST-inclusive MRP
  stock: number;
  discount_percent?: number;
}

export interface ProductSpec {
  key: string;
  value: string;
}

export interface ProductBadge {
  key: string;
  label?: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: 'Mobiles' | 'Laptops' | 'TVs' | 'Tablets' | 'Accessories';
  description?: string;
  images: string[];
  variants: ProductVariant[];
  specifications: ProductSpec[];
  badges?: ProductBadge[];
  allow_cod: boolean;
  allow_online: boolean;
  rating: number;
  review_count: number;
  is_active: boolean;
  created_at: string;

  // ── GST fields ──────────────────────────────────────────────────────────────
  gst_rate: GstRate;      // e.g. 18
  hsn_code?: string;      // 8-digit HSN code
  gst_label?: string;     // e.g. "GST 18%" — computed by backend
  // ─────────────────────────────────────────────────────────────────────────────
}

export interface ProductListItem {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  primary_image?: string;
  min_price: number;
  max_price: number;
  min_mrp: number;
  max_discount_percent: number;
  is_active: boolean;
  allow_cod: boolean;
  allow_online: boolean;
  avg_rating: number;
  review_count: number;
  in_stock: boolean;

  // ── GST fields ──────────────────────────────────────────────────────────────
  gst_rate: GstRate;
  hsn_code?: string;
  // ─────────────────────────────────────────────────────────────────────────────
}

export interface Review {
  id: string;
  product_id: string;
  user_name: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  verified_purchase: boolean;
}

// ── GST calculation utilities ─────────────────────────────────────────────────
// Prices stored/shown are GST-inclusive. Use these to derive the breakdown.

export interface GstBreakdown {
  basePrice: number;   // price before GST
  gstAmount: number;   // GST portion
  gstRate: number;     // e.g. 18
  inclusivePrice: number;  // what customer pays
}

/**
 * Break a GST-inclusive price into base + GST components.
 * Formula: base = price / (1 + rate/100)
 */
export function calcGstBreakdown(inclusivePrice: number, gstRate: number): GstBreakdown {
  if (gstRate <= 0) {
    return { basePrice: inclusivePrice, gstAmount: 0, gstRate, inclusivePrice };
  }
  const base = parseFloat((inclusivePrice / (1 + gstRate / 100)).toFixed(2));
  const gst = parseFloat((inclusivePrice - base).toFixed(2));
  return { basePrice: base, gstAmount: gst, gstRate, inclusivePrice };
}

/**
 * Format a GST rate for display: 18 → "18%"
 */
export function formatGstRate(rate: number): string {
  return `${rate}%`;
}
