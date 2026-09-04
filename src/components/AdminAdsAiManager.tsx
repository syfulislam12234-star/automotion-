import React, { useEffect, useState } from 'react';
import {
  Megaphone, Cpu, Save, Loader2, Plus, Trash2, RefreshCw, ToggleLeft, ToggleRight, Coins,
} from 'lucide-react';
import { AuthService } from '../services/authService';

interface AdPlacement {
  id: string;
  name: string;
  code: string;
  frequency: number;
  enabled: boolean;
}

interface AiProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
}

interface FeatureCreditCosts {
  ytSeoCost: number;
  ytViralCost: number;
  ytCheckCost: number;
  autoUploadCost: number;
}

interface SystemConfig {
  adsEnabled: boolean;
  adsByPlan: { free: boolean; pro: boolean; enterprise: boolean };
  adPlacements: AdPlacement[];
  aiProviders: AiProviderConfig[];
  featureCreditCosts: FeatureCreditCosts;
}

const authHeaders = (): Record<string, string> => {
  const session = AuthService.getCurrentSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;
  return headers;
};

const CREDIT_FIELDS: Array<{ key: keyof FeatureCreditCosts; label: string; hint: string }> = [
  { key: 'ytSeoCost', label: '/yt_seo — AI Channel SEO', hint: 'credits per SEO audit' },
  { key: 'ytViralCost', label: '/yt_viral — Viral Predictor', hint: 'credits per prediction batch' },
  { key: 'ytCheckCost', label: '/yt_check — Channel Analytics', hint: 'credits per analytics run' },
  { key: 'autoUploadCost', label: 'Auto-Upload', hint: 'credits per automated upload' },
];

