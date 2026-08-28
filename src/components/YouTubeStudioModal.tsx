import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Upload, X, Youtube } from 'lucide-react';
import { AuthService } from '../services/authService';
import { BotConfig } from '../types';

interface YouTubeStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BotConfig;
  onUpdateConfig: (updates: Partial<BotConfig>) => void;
  onShowToast: (msg: string) => void;
}

type PrivacyStatus = 'public' | 'private' | 'unlisted';

export const YouTubeStudioModal: React.FC<YouTubeStudioModalProps> = ({ isOpen, onClose, config, onShowToast }) => {
  const [step, setStep] = useState(1);
  const [video, setVideo] = useState<File | null>(null);
  const [topic, setTopic] = useState('');
  const [privacyStatus, setPrivacyStatus] = useState<PrivacyStatus>((config.youtubeDefaultPrivacy as PrivacyStatus) || 'public');
  const [madeForKids, setMadeForKids] = useState<boolean | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const close = () => { if (!isUploading) onClose(); };
  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Video file could not be read.'));
    reader.readAsDataURL(file);
  });

  const upload = async () => {
    if (!video || !topic.trim() || madeForKids === null) return;
    setIsUploading(true);
    try {
      const session = AuthService.getCurrentSession();
      const response = await fetch('/api/youtube/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.token || ''}` },
        body: JSON.stringify({
          videoBase64: await fileToBase64(video),
          mimeType: video.type || 'video/mp4',
          titlePrompt: topic.trim(),
          privacyStatus,
          madeForKids,
          youtube: {
            clientId: config.youtubeClientId,
            clientSecret: config.youtubeClientSecret,
            refreshToken: config.youtubeRefreshToken,
            channelId: config.youtubeChannelId,
            categoryId: config.youtubeDefaultCategory,
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || 'YouTube upload failed.');
      setResultUrl(data.url || null);
      onShowToast('YouTube video uploaded with AI SEO metadata.');
    } catch (error: any) {
      onShowToast(`YouTube upload failed: ${error?.message || 'Check OAuth settings.'}`);
    } finally {
      setIsUploading(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl p-6 space-y-6">
      <header className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3"><Youtube className="w-6 h-6 text-rose-400" /><div><h2 className="text-lg font-bold text-white">YouTube Auto Upload</h2><p className="text-xs text-slate-400">AI SEO metadata and live Data API v3 upload</p></div></div>
        <button onClick={close} disabled={isUploading} className="p-2 text-slate-400 hover:text-white disabled:opacity-40"><X className="w-5 h-5" /></button>
      </header>
      <div className="flex items-center gap-2 text-xs text-slate-400"><strong className="text-rose-400">Step {step} of 3</strong><div className="h-1 flex-1 bg-slate-800 rounded"><div className="h-1 bg-rose-500 rounded" style={{ width: `${step * 33.333}%` }} /></div></div>
      {step === 1 && <section className="space-y-4"><h3 className="text-sm font-semibold text-white">1. Select and describe the video</h3><input type="file" accept="video/*" onChange={(event) => setVideo(event.target.files?.[0] || null)} className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-rose-600 file:px-3 file:py-2 file:text-white" /><input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Describe the video for AI SEO generation" className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white" />{video && <p className="text-xs text-slate-400">Selected: {video.name} ({Math.round(video.size / 1024 / 1024)} MB)</p>}</section>}
      {step === 2 && <section className="space-y-4"><h3 className="text-sm font-semibold text-white">ভিডিওটি কি Public, Private নাকি Unlisted করতে চান?</h3><div className="grid grid-cols-3 gap-2">{(['public', 'private', 'unlisted'] as PrivacyStatus[]).map((option) => <button key={option} onClick={() => setPrivacyStatus(option)} className={`p-3 rounded-xl border text-sm capitalize ${privacyStatus === option ? 'border-rose-500 bg-rose-500/10 text-white' : 'border-slate-700 text-slate-400'}`}>{option}</button>)}</div></section>}
      {step === 3 && <section className="space-y-4"><h3 className="text-sm font-semibold text-white">ভিডিওটি কি Made for Kids (বাচ্চাদের জন্য) নাকি Not Made for Kids (বাচ্চাদের জন্য নয়)?</h3><div className="grid grid-cols-2 gap-3"><button onClick={() => setMadeForKids(true)} className={`p-4 rounded-xl border text-sm ${madeForKids === true ? 'border-rose-500 bg-rose-500/10 text-white' : 'border-slate-700 text-slate-400'}`}>Made for Kids</button><button onClick={() => setMadeForKids(false)} className={`p-4 rounded-xl border text-sm ${madeForKids === false ? 'border-rose-500 bg-rose-500/10 text-white' : 'border-slate-700 text-slate-400'}`}>Not Made for Kids</button></div>{resultUrl && <div className="flex items-center gap-2 text-emerald-400 text-sm"><CheckCircle2 className="w-4 h-4" /><a href={resultUrl} target="_blank" rel="noreferrer" className="underline">Open uploaded video</a></div>}</section>}
      <footer className="flex justify-between"><button onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1 || isUploading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-slate-300 disabled:opacity-40"><ArrowLeft className="w-4 h-4" />Back</button>{step < 3 ? <button onClick={() => setStep((current) => current + 1)} disabled={(step === 1 && (!video || !topic.trim())) || isUploading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white disabled:opacity-40">Next<ArrowRight className="w-4 h-4" /></button> : <button onClick={upload} disabled={madeForKids === null || isUploading || Boolean(resultUrl)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-40">{isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}{isUploading ? 'Uploading...' : 'Upload to YouTube'}</button>}</footer>
    </div>
  </div>;
};
