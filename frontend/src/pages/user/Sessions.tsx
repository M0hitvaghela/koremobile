import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchUserSessions,
  revokeUserSession,
  logoutAllUserDevices,
  SessionInfo,
} from "../../utils/sessionsApi";
import { useAuthStore } from "../../store/authStore";

function parseUA(ua: string | null): { browser: string; os: string; isMobile: boolean } {
  if (!ua) return { browser: "Unknown", os: "Unknown", isMobile: false };
  const isMobile = /Android|iPhone|iPad/.test(ua);
  const browser =
    ua.includes("Chrome") && !ua.includes("Edg") ? "Chrome"
    : ua.includes("Firefox") ? "Firefox"
    : ua.includes("Safari") && !ua.includes("Chrome") ? "Safari"
    : ua.includes("Edg") ? "Edge"
    : "Browser";
  const os =
    ua.includes("Windows") ? "Windows"
    : ua.includes("Mac") ? "macOS"
    : ua.includes("Android") ? "Android"
    : ua.includes("iPhone") ? "iPhone"
    : ua.includes("iPad") ? "iPad"
    : ua.includes("Linux") ? "Linux"
    : "Unknown";
  return { browser, os, isMobile };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function DeviceIcon({ isMobile, isCurrent }: { isMobile: boolean; isCurrent: boolean }) {
  return (
    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
      isCurrent ? "bg-blue-50" : "bg-gray-50"
    }`}>
      {isMobile ? (
        <svg className={`w-4 h-4 md:w-5 md:h-5 ${isCurrent ? "text-blue-500" : "text-gray-400"}`} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
          <rect x="7" y="2" width="10" height="20" rx="2.5" />
          <circle cx="12" cy="18.5" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      ) : (
        <svg className={`w-4 h-4 md:w-5 md:h-5 ${isCurrent ? "text-blue-500" : "text-gray-400"}`} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="flex items-center gap-3 p-3 md:p-4 rounded-2xl bg-gray-50 border border-gray-100">
      <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gray-200 animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-gray-200 rounded-full w-1/3 animate-pulse" />
        <div className="h-2.5 bg-gray-200 rounded-full w-1/2 animate-pulse" />
      </div>
      <div className="w-16 h-8 bg-gray-200 rounded-xl animate-pulse" />
    </div>
  );
}

export default function Sessions() {
  const navigate = useNavigate();
  const logout = useAuthStore((s: any) => s.logout);

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<number | null>(null);
  const [allBusy, setAllBusy] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    fetchUserSessions()
      .then(setSessions)
      .catch(() => setError("Could not load sessions."))
      .finally(() => setLoading(false));
  }, []);

  const handleRevoke = async (id: number, isCurrent: boolean) => {
    if (isCurrent) {
      setAllBusy(true);
      await revokeUserSession(id).catch(() => {});
      await logout();
      navigate("/login");
      return;
    }
    setRevoking(id);
    try {
      await revokeUserSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch {
      setError("Failed to revoke session.");
    } finally {
      setRevoking(null);
    }
  };

  const handleLogoutAll = async () => {
    setShowConfirm(false);
    setAllBusy(true);
    await logoutAllUserDevices().catch(() => {});
    await logout();
    navigate("/login");
  };

  return (
    <>
      <div className="space-y-4 md:space-y-5">

        {/* Title */}
        <div>
          <h2 className="text-base md:text-lg font-semibold text-gray-900">Active Sessions</h2>
          <p className="text-xs md:text-sm text-gray-400 mt-0.5">
            {!loading && sessions.length > 0
              ? `${sessions.length} device${sessions.length !== 1 ? "s" : ""} currently signed in`
              : "Manage where you're signed in"}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-xs md:text-sm text-red-600">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-9v4a1 1 0 002 0V9a1 1 0 00-2 0zm1-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Session cards */}
        <div className="space-y-2.5 md:space-y-3">
          {loading ? (
            [1, 2].map(i => <SkeletonCard key={i} />)
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <p className="text-xs md:text-sm text-gray-400 font-medium">No active sessions found</p>
            </div>
          ) : (
            sessions.map(s => {
              const { browser, os, isMobile } = parseUA(s.device_info);
              const isRevoking = revoking === s.id;
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 p-3 md:p-4 rounded-2xl border transition-all duration-200 ${
                    s.is_current
                      ? "bg-blue-50/70 border-blue-200"
                      : "bg-white border-gray-100 hover:border-gray-200"
                  }`}
                >
                  <DeviceIcon isMobile={isMobile} isCurrent={s.is_current} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs md:text-sm font-semibold text-gray-800 truncate">
                        {browser} on {os}
                      </span>
                      {s.is_current && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] md:text-[11px] font-semibold bg-blue-100 text-blue-600 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          This device
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] md:text-xs text-gray-400 mt-0.5 truncate">
                      {s.ip_address || "IP unknown"} · {timeAgo(s.last_used)} ·{' '}
                      {new Date(s.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>

                  <button
                    onClick={() => handleRevoke(s.id, s.is_current)}
                    disabled={isRevoking || allBusy}
                    className={`flex-shrink-0 min-w-[60px] md:min-w-[72px] flex items-center justify-center gap-1 px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 ${
                      s.is_current
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                        : "bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600"
                    }`}
                  >
                    {isRevoking ? (
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    ) : s.is_current ? "Sign out" : "Revoke"}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Sign out all devices */}
        {!loading && sessions.length > 0 && (
          <button
            onClick={() => setShowConfirm(true)}
            disabled={allBusy}
            className="w-full py-3 rounded-2xl text-xs md:text-sm font-semibold text-red-500 bg-white border border-red-100 hover:bg-red-50 transition-colors disabled:opacity-40"
          >
            {allBusy ? "Signing out…" : "Sign out from all devices"}
          </button>
        )}
      </div>

      {/* Confirm modal — slides up from bottom on mobile */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
          <div
            className="absolute inset-0 bg-black/25 backdrop-blur-sm"
            onClick={() => setShowConfirm(false)}
          />
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-5 md:p-6 shadow-2xl">
            <div className="w-10 h-10 md:w-11 md:h-11 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <h3 className="text-sm md:text-[15px] font-bold text-gray-900 text-center">
              Sign out everywhere?
            </h3>
            <p className="text-xs md:text-sm text-gray-400 text-center mt-1.5 mb-5 leading-relaxed">
              You'll be logged out from all devices, including this one.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleLogoutAll}
                className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Yes, sign out all devices
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}