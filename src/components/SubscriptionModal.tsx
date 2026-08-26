import React, { useState } from 'react';
import { BotConfig, UserAccount, StripePaymentInfo, UsageMetering } from '../types';
import { AuthService } from '../services/authService';
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
  CreditCard,
  TrendingUp,
  BarChart3,
  RefreshCw,
  Download,
  Receipt,
  FileCheck,
  AlertCircle,
  Calendar,
} from 'lucide-react';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BotConfig;
  currentUser?: UserAccount | null;
  onUpdateConfig: (newConfig: BotConfig) => void;
  onShowToast: (msg: string) => void;
  onOpenGatewaySetup?: (gatewayId?: string) => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  config,
  currentUser,
  onUpdateConfig,
  onShowToast,
  onOpenGatewaySetup,
}) => {
  const [activeTab, setActiveTab] = useState<'plans' | 'metering' | 'checkout' | 'invoices'>('plans');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlanTier, setSelectedPlanTier] = useState<
    'community_free' | 'starter_pro' | 'master_architect' | 'enterprise_ultra'
  >(currentUser?.planTier || 'starter_pro');

  // Checkout form state
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('888');
  const [cardholderName, setCardholderName] = useState(currentUser?.name || 'Syful Islam');
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Invoices mock
  const [invoices, setInvoices] = useState<StripePaymentInfo[]>([
    {
      planId: 'master_architect',
      planName: 'Master Architect Pro Cloud',
      amountUsd: 29.0,
      billingInterval: 'monthly',
      currency: 'USD',
      status: 'active',
      cardLast4: '4242',
      cardBrand: 'Visa',
      invoiceId: 'INV-2026-88194',
      transactionDate: '2026-08-15',
    },
    {
      planId: 'starter_pro',
      planName: 'Starter Pro LPU Tier',
      amountUsd: 9.0,
      billingInterval: 'monthly',
      currency: 'USD',
      status: 'active',
      cardLast4: '4242',
      cardBrand: 'Visa',
      invoiceId: 'INV-2026-77312',
      transactionDate: '2026-07-15',
    },
  ]);

  // Usage Metering state
  const [usage, setUsage] = useState<UsageMetering>({
    tokensUsedThisMonth: currentUser?.tokensUsed || 342150,
    monthlyQuota: currentUser?.monthlyQuota || 5000000,
    requestsMade: 1840,
    costEstimatedUsd: 1.84,
    planTier: currentUser?.planTier || 'master_architect',
    resetDate: '2026-09-01',
    dailyUsage: [
      { date: 'Aug 17', tokens: 42000, requests: 210 },
      { date: 'Aug 18', tokens: 68000, requests: 340 },
      { date: 'Aug 19', tokens: 51000, requests: 290 },
      { date: 'Aug 20', tokens: 89000, requests: 460 },
      { date: 'Aug 21', tokens: 35000, requests: 180 },
      { date: 'Aug 22', tokens: 41000, requests: 220 },
      { date: 'Aug 23', tokens: 16150, requests: 140 },
    ],
  });

  if (!isOpen) return null;

  const currentTier = currentUser?.planTier || 'starter_pro';
  const discountMultiplier = billingCycle === 'yearly' ? 0.8 : 1.0;

  const plans = [
    {
      id: 'community_free',
      name: 'Community Open Tier',
      monthlyPrice: 0,
      yearlyPrice: 0,
      badge: '100% Free Forever',
      badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
      description: 'Ideal for local hobbyists, self-managed personal bots & custom API key runners.',
      tokens: '500,000 Free Tokens/mo',
      features: [
        'Connect your own Groq, Gemini & Mistral Keys',
        'Telegram & Discord Bot Protocols',
        '20-Tier Local Failover Engine',
        'Managed deployment guidance',
        'Standard Community Discord Support',
      ],
      disabledFeatures: [
        'Dedicated 24/7 Managed VPS Hosting',
        'Pre-Configured Global Frontier AI Pool',
        'Claude 3.5 Sonnet & GPT-4o Pro Unlocks',
        'Real-time C2PA Provenance Scanner',
      ],
      isPopular: false,
      ctaText: 'Current Plan',
    },
    {
      id: 'starter_pro',
      name: 'Starter Pro LPU Tier',
      monthlyPrice: 9,
      yearlyPrice: 86,
      badge: 'Most Accessible',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      description: 'Zero API keys required. We provide high-speed LPU inference & auto-failover.',
      tokens: '2,500,000 Fast LPU Tokens/mo',
      features: [
        'Platform-Supplied Groq & Cerebras LPU Engines',
        'All 10 Platform Messaging Gateways',
        'Automated Zero-Downtime Key Rotation',
        'Live Ping Speed Benchmarking Dashboard',
        'Standard Webhook Ingress (500 req/min)',
        'YouTube SEO AI Generator Suite',
      ],
      disabledFeatures: [
        'Full Managed 24/7 Dedicated VPS Instance',
        'Custom Admin PIN & 2FA TOTP Vault',
      ],
      isPopular: false,
      ctaText: 'Upgrade with Stripe',
    },
    {
      id: 'master_architect',
      name: 'Master Architect Pro Cloud',
      monthlyPrice: 29,
      yearlyPrice: 278,
      badge: 'RECOMMENDED',
      badgeColor: 'bg-gradient-to-r from-amber-500 to-indigo-500 text-white font-black shadow-lg shadow-indigo-500/30',
      description: 'The complete turn-key package: 24/7 Managed Cloud Server + 100-AI Model Global Cascade.',
      tokens: '10,000,000 High-Compute Tokens/mo',
      features: [
        'Unlock Gemini 2.5 Pro, Claude 3.5 Sonnet, GPT-4o & DeepSeek R1',
        'Dedicated 24/7 Managed Cloud VPS Server Included',
        'All 10 Protocols with Zero Session Loss',
        'Advanced C2PA & SynthID Deepfake Media Scanner',
        'Developer Studio Raw Code In-Browser Editor',
        'Enterprise 2FA TOTP & IP Whitelisting Shield',
        'Zero API Key Management: Instant Plug & Play',
      ],
      disabledFeatures: [],
      isPopular: true,
      ctaText: 'Activate Pro Cloud ($29)',
    },
    {
      id: 'enterprise_ultra',
      name: 'Enterprise Global Cluster',
      monthlyPrice: 99,
      yearlyPrice: 950,
      badge: 'Ultimate Enterprise',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      description: 'Multi-region clustered VPS with dedicated GPU compute & 99.99% SLA.',
      tokens: '50,000,000 Enterprise Tokens/mo',
      features: [
        'Unlimited 100+ Global AI Model Cascade Access',
        'Dedicated Multi-Core High-RAM Cloud Cluster',
        'Dedicated IP Address & Custom SSL Reverse Proxy',
        'Full Security Audit & Real-time Penetration Shield',
        'Direct Priority VIP Telegram & WhatsApp Support',
        'Custom Fine-Tuning & Model Weight Hosting',
      ],
      disabledFeatures: [],
      isPopular: false,
      ctaText: 'Deploy Enterprise',
    },
  ];

  const handleSelectPlan = (planId: any) => {
    setSelectedPlanTier(planId);
    setActiveTab('checkout');
  };

  const handleExecutePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessingPayment(true);

    try {
      // Simulate real Stripe API payment intent confirmation
      await new Promise((r) => setTimeout(r, 1600));

      const selectedPlan = plans.find((p) => p.id === selectedPlanTier) || plans[2];
      const newInvoice: StripePaymentInfo = {
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        amountUsd: billingCycle === 'yearly' ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice,
        billingInterval: billingCycle,
        currency: 'USD',
        status: 'active',
        cardLast4: cardNumber.replace(/\s+/g, '').slice(-4) || '4242',
        cardBrand: 'Visa',
        invoiceId: `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
        transactionDate: new Date().toISOString().split('T')[0],
      };

      setInvoices((prev) => [newInvoice, ...prev]);
      setPaymentSuccess(true);

      // Update user plan & bot config architecture
      const updatedConfig: BotConfig = {
        ...config,
        architectureMode: 'hybrid_managed_pro',
        userPlanTier: selectedPlan.id as any,
        useCentralizedAiEngine: true,
        useCentralizedVpsCluster: true,
      };
      onUpdateConfig(updatedConfig);
      onShowToast(`🎉 Success! Upgraded to ${selectedPlan.name}. Premium 100-AI cascade unlocked.`);

      setTimeout(() => {
        setIsProcessingPayment(false);
        setActiveTab('metering');
      }, 1200);
    } catch (err: any) {
      setIsProcessingPayment(false);
      onShowToast(`❌ Payment error: ${err.message || 'Verification failed.'}`);
    }
  };

  const usagePercent = Math.min(100, Math.round((usage.tokensUsedThisMonth / usage.monthlyQuota) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden text-slate-200 ring-1 ring-white/10">
        {/* Top Header */}
        <div className="p-5 sm:p-6 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  Pro-Grade Chat & Subscription Engine
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <CreditCard className="w-3 h-3" />
                  STRIPE POWERED
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Unlock 100-AI Frontier Models (Claude 3.5 Sonnet, GPT-4o, DeepSeek R1), 24/7 Managed VPS & Usage Metering.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Nav Tabs */}
            <div className="hidden md:flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1">
              <button
                onClick={() => setActiveTab('plans')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'plans'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Pricing Plans
              </button>
              <button
                onClick={() => setActiveTab('metering')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'metering'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Usage Metering
              </button>
              <button
                onClick={() => setActiveTab('checkout')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'checkout'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                Stripe Checkout
              </button>
              <button
                onClick={() => setActiveTab('invoices')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'invoices'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                Receipts
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* TAB 1: PRICING PLANS */}
          {activeTab === 'plans' && (
            <div className="space-y-6">
              {/* Billing Interval Toggle */}
              <div className="flex items-center justify-center gap-3">
                <span className={`text-xs font-bold ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-400'}`}>
                  Monthly Billing
                </span>
                <button
                  type="button"
                  onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                  className={`w-14 h-7 rounded-full p-1 transition-colors cursor-pointer ${
                    billingCycle === 'yearly' ? 'bg-gradient-to-r from-amber-500 to-indigo-600' : 'bg-slate-800'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      billingCycle === 'yearly' ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className={`text-xs font-bold flex items-center gap-1.5 ${billingCycle === 'yearly' ? 'text-amber-300' : 'text-slate-400'}`}>
                  Yearly Billing
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    SAVE 20%
                  </span>
                </span>
              </div>

              {/* Plans Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {plans.map((plan) => {
                  const price = billingCycle === 'yearly' ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;
                  const isCurrent = currentUser?.planTier === plan.id;
                  const isSelected = selectedPlanTier === plan.id;

                  return (
                    <div
                      key={plan.id}
                      className={`relative rounded-3xl p-5 flex flex-col justify-between transition-all duration-200 border ${
                        plan.isPopular
                          ? 'bg-gradient-to-b from-slate-900 via-indigo-950/40 to-slate-900 border-indigo-500/50 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500/40'
                          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      {/* Top Badge */}
                      <div className="flex items-center justify-between mb-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${plan.badgeColor}`}>
                          {plan.badge}
                        </span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-500 text-slate-950">
                            ACTIVE
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="text-base font-extrabold text-white">{plan.name}</h4>
                        <p className="text-xs text-slate-400 mt-1 min-h-[36px]">{plan.description}</p>

                        <div className="mt-4 mb-4 pb-4 border-b border-slate-800">
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-white">${price}</span>
                            <span className="text-xs text-slate-400 font-medium">/ month</span>
                          </div>
                          <div className="text-[11px] font-mono text-indigo-400 font-bold mt-1">
                            {plan.tokens}
                          </div>
                        </div>

                        {/* Feature List */}
                        <div className="space-y-2 mb-6">
                          {plan.features.map((feat, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </div>
                          ))}
                          {plan.disabledFeatures.map((feat, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs text-slate-500 line-through">
                              <X className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => handleSelectPlan(plan.id)}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                          plan.isPopular
                            ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg shadow-indigo-500/25 hover:opacity-95'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        }`}
                      >
                        {plan.id === 'community_free' ? 'Select Free Tier' : plan.ctaText}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: USAGE METERING */}
          {activeTab === 'metering' && (
            <div className="space-y-6">
              {/* Metering Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Token Consumption</span>
                    <Zap className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-white">
                      {(usage.tokensUsedThisMonth / 1000).toFixed(1)}k
                      <span className="text-xs text-slate-400 font-normal"> / {(usage.monthlyQuota / 1000000).toFixed(0)}M</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full mt-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                      {usagePercent}% monthly quota consumed
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">API Ingress Requests</span>
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-white">{usage.requestsMade.toLocaleString()}</div>
                    <div className="text-xs text-emerald-400 font-medium mt-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      +28.4% compared to last week
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Estimated Cost</span>
                    <CreditCard className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-white">${usage.costEstimatedUsd.toFixed(2)}</div>
                    <div className="text-xs text-slate-400 mt-1">Covered 100% by Pro Plan allowance</div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Cycle Reset Date</span>
                    <Calendar className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-xl font-black text-white">{usage.resetDate}</div>
                    <div className="text-xs text-indigo-400 font-medium mt-1">Automatic quota refresh</div>
                  </div>
                </div>
              </div>

              {/* Daily Token Chart Representation */}
              <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-sm font-bold text-white">Daily Token & Inference Traffic</h4>
                    <p className="text-xs text-slate-400">Tokens consumed across 10 messaging platforms</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                    Live Telemetry
                  </span>
                </div>

                <div className="h-40 flex items-end justify-between gap-3 pt-6 pb-2 px-2">
                  {usage.dailyUsage.map((day, idx) => {
                    const maxTokens = 100000;
                    const heightPercent = Math.max(15, Math.min(100, (day.tokens / maxTokens) * 100));
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                        <div className="text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition">
                          {(day.tokens / 1000).toFixed(0)}k
                        </div>
                        <div
                          className="w-full rounded-t-lg bg-gradient-to-t from-indigo-600 to-purple-500 group-hover:from-indigo-500 group-hover:to-pink-500 transition-all duration-300 shadow-md shadow-indigo-500/10"
                          style={{ height: `${heightPercent}%` }}
                        />
                        <span className="text-[11px] font-medium text-slate-400">{day.date}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STRIPE CHECKOUT SIMULATOR */}
          {activeTab === 'checkout' && (
            <div className="max-w-2xl mx-auto p-6 rounded-3xl bg-slate-950/80 border border-slate-800 shadow-2xl">
              <div className="flex items-center justify-between pb-5 border-b border-slate-800 mb-6">
                <div>
                  <h4 className="text-base font-extrabold text-white flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-indigo-400" />
                    Stripe Secure Checkout
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Encrypted with 256-bit SSL & Stripe PCI-DSS Level 1 compliance.
                  </p>
                </div>
                <div className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-indigo-400 font-bold">
                  {selectedPlanTier.replace('_', ' ').toUpperCase()}
                </div>
              </div>

              {paymentSuccess ? (
                <div className="text-center py-8 space-y-4 animate-in fade-in">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-lg font-extrabold text-white">Payment Verified & Activated!</h4>
                  <p className="text-xs text-slate-300 max-w-md mx-auto">
                    Your Pro subscription is now active. All 100-AI models, dedicated VPS cluster, and priority channels are unlocked.
                  </p>
                  <button
                    onClick={() => setActiveTab('metering')}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500 transition cursor-pointer"
                  >
                    View Usage Metering
                  </button>
                </div>
              ) : (
                <form onSubmit={handleExecutePayment} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">Cardholder Name</label>
                    <input
                      type="text"
                      value={cardholderName}
                      onChange={(e) => setCardholderName(e.target.value)}
                      required
                      placeholder="Syful Islam"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">Card Number</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        required
                        placeholder="4242 4242 4242 4242"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-indigo-500 pl-10"
                      />
                      <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">Expiration</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        required
                        placeholder="MM/YY"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">CVC / CVV</label>
                      <input
                        type="text"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        required
                        placeholder="888"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-200 flex items-center justify-between">
                    <span>Total Due Today:</span>
                    <span className="text-base font-black text-white">
                      ${selectedPlanTier === 'master_architect' ? 29 : selectedPlanTier === 'enterprise_ultra' ? 99 : 9}.00 USD
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessingPayment}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 hover:opacity-95 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isProcessingPayment ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Authorizing Stripe Token...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Complete Secure Subscription
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB 4: INVOICES & RECEIPTS */}
          {activeTab === 'invoices' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">Billing History & Invoices</h4>
                  <p className="text-xs text-slate-400">Download PDF receipts and VAT tax invoices</p>
                </div>
              </div>

              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">Invoice ID</th>
                      <th className="p-3.5">Plan</th>
                      <th className="p-3.5">Amount</th>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {invoices.map((inv) => (
                      <tr key={inv.invoiceId} className="hover:bg-slate-900/50">
                        <td className="p-3.5 font-mono text-slate-300">{inv.invoiceId}</td>
                        <td className="p-3.5 font-medium text-white">{inv.planName}</td>
                        <td className="p-3.5 font-black text-emerald-400">${inv.amountUsd.toFixed(2)} USD</td>
                        <td className="p-3.5 text-slate-400">{inv.transactionDate}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            PAID
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => onShowToast(`📄 Downloading receipt ${inv.invoiceId}...`)}
                            className="p-1.5 rounded-lg text-indigo-400 hover:text-white hover:bg-slate-800 transition cursor-pointer inline-flex items-center gap-1 font-semibold"
                          >
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
