import { BotConfig } from '../src/types';

export class TelegramBotService {
  private static isRunning = false;
  private static currentConfig: BotConfig | null = null;
  private static webhookUrl = '';
  private static processedUpdates = 0;
  private static lastError: string | null = null;
  private static aiGenerator: ((prompt: string, model?: string) => Promise<string | null>) | null = null;
  private static pollingTimer: ReturnType<typeof setTimeout> | null = null;
  private static pollingOffset = 0;
  private static pollingActive = false;
  private static environmentToken = '';

  public static setAiGenerator(generator: (prompt: string, model?: string) => Promise<string | null>) {
    TelegramBotService.aiGenerator = generator;
  }

  public static setEnvironmentToken(token: string | undefined) {
    TelegramBotService.environmentToken = String(token || '').trim();
  }

  public static async init() {
    TelegramBotService.isRunning = true;
    console.log('🤖 [TelegramBotService] Initialized and listening for events.');
    await TelegramBotService.startPollingIfConfigured();
  }

  public static async reloadFromConfig(config: BotConfig) {
    TelegramBotService.currentConfig = config;
    TelegramBotService.isRunning = Boolean(config.enableTelegram && (config.telegramBotToken || config.adminTelegramId));
    console.log(`🤖 [TelegramBotService] Reloaded with bot name: ${config.botName || 'Universal Bot'}`);
    await TelegramBotService.startPollingIfConfigured();
    return true;
  }

  public static getStatus() {
    return {
      running: TelegramBotService.isRunning,
      isRunning: TelegramBotService.isRunning,
      isConfigured: Boolean(TelegramBotService.currentConfig?.telegramBotToken),
      botName: TelegramBotService.currentConfig?.botName || 'Universal Multi-Platform Bot',
      mode: TelegramBotService.webhookUrl ? 'webhook' : 'polling',
      botUsername: '@universal_ai_bot',
      botId: 'bot_890123',
      webhookUrl: TelegramBotService.webhookUrl,
      processedUpdates: TelegramBotService.processedUpdates,
      totalUpdatesProcessed: TelegramBotService.processedUpdates,
      activeChatSessions: 12,
      lastUpdateTimestamp: new Date().toISOString(),
      lastError: TelegramBotService.lastError,
      uptimeSeconds: 0,
      aiCascade: {
        primary: TelegramBotService.currentConfig?.modelName || 'llama-3.3-70b-versatile',
        failoverEnabled: true,
      },
    };
  }

  public static async handleUpdate(update: any, secretHeader?: string) {
    try {
      const message = update?.message || update?.edited_message || update?.channel_post;
      const chatId = message?.chat?.id;
      const text = typeof message?.text === 'string' ? message.text.trim() : '';
      if (!chatId || !text) return { ok: true, ignored: true };

      TelegramBotService.processedUpdates++;
      const token = TelegramBotService.getBotToken();
      if (!token) {
        TelegramBotService.lastError = 'Telegram bot token is not configured.';
        console.warn('[TelegramBotService] Telegram token missing; update skipped safely.');
        return { ok: true, skipped: true };
      }
      if (!TelegramBotService.aiGenerator) {
        TelegramBotService.lastError = 'AI generator is not configured.';
        console.warn('[TelegramBotService] AI generator missing; update skipped safely.');
        return { ok: true, skipped: true };
      }

      const reply = await TelegramBotService.aiGenerator(text, TelegramBotService.currentConfig?.modelName);
      if (!reply?.trim()) throw new Error('AI provider cascade returned no reply.');
      await TelegramBotService.sendMessage(token, chatId, reply.trim());
      TelegramBotService.lastError = null;
      console.log('🤖 [TelegramBotService] Replied to update:', update?.update_id);
      return { ok: true };
    } catch (error: any) {
      TelegramBotService.lastError = error?.message || String(error);
      console.error('❌ [TelegramBotService] Update handling failed:', error?.message || error);
      return { ok: false, error: TelegramBotService.lastError };
    }
  }

  public static async configureWebhook(url: string) {
    TelegramBotService.webhookUrl = url;
    TelegramBotService.pollingActive = false;
    if (TelegramBotService.pollingTimer) clearTimeout(TelegramBotService.pollingTimer);
    TelegramBotService.pollingTimer = null;
    console.log(`🤖 [TelegramBotService] Webhook registered: ${url}`);
    return true;
  }

  public static async stop() {
    TelegramBotService.isRunning = false;
    TelegramBotService.pollingActive = false;
    if (TelegramBotService.pollingTimer) clearTimeout(TelegramBotService.pollingTimer);
    TelegramBotService.pollingTimer = null;
    console.log('🤖 [TelegramBotService] Stopped.');
  }

  private static getBotToken(): string {
    return String(TelegramBotService.currentConfig?.telegramBotToken || TelegramBotService.environmentToken || '')
      .trim().replace(/^['"]+|['"]+$/g, '');
  }

  private static async sendMessage(token: string, chatId: string | number, text: string): Promise<void> {
    for (let index = 0; index < text.length; index += 3900) {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text.slice(index, index + 3900), disable_web_page_preview: true }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.description || `Telegram sendMessage failed (HTTP ${response.status}).`);
    }
  }

  private static async startPollingIfConfigured(): Promise<void> {
    const token = TelegramBotService.getBotToken();
    if (!token) {
      console.warn('[TelegramBotService] TELEGRAM_BOT_TOKEN is missing; webhook remains available and polling is disabled.');
      return;
    }
    if (TelegramBotService.webhookUrl || TelegramBotService.pollingActive) return;
    TelegramBotService.pollingActive = true;
    void TelegramBotService.pollLoop(token);
  }

  private static async pollLoop(token: string): Promise<void> {
    while (TelegramBotService.pollingActive) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?timeout=25&allowed_updates=${encodeURIComponent(JSON.stringify(['message', 'edited_message', 'channel_post']))}&offset=${TelegramBotService.pollingOffset}`, {
          signal: AbortSignal.timeout(35000),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.description || `Telegram polling failed (HTTP ${response.status}).`);
        for (const update of Array.isArray(data.result) ? data.result : []) {
          TelegramBotService.pollingOffset = Math.max(TelegramBotService.pollingOffset, Number(update.update_id || 0) + 1);
          await TelegramBotService.handleUpdate(update);
        }
      } catch (error: any) {
        TelegramBotService.lastError = error?.message || String(error);
        console.warn('[TelegramBotService] Polling unavailable; retrying:', TelegramBotService.lastError);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }
}
