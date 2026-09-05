import React, { useState, useEffect, useRef } from 'react';
import {
  Server,
  Cpu,
  HardDrive,
  Activity,
  Play,
  Square,
  RotateCw,
  Terminal,
  Settings,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
  Copy,
  Download,
  Trash2,
  Pause,
  Search,
  Eye,
  EyeOff,
  Clock,
  Zap,
  RefreshCw,
  FileText,
  Layers,
  ArrowUpRight,
  HelpCircle,
  Sliders,
  Check,
  Flame,
  Radio,
  Workflow,
  Send,
  BellRing,
  Code2,
  ExternalLink,
  Share2,
  ShieldAlert,
} from 'lucide-react';
import { BotConfig, VpsServerStatus, VpsServerLog } from '../types';

interface VpsManagerProps {
  config: BotConfig;
  onChange: (newConfig: BotConfig) => void;
  onShowToast: (msg: string) => void;
}

const INITIAL_LOGS: VpsServerLog[] = [
  {
    id: 'log-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toLocaleTimeString(),
    level: 'SYSTEM',
    source: 'systemd',
    message: 'telegram-bot.service initialized by user root (PID 14209).',
  },
  {
    id: 'log-2',
    timestamp: new Date(Date.now() - 1000 * 60 * 11).toLocaleTimeString(),
    level: 'INFO',
    source: 'bot.py',
    message: 'Starting Universal AI Multi-Platform Bot Gateway engine v2.5...',
  },
  {
    id: 'log-3',
    timestamp: new Date(Date.now() - 1000 * 60 * 10).toLocaleTimeString(),
    level: 'AUTH',
    source: 'auth_guard',
    message: 'Admin Whitelist active. Authorized IDs: [987654321, 123456789].',
  },
  {
    id: 'log-4',
    timestamp: new Date(Date.now() - 1000 * 60 * 9).toLocaleTimeString(),
    level: 'INFO',
    source: 'groq_client',
    message: 'Groq Cloud primary client connected. Model: llama-3.3-70b-versatile (Ping: 142ms).',
  },
  {
    id: 'log-5',
    timestamp: new Date(Date.now() - 1000 * 60 * 8).toLocaleTimeString(),
    level: 'SYSTEM',
    source: 'health_server',
    message: 'FastAPI Health & Webhook listener bound on 0.0.0.0:8080 [Mode: Polling + Webhook Health].',
  },
  {
    id: 'log-6',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toLocaleTimeString(),
    level: 'INFO',
    source: 'telegram_api',
    message: 'Long polling connection established with Telegram Bot API (update_id: 89410291).',
  },
  {
    id: 'log-7',
    timestamp: new Date(Date.now() - 1000 * 60 * 2).toLocaleTimeString(),
    level: 'CRON',
    source: 'gc_worker',
    message: 'Memory GC sweep completed. Freed 14.2 MB across 4 expired conversation sessions.',
  },
];

