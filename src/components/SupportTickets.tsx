import React, { useEffect, useState } from 'react';
import { X, Plus, MessageSquare, Clock, CheckCircle2, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { AuthService } from '../services/authService';
import { SupportTicket } from '../types';

interface SupportTicketsProps { isOpen: boolean; onClose: () => void; onShowToast: (msg: string) => void; }

const CATEGORIES: Array<{ id: SupportTicket['category']; label: string }> = [
  { id: 'billing', label: '💳 Billing & Payments' }, { id: 'technical', label: '🛠️ Technical Issue' },
  { id: 'account', label: '👤 Account' }, { id: 'feature', label: '💡 Feature Request' }, { id: 'other', label: '📋 Other' },
];
const PRIORITIES: Array<{ id: SupportTicket['priority']; label: string; color: string }> = [
  { id: 'low', label: 'Low', color: 'text-slate-400' }, { id: 'medium', label: 'Medium', color: 'text-amber-400' },
  { id: 'high', label: 'High', color: 'text-orange-400' }, { id: 'urgent', label: 'Urgent', color: 'text-red-400' },
];
const authHeaders = (): Record<string, string> => {
  const s = AuthService.getCurrentSession(); const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (s?.token) h['Authorization'] = `Bearer ${s.token}`; return h;
};
const statusIcon = (status: SupportTicket['status']) =>
  status === 'resolved' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Clock className="w-4 h-4 text-amber-400" />;

export const SupportTickets: React.FC<SupportTicketsProps> = ({ isOpen, onClose, onShowToast }) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<SupportTicket['category']>('technical');
  const [priority, setPriority] = useState<SupportTicket['priority']>('medium');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/support/tickets', { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (data.success) setTickets(data.tickets || []); else throw new Error(data.message || 'Failed to load tickets.');
    } catch (err: any) { onShowToast(`⚠️ ${err?.message || 'Failed to load tickets.'}`); } finally { setLoading(false); }
  };

  useEffect(() => { if (isOpen) { loadTickets(); setShowForm(false); } }, [isOpen]);

  const resetForm = () => { setSubject(''); setCategory('technical'); setPriority('medium'); setDescription(''); };

  const submitTicket = async () => {
    if (!subject.trim() || !description.trim()) { onShowToast('⚠️ Subject and description are required.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/support/tickets', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ subject: subject.trim(), category, priority, description: description.trim() }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || `Submit failed (HTTP ${res.status}).`);
      onShowToast('✅ Support ticket submitted. We will respond shortly.'); resetForm(); setShowForm(false); loadTickets();
    } catch (err: any) { onShowToast(`⚠️ ${err?.message || 'Failed to submit ticket.'}`); } finally { setSubmitting(false); }
  };

  const submitReply = async (ticketId: string) => {
    if (!replyText.trim()) return;
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/reply`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ message: replyText.trim() }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'Reply failed.');
      setReplyText(''); setReplyingTo(null); onShowToast('✅ Reply sent.'); loadTickets();
    } catch (err: any) { onShowToast(`⚠️ ${err?.message || 'Failed to send reply.'}`); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20"><MessageSquare className="w-5 h-5" /></div>
            <div><h2 className="text-lg font-bold text-slate-100">Support Tickets</h2><p className="text-[11px] text-slate-400">{tickets.length} ticket{tickets.length === 1 ? '' : 's'}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowForm(!showForm); resetForm(); }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-500"><Plus className="w-3.5 h-3.5" /> New Ticket</button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 rounded-xl"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {showForm && (
            <div className="p-4 rounded-2xl border border-sky-500/30 bg-sky-500/5 space-y-3">
              <div className="text-sm font-semibold text-slate-100">Submit a new ticket</div>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/50" />
              <div className="grid grid-cols-2 gap-3">
                <select value={category} onChange={(e) => setCategory(e.target.value as any)} className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-sky-500/50">{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
                <select value={priority} onChange={(e) => setPriority(e.target.value as any)} className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-sky-500/50">{PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
              </div>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Describe your issue in detail..." className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/50 resize-none" />
              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowForm(false); resetForm(); }} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700">Cancel</button>
                <button onClick={submitTicket} disabled={submitting} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-500 disabled:opacity-50">{submitting ? 'Sending...' : 'Submit Ticket'}</button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="p-10 text-center text-slate-400 text-sm">Loading tickets…</div>
          ) : tickets.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">No support tickets yet. Click "New Ticket" to get help.</div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => {
                const expanded = expandedTicket === ticket.id;
                return (
                  <div key={ticket.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                    <button onClick={() => setExpandedTicket(expanded ? null : ticket.id)} className="w-full flex items-center justify-between gap-3 p-4 text-left">
                      <div className="flex items-center gap-3 min-w-0">
                        {statusIcon(ticket.status)}
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-100 truncate">{ticket.subject}</div>
                          <div className="text-[11px] text-slate-500">{ticket.category} · <span className={PRIORITIES.find((p) => p.id === ticket.priority)?.color}>{ticket.priority}</span> · {new Date(ticket.createdAt).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ticket.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{ticket.status}</span>
                        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </button>
                    {expanded && (
                      <div className="border-t border-slate-800 p-4 space-y-3">
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{ticket.description}</p>
                        {ticket.replies.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-slate-800/60">
                            {ticket.replies.map((r) => (
                              <div key={r.id} className={`p-3 rounded-xl text-xs ${r.authorRole === 'admin' ? 'bg-sky-500/10 border border-sky-500/20' : 'bg-slate-800/60 border border-slate-700'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`font-semibold ${r.authorRole === 'admin' ? 'text-sky-300' : 'text-slate-300'}`}>{r.authorRole === 'admin' ? '🛡️ Support' : 'You'}</span>
                                  <span className="text-[10px] text-slate-500">{new Date(r.createdAt).toLocaleString()}</span>
                                </div>
                                <p className="text-slate-200 whitespace-pre-wrap">{r.message}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {ticket.status !== 'resolved' && (
                          <div className="pt-2">
                            {replyingTo === ticket.id ? (
                              <div className="flex gap-2">
                                <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write a reply..." className="flex-1 py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/50" />
                                <button onClick={() => submitReply(ticket.id)} className="px-3 py-2 rounded-xl bg-sky-600 text-white"><Send className="w-4 h-4" /></button>
                              </div>
                            ) : (
                              <button onClick={() => setReplyingTo(ticket.id)} className="text-xs text-sky-400 hover:text-sky-300">Reply</button>
                            )}
                          </div>
                        )}
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
  </div>
);
};
