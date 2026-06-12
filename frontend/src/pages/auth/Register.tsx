import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../../components/ui/Logo';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';

const RESEND_SECONDS = 90;

export function Register() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const sendRegisterEmailOtp = useAuthStore((s) => s.sendRegisterEmailOtp);
  const verifyRegisterEmailOtp = useAuthStore((s) => s.verifyRegisterEmailOtp);
  const showToast = useToastStore((s) => s.showToast);

  const [data, setData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const [emailLocked, setEmailLocked] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  const emailValid = useMemo(() => /^\S+@\S+\.\S+$/.test(data.email), [data.email]);

  const sendOtp = async () => {
    if (!emailValid || emailVerified) return;
    setErrors((prev) => ({ ...prev, email: '' }));
    setSendingOtp(true);
    const res = await sendRegisterEmailOtp(data.email);
    setSendingOtp(false);
    if (!res.success) {
      setErrors((prev) => ({ ...prev, email: res.error || 'Failed to send verification code' }));
      return;
    }
    setEmailLocked(true);
    setEmailOtpSent(true);
    setSecondsLeft(RESEND_SECONDS);
    showToast('Verification code sent to your email', 'success');
  };

  const verifyOtp = async () => {
    if (!emailOtp || emailOtp.length !== 6) {
      setErrors((prev) => ({ ...prev, emailOtp: 'Enter 6-digit OTP' }));
      return;
    }
    setErrors((prev) => ({ ...prev, emailOtp: '' }));
    setVerifyingOtp(true);
    const res = await verifyRegisterEmailOtp(data.email, emailOtp);
    setVerifyingOtp(false);
    if (!res.success) {
      setErrors((prev) => ({ ...prev, emailOtp: res.error || 'Invalid OTP' }));
      return;
    }
    setEmailVerified(true);
    setEmailOtpSent(false);
    showToast('Email verified successfully', 'success');
  };

  const handleSubmit = async () => {
    const e: Record<string, string> = {};
    if (!data.name.trim()) e.name = 'Required';
    if (!emailValid) e.email = 'Invalid email';
    if (!emailVerified) e.email = 'Please verify your email first';
    if (!/^\d{10}$/.test(data.phone)) e.phone = 'Enter a valid 10-digit phone';
    if (data.password.length < 8) e.password = 'Min 8 characters';
    if (data.password !== data.confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    const res = await register({
      name: data.name,
      email: data.email,
      phone: data.phone,
      password: data.password,
    });
    setLoading(false);

    if (!res.success) {
      showToast(res.error || 'Unable to create account', 'error');
      return;
    }

    showToast('Account created successfully', 'success');
    navigate('/');
  };

  return (
    <div className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-8 w-full">
      <div className="bg-white rounded-2xl shadow-cardHover p-5 md:p-8 w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-5 md:mb-6">
          <Logo size="lg" />
        </div>

        <h1 className="font-heading font-bold text-xl md:text-2xl text-ink text-center">
          Create Account
        </h1>
        <p className="text-xs md:text-sm text-muted text-center mt-1 mb-5 md:mb-6">
          Get started in seconds
        </p>

        <div className="space-y-3">
          {/* Name */}
          <Input
            label="Full Name"
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            error={errors.name}
          />

          {/* Email + OTP */}
          <div className="space-y-2">
            <Input
              label="Email"
              type="email"
              value={data.email}
              onChange={(e) => setData({ ...data, email: e.target.value })}
              error={errors.email}
              disabled={emailLocked}
            />

            {!emailVerified && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="md"
                  onClick={sendOtp}
                  disabled={!emailValid || sendingOtp || (emailOtpSent && secondsLeft > 0)}
                  className="flex-1 text-xs md:text-sm"
                >
                  {sendingOtp ? 'Sending...' : emailOtpSent ? 'Resend OTP' : 'Verify Email'}
                </Button>
                {emailOtpSent && secondsLeft > 0 && (
                  <div className="px-3 py-2 text-xs text-muted bg-bg rounded-lg min-w-[72px] md:min-w-[94px] text-center flex items-center justify-center">
                    {secondsLeft}s
                  </div>
                )}
              </div>
            )}

            {!emailVerified && emailOtpSent && (
              <div className="space-y-2">
                <Input
                  label="Email OTP"
                  value={emailOtp}
                  onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                  maxLength={6}
                  error={errors.emailOtp}
                  placeholder="Enter 6-digit OTP"
                />
                <Button variant="primary" size="md" fullWidth onClick={verifyOtp} disabled={verifyingOtp}>
                  {verifyingOtp ? 'Verifying...' : 'Confirm OTP'}
                </Button>
              </div>
            )}

            {emailVerified && (
              <p className="text-xs text-success font-semibold flex items-center gap-1">
                ✓ Email verified
              </p>
            )}
          </div>

          {/* Phone */}
          <Input
            label="Phone Number"
            maxLength={10}
            value={data.phone}
            onChange={(e) => setData({ ...data, phone: e.target.value.replace(/\D/g, '') })}
            error={errors.phone}
          />

          {/* Password */}
          <Input
            label="Password"
            type="password"
            value={data.password}
            onChange={(e) => setData({ ...data, password: e.target.value })}
            error={errors.password}
          />

          {/* Confirm */}
          <Input
            label="Confirm Password"
            type="password"
            value={data.confirm}
            onChange={(e) => setData({ ...data, confirm: e.target.value })}
            error={errors.confirm}
          />

          <Button variant="primary" size="lg" fullWidth onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </Button>
        </div>

        <p className="text-xs md:text-sm text-muted text-center mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}