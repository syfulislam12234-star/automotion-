import React, { useState } from 'react';
import { GeneratedFile } from '../types';
import { Copy, Check, Download, FileCode, Search, Terminal, FileText, Settings, Sparkles } from 'lucide-react';

interface CodeViewerProps {
  files: GeneratedFile[];
  activeFileIndex: number;
  onSelectFile: (index: number) => void;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  files,
  activeFileIndex,
  onSelectFile,
}) => {
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentFile = files[activeFileIndex] || files[0];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const handleDownloadSingleFile = () => {
    const blob = new Blob([currentFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = currentFile.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const lines = currentFile.content.split('\n');
  const lineCount = lines.length;
  const fileSizeKB = (new TextEncoder().encode(currentFile.content).length / 1024).toFixed(1);

  const getFileIcon = (filename: string) => {
    if (filename.endsWith('.py')) return <FileCode className="w-4 h-4 text-yellow-400" />;
    if (filename === 'requirements.txt') return <Terminal className="w-4 h-4 text-emerald-400" />;
    if (filename === 'Procfile') return <Settings className="w-4 h-4 text-purple-400" />;
    if (filename.startsWith('.env')) return <Settings className="w-4 h-4 text-amber-400" />;
    if (filename.endsWith('.yaml')) return <Settings className="w-4 h-4 text-cyan-400" />;
    return <FileText className="w-4 h-4 text-blue-400" />;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full">
      {/* File Tabs Header */}
      <div className="bg-slate-950 border-b border-slate-800 px-3 pt-3 flex items-center justify-between overflow-x-auto gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
          {files.map((file, idx) => {
            const isActive = idx === activeFileIndex;
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
                {file.isImportant && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick actions for current file */}
        <div className="flex items-center gap-1.5 pb-2 shrink-0">
          <button
            onClick={handleDownloadSingleFile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-slate-800 transition cursor-pointer"
            title={`Download ${currentFile.filename}`}
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-slate-800 border border-slate-700 hover:bg-slate-700 transition cursor-pointer"
            title="Copy file contents"
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

      {/* Code Editor Window */}
      <div className="flex-1 overflow-auto bg-slate-950 p-4 font-mono text-xs text-slate-300 max-h-[640px] leading-relaxed select-text">
        <table className="w-full border-collapse font-mono">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-slate-900/60 transition-colors">
                <td className="pr-4 text-right select-none text-slate-600 w-10 text-[11px] align-top font-mono">
                  {i + 1}
                </td>
                <td className="whitespace-pre-wrap break-all text-slate-200 font-mono">
                  {/* Basic syntax coloring highlights */}
                  {line.startsWith('#') || line.startsWith('//') ? (
                    <span className="text-slate-500 italic">{line}</span>
                  ) : line.startsWith('import ') || line.startsWith('from ') || line.startsWith('def ') || line.startsWith('class ') || line.startsWith('async ') ? (
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
      </div>
    </div>
  );
};
