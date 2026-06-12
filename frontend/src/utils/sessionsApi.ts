/**
 * utils/sessionsApi.ts
 * Uses your existing axios instance from api.ts.
 * NOTE: api instance baseURL is already /api/v1 — paths here must NOT repeat it.
 * Cookies sent automatically via withCredentials: true in the axios instance.
 */
import { api } from "./api";

export interface SessionInfo {
  id: number;
  device_info: string | null;
  ip_address: string | null;
  created_at: string;
  last_used: string;
  is_current: boolean;
}

// ── User ─────────────────────────────────────────────────────────────────────
export const fetchUserSessions = (): Promise<SessionInfo[]> =>
  api.get("/auth/sessions").then(r => r.data);

export const revokeUserSession = (id: number): Promise<void> =>
  api.delete(`/auth/sessions/${id}`);

export const logoutAllUserDevices = (): Promise<void> =>
  api.delete("/auth/sessions/all");

export const logoutCurrentUser = (): Promise<void> =>
  api.post("/auth/logout");

// ── Admin ─────────────────────────────────────────────────────────────────────
export const fetchAdminSessions = (): Promise<SessionInfo[]> =>
  api.get("/admin/auth/sessions").then(r => r.data);

export const revokeAdminSession = (id: number): Promise<void> =>
  api.delete(`/admin/auth/sessions/${id}`);

export const logoutAllAdminDevices = (): Promise<void> =>
  api.delete("/admin/auth/sessions/all");

export const logoutCurrentAdmin = (): Promise<void> =>
  api.post("/admin/auth/logout");