import { create } from 'zustand';
import { authApi } from '../utils/authApi';
import type { User } from '../types/user';
import type { Address } from '../types/order';

interface AuthResult {
  success: boolean;
  role?: 'user' | 'admin';
  error?: string;
}

interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
}

interface RegisterEmailOtpResult {
  success: boolean;
  error?: string;
  otpSent?: boolean;
  verified?: boolean;
}

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isHydrating: boolean;

  login: (email: string, password: string) => Promise<AuthResult>;
  adminLogin: (username: string, password: string) => Promise<AuthResult>;
  register: (data: RegisterInput) => Promise<AuthResult>;
  sendRegisterEmailOtp: (email: string) => Promise<RegisterEmailOtpResult>;
  verifyRegisterEmailOtp: (email: string, otp: string) => Promise<RegisterEmailOtpResult>;
  sendLoginOtp: (phone: string) => Promise<AuthResult>;
  verifyLoginOtp: (phone: string, otp: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  adminLogout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => void;
  addAddress: (address: Address) => void;
  updateAddress: (index: number, address: Address) => void;
  deleteAddress: (index: number) => void;
  setDefaultAddress: (index: number) => void;
  hydrate: () => Promise<void>;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isHydrating: true,

  // ── User login ──────────────────────────────────────────────────────────
  login: async (email, password) => {
    try {
      await authApi.loginEmail({ email: normalizeEmail(email), password });
      const profile = await authApi.me();
      const user: User = {
        id: String(profile.id),
        name: profile.name,
        email: profile.email || normalizeEmail(email),
        phone: profile.phone || '',
        role: 'user',
        addresses: [],
      };
      set({ user, isAuthenticated: true });
      return { success: true, role: 'user' };
    } catch {
      return { success: false, error: 'Invalid email or password' };
    }
  },

  // ── Admin login ─────────────────────────────────────────────────────────
  adminLogin: async (username, password) => {
    try {
      await authApi.adminLogin({ username: username.trim(), password });
      const profile = await authApi.adminMe();
      const user: User = {
        id: String(profile.id),
        name: profile.username,
        email: profile.email || '',
        phone: '',
        role: 'admin',
        addresses: [],
      };
      set({ user, isAuthenticated: true });
      return { success: true, role: 'admin' };
    } catch {
      return { success: false, error: 'Invalid admin credentials' };
    }
  },

  // ── Register ────────────────────────────────────────────────────────────
  register: async ({ name, email, phone, password }) => {
    try {
      // ✅ FIX — phone is now passed to the API
      await authApi.registerEmail({ name, email: normalizeEmail(email), phone, password });
      const profile = await authApi.me();
      const user: User = {
        id: String(profile.id),
        name: profile.name,
        email: profile.email || normalizeEmail(email),
        phone: profile.phone || phone,
        role: 'user',
        addresses: [],
      };
      set({ user, isAuthenticated: true });
      return { success: true, role: 'user' };
    } catch {
      return { success: false, error: 'Unable to create account' };
    }
  },

  sendRegisterEmailOtp: async (email) => {
    try {
      await authApi.sendRegisterEmailOtp({ email: normalizeEmail(email) });
      return { success: true, otpSent: true };
    } catch {
      return { success: false, error: 'Unable to send verification code' };
    }
  },

  verifyRegisterEmailOtp: async (email, otp) => {
    try {
      await authApi.verifyRegisterEmailOtp({ email: normalizeEmail(email), otp });
      return { success: true, verified: true };
    } catch {
      return { success: false, error: 'Invalid verification code' };
    }
  },

  sendLoginOtp: async (phone) => {
    try {
      await authApi.loginOtpSend({ phone });
      return { success: true, role: 'user' };
    } catch {
      return { success: false, error: 'Unable to send OTP' };
    }
  },

  verifyLoginOtp: async (phone, otp) => {
    try {
      await authApi.loginOtpVerify({ phone, otp });
      const profile = await authApi.me();
      const user: User = {
        id: String(profile.id),
        name: profile.name,
        email: profile.email || '',
        phone: profile.phone || phone,
        role: 'user',
        addresses: [],
      };
      set({ user, isAuthenticated: true });
      return { success: true, role: 'user' };
    } catch {
      return { success: false, error: 'Invalid OTP' };
    }
  },

  // ── Logout ──────────────────────────────────────────────────────────────
  logout: async () => {
    try {
      await authApi.logout();
    } catch { /* ignore */ }
    set({ user: null, isAuthenticated: false });
  },

  adminLogout: async () => {
    try {
      await authApi.adminLogout();
    } catch { /* ignore */ }
    set({ user: null, isAuthenticated: false });
  },

  // ── Profile helpers ─────────────────────────────────────────────────────
  updateProfile: (data) => {
    const u = get().user;
    if (!u) return;
    set({ user: { ...u, ...data } });
  },

  addAddress: (address) => {
    const u = get().user;
    if (!u) return;
    const addresses = [...u.addresses];
    const next = { ...address };
    if (next.is_default) addresses.forEach((a) => (a.is_default = false));
    if (addresses.length === 0) next.is_default = true;
    addresses.push(next);
    set({ user: { ...u, addresses } });
  },

  updateAddress: (index, address) => {
    const u = get().user;
    if (!u) return;
    const addresses = [...u.addresses];
    const next = { ...address };
    if (next.is_default) addresses.forEach((a) => (a.is_default = false));
    addresses[index] = next;
    set({ user: { ...u, addresses } });
  },

  deleteAddress: (index) => {
    const u = get().user;
    if (!u) return;
    const addresses = u.addresses.filter((_, i) => i !== index);
    if (addresses.length > 0 && !addresses.some((a) => a.is_default)) {
      addresses[0].is_default = true;
    }
    set({ user: { ...u, addresses } });
  },

  setDefaultAddress: (index) => {
    const u = get().user;
    if (!u) return;
    const addresses = u.addresses.map((a, i) => ({ ...a, is_default: i === index }));
    set({ user: { ...u, addresses } });
  },

  // ── Hydrate ──────────────────────────────────────────────────────────────
  hydrate: async () => {
    set({ isHydrating: true });
    try {
      try {
        const profile = await authApi.me();
        const user: User = {
          id: String(profile.id),
          name: profile.name,
          email: profile.email || '',
          phone: profile.phone || '',
          role: 'user',
          addresses: [],
        };
        set({ user, isAuthenticated: true, isHydrating: false });
        return;
      } catch {
        // Not a user session — try admin
      }

      try {
        const profile = await authApi.adminMe();
        const user: User = {
          id: String(profile.id),
          name: profile.username,
          email: profile.email || '',
          phone: '',
          role: 'admin',
          addresses: [],
        };
        set({ user, isAuthenticated: true, isHydrating: false });
        return;
      } catch {
        // Not an admin session either
      }

      set({ user: null, isAuthenticated: false, isHydrating: false });
    } catch {
      set({ user: null, isAuthenticated: false, isHydrating: false });
    }
  },
}));