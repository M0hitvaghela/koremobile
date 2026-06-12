import { api } from './api';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface CarrierRate {
  logistic_name: string;
  rate: number;
  delivery_tat: string;
  cod: string;
  prepaid: string;
}

export interface RateCheckResult {
  to_pincode: string;
  from_pincode: string;
  weight_kg: number;
  carriers: CarrierRate[];
}

export interface CreateShipmentPayload {
  weight_kg: number;
  length?: number;
  width?: number;
  height?: number;
  logistics?: string;       // "" = auto, or "delhivery","xpressbees" etc.
  eway_bill_number?: string; // required for orders > ₹50,000
}

export interface CreateShipmentResult {
  message: string;
  itl_order_id: string;
  itl_awb_number: string;
  itl_logistic_name: string;
  itl_tracking_url: string;
}

export interface SyncTrackingResult {
  message: string;
  current_status: string;
  current_status_code: string;
  expected_delivery_date: string | null;
  order_status: string;
}

export interface TrackingInfo {
  has_shipment: boolean;
  message?: string;
  itl_awb_number?: string;
  itl_logistic_name?: string;
  itl_tracking_url?: string;
  itl_current_status?: string;
  itl_current_status_code?: string;
  itl_expected_delivery_date?: string | null;
  itl_last_synced_at?: string | null;
  scan_details?: ScanEvent[];
}

export interface ScanEvent {
  status: string;
  status_code: string;
  scan_location: string;
  remark: string;
  scan_date_time: string;
  status_reason?: string;
}

// ─── Admin: Get carrier rates before creating shipment ────────────────────────
export async function adminGetRates(
  orderId: number,
  weight_kg: number,
  length = 10,
  width = 10,
  height = 5,
): Promise<RateCheckResult> {
  const res = await api.post(`/admin/shipping/${orderId}/rates`, {
    weight_kg, length, width, height,
  });
  return res.data;
}

// ─── Admin: Create shipment ───────────────────────────────────────────────────
export async function adminCreateShipment(
  orderId: number,
  payload: CreateShipmentPayload,
): Promise<CreateShipmentResult> {
  const res = await api.post(`/admin/shipping/${orderId}/create`, payload);
  return res.data;
}

// ─── Admin: Get label PDF URL ─────────────────────────────────────────────────
export async function adminGetLabel(orderId: number): Promise<{ label_url: string; awb_number: string }> {
  const res = await api.get(`/admin/shipping/${orderId}/label`);
  return res.data;
}

// ─── Admin: Sync tracking from ITL ───────────────────────────────────────────
export async function adminSyncTracking(orderId: number): Promise<SyncTrackingResult> {
  const res = await api.post(`/admin/shipping/${orderId}/sync`);
  return res.data;
}

// ─── Admin: Cancel shipment on ITL ───────────────────────────────────────────
export async function adminCancelShipment(orderId: number): Promise<{ message: string }> {
  const res = await api.post(`/admin/shipping/${orderId}/cancel`);
  return res.data;
}

// ─── Admin: Generate manifest PDF for multiple AWBs ──────────────────────────
export async function adminGenerateManifest(
  awbNumbers: string[],
): Promise<{ manifest_url: string; awb_count: number }> {
  const res = await api.post('/admin/shipping/manifest', { awb_numbers: awbNumbers });
  return res.data;
}

// ─── Admin: Check pincode serviceability ─────────────────────────────────────
export async function adminCheckPincode(pincode: string): Promise<unknown> {
  const res = await api.get(`/admin/shipping/pincode/${pincode}`);
  return res.data;
}

// ─── User: Get tracking info for own order ───────────────────────────────────
export async function getOrderTracking(orderId: number): Promise<TrackingInfo> {
  const res = await api.get(`/orders/${orderId}/track`);
  return res.data;
}