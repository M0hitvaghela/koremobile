import axios, { type AxiosInstance } from 'axios';

// ─────────────────────────────────────────────────────────────────────────────
// All authentication is handled via httpOnly cookies set by the backend.
// withCredentials: true ensures the browser sends those cookies on every request.
// There is NO Authorization: Bearer header — no token stored client-side at all.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

export function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
}

// ── Global network-state notifier ─────────────────────────────────────────────
// Events:
//   'server-down'  — backend process is off / 5xx error (our fault)
//   'no-internet'  — browser has no network at all (user's fault)
//   'up'           — everything back to normal

type NetworkEvent = 'server-down' | 'no-internet' | 'up';
type NetworkHandler = () => void;

const listeners: Record<NetworkEvent, Set<NetworkHandler>> = {
  'server-down': new Set(),
  'no-internet': new Set(),
  'up':          new Set(),
};

export const networkBus = {
  on(event: NetworkEvent, fn: NetworkHandler) {
    listeners[event].add(fn);
  },
  off(event: NetworkEvent, fn: NetworkHandler) {
    listeners[event].delete(fn);
  },
  emit(event: NetworkEvent) {
    listeners[event].forEach((fn) => fn());
  },
};

// Debounce "up" so a single slow request doesn't flicker the banner away
let upTimer: ReturnType<typeof setTimeout> | null = null;

function notifyServerDown() {
  if (upTimer) { clearTimeout(upTimer); upTimer = null; }
  networkBus.emit('server-down');
}

function notifyNoInternet() {
  if (upTimer) { clearTimeout(upTimer); upTimer = null; }
  networkBus.emit('no-internet');
}

function notifyUp() {
  if (upTimer) return;
  upTimer = setTimeout(() => {
    upTimer = null;
    networkBus.emit('up');
  }, 1000);
}

// ── Axios factory ─────────────────────────────────────────────────────────────

export function createApiClient(baseURL = getApiBaseUrl()): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 30000,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.response.use(
    (response) => {
      notifyUp();
      return response;
    },
    (error) => {
      const status: number | undefined = error?.response?.status;

      if (!error.response) {
        // No response object at all — two sub-cases:
        if (!navigator.onLine) {
          // Browser itself says there's no internet → user's problem
          notifyNoInternet();
        } else {
          // Browser is online but got no response → our server is down
          notifyServerDown();
        }
      } else if (status && status >= 500) {
        // Got a response but it's a 5xx — server is alive but broken
        notifyServerDown();
      } else {
        // 4xx — server is fine, just a normal API error (wrong password etc.)
        notifyUp();
      }

      return Promise.reject(error);
    }
  );

  return client;
}

export const api = createApiClient();