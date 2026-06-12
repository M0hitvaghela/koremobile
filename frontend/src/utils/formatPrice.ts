export const formatINR = (price: number): string => {
  if (typeof price !== 'number' || isNaN(price)) return '₹0';
  return '₹' + price.toLocaleString('en-IN');
};

export const calcDiscount = (mrp: number, price: number): number => {
  if (!mrp || mrp <= 0 || price >= mrp) return 0;
  return Math.round((mrp - price) / mrp * 100);
};

// ── GST helpers ───────────────────────────────────────────────────────────────
// All prices in DB are GST-inclusive. These helpers derive the breakdown.

export interface GstBreakdown {
  basePrice: number;      // price before GST (taxable value)
  gstAmount: number;      // total GST portion
  cgst: number;           // CGST = gstAmount / 2 (intra-state)
  sgst: number;           // SGST = gstAmount / 2 (intra-state)
  inclusivePrice: number; // what customer pays (unchanged)
  gstRate: number;        // e.g. 18
}

/**
 * Split a GST-inclusive price into base + GST components.
 * Formula: base = price / (1 + rate/100)
 */
export function calcGstBreakdown(inclusivePrice: number, gstRate: number): GstBreakdown {
  if (!gstRate || gstRate <= 0) {
    return { basePrice: inclusivePrice, gstAmount: 0, cgst: 0, sgst: 0, inclusivePrice, gstRate: 0 };
  }
  const base = parseFloat((inclusivePrice / (1 + gstRate / 100)).toFixed(2));
  const gst = parseFloat((inclusivePrice - base).toFixed(2));
  const half = parseFloat((gst / 2).toFixed(2));
  return { basePrice: base, gstAmount: gst, cgst: half, sgst: half, inclusivePrice, gstRate };
}

/**
 * Format GST rate for display: 18 → "GST 18%"
 */
export function formatGstRate(rate: number): string {
  return `GST ${rate}%`;
}
