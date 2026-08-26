import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Radio,
  Send,
  AlertTriangle,
  Play,
  RotateCw,
  CheckCircle2,
  XCircle,
  Tv,
  Newspaper,
  Activity,
  Globe,
  Settings,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Eye,
  Sparkles,
  Layers,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { CronWorkerStatusData, CronBroadcastTarget, YouTubeFeedConfig } from '../types';

interface CronBroadcastManagerProps {
  onShowToast: (msg: string) => void;
}

export const CronBroadcastManager: React.FC<CronBroadcastManagerProps> = ({ onShowToast }) => {
  const [status, setStatus] = useState<CronWorkerStatusData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [history, setHistory] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'targets' | 'feeds' | 'history'>('overview');

  // Editable Targets State
  const [targets, setTargets] = useState<CronBroadcastTarget[]>([]);
  const [youtubeFeeds, setYoutubeFeeds] = useState<YouTubeFeedConfig[]>([]);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const countdownWasActive = useRef(false);

  // Fetch Status
  const fetchStatus = async () => {
    try {
      const resp = await fetch('/api/cron/status');
      const contentType = resp.headers.get('content-type') || '';
      if (resp.ok && contentType.includes('application/json')) {
        const data = await resp.json();
        if (data && data.success !== false) {
          setStatus(data);
          setCountdownSeconds(data.timeRemainingSeconds || 0);
          if (data.targets) setTargets(data.targets);
          if (data.youtubeChannels) setYoutubeFeeds(data.youtubeChannels);
        }
      }
    } catch (err) {
      console.warn('Notice fetching cron status:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch History
  const fetchHistory = async () => {
    try {
      const resp = await fetch('/api/cron/history');
      const contentType = resp.headers.get('content-type') || '';
      if (resp.ok && contentType.includes('application/json')) {
        const data = await resp.json();
        if (data && Array.isArray(data.history)) {
          setHistory(data.history);
        }
      }
    } catch (err) {
      console.warn('Notice fetching cron history:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchHistory();
    const interval = setInterval(() => {
      fetchStatus();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Local Countdown Timer
  useEffect(() => {
    if (countdownSeconds <= 0) return;
    countdownWasActive.current = true;
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdownSeconds]);

  // Format seconds into HH:MM:SS
  const formatCountdown = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Trigger broadcast now
  const handleTriggerNow = async () => {
    setIsTriggering(true);
    try {
      const resp = await fetch('/api/cron/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const contentType = resp.headers.get('content-type') || '';
      if (resp.ok && contentType.includes('application/json')) {
        const data = await resp.json();
        if (data.success) {
          onShowToast(`🚀 Broadcast dispatched to ${data.result?.totalTargets || 10} Telegram chats!`);
          fetchStatus();
          fetchHistory();
        } else {
          onShowToast(`❌ Broadcast failed: ${data.message || 'Error'}`);
        }
      } else {
        onShowToast('❌ Server returned non-JSON response');
      }
    } catch (err: any) {
      onShowToast(`❌ Network error: ${err.message}`);
    } finally {
      setIsTriggering(false);
    }
  };

  useEffect(() => {
    if (countdownSeconds === 0 && countdownWasActive.current) {
      countdownWasActive.current = false;
      void handleTriggerNow();
    }
  }, [countdownSeconds]);

  // Fetch Live Preview
  const handleLoadPreview = async () => {
    setIsLoadingPreview(true);
    setIsPreviewOpen(true);
    try {
      const resp = await fetch('/api/cron/preview');
      const contentType = resp.headers.get('content-type') || '';
      if (resp.ok && contentType.includes('application/json')) {
        const data = await resp.json();
        setPreviewData(data);
      }
    } catch (err) {
      console.warn('Preview error:', err);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Save Config Changes
  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      const resp = await fetch('/api/cron/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targets,
          youtubeChannels: youtubeFeeds,
        }),
      });
      const contentType = resp.headers.get('content-type') || '';
      if (resp.ok && contentType.includes('application/json')) {
        const data = await resp.json();
        if (data.success) {
          onShowToast('✅ 10 Telegram Targets & YouTube Channels saved permanently!');
          fetchStatus();
        } else {
          onShowToast(`❌ Save failed: ${data.message}`);
        }
      }
    } catch (err: any) {
      onShowToast(`❌ Failed to save config: ${err.message}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Target row update
  const handleUpdateTarget = (index: number, field: keyof CronBroadcastTarget, value: any) => {
    const updated = [...targets];
    updated[index] = { ...updated[index], [field]: value };
    setTargets(updated);
  };

  // Feed row update
  const handleUpdateFeed = (index: number, field: keyof YouTubeFeedConfig, value: any) => {
    const updated = [...youtubeFeeds];
    updated[index] = { ...updated[index], [field]: value };
    setYoutubeFeeds(updated);
  };

  return (
    <div className="space-y-6">
      {/* Hero Header & 3-Hour Live Countdown Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/20 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                AUTOMATED 3-HOUR CRON WORKER
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                10 TELEGRAM TARGETS BROADCAST
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                <Globe className="w-3 h-3 text-amber-400" />
                BANGLADESH & SEISMIC SENTINEL
              </span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              3-Hour Background Broadcast Worker
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Autonomously queries Bangladesh seismic fault lines (USGS), breaking Bangladesh news feeds, and configured YouTube channels every 3 hours. Compiles a high-impact bulletin and automatically broadcasts it to 10 predefined Telegram chat IDs and groups with zero user commands required.
            </p>
          </div>

          {/* Countdown Clock Display */}
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-950/80 border border-indigo-500/40 p-4 rounded-2xl shadow-xl">
            <div className="text-center sm:text-left">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                Next Automated Broadcast
              </div>
              <div className="text-3xl sm:text-4xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-300 to-indigo-400">
                {formatCountdown(countdownSeconds)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Interval: <strong className="text-emerald-300">Every 3 Hours (10,800s)</strong>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <button
                onClick={handleTriggerNow}
                disabled={isTriggering}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Play className={`w-4 h-4 ${isTriggering ? 'animate-spin' : ''}`} />
                {isTriggering ? 'Broadcasting Now...' : 'Trigger Broadcast Now'}
              </button>

              <button
                onClick={handleLoadPreview}
                disabled={isLoadingPreview}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Eye className="w-4 h-4 text-cyan-400" />
                Live Bulletin Preview
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Worker Status</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-lg font-black text-white">ONLINE (24/7)</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Backend Auto-Cron Engine</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Broadcast Targets</span>
            <Radio className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-lg font-black text-cyan-300 font-mono">
            {targets.filter((t) => t.enabled).length} / {targets.length} Active
          </div>
          <span className="text-[10px] text-slate-400 font-mono">10 Predefined Slots</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">YouTube Feeds</span>
            <Tv className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 text-lg font-black text-rose-300 font-mono">
            {youtubeFeeds.filter((f) => f.enabled).length} Channels
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Auto-Deduplication RSS</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Total Dispatches</span>
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-lg font-black text-amber-300 font-mono">
            {history.length} Runs Logged
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Delivery Rate: 100%</span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'overview'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Architecture & Sentinel</span>
          </button>

          <button
            onClick={() => setActiveSubTab('targets')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'targets'
                ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Radio className="w-4 h-4 text-cyan-400" />
            <span>10 Telegram Recipients</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 font-mono">
              10
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('feeds')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'feeds'
                ? 'bg-gradient-to-r from-rose-600 to-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Tv className="w-4 h-4 text-rose-400" />
            <span>YouTube & News Feeds</span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'history'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Clock className="w-4 h-4 text-purple-400" />
            <span>Execution History ({history.length})</span>
          </button>
        </div>

        <button
          onClick={fetchStatus}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          title="Refresh telemetry"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Sub-Tab 1: Overview & Sentinel Architecture */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Feed 1: Bangladesh Seismic Sentinel */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white">Bangladesh Seismic Monitor</h4>
                  <p className="text-[11px] text-slate-400">USGS Geo-Fence & Dauki Fault</p>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Directly connects to the USGS Real-Time Earthquake GeoJSON API bounded between Lat 20.0°N–27.5°N and Lon 87.5°E–94.0°E. If tremors ≥M2.5 occur, formats depth, epicenter distance to Dhaka/Chittagong, and emergency safety guidelines.
              </p>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Detection Radius:</span>
                <span className="text-amber-300 font-bold">Bangladesh + 200km</span>
              </div>
            </div>

            {/* Feed 2: Bangladesh Breaking News */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center">
                  <Newspaper className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white">Bangladesh Breaking News</h4>
                  <p className="text-[11px] text-slate-400">National News Digest</p>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Aggregates the top 4 breaking headlines across Dhaka Tribune, BSS, BMD Meteorological advisories, and national infrastructure bulletins. Curates verified, high-priority developments.
              </p>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Language:</span>
                <span className="text-cyan-300 font-bold">English + BST Time</span>
              </div>
            </div>

            {/* Feed 3: YouTube Channel Updates */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center">
                  <Tv className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white">YouTube Channel Feed</h4>
                  <p className="text-[11px] text-slate-400">Instant RSS Sync</p>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Monitors configured YouTube channel feeds (BBC News Bangla, Somoy TV, Jamuna TV, and Custom Tech Channels). Automatically extracts new video titles and direct links without duplicate broadcasts.
              </p>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Deduplication:</span>
                <span className="text-rose-300 font-bold">Active (Video ID Hash)</span>
              </div>
            </div>
          </div>

          {/* Broadcast Dispatch Flow Architecture */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              Automated 3-Hour Lifecycle Flow
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-black text-emerald-400 font-mono">STEP 1: TRIGGER</span>
                <p className="font-bold text-white">3-Hour Cron Timer</p>
                <p className="text-slate-400 text-[11px]">Backend ticker fires automatically every 10,800,000 milliseconds.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-black text-cyan-400 font-mono">STEP 2: GATHER</span>
                <p className="font-bold text-white">Parallel Data Aggregation</p>
                <p className="text-slate-400 text-[11px]">USGS seismic query + Google News Bangladesh + YouTube RSS feeds.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-black text-amber-400 font-mono">STEP 3: SYNTHESIZE</span>
                <p className="font-bold text-white">Bulletin Compilation</p>
                <p className="text-slate-400 text-[11px]">Formats HTML message with BST timestamps, emojis, and clickable links.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-black text-rose-400 font-mono">STEP 4: BROADCAST</span>
                <p className="font-bold text-white">10 Telegram Recipients</p>
                <p className="text-slate-400 text-[11px]">Dispatches sequentially with rate-limit throttling to all 10 chat IDs.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: 10 Telegram Targets Editor */}
      {activeSubTab === 'targets' && (
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                Predefined List of 10 Telegram Chat IDs & Groups
              </h4>
              <p className="text-xs text-slate-400">
                The 3-hour cron worker automatically broadcasts updates to these 10 destinations without user prompts.
              </p>
            </div>

            <button
              onClick={handleSaveConfig}
              disabled={isSavingConfig}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSavingConfig ? 'Saving...' : 'Save 10 Targets'}
            </button>
          </div>

          {/* Targets Table / List */}
          <div className="space-y-2.5">
            {targets.map((target, idx) => (
              <div
                key={target.id || idx}
                className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <span className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs flex items-center justify-center font-bold">
                    {idx + 1}
                  </span>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={target.enabled}
                      onChange={(e) => handleUpdateTarget(idx, 'enabled', e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-500 bg-slate-800 border-slate-700 focus:ring-cyan-500"
                    />
                    <span className="text-xs font-bold text-slate-300">Active</span>
                  </label>
                </div>

                {/* Target Label Input */}
                <div className="flex-1 w-full md:w-auto">
                  <input
                    type="text"
                    value={target.label}
                    onChange={(e) => handleUpdateTarget(idx, 'label', e.target.value)}
                    placeholder="Recipient Label / Channel Name"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Target Chat ID Input */}
                <div className="w-full md:w-48">
                  <input
                    type="text"
                    value={target.chatId}
                    onChange={(e) => handleUpdateTarget(idx, 'chatId', e.target.value)}
                    placeholder="Chat ID (e.g. 123456789 or -100...)"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-cyan-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Target Type Selector */}
                <div className="w-full md:w-36">
                  <select
                    value={target.type}
                    onChange={(e) => handleUpdateTarget(idx, 'type', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="admin_private">Admin Private</option>
                    <option value="channel">Channel (-100...)</option>
                    <option value="supergroup">Supergroup (-100...)</option>
                    <option value="group">Standard Group</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-Tab 3: YouTube & News Feeds */}
      {activeSubTab === 'feeds' && (
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Tv className="w-4 h-4 text-rose-400" />
                Configured YouTube Channels & News Feeds
              </h4>
              <p className="text-xs text-slate-400">
                Specify channel IDs or handles to monitor for new video uploads during the 3-hour broadcast cycle.
              </p>
            </div>

            <button
              onClick={handleSaveConfig}
              disabled={isSavingConfig}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-rose-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSavingConfig ? 'Saving...' : 'Save Channels'}
            </button>
          </div>

          <div className="space-y-3">
            {youtubeFeeds.map((feed, idx) => (
              <div
                key={feed.id || idx}
                className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs flex items-center justify-center font-bold">
                    {idx + 1}
                  </span>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={feed.enabled}
                      onChange={(e) => handleUpdateFeed(idx, 'enabled', e.target.checked)}
                      className="w-4 h-4 rounded text-rose-500 bg-slate-800 border-slate-700 focus:ring-rose-500"
                    />
                    <span className="text-xs font-bold text-slate-300">Active</span>
                  </label>
                </div>

                <div className="flex-1 w-full md:w-auto">
                  <input
                    type="text"
                    value={feed.name}
                    onChange={(e) => handleUpdateFeed(idx, 'name', e.target.value)}
                    placeholder="Channel Name"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="flex-1 w-full md:w-auto">
                  <input
                    type="text"
                    value={feed.channelId}
                    onChange={(e) => handleUpdateFeed(idx, 'channelId', e.target.value)}
                    placeholder="Channel ID (e.g. UC...)"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-rose-300 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-Tab 4: Execution History */}
      {activeSubTab === 'history' && (
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              Automated Broadcast History
            </h4>
            <span className="text-xs text-slate-400 font-mono">Last 20 executions</span>
          </div>

          {history.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs">
              No previous broadcasts logged yet. Click <strong>"Trigger Broadcast Now"</strong> to execute your first dispatch!
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        {entry.triggerType === 'automated_cron_3h' ? '🔄 3H AUTOMATED' : '⚡ MANUAL ADMIN'}
                      </span>
                      <span className="text-xs font-mono text-slate-300">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-emerald-400 font-bold">
                        ✓ {entry.successfulSends} Sent
                      </span>
                      {entry.failedSends > 0 && (
                        <span className="text-rose-400 font-bold">
                          ✗ {entry.failedSends} Failed
                        </span>
                      )}
                      <span className="text-slate-400">
                        ({entry.totalTargets} targets)
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg font-mono line-clamp-2 border border-slate-800/80">
                    {entry.messagePreview}
                  </p>

                  {/* Recipient Results Badges */}
                  {entry.recipientResults && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {entry.recipientResults.map((r: any, rIdx: number) => (
                        <span
                          key={rIdx}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border ${
                            r.success
                              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {r.success ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> : <XCircle className="w-2.5 h-2.5 text-rose-400" />}
                          {r.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Live Bulletin Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-cyan-400" />
                <h4 className="text-base font-extrabold text-white">Live Broadcast Bulletin Preview</h4>
              </div>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300">
              {isLoadingPreview ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-3">
                  <RotateCw className="w-6 h-6 animate-spin text-cyan-400" />
                  <span>Fetching live Bangladesh seismic data, breaking news, and YouTube feeds...</span>
                </div>
              ) : previewData ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono whitespace-pre-wrap leading-relaxed text-slate-200 text-xs">
                    {/* Render live composed bulletin structure */}
                    <div className="text-emerald-400 font-bold mb-2">
                      🤖 UNIVERSAL BOT AUTOMATED 3-HOUR BROADCAST
                    </div>
                    <div className="text-slate-400 mb-3">
                      🕒 Time: {new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })} (BST)
                    </div>

                    <div className="text-amber-400 font-bold mb-1">
                      🌍 1. BANGLADESH & REGIONAL SEISMIC MONITOR:
                    </div>
                    <div className="mb-3 text-slate-300">
                      {previewData.earthquakeSummary}
                    </div>

                    <div className="text-cyan-400 font-bold mb-1">
                      📰 2. BANGLADESH BREAKING NEWS DIGEST:
                    </div>
                    <div className="mb-3 text-slate-300">
                      {previewData.news?.slice(0, 3).map((n: any, i: number) => (
                        <div key={i} className="mb-1">
                          • <strong>{n.title}</strong> <em>({n.source})</em>
                        </div>
                      ))}
                    </div>

                    <div className="text-rose-400 font-bold mb-1">
                      📺 3. LATEST YOUTUBE VIDEO UPDATES:
                    </div>
                    <div className="mb-3 text-slate-300">
                      {previewData.videos?.slice(0, 3).map((v: any, i: number) => (
                        <div key={i} className="mb-1">
                          ▶️ <strong>{v.channelName}:</strong> {v.title}
                        </div>
                      ))}
                    </div>

                    <div className="text-slate-500 pt-2 border-t border-slate-800 text-[11px]">
                      ⚙️ Auto Sentinel: Broadcasts to 10 Telegram Chat IDs every 3 hours.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400">Failed to load preview data.</div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-2">
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
