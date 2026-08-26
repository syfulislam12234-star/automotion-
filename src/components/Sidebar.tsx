import React from 'react';
import {
  Activity,
  Bot,
  Brain,
  Clock,
  Lock,
  MessageSquare,
  Scan,
  ShieldCheck,
  Sliders,
  User,
  Video,
  X,
} from 'lucide-react';

export type AppView =
  | 'simulator'
  | 'preferences'
  | 'performance'
  | 'cascade'
  | 'cron'
  | 'gateways'
  | 'security'
  | 'vps'
  | 'scanner'
  | 'admin'
  | 'settings';

interface SidebarProps {
  isOpen: boolean;
  activeView: AppView;
  onClose: () => void;
  onSelectView: (view: AppView) => void;
  onOpenPortal?: () => void;
  onOpenSubscription?: () => void;
  onOpenYouTube?: () => void;
  onOpenDeploy?: () => void;
  onOpenAuth: () => void;
  onLogOut: () => void;
  currentUser: { name: string } | null;
}

const publicItems = [
  { id: 'simulator', label: 'Chat workspace', icon: MessageSquare },
  { id: 'performance', label: 'Analytics & usage', icon: Activity },
  { id: 'cascade', label: 'AI cascade', icon: Brain },
  { id: 'cron', label: 'Chat history & broadcasts', icon: Clock },
  { id: 'scanner', label: 'Media scanner', icon: Scan },
  { id: 'preferences', label: 'General preferences', icon: Sliders },
  { id: 'security', label: 'App information & security', icon: ShieldCheck },
] as const;


export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  activeView,
  onClose,
  onSelectView,
  onOpenPortal,
  onOpenSubscription,
  onOpenYouTube,
  onOpenDeploy,
  onOpenAuth,
  onLogOut,
  currentUser,
}) => {
  const select = (view: AppView) => {
    onSelectView(view);
    onClose();
  };

  return (
    <>
      {isOpen && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-800 bg-slate-950/95 backdrop-blur-xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-full flex-col overflow-y-auto px-4 py-5">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/30"><Bot className="h-5 w-5" /></div>
              <div><p className="text-sm font-bold text-white">Control center</p><p className="text-[10px] text-slate-500">Universal Bot</p></div>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white lg:hidden" title="Close navigation"><X className="h-4 w-4" /></button>
          </div>

          <nav className="space-y-6" aria-label="Application navigation">
            <SidebarGroup label="Public / open">
              {publicItems.map(({ id, label, icon: Icon }) => <SidebarItem key={id} label={label} icon={<Icon className="h-4 w-4" />} active={activeView === id} onClick={() => select(id)} />)}
            </SidebarGroup>
          </nav>

          <div className="mt-auto border-t border-slate-800 pt-4">
            {currentUser ? <button onClick={onLogOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-400 hover:bg-slate-900 hover:text-white"><User className="h-4 w-4" /> Sign out {currentUser.name}</button> : <button onClick={onOpenAuth} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-cyan-300 hover:bg-slate-900"><User className="h-4 w-4" /> Sign in</button>}
          </div>
        </div>
      </aside>
    </>
  );
};

const SidebarGroup: React.FC<React.PropsWithChildren<{ label: string }>> = ({ label, children }) => <section><p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-600">{label}</p><div className="space-y-0.5">{children}</div></section>;

const SidebarItem: React.FC<{ label: string; icon: React.ReactNode; active?: boolean; locked?: boolean; onClick: () => void }> = ({ label, icon, active, locked, onClick }) => <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-medium transition ${active ? 'bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'}`}><span className="text-current">{icon}</span><span className="flex-1">{label}</span>{locked ? <Lock className="h-3.5 w-3.5 text-amber-400" /> : null}</button>;
