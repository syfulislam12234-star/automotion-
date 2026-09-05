import React, { useState } from 'react';
import {
  MessageSquare,
  Sparkles,
  Brain,
  Radio,
  Globe,
  Smartphone,
  Hash,
  Send,
  Shield,
  ShieldCheck,
  Lock,
  Unlock,
  Key,
  Activity,
  Server,
  Clock,
  Scan,
  Video,
  Sliders,
  SlidersHorizontal,
  Mail,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  Layers,
  Zap,
  Terminal,
  LayoutDashboard,
  ShoppingCart,
  GraduationCap,
  MessageCircle,
} from 'lucide-react';

export type AppView =
  | 'chat'
  | 'simulator'
  | 'gateways'
  | 'cascade'
  | 'performance'
  | 'analyzer'
  | 'cron'
  | 'scanner'
  | 'youtube'
  | 'vault'
  | 'security'
  | 'vps'
  | 'admin'
  | 'preferences'
  | 'settings'
  | 'gmail'
  | 'ch-telegram'
  | 'ch-whatsapp'
  | 'ch-line'
  | 'ch-discord'
  | 'ch-slack'
  | 'ch-messenger'
  | 'ch-signal'
  | 'ch-viber'
  | 'ch-teams'
  | 'ch-webhook'
  | 'ecommerce-crm'
  | 'ai-trainer'
  | 'messenger-config';

