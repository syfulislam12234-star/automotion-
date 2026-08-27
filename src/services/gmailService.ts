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
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    });
  }

  /**
   * Authenticates user with Google and acquires Gmail OAuth access token
   */
  public static async signInWithGmail(): Promise<{ user: User; accessToken: string }> {
    if (!auth) {
      throw new Error('Firebase Auth is not initialized. Please verify configuration.');
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
      return { user: result.user, accessToken: cachedAccessToken };
    } catch (error: any) {
      console.error('[GmailService] Sign-in error:', error);
      throw error;
    } finally {
      isSigningIn = false;
    }
  }

  public static getAccessToken(): string | null {
    return cachedAccessToken;
  }

  public static setAccessToken(token: string | null): void {
    cachedAccessToken = token;
  }

  public static async signOut(): Promise<void> {
    if (auth) {
      await fbSignOut(auth);
    }
    cachedAccessToken = null;
  }

  /**
   * Fetch authenticated user's Gmail profile
   */
  public static async getProfile(): Promise<GmailProfile> {
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
    const closing = params.tone === 'friendly' ? '\n\nBest regards,\nUniversal Bot' : '\n\nSincerely,\nAI Assistant';
    return `${greeting}Thank you for your message regarding: "${params.context.slice(0, 80)}...".\n\nI have reviewed the details and will follow up accordingly.${closing}`;
  }
}
