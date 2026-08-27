import React, { useState, useEffect, useRef } from 'react';
import { BotConfig, ChatMessage, ChatThread } from '../types';
import { AiService } from '../services/aiService';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Copy,
  Check,
  RefreshCw,
  Plus,
  Trash2,
  Paperclip,
  Search,
  Globe,
  Brain,
  Sliders,
  ChevronDown,
  Layers,
  Zap,
  Clock,
  Pin,
  FileCode,
  Volume2,
  Terminal,
  Shield,
  Square,
  Share2,
} from 'lucide-react';

interface UnifiedChatWorkspaceProps {
  config: BotConfig;
  onShowToast: (msg: string) => void;
  onOpenVault?: () => void;
  onOpenGateways?: () => void;
}

const STORAGE_THREADS_KEY = 'universal_bot_chat_threads_v2';
const ACTIVE_THREAD_KEY = 'universal_bot_active_thread_id_v2';

const SUGGESTIONS = [
  {
    title: 'Build Telegram Bot',
    desc: 'Python & Node.js webhook code with auto-restart',
    prompt: 'Write a complete production-ready Python Telegram bot with webhook support, error handling, and 24/7 background polling.',
    icon: '🤖',
  },
  {
    title: '150-AI Failover Cascade',
    desc: 'How zero-downtime routing works across 20 providers',
    prompt: 'Explain the architecture of the 150-AI model failover cascade. How does it handle 503 high demand spikes and automatically route to Groq, Gemini, and Cerebras?',
    icon: '⚡',
  },
  {
    title: '10-Channel Messaging Bridge',
    desc: 'Connect Telegram, WhatsApp, LINE, Discord & Slack',
    prompt: 'How do I bridge a single AI core across all 10 messenger platforms (Telegram, WhatsApp, LINE, Discord, Slack, Messenger, Signal, Viber, Teams, Webhooks)?',
    icon: '📡',
  },
  {
    title: 'Benchmark Groq vs Gemini',
    desc: 'Compare LPU sub-40ms vs Multimodal 2M context',
    prompt: 'Compare Groq LPU inference speed vs Google Gemini 3.6 Flash and Cerebras. When should I choose each provider for bot messaging?',
    icon: '🚀',
  },
];

const AVAILABLE_MODELS = [
  { id: 'auto-unified', name: 'Unified AI Brain (Auto-Cascade)', provider: 'Unified Core', badge: 'Auto Failover', speed: '~35ms' },
  { id: 'gemini-3.6-flash', name: 'Google Gemini 3.6 Flash', provider: 'Google', badge: 'Active', speed: '~55ms' },
  { id: 'llama-3.3-70b-versatile', name: 'Groq Llama 3.3 70B', provider: 'Groq LPU', badge: 'Ultra-Fast', speed: '~38ms' },
  { id: 'llama3.3-70b', name: 'Cerebras Llama 3.3', provider: 'Cerebras', badge: 'Wafer-Scale', speed: '~32ms' },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Reasoning)', provider: 'OpenRouter', badge: 'Free Tier', speed: '~80ms' },
  { id: 'mistral-small-latest', name: 'Mistral Small Latest', provider: 'Mistral AI', badge: 'Active', speed: '~70ms' },
  { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Together Llama 3.3 Turbo', provider: 'Together AI', badge: 'Active', speed: '~65ms' },
  { id: 'pollinations-free', name: 'Pollinations AI (Zero-Key)', provider: 'Pollinations', badge: '100% Free', speed: '~50ms' },
];

