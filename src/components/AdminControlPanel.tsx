import React, { useState } from 'react';
import { BotConfig } from '../types';
import { ShieldCheck, Server, RefreshCw, Key, Users, Activity, Download, Upload, Terminal, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';

interface AdminControlPanelProps {
  config: BotConfig;
  onChange: (updates: Partial<BotConfig>) => void;
  onShowToast: (msg: string) => void;
  onOpenPortal: (platformId?: string) => void;
  onOpenSubscriptionModal: () => void;
}

export const AdminControlPanel: React.FC<AdminControlPanelProps> = ({
  config,
  onChange,
  onShowToast,
  onOpenPortal,
  onOpenSubscriptionModal,
}) => {
  const [adminWhitelist, setAdminWhitelist] = useState(config.adminUserIds || '');
  const [commandInput, setCommandInput] = useState('');
  const [commandOutput, setCommandOutput] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleSaveWhitelist = () => {
    onChange({ adminUserIds: adminWhitelist, enableAdminWhitelist: true });
    onShowToast('🛡️ Admin whitelist saved successfully!');
  };

  const handleExecuteCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;

    setIsExecuting(true);
    const cmd = commandInput.trim();
    setCommandInput('');

    try {
      const res = await fetch('/api/admin/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await res.json().catch(() => ({}));
      setCommandOutput((prev) => [
        `> ${cmd}`,
        data.output || data.message || 'Executed successfully.',
        ...prev.slice(0, 20),
      ]);
    } catch (err: any) {
      setCommandOutput((prev) => [`> ${cmd}`, `Error: ${err.message}`, ...prev.slice(0, 20)]);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Enterprise Admin Control Center</h2>
              <p className="text-xs text-slate-400">Strict IP & Telegram ID Whitelist, Live Node Control, & Database Sync</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSubscriptionModal}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition cursor-pointer"
            >
              Enterprise Tier Active
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Whitelist Configuration */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-4">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
            <Lock className="w-4 h-4" />
            <span>Admin Telegram User ID Whitelist</span>
          </div>
          <p className="text-xs text-slate-400">
            Comma-separated numeric Telegram User IDs authorized to execute privileged commands.
          </p>
          <textarea
            value={adminWhitelist}
            onChange={(e) => setAdminWhitelist(e.target.value)}
            placeholder="e.g. 123456789, 987654321"
            rows={3}
            className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleSaveWhitelist}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition cursor-pointer"
          >
            Save Admin Whitelist
          </button>
        </div>

        {/* Live Admin Command Terminal */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <Terminal className="w-4 h-4" />
            <span>Direct Admin Command Console</span>
          </div>
          <form onSubmit={handleExecuteCommand} className="flex gap-2">
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder="/status, /stats, /clear_memory..."
              className="flex-1 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={isExecuting}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
            >
              Run
            </button>
          </form>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 h-36 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1">
            {commandOutput.length === 0 ? (
              <span className="text-slate-600">Enter a command above to execute on the live node...</span>
            ) : (
              commandOutput.map((line, i) => (
                <div key={i} className={line.startsWith('>') ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
