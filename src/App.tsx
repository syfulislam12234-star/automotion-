import React, { useState, useEffect } from 'react';
import { BotConfig, UserAccount, AuthSession } from './types';
import { Navbar } from './components/Navbar';
import { ConfigPanel } from './components/ConfigPanel';
import { TelegramSimulator } from './components/TelegramSimulator';
import { DeployGuideModal } from './components/DeployGuideModal';
import { MemoryInspector } from './components/MemoryInspector';
import { AdminControlPanel } from './components/AdminControlPanel';
import { ApiPortalModal } from './components/ApiPortalModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import { AuthModal } from './components/AuthModal';
import { VpsManager } from './components/VpsManager';
import { AiMediaScanner } from './components/AiMediaScanner';
import { AiChatModal } from './components/AiChatModal';
import { AiCascadeDashboard } from './components/AiCascadeDashboard';
import { PerformanceDashboard } from './components/PerformanceDashboard';
import { OmniChannelGateway } from './components/OmniChannelGateway';
import { EnterpriseSecurity } from './components/EnterpriseSecurity';
import { YouTubeStudioModal } from './components/YouTubeStudioModal';
import { CronBroadcastManager } from './components/CronBroadcastManager';
import { Sidebar, AppView } from './components/Sidebar';
import { AuthService } from './services/authService';
import {
  Rocket,
  Bot,
  Zap,
  Brain,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Terminal,
  Layers,
  Repeat,
  LayoutDashboard,
  Cpu,
  Radio,
  Video,
  Globe,
  Lock,
  Unlock,
  Shield,
  Key,
  Server,
  Activity,
  User,
  Fingerprint,
  Scan,
  MessageSquare,
  MessageCircle,
  TrendingUp,
  Clock,
} from 'lucide-react';

