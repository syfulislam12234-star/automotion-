import React, { useState } from 'react';
import { BotConfig } from '../types';
import { X, Rocket, Copy, Check, Terminal, ExternalLink, ShieldCheck, Server } from 'lucide-react';

interface DeployGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BotConfig;
}

export const DeployGuideModal: React.FC<DeployGuideModalProps> = ({ isOpen, onClose, config }) => {
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, stepIndex: number) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(stepIndex);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const steps = [
    {
      title: '1. Clone or Download Repository',
      code: `git clone https://github.com/your-username/remix-telegram-groq-bot.git\ncd remix-telegram-groq-bot\npip install -r requirements.txt`,
      description: 'Clone the Naxora AI source or download the production ZIP bundle.',
    },
    {
      title: '2. Configure Environment Variables',
      code: `export TELEGRAM_BOT_TOKEN="${config.telegramBotToken || 'YOUR_BOT_TOKEN'}"\nexport GROQ_API_KEY="${config.groqApiKey || 'YOUR_GROQ_API_KEY'}"\nexport GEMINI_API_KEY="${config.geminiApiKey || 'YOUR_GEMINI_API_KEY'}"`,
      description: 'Set your Telegram bot token and multi-tier AI provider API credentials.',
    },
    {
      title: '3. Launch Local or Cloud Worker',
      code: `python3 bot.py`,
      description: 'Run the zero-downtime Python worker with automated failover and 100-AI cascade.',
    },
    {
      title: '4. Deploy to Render / Railway / Cloud Run',
      code: `# Dockerfile is included for zero-config containerized deployment\ndocker build -t remix-telegram-bot .\ndocker run -p 8080:8080 -e PORT=8080 remix-telegram-bot`,
      description: 'One-click deploy to Render, Railway, or Google Cloud Run.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Zero-Downtime Deployment Guide</h2>
              <p className="text-xs text-slate-400">Step-by-step instructions for 24/7 cloud hosting</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-200 text-sm">{step.title}</h4>
                <button
                  onClick={() => handleCopy(step.code, index)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition cursor-pointer"
                >
                  {copiedStep === index ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedStep === index ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-400">{step.description}</p>
              <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-cyan-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                {step.code}
              </pre>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
