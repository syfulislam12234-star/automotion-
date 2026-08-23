import React, { useState } from 'react';
import { GeneratedFile } from '../types';
import {
  Copy,
  Check,
  Download,
  FileCode,
  Search,
  Terminal,
  FileText,
  Settings,
  Sparkles,
  Edit3,
  Eye,
  Save,
  RotateCcw,
  Server,
  Play,
  Layers,
  Code2,
} from 'lucide-react';

interface CodeViewerProps {
  files: GeneratedFile[];
  activeFileIndex: number;
  onSelectFile: (index: number) => void;
  onShowToast?: (msg: string) => void;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  files,
  activeFileIndex,
  onSelectFile,
  onShowToast,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedFilesContent, setEditedFilesContent] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'editor' | 'deploy_snippets'>('editor');

  const currentFile = files[activeFileIndex] || files[0];
  const activeContent = editedFilesContent[currentFile.filename] ?? currentFile.content;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeContent);
      setCopied(true);
      if (onShowToast) onShowToast(`📋 Copied ${currentFile.filename} to clipboard!`);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const handleDownloadSingleFile = () => {
    const blob = new Blob([activeContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = currentFile.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (onShowToast) onShowToast(`💾 Downloaded ${currentFile.filename}`);
  };

  const handleContentChange = (newVal: string) => {
    setEditedFilesContent((prev) => ({
      ...prev,
      [currentFile.filename]: newVal,
    }));
  };

  const handleResetToDefault = () => {
    setEditedFilesContent((prev) => {
      const copy = { ...prev };
      delete copy[currentFile.filename];
      return copy;
    });
    if (onShowToast) onShowToast(`🔄 Reset ${currentFile.filename} to template default.`);
  };

  const lines = activeContent.split('\n');
  const lineCount = lines.length;
  const fileSizeKB = (new TextEncoder().encode(activeContent).length / 1024).toFixed(1);

  const getFileIcon = (filename: string) => {
    if (filename.endsWith('.py')) return <FileCode className="w-4 h-4 text-yellow-400" />;
    if (filename === 'requirements.txt') return <Terminal className="w-4 h-4 text-emerald-400" />;
    if (filename === 'Procfile') return <Settings className="w-4 h-4 text-purple-400" />;
    if (filename.startsWith('.env')) return <Settings className="w-4 h-4 text-amber-400" />;
    if (filename.endsWith('.yaml')) return <Settings className="w-4 h-4 text-cyan-400" />;
    return <FileText className="w-4 h-4 text-blue-400" />;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-full ring-1 ring-white/5">
      {/* Top Bar with Mode Controls */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
            <button
              onClick={() => setActiveSubTab('editor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'editor' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Source Code Studio
            </button>
            <button
              onClick={() => setActiveSubTab('deploy_snippets')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'deploy_snippets' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              VPS Deploy Snippets
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
              isEditing
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            {isEditing ? 'Read-Only Mode' : 'Live Raw Code Editor'}
          </button>

          {isEditing && (
            <button
              onClick={handleResetToDefault}
              className="p-1.5 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-slate-800 border border-slate-800 transition cursor-pointer"
              title="Reset file to default"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleDownloadSingleFile}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-slate-800 transition cursor-pointer"
            title={`Download ${currentFile.filename}`}
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-200 bg-slate-800 border border-slate-700 hover:bg-slate-700 transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy File</span>
              </>
            )}
          </button>
        </div>
      </div>

      {activeSubTab === 'editor' ? (
        <>
          {/* File Tabs Header */}
          <div className="bg-slate-950/80 border-b border-slate-800 px-3 pt-2.5 flex items-center justify-between overflow-x-auto gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
              {files.map((file, idx) => {
                const isActive = idx === activeFileIndex;
                const isModified = editedFilesContent[file.filename] !== undefined;

                return (
                  <button
                    key={file.filename}
                    onClick={() => onSelectFile(idx)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-slate-800 text-slate-100 font-semibold border border-slate-700 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    {getFileIcon(file.filename)}
                    <span>{file.filename}</span>
                    {isModified && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Modified" />}
                    {file.isImportant && !isModified && (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* File Details Subheader */}
          <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-medium">{currentFile.description}</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
              <span>{lineCount} lines</span>
              <span>•</span>
              <span>{fileSizeKB} KB</span>
              <span>•</span>
              <span className="uppercase text-cyan-400/90">{currentFile.language}</span>
            </div>
          </div>

          {/* Code Viewer / Raw Editor Box */}
          <div className="flex-1 overflow-auto bg-slate-950 p-4 font-mono text-xs text-slate-300 max-h-[640px] leading-relaxed select-text">
            {isEditing ? (
              <textarea
                value={activeContent}
                onChange={(e) => handleContentChange(e.target.value)}
                spellCheck={false}
                className="w-full h-full min-h-[500px] bg-transparent text-slate-100 font-mono text-xs focus:outline-none resize-none leading-relaxed selection:bg-indigo-500 selection:text-white"
              />
            ) : (
              <table className="w-full border-collapse font-mono">
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className="hover:bg-slate-900/60 transition-colors">
                      <td className="pr-4 text-right select-none text-slate-600 w-10 text-[11px] align-top font-mono">
                        {i + 1}
                      </td>
                      <td className="whitespace-pre-wrap break-all text-slate-200 font-mono">
                        {line.startsWith('#') || line.startsWith('//') ? (
                          <span className="text-slate-500 italic">{line}</span>
                        ) : line.startsWith('import ') ||
                          line.startsWith('from ') ||
                          line.startsWith('def ') ||
                          line.startsWith('class ') ||
                          line.startsWith('async ') ? (
                          <span className="text-cyan-400">{line}</span>
                        ) : line.includes('TELEGRAM_BOT_TOKEN') || line.includes('GROQ_API_KEY') ? (
                          <span className="text-amber-300 font-semibold">{line}</span>
                        ) : line.startsWith('"""') || line.endsWith('"""') ? (
                          <span className="text-emerald-400/90 italic">{line}</span>
                        ) : (
                          <span>{line}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        /* VPS Deployment Snippets */
        <div className="p-6 space-y-6 overflow-y-auto max-h-[640px]">
          <div className="space-y-4">
            <div>
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                Production Deployment Commands
              </h4>
              <p className="text-xs text-slate-400 mt-1">Copy and execute directly on Ubuntu, Debian, or Docker host</p>
            </div>

            {/* Docker Run */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">1. Docker One-Liner (Isolated Container)</span>
                <span className="text-slate-500 font-mono text-[11px]">Recommended</span>
              </div>
              <pre className="p-3 rounded-xl bg-slate-900 text-xs font-mono text-emerald-300 overflow-x-auto">
{`docker build -t universal-ai-bot .
docker run -d --name universal-ai-bot-daemon --restart unless-stopped -p 8080:8080 universal-ai-bot`}
              </pre>
            </div>

            {/* Systemd Daemon */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">2. Linux Systemd 24/7 Service Daemon</span>
                <span className="text-slate-500 font-mono text-[11px]">/etc/systemd/system/universal-bot.service</span>
              </div>
              <pre className="p-3 rounded-xl bg-slate-900 text-xs font-mono text-cyan-300 overflow-x-auto">
{`[Unit]
Description=Universal Multi-Platform 20-AI Bot Daemon
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/universal-ai-bot
ExecStart=/usr/bin/python3 /opt/universal-ai-bot/bot.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target`}
              </pre>
            </div>

            {/* Background Screen / Tmux */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">3. Quick Tmux / Screen Background Session</span>
              </div>
              <pre className="p-3 rounded-xl bg-slate-900 text-xs font-mono text-amber-300 overflow-x-auto">
{`screen -S universal_bot python3 bot.py
# Press CTRL+A then D to detach session safely`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
