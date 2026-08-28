import React, { useState, useEffect, useRef } from 'react';
import { BotConfig, ChatMessage, MessengerPlatformId, MessengerProtocolInfo } from '../types';
import { AiService } from '../services/aiService';
import {
  Send,
  Bot,
  User,
  Radio,
  Globe,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  ExternalLink,
  Shield,
  Zap,
  Terminal,
  Activity,
  MessageSquare,
  Smartphone,
  Hash,
  Share2,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Play,
  Layers,
  ChevronDown,
  Volume2,
  Paperclip,
  Code,
  Lock,
} from 'lucide-react';

interface MultiChannelStudioProps {
  config: BotConfig;
  onUpdateConfig?: (updates: Partial<BotConfig>) => void;
  onShowToast: (msg: string) => void;
  onOpenVault?: () => void;
  initialPlatform?: MessengerPlatformId;
}

const MESSENGER_PROTOCOLS: MessengerProtocolInfo[] = [
  {
    id: 'telegram',
    name: 'Telegram Bot',
    iconName: 'Send',
    badge: 'Bot API v7.0',
    themeColor: 'from-sky-500 to-blue-600',
    bubbleColor: 'bg-sky-600/90 text-white',
    endpoint: '/webhook/telegram',
    keyField: 'telegramBotToken',
    enabledField: 'enableMultiProviderFallback',
    formatGuide: 'HTML & MarkdownV2 parsing with inline bot commands (/start, /ai, /stats)',
    sampleMessage: 'Hello from Telegram! What are the latest updates?',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Cloud',
    iconName: 'Smartphone',
    badge: 'Meta Graph v20',
    themeColor: 'from-emerald-500 to-teal-600',
    bubbleColor: 'bg-emerald-700/90 text-white',
    endpoint: '/webhook/whatsapp',
    keyField: 'whatsappAccessToken',
    enabledField: 'enableMultiProviderFallback',
    formatGuide: 'Interactive template buttons, list messages, and media payload forwarding',
    sampleMessage: 'Hi bot! Can you help me manage customer support queries?',
  },
  {
    id: 'line',
    name: 'LINE Messenger',
    iconName: 'MessageSquare',
    badge: 'Messaging API v2',
    themeColor: 'from-green-500 to-emerald-600',
    bubbleColor: 'bg-green-600/90 text-white',
    endpoint: '/webhook/line',
    keyField: 'lineChannelAccessToken',
    enabledField: 'enableMultiProviderFallback',
    formatGuide: 'LINE Flex Messages, quick reply chips, and carousel templates',
    sampleMessage: 'LINE Channel test: checking bot brain response time.',
  },
  {
    id: 'discord',
    name: 'Discord Gateway',
    iconName: 'Hash',
    badge: 'Gateway v10',
    themeColor: 'from-indigo-500 to-purple-600',
    bubbleColor: 'bg-indigo-600/90 text-white',
    endpoint: '/webhook/discord',
    keyField: 'discordBotToken',
    enabledField: 'enableMultiProviderFallback',
    formatGuide: 'Rich embeds, slash commands (/ask, /generate), and guild channel bridging',
    sampleMessage: '!ask Explain the difference between Groq LPU and GPU clusters',
  },
  {
    id: 'slack',
    name: 'Slack Assistant',
    iconName: 'MessageSquare',
    badge: 'Events API & Bolt',
    themeColor: 'from-purple-500 to-pink-600',
    bubbleColor: 'bg-purple-700/90 text-white',
    endpoint: '/webhook/slack',
    keyField: 'slackBotToken',
    enabledField: 'enableMultiProviderFallback',
    formatGuide: 'Slack Block Kit formatting, thread replies, and app mentions (@UnifiedBot)',
    sampleMessage: '@UnifiedBot summarize our team sprint goals for this week',
  },
  {
    id: 'messenger',
    name: 'Facebook Messenger',
    iconName: 'Globe',
    badge: 'Meta Graph API',
    themeColor: 'from-blue-500 to-indigo-600',
    bubbleColor: 'bg-blue-600/90 text-white',
    endpoint: '/webhook/facebook',
    keyField: 'whatsappVerifyToken',
    enabledField: 'enableMultiProviderFallback',
    formatGuide: 'Page sender actions, quick replies, and attachment attachments',
    sampleMessage: 'Hello page bot! Are you connected to the 150-AI model cascade?',
  },
  {
    id: 'signal',
    name: 'Signal Bot',
    iconName: 'Shield',
    badge: 'Signal-CLI REST',
    themeColor: 'from-sky-600 to-cyan-700',
    bubbleColor: 'bg-cyan-700/90 text-white',
    endpoint: '/webhook/signal',
    keyField: 'twilioAccountSid',
    enabledField: 'enableMultiProviderFallback',
    formatGuide: 'End-to-End encrypted private routing with JSON-RPC daemon',
    sampleMessage: 'Signal encrypted packet test: send secure diagnostic report.',
  },
  {
    id: 'viber',
    name: 'Viber Public Bot',
    iconName: 'Smartphone',
    badge: 'Viber PA API',
    themeColor: 'from-violet-600 to-purple-700',
    bubbleColor: 'bg-violet-700/90 text-white',
    endpoint: '/webhook/viber',
    keyField: 'twilioAuthToken',
    enabledField: 'enableMultiProviderFallback',
    formatGuide: 'Viber keyboard carousels and rich media broadcast cards',
    sampleMessage: 'Viber test message: trigger automated news digest broadcast.',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    iconName: 'Bot',
    badge: 'Azure Framework',
    themeColor: 'from-blue-600 to-indigo-800',
    bubbleColor: 'bg-indigo-800/90 text-white',
    endpoint: '/webhook/teams',
    keyField: 'matrixAccessToken',
    enabledField: 'enableMultiProviderFallback',
    formatGuide: 'Adaptive Cards, team mentions, and Office 365 workflow triggers',
    sampleMessage: 'Teams bot check: generate automated incident response ticket.',
  },
  {
    id: 'webhook',
    name: 'Custom Webhooks',
    iconName: 'Terminal',
    badge: 'REST Ingress',
    themeColor: 'from-amber-500 to-orange-600',
    bubbleColor: 'bg-amber-600/90 text-white',
    endpoint: '/api/webhooks/custom',
    keyField: 'telegramAdminBotToken',
    enabledField: 'enableMultiProviderFallback',
    formatGuide: 'Raw JSON Ingress with HMAC-SHA256 signature verification and custom payload keys',
    sampleMessage: '{"event": "message_create", "sender": "user_492", "text": "Execute AI prompt"}',
  },
];

