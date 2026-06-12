import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../../components/ui/Logo';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { authApi } from '../../utils/authApi';
import { useToastStore } from '../../store/toastStore';

const RESEND_SECONDS = 90;

export function ForgotPassword() {
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.showToast);

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [emailLocked, setEmailLocked] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const emailValid = useMemo(() => /^\S+@\S+\.\S+$/.test(email), [email]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  const sendOtp = async () => {
    setErrors({});
    if (!emailValid) {
      setErrors({ email: 'Enter a valid email' });
      return;
    }
    setLoading(true);
    try {
      await authApi.forgotPassword({ email });
      setEmailLocked(true);
      setOtpSent(true);
      setSecondsLeft(RESEND_SECONDS);
      showToast('OTP sent to your email', 'success');
    } catch {
      setErrors({ email: 'Unable to send OTP' });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setErrors({});
    if (otp.length !== 6) {
      setErrors({ otp: 'Enter 6-digit OTP' });
      return;
    }
    setLoading(true);
    try {
      await authApi.forgotPasswordVerify({ email, otp });
      setOtpVerified(true);
      setOtpSent(false);
      showToast('OTP verified', 'success');
    } catch {
      setErrors({ otp: 'Invalid OTP' });
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    const e: Record<string, string> = {};
    if (!otpVerified) e.otp = 'Verify OTP first';
    if (password.length < 8) e.password = 'Min 8 characters';
    if (password !== confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      await authApi.resetPassword({ email, otp, new_password: password });
      showToast('Password updated. Please sign in.', 'success');
      navigate('/login');
    } catch {
      setErrors({ password: 'Unable to update password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-10 w-full">
      <div className="bg-white rounded-2xl shadow-cardHover p-8 w-full max-w-md">
          {/* Logo */}
        <div className="flex justify-center mb-5 md:mb-6">
          <Logo size="lg" />
        </div>
 
        <h1 className="font-heading font-bold text-xl md:text-2xl text-ink text-center">
          Reset Password
        </h1>
        <p className="text-xs md:text-sm text-muted text-center mt-1 mb-5 md:mb-6">
          We'll send an OTP to your email
        </p>

        <div className="space-y-3">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            disabled={emailLocked}
          />

          {!otpVerified && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="md"
                onClick={sendOtp}
                disabled={!emailValid || loading || (otpSent && secondsLeft > 0)}
                className="flex-1"
              >
                {loading ? 'Sending...' : otpSent ? 'Resend OTP' : 'Send OTP'}
              </Button>
              {otpSent && secondsLeft > 0 && (
                <div className="px-3 py-2 text-xs text-muted bg-bg rounded-lg min-w-[94px] text-center flex items-center justify-center">
                  {secondsLeft}s
                </div>
              )}
            </div>
          )}

          {otpSent && !otpVerified && (
            <div className="space-y-2">
              <Input
                label="OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                error={errors.otp}
                placeholder="Enter 6-digit OTP"
              />
              <Button variant="primary" size="md" fullWidth onClick={verifyOtp} disabled={loading}>
                {loading ? 'Verifying...' : 'Verify OTP'}
              </Button>
            </div>
          )}

          {otpVerified && (
            <div className="space-y-3">
              <Input
                label="New Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
              />
              <Input
                label="Confirm Password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                error={errors.confirm}
              />
              <Button variant="primary" size="lg" fullWidth onClick={resetPassword} disabled={loading}>
                {loading ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          )}
        </div>

         <p className="text-xs md:text-sm text-muted text-center mt-5">
          Remembered your password?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}