export const AdminAdsAiManager: React.FC<{ onShowToast: (message: string) => void }> = ({ onShowToast }) => {
  const [loading, setLoading] = useState(true);
  const [savingAds, setSavingAds] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [adsEnabled, setAdsEnabled] = useState(false);
  const [adsByPlan, setAdsByPlan] = useState<{ free: boolean; pro: boolean; enterprise: boolean }>({ free: true, pro: false, enterprise: false });
  const [placements, setPlacements] = useState<AdPlacement[]>([]);
  const [providers, setProviders] = useState<AiProviderConfig[]>([]);
  const [costs, setCosts] = useState<FeatureCreditCosts>({ ytSeoCost: 5, ytViralCost: 8, ytCheckCost: 2, autoUploadCost: 10 });

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/system/config', { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data?.message || `Failed to load config (HTTP ${res.status}).`);
      const config = data.config as SystemConfig;
      setAdsEnabled(config.adsEnabled === true);
      setAdsByPlan({ free: config.adsByPlan?.free === true, pro: config.adsByPlan?.pro === true, enterprise: config.adsByPlan?.enterprise === true });
      setPlacements(Array.isArray(config.adPlacements) ? config.adPlacements : []);
      setProviders((Array.isArray(config.aiProviders) ? config.aiProviders : []).slice().sort((a, b) => a.priority - b.priority));
      setCosts({ ...config.featureCreditCosts });
    } catch (err: any) {
      onShowToast(`⚠️ ${err?.message || 'Failed to load system configuration.'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConfig(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const saveAdsConfig = async () => {
    setSavingAds(true);
    try {
      const res = await fetch('/api/admin/system/ads', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ adsEnabled, adsByPlan, adPlacements: placements }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data?.message || `Save failed (HTTP ${res.status}).`);
      onShowToast('✅ Ads configuration saved.');
    } catch (err: any) {
      onShowToast(`⚠️ ${err?.message || 'Failed to save ads configuration.'}`);
    } finally {
      setSavingAds(false);
    }
  };

  const saveAiConfig = async () => {
    setSavingAi(true);
    try {
      const res = await fetch('/api/admin/system/ai', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ aiProviders: providers, featureCreditCosts: costs }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data?.message || `Save failed (HTTP ${res.status}).`);
      onShowToast('✅ AI configuration saved — cascade updates within seconds.');
      setProviders((data.config?.aiProviders || providers).slice().sort((a: AiProviderConfig, b: AiProviderConfig) => a.priority - b.priority));
    } catch (err: any) {
      onShowToast(`⚠️ ${err?.message || 'Failed to save AI configuration.'}`);
    } finally {
      setSavingAi(false);
    }
  };

  const updatePlacement = (id: string, patch: Partial<AdPlacement>) => {
    setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const addPlacement = () => {
    setPlacements((prev) => [...prev, { id: `ad_${Date.now()}`, name: 'New Ad Slot', code: '', frequency: 1, enabled: true }]);
  };

  const removePlacement = (id: string) => {
    setPlacements((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="flex items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Ads &amp; AI Control</h2>
            <p className="text-xs text-slate-400">Global ad delivery, plan eligibility, ad slots, AI provider cascade &amp; feature credit pricing</p>
          </div>
        </div>
        <button onClick={loadConfig} className="p-2.5 rounded-xl bg-slate-800/80 text-slate-300 border border-slate-700 hover:bg-slate-700/80 transition-colors" title="Reload">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="p-10 rounded-2xl border border-slate-800 bg-slate-900/60 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading configuration…</div>
      ) : (
        <>
          {/* ADS MANAGEMENT SECTION */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-slate-100">Ads Management</h3>
              </div>
              <button onClick={saveAdsConfig} disabled={savingAds} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 disabled:opacity-50">
                {savingAds ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Ads
              </button>
            </div>
            <div className="px-5 py-4 space-y-5">
              {/* Global toggle */}
              <button onClick={() => setAdsEnabled(!adsEnabled)} className="flex items-center justify-between w-full p-4 rounded-xl bg-slate-800/60 border border-slate-700 hover:border-slate-600 transition-colors text-left">
                <div>
                  <div className="font-medium text-slate-200">Global Ads</div>
                  <div className="text-xs text-slate-500">Master switch — when OFF, no ads are served to any plan</div>
                </div>
                <span className="text-3xl leading-none">{adsEnabled ? '🟢' : '🔴'}</span>
              </button>

              {/* Plan eligibility */}
              <div>
                <div className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Show Ads by Plan</div>
                <div className="grid grid-cols-3 gap-3">
                  {(['free', 'pro', 'enterprise'] as const).map((plan) => (
                    <button
                      key={plan}
                      onClick={() => setAdsByPlan({ ...adsByPlan, [plan]: !adsByPlan[plan] })}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium capitalize transition-colors ${adsByPlan[plan] ? 'bg-amber-500/10 text-amber-300 border-amber-500/40' : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:border-slate-600'}`}
                    >
                      {adsByPlan[plan] ? '☑' : '☐'} {plan}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ad placements */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Ad Placements ({placements.length})</div>
                  <button onClick={addPlacement} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20 text-xs">
                    <Plus className="w-3.5 h-3.5" /> Add Placement
                  </button>
                </div>
                {placements.length === 0 && (
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-dashed border-slate-700 text-center text-xs text-slate-500">
                    No ad slots yet — add one to inject banner/popup/inline scripts.
                  </div>
                )}
                <div className="space-y-3">
                  {placements.map((placement) => (
                    <div key={placement.id} className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          value={placement.name}
                          onChange={(e) => updatePlacement(placement.id, { name: e.target.value })}
                          placeholder="Slot name (e.g. Dashboard Banner)"
                          className="flex-1 min-w-[180px] py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                        />
                        <label className="flex items-center gap-1.5 text-xs text-slate-400">
                          Freq
                          <input
                            type="number"
                            min={1}
                            value={placement.frequency}
                            onChange={(e) => updatePlacement(placement.id, { frequency: Math.max(1, Number(e.target.value) || 1) })}
                            className="w-16 py-1.5 px-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
                          />
                        </label>
                        <button onClick={() => updatePlacement(placement.id, { enabled: !placement.enabled })} className="flex items-center gap-1 text-xs text-slate-300">
                          {placement.enabled ? <ToggleRight className="w-6 h-6 text-emerald-400" /> : <ToggleLeft className="w-6 h-6 text-slate-500" />}
                          {placement.enabled ? 'ON' : 'OFF'}
                        </button>
                        <button onClick={() => removePlacement(placement.id)} className="p-2 rounded-lg bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20" title="Remove placement">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <textarea
                        value={placement.code}
                        onChange={(e) => updatePlacement(placement.id, { code: e.target.value })}
                        rows={3}
                        placeholder="Paste ad script / HTML snippet here…"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 resize-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* AI & CREDITS MANAGEMENT SECTION */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-slate-100">AI Providers &amp; Credit Costs</h3>
              </div>
              <button onClick={saveAiConfig} disabled={savingAi} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50">
                {savingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save AI
              </button>
            </div>
            <div className="px-5 py-4 space-y-5">
              {/* Providers */}
              <div>
                <div className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">AI Provider Cascade (lower priority number = tried first)</div>
                <div className="space-y-2">
                  {providers.map((provider) => (
                    <div key={provider.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700">
                      <button
                        onClick={() => setProviders((prev) => prev.map((p) => (p.id === provider.id ? { ...p, enabled: !p.enabled } : p)))}
                        className="flex items-center gap-1 text-xs font-medium w-24"
                      >
                        {provider.enabled ? <ToggleRight className="w-7 h-7 text-emerald-400" /> : <ToggleLeft className="w-7 h-7 text-slate-500" />}
                        <span className={provider.enabled ? 'text-emerald-300' : 'text-slate-500'}>{provider.enabled ? 'ON' : 'OFF'}</span>
                      </button>
                      <div className="flex-1 min-w-[140px]">
                        <div className="text-sm font-medium text-slate-200">{provider.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{provider.id}</div>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-slate-400">
                        Priority
                        <input
                          type="number"
                          value={provider.priority}
                          onChange={(e) => setProviders((prev) => prev.map((p) => (p.id === provider.id ? { ...p, priority: Number(e.target.value) || 0 } : p)))}
                          className="w-20 py-1.5 px-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                        />
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Disabled providers are removed from the failover cascade (Telegram bots + Web AI) within seconds of saving. If every provider is disabled, AI features pause safely.</p>
              </div>

              {/* Credit costs */}
              <div>
                <div className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Feature Credit Costs</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CREDIT_FIELDS.map((field) => (
                    <label key={field.key} className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 block">
                      <div className="text-xs font-medium text-slate-300">{field.label}</div>
                      <div className="text-[10px] text-slate-500 mb-2">{field.hint}</div>
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-amber-400" />
                        <input
                          type="number"
                          min={0}
                          value={costs[field.key]}
                          onChange={(e) => setCosts({ ...costs, [field.key]: Math.max(0, Number(e.target.value) || 0) })}
                          className="w-24 py-1.5 px-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                        />
                        <span className="text-[10px] text-slate-500">0 = free for everyone</span>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Credits are deducted from the user's balance per use. Administrators are always exempt, and legacy accounts without a credit balance are never blocked.</p>
              </div>
            </div>
          </div>

        </>
      )}
    </div>
  );
};
