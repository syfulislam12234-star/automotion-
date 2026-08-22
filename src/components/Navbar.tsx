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
} from 'lucide-react';
import { UserAccount } from '../types';

interface NavbarProps {
  currentUser: UserAccount | null;
  onOpenAuthModal: (tab?: 'login' | 'signup' | 'verify') => void;
  onLogOut: () => void;
  onOpenDeployGuide: () => void;
  onDownloadZip: () => void;
  isZipping: boolean;
  copiedAll: boolean;
  onCopyAll: () => void;
  onOpenPortal?: () => void;
  onOpenSubscriptionModal?: () => void;
  isCodeStudioUnlocked?: boolean;
  onOpenAdminPinModal?: () => void;
  onLockCodeStudio?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onOpenAuthModal,
  onLogOut,
  onOpenDeployGuide,
  onDownloadZip,
  isZipping,
  copiedAll,
  onCopyAll,
  onOpenPortal,
  onOpenSubscriptionModal,
  isCodeStudioUnlocked = false,
  onOpenAdminPinModal,
  onLockCodeStudio,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left Branding */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-slate-100 text-lg tracking-tight">
                Groq Telegram Bot Builder
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                20 AI • 10 Gateways
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Python Async Bot • 20 AI Providers • 10 Messaging Gateways • YouTube Suite
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {onOpenSubscriptionModal && (
            <button
              onClick={onOpenSubscriptionModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-amber-300 bg-amber-950/50 border border-amber-500/40 hover:bg-amber-900/50 transition shadow-sm cursor-pointer"
              title="Subscription & Managed Cloud Plans Portal"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Pro Plans</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Soon
              </span>
            </button>
          )}

          {onOpenPortal && (
            <button
              onClick={onOpenPortal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 transition shadow-md shadow-cyan-500/20 active:scale-95 cursor-pointer"
              title="1-Click Direct API Setup & Messaging Portal"
            >
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">1-Click</span> Portal
            </button>
          )}

          <button
            onClick={onOpenDeployGuide}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-cyan-300 bg-cyan-950/60 border border-cyan-700/50 hover:bg-cyan-900/60 transition shadow-sm cursor-pointer"
            title="Step-by-step Render deployment walkthrough"
          >
            <Rocket className="w-4 h-4 text-cyan-400" />
            <span className="hidden md:inline">Cloud</span> Deploy Guide
          </button>

          {/* Admin Security Pin / Lock Toggle */}
          {isCodeStudioUnlocked ? (
            <button
              onClick={onLockCodeStudio}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 hover:bg-emerald-900/60 transition cursor-pointer"
              title="Admin Mode Active. Click to lock Code Studio."
            >
              <Unlock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden lg:inline">Admin Mode</span>
              <span className="px-1 py-0.2 text-[10px] bg-emerald-500/20 rounded">Lock</span>
            </button>
          ) : (
            onOpenAdminPinModal && (
              <button
                onClick={onOpenAdminPinModal}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 bg-slate-800/80 border border-slate-700 hover:text-slate-200 hover:bg-slate-700 transition cursor-pointer"
                title="Unlock Admin Code Studio with PIN"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden lg:inline">Admin PIN</span>
              </button>
            )
          )}

          {isCodeStudioUnlocked && (
            <button
              onClick={onCopyAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-700 transition cursor-pointer"
              title="Copy bot.py code to clipboard"
            >
              {copiedAll ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Terminal className="w-4 h-4 text-slate-400" />
                  <span className="hidden lg:inline">Copy</span> bot.py
                </>
              )}
            </button>
          )}

          <button
            onClick={onDownloadZip}
            disabled={isZipping}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 transition shadow-md shadow-cyan-500/25 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{isZipping ? 'Bundling...' : 'ZIP'}</span>
          </button>

          {/* User Account & Verification / Log In Gateway Button */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/80 hover:border-slate-600 text-slate-200 transition cursor-pointer"
              >
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white uppercase ring-1 ring-white/20">
                  {currentUser.name.charAt(0) || 'U'}
                </div>
                <div className="hidden md:flex flex-col text-left leading-tight">
                  <span className="text-xs font-bold text-white truncate max-w-[100px]">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-0.5 font-medium">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Verified
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-3 text-slate-200 z-50 animate-in fade-in slide-in-from-top-2 ring-1 ring-white/10">
                  <div className="p-2 border-b border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{currentUser.name}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {currentUser.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
                    <div className="pt-1 flex items-center gap-1.5 text-[10px] text-emerald-400">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Email Verified • Active Session</span>
                    </div>
                  </div>

                  <div className="py-2 space-y-1 text-xs">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenAuthModal('verify');
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Security & OTP Code</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">{currentUser.verificationCode || '749201'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenSubscriptionModal && onOpenSubscriptionModal();
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Subscription & Plan</span>
                    </button>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogOut();
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-400" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => onOpenAuthModal('login')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 transition shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer ring-1 ring-emerald-400/40"
              title="Sign in or verify developer account"
            >
              <User className="w-4 h-4" />
              <span>Log In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};


