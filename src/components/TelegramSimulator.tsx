import React, { useState, useRef, useEffect } from 'react';
import { BotConfig } from '../types';
import {
  Send,
  Sparkles,
  Layers,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Info,
  Shield,
  Activity,
  BellRing,
  Bot,
  MessageSquare,
  Video,
  Image as ImageIcon,
  Search,
  Volume2,
  FileText,
  Paperclip,
  CloudSun,
  Languages,
  Timer,
  FileSearch,
  Smartphone,
  Radio,
  Globe,
  Cpu,
  Share2,
} from 'lucide-react';

interface TelegramSimulatorProps {
  config: BotConfig;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot' | 'system';
  platform?: 
    | 'telegram' 
    | 'discord' 
    | 'slack' 
    | 'whatsapp' 
    | 'twilio' 
    | 'pushover' 
    | 'pyrogram' 
    | 'line' 
    | 'matrix' 
    | 'apprise';
  text: string;
  timestamp: string;
  provider?: string;
  isCommand?: boolean;
  imageUrl?: string;
  fileName?: string;
}

export const TelegramSimulator: React.FC<TelegramSimulatorProps> = ({ config }) => {
  const [activePlatform, setActivePlatform] = useState<
    'telegram' | 'discord' | 'slack' | 'whatsapp' | 'twilio' | 'pushover' | 'pyrogram' | 'line' | 'matrix' | 'apprise'
  >('telegram');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [memoryTurns, setMemoryTurns] = useState<{ role: string; content: string; timestamp: number }[]>([]);
  const [simulatedProviderIndex, setSimulatedProviderIndex] = useState<number>(0);
  const [adminAlertToast, setAdminAlertToast] = useState<{ title: string; details: string; level: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const triggerAdminAlertToast = (title: string, details: string, level: string = 'WARNING') => {
    setAdminAlertToast({ title, details, level });
    setTimeout(() => {
      setAdminAlertToast(null);
    }, 6000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      platform: activePlatform,
      text: `📄 Uploaded document: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
      timestamp: getCurrentTime(),
      fileName: file.name,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    setTimeout(() => {
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      const providerName = 'Groq (LPU Inference - Llama 3.3 70B)';
      const botResponse = `📊 *Document Intelligence Analysis: \`${file.name}\`*\n*Engine:* \`${providerName}\`\n\n` +
        `### 📌 Executive Summary:\n` +
        `The document contains structured technical architectural specifications for deploying resilient 20-provider multi-platform AI agents across serverless clusters.\n\n` +
        `### 🔑 Key Takeaways & Extracted Insights:\n` +
        `1. **Zero-Downtime 20-Tier Multi-Cascade:** Automatically mitigates API key failures via 20 providers.\n` +
        `2. **Automated Document Intelligence:** Extracts text from ${isPdf ? 'PDF pages via pypdf' : 'plaintext/code streams'} and synthesizes executive bullet points.\n` +
        `3. **10-Platform Gateway:** Syncs responses across Telegram, Discord, Slack, and WhatsApp.\n\n` +
        `💡 *Extracted from 100% of uploaded text buffers.*`;

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: 'bot',
          platform: activePlatform,
          text: botResponse,
          timestamp: getCurrentTime(),
          provider: providerName,
        },
      ]);
      setIsTyping(false);
    }, 600);
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const userText = inputValue.trim();
    if (!userText) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      platform: activePlatform,
      text: userText,
      timestamp: getCurrentTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      let botResponse = '';
      let providerName = `Groq (${config.modelName})`;
      let generatedImageUrl: string | undefined = undefined;
      const isCommand = userText.startsWith('/');

      if (isCommand) {
        const cmdParts = userText.split(' ');
        const command = cmdParts[0].toLowerCase().replace('/', '');
        const args = cmdParts.slice(1).join(' ');

        switch (command) {
          case 'yt_seo':
            providerName = `Google Gemini (${config.geminiModel})`;
            botResponse = `🎬 *YouTube Viral SEO Intelligence Suite (Data API v3 Ready)*\n\n` +
              `🎯 **5 High-CTR Title Formulas for "${args || 'AI Bot Tutorial'}":**\n` +
              `1. \`🔥 How I Built a 20-AI-Provider Bot in 10 Minutes! (Groq + Gemini)\`\n` +
              `2. \`Stop Paying for AI APIs! 20 Free Providers in One Python Bot\`\n` +
              `3. \`Zero-Downtime Multi-Platform AI Bot: Telegram, Discord & Slack\`\n` +
              `4. \`Ultimate Free AI Cloud Deploy Guide (Render, Koyeb & Fly.io)\`\n` +
              `5. \`How to Automate YouTube Video Uploads with Python OAuth 2.0\`\n\n` +
              `🏷️ **High-Volume YouTube Tags:**\n` +
              `\`telegram bot, groq lpu, gemini 2.5 flash, discord bot python, free ai api, youtube automation\`\n\n` +
              `🎨 **AI Thumbnail Prompt (Midjourney / Pollinations):**\n` +
              `_"Photorealistic glowing robotic terminal running 20 AI providers with zero latency, neon cyan lighting, 8k render, high contrast."_\n\n` +
              `💡 *Ready for 1-click execution via \`/yt_upload\`.*`;
            break;

          case 'yt_upload':
            botResponse = `📤 *YouTube OAuth 2.0 Upload Controller:*\n\n` +
              `• **OAuth2 State:** \`AUTHENTICATED (Token Active)\`\n` +
              `• **Target Channel:** \`${config.youtubeChannelId || 'Default Authorized Channel'}\`\n` +
              `• **Privacy Mode:** \`${config.youtubeDefaultPrivacy?.toUpperCase() || 'PUBLIC'}\`\n` +
              `• **Chunk Size:** \`4MB Resumable Upload Chunks\`\n\n` +
              `💡 *Use \`/yt_upload <path_to_video> [optional_title]\` to queue automatic upload.*`;
            break;

          case 'image':
            generatedImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
              args || 'futuristic glowing cybernetic AI robot in neon server room'
            )}?width=800&height=600&nologo=true`;
            botResponse = `🎨 *AI Image Synthesized (Pollinations AI Free):*\n\nPrompt: _"${args || 'futuristic glowing cybernetic AI robot in neon server room'}"_\nResolution: \`800x600 HD\``;
            break;

          case 'weather':
            botResponse = `🌤️ *Live Weather Report: ${args || 'London, UK'}*\n• **Temperature:** \`21.5°C\` (70.7°F)\n• **Condition:** ⛅ Partly Cloudy\n• **Humidity:** \`64%\` | **Wind:** \`12.5 km/h\`\n💡 *Source: Open-Meteo Free API (Zero API Keys)*`;
            break;

          case 'translate':
            botResponse = `🌐 *Polyglot AI Translation:*\n\n• **Source Text:** "${args || 'Good morning, welcome to our AI bot'}"\n• **Translated (Bengali):** "শুভ সকাল, আমাদের এআই বটে আপনাকে স্বাগতম"\n• **Phonetics:** "Shuvo shokal, amader AI bot-e apnake shagotom"`;
            break;

          case 'search':
            botResponse = `🔍 *DuckDuckGo Web Search & AI Synthesis:*\n\nQuery: _"${args || 'Latest AI news 2026'}"_\n\n1. **Groq LPU:** Llama 3.3 70B delivers sub-100ms reasoning.\n2. **Gemini 2.5 Flash:** High-throughput multimodal processing with extended context.\n3. **Decentralized Inference:** Zero-downtime routing across 20 global providers.`;
            break;

          case 'providers':
            botResponse = `⚡ *20-Tier AI Failover Cascade Health:*\n\n` +
              `1. 🟢 **Groq (LPU):** \`142ms\` (Active Primary)\n` +
              `2. 🟢 **Google AI Studio (Gemini 2.5):** \`310ms\` (Standby)\n` +
              `3. 🟢 **Cerebras (1000+ t/s):** \`95ms\` (Standby)\n` +
              `4. 🟢 **OpenRouter (DeepSeek R1 free):** \`480ms\` (Standby)\n` +
              `5. 🟢 **SambaNova (200+ t/s):** \`120ms\` (Standby)\n` +
              `6. 🟢 **Pollinations AI (Zero Key):** \`380ms\` (Standby)\n` +
              `7. 🟢 **Mistral AI:** \`340ms\` (Standby)\n` +
              `8. 🟢 **GitHub Models (Azure):** \`290ms\` (Standby)\n` +
              `9. 🟢 **Cloudflare Workers AI:** \`210ms\` (Standby)\n` +
              `10. 🟢 **Together AI Turbo:** \`230ms\` (Standby)\n` +
              `11-20. 🟢 NVIDIA NIM, DeepInfra, Hugging Face, DeepSeek, Cohere, Chutes, Voyage, Replicate, Vercel AI, Ollama.`;
            break;

          case 'health':
            botResponse = `📊 *System Health & Platform Gateway Report:*\n\n` +
              `• **Uptime:** \`99.99%\` (24/7 Background Worker)\n` +
              `• **AI Failover Pool:** \`20 / 20 Available\`\n` +
              `• **Messaging Gateways:** \`10 Protocols Active (Telegram, Discord, Slack, WhatsApp, Twilio, Pushover, Line, Matrix, Pyrogram, Apprise)\`\n` +
              `• **YouTube Data API v3:** \`OAuth 2.0 Authenticated\`\n` +
              `• **Memory Buffer:** \`${memoryTurns.length} active conversation turns\``;
            break;

          case 'testalert':
            triggerAdminAlertToast(
              'Diagnostic Heartbeat Test Alert',
              'Multi-channel diagnostic ping broadcasted across Telegram, Discord, and Pushover.',
              'INFO'
            );
            botResponse = `✅ *Diagnostic Alert Broadcasted!*\n\nDispatched simultaneously to:\n1. **Telegram Admin ID:** \`${config.adminTelegramId || '123456789'}\`\n2. **Discord Webhook:** \`${config.discordAdminWebhookUrl || 'Configured Webhook'}\``;
            break;

          case 'reset':
            setMemoryTurns([]);
            botResponse = `🧹 *Conversation memory cleared.* (0 turns in active sliding window).`;
            break;

          default:
            botResponse = `🤖 Command recognized. Type \`/help\`, \`/yt_seo\`, \`/image\`, \`/search\`, \`/weather\`, \`/translate\`, or \`/providers\` to explore features.`;
            break;
        }
      } else {
        const providers = [
          { name: `Groq (${config.modelName})`, label: 'Groq Cloud' },
          { name: `Google Gemini (${config.geminiModel})`, label: 'Google Gemini' },
          { name: `Cerebras (${config.cerebrasModel})`, label: 'Cerebras' },
          { name: `OpenRouter (DeepSeek R1 free)`, label: 'OpenRouter Free' },
          { name: `SambaNova (${config.sambanovaModel || 'Llama 3.3'})`, label: 'SambaNova' },
          { name: `Pollinations.ai (Free Zero-Key)`, label: 'Pollinations AI' },
          { name: `Mistral AI (${config.mistralModel})`, label: 'Mistral AI' },
          { name: `GitHub Models (${config.githubModel || 'gpt-4o-mini'})`, label: 'GitHub Models' },
        ];

        const activeProv = providers[simulatedProviderIndex % providers.length];
        providerName = activeProv.name;

        if (simulatedProviderIndex > 0) {
          triggerAdminAlertToast(
            `Failover Triggered: ${activeProv.label}`,
            `Traffic routed to ${activeProv.name} across 10 messaging gateways`,
            'WARNING'
          );
        }

        botResponse = `Here is a helpful response to: *"${userText}"* on **${activePlatform.toUpperCase()}**!\n\n• **Inference Provider:** \`${providerName}\`\n• **Context Retention:** Memory saved in shared buffer (${memoryTurns.length + 1} turns)\n• **10-Platform Gateway:** Concurrently available on Telegram, Discord, Slack, WhatsApp, Twilio, Pushover, Line, Matrix, Pyrogram, and Apprise.`;

        setMemoryTurns((prev) => [
          ...prev,
          { role: 'user', content: userText, timestamp: Date.now() },
          { role: 'assistant', content: botResponse, timestamp: Date.now() },
        ]);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: 'bot',
          platform: activePlatform,
          text: botResponse,
          timestamp: getCurrentTime(),
          provider: providerName,
          isCommand: isCommand,
          imageUrl: generatedImageUrl,
        },
      ]);
      setIsTyping(false);
    }, 450);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        sender: 'bot',
        platform: 'telegram',
        text: `👋 *Welcome to the 20-AI Provider Multi-Platform Bot Simulator!*\n\n• **10 Messaging Gateways:** Concurrently handles **Telegram**, **Discord**, **Slack**, **WhatsApp**, **Twilio**, **Pushover**, **Line**, **Matrix**, **Pyrogram**, and **Apprise**.\n• **20-Tier AI Failover:** Groq -> Gemini -> Cerebras -> OpenRouter -> SambaNova -> Pollinations -> Mistral -> GitHub Models -> Cloudflare -> Together -> NVIDIA -> DeepInfra -> Hugging Face -> DeepSeek -> Cohere -> Chutes -> Voyage -> Replicate -> Vercel -> Ollama.\n• **YouTube Studio Suite:** Try \`/yt_seo <topic>\` for viral title formulas & \`/yt_upload\` for OAuth2 auto-uploader.\n\nType a message or click any quick command below!`,
        timestamp: getCurrentTime(),
        provider: `Groq (${config.modelName})`,
      },
    ]);
  }, []);

  const getBubbleClass = (sender: 'user' | 'bot' | 'system') => {
    if (sender === 'user') {
      if (activePlatform === 'discord') return 'bg-indigo-600 text-white rounded-br-none';
      if (activePlatform === 'slack') return 'bg-emerald-600 text-white rounded-br-none';
      if (activePlatform === 'whatsapp') return 'bg-teal-600 text-white rounded-br-none';
      return 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-none';
    }
    return 'bg-slate-800 border border-slate-700/70 text-slate-200 rounded-bl-none shadow-md';
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-[600px] shadow-xl overflow-hidden relative">
      {/* Admin Alert Broadcast Toast Overlay */}
      {adminAlertToast && (
        <div className="absolute top-14 left-4 right-4 z-40 animate-bounce">
          <div className={`p-3 rounded-xl border shadow-2xl flex items-start gap-2.5 backdrop-blur-md ${
            adminAlertToast.level === 'CRITICAL' || adminAlertToast.level === 'ERROR'
              ? 'bg-rose-950/90 border-rose-500/60 text-rose-200'
              : adminAlertToast.level === 'WARNING'
              ? 'bg-amber-950/90 border-amber-500/60 text-amber-200'
              : 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'
          }`}>
            <BellRing className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <div className="font-bold flex items-center justify-between">
                <span>[SENTINEL ALERT] {adminAlertToast.title}</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-black/40">
                  Telegram + Discord + Pushover
                </span>
              </div>
              <p className="text-[11px] opacity-90 mt-0.5 font-mono">{adminAlertToast.details}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header Platform Switcher */}
      <div className="p-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white leading-none">Live Gateway Simulator</h3>
            <span className="text-[10px] text-slate-400 font-mono">10 Protocols • 20 AI Cascade</span>
          </div>
        </div>

        {/* 10-Platform Selector */}
        <select
          value={activePlatform}
          onChange={(e) => setActivePlatform(e.target.value as any)}
          className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-cyan-300 font-semibold focus:outline-none focus:border-cyan-500"
        >
          <option value="telegram">✈️ Telegram Bot</option>
          <option value="discord">👾 Discord Bot</option>
          <option value="slack">💬 Slack Bolt</option>
          <option value="whatsapp">📱 WhatsApp Cloud</option>
          <option value="twilio">📡 Twilio SMS/WA</option>
          <option value="pushover">🔔 Pushover API</option>
          <option value="pyrogram">⚡ Pyrogram MTProto</option>
          <option value="line">🟢 LINE Messenger</option>
          <option value="matrix">🌐 Matrix/Element</option>
          <option value="apprise">📢 Apprise Hub</option>
        </select>
      </div>

      {/* Quick Command Ribbon */}
      <div className="px-3 py-1.5 bg-slate-950/50 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
        <button
          onClick={() => {
            setInputValue('/yt_seo 20 Free AI APIs Python Bot');
          }}
          className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 shrink-0 cursor-pointer"
        >
          🎬 /yt_seo
        </button>
        <button
          onClick={() => {
            setInputValue('/yt_upload my_video.mp4');
          }}
          className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 shrink-0 cursor-pointer"
        >
          📤 /yt_upload
        </button>
        <button
          onClick={() => {
            setInputValue('/providers');
          }}
          className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 shrink-0 cursor-pointer"
        >
          ⚡ /providers
        </button>
        <button
          onClick={() => {
            setInputValue('/weather Tokyo');
          }}
          className="px-2 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 shrink-0 cursor-pointer"
        >
          🌤️ /weather
        </button>
        <button
          onClick={() => {
            setInputValue('/translate Hello world to Bengali');
          }}
          className="px-2 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 shrink-0 cursor-pointer"
        >
          🌐 /translate
        </button>
        <button
          onClick={() => {
            setInputValue('/image futuristic AI robot city');
          }}
          className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 shrink-0 cursor-pointer"
        >
          🎨 /image
        </button>
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 font-sans text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
              <span className="capitalize">{msg.platform || activePlatform}</span>
              <span>•</span>
              <span>{msg.timestamp}</span>
              {msg.provider && (
                <>
                  <span>•</span>
                  <span className="text-cyan-400 font-mono">{msg.provider}</span>
                </>
              )}
            </div>

            <div className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${getBubbleClass(msg.sender)}`}>
              <div className="whitespace-pre-wrap">{msg.text}</div>
              {msg.imageUrl && (
                <img
                  src={msg.imageUrl}
                  alt="Generated AI Preview"
                  className="mt-2.5 rounded-xl border border-slate-700 max-h-48 w-full object-cover shadow-lg"
                  loading="lazy"
                />
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 p-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>Bot is typing across 10 gateways...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Input Field */}
      <form onSubmit={handleSendMessage} className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
          accept=".pdf,.txt,.md,.py,.json"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          title="Upload Document (.pdf, .txt)"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={`Message on ${activePlatform} (try /yt_seo, /providers, /image)...`}
          className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />

        <button
          type="submit"
          className="p-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white transition shadow-md shadow-cyan-500/20 cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
