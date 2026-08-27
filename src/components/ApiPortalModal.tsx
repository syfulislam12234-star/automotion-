import React, { useState } from 'react';
import { BotConfig } from '../types';
import { X, Key, ExternalLink, ShieldCheck, Check, Sparkles, Zap, Bot, Lock } from 'lucide-react';

interface ApiPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BotConfig;
  onUpdateConfig: (updates: Partial<BotConfig>) => void;
  onShowToast: (msg: string) => void;
  initialPlatformId?: string;
}

export const ApiPortalModal: React.FC<ApiPortalModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onShowToast,
  initialPlatformId = 'groq',
}) => {
  const [selectedProvider, setSelectedProvider] = useState<string>(initialPlatformId);
  const [keyInput, setKeyInput] = useState('');

  if (!isOpen) return null;

  const providers = [
    { id: 'groq', name: 'Groq Cloud LPU', link: 'https://console.groq.com/keys', configKey: 'groqApiKey', badge: 'Ultra-Fast LPU' },
    { id: 'gemini', name: 'Google AI Studio', link: 'https://aistudio.google.com/app/apikey', configKey: 'geminiApiKey', badge: '2M Context' },
    { id: 'cerebras', name: 'Cerebras Wafer-Scale', link: 'https://cloud.cerebras.ai', configKey: 'cerebrasApiKey', badge: '1800 Tok/s' },
    { id: 'openrouter', name: 'OpenRouter Aggregator', link: 'https://openrouter.ai/keys', configKey: 'openrouterApiKey', badge: '100+ Models' },
    { id: 'telegram', name: 'Telegram Bot Father', link: 'https://t.me/BotFather', configKey: 'telegramBotToken', badge: 'Messaging' },
    { id: 'mistral', name: 'Mistral AI Console', link: 'https://console.mistral.ai', configKey: 'mistralApiKey', badge: 'European AI' },
  ];

  const currentProvider = providers.find((p) => p.id === selectedProvider) || providers[0];

  const handleSave = () => {
    if (currentProvider.configKey) {
      onUpdateConfig({ [currentProvider.configKey]: keyInput } as Partial<BotConfig>);
      onShowToast(`✅ ${currentProvider.name} credentials updated!`);
      setKeyInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">1-Click Direct API Setup Portal</h2>
              <p className="text-xs text-slate-400">Generate & configure zero-cost developer API keys</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 rounded-xl transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSelectedProvider(p.id);
                setKeyInput((config as any)[p.configKey] || '');
              }}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                selectedProvider === p.id
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="text-xs font-semibold">{p.name}</div>
              <div className="text-[10px] text-slate-500 mt-1">{p.badge}</div>
            </button>
          ))}
        </div>

        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">{currentProvider.name} API Key</span>
            <a
              href={currentProvider.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-cyan-400 hover:underline"
            >
              <span>Get Free Key at Official Console</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={`Enter ${currentProvider.name} key...`}
            className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
          />
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition cursor-pointer"
            >
              Save Credentials
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
