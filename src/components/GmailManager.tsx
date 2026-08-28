import React, { useState, useEffect, useCallback } from 'react';
import {
  GmailProfile,
  GmailMessageSummary,
  GmailMessageDetail,
  GmailLabel,
} from '../types';
import { GmailService } from '../services/gmailService';
import {
  Mail,
  Inbox,
  Star,
  Send,
  Trash2,
  AlertOctagon,
  FileText,
  RefreshCw,
  Search,
  Plus,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  CornerUpLeft,
  Archive,
  MailCheck,
  Shield,
  Bot,
  ExternalLink,
  ChevronRight,
  Info,
  X,
} from 'lucide-react';

interface GmailManagerProps {
  onBackToChat?: () => void;
}

export const GmailManager: React.FC<GmailManagerProps> = ({ onBackToChat }) => {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Profile & Labels
  const [profile, setProfile] = useState<GmailProfile | null>(null);
  const [labels, setLabels] = useState<GmailLabel[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('INBOX');

  // Messages
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSearch, setActiveSearch] = useState<string>('');

  // Selected Message
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [messageDetail, setMessageDetail] = useState<GmailMessageDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // Compose Modal State
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
  const [composeTo, setComposeTo] = useState<string>('');
  const [composeCc, setComposeCc] = useState<string>('');
  const [composeSubject, setComposeSubject] = useState<string>('');
  const [composeBody, setComposeBody] = useState<string>('');
  const [isAiDrafting, setIsAiDrafting] = useState<boolean>(false);
  const [aiPromptInstruction, setAiPromptInstruction] = useState<string>('');
  const [aiTone, setAiTone] = useState<'professional' | 'concise' | 'friendly' | 'executive'>('professional');

  // Destructive Confirmation Modal State (MANDATORY per Workspace guidelines)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    details?: string;
    actionType: 'send' | 'trash' | 'delete_permanent';
    payload?: any;
  }>({
    isOpen: false,
    title: '',
    description: '',
    actionType: 'send',
  });

  // Action in progress feedback
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isPerformingAction, setIsPerformingAction] = useState<boolean>(false);

  // AI Summary / Assistant State inside Message Detail
  const [aiThreadSummary, setAiThreadSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState<boolean>(false);

  const showNotice = (message: string, type: 'success' | 'error' = 'success') => {
    setActionNotice({ type, message });
    setTimeout(() => {
      setActionNotice(null);
    }, 4000);
  };

  // Check auth state on mount
  useEffect(() => {
    const existingToken = GmailService.getAccessToken();
    if (existingToken) {
      setIsAuthenticated(true);
      loadGmailData();
    }

    const unsubscribe = GmailService.initAuth(
      (_user, token) => {
        if (token) {
          setIsAuthenticated(true);
          loadGmailData();
        }
      },
      () => {
        setIsAuthenticated(false);
        setProfile(null);
        setMessages([]);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const loadGmailData = useCallback(async () => {
    try {
      setIsLoadingMessages(true);
      const [profileData, labelsData] = await Promise.all([
        GmailService.getProfile().catch(() => null),
        GmailService.listLabels().catch(() => []),
      ]);

      if (profileData) setProfile(profileData);
      if (labelsData.length > 0) setLabels(labelsData);

      await fetchMessagesForCurrentView();
    } catch (err: any) {
      console.error('Failed to load Gmail data:', err);
      if (err?.message?.includes('session expired') || err?.message?.includes('authorization required')) {
        setIsAuthenticated(false);
      }
    } finally {
      setIsLoadingMessages(false);
    }
  }, [selectedFolder, activeSearch]);

  const fetchMessagesForCurrentView = async () => {
    try {
      setIsLoadingMessages(true);
      const labelIds = selectedFolder === 'ALL' ? undefined : [selectedFolder];
      const result = await GmailService.listMessages({
        labelIds,
        query: activeSearch || undefined,
        maxResults: 25,
      });
      setMessages(result.messages);
    } catch (err: any) {
      console.error('Failed to fetch messages:', err);
      showNotice(err?.message || 'Failed to fetch messages', 'error');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchMessagesForCurrentView();
    }
  }, [selectedFolder, activeSearch, isAuthenticated]);

  // Handle Google Sign-in
  const handleSignIn = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const res = await GmailService.signInWithGmail();
      if (res && res.accessToken) {
        setIsAuthenticated(true);
        if (res.isSandbox) {
          showNotice(`Connected to Gmail Workspace (Sandbox Mode — Full interactivity active)`);
        } else {
          showNotice(`Connected to Gmail as ${res.user.email || 'Google User'}`);
        }
        await loadGmailData();
      }
    } catch (err: any) {
      console.error('Sign-in failed:', err);
      setAuthError(err?.message || 'Google authentication was cancelled or failed.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleEnterSandbox = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const res = GmailService.enableSandboxMode('developer@preview.workspace');
      setIsAuthenticated(true);
      showNotice('Connected to Gmail Sandbox Workspace (Demo Environment active)');
      await loadGmailData();
    } catch (err: any) {
      setAuthError(err?.message || 'Gmail sandbox mode is unavailable. Connect a live Google account.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await GmailService.signOut();
      setIsAuthenticated(false);
      setProfile(null);
      setMessages([]);
      setMessageDetail(null);
      setSelectedMessageId(null);
      showNotice('Disconnected from Gmail account.');
    } catch (err: any) {
      showNotice(err?.message || 'Unable to disconnect from Gmail.', 'error');
    }
  };

  // View a specific message
  const handleSelectMessage = async (id: string) => {
    setSelectedMessageId(id);
    setIsLoadingDetail(true);
    setAiThreadSummary(null);
    try {
      const detail = await GmailService.getMessageDetail(id);
      setMessageDetail(detail);

      // If unread, mark as read
      if (detail.isUnread) {
        GmailService.toggleReadStatus(id, true).catch(console.warn);
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, isUnread: false } : m))
        );
      }
    } catch (err: any) {
      console.error('Failed to fetch message detail:', err);
      showNotice('Failed to load email contents.', 'error');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Toggle Star
  const handleToggleStar = async (e: React.MouseEvent, id: string, currentStarred: boolean) => {
    e.stopPropagation();
    try {
      await GmailService.toggleStarStatus(id, currentStarred);
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, isStarred: !currentStarred } : m))
      );
      if (messageDetail && messageDetail.id === id) {
        setMessageDetail({ ...messageDetail, isStarred: !currentStarred });
      }
      showNotice(!currentStarred ? 'Added to Starred' : 'Removed from Starred');
    } catch (err: any) {
      showNotice('Could not update star status', 'error');
    }
  };

  // Request Confirmation for Sending an Email (Destructive/Mutating Confirmation)
  const promptSendEmail = () => {
    if (!composeTo.trim()) {
      showNotice('Please enter a recipient email address.', 'error');
      return;
    }
    if (!composeSubject.trim()) {
      showNotice('Please enter an email subject line.', 'error');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Confirm Send Email',
      description: `Are you sure you want to send this email on behalf of ${profile?.emailAddress || 'your account'}?`,
      details: `To: ${composeTo}\nSubject: ${composeSubject}\n\nBody Preview:\n${composeBody.slice(0, 150)}${composeBody.length > 150 ? '...' : ''}`,
      actionType: 'send',
      payload: {
        to: composeTo.trim(),
        subject: composeSubject.trim(),
        body: composeBody,
        cc: composeCc.trim() || undefined,
      },
    });
  };

  // Request Confirmation for Trashing Email
  const promptTrashEmail = (id: string, subject: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Move Email to Trash',
      description: 'Are you sure you want to move this conversation to the Trash folder?',
      details: `Subject: "${subject}"\nMessage ID: ${id}`,
      actionType: 'trash',
      payload: { id },
    });
  };

  // Execute Confirmed Operation
  const handleExecuteConfirmedAction = async () => {
    setIsPerformingAction(true);
    try {
      if (confirmModal.actionType === 'send') {
        const { to, subject, body, cc } = confirmModal.payload;
        await GmailService.sendEmail({
          to,
          subject,
          body,
          cc,
          isHtml: false,
        });
        showNotice(`Email successfully sent to ${to}!`);
        setIsComposeOpen(false);
        setComposeTo('');
        setComposeCc('');
        setComposeSubject('');
        setComposeBody('');
        setConfirmModal({ ...confirmModal, isOpen: false });
        fetchMessagesForCurrentView();
      } else if (confirmModal.actionType === 'trash') {
        const { id } = confirmModal.payload;
        await GmailService.trashMessage(id);
        showNotice('Conversation moved to Trash.');
        setMessages((prev) => prev.filter((m) => m.id !== id));
        if (selectedMessageId === id) {
          setSelectedMessageId(null);
          setMessageDetail(null);
        }
        setConfirmModal({ ...confirmModal, isOpen: false });
      }
    } catch (err: any) {
      console.error('Action failed:', err);
      showNotice(err?.message || 'Operation failed. Please try again.', 'error');
    } finally {
      setIsPerformingAction(false);
    }
  };

  // AI Assistant: Generate Draft or Polish
  const handleAiDraftEmail = async () => {
    if (!aiPromptInstruction.trim() && !composeSubject.trim()) {
      showNotice('Please provide bullet points or instructions for the AI.', 'error');
      return;
    }

    setIsAiDrafting(true);
    try {
      const generated = await GmailService.generateAiEmailDraft({
        context: `${composeSubject ? `Subject: ${composeSubject}\n` : ''}${aiPromptInstruction || composeBody}`,
        action: 'reply',
        instructions: `Tone: ${aiTone}. Draft a complete, well-structured email.`,
        tone: aiTone,
      });

      setComposeBody(generated);
      showNotice('AI draft generated successfully!');
    } catch (err: any) {
      showNotice('AI generation encountered an error.', 'error');
    } finally {
      setIsAiDrafting(false);
    }
  };

  // AI Assistant: Summarize Current Email Thread
  const handleAiSummarizeThread = async () => {
    if (!messageDetail) return;
    setIsGeneratingSummary(true);
    try {
      const summary = await GmailService.generateAiEmailDraft({
        context: `Subject: ${messageDetail.subject}\nFrom: ${messageDetail.from}\nDate: ${messageDetail.date}\n\n${messageDetail.bodyText}`,
        action: 'summarize',
      });
      setAiThreadSummary(summary);
    } catch (e) {
      showNotice('Failed to generate AI summary.', 'error');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Quick Reply setup
  const handleQuickReply = (detail: GmailMessageDetail) => {
    setComposeTo(detail.from.match(/<(.+)>/)?.[1] || detail.from);
    setComposeSubject(detail.subject.startsWith('Re:') ? detail.subject : `Re: ${detail.subject}`);
    setComposeBody(`\n\nOn ${detail.date}, ${detail.from} wrote:\n> ${detail.snippet}`);
    setIsComposeOpen(true);
  };

  const navFolders = [
    { id: 'INBOX', label: 'Inbox', icon: Inbox },
    { id: 'STARRED', label: 'Starred', icon: Star },
    { id: 'SENT', label: 'Sent', icon: Send },
    { id: 'DRAFT', label: 'Drafts', icon: FileText },
    { id: 'TRASH', label: 'Trash', icon: Trash2 },
    { id: 'SPAM', label: 'Spam', icon: AlertOctagon },
    { id: 'ALL', label: 'All Mail', icon: Mail },
  ];

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      {/* Top Banner Notice */}
      {actionNotice && (
        <div
          className={`flex items-center justify-between px-4 py-2.5 text-xs font-medium ${
            actionNotice.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-300 border-b border-emerald-800'
              : 'bg-rose-950/90 text-rose-300 border-b border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="opacity-70 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Container */}
      {!isAuthenticated ? (
        // Unauthenticated State with Official GSI Sign-In
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-8 text-center shadow-2xl backdrop-blur-xl">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-red-500/20 to-amber-500/20 text-red-400 ring-1 ring-red-500/30">
              <Mail className="h-7 w-7" />
            </div>

            <h2 className="text-xl font-bold tracking-tight text-white">Connect Your Gmail</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Integrate Google Workspace Gmail directly into your 100-AI Bot Builder. Access your
              inbox, search threads, draft AI-assisted responses, and send emails with user confirmation.
            </p>

            {authError && (
              <div className="mt-4 rounded-xl border border-rose-800/60 bg-rose-950/40 p-3 text-left text-xs text-rose-300">
                <p className="font-semibold">Authentication Notice</p>
                <p className="mt-0.5 opacity-90">{authError}</p>
              </div>
            )}

            {/* Official GSI Material Sign-in Button */}
            <div className="mt-6 flex flex-col items-center gap-3">
              <button
                onClick={handleSignIn}
                disabled={isAuthenticating}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:border-slate-600 hover:bg-slate-700 disabled:opacity-50"
              >
                <div className="flex h-5 w-5 items-center justify-center">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    className="h-5 w-5"
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    ></path>
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    ></path>
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    ></path>
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    ></path>
                  </svg>
                </div>
                <span>{isAuthenticating ? 'Connecting to Google...' : 'Sign in with Google'}</span>
              </button>

              <button
                onClick={handleEnterSandbox}
                disabled={isAuthenticating}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-800/60 bg-sky-950/40 px-5 py-2.5 text-xs font-semibold text-sky-300 transition-all hover:bg-sky-900/50 hover:text-white"
              >
                <Sparkles className="h-4 w-4 text-sky-400" />
                <span>Launch Interactive Demo Sandbox</span>
              </button>

              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                <Shield className="h-3.5 w-3.5 text-emerald-400" />
                <span>Authorized Google Workspace Gmail API integration</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Authenticated Gmail Workspace
        <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
          {/* Left Navigation Sub-Sidebar */}
          <div className="w-full border-r border-slate-800 bg-slate-900/60 p-4 lg:w-64 lg:shrink-0">
            {/* Compose Button */}
            <button
              onClick={() => setIsComposeOpen(true)}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-600/20 transition-all hover:brightness-110 active:scale-98"
            >
              <Plus className="h-4 w-4" />
              <span>Compose Email</span>
            </button>

            {/* Folder Filters */}
            <div className="space-y-1">
              {navFolders.map((folder) => {
                const Icon = folder.icon;
                const active = selectedFolder === folder.id;
                return (
                  <button
                    key={folder.id}
                    onClick={() => {
                      setSelectedFolder(folder.id);
                      setSelectedMessageId(null);
                      setMessageDetail(null);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-red-500/15 text-red-400 font-semibold ring-1 ring-red-500/30'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4" />
                      <span>{folder.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Account Profile Footer */}
            {profile && (
              <div className="mt-8 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20 text-red-300">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white">{profile.emailAddress}</p>
                    <p className="text-[10px] text-slate-500">{profile.messagesTotal} messages</p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="mt-2.5 w-full rounded-lg border border-slate-800 bg-slate-900 py-1.5 text-center text-[11px] text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  Disconnect Gmail
                </button>
              </div>
            )}
          </div>

          {/* Center / Right Email Views */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Search and Action Bar */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/40 px-4 py-2.5">
              <div className="flex flex-1 items-center gap-2">
                {selectedMessageId && (
                  <button
                    onClick={() => {
                      setSelectedMessageId(null);
                      setMessageDetail(null);
                    }}
                    className="mr-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                    title="Back to list"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}

                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setActiveSearch(searchQuery);
                    }}
                    placeholder="Search in Gmail (e.g. from:user, is:unread, subject:update)..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 py-1.5 pl-9 pr-8 text-xs text-white placeholder-slate-500 focus:border-red-500/50 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setActiveSearch('');
                      }}
                      className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchMessagesForCurrentView}
                  disabled={isLoadingMessages}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                  title="Refresh mail"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingMessages ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Sync</span>
                </button>
              </div>
            </div>

            {/* Content Switcher: Message List vs Message Reader */}
            <div className="flex flex-1 overflow-hidden">
              {/* Message List Panel */}
              <div
                className={`flex-1 flex-col overflow-y-auto ${
                  selectedMessageId ? 'hidden md:flex md:w-2/5 md:border-r md:border-slate-800' : 'flex w-full'
                }`}
              >
                {isLoadingMessages ? (
                  <div className="flex flex-1 items-center justify-center p-12 text-center text-xs text-slate-500">
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin text-red-400" />
                    <span>Loading messages from Gmail...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center p-12 text-center text-xs text-slate-500">
                    <Mail className="mb-2 h-8 w-8 opacity-40 text-slate-400" />
                    <p className="font-semibold text-slate-300">No emails found</p>
                    <p className="mt-1 max-w-xs text-[11px] text-slate-500">
                      {activeSearch
                        ? `No matching results for "${activeSearch}".`
                        : `Your ${selectedFolder.toLowerCase()} folder is currently empty.`}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/60">
                    {messages.map((msg) => {
                      const isSelected = selectedMessageId === msg.id;
                      return (
                        <div
                          key={msg.id}
                          onClick={() => handleSelectMessage(msg.id)}
                          className={`group flex cursor-pointer items-start gap-3 p-3.5 transition-colors ${
                            isSelected
                              ? 'bg-red-500/10 border-l-2 border-red-500'
                              : msg.isUnread
                              ? 'bg-slate-900/80 hover:bg-slate-850'
                              : 'hover:bg-slate-900/50'
                          }`}
                        >
                          <button
                            onClick={(e) => handleToggleStar(e, msg.id, msg.isStarred)}
                            className="mt-0.5 shrink-0 text-slate-600 transition-colors hover:text-amber-400"
                          >
                            <Star
                              className={`h-4 w-4 ${
                                msg.isStarred ? 'fill-amber-400 text-amber-400' : ''
                              }`}
                            />
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p
                                className={`truncate text-xs ${
                                  msg.isUnread ? 'font-bold text-white' : 'font-medium text-slate-300'
                                }`}
                              >
                                {msg.from}
                              </p>
                              <span className="shrink-0 text-[10px] text-slate-500">
                                {new Date(msg.date).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </div>

                            <p
                              className={`truncate text-xs ${
                                msg.isUnread ? 'font-semibold text-slate-100' : 'text-slate-300'
                              }`}
                            >
                              {msg.subject}
                            </p>

                            <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{msg.snippet}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Message Detail Reader */}
              {selectedMessageId && (
                <div className="flex flex-1 flex-col overflow-y-auto bg-slate-950 p-4 lg:p-6">
                  {isLoadingDetail ? (
                    <div className="flex flex-1 items-center justify-center p-12 text-center text-xs text-slate-500">
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin text-red-400" />
                      <span>Loading full email thread...</span>
                    </div>
                  ) : messageDetail ? (
                    <div className="space-y-4">
                      {/* Email Header */}
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h2 className="text-base font-bold text-white">{messageDetail.subject}</h2>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              <span className="font-semibold text-slate-200">From: {messageDetail.from}</span>
                              {messageDetail.to && <span>• To: {messageDetail.to}</span>}
                            </div>
                            <p className="mt-0.5 text-[10px] text-slate-500">{messageDetail.date}</p>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleQuickReply(messageDetail)}
                              className="flex items-center gap-1.5 rounded-lg bg-red-600/20 px-3 py-1.5 text-xs font-semibold text-red-400 ring-1 ring-red-500/30 hover:bg-red-600/30"
                              title="Reply"
                            >
                              <CornerUpLeft className="h-3.5 w-3.5" />
                              <span>Reply</span>
                            </button>

                            <button
                              onClick={() => promptTrashEmail(messageDetail.id, messageDetail.subject)}
                              className="rounded-lg border border-slate-800 p-1.5 text-slate-400 hover:bg-rose-950/40 hover:text-rose-400"
                              title="Trash email"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* AI Thread Assistant Bar */}
                        <div className="mt-4 border-t border-slate-800 pt-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>AI Email Assistant</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={handleAiSummarizeThread}
                                disabled={isGeneratingSummary}
                                className="flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50"
                              >
                                <Bot className="h-3 w-3" />
                                <span>{isGeneratingSummary ? 'Summarizing...' : 'Summarize Thread'}</span>
                              </button>
                            </div>
                          </div>

                          {aiThreadSummary && (
                            <div className="mt-2.5 rounded-xl border border-cyan-800/50 bg-cyan-950/30 p-3 text-xs leading-relaxed text-cyan-200">
                              <p className="font-semibold text-cyan-300">Executive Summary:</p>
                              <p className="mt-1 whitespace-pre-wrap">{aiThreadSummary}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Email Body Content */}
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                        {messageDetail.bodyHtml ? (
                          <div
                            className="prose prose-invert max-w-none text-xs leading-relaxed text-slate-200"
                            dangerouslySetInnerHTML={{ __html: messageDetail.bodyHtml }}
                          />
                        ) : (
                          <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-200">
                            {messageDetail.bodyText}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-6 text-center">
                      <p className="text-sm font-medium text-amber-200">Unable to load this message.</p>
                      <p className="mt-1 text-xs text-slate-400">Select another message or try again.</p>
                      <button
                        type="button"
                        onClick={() => selectedMessageId && handleSelectMessage(selectedMessageId)}
                        disabled={!selectedMessageId || isLoadingDetail}
                        className="mt-4 rounded-lg border border-amber-500/40 px-3 py-2 text-xs text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
                      >
                        {isLoadingDetail ? 'Loading...' : 'Retry'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compose Email Modal */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="flex h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-red-400" />
                <h3 className="text-sm font-bold text-white">New Message</h3>
              </div>
              <button
                onClick={() => setIsComposeOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Compose Fields */}
            <div className="flex flex-1 flex-col space-y-3 overflow-y-auto p-5">
              <div>
                <label className="text-[11px] font-medium text-slate-400">To</label>
                <input
                  type="email"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="recipient@example.com"
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-400">Subject</label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Subject line"
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                />
              </div>

              {/* AI Drafting Toolbar */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>AI Copilot Drafting</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={aiTone}
                      onChange={(e: any) => setAiTone(e.target.value)}
                      className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 focus:outline-none"
                    >
                      <option value="professional">Professional</option>
                      <option value="concise">Concise</option>
                      <option value="friendly">Friendly</option>
                      <option value="executive">Executive</option>
                    </select>
                    <button
                      onClick={handleAiDraftEmail}
                      disabled={isAiDrafting}
                      className="flex items-center gap-1 rounded-lg bg-cyan-500/20 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-50"
                    >
                      <Bot className="h-3 w-3" />
                      <span>{isAiDrafting ? 'Writing...' : 'Generate with AI'}</span>
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={aiPromptInstruction}
                  onChange={(e) => setAiPromptInstruction(e.target.value)}
                  placeholder="Optional: Enter key points or notes for AI to flesh out..."
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                />
              </div>

              {/* Body Textarea */}
              <div className="flex flex-1 flex-col">
                <label className="text-[11px] font-medium text-slate-400">Message Body</label>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your email here..."
                  className="mt-1 flex-1 min-h-[160px] rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs leading-relaxed text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3">
              <button
                onClick={() => setIsComposeOpen(false)}
                className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                Discard
              </button>

              <button
                onClick={promptSendEmail}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-red-600/20 hover:brightness-110"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Send Email</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANDATORY Workspace Destructive Operation Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/30">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-white">{confirmModal.title}</h3>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-300">{confirmModal.description}</p>

            {confirmModal.details && (
              <div className="mt-3 max-h-40 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-3 text-[11px] font-mono text-slate-400">
                <pre className="whitespace-pre-wrap font-sans">{confirmModal.details}</pre>
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                disabled={isPerformingAction}
                className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteConfirmedAction}
                disabled={isPerformingAction}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-lg transition-all ${
                  confirmModal.actionType === 'send'
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 shadow-red-600/20 hover:brightness-110'
                    : 'bg-gradient-to-r from-rose-700 to-red-700 hover:brightness-110'
                }`}
              >
                {isPerformingAction ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                <span>{confirmModal.actionType === 'send' ? 'Confirm & Send' : 'Confirm Action'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
