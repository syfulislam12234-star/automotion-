import React, { useEffect, useState } from 'react';
import { BotConfig } from '../types';
import { X, Key, ExternalLink, ShieldCheck, Check, Sparkles, Zap, Bot, Lock } from 'lucide-react';
import { AI_PROVIDER_GATEWAYS_100 } from '../data/aiProviders100';
import { AuthService } from '../services/authService';
import { AiService } from '../services/aiService';

interface ApiPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BotConfig;
  onUpdateConfig: (updates: Partial<BotConfig>) => Promise<boolean> | boolean;
  onShowToast: (msg: string) => void;
  onRequireAuth: () => void;
  initialPlatformId?: string;
}

export const ApiPortalModal: React.FC<ApiPortalModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onShowToast,
  onRequireAuth,
  initialPlatformId = 'groq',
}) => {
  const [selectedProvider, setSelectedProvider] = useState<string>(initialPlatformId);
  const [keyInput, setKeyInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const providers = AI_PROVIDER_GATEWAYS_100;

  const currentProvider = providers.find((p) => p.id === selectedProvider) || providers[0];
  const legacyKeys: Record<string, keyof BotConfig> = {
    groq: 'groqApiKey', gemini: 'geminiApiKey', google: 'geminiApiKey', cerebras: 'cerebrasApiKey',
    openrouter: 'openrouterApiKey', mistral: 'mistralApiKey', telegram: 'telegramBotToken',
  };
  const currentKey = (config.apiGatewayKeys?.[currentProvider.id] || (legacyKeys[currentProvider.id] ? config[legacyKeys[currentProvider.id]] : '')) as string;

  useEffect(() => {
    setKeyInput((previous) => previous || currentKey);
  }, [selectedProvider]);

  const handleSave = async () => {
    const value = keyInput.trim();
    if (!value) return;
    const session = AuthService.getCurrentSession();
    if (!session?.token || !session.isVerified || !session.user.isVerified) {
      onRequireAuth();
      setConnectionStatus(null);
      return;
    }
    setIsSaving(true);
    setConnectionStatus(null);
    try {
      const response = await fetch('/api/ai/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.token || ''}` },
        body: JSON.stringify({ provider: currentProvider.id, token: value }),
      });
      const verification = await response.json().catch(() => ({}));
      if (!response.ok || !verification.success) throw new Error(verification.error || verification.message || 'API key verification failed.');
      void AiService.saveApiKey(currentProvider.id, value);
      void Promise.resolve(onUpdateConfig({ apiGatewayKeys: { ...(config.apiGatewayKeys || {}), [currentProvider.id]: value }, ...(legacyKeys[currentProvider.id] ? { [legacyKeys[currentProvider.id]]: value } : {}) })).catch(() => undefined);
      setConnectionStatus('Connected Successfully');
      onShowToast('🟢 API Key saved and activated successfully!');
      setKeyInput('');
    } catch (error: any) {
      setConnectionStatus(error?.message || 'API key verification failed.');
      onShowToast(`⚠️ ${currentProvider.name}: ${error?.message || 'connection failed.'}`);
    } finally {
      setIsSaving(false);
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

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSelectedProvider(p.id);
                setKeyInput((config.apiGatewayKeys?.[p.id] || (legacyKeys[p.id] ? config[legacyKeys[p.id]] : '')) as string || '');
                setConnectionStatus(null);
              }}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                selectedProvider === p.id
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="text-xs font-semibold">{p.name}</div>
              <div className="text-[10px] text-slate-500 mt-1">{p.speedTag}</div>
            </button>
          ))}
        </div>

        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">{currentProvider.name} API Key</span>
            <a
              href={currentProvider.keyUrl}
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
              disabled={isSaving || !keyInput.trim()}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition cursor-pointer"
            >
              {isSaving ? 'Verifying & Saving...' : 'Verify & Save Credentials'}
            </button>
          </div>
          {connectionStatus && <p className={`text-xs ${connectionStatus === 'Connected Successfully' ? 'text-emerald-400' : 'text-rose-400'}`}>{connectionStatus}</p>}
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
