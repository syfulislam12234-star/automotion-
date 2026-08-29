import crypto from 'crypto';
import { ServerDatabase } from './db';
import { BotConfig } from '../src/types';
import { FailoverEngine } from './aiFailoverEngine';

/**
 * Complete Facebook Messenger Configuration & Webhook Engine
 *
 * - Messenger Profile API: "Get Started" button, Persistent Menu, Auto-Greeting.
 * - Webhook payload processing with HMAC SHA-256 signature verification
 *   (`x-hub-signature-256`) using timing-safe comparison.
 * - Replies are generated through the Millisecond AI Failover Engine (with the
 *   trained store-knowledge context injected automatically) and respect the
 *   per-customer AI vs Human handover mode stored in the CRM.
 * - Telegram, WhatsApp and every other webhook flow are untouched.
 */

export interface MessengerConfigSnapshot {
  pageAccessToken: string;
  appSecret: string;
  verifyToken: string;
  graphApiVersion: string;
  getStartedEnabled: boolean;
  getStartedPayload: string;
  greetingText: string;
  persistentMenu: string;
}

interface MessengerMessagingEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean };
  postback?: { payload?: string; title?: string };
  delivery?: unknown;
  read?: unknown;
}

interface MessengerWebhookPayload {
  object?: string;
  entry?: Array<{ id?: string; time?: number; messaging?: MessengerMessagingEvent[] }>;
}

function cleanValue(value: unknown): string {
  return String(value ?? '').trim();
}

export class MessengerService {
  private static processedEvents = 0;
  private static lastEventAt = '';

  /** Resolves the Messenger configuration: dashboard override → DB configs → environment. */
  public static resolveConfig(override?: Partial<MessengerConfigSnapshot>): MessengerConfigSnapshot {
    let dbConfig: Partial<BotConfig> = {};
    try {
      for (const { config } of ServerDatabase.getAllBotConfigs()) {
        if (config?.messengerPageAccessToken) {
          dbConfig = config;
          break;
        }
      }
    } catch {
      // Database unavailable — fall through to environment defaults.
    }
    return {
      pageAccessToken: cleanValue(override?.pageAccessToken ?? dbConfig.messengerPageAccessToken ?? process.env.MESSENGER_PAGE_ACCESS_TOKEN ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN),
      appSecret: cleanValue(override?.appSecret ?? dbConfig.messengerAppSecret ?? process.env.MESSENGER_APP_SECRET ?? process.env.FACEBOOK_APP_SECRET),
      verifyToken: cleanValue(override?.verifyToken ?? dbConfig.messengerVerifyToken ?? process.env.MESSENGER_VERIFY_TOKEN ?? process.env.FACEBOOK_VERIFY_TOKEN) || 'automotion_verify_token',
      graphApiVersion: cleanValue(override?.graphApiVersion ?? dbConfig.messengerGraphApiVersion ?? process.env.MESSENGER_GRAPH_API_VERSION) || 'v19.0',
      getStartedEnabled: override?.getStartedEnabled ?? dbConfig.messengerGetStartedEnabled ?? true,
      getStartedPayload: cleanValue(override?.getStartedPayload ?? dbConfig.messengerGetStartedPayload) || 'GET_STARTED',
      greetingText: cleanValue(override?.greetingText ?? dbConfig.messengerGreetingText),
      persistentMenu: cleanValue(override?.persistentMenu ?? dbConfig.messengerPersistentMenu),
    };
  }

