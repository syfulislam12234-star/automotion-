import React, { useState, useEffect } from 'react';
import { Activity, Zap, Cpu, TrendingUp, RefreshCw, Sparkles, Server, MessageSquare } from 'lucide-react';
import { AuthService } from '../services/authService';

interface PerformanceDashboardProps {
  onShowToast: (msg: string) => void;
  onOpenAiChat: () => void;
}

interface AnalyzerStats {
  activeApiKeyConnections: number;
  totalActiveModels: number;
  activeApiKeyList: string[];
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ onShowToast, onOpenAiChat }) => {
  const [data, setData] = useState({ totalRequests: 0, successfulFailovers: 0, averageLatencyMs: 0, tokenCount: 0, providerHealth: [] as Array<{ provider: string; status: string; latency: string; uptime: string }> });
  const [analyzer, setAnalyzer] = useState<AnalyzerStats | null>(null);
  const [scanning, setScanning] = useState(false);

  const [benchmarking, setBenchmarking] = useState(false);

  const scanSystem = async () => {
    setScanning(true);
    try {
      const session = AuthService.getCurrentSession();
      const response = await fetch('/api/ai/analyzer-stats', { headers: { Authorization: `Bearer ${session?.token || ''}` }, signal: AbortSignal.timeout(15000) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || payload.message || 'Live analyzer unavailable.');
      setAnalyzer(payload.stats);
    } catch (error: any) {
      onShowToast(`Analyzer scan failed: ${error?.message || 'Live analyzer unavailable.'}`);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    const loadTelemetry = async () => {
      try {
        const response = await fetch('/api/telemetry/performance', { signal: AbortSignal.timeout(10000) });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload.success && payload.data) setData(payload.data);
      } catch (error) {
        console.warn('[Telemetry] Live metrics unavailable:', error);
      }
    };
    void loadTelemetry();
    void scanSystem();
    const timer = window.setInterval(() => { void loadTelemetry(); void scanSystem(); }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const handleRunBenchmark = async () => {
    setBenchmarking(true);
    try {
      const res = await fetch('/api/telemetry/benchmark', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || data?.error || `Benchmark failed (HTTP ${res.status}).`);
      }
      onShowToast('⚡ Multi-model live benchmark completed successfully!');
    } catch (e: any) {
      onShowToast(`⚠️ Benchmark failed: ${e?.message || 'Unable to reach the telemetry service.'}`);
    } finally {
      setBenchmarking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Live AI Telemetry & Benchmark Center</h2>
              <p className="text-xs text-slate-400">Sub-second token throughput, failover latency, & provider uptime metrics</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRunBenchmark}
              disabled={benchmarking}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>{benchmarking ? 'Benchmarking...' : 'Run Live Benchmark'}</span>
            </button>
            <button
              onClick={onOpenAiChat}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Test in AI Copilot</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400">Total Interactions</span>
          <div className="text-2xl font-extrabold text-white font-mono">{data.totalRequests.toLocaleString()}</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400">Average Edge Latency</span>
          <div className="text-2xl font-extrabold text-cyan-400 font-mono">{data.averageLatencyMs}ms</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400">Auto Failovers (Zero Drops)</span>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">{data.successfulFailovers}</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400">Tokens Processed</span>
          <div className="text-2xl font-extrabold text-indigo-400 font-mono">{data.tokenCount.toLocaleString()}</div>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-slate-900/90 border border-emerald-500/20 space-y-4">
        <div className="flex items-center justify-between"><h3 className="font-semibold text-slate-200 text-sm">Real-Time AI System Analyzer</h3><button onClick={() => void scanSystem()} disabled={scanning} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs disabled:opacity-50"><RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />{scanning ? 'Scanning...' : 'Re-Scan System'}</button></div>
        {analyzer ? <><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[['Total Active AI Models', analyzer.totalActiveModels], ['API Keys Active', analyzer.activeApiKeyConnections]].map(([label, value]) => <div key={String(label)} className="p-3 rounded-xl bg-slate-950 border border-slate-800"><div className="text-2xl font-bold text-white">{value}</div><div className="text-xs text-slate-400">{label}</div></div>)}</div><div className="max-h-52 overflow-y-auto rounded-xl bg-slate-950 border border-slate-800 p-3 space-y-1.5"><h4 className="text-xs font-semibold text-white mb-2">Active AI Infrastructure</h4>{analyzer.activeApiKeyList.map((name) => <div key={name} className="flex items-center gap-2 text-xs text-slate-300"><span className="text-emerald-400">●</span><span>{name}</span><span className="ml-auto text-emerald-400">Operational</span></div>)}{analyzer.totalActiveModels === 0 && <p className="text-xs text-slate-500">Please add at least one API key in the API Portal to enable AI features.</p>}</div><p className="text-sm font-semibold text-emerald-400">Verified {analyzer.totalActiveModels} API Key Providers operational</p></> : <p className="text-xs text-slate-500">Scanning live AI infrastructure...</p>}
      </div>

      {/* Provider Health Table */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        <h3 className="font-semibold text-slate-200 text-sm">Real-Time Provider Infrastructure Health</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-slate-500 border-b border-slate-800">
              <tr>
                <th className="pb-3 font-semibold">Provider / Cluster</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Latency</th>
                <th className="pb-3 font-semibold">Uptime SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data.providerHealth.map((p, i) => (
                <tr key={i} className="hover:bg-slate-950/40 transition">
                  <td className="py-3 font-medium text-slate-200">{p.provider}</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                      {p.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 font-mono text-cyan-300">{p.latency}</td>
                  <td className="py-3 font-mono text-slate-300">{p.uptime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
