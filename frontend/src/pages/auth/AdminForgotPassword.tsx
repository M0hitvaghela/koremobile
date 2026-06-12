import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../../components/ui/Logo';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { adminApi } from '../../utils/adminApi';
import { useToastStore } from '../../store/toastStore';

const RESEND_SECONDS = 90;

type Step = 'email' | 'otp' | 'reset';

export function AdminForgotPassword() {
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.showToast);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const emailValid = useMemo(() => /^\S+@\S+\.\S+$/.test(email), [email]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = window.setInterval(() => setSecondsLeft((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => window.clearInterval(t);
  }, [secondsLeft]);

  // ── Step 1: Send OTP ───────────────────────────────────────────────────────
  const sendOtp = async () => {
    setErrors({});
    if (!emailValid) { setErrors({ email: 'Enter a valid email' }); return; }
    setLoading(true);
    try {
      await adminApi.post('/admin/auth/forgot-password', { email });
      setStep('otp');
      setSecondsLeft(RESEND_SECONDS);
      showToast('OTP sent to your email', 'success');
    } catch {
      setErrors({ email: 'Unable to send OTP. Check if email is registered.' });
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  const resendOtp = async () => {
    setLoading(true);
    try {
      await adminApi.post('/admin/auth/forgot-password', { email });
      setSecondsLeft(RESEND_SECONDS);
      setOtp('');
      showToast('New OTP sent', 'success');
    } catch {
      showToast('Could not resend OTP', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ─────────────────────────────────────────────────────
  const verifyOtp = async () => {
    setErrors({});
    if (otp.length !== 6) { setErrors({ otp: 'Enter 6-digit OTP' }); return; }
    setLoading(true);
    try {
      await adminApi.post('/admin/auth/forgot-password/verify', { email, otp });
      setStep('reset');
      showToast('OTP verified', 'success');
    } catch (err: any) {
      setErrors({ otp: err?.response?.data?.detail || 'Invalid OTP' });
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Reset Password ─────────────────────────────────────────────────
  const resetPassword = async () => {
    const e: Record<string, string> = {};
    if (password.length < 8) e.password = 'Min 8 characters';
    if (password !== confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      await adminApi.post('/admin/auth/forgot-password/reset', {
        email,
        otp,
        new_password: password,
      });
      showToast('Password updated. Please sign in.', 'success');
      navigate('/admin/login');
    } catch (err: any) {
      setErrors({ password: err?.response?.data?.detail || 'Unable to update password' });
    } finally {
      setLoading(false);
    }
  };

  // ── Step indicator dots ────────────────────────────────────────────────────
  const steps: Step[] = ['email', 'otp', 'reset'];
  const stepIdx = steps.indexOf(step);

  return (
    <div className="min-h-screen bg-adminBg flex items-center justify-center px-4 py-10 w-full">
      <div className="bg-adminSurf border border-adminBorder rounded-2xl shadow-cardHover p-8 w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Logo size="lg" variant="light" />
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <div
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  i <= stepIdx ? 'bg-primary scale-110' : 'bg-gray-600'
                }`}
              />
              {i < steps.length - 1 && (
                <div className={`h-px w-8 transition-all duration-300 ${i < stepIdx ? 'bg-primary' : 'bg-gray-600'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── STEP 1: Email ── */}
        {step === 'email' && (
          <>
            <h1 className="font-heading font-bold text-2xl text-white text-center">
              Reset Admin Password
            </h1>
            <p className="text-sm text-gray-400 text-center mt-1 mb-6">
              Enter your admin email to receive an OTP
            </p>
            <div className="space-y-3">
              <Input
                dark
                label="Admin Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                placeholder="admin@example.com"
                onKeyDown={(e) => e.key === 'Enter' && sendOtp()}
              />
              {errors.email && <p className="text-sm text-red-400">{errors.email}</p>}
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={sendOtp}
                disabled={!emailValid || loading}
              >
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </Button>
            </div>
          </>
        )}

        {/* ── STEP 2: OTP ── */}
        {step === 'otp' && (
          <>
            <h1 className="font-heading font-bold text-2xl text-white text-center">
              Enter OTP
            </h1>
            <p className="text-sm text-gray-400 text-center mt-1 mb-6">
              Check your email for the 6-digit code
            </p>
            <div className="space-y-3">
              <Input
                dark
                label="6-Digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                placeholder="Enter OTP"
                error={errors.otp}
                onKeyDown={(e) => e.key === 'Enter' && verifyOtp()}
              />
              {errors.otp && <p className="text-sm text-red-400">{errors.otp}</p>}
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={verifyOtp}
                disabled={loading}
              >
                {loading ? 'Verifying...' : 'Verify OTP'}
              </Button>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setErrors({}); setOtp(''); }}
                  className="text-sm text-gray-500 hover:text-gray-300"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={resendOtp}
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

        {/* ── STEP 3: New Password ── */}
        {step === 'reset' && (
          <>
            <h1 className="font-heading font-bold text-2xl text-white text-center">
              New Password
            </h1>
            <p className="text-sm text-gray-400 text-center mt-1 mb-6">
              Choose a strong new password
            </p>
            <div className="space-y-3">
              <Input
                dark
                label="New Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                placeholder="Min 8 characters"
              />
              <Input
                dark
                label="Confirm Password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                error={errors.confirm}
                placeholder="Repeat password"
                onKeyDown={(e) => e.key === 'Enter' && resetPassword()}
              />
              {errors.password && <p className="text-sm text-red-400">{errors.password}</p>}
              {errors.confirm && <p className="text-sm text-red-400">{errors.confirm}</p>}
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={resetPassword}
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </>
        )}

        <p className="text-sm text-gray-400 text-center mt-5">
          Remember your password?{' '}
          <Link to="/admin/login" className="text-primary font-semibold hover:underline">
            Admin Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}