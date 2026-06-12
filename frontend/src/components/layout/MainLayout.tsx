import React, { useEffect, useState, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { CategoryNav } from './CategoryNav';
import { networkBus } from '../../utils/api';

// ── Banner ────────────────────────────────────────────────────────────────────

type BannerState = 'hidden' | 'server-down' | 'no-internet' | 'back';

const BANNER_CONFIG = {
  'server-down': {
    icon: '🔧',
    message: "We're having server issues — our team is on it",
    bg: '#1c1917',
  },
  'no-internet': {
    icon: '📶',
    message: 'No internet connection — please check your network',
    bg: '#1e1b4b',
  },
  back: {
    icon: '✅',
    message: 'Back online',
    bg: '#14532d',
  },
} as const;

function ServerBanner() {
  const [state, setState] = useState<BannerState>('hidden');
  const [visible, setVisible] = useState(false);

  const handleServerDown = useCallback(() => {
    setState('server-down');
    setVisible(true);
  }, []);

  const handleNoInternet = useCallback(() => {
    setState('no-internet');
    setVisible(true);
  }, []);

  const handleUp = useCallback(() => {
    setState((prev) => {
      if (prev === 'server-down' || prev === 'no-internet') {
        setTimeout(() => setVisible(false), 3000);
        return 'back';
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    networkBus.on('server-down', handleServerDown);
    networkBus.on('no-internet', handleNoInternet);
    networkBus.on('up', handleUp);

    // Browser-level offline event (no axios request needed to detect)
    const onOffline = () => handleNoInternet();
    const onOnline  = () => handleUp();
    window.addEventListener('offline', onOffline);
    window.addEventListener('online',  onOnline);

    return () => {
      networkBus.off('server-down', handleServerDown);
      networkBus.off('no-internet', handleNoInternet);
      networkBus.off('up', handleUp);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online',  onOnline);
    };
  }, [handleServerDown, handleNoInternet, handleUp]);

  if (!visible || state === 'hidden') return null;

  const config = BANNER_CONFIG[state as keyof typeof BANNER_CONFIG];
  const isBack = state === 'back';

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 18px',
        borderRadius: 10,
        background: config.bg,
        color: '#fff',
        fontSize: 13,
        fontWeight: 500,
        maxWidth: 'calc(100vw - 32px)',
        whiteSpace: 'nowrap',
        animation: 'kore-slide-up 0.25s ease',
      }}
    >
      <span style={{ fontSize: 15, flexShrink: 0 }}>{config.icon}</span>
      <span>{config.message}</span>

      {/* Dismiss button — only when down, not on "back online" */}
      {!isBack && (
        <button
          onClick={() => setVisible(false)}
          aria-label="Dismiss"
          style={{
            marginLeft: 8,
            background: 'transparent',
            border: 'none',
            color: '#a8a29e',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            padding: 0,
            flexShrink: 0,
          }}
        >
          ×
        </button>
      )}

      <style>{`
        @keyframes kore-slide-up {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Main layout ───────────────────────────────────────────────────────────────

export function MainLayout() {
  const location = useLocation();
  const showCategoryNav =
    ['/', '/products'].some(
      (p) => location.pathname === p || location.pathname.startsWith('/products')
    ) && !location.pathname.includes('/products/');

  return (
    <div className="min-h-screen flex flex-col bg-bg w-full">
      <Header />
      {showCategoryNav && <CategoryNav />}
      <main className="flex-1 w-full pb-14 md:pb-0 main-content">
        <Outlet />
      </main>
      <Footer />
      <ServerBanner />
    </div>
  );
}