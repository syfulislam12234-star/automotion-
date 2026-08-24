import crypto from 'crypto';
import { DbChannelConnection, ServerDatabase } from './db';
import { GLOBAL_100_AI_MODELS } from '../src/data/aiModels100';

type Platform = 'telegram' | 'whatsapp' | 'line';
type AiGenerator = (request: {
  prompt: string;
  model: string;
  systemPrompt?: string;
  history?: Array<{ role: string; content: string }>;
}) => Promise<string>;

interface IncomingMessage {
  channelId: string;
  platform: Platform;
  senderId: string;
  replyTarget: string;
  text: string;
}

const MODEL_BY_ID = new Map(GLOBAL_100_AI_MODELS.map(model => [model.id, model]));
const MODEL_BY_PROVIDER_ID = new Map(GLOBAL_100_AI_MODELS.map(model => [model.modelId, model]));

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export class MultiChannelGateway {
  private readonly running = new Set<string>();
  private readonly pollingTasks = new Map<string, Promise<void>>();
  private readonly offsets = new Map<string, number>();
  private readonly histories = new Map<string, Array<{ role: string; content: string }>>();

  public constructor(private readonly generateAi: AiGenerator) {}

  public listForUser(userId: string) {
    return ServerDatabase.getChannelsForUser(userId).map(channel => this.publicChannel(channel));
  }

  public async configure(channel: DbChannelConnection): Promise<DbChannelConnection> {
    this.validateChannel(channel);
    const previous = ServerDatabase.getChannel(channel.id);
    if (previous && previous.userId !== channel.userId) throw new Error('Channel belongs to another user.');

    const saved = ServerDatabase.saveChannel({
      ...channel,
      updatedAt: new Date().toISOString(),
      status: channel.enabled ? 'configured' : 'stopped',
    });
    await this.stop(channel.id);
    if (saved.enabled) await this.start(saved);
    return this.publicChannel(ServerDatabase.getChannel(saved.id) || saved);
  }

  public async remove(channelId: string, userId: string): Promise<boolean> {
    const channel = ServerDatabase.getChannel(channelId);
    if (!channel || channel.userId !== userId) return false;
    await this.stop(channelId);
    return ServerDatabase.deleteChannel(channelId);
  }

  public async startAll(): Promise<void> {
    for (const [ownerKey, saved] of Object.entries(ServerDatabase.getAllBotConfigs())) {
      const user = ServerDatabase.getUserById(ownerKey) || ServerDatabase.getUserByEmail(ownerKey);
      if (user && saved?.config) {
        try {
          await this.syncFromBotConfig(user.id, saved.config);
        } catch (error: any) {
          console.error(`Channel configuration restore failed for ${user.id}:`, error?.message || error);
        }
      }
    }
    for (const channel of ServerDatabase.getAllChannels()) {
      if (!channel.enabled) continue;
      if (channel.platform === 'telegram' && channel.credentials.token === process.env.TELEGRAM_BOT_TOKEN) continue;
      try {
        await this.start(channel);
      } catch (error: any) {
        this.markError(channel, error);
      }
    }
  }

  public async syncFromBotConfig(userId: string, config: any): Promise<void> {
    const channels: Array<{ platform: Platform; enabled: boolean; mode: 'polling' | 'webhook'; credentials: Record<string, string> }> = [
      {
        platform: 'telegram',
        enabled: Boolean(config.enableTelegram && config.telegramBotToken && config.telegramBotToken !== process.env.TELEGRAM_BOT_TOKEN),
        mode: config.deploymentMode === 'webhook' ? 'webhook' : 'polling',
        credentials: { token: String(config.telegramBotToken || '') },
      },
      {
        platform: 'whatsapp',
        enabled: Boolean(config.enableWhatsApp && config.whatsappPhoneNumberId && config.whatsappAccessToken),
        mode: 'webhook',
        credentials: { phoneNumberId: String(config.whatsappPhoneNumberId || ''), accessToken: String(config.whatsappAccessToken || ''), verifyToken: String(config.whatsappVerifyToken || '') },
      },
      {
        platform: 'line',
        enabled: Boolean(config.enableLine && config.lineChannelAccessToken),
        mode: 'webhook',
        credentials: { channelAccessToken: String(config.lineChannelAccessToken || ''), channelSecret: String(config.lineChannelSecret || '') },
      },
    ];
    for (const entry of channels) {
      const existing = ServerDatabase.getChannel(`${userId}:${entry.platform}`);
      const channel: DbChannelConnection = {
        id: `${userId}:${entry.platform}`,
        userId,
        platform: entry.platform,
        enabled: entry.enabled,
        mode: entry.mode,
        credentials: entry.credentials,
        modelId: config.modelName,
        systemPrompt: config.systemPrompt,
        status: existing?.status || 'configured',
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await this.configure(channel);
    }
  }

  public async stopAll(): Promise<void> {
    await Promise.all([...this.running].map(channelId => this.stop(channelId)));
  }

  public async handleWebhook(channelId: string, body: any, suppliedSecret?: string, rawBody?: string): Promise<void> {
    const channel = ServerDatabase.getChannel(channelId);
    if (!channel || !channel.enabled) throw new Error('Channel is not active.');
    if (channel.platform === 'line') {
      const signature = crypto.createHmac('sha256', channel.credentials.channelSecret || '').update(rawBody || JSON.stringify(body)).digest('base64');
      if (!suppliedSecret || !safeEqual(signature, suppliedSecret)) throw new Error('Webhook authentication failed.');
    } else {
      const expectedSecret = channel.credentials.webhookSecret || '';
      if (expectedSecret && !safeEqual(expectedSecret, suppliedSecret || '')) throw new Error('Webhook authentication failed.');
    }

    const message = this.normalize(channel, body);
    if (message) await this.processMessage(channel, message);
  }

  public verifyWhatsApp(channelId: string, mode: string, token: string, challenge: string): string {
    const channel = this.getActiveChannel(channelId, 'whatsapp');
    const verifyToken = channel.credentials.verifyToken || channel.credentials.whatsappVerifyToken || '';
    if (mode === 'subscribe' && verifyToken && safeEqual(verifyToken, token)) return challenge;
    throw new Error('WhatsApp webhook verification failed.');
  }

  private async start(channel: DbChannelConnection): Promise<void> {
    if (this.running.has(channel.id)) return;
    if (channel.mode === 'polling' && channel.platform !== 'telegram') {
      throw new Error(`${channel.platform} supports webhook mode only.`);
    }
    this.running.add(channel.id);
    ServerDatabase.saveChannel({ ...channel, status: 'running', lastError: undefined, updatedAt: new Date().toISOString() });
    if (channel.platform === 'telegram' && channel.mode === 'polling') {
      const task = this.pollTelegram(channel).finally(() => this.pollingTasks.delete(channel.id));
      this.pollingTasks.set(channel.id, task);
    }
  }

  private async stop(channelId: string): Promise<void> {
    this.running.delete(channelId);
    const channel = ServerDatabase.getChannel(channelId);
    if (channel) ServerDatabase.saveChannel({ ...channel, status: 'stopped', updatedAt: new Date().toISOString() });
  }

  private async pollTelegram(channel: DbChannelConnection): Promise<void> {
    const token = this.requiredCredential(channel, ['token', 'botToken', 'telegramBotToken']);
    while (this.running.has(channel.id)) {
      try {
        const updates = await this.telegramApi(token, 'getUpdates', {
          offset: (this.offsets.get(channel.id) || 0) + 1,
          timeout: 25,
          allowed_updates: ['message'],
        });
        for (const update of updates) {
          this.offsets.set(channel.id, update.update_id);
          const message = this.normalize(channel, update);
          if (message) await this.processMessage(channel, message);
        }
      } catch (error: any) {
        this.markError(channel, error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private async processMessage(channel: DbChannelConnection, message: IncomingMessage): Promise<void> {
    const historyKey = `${channel.id}:${message.senderId}`;
    const history = this.histories.get(historyKey) || [];
    try {
      const model = this.resolveModel(channel.modelId);
      const response = await this.generateAi({
        prompt: message.text,
        model: model.modelId,
        systemPrompt: channel.systemPrompt,
        history,
      });
      history.push({ role: 'user', content: message.text }, { role: 'assistant', content: response });
      this.histories.set(historyKey, history.slice(-16));
      await this.send(channel, message.replyTarget, response);
      this.markRunning(channel);
    } catch (error: any) {
      this.markError(channel, error);
    }
  }

  private normalize(channel: DbChannelConnection, payload: any): IncomingMessage | null {
    if (channel.platform === 'telegram') {
      const message = payload.message || payload.edited_message;
      const text = String(message?.text || message?.caption || '').trim();
      if (!message?.chat?.id || !text || message.from?.is_bot) return null;
      return { channelId: channel.id, platform: 'telegram', senderId: String(message.from?.id || message.chat.id), replyTarget: String(message.chat.id), text };
    }
    if (channel.platform === 'whatsapp') {
      const value = payload.entry?.[0]?.changes?.[0]?.value;
      const message = value?.messages?.[0];
      const text = String(message?.text?.body || '').trim();
      if (!message?.from || !text) return null;
      return { channelId: channel.id, platform: 'whatsapp', senderId: message.from, replyTarget: message.from, text };
    }
    const event = payload.events?.[0];
    const text = String(event?.message?.text || '').trim();
    if (!event?.source?.userId || !text) return null;
    return { channelId: channel.id, platform: 'line', senderId: event.source.userId, replyTarget: event.source.userId, text };
  }

  private async send(channel: DbChannelConnection, recipient: string, text: string): Promise<void> {
    if (channel.platform === 'telegram') {
      await this.telegramApi(this.requiredCredential(channel, ['token', 'botToken', 'telegramBotToken']), 'sendMessage', { chat_id: recipient, text });
      return;
    }
    if (channel.platform === 'whatsapp') {
      const phoneId = this.requiredCredential(channel, ['phoneNumberId', 'whatsappPhoneNumberId']);
      const accessToken = this.requiredCredential(channel, ['accessToken', 'whatsappAccessToken']);
      await this.request(`https://graph.facebook.com/v20.0/${encodeURIComponent(phoneId)}/messages`, { Authorization: `Bearer ${accessToken}` }, { messaging_product: 'whatsapp', to: recipient, type: 'text', text: { body: text } });
      return;
    }
    const accessToken = this.requiredCredential(channel, ['channelAccessToken', 'lineChannelAccessToken']);
    await this.request('https://api.line.me/v2/bot/message/push', { Authorization: `Bearer ${accessToken}` }, { to: recipient, messages: [{ type: 'text', text }] });
  }

  private async telegramApi(token: string, method: string, body: any): Promise<any> {
    return this.request(`https://api.telegram.org/bot${token}/${method}`, {}, body).then(result => result.result);
  }

  private async request(url: string, headers: Record<string, string>, body: any): Promise<any> {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(`${response.status}: ${data.description || data.error?.message || 'Channel API request failed'}`);
    return data;
  }

  private resolveModel(modelId?: string) {
    const model = (modelId && (MODEL_BY_ID.get(modelId) || MODEL_BY_PROVIDER_ID.get(modelId))) || GLOBAL_100_AI_MODELS.find(entry => entry.status === 'active');
    if (!model) throw new Error('No active AI model is available.');
    return model;
  }

  private validateChannel(channel: DbChannelConnection): void {
    if (!channel.id || !channel.userId || !['telegram', 'whatsapp', 'line'].includes(channel.platform)) throw new Error('Invalid channel connection.');
    if (channel.enabled) {
      const keys = channel.platform === 'telegram' ? ['token', 'botToken', 'telegramBotToken'] : channel.platform === 'whatsapp' ? ['phoneNumberId', 'whatsappPhoneNumberId', 'accessToken', 'whatsappAccessToken'] : ['channelAccessToken', 'lineChannelAccessToken'];
      if (!keys.some(key => channel.credentials[key])) throw new Error(`Missing credentials for ${channel.platform}.`);
    }
  }

  private getActiveChannel(channelId: string, platform: Platform): DbChannelConnection {
    const channel = ServerDatabase.getChannel(channelId);
    if (!channel || channel.platform !== platform || !channel.enabled) throw new Error('Channel is not active.');
    return channel;
  }

  private requiredCredential(channel: DbChannelConnection, keys: string[]): string {
    const value = keys.map(key => channel.credentials[key]).find(Boolean);
    if (!value) throw new Error(`Missing credential for ${channel.platform}.`);
    return value;
  }

  private markRunning(channel: DbChannelConnection): void {
    const current = ServerDatabase.getChannel(channel.id);
    if (current) ServerDatabase.saveChannel({ ...current, status: 'running', lastError: undefined, updatedAt: new Date().toISOString() });
  }

  private markError(channel: DbChannelConnection, error: any): void {
    const current = ServerDatabase.getChannel(channel.id);
    if (current) ServerDatabase.saveChannel({ ...current, status: 'error', lastError: String(error?.message || error).slice(0, 500), updatedAt: new Date().toISOString() });
  }

  private publicChannel(channel: DbChannelConnection) {
    return { ...channel, credentials: Object.fromEntries(Object.keys(channel.credentials).map(key => [key, 'configured'])) };
  }
}
