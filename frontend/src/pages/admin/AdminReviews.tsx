import React, { useEffect, useState, useCallback } from 'react';
import {
  StarIcon,
  TrashIcon,
  AlertTriangleIcon,
  SearchIcon,
  FilterIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  MessageSquareIcon,
  Loader2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XCircleIcon,
} from 'lucide-react';
import { adminApi } from '../../utils/adminApi';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminReview {
  id: number;
  product_id: number;
  product_name: string;
  user_id: number;
  user_name: string;
  rating: number;
  title: string;
  body: string;
  is_verified: boolean;
  is_flagged: boolean;
  created_at: string;
}

interface ReviewsResponse {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  flagged_count: number;
  reviews: AdminReview[];
}

interface ReviewStats {
  total: number;
  flagged: number;
  avg_rating: number;
}

// ── Star renderer ─────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <StarIcon
          key={s}
          size={13}
          className={s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}
        />
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function AdminReviews() {
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterFlagged, setFilterFlagged] = useState<'all' | 'flagged' | 'clean'>('all');
  const [filterRating, setFilterRating] = useState<string>('');
  const [page, setPage] = useState(1);

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminApi.get<ReviewStats>('/admin/reviews/stats');
      setStats(res.data);
    } catch {}
  }, []);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), per_page: '15' };
      if (search) params.search = search;
      if (filterFlagged === 'flagged') params.flagged = 'true';
      if (filterFlagged === 'clean') params.flagged = 'false';
      if (filterRating) params.rating = filterRating;

      const query = new URLSearchParams(params).toString();
      const res = await adminApi.get<ReviewsResponse>(`/admin/reviews?${query}`);
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterFlagged, filterRating]);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, filterFlagged, filterRating]);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await adminApi.delete(`/admin/reviews/${id}`);
      setConfirmId(null);
      await fetchReviews();
      await fetchStats();
    } catch {
      alert('Failed to delete review.');
    } finally {
      setDeletingId(null);
    }
  };

  const flaggedCount = stats?.flagged ?? data?.flagged_count ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">Review Moderation</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Manage and moderate customer reviews
          </p>
        </div>
        <button
          onClick={() => { fetchReviews(); fetchStats(); }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-adminSurf border border-adminBorder text-sm text-gray-400 hover:text-white transition-colors"
        >
          <RefreshCwIcon size={14} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-adminSurf border border-adminBorder rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10">
            <MessageSquareIcon size={20} className="text-blue-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{stats?.total ?? '—'}</div>
            <div className="text-xs text-gray-400">Total Reviews</div>
          </div>
        </div>
        <div className="bg-adminSurf border border-adminBorder rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-500/10">
            <AlertTriangleIcon size={20} className="text-red-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{flaggedCount}</div>
            <div className="text-xs text-gray-400">Flagged Reviews</div>
          </div>
        </div>
        <div className="bg-adminSurf border border-adminBorder rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-yellow-500/10">
            <StarIcon size={20} className="text-yellow-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{stats?.avg_rating ?? '—'}</div>
            <div className="text-xs text-gray-400">Avg Rating</div>
          </div>
        </div>
      </div>

      {/* Flagged Alert Banner */}
      {flaggedCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          <AlertTriangleIcon size={16} className="shrink-0" />
          <span>
            <strong>{flaggedCount} review{flaggedCount !== 1 ? 's' : ''}</strong> contain potentially inappropriate language and need attention.
          </span>
          <button
            onClick={() => setFilterFlagged('flagged')}
            className="ml-auto text-xs font-semibold underline underline-offset-2 hover:text-red-200"
          >
            Show flagged
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-adminSurf border border-adminBorder rounded-xl p-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search review text…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-adminBg border border-adminBorder rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary"
          />
        </div>

        {/* Flagged filter */}
        <div className="flex rounded-lg overflow-hidden border border-adminBorder text-sm">
          {(['all', 'flagged', 'clean'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilterFlagged(v)}
              className={`px-3 py-2 capitalize transition-colors ${
                filterFlagged === v
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {v === 'flagged' ? '⚠ Flagged' : v === 'clean' ? '✓ Clean' : 'All'}
            </button>
          ))}
        </div>

        {/* Rating filter */}
        <select
          value={filterRating}
          onChange={(e) => setFilterRating(e.target.value)}
          className="px-3 py-2 bg-adminBg border border-adminBorder rounded-lg text-sm text-gray-300 focus:outline-none focus:border-primary"
        >
          <option value="">All Ratings</option>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>{'★'.repeat(r)} {r} star{r !== 1 ? 's' : ''}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-adminSurf border border-adminBorder rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2Icon size={24} className="animate-spin text-primary" />
          </div>
        ) : !data || data.reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <MessageSquareIcon size={32} className="mb-3 opacity-40" />
            <p className="text-sm">No reviews found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-adminBg/50">
                  <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                    <th className="px-5 py-3 font-semibold">Customer</th>
                    <th className="px-5 py-3 font-semibold">Product</th>
                    <th className="px-5 py-3 font-semibold">Rating</th>
                    <th className="px-5 py-3 font-semibold">Review</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-adminBorder">
                  {data.reviews.map((review) => (
                    <tr
                      key={review.id}
                      className={`hover:bg-adminBg/30 transition-colors ${
                        review.is_flagged ? 'bg-red-500/5' : ''
                      }`}
                    >
                      {/* Customer */}
                      <td className="px-5 py-4">
                        <div className="font-medium text-white text-sm">{review.user_name}</div>
                        <div className="text-xs text-gray-500">ID #{review.user_id}</div>
                      </td>

                      {/* Product */}
                      <td className="px-5 py-4">
                        <div className="text-sm text-gray-300 max-w-[160px] truncate" title={review.product_name}>
                          {review.product_name}
                        </div>
                      </td>

                      {/* Rating */}
                      <td className="px-5 py-4">
                        <Stars rating={review.rating} />
                        <span className="text-xs text-gray-500 mt-0.5 block">{review.rating}/5</span>
                      </td>

                      {/* Review content */}
                      <td className="px-5 py-4 max-w-xs">
                        {review.title && (
                          <div className="font-medium text-white text-sm mb-0.5 truncate">
                            {highlightBadWords(review.title)}
                          </div>
                        )}
                        <div className="text-gray-400 text-xs line-clamp-2 leading-relaxed">
                          {highlightBadWords(review.body)}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          {review.is_flagged ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/20">
                              <AlertTriangleIcon size={10} />
                              Flagged
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                              <CheckCircleIcon size={10} />
                              Clean
                            </span>
                          )}
                          {review.is_verified && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              ✓ Verified
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4 text-xs text-gray-400 whitespace-nowrap">
                        {review.created_at
                          ? new Date(review.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })
                          : '—'}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 text-right">
                        {confirmId === review.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-gray-400">Sure?</span>
                            <button
                              onClick={() => handleDelete(review.id)}
                              disabled={deletingId === review.id}
                              className="px-2.5 py-1 rounded text-xs font-semibold bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 transition-colors"
                            >
                              {deletingId === review.id ? (
                                <Loader2Icon size={12} className="animate-spin" />
                              ) : 'Delete'}
                            </button>
                            <button
                              onClick={() => setConfirmId(null)}
                              className="p-1 rounded text-gray-400 hover:text-white transition-colors"
                            >
                              <XCircleIcon size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmId(review.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              review.is_flagged
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                                : 'bg-adminBg text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-adminBorder'
                            }`}
                          >
                            <TrashIcon size={12} />
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.total_pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-adminBorder">
                <span className="text-xs text-gray-400">
                  Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, data.total)} of {data.total} reviews
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-adminBorder text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeftIcon size={14} />
                  </button>
                  <span className="text-sm text-white font-medium px-2">
                    {page} / {data.total_pages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                    disabled={page === data.total_pages}
                    className="p-1.5 rounded-lg border border-adminBorder text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRightIcon size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Highlight bad words in text ───────────────────────────────────────────────

const BAD_WORDS = [
  'fuck', 'shit', 'ass', 'bastard', 'bitch', 'damn', 'crap', 'dick',
  'piss', 'cock', 'cunt', 'whore', 'slut', 'nigger', 'nigga', 'faggot',
  'retard', 'idiot', 'stupid', 'moron', 'loser', 'chutiya', 'madarchod',
  'bhenchod', 'gaandu', 'harami', 'randi', 'saala', 'bakwas', 'bekar',
];

function highlightBadWords(text: string): React.ReactNode {
  if (!text) return null;
  const pattern = new RegExp(`(${BAD_WORDS.join('|')})`, 'gi');
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    BAD_WORDS.includes(part.toLowerCase()) ? (
      <mark key={i} className="bg-red-500/30 text-red-300 rounded px-0.5 not-italic">
        {part}
      </mark>
    ) : part
  );
}