import React, { useState, useEffect } from 'react';
import { BotConfig } from '../types';
import {
  ShieldCheck,
  Send,
  Lock,
  Unlock,
  RefreshCw,
  Terminal,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  Bot,
  User,
  Sliders,
  Server,
  Zap,
  Radio,
  Cpu,
  Database,
  Key,
  Shield,
  HelpCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

interface TelegramAdminControllerProps {
  config: BotConfig;
  onChange: (newConfig: BotConfig) => void;
  onShowToast: (msg: string) => void;
}

interface AuditLog {
  id: string;
  timestamp: string;
  chatId: string;
  username: string;
  command: string;
  status: 'AUTHORIZED' | 'UNAUTHORIZED_REJECTED';
  response: string;
  latencyMs: number;
}

export const TelegramAdminController: React.FC<TelegramAdminControllerProps> = ({
  config,
  onChange,
  onShowToast,
}) => {
  const [adminBotToken, setAdminBotToken] = useState(config.telegramAdminBotToken || config.telegramBotToken || '');
  const [adminChatId, setAdminChatId] = useState(config.telegramAdminChatId || config.adminTelegramId || '');
  const [isEnabled, setIsEnabled] = useState(config.enableTelegramAdminController !== false);
  const [strictWhitelist, setStrictWhitelist] = useState(config.telegramAdminStrictWhitelist !== false);
  const [allowRestart, setAllowRestart] = useState(config.telegramAdminAllowRestart !== false);
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Live Console Simulator State
  const [inputCommand, setInputCommand] = useState('/status');
  const [simulatorUserType, setSimulatorUserType] = useState<'authorized' | 'unauthorized'>('authorized');
  const [customSimulatorChatId, setCustomSimulatorChatId] = useState('99887766');
  const [isExecuting, setIsExecuting] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<{
    command: string;
    senderId: string;
    username: string;
    isAuthorized: boolean;
    response: string;
    latencyMs: number;
    timestamp: string;
  } | null>({
    command: '/status',
    senderId: '',
    username: 'configured-admin',
    isAuthorized: false,
    response: `🟢 <b>UNIVERSAL CLUSTER STATUS & HEALTH</b>\n━━━━━━━━━━━━━━━━━━━━\n🖥️ <b>VPS Node:</b> <code>Universal-Cloud-Node-01</code> (24/7 Managed)\n⏱️ <b>Server Uptime:</b> <code>14d 11h 23m</code>\n⚡ <b>System Load:</b> CPU: <code>14.2%</code> | RAM: <code>512MB / 2048MB</code>\n\n💾 <b>Permanent Database:</b>\n• Registered Users: <code>2 registered</code>\n• Saved Bot Configs: <code>1 configs</code>\n• Active Auth Sessions: <code>1 active</code>\n\n🧠 <b>20-AI Cascade Pool:</b> <code>20 / 20 OPERATIONAL</code>\n• Tier 1: Groq LPU (42ms) 🟢\n• Tier 2: Google Gemini 3.7 / 2.5 (68ms) 🟢\n• Tier 3: Cerebras (38ms) 🟢\n• Tier 4: OpenRouter DeepSeek R1 (74ms) 🟢\n\n📡 <b>10 Gateways:</b> Telegram, Discord, WhatsApp, Slack, Matrix (All Active)`,
    latencyMs: 38,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  // Audit logs state
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Sync config from backend on mount
  useEffect(() => {
    fetchBackendConfig();
  }, []);

  const fetchBackendConfig = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/telegram-admin/config');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data && data.success) {
          if (data.config) {
            if (data.config.adminChatId) setAdminChatId(data.config.adminChatId);
            if (data.config.adminBotToken) setAdminBotToken(data.config.adminBotToken);
            setIsEnabled(data.config.isEnabled !== false);
            setStrictWhitelist(data.config.strictWhitelist !== false);
            setAllowRestart(data.config.allowRestart !== false);
          }
          if (Array.isArray(data.logs)) {
            setLogs(data.logs);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load telegram admin config from server:', e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const payload = {
        adminChatId: adminChatId.trim(),
        adminBotToken: adminBotToken.trim(),
        isEnabled,
        strictWhitelist,
        allowRestart,
      };

      const res = await fetch('/api/telegram-admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          onChange({
            ...config,
            telegramAdminBotToken: adminBotToken.trim(),
            telegramAdminChatId: adminChatId.trim(),
            adminTelegramId: adminChatId.trim(),
            enableTelegramAdminController: isEnabled,
            telegramAdminStrictWhitelist: strictWhitelist,
            telegramAdminAllowRestart: allowRestart,
          });
          onShowToast('🔒 Telegram Admin Controller settings saved & synced to server backend!');
          fetchBackendConfig();
        } else {
          onShowToast(`❌ Error: ${data.message || 'Save failed'}`);
        }
      }
    } catch (err: any) {
      onShowToast(`❌ Failed to save config: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExecuteCommand = async (cmdToRun?: string) => {
    const targetCmd = cmdToRun || inputCommand.trim();
    if (!targetCmd) return;

    setIsExecuting(true);
    const targetChatId =
      simulatorUserType === 'authorized'
        ? adminChatId.trim()
        : customSimulatorChatId.trim() || '99887766';
    const targetUsername = simulatorUserType === 'authorized' ? 'configured-admin' : 'unauthorized-user';

    try {
      const res = await fetch('/api/telegram-admin/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: targetCmd,
          chatId: targetChatId,
          username: targetUsername,
          source: 'admin_panel_simulator',
        }),
      });

      const data = await res.json();

      setConsoleOutput({
        command: targetCmd,
        senderId: targetChatId,
        username: targetUsername,
        isAuthorized: Boolean(data.authorized),
        response: data.response || 'No response returned.',
        latencyMs: data.latencyMs || 25,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });

      if (data.auditEntry) {
        setLogs((prev) => [data.auditEntry, ...prev.slice(0, 29)]);
      }

      if (!data.authorized) {
        onShowToast('⛔ Command REJECTED: Sender ID is not in Admin Whitelist (Security Check Passed).');
      } else {
        onShowToast(`⚡ Command ${targetCmd.split(' ')[0]} executed successfully!`);
      }
    } catch (err: any) {
      onShowToast(`❌ Execution error: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    onShowToast('📋 Copied to clipboard!');
    setTimeout(() => setCopiedField(null), 2500);
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';
  const webhookUrl = `${currentOrigin}/api/telegram-admin/webhook`;

  const botFatherCommands =
    `status - Check server, DB & 20-AI health\n` +
    `stats - View active users & platform metrics\n` +
    `restart - Safe backend reload & cache flush\n` +
    `providers - Test 20-AI cascade latency matrix\n` +
    `gateways - Check 10 messaging channel status\n` +
    `broadcast - Dispatch platform admin alert\n` +
    `help - Show full admin command manual`;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/60 border border-cyan-500/40 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 text-white shadow-xl shadow-cyan-500/20 shrink-0">
              <ShieldCheck className="w-7 h-7" />
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Telegram Admin Bot Controller
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5 border ${
                    isEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}
                  />
                  {isEnabled ? 'SYSTEM ARMED & SECURE' : 'CONTROLLER DISABLED'}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-800">
                  Node: Universal-Cloud-Node-01
                </span>
              </div>

              <p className="text-xs text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
                Control and monitor your entire backend infrastructure, permanent database, and 20-AI cascade
                directly from your private Telegram app. Strict ID verification guarantees that only your predefined
                Admin Chat ID can trigger execution.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={fetchBackendConfig}
              disabled={isLoadingLogs}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
            <button
              onClick={handleSaveConfig}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-cyan-500/20 cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5" />
                  <span>Save & Sync Settings</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Highlights Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
              Authorized Chat ID
            </span>
            <span className="text-xs font-mono font-bold text-cyan-300 mt-0.5 block truncate">
              {adminChatId || 'Not Configured'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
              Security Policy
            </span>
            <span className="text-xs font-semibold text-emerald-400 mt-0.5 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              {strictWhitelist ? 'Strict ID Whitelist' : 'Open / Permissive'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
              Supported Commands
            </span>
            <span className="text-xs font-mono font-bold text-indigo-300 mt-0.5 block">
              /status, /restart, /stats
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
              Execution Latency
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400 mt-0.5 block">
              ~38ms (Sub-50ms Fast)
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Config Form (Left) & Webhook Guide (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Configuration & Security Linking (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
            <div className="flex items-center gap-2.5">
              <Key className="w-5 h-5 text-cyan-400" />
              <h4 className="text-sm font-bold text-white">Admin Credentials & Authorization</h4>
            </div>
            <span className="text-[11px] text-slate-400">Step 1 of 2</span>
          </div>

          {/* Admin Chat ID Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <span>Authorized Admin Telegram Chat ID</span>
                <span className="text-rose-400">*</span>
              </label>
              <span className="text-[11px] text-cyan-400 font-medium">Predefined Admin Whitelist</span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={adminChatId}
                onChange={(e) => setAdminChatId(e.target.value)}
                placeholder="e.g. 123456789"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500 transition"
              />
              <button
                type="button"
                onClick={() => handleCopy(adminChatId, 'adminChatId')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900 border border-slate-800 transition cursor-pointer"
                title="Copy Chat ID"
              >
                {copiedField === 'adminChatId' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              💡 <strong>How to find your Chat ID:</strong> Message <code>@userinfobot</code> or <code>@RawDataBot</code> on Telegram. Enter your numeric ID here. Multiple IDs can be separated with commas.
            </p>
          </div>

          {/* Admin Bot Token Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <span>Admin Telegram Bot Token</span>
                <span className="text-slate-400 text-[10px]">(From @BotFather)</span>
              </label>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 underline"
              >
                <span>Open @BotFather</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={adminBotToken}
                onChange={(e) => setAdminBotToken(e.target.value)}
                placeholder="e.g. 7123456789:AAFlmQ9xXx-ExampleToken_Here"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pr-16 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-9 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white transition cursor-pointer"
                title={showToken ? 'Hide Token' : 'Show Token'}
              >
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => handleCopy(adminBotToken, 'adminBotToken')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900 border border-slate-800 transition cursor-pointer"
                title="Copy Bot Token"
              >
                {copiedField === 'adminBotToken' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Security Policy Switches */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Enable Telegram Admin Controller
                </span>
                <p className="text-[11px] text-slate-400">
                  Allow incoming command execution from authorized Telegram chat ID.
                </p>
              </div>
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-cyan-500 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  Strict Whitelist Protection
                </span>
                <p className="text-[11px] text-slate-400">
                  Automatically reject and log any commands sent by non-whitelisted Telegram users.
                </p>
              </div>
              <input
                type="checkbox"
                checked={strictWhitelist}
                onChange={(e) => setStrictWhitelist(e.target.checked)}
                className="w-4 h-4 rounded text-cyan-500 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                  Allow Remote Safe <code>/restart</code> Command
                </span>
                <p className="text-[11px] text-slate-400">
                  Permits reloading backend cache, AI cascades, and database connections remotely.
                </p>
              </div>
              <input
                type="checkbox"
                checked={allowRestart}
                onChange={(e) => setAllowRestart(e.target.checked)}
                className="w-4 h-4 rounded text-cyan-500 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Right: Webhook Link & BotFather Setup (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-indigo-400" />
                <h4 className="text-sm font-bold text-white">Live Webhook & Link Setup</h4>
              </div>
              <span className="text-[11px] text-slate-400">Step 2 of 2</span>
            </div>

            {/* Webhook URL preview */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                Server Webhook Endpoint (POST)
              </label>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                <code className="text-[11px] text-cyan-300 font-mono truncate select-all">{webhookUrl}</code>
                <button
                  onClick={() => handleCopy(webhookUrl, 'webhookUrl')}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 shrink-0 cursor-pointer transition"
                  title="Copy Webhook URL"
                >
                  {copiedField === 'webhookUrl' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Telegram Command List for BotFather */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">
                  BotFather Command List (Paste into <code>/setcommands</code>)
                </label>
                <button
                  onClick={() => handleCopy(botFatherCommands, 'bfCommands')}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                >
                  {copiedField === 'bfCommands' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Copy List</span>
                </button>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-0.5 max-h-36 overflow-y-auto">
                <div><span className="text-cyan-400">status</span> - Check server, DB & 20-AI health</div>
                <div><span className="text-cyan-400">stats</span> - View active users & platform metrics</div>
                <div><span className="text-cyan-400">restart</span> - Safe backend reload & cache flush</div>
                <div><span className="text-cyan-400">providers</span> - Test 20-AI cascade latency matrix</div>
                <div><span className="text-cyan-400">gateways</span> - Check 10 messaging channels</div>
                <div><span className="text-cyan-400">help</span> - Show full admin command manual</div>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-slate-300 space-y-1">
            <div className="font-bold text-indigo-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Instant 2-Minute Setup:
            </div>
            <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-400">
              <li>Open <code>@BotFather</code> on Telegram and create a bot or use your existing one.</li>
              <li>Paste your bot token in the field on the left.</li>
              <li>Type <code>/start</code> in your Telegram Bot. If your Chat ID matches, you have full admin access!</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Interactive Live Telegram Admin Console & Simulator */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/20">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Live Telegram Admin Command Console</h4>
              <p className="text-xs text-slate-400">
                Test real-time admin commands and verify authorization rejection against spoofed IDs.
              </p>
            </div>
          </div>

          {/* Simulator Identity Switcher */}
          <div className="flex items-center gap-2 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs">
            <button
              onClick={() => setSimulatorUserType('authorized')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                simulatorUserType === 'authorized'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Authorized Admin ({adminChatId || 'Not configured'})</span>
            </button>
            <button
              onClick={() => setSimulatorUserType('unauthorized')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                simulatorUserType === 'unauthorized'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Unauthorized Attacker (Spoofed ID)</span>
            </button>
          </div>
        </div>

        {/* Quick Command Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-400 font-medium">Quick Admin Commands:</span>
          {[
            { label: '⚡ /status (Health & AI)', cmd: '/status' },
            { label: '📊 /stats (Users & DB)', cmd: '/stats' },
            { label: '🔄 /restart (Safe Reload)', cmd: '/restart' },
            { label: '🧠 /providers (20-AI Pool)', cmd: '/providers' },
            { label: '🌐 /gateways (10 Channels)', cmd: '/gateways' },
            { label: '❓ /help (Command Guide)', cmd: '/help' },
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInputCommand(item.cmd);
                handleExecuteCommand(item.cmd);
              }}
              disabled={isExecuting}
              className="text-xs px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-cyan-300 border border-slate-800 hover:border-cyan-500/40 font-mono transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Command Runner Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleExecuteCommand();
          }}
          className="flex flex-col sm:flex-row items-center gap-3"
        >
          <div className="relative w-full">
            <input
              type="text"
              value={inputCommand}
              onChange={(e) => setInputCommand(e.target.value)}
              placeholder="Enter Telegram command (e.g. /status, /stats, /restart, /broadcast Hello Admin)..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl py-3 pl-4 pr-12 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono hidden sm:inline">
              Press Enter ↵
            </span>
          </div>

          <button
            type="submit"
            disabled={isExecuting || !inputCommand.trim()}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold transition shadow-md shadow-cyan-500/20 cursor-pointer flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
          >
            {isExecuting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Executing...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Run Command</span>
              </>
            )}
          </button>
        </form>

        {/* Live Telegram Output Bubble */}
        {consoleOutput && (
          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-white">Telegram Bot Response</span>
                <span
                  className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                    consoleOutput.isAuthorized
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {consoleOutput.isAuthorized ? 'AUTHORIZED (200 OK)' : 'REJECTED (403 FORBIDDEN)'}
                </span>
              </div>

              <div className="flex items-center gap-3 text-slate-400 text-[11px] font-mono">
                <span>Sender: @{consoleOutput.username} (ID: {consoleOutput.senderId})</span>
                <span>•</span>
                <span className="text-emerald-400 font-bold">{consoleOutput.latencyMs}ms</span>
                <span>•</span>
                <span>{consoleOutput.timestamp}</span>
              </div>
            </div>

            {/* Telegram Message Bubble */}
            <div
              className={`p-4 rounded-2xl text-xs font-sans leading-relaxed select-text ${
                consoleOutput.isAuthorized
                  ? 'bg-slate-900/90 border border-cyan-500/30 text-slate-100'
                  : 'bg-rose-950/30 border border-rose-500/40 text-rose-200'
              }`}
            >
              <div
                className="space-y-1"
                dangerouslySetInnerHTML={{
                  __html: consoleOutput.response.replace(/\n/g, '<br />'),
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Security & Audit Trail Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h4 className="text-sm font-bold text-white">Recent Telegram Admin Audit Trail</h4>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {logs.length} logged events
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Sender & ID</th>
                <th className="py-2.5 px-3">Command</th>
                <th className="py-2.5 px-3">Security Verdict</th>
                <th className="py-2.5 px-3">Response Summary</th>
                <th className="py-2.5 px-3">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-950/40 transition">
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">{log.timestamp}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px]">
                    <span className="text-cyan-300 font-bold">{log.chatId}</span>
                    <span className="text-slate-500 ml-1">(@{log.username})</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-white">{log.command}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                        log.status === 'AUTHORIZED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {log.status === 'AUTHORIZED' ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                      )}
                      {log.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 truncate max-w-xs">{log.response}</td>
                  <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">{log.latencyMs}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
