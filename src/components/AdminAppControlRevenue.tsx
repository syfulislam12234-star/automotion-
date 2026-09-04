import React, { useEffect, useState } from 'react';
import {
  Settings2, Send, TrendingUp, Loader2, RefreshCw, Save, Megaphone, DollarSign, Users, CheckCircle2, Clock, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { AuthService } from '../services/authService';

interface AppControl {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  registrationOpen: boolean;
  freeTrial: { enabled: boolean; trialDays: number; bonusCredits: number };
  featureToggles: { liveStreaming: boolean; ytCheck: boolean; ytSeo: boolean; ytViral: boolean; autoUpload: boolean };
}

interface RevenueStats {
  revenueByCurrency: Record<string, number>;
  monthlyRecurringByCurrency: Record<string, number>;
  approvedPaymentsCount: number;
  pendingPaymentsCount: number;
  rejectedPaymentsCount: number;
  activeSubscribers: { pro: number; enterprise: number; total: number };
  monthlyBreakdown: Array<{ month: string; byCurrency: Record<string, number> }>;
}

const authHeaders = (): Record<string, string> => {
  const session = AuthService.getCurrentSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;
  return headers;
};

const FEATURES: Array<{ key: keyof AppControl['featureToggles']; label: string }> = [
  { key: 'liveStreaming', label: '🎥 Live Streaming' },
  { key: 'ytCheck', label: '📊 /yt_check — Channel Analytics' },
  { key: 'ytSeo', label: '🔥 /yt_seo — AI Channel SEO' },
  { key: 'ytViral', label: '🔮 /yt_viral — Viral Predictor' },
  { key: 'autoUpload', label: '📤 Auto-Upload' },
];

const currencySymbol = (currency: string): string => (String(currency).toUpperCase() === 'USD' ? '$' : '৳');

export const AdminAppControlRevenue: React.FC<{ onShowToast: (message: string) => void }> = ({ onShowToast }) => {
  const [loading, setLoading] = useState(true);
  const [savingControl, setSavingControl] = useState(false);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [appControl, setAppControl] = useState<AppControl>({
    maintenanceMode: false,
    maintenanceMessage: '',
    registrationOpen: true,
    freeTrial: { enabled: false, trialDays: 3, bonusCredits: 100 },
    featureToggles: { liveStreaming: true, ytCheck: true, ytSeo: true, ytViral: true, autoUpload: true },
  });
  const [broadcast, setBroadcast] = useState('');
  const [broadcastChannel, setBroadcastChannel] = useState<'in-app' | 'telegram' | 'both'>('in-app');
  const [stats, setStats] = useState<RevenueStats | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [controlRes, revenueRes] = await Promise.all([
        fetch('/api/admin/system/app-control', { headers: authHeaders() }),
        fetch('/api/admin/analytics/revenue', { headers: authHeaders() }),
      ]);
      const control = await controlRes.json().catch(() => ({}));
      const revenue = await revenueRes.json().catch(() => ({}));
      if (control.success) setAppControl(control.appControl);
      else throw new Error(control.message || `Failed to load app control (HTTP ${controlRes.status}).`);
      if (revenue.success) setStats(revenue.stats);
      else throw new Error(revenue.message || `Failed to load revenue (HTTP ${revenueRes.status}).`);
    } catch (err: any) {
      onShowToast(`⚠️ ${err?.message || 'Failed to load app control data.'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const saveAppControl = async () => {
    setSavingControl(true);
    try {
      const res = await fetch('/api/admin/system/app-control', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ...appControl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data?.message || `Save failed (HTTP ${res.status}).`);
      if (data.appControl) setAppControl(data.appControl);
      onShowToast('✅ App control settings saved.');
      if (appControl.maintenanceMode) onShowToast('⚠️ Maintenance mode is now ACTIVE — non-admin access is paused.');
    } catch (err: any) {
      onShowToast(`⚠️ ${err?.message || 'Failed to save app control settings.'}`);
    } finally {
      setSavingControl(false);
    }
  };

  const sendBroadcast = async () => {
    if (!broadcast.trim()) {
      onShowToast('⚠️ Write a message before broadcasting.');
      return;
    }
    setSendingBroadcast(true);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ message: broadcast.trim(), channel: broadcastChannel }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || `Broadcast failed (HTTP ${res.status}).`);
      onShowToast(`✅ ${data.message || 'Broadcast sent.'}`);
      setBroadcast('');
    } catch (err: any) {
      onShowToast(`⚠️ ${err?.message || 'Broadcast failed.'}`);
    } finally {
      setSendingBroadcast(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="flex items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Settings2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">App Control &amp; Revenue</h2>
            <p className="text-xs text-slate-400">Maintenance, registration, free trials, feature switches, broadcasts &amp; financial analytics</p>
          </div>
        </div>
        <button onClick={loadAll} className="p-2.5 rounded-xl bg-slate-800/80 text-slate-300 border border-slate-700 hover:bg-slate-700/80 transition-colors" title="Reload">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="p-10 rounded-2xl border border-slate-800 bg-slate-900/60 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading app control data…</div>
      ) : (
        <>
          {/* APP CONTROL SECTION */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-sky-400" />
                <h3 className="font-semibold text-slate-100">App Control</h3>
              </div>
              <button onClick={saveAppControl} disabled={savingControl} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-medium hover:bg-sky-500 disabled:opacity-50">
                {savingControl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </button>
            </div>
            <div className="px-5 py-4 space-y-5">
              {/* Maintenance */}
              <button onClick={() => setAppControl({ ...appControl, maintenanceMode: !appControl.maintenanceMode })} className="flex items-center justify-between w-full p-4 rounded-xl bg-slate-800/60 border border-slate-700 hover:border-slate-600 transition-colors text-left">
                <div>
                  <div className="font-medium text-slate-200">Maintenance Mode</div>
                  <div className="text-xs text-slate-500">When ON, non-admin web users get a maintenance notice; bots reply with the announcement</div>
                </div>
                <span className="text-3xl leading-none">{appControl.maintenanceMode ? '🟠' : '⚪'}</span>
              </button>
              {appControl.maintenanceMode && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Maintenance Announcement</label>
                  <input
                    value={appControl.maintenanceMessage}
                    onChange={(e) => setAppControl({ ...appControl, maintenanceMessage: e.target.value })}
                    placeholder="e.g. 🛠️ Scheduled maintenance — back in 30 minutes!"
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
                  />
                </div>
              )}

              {/* Registration */}
              <button onClick={() => setAppControl({ ...appControl, registrationOpen: !appControl.registrationOpen })} className="flex items-center justify-between w-full p-4 rounded-xl bg-slate-800/60 border border-slate-700 hover:border-slate-600 transition-colors text-left">
                <div>
                  <div className="font-medium text-slate-200">Registration Open</div>
                  <div className="text-xs text-slate-500">When OFF, new account signups are blocked (existing users unaffected)</div>
                </div>
                <span className="text-3xl leading-none">{appControl.registrationOpen ? '🟢' : '🔴'}</span>
              </button>

              {/* Free trial */}
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-3">
                <button onClick={() => setAppControl({ ...appControl, freeTrial: { ...appControl.freeTrial, enabled: !appControl.freeTrial.enabled } })} className="flex items-center justify-between w-full text-left">
                  <div>
                    <div className="font-medium text-slate-200">Free Trial (auto-grant on signup)</div>
                    <div className="text-xs text-slate-500">New users get a Pro trial window + bonus credits</div>
                  </div>
                  <span className="text-2xl leading-none">{appControl.freeTrial.enabled ? '🟢' : '🔴'}</span>
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-400 mb-1 block">Trial Days</span>
                    <input type="number" min={0} value={appControl.freeTrial.trialDays} onChange={(e) => setAppControl({ ...appControl, freeTrial: { ...appControl.freeTrial, trialDays: Math.max(0, Number(e.target.value) || 0) } })} className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-sky-500/50" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-400 mb-1 block">Bonus Credits</span>
                    <input type="number" min={0} value={appControl.freeTrial.bonusCredits} onChange={(e) => setAppControl({ ...appControl, freeTrial: { ...appControl.freeTrial, bonusCredits: Math.max(0, Number(e.target.value) || 0) } })} className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-sky-500/50" />
                  </label>
                </div>
              </div>
              {/* Feature toggles */}
              <div>
                <div className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Feature Toggles</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FEATURES.map((feature) => (
                    <button key={feature.key} onClick={() => setAppControl({ ...appControl, featureToggles: { ...appControl.featureToggles, [feature.key]: !appControl.featureToggles[feature.key] } })} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 hover:border-slate-600 transition-colors text-left">
                      <span className="text-xs font-medium text-slate-200">{feature.label}</span>
                      {appControl.featureToggles[feature.key] ? <ToggleRight className="w-6 h-6 text-emerald-400 shrink-0" /> : <ToggleLeft className="w-6 h-6 text-slate-500 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* BROADCAST SECTION */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-fuchsia-400" />
              <h3 className="font-semibold text-slate-100">Broadcast Notification</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <textarea
                value={broadcast}
                onChange={(e) => setBroadcast(e.target.value)}
                rows={3}
                placeholder="Announcement to all users &amp; Telegram bot owners… e.g. 🎉 New feature live! Stream any device to YouTube now."
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-fuchsia-500/50 resize-none"
              />
              <div className="flex flex-wrap items-center gap-3">
                <select value={broadcastChannel} onChange={(e) => setBroadcastChannel(e.target.value as 'in-app' | 'telegram' | 'both')} className="py-2 px-3 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-fuchsia-500/50">
                  <option value="in-app">📄 In-app alert only</option>
                  <option value="telegram">🤖 Telegram bots only</option>
                  <option value="both">📄 + 🤖 Both</option>
                </select>
                <button onClick={sendBroadcast} disabled={sendingBroadcast || !broadcast.trim()} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-fuchsia-600 text-white text-sm font-medium hover:bg-fuchsia-500 disabled:opacity-50">
                  {sendingBroadcast ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} 🚀 Send Broadcast
                </button>
              </div>
            </div>
          </div>

          {/* REVENUE DASHBOARD */}
          {stats && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-slate-100">Revenue Dashboard</h3>
              </div>
              <div className="px-5 py-4 space-y-4">
                {/* Stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 uppercase tracking-wider"><DollarSign className="w-3.5 h-3.5 text-emerald-400" />Total Revenue</div>
                    <div className="mt-1 text-xl font-bold text-slate-100">
                      {Object.entries(stats.revenueByCurrency).map(([currency, amount], index) => (
                        <span key={currency}>{index > 0 && <span className="mx-1 text-slate-500">+</span>}{currencySymbol(currency)}{Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      ))}
                      {Object.keys(stats.revenueByCurrency).length === 0 && <span className="text-slate-400">—</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                      {Object.entries(stats.revenueByCurrency).map(([currency, amount]) => (
                        <span key={currency}>{currency}: {currencySymbol(currency)}{Number(amount || 0).toFixed(2)}</span>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 uppercase tracking-wider"><Clock className="w-3.5 h-3.5 text-sky-400" />MRR (last 30d)</div>
                    <div className="mt-1 text-xl font-bold text-slate-100">
                      {Object.entries(stats.monthlyRecurringByCurrency).map(([currency, amount], index) => (
                        <span key={currency}>{index > 0 && <span className="mx-1 text-slate-500">+</span>}{currencySymbol(currency)}{Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      ))}
                      {Object.keys(stats.monthlyRecurringByCurrency).length === 0 && <span className="text-slate-400">—</span>}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">Approved revenue, trailing 30 days</div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 uppercase tracking-wider"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />Approved Payments</div>
                    <div className="mt-1 text-xl font-bold text-slate-100">{stats.approvedPaymentsCount}</div>
                    <div className="text-[11px] text-slate-500 mt-1">⏳ {stats.pendingPaymentsCount} pending · ❌ {stats.rejectedPaymentsCount} rejected</div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 uppercase tracking-wider"><Users className="w-3.5 h-3.5 text-amber-400" />Active Subscribers</div>
                    <div className="mt-1 text-xl font-bold text-slate-100">{stats.activeSubscribers.total}</div>
                    <div className="text-[11px] text-slate-500 mt-1">Pro: <span className="text-amber-300">{stats.activeSubscribers.pro}</span> · Enterprise: <span className="text-fuchsia-300">{stats.activeSubscribers.enterprise}</span></div>
                  </div>
                </div>

                {/* Monthly breakdown */}
                <div>
                  <div className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Monthly Revenue (last 6 months)</div>
                  <div className="space-y-2">
                    {stats.monthlyBreakdown.map((entry) => {
                      const total = Object.values(entry.byCurrency).reduce((sum, value) => sum + Number(value || 0), 0);
                      const maxTotal = Math.max(1, ...stats.monthlyBreakdown.map((row) => Object.values(row.byCurrency).reduce((sum, value) => sum + Number(value || 0), 0)));
                      const pct = (total / maxTotal) * 100;
                      return (
                        <div key={entry.month} className="flex items-center gap-3">
                          <span className="w-16 text-[11px] text-slate-400 font-mono shrink-0">{entry.month}</span>
                          <div className="flex-1 h-5 rounded-lg bg-slate-800/60 overflow-hidden">
                            <div className="h-full rounded-lg bg-gradient-to-r from-emerald-600/80 to-sky-500/80 transition-all" style={{ width: `${Math.max(2, pct)}%` }} />
                          </div>
                          <span className="w-24 text-right text-[11px] text-slate-300 font-mono shrink-0">
                            {total > 0 ? Object.entries(entry.byCurrency).map(([currency, amount]) => `${currencySymbol(currency)}${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`).join(' + ') : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};