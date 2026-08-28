import React, { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw, X, Zap, KeyRound } from 'lucide-react';
import { AuthService } from '../services/authService';

interface AnalyzerStats {
  activeKeyless: number;
  activeApiKeyConnections: number;
  totalActiveModels: number;
  checkedAt: string;
  keylessHealthy: boolean;
  verifiedApiProviders: string[];
  activeKeylessList: string[];
  activeApiKeyList: string[];
}

interface AiAnalyzerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiAnalyzerModal: React.FC<AiAnalyzerModalProps> = ({ isOpen, onClose }) => {
  const [stats, setStats] = useState<AnalyzerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = AuthService.getCurrentSession();
      const response = await fetch('/api/ai/analyzer-stats', { headers: { Authorization: `Bearer ${session?.token || ''}` }, signal: AbortSignal.timeout(15000) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || data.message || 'Live analyzer unavailable.');
      setStats(data.stats);
    } catch (scanError: any) {
      setError(scanError?.message || 'Live analyzer unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) void scan();
  }, [isOpen, scan]);

  if (!isOpen) return null;
  const cards = [
    { label: 'Total Active AI Models', value: stats?.totalActiveModels ?? '-', icon: <Activity className="w-5 h-5" />, color: 'emerald' },
    { label: 'Active Keyless Connections', value: stats?.activeKeyless ?? '-', icon: <Zap className="w-5 h-5" />, color: 'amber' },
    { label: 'Active API Key Connections', value: stats?.activeApiKeyConnections ?? '-', icon: <KeyRound className="w-5 h-5" />, color: 'cyan' },
  ];

  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl p-6 space-y-6">
      <header className="flex items-center justify-between border-b border-slate-800 pb-4"><div className="flex items-center gap-3"><Activity className="w-6 h-6 text-emerald-400" /><div><h2 className="text-lg font-bold text-white">Real-Time AI System Analyzer</h2><p className="text-xs text-slate-400">Live verified runtime connections</p></div></div><button onClick={onClose} className="p-2 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button></header>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{cards.map((card) => <div key={card.label} className={`p-4 rounded-xl border border-${card.color}-500/30 bg-${card.color}-500/10`}><div className={`text-${card.color}-400 mb-3`}>{card.icon}</div><div className="text-3xl font-bold text-white">{card.value}</div><div className="text-xs text-slate-400 mt-1">{card.label}</div></div>)}</div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {stats && <p className="text-xs text-slate-500">Last verified: {new Date(stats.checkedAt).toLocaleString()} · {stats.keylessHealthy ? 'Keyless provider reachable' : 'Keyless provider unavailable'}</p>}
      {stats && <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2"><h3 className="text-sm font-semibold text-white">Active AI Infrastructure</h3>{[...stats.activeKeylessList, ...stats.activeApiKeyList].map((name) => <div key={name} className="flex items-center gap-2 text-xs text-slate-300"><span className="text-emerald-400">●</span><span>{name}</span><span className="ml-auto text-emerald-400">Operational</span></div>)}{stats.activeKeylessList.length + stats.activeApiKeyList.length === 0 && <p className="text-xs text-slate-500">No live connections verified.</p>}</div>}
      {stats && <p className="text-sm font-semibold text-emerald-400">{stats.activeKeylessList.length + stats.activeApiKeyList.length >= 15 ? 'Verified 15+ Keyless & API Providers operational' : `Verified ${stats.activeKeylessList.length + stats.activeApiKeyList.length} Keyless & API Providers operational`}</p>}
      <div className="flex justify-end"><button onClick={() => void scan()} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />{loading ? 'Scanning...' : 'Re-Scan System'}</button></div>
    </div>
  </div>;
};
