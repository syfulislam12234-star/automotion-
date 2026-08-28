import React, { useEffect, useState } from 'react';
import { AiModelCatalogItem, BotConfig } from '../types';
import { AiService, FreeModelStatus } from '../services/aiService';
import { Cpu, Zap, ShieldCheck, Key, RefreshCw, CheckCircle2, AlertCircle, Sparkles, ExternalLink } from 'lucide-react';

interface AiCascadeDashboardProps {
  config: BotConfig;
  onChange: (updates: Partial<BotConfig>) => void;
  onShowToast: (msg: string) => void;
}

export const AiCascadeDashboard: React.FC<AiCascadeDashboardProps> = ({
  config,
  onChange,
  onShowToast,
}) => {
  const [freeModelCount, setFreeModelCount] = useState(0);
  const [freeModels, setFreeModels] = useState<AiModelCatalogItem[]>([]);
  const [modelStatuses, setModelStatuses] = useState<Record<string, FreeModelStatus['status']>>({});

  useEffect(() => {
    let mounted = true;
    void AiService.getFreeModelCatalog().then((catalog) => {
      if (mounted) {
        setFreeModelCount(catalog.count);
        setFreeModels(catalog.models);
      }
    });
    void AiService.getFreeModelStatuses().then((statuses) => {
      if (mounted) setModelStatuses(Object.fromEntries(statuses.map((status) => [status.modelId, status.status])));
    });
    return () => {
      mounted = false;
    };
  }, []);

  const tiers = [
    { rank: 1, provider: 'Google AI Studio', model: config.geminiModel || 'gemini-3.7-flash', enabled: config.enableGeminiFallback, key: config.geminiApiKey, portalId: 'gemini', speed: '200 tok/s' },
    { rank: 2, provider: 'Groq Cloud LPU', model: config.groqModel || 'llama-3.3-70b-versatile', enabled: true, key: config.groqApiKey, portalId: 'groq', speed: '380 tok/s' },
    { rank: 3, provider: 'Cerebras CS-3', model: config.cerebrasModel || 'llama3.3-70b', enabled: config.enableCerebrasFallback, key: config.cerebrasApiKey, portalId: 'cerebras', speed: '1800 tok/s' },
    { rank: 4, provider: 'OpenRouter Aggregator', model: config.openrouterModel || 'deepseek/deepseek-r1:free', enabled: config.enableOpenRouterFallback, key: config.openrouterApiKey, portalId: 'openrouter', speed: '90 tok/s' },
    { rank: 5, provider: 'Mistral AI', model: config.mistralModel || 'mistral-small-latest', enabled: config.enableMistralFallback, key: config.mistralApiKey, portalId: 'mistral', speed: '160 tok/s' },
    { rank: 6, provider: 'SambaNova Systems', model: config.sambanovaModel || 'Meta-Llama-3.3-70B-Instruct', enabled: config.enableSambaNovaFallback, key: config.sambanovaApiKey, portalId: 'sambanova', speed: '450 tok/s' },
    { rank: 7, provider: 'Cohere Enterprise', model: config.cohereModel || 'command-r-plus-08-2024', enabled: config.enableCohereFallback, key: config.cohereApiKey, portalId: 'cohere', speed: '100 tok/s' },
    { rank: 8, provider: 'Together AI Turbo', model: config.togetherModel || 'meta-llama/Llama-3.3-70B-Instruct-Turbo', enabled: config.enableTogetherFallback, key: config.togetherApiKey, portalId: 'together', speed: '240 tok/s' },
    { rank: 9, provider: 'NVIDIA NIM Microservices', model: config.nvidiaNimModel || 'meta/llama-3.3-70b-instruct', enabled: config.enableNvidiaNimFallback, key: config.nvidiaNimApiKey, portalId: 'nvidianim', speed: '260 tok/s' },
  ];

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950/30 to-slate-900 border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">{freeModelCount >= 150 ? `${freeModelCount}-AI` : 'Free AI'} Auto-Failover Cascade Hierarchy</h2>
              <p className="text-xs text-slate-400">{freeModelCount || 'Dynamic'} free models available with sequential failover routing</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiers.map((tier) => (
          <div
            key={tier.rank}
            className={`p-4 rounded-2xl border transition space-y-3 ${
              tier.key
                ? 'bg-slate-900/90 border-slate-800 hover:border-cyan-500/40 shadow-lg'
                : 'bg-slate-950/60 border-slate-800/80 opacity-90'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 font-mono text-xs font-bold flex items-center justify-center">
                  #{tier.rank}
                </span>
                <span className="text-xs font-bold text-slate-200">{tier.provider}</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                tier.key ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
              }`}>
                {tier.key ? 'ACTIVE' : 'STANDBY'}
              </span>
            </div>

            <div className="text-xs font-mono text-cyan-300 truncate bg-slate-950 p-2 rounded-lg border border-slate-900">
              {tier.model}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>Speed: <strong className="text-slate-200">{tier.speed}</strong></span>
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-100">Available free models ({freeModels.length || 150})</h3>
          <span className="text-[10px] uppercase tracking-widest text-emerald-400">Automatic fallback order</span>
        </div>
        <div className="grid max-h-[34rem] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
          {freeModels.map((model, index) => (
            <div key={`${model.provider}-${model.modelId}-${index}`} className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-900/70 px-3 py-2">
              <span className="w-6 shrink-0 text-[10px] font-mono text-cyan-400">{index + 1}</span>
              <span className="min-w-0 truncate text-[11px] text-slate-300" title={model.modelId}>{model.name}</span>
              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${modelStatuses[model.modelId] === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                {modelStatuses[model.modelId] === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
