import React from 'react';
import { BotConfig } from '../types';
import { Brain, Activity, Server, BellRing, Bot, MessageSquare } from 'lucide-react';

interface MemoryInspectorProps {
  config: BotConfig;
}

export const MemoryInspector: React.FC<MemoryInspectorProps> = ({ config }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-sm">
              Universal Multi-Platform AI & Dual Alert Architecture
            </h3>
            <p className="text-xs text-slate-400">
              Telegram • Discord • Slack connected to 6-Tier AI Engine with Discord Webhook alerts
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40 flex items-center gap-1">
          <Activity className="w-3 h-3" />
          Zero Session Loss
        </span>
      </div>

      {/* Connected Platforms Strip */}
      <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Bot className="w-4 h-4 text-cyan-400" />
          <span>Unified Chat Ingress:</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-cyan-950/80 text-cyan-300 border border-cyan-800/50 flex items-center gap-1">
            ✈️ Telegram Bot
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 flex items-center gap-1">
            👾 Discord Bot
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 flex items-center gap-1">
            💬 Slack App
          </span>
        </div>
      </div>

      {/* 6-Step Visual Flow Diagram */}
      <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
        <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
          <span>Shared 6-Tier Failover Cascade</span>
          <span className="text-[10px] text-slate-500 font-mono">Dynamic Fallback Pipeline</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          {/* Step 1 */}
          <div className="p-2.5 bg-slate-900 rounded-lg border border-cyan-500/30">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-cyan-300">1. Groq (LPU)</span>
              <span className="text-[9px] bg-cyan-950 px-1 py-0.2 rounded text-cyan-400 font-mono">
                Primary
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Multi-key pool. If 429 occurs, cools down key and cascades to Gemini.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-2.5 bg-slate-900 rounded-lg border border-blue-500/30">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-blue-300">2. Google Gemini</span>
              <span className="text-[9px] bg-blue-950 px-1 py-0.2 rounded text-blue-400 font-mono">
                Fallback 1
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Fast, intelligent reasoning using <code className="text-blue-200">{config.geminiModel}</code>.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-2.5 bg-slate-900 rounded-lg border border-purple-500/30">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-purple-300">3. Cerebras</span>
              <span className="text-[9px] bg-purple-950 px-1 py-0.2 rounded text-purple-400 font-mono">
                Fallback 2
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Ultra-fast backup using <code className="text-purple-200">{config.cerebrasModel}</code>.
            </p>
          </div>

          {/* Step 4 */}
          <div className="p-2.5 bg-slate-900 rounded-lg border border-emerald-500/30">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-emerald-300">4. OpenRouter Free</span>
              <span className="text-[9px] bg-emerald-950 px-1 py-0.2 rounded text-emerald-400 font-mono">
                Fallback 3
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Cascades through free models: <strong>DeepSeek R1 free</strong> & <strong>Llama 3.3 free</strong>.
            </p>
          </div>

          {/* Step 5 */}
          <div className="p-2.5 bg-slate-900 rounded-lg border border-orange-500/30">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-orange-300">5. Together AI</span>
              <span className="text-[9px] bg-orange-950 px-1 py-0.2 rounded text-orange-400 font-mono">
                Fallback 4
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Turbo inference using <code className="text-orange-200">Llama-3.3-70B-Turbo</code>.
            </p>
          </div>

          {/* Step 6 */}
          <div className="p-2.5 bg-slate-900 rounded-lg border border-rose-500/30">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-rose-300">6. Mistral AI</span>
              <span className="text-[9px] bg-rose-950 px-1 py-0.2 rounded text-rose-400 font-mono">
                Fallback 5
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Sovereign AI backup using <code className="text-rose-200">{config.mistralModel}</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Dual Admin Alert Channel Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 mb-1">
              <Brain className="w-4 h-4 text-cyan-400" />
              <span>Multi-Platform Memory Window</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Maintains isolated conversational memory per user and platform, preventing cross-chat collision while sharing the same AI inference engine.
            </p>
          </div>
          <div className="mt-2 text-[10px] font-mono text-cyan-400">
            <span>Window:</span>{' '}
            <span className="bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/50">
              {config.maxMemoryTurns} turns sliding buffer
            </span>
          </div>
        </div>

        <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 mb-1">
              <BellRing className="w-4 h-4 text-rose-400" />
              <span>Dual Admin Alert Broadcast</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Dispatches non-blocking alerts to both <strong>Telegram ID</strong> and <strong>Discord Webhook</strong> upon 429 rate limits, failover switches, and crashes.
            </p>
          </div>
          <div className="mt-2 text-[10px] font-mono text-rose-400 flex items-center justify-between">
            <span>Channels:</span>{' '}
            <span className="bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-800/50">
              Telegram + Discord Webhook
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
