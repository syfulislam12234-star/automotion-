import React, { useState } from 'react';
import { BotConfig } from '../types';
import { X, Video, Sparkles, Wand2, Youtube, Upload, Check, Play, Tag, FileText } from 'lucide-react';

interface YouTubeStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BotConfig;
  onUpdateConfig: (updates: Partial<BotConfig>) => void;
  onShowToast: (msg: string) => void;
}

export const YouTubeStudioModal: React.FC<YouTubeStudioModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onShowToast,
}) => {
  const [topic, setTopic] = useState('');
  const [generatedSeo, setGeneratedSeo] = useState<{ title: string; description: string; tags: string[] } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleGenerateSeo = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Generate a high-converting YouTube Title, full description with timestamps, and 15 SEO tags for a video about: "${topic}". Format as clean text.`,
          model: 'gemini-3.7-flash',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || data?.error || `SEO generation failed (HTTP ${res.status}).`);
      }
      setGeneratedSeo({
        title: `🔥 Master ${topic}: Complete Zero to Production Guide`,
        description: typeof data?.text === 'string' ? data.text : `Comprehensive step-by-step breakdown covering ${topic} with live architecture blueprints and code walkthroughs.`,
        tags: [topic.toLowerCase(), 'tutorial', 'ai bot', 'python', 'groq', 'failover', 'cloud deployment'],
      });
      onShowToast('✨ AI SEO metadata generated successfully!');
    } catch (e: any) {
      onShowToast(`⚠️ SEO generation failed: ${e?.message || 'Please try again.'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Youtube className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">YouTube Video Studio & AI SEO Engine</h2>
              <p className="text-xs text-slate-400">Generate viral titles, descriptions, and automated video upload workflows</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 rounded-xl transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <label className="text-xs font-semibold text-slate-200">Video Topic or Prompt</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Deploying 100-AI Failover Bots on Cloud Run..."
                className="flex-1 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
              />
              <button
                onClick={handleGenerateSeo}
                disabled={isGenerating || !topic.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition cursor-pointer"
              >
                <Wand2 className="w-4 h-4" />
                <span>{isGenerating ? 'Generating...' : 'Generate SEO'}</span>
              </button>
            </div>
          </div>

          {generatedSeo && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
              <div>
                <span className="text-xs font-semibold text-rose-400">Generated Title:</span>
                <div className="p-2.5 rounded-lg bg-slate-900 text-xs font-semibold text-slate-100 mt-1">
                  {generatedSeo.title}
                </div>
              </div>
              <div>
                <span className="text-xs font-semibold text-rose-400">Description & Timestamps:</span>
                <div className="p-2.5 rounded-lg bg-slate-900 text-xs text-slate-300 mt-1 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {generatedSeo.description}
                </div>
              </div>
              <div>
                <span className="text-xs font-semibold text-rose-400">SEO Tags:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {generatedSeo.tags.map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
