import React from 'react';
import { BotConfig } from '../types';
import { X, Sparkles, Check, Zap, ShieldCheck, Server, Rocket } from 'lucide-react';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BotConfig;
  onUpdateConfig: (updates: Partial<BotConfig>) => void;
  onShowToast: (msg: string) => void;
  onOpenGatewaySetup: (gatewayId?: string) => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onShowToast,
  onOpenGatewaySetup,
}) => {
  if (!isOpen) return null;

  const plans = [
    {
      id: 'community',
      name: 'Developer Community',
      price: '$0',
      period: 'forever',
      description: 'Single-bot deployment with Groq & Gemini Flash failover.',
      features: ['2 Tier AI Failover', 'Telegram Gateway', '15-turn sliding memory', 'Community Discord Support'],
      active: false,
    },
    {
      id: 'pro_cluster',
      name: 'Pro Cloud Super-App',
      price: '$29',
      period: '/mo',
      description: '100-AI Failover Cascade, 10-Channel Gateways, and AI SEO YouTube Studio.',
      features: ['100-AI Redundancy Cascade', '10 Omni-Channel Gateways', 'Unlimited sliding memory', 'YouTube AI Auto-SEO & Scheduler', 'Sub-second LPU streaming'],
      highlight: true,
      active: false,
    },
    {
      id: 'enterprise_cluster',
      name: 'Enterprise Dedicated VPS',
      price: '$99',
      period: '/mo',
      description: 'Dedicated isolated server nodes, 2FA firewall whitelist, and custom LLM fine-tuning.',
      features: ['Isolated High-Mem Docker Nodes', 'Custom IP & 2FA Whitelists', 'Hourly Seismic/News Cron Worker', 'SLA 99.99% Zero Downtime Guarantee', '24/7 Dedicated Architect Support'],
      active: true,
    },
  ];

  const handleSelectPlan = (planId: string) => {
    onUpdateConfig({ userPlanTier: planId });
    onShowToast(`🎉 Switched to ${planId.replace('_', ' ').toUpperCase()} successfully!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Pro Plans & High-Concurrency Metering</h2>
              <p className="text-xs text-slate-400">Scale across millions of daily messages with zero downtime</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 rounded-xl transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`p-5 rounded-2xl border flex flex-col justify-between space-y-4 transition ${
                plan.highlight
                  ? 'bg-gradient-to-b from-indigo-950/40 to-slate-950 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                  : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">{plan.name}</span>
                  {config.userPlanTier === plan.id && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                      CURRENT
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                  <span className="text-xs text-slate-400">{plan.period}</span>
                </div>
                <p className="text-xs text-slate-400">{plan.description}</p>
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  {plan.features.map((feat, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleSelectPlan(plan.id)}
                className={`w-full py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  config.userPlanTier === plan.id
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                    : plan.highlight
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                {config.userPlanTier === plan.id ? 'Active Plan' : 'Select Plan'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