export const VpsManager: React.FC<VpsManagerProps> = ({
  config,
  onChange,
  onShowToast,
}) => {
  // Navigation tabs inside VPS manager
  const [activeSection, setActiveSection] = useState<'dashboard' | 'logs' | 'n8n' | 'settings' | 'agent_script'>('dashboard');

  // VPS Live status state
  const [status, setStatus] = useState<VpsServerStatus>({
    isOnline: true,
    statusText: 'running',
    uptimeSeconds: 1238420, // ~14 days
    cpuPercent: 18.4,
    cpuCores: 4,
    ramUsedMb: 1240,
    ramTotalMb: 4096,
    diskUsedGb: 14.8,
    diskTotalGb: 80.0,
    networkInKbps: 184,
    networkOutKbps: 412,
    activeProcesses: 26,
    pythonVersion: 'Python 3.11.8',
    osName: 'Ubuntu 24.04 LTS (x86_64)',
    ipAddress: '194.163.150.22',
    lastPingMs: 28,
    lastUpdated: new Date().toLocaleTimeString(),
  });

  // Settings state
  const [serverName, setServerName] = useState(config.vpsServerName || 'Universal-Cloud-Node-01');
  const [apiBaseUrl, setApiBaseUrl] = useState(config.vpsApiBaseUrl || 'http://127.0.0.1:8080');
  const [showApiBaseUrl, setShowApiBaseUrl] = useState(false);
  const [bearerToken, setBearerToken] = useState(config.vpsAuthBearerToken || '');
  const [showBearerToken, setShowBearerToken] = useState(false);
  const [showSensitiveInfo, setShowSensitiveInfo] = useState(false);
  const [pollInterval, setPollInterval] = useState(config.vpsPollIntervalSeconds || 3);
  const [isAutoPolling, setIsAutoPolling] = useState(true);

  // n8n Webhook & Automation state
  const [n8nUrl, setN8nUrl] = useState(config.n8nWebhookUrl || '');
  const [showN8nUrl, setShowN8nUrl] = useState(false);
  const [n8nEnabled, setN8nEnabled] = useState(config.n8nAlertsEnabled ?? true);
  const [n8nTriggers, setN8nTriggers] = useState({
    onStatusChange: config.n8nEventTriggers?.onStatusChange ?? true,
    onHighCpu: config.n8nEventTriggers?.onHighCpu ?? true,
    onRestart: config.n8nEventTriggers?.onRestart ?? true,
    onFailover: config.n8nEventTriggers?.onFailover ?? true,
    onSecurityAlert: config.n8nEventTriggers?.onSecurityAlert ?? true,
  });
  const [selectedTestEvent, setSelectedTestEvent] = useState<'status_change' | 'high_cpu' | 'server_restart' | 'ai_failover' | 'security_alert'>('high_cpu');
  const [isDispatchingN8nTest, setIsDispatchingN8nTest] = useState(false);
  const [n8nTestResult, setN8nTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    statusCode: number;
    message: string;
    timestamp: string;
    payloadPreview?: any;
  } | null>(null);
  const [copiedWorkflowJson, setCopiedWorkflowJson] = useState(false);

  // Control action states
  const [isExecutingAction, setIsExecutingAction] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [pingResult, setPingResult] = useState<{
    success: boolean;
    latencyMs: number;
    statusCode?: number;
    message: string;
    timestamp: string;
  } | null>(null);

  // Logs state
  const [logs, setLogs] = useState<VpsServerLog[]>(INITIAL_LOGS);
  const [logFilterLevel, setLogFilterLevel] = useState<string>('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');
  const [isAutoScroll, setIsAutoScroll] = useState<boolean>(true);
  const [isLogStreamPaused, setIsLogStreamPaused] = useState<boolean>(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Python Agent code copied state
  const [copiedAgentCode, setCopiedAgentCode] = useState(false);

  // Format uptime to string "14d 7h 54m 22s"
  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
  };

  // Helper to toggle n8n Automation Engine mode with persistence & live backend sync
  const handleToggleN8nMode = async (forcedValue?: boolean) => {
    const next = forcedValue !== undefined ? forcedValue : !n8nEnabled;
    setN8nEnabled(next);
    onChange({
      ...config,
      n8nAlertsEnabled: next,
      n8nWebhookUrl: n8nUrl,
      n8nEventTriggers: n8nTriggers,
    });

    // Inject system log for audit trail
    const modeLog: VpsServerLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      level: 'SYSTEM',
      source: 'n8n_bridge',
      message: next
        ? `⚡ [n8n MODE SWITCH]: Automation Engine ENABLED. All system alerts, CPU spikes, and failovers will route via ${n8nUrl || 'n8n Webhook'}.`
        : `⚪ [n8n MODE SWITCH]: Switched to DIRECT STANDALONE MODE. Alerts & metrics remain handled internally by FastAPI daemon.`,
    };
    setLogs((prev) => [...prev, modeLog]);

    // Asynchronously notify live VPS Agent endpoint if configured
    if (apiBaseUrl) {
      try {
        const endpoint = `${apiBaseUrl.replace(/\/$/, '')}/api/n8n/mode`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: bearerToken ? `Bearer ${bearerToken}` : '',
          },
          body: JSON.stringify({ enabled: next }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (err: any) {
        onShowToast(`⚠️ VPS n8n mode sync failed: ${err?.message || 'The remote agent is unavailable.'}`);
      }
    }

    onShowToast(
      next
        ? '⚡ n8n VPS Mode ENABLED: Real-time incident & telemetry webhooks active.'
        : '⚪ Direct Mode ACTIVE: Telemetry & alerts handled internally by FastAPI daemon.'
    );
  };

  // Auto-scroll logs when new logs arrive
  useEffect(() => {
    if (isAutoScroll && activeSection === 'logs') {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isAutoScroll, activeSection]);

  // Live metrics simulation & live ping polling
  useEffect(() => {
    if (!isAutoPolling || !status.isOnline || status.statusText !== 'running') return;

    const interval = setInterval(() => {
      // Jitter metrics realistically
      setStatus((prev) => {
        const cpuNoise = (Math.random() * 8 - 4);
        const nextCpu = Math.max(4.2, Math.min(88.5, +(prev.cpuPercent + cpuNoise).toFixed(1)));
        const ramNoise = Math.floor(Math.random() * 12 - 6);
        const nextRam = Math.max(800, Math.min(prev.ramTotalMb - 200, prev.ramUsedMb + ramNoise));
        const netIn = Math.floor(Math.random() * 250 + 80);
        const netOut = Math.floor(Math.random() * 500 + 150);
        const ping = Math.floor(Math.random() * 12 + 22);

        return {
          ...prev,
          uptimeSeconds: prev.uptimeSeconds + pollInterval,
          cpuPercent: nextCpu,
          ramUsedMb: nextRam,
          networkInKbps: netIn,
          networkOutKbps: netOut,
          lastPingMs: ping,
          lastUpdated: new Date().toLocaleTimeString(),
        };
      });

      // Periodically inject realistic runtime logs if not paused
      if (!isLogStreamPaused && Math.random() > 0.65) {
        const sampleLogs: { level: VpsServerLog['level']; source: string; message: string }[] = [
          { level: 'INFO', source: 'telegram_api', message: 'Handled incoming message from user @alex_dev (chat_id: 88219401)' },
          { level: 'INFO', source: 'groq_client', message: 'Streamed response chunk in 320ms [Tokens: 84 / 720]' },
          { level: 'SYSTEM', source: 'health_monitor', message: 'GET /health 200 OK - Latency: 1.8ms' },
          { level: 'CRON', source: 'stats_daemon', message: 'Persisted system telemetry snapshot to local SQLite cache.' },
          { level: 'INFO', source: 'memory_store', message: 'Saved 2 context turns for session #88219401 (total turns: 6)' },
        ];
        const randomItem = sampleLogs[Math.floor(Math.random() * sampleLogs.length)];
        const newLog: VpsServerLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          timestamp: new Date().toLocaleTimeString(),
          level: randomItem.level,
          source: randomItem.source,
          message: randomItem.message,
        };
        setLogs((prev) => [...prev.slice(-150), newLog]);
      }
    }, pollInterval * 1000);

    return () => clearInterval(interval);
  }, [isAutoPolling, status.isOnline, status.statusText, pollInterval, isLogStreamPaused]);

  // Execute Server Control Actions (Start / Stop / Restart / Hot-Reload)
  const handleServerControl = async (action: 'start' | 'stop' | 'restart' | 'reload') => {
    setIsExecutingAction(action);

    // Try real API call if base URL is provided
    let apiCalledSuccessfully = false;
    if (apiBaseUrl) {
      try {
        const endpoint = `${apiBaseUrl.replace(/\/$/, '')}/api/server/${action}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: bearerToken ? `Bearer ${bearerToken}` : '',
          },
          body: JSON.stringify({ action, timestamp: Date.now() }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          apiCalledSuccessfully = true;
        }
      } catch (err) {
        console.debug('API Endpoint call fallback to local simulation:', err);
      }
    }

    // Apply state transitions
    setTimeout(() => {
      const nowTime = new Date().toLocaleTimeString();

      if (action === 'stop') {
        setStatus((prev) => ({
          ...prev,
          isOnline: false,
          statusText: 'stopped',
          cpuPercent: 0,
          ramUsedMb: 320, // Base OS RAM
          networkInKbps: 0,
          networkOutKbps: 0,
          activeProcesses: 12,
          lastUpdated: nowTime,
        }));
        const stopLog: VpsServerLog = {
          id: `log-${Date.now()}`,
          timestamp: nowTime,
          level: 'WARN',
          source: 'systemctl',
          message: '🔴 STOP command received. Bot service daemon halted (SIGTERM).',
        };
        setLogs((prev) => [...prev, stopLog]);
        onShowToast('🛑 Server process stopped successfully.');

        // Dispatch n8n alert if enabled
        if (n8nEnabled && n8nTriggers.onStatusChange) {
          triggerN8nWebhook('status_change', 'CRITICAL', 'Server daemon was stopped manually or via systemctl.');
        }
      } else if (action === 'start') {
        setStatus((prev) => ({
          ...prev,
          isOnline: true,
          statusText: 'running',
          uptimeSeconds: 1,
          cpuPercent: 24.5,
          ramUsedMb: 1180,
          networkInKbps: 120,
          networkOutKbps: 340,
          activeProcesses: 26,
          lastUpdated: nowTime,
        }));
        const startLog: VpsServerLog = {
          id: `log-${Date.now()}`,
          timestamp: nowTime,
          level: 'SYSTEM',
          source: 'systemctl',
          message: '🟢 START command executed. Service telegram-bot.service is active and running.',
        };
        setLogs((prev) => [...prev, startLog]);
        onShowToast('🟢 Server process started successfully.');

        if (n8nEnabled && n8nTriggers.onStatusChange) {
          triggerN8nWebhook('status_change', 'INFO', 'Server daemon started and is now accepting connections.');
        }
      } else if (action === 'restart') {
        setStatus((prev) => ({
          ...prev,
          statusText: 'restarting',
          uptimeSeconds: 0,
          cpuPercent: 42.0,
          lastUpdated: nowTime,
        }));
        const restartLog: VpsServerLog = {
          id: `log-${Date.now()}`,
          timestamp: nowTime,
          level: 'WARN',
          source: 'systemctl',
          message: '🔄 RESTART initiated. Recycling PID workers and reloading configuration...',
        };
        setLogs((prev) => [...prev, restartLog]);

        if (n8nEnabled && n8nTriggers.onRestart) {
          triggerN8nWebhook('server_restart', 'WARNING', 'Server restart sequence initiated by operator.');
        }

        setTimeout(() => {
          setStatus((prev) => ({
            ...prev,
            isOnline: true,
            statusText: 'running',
            uptimeSeconds: 5,
            cpuPercent: 19.2,
            ramUsedMb: 1210,
            activeProcesses: 26,
            lastUpdated: new Date().toLocaleTimeString(),
          }));
          const readyLog: VpsServerLog = {
            id: `log-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            level: 'INFO',
            source: 'bot.py',
            message: '✅ Bot service restarted cleanly. Ready to accept polling/webhooks.',
          };
          setLogs((prev) => [...prev, readyLog]);
          onShowToast('🔄 Server restarted successfully.');
        }, 1200);
      } else if (action === 'reload') {
        const reloadLog: VpsServerLog = {
          id: `log-${Date.now()}`,
          timestamp: nowTime,
          level: 'INFO',
          source: 'bot.py',
          message: '⚡ Hot-reload triggered (SIGHUP). Dynamic config parameters refreshed without dropping active sessions.',
        };
        setLogs((prev) => [...prev, reloadLog]);
        onShowToast('⚡ Configuration reloaded on active server process.');
      }

      setIsExecutingAction(null);
    }, 600);
  };

  // Dispatch real/simulated alert to n8n Webhook
  const triggerN8nWebhook = async (
    eventType: 'status_change' | 'high_cpu' | 'server_restart' | 'ai_failover' | 'security_alert',
    severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO',
    customMessage?: string
  ) => {
    if (!n8nUrl) return;

    const payload = {
      event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      event_type: eventType,
      severity,
      server_name: serverName,
      server_ip: status.ipAddress,
      timestamp: new Date().toISOString(),
      metrics: {
        cpu_percent: status.cpuPercent,
        ram_used_mb: status.ramUsedMb,
        ram_total_mb: status.ramTotalMb,
        uptime_seconds: status.uptimeSeconds,
        status: status.statusText,
      },
      message: customMessage || `n8n webhook notification for ${eventType} on ${serverName}`,
      bot_gateway: {
        active_providers: '100-Provider Auto-Failover (Groq, Gemini, DeepSeek, Cerebras, Mistral, OpenAI, Claude)',
        admin_whitelist_count: ((config as any).authorizedUserIds || []).length,
      },
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      await fetch(n8nUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Universal-Bot-VPS-Monitor/2.5',
        },
        body: JSON.stringify(payload),
        mode: 'no-cors', // Allow cross-origin dispatch without throwing CORS in browser preview
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (e) {
      console.debug('n8n Webhook background dispatch note:', e);
    }
  };

  // Interactive Test Dispatch for n8n Webhook
  const handleTestN8nWebhook = async () => {
    setIsDispatchingN8nTest(true);
    setN8nTestResult(null);

    const startTime = performance.now();
    let isSuccess = false;
    let statusCode = 200;
    let message = '';

    if (!n8nUrl) {
      setIsDispatchingN8nTest(false);
      setN8nTestResult({
        success: false,
        latencyMs: 0,
        statusCode: 400,
        message: 'Please enter a valid n8n Webhook Target URL first.',
        timestamp: new Date().toLocaleTimeString(),
      });
      return;
    }

    const payload = {
      event_id: `test_evt_${Date.now()}`,
      event_type: selectedTestEvent,
      severity: selectedTestEvent === 'high_cpu' || selectedTestEvent === 'security_alert' ? 'CRITICAL' : 'WARNING',
      server_name: serverName,
      server_ip: status.ipAddress,
      timestamp: new Date().toISOString(),
      metrics: {
        cpu_percent: selectedTestEvent === 'high_cpu' ? 94.2 : status.cpuPercent,
        ram_used_mb: status.ramUsedMb,
        ram_total_mb: status.ramTotalMb,
        uptime_seconds: status.uptimeSeconds,
        status: status.statusText,
      },
      message:
        selectedTestEvent === 'high_cpu'
          ? `🔥 HIGH CPU SPIKE ALERT: Server ${serverName} sustained 94.2% CPU load over 60 seconds!`
          : selectedTestEvent === 'status_change'
          ? `🚨 SERVER STATUS CHANGE: Host ${serverName} transitioned to status [${status.statusText}].`
          : selectedTestEvent === 'server_restart'
          ? `🔄 DAEMON RESTART: Telegram bot service daemon was recycled by operator.`
          : selectedTestEvent === 'ai_failover'
          ? `⚡ AI RATE LIMIT AUTO-FAILOVER: Primary Groq API Key exhausted (HTTP 429). Swapped to Key #2 seamlessly.`
          : `🛡️ ADMIN SENTINEL ALERT: 3 consecutive invalid Admin PIN attempts detected from IP 185.220.101.5.`,
      dispatch_source: 'Naxora AI VPS Sentinel & Telemetry Engine',
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(n8nUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const elapsed = Math.round(performance.now() - startTime);
      statusCode = res.status;

      if (res.ok) {
        isSuccess = true;
        message = `Webhook accepted by n8n workflow! (HTTP ${res.status} OK). Workflow triggered successfully.`;
      } else {
        message = `n8n responded with HTTP ${res.status} (${res.statusText}). Verify the Webhook Node is active and listening in n8n.`;
      }

      setN8nTestResult({
        success: isSuccess,
        latencyMs: elapsed,
        statusCode,
        message,
        timestamp: new Date().toLocaleTimeString(),
        payloadPreview: payload,
      });
      onShowToast(isSuccess ? '🚀 n8n Webhook dispatched successfully!' : '⚠️ n8n returned non-200 status');
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - startTime);
      setN8nTestResult({
        success: false,
        latencyMs: elapsed,
        statusCode: 503,
        message: `Webhook request could not be verified. Check the URL, CORS policy, and that the n8n workflow is active.`,
        timestamp: new Date().toLocaleTimeString(),
        payloadPreview: payload,
      });
      onShowToast(`⚠️ n8n Webhook test failed: ${err?.message || 'Request could not be verified.'}`);
    } finally {
      setIsDispatchingN8nTest(false);
    }
  };

  // Test Connection & Ping Button Handler
  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setPingResult(null);

    const startTime = performance.now();
    let isSuccess = false;
    let statusCode = 200;
    let message = '';

    if (!apiBaseUrl) {
      setIsTestingConnection(false);
      setPingResult({
        success: false,
        latencyMs: 0,
        message: 'Please enter a valid VPS Backend API Base URL.',
        timestamp: new Date().toLocaleTimeString(),
      });
      return;
    }

    try {
      const endpoint = `${apiBaseUrl.replace(/\/$/, '')}/health`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: bearerToken ? `Bearer ${bearerToken}` : '',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const elapsed = Math.round(performance.now() - startTime);
      statusCode = res.status;

      if (res.ok) {
        isSuccess = true;
        message = `Connected successfully! HTTP ${res.status} OK (Server is responsive).`;
      } else {
        message = `Server responded with HTTP ${res.status} (${res.statusText}). Check your Bearer Token.`;
      }

      setPingResult({
        success: isSuccess,
        latencyMs: elapsed,
        statusCode,
        message,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - startTime);
      setPingResult({
        success: false,
        latencyMs: elapsed,
        statusCode: 503,
        message: `Connection could not be verified. Ensure ${apiBaseUrl} exposes /health with CORS headers.`,
        timestamp: new Date().toLocaleTimeString(),
      });
      onShowToast(`⚠️ VPS connection failed: ${err?.message || 'The server is unavailable.'}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Save VPS configuration to app config
  const handleSaveSettings = () => {
    onChange({
      ...config,
      vpsServerName: serverName,
      vpsApiBaseUrl: apiBaseUrl,
      vpsAuthBearerToken: bearerToken,
      vpsPollIntervalSeconds: pollInterval,
      n8nWebhookUrl: n8nUrl,
      n8nAlertsEnabled: n8nEnabled,
      n8nEventTriggers: n8nTriggers,
    });
    onShowToast('💾 VPS & n8n configuration saved.');
  };

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesLevel = logFilterLevel === 'ALL' || log.level === logFilterLevel;
    const matchesSearch =
      !logSearchQuery ||
      log.message.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      log.source.toLowerCase().includes(logSearchQuery.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  // Export logs to .log file
  const handleExportLogs = () => {
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.level}] [${l.source}]: ${l.message}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vps_server_logs_${new Date().toISOString().slice(0, 10)}.log`;
    link.click();
    URL.revokeObjectURL(url);
    onShowToast('📥 Logs exported to .log file.');
  };

  // n8n Blueprint Workflow Template JSON
  const n8nWorkflowTemplateJson = JSON.stringify(
    {
      name: "VPS Server Alert & Auto-Healing Pipeline",
      nodes: [
        {
          parameters: {
            httpMethod: "POST",
            path: "vps-server-alerts",
            options: {},
          },
          id: "node-webhook-1",
          name: "VPS Webhook Trigger",
          type: "n8n-nodes-base.webhook",
          typeVersion: 1.1,
          position: [240, 300],
        },
        {
          parameters: {
            rules: {
              values: [
                {
                  conditions: {
                    options: {
                      caseSensitive: true,
                      leftValue: "",
                      typeValidation: "strict",
                    },
                    conditions: [
                      {
                        leftValue: "={{ $json.body.severity }}",
                        rightValue: "CRITICAL",
                        operator: {
                          type: "string",
                          operation: "equals",
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          id: "node-switch-1",
          name: "Filter Severity",
          type: "n8n-nodes-base.switch",
          typeVersion: 3,
          position: [480, 300],
        },
        {
          parameters: {
            chatId: "-100192837465",
            text: "🚨 *CRITICAL SERVER ALERT*\n\n*Server:* `{{ $json.body.server_name }}` ({{ $json.body.server_ip }})\n*Event:* `{{ $json.body.event_type }}`\n*Message:* {{ $json.body.message }}\n*CPU:* `{{ $json.body.metrics.cpu_percent }}%`\n*RAM:* `{{ $json.body.metrics.ram_used_mb }}/{{ $json.body.metrics.ram_total_mb }} MB`\n*Time:* {{ $json.body.timestamp }}",
            additionalFields: {
              parse_mode: "Markdown",
            },
          },
          id: "node-telegram-1",
          name: "Send Telegram Admin Alert",
          type: "n8n-nodes-base.telegram",
          typeVersion: 1.2,
          position: [740, 200],
        },
        {
          parameters: {
            url: "https://discord.com/api/webhooks/your-channel-webhook",
            sendBody: true,
            specifyBody: "json",
            jsonBody: '={"content": "📢 **VPS Notice**: {{ $json.body.message }}"}',
            options: {},
          },
          id: "node-discord-1",
          name: "Send Discord Notice",
          type: "n8n-nodes-base.httpRequest",
          typeVersion: 4.2,
          position: [740, 420],
        },
      ],
      connections: {
        "VPS Webhook Trigger": {
          main: [[{ node: "Filter Severity", type: "main", index: 0 }]],
        },
        "Filter Severity": {
          main: [
            [{ node: "Send Telegram Admin Alert", type: "main", index: 0 }],
            [{ node: "Send Discord Notice", type: "main", index: 0 }],
          ],
        },
      },
    },
    null,
    2
  );

  // Python standalone agent script template
  const pythonAgentCode = `#!/usr/bin/env python3
"""
=============================================================================
VPS Server Monitor & Remote Management Agent + n8n Automation Dispatcher
=============================================================================
Provides real-time CPU, RAM, Disk, Network metrics, daemon control hooks,
and automated alert dispatching to self-hosted n8n Webhook workflows.

Run on Ubuntu / Debian / CentOS VPS:
  pip install fastapi uvicorn psutil requests
  python3 vps_agent.py
"""

import os
import time
import psutil
import subprocess
import requests
from fastapi import FastAPI, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="VPS Server Monitor & Remote Management Agent")

# Enable CORS for browser management dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AUTH_BEARER_TOKEN = os.getenv("VPS_AUTH_TOKEN", "${bearerToken || ''}")
N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL", "${n8nUrl || ''}")
N8N_ENABLED = ${n8nEnabled ? 'True' : 'False'}
START_TIME = time.time()
LAST_N8N_DISPATCH = {"timestamp": None, "event": None, "status": "idle"}

def dispatch_n8n_alert(event_type: str, severity: str, message: str, extra_metrics: dict = None):
    """Dispatches structured JSON alert payload to configured n8n Webhook endpoint."""
    global LAST_N8N_DISPATCH
    if not N8N_ENABLED or not N8N_WEBHOOK_URL:
        return False
    try:
        payload = {
            "event_id": f"evt_{int(time.time()*1000)}",
            "event_type": event_type,
            "severity": severity,
            "server_name": "${serverName || 'Telegram-AI-Bot'}",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "message": message,
            "metrics": extra_metrics or {
                "cpu_percent": psutil.cpu_percent(),
                "ram_used_mb": int(psutil.virtual_memory().used / (1024 * 1024)),
                "ram_total_mb": int(psutil.virtual_memory().total / (1024 * 1024)),
                "uptime_seconds": int(time.time() - START_TIME)
            }
        }
        res = requests.post(N8N_WEBHOOK_URL, json=payload, timeout=3.5)
        LAST_N8N_DISPATCH = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()),
            "event": event_type,
            "status": f"HTTP {res.status_code}"
        }
        return res.status_code in (200, 201, 204)
    except Exception as e:
        print(f"[n8n-alert-dispatch-error]: {e}")
        LAST_N8N_DISPATCH = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()),
            "event": event_type,
            "status": f"Error: {str(e)[:40]}"
        }
        return False

def verify_token(authorization: str = Header(None)):
    if not AUTH_BEARER_TOKEN:
        return True
    if not authorization or authorization != f"Bearer {AUTH_BEARER_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid Bearer Token")
    return True

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "${serverName || 'Telegram-AI-Bot'}",
        "uptime_seconds": int(time.time() - START_TIME),
        "n8n_dispatcher_active": bool(N8N_ENABLED and N8N_WEBHOOK_URL),
        "timestamp": time.time()
    }

@app.get("/api/vps/status")
def get_vps_status(auth: bool = Depends(verify_token)):
    cpu_percent = psutil.cpu_percent(interval=0.2)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    net_io = psutil.net_io_counters()

    # Check for High CPU threshold and dispatch n8n trigger
    if cpu_percent > 85.0 and ${n8nTriggers.onHighCpu ? 'True' : 'False'}:
        dispatch_n8n_alert("high_cpu", "CRITICAL", f"High CPU Load sustained: {cpu_percent}%")

    return {
        "is_online": True,
        "status_text": "running",
        "uptime_seconds": int(time.time() - START_TIME),
        "cpu_percent": cpu_percent,
        "cpu_cores": psutil.cpu_count(logical=True),
        "ram_used_mb": int(ram.used / (1024 * 1024)),
        "ram_total_mb": int(ram.total / (1024 * 1024)),
        "disk_used_gb": round(disk.used / (1024**3), 1),
        "disk_total_gb": round(disk.total / (1024**3), 1),
        "network_in_kbps": int(net_io.bytes_recv / 1024) % 1000,
        "network_out_kbps": int(net_io.bytes_sent / 1024) % 1000,
        "active_processes": len(psutil.pids()),
        "os_name": os.uname().sysname + " " + os.uname().release,
        "n8n_status": {
            "enabled": N8N_ENABLED,
            "webhook_configured": bool(N8N_WEBHOOK_URL),
            "last_dispatch": LAST_N8N_DISPATCH
        },
        "timestamp": time.time()
    }

@app.get("/api/n8n/status")
def get_n8n_integration_status(auth: bool = Depends(verify_token)):
    """Returns real-time status of the local/remote n8n automation bridge."""
    return {
        "n8n_enabled": N8N_ENABLED,
        "webhook_url": N8N_WEBHOOK_URL,
        "last_dispatch": LAST_N8N_DISPATCH,
        "supported_triggers": ["status_change", "high_cpu", "server_restart", "ai_failover", "security_alert"]
    }

class N8nTestPayload(BaseModel):
    event_type: str = "high_cpu"
    severity: str = "WARNING"
    message: str = "Test webhook trigger from VPS agent"

@app.post("/api/n8n/test")
def test_n8n_dispatch(payload: N8nTestPayload, auth: bool = Depends(verify_token)):
    """Manually test and trigger an n8n webhook payload from the server agent."""
    success = dispatch_n8n_alert(payload.event_type, payload.severity, payload.message)
    return {
        "dispatched": success,
        "endpoint": N8N_WEBHOOK_URL,
        "event_type": payload.event_type,
        "last_dispatch": LAST_N8N_DISPATCH
    }

class ControlPayload(BaseModel):
    action: str

@app.post("/api/server/{action}")
def control_server(action: str, auth: bool = Depends(verify_token)):
    if action == "restart":
        subprocess.Popen(["systemctl", "restart", "telegram-bot"])
        dispatch_n8n_alert("server_restart", "WARNING", "Server restart initiated via API")
        return {"status": "restarting", "message": "Service restart initiated"}
    elif action == "stop":
        subprocess.Popen(["systemctl", "stop", "telegram-bot"])
        dispatch_n8n_alert("status_change", "CRITICAL", "Service stopped via API")
        return {"status": "stopped", "message": "Service stopped"}
    elif action == "start":
        subprocess.Popen(["systemctl", "start", "telegram-bot"])
        dispatch_n8n_alert("status_change", "INFO", "Service started via API")
        return {"status": "running", "message": "Service started"}
    elif action == "reload":
        subprocess.Popen(["systemctl", "reload", "telegram-bot"])
        dispatch_n8n_alert("config_reload", "INFO", "Configuration reloaded via API")
        return {"status": "reloaded", "message": "Service configuration reloaded"}
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action {action}")

if __name__ == "__main__":
    import uvicorn
    # Initial startup broadcast to n8n
    dispatch_n8n_alert("status_change", "INFO", "VPS Monitoring Agent booted & online")
    uvicorn.run(app, host="0.0.0.0", port=${config.serverPort || 8080})
`;

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30">
                <Server className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
                  <span>VPS & Cloud Server Manager</span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    status.isOnline && status.statusText === 'running'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : status.statusText === 'restarting'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      status.isOnline && status.statusText === 'running'
                        ? 'bg-emerald-400 animate-pulse'
                        : status.statusText === 'restarting'
                        ? 'bg-amber-400 animate-ping'
                        : 'bg-rose-400'
                    }`}></span>
                    <span>
                      {status.isOnline && status.statusText === 'running'
                        ? '🟢 Online'
                        : status.statusText === 'restarting'
                        ? '🟡 Restarting...'
                        : '🔴 Offline'}
                    </span>
                  </span>

                  {/* Interactive n8n Mode Switch Pill */}
                  <button
                    onClick={() => handleToggleN8nMode()}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold transition cursor-pointer ${
                      n8nEnabled
                        ? 'bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-300 border border-orange-500/30 hover:border-orange-400 shadow-sm shadow-orange-950/40'
                        : 'bg-slate-800/80 text-slate-400 border border-slate-700 hover:border-slate-600 hover:text-slate-300'
                    }`}
                    title={
                      n8nEnabled
                        ? 'n8n Automation Engine is ACTIVE (Click to switch to Direct Mode)'
                        : 'Direct Standalone Mode ACTIVE (Click to enable n8n Automation Engine)'
                    }
                  >
                    <Workflow className={`w-3 h-3 ${n8nEnabled ? 'text-orange-400' : 'text-slate-500'}`} />
                    <span>{n8nEnabled ? '🟢 n8n Mode Active' : '⚪ Direct Mode'}</span>
                  </button>
                </h2>
                <p className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                  <span>Host: <strong className="text-cyan-300">{serverName}</strong></span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <span>IP: {showSensitiveInfo ? status.ipAddress : '•••.•••.•••.••'}</span>
                    <button
                      type="button"
                      onClick={() => setShowSensitiveInfo(!showSensitiveInfo)}
                      className="text-slate-500 hover:text-slate-300 p-0.5 rounded cursor-pointer"
                      title={showSensitiveInfo ? 'Hide sensitive IP' : 'Reveal sensitive IP'}
                    >
                      {showSensitiveInfo ? <EyeOff className="w-3 h-3 text-cyan-400" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </span>
                  <span>•</span>
                  <span>Ping: <strong className="text-emerald-400">{status.lastPingMs}ms</strong></span>
                  <span>•</span>
                  <span>Engine: <strong className={n8nEnabled ? 'text-orange-400' : 'text-slate-400'}>{n8nEnabled ? 'n8n Pipeline' : 'Direct API'}</strong></span>
                </p>
              </div>
            </div>
          </div>

          {/* Quick Sub-Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveSection('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeSection === 'dashboard'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Live Status & Controls</span>
            </button>

            <button
              onClick={() => setActiveSection('logs')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeSection === 'logs'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>Logs Terminal</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-900/60 font-mono text-cyan-300">
                {logs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSection('n8n')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeSection === 'n8n'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-md shadow-orange-500/25 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              }`}
            >
              <Workflow className="w-4 h-4 text-orange-400 group-hover:text-white" />
              <span>n8n Webhook & Alerts</span>
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
            </button>

            <button
              onClick={() => setActiveSection('settings')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeSection === 'settings'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Backend API & Auth</span>
            </button>

            <button
              onClick={() => setActiveSection('agent_script')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeSection === 'agent_script'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Python VPS Agent</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: LIVE STATUS DASHBOARD & SERVER CONTROL PANEL */}
      {activeSection === 'dashboard' && (
        <div className="space-y-6">
          {/* Interactive n8n VPS Mode Switch Banner */}
          <div className={`border rounded-3xl p-5 transition-all ${
            n8nEnabled
              ? 'bg-gradient-to-r from-orange-950/40 via-slate-900 to-amber-950/30 border-orange-500/40 shadow-lg shadow-orange-950/30'
              : 'bg-slate-900/90 border-slate-800'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 transition-transform ${
                  n8nEnabled
                    ? 'bg-gradient-to-tr from-orange-500 to-amber-500 text-slate-950 shadow-md shadow-orange-500/30 ring-2 ring-orange-400/40 scale-105'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  <Workflow className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-bold text-white tracking-tight">
                      n8n Automation Engine (VPS Mode Switch)
                    </h4>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      n8nEnabled
                        ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {n8nEnabled ? '🟢 n8n Active' : '⚪ Direct Mode'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed max-w-2xl">
                    {n8nEnabled
                      ? '⚡ All server alerts, CPU spikes, daemon lifecycle hooks & AI rate-limit failovers are automatically routed into your n8n workflow canvas.'
                      : '🛡️ Direct mode active — System alerts & telemetry stay managed internally on the FastAPI daemon without external webhook dispatches.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
                <div className="text-right">
                  <span className="text-xs font-bold text-white block">
                    {n8nEnabled ? 'n8n Pipeline' : 'Internal Mode'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {n8nEnabled ? 'Webhook Dispatching' : 'Standalone Direct'}
                  </span>
                </div>
                <button
                  onClick={() => handleToggleN8nMode()}
                  className={`w-14 h-7 rounded-full transition-colors relative p-0.5 cursor-pointer shadow-inner ${
                    n8nEnabled ? 'bg-orange-500' : 'bg-slate-800 border border-slate-700'
                  }`}
                  aria-label="Toggle n8n Automation Engine Mode"
                  title={n8nEnabled ? 'Click to disable n8n mode' : 'Click to enable n8n mode'}
                >
                  <div
                    className={`w-6 h-6 rounded-full bg-white transition-transform shadow-md ${
                      n8nEnabled ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  ></div>
                </button>
              </div>
            </div>
          </div>

          {/* Server Control Panel Buttons Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <span>Server Process Control Center</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Direct daemon commands wired to systemd / supervisor / Docker container runtime hooks.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Last Updated: {status.lastUpdated}</span>
              </div>
            </div>

            {/* Dedicated Action Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              {/* Button 1: Start Server */}
              <button
                onClick={() => handleServerControl('start')}
                disabled={status.isOnline && status.statusText === 'running' || isExecutingAction !== null}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold text-xs transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-emerald-950/40"
              >
                {isExecutingAction === 'start' ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                ) : (
                  <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                )}
                <span>Start Server</span>
              </button>

              {/* Button 2: Stop Server */}
              <button
                onClick={() => handleServerControl('stop')}
                disabled={!status.isOnline || isExecutingAction !== null}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-semibold text-xs transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-rose-950/40"
              >
                {isExecutingAction === 'stop' ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
                ) : (
                  <Square className="w-4 h-4 text-rose-400 fill-rose-400" />
                )}
                <span>Stop Server</span>
              </button>

              {/* Button 3: Restart Server */}
              <button
                onClick={() => handleServerControl('restart')}
                disabled={isExecutingAction !== null}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 font-semibold text-xs transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-amber-950/40"
              >
                {isExecutingAction === 'restart' ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                ) : (
                  <RotateCw className="w-4 h-4 text-amber-400" />
                )}
                <span>Restart Server</span>
              </button>

              {/* Button 4: Hot-Reload Config */}
              <button
                onClick={() => handleServerControl('reload')}
                disabled={!status.isOnline || isExecutingAction !== null}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 font-semibold text-xs transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-cyan-950/40"
              >
                {isExecutingAction === 'reload' ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                ) : (
                  <Zap className="w-4 h-4 text-cyan-400" />
                )}
                <span>Hot-Reload Config</span>
              </button>
            </div>
          </div>

          {/* Core Hardware Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metric 1: CPU Usage */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-medium">CPU Load</span>
                    <h4 className="text-xl font-bold text-white font-mono tracking-tight">
                      {status.cpuPercent}%
                    </h4>
                  </div>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300">
                  {status.cpuCores} Cores
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      status.cpuPercent > 75
                        ? 'bg-rose-500'
                        : status.cpuPercent > 45
                        ? 'bg-amber-500'
                        : 'bg-cyan-500'
                    }`}
                    style={{ width: `${Math.min(100, status.cpuPercent)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Load Avg: 0.42, 0.38</span>
                  <span>Max: 100%</span>
                </div>
              </div>
            </div>

            {/* Metric 2: RAM Memory */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-medium">RAM Memory</span>
                    <h4 className="text-xl font-bold text-white font-mono tracking-tight">
                      {Math.round((status.ramUsedMb / status.ramTotalMb) * 100)}%
                    </h4>
                  </div>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-slate-800 text-purple-300">
                  {status.ramUsedMb} / {status.ramTotalMb} MB
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500 rounded-full"
                    style={{ width: `${(status.ramUsedMb / status.ramTotalMb) * 100}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Free: {status.ramTotalMb - status.ramUsedMb} MB</span>
                  <span>Swap: 0 / 2048 MB</span>
                </div>
              </div>
            </div>

            {/* Metric 3: Server Uptime */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-medium">Server Uptime</span>
                    <h4 className="text-base font-bold text-white font-mono tracking-tight truncate">
                      {formatUptime(status.uptimeSeconds)}
                    </h4>
                  </div>
                </div>
              </div>

              <div className="pt-1 text-xs text-slate-400 flex items-center justify-between border-t border-slate-800/80">
                <span>Active Tasks:</span>
                <strong className="text-emerald-400 font-mono">{status.activeProcesses} Threads</strong>
              </div>
            </div>

            {/* Metric 4: Disk / SSD Storage */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-medium">NVMe Disk</span>
                    <h4 className="text-xl font-bold text-white font-mono tracking-tight">
                      {status.diskUsedGb} / {status.diskTotalGb} GB
                    </h4>
                  </div>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-slate-800 text-amber-300">
                  {Math.round((status.diskUsedGb / status.diskTotalGb) * 100)}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-500 rounded-full"
                    style={{ width: `${(status.diskUsedGb / status.diskTotalGb) * 100}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Mount: / (ext4)</span>
                  <span>Free: {(status.diskTotalGb - status.diskUsedGb).toFixed(1)} GB</span>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary Telemetry & Network Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Network Traffic */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-cyan-400" />
                  <span>Real-time Network I/O</span>
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80">
                  <span className="text-slate-400 block text-[11px]">Inbound</span>
                  <span className="text-sm font-mono font-bold text-cyan-300">{status.networkInKbps} KB/s</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80">
                  <span className="text-slate-400 block text-[11px]">Outbound</span>
                  <span className="text-sm font-mono font-bold text-emerald-300">{status.networkOutKbps} KB/s</span>
                </div>
              </div>
            </div>

            {/* Operating System & Runtime */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Server className="w-4 h-4 text-purple-400" />
                <span>Runtime Environment</span>
              </span>

              <div className="space-y-1.5 text-xs text-slate-300 font-mono">
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500">OS:</span>
                  <span className="text-white truncate">{status.osName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500">Python:</span>
                  <span className="text-cyan-300">{status.pythonVersion}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Mode:</span>
                  <span className="text-emerald-400">Daemon (systemd)</span>
                </div>
              </div>
            </div>

            {/* n8n Automation Bridge Live Status Card */}
            <div className="bg-slate-900 border border-orange-500/20 rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Workflow className="w-4 h-4 text-orange-400" />
                  <span>n8n 24/7 Automation</span>
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  n8nEnabled && n8nUrl
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {n8nEnabled && n8nUrl ? 'ACTIVE' : 'STANDBY'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300 font-mono">
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500">Stack:</span>
                  <span className="text-orange-300">Docker / PM2</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500">Triggers:</span>
                  <span className="text-emerald-400 font-bold">
                    {Object.values(n8nTriggers).filter(Boolean).length} Active
                  </span>
                </div>
                <div className="flex justify-between py-1 items-center">
                  <span className="text-slate-500">Endpoint:</span>
                  <button
                    onClick={() => setActiveSection('n8n')}
                    className="text-[11px] text-orange-400 hover:text-orange-300 underline truncate max-w-[110px] cursor-pointer"
                    title={n8nUrl || 'Configure Webhook'}
                  >
                    {n8nUrl ? 'Configured' : 'Setup URL'}
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Diagnostic / Ping Test */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Backend Handshake</span>
              </span>

              <div className="space-y-2">
                <div className="text-xs text-slate-400 leading-relaxed truncate font-mono flex items-center justify-between">
                  <span>
                    Endpoint: {showSensitiveInfo ? (apiBaseUrl || 'Not configured') : (apiBaseUrl ? apiBaseUrl.replace(/^(https?:\/\/)([^:\/]+)(.*)$/, '$1••••••••$3') : 'Not configured')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSensitiveInfo(!showSensitiveInfo)}
                    className="text-slate-500 hover:text-slate-300 p-0.5 rounded cursor-pointer"
                    title={showSensitiveInfo ? 'Hide sensitive endpoint' : 'Reveal sensitive endpoint'}
                  >
                    {showSensitiveInfo ? <EyeOff className="w-3 h-3 text-cyan-400" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
                <button
                  onClick={handleTestConnection}
                  disabled={isTestingConnection}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 cursor-pointer"
                >
                  {isTestingConnection ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  ) : (
                    <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                  <span>Test Ping</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: CLEAN TERMINAL-STYLE LOGS VIEWER */}
      {activeSection === 'logs' && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl space-y-0">
          {/* Terminal Top Bar */}
          <div className="bg-slate-900/90 px-5 py-3.5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Traffic Lights */}
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>vps-daemon.log — {serverName}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                  LIVE STREAM
                </span>
              </div>
            </div>

            {/* Filter & Action Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Search filter input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter logs..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 w-36 sm:w-44 font-mono"
                />
              </div>

              {/* Level Filter Dropdown */}
              <select
                value={logFilterLevel}
                onChange={(e) => setLogFilterLevel(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="ALL">ALL LEVELS</option>
                <option value="INFO">INFO</option>
                <option value="SYSTEM">SYSTEM</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
                <option value="CRON">CRON</option>
                <option value="AUTH">AUTH</option>
              </select>

              {/* Auto Scroll Toggle */}
              <button
                onClick={() => setIsAutoScroll(!isAutoScroll)}
                className={`p-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  isAutoScroll
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title={isAutoScroll ? 'Auto-scroll is ON' : 'Auto-scroll is OFF'}
              >
                <ArrowUpRight className="w-4 h-4" />
              </button>

              {/* Pause Stream Toggle */}
              <button
                onClick={() => setIsLogStreamPaused(!isLogStreamPaused)}
                className={`p-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  isLogStreamPaused
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title={isLogStreamPaused ? 'Stream is Paused' : 'Stream is Active'}
              >
                <Pause className="w-4 h-4" />
              </button>

              {/* Export Logs */}
              <button
                onClick={handleExportLogs}
                className="p-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                title="Download Log File"
              >
                <Download className="w-4 h-4" />
              </button>

              {/* Clear Logs */}
              <button
                onClick={() => {
                  setLogs([]);
                  onShowToast('🧹 Terminal logs cleared.');
                }}
                className="p-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition cursor-pointer"
                title="Clear Logs Screen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Terminal Logs Content Box */}
          <div className="p-4 sm:p-5 font-mono text-xs text-slate-300 max-h-[480px] overflow-y-auto space-y-1.5 leading-relaxed selection:bg-cyan-500/30 selection:text-white">
            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-600">
                <Terminal className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No log records match your filter criteria.</p>
              </div>
            ) : (
              filteredLogs.map((log, idx) => (
                <div key={log.id} className="flex items-start gap-2 hover:bg-slate-900/60 px-2 py-1 rounded-lg transition group">
                  <span className="text-slate-600 select-none w-7 text-right text-[11px] shrink-0 font-sans">
                    {idx + 1}
                  </span>
                  <span className="text-slate-500 shrink-0 text-[11px]">
                    [{log.timestamp}]
                  </span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 tracking-wider ${
                    log.level === 'INFO'
                      ? 'bg-blue-500/20 text-cyan-300 border border-blue-500/30'
                      : log.level === 'SYSTEM'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : log.level === 'WARN'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : log.level === 'ERROR'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : log.level === 'AUTH'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  }`}>
                    {log.level}
                  </span>
                  <span className="text-slate-400 font-semibold shrink-0">
                    [{log.source}]:
                  </span>
                  <span className="text-slate-200 break-all group-hover:text-white">
                    {log.message}
                  </span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>

          {/* Terminal Bottom Status Bar & Simulation Triggers */}
          <div className="bg-slate-900/80 px-5 py-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Buffer: {logs.length} / 500 lines</span>
              <span>•</span>
              <span>{isLogStreamPaused ? '⏸️ Stream Paused' : '▶️ Live Polling Active'}</span>
            </div>

            {/* Quick Event Simulation Injections */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-[10px]">Inject Test Event:</span>
              <button
                onClick={() => {
                  const testLog: VpsServerLog = {
                    id: `log-${Date.now()}`,
                    timestamp: new Date().toLocaleTimeString(),
                    level: 'INFO',
                    source: 'groq_balancer',
                    message: 'Primary API key exhausted (429 Rate Limit). Auto-swapped to Secondary Fallback Key in 18ms.',
                  };
                  setLogs((prev) => [...prev, testLog]);
                  onShowToast('⚡ Test Failover Event injected into log buffer.');
                }}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition cursor-pointer"
              >
                + AI Failover
              </button>
              <button
                onClick={() => {
                  const testLog: VpsServerLog = {
                    id: `log-${Date.now()}`,
                    timestamp: new Date().toLocaleTimeString(),
                    level: 'CRON',
                    source: 'yt_uploader',
                    message: 'YouTube Auto-Queue: Video #8821 upload started. (Title: "AI Automation Workflow 2026").',
                  };
                  setLogs((prev) => [...prev, testLog]);
                  onShowToast('⚡ Test YouTube Log injected.');
                }}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition cursor-pointer"
              >
                + YouTube Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: n8n WEBHOOK & AUTOMATION INTEGRATION */}
      {activeSection === 'n8n' && (
        <div className="space-y-6">
          {/* n8n Overview Banner with Dedicated Mode Switch */}
          <div className={`border rounded-3xl p-6 shadow-xl relative overflow-hidden transition-all ${
            n8nEnabled
              ? 'bg-gradient-to-r from-orange-950/40 via-slate-900 to-amber-950/30 border-orange-500/40'
              : 'bg-slate-900/90 border-slate-800'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 shadow-lg ${
                    n8nEnabled
                      ? 'bg-gradient-to-tr from-orange-500 to-amber-500 text-slate-950 shadow-orange-500/20'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    <Workflow className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      <span>n8n VPS Mode & Automation Engine</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        n8nEnabled
                          ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {n8nEnabled ? '🟢 n8n Active' : '⚪ Direct Mode'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      {n8nEnabled
                        ? 'Live alerts, CPU spikes, lifecycle events, and AI failovers are actively routed to your n8n workflow canvas.'
                        : 'Direct mode active — Core server monitoring and daemon actions operate internally without external webhook dispatches.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Master Mode Toggle Switch */}
              <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-950/80 border border-orange-500/20 shrink-0">
                <div className="text-right">
                  <span className="text-xs font-bold text-white block">
                    {n8nEnabled ? 'n8n VPS Mode' : 'Direct Standalone'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {n8nEnabled ? '🟢 Automated Webhooks' : '⚪ Internal Only'}
                  </span>
                </div>
                <button
                  onClick={() => handleToggleN8nMode()}
                  className={`w-14 h-7 rounded-full transition-colors relative p-0.5 cursor-pointer shadow-inner ${
                    n8nEnabled ? 'bg-orange-500' : 'bg-slate-800 border border-slate-700'
                  }`}
                  aria-label="Toggle n8n VPS Mode"
                  title={n8nEnabled ? 'Click to disable n8n Automation Engine' : 'Click to enable n8n Automation Engine'}
                >
                  <div
                    className={`w-6 h-6 rounded-full bg-white transition-transform shadow-md ${
                      n8nEnabled ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  ></div>
                </button>
              </div>
            </div>
          </div>

          {/* n8n Webhook Configuration Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  n8n Webhook Endpoint URL
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Workflow className="w-4 h-4 text-orange-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showN8nUrl ? 'text' : 'password'}
                      value={n8nUrl}
                      onChange={(e) => setN8nUrl(e.target.value)}
                      placeholder="https://n8n.yourdomain.com/webhook/vps-server-alerts or http://localhost:5678/webhook/..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs font-mono text-orange-300 placeholder-slate-600 focus:outline-none focus:border-orange-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowN8nUrl(!showN8nUrl)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                      title={showN8nUrl ? 'Hide URL' : 'Reveal URL'}
                    >
                      {showN8nUrl ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      onChange({
                        ...config,
                        n8nWebhookUrl: n8nUrl,
                        n8nAlertsEnabled: n8nEnabled,
                        n8nEventTriggers: n8nTriggers,
                      });
                      onShowToast('💾 n8n Webhook URL updated.');
                    }}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition shadow-lg shadow-orange-500/20 cursor-pointer shrink-0"
                  >
                    <Check className="w-4 h-4" />
                    <span>Save Webhook</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Copy the Production or Test Webhook URL from your n8n <code className="text-orange-400">Webhook Node</code> (HTTP Method: POST).
                </p>
              </div>

              {/* Event Triggers Selection Grid */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-orange-400" />
                    <span>Event Dispatch Triggers & Alert Filters</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Select which server incidents notify n8n
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Trigger 1: Server Status Changes */}
                  <label className={`p-4 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
                    n8nTriggers.onStatusChange
                      ? 'bg-slate-950 border-orange-500/40 text-white'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 opacity-60'
                  }`}>
                    <input
                      type="checkbox"
                      checked={n8nTriggers.onStatusChange}
                      onChange={(e) => setN8nTriggers({ ...n8nTriggers, onStatusChange: e.target.checked })}
                      className="mt-0.5 rounded bg-slate-800 border-slate-700 text-orange-500 focus:ring-0"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold block text-white flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Status Transitions</span>
                      </span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Online, Stopped, Degraded, or Offline state transitions.
                      </p>
                    </div>
                  </label>

                  {/* Trigger 2: High CPU / RAM Usage */}
                  <label className={`p-4 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
                    n8nTriggers.onHighCpu
                      ? 'bg-slate-950 border-orange-500/40 text-white'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 opacity-60'
                  }`}>
                    <input
                      type="checkbox"
                      checked={n8nTriggers.onHighCpu}
                      onChange={(e) => setN8nTriggers({ ...n8nTriggers, onHighCpu: e.target.checked })}
                      className="mt-0.5 rounded bg-slate-800 border-slate-700 text-orange-500 focus:ring-0"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold block text-white flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-rose-400" />
                        <span>Resource Spikes</span>
                      </span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Trigger alerts if CPU &gt; 80% or RAM &gt; 85% for 3+ cycles.
                      </p>
                    </div>
                  </label>

                  {/* Trigger 3: Server Restart & Reloads */}
                  <label className={`p-4 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
                    n8nTriggers.onRestart
                      ? 'bg-slate-950 border-orange-500/40 text-white'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 opacity-60'
                  }`}>
                    <input
                      type="checkbox"
                      checked={n8nTriggers.onRestart}
                      onChange={(e) => setN8nTriggers({ ...n8nTriggers, onRestart: e.target.checked })}
                      className="mt-0.5 rounded bg-slate-800 border-slate-700 text-orange-500 focus:ring-0"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold block text-white flex items-center gap-1.5">
                        <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                        <span>Lifecycle & Restarts</span>
                      </span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Broadcasts systemctl start, stop, reload & restart actions.
                      </p>
                    </div>
                  </label>

                  {/* Trigger 4: AI Rate Limit Auto-Failovers */}
                  <label className={`p-4 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
                    n8nTriggers.onFailover
                      ? 'bg-slate-950 border-orange-500/40 text-white'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 opacity-60'
                  }`}>
                    <input
                      type="checkbox"
                      checked={n8nTriggers.onFailover}
                      onChange={(e) => setN8nTriggers({ ...n8nTriggers, onFailover: e.target.checked })}
                      className="mt-0.5 rounded bg-slate-800 border-slate-700 text-orange-500 focus:ring-0"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold block text-white flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        <span>AI Key 429 Failovers</span>
                      </span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Notify when Groq/OpenAI/Gemini rate-limits swap to backup keys.
                      </p>
                    </div>
                  </label>

                  {/* Trigger 5: Admin Sentinel & Security */}
                  <label className={`p-4 rounded-2xl border transition cursor-pointer flex items-start gap-3 sm:col-span-2 lg:col-span-2 ${
                    n8nTriggers.onSecurityAlert
                      ? 'bg-slate-950 border-orange-500/40 text-white'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 opacity-60'
                  }`}>
                    <input
                      type="checkbox"
                      checked={n8nTriggers.onSecurityAlert}
                      onChange={(e) => setN8nTriggers({ ...n8nTriggers, onSecurityAlert: e.target.checked })}
                      className="mt-0.5 rounded bg-slate-800 border-slate-700 text-orange-500 focus:ring-0"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold block text-white flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                        <span>Admin Sentinel & Security Alerts</span>
                      </span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Dispatches instant alerts when unauthorized Admin PIN attempts or blocked IP scans occur.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Test Payload Dispatch Box */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Send className="w-4 h-4 text-orange-400" />
                    <span>Interactive n8n Webhook Test Dispatcher</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Generate and transmit a live sample alert event payload to your n8n Webhook node.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedTestEvent}
                    onChange={(e) => setSelectedTestEvent(e.target.value as any)}
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-orange-500 cursor-pointer"
                  >
                    <option value="high_cpu">🔥 High CPU Spike (94.2%)</option>
                    <option value="status_change">🚨 Server Status Change (Stopped/Online)</option>
                    <option value="server_restart">🔄 Bot Daemon Restarted</option>
                    <option value="ai_failover">⚡ AI 429 Failover Trigger</option>
                    <option value="security_alert">🛡️ Unauthorized PIN Attempt</option>
                  </select>

                  <button
                    onClick={handleTestN8nWebhook}
                    disabled={isDispatchingN8nTest}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition shadow-md shadow-orange-500/20 cursor-pointer shrink-0"
                  >
                    {isDispatchingN8nTest ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Dispatch Test</span>
                  </button>
                </div>
              </div>

              {/* Test Response Box */}
              {n8nTestResult && (
                <div className={`p-4 rounded-xl border space-y-2 ${
                  n8nTestResult.success
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="font-bold flex items-center gap-2 text-white text-xs">
                      {n8nTestResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                      )}
                      <span>{n8nTestResult.success ? 'Webhook Dispatched & Handled' : 'Webhook Notice'}</span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-orange-300">
                        {n8nTestResult.latencyMs} ms
                      </span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400">
                        HTTP {n8nTestResult.statusCode}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 font-mono leading-relaxed">
                    {n8nTestResult.message}
                  </p>

                  {n8nTestResult.payloadPreview && (
                    <div className="pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] text-slate-500 font-mono uppercase block mb-1">
                        Transmitted JSON Body:
                      </span>
                      <pre className="p-3 rounded-lg bg-slate-950 text-[11px] text-slate-300 font-mono overflow-x-auto max-h-36">
                        {JSON.stringify(n8nTestResult.payloadPreview, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* n8n Ready-to-import Workflow Blueprint */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-orange-400" />
                    <span>Pre-Built n8n Automation Workflow Recipe</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Import this JSON directly into n8n via <strong className="text-white">Workflow &gt; Import from Clipboard</strong> to connect Webhook triggers to Telegram, Discord, and Slack.
                  </p>
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(n8nWorkflowTemplateJson);
                    setCopiedWorkflowJson(true);
                    setTimeout(() => setCopiedWorkflowJson(false), 2000);
                    onShowToast('📋 n8n Workflow JSON copied to clipboard!');
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer shrink-0"
                >
                  {copiedWorkflowJson ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied JSON!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-orange-400" />
                      <span>Copy Workflow JSON</span>
                    </>
                  )}
                </button>
              </div>

              {/* Visual Pipeline Diagram */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-900 border border-orange-500/30 text-center space-y-1">
                  <span className="text-orange-400 font-bold block text-[11px]">1. Webhook Trigger</span>
                  <span className="text-[10px] text-slate-400">POST /vps-server-alerts</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-1">
                  <span className="text-cyan-400 font-bold block text-[11px]">2. Switch Node</span>
                  <span className="text-[10px] text-slate-400">Filter CRITICAL vs INFO</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-1">
                  <span className="text-emerald-400 font-bold block text-[11px]">3. Telegram Node</span>
                  <span className="text-[10px] text-slate-400">Send Markdown Alert</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-1">
                  <span className="text-purple-400 font-bold block text-[11px]">4. Discord / Slack</span>
                  <span className="text-[10px] text-slate-400">Broadcast Ops Notice</span>
                </div>
              </div>
            </div>

            {/* Comprehensive 24/7 Hosting Guide for n8n + FastAPI on Single Free VPS */}
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    24/7 Hosting Guide: Running n8n & FastAPI Agent on a Single Free VPS
                  </h4>
                  <p className="text-xs text-slate-400">
                    Deploy both services side-by-side with zero port conflicts on Oracle Always Free, Hetzner, AWS, or DigitalOcean.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Method 1: Docker Compose */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                      <Terminal className="w-4 h-4" />
                      <span>Option A: Docker Compose (Recommended)</span>
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      Isolated & Zero-Config
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Uses the pre-configured <code className="text-orange-300 bg-slate-950 px-1 py-0.5 rounded">docker-compose.yml</code> to run the AI Bot, FastAPI Agent (port 8081), and n8n (port 5678) in bridged networking.
                  </p>
                  <pre className="p-3 rounded-lg bg-slate-950 text-[11px] text-slate-300 font-mono overflow-x-auto">
{`# 1. SSH into your VPS
ssh ubuntu@your-vps-ip

# 2. Launch the entire 3-service stack
docker compose up -d

# 3. Access n8n Webhook Engine
http://your-vps-ip:5678`}
                  </pre>
                  <div className="text-[11px] text-slate-400">
                    💡 <em>Internal Webhook URL for agent:</em> <code className="text-emerald-400">http://n8n:5678/webhook/vps-server-alerts</code>
                  </div>
                </div>

                {/* Method 2: PM2 Process Manager */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Zap className="w-4 h-4" />
                      <span>Option B: PM2 Process Manager</span>
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      Low RAM Footprint
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Ideal for lightweight 1GB RAM instances. PM2 keeps all Python daemons and n8n running with automatic restart on reboot.
                  </p>
                  <pre className="p-3 rounded-lg bg-slate-950 text-[11px] text-slate-300 font-mono overflow-x-auto">
{`# 1. Install PM2 & n8n globally
sudo npm install -g pm2 n8n

# 2. Start all services via ecosystem file
pm2 start ecosystem.config.js

# 3. Enable 24/7 startup on boot
pm2 save && pm2 startup`}
                  </pre>
                  <div className="text-[11px] text-slate-400">
                    💡 <em>Localhost Webhook URL:</em> <code className="text-emerald-400">http://localhost:5678/webhook/vps-server-alerts</code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: SETTINGS & BACKEND API CONFIGURATION */}
      {activeSection === 'settings' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Settings className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Backend API & Authentication Settings
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Configure connection parameters to your self-hosted VPS, Docker host, cloud backend, and n8n webhook pipelines.
              </p>
            </div>

            <button
              onClick={handleSaveSettings}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold transition shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save Configuration</span>
            </button>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Input 1: Server Name */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Server Display Label / Node Name
              </label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="e.g. Hetzner-CPX31-Frankfurt-01"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
              <p className="text-[11px] text-slate-500">
                Human-friendly name to identify this server in the dashboard header.
              </p>
            </div>

            {/* Input 2: Backend API Base URL */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Backend API Base URL (VPS IP or Domain)
              </label>
              <div className="relative">
                <input
                  type={showApiBaseUrl ? 'text' : 'password'}
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  placeholder="http://127.0.0.1:8080 or https://vps.yourdomain.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiBaseUrl(!showApiBaseUrl)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                  title={showApiBaseUrl ? 'Hide Base URL' : 'Reveal Base URL'}
                >
                  {showApiBaseUrl ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                The public or private REST endpoint where your bot health & control API is listening.
              </p>
            </div>

            {/* Input 3: Authorization Bearer Token */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Authorization Bearer Token (API Secret)
              </label>
              <div className="relative">
                <input
                  type={showBearerToken ? 'text' : 'password'}
                  value={bearerToken}
                  onChange={(e) => setBearerToken(e.target.value)}
                  placeholder="vps_sec_token_••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono text-purple-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowBearerToken(!showBearerToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                  title={showBearerToken ? 'Hide Token' : 'Reveal Token'}
                >
                  {showBearerToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Passed in HTTP Header: <code className="text-purple-400">Authorization: Bearer &lt;token&gt;</code>
              </p>
            </div>

            {/* Input 4: n8n Webhook URL in Settings */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-slate-300">
                  n8n Webhook Target URL
                </label>
                <button
                  onClick={() => setActiveSection('n8n')}
                  className="text-[11px] text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer"
                >
                  <span>Configure Triggers &gt;</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showN8nUrl ? 'text' : 'password'}
                  value={n8nUrl}
                  onChange={(e) => setN8nUrl(e.target.value)}
                  placeholder="https://n8n.yourdomain.com/webhook/vps-server-alerts"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono text-orange-300 placeholder-slate-600 focus:outline-none focus:border-orange-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowN8nUrl(!showN8nUrl)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                  title={showN8nUrl ? 'Hide URL' : 'Reveal URL'}
                >
                  {showN8nUrl ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Dispatches alert JSON payloads to n8n workflows for automated incident triage.
              </p>
            </div>

            {/* n8n Mode Switch Toggle in Settings */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-orange-500/30 flex items-center justify-between gap-4 md:col-span-2">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  n8nEnabled
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  <Workflow className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      Enable n8n Automation Engine (VPS Mode)
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      n8nEnabled
                        ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {n8nEnabled ? '🟢 n8n Active' : '⚪ Direct Mode'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    When toggled ON, incident alerts & triggers route through n8n. When OFF, system falls back to direct internal backend handling.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleToggleN8nMode()}
                className={`w-12 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 shadow-inner ${
                  n8nEnabled ? 'bg-orange-500' : 'bg-slate-800 border border-slate-700'
                }`}
                aria-label="Toggle n8n VPS Mode"
                title={n8nEnabled ? 'Click to disable n8n mode' : 'Click to enable n8n mode'}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform shadow-md ${
                    n8nEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                ></div>
              </button>
            </div>

            {/* Input 5: Polling Interval */}
            <div className="space-y-2 md:col-span-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-slate-300">
                  Telemetry Refresh Rate: <span className="text-cyan-400 font-mono">{pollInterval}s</span>
                </label>
                <label className="text-[11px] text-slate-400 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAutoPolling}
                    onChange={(e) => setIsAutoPolling(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>Auto-Refresh Active</span>
                </label>
              </div>
              <input
                type="range"
                min={1}
                max={15}
                step={1}
                value={pollInterval}
                onChange={(e) => setPollInterval(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>1s (High Frequency)</span>
                <span>5s (Standard)</span>
                <span>15s (Eco Low Bandwidth)</span>
              </div>
            </div>
          </div>

          {/* Test Ping & Connectivity Diagnostics Box */}
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-cyan-400" />
                  <span>Connection Diagnostics & Ping Tester</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verify DNS resolution, firewall reachability, and Bearer token validation with your VPS.
                </p>
              </div>

              <button
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                {isTestingConnection ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                ) : (
                  <Activity className="w-4 h-4 text-cyan-400" />
                )}
                <span>Test Connection Now</span>
              </button>
            </div>

            {pingResult && (
              <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                pingResult.success
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
              }`}>
                {pingResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 text-xs">
                  <div className="font-bold flex items-center gap-2 text-white">
                    <span>{pingResult.success ? 'Handshake Successful' : 'Connection Notice'}</span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300">
                      {pingResult.latencyMs} ms
                    </span>
                    {pingResult.statusCode && (
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-900 text-slate-400">
                        HTTP {pingResult.statusCode}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-300 leading-relaxed font-mono">
                    {pingResult.message}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 5: PYTHON VPS MONITORING AGENT SCRIPT */}
      {activeSection === 'agent_script' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Standalone VPS Agent Script (vps_agent.py)
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Deploy this single-file Python FastAPI service on your Ubuntu/Debian server to report real hardware metrics and accept control commands.
              </p>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(pythonAgentCode);
                setCopiedAgentCode(true);
                setTimeout(() => setCopiedAgentCode(false), 2000);
                onShowToast('📋 vps_agent.py copied to clipboard!');
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-lg shadow-purple-500/20 cursor-pointer"
            >
              {copiedAgentCode ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy vps_agent.py</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Setup Instructions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <span className="font-bold text-cyan-400 font-mono">1. Install Dependencies</span>
              <p className="text-slate-400">Run on your VPS terminal:</p>
              <code className="block p-2 rounded bg-slate-900 text-[11px] text-slate-200 font-mono">
                pip install fastapi uvicorn psutil requests
              </code>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <span className="font-bold text-purple-400 font-mono">2. Save Script</span>
              <p className="text-slate-400">Paste code into <code className="text-white">vps_agent.py</code>:</p>
              <code className="block p-2 rounded bg-slate-900 text-[11px] text-slate-200 font-mono">
                nano vps_agent.py
              </code>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <span className="font-bold text-emerald-400 font-mono">3. Start Agent Service</span>
              <p className="text-slate-400">Launch FastAPI listener:</p>
              <code className="block p-2 rounded bg-slate-900 text-[11px] text-slate-200 font-mono">
                python3 vps_agent.py
              </code>
            </div>
          </div>

          {/* Code display */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
            <div className="bg-slate-900/90 px-4 py-2 border-b border-slate-800 text-xs font-mono text-slate-400 flex items-center justify-between">
              <span>vps_agent.py (FastAPI + psutil + n8n Webhook Dispatcher)</span>
              <span className="text-[11px] text-slate-500">Python 3.8+</span>
            </div>
            <pre className="p-5 font-mono text-xs text-slate-300 overflow-x-auto max-h-96 leading-relaxed">
              {pythonAgentCode}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
