import React, { useEffect, useState } from 'react';
import { Headphones, Loader2, RefreshCw, Send, CheckCircle2, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { AuthService } from '../services/authService';
import { SupportTicket } from '../types';

interface AdminSupportTicketsProps { onShowToast: (msg: string) => void; }

const authHeaders = (): Record<string, string> => {
  const s = AuthService.getCurrentSession(); const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (s?.token) h['Authorization'] = `Bearer ${s.token}`; return h;
};
const statusIcon = (st: SupportTicket['status']) => st === 'resolved' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Clock className="w-4 h-4 text-amber-400" />;

export const AdminSupportTickets: React.FC<AdminSupportTicketsProps> = ({ onShowToast }) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'all' | 'open' | 'resolved'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/support-tickets?status=${status}`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (data.success) setTickets(data.tickets || []); else throw new Error(data.message || 'Failed to load tickets.');
    } catch (err: any) { onShowToast(`⚠️ ${err?.message || 'Failed to load tickets.'}`); } finally { setLoading(false); }
  };

  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const reply = async (id: string) => {
    if (!replyText.trim()) return;
    try {
      const res = await fetch(`/api/admin/support-tickets/${id}/reply`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ message: replyText.trim() }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'Reply failed.');
      setReplyText(''); onShowToast('✅ Reply sent.'); load();
    } catch (err: any) { onShowToast(`⚠️ ${err?.message || 'Failed to send reply.'}`); }
  };

  const toggleStatus = async (id: string, current: 'open' | 'resolved') => {
    try {
      const next = current === 'open' ? 'resolved' : 'open';
      const res = await fetch(`/api/admin/support-tickets/${id}/status`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ status: next }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'Update failed.');
      onShowToast(`✅ Ticket marked ${next}.`); load();
    } catch (err: any) { onShowToast(`⚠️ ${err?.message || 'Failed to update ticket.'}`); }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
        <div className="flex items-center gap-2"><Headphones className="w-5 h-5 text-fuchsia-400" /><h3 className="font-semibold text-slate-100">Support Tickets</h3></div>
        <div className="flex items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="py-1.5 px-3 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-fuchsia-500/50">
            <option value="all">All</option><option value="open">Open</option><option value="resolved">Resolved</option>
          </select>
          <button onClick={load} className="p-2 rounded-xl bg-slate-800/80 text-slate-300 border border-slate-700 hover:bg-slate-700/80"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>
      <div className="divide-y divide-slate-800/60 max-h-[60vh] overflow-y-auto">
        {loading ? (
          <div className="p-10 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading tickets…</div>
        ) : tickets.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No support tickets.</div>
        ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => {
          const isOpen = expanded === ticket.id;
          return (
            <div key={ticket.id}>
              <button onClick={() => setExpanded(isOpen ? null : ticket.id)} className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-slate-800/30">
                <div className="flex items-center gap-3 min-w-0">
                  {statusIcon(ticket.status)}
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-100 truncate">{ticket.subject}</div>
                    <div className="text-[11px] text-slate-500">{ticket.userEmail || ticket.userId} · {ticket.category} · {ticket.priority} · {new Date(ticket.createdAt).toLocaleString()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ticket.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{ticket.status}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </button>
              {isOpen && (
                <div className="px-5 pb-4 space-y-3 border-t border-slate-800/60 pt-3 bg-slate-900/40">
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{ticket.description}</p>
                  {ticket.replies.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-800/60">
                      {ticket.replies.map((r) => (
                        <div key={r.id} className={`p-3 rounded-xl text-xs ${r.authorRole === 'admin' ? 'bg-fuchsia-500/10 border border-fuchsia-500/20' : 'bg-slate-800/60 border border-slate-700'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-semibold ${r.authorRole === 'admin' ? 'text-fuchsia-300' : 'text-slate-300'}`}>{r.authorRole === 'admin' ? '🛡️ Admin' : '👤 User'}</span>
                            <span className="text-[10px] text-slate-500">{new Date(r.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-slate-200 whitespace-pre-wrap">{r.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write a reply…" className="flex-1 py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-fuchsia-500/50" />
                    <button onClick={() => reply(ticket.id)} className="px-3 py-2 rounded-xl bg-fuchsia-600 text-white"><Send className="w-4 h-4" /></button>
                  </div>
                  <button onClick={() => toggleStatus(ticket.id, ticket.status)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${ticket.status === 'open' ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-600/20 text-amber-300 border border-amber-500/30'}`}>
                    {ticket.status === 'open' ? 'Mark Resolved' : 'Reopen Ticket'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
            </div>
          )
        }
      </div>
    </div>
  );
};