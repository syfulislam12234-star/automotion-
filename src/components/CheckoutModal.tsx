import React, { useEffect, useState } from 'react';
import { X, Copy, Check, Loader2, CheckCircle2, Wallet } from 'lucide-react';
import { AuthService } from '../services/authService';

export interface CheckoutPlan {
  id: string;
  name: string;
  amount: number;
  currency: string;
  priceLabel: string;
}

interface PaymentMethods {
  bkash: string;
  nagad: string;
  rocket: string;
  instructions: string;
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: CheckoutPlan | null;
  onShowToast: (msg: string) => void;
}

const METHOD_OPTIONS: Array<{ id: string; label: string; icon: string }> = [
  { id: 'bkash', label: 'bKash', icon: '📱' },
  { id: 'nagad', label: 'Nagad', icon: '📲' },
  { id: 'rocket', label: 'Rocket', icon: '🚀' },
];

const authHeaders = (): Record<string, string> => {
  const session = AuthService.getCurrentSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;
  return headers;
};

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, plan, onShowToast }) => {
  const [methods, setMethods] = useState<PaymentMethods>({ bkash: '', nagad: '', rocket: '', instructions: '' });
  const [paymentMethod, setPaymentMethod] = useState('bkash');
  const [senderPhone, setSenderPhone] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setSubmitted(false);
    setPaymentMethod('bkash');
    setSenderPhone('');
    setTransactionId('');
    setCopied('');
    fetch('/api/payments/methods')
      .then((r) => r.json().catch(() => ({})))
      .then((d: any) => { if (d?.success && d.paymentMethods) setMethods(d.paymentMethods); })
      .catch(() => { /* admin-configured numbers load when available */ });
  }, [isOpen]);

  if (!isOpen || !plan) return null;

  const methodNumber = paymentMethod === 'nagad' ? methods.nagad : paymentMethod === 'rocket' ? methods.rocket : methods.bkash;

  const copyNumber = (label: string, value: string) => {
    if (!value) return;
    try {
      navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(''), 1400);
    } catch { /* noop */ }
  };

  const handleSubmit = async () => {
    if (!paymentMethod) { onShowToast('⚠️ Please select a payment method.'); return; }
    if (!senderPhone.trim()) { onShowToast('⚠️ Please enter your sender number.'); return; }
    if (!transactionId.trim()) { onShowToast('⚠️ Please enter your Transaction (Txn) ID.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/payments/submit', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          amount: plan.amount,
          currency: plan.currency,
          paymentMethod,
          transactionId: transactionId.trim(),
          planId: plan.id,
          notes: `Sender ${senderPhone.trim()}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error((data as any)?.message || `Submission failed (HTTP ${res.status}).`);
      setSubmitted(true);
      onShowToast('Payment submitted! Admin will verify and activate your plan shortly.');
    } catch (err: any) {
      onShowToast(`⚠️ ${err?.message || 'Payment submission failed.'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Manual Payment Checkout</h2>
              <p className="text-[11px] text-slate-400">{plan.name} · {plan.priceLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 rounded-xl transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="p-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-100">Payment submitted!</h3>
            <p className="text-xs text-slate-300">Admin will verify and activate your plan shortly.</p>
            <div className="text-[11px] text-slate-500">Keep your Txn ID: <span className="text-emerald-300 font-mono">{transactionId}</span></div>
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-600/30 transition-colors">Done</button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">{methods.instructions || 'Send the plan amount to the number below, then enter your sender &amp; Txn ID.'}</p>

            <div>
              <div className="text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Payment Method</div>
              <div className="grid grid-cols-3 gap-2">
                {METHOD_OPTIONS.map((m) => (
                  <button key={m.id} onClick={() => setPaymentMethod(m.id)} className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-xs font-medium transition-colors border ${paymentMethod === m.id ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                    <span className="text-lg leading-none">{m.icon}</span><span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-800/70 border border-slate-700">
              <div className="flex items-center gap-2"><span className="text-xs font-medium text-slate-300">Send to:</span><span className="font-mono text-sm text-emerald-300">{methodNumber || '—'}</span></div>
              {methodNumber ? (<button onClick={() => copyNumber('number', methodNumber)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700/60 text-slate-200 text-[11px] hover:bg-slate-700">{copied === 'number' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />} {copied === 'number' ? 'Copied' : 'Copy'}</button>) : null}
            </div>

            <label className="block">
              <span className="text-xs font-medium text-slate-400 mb-1 block">Sender Phone Number</span>
              <input value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} inputMode="tel" placeholder="01XXX-XXXXXX" className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50" />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-400 mb-1 block">Transaction ID (Txn ID)</span>
              <input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="From your payment SMS, e.g. 9HG7K2P3Q1M" className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50" />
            </label>

            <div className="flex items-center justify-between gap-3">
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50">{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Submit Payment</button>
            </div>

            <p className="text-[11px] text-slate-500 text-center">🔒 Your plan activates after the admin verifies this payment.</p>
          </div>
        )}
      </div>
    </div>
  );
};