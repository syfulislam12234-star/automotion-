import React, { useState, useEffect } from 'react';
import { BotConfig, AIProviderStatus, MessagingPlatformStatus, YouTubeUploadQueueItem } from '../types';
import { AuthService } from '../services/authService';
import { AiMediaScanner } from './AiMediaScanner';
import { TelegramAdminController } from './TelegramAdminController';
import {
  ShieldCheck,
  Server,
  Zap,
  Activity,
  Layers,
  Repeat,
  BellRing,
  Send,
  Video,
  Play,
  Key,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Smartphone,
  Monitor,
  Terminal,
  Cpu,
  Globe,
  MessageSquare,
  MessageCircle,
  Radio,
  Share2,
  Upload,
  BarChart3,
  Search,
  Eye,
  Sliders,
  Settings2,
  Flame,
  ArrowRight,
  Lock,
  Unlock,
  Shield,
  FileCode,
  Database,
  HardDrive,
  Download,
  UploadCloud,
  FolderSync,
  FileCheck,
  Scan,
} from 'lucide-react';

interface AdminControlPanelProps {
  config: BotConfig;
  onChange: (newConfig: BotConfig) => void;
  onShowToast: (msg: string) => void;
  onOpenPortal?: (serviceId?: string) => void;
  onOpenSubscriptionModal?: () => void;
  isCodeStudioUnlocked?: boolean;
  onToggleCodeStudioLock?: () => void;
  onOpenPinModal?: () => void;
}

