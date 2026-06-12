export interface Address {
  id?: string;
  name: string;
  phone: string;
  house_no: string;
  area: string;
  village: string;
  taluka: string;
  district: string;
  pincode: string;
  state: string;
  label: 'Home' | 'Work' | 'Other';
  is_default: boolean;
  gstin?: string;
  company_name?: string;
}

export interface OrderItem {
  product_id: string;
  variant_id: string;
  product_name: string;
  variant_label?: string;
  image_url?: string;

  price: number;          // GST-inclusive selling price per unit
  mrp: number;            // GST-inclusive MRP per unit
  quantity: number;

  // ── GST breakdown (computed by backend) ─────────────────────────────────────
  gst_rate: number;       // e.g. 18.0
  hsn_code?: string;
  base_price: number;     // price ex-GST per unit
  gst_amount: number;     // GST per unit

  // computed fields from backend
  subtotal: number;          // price × qty
  taxable_subtotal: number;  // base_price × qty
  gst_subtotal: number;      // gst_amount × qty
  cgst_amount: number;       // gst_subtotal / 2
  sgst_amount: number;       // gst_subtotal / 2
  gst_label: string;         // e.g. "GST 18%"
  // ─────────────────────────────────────────────────────────────────────────────
}

export type OrderStatus =
  | 'placed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'return_requested'
  | 'returned';

export type PaymentMethod = 'cod' | 'online';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  items: OrderItem[];
  address: Address;

  subtotal: number;       // GST-inclusive subtotal
  shipping_fee: number;
  total: number;          // final payable

  // ── GST summary ─────────────────────────────────────────────────────────────
  taxable_amount: number; // total before GST
  total_gst: number;      // total GST collected
  total_cgst: number;     // computed: total_gst / 2
  total_sgst: number;     // computed: total_gst / 2
  // ─────────────────────────────────────────────────────────────────────────────

  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: OrderStatus;
  tracking_number?: string;
  created_at: string;
  cancel_reason?: string;
  return_reason?: string;
  cashfree_order_id?: string;
}

// ── Bill/Invoice data shape for PDF generation ───────────────────────────────
export interface InvoiceData {
  order: Order;
  seller: {
    name: string;
    address: string;
    gstin: string;
    state: string;
    stateCode: string;
  };
}
