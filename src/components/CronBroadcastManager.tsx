import React, { useState, useEffect } from 'react';
import { Clock, Play, Radio, AlertTriangle, Newspaper, Globe, Sparkles, CheckCircle2 } from 'lucide-react';

interface CronBroadcastManagerProps {
  onShowToast: (msg: string) => void;
}

export const CronBroadcastManager: React.FC<CronBroadcastManagerProps> = ({ onShowToast }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState<any[]>([
    {
      id: '1',
      title: 'South Asia Seismic & Breaking Tech Alert',
      timestamp: '25 mins ago',
      targets: 'Telegram • Discord • Slack',
      status: 'Delivered',
    },
    {
      id: '2',
      title: 'Universal Bot Cluster Health Heartbeat',
      timestamp: '1h 25 mins ago',
      targets: 'Telegram Admin',
      status: 'Delivered',
    },
  ]);

  const handleTriggerNow = async () => {
    setIsRunning(true);
    try {
      const res = await fetch('/api/cron/trigger', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || data?.error || `Broadcast failed (HTTP ${res.status}).`);
      }
      setHistory((prev) => [
        {
          id: Math.random().toString(36).substring(2, 9),
          title: 'Manual On-Demand AI Digest',
          timestamp: 'Just now',
          targets: 'All Configured Gateways',
          status: 'Delivered',
        },
        ...prev,
      ]);
      onShowToast('📡 Automated broadcast dispatched across all active channels!');
    } catch (e: any) {
      onShowToast(`⚠️ Broadcast failed: ${e?.message || 'Unable to reach the broadcast service.'}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900 border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Automated Cron Broadcast Engine</h2>
              <p className="text-xs text-slate-400">Scheduled regional seismic alerts, breaking headlines, & YouTube channel sync</p>
            </div>
          </div>
          <button
            onClick={handleTriggerNow}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition cursor-pointer"
          >
            <Play className="w-4 h-4" />
            <span>{isRunning ? 'Broadcasting...' : 'Trigger Now'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs">
            <AlertTriangle className="w-4 h-4" />
            <span>Bangladesh Earthquake Monitor</span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time USGS & BMD seismic listener alerting when magnitude &gt; 3.0.
          </p>
          <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
            MONITORING ACTIVE
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
            <Newspaper className="w-4 h-4" />
            <span>AI News Synthesizer</span>
          </div>
          <p className="text-xs text-slate-400">
            Pulls top tech, science, and regional news, summarized by Llama 3.3.
          </p>
          <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
            SCHEDULE: HOURLY
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
            <Radio className="w-4 h-4" />
            <span>Multi-Channel Dispatch</span>
          </div>
          <p className="text-xs text-slate-400">
            Delivers broadcast simultaneously across Telegram groups, Discord, and Slack.
          </p>
          <span className="inline-block px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-bold">
            10 GATEWAYS READY
          </span>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
        <h3 className="font-semibold text-slate-200 text-sm">Recent Automated Broadcast History</h3>
        <div className="space-y-2">
          {history.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs"
            >
              <div>
                <h4 className="font-bold text-slate-200">{item.title}</h4>
                <p className="text-slate-400 text-[11px]">{item.targets}</p>
              </div>
              <div className="text-right">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium text-[10px]">
                  {item.status}
                </span>
                <div className="text-slate-500 text-[10px] mt-0.5">{item.timestamp}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
