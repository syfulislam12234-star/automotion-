import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  Trash2,
  Minimize2,
  Maximize2,
  Cpu,
  Layers,
  Copy,
  Check,
  Mic,
  Volume2,
  RefreshCw,
  HelpCircle,
  Code,
  Globe,
  Server,
  Zap,
  ChevronDown,
} from 'lucide-react';
import { BotConfig } from '../types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  provider?: string;
  latencyMs?: number;
  voiceInput?: boolean;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface AiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BotConfig;
  onShowToast?: (msg: string) => void;
  onNavigateTab?: (tab: 'simulator' | 'admin' | 'vps' | 'scanner' | 'studio') => void;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-welcome-1',
    role: 'assistant',
    content: `👋 **Hi! I'm your in-app AI Copilot & Bot Architect.**\n\nI can help you:\n- ⚡ **Optimize your 20-AI cascade** (Groq, Gemini, DeepSeek R1, Cerebras)\n- 🤖 **Configure 10 messaging gateways** (Telegram, Discord, WhatsApp, Slack)\n- 🚀 **Guide cloud deployments** (Render, Koyeb, Fly.io, or VPS)\n- 💡 **Brainstorm custom commands** (e.g. \`/yt_seo\`, document intelligence, auto-moderation)\n\nWhat would you like to build or troubleshoot today?`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    provider: 'Centralized Multi-Provider AI Engine (Zero-Key)',
    latencyMs: 45,
  },
];

const SUGGESTED_PROMPTS = [
  'How do I deploy this bot on Render for free?',
  'Explain the 20-tier AI failover cascade',
  'How to configure WhatsApp Cloud API?',
  'Give me 5 viral bot command ideas',
];

interface ChatInputProps {
  isLoading: boolean;
  onSend: (prompt: string, fromVoice?: boolean) => void;
  isOpen: boolean;
  onVoiceError: (message: string) => void;
}

const ChatInput = React.memo(({ isLoading, onSend, isOpen, onVoiceError }: ChatInputProps) => {
  const [value, setValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const voiceInputRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (isOpen) textareaRef.current?.focus();
  }, [isOpen]);

  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      onVoiceError('এই ব্রাউজারে voice input সমর্থিত নয়।');
      return;
    }

    try {
      const recognition = new Recognition();
      recognition.lang = 'bn-BD';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let transcript = '';
        for (let index = 0; index < event.results.length; index += 1) {
          transcript += event.results[index][0].transcript;
        }
        setValue(transcript);
        voiceInputRef.current = true;
      };
      recognition.onend = () => {
        recognitionRef.current = null;
        setIsListening(false);
      };
      recognition.onerror = (event) => {
        recognitionRef.current = null;
        setIsListening(false);
        onVoiceError(event.error === 'not-allowed'
          ? 'মাইক্রোফোন permission দেওয়া হয়নি। Browser settings থেকে permission দিন।'
          : 'Voice input সাময়িকভাবে unavailable।');
      };
      recognitionRef.current = recognition;
      setIsListening(true);
      recognition.start();
    } catch {
      setIsListening(false);
      onVoiceError('মাইক্রোফোন চালু করা যায়নি।');
    }
  };

  const submit = () => {
    const prompt = value.trim();
    if (!prompt || isLoading) return;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsListening(false);
    }
    onSend(prompt, voiceInputRef.current);
    voiceInputRef.current = false;
    setValue('');
  };

  return (
    <div className="p-3 bg-slate-950 border-t border-slate-800 rounded-b-3xl shrink-0">
      <form onSubmit={(event) => { event.preventDefault(); submit(); }} className="relative flex items-center gap-2">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Ask about bot code, cascades, webhooks, or VPS deployment..."
          className="w-full bg-slate-900 border border-slate-700/80 rounded-2xl py-2.5 pl-11 pr-12 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 resize-none max-h-24 transition"
        />
        <button
          type="button"
          onClick={toggleVoiceInput}
          disabled={isLoading}
          className={`absolute left-2 p-2 rounded-xl transition cursor-pointer disabled:opacity-40 ${isListening ? 'text-rose-300 bg-rose-500/20 animate-pulse' : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800'}`}
          title={isListening ? 'Stop voice input' : 'Start Bengali voice input'}
          aria-label={isListening ? 'Stop voice input' : 'Start Bengali voice input'}
        >
          <Mic className="w-3.5 h-3.5" />
        </button>
        <button
          type="submit"
          disabled={isLoading || !value.trim()}
          className="absolute right-2 p-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-cyan-500/20 active:scale-95 cursor-pointer"
          title="Send Message (Enter)"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
      <div className="mt-1.5 px-1 flex items-center justify-between text-[10px] text-slate-400 font-mono">
        <span>Shift + Enter for new line</span>
        <span className="text-cyan-400/80 font-sans">Powered by Google Gemini & Groq</span>
      </div>
    </div>
  );
});

