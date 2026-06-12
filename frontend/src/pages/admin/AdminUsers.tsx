import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  SearchIcon,
  ShieldOffIcon,
  ShieldCheckIcon,
  Loader2Icon,
  UserIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { adminUsersApi, AdminUserItem } from '../../utils/adminApi';

const TABS = [
  { label: 'All Users', value: undefined },
  { label: 'Blocked',   value: true },
] as const;

export function AdminUsers() {
  const [users, setUsers]       = useState<AdminUserItem[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [pages, setPages]       = useState(1);
  const [search, setSearch]     = useState('');
  const [tab, setTab]           = useState<boolean | undefined>(undefined);
  const [loading, setLoading]   = useState(false);
  const [searchInput, setSearchInput] = useState('');

  const load = async (p = 1, s = search, blocked = tab) => {
    setLoading(true);
    try {
      const res = await adminUsersApi.list({ page: p, limit: 20, search: s || undefined, blocked });
      setUsers(res.users);
      setTotal(res.total);
      setPage(res.page);
      setPages(res.pages);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1, search, tab); }, [tab]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    load(1, searchInput, tab);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold text-white">Users</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total} total users</p>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Tabs */}
        <div className="flex gap-1 bg-adminBg rounded-lg p-1">
          {TABS.map((t) => (
            <button
              key={String(t.value)}
              onClick={() => { setTab(t.value); }}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                tab === t.value
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name / email / phone…"
              className="pl-8 pr-3 py-2 bg-adminBg border border-adminBorder rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary w-64"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90"
          >
            Search
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-adminSurf border border-adminBorder rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2Icon size={24} className="animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-adminBg/50">
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-5 py-3 font-semibold">Auth</th>
                  <th className="px-5 py-3 font-semibold text-center">Orders</th>
                  <th className="px-5 py-3 font-semibold text-center">Returns</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Joined</th>
                  <th className="px-5 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-adminBorder">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-adminBg/30">
                      {/* User */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-adminBg flex items-center justify-center text-gray-400">
                            <UserIcon size={14} />
                          </div>
                          <div>
                            <p className="font-semibold text-white">{u.name}</p>
                            <p className="text-xs text-gray-400">{u.email ?? u.phone ?? '—'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Auth method */}
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-adminBg text-gray-300 border border-adminBorder">
                          {u.auth_method}
                        </span>
                      </td>

                      {/* Orders */}
                      <td className="px-5 py-3 text-center text-white font-semibold">
                        {u.total_orders}
                      </td>

                      {/* Returns — highlight if suspicious */}
                      <td className="px-5 py-3 text-center">
                        <span className={`font-semibold ${u.return_count >= 3 ? 'text-red-400' : 'text-gray-300'}`}>
                          {u.return_count}
                          {u.return_count >= 3 && (
                            <span className="ml-1 text-xs text-red-400">⚠</span>
                          )}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3">
                        {u.is_blocked ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                            <ShieldOffIcon size={10} /> Blocked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                            <ShieldCheckIcon size={10} /> Active
                          </span>
                        )}
                      </td>

                      {/* Joined */}
                      <td className="px-5 py-3 text-gray-400 text-xs">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—'}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3 text-right">
                        <Link
                          to={`/admin/users/${u.id}`}
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
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-5 py-4 border-t border-adminBorder flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Page {page} of {pages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => load(page - 1)}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm bg-adminBg border border-adminBorder rounded-lg text-gray-300 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => load(page + 1)}
                disabled={page === pages}
                className="px-3 py-1.5 text-sm bg-adminBg border border-adminBorder rounded-lg text-gray-300 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}