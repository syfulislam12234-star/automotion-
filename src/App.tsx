import React, { Component, useState, useEffect } from 'react';
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
import { GmailManager } from './components/GmailManager';
import { Sidebar, AppView } from './components/Sidebar';
import { UnifiedChatWorkspace } from './components/UnifiedChatWorkspace';
import { MultiChannelStudio } from './components/MultiChannelStudio';
import { AiBrainVisualizer } from './components/AiBrainVisualizer';
import { AiAnalyzerModal } from './components/AiAnalyzerModal';
import { ApiVaultModal } from './components/ApiVaultModal';
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
    'You are a versatile, intelligent multi-platform AI assistant powered by a 100-provider auto-failover engine. Provide clear, accurate, and concise Markdown answers across Telegram, Discord, Slack, and WhatsApp.',
  botName: 'Universal Multi-Platform 100-AI Bot',
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

  // Multi-Provider & Key Rotation (100 AI Providers)
  enableMultiProviderFallback: true,
  groqKeysCount: 2,
  keyCooldownSeconds: 60,
  apiGatewayKeys: {},

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

  // 9. Cohere
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
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          n8nEventTriggers: {
            ...DEFAULT_CONFIG.n8nEventTriggers,
            ...(parsed.n8nEventTriggers && typeof parsed.n8nEventTriggers === 'object'
              ? parsed.n8nEventTriggers
              : {}),
          },
        };
      }
    }
  } catch (e) {
    console.error('Failed to load config from localStorage:', e);
  }
  return { ...DEFAULT_CONFIG, n8nEventTriggers: { ...DEFAULT_CONFIG.n8nEventTriggers } };
};

const isValidSession = (value: AuthSession | null | undefined): value is AuthSession => Boolean(value);

const normalizeWorkspaceConfig = (value: unknown): BotConfig => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return getInitialConfig();
  const candidate = value as Partial<BotConfig>;
  return {
    ...getInitialConfig(),
    ...candidate,
    n8nEventTriggers: {
      ...DEFAULT_CONFIG.n8nEventTriggers,
      ...(candidate.n8nEventTriggers && typeof candidate.n8nEventTriggers === 'object'
        ? candidate.n8nEventTriggers
        : {}),
    },
  };
};

