import React, { useState } from 'react';
import { BotConfig } from '../types';
import {
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Zap,
  Server,
  Cpu,
  Send,
  MessageSquare,
  Lock,
  ArrowRight,
  Check,
  X,
  Clock,
  ExternalLink,
  Flame,
  Radio,
  Sliders,
  Layers,
  Bell,
  HelpCircle,
} from 'lucide-react';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BotConfig;
  onUpdateConfig: (newConfig: BotConfig) => void;
  onShowToast: (msg: string) => void;
  onOpenGatewaySetup?: (gatewayId?: string) => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onShowToast,
  onOpenGatewaySetup,
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [joinedWaitlist, setJoinedWaitlist] = useState(false);

  if (!isOpen) return null;

  const handleJoinWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail.trim() || !waitlistEmail.includes('@')) {
      onShowToast('⚠️ Please enter a valid email address.');
      return;
    }
    setJoinedWaitlist(true);
    onShowToast(`🎉 You're on the priority waitlist! We will notify ${waitlistEmail} at launch.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-200 ring-1 ring-white/10">
        {/* Header Bar */}
        <div className="p-5 sm:p-6 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-white tracking-tight">
                  Subscription & Managed Plans Portal
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  PRO PLANS COMING SOON
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Compare Self-Managed Community tiers and our upcoming Hybrid Managed Cloud Plans.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Top Coming Soon Launch Notice */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-indigo-950/40 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white">Hybrid Managed Cloud Pro Tiers</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500 text-slate-950 animate-pulse">
                    LAUNCHING SOON
                  </span>
                </div>
                <p className="text-xs text-amber-200/80 mt-0.5 leading-relaxed">
                  Get full 24/7 managed VPS hosting and platform-supplied 20-tier AI engines. Pro Plan customers only connect their own messaging tokens (Telegram, Discord, WhatsApp, Slack, etc.) without worrying about VPS setup or AI API keys!
                </p>
              </div>
            </div>

            {/* Quick Waitlist Form */}
            {!joinedWaitlist ? (
              <form onSubmit={handleJoinWaitlist} className="flex items-center gap-1.5 shrink-0">
                <input
                  type="email"
                  placeholder="name@email.com"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 w-44"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer"
                >
                  Join Waitlist
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Priority Access Reserved</span>
              </div>
            )}
          </div>

          {/* Architecture Concept Explainer: User Managed Messaging vs Platform Managed AI */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-2">
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                <Send className="w-4 h-4 text-indigo-400" />
                <span>1. Customer Managed (Your Control)</span>
              </div>
              <h4 className="text-sm font-bold text-white">Your Messaging Gateway Tokens</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                You configure only your own bot tokens across 10 platforms: <strong>Telegram</strong>, <strong>Discord</strong>, <strong>WhatsApp Cloud</strong>, <strong>Slack</strong>, <strong>LINE</strong>, <strong>Matrix</strong>, <strong>Twilio</strong>, <strong>Pushover</strong>, <strong>Pyrogram</strong>, and <strong>Apprise</strong>.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => {
                    onClose();
                    if (onOpenGatewaySetup) onOpenGatewaySetup('telegram');
                  }}
                  className="text-xs text-indigo-300 hover:text-indigo-200 font-semibold flex items-center gap-1 cursor-pointer hover:underline"
                >
                  <span>Configure your bot tokens in 1-Click Portal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 space-y-2">
              <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold uppercase tracking-wider">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>2. Platform Managed (Zero Effort)</span>
              </div>
              <h4 className="text-sm font-bold text-white">Centralized AI & 24/7 VPS Cluster</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                The platform runs the 24/7 cloud VPS server and automatically supplies pre-configured multi-tier AI keys (Groq LPU, Gemini 2.5 Flash, Cerebras, OpenRouter, SambaNova, etc.) with automated failover and 429 rate limit queues.
              </p>
              <div className="pt-2 flex items-center gap-2 text-xs text-cyan-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Zero AI API keys required from user in Pro Plan</span>
              </div>
            </div>
          </div>

          {/* Pricing & Plan Cards Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-white">Available Plans & Infrastructure Options</h4>
                <p className="text-xs text-slate-400">Choose between open self-hosting or our upcoming fully managed service.</p>
              </div>

              {/* Billing Toggle */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                    billingCycle === 'monthly' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('yearly')}
                  className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
                    billingCycle === 'yearly' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>Yearly</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">20% OFF</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* PLAN 1: Community Self-Managed (Current Active) */}
              <div className="p-5 rounded-3xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between space-y-5 hover:border-slate-700 transition">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      Community Edition
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 font-semibold">
                      CURRENT PLAN
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-extrabold text-white">Self-Hosted Free</h3>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-white">$0</span>
                      <span className="text-xs text-slate-400">/ forever</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Run on your own free Render, Koyeb, or local server. You provide your own AI keys and messaging tokens.
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-3 border-t border-slate-800/80 text-xs">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>10 Messaging Gateways (User Tokens)</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>20 AI Providers (User Supplies Free Keys)</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Full Python Source Code & ZIP Export</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Free Cloud Deployment Walkthroughs</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500">
                      <X className="w-4 h-4 text-slate-600 shrink-0" />
                      <span>Managed 24/7 VPS Server (Self-Hosted)</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer"
                >
                  Active in Current Session
                </button>
              </div>

              {/* PLAN 2: Hybrid Managed Pro Plan (COMING SOON) */}
              <div className="relative p-5 rounded-3xl bg-gradient-to-b from-indigo-950/60 via-slate-900 to-slate-950 border-2 border-indigo-500/50 flex flex-col justify-between space-y-5 shadow-xl shadow-indigo-500/10">
                {/* Prominent Coming Soon Floating Ribbon */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3.5 py-1 rounded-full text-[11px] font-extrabold bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md flex items-center gap-1.5 uppercase tracking-wide">
                    <Clock className="w-3.5 h-3.5" />
                    COMING SOON
                  </span>
                </div>

                <div className="space-y-4 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      Hybrid Managed Pro
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 font-semibold">
                      POPULAR
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-extrabold text-white">Cloud Pro Managed</h3>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-white">{billingCycle === 'yearly' ? '$12' : '$15'}</span>
                      <span className="text-xs text-slate-400">/ month</span>
                    </div>
                    <p className="text-xs text-indigo-200/90 mt-2">
                      Connect your messaging bots. <strong>We supply the 24/7 VPS & all 20 AI API keys</strong> with high-speed rotation.
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-3 border-t border-indigo-500/20 text-xs">
                    <div className="flex items-center gap-2 text-indigo-200 font-medium">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Customer Only Inputs Bot Tokens (Telegram, Discord...)</span>
                    </div>
                    <div className="flex items-center gap-2 text-indigo-200 font-medium">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Zero AI API Keys Required (Platform Supplied)</span>
                    </div>
                    <div className="flex items-center gap-2 text-indigo-200 font-medium">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>24/7 Managed Cloud VPS Uptime Guarantee</span>
                    </div>
                    <div className="flex items-center gap-2 text-indigo-200 font-medium">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Automated 20-Tier AI Failover & Cooldown Recovery</span>
                    </div>
                    <div className="flex items-center gap-2 text-indigo-200 font-medium">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Priority Support & Auto-Updates</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => {
                      onShowToast('🚀 Hybrid Managed Pro Plan is launching soon! You can join the waitlist above.');
                    }}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Coming Soon — Get Notified</span>
                  </button>
                  <p className="text-[10px] text-center text-slate-400">No credit card charged now.</p>
                </div>
              </div>

              {/* PLAN 3: Enterprise Custom Cluster (COMING SOON) */}
              <div className="relative p-5 rounded-3xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between space-y-5 hover:border-slate-700 transition">
                <div className="absolute -top-3 right-4">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                    COMING SOON
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      Dedicated Cluster
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-extrabold text-white">Enterprise Managed</h3>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-white">{billingCycle === 'yearly' ? '$39' : '$49'}</span>
                      <span className="text-xs text-slate-400">/ month</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Dedicated isolated VPS instances, custom fine-tuned models, and SLA uptime backing.
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-3 border-t border-slate-800/80 text-xs">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Dedicated Single-Tenant VPS Node</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Unlimited Custom Messaging Webhooks</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Private Model Fine-Tuning & Vector DB</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>99.9% Uptime SLA & Dedicated Admin Escalation</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onShowToast('🏢 Enterprise Dedicated Clusters will launch alongside Pro Plans!');
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Coming Soon</span>
                </button>
              </div>
            </div>
          </div>

          {/* FAQ & Information Box */}
          <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-indigo-400" />
              <span>How does the Hybrid Managed Model work?</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-400">
              <div className="space-y-1">
                <span className="font-semibold text-white">1. You bring your bot tokens</span>
                <p>You create your bot on Telegram via @BotFather or Discord Developer Portal and paste the token here.</p>
              </div>
              <div className="space-y-1">
                <span className="font-semibold text-white">2. We supply the infrastructure</span>
                <p>Our centralized 24/7 cloud VPS hosts the bot daemon and provides pre-funded multi-tier AI keys.</p>
              </div>
              <div className="space-y-1">
                <span className="font-semibold text-white">3. Zero maintenance for you</span>
                <p>No terminal commands, no server crashes, and no rate limit errors to worry about.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Self-Hosted Community Edition is 100% Free and available right now</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