const DEFAULT_CONFIG: BotConfig = {
  modelName: 'llama-3.3-70b-versatile',
  maxMemoryTurns: 15,
  memoryTtlMinutes: 120,
  temperature: 0.7,
  maxOutputTokens: 2048,
  systemPrompt:
    'You are a versatile, intelligent multi-platform AI assistant powered by a 20-tier auto-failover engine. Provide clear, accurate, and concise Markdown answers across Telegram, Discord, Slack, and WhatsApp.',
  botName: 'Universal Multi-Platform 20-AI Bot',
  enableAdminWhitelist: false,
  adminUserIds: '',
  enableStreamTyping: true,
  enableMarkdownV2: true,
  enableStatsCommand: true,
  enableCustomPromptCommand: true,

  // Hybrid AI Ensemble & Super-Brain System
  enableHybridEnsemble: true,
  ensembleStrategy: 'super_brain_synthesis',
  ensemblePrimaryProviders: ['groq', 'gemini', 'cerebras', 'openrouter'],
  ensembleTimeoutMs: 3500,
  enableEnsembleComparisonTelemetry: true,

  // Multi-Provider & Key Rotation (20 AI Providers)
  enableMultiProviderFallback: true,
  groqKeysCount: 2,
  keyCooldownSeconds: 60,

  // 1. Google AI Studio
  enableGeminiFallback: true,
  geminiModel: 'gemini-3.7-flash',
  geminiApiKey: '',

  // 2. Groq
  groqModel: 'llama-3.3-70b-versatile',
  groqApiKey: '',

  // 3. OpenRouter
  enableOpenRouterFallback: true,
  openrouterModel: 'deepseek/deepseek-r1:free',
  openrouterApiKey: '',

  // 4. Cerebras
  enableCerebrasFallback: true,
  cerebrasModel: 'llama3.3-70b',
  cerebrasApiKey: '',

  // 5. Mistral AI
  enableMistralFallback: true,
  mistralModel: 'mistral-small-latest',
  mistralApiKey: '',

  // 6. Cloudflare Workers AI
  enableCloudflareFallback: true,
  cloudflareAccountId: '',
  cloudflareApiToken: '',
  cloudflareModel: '@cf/meta/llama-3.3-70b-instruct',

  // 7. GitHub Models
  enableGithubModelsFallback: true,
  githubToken: '',
  githubModel: 'gpt-4o-mini',

  // 8. Hugging Face
  enableHuggingFaceFallback: true,
  huggingfaceApiKey: '',
  huggingfaceModel: 'meta-llama/Llama-3.3-70B-Instruct',

  // 9. Pollinations AI (Zero key free)
  enablePollinationsFallback: true,
  pollinationsModel: 'openai',

  // 10. Cohere
  enableCohereFallback: true,
  cohereApiKey: '',
  cohereModel: 'command-r-plus-08-2024',

  // 11. NVIDIA NIM
  enableNvidiaNimFallback: true,
  nvidiaNimApiKey: '',
  nvidiaNimModel: 'meta/llama-3.3-70b-instruct',

  // 12. Together AI
  enableTogetherFallback: true,
  togetherModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  togetherApiKey: '',

  // 13. SambaNova
  enableSambaNovaFallback: true,
  sambanovaApiKey: '',
  sambanovaModel: 'Meta-Llama-3.3-70B-Instruct',

  // 14. DeepInfra
  enableDeepInfraFallback: true,
  deepinfraApiKey: '',
  deepinfraModel: 'meta-llama/Meta-Llama-3.3-70B-Instruct',

  // 15. Chutes AI
  enableChutesFallback: true,
  chutesApiKey: '',
  chutesModel: 'deepseek-ai/DeepSeek-V3',

  // 16. Voyage AI
  enableVoyageFallback: true,
  voyageApiKey: '',
  voyageModel: 'voyage-3-large',

  // 17. Replicate
  enableReplicateFallback: true,
  replicateApiToken: '',
  replicateModel: 'meta/meta-llama-3-70b-instruct',

  // 18. Vercel AI Gateway
  enableVercelAiFallback: true,
  vercelAiToken: '',
  vercelAiModel: 'openai/gpt-4o-mini',

  // 19. DeepSeek Official
  enableDeepSeekFallback: true,
  deepseekApiKey: '',
  deepseekModel: 'deepseek-chat',

  // 20. Ollama Local Server
  enableOllamaFallback: true,
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.3:latest',

  // Admin Alerting & Heartbeats
  adminTelegramId: '',
  discordAdminWebhookUrl: '',
  enableAdminAlerts: true,
  enableHeartbeatNotifications: true,

  // Telegram Admin Bot Controller
  enableTelegramAdminController: true,
  telegramAdminBotToken: '',
  telegramAdminChatId: '',
  telegramAdminStrictWhitelist: true,
  telegramAdminAllowRestart: true,

  // 10 Platform Messaging Gateways
  enableTelegram: true,
  telegramBotToken: '',

  enableDiscord: true,
  discordBotToken: '',

  enableSlack: true,
  slackBotToken: '',
  slackAppToken: '',
  slackSigningSecret: '',

  enableWhatsApp: true,
  whatsappPhoneNumberId: '',
  whatsappAccessToken: '',
  whatsappVerifyToken: '',

  enableTwilio: true,
  twilioAccountSid: '',
  twilioAuthToken: '',
  twilioPhoneNumber: '',
  twilioToNumber: '',

  enableLine: true,
  lineChannelSecret: '',
  lineChannelAccessToken: '',

  enableMatrix: true,
  matrixHomeserver: 'https://matrix.org',
  matrixUserId: '',
  matrixAccessToken: '',
  matrixRoomId: '',

  enablePyrogram: true,
  pyrogramApiId: '',
  pyrogramApiHash: '',
  pyrogramSessionString: '',

  enableApprise: true,
  appriseUrls: '',

  enablePushover: true,
  pushoverUserKey: '',
  pushoverAppToken: '',

  // YouTube OAuth2 & AI SEO Automation
  enableYouTubeAutomation: true,
  youtubeApiKey: '',
  youtubeClientId: '',
  youtubeClientSecret: '',
  youtubeRefreshToken: '',
  youtubeChannelId: '',
  youtubeDefaultCategory: '27',
  youtubeDefaultPrivacy: 'public',
  enableYtAutoSeo: true,
  enableYtAutoUploadQueue: true,

  // Cloud & Deployment Settings
  deploymentMode: 'polling_with_health',
  serverPort: 8080,
  webhookUrl: '',

  // Pro SaaS Customer Profile & Subscription Tiers
  userProfileName: 'Syful Islam',
  userPlanTier: 'enterprise_cluster',

  // VPS / Cloud Server Management & Monitoring
  vpsServerName: 'Universal-Cloud-Node-01',
  vpsApiBaseUrl: 'http://127.0.0.1:8080',
  vpsAuthBearerToken: '',
  vpsPollIntervalSeconds: 3,
  vpsAutoReconnect: true,

  // n8n Webhook & Automation Integration
  n8nWebhookUrl: '',
  n8nAlertsEnabled: true,
  n8nEventTriggers: {
    onStatusChange: true,
    onHighCpu: true,
    onRestart: true,
    onFailover: true,
    onSecurityAlert: true,
  },
};

