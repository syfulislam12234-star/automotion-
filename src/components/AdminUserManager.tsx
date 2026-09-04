import React, { useCallback, useEffect, useState } from 'react';
import {
  Users, Search, ShieldBan, ShieldCheck, Crown, CalendarClock, Coins,
  ChevronLeft, ChevronRight, X, RefreshCw, Pencil, Loader2, AlertTriangle,
} from 'lucide-react';
import { AuthService } from '../services/authService';

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'developer' | 'operator' | 'viewer';
  isAdmin?: boolean;
  isVerified: boolean;
  plan?: string;
  subscriptionStatus?: string;
  planExpiresAt?: string | null;
  credits?: number;
  isBlocked: boolean;
  activeSessions?: number;
  createdAt?: string;
  lastLoginAt?: string;
}

interface ListResponse {
  success: boolean;
  users: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  message?: string;
}

interface EditForm {
  plan: string;
  subscriptionStatus: string;
  planExpiresAt: string; // yyyy-MM-dd input value ('' = never)
  credits: string;
  extendDays: string;
}

const PLAN_OPTIONS = ['free', 'pro', 'enterprise'];
const STATUS_OPTIONS = ['active', 'expired', 'canceled', 'none'];

const authHeaders = (): Record<string, string> => {
  const session = AuthService.getCurrentSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;
  return headers;
};

const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const planBadge = (plan?: string): string => {
  switch (plan) {
    case 'enterprise': return 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30';
    case 'pro': return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
    default: return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
  }
};

