import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ShieldOffIcon,
  ShieldCheckIcon,
  Loader2Icon,
  UserIcon,
  PackageIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { adminUsersApi, AdminUserDetail as IAdminUserDetail } from '../../utils/adminApi';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatINR } from '../../utils/formatPrice';

export function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser]           = useState<IAdminUserDetail | null>(null);
  const [loading, setLoading]     = useState(true);
  const [acting, setActing]       = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [reason, setReason]       = useState('');
  const [error, setError]         = useState('');

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await adminUsersApi.getById(Number(id));
      setUser(data);
    } catch {
      navigate('/admin/users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleBlock = async () => {
    if (!reason.trim()) { setError('Please enter a reason.'); return; }
    setActing(true);
    try {
      await adminUsersApi.block(Number(id), reason.trim());
      setShowBlock(false);
      setReason('');
      setError('');
      await load();
    } catch {
      setError('Failed to block user. Try again.');
    } finally {
      setActing(false);
    }
  };

  const handleUnblock = async () => {
    if (!confirm(`Unblock ${user?.name}?`)) return;
    setActing(true);
    try {
      await adminUsersApi.unblock(Number(id));
      await load();
    } catch {
      // ignore
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2Icon size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <button
        onClick={() => navigate('/admin/users')}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
      >
        <ArrowLeftIcon size={14} /> Back to Users
      </button>

      {/* User card */}
      <div className="bg-adminSurf border border-adminBorder rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-adminBg flex items-center justify-center text-gray-400">
              <UserIcon size={24} />
            </div>
            <div>
              <h1 className="text-xl font-heading font-bold text-white">{user.name}</h1>
              <p className="text-sm text-gray-400">{user.email ?? user.phone ?? '—'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full bg-adminBg text-gray-300 border border-adminBorder">
                  {user.auth_method}
                </span>
                {user.is_blocked ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                    <ShieldOffIcon size={10} /> Blocked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                    <ShieldCheckIcon size={10} /> Active
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Block / Unblock button */}
          <div>
            {user.is_blocked ? (
              <button
                onClick={handleUnblock}
                disabled={acting}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {acting ? <Loader2Icon size={14} className="animate-spin" /> : <ShieldCheckIcon size={14} />}
                Unblock User
              </button>
            ) : (
              <button
                onClick={() => setShowBlock(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700"
              >
                <ShieldOffIcon size={14} /> Block User
              </button>
            )}
          </div>
        </div>

        {/* Block reason display */}
        {user.is_blocked && user.blocked_reason && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-xs text-red-400 font-semibold uppercase tracking-wide mb-1">Block Reason</p>
            <p className="text-sm text-red-300">{user.blocked_reason}</p>
            {user.blocked_at && (
              <p className="text-xs text-red-400/60 mt-1">
                Blocked on {new Date(user.blocked_at).toLocaleString('en-IN')}
              </p>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-adminBorder">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{user.total_orders}</p>
            <p className="text-xs text-gray-400 mt-0.5">Total Orders</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${user.return_count >= 3 ? 'text-red-400' : 'text-white'}`}>
              {user.return_count}
              {user.return_count >= 3 && <span className="text-sm ml-1">⚠</span>}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Returns / Requests</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-white">
              {user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN') : '—'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Joined</p>
          </div>
        </div>
      </div>

      {/* Block modal */}
      {showBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-adminSurf border border-adminBorder rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
            <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2">
              <ShieldOffIcon size={18} className="text-red-400" /> Block {user.name}
            </h2>
            <p className="text-sm text-gray-400">
              This will immediately log out the user and prevent them from logging in.
            </p>
            <div>
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1.5">
                Reason *
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => { setReason(e.target.value); setError(''); }}
                placeholder="e.g. Repeated return abuse — 5 returns in 30 days"
                className="w-full bg-adminBg border border-adminBorder rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary resize-none"
              />
              {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowBlock(false); setReason(''); setError(''); }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleBlock}
                disabled={acting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {acting && <Loader2Icon size={14} className="animate-spin" />}
                Confirm Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order history */}
      <div className="bg-adminSurf border border-adminBorder rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-adminBorder">
          <h2 className="font-heading font-semibold text-white flex items-center gap-2">
            <PackageIcon size={16} /> Order History
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-adminBg/50">
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3 font-semibold">Order #</th>
                <th className="px-5 py-3 font-semibold">Total</th>
                <th className="px-5 py-3 font-semibold">Payment</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Return Reason</th>
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-adminBorder">
              {user.orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-500">
                    No orders yet.
                  </td>
                </tr>
              ) : (
                user.orders.map((o) => (
                  <tr key={o.id} className="hover:bg-adminBg/30">
                    <td className="px-5 py-3 font-mono text-primary font-semibold">{o.order_number}</td>
                    <td className="px-5 py-3 font-semibold text-white">{formatINR(o.total)}</td>
                    <td className="px-5 py-3 text-gray-400 capitalize">{o.payment_method}</td>
                    <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-5 py-3 text-gray-400 text-xs max-w-[180px] truncate">
                      {o.return_reason ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        to={`/admin/orders/${o.id}`}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}