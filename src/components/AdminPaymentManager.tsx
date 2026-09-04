import React, { useCallback, useEffect, useState } from 'react';
import {
  CreditCard, Search, CheckCircle2, XCircle, RefreshCw, ChevronLeft, ChevronRight,
  Loader2, Wallet, Clock, Ban,
} from 'lucide-react';
import { AuthService } from '../services/authService';

interface PaymentRow {
  id: string;
  userId: string;
  amount: number;
  currency: 'BDT' | 'USD';
  paymentMethod: string;
  transactionId: string;
  status: 'pending' | 'approved' | 'rejected';
  planId: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  userEmail?: string;
  userName?: string;
  reviewedAt?: string;
}

interface PaymentsResponse {
  success: boolean;
  payments: PaymentRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  message?: string;
}

const PLAN_CREDITS: Record<string, number> = { free: 500, pro: 2000, enterprise: 10000 };
const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: 'pending', label: '⏳ Pending' },
  { key: 'approved', label: '✅ Approved' },
  { key: 'rejected', label: '❌ Rejected' },
  { key: 'all', label: 'All' },
];

const authHeaders = (): Record<string, string> => {
  const session = AuthService.getCurrentSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;
  return headers;
};

const formatDate = (value?: string): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const statusBadge = (status: string): { label: string; cls: string } => {
  switch (status) {
    case 'approved': return { label: '✅ Approved', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' };
    case 'rejected': return { label: '❌ Rejected', cls: 'bg-red-500/10 text-red-300 border-red-500/30' };
    default: return { label: '⏳ Pending', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30' };
  }
};

const methodIcon = (method: string): string => {
  switch (String(method || '').toLowerCase()) {
    case 'bkash': return '📱';
    case 'nagad': return '📲';
    case 'rocket': return '🚀';
    case 'bank': return '🏦';
    case 'card': return '💳';
    default: return '💰';
  }
};

export const AdminPaymentManager: React.FC<{ onShowToast: (message: string) => void }> = ({ onShowToast }) => {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approving, setApproving] = useState<PaymentRow | null>(null);
  const [rejecting, setRejecting] = useState<PaymentRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState(false);

  const loadPayments = useCallback(async (targetPage = page) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(targetPage),
        limit: '15',
        status: statusFilter,
        search,
      });
      const res = await fetch(`/api/admin/payments?${qs.toString()}`, { headers: authHeaders() });
      const data: PaymentsResponse = await res.json().catch(() => ({ success: false } as PaymentsResponse));
      if (!res.ok || !data.success) {
        throw new Error(data.message || `Unable to load payments (HTTP ${res.status}).`);
      }
      setRows(data.payments || []);
      setTotal(data.total || 0);
      setPage(data.page || targetPage);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      onShowToast(`⚠️ ${err?.message || 'Failed to load payments.'}`);
      setRows([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, search]);

  useEffect(() => { loadPayments(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [statusFilter, search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleApprove = async () => {
    if (!approving) return;
    const payment = approving;
    setBusyId(payment.id);
    setApproving(null);
    try {
      const res = await fetch('/api/admin/payments/approve', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ paymentId: payment.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data?.message || `Approval failed (HTTP ${res.status}).`);
      onShowToast(`✅ ${data.message || 'Payment approved.'}`);
      loadPayments(page);
    } catch (err: any) {
      onShowToast(`⚠️ ${err?.message || 'Approval failed.'}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async () => {
    if (!rejecting) return;
    if (!rejectReason.trim()) {
      onShowToast('⚠️ A rejection reason is required.');
      return;
    }
    const payment = rejecting;
    setBusyId(payment.id);
    setRejecting(null);
    try {
      const res = await fetch('/api/admin/payments/reject', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ paymentId: payment.id, reason: rejectReason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data?.message || `Rejection failed (HTTP ${res.status}).`);
      onShowToast(`❌ Payment ${payment.transactionId} rejected.`);
      setRejectReason('');
      loadPayments(page);
    } catch (err: any) {
      onShowToast(`⚠️ ${err?.message || 'Rejection failed.'}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Payment Management</h2>
              <p className="text-xs text-slate-400">Verify manual bKash/Nagad/Rocket/Bank/Card payments — approval auto-applies plan &amp; credits — {total} transaction{total === 1 ? '' : 's'}</p>
            </div>
          </div>
          <button
            onClick={() => loadPayments(page)}
            className="p-2.5 rounded-xl bg-slate-800/80 text-slate-300 border border-slate-700 hover:bg-slate-700/80 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status filter tabs + search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/80 border border-slate-800">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${statusFilter === f.key ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by Txn ID, email, or name…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </form>
      </div>

      {/* Payments table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-900/90 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Txn ID</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading payments…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No transactions match the current filters.</td></tr>
              )}
              {!loading && rows.map((payment) => {
                const badge = statusBadge(payment.status);
                const isPending = payment.status === 'pending';
                return (
                  <tr key={payment.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-200">{payment.userName || 'Unknown user'}</div>
                      <div className="text-xs text-slate-500">{payment.userEmail || payment.userId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="px-1.5 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300">{payment.transactionId}</code>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-medium text-slate-200">
                        <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                        {payment.currency === 'USD' ? '$' : '৳'}{payment.amount}
                        <span className="text-[10px] text-slate-500">{payment.currency}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{methodIcon(payment.paymentMethod)} {payment.paymentMethod}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs border capitalize bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30">{payment.planId}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(payment.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${badge.cls}`}>{badge.label}</span>
                      {payment.status === 'rejected' && payment.notes && (
                        <div className="text-[10px] text-slate-500 mt-1 max-w-[160px] truncate" title={payment.notes}>Reason: {payment.notes}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {isPending ? (
                          <>
                            <button
                              onClick={() => setApproving(payment)}
                              disabled={busyId === payment.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 text-xs transition-colors disabled:opacity-50"
                              title="Approve — auto-applies plan & credits"
                            >
                              {busyId === payment.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Approve
                            </button>
                            <button
                              onClick={() => { setRejecting(payment); setRejectReason(''); }}
                              disabled={busyId === payment.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20 text-xs transition-colors disabled:opacity-50"
                              title="Reject with reason"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Reject
                            </button>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500"><Clock className="w-3 h-3" /> Reviewed {formatDate(payment.reviewedAt || payment.updatedAt)}</span>
                        )}
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
              onClick={() => loadPayments(Math.max(1, page - 1))}
              disabled={page <= 1 || loading}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 disabled:opacity-40 hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => loadPayments(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages || loading}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 disabled:opacity-40 hover:bg-slate-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Approve confirmation modal */}
      {approving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => !acting && setApproving(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-100">Approve this payment?</h3>
                <p className="text-xs text-slate-400 mt-1">
                  <span className="text-slate-200">{approving.userName} ({approving.userEmail})</span> paid{' '}
                  <span className="text-emerald-300">{approving.currency === 'USD' ? '$' : '৳'}{approving.amount}</span> via {approving.paymentMethod} (Txn <code className="text-[10px]">{approving.transactionId}</code>).
                </p>
                <div className="mt-2 text-xs text-slate-300 space-y-1 bg-slate-800/60 rounded-xl p-3 border border-slate-700">
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Activates <span className="capitalize font-medium">{approving.planId}</span> plan</div>
                  <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-emerald-400" /> Extends expiry by 30 days</div>
                  <div className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5 text-emerald-400" /> Grants {PLAN_CREDITS[approving.planId] || 500} credits</div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setApproving(null)} disabled={acting} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 text-sm hover:bg-slate-700 disabled:opacity-50">Cancel</button>
              <button onClick={handleApprove} disabled={acting} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50">
                {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Approve &amp; Upgrade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => !acting && setRejecting(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30">
                <Ban className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-100">Reject payment</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Txn <code className="text-[10px]">{rejecting.transactionId}</code> from {rejecting.userName || rejecting.userEmail}. A reason is required and is shown in the admin log.
                </p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Transaction ID not found in bKash statement"
                  className="mt-2 w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500/50 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setRejecting(null)} disabled={acting} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 text-sm hover:bg-slate-700 disabled:opacity-50">Cancel</button>
              <button onClick={handleReject} disabled={acting || !rejectReason.trim()} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500 disabled:opacity-50">
                {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Reject Payment
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};
