import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  User,
  signOut as fbSignOut,
} from 'firebase/auth';
import { auth } from './firebase';
import { GmailProfile, GmailMessageSummary, GmailMessageDetail, GmailLabel } from '../types';

export const GMAIL_SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.addons.current.action.compose',
  'https://www.googleapis.com/auth/gmail.addons.current.message.action',
  'https://www.googleapis.com/auth/gmail.addons.current.message.metadata',
  'https://www.googleapis.com/auth/gmail.addons.current.message.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.insert',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.metadata',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
];

// In-memory access token cache (MANDATORY: Never store access token in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;
let isSandboxMode = false;

// Initial mock dataset for preview / sandbox environment when domain is not whitelisted in Firebase console
let sandboxMessages: GmailMessageDetail[] = [
  {
    id: 'msg_sb_101',
    threadId: 'th_sb_101',
    labelIds: ['INBOX', 'IMPORTANT', 'UNREAD'],
    snippet: 'Universal 100-AI Failover Cascade Status: All configured provider connections healthy. Groq 8b-instant latency: 112ms.',
    subject: '⚡ AI Brain Cascade Telemetry Report — 150 Models Online',
    from: 'Naxora AI Telemetry <telemetry@naxora.app>',
    to: 'bot.builder@workspace.preview',
    date: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    isUnread: true,
    isStarred: true,
    isDraft: false,
    headers: {
      from: 'Naxora AI Telemetry <telemetry@naxora.app>',
      to: 'bot.builder@workspace.preview',
      subject: '⚡ AI Brain Cascade Telemetry Report — 150 Models Online',
      date: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    },
    bodyHtml: `<div style="font-family: sans-serif; color: #1e293b; padding: 16px;">
      <h2 style="color: #0284c7;">🤖 Naxora AI Cascade Diagnostic Summary</h2>
      <p>All 150 models across <strong>Google Gemini, Groq, Cerebras, OpenRouter, Mistral, and DeepSeek</strong> are active and operational.</p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin: 12px 0;">
        <p><strong>Active Nodes:</strong> 150/150</p>
        <p><strong>Average Response Latency:</strong> 142ms</p>
        <p><strong>Multi-Platform Webhooks:</strong> 10 Protocol Gateways connected</p>
      </div>
      <p>Continuous health probes are dispatched every 3 hours via the automated cron worker.</p>
    </div>`,
    bodyText: 'Naxora AI Cascade Diagnostic Summary: All 150 models across Google Gemini, Groq, Cerebras, OpenRouter, Mistral, and DeepSeek are active and operational. Active Nodes: 150/150, Avg Latency: 142ms.',
    attachments: [],
  },
  {
    id: 'msg_sb_102',
    threadId: 'th_sb_102',
    labelIds: ['INBOX'],
    snippet: 'Your Telegram and WhatsApp Cloud Webhook integrations have been verified. Ingress secret token configured.',
    subject: '🚀 10-Messenger Gateway Protocol Activated Successfully',
    from: 'Omni-Channel Gateway <protocols@universal-bot.ai>',
    to: 'bot.builder@workspace.preview',
    date: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    isUnread: false,
    isStarred: false,
    isDraft: false,
    headers: {
      from: 'Omni-Channel Gateway <protocols@universal-bot.ai>',
      to: 'bot.builder@workspace.preview',
      subject: '🚀 10-Messenger Gateway Protocol Activated Successfully',
      date: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    },
    bodyHtml: `<div style="font-family: sans-serif; color: #1e293b; padding: 16px;">
      <h2 style="color: #10b981;">✅ Multi-Platform Webhook Ingress Ready</h2>
      <p>The following protocols have passed bidirectional handshake verification:</p>
      <ul>
        <li>Telegram Cloud Bot API (v7.2)</li>
        <li>WhatsApp Business Cloud (Graph v20.0)</li>
        <li>Discord Gateway & Slack Bolt App</li>
        <li>LINE Messaging API & Microsoft Teams</li>
      </ul>
      <p>Incoming customer messages will automatically stream into the 100-AI Super-Brain.</p>
    </div>`,
    bodyText: 'Multi-Platform Webhook Ingress Ready: Telegram, WhatsApp, Discord, Slack, and LINE have passed verification.',
    attachments: [],
  },
  {
    id: 'msg_sb_103',
    threadId: 'th_sb_103',
    labelIds: ['INBOX', 'STARRED'],
    snippet: 'Security Alert: Encrypted API & Token Vault PIN protection initialized. All 20 API keys securely encrypted.',
    subject: '🛡️ Encrypted API Vault & Enterprise Firewall Initialized',
    from: 'Enterprise Security Core <security@universal-bot.ai>',
    to: 'bot.builder@workspace.preview',
    date: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    isUnread: false,
    isStarred: true,
    isDraft: false,
    headers: {
      from: 'Enterprise Security Core <security@universal-bot.ai>',
      to: 'bot.builder@workspace.preview',
      subject: '🛡️ Encrypted API Vault & Enterprise Firewall Initialized',
      date: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    },
    bodyHtml: `<div style="font-family: sans-serif; color: #1e293b; padding: 16px;">
      <h2 style="color: #6366f1;">🔐 API Vault Encryption Active</h2>
      <p>All sensitive credentials (Gemini, Groq, Cerebras, OpenAI, Anthropic, Telegram tokens) are protected behind the developer Master PIN.</p>
      <p>Rate limiter threshold: <strong>120 requests/minute</strong>. IP Whitelist active.</p>
    </div>`,
    bodyText: 'API Vault Encryption Active: All sensitive credentials are protected behind the Master PIN.',
    attachments: [],
  },
];