const MemoizedMessageContent = React.memo(({ content, renderContent }: {
  content: string;
  renderContent: (value: string) => React.ReactNode;
}) => <div className="space-y-1">{renderContent(content)}</div>);

export const AiChatModal: React.FC<AiChatModalProps> = ({
  isOpen,
  onClose,
  config,
  onShowToast,
  onNavigateTab,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('universal_bot_copilot_chat');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((message): message is ChatMessage => (
            message &&
            typeof message === 'object' &&
            (message.role === 'user' || message.role === 'assistant') &&
            typeof message.content === 'string'
          ));
        }
      }
    } catch {
      // Use an empty chat when persisted data is invalid.
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<'gemini-3.7-flash' | 'groq-llama-3.3' | 'deepseek-r1' | 'cerebras-llama3.3'>('gemini-3.7-flash');
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const typewriterTimersRef = useRef<Set<ReturnType<typeof setInterval>>>(new Set());

  useEffect(() => () => {
    audioRef.current?.pause();
    if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
    typewriterTimersRef.current.forEach((timer) => clearInterval(timer));
    typewriterTimersRef.current.clear();
  }, []);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages, isLoading]);

  // Persist messages in localStorage
  useEffect(() => {
    try {
      localStorage.setItem('universal_bot_copilot_chat', JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  const speakMessage = useCallback(async (text: string, messageId: string) => {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) return;
      const audioUrl = URL.createObjectURL(await response.blob());
      audioRef.current?.pause();
      if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setSpeakingMessageId(messageId);
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setSpeakingMessageId(null);
      };
      await audio.play();
    } catch {
      setSpeakingMessageId(null);
    }
  }, []);

  const streamAssistantText = useCallback((messageId: string, text: string): Promise<void> => {
    return new Promise((resolve) => {
      let position = 0;
      const timer = setInterval(() => {
        position = Math.min(text.length, position + 3);
        const visibleText = text.slice(0, position);
        setMessages((previous) => previous.map((message) => (
          message.id === messageId ? { ...message, content: visibleText } : message
        )));
        if (position >= text.length) {
          clearInterval(timer);
          typewriterTimersRef.current.delete(timer);
          resolve();
        }
      }, 18);
      typewriterTimersRef.current.add(timer);
    });
  }, []);

  const handleSendMessage = useCallback(async (textToSend: string, fromVoice = false) => {
    if (!textToSend || isLoading) return;

    setAssistantError(null);
    setLastFailedPrompt(null);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const startTime = Date.now();

    try {
      // Build conversation history for context
      const historyPayload = messages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      historyPayload.push({
        role: 'user',
        content: textToSend,
      });

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          history: historyPayload,
          model: selectedModel === 'gemini-3.7-flash' ? 'gemini-3.7-flash' : 'gemini-2.5-flash',
          isChatAssistant: true,
          platform: 'in_app_chat',
        }),
      });

      const data = await response.json().catch(() => ({}));
      const latency = Date.now() - startTime;

      if (response.ok && data && data.text) {
        const assistantMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          provider: data.providerUsed || 'Centralized Multi-Provider Engine',
          latencyMs: data.latencyMs || latency,
          voiceInput: fromVoice,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        await streamAssistantText(assistantMsg.id, data.text);
        if (fromVoice) void speakMessage(data.text, assistantMsg.id);
      } else {
        throw new Error(data.message || data.error || 'Unable to generate response');
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      setAssistantError(err?.message || 'The assistant could not connect right now.');
      setLastFailedPrompt(textToSend);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, selectedModel, speakMessage, streamAssistantText]);

  const handleClearHistory = () => {
    setMessages(INITIAL_MESSAGES);
    try {
      localStorage.removeItem('universal_bot_copilot_chat');
    } catch {
      // ignore
    }
    if (onShowToast) onShowToast('🧹 Chat history cleared.');
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    if (onShowToast) onShowToast('📋 Response copied to clipboard!');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleVoiceError = (message: string) => {
    setAssistantError(message);
    if (onShowToast) onShowToast(message);
  };

  // Helper to format basic markdown text nicely
  const renderFormattedContent = useCallback((content: string) => {
    // Simple markdown renderer for headers, bold, code blocks, bullet points
    const lines = content.split('\n');
    return lines.map((line, i) => {
      // Heading 3
      if (line.startsWith('### ')) {
        return (
          <h4 key={i} className="text-sm font-bold text-cyan-300 mt-2 mb-1">
            {line.replace('### ', '')}
          </h4>
        );
      }
      // Heading 2 / 1
      if (line.startsWith('## ') || line.startsWith('# ')) {
        return (
          <h3 key={i} className="text-sm font-extrabold text-white mt-3 mb-1.5 border-b border-slate-700/60 pb-1">
            {line.replace(/^#+\s/, '')}
          </h3>
        );
      }
      // Bullet list item
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const itemText = line.trim().replace(/^[-*]\s/, '');
        return (
          <div key={i} className="flex items-start gap-2 my-0.5 text-xs text-slate-200 pl-1">
            <span className="text-cyan-400 mt-0.5">•</span>
            <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(itemText) }} />
          </div>
        );
      }
      // Numbered list item
      if (/^\d+\.\s/.test(line.trim())) {
        return (
          <div key={i} className="flex items-start gap-2 my-0.5 text-xs text-slate-200 pl-1">
            <span className="text-cyan-400 font-mono font-bold mt-0.5">{line.trim().match(/^\d+\./)?.[0]}</span>
            <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line.trim().replace(/^\d+\.\s*/, '')) }} />
          </div>
        );
      }
      // Code block lines or single backticks
      if (line.startsWith('```')) {
        return null; // Handled generally
      }
      // Empty line
      if (!line.trim()) {
        return <div key={i} className="h-1.5" />;
      }
      // Standard paragraph
      return (
        <p
          key={i}
          className="text-xs text-slate-200 leading-relaxed my-0.5"
          dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line) }}
        />
      );
    });
  }, []);

  const formatInlineMarkdown = (text: string) => {
    let formatted = text
      // Escape raw HTML tags
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Bold **text**
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
      // Inline code `code`
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-900 text-cyan-300 font-mono text-[11px] border border-cyan-500/30">$1</code>')
      // Italic *text* or _text_
      .replace(/_([^_]+)_/g, '<em class="text-slate-300 italic">$1</em>');
    return formatted;
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`fixed z-50 flex flex-col transition-all duration-300 ease-out shadow-2xl bg-slate-900 border border-slate-700/80 ${
        isExpanded
          ? 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-[680px] h-[calc(100vh-4rem)] max-h-[820px] rounded-3xl'
          : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-[460px] h-[600px] max-h-[calc(100vh-5rem)] rounded-3xl'
        }`}
      >
      {/* Header Bar */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/60 border-b border-slate-800 rounded-t-3xl flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-slate-900 rounded-full animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">AI Assistant & Copilot</h3>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                PRO ENGINE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span>Centralized Multi-Tier AI</span>
              <span>•</span>
              <span className="text-emerald-400 font-medium">Zero Keys Needed</span>
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleClearHistory}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition cursor-pointer"
            title="Clear Chat History"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition cursor-pointer hidden sm:flex"
            title={isExpanded ? 'Minimize Window' : 'Expand Window'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
            title="Close Chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Engine & Quick Navigation Ribbon */}
      <div className="px-4 py-2 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between text-[11px] gap-2 shrink-0">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Active Model:</span>
          <select
            value={selectedModel}
            onChange={(e: any) => setSelectedModel(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-0.5 text-[11px] focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="gemini-3.7-flash">Gemini 3.7 Flash (Default Pro)</option>
            <option value="groq-llama-3.3">Groq Llama 3.3 70B (Fast LPU)</option>
            <option value="deepseek-r1">DeepSeek R1 (Reasoning)</option>
            <option value="cerebras-llama3.3">Cerebras (1000+ t/s)</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('vps')}
              className="text-slate-400 hover:text-cyan-300 transition text-[10px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md cursor-pointer flex items-center gap-1"
            >
              <Server className="w-3 h-3 text-cyan-400" />
              <span>VPS</span>
            </button>
          )}
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('scanner')}
              className="text-slate-400 hover:text-cyan-300 transition text-[10px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md cursor-pointer flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Scanner</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs select-text scrollbar-thin scrollbar-thumb-slate-700">
        {(messages?.length ? messages : []).map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-cyan-500/20 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl p-3.5 space-y-2 relative group ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white rounded-tr-xs shadow-md shadow-cyan-600/20'
                  : 'bg-slate-950 border border-slate-800 text-slate-100 rounded-tl-xs shadow-md'
              }`}
            >
              {/* Message Body */}
              <MemoizedMessageContent content={msg.content} renderContent={renderFormattedContent} />

              {/* Message Metadata & Copy Button */}
              <div
                className={`flex items-center justify-between pt-1 border-t text-[10px] ${
                  msg.role === 'user' ? 'border-cyan-500/30 text-cyan-100' : 'border-slate-800/80 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{msg.timestamp}</span>
                  {msg.provider && (
                    <span className="font-mono text-[9px] text-cyan-400/90 truncate max-w-[160px]">
                      • {msg.provider}
                    </span>
                  )}
                  {msg.latencyMs && (
                    <span className="font-mono text-[9px] text-emerald-400">({msg.latencyMs}ms)</span>
                  )}
                </div>

                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => void speakMessage(msg.content, msg.id)}
                      className="opacity-60 group-hover:opacity-100 hover:text-cyan-300 transition cursor-pointer p-0.5"
                      title="Play voice response"
                      aria-label="Play voice response"
                    >
                      <Volume2 className={`w-3 h-3 ${speakingMessageId === msg.id ? 'text-cyan-300 animate-pulse' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleCopyMessage(msg.id, msg.content)}
                      className="opacity-60 group-hover:opacity-100 hover:text-cyan-300 transition cursor-pointer p-0.5"
                      title="Copy Answer"
                    >
                      {copiedIndex === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {/* Typing Indicator */}
        {isLoading && (
          <div className="flex items-start gap-2.5 justify-start">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-cyan-500/20 mt-0.5">
              <Bot className="w-4 h-4 animate-bounce" />
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl rounded-tl-xs p-3.5 text-xs text-slate-400 flex items-center gap-2.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              <span className="text-cyan-300 font-medium">AI ভাবছে... Thinking...</span>
              <div className="flex items-center gap-1 pl-1">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse delay-150"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse delay-300"></div>
              </div>
            </div>
          </div>
        )}

        {assistantError && (
          <div className="flex items-start gap-2.5 justify-start">
            <div className="w-7 h-7 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300 shrink-0 mt-0.5">
              <Bot className="w-4 h-4" />
            </div>
            <div className="rounded-2xl rounded-tl-xs border border-rose-500/30 bg-rose-950/30 p-3.5 text-xs text-rose-100 space-y-2">
              <p>{assistantError}</p>
              {lastFailedPrompt && (
                <button
                  type="button"
                  onClick={() => handleSendMessage(lastFailedPrompt)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/40 px-2.5 py-1.5 text-rose-200 hover:bg-rose-500/20 transition cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      {(messages?.length ?? 0) <= 2 && (
        <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-950/40 flex flex-wrap gap-1.5 shrink-0">
          <span className="text-[10px] text-slate-400 font-medium w-full flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-cyan-400" />
            Suggested prompts:
          </span>
          {SUGGESTED_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt)}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 transition cursor-pointer truncate max-w-full text-left"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

        <ChatInput isLoading={isLoading} onSend={handleSendMessage} onVoiceError={handleVoiceError} isOpen={isOpen} />
      </div>
    </>
  );
};
