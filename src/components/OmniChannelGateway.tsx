import React from 'react';
import { BotConfig } from '../types';
import { Radio, MessageSquare, ShieldCheck, CheckCircle2, Key, ExternalLink, Globe, Smartphone } from 'lucide-react';

interface OmniChannelGatewayProps {
  config: BotConfig;
  onChange: (updates: Partial<BotConfig>) => void;
  onShowToast: (msg: string) => void;
  onOpenPortal: (platformId?: string) => void;
}

export const OmniChannelGateway: React.FC<OmniChannelGatewayProps> = ({
  config,
  onChange,
  onShowToast,
  onOpenPortal,
}) => {
  const channels = [
    { id: 'telegram', name: 'Telegram Bot', keyField: 'telegramBotToken', enabledField: 'enableTelegram', icon: MessageSquare, badge: 'Active Webhook' },
    { id: 'discord', name: 'Discord Bot', keyField: 'discordBotToken', enabledField: 'enableDiscord', icon: Radio, badge: 'Gateway v10' },
    { id: 'slack', name: 'Slack Bot', keyField: 'slackBotToken', enabledField: 'enableSlack', icon: Globe, badge: 'Socket Mode' },
    { id: 'whatsapp', name: 'WhatsApp Cloud API', keyField: 'whatsappAccessToken', enabledField: 'enableWhatsApp', icon: Smartphone, badge: 'Meta Graph' },
    { id: 'twilio', name: 'Twilio SMS & Voice', keyField: 'twilioAuthToken', enabledField: 'enableTwilio', icon: Smartphone, badge: 'Rest API' },
    { id: 'line', name: 'LINE Messaging API', keyField: 'lineChannelAccessToken', enabledField: 'enableLine', icon: MessageSquare, badge: 'Line Webhook' },
    { id: 'matrix', name: 'Matrix Synapse Bridge', keyField: 'matrixAccessToken', enabledField: 'enableMatrix', icon: Globe, badge: 'Federated' },
    { id: 'pushover', name: 'Pushover Alerts', keyField: 'pushoverAppToken', enabledField: 'enablePushover', icon: Radio, badge: 'Push Protocol' },
  ];

  const handleToggle = (enabledField: string, currentValue: boolean) => {
    onChange({ [enabledField]: !currentValue } as Partial<BotConfig>);
    onShowToast(`📡 Channel configuration updated.`);
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">10-Platform Omni-Channel Messaging Gateways</h2>
            <p className="text-xs text-slate-400">Manage connected messaging protocols & webhook credentials</p>
          </div>
        </div>
        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
          Unified AI Active
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {channels.map((ch) => {
          const isEnabled = Boolean((config as any)[ch.enabledField]);
          const hasKey = Boolean((config as any)[ch.keyField]);
          const Icon = ch.icon;

          return (
            <div
              key={ch.id}
              className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-indigo-500/40 transition shadow-lg"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Icon className="w-5 h-5" />
                  </div>
                  <button
                    onClick={() => handleToggle(ch.enabledField, isEnabled)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                      isEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isEnabled ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>
                <div>
                  <h4 className="font-bold text-slate-100 text-sm">{ch.name}</h4>
                  <span className="text-[10px] text-slate-400 font-mono">{ch.badge}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500">Status:</span>
                  <span className={hasKey ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                    {hasKey ? 'Configured' : 'Missing Token'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onOpenPortal(ch.id)}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Configure Keys</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
