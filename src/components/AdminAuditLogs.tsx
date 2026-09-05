import React, { useEffect, useState } from 'react';
import { ScrollText, Loader2, RefreshCw, Search } from 'lucide-react';
import { AuthService } from '../services/authService';
import { AuditLog } from '../types';

interface AdminAuditLogsProps { onShowToast: (msg: string) => void; }

const authHeaders = (): Record<string, string> => {
  const s = AuthService.getCurrentSession(); const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (s?.token) h['Authorization'] = `Bearer ${s.token}`; return h;
};

const ACTION_LABELS: Record<string, string> = {
  APPROVE_PAYMENT: '✅ Approve Payment', REJECT_PAYMENT: '❌ Reject Payment', BLOCK_USER: '🚫 Block User',
  UNBLOCK_USER: '🔓 Unblock User', UPDATE_CONFIG: '⚙️ Update Config', TOGGLE_MAINTENANCE: '🛠️ Maintenance Toggle',
  ASSIGN_ADMIN: '👑 Assign Admin', UPDATE_ADS: '📢 Update Ads', UPDATE_AI: '🧠 Update AI',
  UPDATE_PAYMENT_METHODS: '💳 Payment Methods', REPLY_SUPPORT: '💬 Support Reply', UPDATE_SUPPORT_STATUS: '🎧 Support Status',
};

export const AdminAuditLogs: React.FC<AdminAuditLogsProps> = ({ onShowToast }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [action, setAction] = useState('all');
  const [search, setSearch] = useState('');

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20', action, search });
      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (data.success) { setLogs(data.logs || []); setTotalPages(data.totalPages || 1); setPage(data.page || 1); }
      else throw new Error(data.message || 'Failed to load audit logs.');
    } catch (err: any) { onShowToast(`⚠️ ${err?.message || 'Failed to load audit logs.'}`); } finally { setLoading(false); }
  };

  useEffect(() => { load(1); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
        <div className="flex items-center gap-2"><ScrollText className="w-5 h-5 text-amber-400" /><h3 className="font-semibold text-slate-100">Audit Logs</h3></div>
        <button onClick={() => load(page)} className="p-2 rounded-xl bg-slate-800/80 text-slate-300 border border-slate-700 hover:bg-slate-700/80"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>
      <div className="px-5 py-3 flex flex-wrap items-center gap-2 border-b border-slate-800/60">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load(1)} placeholder="Search logs…" className="w-full py-2 pl-9 pr-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50" />
        </div>
        <select value={action} onChange={(e) => setAction(e.target.value)} className="py-2 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50">
          <option value="all">All actions</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="divide-y divide-slate-800/60 max-h-[60vh] overflow-y-auto">
        {loading ? (
          <div className="p-10 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading audit logs…</div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No audit entries found.</div>
        ) : logs.map((log) => (
          <div key={log.id} className="px-5 py-3 flex items-start gap-3 hover:bg-slate-800/30">
            <span className="text-sm shrink-0 mt-0.5">{ACTION_LABELS[log.action] || log.action}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-slate-200 truncate">{log.details || '—'}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                by {log.adminEmail || log.adminUserId}{log.targetUserId ? ` → ${log.targetUserId}` : ''} · {new Date(log.createdAt).toLocaleString()}
                {log.ipAddress ? ` · ${log.ipAddress}` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => load(page - 1)} disabled={page <= 1} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40">Prev</button>
            <button onClick={() => load(page + 1)} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
};