interface SidebarProps {
  isOpen: boolean;
  activeView: AppView;
  onClose: () => void;
  onSelectView: (view: AppView) => void;
  onOpenAuth: () => void;
  onLogOut: () => void;
  onOpenVault?: () => void;
  currentUser: { name: string; email?: string; role?: string } | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  activeView,
  onClose,
  onSelectView,
  onOpenAuth,
  onLogOut,
  onOpenVault,
  currentUser,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const select = (view: AppView) => {
    if (view === 'vault' && onOpenVault) {
      onOpenVault();
      return;
    }
    onSelectView(view);
    onClose();
  };

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden cursor-pointer"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-800/80 bg-slate-950/95 backdrop-blur-2xl transition-all duration-300 lg:sticky lg:top-0 lg:h-screen ${
          isCollapsed ? 'lg:w-[76px]' : 'lg:w-[268px]'
        } w-[268px] ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Sidebar Brand Header */}
        <div
          className={`p-3.5 border-b border-slate-800/80 flex items-center ${
            isCollapsed ? 'justify-center' : 'justify-between'
          } transition-all duration-300`}
        >
          {/* Logo & Brand - Only displayed when sidebar is expanded */}
          {isCollapsed ? (
            <img src="/logo.png" alt="Naxora AI logo" className="w-9 h-9 shrink-0 object-contain drop-shadow-lg" />
          ) : (
            <div className="flex items-center gap-3 overflow-hidden animate-fadeIn">
              <img src="/logo.png" alt="Naxora AI logo" className="w-9 h-9 shrink-0 object-contain drop-shadow-lg" />

              <div>
                <h1 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
                  <span>Naxora AI</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                </h1>
                <p className="text-[10px] text-cyan-400 font-mono whitespace-nowrap">Multi-Provider AI Studio</p>
              </div>
            </div>
          )}

          <div className="flex items-center">
            {/* Desktop collapse toggle */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:flex p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4 text-cyan-400" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            {/* Mobile close button */}
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Categories */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5 scrollbar-thin">
          {/* SECTION 1: WORKSPACE */}
          <div>
            {!isCollapsed && (
              <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>Workspace</span>
                <span className="text-[9px] font-mono text-cyan-400">Core</span>
              </div>
            )}

            <div className="space-y-1">
              <SidebarItem
                icon={<Sparkles className="w-4 h-4 text-cyan-400" />}
                label="Help Chat"
                badge="AI Studio"
                active={activeView === 'chat'}
                collapsed={isCollapsed}
                onClick={() => select('chat')}
              />
              <SidebarItem
                icon={<Radio className="w-4 h-4 text-sky-400" />}
                label="Messenger Hub"
                badge="10 Channels"
                active={activeView === 'simulator' || activeView === 'gateways' || activeView.startsWith('ch-')}
                collapsed={isCollapsed}
                onClick={() => select('simulator')}
              />
              <SidebarItem
                icon={<Brain className="w-4 h-4 text-indigo-400" />}
                label="100-AI Brain Core"
                badge="Active"
                active={activeView === 'cascade'}
                collapsed={isCollapsed}
                onClick={() => select('cascade')}
              />
              <SidebarItem
                icon={<Sliders className="w-4 h-4 text-amber-400" />}
                label="Bot Configuration"
                active={activeView === 'preferences' || activeView === 'settings'}
                collapsed={isCollapsed}
                onClick={() => select('preferences')}
              />
            </div>
          </div>

          {/* SECTION 2: AI MODELS & BROADCASTS */}
          <div>
            {!isCollapsed && (
              <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>AI Models & Intelligence</span>
                <span className="text-[9px] font-mono text-purple-400">100 AI Providers</span>
              </div>
            )}

            <div className="space-y-1">
              <SidebarItem
                icon={<Activity className="w-4 h-4 text-emerald-400" />}
                label="Live Telemetry & Ping"
                active={activeView === 'performance'}
                collapsed={isCollapsed}
                onClick={() => select('performance')}
              />
              <SidebarItem
                icon={<Activity className="w-4 h-4 text-cyan-400" />}
                label="AI System Analyzer"
                active={activeView === 'analyzer'}
                collapsed={isCollapsed}
                onClick={() => select('analyzer')}
              />
              <SidebarItem
                icon={<Clock className="w-4 h-4 text-amber-400" />}
                label="Emergency Broadcast"
                badge="2H Auto"
                active={activeView === 'cron'}
                collapsed={isCollapsed}
                onClick={() => select('cron')}
              />
              <SidebarItem
                icon={<Scan className="w-4 h-4 text-rose-400" />}
                label="AI Media Scanner"
                active={activeView === 'scanner'}
                collapsed={isCollapsed}
                onClick={() => select('scanner')}
              />
              <SidebarItem
                icon={<Video className="w-4 h-4 text-red-400" />}
                label="YouTube Video Studio"
                active={activeView === 'youtube'}
                collapsed={isCollapsed}
                onClick={() => select('youtube')}
              />
              <SidebarItem
                icon={<Mail className="w-4 h-4 text-amber-400" />}
                label="Gmail Integration"
                active={activeView === 'gmail'}
                collapsed={isCollapsed}
                onClick={() => select('gmail')}
              />
            </div>
          </div>

          {/* SECTION 4: SECURITY & CLOUD */}
          <div>
            {!isCollapsed && (
              <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>Security & Infrastructure</span>
                <span className="text-[9px] font-mono text-amber-400">PIN Locked</span>
              </div>
            )}

            <div className="space-y-1">
              <SidebarItem
                icon={<Lock className="w-4 h-4 text-amber-400" />}
                label="API Vault (Protected)"
                badge="20 Keys"
                active={activeView === 'vault'}
                collapsed={isCollapsed}
                onClick={() => select('vault')}
              />
              <SidebarItem
                icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
                label="Enterprise Security"
                active={activeView === 'security'}
                collapsed={isCollapsed}
                onClick={() => select('security')}
              />
              <SidebarItem
                icon={<Server className="w-4 h-4 text-blue-400" />}
                label="VPS Server Monitor"
                active={activeView === 'vps'}
                collapsed={isCollapsed}
                onClick={() => select('vps')}
              />
              <SidebarItem
                icon={<LayoutDashboard className="w-4 h-4 text-purple-400" />}
                label="Admin Control Panel"
                active={activeView === 'admin'}
                collapsed={isCollapsed}
                onClick={() => select('admin')}
              />
            </div>
          </div>

          {/* SECTION 5: BUSINESS & E-COMMERCE SUITE — pinned strictly at the very bottom */}
          <div>
            {!isCollapsed && (
              <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>Business & E-Commerce</span>
                <span className="text-[9px] font-mono text-emerald-400">CRM</span>
              </div>
            )}

            <div className="space-y-1">
              <SidebarItem
                icon={<ShoppingCart className="w-4 h-4 text-emerald-400" />}
                label="🛒 E-commerce CRM Hub"
                badge="Live"
                active={activeView === 'ecommerce-crm'}
                collapsed={isCollapsed}
                onClick={() => select('ecommerce-crm')}
              />
              <SidebarItem
                icon={<GraduationCap className="w-4 h-4 text-fuchsia-400" />}
                label="🧠 Custom AI Store Trainer"
                active={activeView === 'ai-trainer'}
                collapsed={isCollapsed}
                onClick={() => select('ai-trainer')}
              />
              <SidebarItem
                icon={<MessageCircle className="w-4 h-4 text-blue-400" />}
                label="💬 FB Messenger Config"
                active={activeView === 'messenger-config'}
                collapsed={isCollapsed}
                onClick={() => select('messenger-config')}
              />
            </div>
          </div>
        </div>

        {/* Sidebar Footer User Profile */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
          {currentUser ? (
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} p-1.5 rounded-xl bg-slate-900/80 border border-slate-800`}>
              <div className="flex items-center gap-2.5 truncate">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                {!isCollapsed && (
                  <div className="truncate">
                    <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
                    <p className="text-[10px] text-slate-400 truncate capitalize font-mono">{currentUser.role || 'Member'}</p>
                  </div>
                )}
              </div>

              {!isCollapsed && (
                <button
                  onClick={onLogOut}
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 text-xs font-semibold transition cursor-pointer"
            >
              <User className="w-4 h-4" />
              {!isCollapsed && <span>Sign In</span>}
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  active?: boolean;
  collapsed?: boolean;
  onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({
  icon,
  label,
  badge,
  active,
  collapsed,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center ${
        collapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2'
      } rounded-xl text-xs font-medium transition cursor-pointer ${
        active
          ? 'bg-gradient-to-r from-cyan-500/15 to-indigo-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
          : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
      }`}
    >
      <div className="flex items-center gap-2.5 truncate">
        <span className="shrink-0">{icon}</span>
        {!collapsed && <span className="truncate">{label}</span>}
      </div>

      {!collapsed && badge && (
        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold bg-slate-800 text-cyan-300 border border-slate-700/80">
          {badge}
        </span>
      )}
    </button>
  );
};