function AppContent() {
  const [config, setConfig] = useState<BotConfig>(getInitialConfig);
  const [loading, setLoading] = useState(true);

  // User Authentication & Session State
  const [session, setSession] = useState<AuthSession | null>(() => AuthService.normalizeSession(AuthService.getCurrentSession()));
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdminPortalOpen, setIsAdminPortalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'signup' | 'verify'>('login');
  const [authFeatureContext, setAuthFeatureContext] = useState<string | undefined>(undefined);
  const currentUser = session?.user || null;

  // Active View Tab Navigation
  const [activeTab, setActiveTab] = useState<AppView>('chat');
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [vaultInitialCategory, setVaultInitialCategory] = useState<'ai' | 'messengers' | 'pin'>('ai');
  const [isDeployGuideOpen, setIsDeployGuideOpen] = useState(false);
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isYouTubeStudioOpen, setIsYouTubeStudioOpen] = useState(false);
  const [isAiAnalyzerOpen, setIsAiAnalyzerOpen] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(true);
  const [portalInitialServiceId, setPortalInitialServiceId] = useState<string | undefined>(undefined);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Sync session & load permanently saved user bot config from server database on mount
  useEffect(() => {
    let isMounted = true;
    const fallbackTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 1000);
    const initializeWorkspace = async () => {
      try {
        const result = await AuthService.syncSessionWithServer();
        if (!isMounted) return;

        const updatedSession = result?.session;
        const serverConfig = result?.botConfig;
        const normalizedSession = AuthService.normalizeSession(updatedSession);
        if (isValidSession(normalizedSession)) {
          setSession(normalizedSession);
        } else {
          setSession(null);
        }
        if (serverConfig) {
          setConfig((previous) => normalizeWorkspaceConfig({ ...previous, ...serverConfig }));
        }
      } catch (error) {
        console.warn('Workspace initialization sync notice:', error);
        if (isMounted) {
          setSession(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    void initializeWorkspace();
    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleConfigChange = async (newConfig: BotConfig | Partial<BotConfig>): Promise<boolean> => {
    const previousConfig = config;
    const mergedConfig = normalizeWorkspaceConfig({ ...config, ...newConfig });
    setConfig(mergedConfig);
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(mergedConfig));
    } catch (e) {
      console.error('Failed to persist config to localStorage:', e);
    }
    // Permanently sync with server database
    let saved = false;
    try {
      saved = await AuthService.saveUserBotConfig(mergedConfig, currentUser?.id);
    } catch (error: any) {
      console.error('Failed to persist bot configuration:', error);
      showToast(`⚠️ Configuration save failed: ${error?.message || 'Please try again.'}`);
    }
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

  // Protected Gatekeeper (Seamless Access in Preview)
  const requireAuth = (_featureName: string, action: () => void) => {
    action();
  };

  const handleAuthenticated = (newSession: AuthSession) => {
    const normalizedSession = AuthService.normalizeSession({
      ...newSession,
      isVerified: true,
      user: { ...newSession.user, isVerified: true },
    });
    if (!normalizedSession) return;
    setSession(normalizedSession);
    showToast(`✅ Welcome, ${normalizedSession.user.name || 'user'}! Session active.`);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-5 text-center shadow-xl">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p className="text-sm text-slate-300">Loading secure workspace...</p>
        </div>
      </div>
    );
  }

  const isAuthenticated = Boolean(currentUser && session?.isVerified === true && currentUser.isVerified === true);

  if (!isAuthenticated) {
    const isAdminLoginRoute = window.location.pathname === '/admin/login';
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <AuthModal
          isOpen
          isGateMode
          initialTab={currentUser ? 'verify' : 'login'}
          onAuthenticated={handleAuthenticated}
          onShowToast={showToast}
          isAdminPortal={isAdminLoginRoute}
          initialEmail={currentUser?.email}
          featureProtectedName={isAdminLoginRoute ? 'the administrator portal' : 'the Universal Bot workspace'}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row font-sans selection:bg-cyan-500 selection:text-white">
      <AppErrorBoundary fallback={<div className="w-[268px] p-4 text-xs text-slate-400">Navigation temporarily unavailable.</div>}>
      <Sidebar
        isOpen={isSidebarOpen}
        activeView={activeTab}
        onClose={() => setIsSidebarOpen(false)}
        onSelectView={handleSidebarSelect}
        onOpenAuth={() => { setAuthFeatureContext(undefined); setAuthModalTab('login'); setIsAuthModalOpen(true); }}
        onLogOut={handleLogOut}
        onOpenVault={() => setIsVaultModalOpen(true)}
        currentUser={currentUser}
      />
      </AppErrorBoundary>
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
        onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
        onOpenYouTubeStudio={() => setIsYouTubeStudioOpen(true)}
        onOpenAiChat={() => setIsAiChatOpen(true)}
        onToggleSidebar={() => setIsSidebarOpen(true)}
        onOpenAdminPortal={() => setIsAdminPortalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Sleek Minimalist Operational Header */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-100">Universal Multi-Platform AI Bot Engine</h2>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    ONLINE
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                  <span>10 Gateways Active</span>
                  <span>•</span>
                  <span>150-AI Failover Core</span>
                  <span>•</span>
                  <span>2H Emergency Dispatch</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsSubscriptionModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Plans</span>
              </button>
              <button
                onClick={() => setIsYouTubeStudioOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-semibold border border-rose-500/30 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Video className="w-3.5 h-3.5" />
                <span>YouTube Studio</span>
              </button>
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

            {/* View 2: Performance Dashboard (Real-Time 150-AI Telemetry) */}
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
                150-AI
              </span>
            </button>

            {/* View 3: 150-AI Cascade Engine */}
            <button
              onClick={() => setActiveTab('cascade')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'cascade'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Layers className="w-4 h-4 text-amber-400" />
              <span>150-AI Cascade</span>
            </button>

            {/* View 3: Automated Bangladesh Emergency News Broadcast Worker */}
            <button
              onClick={() => setActiveTab('cron')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'cron'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Emergency Broadcast</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                2H Auto
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
          </div>
        </div>

        {/* View 0: ChatGPT-style Main Chat Workspace (Default) */}
        {activeTab === 'chat' && (
          <UnifiedChatWorkspace
            config={config}
            onShowToast={showToast}
            onOpenVault={() => setIsVaultModalOpen(true)}
            onOpenGateways={() => setActiveTab('gateways')}
          />
        )}

        {/* View 1: 10-Messenger Protocol Multi-Channel Studio */}
        {(activeTab === 'simulator' || activeTab === 'gateways' || activeTab.startsWith('ch-')) && (
          <MultiChannelStudio
            config={config}
            onUpdateConfig={handleConfigChange}
            onShowToast={showToast}
            onOpenVault={() => setIsVaultModalOpen(true)}
            initialPlatform={activeTab.startsWith('ch-') ? (activeTab.replace('ch-', '') as any) : 'telegram'}
          />
        )}

        {activeTab === 'preferences' && (
          <AppErrorBoundary fallback={<div className="p-6 rounded-2xl border border-amber-500/30 bg-slate-900 text-sm text-amber-300">Bot Configuration is temporarily unavailable.</div>}>
          <ConfigPanel
            config={config}
            onChange={handleConfigChange}
            onResetToDefaults={handleResetToDefaults}
            onOpenPortal={handleOpenPortal}
            onShowToast={showToast}
            initialTab="model"
          />
          </AppErrorBoundary>
        )}

        {/* View 2: Performance Dashboard (Real-Time 150-AI Telemetry) */}
        {activeTab === 'performance' && (
          <PerformanceDashboard
            onShowToast={showToast}
            onOpenAiChat={() => setIsAiChatOpen(true)}
          />
        )}

        {/* View 3: 150-AI Super-Brain & Failover Cascade Dashboard */}
        {activeTab === 'cascade' && (
          <div className="space-y-6">
            <AiBrainVisualizer
              config={config}
              onUpdateConfig={handleConfigChange}
              onShowToast={showToast}
              onOpenVault={() => setIsVaultModalOpen(true)}
            />
            <AiCascadeDashboard
              config={config}
              onChange={handleConfigChange}
              onShowToast={showToast}
            />
          </div>
        )}

        {/* View 3: 3-Hour Automated Cron Broadcast Worker */}
        {activeTab === 'cron' && (
          <CronBroadcastManager onShowToast={showToast} />
        )}

        {/* View 4: Enterprise Security & 2FA */}
        {(activeTab === 'security' || activeTab === 'vault') && (
          <EnterpriseSecurity
            config={config}
            onChange={handleConfigChange}
            onShowToast={showToast}
          />
        )}

        {/* View 5: VPS Server Monitor */}
        {activeTab === 'vps' && (
          <VpsManager config={config} onChange={handleConfigChange} onShowToast={showToast} />
        )}

        {/* View 6: AI Media Scanner */}
        {activeTab === 'scanner' && <AiMediaScanner onShowToast={showToast} />}

        {activeTab === 'analyzer' && (
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4">
            <h3 className="text-lg font-bold text-white">Real-Time AI System Analyzer</h3>
            <p className="text-xs text-slate-400">Inspect verified live model and gateway connections.</p>
            <button onClick={() => setIsAiAnalyzerOpen(true)} className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs cursor-pointer">Open Live Analyzer</button>
          </div>
        )}

        {/* View 7: YouTube Studio */}
        {activeTab === 'youtube' && (
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4">
            <h3 className="text-lg font-bold text-white">YouTube Video Studio & AI SEO</h3>
            <p className="text-xs text-slate-400">Launch the dedicated creator studio modal to generate scripts, tags, and automated uploads.</p>
            <button
              onClick={() => setIsYouTubeStudioOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-xs shadow-lg transition cursor-pointer"
            >
              Open YouTube Creator Studio
            </button>
          </div>
        )}

        {/* View 8: Admin Panel */}
        {currentUser?.role === 'admin' && activeTab === 'admin' && (
          <AdminControlPanel
            config={config}
            onChange={handleConfigChange}
            onShowToast={showToast}
            onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
          />
        )}

        {/* View 9: Gmail Workspace Hub */}
        {activeTab === 'gmail' && (
          <div className="h-[calc(100vh-140px)] min-h-[600px] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
            <GmailManager onBackToChat={() => setActiveTab('chat')} />
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-cyan-400" />
            <span>
              Universal Multi-Platform & 150-AI Super-App • Syful Islam Architecture • 10 Gateways • Zero Downtime
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('gmail')}
              className="text-red-400 hover:text-red-300 transition cursor-pointer flex items-center gap-1 font-medium"
            >
              <span>Gmail Hub</span>
            </button>
            <span>•</span>
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

      <AiAnalyzerModal isOpen={isAiAnalyzerOpen} onClose={() => setIsAiAnalyzerOpen(false)} />

      {/* Encrypted API & Token Vault (Password Protected) */}
      <ApiVaultModal
        isOpen={isVaultModalOpen}
        onClose={() => setIsVaultModalOpen(false)}
        config={config}
        onUpdateConfig={handleConfigChange}
        onShowToast={showToast}
        initialCategory={vaultInitialCategory}
      />

      {/* 1-Click Direct API Setup & Messaging Portal Modal */}
      <AppErrorBoundary fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6"><div className="rounded-xl border border-amber-500/30 bg-slate-900 p-5 text-sm text-amber-300">API Portal is temporarily unavailable. Please return to Bot Configuration and try again.</div></div>}>
      <ApiPortalModal
        isOpen={isPortalOpen}
        onClose={() => setIsPortalOpen(false)}
        config={config}
        onUpdateConfig={handleConfigChange}
        onShowToast={showToast}
        onRequireAuth={() => {
          setAuthFeatureContext('API Key Portal');
          setAuthModalTab('login');
          setIsAuthModalOpen(true);
        }}
        initialPlatformId={portalInitialServiceId}
      />
      </AppErrorBoundary>

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
        authPromptMessage={authFeatureContext === 'API Key Portal' ? 'Please login first to save API keys.' : undefined}
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
          if (adminSession.user?.role === 'admin' && adminSession.isVerified === true) {
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
          if (tab === 'admin') {
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

interface AppErrorBoundaryProps {
  children?: React.ReactNode;
  fallback?: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error) {
    console.error('Application rendering failed:', error);
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md rounded-2xl border border-rose-500/30 bg-slate-900 p-6 text-center shadow-xl">
            <h1 className="text-lg font-semibold text-white">The workspace could not load</h1>
            <p className="mt-2 text-sm text-slate-400">Refresh the page to retry the secure application startup.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
  );
}
