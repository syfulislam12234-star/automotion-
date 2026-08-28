import React, { useState } from 'react';
import { BotConfig, ChatMessage } from '../types';
import { AiService } from '../services/aiService';
import { X, Send, Bot, User, Sparkles, Zap, Trash2, ShieldCheck, RefreshCw } from 'lucide-react';

interface AiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BotConfig;
  onShowToast: (msg: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const AiChatModal: React.FC<AiChatModalProps> = ({
  isOpen,
  onClose,
  config,
  onShowToast,
  onNavigateTab,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'bot',
      text: `Hello! I am your 100-AI Super-Brain Assistant powered by **${config.botName || 'Universal Bot'}**. How can I assist you with bot deployments, multi-channel gateways, or Python scripts today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'user',
      text: input.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setIsThinking(true);

    try {
      const generatedText = await AiService.generateText({
        prompt: userMsg.text,
        model: config.modelName || 'gemini-3.6-flash',
        systemPrompt: config.systemPrompt,
        messages: [
          ...messages.map((message) => ({
            role: message.sender === 'bot' ? 'assistant' as const : 'user' as const,
            content: message.text,
          })),
          { role: 'user', content: userMsg.text },
        ],
      });

      const botResponse: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'bot',
        text: generatedText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botResponse]);
    } catch (err: any) {
      console.warn('[AiChatModal] AI response handled with fallback:', err);
      const fallbackResponse: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'bot',
        text: `🤖 I'm here to help! I received: *"**${userMsg.text}**"*. You can configure custom AI keys in the **AI Super-Brain** tab or launch actions via the **Telegram Simulator**.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackResponse]);
    } finally {
      setLoading(false);
      setIsThinking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl h-[600px] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">AI Copilot & Multi-Tier Assistant</h3>
              <p className="text-xs text-slate-400">100-AI Redundancy Cascade • Live Failover</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 rounded-xl transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isThinking && (
          <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950/40 px-4 py-3 text-xs text-slate-400" role="status" aria-live="polite">
            <span>AI is thinking...</span>
            <span className="flex items-center gap-1" aria-hidden="true">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400" />
            </span>
          </div>
        )}

        {/* Message history */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'bot' && (
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`p-3 rounded-2xl max-w-[80%] text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-cyan-600 text-white rounded-br-none'
                    : 'bg-slate-950/90 border border-slate-800 text-slate-200 rounded-bl-none'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>
                <div className="text-[10px] text-slate-400 mt-1 text-right">{msg.timestamp}</div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 animate-pulse">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 text-xs text-cyan-400 italic">
                Cascading across 100 AI providers...
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-950/60 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask questions about bot scripts, models, or failover rules..."
            className="flex-1 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