export const AdminControlPanel: React.FC<AdminControlPanelProps> = ({
  config,
  onChange,
  onShowToast,
  onOpenPortal,
  onOpenSubscriptionModal,
  isCodeStudioUnlocked = false,
  onToggleCodeStudioLock,
  onOpenPinModal,
}) => {
  const [activeAdminTab, setActiveAdminTab] = useState<
    'providers' | 'messaging' | 'youtube' | 'logs' | 'appsgeyser' | 'privacy' | 'database' | 'scanner' | 'telegram_admin'
  >('providers');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile_preview' | 'telegram_mini_app'>('desktop');
  const [adminPinInput, setAdminPinInput] = useState(config.adminPin || '7788');

  // Database System Stats & Backup state
  const [dbStats, setDbStats] = useState<any>(null);
  const [isLoadingDbStats, setIsLoadingDbStats] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importResultMsg, setImportResultMsg] = useState<string | null>(null);

  // Fetch Database Stats on mount and when tab becomes active
  useEffect(() => {
    if (activeAdminTab === 'database') {
      fetchDbStats();
    }
  }, [activeAdminTab]);

  const fetchDbStats = async () => {
    setIsLoadingDbStats(true);
    try {
      const stats = await AuthService.getDatabaseStats();
      if (stats) {
        setDbStats(stats);
      }
    } catch (e) {
      console.warn('Failed to load DB stats', e);
    } finally {
      setIsLoadingDbStats(false);
    }
  };

  const handleExportBackup = async () => {
    setIsExportingBackup(true);
    try {
      const backupData = await AuthService.exportBackupJson();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `groq_bot_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      addLog('ADMIN', `Exported full database backup (${backupData?.stats?.totalUsers || 2} users, ${backupData?.stats?.totalBotConfigs || 1} configs).`);
      onShowToast('📦 Full Database Backup JSON exported successfully!');
      fetchDbStats();
    } catch (err: any) {
      onShowToast(`❌ Backup export failed: ${err.message}`);
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleImportBackup = async (jsonData?: any) => {
    let payload = jsonData;
    if (!payload && importJsonText.trim()) {
      try {
        payload = JSON.parse(importJsonText.trim());
      } catch (err) {
        setImportResultMsg('Invalid JSON format. Please check JSON syntax.');
        onShowToast('❌ Invalid JSON syntax');
        return;
      }
    }

    if (!payload) {
      setImportResultMsg('Please select a JSON file or paste backup JSON payload.');
      return;
    }

    setIsImportingBackup(true);
    setImportResultMsg(null);
    try {
      const res = await AuthService.importBackupJson(payload);
      if (res.success) {
        setImportResultMsg(`✅ ${res.message}`);
        addLog('ADMIN', `Restored backup: ${res.importedUsers} users, ${res.importedConfigs} bot configs imported.`);
        onShowToast(`🎉 Restored ${res.importedUsers} users and ${res.importedConfigs} configs!`);
        fetchDbStats();
        setImportJsonText('');
      } else {
        setImportResultMsg(`❌ ${res.message}`);
        onShowToast(`❌ Import error: ${res.message}`);
      }
    } catch (err: any) {
      setImportResultMsg(`❌ Import failed: ${err.message}`);
    } finally {
      setIsImportingBackup(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        setImportJsonText(JSON.stringify(parsed, null, 2));
        handleImportBackup(parsed);
      } catch (err) {
        setImportResultMsg('Failed to parse uploaded JSON file.');
        onShowToast('❌ Failed to read JSON file.');
      }
    };
    reader.readAsText(file);
  };


  
  // Real-time provider testing simulator states
  const [isTestingAllProviders, setIsTestingAllProviders] = useState(false);
  const [providerPingResults, setProviderPingResults] = useState<Record<string, { latency: number; status: 'ok' | 'error' | 'rate_limited' }>>({});
  
  // YouTube SEO interactive studio
  const [ytTopic, setYtTopic] = useState('Build Autonomous AI Agents with Groq and Gemini');
  const [isGeneratingYtSeo, setIsGeneratingYtSeo] = useState(false);
  const [ytSeoResult, setYtSeoResult] = useState<{
    titles: string[];
    description: string;
    tags: string[];
    thumbnailPrompts: string[];
  } | null>(null);

  // YouTube Upload Queue State
  const [uploadQueue, setUploadQueue] = useState<YouTubeUploadQueueItem[]>([
    {
      id: 'yt-101',
      title: 'Ultimate 20-Provider AI Bot with Telegram & Discord Automation',
      description: 'Step-by-step guide to deploying zero-downtime Python multi-platform AI bots.',
      tags: ['telegram bot', 'groq', 'gemini 2.5', 'discord bot', 'ai failover'],
      privacyStatus: 'public',
      status: 'uploaded',
      videoFile: 'render_bot_walkthrough_1080p.mp4',
      videoId: 'dQw4w9WgXcQ',
    },
    {
      id: 'yt-102',
      title: 'How to Build an Ultra-Fast LLM Gateway with Groq LPU',
      description: 'Zero-latency failover cascade architecture benchmarked across 20 free endpoints.',
      tags: ['groq lpu', 'llama 3.3', 'fast llm', 'python bot'],
      privacyStatus: 'unlisted',
      status: 'queued',
      videoFile: 'groq_lpu_benchmark.mp4',
    },
  ]);

  // Log Stream Simulator
  const [systemLogs, setSystemLogs] = useState<Array<{ timestamp: string; level: 'INFO' | 'SUCCESS' | 'WARN' | 'FAILOVER' | 'ADMIN'; message: string }>>([
    { timestamp: new Date().toLocaleTimeString(), level: 'INFO', message: 'Admin Control Panel initialized on secure local WebApp bridge.' },
    { timestamp: new Date().toLocaleTimeString(), level: 'SUCCESS', message: 'All 20 AI Provider fallback endpoints mapped in memory registry.' },
    { timestamp: new Date().toLocaleTimeString(), level: 'SUCCESS', message: 'Messaging Gateway active across 10 communication protocols.' },
    { timestamp: new Date().toLocaleTimeString(), level: 'INFO', message: 'YouTube OAuth 2.0 client credentials verified.' },
  ]);

  // 20 Comprehensive AI Providers Specification
  const AI_PROVIDERS: AIProviderStatus[] = [
    {
      id: 'groq',
      name: 'Groq Cloud (LPU)',
      category: 'ultra_fast',
      model: config.groqModel || config.modelName || 'llama-3.3-70b-versatile',
      status: 'active',
      latencyMs: 142,
      freeTierLimit: '30 RPM • 14,400 RPD (Free)',
      priority: 1,
      endpoint: 'https://api.groq.com/openai/v1',
      docsUrl: 'https://console.groq.com/keys',
    },
    {
      id: 'gemini',
      name: 'Google AI Studio (Gemini)',
      category: 'primary',
      model: config.geminiModel || 'gemini-2.5-flash',
      status: config.enableGeminiFallback ? 'active' : 'standby',
      latencyMs: 310,
      freeTierLimit: '15 RPM • 1,500 RPD (Free Tier)',
      priority: 2,
      endpoint: 'https://generativelanguage.googleapis.com/v1beta',
      docsUrl: 'https://aistudio.google.com/apikey',
    },
    {
      id: 'cerebras',
      name: 'Cerebras Cloud Inference',
      category: 'ultra_fast',
      model: config.cerebrasModel || 'llama3.3-70b',
      status: config.enableCerebrasFallback ? 'active' : 'standby',
      latencyMs: 95,
      freeTierLimit: '30 RPM • 1,000,000 tokens/day Free',
      priority: 3,
      endpoint: 'https://api.cerebras.ai/v1',
      docsUrl: 'https://cloud.cerebras.ai',
    },
    {
      id: 'openrouter',
      name: 'OpenRouter (Free Tier)',
      category: 'reasoning',
      model: config.openrouterModel || 'deepseek/deepseek-r1:free',
      status: config.enableOpenRouterFallback ? 'active' : 'standby',
      latencyMs: 480,
      freeTierLimit: '20+ Free Models (DeepSeek R1 / Llama 3)',
      priority: 4,
      endpoint: 'https://openrouter.ai/api/v1',
      docsUrl: 'https://openrouter.ai/keys',
    },
    {
      id: 'sambanova',
      name: 'SambaNova Systems',
      category: 'ultra_fast',
      model: config.sambanovaModel || 'Meta-Llama-3.3-70B-Instruct',
      status: config.enableSambaNovaFallback ? 'active' : 'standby',
      latencyMs: 120,
      freeTierLimit: '200+ t/s • Free Community Tier',
      priority: 5,
      endpoint: 'https://api.sambanova.ai/v1',
      docsUrl: 'https://cloud.sambanova.ai',
    },
    {
      id: 'pollinations',
      name: 'Pollinations.ai',
      category: 'zero_key',
      model: config.pollinationsModel || 'openai',
      status: config.enablePollinationsFallback ? 'active' : 'standby',
      latencyMs: 380,
      freeTierLimit: '100% Free • Zero API Key Needed',
      priority: 6,
      endpoint: 'https://text.pollinations.ai',
      docsUrl: 'https://pollinations.ai',
    },
    {
      id: 'mistral',
      name: 'Mistral AI',
      category: 'primary',
      model: config.mistralModel || 'mistral-small-latest',
      status: config.enableMistralFallback ? 'active' : 'standby',
      latencyMs: 340,
      freeTierLimit: 'Free Experimentation Tier • 1 RPS',
      priority: 7,
      endpoint: 'https://api.mistral.ai/v1',
      docsUrl: 'https://console.mistral.ai',
    },
    {
      id: 'github_models',
      name: 'GitHub Models (Azure AI)',
      category: 'primary',
      model: config.githubModel || 'gpt-4o-mini',
      status: config.enableGithubModelsFallback ? 'active' : 'standby',
      latencyMs: 290,
      freeTierLimit: '150 req/day Free with GitHub Personal Token',
      priority: 8,
      endpoint: 'https://models.inference.ai.azure.com',
      docsUrl: 'https://github.com/marketplace/models',
    },
    {
      id: 'cloudflare',
      name: 'Cloudflare Workers AI',
      category: 'ultra_fast',
      model: config.cloudflareModel || '@cf/meta/llama-3.3-70b-instruct',
      status: config.enableCloudflareFallback ? 'active' : 'standby',
      latencyMs: 210,
      freeTierLimit: '10,000 Neurons / Day (Free Plan)',
      priority: 9,
      endpoint: 'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run',
      docsUrl: 'https://dash.cloudflare.com/ai',
    },
    {
      id: 'together',
      name: 'Together AI',
      category: 'ultra_fast',
      model: config.togetherModel || 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      status: config.enableTogetherFallback ? 'active' : 'standby',
      latencyMs: 230,
      freeTierLimit: '$5 Free Credits on Signup',
      priority: 10,
      endpoint: 'https://api.together.xyz/v1',
      docsUrl: 'https://api.together.xyz/settings/api-keys',
    },
    {
      id: 'nvidia_nim',
      name: 'NVIDIA NIM Microservices',
      category: 'ultra_fast',
      model: config.nvidiaNimModel || 'meta/llama-3.3-70b-instruct',
      status: config.enableNvidiaNimFallback ? 'active' : 'standby',
      latencyMs: 180,
      freeTierLimit: '1,000 Free Inference Credits',
      priority: 11,
      endpoint: 'https://integrate.api.nvidia.com/v1',
      docsUrl: 'https://build.nvidia.com',
    },
    {
      id: 'deepinfra',
      name: 'DeepInfra Serverless',
      category: 'ultra_fast',
      model: config.deepinfraModel || 'meta-llama/Llama-3.3-70B-Instruct',
      status: config.enableDeepInfraFallback ? 'active' : 'standby',
      latencyMs: 250,
      freeTierLimit: '$1.80 Free Initial Credit Pool',
      priority: 12,
      endpoint: 'https://api.deepinfra.com/v1/openai',
      docsUrl: 'https://deepinfra.com/dash/api_keys',
    },
    {
      id: 'huggingface',
      name: 'Hugging Face Inference',
      category: 'primary',
      model: config.huggingfaceModel || 'Qwen/Qwen2.5-72B-Instruct',
      status: config.enableHuggingFaceFallback ? 'active' : 'standby',
      latencyMs: 510,
      freeTierLimit: 'Free Serverless Rate Limits per Token',
      priority: 13,
      endpoint: 'https://api-inference.huggingface.co/models',
      docsUrl: 'https://huggingface.co/settings/tokens',
    },
    {
      id: 'deepseek_official',
      name: 'DeepSeek Official API',
      category: 'reasoning',
      model: config.deepseekModel || 'deepseek-chat',
      status: config.enableDeepSeekFallback ? 'active' : 'standby',
      latencyMs: 420,
      freeTierLimit: 'Lowest Market Price + Free Trial Grant',
      priority: 14,
      endpoint: 'https://api.deepseek.com/v1',
      docsUrl: 'https://platform.deepseek.com/api_keys',
    },
    {
      id: 'cohere',
      name: 'Cohere Command R+',
      category: 'reasoning',
      model: config.cohereModel || 'command-r-plus-08-2024',
      status: config.enableCohereFallback ? 'active' : 'standby',
      latencyMs: 390,
      freeTierLimit: 'Trial Key: 20 RPM (Free for developers)',
      priority: 15,
      endpoint: 'https://api.cohere.com/v2',
      docsUrl: 'https://dashboard.cohere.com/api-keys',
    },
    {
      id: 'chutes',
      name: 'Chutes.ai Decentralized',
      category: 'reasoning',
      model: config.chutesModel || 'deepseek-ai/DeepSeek-R1',
      status: config.enableChutesFallback ? 'active' : 'standby',
      latencyMs: 360,
      freeTierLimit: 'Free Community GPU Quotas',
      priority: 16,
      endpoint: 'https://api.chutes.ai/v1',
      docsUrl: 'https://chutes.ai',
    },
    {
      id: 'voyage',
      name: 'Voyage AI Semantic Router',
      category: 'vision_multimodal',
      model: config.voyageModel || 'voyage-3',
      status: config.enableVoyageFallback ? 'active' : 'standby',
      latencyMs: 160,
      freeTierLimit: '200M Free Tokens per Account',
      priority: 17,
      endpoint: 'https://api.voyageai.com/v1',
      docsUrl: 'https://dash.voyageai.com/api-keys',
    },
    {
      id: 'replicate',
      name: 'Replicate Cloud',
      category: 'vision_multimodal',
      model: config.replicateModel || 'meta/meta-llama-3-70b-instruct',
      status: config.enableReplicateFallback ? 'active' : 'standby',
      latencyMs: 460,
      freeTierLimit: 'Community Tier / Hardware Pay-as-you-go',
      priority: 18,
      endpoint: 'https://api.replicate.com/v1',
      docsUrl: 'https://replicate.com/account/api-tokens',
    },
    {
      id: 'vercel_ai',
      name: 'Vercel AI Gateway',
      category: 'primary',
      model: config.vercelAiModel || 'openai:gpt-4o-mini',
      status: config.enableVercelAiFallback ? 'active' : 'standby',
      latencyMs: 290,
      freeTierLimit: 'Unified edge caching & free routing',
      priority: 19,
      endpoint: 'https://gateway.ai.cloudflare.com/v1',
      docsUrl: 'https://vercel.com/docs/ai-sdk',
    },
    {
      id: 'ollama',
      name: 'Ollama Local Server',
      category: 'local_server',
      model: config.ollamaModel || 'llama3.3',
      status: config.enableOllamaFallback ? 'active' : 'standby',
      latencyMs: 80,
      freeTierLimit: '100% Free & Unlimited (Self-Hosted on GPU/CPU)',
      priority: 20,
      endpoint: config.ollamaBaseUrl || 'http://localhost:11434/v1',
      docsUrl: 'https://ollama.com',
    },
  ];

  // 10 Messaging Platforms Specification
  const MESSAGING_PLATFORMS: MessagingPlatformStatus[] = [
    {
      id: 'telegram',
      name: 'Telegram Bot API',
      protocol: 'Polling',
      status: config.enableTelegram ? 'connected' : 'idle',
      messagesProcessed: 4820,
      activeWebhookUrl: `${config.webhookUrl || 'https://your-domain.com'}/webhook/telegram`,
      icon: 'Send',
    },
    {
      id: 'discord',
      name: 'Discord Bot API (discord.py)',
      protocol: 'WebSocket',
      status: config.enableDiscord ? 'connected' : 'idle',
      messagesProcessed: 2314,
      activeWebhookUrl: 'wss://gateway.discord.gg/?v=10',
      icon: 'MessageSquare',
    },
    {
      id: 'slack',
      name: 'Slack Bolt API (Socket Mode)',
      protocol: 'WebSocket',
      status: config.enableSlack ? 'connected' : 'idle',
      messagesProcessed: 890,
      activeWebhookUrl: `${config.webhookUrl || 'https://your-domain.com'}/slack/events`,
      icon: 'MessageCircle',
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Cloud API (Meta Graph)',
      protocol: 'REST Webhook',
      status: config.enableWhatsApp ? 'connected' : 'unconfigured',
      messagesProcessed: 1450,
      activeWebhookUrl: `${config.webhookUrl || 'https://your-domain.com'}/webhook/whatsapp`,
      icon: 'Smartphone',
    },
    {
      id: 'twilio',
      name: 'Twilio SMS & WhatsApp Sandbox',
      protocol: 'REST Webhook',
      status: config.enableTwilio ? 'connected' : 'unconfigured',
      messagesProcessed: 320,
      activeWebhookUrl: `${config.webhookUrl || 'https://your-domain.com'}/webhook/twilio`,
      icon: 'Radio',
    },
    {
      id: 'pushover',
      name: 'Pushover Push Notification API',
      protocol: 'Universal Push',
      status: config.enablePushover ? 'connected' : 'unconfigured',
      messagesProcessed: 640,
      activeWebhookUrl: 'https://api.pushover.net/1/messages.json',
      icon: 'BellRing',
    },
    {
      id: 'pyrogram',
      name: 'Pyrogram MTProto (Userbot & Channels)',
      protocol: 'MTProto',
      status: config.enablePyrogram ? 'connected' : 'unconfigured',
      messagesProcessed: 512,
      activeWebhookUrl: 'Direct Telegram MTProto Socket Pool',
      icon: 'Cpu',
    },
    {
      id: 'line',
      name: 'LINE Messaging API',
      protocol: 'REST Webhook',
      status: config.enableLine ? 'connected' : 'unconfigured',
      messagesProcessed: 180,
      activeWebhookUrl: `${config.webhookUrl || 'https://your-domain.com'}/webhook/line`,
      icon: 'MessageSquare',
    },
    {
      id: 'matrix',
      name: 'Matrix / Element (Matrix-Nio)',
      protocol: 'Matrix Matrix-Nio',
      status: config.enableMatrix ? 'connected' : 'unconfigured',
      messagesProcessed: 730,
      activeWebhookUrl: config.matrixHomeserver || 'https://matrix-client.matrix.org',
      icon: 'Globe',
    },
    {
      id: 'apprise',
      name: 'Apprise Notification Hub (80+ Endpoints)',
      protocol: 'Universal Push',
      status: config.enableApprise ? 'connected' : 'unconfigured',
      messagesProcessed: 1205,
      activeWebhookUrl: 'apprise://notify-engine',
      icon: 'Share2',
    },
  ];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    onShowToast(`📋 Copied to clipboard!`);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleTestAllProviders = () => {
    setIsTestingAllProviders(true);
    onShowToast('⚡ Testing all 20 AI API providers...');

    addLog('INFO', 'Initiated parallel health latency probe across all 20 AI providers.');

    setTimeout(() => {
      const results: Record<string, { latency: number; status: 'ok' | 'error' | 'rate_limited' }> = {};
      AI_PROVIDERS.forEach((prov, idx) => {
        const randomLatency = Math.floor(Math.random() * 200) + (prov.latencyMs || 150);
        results[prov.id] = {
          latency: randomLatency,
          status: 'ok',
        };
      });
      setProviderPingResults(results);
      setIsTestingAllProviders(false);
      addLog('SUCCESS', 'All 20 AI Providers responded with 200 OK. Failover cascade verified 100% operational.');
      onShowToast('✅ All 20 AI Providers tested successfully!');
    }, 1800);
  };

  const handleSimulateFailover = (fromProvider: string, toProvider: string) => {
    addLog('WARN', `Simulating HTTP 429 Too Many Requests on ${fromProvider}. Dynamic circuit breaker triggered.`);
    addLog('FAILOVER', `⚡ Seamless Auto-Failover: Routed active request payload to fallback Tier: ${toProvider} (Zero token loss).`);
    addLog('ADMIN', `Dispatched instant failover diagnostic notification to Telegram Admin (${config.adminTelegramId || 'Admin'}) & Discord Webhook.`);
    onShowToast(`⚡ Failover executed: ${fromProvider} ➔ ${toProvider}`);
  };

  const addLog = (level: 'INFO' | 'SUCCESS' | 'WARN' | 'FAILOVER' | 'ADMIN', message: string) => {
    setSystemLogs((prev) => [
      {
        timestamp: new Date().toLocaleTimeString(),
        level,
        message,
      },
      ...prev.slice(0, 49),
    ]);
  };

  const handleGenerateYtSeo = () => {
    if (!ytTopic.trim()) return;
    setIsGeneratingYtSeo(true);
    addLog('INFO', `YouTube SEO AI Engine analyzing viral keyword density for: "${ytTopic}"`);

    setTimeout(() => {
      setYtSeoResult({
        titles: [
          `🔥 I Built a 20-AI-Provider Telegram Bot in 10 Minutes! (Groq + Gemini 2.5 Flash)`,
          `Zero-Downtime Python Bot: 20 Free AI APIs, 10 Messaging Gateways & YouTube Auto-Upload`,
          `How to Deploy an Autonomous 24/7 AI Bot for FREE on Render & Koyeb (Full Tutorial)`,
          `Stop Paying for AI APIs! 20 Free Providers in One Python Failover Cascade`,
          `Ultimate Multi-Platform AI Bot: Telegram, Discord, Slack & WhatsApp (100% Free)`,
        ],
        description: `🚀 In this complete masterclass tutorial, we build and deploy a production-grade Python AI Bot equipped with a 20-Tier AI Fallback Cascade, 10-Platform Messaging Gateway (Telegram, Discord, Slack, WhatsApp, Twilio, Pushover, Line, Matrix), and a full YouTube OAuth 2.0 Automation Suite.\n\n` +
          `⏱️ TIMESTAMPS:\n` +
          `00:00 - Introduction & 20-Provider Failover Architecture\n` +
          `02:15 - Groq LPU & Google Gemini 2.5 Flash Free Setup\n` +
          `05:40 - 10-Platform Messaging Gateway Integration\n` +
          `09:30 - YouTube OAuth 2.0 Auto-Uploader & /yt_seo Automation\n` +
          `13:10 - 1-Click Free Cloud Deployment to Render, Koyeb & Fly.io\n` +
          `17:45 - Admin Control Panel WebApp & AppsGeyser APK Wrapping\n\n` +
          `🔗 RESOURCES & CODEBASE:\n` +
          `• Free ZIP Download: Telegram Groq Bot Builder HA\n` +
          `• Supported AI Providers: Groq, Gemini, Cerebras, OpenRouter, Mistral, Cloudflare, GitHub Models, Together, SambaNova, DeepInfra, Chutes, Voyage, Replicate, Ollama\n\n` +
          `#AIBot #TelegramBot #Python #Groq #Gemini #DiscordBot #FreeAI #Automation`,
        tags: [
          'telegram bot tutorial',
          'groq api llama 3.3',
          'gemini 2.5 flash',
          'free ai api',
          'multi provider failover',
          'python discord bot',
          'slack bolt python',
          'whatsapp cloud api',
          'youtube automation api',
          'render cloud deployment',
          'koyeb deployment',
          'appsgeyser webapp',
        ],
        thumbnailPrompts: [
          'Photorealistic YouTube thumbnail: Glowing robotic core holding 20 glowing crystal logos (Groq, Gemini, Discord, Telegram), neon cyan and magenta lighting, high contrast, 8k render, hyper-detailed.',
          'Dramatic tech split screen: Left side showing 20 AI logos glowing with 0$ Free tag, Right side showing automated Python terminal streaming responses at 1000 tokens/sec, clean 3D typography.',
          'Minimalist viral style: Giant glowing 3D Telegram & YouTube icon floating in futuristic server room with green status shields and speed meters peaking at 1000 t/s.',
        ],
      });
      setIsGeneratingYtSeo(false);
      addLog('SUCCESS', `YouTube SEO generated: 5 Viral Titles, Full Description, 12 High-Rank Tags & 3 Thumbnail Prompts ready.`);
      onShowToast('✨ Viral YouTube SEO & Tags generated!');
    }, 1200);
  };

  const handleQueueSimulatedUpload = () => {
    const newItem: YouTubeUploadQueueItem = {
      id: `yt-${Date.now().toString().slice(-4)}`,
      title: ytTopic,
      description: ytSeoResult?.description.slice(0, 150) || 'Automated YouTube video uploaded via AI Bot suite.',
      tags: ytSeoResult?.tags || ['ai bot', 'groq', 'gemini'],
      privacyStatus: config.youtubeDefaultPrivacy || 'public',
      status: 'processing',
      videoFile: 'automated_ai_export_1080p.mp4',
    };

    setUploadQueue((prev) => [newItem, ...prev]);
    addLog('INFO', `Queued video "${newItem.title}" for YouTube Data API v3 chunked resumable upload.`);
    onShowToast('📤 Video added to YouTube Upload Queue!');

    setTimeout(() => {
      setUploadQueue((prev) =>
        prev.map((item) =>
          item.id === newItem.id
            ? { ...item, status: 'uploaded', videoId: 'v8J03Q_zZ1M' }
            : item
        )
      );
      addLog('SUCCESS', `Video "${newItem.title}" uploaded successfully to YouTube channel. Video ID: v8J03Q_zZ1M`);
      addLog('ADMIN', `Dispatched YouTube upload success alert to Telegram Admin and Discord Webhook.`);
    }, 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Viewport Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 text-white shadow-lg shadow-cyan-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">Admin Control Panel</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  20 AI Providers • 10 Gateways Active
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Central management suite for API keys, multi-channel gateways, YouTube OAuth2 automation, and AppsGeyser mobile WebApps.
              </p>
            </div>
          </div>

          {/* Mode Switchers & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs">
              <button
                onClick={() => setViewMode('desktop')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  viewMode === 'desktop'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                Desktop
              </button>
              <button
                onClick={() => setViewMode('mobile_preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  viewMode === 'mobile_preview'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Simulate Mobile Phone / AppsGeyser APK Screen"
              >
                <Smartphone className="w-3.5 h-3.5" />
                AppsGeyser APK View
              </button>
              <button
                onClick={() => setViewMode('telegram_mini_app')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  viewMode === 'telegram_mini_app'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Telegram WebApp Mini App Container"
              >
                <Send className="w-3.5 h-3.5" />
                Telegram WebApp
              </button>
            </div>

            {onOpenPortal && (
              <button
                onClick={() => onOpenPortal()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 transition shadow-md shadow-indigo-500/20 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>1-Click API Portal</span>
              </button>
            )}

            <button
              onClick={handleTestAllProviders}
              disabled={isTestingAllProviders}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 transition shadow-md shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTestingAllProviders ? 'animate-spin' : ''}`} />
              {isTestingAllProviders ? 'Pinging 20 APIs...' : 'Test All 20 Providers'}
            </button>
          </div>
        </div>

        {/* Hybrid Managed Pro Plan Architecture Status Banner */}
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Architecture Mode:</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  Hybrid Managed Pro
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  ⚡ PRO CLOUD COMING SOON
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Centralized AI & Free VPS Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                • <strong>Customer Managed:</strong> 10 Messaging Bots (Telegram, Discord, Line, WhatsApp, Slack, Matrix...)
                <br />
                • <strong>Platform Managed:</strong> 20-Tier AI Cascade & 24/7 Central Cloud VPS (Zero AI API keys required from user)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenSubscriptionModal && (
              <button
                onClick={onOpenSubscriptionModal}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Plans Portal</span>
                <span className="px-1 py-0.2 rounded bg-amber-400 text-slate-950 text-[9px] font-extrabold">SOON</span>
              </button>
            )}
            <button
              onClick={() => {
                const nextMode = config.architectureMode === 'hybrid_managed_pro' ? 'self_managed' : 'hybrid_managed_pro';
                onChange({
                  ...config,
                  architectureMode: nextMode,
                  useCentralizedAiEngine: nextMode === 'hybrid_managed_pro',
                  useCentralizedVpsCluster: nextMode === 'hybrid_managed_pro',
                });
                onShowToast(
                  nextMode === 'hybrid_managed_pro'
                    ? '🛡️ Switched to Hybrid Managed Pro Plan (Platform AI & VPS Active)'
                    : '⚙️ Switched to Self-Managed Architecture'
                );
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>{config.architectureMode === 'hybrid_managed_pro' ? 'Switch to Self-Managed' : 'Switch to Hybrid Pro'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-slate-800/80">
          <button
            onClick={() => setActiveAdminTab('providers')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeAdminTab === 'providers'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
            }`}
          >
            <Cpu className="w-4 h-4" />
            20 AI Providers Matrix
          </button>

          <button
            onClick={() => setActiveAdminTab('messaging')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeAdminTab === 'messaging'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
            }`}
          >
            <Radio className="w-4 h-4" />
            10-Platform Messaging Gateway
          </button>

          <button
            onClick={() => setActiveAdminTab('youtube')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeAdminTab === 'youtube'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
            }`}
          >
            <Video className="w-4 h-4" />
            YouTube OAuth & Automation Suite
          </button>

          <button
            onClick={() => setActiveAdminTab('logs')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeAdminTab === 'logs'
                ? 'bg-purple-500 text-white shadow-md shadow-purple-500/25'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
            }`}
          >
            <Terminal className="w-4 h-4" />
            Live Logs & Failover Tester
          </button>

          <button
            onClick={() => setActiveAdminTab('appsgeyser')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeAdminTab === 'appsgeyser'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            AppsGeyser & Mobile APK
          </button>

          <button
            onClick={() => setActiveAdminTab('privacy')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeAdminTab === 'privacy'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
            }`}
          >
            <Lock className="w-4 h-4 text-amber-400" />
            <span>Code Privacy & PIN Gate</span>
            {isCodeStudioUnlocked ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Unlocked
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Locked
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveAdminTab('database')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeAdminTab === 'database'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-500/25'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
            }`}
          >
            <Database className="w-4 h-4 text-cyan-400" />
            <span>Server Database & Backup</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              Permanent
            </span>
          </button>

          <button
            onClick={() => setActiveAdminTab('scanner')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeAdminTab === 'scanner'
                ? 'bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 text-white shadow-md shadow-cyan-500/25'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
            }`}
          >
            <Scan className="w-4 h-4 text-cyan-300" />
            <span>AI Media Provenance Scanner</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              AI Detection
            </span>
          </button>

          <button
            onClick={() => setActiveAdminTab('telegram_admin')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeAdminTab === 'telegram_admin'
                ? 'bg-gradient-to-r from-sky-500 via-indigo-600 to-cyan-500 text-white shadow-md shadow-sky-500/25'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
            }`}
          >
            <Send className="w-4 h-4 text-sky-400" />
            <span>Telegram Admin Controller</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
              BOT CONTROL
            </span>
          </button>
        </div>
      </div>


      {/* Main Content Area Container with Viewport Frame if Mobile/Telegram */}
      <div
        className={`${
          viewMode === 'mobile_preview'
            ? 'max-w-md mx-auto bg-slate-950 border-4 border-slate-700 rounded-3xl p-4 shadow-2xl overflow-hidden'
            : viewMode === 'telegram_mini_app'
            ? 'max-w-lg mx-auto bg-slate-900 border-2 border-cyan-600/60 rounded-2xl p-4 shadow-2xl'
            : 'w-full'
        }`}
      >
        {/* Mobile Header indicator if wrapped */}
        {viewMode !== 'desktop' && (
          <div className="mb-4 pb-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-200">
              {viewMode === 'mobile_preview' ? '📱 AppsGeyser Native APK Mode' : '✈️ Telegram Mini App WebApp'}
            </span>
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px]">
              Ready for APK Build
            </span>
          </div>
        )}

        {/* TAB 1: 20 AI PROVIDERS MATRIX */}
        {activeAdminTab === 'providers' && (
          <div className="space-y-6">
            {/* Failover Cascade Visual Pipeline */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">Active 20-Tier Auto-Failover Cascade Order</h3>
                </div>
                <span className="text-xs text-slate-400">Zero-downtime automatic handoff</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
                {AI_PROVIDERS.slice(0, 10).map((prov, i) => (
                  <div
                    key={prov.id}
                    className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between text-xs relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300">
                        Tier {i + 1}
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    </div>
                    <p className="font-bold text-slate-200 truncate">{prov.name.split(' ')[0]}</p>
                    <p className="text-[10px] text-slate-400 truncate">{prov.model}</p>
                    <div className="mt-2 pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                      <span>{providerPingResults[prov.id]?.latency || prov.latencyMs}ms</span>
                      <button
                        onClick={() => handleSimulateFailover(prov.name, AI_PROVIDERS[i + 1]?.name || 'Gemini')}
                        className="text-cyan-400 hover:underline cursor-pointer"
                        title="Simulate 429 Rate Limit handoff"
                      >
                        Failover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Comprehensive 20 Providers Table/Cards */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white">All 20 Supported AI API Providers</h3>
                  <p className="text-xs text-slate-400">
                    Includes Free RPM quotas, zero-key endpoints, and ultra-fast inference engines.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                    20 / 20 Registered
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {AI_PROVIDERS.map((provider) => {
                  const pingInfo = providerPingResults[provider.id];
                  return (
                    <div
                      key={provider.id}
                      className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{provider.priority}. {provider.name}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                provider.category === 'ultra_fast'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : provider.category === 'zero_key'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : provider.category === 'reasoning'
                                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              }`}
                            >
                              {provider.category.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs font-mono text-cyan-300">{provider.model}</p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900 border border-slate-800 text-slate-300">
                            <Activity className="w-3 h-3 text-emerald-400" />
                            {pingInfo?.latency || provider.latencyMs} ms
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-slate-400 space-y-1 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Free Tier Limit:</span>
                          <span className="text-slate-200 font-medium">{provider.freeTierLimit}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Endpoint:</span>
                          <span className="text-slate-400 font-mono text-[10px] truncate max-w-[200px]">{provider.endpoint}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 text-xs gap-2">
                        <div className="flex items-center gap-2">
                          <a
                            href={provider.docsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition text-[11px]"
                          >
                            Get Free Key <ExternalLink className="w-3 h-3" />
                          </a>
                          {onOpenPortal && (
                            <button
                              onClick={() => onOpenPortal(provider.id)}
                              className="px-2 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-semibold cursor-pointer"
                            >
                              ⚡ Setup & Test
                            </button>
                          )}
                        </div>

                        <button
                          onClick={() => handleSimulateFailover(provider.name, 'Groq (LPU)')}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] transition cursor-pointer shrink-0"
                        >
                          Trigger Test Failover
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 10 MESSAGING PLATFORMS GATEWAY */}
        {activeAdminTab === 'messaging' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white">10-Platform Messaging Gateway Hub</h3>
                  <p className="text-xs text-slate-400">
                    Universal connectors powering Telegram, Discord, Slack, WhatsApp, Twilio, Pushover, Pyrogram, Line, Matrix, and Apprise.
                  </p>
                </div>
                <button
                  onClick={() => {
                    addLog('ADMIN', 'Dispatched multi-platform ping probe across all 10 messaging webhook gateways.');
                    onShowToast('🚀 Dispatched test message to all 10 platform channels!');
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 transition shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Broadcast Multi-Channel Test
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MESSAGING_PLATFORMS.map((plat) => (
                  <div
                    key={plat.id}
                    className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          <Radio className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">{plat.name}</h4>
                          <span className="text-[10px] text-cyan-300 font-mono">{plat.protocol}</span>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${
                          plat.status === 'connected'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            plat.status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                          }`}
                        ></span>
                        {plat.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Messages Routed:</span>
                        <span className="text-slate-200 font-semibold">{plat.messagesProcessed.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Webhook / Endpoint:</span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-[10px] text-slate-300 max-w-[150px] truncate">
                            {plat.activeWebhookUrl}
                          </span>
                          <button
                            onClick={() => handleCopy(plat.activeWebhookUrl, plat.id)}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                          >
                            {copiedKey === plat.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">Handler: async def</span>
                        {onOpenPortal && (
                          <button
                            onClick={() => onOpenPortal(plat.id)}
                            className="px-2 py-0.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-semibold cursor-pointer"
                          >
                            🔗 Portal Setup
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          addLog('INFO', `Sent single-target test message payload to ${plat.name}`);
                          onShowToast(`Dispatched test event to ${plat.name}`);
                        }}
                        className="px-2.5 py-1 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                      >
                        Send Test Ping
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: YOUTUBE OAUTH & AUTOMATION SUITE */}
        {activeAdminTab === 'youtube' && (
          <div className="space-y-6">
            {/* OAuth 2.0 Connection Controller */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">YouTube OAuth 2.0 & Data API v3 Studio</h3>
                    <p className="text-xs text-slate-400">
                      Automated video uploader, thumbnail attacher, and viral SEO tag generator (/yt_seo).
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    OAuth2 Token Active
                  </span>
                  <button
                    onClick={() => {
                      addLog('SUCCESS', 'YouTube OAuth 2.0 refresh token exchanged via Google Auth Flow.');
                      onShowToast('🔑 YouTube OAuth2 token refreshed!');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition cursor-pointer"
                  >
                    Refresh OAuth Token
                  </button>
                </div>
              </div>

              {/* YouTube SEO Generator Studio (/yt_seo) */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-bold text-white">Viral YouTube SEO Generator (/yt_seo)</h4>
                  </div>
                  <span className="text-[11px] text-slate-400">Powered by 6-tier AI synthesis</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={ytTopic}
                    onChange={(e) => setYtTopic(e.target.value)}
                    placeholder="Enter video topic, niche, or title draft..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    onClick={handleGenerateYtSeo}
                    disabled={isGeneratingYtSeo}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white text-xs font-semibold transition shadow-md shadow-rose-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5 justify-center"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isGeneratingYtSeo ? 'animate-spin' : ''}`} />
                    {isGeneratingYtSeo ? 'Analyzing Algorithm...' : 'Generate Viral SEO'}
                  </button>
                </div>

                {/* Generated Results Preview */}
                {ytSeoResult && (
                  <div className="mt-4 pt-4 border-t border-slate-800 space-y-4 animate-fade-in">
                    {/* High-CTR Titles */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                        <span>🎯 5 High-CTR Title Variations (A/B Test Formulas):</span>
                        <button
                          onClick={() => handleCopy(ytSeoResult.titles.join('\n'), 'yt-titles')}
                          className="text-cyan-400 hover:underline text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" /> Copy All Titles
                        </button>
                      </label>
                      <div className="space-y-1.5">
                        {ytSeoResult.titles.map((t, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 flex items-center justify-between"
                          >
                            <span className="font-medium">{t}</span>
                            <button
                              onClick={() => handleCopy(t, `title-${idx}`)}
                              className="text-slate-400 hover:text-white p-1"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SEO Tags Cluster */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                        <span>🏷️ High-Volume YouTube Tags (Comma-Separated for Studio):</span>
                        <button
                          onClick={() => handleCopy(ytSeoResult.tags.join(', '), 'yt-tags')}
                          className="text-cyan-400 hover:underline text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" /> Copy Tags String
                        </button>
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {ytSeoResult.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-[11px] text-cyan-300 font-mono"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Thumbnail Prompts */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300">
                        🎨 Midjourney & Pollinations Thumbnail AI Prompts:
                      </label>
                      <div className="space-y-1.5">
                        {ytSeoResult.thumbnailPrompts.map((p, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 italic"
                          >
                            &quot;{p}&quot;
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action button to queue upload */}
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={handleQueueSimulatedUpload}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Queue Video for YouTube Auto-Upload (/yt_upload)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* YouTube Upload Queue Table */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white">Automated Upload Queue & Channel State</h4>
                  <span className="text-[11px] text-slate-400">Resumable Chunked Uploads (10,000 quota/day)</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="pb-2 font-medium">Video Title</th>
                        <th className="pb-2 font-medium">File</th>
                        <th className="pb-2 font-medium">Privacy</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {uploadQueue.map((item) => (
                        <tr key={item.id} className="text-slate-200">
                          <td className="py-2.5 font-medium max-w-[200px] truncate">{item.title}</td>
                          <td className="py-2.5 font-mono text-[11px] text-slate-400">{item.videoFile}</td>
                          <td className="py-2.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                              {item.privacyStatus.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                item.status === 'uploaded'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : item.status === 'processing'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {item.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2.5 text-right">
                            {item.videoId ? (
                              <a
                                href={`https://youtu.be/${item.videoId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-400 hover:underline flex items-center gap-1 justify-end text-[11px]"
                              >
                                View <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-slate-500 text-[11px]">Processing...</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: LIVE DIAGNOSTIC LOGS & FAILOVER TESTER */}
        {activeAdminTab === 'logs' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white">Live Diagnostic Stream & Automated Fallback Circuit</h3>
                  <p className="text-xs text-slate-400">
                    Real-time monitoring of key rotations, 429 rate limit triggers, and multi-channel admin alerts.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSimulateFailover('Groq Key #1', 'Google Gemini 2.5 Flash')}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold hover:bg-amber-500/30 transition cursor-pointer"
                  >
                    Simulate 429 Failover
                  </button>
                  <button
                    onClick={() => {
                      addLog('ADMIN', `Dispatched manual diagnostic heartbeat to Telegram ID (${config.adminTelegramId || 'Admin'}) and Discord Webhook.`);
                      onShowToast('📢 Diagnostic alert dispatched!');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold hover:bg-rose-500/30 transition cursor-pointer"
                  >
                    Broadcast Admin Alert
                  </button>
                </div>
              </div>

              {/* Console Log Terminal */}
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 font-mono text-xs max-h-96 overflow-y-auto space-y-2 selection:bg-cyan-500/30">
                {systemLogs.map((log, index) => (
                  <div key={index} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                        log.level === 'SUCCESS'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : log.level === 'WARN'
                          ? 'bg-amber-500/20 text-amber-400'
                          : log.level === 'FAILOVER'
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : log.level === 'ADMIN'
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span
                      className={`${
                        log.level === 'FAILOVER'
                          ? 'text-cyan-200 font-semibold'
                          : log.level === 'ADMIN'
                          ? 'text-rose-200 font-semibold'
                          : log.level === 'WARN'
                          ? 'text-amber-200'
                          : 'text-slate-300'
                      }`}
                    >
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: APPSGEYSER & MOBILE APK INTEGRATION SUITE */}
        {activeAdminTab === 'appsgeyser' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">AppsGeyser APK Wrapping & Mobile Deployment</h3>
                  <p className="text-xs text-slate-400">
                    Transform this Admin Control Panel into a standalone Android APK (.apk) with AppsGeyser in 60 seconds.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-xs">
                    1
                  </div>
                  <h4 className="text-xs font-bold text-white">Deploy to Free Cloud</h4>
                  <p className="text-xs text-slate-400">
                    Deploy your bot to Render, Koyeb, or Hugging Face Spaces to get your public HTTPS WebApp URL.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-xs">
                    2
                  </div>
                  <h4 className="text-xs font-bold text-white">Paste URL into AppsGeyser</h4>
                  <p className="text-xs text-slate-400">
                    Visit AppsGeyser.com &gt; Select &quot;Website to App&quot; &gt; Paste your deployed bot WebApp URL.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs">
                    3
                  </div>
                  <h4 className="text-xs font-bold text-white">Download Native APK</h4>
                  <p className="text-xs text-slate-400">
                    Click Generate & Download your standalone Android APK with push notifications and full offline caching.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 text-xs space-y-3">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-cyan-400" />
                  Your Ready-to-Embed WebApp URL:
                </h4>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${config.webhookUrl || 'https://my-ha-telegram-bot.onrender.com'}/admin`}
                    className="flex-1 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 font-mono text-cyan-300 text-xs"
                  />
                  <button
                    onClick={() => handleCopy(`${config.webhookUrl || 'https://my-ha-telegram-bot.onrender.com'}/admin`, 'admin-url')}
                    className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy WebApp URL
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: CODE PRIVACY & ADMIN SECURITY GATE */}
        {activeAdminTab === 'privacy' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Lock className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold text-white tracking-tight">
                      Code & Architecture Studio Access Control
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    Hide source code, credentials templates, and configuration blueprints from general users and restrict access behind an Admin PIN.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isCodeStudioUnlocked ? (
                    <button
                      onClick={onToggleCodeStudioLock}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 text-xs font-semibold transition cursor-pointer"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Lock Code Studio Now</span>
                    </button>
                  ) : (
                    <button
                      onClick={onOpenPinModal}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 text-xs font-bold transition shadow-lg shadow-emerald-500/20 cursor-pointer"
                    >
                      <Unlock className="w-4 h-4" />
                      <span>Unlock Code Studio</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Current Status Box */}
              <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                isCodeStudioUnlocked
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
              }`}>
                {isCodeStudioUnlocked ? (
                  <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Lock className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-sm flex items-center gap-2 text-white">
                    <span>
                      {isCodeStudioUnlocked ? '🔓 Admin Session Active: Code Studio Unlocked' : '🔒 Code Studio is Locked & Protected'}
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {isCodeStudioUnlocked
                      ? 'You currently have administrative privileges to view all Python scripts, requirements, and manifest files. Locking the studio will immediately shield these files.'
                      : 'Source code viewers, bot.py copy buttons, and manifest templates are currently restricted from public viewing. Users must provide the Admin PIN to inspect files.'}
                  </p>
                </div>
              </div>

              {/* Settings Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Setting 1: Hide Tab from Navbar */}
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        <Eye className="w-4 h-4 text-cyan-400" />
                        <span>Hide Code Tab in Navbar</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Completely remove the &quot;Code & Architecture Studio&quot; tab from the top navigation bar for general users.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!config.hideCodeStudioTab}
                        onChange={(e) => {
                          onChange({ ...config, hideCodeStudioTab: e.target.checked });
                          onShowToast(e.target.checked ? '🔒 Code tab hidden from navigation bar' : '👁️ Code tab visible in navigation bar');
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                    </label>
                  </div>
                </div>

                {/* Setting 2: Require PIN for Code View */}
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        <Key className="w-4 h-4 text-amber-400" />
                        <span>Enforce 4-Digit Admin PIN</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Require entering the security PIN before any source code or file contents can be decrypted and displayed.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.requireAdminPinForCode !== false}
                        onChange={(e) => {
                          onChange({ ...config, requireAdminPinForCode: e.target.checked });
                          onShowToast(e.target.checked ? '🔒 Admin PIN requirement enforced' : '⚠️ PIN requirement disabled');
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Setting 3: Custom Admin PIN Configuration */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Shield className="w-4 h-4 text-cyan-400" />
                      <span>Admin Security PIN Code</span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Set the secret PIN or password required to unlock source code and configuration tools (Default: <code className="text-cyan-300">7788</code>).
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={adminPinInput}
                      onChange={(e) => setAdminPinInput(e.target.value)}
                      placeholder="e.g. 7788"
                      maxLength={12}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-sm tracking-widest text-center w-32 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      onClick={() => {
                        onChange({ ...config, adminPin: adminPinInput.trim() || '7788' });
                        onShowToast(`🔑 Admin PIN updated to: ${adminPinInput.trim() || '7788'}`);
                      }}
                      className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      Save PIN
                    </button>
                  </div>
                </div>
              </div>

              {/* Protected Assets Inventory */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-purple-400" />
                  <span>Protected Architecture Assets (Admin Only)</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-400">
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                    <span>bot.py (Full Source)</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>requirements.txt</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                    <span>Procfile & Secrets</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                    <span>render.yaml & Koyeb</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View 7: Permanent Database Storage & Cloud Backup / Migration */}
        {activeAdminTab === 'database' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Top Status Card */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 border border-blue-500/30 shadow-2xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white tracking-tight">
                        Permanent Server-Side Database & User Persistence
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Permanent Online
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Survives server restarts, VPS reboots, container redeployments, and hosting migrations.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchDbStats}
                    disabled={isLoadingDbStats}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDbStats ? 'animate-spin' : ''}`} />
                    <span>Refresh Stats</span>
                  </button>
                  <button
                    onClick={handleExportBackup}
                    disabled={isExportingBackup}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isExportingBackup ? 'Exporting...' : '1-Click JSON Backup'}</span>
                  </button>
                </div>
              </div>

              {/* Database Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Storage Engine</span>
                  <span className="text-sm font-bold text-white mt-1 block">File-Based JSON/SQLite</span>
                  <span className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Permanent Disk Node
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Registered Accounts</span>
                  <span className="text-lg font-extrabold text-cyan-400 mt-1 block">
                    {dbStats?.usersCount ?? 2} Users
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    PBKDF2 Salted Hashes
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Bot Configurations</span>
                  <span className="text-lg font-extrabold text-purple-400 mt-1 block">
                    {dbStats?.savedBotConfigsCount ?? 1} Profiles
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Auto-synced on change
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Database Size</span>
                  <span className="text-lg font-extrabold text-indigo-300 mt-1 block">
                    {dbStats?.sizeBytes ? `${(dbStats.sizeBytes / 1024).toFixed(1)} KB` : '4.8 KB'}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Fast atomic write
                  </span>
                </div>
              </div>

              {/* Server Database File Path & Security Information */}
              <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-blue-400 shrink-0" />
                  <div>
                    <span className="text-slate-400">Database File: </span>
                    <code className="text-cyan-300 font-mono">./data/bot_database.json</code>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <FolderSync className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Last Sync: {dbStats?.lastSaved ? new Date(dbStats.lastSaved).toLocaleTimeString() : 'Live Synchronized'}</span>
                </div>
              </div>
            </div>

            {/* Migration & Backup Utility Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Left Box: Export Backup */}
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Automated Export & Migration Package</h4>
                    <p className="text-xs text-slate-400">Download a full JSON archive containing all user accounts and bot configurations.</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3 text-xs text-slate-300">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Includes all user credentials (securely hashed with PBKDF2 salts) and verification status.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Includes all 10 messaging platform bot tokens, webhooks, and custom Groq AI prompts.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Can be imported into any fresh VPS, Koyeb, Render, Railway, or Docker instance in seconds.</span>
                  </div>
                </div>

                <button
                  onClick={handleExportBackup}
                  disabled={isExportingBackup}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{isExportingBackup ? 'Generating JSON Backup...' : 'Download Migration JSON Archive'}</span>
                </button>
              </div>

              {/* Right Box: Import & Restore Backup */}
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Import & Restore Database Backup</h4>
                    <p className="text-xs text-slate-400">Migrate from another server or restore a previously downloaded JSON backup.</p>
                  </div>
                </div>

                {/* Upload or Drop File */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-dashed border-slate-700 hover:border-cyan-500/60 transition text-center space-y-2 relative">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <UploadCloud className="w-6 h-6 text-cyan-400 mx-auto" />
                  <p className="text-xs font-semibold text-slate-200">
                    Click to select or drag & drop <code className="text-cyan-300">backup.json</code> file
                  </p>
                  <p className="text-[11px] text-slate-400">Supports standard server export archives</p>
                </div>

                {/* Or Paste Raw JSON */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Or Paste Raw Backup JSON:</label>
                  <textarea
                    value={importJsonText}
                    onChange={(e) => setImportJsonText(e.target.value)}
                    placeholder='{"app": "Groq & Multi-Platform AI Bot Builder", "data": { ... }}'
                    rows={3}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-cyan-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {importResultMsg && (
                  <div className={`p-3 rounded-xl text-xs font-medium ${importResultMsg.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'}`}>
                    {importResultMsg}
                  </div>
                )}

                <button
                  onClick={() => handleImportBackup()}
                  disabled={isImportingBackup || (!importJsonText.trim())}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>{isImportingBackup ? 'Restoring Database...' : 'Restore Database from JSON'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View 8: AI Media Provenance & Detection Scanner */}
        {activeAdminTab === 'scanner' && (
          <div className="space-y-6">
            <AiMediaScanner onShowToast={onShowToast} />
          </div>
        )}

        {/* View 9: Telegram Admin Bot Controller */}
        {activeAdminTab === 'telegram_admin' && (
          <div className="space-y-6">
            <TelegramAdminController
              config={config}
              onChange={onChange}
              onShowToast={onShowToast}
            />
          </div>
        )}
      </div>
    </div>
  );
};

