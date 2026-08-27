import React, { useState } from 'react';
import {
  Download,
  Rocket,
  Bot,
  Globe,
  Check,
  Terminal,
  ExternalLink,
  Key,
  Lock,
  Unlock,
  ShieldCheck,
  Sparkles,
  Clock,
  User,
  LogOut,
  ChevronDown,
  CheckCircle2,
  KeyRound,
  Shield,
  Video,
  Layers,
  Radio,
  Menu,
  Mail,
} from 'lucide-react';
import { UserAccount } from '../types';

interface NavbarProps {
  currentUser: UserAccount | null;
  onOpenAuthModal: (tab?: 'login' | 'signup' | 'verify') => void;
  onLogOut: () => void;
  onOpenDeployGuide: () => void;
  onDownloadZip?: () => void;
  isZipping?: boolean;
  copiedAll?: boolean;
  onCopyAll?: () => void;
  onOpenPortal?: () => void;
  onOpenSubscriptionModal?: () => void;
  onOpenAiChat?: () => void;
  onOpenYouTubeStudio?: () => void;
  onSelectTab?: (tab: string) => void;
  isCodeStudioUnlocked?: boolean;
  onToggleSidebar?: () => void;
  onOpenAdminPortal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onOpenAuthModal,
  onLogOut,
  onOpenDeployGuide,
  onDownloadZip = () => {},
  isZipping = false,
  copiedAll = false,
  onCopyAll = () => {},
  onOpenPortal,
  onOpenSubscriptionModal,
  onOpenAiChat,
  onOpenYouTubeStudio,
  onSelectTab,
  isCodeStudioUnlocked = false,
  onToggleSidebar,
  onOpenAdminPortal,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const displayName = currentUser?.name || currentUser?.email?.split('@')[0] || 'User';

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left Branding */}
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button onClick={onToggleSidebar} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden" title="Open navigation">
              <Menu className="h-5 w-5" />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-slate-100 text-base sm:text-lg tracking-tight">
              Bot
            </h1>
          </div>
        </div>

        {/* Right Actions: Clean, modern, minimal essential controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {onSelectTab && (
            <button
              onClick={() => onSelectTab('gmail')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-300 bg-red-950/50 border border-red-500/30 hover:bg-red-900/40 transition shadow-sm cursor-pointer"
              title="Open Gmail Workspace Hub"
            >
              <Mail className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden md:inline">Gmail</span>
            </button>
          )}

          {onOpenYouTubeStudio && (
            <button
              onClick={onOpenYouTubeStudio}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-300 bg-rose-950/50 border border-rose-500/30 hover:bg-rose-900/40 transition shadow-sm cursor-pointer"
              title="YouTube Media Studio & AI SEO Generator"
            >
              <Video className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden md:inline">YouTube</span> Studio
            </button>
          )}

          {onOpenAiChat && (
            <button
              onClick={onOpenAiChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 hover:bg-cyan-900/50 hover:border-cyan-400 transition shadow-sm cursor-pointer"
              title="Open AI Assistant & Copilot Chat"
            >
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
              <span>AI Chat</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse hidden sm:inline-block"></span>
            </button>
          )}

          {onOpenAdminPortal && (
            <button onClick={onOpenAdminPortal} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-300 bg-amber-950/40 border border-amber-500/30 hover:bg-amber-900/40 transition" title="Open administrator authentication portal">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin Portal</span>
            </button>
          )}

          {onOpenSubscriptionModal && (
            <button
              onClick={onOpenSubscriptionModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-300 bg-amber-950/40 border border-amber-500/30 hover:bg-amber-900/40 transition shadow-sm cursor-pointer"
              title="Subscription & Managed Cloud Plans Portal"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Pro Plans</span>
            </button>
          )}

          {onOpenPortal && (
            <button
              onClick={onOpenPortal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 transition shadow-md shadow-cyan-500/20 cursor-pointer"
              title="1-Click Direct API Setup & Messaging Portal"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">1-Click</span> Portal
            </button>
          )}

          <button
            onClick={onOpenDeployGuide}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-cyan-300 bg-cyan-950/50 border border-cyan-700/40 hover:bg-cyan-900/50 transition shadow-sm cursor-pointer"
            title="Step-by-step Render deployment walkthrough"
          >
            <Rocket className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Cloud</span> Deploy
          </button>

          {/* User Account & Verification / Log In & Out */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/80 hover:border-slate-600 text-slate-200 transition cursor-pointer"
              >
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="" className="w-6 h-6 rounded-lg object-cover ring-1 ring-white/20" />
                ) : (
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white uppercase ring-1 ring-white/20">
                    {displayName.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div className="hidden md:flex flex-col text-left leading-tight">
                  <span className="text-xs font-bold text-white truncate max-w-[110px]">
                    {displayName}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-3 text-slate-200 z-50 animate-in fade-in slide-in-from-top-2 ring-1 ring-white/10">
                  <div className="p-2 border-b border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{displayName}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {currentUser.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
                    <div className="pt-1 flex items-center gap-1.5 text-[10px] text-emerald-400">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Verified Developer Account</span>
                    </div>
                  </div>

                  <div className="py-2 space-y-1">
                    {onOpenSubscriptionModal && (
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenSubscriptionModal();
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-800 text-amber-300 font-semibold flex items-center gap-2 transition cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Manage Subscription & Quotas</span>
                      </button>
                    )}
                    {onOpenYouTubeStudio && (
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenYouTubeStudio();
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-800 text-rose-300 font-semibold flex items-center gap-2 transition cursor-pointer"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>YouTube Media Studio</span>
                      </button>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogOut();
                      }}
                      className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 font-semibold transition cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => onOpenAuthModal('login')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer"
            >
              <User className="w-3.5 h-3.5" />
              <span>Log In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