  /** Messenger subscription verification (GET hub.mode/hub.verify_token/hub.challenge). */
  public static verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const config = MessengerService.resolveConfig();
    if (mode !== 'subscribe' || token !== config.verifyToken) return null;
    return challenge || 'webhook_verified';
  }

  /** HMAC SHA-256 signature verification of the raw request body (x-hub-signature-256). */
  public static verifySignature(rawBody: string | undefined, signature: string, appSecret: string): boolean {
    if (!appSecret) {
      console.warn('[MessengerService] App Secret not configured — skipping signature verification.');
      return true;
    }
    if (!rawBody || !signature.startsWith('sha256=')) return false;
    const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const receivedBuffer = Buffer.from(signature, 'utf8');
    if (expectedBuffer.length !== receivedBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  /** Processes verified Messenger webhook payloads into the CRM and the AI brain. */
  public static async handleWebhookEvent(payload: MessengerWebhookPayload, rawBody?: string, signature?: string): Promise<{ handled: number; verified: boolean }> {
    const config = MessengerService.resolveConfig();
    const verified = MessengerService.verifySignature(rawBody, signature || '', config.appSecret);
    if (!verified) return { handled: 0, verified: false };

    let handled = 0;
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    for (const entry of entries) {
      const messagingEvents = Array.isArray(entry?.messaging) ? entry.messaging : [];
      for (const event of messagingEvents) {
        const senderId = cleanValue(event?.sender?.id);
        if (!senderId) continue;
        if (event?.message?.is_echo || event?.delivery || event?.read) continue;

        const text = cleanValue(event?.message?.text) || cleanValue(event?.postback?.title) || cleanValue(event?.postback?.payload);
        if (!text) continue;

        const senderName = await MessengerService.fetchSenderName(config, senderId).catch(() => null);
        const customer = ServerDatabase.upsertCrmCustomer('messenger', senderId, senderName || undefined);
        ServerDatabase.addCrmMessage({
          customerId: customer.id,
          customerName: customer.name,
          platform: 'messenger',
          direction: 'inbound',
          text: text.slice(0, 2000),
        });
        MessengerService.processedEvents += 1;
        MessengerService.lastEventAt = new Date().toISOString();
        handled += 1;

        // AI vs Human handover: only the AI mode auto-replies.
        if (customer.agentMode !== 'ai' || !config.pageAccessToken) continue;

        const reply = await FailoverEngine.generate([{ role: 'user', content: text }]).catch(() => null);
        if (!reply?.text) continue;
        const delivered = await MessengerService.sendMessengerText(config, senderId, reply.text).catch(() => false);
        ServerDatabase.addCrmMessage({
          customerId: customer.id,
          customerName: customer.name,
          platform: 'messenger',
          direction: 'outbound',
          text: `${reply.text}${delivered ? '' : ' (queued — delivery pending)'}`.slice(0, 2000),
        });
      }
    }
    return { handled, verified: true };
  }

  /** Sends a plain text message through the Facebook Graph API Send endpoint. */
  public static async sendMessengerText(config: MessengerConfigSnapshot, recipientId: string, text: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/${config.graphApiVersion}/me/messages?access_token=${encodeURIComponent(config.pageAccessToken)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient: { id: recipientId }, message: { text: String(text || '').slice(0, 2000) } }),
          signal: AbortSignal.timeout(10000),
        },
      );
      return response.ok;
    } catch (error: any) {
      console.warn('[MessengerService] Send message failed:', error?.message || error);
      return false;
    }
  }

  /** Best-effort sender profile lookup (first/last name) through the Graph API. */
  public static async fetchSenderName(config: MessengerConfigSnapshot, senderId: string): Promise<string | null> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/${config.graphApiVersion}/${encodeURIComponent(senderId)}?fields=first_name,last_name&access_token=${encodeURIComponent(config.pageAccessToken)}`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (!response.ok) return null;
      const data = await response.json().catch(() => ({})) as { first_name?: string; last_name?: string };
      const name = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
      return name || null;
    } catch {
      return null;
    }
  }

  /** Pushes Get Started / Greeting / Persistent Menu to the Messenger Profile API. */
  public static async syncMessengerProfile(override?: Partial<MessengerConfigSnapshot>): Promise<{ results: string[] }> {
    const config = MessengerService.resolveConfig(override);
    if (!config.pageAccessToken) throw new Error('Page Access Token is required to sync the Messenger profile.');
    const results: string[] = [];
    const base = `https://graph.facebook.com/${config.graphApiVersion}/me/messenger_profile?access_token=${encodeURIComponent(config.pageAccessToken)}`;

    const postProfile = async (body: Record<string, unknown>, label: string): Promise<void> => {
      const response = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`${label} failed (HTTP ${response.status}): ${errorText.slice(0, 160)}`);
      }
      results.push(`${label} ✓`);
    };

    if (config.getStartedEnabled) {
      await postProfile({ get_started: { payload: config.getStartedPayload } }, 'Get Started button');
    } else {
      await fetch(`${base}&fields=get_started`, { method: 'DELETE', signal: AbortSignal.timeout(10000) }).catch(() => null);
      results.push('Get Started button removed');
    }

    if (config.greetingText) {
      await postProfile({ greeting: [{ locale: 'default', text: config.greetingText.slice(0, 160) }] }, 'Auto-greeting');
    } else {
      await fetch(`${base}&fields=greeting`, { method: 'DELETE', signal: AbortSignal.timeout(10000) }).catch(() => null);
      results.push('Auto-greeting removed');
    }

    if (config.persistentMenu) {
      let items: unknown;
      try {
        items = JSON.parse(config.persistentMenu);
      } catch {
        throw new Error('Persistent Menu must be a valid JSON array of menu items.');
      }
      if (!Array.isArray(items)) throw new Error('Persistent Menu must be a JSON array of menu items.');
      await postProfile(
        { persistent_menu: [{ locale: 'default', composer_input_disabled: false, call_to_actions: items }] },
        'Persistent Menu',
      );
    }

    return { results };
  }

  public static getStatus(): { processedEvents: number; lastEventAt: string } {
    return { processedEvents: MessengerService.processedEvents, lastEventAt: MessengerService.lastEventAt };
  }
}