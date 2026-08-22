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
  adminTelegramId: '',
  discordAdminWebhookUrl: '',
  enableAdminAlerts: true,
  enableHeartbeatNotifications: true,

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

  enableTwilio: false,
  twilioAccountSid: '',
  twilioAuthToken: '',
  twilioPhoneNumber: '',
  twilioToNumber: '',

  enablePushover: false,
  pushoverUserKey: '',
  pushoverAppToken: '',

  enablePyrogram: false,
  pyrogramApiId: '',
  pyrogramApiHash: '',
  pyrogramSessionString: '',

  enableLine: false,
  lineChannelSecret: '',
  lineChannelAccessToken: '',

  enableMatrix: false,
  matrixHomeserver: 'https://matrix-client.matrix.org',
  matrixUserId: '',
  matrixAccessToken: '',
  matrixRoomId: '',

  enableApprise: false,
  appriseUrls: '',

  // YouTube OAuth & Automation Suite
  enableYouTubeAutomation: true,
  youtubeClientId: '',
  youtubeClientSecret: '',
  youtubeRefreshToken: '',
  youtubeChannelId: '',
  youtubeDefaultCategory: '28',
  youtubeDefaultPrivacy: 'public',
  enableYtAutoSeo: true,
  enableYtAutoUploadQueue: true,

  // Cloud & Deployment Settings
  deploymentMode: 'polling_with_health',
  serverPort: 8080,
  webhookUrl: '',

  // Architecture & Operating Model (Hybrid Managed Pro Plan vs Self-Managed)
  architectureMode: 'hybrid_managed_pro',
  useCentralizedAiEngine: true,
  useCentralizedVpsCluster: true,
  userProfileName: 'Pro Customer',
  userPlanTier: 'pro_managed',

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

  // Default to Live Simulator mode for general users
  const [activeTab, setActiveTab] = useState<'simulator' | 'admin' | 'vps' | 'studio'>('simulator');
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [isDeployGuideOpen, setIsDeployGuideOpen] = useState(false);
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
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

  const handleConfigChange = (newConfig: BotConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
    } catch (e) {
      console.error('Failed to persist config to localStorage:', e);
    }
  };

  // Protected Gatekeeper: checks authentication before navigating to sensitive routes
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleOpenPortal = (serviceId?: string) => {
    requireAuth('1-Click Direct API Setup Portal', () => {
      setPortalInitialServiceId(serviceId || 'groq');
      setIsPortalOpen(true);
    });
  };

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      const zip = new JSZip();

      generatedFiles.forEach((file) => {
        zip.file(file.filename, file.content);
      });

      zip.file(
        '.gitignore',
        `__pycache__/
*.pyc
*.pyo
*.pyd
.env
.venv/
env/
venv/
.DS_Store
`
      );

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `universal-20ai-10gateway-bot.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('📦 Project ZIP downloaded successfully!');
    } catch (err) {
      console.error('ZIP generation error:', err);
      showToast('❌ Failed to create zip file.');
    } finally {
      setIsZipping(false);
    }
  };

  const handleCopyMainCode = async () => {
    try {
      const botPy = generatedFiles.find((f) => f.filename === 'bot.py') || generatedFiles[0];
      await navigator.clipboard.writeText(botPy.content);
      setCopiedAll(true);
      showToast('📋 bot.py copied to clipboard!');
      setTimeout(() => setCopiedAll(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetToDefaults = () => {
    handleConfigChange(DEFAULT_CONFIG);
    try {
      localStorage.removeItem(CONFIG_STORAGE_KEY);
    } catch (e) {
      console.error(e);
    }
    showToast('🔄 Configuration reset to recommended defaults');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        onOpenAuthModal={(tab) => {
          setAuthModalTab(tab || 'login');
          setAuthFeatureContext(undefined);
          setIsAuthModalOpen(true);
        }}
        onLogOut={handleLogOut}
        onOpenDeployGuide={() => setIsDeployGuideOpen(true)}
        onDownloadZip={handleDownloadZip}
        isZipping={isZipping}
        copiedAll={copiedAll}
        onCopyAll={handleCopyMainCode}
        onOpenPortal={() => handleOpenPortal('groq')}
        onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
        isCodeStudioUnlocked={isCodeStudioUnlocked}
        onOpenAdminPinModal={() => setIsPinModalOpen(true)}
        onLockCodeStudio={handleLockCodeStudio}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Hero Spotlight Section */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 border border-slate-800 p-6 sm:p-8 shadow-2xl">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  20 AI Providers
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-indigo-400" />
                  10 Messaging Gateways
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-rose-400" />
                  YouTube OAuth2 Suite
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                  <Rocket className="w-3.5 h-3.5" />
                  Multi-Cloud Ready
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Universal Multi-Platform & 20-AI Bot Generator
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Zero-downtime Python architecture with <strong>20 free AI API providers</strong> (Groq, Gemini 2.5 Flash, Cerebras, OpenRouter, Mistral, Cloudflare, GitHub Models, SambaNova, Pollinations, Cohere, NVIDIA, Together, DeepInfra, Chutes, Voyage, Replicate, Vercel AI, DeepSeek, HuggingFace, Ollama) and <strong>10 messaging platforms</strong> (Telegram, Discord, Slack, WhatsApp, Twilio, Pushover, Pyrogram, Line, Matrix, Apprise) with <strong>YouTube OAuth 2.0 Automation</strong> and Sentinel Admin Alerting.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                onClick={() => handleOpenPortal('groq')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-indigo-500 transition shadow-lg shadow-cyan-500/20 cursor-pointer"
              >
                <Globe className="w-4 h-4" />
                <span>1-Click API Setup Portal</span>
              </button>

              <button
                onClick={handleDownloadZip}
                disabled={isZipping}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 transition shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{isZipping ? 'Creating Archive...' : 'Download Full ZIP'}</span>
              </button>

              <button
                onClick={() => setIsDeployGuideOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-200 bg-slate-800/80 border border-slate-700 hover:bg-slate-700/80 hover:text-white transition cursor-pointer"
              >
                <Rocket className="w-4 h-4 text-cyan-400" />
                <span>Deploy Guides</span>
              </button>
            </div>
          </div>

          {/* Quick Badges */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>20 AI Provider Pool</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>10 Messaging Gateways</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>YouTube OAuth2 & /yt_seo</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Admin Sentinel Alerts</span>
            </div>
          </div>
        </section>

        {/* Top View Selector Navigation Bar */}
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-2">
          <div className="flex items-center gap-2">
            {/* View 1: Live Gateway Simulator (Default) */}
            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'simulator'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>Live Gateway Simulator</span>
            </button>

            {/* View 2: Admin Control Dashboard */}
            <button
              onClick={handleAdminTabClick}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Admin Dashboard</span>
              {!currentUser && <Lock className="w-3 h-3 text-amber-400/80" />}
            </button>

            {/* View 3: VPS & Cloud Server Manager */}
            <button
              onClick={handleVpsTabClick}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'vps'
                  ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Server className="w-4 h-4" />
              <span>VPS Server Monitor</span>
              {!currentUser ? (
                <Lock className="w-3 h-3 text-amber-400/80" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              )}
            </button>

            {/* View 4: Code & Architecture Studio (Protected) */}
            {(!config.hideCodeStudioTab || isCodeStudioUnlocked) && (
              <button
                onClick={handleStudioTabClick}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'studio'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                    : isCodeStudioUnlocked
                    ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title={isCodeStudioUnlocked ? 'Code & Architecture Studio' : 'Admin PIN Required'}
              >
                <Code2 className="w-4 h-4" />
                <span>Code Studio</span>
                {isCodeStudioUnlocked ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Admin 🔓
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>PIN</span>
                  </span>
                )}
              </button>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400 font-mono pr-2">
            <button
              onClick={() => handleOpenPortal('groq')}
              className="text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>1-Click API Portal</span>
            </button>
            <span>•</span>
            <span>20 APIs</span>
            <span>•</span>
            <span>10 Gateways</span>
          </div>
        </div>

        {/* View 1: Simulator Dedicated Mode (Default) */}
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
                      <span>Developer Authentication Gateway & Session Gate</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Guest Mode
                      </span>
                    </h4>
                    <p className="text-xs text-slate-300">
                      Sign in or complete 6-digit OTP verification to unlock the VPS Server Monitor, 1-Click Multi-Platform Webhook Portal, and Production Admin controls.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setAuthFeatureContext('Developer Workspace');
                      setAuthModalTab('login');
                      setIsAuthModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 transition shadow-md shadow-cyan-500/20 cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Log In / Register (1-Click Demo)</span>
                  </button>
                </div>
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

        {/* View 2: Admin Dashboard */}
        {activeTab === 'admin' && (
          <div className="space-y-6">
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
          </div>
        )}

        {/* View 3: VPS & Cloud Server Management Dashboard */}
        {activeTab === 'vps' && (
          <div className="space-y-6">
            <VpsManager
              config={config}
              onChange={handleConfigChange}
              onShowToast={showToast}
            />
          </div>
        )}

        {/* View 4: Studio Mode (Protected Area) */}
        {activeTab === 'studio' && (
          <>
            {isCodeStudioUnlocked ? (
              <div className="space-y-4">
                {/* Admin Mode Top Status Bar */}
                <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <div>
                      <span className="text-xs font-bold text-emerald-300">
                        Admin Mode Active • Source Code & Architecture Unlocked
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Full access granted to bot.py, requirements.txt, and cloud deployment manifests.
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
              /* Security Lock Gate Card */
              <div className="max-w-2xl mx-auto my-12 bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">
                  <Lock className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    Admin-Only Protected Area
                  </h3>
                  <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                    The Code & Architecture Studio is restricted to authorized administrators. Enter the 4-digit Admin PIN to view source code files and environment templates.
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
              Universal AI Multi-Platform Bot Generator • 20 AI Providers • 10 Gateways • YouTube OAuth 2.0
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSubscriptionModalOpen(true)}
              className="text-amber-400 hover:text-amber-300 transition cursor-pointer flex items-center gap-1 font-medium"
            >
              <span>Subscription & Pro Plans</span>
              <span className="px-1 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 font-bold">SOON</span>
            </button>
            <span>•</span>
            <button
              onClick={() => handleOpenPortal('groq')}
              className="hover:text-cyan-400 transition cursor-pointer"
            >
              1-Click Setup Portal
            </button>
            <span>•</span>
            <button
              onClick={() => setIsDeployGuideOpen(true)}
              className="hover:text-cyan-400 transition cursor-pointer"
            >
              Cloud Deployment
            </button>
            <span>•</span>
            <button
              onClick={() => {
                if (isCodeStudioUnlocked) {
                  handleLockCodeStudio();
                } else {
                  setIsPinModalOpen(true);
                }
              }}
              className="hover:text-amber-400 transition cursor-pointer flex items-center gap-1"
            >
              <Lock className="w-3 h-3" />
              <span>{isCodeStudioUnlocked ? 'Lock Studio' : 'Admin Login'}</span>
            </button>
          </div>
        </div>
      </footer>

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
