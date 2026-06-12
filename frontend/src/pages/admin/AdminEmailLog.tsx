import React, { useEffect, useState } from 'react';
import {
  MailIcon, CheckCircleIcon, XCircleIcon, ClockIcon,
  RefreshCwIcon, Loader2Icon, AlertTriangleIcon, SendIcon,
} from 'lucide-react';
import { adminApi } from '../../utils/adminApi';

interface EmailLogEntry {
  id: string;
  type: string;
  to: string;
  status: 'sent' | 'failed' | 'queued';
  attempt: number;
  created_at: string;
  error?: string;
  data?: Record<string, unknown>;
}

const TYPE_LABELS: Record<string, string> = {
  order_confirmation: 'Order Confirmation',
  otp:               'OTP / Login Code',
  welcome:           'Welcome',
  payment_failed:    'Payment Failed',
};

const TYPE_COLORS: Record<string, string> = {
  order_confirmation: '#22c55e',
  otp:               '#2874F0',
  welcome:           '#7C3AED',
  payment_failed:    '#ef4444',
};

// Only these types get the Resend button
const RESENDABLE_TYPES = new Set(['order_confirmation', 'payment_failed', 'welcome']);

export function AdminEmailLog() {
  const [queue, setQueue]   = useState<EmailLogEntry[]>([]);
  const [failed, setFailed] = useState<EmailLogEntry[]>([]);
  const [sent, setSent]     = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab]       = useState<'failed' | 'queued' | 'sent'>('failed');
  const [resending, setResending] = useState<string | null>(null);
  const [toast, setToast]   = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<{ queue: EmailLogEntry[]; failed: EmailLogEntry[]; sent: EmailLogEntry[] }>(
        '/admin/email-log'
      );
      setQueue(res.data.queue  ?? []);
      setFailed(res.data.failed ?? []);
      setSent(res.data.sent ?? []);
    } catch {
      // show empty state gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // index = position in the list (parsed from id like "failed-2")
  const handleResend = async (entry: EmailLogEntry) => {
    const parts = entry.id.split('-');
    const status = parts[0];          // "failed" | "queued"
    const index  = parseInt(parts[1], 10);

    setResending(entry.id);
    try {
      await adminApi.post(`/admin/email-log/resend/${status}/${index}`, {});
      showToast(`Email resent to ${entry.to}`, true);
      await load(); // refresh list
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? 'Resend failed. Check SMTP config.';
      showToast(msg, false);
    } finally {
      setResending(null);
    }
  };

  const entries = tab === 'failed' ? failed : tab === 'queued' ? queue : sent;

  return (
    <div className="space-y-4">

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold transition-all ${
            toast.ok
              ? 'bg-green-500/90 text-white'
              : 'bg-red-500/90 text-white'
          }`}
        >
          {toast.ok ? <CheckCircleIcon size={16} /> : <XCircleIcon size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white flex items-center gap-2">
            <MailIcon size={22} /> Email Log
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Monitor queued and failed emails — resend order emails manually
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
        >
          <RefreshCwIcon size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/25 rounded-xl px-4 py-3 min-w-[140px]">
          <CheckCircleIcon size={18} className="text-green-400" />
          <div>
            <div className="text-xs text-gray-500 font-medium">Sent (latest 100)</div>
            <div className="text-xl font-bold text-green-400">{sent.length}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 min-w-[140px]">
          <XCircleIcon size={18} className="text-red-400" />
          <div>
            <div className="text-xs text-gray-500 font-medium">Dead (failed)</div>
            <div className="text-xl font-bold text-red-400">{failed.length}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/25 rounded-xl px-4 py-3 min-w-[140px]">
          <ClockIcon size={18} className="text-yellow-400" />
          <div>
            <div className="text-xs text-gray-500 font-medium">Queued (retrying)</div>
            <div className="text-xl font-bold text-yellow-400">{queue.length}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {([['failed', 'Dead / Failed'], ['queued', 'In Queue'], ['sent', 'Sent History']] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg whitespace-nowrap transition-colors ${
              tab === v
                ? 'bg-adminSurf text-white border border-adminBorder border-b-adminSurf'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-adminSurf border border-adminBorder rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2Icon size={24} className="animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
            <CheckCircleIcon size={32} className="text-green-500/50" />
            <p className="text-sm">
              {tab === 'failed' ? 'No dead emails — all good!' : tab === 'queued' ? 'Queue is empty' : 'No sent emails yet'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-adminBg/50">
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3">Attempts</th>
                  <th className="px-4 py-3">Time</th>
                  {tab === 'failed' && <th className="px-4 py-3">Error</th>}
                  {tab !== 'sent' && <th className="px-4 py-3">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-adminBorder">
                {entries.map((e, i) => {
                  const canResend = RESENDABLE_TYPES.has(e.type);
                  const isSending = resending === e.id;
                  return (
                    <tr key={e.id ?? i} className="hover:bg-adminBg/30">
                      <td className="px-4 py-3">
                        <span
                          className="text-xs px-2 py-0.5 rounded font-semibold"
                          style={{
                            background: `${TYPE_COLORS[e.type] ?? '#6b7280'}18`,
                            color: TYPE_COLORS[e.type] ?? '#9ca3af',
                            border: `1px solid ${TYPE_COLORS[e.type] ?? '#6b7280'}30`,
                          }}
                        >
                          {TYPE_LABELS[e.type] ?? e.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300 font-mono text-xs">{e.to}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold text-xs ${
                          e.attempt >= 3 ? 'text-red-400' : 'text-yellow-400'
                        }`}>
                          {e.attempt} / 3
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {(e.status === 'sent' ? (e as EmailLogEntry & { sent_at?: string }).sent_at : e.created_at)
                          ? new Date(((e as EmailLogEntry & { sent_at?: string }).sent_at ?? e.created_at)!).toLocaleString('en-IN', {
                              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      {tab === 'failed' && (
                        <td className="px-4 py-3 text-red-400 text-xs max-w-[200px] truncate">
                          {e.error ?? '—'}
                        </td>
                      )}
                      {tab !== 'sent' && (
                        <td className="px-4 py-3">
                          {canResend ? (
                            <button
                              onClick={() => handleResend(e)}
                              disabled={isSending || resending !== null}
                              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                            >
                              {isSending
                                ? <Loader2Icon size={11} className="animate-spin" />
                                : <SendIcon size={11} />}
                              {isSending ? 'Sending…' : 'Resend'}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-600 italic">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 text-xs text-gray-500 bg-adminSurf border border-adminBorder rounded-xl p-4">
        <AlertTriangleIcon size={13} className="mt-0.5 shrink-0 text-yellow-500" />
        <p>
          <strong className="text-gray-400">Resend</strong> is available for{' '}
          <strong className="text-green-400">Order Confirmation</strong>,{' '}
          <strong className="text-red-400">Payment Failed</strong>, and{' '}
          <strong className="text-purple-400">Welcome</strong> emails.
          OTP emails cannot be resent manually.
          Data lives in <code className="text-gray-400">email:failed</code> and{' '}
          <code className="text-gray-400">email:queue</code> Redis keys.
        </p>
      </div>
    </div>
  );
}