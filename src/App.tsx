import React, { useState, useMemo, useEffect } from 'react';
import JSZip from 'jszip';
import { BotConfig, UserAccount, AuthSession } from './types';
import { getAllGeneratedFiles } from './data/codeTemplates';
import { Navbar } from './components/Navbar';
import { CodeViewer } from './components/CodeViewer';
import { ConfigPanel } from './components/ConfigPanel';
import { TelegramSimulator } from './components/TelegramSimulator';
import { DeployGuideModal } from './components/DeployGuideModal';
import { MemoryInspector } from './components/MemoryInspector';
import { AdminControlPanel } from './components/AdminControlPanel';
import { ApiPortalModal } from './components/ApiPortalModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import { AdminPinModal } from './components/AdminPinModal';
import { AuthModal } from './components/AuthModal';
import { VpsManager } from './components/VpsManager';
import { AiMediaScanner } from './components/AiMediaScanner';
import { AiChatModal } from './components/AiChatModal';
import { AiCascadeDashboard } from './components/AiCascadeDashboard';
import { OmniChannelGateway } from './components/OmniChannelGateway';
import { EnterpriseSecurity } from './components/EnterpriseSecurity';
import { YouTubeStudioModal } from './components/YouTubeStudioModal';
import { CronBroadcastManager } from './components/CronBroadcastManager';
import { AuthService } from './services/authService';
import {
  Download,
  Rocket,
  Bot,
  Zap,
  Brain,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Terminal,
  Code2,
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
  geminiModel: 'gemini-2.5-flash',
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
  adminTelegramId: '749201994',
  discordAdminWebhookUrl: '',
  enableAdminAlerts: true,
  enableHeartbeatNotifications: true,

  // Telegram Admin Bot Controller
  enableTelegramAdminController: true,
  telegramAdminBotToken: '',
  telegramAdminChatId: '749201994',
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

  // Code Studio Privacy & Admin Security Gate
  adminPin: '7788',
  hideCodeStudioTab: false,
  requireAdminPinForCode: true,

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
const ADMIN_UNLOCKED_STORAGE_KEY = 'universal_bot_admin_unlocked';

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
  const [authModalTab, setAuthModalTab] = useState<'login' | 'signup' | 'verify'>('login');
  const [authFeatureContext, setAuthFeatureContext] = useState<string | undefined>(undefined);
  const currentUser = session?.user || null;

  // Active View Tab Navigation
  const [activeTab, setActiveTab] = useState<
    'simulator' | 'cascade' | 'cron' | 'gateways' | 'security' | 'vps' | 'scanner' | 'admin' | 'studio'
  >('simulator');
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [isDeployGuideOpen, setIsDeployGuideOpen] = useState(false);
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isYouTubeStudioOpen, setIsYouTubeStudioOpen] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [portalInitialServiceId, setPortalInitialServiceId] = useState<string | undefined>(undefined);
  const [isZipping, setIsZipping] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Admin PIN / Code Studio Security Unlock state
  const [isCodeStudioUnlocked, setIsCodeStudioUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(ADMIN_UNLOCKED_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // Sync session & load permanently saved user bot config from server database on mount
  useEffect(() => {
    let isMounted = true;
    AuthService.syncSessionWithServer().then(({ session: updatedSession, botConfig: serverConfig }) => {
      if (!isMounted) return;
      if (updatedSession) {
        setSession(updatedSession);
        if (updatedSession.user.role === 'admin') {
          setIsCodeStudioUnlocked(true);
        }
      }
      if (serverConfig) {
        setConfig((prev) => ({ ...prev, ...serverConfig }));
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleConfigChange = (newConfig: BotConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
    } catch (e) {
      console.error('Failed to persist config to localStorage:', e);
    }
    // Permanently sync with server database
    AuthService.saveUserBotConfig(newConfig, currentUser?.id);
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
    if (newSession.user.role === 'admin') {
      setIsCodeStudioUnlocked(true);
      try {
        sessionStorage.setItem(ADMIN_UNLOCKED_STORAGE_KEY, 'true');
      } catch (e) {
        console.error(e);
      }
    }
    showToast(`✅ Welcome, ${newSession.user.name}! Session active.`);
  };

  const handleLogOut = () => {
    AuthService.logOut();
    setSession(null);
    setIsCodeStudioUnlocked(false);
    try {
      sessionStorage.removeItem(ADMIN_UNLOCKED_STORAGE_KEY);
    } catch (e) {
      console.error(e);
    }
    setActiveTab('simulator');
    showToast('👋 You have been logged out.');
  };

  const handleUnlockCodeStudio = () => {
    setIsCodeStudioUnlocked(true);
    try {
      sessionStorage.setItem(ADMIN_UNLOCKED_STORAGE_KEY, 'true');
    } catch (e) {
      console.error(e);
    }
    setActiveTab('studio');
  };

  const handleLockCodeStudio = () => {
    setIsCodeStudioUnlocked(false);
    try {
      sessionStorage.removeItem(ADMIN_UNLOCKED_STORAGE_KEY);
    } catch (e) {
      console.error(e);
    }
    if (activeTab === 'studio') {
      setActiveTab('simulator');
    }
    showToast('🔒 Code & Architecture Studio locked.');
  };

  const handleStudioTabClick = () => {
    requireAuth('Code & Architecture Studio', () => {
      if (!isCodeStudioUnlocked && config.requireAdminPinForCode !== false) {
        setIsPinModalOpen(true);
      } else {
        setActiveTab('studio');
      }
    });
  };

  const handleAdminTabClick = () => {
    requireAuth('Admin Dashboard', () => {
      setActiveTab('admin');
    });
  };

  const handleVpsTabClick = () => {
    requireAuth('VPS & Cloud Server Monitor', () => {
      setActiveTab('vps');
    });
  };

  const generatedFiles = useMemo(() => {
    return getAllGeneratedFiles(config);
  }, [config]);

  const handleResetToDefaults = () => {
    setConfig(DEFAULT_CONFIG);
    try {
      localStorage.removeItem(CONFIG_STORAGE_KEY);
    } catch (e) {
      console.error(e);
    }
    showToast('🔄 All configurations reset to high-resilience defaults.');
  };

  const handleDownloadZip = async () => {
    setIsZipping(true);
    showToast('📦 Bundling universal multi-platform bot project...');
    try {
      const zip = new JSZip();
      generatedFiles.forEach((file) => {
        zip.file(file.filename, file.content);
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'universal-multi-platform-bot.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('🎉 Project zip downloaded successfully!');
    } catch (err) {
      console.error('Failed to create zip: ', err);
      showToast('❌ Failed to create zip package.');
    } finally {
      setIsZipping(false);
    }
  };

  const handleCopyAllCode = async () => {
    try {
      const allText = generatedFiles
        .map((f) => `### FILE: ${f.filename}\n${f.content}\n\n`)
        .join('----------------------------------------\n\n');
      await navigator.clipboard.writeText(allText);
      setCopiedAll(true);
      showToast('📋 Copied all source files to clipboard!');
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
      showToast('❌ Failed to copy to clipboard.');
    }
  };

  const handleOpenPortal = (serviceId?: string) => {
    setPortalInitialServiceId(serviceId);
    setIsPortalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
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
        onDownloadZip={handleDownloadZip}
        isZipping={isZipping}
        copiedAll={copiedAll}
        onCopyAll={handleCopyAllCode}
        onOpenPortal={() => handleOpenPortal('groq')}
        onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
        onOpenYouTubeStudio={() => setIsYouTubeStudioOpen(true)}
        onOpenAiChat={() => setIsAiChatOpen(true)}
        isCodeStudioUnlocked={isCodeStudioUnlocked}
        onOpenAdminPinModal={() => setIsPinModalOpen(true)}
        onLockCodeStudio={handleLockCodeStudio}
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
              <button
                onClick={handleDownloadZip}
                disabled={isZipping}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Download className={`w-4 h-4 ${isZipping ? 'animate-bounce' : ''}`} />
                <span>{isZipping ? 'Bundling...' : 'Download Code .ZIP'}</span>
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
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-2 overflow-x-auto">
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

            {/* View 2: 100-AI Cascade Engine */}
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
            {(!config.hideCodeStudioTab || isCodeStudioUnlocked) && (
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
                {isCodeStudioUnlocked ? (
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
                <ConfigPanel
                  config={config}
                  onChange={handleConfigChange}
                  onResetToDefaults={handleResetToDefaults}
                  onOpenPortal={handleOpenPortal}
                  onShowToast={showToast}
                />
                <MemoryInspector config={config} />
              </div>
            </div>
          </div>
        )}

        {/* View 2: 100-AI Failover Cascade Dashboard */}
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
        {activeTab === 'gateways' && (
          <OmniChannelGateway
            config={config}
            onChange={handleConfigChange}
            onShowToast={showToast}
            onOpenPortal={handleOpenPortal}
          />
        )}

        {/* View 4: Enterprise Security & 2FA */}
        {activeTab === 'security' && (
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

        {/* View 7: Admin Panel */}
        {activeTab === 'admin' && (
          <AdminControlPanel
            config={config}
            onChange={handleConfigChange}
            onShowToast={showToast}
            onOpenPortal={handleOpenPortal}
            onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
            isCodeStudioUnlocked={isCodeStudioUnlocked}
            onToggleCodeStudioLock={() => {
              if (isCodeStudioUnlocked) {
                handleLockCodeStudio();
              } else {
                setIsPinModalOpen(true);
              }
            }}
            onOpenPinModal={() => setIsPinModalOpen(true)}
          />
        )}

        {/* View 8: Code Studio */}
        {activeTab === 'studio' && (
          <>
            {isCodeStudioUnlocked ? (
              <div className="space-y-4">
                <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <div>
                      <span className="text-xs font-bold text-emerald-300">
                        Admin Mode Active • Raw Source Code Studio Unlocked
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Edit code files directly in browser or generate production VPS deployment scripts.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleLockCodeStudio}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-xs font-semibold text-rose-400 hover:text-rose-300 transition cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Lock Code Studio</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-7 space-y-6">
                    <CodeViewer
                      files={generatedFiles}
                      activeFileIndex={activeFileIndex}
                      onSelectFile={setActiveFileIndex}
                      onShowToast={showToast}
                    />
                    <MemoryInspector config={config} />
                  </div>

                  <div className="lg:col-span-5 space-y-6">
                    <ConfigPanel
                      config={config}
                      onChange={handleConfigChange}
                      onResetToDefaults={handleResetToDefaults}
                      onOpenPortal={handleOpenPortal}
                      onShowToast={showToast}
                    />
                    <TelegramSimulator config={config} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto my-12 bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">
                  <Lock className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    Admin-Only Protected Area
                  </h3>
                  <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                    The Code & Architecture Studio is restricted to authorized administrators. Enter the 4-digit Admin PIN to access live code editing and deployment tools.
                  </p>
                </div>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={() => setIsPinModalOpen(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white text-sm font-bold transition shadow-lg shadow-amber-500/25 active:scale-95 cursor-pointer"
                  >
                    <Key className="w-4 h-4" />
                    <span>Enter Admin PIN (Default: 7788)</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('simulator')}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 text-sm font-medium transition cursor-pointer"
                  >
                    Back to Live Simulator
                  </button>
                </div>
              </div>
            )}
          </>
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

      {/* YouTube Media Studio & AI SEO Modal */}
      <YouTubeStudioModal
        isOpen={isYouTubeStudioOpen}
        onClose={() => setIsYouTubeStudioOpen(false)}
        config={config}
        onUpdateConfig={handleConfigChange}
        onShowToast={showToast}
      />

      {/* Admin PIN Verification Modal */}
      <AdminPinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handleUnlockCodeStudio}
        correctPin={config.adminPin || '7788'}
        onShowToast={showToast}
      />

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
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialTab={authModalTab}
        featureProtectedName={authFeatureContext}
        onAuthenticated={handleAuthenticated}
        onShowToast={showToast}
      />

      {/* Floating In-App AI Chat Assistant FAB */}
      <div className="fixed bottom-6 left-6 sm:bottom-8 sm:left-8 z-40">
        <button
          onClick={() => setIsAiChatOpen(!isAiChatOpen)}
          className={`relative group flex items-center gap-2.5 px-4 py-3 rounded-full shadow-2xl transition-all duration-300 active:scale-95 cursor-pointer border ${
            isAiChatOpen
              ? 'bg-slate-900 border-cyan-400 text-cyan-300 shadow-cyan-500/20'
              : 'bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 border-cyan-400/40 text-white shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105'
          }`}
          title={isAiChatOpen ? 'Close AI Assistant' : 'Open AI Assistant & Copilot'}
        >
          <div className="relative">
            <Bot className={`w-5 h-5 ${isAiChatOpen ? 'text-cyan-400' : 'text-white animate-pulse'}`} />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-900 rounded-full"></span>
          </div>
          <span className="text-xs font-bold tracking-wide">
            {isAiChatOpen ? 'Close AI Copilot' : 'AI Assistant'}
          </span>
          <span className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-white/20 text-white">
            100-AI
          </span>
        </button>
      </div>

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