const CONFIG_STORAGE_KEY = 'universal_bot_config_v2';

const getInitialConfig = (): BotConfig => {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load config from localStorage:', e);
  }
  return DEFAULT_CONFIG;
};

export default function App() {
  const [config, setConfig] = useState<BotConfig>(getInitialConfig);

  // User Authentication & Session State
  const [session, setSession] = useState<AuthSession | null>(() => {
    return AuthService.getCurrentSession();
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdminPortalOpen, setIsAdminPortalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'signup' | 'verify'>('login');
  const [authFeatureContext, setAuthFeatureContext] = useState<string | undefined>(undefined);
  const currentUser = session?.user || null;

  // Active View Tab Navigation
  const [activeTab, setActiveTab] = useState<
    AppView
  >('simulator');
  const [isDeployGuideOpen, setIsDeployGuideOpen] = useState(false);
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isYouTubeStudioOpen, setIsYouTubeStudioOpen] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(true);
  const [portalInitialServiceId, setPortalInitialServiceId] = useState<string | undefined>(undefined);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Sync session & load permanently saved user bot config from server database on mount
  useEffect(() => {
    let isMounted = true;
    AuthService.syncSessionWithServer().then(({ session: updatedSession, botConfig: serverConfig }) => {
      if (!isMounted) return;
      if (updatedSession) {
        setSession(updatedSession);
      }
      if (serverConfig) {
        setConfig((prev) => ({ ...prev, ...serverConfig }));
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleConfigChange = async (newConfig: BotConfig): Promise<boolean> => {
    const previousConfig = config;
    setConfig(newConfig);
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
    } catch (e) {
      console.error('Failed to persist config to localStorage:', e);
    }
    // Permanently sync with server database
    const saved = await AuthService.saveUserBotConfig(newConfig, currentUser?.id);
    if (!saved) {
      setConfig(previousConfig);
      try {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(previousConfig));
      } catch (e) {
        console.error('Failed to restore previous config in localStorage:', e);
      }
    }
    return saved;
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Protected Gatekeeper
  const requireAuth = (featureName: string, action: () => void) => {
    if (!currentUser) {
      setAuthFeatureContext(featureName);
      setAuthModalTab('login');
      setIsAuthModalOpen(true);
      showToast(`🔒 Please log in to access ${featureName}.`);
      return;
    }
    if (!currentUser.isVerified) {
      setAuthFeatureContext(featureName);
      setAuthModalTab('verify');
      setIsAuthModalOpen(true);
      showToast(`⚠️ Please verify your 6-digit email OTP to access ${featureName}.`);
      return;
    }
    action();
  };

  const handleAuthenticated = (newSession: AuthSession) => {
    setSession(newSession);
    showToast(`✅ Welcome, ${newSession.user.name}! Session active.`);
  };

  const handleLogOut = () => {
    AuthService.logOut();
    setSession(null);
    setActiveTab('simulator');
    showToast('👋 You have been logged out.');
  };

  const handleSidebarSelect = (view: AppView) => {
    if (view === 'admin') {
      handleAdminTabClick();
      return;
    }
    if (view === 'vps') {
      handleVpsTabClick();
      return;
    }
    setActiveTab(view);
  };

  const handleAdminTabClick = () => {
    requireAuth('Admin Dashboard', () => {
      if (currentUser?.role !== 'admin') return;
      setActiveTab('admin');
    });
  };

  const handleVpsTabClick = () => {
    requireAuth('VPS & Cloud Server Monitor', () => {
      if (currentUser?.role !== 'admin') return;
      setActiveTab('vps');
    });
  };

  const handleResetToDefaults = () => {
    setConfig(DEFAULT_CONFIG);
    try {
      localStorage.removeItem(CONFIG_STORAGE_KEY);
    } catch (e) {
      console.error(e);
    }
    showToast('🔄 All configurations reset to high-resilience defaults.');
  };

  const handleOpenPortal = (serviceId?: string) => {
    setPortalInitialServiceId(serviceId);
    setIsPortalOpen(true);
  };

  if (!currentUser) {
    const isAdminLoginRoute = window.location.pathname === '/admin/login';
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <AuthModal
          isOpen
          isGateMode
          initialTab="login"
          onAuthenticated={handleAuthenticated}
          onShowToast={showToast}
          isAdminPortal={isAdminLoginRoute}
          featureProtectedName={isAdminLoginRoute ? 'the administrator portal' : 'the Universal Bot workspace'}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row font-sans selection:bg-cyan-500 selection:text-white">
      <Sidebar
        isOpen={isSidebarOpen}
        activeView={activeTab}
        onClose={() => setIsSidebarOpen(false)}
        onSelectView={handleSidebarSelect}
        onOpenAuth={() => { setAuthFeatureContext(undefined); setAuthModalTab('login'); setIsAuthModalOpen(true); }}
        onLogOut={handleLogOut}
        currentUser={currentUser}
      />
      <div className="min-w-0 flex-1 flex flex-col">
      {/* Universal Super-App Navbar */}
      <Navbar
        currentUser={currentUser}
        onOpenAuthModal={(tab) => {
          setAuthFeatureContext(undefined);
          setAuthModalTab(tab || 'login');
          setIsAuthModalOpen(true);
        }}
        onLogOut={handleLogOut}
        onOpenDeployGuide={() => setIsDeployGuideOpen(true)}
        onOpenPortal={() => handleOpenPortal('groq')}
        onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
        onOpenYouTubeStudio={() => setIsYouTubeStudioOpen(true)}
        onOpenAiChat={() => setIsAiChatOpen(true)}
        onToggleSidebar={() => setIsSidebarOpen(true)}
        onOpenAdminPortal={() => setIsAdminPortalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Hero Banner with Quick Navigation */}
        <section className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden ring-1 ring-white/5">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-lg shadow-cyan-500/20">
                  ENTERPRISE 100-AI SUPER-APP
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <Activity className="w-3 h-3 animate-pulse" />
                  SLA 99.999%
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Universal Multi-Platform Bot & AI Generator
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Connect Telegram, Discord, Slack, and WhatsApp to a zero-downtime 100-AI model cascade with automated key rotation, YouTube video lifecycle studio, and enterprise security firewall.
              </p>
            </div>

            {/* Hero Quick Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={() => setIsSubscriptionModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Pro Plans & Metering</span>
              </button>
              <button
                onClick={() => setIsYouTubeStudioOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-red-500/20 transition flex items-center gap-2 cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>YouTube Studio</span>
              </button>
            </div>
          </div>

          {/* Feature Highlights Grid */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>100-AI Model Failover</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>10 Messaging Gateways</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>YouTube SEO & C2PA Scan</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>IP Whitelist & 2FA</span>
            </div>
          </div>
        </section>

        {/* Top View Selector Navigation Bar */}
        <div className="hidden">
          <div className="flex items-center gap-1.5 min-w-max">
            {/* View 1: Live Gateway Simulator */}
            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'simulator'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>Live Simulator</span>
            </button>

            {/* View 2: Performance Dashboard (Real-Time 100-AI Telemetry) */}
            <button
              onClick={() => setActiveTab('performance')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'performance'
                  ? 'bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-600 text-white shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>Performance Dashboard</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                100-AI
              </span>
            </button>

            {/* View 3: 100-AI Cascade Engine */}
            <button
              onClick={() => setActiveTab('cascade')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'cascade'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Layers className="w-4 h-4 text-amber-400" />
              <span>100-AI Cascade</span>
            </button>

            {/* View 3: 3-Hour Automated Cron Broadcast Worker */}
            <button
              onClick={() => setActiveTab('cron')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'cron'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Clock className="w-4 h-4 text-amber-400" />
              <span>3H Cron Broadcast</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                10 Chats
              </span>
            </button>

            {/* View 4: Omni-Channel Gateways */}
            <button
              onClick={() => setActiveTab('gateways')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'gateways'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Radio className="w-4 h-4 text-cyan-400" />
              <span>10 Gateways</span>
            </button>

            {/* View 4: Enterprise Security & 2FA */}
            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'security'
                  ? 'bg-gradient-to-r from-emerald-500 to-indigo-600 text-white shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Security & 2FA</span>
            </button>

            {/* View 5: VPS Server Monitor */}
            <button
              onClick={handleVpsTabClick}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'vps'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Server className="w-4 h-4 text-blue-400" />
              <span>VPS Monitor</span>
            </button>

            {/* View 6: AI Media Scanner */}
            <button
              onClick={() => setActiveTab('scanner')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'scanner'
                  ? 'bg-gradient-to-r from-rose-500 to-purple-600 text-white shadow-md shadow-rose-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Scan className="w-4 h-4 text-rose-400" />
              <span>Media Scanner</span>
            </button>

            {/* View 7: Admin Control Dashboard */}
            <button
              onClick={handleAdminTabClick}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Admin Panel</span>
            </button>

            {/* View 8: Code & Architecture Studio (Protected) */}
            {false && (
              <button
                onClick={handleStudioTabClick}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'studio'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Code2 className="w-4 h-4" />
                <span>Code Studio</span>
                {false ? (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Admin 🔓
                  </span>
                ) : (
                  <Lock className="w-3 h-3 text-amber-400" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* View 1: Live Simulator Mode */}
        {activeTab === 'simulator' && (
          <div className="space-y-6">
            {!currentUser && (
              <div className="bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-purple-950/40 border border-cyan-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Developer Authentication & Cloud Storage Gate</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Guest Mode
                      </span>
                    </h4>
                    <p className="text-xs text-slate-300">
                      Sign in or complete 6-digit OTP verification to unlock VPS Server Monitor, 1-Click Multi-Platform Webhook Portal, and Firestore chat sync.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setAuthFeatureContext('Developer Workspace');
                    setAuthModalTab('login');
                    setIsAuthModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 transition shadow-md shadow-cyan-500/20 cursor-pointer shrink-0"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Log In / Register (1-Click Demo)</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 space-y-6">
                <TelegramSimulator config={config} />
              </div>
              <div className="lg:col-span-5 space-y-6">
                <MemoryInspector config={config} />
              </div>
            </div>
          </div>
        )}

        {currentUser?.role === 'admin' && activeTab === 'settings' && (
          <ConfigPanel
            config={config}
            onChange={handleConfigChange}
            onResetToDefaults={handleResetToDefaults}
            onOpenPortal={handleOpenPortal}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'preferences' && (
          <ConfigPanel
            config={config}
            onChange={handleConfigChange}
            onResetToDefaults={handleResetToDefaults}
            onOpenPortal={handleOpenPortal}
            onShowToast={showToast}
            initialTab="model"
          />
        )}

        {/* View 2: Performance Dashboard (Real-Time 100-AI Telemetry) */}
        {activeTab === 'performance' && (
          <PerformanceDashboard
            onShowToast={showToast}
            onOpenAiChat={() => setIsAiChatOpen(true)}
          />
        )}

        {/* View 3: 100-AI Failover Cascade Dashboard */}
        {activeTab === 'cascade' && (
          <AiCascadeDashboard
            config={config}
            onChange={handleConfigChange}
            onShowToast={showToast}
            onOpenPortal={handleOpenPortal}
          />
        )}

        {/* View 3: 3-Hour Automated Cron Broadcast Worker */}
        {activeTab === 'cron' && (
          <CronBroadcastManager onShowToast={showToast} />
        )}

        {/* View 4: Omni-Channel Gateways */}
        {currentUser?.role === 'admin' && activeTab === 'gateways' && (
          <OmniChannelGateway
            config={config}
            onChange={handleConfigChange}
            onShowToast={showToast}
            onOpenPortal={handleOpenPortal}
          />
        )}

        {/* View 4: Enterprise Security & 2FA */}
        {currentUser?.role === 'admin' && activeTab === 'security' && (
          <EnterpriseSecurity
            config={config}
            onChange={handleConfigChange}
            onShowToast={showToast}
          />
        )}

        {/* View 5: VPS Server Monitor */}
        {currentUser?.role === 'admin' && activeTab === 'vps' && (
          <VpsManager config={config} onChange={handleConfigChange} onShowToast={showToast} />
        )}

        {/* View 6: AI Media Scanner */}
        {activeTab === 'scanner' && <AiMediaScanner onShowToast={showToast} />}

        {/* View 7: Admin Panel */}
        {currentUser?.role === 'admin' && activeTab === 'admin' && (
          <AdminControlPanel
            config={config}
            onChange={handleConfigChange}
            onShowToast={showToast}
            onOpenPortal={handleOpenPortal}
            onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-cyan-400" />
            <span>
              Universal Multi-Platform & 100-AI Super-App • Syful Islam Architecture • 10 Gateways • Zero Downtime
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSubscriptionModalOpen(true)}
              className="text-amber-400 hover:text-amber-300 transition cursor-pointer flex items-center gap-1 font-medium"
            >
              <span>Pro Plans & Metering</span>
              <span className="px-1 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 font-bold">ACTIVE</span>
            </button>
            <span>•</span>
            <button
              onClick={() => setIsYouTubeStudioOpen(true)}
              className="text-rose-400 hover:text-rose-300 transition cursor-pointer flex items-center gap-1 font-medium"
            >
              <span>YouTube Studio</span>
            </button>
            <span>•</span>
            <button onClick={() => handleOpenPortal('groq')} className="hover:text-cyan-400 transition cursor-pointer">
              1-Click Setup Portal
            </button>
            <span>•</span>
            <button onClick={() => setIsDeployGuideOpen(true)} className="hover:text-cyan-400 transition cursor-pointer">
              Cloud Deployment
            </button>
          </div>
        </div>
      </footer>
      </div>

      {/* YouTube Media Studio & AI SEO Modal */}
      <YouTubeStudioModal
        isOpen={isYouTubeStudioOpen}
        onClose={() => setIsYouTubeStudioOpen(false)}
        config={config}
        onUpdateConfig={handleConfigChange}
        onShowToast={showToast}
      />

      {/* Admin PIN Verification Modal */}

      {/* 1-Click Direct API Setup & Messaging Portal Modal */}
      <ApiPortalModal
        isOpen={isPortalOpen}
        onClose={() => setIsPortalOpen(false)}
        config={config}
        onUpdateConfig={handleConfigChange}
        onShowToast={showToast}
        initialPlatformId={portalInitialServiceId}
      />

      {/* Subscription & Managed Cloud Plans Portal Modal */}
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
        config={config}
        onUpdateConfig={handleConfigChange}
        onShowToast={showToast}
        onOpenGatewaySetup={(gatewayId) => {
          handleOpenPortal(gatewayId || 'telegram');
        }}
      />

      {/* Deploy Guide Walkthrough Modal */}
      <DeployGuideModal
        isOpen={isDeployGuideOpen}
        onClose={() => setIsDeployGuideOpen(false)}
        config={config}
      />

      {/* User Authentication & Verification Gateway Modal */}
      <AuthModal
        isOpen={isAuthModalOpen || !currentUser}
        onClose={currentUser ? () => setIsAuthModalOpen(false) : undefined}
        isGateMode={!currentUser}
        initialTab={authModalTab}
        featureProtectedName={authFeatureContext}
        onAuthenticated={handleAuthenticated}
        onShowToast={showToast}
      />

      <AuthModal
        isOpen={isAdminPortalOpen}
        onClose={() => setIsAdminPortalOpen(false)}
        initialTab="login"
        isAdminPortal
        featureProtectedName="Administrator Portal"
        onAuthenticated={(adminSession) => {
          if (adminSession.user.role === 'admin') {
            handleAuthenticated(adminSession);
            setActiveTab('admin');
          }
        }}
        onShowToast={showToast}
      />

      {/* Messenger-style AI Assistant toggle */}
      {!isAiChatOpen && (
        <button
          onClick={() => setIsAiChatOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-cyan-300/50 bg-gradient-to-br from-cyan-500 to-indigo-600 text-white shadow-2xl shadow-cyan-500/30 transition hover:scale-105 hover:shadow-cyan-500/50 active:scale-95"
          title="Open AI Assistant & Copilot"
          aria-label="Open AI Assistant & Copilot"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-slate-950 bg-emerald-400" />
        </button>
      )}

      {/* In-App AI Chat Assistant Modal / Panel */}
      <AiChatModal
        isOpen={isAiChatOpen}
        onClose={() => setIsAiChatOpen(false)}
        config={config}
        onShowToast={showToast}
        onNavigateTab={(tab) => {
          if (tab === 'studio') {
            handleStudioTabClick();
          } else if (tab === 'admin') {
            handleAdminTabClick();
          } else if (tab === 'vps') {
            handleVpsTabClick();
          } else {
            setActiveTab(tab as any);
          }
        }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-cyan-500/50 text-slate-100 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-medium animate-slide-up">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