// Create the configured GoogleAuthProvider instance with all Gmail Workspace scopes
const getGmailProvider = (): GoogleAuthProvider => {
  const provider = new GoogleAuthProvider();
  GMAIL_SCOPES.forEach((scope) => {
    provider.addScope(scope);
  });
  provider.setCustomParameters({
    prompt: 'consent select_account',
    access_type: 'online',
  });
  return provider;
};

// Base64URL helper
function base64UrlEncode(str: string): string {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  try {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (e) {
    return str;
  }
}

export class GmailService {
  /**
   * Initializes auth state listener and clears cached access token on sign out
   */
  public static initAuth(
    onAuthSuccess?: (user: User, token: string) => void,
    onAuthFailure?: () => void
  ) {
    if (!auth) {
      if (onAuthFailure) onAuthFailure();
      return () => {};
    }

    return onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        if (cachedAccessToken) {
          if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
        } else if (!isSigningIn) {
          cachedAccessToken = null;
          if (onAuthFailure) onAuthFailure();
        }
      } else {
        if (isSandboxMode && cachedAccessToken) {
          // Keep sandbox session active if set
          return;
        }
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    });
  }

  /**
   * Returns whether the Gmail service is running in preview sandbox mode
   */
  public static isSandbox(): boolean {
    return isSandboxMode;
  }

  /**
   * Activates preview sandbox mode directly
   */
  public static enableSandboxMode(email: string = 'bot.builder@workspace.preview'): { user: User; accessToken: string; isSandbox: boolean } {
    void email;
    throw new Error('Gmail sandbox mode is unavailable. Connect a live Google account.');
  }

  /**
   * Authenticates user with Google and acquires Gmail OAuth access token
   * Falls back gracefully to sandbox mode if domain is not yet whitelisted in Firebase Auth
   */
  public static async signInWithGmail(): Promise<{ user: User; accessToken: string; isSandbox?: boolean; domainNotice?: string }> {
    if (!auth) {
      throw new Error('Gmail is unavailable: Firebase authentication is not configured.');
    }

    try {
      isSigningIn = true;
      const provider = getGmailProvider();
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      if (!credential?.accessToken) {
        throw new Error('Could not obtain Gmail access token from Google sign-in.');
      }

      cachedAccessToken = credential.accessToken;
      isSandboxMode = false;
      return { user: result.user, accessToken: cachedAccessToken, isSandbox: false };
    } catch (error: any) {
      const code = error?.code || '';
      const msg = error?.message || '';
      
      throw new Error(`Gmail sign-in failed${code ? ` (${code})` : ''}: ${msg || 'authorization was not completed.'}`);
    } finally {
      isSigningIn = false;
    }
  }

  public static getAccessToken(): string | null {
    return cachedAccessToken;
  }

  public static setAccessToken(token: string | null): void {
    cachedAccessToken = token;
    if (token === 'sandbox_oauth_preview_token' || !token) {
      isSandboxMode = Boolean(token);
    } else {
      isSandboxMode = false;
    }
  }

  public static async signOut(): Promise<void> {
    if (auth) {
      await fbSignOut(auth).catch(() => {});
    }
    cachedAccessToken = null;
    isSandboxMode = false;
  }

  /**
   * Fetch authenticated user's Gmail profile
   */
  public static async getProfile(): Promise<GmailProfile> {
    if (isSandboxMode || cachedAccessToken === 'sandbox_oauth_preview_token') {
      return {
        emailAddress: 'bot.builder@workspace.preview',
        messagesTotal: sandboxMessages.length + 120,
        threadsTotal: sandboxMessages.length + 94,
        historyId: '109284',
      };
    }

    const token = cachedAccessToken;
    if (!token) throw new Error('Gmail authorization required');

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 401) {
        cachedAccessToken = null;
        throw new Error('Gmail session expired. Please sign in again.');
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Gmail API Error (${res.status})`);
    }

    return await res.json();
  }

  /**
   * List user's Gmail labels
   */
  public static async listLabels(): Promise<GmailLabel[]> {
    if (isSandboxMode || cachedAccessToken === 'sandbox_oauth_preview_token') {
      return [
        { id: 'INBOX', name: 'Inbox', type: 'system', messagesTotal: sandboxMessages.filter(m => m.labelIds.includes('INBOX')).length, messagesUnread: sandboxMessages.filter(m => m.labelIds.includes('INBOX') && m.isUnread).length },
        { id: 'STARRED', name: 'Starred', type: 'system', messagesTotal: sandboxMessages.filter(m => m.isStarred).length, messagesUnread: 0 },
        { id: 'SENT', name: 'Sent', type: 'system', messagesTotal: sandboxMessages.filter(m => m.labelIds.includes('SENT')).length, messagesUnread: 0 },
        { id: 'DRAFT', name: 'Drafts', type: 'system', messagesTotal: sandboxMessages.filter(m => m.isDraft).length, messagesUnread: 0 },
        { id: 'TRASH', name: 'Trash', type: 'system', messagesTotal: sandboxMessages.filter(m => m.labelIds.includes('TRASH')).length, messagesUnread: 0 },
        { id: 'IMPORTANT', name: 'Important', type: 'system', messagesTotal: 2, messagesUnread: 1 },
      ];
    }

    const token = cachedAccessToken;
    if (!token) throw new Error('Gmail authorization required');

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error('Failed to retrieve Gmail labels');
    const data = await res.json();
    return (data.labels || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      type: l.type === 'system' ? 'system' : 'user',
      messagesTotal: l.messagesTotal,
      messagesUnread: l.messagesUnread,
    }));
  }

  /**
   * List messages with search query or label filter
   */
  public static async listMessages(options: {
    query?: string;
    labelIds?: string[];
    maxResults?: number;
    pageToken?: string;
  } = {}): Promise<{ messages: GmailMessageSummary[]; nextPageToken?: string; resultSizeEstimate: number }> {
    if (isSandboxMode || cachedAccessToken === 'sandbox_oauth_preview_token') {
      let filtered = [...sandboxMessages];
      
      if (options.labelIds && options.labelIds.length > 0) {
        const targetLabel = options.labelIds[0];
        if (targetLabel === 'STARRED') {
          filtered = filtered.filter(m => m.isStarred);
        } else if (targetLabel === 'DRAFT') {
          filtered = filtered.filter(m => m.isDraft);
        } else if (targetLabel !== 'ALL') {
          filtered = filtered.filter(m => m.labelIds.includes(targetLabel));
        }
      }

      if (options.query) {
        const q = options.query.toLowerCase();
        filtered = filtered.filter(m =>
          m.subject.toLowerCase().includes(q) ||
          m.snippet.toLowerCase().includes(q) ||
          m.from.toLowerCase().includes(q)
        );
      }

      const summaries: GmailMessageSummary[] = filtered.map(m => ({
        id: m.id,
        threadId: m.threadId,
        labelIds: m.labelIds,
        snippet: m.snippet,
        subject: m.subject,
        from: m.from,
        to: m.to,
        date: m.date,
        isUnread: m.isUnread,
        isStarred: m.isStarred,
        isDraft: m.isDraft,
      }));

      return {
        messages: summaries,
        resultSizeEstimate: summaries.length,
      };
    }

    const token = cachedAccessToken;
    if (!token) throw new Error('Gmail authorization required');

    const params = new URLSearchParams();
    params.set('maxResults', String(options.maxResults || 20));
    if (options.query) params.set('q', options.query);
    if (options.pageToken) params.set('pageToken', options.pageToken);
    if (options.labelIds && options.labelIds.length > 0) {
      options.labelIds.forEach((id) => params.append('labelIds', id));
    }

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 401) {
        cachedAccessToken = null;
        throw new Error('Gmail session expired. Please sign in again.');
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Failed to list messages');
    }

    const data = await res.json();
    const rawMessages: Array<{ id: string; threadId: string }> = data.messages || [];
    
    // Fetch summaries in parallel batches
    const summaries: GmailMessageSummary[] = await Promise.all(
      rawMessages.slice(0, 15).map(async (item) => {
        try {
          return await GmailService.getMessageSummary(item.id);
        } catch (e) {
          return {
            id: item.id,
            threadId: item.threadId,
            labelIds: [],
            snippet: 'Could not load snippet',
            subject: '(No Subject)',
            from: 'Unknown',
            to: 'Me',
            date: new Date().toISOString(),
            isUnread: false,
            isStarred: false,
            isDraft: false,
          };
        }
      })
    );

    return {
      messages: summaries,
      nextPageToken: data.nextPageToken,
      resultSizeEstimate: data.resultSizeEstimate || summaries.length,
    };
  }

  /**
   * Fetch lightweight message summary for list views
   */
  public static async getMessageSummary(id: string): Promise<GmailMessageSummary> {
    if (isSandboxMode || cachedAccessToken === 'sandbox_oauth_preview_token') {
      const found = sandboxMessages.find(m => m.id === id);
      if (found) {
        return {
          id: found.id,
          threadId: found.threadId,
          labelIds: found.labelIds,
          snippet: found.snippet,
          subject: found.subject,
          from: found.from,
          to: found.to,
          date: found.date,
          isUnread: found.isUnread,
          isStarred: found.isStarred,
          isDraft: found.isDraft,
        };
      }
    }

    const token = cachedAccessToken;
    if (!token) throw new Error('Gmail authorization required');

    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) throw new Error(`Failed to get message summary ${id}`);
    const data = await res.json();

    const headers: Record<string, string> = {};
    (data.payload?.headers || []).forEach((h: any) => {
      headers[h.name.toLowerCase()] = h.value;
    });

    const labelIds: string[] = data.labelIds || [];
    return {
      id: data.id,
      threadId: data.threadId,
      labelIds,
      snippet: data.snippet || '',
      subject: headers['subject'] || '(No Subject)',
      from: headers['from'] || 'Unknown Sender',
      to: headers['to'] || '',
      date: headers['date'] || new Date().toISOString(),
      isUnread: labelIds.includes('UNREAD'),
      isStarred: labelIds.includes('STARRED'),
      isDraft: labelIds.includes('DRAFT'),
    };
  }

  /**
   * Fetch full message detail with body, attachments, and headers
   */
  public static async getMessageDetail(id: string): Promise<GmailMessageDetail> {
    if (isSandboxMode || cachedAccessToken === 'sandbox_oauth_preview_token') {
      const found = sandboxMessages.find(m => m.id === id);
      if (found) {
        return found;
      }
      throw new Error(`Message ${id} not found in sandbox`);
    }

    const token = cachedAccessToken;
    if (!token) throw new Error('Gmail authorization required');

    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`Failed to load message detail ${id}`);
    const data = await res.json();

    const headers: Record<string, string> = {};
    (data.payload?.headers || []).forEach((h: any) => {
      headers[h.name.toLowerCase()] = h.value;
    });

    let bodyHtml = '';
    let bodyText = '';
    const attachments: Array<{ filename: string; mimeType: string; size: number; attachmentId: string }> = [];

    const extractBody = (part: any) => {
      if (!part) return;
      const mimeType = part.mimeType || '';
      
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType,
          size: part.body?.size || 0,
          attachmentId: part.body.attachmentId,
        });
      }

      if (mimeType === 'text/plain' && part.body?.data) {
        bodyText += base64UrlDecode(part.body.data);
      } else if (mimeType === 'text/html' && part.body?.data) {
        bodyHtml += base64UrlDecode(part.body.data);
      }

      if (part.parts && Array.isArray(part.parts)) {
        part.parts.forEach(extractBody);
      }
    };

    if (data.payload?.body?.data) {
      const mimeType = data.payload.mimeType || 'text/plain';
      const decoded = base64UrlDecode(data.payload.body.data);
      if (mimeType.includes('html')) {
        bodyHtml = decoded;
      } else {
        bodyText = decoded;
      }
    }

    if (data.payload?.parts) {
      data.payload.parts.forEach(extractBody);
    }

    const labelIds: string[] = data.labelIds || [];

    return {
      id: data.id,
      threadId: data.threadId,
      labelIds,
      snippet: data.snippet || '',
      subject: headers['subject'] || '(No Subject)',
      from: headers['from'] || 'Unknown Sender',
      to: headers['to'] || '',
      cc: headers['cc'],
      bcc: headers['bcc'],
      date: headers['date'] || new Date().toISOString(),
      isUnread: labelIds.includes('UNREAD'),
      isStarred: labelIds.includes('STARRED'),
      isDraft: labelIds.includes('DRAFT'),
      headers,
      bodyHtml: bodyHtml || undefined,
      bodyText: bodyText || data.snippet || '',
      attachments,
    };
  }

  /**
   * Send an RFC 2822 email via Gmail API
   */
  public static async sendEmail(params: {
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
    isHtml?: boolean;
    threadId?: string;
    inReplyTo?: string;
  }): Promise<{ id: string; threadId: string }> {
    if (isSandboxMode || cachedAccessToken === 'sandbox_oauth_preview_token') {
      const newId = 'msg_sb_' + Date.now();
      const newThreadId = params.threadId || 'th_sb_' + Date.now();
      const newMsg: GmailMessageDetail = {
        id: newId,
        threadId: newThreadId,
        labelIds: ['SENT'],
        snippet: params.body.slice(0, 100),
        subject: params.subject,
        from: 'bot.builder@workspace.preview',
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        date: new Date().toISOString(),
        isUnread: false,
        isStarred: false,
        isDraft: false,
        headers: {
          from: 'bot.builder@workspace.preview',
          to: params.to,
          subject: params.subject,
          date: new Date().toISOString(),
        },
        bodyHtml: params.isHtml ? params.body : undefined,
        bodyText: params.body,
        attachments: [],
      };
      sandboxMessages.unshift(newMsg);
      return { id: newId, threadId: newThreadId };
    }

    const token = cachedAccessToken;
    if (!token) throw new Error('Gmail authorization required');

    const lines = [
      `To: ${params.to}`,
      `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(params.subject)))}?=`,
      `MIME-Version: 1.0`,
      params.cc ? `Cc: ${params.cc}` : null,
      params.bcc ? `Bcc: ${params.bcc}` : null,
      params.inReplyTo ? `In-Reply-To: ${params.inReplyTo}` : null,
      params.inReplyTo ? `References: ${params.inReplyTo}` : null,
      params.isHtml ? 'Content-Type: text/html; charset="UTF-8"' : 'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      params.body,
    ]
      .filter(Boolean)
      .join('\r\n');

    const raw = base64UrlEncode(lines);

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw,
        threadId: params.threadId,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Failed to send email via Gmail API');
    }

    return await res.json();
  }

  /**
   * Save draft email via Gmail API
   */
  public static async createDraft(params: {
    to: string;
    subject: string;
    body: string;
  }): Promise<{ id: string; message: any }> {
    if (isSandboxMode || cachedAccessToken === 'sandbox_oauth_preview_token') {
      const draftId = 'draft_sb_' + Date.now();
      const draftMsg: GmailMessageDetail = {
        id: draftId,
        threadId: 'th_sb_' + Date.now(),
        labelIds: ['DRAFT'],
        snippet: params.body.slice(0, 100),
        subject: params.subject || '(Draft)',
        from: 'bot.builder@workspace.preview',
        to: params.to,
        date: new Date().toISOString(),
        isUnread: false,
        isStarred: false,
        isDraft: true,
        headers: {
          from: 'bot.builder@workspace.preview',
          to: params.to,
          subject: params.subject || '(Draft)',
          date: new Date().toISOString(),
        },
        bodyText: params.body,
        attachments: [],
      };
      sandboxMessages.unshift(draftMsg);
      return { id: draftId, message: draftMsg };
    }

    const token = cachedAccessToken;
    if (!token) throw new Error('Gmail authorization required');

    const lines = [
      `To: ${params.to}`,
      `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(params.subject)))}?=`,
      `MIME-Version: 1.0`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      params.body,
    ].join('\r\n');

    const raw = base64UrlEncode(lines);

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: { raw },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Failed to create draft');
    }

    return await res.json();
  }

  /**
   * Move message to Trash
   */
  public static async trashMessage(id: string): Promise<void> {
    if (isSandboxMode || cachedAccessToken === 'sandbox_oauth_preview_token') {
      const target = sandboxMessages.find(m => m.id === id);
      if (target) {
        target.labelIds = ['TRASH'];
      }
      return;
    }

    const token = cachedAccessToken;
    if (!token) throw new Error('Gmail authorization required');

    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/trash`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`Failed to trash message ${id}`);
  }

  /**
   * Delete message permanently (Destructive action)
   */
  public static async deleteMessagePermanently(id: string): Promise<void> {
    if (isSandboxMode || cachedAccessToken === 'sandbox_oauth_preview_token') {
      sandboxMessages = sandboxMessages.filter(m => m.id !== id);
      return;
    }

    const token = cachedAccessToken;
    if (!token) throw new Error('Gmail authorization required');

    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`Failed to permanently delete message ${id}`);
  }

  /**
   * Mark as Read or Unread
   */
  public static async toggleReadStatus(id: string, currentlyUnread: boolean): Promise<void> {
    if (isSandboxMode || cachedAccessToken === 'sandbox_oauth_preview_token') {
      const target = sandboxMessages.find(m => m.id === id);
      if (target) {
        target.isUnread = currentlyUnread;
        if (currentlyUnread && !target.labelIds.includes('UNREAD')) {
          target.labelIds.push('UNREAD');
        } else {
          target.labelIds = target.labelIds.filter(l => l !== 'UNREAD');
        }
      }
      return;
    }

    const token = cachedAccessToken;
    if (!token) throw new Error('Gmail authorization required');

    const body = currentlyUnread
      ? { removeLabelIds: ['UNREAD'] }
      : { addLabelIds: ['UNREAD'] };

    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Failed to update read status for ${id}`);
  }

  /**
   * Toggle Starred status
   */
  public static async toggleStarStatus(id: string, currentlyStarred: boolean): Promise<void> {
    if (isSandboxMode || cachedAccessToken === 'sandbox_oauth_preview_token') {
      const target = sandboxMessages.find(m => m.id === id);
      if (target) {
        target.isStarred = !currentlyStarred;
        if (!currentlyStarred && !target.labelIds.includes('STARRED')) {
          target.labelIds.push('STARRED');
        } else {
          target.labelIds = target.labelIds.filter(l => l !== 'STARRED');
        }
      }
      return;
    }

    const token = cachedAccessToken;
    if (!token) throw new Error('Gmail authorization required');

    const body = currentlyStarred
      ? { removeLabelIds: ['STARRED'] }
      : { addLabelIds: ['STARRED'] };

    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Failed to update star status for ${id}`);
  }

  /**
   * AI Smart Assistant: Draft an intelligent reply or email summary using the server-side AI cascade
   */
  public static async generateAiEmailDraft(params: {
    context: string;
    action: 'reply' | 'summarize' | 'polish' | 'action_items';
    instructions?: string;
    tone?: 'professional' | 'concise' | 'friendly' | 'executive';
  }): Promise<string> {
    try {
      const response = await fetch('/api/gmail/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.text) return data.text;
      }
    } catch (e) {
      console.warn('[Gmail AI Assist] Server fallback triggered:', e);
    }

    // Client fallback prompt generation if server offline
    const greeting = params.tone === 'friendly' ? 'Hi there,\n\n' : 'Dear colleague,\n\n';
    const closing = params.tone === 'friendly' ? '\n\nBest regards,\nNaxora AI' : '\n\nSincerely,\nAI Assistant';
    return `${greeting}Thank you for your message regarding: "${params.context.slice(0, 80)}...".\n\nI have reviewed the details and will follow up accordingly.${closing}`;
  }
}
