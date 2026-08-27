import React, { useState } from 'react';
import { BotConfig } from '../types';
import { Brain, Trash2, Clock, RefreshCw, Cpu, Database, Sparkles, Check } from 'lucide-react';

interface MemoryInspectorProps {
  config: BotConfig;
}

export const MemoryInspector: React.FC<MemoryInspectorProps> = ({ config }) => {
  const [activeTab, setActiveTab] = useState<'conversations' | 'vectors' | 'diagnostics'>('conversations');
  const [cleared, setCleared] = useState(false);

  const mockConversations = [
    {
      id: 'session_8921',
      user: 'Syful Islam (@syfuldev)',
      platform: 'Telegram',
      turns: 8,
      lastMessage: 'Generate zero-downtime multi-channel failover architecture code in Python.',
      updated: '1 min ago',
      tokens: 1420,
    },
    {
      id: 'session_4412',
      user: 'DevOps Lead',
      platform: 'Discord',
      turns: 4,
      lastMessage: 'What is the current LPU token generation speed on Groq vs Cerebras?',
      updated: '4 mins ago',
      tokens: 680,
    },
    {
      id: 'session_1092',
      user: 'Automation Bot',
      platform: 'Slack',
      turns: 12,
      lastMessage: 'Trigger hourly health telemetry check and sync Firestore.',
      updated: '12 mins ago',
      tokens: 2190,
    },
  ];

  const handleClearMemory = () => {
    setCleared(true);
    setTimeout(() => setCleared(false), 2500);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-sm">Conversation Memory Inspector</h3>
            <p className="text-xs text-slate-400">Sliding Window • Max {config.maxMemoryTurns} turns • {config.memoryTtlMinutes}m TTL</p>
          </div>
        </div>
        <button
          onClick={handleClearMemory}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-rose-300 bg-slate-800/80 hover:bg-rose-500/10 border border-slate-700 hover:border-rose-500/30 rounded-xl transition cursor-pointer"
        >
          {cleared ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Trash2 className="w-3.5 h-3.5" />}
          <span>{cleared ? 'Purged!' : 'Purge Cache'}</span>
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('conversations')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeTab === 'conversations'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          Active Sessions ({mockConversations.length})
        </button>
        <button
          onClick={() => setActiveTab('vectors')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeTab === 'vectors'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          Vector Store Embeddings
        </button>
        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeTab === 'diagnostics'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          TTL & Eviction
        </button>
      </div>

      {activeTab === 'conversations' && (
        <div className="space-y-3">
          {mockConversations.map((conv) => (
            <div
              key={conv.id}
              className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-indigo-500/30 transition space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200">{conv.user}</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px]">
                    {conv.platform}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                  <Clock className="w-3 h-3" />
                  <span>{conv.updated}</span>
                </div>
              </div>
              <p className="text-xs text-slate-300 line-clamp-1 italic font-mono">
                "{conv.lastMessage}"
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                <span>Turns: {conv.turns} / {config.maxMemoryTurns}</span>
                <span>Context tokens: ~{conv.tokens}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'vectors' && (
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-3">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold">
            <Sparkles className="w-4 h-4" />
            <span>Semantic Embedding Store (Voyage / Cohere Embed)</span>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            Vector embeddings are indexed in real time for long-term document search and episodic retrieval across chat sessions.
          </p>
          <div className="grid grid-cols-2 gap-3 pt-2 text-[11px]">
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Indexed Vectors:</span>
              <span className="float-right font-mono font-bold text-slate-200">1,840</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Dimensions:</span>
              <span className="float-right font-mono font-bold text-slate-200">1,536d</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'diagnostics' && (
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 text-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <Cpu className="w-4 h-4" />
            <span>Memory Garbage Collector & TTL Engine</span>
          </div>
          <div className="space-y-2 text-slate-300">
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">Inactivity Timeout:</span>
              <span className="font-mono text-cyan-300">{config.memoryTtlMinutes} minutes</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">Sliding Max Turns:</span>
              <span className="font-mono text-cyan-300">{config.maxMemoryTurns} turns</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Eviction Strategy:</span>
              <span className="font-mono text-cyan-300">LRU + Priority Sliding</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
