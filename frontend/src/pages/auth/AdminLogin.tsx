import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '../../components/ui/Logo';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { adminApi } from '../../utils/adminApi';

type Step = 'credentials' | 'otp';

const RESEND_SECONDS = 90;

export function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const hydrate = useAuthStore((s) => s.hydrate);
  const showToast = useToastStore((s) => s.showToast);
  const from = (location.state as { from?: string })?.from || '/admin';

  // Step 1 — credentials
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Step 2 — OTP
  const [step, setStep] = useState<Step>('credentials');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [adminEmail, setAdminEmail] = useState(''); // real email for verify call
  const [otp, setOtp] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Countdown timer for resend
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = window.setInterval(() => setSecondsLeft((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => window.clearInterval(t);
  }, [secondsLeft]);

  // ── Step 1: validate credentials → backend sends OTP ──────────────────────
  const handleCredentials = async () => {
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('Enter username/email and password');
      return;
    }
    setLoading(true);
    try {
      const res = await adminApi.post<{
        otp_required: boolean;
        email: string;
        admin_identifier: string;
      }>('/admin/auth/login', { username, password });

      if (res.data.otp_required) {
        setMaskedEmail(res.data.email);
        setAdminEmail(res.data.admin_identifier);
        setStep('otp');
        setSecondsLeft(RESEND_SECONDS);
        showToast(`OTP sent to ${res.data.email}`, 'success');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Invalid admin credentials';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  const handleResend = async () => {
    setError('');
    setLoading(true);
    try {
      await adminApi.post('/admin/auth/login', { username, password });
      setSecondsLeft(RESEND_SECONDS);
      setOtp('');
      showToast('New OTP sent', 'success');
    } catch {
      setError('Could not resend OTP');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify OTP → issue cookie, then hydrate store ──────────────────
  const handleVerifyOtp = async () => {
    setError('');
    if (otp.length !== 6) {
      setError('Enter the 6-digit OTP');
      return;
    }
    setLoading(true);
    try {
      // Backend sets the httpOnly admin cookie on success
      await adminApi.post('/admin/auth/login/verify-otp', {
        email: adminEmail,
        otp,
      });

      // Use the store's own hydrate() — it calls /admin/auth/me, sets user +
      // isAuthenticated correctly, and crucially sets isHydrating: false
      await hydrate();

      showToast('Admin signed in successfully', 'success');
      navigate(from, { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Invalid or expired OTP';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-adminBg flex items-center justify-center px-4 py-10 w-full">
      <div className="bg-adminSurf border border-adminBorder rounded-2xl shadow-cardHover p-8 w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Logo size="lg" variant="light" />
        </div>

        {/* ── STEP 1: Credentials ── */}
        {step === 'credentials' && (
          <>
            <h1 className="font-heading font-bold text-2xl text-white text-center">
              Admin Sign In
            </h1>
            <p className="text-sm text-gray-400 text-center mt-1 mb-6">
              Access the admin panel securely
            </p>

            <div className="space-y-3">
              <Input
                dark
                label="Admin Username or Email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="mohit or mohit@example.com"
                onKeyDown={(e) => e.key === 'Enter' && handleCredentials()}
              />
              <Input
                dark
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={(e) => e.key === 'Enter' && handleCredentials()}
              />

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleCredentials}
                disabled={loading}
              >
                {loading ? 'Verifying...' : 'Continue'}
              </Button>

              <p className="text-sm text-gray-500 text-center pt-1">
                <Link
                  to="/admin/forgot-password"
                  className="text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </p>
            </div>
          </>
        )}

        {/* ── STEP 2: OTP Verification ── */}
        {step === 'otp' && (
          <>
            <h1 className="font-heading font-bold text-2xl text-white text-center">
              Two-Factor Verification
            </h1>
            <p className="text-sm text-gray-400 text-center mt-1 mb-1">
              OTP sent to
            </p>
            <p className="text-sm text-primary font-semibold text-center mb-6">
              {maskedEmail}
            </p>

            <div className="space-y-3">
              <Input
                dark
                label="6-Digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                placeholder="Enter OTP"
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
              />

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleVerifyOtp}
                disabled={loading}
              >
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </Button>

              {/* Resend row */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => { setStep('credentials'); setError(''); setOtp(''); }}
                  className="text-sm text-gray-500 hover:text-gray-300"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={secondsLeft > 0 || loading}
                  className={`text-sm font-medium ${
                    secondsLeft > 0
                      ? 'text-gray-600 cursor-not-allowed'
                      : 'text-primary hover:underline'
                  }`}
                >
                  {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend OTP'}
                </button>
              </div>
            </div>
          </>
        )}

        <p className="text-sm text-gray-400 text-center mt-5">
          Customer login?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Go to customer sign in
          </Link>
        </p>
      </div>
    </div>
  );
}