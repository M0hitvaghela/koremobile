import { api } from './api';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface RegisterEmailPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface RegisterEmailOtpPayload {
  email: string;
}

export interface RegisterEmailOtpVerifyPayload {
  email: string;
  otp: string;
}

export interface RegisterOtpPayload {
  name: string;
  phone: string;
}

export interface LoginEmailPayload {
  email: string;
  password: string;
}

export interface OtpSendPayload {
  phone: string;
}

export interface OtpVerifyPayload {
  phone: string;
  otp: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ForgotPasswordVerifyPayload {
  email: string;
  otp: string;
}

export interface ResetPasswordPayload {
  email: string;
  otp: string;
  new_password: string;
}

export interface AdminLoginPayload {
  username: string;
  password: string;
}

export interface CurrentUserResponse {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  is_verified: boolean;
  auth_method: string;
}

export interface CurrentAdminResponse {
  id: number;
  username: string;
  email: string | null;
  role: 'admin';
  last_login: string | null;
}

export const authApi = {
  // ── User auth ─────────────────────────────────────────────────────────────

  registerEmail: async (payload: RegisterEmailPayload): Promise<TokenResponse> => {
    const response = await api.post<TokenResponse>('/auth/register/email', payload);
    return response.data;
  },

  sendRegisterEmailOtp: async (payload: RegisterEmailOtpPayload) => {
    const response = await api.post('/auth/register/email/send-otp', payload);
    return response.data;
  },

  verifyRegisterEmailOtp: async (payload: RegisterEmailOtpVerifyPayload) => {
    const response = await api.post('/auth/register/email/verify', payload);
    return response.data;
  },

  registerOtp: async (payload: RegisterOtpPayload) => {
    const response = await api.post('/auth/register/otp', payload);
    return response.data;
  },

  loginEmail: async (payload: LoginEmailPayload): Promise<TokenResponse> => {
    const response = await api.post<TokenResponse>('/auth/login/email', payload);
    return response.data;
    // NOTE: We intentionally do NOT store response.data.access_token anywhere.
    // The backend sets an httpOnly cookie automatically. The token in the body
    // is only returned for Swagger/API client compatibility.
  },

  loginOtpSend: async (payload: OtpSendPayload) => {
    const response = await api.post('/auth/login/otp/send', payload);
    return response.data;
  },

  loginOtpVerify: async (payload: OtpVerifyPayload): Promise<TokenResponse> => {
    const response = await api.post<TokenResponse>('/auth/login/otp/verify', payload);
    return response.data;
  },

  forgotPassword: async (payload: ForgotPasswordPayload) => {
    const response = await api.post('/auth/password/forgot', payload);
    return response.data;
  },

  forgotPasswordVerify: async (payload: ForgotPasswordVerifyPayload) => {
    const response = await api.post('/auth/password/verify', payload);
    return response.data;
  },

  resetPassword: async (payload: ResetPasswordPayload) => {
    const response = await api.post('/auth/password/reset', payload);
    return response.data;
  },

  /** Restore user session on page reload — relies on httpOnly cookie only. */
  me: async (): Promise<CurrentUserResponse> => {
    const response = await api.get<CurrentUserResponse>('/auth/me');
    return response.data;
  },

  /** Tell backend to clear the user session cookie. */
  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  // ── Admin auth ────────────────────────────────────────────────────────────

  adminLogin: async (payload: AdminLoginPayload): Promise<TokenResponse> => {
    const response = await api.post<TokenResponse>('/admin/auth/login', payload);
    return response.data;
    // NOTE: Same as loginEmail — do NOT store the token. Cookie is set by backend.
  },

  /** Restore admin session on page reload — relies on httpOnly cookie only. */
  adminMe: async (): Promise<CurrentAdminResponse> => {
    const response = await api.get<CurrentAdminResponse>('/admin/auth/me');
    return response.data;
  },

  /** Tell backend to clear the admin session cookie. */
  adminLogout: async (): Promise<void> => {
    await api.post('/admin/auth/logout');
  },
};