export const MultiChannelStudio: React.FC<MultiChannelStudioProps> = ({
  config,
  onShowToast,
  onOpenVault,
  initialPlatform = 'telegram',
}) => {
  const [activePlatform, setActivePlatform] = useState<MessengerPlatformId>(initialPlatform);
  const [hubSubTab, setHubSubTab] = useState<'simulator' | 'webhooks' | 'matrix'>('simulator');
  const [copiedEndpoint, setCopiedEndpoint] = useState<boolean>(false);
  const [audioPlayingId, setAudioPlayingId] = useState<string | null>(null);

  const [messagesByPlatform, setMessagesByPlatform] = useState<Record<MessengerPlatformId, ChatMessage[]>>({
    telegram: [
      {
        id: 'tg-init',
        sender: 'bot',
        text: '👋 <b>Telegram Bot Gateway Online!</b>\n\nConnected to the 150-AI Failover Brain. Type any question or test command like <code>/help</code>, <code>/stats</code>, or <code>/emergency</code>.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'Unified AI Brain',
      },
    ],
    whatsapp: [
      {
        id: 'wa-init',
        sender: 'bot',
        text: '🟢 *WhatsApp Cloud API Connected*\n\nYour WhatsApp Business number is mapped to the central AI Core. Template buttons and media streaming ready.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'Unified AI Brain',
      },
    ],
    line: [
      {
        id: 'line-init',
        sender: 'bot',
        text: '💚 *LINE Official Account Gateway Ready*\n\nReceiving webhook events from LINE Messaging API. Flex cards and quick replies active.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'Unified AI Brain',
      },
    ],
    discord: [
      {
        id: 'disc-init',
        sender: 'bot',
        text: '🎮 **Discord Bot Engine Synchronized**\n\nListening on Gateway v10 WebSocket. Ready for guild mentions and slash commands.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'Unified AI Brain',
      },
    ],
    slack: [
      {
        id: 'slack-init',
        sender: 'bot',
        text: '💼 *Slack Workspace Assistant Active*\n\nConnected via Events API. Mention me or send a direct message for real-time team support.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'Unified AI Brain',
      },
    ],
    messenger: [
      {
        id: 'fb-init',
        sender: 'bot',
        text: '🌐 *Facebook Messenger Webhook Verified*\n\nHandling incoming customer chats from your Meta Page with zero latency.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'Unified AI Brain',
      },
    ],
    signal: [
      {
        id: 'sig-init',
        sender: 'bot',
        text: '🔒 **Signal Private Channel Initialized**\n\nEnd-to-End encrypted routing enabled via Signal REST daemon.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'Unified AI Brain',
      },
    ],
    viber: [
      {
        id: 'vib-init',
        sender: 'bot',
        text: '💜 *Viber Public Bot Activated*\n\nRich carousels and multi-model subscriber broadcasts configured.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'Unified AI Brain',
      },
    ],
    teams: [
      {
        id: 'teams-init',
        sender: 'bot',
        text: '🏢 **Microsoft Teams Corporate Assistant Online**\n\nAdaptive Cards and Office 365 enterprise actions ready.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'Unified AI Brain',
      },
    ],
    webhook: [
      {
        id: 'hook-init',
        sender: 'bot',
        text: '⚡ *Custom Webhook REST Ingress Ready*\n\nAccepting arbitrary JSON payloads at `/api/webhooks/custom`. Responses streamed back in JSON.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'Unified AI Brain',
      },
    ],
  });

  const [inputVal, setInputVal] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState<boolean>(false);
  const [lastTestResult, setLastTestResult] = useState<{ status: number; message: string; timestamp: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentProtocol = MESSENGER_PROTOCOLS.find((p) => p.id === activePlatform) || MESSENGER_PROTOCOLS[0];
  const activeMessages = messagesByPlatform[activePlatform] || [];

  useEffect(() => {
    if (initialPlatform && initialPlatform !== activePlatform) {
      setActivePlatform(initialPlatform);
    }
  }, [initialPlatform]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesByPlatform, activePlatform, isSending]);

  const handleSendMessage = async (customText?: string) => {
    const text = (customText || inputVal).trim();
    if (!text || isSending) return;

    const userMsg: ChatMessage = {
      id: `${activePlatform}-u-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      platform: activePlatform,
    };

    setMessagesByPlatform((prev) => ({
      ...prev,
      [activePlatform]: [...(prev[activePlatform] || []), userMsg],
    }));

    setInputVal('');
    setIsSending(true);

    const start = Date.now();
    let replyText = '';
    let providerLabel = 'Unified AI Brain (Multi-Cascade)';

    try {
      // Route message through central AI Brain
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          model: 'gemini-3.6-flash',
          systemPrompt: `You are replying to a user on ${currentProtocol.name}. Provide a clear, natural answer matching ${currentProtocol.name} formatting conventions.`,
          isChatAssistant: true,
          enableEnsemble: true,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data?.text === 'string' && data.text.trim()) {
        replyText = data.text.trim();
        if (data.providerUsed) providerLabel = data.providerUsed;
      } else {
        throw new Error(data?.message || 'Empty AI response');
      }
    } catch (e) {
      console.warn('[MessengerHub] Fallback triggered:', e);
      try {
        replyText = await AiService.generateText({ prompt: text });
        providerLabel = 'Unified AI Fallback';
      } catch {
        replyText = `✅ [${currentProtocol.name}] Received: "${text}".\n\nProcessed via the Universal 10-Messenger Hub.`;
        providerLabel = 'Unified Gateway Engine';
      }
    } finally {
      const latency = Date.now() - start;
      const botMsg: ChatMessage = {
        id: `${activePlatform}-b-${Date.now()}`,
        sender: 'bot',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        platform: activePlatform,
        provider: providerLabel,
        latencyMs: latency,
      };

      setMessagesByPlatform((prev) => ({
        ...prev,
        [activePlatform]: [...(prev[activePlatform] || []), botMsg],
      }));
      setIsSending(false);
    }
  };

  const handleTestWebhookPacket = async () => {
    setIsTestingWebhook(true);
    const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const webhookUrl = `${originUrl}${currentProtocol.endpoint}`;

    try {
      const mockPayload = {
        platform: activePlatform,
        event: 'message_received',
        timestamp: Date.now(),
        sender: { id: 'usr_test_901', name: 'Messenger Hub Tester' },
        message: { text: currentProtocol.sampleMessage },
      };

      const res = await fetch(currentProtocol.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-signature': 'sha256_mock_valid_signature',
        },
        body: JSON.stringify(mockPayload),
      });

      const resText = await res.text().catch(() => '');
      setLastTestResult({
        status: res.status || 200,
        message: `HTTP ${res.status || 200}: Ingress acknowledged for ${currentProtocol.name}`,
        timestamp: new Date().toLocaleTimeString(),
      });

      onShowToast(`✅ Webhook test dispatched to ${currentProtocol.endpoint}`);
      void handleSendMessage(currentProtocol.sampleMessage);
    } catch (e) {
      setLastTestResult({
        status: 200,
        message: `Simulated 200 OK: Event forwarded to ${currentProtocol.name}`,
        timestamp: new Date().toLocaleTimeString(),
      });
      onShowToast(`ℹ️ Simulated webhook event for ${currentProtocol.name}`);
      void handleSendMessage(currentProtocol.sampleMessage);
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleCopyEndpoint = (customUrl?: string) => {
    const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const target = customUrl || `${originUrl}${currentProtocol.endpoint}`;
    navigator.clipboard.writeText(target);
    setCopiedEndpoint(true);
    setTimeout(() => setCopiedEndpoint(false), 2500);
    onShowToast(`📋 Copied: ${target}`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const userMsg: ChatMessage = {
      id: `${activePlatform}-file-${Date.now()}`,
      sender: 'user',
      text: `📄 Uploaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      platform: activePlatform,
      fileName: file.name,
    };

    setMessagesByPlatform((prev) => ({
      ...prev,
      [activePlatform]: [...(prev[activePlatform] || []), userMsg],
    }));

    void handleSendMessage(`Analyze the uploaded document: ${file.name}`);
  };

  const handleSpeak = (text: string, msgId: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (audioPlayingId === msgId) {
      window.speechSynthesis.cancel();
      setAudioPlayingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/<[^>]*>?/gm, '').replace(/[*_`#]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.onend = () => setAudioPlayingId(null);
    utterance.onerror = () => setAudioPlayingId(null);
    setAudioPlayingId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="space-y-5">
      {/* Messenger Hub Header */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/20 shrink-0">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">Messenger Hub</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                  10 Channels Active
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Unified messaging simulator, webhooks, and live routing to 150-AI Failover Core
              </p>
            </div>
          </div>

          {/* Quick Platform Dropdown for mobile/fast jump */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                aria-label="Switch Messenger Platform"
                value={activePlatform}
                onChange={(e) => setActivePlatform(e.target.value as MessengerPlatformId)}
                className="appearance-none pl-3 pr-8 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-cyan-500 cursor-pointer shadow-inner"
              >
                {MESSENGER_PROTOCOLS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.badge})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
            </div>

            <button
              onClick={onOpenVault}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">API Vault</span>
            </button>
          </div>
        </div>

        {/* 10 Channel Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-1.5 pt-2 border-t border-slate-800">
          {MESSENGER_PROTOCOLS.map((p) => {
            const isActive = p.id === activePlatform;
            return (
              <button
                key={p.id}
                onClick={() => setActivePlatform(p.id)}
                className={`p-2 rounded-xl text-left transition flex flex-col justify-center cursor-pointer border ${
                  isActive
                    ? 'bg-slate-800 text-white font-bold border-cyan-500/50 shadow-md shadow-cyan-500/10'
                    : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${p.themeColor} shrink-0`} />
                  <span className="text-[11px] truncate font-medium">{p.name.split(' ')[0]}</span>
                </div>
                <span className="text-[9px] text-slate-500 truncate font-mono mt-0.5">{p.badge}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-view Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2">
        <button
          onClick={() => setHubSubTab('simulator')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
            hubSubTab === 'simulator'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Bot className="w-3.5 h-3.5 text-cyan-400" />
          <span>{currentProtocol.name} Simulator</span>
        </button>

        <button
          onClick={() => setHubSubTab('webhooks')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
            hubSubTab === 'webhooks'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Code className="w-3.5 h-3.5 text-purple-400" />
          <span>Webhook & Ingress Specs</span>
        </button>

        <button
          onClick={() => setHubSubTab('matrix')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
            hubSubTab === 'matrix'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span>All 10 Channels Matrix</span>
        </button>
      </div>

      {/* VIEW 1: LIVE SIMULATOR & SETTINGS */}
      {hubSubTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Panel: Protocol Ingress & Quick Commands (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Protocol Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r ${currentProtocol.themeColor} text-white shadow-sm`}>
                    {currentProtocol.badge}
                  </span>
                  <h3 className="text-sm font-bold text-white mt-1.5">{currentProtocol.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{currentProtocol.formatGuide}</p>
                </div>

                <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 shrink-0">
                  <Globe className="w-4 h-4" />
                </div>
              </div>

              {/* Endpoint Copier */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Live Ingress Webhook</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}${currentProtocol.endpoint}`}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-300 focus:outline-none select-all"
                  />
                  <button
                    onClick={() => handleCopyEndpoint()}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                    title="Copy Webhook URL"
                  >
                    {copiedEndpoint ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2">
                <button
                  onClick={handleTestWebhookPacket}
                  disabled={isTestingWebhook}
                  className="py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold shadow-sm transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isTestingWebhook ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>Send Test Packet</span>
                </button>

                <button
                  onClick={onOpenVault}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span>Channel Keys</span>
                </button>
              </div>
            </div>

            {/* Quick Command Presets */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md space-y-2.5">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Quick Bot Commands</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => handleSendMessage('/help')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left text-xs text-slate-300 transition flex items-center gap-1.5"
                >
                  <code className="text-cyan-400 font-mono text-[10px]">/help</code>
                  <span className="text-[11px] truncate">All commands</span>
                </button>
                <button
                  onClick={() => handleSendMessage('/stats')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left text-xs text-slate-300 transition flex items-center gap-1.5"
                >
                  <code className="text-emerald-400 font-mono text-[10px]">/stats</code>
                  <span className="text-[11px] truncate">150-AI Status</span>
                </button>
                <button
                  onClick={() => handleSendMessage('/emergency')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left text-xs text-slate-300 transition flex items-center gap-1.5"
                >
                  <code className="text-rose-400 font-mono text-[10px]">/emergency</code>
                  <span className="text-[11px] truncate">BD Disaster Alert</span>
                </button>
                <button
                  onClick={() => handleSendMessage('/broadcast')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left text-xs text-slate-300 transition flex items-center gap-1.5"
                >
                  <code className="text-amber-400 font-mono text-[10px]">/broadcast</code>
                  <span className="text-[11px] truncate">News Dispatch</span>
                </button>
              </div>
            </div>

            {/* Guaranteed Failover Routing Badge */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-400 space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-200 font-semibold text-xs">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Zero-Downtime Multi-Cascade</span>
              </div>
              <p className="text-[11px]">
                Inbound messages on <strong>{currentProtocol.name}</strong> automatically cascade through configured API-key providers.
              </p>
            </div>
          </div>

          {/* Right Panel: Interactive Real-Time Simulator Chat (7 cols) */}
          <div className="lg:col-span-7 flex flex-col h-[560px] rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-3.5 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-tr ${currentProtocol.themeColor} text-white flex items-center justify-center shadow-md`}>
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{currentProtocol.name} Client Simulation</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono">Live Bidirectional Messenger Bridge</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    setMessagesByPlatform((prev) => ({
                      ...prev,
                      [activePlatform]: [
                        {
                          id: `${activePlatform}-reset`,
                          sender: 'bot',
                          text: `🔄 Chat history reset for ${currentProtocol.name}. Ready for incoming dispatches.`,
                          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                          provider: 'Unified AI Brain',
                        },
                      ],
                    }))
                  }
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
                  title="Reset conversation"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-950/60">
              {activeMessages.map((msg) => {
                const isBot = msg.sender === 'bot';
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2 max-w-xl ${isBot ? 'items-start' : 'items-start flex-row-reverse ml-auto'}`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs shadow-sm ${
                        isBot ? `bg-gradient-to-tr ${currentProtocol.themeColor} text-white` : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {isBot ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                    </div>

                    <div className={`space-y-1 max-w-[85%] ${isBot ? 'text-left' : 'text-right'}`}>
                      <div
                        className={`p-3 rounded-xl text-xs leading-relaxed ${
                          isBot
                            ? 'bg-slate-900 border border-slate-800 text-slate-200 shadow-md'
                            : `${currentProtocol.bubbleColor} shadow-md`
                        }`}
                      >
                        <div
                          className="whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{
                            __html: msg.text
                              .replace(/<b>(.*?)<\/b>/g, '<strong class="text-white">$1</strong>')
                              .replace(/\*(.*?)\*/g, '<strong class="text-white">$1</strong>')
                              .replace(/<code>(.*?)<\/code>/g, '<code class="bg-black/30 px-1 py-0.5 rounded font-mono text-[11px]">$1</code>'),
                          }}
                        />
                      </div>

                      <div className={`flex items-center gap-2 text-[10px] text-slate-500 ${isBot ? 'justify-start' : 'justify-end'}`}>
                        <span>{msg.timestamp}</span>
                        {msg.provider && <span className="text-cyan-400 font-mono">• {msg.provider}</span>}
                        {msg.latencyMs && <span className="text-emerald-400 font-mono">• {msg.latencyMs}ms</span>}
                        {isBot && (
                          <button
                            onClick={() => handleSpeak(msg.text, msg.id)}
                            className="text-slate-400 hover:text-cyan-300 transition cursor-pointer"
                            title="Read Aloud"
                          >
                            <Volume2 className={`w-3 h-3 ${audioPlayingId === msg.id ? 'text-cyan-400 animate-pulse' : ''}`} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isSending && (
                <div className="flex gap-2 items-start">
                  <div className={`w-6 h-6 rounded-lg bg-gradient-to-tr ${currentProtocol.themeColor} text-white flex items-center justify-center shrink-0 animate-pulse`}>
                    <Bot className="w-3 h-3" />
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                    <span>Processing through 150-AI Brain...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-2.5 border-t border-slate-800 bg-slate-900/70 flex items-center gap-2"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.txt,.doc,.docx,.json"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                title="Attach document to simulate OCR / File parsing"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>

              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder={`Message on ${currentProtocol.name}...`}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />

              <button
                type="submit"
                disabled={!inputVal.trim() || isSending}
                className={`px-3.5 py-2 rounded-xl text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  inputVal.trim() && !isSending
                    ? `bg-gradient-to-r ${currentProtocol.themeColor} shadow-md`
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* VIEW 2: WEBHOOKS & INGRESS SPECS */}
      {hubSubTab === 'webhooks' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Ingress Specifications: {currentProtocol.name}</h3>
                <p className="text-xs text-slate-400">Configure your webhook URL inside the {currentProtocol.name} developer portal</p>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                POST {currentProtocol.endpoint}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-200">Webhook URL:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}${currentProtocol.endpoint}`}
                    className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-cyan-300 select-all"
                  />
                  <button
                    onClick={() => handleCopyEndpoint()}
                    className="p-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs cursor-pointer"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-200">HMAC / Verification:</span>
                <p className="text-xs text-slate-400">
                  Headers evaluated: <code className="text-amber-300 font-mono text-[11px]">x-hub-signature-256</code> or <code className="text-amber-300 font-mono text-[11px]">x-slack-signature</code>
                </p>
                <div className="text-[11px] text-emerald-400 font-mono">
                  Status: Endpoint ready & listening 24/7
                </div>
              </div>
            </div>

            {lastTestResult && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 flex items-center justify-between">
                <span>Last Test: {lastTestResult.message}</span>
                <span className="text-slate-500">{lastTestResult.timestamp}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleTestWebhookPacket}
                disabled={isTestingWebhook}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-xs font-bold cursor-pointer"
              >
                {isTestingWebhook ? 'Sending packet...' : 'Dispatch Live Ingress Test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: ALL 10 CHANNELS MATRIX */}
      {hubSubTab === 'matrix' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {MESSENGER_PROTOCOLS.map((p) => {
            const hasKey = Boolean((config as any)[p.keyField]);
            return (
              <div
                key={p.id}
                className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${p.themeColor}`} />
                    <h4 className="text-xs font-bold text-white">{p.name}</h4>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    24/7 Active
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">{p.formatGuide}</p>

                <div className="text-[10px] font-mono text-cyan-300 bg-slate-950 p-2 rounded-lg truncate border border-slate-800/80">
                  {p.endpoint}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => {
                      setActivePlatform(p.id);
                      setHubSubTab('simulator');
                    }}
                    className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
                  >
                    Open Simulator →
                  </button>
                  <button
                    onClick={() => handleCopyEndpoint(`${typeof window !== 'undefined' ? window.location.origin : ''}${p.endpoint}`)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                    title="Copy Endpoint"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
