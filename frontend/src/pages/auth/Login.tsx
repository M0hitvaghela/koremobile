import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Logo } from '../../components/ui/Logo';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';

type LoginMode = 'password' | 'otp';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const sendLoginOtp = useAuthStore((s) => s.sendLoginOtp);
  const verifyLoginOtp = useAuthStore((s) => s.verifyLoginOtp);
  const showToast = useToastStore((s) => s.showToast);
  const from = (location.state as { from?: string })?.from || '/';

  const [mode, setMode] = useState<LoginMode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordLogin = async () => {
    setError('');
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.success) {
      showToast('Welcome back!', 'success');
      const isAdminEmail = email.trim().toLowerCase() === 'admin@koremobile.in' || email.trim().toLowerCase() === 'admin';
      navigate(res.role === 'admin' && isAdminEmail ? '/admin' : from);
      return;
    }
    setError(res.error || 'Login failed');
  };

  const handleSendOtp = async () => {
    setError('');
    setLoading(true);
    const res = await sendLoginOtp(phone);
    setLoading(false);
    if (res.success) {
      setOtpSent(true);
      showToast('OTP sent to your phone', 'success');
      return;
    }
    setError(res.error || 'Unable to send OTP');
  };

  const handleVerifyOtp = async () => {
    setError('');
    setLoading(true);
    const res = await verifyLoginOtp(phone, otp);
    setLoading(false);
    if (res.success) {
      showToast('Signed in successfully', 'success');
      navigate(from);
      return;
    }
    setError(res.error || 'Invalid OTP');
  };

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-10 w-full">
      <div className="bg-white rounded-2xl shadow-cardHover p-8 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Logo size="lg" />
        </div>
        <h1 className="font-heading font-bold text-2xl text-ink text-center">
          Welcome back
        </h1>
        <p className="text-sm text-muted text-center mt-1 mb-6">
          Sign in to continue shopping
        </p>

        <div className="flex bg-bg rounded-xl p-1 mb-5">
          <button
            type="button"
            onClick={() => {
              setMode('password');
              setError('');
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${mode === 'password' ? 'bg-white shadow-sm text-ink' : 'text-muted'}`}>
            Email Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('otp');
              setError('');
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${mode === 'otp' ? 'bg-white shadow-sm text-ink' : 'text-muted'}`}>
            OTP Login
          </button>
        </div>

        {mode === 'password' ? (
          <div className="space-y-3">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordLogin()} />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordLogin()} />

            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button variant="primary" size="lg" fullWidth onClick={handlePasswordLogin} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
            <div className="text-right">
              <Link to="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              label="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="9876543210"
              maxLength={10}
              onKeyDown={(e) => e.key === 'Enter' && (otpSent ? handleVerifyOtp() : handleSendOtp())} />

            {otpSent && (
              <Input
                label="OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit code"
                maxLength={6}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()} />
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={otpSent ? handleVerifyOtp : handleSendOtp}
              disabled={loading}>
              {loading ? 'Please wait...' : otpSent ? 'Verify OTP' : 'Send OTP'}
            </Button>
          </div>
        )}

        <p className="text-sm text-muted text-center mt-5">
          Don't have account?{' '}
          <Link to="/register" className="text-primary font-semibold hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}