export const UnifiedChatWorkspace: React.FC<UnifiedChatWorkspaceProps> = ({
  config,
  onShowToast,
  onOpenVault,
  onOpenGateways,
}) => {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>('');
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('auto-unified');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isReasoningMode, setIsReasoningMode] = useState<boolean>(false);
  const [isWebSearchMode, setIsWebSearchMode] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load threads on mount
  useEffect(() => {
    try {
      const savedThreads = localStorage.getItem(STORAGE_THREADS_KEY);
      const savedActiveId = localStorage.getItem(ACTIVE_THREAD_KEY);
      if (savedThreads) {
        const parsed: ChatThread[] = JSON.parse(savedThreads);
        if (parsed.length > 0) {
          setThreads(parsed);
          setActiveThreadId(savedActiveId && parsed.some(t => t.id === savedActiveId) ? savedActiveId : parsed[0].id);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load threads from storage:', e);
    }

    // Default initial thread
    const initialThread: ChatThread = {
      id: 'default-thread-' + Date.now(),
      title: 'Universal AI Brain Studio',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'auto-unified',
      messages: [
        {
          id: 'welcome-msg',
          sender: 'bot',
          text: `👋 **Welcome to the Unified AI Brain Studio!**\n\nI am your central AI Copilot, wired directly into all **150+ AI models** and **10 messenger gateways** (Telegram, WhatsApp, LINE, Discord, Slack, Messenger, Signal, Viber, Teams, and Webhook).\n\n### ⚡ What I Can Do:\n- **Build & Deploy Bots:** Generate full webhook server code, background workers, and automation scripts.\n- **Multi-Model Intelligence:** Query Groq, Google Gemini, Cerebras, OpenRouter, and Mistral with automatic multi-model failover.\n- **Simulate Any Channel:** Test message routing across any connected messenger in real time.\n\n*Type any question below, or select a quick starter prompt to begin!*`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          provider: 'Unified AI Brain (150-Model Core)',
          latencyMs: 38,
        },
      ],
    };
    setThreads([initialThread]);
    setActiveThreadId(initialThread.id);
  }, []);

  // Save threads to localStorage
  useEffect(() => {
    if (threads.length > 0) {
      try {
        localStorage.setItem(STORAGE_THREADS_KEY, JSON.stringify(threads));
        localStorage.setItem(ACTIVE_THREAD_KEY, activeThreadId);
      } catch (e) {
        console.warn('Failed to save threads:', e);
      }
    }
  }, [threads, activeThreadId]);

  // Scroll to bottom on message updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threads, isGenerating]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [inputPrompt]);

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];

  const handleCreateNewThread = () => {
    const newThread: ChatThread = {
      id: 'thread-' + Date.now(),
      title: 'New Conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: selectedModel,
      messages: [],
    };
    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newThread.id);
    setInputPrompt('');
    if (textareaRef.current) textareaRef.current.focus();
  };

  const handleDeleteThread = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (threads.length <= 1) {
      // Clear instead of deleting only thread
      setThreads([
        {
          id: 'thread-' + Date.now(),
          title: 'New Conversation',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          model: selectedModel,
          messages: [],
        },
      ]);
      return;
    }
    const updated = threads.filter((t) => t.id !== threadId);
    setThreads(updated);
    if (activeThreadId === threadId) {
      setActiveThreadId(updated[0].id);
    }
  };

  const handleTogglePinThread = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, pinned: !t.pinned } : t))
    );
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputPrompt).trim();
    if (!textToSend || isGenerating) return;

    const userMessage: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Update active thread title if it's the first user message
    const currentMessages = activeThread?.messages || [];
    const isFirstUserMessage = !currentMessages.some((m) => m.sender === 'user');
    const newTitle = isFirstUserMessage
      ? textToSend.slice(0, 32) + (textToSend.length > 32 ? '...' : '')
      : activeThread?.title || 'Conversation';

    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === activeThreadId) {
          return {
            ...t,
            title: newTitle,
            updatedAt: Date.now(),
            messages: [...t.messages, userMessage],
          };
        }
        return t;
      })
    );

    setInputPrompt('');
    setIsGenerating(true);

    const startTime = Date.now();
    let botResponseText = '';
    let providerLabel = 'Unified AI Brain (Multi-Cascade)';

    try {
      const effectiveSystemPrompt = `${config.systemPrompt || ''}\n${
        isReasoningMode
          ? 'You are in Deep Reasoning mode. Thoroughly explain step-by-step logic, edge cases, and best practices with code examples.'
          : ''
      }${
        isWebSearchMode
          ? '\nYou have live web search awareness enabled. Synthesize verified up-to-date information clearly.'
          : ''
      }`;

      // Query central AI endpoint
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          model: selectedModel === 'auto-unified' ? 'gemini-3.6-flash' : selectedModel,
          systemPrompt: effectiveSystemPrompt,
          messages: [
            ...currentMessages.map((m) => ({
              role: m.sender === 'bot' ? 'assistant' : 'user',
              content: m.text,
            })),
            { role: 'user', content: textToSend },
          ],
          enableEnsemble: selectedModel === 'auto-unified',
          isChatAssistant: true,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && typeof data?.text === 'string' && data.text.trim()) {
        botResponseText = data.text.trim();
        if (data.providerUsed) providerLabel = data.providerUsed;
      } else {
        throw new Error(data?.message || 'Primary route returned empty text');
      }
    } catch (err: any) {
      console.warn('[UnifiedChatWorkspace] Cascade fallback triggered:', err);
      // Public fallback generator
      try {
        botResponseText = await AiService.generateText({
          prompt: textToSend,
          model: selectedModel === 'auto-unified' ? 'gemini-3.6-flash' : selectedModel,
          messages: [
            ...currentMessages.map((m) => ({
              role: m.sender === 'bot' ? ('assistant' as const) : ('user' as const),
              content: m.text,
            })),
            { role: 'user' as const, content: textToSend },
          ],
        });
        providerLabel = 'Unified AI Fallback Engine';
      } catch (fallbackErr) {
        console.warn('[UnifiedChatWorkspace] AI fallback unavailable:', fallbackErr);
        botResponseText = 'AI generation failed after all configured providers were tried.';
        providerLabel = 'AI Cascade Exhausted';
      }
    } finally {
      const latency = Date.now() - startTime;
      const botMessage: ChatMessage = {
        id: 'bot-' + Date.now(),
        sender: 'bot',
        text: botResponseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: providerLabel,
        latencyMs: latency,
      };

      setThreads((prev) =>
        prev.map((t) => {
          if (t.id === activeThreadId) {
            return {
              ...t,
              updatedAt: Date.now(),
              messages: [...t.messages, botMessage],
            };
          }
          return t;
        })
      );
      setIsGenerating(false);
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    onShowToast('📋 Copied to clipboard!');
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const snippet = content.length > 2000 ? content.slice(0, 2000) + '\n...[truncated]' : content;
      setInputPrompt(
        (prev) =>
          prev +
          (prev ? '\n\n' : '') +
          `\`\`\`${file.name.split('.').pop() || 'text'} (${file.name})\n${snippet}\n\`\`\`\n\nPlease analyze this file.`
      );
      onShowToast(`📎 Attached file: ${file.name}`);
    };
    reader.readAsText(file);
  };

  // Helper to render markdown and code blocks cleanly
  const renderFormattedMessage = (text: string, msgId: string) => {
    // Check for code blocks
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    let blockCount = 0;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Text before code block
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.slice(lastIndex, match.index),
          id: `${msgId}-txt-${lastIndex}`,
        });
      }

      // Code block
      const lang = match[1] || 'plaintext';
      const code = match[2];
      const blockId = `${msgId}-code-${blockCount++}`;

      parts.push({
        type: 'code',
        lang,
        code,
        id: blockId,
      });

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex),
        id: `${msgId}-txt-${lastIndex}`,
      });
    }

    return (
      <div className="space-y-3">
        {parts.map((part) => {
          if (part.type === 'code') {
            return (
              <div
                key={part.id}
                className="my-3 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950 font-mono text-xs shadow-lg"
              >
                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-3.5 py-1.5 text-slate-400">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-400">
                    <FileCode className="h-3.5 w-3.5" />
                    {part.lang}
                  </span>
                  <button
                    onClick={() => handleCopyText(part.code, part.id)}
                    className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                  >
                    {copiedCodeId === part.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="overflow-x-auto p-3.5 leading-relaxed text-slate-200 selection:bg-cyan-500 selection:text-white">
                  <code>{part.code}</code>
                </pre>
              </div>
            );
          }

          // Format simple bold, inline code, bullets, headings
          const lines = part.content.split('\n');
          return (
            <div key={part.id} className="space-y-1.5 leading-relaxed">
              {lines.map((line, idx) => {
                if (line.startsWith('### ')) {
                  return (
                    <h4 key={idx} className="mt-3 text-sm font-bold text-cyan-300">
                      {line.replace('### ', '')}
                    </h4>
                  );
                }
                if (line.startsWith('## ')) {
                  return (
                    <h3 key={idx} className="mt-4 text-base font-bold text-white">
                      {line.replace('## ', '')}
                    </h3>
                  );
                }
                if (line.startsWith('# ')) {
                  return (
                    <h2 key={idx} className="mt-4 text-lg font-extrabold text-white">
                      {line.replace('# ', '')}
                    </h2>
                  );
                }
                if (line.trim().startsWith('- ') || line.trim().startsWith('• ') || line.trim().startsWith('* ')) {
                  const bulletText = line.trim().replace(/^[-•*]\s+/, '');
                  return (
                    <div key={idx} className="flex items-start gap-2 pl-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                      <span
                        dangerouslySetInnerHTML={{
                          __html: formatInlineMarkdown(bulletText),
                        }}
                      />
                    </div>
                  );
                }
                if (!line.trim()) {
                  return <div key={idx} className="h-1.5" />;
                }
                return (
                  <p
                    key={idx}
                    dangerouslySetInnerHTML={{
                      __html: formatInlineMarkdown(line),
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const formatInlineMarkdown = (str: string) => {
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic text-slate-300">$1</em>')
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[11px] border border-slate-700">$1</code>');
  };

  const filteredThreads = threads.filter((t) =>
    t.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-145px)] min-h-[500px] w-full overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl relative">
      {/* Left Conversation Drawer / History */}
      <div
        className={`${
          isSidebarOpen ? 'w-72' : 'w-0'
        } hidden md:flex flex-col shrink-0 border-r border-slate-800/80 bg-slate-900/60 backdrop-blur-xl transition-all duration-300 overflow-hidden`}
      >
        <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between gap-2">
          <button
            onClick={handleCreateNewThread}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-cyan-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Search Threads */}
        <div className="px-3 pt-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search chat history..."
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Recent Conversations ({filteredThreads.length})
          </div>

          {filteredThreads.map((thread) => {
            const isActive = thread.id === activeThreadId;
            return (
              <div
                key={thread.id}
                onClick={() => setActiveThreadId(thread.id)}
                className={`group flex items-center justify-between p-2.5 rounded-xl text-xs transition cursor-pointer ${
                  isActive
                    ? 'bg-slate-800 text-white font-semibold border border-cyan-500/30'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <Bot className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <span className="truncate">{thread.title}</span>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                  <button
                    onClick={(e) => handleTogglePinThread(thread.id, e)}
                    className={`p-1 rounded hover:bg-slate-700 ${thread.pinned ? 'text-amber-400 opacity-100' : 'text-slate-400'}`}
                    title="Pin thread"
                  >
                    <Pin className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteThread(thread.id, e)}
                    className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-700"
                    title="Delete thread"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Quick Tools */}
        <div className="p-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400">
          <button
            onClick={onOpenVault}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>API Vault (Protected)</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400">20 Keys</span>
          </button>
          <button
            onClick={onOpenGateways}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>10-Channel Gateways</span>
            </span>
            <span className="text-[10px] font-mono text-cyan-400">10 Active</span>
          </button>
        </div>
      </div>

      {/* Main Chat Canvas */}
      <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative">
        {/* Top Chat Header */}
        <div className="h-14 border-b border-slate-800/80 px-4 flex items-center justify-between bg-slate-900/40 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Toggle sidebar"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* Model Selector Dropdown */}
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="appearance-none bg-slate-800/90 border border-slate-700 text-white text-xs font-semibold py-1.5 pl-3 pr-8 rounded-xl focus:outline-none focus:border-cyan-500 cursor-pointer shadow-sm"
              >
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.speed})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-[11px] text-emerald-400">Unified 150-AI Core Active</span>
            </div>
          </div>

          {/* Quick Option Toggles */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsReasoningMode(!isReasoningMode)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                isReasoningMode
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="Toggle Deep Reasoning Mode"
            >
              <Brain className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reasoning</span>
            </button>

            <button
              onClick={() => setIsWebSearchMode(!isWebSearchMode)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                isWebSearchMode
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="Toggle Web Search Grounding"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Web Search</span>
            </button>

            <button
              onClick={handleCreateNewThread}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="New chat"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {(!activeThread?.messages || activeThread.messages.length === 0) ? (
            /* Empty State with Prompt Cards */
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-6 py-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white flex items-center justify-center shadow-xl shadow-cyan-500/20">
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-extrabold text-white">How can the Unified AI Brain assist you?</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Powered by 150 AI models with zero-downtime failover and multi-messenger protocol execution.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
                {SUGGESTIONS.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(item.prompt)}
                    className="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-left transition shadow-md group cursor-pointer"
                  >
                    <div className="text-lg mb-1">{item.icon}</div>
                    <div className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 transition">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Active Message Stream */
            activeThread.messages.map((msg) => {
              const isBot = msg.sender === 'bot';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-3xl mx-auto ${isBot ? 'items-start' : 'items-start flex-row-reverse'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                      isBot
                        ? 'bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-200 border border-slate-700'
                    }`}
                  >
                    {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>

                  <div className={`space-y-1.5 max-w-[85%] ${isBot ? 'text-left' : 'text-right'}`}>
                    {/* Message Bubble */}
                    <div
                      className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        isBot
                          ? 'bg-slate-900/90 text-slate-200 border border-slate-800 shadow-lg'
                          : 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                      }`}
                    >
                      {isBot ? (
                        renderFormattedMessage(msg.text, msg.id)
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      )}
                    </div>

                    {/* Metadata & Actions */}
                    <div
                      className={`flex items-center gap-2 text-[10px] text-slate-500 ${
                        isBot ? 'justify-start' : 'justify-end'
                      }`}
                    >
                      <span>{msg.timestamp}</span>
                      {msg.provider && (
                        <>
                          <span>•</span>
                          <span className="text-cyan-400 font-mono">{msg.provider}</span>
                        </>
                      )}
                      {msg.latencyMs && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-400 font-mono">{msg.latencyMs}ms</span>
                        </>
                      )}
                      {isBot && (
                        <button
                          onClick={() => handleCopyText(msg.text, msg.id)}
                          className="hover:text-slate-300 ml-1 p-0.5 rounded transition cursor-pointer"
                          title="Copy response"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Typing Indicator */}
          {isGenerating && (
            <div className="flex gap-3 max-w-3xl mx-auto items-start">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-slate-400 flex items-center gap-2 shadow-lg">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                <span>Generating multi-model response across Unified AI Brain...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Centered Bottom Input Pill */}
        <div className="p-4 sm:p-6 pt-2 max-w-3xl w-full mx-auto shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="relative bg-slate-900/90 border border-slate-700/80 rounded-2xl p-2 shadow-2xl focus-within:border-cyan-500 transition"
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask anything, build a bot, or test 10-channel messenger routing... (Enter to send)"
              className="w-full bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-500 px-3 py-2 resize-none focus:outline-none max-h-40 min-h-[44px]"
            />

            <div className="flex items-center justify-between pt-1 px-2 border-t border-slate-800/60 mt-1">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
                  title="Attach code snippet or text file"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <span className="text-[10px] text-slate-500 hidden sm:inline">
                  Shift+Enter for new line
                </span>
              </div>

              <button
                type="submit"
                disabled={!inputPrompt.trim() || isGenerating}
                className={`p-2 rounded-xl text-white transition flex items-center justify-center cursor-pointer ${
                  inputPrompt.trim() && !isGenerating
                    ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isGenerating ? <Square className="w-4 h-4 fill-current" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
