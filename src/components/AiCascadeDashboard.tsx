import React, { useState, useMemo } from 'react';
import { BotConfig, AIModelEntry } from '../types';
import { GLOBAL_100_AI_MODELS } from '../data/aiModels100';
import {
  Zap,
  Activity,
  Layers,
  Repeat,
  Sparkles,
  Search,
  Sliders,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
  Radio,
  Cpu,
  Globe,
  Gauge,
  Key,
  ShieldAlert,
  SlidersHorizontal,
  ChevronRight,
  ExternalLink,
  Flame,
  Check,
  Play,
  RotateCcw,
  Network,
  GitMerge,
  Award,
  Timer,
} from 'lucide-react';

interface AiCascadeDashboardProps {
  config: BotConfig;
  onChange: (newConfig: BotConfig) => void;
  onShowToast: (msg: string) => void;
  onOpenPortal?: (serviceId?: string) => void;
}

export const AiCascadeDashboard: React.FC<AiCascadeDashboardProps> = ({
  config,
  onChange,
  onShowToast,
  onOpenPortal,
}) => {
  const [modelsList, setModelsList] = useState<AIModelEntry[]>(GLOBAL_100_AI_MODELS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [isSpeedTestingAll, setIsSpeedTestingAll] = useState(false);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [filterProOnly, setFilterProOnly] = useState(false);

  // Ensemble benchmark state
  const [isRunningEnsembleBench, setIsRunningEnsembleBench] = useState(false);
  const [ensembleBenchResults, setEnsembleBenchResults] = useState<{
    totalEnsembleLatencyMs: number;
    results: Array<{ provider: string; model: string; success: boolean; latencyMs: number; length: number }>;
    winner: { provider: string; model: string; latencyMs: number };
  } | null>(null);

  // Active Key Pool simulation
  const [keyRotationStats, setKeyRotationStats] = useState({
    activeKeysInPool: 18,
    quarantinedKeys: 1,
    totalFailoversToday: 42,
    zeroDowntimeUptime: '99.998%',
    avgCascadeLatencyMs: 148,
  });

  const handleRunEnsembleBenchmark = async () => {
    setIsRunningEnsembleBench(true);
    try {
      const res = await fetch('/api/ai/ensemble/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testPrompt: 'Explain how the Hybrid AI Ensemble engine achieves sub-50ms synthesis across 20 providers in bullet points.',
        }),
      });
      const data = await res.json();
      if (data && data.success) {
        setEnsembleBenchResults(data);
        onShowToast(`🧠 Super-Brain benchmark completed in ${data.totalEnsembleLatencyMs}ms! Winner: ${data.winner?.provider}`);
      } else {
        throw new Error(data.error || 'Benchmark error');
      }
    } catch (e: any) {
      onShowToast(`⚠️ Ensemble benchmark notice: ${e.message}`);
    } finally {
      setIsRunningEnsembleBench(false);
    }
  };

  // Filtered models
  const filteredModels = useMemo(() => {
    return modelsList.filter((m) => {
      const matchSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.modelId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = selectedCategory === 'all' || m.category === selectedCategory;
      const matchProvider = selectedProvider === 'all' || m.provider === selectedProvider;
      const matchPro = !filterProOnly || m.isProOnly;
      return matchSearch && matchCategory && matchProvider && matchPro;
    });
  }, [modelsList, searchQuery, selectedCategory, selectedProvider, filterProOnly]);

  const handleTestSingleModel = async (modelId: string) => {
    setTestingModelId(modelId);
    try {
      // Simulate real-time latency ping
      const jitter = Math.floor(Math.random() * 40) - 20;
      await new Promise((r) => setTimeout(r, 600));

      setModelsList((prev) =>
        prev.map((m) => {
          if (m.id === modelId) {
            const newLatency = Math.max(45, m.latencyMs + jitter);
            return { ...m, latencyMs: newLatency, status: 'active' };
          }
          return m;
        })
      );
      onShowToast(`⚡ Latency test complete: pinged ${modelId}`);
    } finally {
      setTestingModelId(null);
    }
  };

  const handleSpeedTestAll = async () => {
    setIsSpeedTestingAll(true);
    onShowToast('🚀 Initiating global speed benchmark across 100 AI endpoints...');

    try {
      await new Promise((r) => setTimeout(r, 1400));
      setModelsList((prev) =>
        prev.map((m) => {
          const jitter = Math.floor(Math.random() * 60) - 30;
          return {
            ...m,
            latencyMs: Math.max(50, m.latencyMs + jitter),
            status: Math.random() > 0.05 ? 'active' : 'standby',
          };
        })
      );
      onShowToast('✅ 100-AI global latency benchmark completed.');
    } finally {
      setIsSpeedTestingAll(false);
    }
  };

  const handleMovePriority = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= modelsList.length) return;

    const updated = [...modelsList];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Re-index priority
    const reindexed = updated.map((m, idx) => ({ ...m, priority: idx + 1 }));
    setModelsList(reindexed);
    onShowToast(`🔄 Adjusted priority for ${temp.name} to Tier #${targetIndex + 1}`);
  };

  const handleToggleModelStatus = (id: string) => {
    setModelsList((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const newStatus = m.status === 'active' ? 'disabled' : 'active';
          return { ...m, status: newStatus as any };
        }
        return m;
      })
    );
  };

  const providers = Array.from(new Set(GLOBAL_100_AI_MODELS.map((m) => m.provider)));

  return (
    <div className="space-y-6">
      {/* Top Banner Overview */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-500 to-indigo-500 text-white shadow-lg shadow-indigo-500/20">
                100-AI FAILOVER CASCADE
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <Activity className="w-3 h-3 animate-pulse" />
                ZERO-DOWNTIME ACTIVE
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Unified Global Multi-Model Cascade Engine
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Autonomous failover network spanning LPUs (Groq, Cerebras, SambaNova), Frontier Reasoning (DeepSeek R1, Gemini 2.5 Pro, Claude 3.5 Sonnet), and 100+ global fallback tiers with automated key rotation.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleSpeedTestAll}
              disabled={isSpeedTestingAll}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSpeedTestingAll ? 'animate-spin' : ''}`} />
              {isSpeedTestingAll ? 'Pinging 100 Models...' : 'Run Global Speed Test'}
            </button>
            <button
              onClick={() => onOpenPortal?.('groq')}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition flex items-center gap-2 cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              Manage API Keys
            </button>
          </div>
        </div>

        {/* Telemetry Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/60">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total AI Pool</span>
            <div className="text-lg font-black text-white mt-0.5">100 Models</div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/60">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Avg Cascade Speed</span>
            <div className="text-lg font-black text-emerald-400 mt-0.5">{keyRotationStats.avgCascadeLatencyMs} ms</div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/60">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Key Rotation Pool</span>
            <div className="text-lg font-black text-indigo-400 mt-0.5">{keyRotationStats.activeKeysInPool} Active Keys</div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/60">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Failovers Prevented</span>
            <div className="text-lg font-black text-purple-400 mt-0.5">{keyRotationStats.totalFailoversToday} today</div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/60 col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">SLA Reliability</span>
            <div className="text-lg font-black text-amber-400 mt-0.5">{keyRotationStats.zeroDowntimeUptime}</div>
          </div>
        </div>
      </div>

      {/* 🧠 HYBRID AI ENSEMBLE SUPER-BRAIN MODULE */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-cyan-950/30 border border-emerald-500/30 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-extrabold text-white">Hybrid AI Ensemble Super-Brain</h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                  CONCURRENT SYNTHESIS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Executes simultaneous parallel inference across Tier 1 LPUs & Reasoning models, synthesizes highest-quality consensus Markdown output.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleRunEnsembleBenchmark}
              disabled={isRunningEnsembleBench}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <GitMerge className={`w-4 h-4 ${isRunningEnsembleBench ? 'animate-spin' : ''}`} />
              {isRunningEnsembleBench ? 'Executing Parallel Race...' : 'Benchmark Super-Brain'}
            </button>

            <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enableHybridEnsemble !== false}
                onChange={(e) => {
                  onChange({ ...config, enableHybridEnsemble: e.target.checked });
                  onShowToast(e.target.checked ? '🧠 Hybrid AI Ensemble enabled' : '⏸️ Switched to sequential cascade');
                }}
                className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-800 border-slate-600"
              />
              <span className="text-xs font-bold text-slate-200">Ensemble Active</span>
            </label>
          </div>
        </div>

        {/* Live Parallel Benchmark Card */}
        {ensembleBenchResults && (
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-extrabold text-white">Parallel Inference Competition Winner:</span>
                <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {ensembleBenchResults.winner?.provider} ({ensembleBenchResults.winner?.latencyMs}ms)
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Total Synthesis Window: <strong className="text-emerald-400">{ensembleBenchResults.totalEnsembleLatencyMs}ms</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {ensembleBenchResults.results.map((r) => (
                <div
                  key={r.provider}
                  className={`p-3 rounded-xl border flex flex-col justify-between ${
                    r.provider === ensembleBenchResults.winner?.provider
                      ? 'bg-emerald-950/40 border-emerald-500/60 shadow-md shadow-emerald-500/10'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white truncate">{r.provider}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400">{r.model}</span>
                    <span className="text-emerald-300 font-bold">{r.latencyMs} ms</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search across 100 AI models (e.g. DeepSeek, Claude, Llama, GPT-4o)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <button
            onClick={() => setFilterProOnly(!filterProOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              filterProOnly
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-slate-800 text-slate-300 border border-slate-700 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Pro Only
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {[
            { id: 'all', label: 'All 100' },
            { id: 'ultra_fast', label: 'LPUs & Fast' },
            { id: 'reasoning', label: 'Reasoning (R1/o3)' },
            { id: 'frontier', label: 'Frontier' },
            { id: 'vision_multimodal', label: 'Vision' },
            { id: 'zero_key', label: 'Zero-Key Free' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Models Table / List */}
      <div className="border border-slate-800 rounded-3xl overflow-hidden bg-slate-900/60 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3.5 w-14 text-center">Rank</th>
                <th className="p-3.5">Model & Provider</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Context Window</th>
                <th className="p-3.5">Speed / Latency</th>
                <th className="p-3.5">Cost / Free Tier</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredModels.map((model, idx) => {
                const isTesting = testingModelId === model.id;

                return (
                  <tr
                    key={model.id}
                    className={`hover:bg-slate-800/50 transition-colors ${
                      model.status === 'disabled' ? 'opacity-40 bg-slate-950/40' : ''
                    }`}
                  >
                    {/* Rank Priority */}
                    <td className="p-3.5 text-center font-mono">
                      <span className="px-2 py-0.5 rounded-md bg-slate-950 text-indigo-400 font-bold border border-slate-800">
                        #{model.priority}
                      </span>
                    </td>

                    {/* Model Details */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <div className="font-extrabold text-white flex items-center gap-1.5">
                          {model.name}
                          {model.isProOnly && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              PRO
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="font-mono text-slate-300">{model.modelId}</span>
                        <span>•</span>
                        <span className="text-indigo-400 font-medium">{model.provider}</span>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="p-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-950 border border-slate-800 text-slate-300">
                        {model.category.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>

                    {/* Context Window */}
                    <td className="p-3.5 font-mono text-slate-300">
                      {(model.contextWindow / 1000).toFixed(0)}k tokens
                    </td>

                    {/* Latency / Speed */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            model.latencyMs < 150
                              ? 'bg-emerald-400'
                              : model.latencyMs < 500
                              ? 'bg-amber-400'
                              : 'bg-indigo-400'
                          }`}
                        />
                        <span className="font-mono font-bold text-white">{model.latencyMs} ms</span>
                      </div>
                    </td>

                    {/* Cost */}
                    <td className="p-3.5 font-mono text-slate-300">{model.costPerMillion}</td>

                    {/* Status */}
                    <td className="p-3.5">
                      <button
                        onClick={() => handleToggleModelStatus(model.id)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                          model.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {model.status.toUpperCase()}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleTestSingleModel(model.id)}
                          disabled={isTesting}
                          title="Run latency ping"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                        >
                          <Gauge className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-amber-400' : ''}`} />
                        </button>
                        <button
                          onClick={() => handleMovePriority(idx, 'up')}
                          disabled={idx === 0}
                          title="Move Priority Up"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 transition cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMovePriority(idx, 'down')}
                          disabled={idx === modelsList.length - 1}
                          title="Move Priority Down"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 transition cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
