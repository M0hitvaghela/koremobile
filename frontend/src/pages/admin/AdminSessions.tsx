import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchAdminSessions,
  revokeAdminSession,
  logoutAllAdminDevices,
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

function parseIST(dateStr: string): Date {
  // DB stores IST but without tz info — tell JS it's +05:30
  return new Date(dateStr.includes('+') ? dateStr : dateStr + '+05:30');
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - parseIST(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function DeviceIcon({ isMobile, isCurrent }: { isMobile: boolean; isCurrent: boolean }) {
  return (
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
      isCurrent ? "bg-indigo-500/20" : "bg-white/8"
    }`} style={isCurrent ? {} : { backgroundColor: "rgba(255,255,255,0.08)" }}>
      {isMobile ? (
        <svg className={`w-5 h-5 ${isCurrent ? "text-indigo-400" : "text-gray-400"}`} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
          <rect x="7" y="2" width="10" height="20" rx="2.5" />
          <circle cx="12" cy="18.5" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      ) : (
        <svg className={`w-5 h-5 ${isCurrent ? "text-indigo-400" : "text-gray-400"}`} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl border border-white/10" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
      <div className="w-11 h-11 rounded-xl animate-pulse flex-shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
      <div className="flex-1 space-y-2.5">
        <div className="h-3.5 rounded-full w-1/3 animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
        <div className="h-3 rounded-full w-1/2 animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
      </div>
      <div className="w-20 h-9 rounded-xl animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
    </div>
  );
}

export default function AdminSessions() {
  const navigate = useNavigate();
  const logout   = useAuthStore((s: any) => s.logout);

  const [sessions, setSessions]     = useState<SessionInfo[]>([]);
  const [loading,  setLoading]      = useState(true);
  const [error,    setError]        = useState<string | null>(null);
  const [revoking, setRevoking]     = useState<number | null>(null);
  const [allBusy,  setAllBusy]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    fetchAdminSessions()
      .then(setSessions)
      .catch(() => setError("Could not load sessions."))
      .finally(() => setLoading(false));
  }, []);

  const handleRevoke = async (id: number, isCurrent: boolean) => {
    if (isCurrent) {
      setAllBusy(true);
      await revokeAdminSession(id).catch(() => {});
      await logout();
      navigate("/admin/login");
      return;
    }
    setRevoking(id);
    try {
      await revokeAdminSession(id);
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
    await logoutAllAdminDevices().catch(() => {});
    await logout();
    navigate("/admin/login");
  };

  return (
    <>
      <div className="p-6 max-w-3xl space-y-5">

        {/* Title row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">Admin Sessions</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {!loading && sessions.length > 0
                ? `${sessions.length} active session${sessions.length !== 1 ? "s" : ""}`
                : "Monitor active admin logins"}
            </p>
          </div>
          {!loading && sessions.length > 0 && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={allBusy}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-red-400 rounded-xl border border-red-500/30 hover:bg-red-500/10 transition-colors disabled:opacity-40"
              style={{ backgroundColor: "rgba(239,68,68,0.08)" }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M17 16l4-4m0 0l-4-4m4 4H7" />
              </svg>
              {allBusy ? "Signing out…" : "Sign out all"}
            </button>
          )}
        </div>

        {/* Security notice */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-blue-500/20" style={{ backgroundColor: "rgba(59,130,246,0.08)" }}>
          <svg className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <p className="text-xs text-blue-300 leading-relaxed">
            Sessions are server-validated on every request. Revoking a session blocks that device instantly, even before the JWT expires.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-red-500/20 text-sm text-red-400" style={{ backgroundColor: "rgba(239,68,68,0.08)" }}>
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-9v4a1 1 0 002 0V9a1 1 0 00-2 0zm1-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Cards */}
        <div className="space-y-3">
          {loading ? (
            [1, 2].map(i => <SkeletonCard key={i} />)
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 font-medium">No active sessions</p>
            </div>
          ) : (
            sessions.map(s => {
              const { browser, os, isMobile } = parseUA(s.device_info);
              const isRevoking = revoking === s.id;
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 ${
                    s.is_current
                      ? "border-indigo-500/30"
                      : "border-white/8 hover:border-white/15"
                  }`}
                  style={{
                    backgroundColor: s.is_current
                      ? "rgba(99,102,241,0.12)"
                      : "rgba(255,255,255,0.05)",
                    borderColor: s.is_current
                      ? "rgba(99,102,241,0.3)"
                      : "rgba(255,255,255,0.08)",
                  }}
                >
                  <DeviceIcon isMobile={isMobile} isCurrent={s.is_current} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-100">
                        {browser} on {os}
                      </span>
                      {s.is_current && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-indigo-300" style={{ backgroundColor: "rgba(99,102,241,0.2)" }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          This session
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      IP: {s.ip_address || "unknown"} &nbsp;·&nbsp; {timeAgo(s.last_used)}
                      &nbsp;·&nbsp; {parseIST(s.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>

                  <button
                    onClick={() => handleRevoke(s.id, s.is_current)}
                    disabled={isRevoking || allBusy}
                    className={`flex-shrink-0 min-w-[72px] flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 ${
                      s.is_current
                        ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                        : "text-gray-300 hover:text-red-400 hover:border-red-500/30"
                    }`}
                    style={s.is_current ? {} : {
                      backgroundColor: "rgba(255,255,255,0.08)",
                    }}
                  >
                    {isRevoking ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
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
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
          <div className="relative w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-white/10" style={{ backgroundColor: "#1e2130" }}>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "rgba(239,68,68,0.15)" }}>
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <h3 className="text-[15px] font-bold text-white text-center">Sign out all admin sessions?</h3>
            <p className="text-sm text-gray-400 text-center mt-1.5 mb-6 leading-relaxed">
              All admin devices will be signed out<br />immediately, including this one.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleLogoutAll}
                className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-red-600 hover:bg-red-500 transition-colors"
              >
                Yes, sign out all
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-gray-400 hover:text-gray-200 transition-colors border border-white/10"
                style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
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