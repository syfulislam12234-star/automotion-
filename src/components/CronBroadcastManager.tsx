import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Play,
  Radio,
  AlertTriangle,
  Newspaper,
  Globe,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Send,
  Sliders,
  Settings,
  Shield,
  Smartphone,
  Hash,
  MessageSquare,
  Flame,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Info,
  PhoneCall,
  Check,
  Zap,
  Activity,
  Layers,
} from 'lucide-react';

interface CronBroadcastManagerProps {
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface NewsItem {
  id: string;
  headline: string;
  headlineBn?: string;
  summary: string;
  summaryBn?: string;
  source: string;
  category: 'emergency' | 'breaking' | 'weather' | 'national' | 'technology';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO';
  url: string;
  publishedAt: string;
  timeAgo?: string;
  tags: string[];
}

interface BroadcastHistoryItem {
  id: string;
  timestamp: string;
  title: string;
  summary: string;
  fullMessage?: string;
  targetCount: number;
  targets: string[];
  status: 'delivered' | 'partial' | 'failed';
  modelUsed?: string;
  itemsCount?: number;
  emergencyAlertLevel?: 'CRITICAL' | 'WARNING' | 'NORMAL';
  recipientsDetail?: Array<{ platform: string; target: string; status: 'ok' | 'skipped' | 'failed'; note?: string }>;
}

export const CronBroadcastManager: React.FC<CronBroadcastManagerProps> = ({ onShowToast }) => {
  // State
  const [isRunning, setIsRunning] = useState(false);
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [isNewsLoading, setIsNewsLoading] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [copiedPreview, setCopiedPreview] = useState(false);

  // Status & Schedule
  const [cronStatus, setCronStatus] = useState<{
    running: boolean;
    enabled: boolean;
    intervalMinutes: number;
    nextRun: string | null;
    countdownSeconds: number;
    lastRun: string | null;
    totalExecuted: number;
  }>({
    running: true,
    enabled: true,
    intervalMinutes: 120,
    nextRun: null,
    countdownSeconds: 7200,
    lastRun: null,
    totalExecuted: 1,
  });

  const [countdown, setCountdown] = useState<number>(7200);

  // Config
  const [config, setConfig] = useState({
    enabled: true,
    intervalMinutes: 120, // 2 hours default
    targets: ['telegram', 'whatsapp', 'discord'],
    newsLanguage: 'bn' as 'bn' | 'en' | 'bilingual',
    emergencyOnly: false,
    includeWeather: true,
    includeHelplines: true,
    broadcastEarthquakes: true,
    broadcastNews: true,
    broadcastYouTube: false,
    customPrompt: 'বাংলাদেশ জাতীয় ও জরুরি ব্রেকিং নিউজ এবং আবহাওয়া সতর্কতা সংক্ষেপে বাংলায় বুলেটিন আকারে তৈরি করো।',
  });

  // Data
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [previewData, setPreviewData] = useState<{
    title: string;
    summary: string;
    fullMessage: string;
    emergencyLevel: 'CRITICAL' | 'WARNING' | 'NORMAL';
    modelUsed: string;
  } | null>(null);

  const [history, setHistory] = useState<BroadcastHistoryItem[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'scanner' | 'config' | 'preview'>('overview');

  // Load Status and initial data
  const loadStatus = async () => {
    try {
      const res = await fetch('/api/cron/status');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCronStatus({
            running: data.running,
            enabled: data.enabled ?? true,
            intervalMinutes: data.intervalMinutes || 120,
            nextRun: data.nextRun,
            countdownSeconds: data.countdownSeconds || 0,
            lastRun: data.lastRun,
            totalExecuted: data.totalExecuted || 0,
          });
          if (data.countdownSeconds > 0) {
            setCountdown(data.countdownSeconds);
          }
          if (data.config) {
            setConfig((prev) => ({ ...prev, ...data.config }));
          }
        }
      }
    } catch {
      // Safe fallback
    }
  };

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/cron/history');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.history)) {
          setHistory(data.history);
        }
      }
    } catch {
      // Safe fallback
    }
  };

  const loadNewsFeed = async () => {
    setIsNewsLoading(true);
    try {
      const res = await fetch('/api/cron/news/bangladesh?refresh=true');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.news)) {
          setNewsItems(data.news);
        }
      }
    } catch (e: any) {
      console.warn('Failed to load news feed:', e?.message);
    } finally {
      setIsNewsLoading(false);
    }
  };

  const loadPreview = async () => {
    setIsPreviewLoading(true);
    try {
      const res = await fetch('/api/cron/preview');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.broadcast) {
          setPreviewData(data.broadcast);
        }
      }
    } catch (e: any) {
      console.warn('Failed to load preview:', e?.message);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    loadHistory();
    loadNewsFeed();

    const intervalTimer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          loadStatus();
          return 7200;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalTimer);
  }, []);

  // Format seconds to hh:mm:ss
  const formatCountdown = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  };

  // Trigger manual broadcast
  const handleTriggerNow = async () => {
    setIsRunning(true);
    try {
      const res = await fetch('/api/cron/trigger', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || data?.error || `Broadcast failed (HTTP ${res.status}).`);
      }
      onShowToast(`🚀 ${data.message || 'Automated Bangladesh Emergency Broadcast delivered successfully!'}`, 'success');
      await loadStatus();
      await loadHistory();
      if (data.result?.broadcast) {
        setHistory((prev) => [data.result.broadcast, ...prev.filter((h) => h.id !== data.result.broadcast.id)]);
      }
    } catch (e: any) {
      onShowToast(`⚠️ Broadcast failed: ${e?.message || 'Unable to reach the broadcast service.'}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  // Save Configuration
  const handleSaveConfig = async (newConfig?: Partial<typeof config>) => {
    setIsConfigLoading(true);
    const payload = newConfig ? { ...config, ...newConfig } : config;
    try {
      const res = await fetch('/api/cron/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || 'Failed to save configuration');
      }
      setConfig(payload);
      onShowToast('✅ Broadcast schedule & channel configuration updated!', 'success');
      await loadStatus();
    } catch (e: any) {
      onShowToast(`⚠️ Config error: ${e?.message}`, 'error');
    } finally {
      setIsConfigLoading(false);
    }
  };

  const toggleTarget = (targetName: string) => {
    const current = [...config.targets];
    const exists = current.includes(targetName);
    const next = exists ? current.filter((t) => t !== targetName) : [...current, targetName];
    if (next.length === 0) {
      onShowToast('Select at least one messenger channel for broadcasting.', 'info');
      return;
    }
    const updated = { ...config, targets: next };
    setConfig(updated);
    handleSaveConfig(updated);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPreview(true);
    setTimeout(() => setCopiedPreview(false), 2000);
    onShowToast('📋 Broadcast bulletin copied to clipboard!', 'info');
  };

  return (
    <div className="space-y-6">
      {/* CLEAN STATUS HEADER */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">Bangladesh Emergency Broadcast Engine</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 font-mono font-bold">
                  2H Cron
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Automated multi-messenger emergency bulletins with 100-AI failover synthesis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerNow}
              disabled={isRunning}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-amber-500/20 transition cursor-pointer active:scale-95"
            >
              <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : 'fill-current'}`} />
              <span>{isRunning ? 'Broadcasting...' : 'Instant Dispatch'}</span>
            </button>
          </div>
        </div>

        {/* STATUS METRICS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-800">
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Schedule</span>
              <p className="text-xs font-bold text-slate-200">
                {config.enabled ? `Every ${config.intervalMinutes / 60}h` : 'Paused'}
              </p>
            </div>
            <span className={`w-2 h-2 rounded-full ${config.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Countdown</span>
            <p className="text-xs font-bold text-amber-400 font-mono">
              {config.enabled ? formatCountdown(countdown) : 'Off'}
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Channels</span>
            <p className="text-xs font-bold text-cyan-400 font-mono">
              {config.targets.length} Connected
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Language</span>
            <p className="text-xs font-bold text-purple-300">
              {config.newsLanguage === 'bn' ? 'বাংলা (Standard)' : config.newsLanguage === 'en' ? 'English' : 'Bilingual'}
            </p>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-amber-400" />
          <span>Overview & History</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('scanner');
            if (newsItems.length === 0) loadNewsFeed();
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeTab === 'scanner'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Newspaper className="w-3.5 h-3.5 text-rose-400" />
          <span>Live Radar ({newsItems.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('preview');
            if (!previewData) loadPreview();
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeTab === 'preview'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Bulletin Preview</span>
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeTab === 'config'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span>Interval & Channels</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* 3 CRISP STATUS CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Disaster Radar</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px] font-mono">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                BMD storm warnings, riverport alerts, and FFWC flood levels.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-xs">
                  <Newspaper className="w-4 h-4" />
                  <span>News Aggregator</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[10px] font-mono">
                  5 SOURCES
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Prothom Alo, Daily Star, Dhaka Tribune with auto-deduplication.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-xs">
                  <Radio className="w-4 h-4" />
                  <span>Multi-Dispatcher</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-mono">
                  {config.targets.length} TARGETS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Telegram Channels, WhatsApp Cloud, Discord & Slack dispatches.
              </p>
            </div>
          </div>

          {/* RECENT BROADCAST AUDIT HISTORY */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-100 text-xs flex items-center gap-2">
                  <span>Broadcast Execution Logs</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                    {history.length}
                  </span>
                </h3>
              </div>

              <button
                onClick={loadHistory}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh History</span>
              </button>
            </div>

            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs bg-slate-950/50 rounded-xl border border-slate-800/60">
                  No automated broadcasts logged yet. Click "Dispatch Live Broadcast Now" above to run the first cycle.
                </div>
              ) : (
                history.map((item) => {
                  const isExpanded = expandedHistoryId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2 transition-all hover:border-slate-700"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                item.emergencyAlertLevel === 'CRITICAL'
                                  ? 'bg-rose-500 animate-ping'
                                  : item.emergencyAlertLevel === 'WARNING'
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-400'
                              }`}
                            />
                            <h4 className="font-bold text-slate-200 text-xs">{item.title}</h4>
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-1">{item.summary}</p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                            {item.status.toUpperCase()} ({item.targetCount} Channels)
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </span>
                          <button
                            onClick={() => setExpandedHistoryId(isExpanded ? null : item.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expandable full message & delivery details */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-3">
                          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                            {item.fullMessage || item.summary}
                          </div>

                          {item.recipientsDetail && item.recipientsDetail.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Channel Delivery Telemetry:
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {item.recipientsDetail.map((rec, i) => (
                                  <div
                                    key={i}
                                    className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60 flex items-center justify-between text-[11px]"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                      <span className="font-semibold text-slate-200 capitalize">{rec.platform}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                                      {rec.note || rec.target}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE BANGLADESH NEWS FEED SCANNER */}
      {activeTab === 'scanner' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <span>Real-Time Bangladesh Emergency & National News Radar</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
                  Live Scanner
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Aggregated from Prothom Alo, Daily Star, Dhaka Tribune, BD Disaster Monitor & BMD Weather.
              </p>
            </div>

            <button
              onClick={loadNewsFeed}
              disabled={isNewsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isNewsLoading ? 'animate-spin text-amber-400' : ''}`} />
              <span>{isNewsLoading ? 'Scanning Feeds...' : 'Refresh Sources'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {newsItems.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border space-y-2.5 transition-all ${
                  item.priority === 'CRITICAL'
                    ? 'bg-rose-950/20 border-rose-800/60 shadow-lg shadow-rose-950/30'
                    : item.priority === 'HIGH' || item.category === 'emergency'
                    ? 'bg-amber-950/20 border-amber-800/60'
                    : 'bg-slate-900/80 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        item.priority === 'CRITICAL'
                          ? 'bg-rose-500 text-white'
                          : item.priority === 'HIGH'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {item.priority === 'CRITICAL'
                        ? '🔴 জরুরি (EMERGENCY)'
                        : item.priority === 'HIGH'
                        ? '🟡 সতর্কবাণী (ALERT)'
                        : '🇧🇩 জাতীয় (NATIONAL)'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">{item.source}</span>
                  </div>

                  <span className="text-[10px] text-slate-500 font-mono">{item.timeAgo || 'Recent'}</span>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-slate-100 text-xs leading-snug">
                    {item.headlineBn || item.headline}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                    {item.summaryBn || item.summary}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <div className="flex flex-wrap gap-1">
                    {item.tags?.slice(0, 3).map((tag, idx) => (
                      <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">
                        #{tag}
                      </span>
                    ))}
                  </div>

                  {item.url && item.url !== '#' && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold transition"
                    >
                      <span>Read Original</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: AI BULLETIN PREVIEW */}
      {activeTab === 'preview' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <span>Unified 100-AI Emergency Broadcast Generator</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                  Live Dispatch Preview
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Inspect the precise synthesized bulletin that will be delivered to Telegram & WhatsApp.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadPreview}
                disabled={isPreviewLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPreviewLoading ? 'animate-spin text-purple-400' : ''}`} />
                <span>{isPreviewLoading ? 'Synthesizing...' : 'Regenerate Preview'}</span>
              </button>

              {previewData?.fullMessage && (
                <button
                  onClick={() => copyToClipboard(previewData.fullMessage)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition cursor-pointer"
                >
                  {copiedPreview ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPreview ? 'Copied!' : 'Copy Bulletin'}</span>
                </button>
              )}
            </div>
          </div>

          {previewData ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Telegram / WhatsApp Simulation Mockup */}
              <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                      <Send className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">Telegram Channel Broadcast Feed</h4>
                      <p className="text-[10px] text-slate-400">@bangladesh_emergency_alerts (2H Automated Cycle)</p>
                    </div>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono">
                    MODEL: {previewData.modelUsed || 'Gemini 3.7 Flash'}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 font-sans text-xs text-slate-200 whitespace-pre-wrap leading-relaxed space-y-2 select-text">
                  {previewData.fullMessage}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Formatted in Telegram Markdown v2 & WhatsApp Clean Text</span>
                  <span>Instant Broadcast Ready</span>
                </div>
              </div>

              {/* Helplines and Advisory Card */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <PhoneCall className="w-4 h-4" />
                  <span>National Emergency Helplines</span>
                </div>
                <p className="text-xs text-slate-400">
                  Automatically attached to the emergency dispatch bulletin for citizen assistance.
                </p>

                <div className="space-y-2 pt-2">
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-200">জাতীয় জরুরি সেবা</span>
                      <p className="text-[10px] text-slate-400">Police, Fire Service, Ambulance</p>
                    </div>
                    <span className="text-xs font-bold text-rose-400 font-mono px-2 py-1 rounded bg-rose-500/10">
                      999
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-200">দুর্যোগ তথ্য ও সতর্কতা</span>
                      <p className="text-[10px] text-slate-400">Cyclone, Flood & Weather Advisory</p>
                    </div>
                    <span className="text-xs font-bold text-amber-400 font-mono px-2 py-1 rounded bg-amber-500/10">
                      1090
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-200">সরকারি তথ্য ও সেবা</span>
                      <p className="text-[10px] text-slate-400">National Citizen Support Line</p>
                    </div>
                    <span className="text-xs font-bold text-cyan-400 font-mono px-2 py-1 rounded bg-cyan-500/10">
                      333
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-200">স্বাস্থ্য বাতায়ন</span>
                      <p className="text-[10px] text-slate-400">24/7 Medical Doctor Helpline</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-400 font-mono px-2 py-1 rounded bg-emerald-500/10">
                      16263
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs bg-slate-900/60 rounded-xl border border-slate-800">
              Click "Regenerate Preview" to synthesize the latest Bangladesh Emergency Bulletin.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SCHEDULE & CHANNEL CONTROLS */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6">
            <div>
              <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                <Sliders className="w-5 h-5 text-cyan-400" />
                <span>Automated Cron Schedule & Multi-Channel Broadcast Controls</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Customize automated dispatch frequencies, target messenger protocols, priority filters, and language preferences.
              </p>
            </div>

            {/* MASTER TOGGLE & INTERVAL */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Automated Background Cron Engine</h4>
                  <p className="text-[11px] text-slate-400">Auto-triggers emergency news dispatches in the background</p>
                </div>
                <button
                  onClick={() => handleSaveConfig({ enabled: !config.enabled })}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    config.enabled ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      config.enabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <label className="text-xs font-bold text-slate-200 block">Broadcast Frequency / Interval</label>
                <select
                  value={config.intervalMinutes}
                  onChange={(e) => handleSaveConfig({ intervalMinutes: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-semibold focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value={60}>Every 1 Hour (Hourly Emergency Alert)</option>
                  <option value={120}>Every 2 Hours (Recommended Automated Cycle)</option>
                  <option value={180}>Every 3 Hours (Standard Digest)</option>
                  <option value={360}>Every 6 Hours (Periodic Summary)</option>
                  <option value={720}>Every 12 Hours (Twice Daily)</option>
                  <option value={1440}>Every 24 Hours (Daily Morning Bulletin)</option>
                </select>
              </div>
            </div>

            {/* LANGUAGE & CONTENT FILTERS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <label className="text-xs font-bold text-slate-200 block">Broadcast Language</label>
                <select
                  value={config.newsLanguage}
                  onChange={(e) => handleSaveConfig({ newsLanguage: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-semibold focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="bn">বাংলা (Bengali - Standard)</option>
                  <option value="en">English (International)</option>
                  <option value="bilingual">Bilingual (বাংলা + English)</option>
                </select>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Include Weather Warnings</h4>
                  <p className="text-[10px] text-slate-400">BMD riverport & maritime storm alerts</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.includeWeather}
                  onChange={(e) => handleSaveConfig({ includeWeather: e.target.checked })}
                  className="w-4 h-4 rounded text-cyan-500 cursor-pointer"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Attach National Helplines</h4>
                  <p className="text-[10px] text-slate-400">999, 1090, 333, 16263 footer</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.includeHelplines}
                  onChange={(e) => handleSaveConfig({ includeHelplines: e.target.checked })}
                  className="w-4 h-4 rounded text-cyan-500 cursor-pointer"
                />
              </div>
            </div>

            {/* TARGET MESSENGER CHANNELS */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                <span>Connected Messenger Broadcast Targets ({config.targets.length} Selected)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { id: 'telegram', label: 'Telegram Bot & Channel', icon: <Send className="w-4 h-4 text-blue-400" /> },
                  { id: 'whatsapp', label: 'WhatsApp Cloud API', icon: <Smartphone className="w-4 h-4 text-emerald-400" /> },
                  { id: 'discord', label: 'Discord Webhook', icon: <Hash className="w-4 h-4 text-indigo-400" /> },
                  { id: 'slack', label: 'Slack Alert Channel', icon: <MessageSquare className="w-4 h-4 text-purple-400" /> },
                  { id: 'line', label: 'LINE Push Protocol', icon: <MessageSquare className="w-4 h-4 text-green-400" /> },
                  { id: 'teams', label: 'Microsoft Teams', icon: <Globe className="w-4 h-4 text-blue-500" /> },
                  { id: 'viber', label: 'Viber Bot Channel', icon: <MessageSquare className="w-4 h-4 text-purple-300" /> },
                  { id: 'webhook', label: 'Generic REST Webhook', icon: <Zap className="w-4 h-4 text-amber-400" /> },
                ].map((target) => {
                  const isSelected = config.targets.includes(target.id);
                  return (
                    <button
                      key={target.id}
                      onClick={() => toggleTarget(target.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-950/30 border-cyan-500/50 shadow-md shadow-cyan-500/10 text-slate-100'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {target.icon}
                        <span className="text-xs font-semibold">{target.label}</span>
                      </div>
                      <span
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                          isSelected ? 'bg-cyan-500 text-slate-950' : 'border border-slate-700'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
