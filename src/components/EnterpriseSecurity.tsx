import React, { useState } from 'react';
import { BotConfig } from '../types';
import { ShieldCheck, Lock, Key, AlertTriangle, CheckCircle2, Shield, Eye, EyeOff } from 'lucide-react';

interface EnterpriseSecurityProps {
  config: BotConfig;
  onChange: (updates: Partial<BotConfig>) => void;
  onShowToast: (msg: string) => void;
}

export const EnterpriseSecurity: React.FC<EnterpriseSecurityProps> = ({
  config,
  onChange,
  onShowToast,
}) => {
  const [whitelist, setWhitelist] = useState(config.adminUserIds || '');
  const [showTokens, setShowTokens] = useState(false);

  const handleSaveSecurity = () => {
    onChange({ adminUserIds: whitelist, enableAdminWhitelist: true });
    onShowToast('🛡️ Enterprise security policies updated.');
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950/30 to-slate-900 border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Enterprise Security, 2FA & Firewall Whitelist</h2>
              <p className="text-xs text-slate-400">Strict numeric Telegram user ID filtering, HMAC API request authentication, and tamper protection</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
            <Lock className="w-4 h-4" />
            <span>Strict User ID Access Control</span>
          </div>
          <p className="text-xs text-slate-400">
            Block all unverified incoming bot interactions across Telegram and connected webhooks.
          </p>
          <textarea
            value={whitelist}
            onChange={(e) => setWhitelist(e.target.value)}
            placeholder="Enter authorized Telegram User IDs..."
            rows={4}
            className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-500"
          />
          <button
            onClick={handleSaveSecurity}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition cursor-pointer"
          >
            Apply Firewall Rules
          </button>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
              <Key className="w-4 h-4" />
              <span>Gateway Token Obfuscation</span>
            </div>
            <button
              onClick={() => setShowTokens(!showTokens)}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              {showTokens ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showTokens ? 'Mask' : 'Reveal'}</span>
            </button>
          </div>
          <div className="space-y-2 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
              <span className="text-slate-400">Telegram Bot Token:</span>
              <span className="text-slate-200">{config.telegramBotToken ? (showTokens ? config.telegramBotToken : '••••••••••••••••') : '<Unset>'}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
              <span className="text-slate-400">Groq API Key:</span>
              <span className="text-slate-200">{config.groqApiKey ? (showTokens ? config.groqApiKey : '••••••••••••••••') : '<Unset>'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
