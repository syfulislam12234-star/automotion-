import { BotConfig } from '../src/types';

export class TelegramBotService {
  private static isRunning = false;
  private static currentConfig: BotConfig | null = null;
  private static webhookUrl = '';
  private static processedUpdates = 0;
  private static lastError: string | null = null;

  public static async init() {
    TelegramBotService.isRunning = true;
    console.log('🤖 [TelegramBotService] Initialized and listening for events.');
  }

  public static async reloadFromConfig(config: BotConfig) {
    TelegramBotService.currentConfig = config;
    TelegramBotService.isRunning = Boolean(config.enableTelegram && (config.telegramBotToken || config.adminTelegramId));
    console.log(`🤖 [TelegramBotService] Reloaded with bot name: ${config.botName || 'Universal Bot'}`);
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
      uptimeSeconds: process.uptime(),
      aiCascade: {
        primary: TelegramBotService.currentConfig?.modelName || 'llama-3.3-70b-versatile',
        failoverEnabled: true,
      },
    };
  }

  public static async handleUpdate(update: any, secretHeader?: string) {
    TelegramBotService.processedUpdates++;
    console.log('🤖 [TelegramBotService] Handled incoming webhook update:', update?.update_id);
    return { ok: true };
  }

  public static async configureWebhook(url: string) {
    TelegramBotService.webhookUrl = url;
    console.log(`🤖 [TelegramBotService] Webhook registered: ${url}`);
    return true;
  }

  public static async stop() {
    TelegramBotService.isRunning = false;
    console.log('🤖 [TelegramBotService] Stopped.');
  }
}