const statusBadge = (user: AdminUserRow): { label: string; cls: string } => {
  if (user.isBlocked) return { label: '⛔ Blocked', cls: 'bg-red-500/10 text-red-300 border-red-500/30' };
  const sub = user.subscriptionStatus || 'none';
  if (sub === 'active') return { label: '✅ Active', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' };
  if (sub === 'expired') return { label: '⌛ Expired', cls: 'bg-orange-500/10 text-orange-300 border-orange-500/30' };
  if (sub === 'canceled') return { label: '🚫 Canceled', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/30' };
  return { label: '• None', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/30' };
};

export const AdminUserManager: React.FC<{ onShowToast: (message: string) => void }> = ({ onShowToast }) => {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [form, setForm] = useState<EditForm>({ plan: 'free', subscriptionStatus: 'active', planExpiresAt: '', credits: '0', extendDays: '' });
  const [confirmBlock, setConfirmBlock] = useState<AdminUserRow | null>(null);
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async (targetPage = page) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(targetPage),
        pageSize: '10',
        search,
        role: roleFilter,
        plan: planFilter,
        status: statusFilter,
      });
      const res = await fetch(`/api/admin/users?${qs.toString()}`, { headers: authHeaders() });
      const data: ListResponse = await res.json().catch(() => ({ success: false } as ListResponse));
      if (!res.ok || !data.success) {
        throw new Error(data.message || `Unable to load users (HTTP ${res.status}).`);
      }
      setRows(data.users || []);
      setTotal(data.total || 0);
      setPage(data.page || targetPage);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      onShowToast(`⚠️ ${err?.message || 'Failed to load users.'}`);
      setRows([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, roleFilter, planFilter, statusFilter]);

  useEffect(() => { loadUsers(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [search, roleFilter, planFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const openEditModal = (user: AdminUserRow) => {
    setEditing(user);
    const expiry = user.planExpiresAt ? String(user.planExpiresAt).slice(0, 10) : '';
    setForm({
      plan: user.plan || 'free',
      subscriptionStatus: user.subscriptionStatus || 'active',
      planExpiresAt: expiry,
      credits: String(user.credits ?? 0),
      extendDays: '',
    });
  };

  const handleSaveSubscription = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        userIdOrEmail: editing.id,
        plan: form.plan,
        subscriptionStatus: form.subscriptionStatus,
        planExpiresAt: form.planExpiresAt ? new Date(`${form.planExpiresAt}T23:59:59`).toISOString() : null,
        credits: Number(form.credits) || 0,
      };
      const days = Number(form.extendDays);
      if (Number.isFinite(days) && days > 0) payload.extendDays = days;
      const res = await fetch('/api/admin/subscription/update', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data?.message || `Update failed (HTTP ${res.status}).`);
      onShowToast(`✅ Subscription updated for ${editing.name}.`);
      setEditing(null);
      loadUsers(page);
    } catch (err: any) {
      onShowToast(`⚠️ ${err?.message || 'Subscription update failed.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!confirmBlock) return;
    const user = confirmBlock;
    setBusyId(user.id);
    setConfirmBlock(null);
    try {
      const res = await fetch('/api/admin/users/block', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ userIdOrEmail: user.id, blocked: !user.isBlocked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data?.message || `Action failed (HTTP ${res.status}).`);
      onShowToast(user.isBlocked ? `✅ ${user.name} unblocked.` : `⛔ ${user.name} blocked and signed out everywhere.`);
      loadUsers(page);
    } catch (err: any) {
      onShowToast(`⚠️ ${err?.message || 'Block action failed.'}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">User &amp; Subscription Management</h2>
              <p className="text-xs text-slate-400">Search users, manage plans, expiry, credits, and block status — {total} registered user{total === 1 ? '' : 's'}</p>
            </div>
          </div>
          <button
            onClick={() => loadUsers(page)}
            className="p-2.5 rounded-xl bg-slate-800/80 text-slate-300 border border-slate-700 hover:bg-slate-700/80 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, email, or ID…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </form>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="py-2.5 px-3 rounded-xl bg-slate-900/80 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50">
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="developer">Developer</option>
          <option value="operator">Operator</option>
          <option value="viewer">Viewer</option>
        </select>
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="py-2.5 px-3 rounded-xl bg-slate-900/80 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50">
          <option value="all">All Plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="py-2.5 px-3 rounded-xl bg-slate-900/80 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50">
          <option value="all">Any Status</option>
          <option value="blocked">Blocked</option>
          <option value="active_sub">Subscription Active</option>
          <option value="expired_sub">Subscription Expired</option>
          <option value="canceled">Canceled</option>
          <option value="none">No Subscription</option>
        </select>
      </div>

      {/* Users table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-900/90 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Expiry</th>
                <th className="px-4 py-3">Credits</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading users…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No users match the current filters.</td></tr>
              )}
              {!loading && rows.map((user) => {
                const badge = statusBadge(user);
                return (
                  <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-200">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${user.role === 'admin' ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' : 'bg-slate-500/10 text-slate-400 border-slate-500/30'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs border capitalize ${planBadge(user.plan)}`}>
                        {user.plan || 'free'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(user.planExpiresAt)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-slate-300"><Coins className="w-3.5 h-3.5 text-amber-400" />{user.credits ?? 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${badge.cls}`}>{badge.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20 text-xs transition-colors"
                          title="Edit plan / expiry / credits"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => setConfirmBlock(user)}
                          disabled={busyId === user.id}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs transition-colors disabled:opacity-50 ${user.isBlocked ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20' : 'bg-red-500/10 text-red-300 border-red-500/30 hover:bg-red-500/20'}`}
                          title={user.isBlocked ? 'Unblock user' : 'Block user (revokes sessions)'}
                        >
                          {busyId === user.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : user.isBlocked ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldBan className="w-3.5 h-3.5" />}
                          {user.isBlocked ? 'Unblock' : 'Block'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-t border-slate-800">
          <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadUsers(Math.max(1, page - 1))}
              disabled={page <= 1 || loading}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 disabled:opacity-40 hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => loadUsers(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages || loading}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 disabled:opacity-40 hover:bg-slate-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit subscription modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => !saving && setEditing(null)}>
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-slate-100">Edit Subscription — {editing.name}</h3>
              </div>
              <button onClick={() => !saving && setEditing(null)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Plan</label>
                <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} className="w-full py-2.5 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50">
                  {PLAN_OPTIONS.map((p) => <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Subscription Status</label>
                <select value={form.subscriptionStatus} onChange={(e) => setForm({ ...form, subscriptionStatus: e.target.value })} className="w-full py-2.5 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50">
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5"><CalendarClock className="w-3.5 h-3.5 inline mr-1" />Expiry Date</label>
                  <input type="date" value={form.planExpiresAt} onChange={(e) => setForm({ ...form, planExpiresAt: e.target.value })} className="w-full py-2.5 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5"><Coins className="w-3.5 h-3.5 inline mr-1" />Credits</label>
                  <input type="number" min="0" value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} className="w-full py-2.5 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Extend Expiry by (days, optional)</label>
                <input type="number" min="0" placeholder="e.g. 30" value={form.extendDays} onChange={(e) => setForm({ ...form, extendDays: e.target.value })} className="w-full py-2.5 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50" />
              </div>
              <p className="text-[11px] text-slate-500">Tip: leave Expiry empty for “never expires”. Extending days adds onto the current expiry (or today) and re-activates expired plans.</p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-800">
              <button onClick={() => setEditing(null)} disabled={saving} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 text-sm hover:bg-slate-700 disabled:opacity-50">Cancel</button>
              <button onClick={handleSaveSubscription} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />} Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block confirmation modal */}
      {confirmBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setConfirmBlock(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl border ${confirmBlock.isBlocked ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                {confirmBlock.isBlocked ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-semibold text-slate-100">{confirmBlock.isBlocked ? 'Unblock this user?' : 'Block this user?'}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {confirmBlock.isBlocked
                    ? `${confirmBlock.name} (${confirmBlock.email}) will regain access immediately.`
                    : `${confirmBlock.name} (${confirmBlock.email}) will be signed out of every active session and denied access.`}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setConfirmBlock(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 text-sm hover:bg-slate-700">Cancel</button>
              <button onClick={handleToggleBlock} className={`px-4 py-2 rounded-xl text-white text-sm font-medium ${confirmBlock.isBlocked ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}>
                {confirmBlock.isBlocked ? 'Yes, Unblock' : 'Yes, Block'}
              </button>
            </div>
          </div>
        </div>
      )}



    </div>
  );
};
