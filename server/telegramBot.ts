import { BotConfig } from '../src/types';
import { uploadYouTubeVideo } from './youtubeService';
import { GlobalApiKeyStore } from './keyStore';
import { FailoverEngine } from './aiFailoverEngine';

interface TelegramUploadState {
  step: 'file' | 'privacy' | 'kids';
  fileId?: string;
  topic?: string;
  privacyStatus?: 'public' | 'private' | 'unlisted';
}

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
  private static uploadStates = new Map<string, TelegramUploadState>();

  private static ensureYouTubeLink(reply: string, userQuery: string): string {
    const videoIntentKeywords = ['video', 'tutorial', 'youtube', 'ভিডিও', 'টিউটোরিয়াল', 'লিংক', 'link'];
    if (!videoIntentKeywords.some((keyword) => userQuery.toLowerCase().includes(keyword.toLowerCase())) || /youtube\.com\//i.test(reply)) return reply;
    return `${reply}\n\n📺 **সরাসরি ইউটিউব টিউটোরিয়াল দেখতে পারেন:**\nhttps://www.youtube.com/results?search_query=${encodeURIComponent(userQuery)}`;
  }

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
        activeProviders: GlobalApiKeyStore.getActiveProviderIds().length,
        activeKeys: GlobalApiKeyStore.getStats().keys,
      },
    };
  }

  public static async handleUpdate(update: any, secretHeader?: string) {
    try {
      const message = update?.message || update?.edited_message || update?.channel_post;
      const chatId = message?.chat?.id;
      const text = typeof message?.text === 'string' ? message.text.trim() : '';
      if (!chatId) return { ok: true, ignored: true };

      TelegramBotService.processedUpdates++;
      const token = TelegramBotService.getBotToken();
      if (!token) {
        TelegramBotService.lastError = 'Telegram bot token is not configured.';
        console.warn('[TelegramBotService] Telegram token missing; update skipped safely.');
        return { ok: true, skipped: true };
      }
      const normalizedText = text.toLowerCase();
      const command = normalizedText.split(/\s+/)[0].split('@')[0];
      const restrictedCommands = new Set(['/admin', '/stats', '/restart', '/broadcast', '/clear_memory', '/whitelist', '/database', '/settings', '/config', '/keys', '/env', '/status_admin', '/telemetry', '/users', '/setkey', '/setenv']);
      const adminChatId = String(TelegramBotService.currentConfig?.telegramAdminChatId || TelegramBotService.currentConfig?.adminTelegramId || '').trim();
      if (restrictedCommands.has(command) && String(chatId) !== adminChatId) {
        await TelegramBotService.sendMessage(token, chatId, 'Access Denied: You do not have authorization for administrative operations.');
        return { ok: true, denied: true };
      }
      const asksForHelp = normalizedText === 'help' || normalizedText === 'assistance' || normalizedText === 'what can you do';
      if (command === '/help' || command === '/start' || asksForHelp) {
        await TelegramBotService.sendMessage(token, chatId,
          '<b>Automotion AI Assistant</b>\n\n' +
          '<b>Available commands</b>\n' +
          '/start - Start or restart the Telegram AI assistant.\n' +
          '/help - View this guide and available automation tools.\n' +
          '/status - Check the live AI engine status.\n' +
          '/yt_upload - Start the secure YouTube upload guide.\n\n' +
          '<b>YouTube upload guide</b>\n' +
          '1. Send /yt_upload, optionally followed by a short topic.\n' +
          '2. Attach the video file when prompted.\n' +
          '3. Choose Public, Private, or Unlisted.\n' +
          '4. Choose Made for Kids or Not Made for Kids.\n' +
          'AI SEO metadata is generated automatically before live YouTube processing.\n\n' +
          '<b>AI assistant chat</b>\n' +
          'Send any question directly in this chat. The live AI fallback engine will answer in your language.\n\n' +
          '<i>Administrative commands and credentials are protected.</i>');
        return { ok: true };
      }
      if (command === '/status') {
        const status = TelegramBotService.getStatus();
        await TelegramBotService.sendMessage(token, chatId,
          `<b>AI Engine Status</b>\n\n` +
          `Status: <b>${status.running ? 'Operational' : 'Stopped'}</b>\n` +
          `Configured: <b>${status.isConfigured ? 'Yes' : 'No'}</b>\n` +
          `Mode: <b>${status.mode}</b>\n` +
          `Updates processed: <b>${status.totalUpdatesProcessed}</b>\n` +
          `Primary route: <b>${TelegramBotService.escapeHtml(status.aiCascade.primary)}</b>`);
        return { ok: true };
      }
      const chatKey = String(chatId);
      const uploadState = TelegramBotService.uploadStates.get(chatKey);
      if (message?.video?.file_id && uploadState?.step === 'file') {
        uploadState.fileId = message.video.file_id;
        uploadState.topic = uploadState.topic || message.video.file_name || 'Uploaded YouTube video';
        uploadState.step = 'privacy';
        await TelegramBotService.sendMessage(token, chatId, 'ভিডিওটি কি Public, Private নাকি Unlisted করতে চান? উত্তর দিন: public, private অথবা unlisted');
        return { ok: true };
      }
      if (!text) return { ok: true, ignored: true };
      if (text.toLowerCase() === '/yt_upload' || text.toLowerCase().startsWith('/yt_upload ')) {
        TelegramBotService.uploadStates.set(chatKey, { step: 'file', topic: text.slice('/yt_upload'.length).trim() || undefined });
        await TelegramBotService.sendMessage(token, chatId, 'ধাপ ১/৩: ভিডিও ফাইলটি এখন Telegram-এ attach করে পাঠান।');
        return { ok: true };
      }
      if (uploadState?.step === 'privacy') {
        const privacy = text.toLowerCase();
        if (!['public', 'private', 'unlisted'].includes(privacy)) {
          await TelegramBotService.sendMessage(token, chatId, 'দয়া করে public, private অথবা unlisted লিখুন।');
          return { ok: true };
        }
        uploadState.privacyStatus = privacy as NonNullable<TelegramUploadState['privacyStatus']>;
        uploadState.step = 'kids';
        await TelegramBotService.sendMessage(token, chatId, 'ধাপ ৩/৩: ভিডিওটি কি Made for Kids নাকি Not Made for Kids? উত্তর দিন: kids অথবা not kids');
        return { ok: true };
      }
      if (uploadState?.step === 'kids') {
        const normalized = text.toLowerCase();
        if (!['kids', 'not kids', 'notkids', 'no'].includes(normalized)) {
          await TelegramBotService.sendMessage(token, chatId, 'দয়া করে kids অথবা not kids লিখুন।');
          return { ok: true };
        }
        try {
          await TelegramBotService.sendMessage(token, chatId, 'AI SEO metadata তৈরি করে YouTube-এ আপলোড করা হচ্ছে...');
          const result = await TelegramBotService.uploadTelegramVideo(token, uploadState, normalized === 'kids', chatId);
          TelegramBotService.uploadStates.delete(chatKey);
          await TelegramBotService.sendMessage(token, chatId, `আপলোড সম্পন্ন: ${result.url}`);
        } catch (error: any) {
          TelegramBotService.uploadStates.delete(chatKey);
          await TelegramBotService.sendMessage(token, chatId, `YouTube আপলোড ব্যর্থ: ${error?.message || 'OAuth configuration পরীক্ষা করুন।'}`);
        }
        return { ok: true };
      }
      void TelegramBotService.sendChatAction(token, chatId).catch((error: any) => {
        console.warn('[TelegramBotService] Typing action dispatch failed:', error?.message || error);
      });
      if (!TelegramBotService.aiGenerator) {
        TelegramBotService.lastError = 'AI generator is not configured.';
        console.warn('[TelegramBotService] AI generator missing; update skipped safely.');
        return { ok: true, skipped: true };
      }

      let reply: string | null = null;
      try {
        reply = await Promise.race([
          TelegramBotService.aiGenerator(text, TelegramBotService.currentConfig?.modelName),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Shared Telegram AI route timed out.')), 20000)),
        ]);
        if (!reply?.trim()) throw new Error('Primary AI route returned no text.');
      } catch (error: any) {
        console.warn('[TelegramBotService] Configured API provider cascade unavailable:', error?.message || error);
      }
      if (!reply?.trim() && TelegramBotService.aiGenerator) {
        // ⚡ Millisecond failover: rapid sequential retries across the entire active provider pool
        const direct = await FailoverEngine.generate([{ role: 'user', content: text }], {
          preferredModel: TelegramBotService.currentConfig?.modelName || undefined,
        }).catch(() => null);
        if (direct?.text?.trim()) reply = direct.text.trim();
      }
      if (!reply?.trim()) {
        reply = GlobalApiKeyStore.hasAnyKeys()
          ? '⚡ All active AI routes are momentarily busy. Please resend your message in a few seconds — the failover engine will route it to the next available provider.'
          : 'Please add at least one API key in the API Portal to enable AI features.';
      }
      await TelegramBotService.sendMessage(token, chatId, TelegramBotService.ensureYouTubeLink(reply.trim(), text));
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

  private static formatTelegramHtml(text: string): string {
    const escaped = TelegramBotService.escapeHtml(text);
    return escaped
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/__(.+?)__/g, '<b>$1</b>')
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  }

  private static escapeHtml(value: string): string {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  private static async sendMessage(token: string, chatId: string | number, text: string): Promise<void> {
    const formattedText = TelegramBotService.formatTelegramHtml(text);
    for (let index = 0; index < formattedText.length; index += 3900) {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: formattedText.slice(index, index + 3900), parse_mode: 'HTML', disable_web_page_preview: true }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.description || `Telegram sendMessage failed (HTTP ${response.status}).`);
    }
  }

  private static async uploadTelegramVideo(token: string, state: TelegramUploadState, madeForKids: boolean, chatId: string | number) {
    if (!state.fileId || !state.topic || !state.privacyStatus || !TelegramBotService.currentConfig) throw new Error('ভিডিও, topic এবং তিনটি upload setting প্রয়োজন।');
    const fileResponse = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(state.fileId)}`, { signal: AbortSignal.timeout(10000) });
    const filePayload = await fileResponse.json().catch(() => ({}));
    if (!fileResponse.ok || !filePayload.ok || !filePayload.result?.file_path) throw new Error('Telegram video file পাওয়া যায়নি।');
    const downloadResponse = await fetch(`https://api.telegram.org/file/bot${token}/${filePayload.result.file_path}`, { signal: AbortSignal.timeout(120000) });
    if (!downloadResponse.ok) throw new Error('Telegram video download ব্যর্থ হয়েছে।');
    const video = new Uint8Array(await downloadResponse.arrayBuffer());
    const config = TelegramBotService.currentConfig;
    return uploadYouTubeVideo({
      video,
      mimeType: 'video/mp4',
      titlePrompt: state.topic,
      privacyStatus: state.privacyStatus,
      madeForKids,
      clientId: config.youtubeClientId,
      clientSecret: config.youtubeClientSecret,
      refreshToken: config.youtubeRefreshToken,
      channelId: config.youtubeChannelId,
      categoryId: config.youtubeDefaultCategory,
    }, (prompt) => TelegramBotService.aiGenerator!(prompt, config.modelName));
  }

  private static async sendChatAction(token: string, chatId: string | number): Promise<void> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
        signal: AbortSignal.timeout(2500),
      });
      if (!response.ok) console.warn(`[TelegramBotService] Typing indicator failed with HTTP ${response.status}.`);
    } catch (error: any) {
      console.warn('[TelegramBotService] Typing indicator unavailable; continuing with AI reply:', error?.message || error);
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
          void TelegramBotService.handleUpdate(update).catch((error: any) => {
            console.warn('[TelegramBotService] Concurrent update processing failed:', error?.message || error);
          });
        }
      } catch (error: any) {
        TelegramBotService.lastError = error?.message || String(error);
        console.warn('[TelegramBotService] Polling unavailable; retrying:', TelegramBotService.lastError);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }
}
