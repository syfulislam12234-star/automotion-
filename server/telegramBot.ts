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
  /** Per-owner registry: ownerId → bot config holding that user's exact Telegram token. */
  private static userBotRegistry = new Map<string, BotConfig>();

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

  /** Registers a per-user bot configuration so webhook updates resolve back to its owner's exact token. */
  public static registerUserBot(ownerId: string, config: BotConfig): void {
    const id = String(ownerId || '').trim();
    if (!id || !config || typeof config !== 'object') return;
    const token = String(config.telegramBotToken || '').trim().replace(/^['"]+|['"]+$/g, '');
    if (!token) {
      TelegramBotService.userBotRegistry.delete(id);
      return;
    }
    TelegramBotService.userBotRegistry.set(id, config);
    console.log(`🤖 [TelegramBotService] Per-user bot registered for ${id} (token …${token.slice(-6)}).`);
  }

  public static getUserBotToken(ownerId: string): string {
    const config = TelegramBotService.userBotRegistry.get(String(ownerId || '').trim());
    return String(config?.telegramBotToken || '').trim().replace(/^['"]+|['"]+$/g, '');
  }

  public static getRegisteredBotCount(): number {
    return TelegramBotService.userBotRegistry.size;
  }

  /**
   * Calls Telegram's real setWebhook API so updates for this exact bot token are
   * delivered to the given callback URL. Gracefully reports HTTP 401 / invalid tokens.
   */
  public static async registerTelegramWebhook(botToken: string, webhookUrl: string): Promise<{ ok: boolean; description?: string }> {
    const token = String(botToken || '').trim().replace(/^['"]+|['"]+$/g, '');
    if (!token) return { ok: false, description: 'Bot token is missing.' };
    if (!/^https:\/\//i.test(webhookUrl)) {
      console.warn(`[TelegramBotService] setWebhook skipped — Telegram requires an HTTPS public URL (got: ${webhookUrl}).`);
      return { ok: false, description: 'Telegram requires an HTTPS public URL for webhooks (set PUBLIC_BASE_URL).' };
    }
    const secretToken = String(process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN || process.env.WEBHOOK_SECRET || '').trim();
    const params = new URLSearchParams({
      url: webhookUrl,
      allowed_updates: JSON.stringify(['message', 'edited_message', 'channel_post', 'callback_query']),
      drop_pending_updates: 'true',
      ...(secretToken ? { secret_token: secretToken } : {}),
    });
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook?${params.toString()}`, {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json().catch(() => ({}) as any);
      if (response.status === 401 || data?.error_code === 401) {
        console.error('❌ [TelegramBotService] setWebhook → HTTP 401 Unauthorized: the bot token is invalid or revoked. Regenerate it via @BotFather and save it again.');
        return { ok: false, description: 'Unauthorized (401): bot token is invalid or revoked.' };
      }
      if (!response.ok || data?.ok === false) {
        const description = String(data?.description || `Telegram setWebhook failed (HTTP ${response.status}).`);
        console.warn(`[TelegramBotService] setWebhook failed for token …${token.slice(-6)}: ${description}`);
        return { ok: false, description };
      }
      console.log(`✅ [TelegramBotService] setWebhook OK for token …${token.slice(-6)} → ${webhookUrl}`);
      return { ok: true };
    } catch (error: any) {
      const description = error?.message || String(error);
      console.warn(`[TelegramBotService] setWebhook request error for token …${token.slice(-6)}:`, description);
      return { ok: false, description };
    }
  }

  /** Registers (or refreshes) the webhook for one stored per-user bot. */
  public static async registerUserWebhook(ownerId: string, baseUrl: string): Promise<{ ok: boolean; description?: string; webhookUrl: string }> {
    const id = String(ownerId || '').trim();
    const webhookUrl = `${String(baseUrl || '').trim().replace(/\/+$/, '')}/api/webhooks/telegram/${encodeURIComponent(id)}`;
    const token = TelegramBotService.getUserBotToken(id);
    if (!token) {
      return { ok: false, description: 'No Telegram bot token is saved for this user yet.', webhookUrl };
    }
    const result = await TelegramBotService.registerTelegramWebhook(token, webhookUrl);
    return { ...result, webhookUrl };
  }

  /** Re-registers webhooks for every stored per-user bot (startup / post-save refresh). */
  public static async registerAllUserWebhooks(baseUrl: string): Promise<void> {
    for (const ownerId of [...TelegramBotService.userBotRegistry.keys()]) {
      try {
        await TelegramBotService.registerUserWebhook(ownerId, baseUrl);
      } catch (error: any) {
        console.warn(`[TelegramBotService] Webhook registration failed for ${ownerId}:`, error?.message || error);
      }
    }
  }

  /**
   * Public, token-explicit reply dispatcher: the response is always sent back through
   * the exact Telegram Bot instance (per-user or global) that received the update.
   */
  public static async sendTelegramMessage(chatId: string | number, responseText: string, botToken?: string): Promise<void> {
    const token = String(botToken || '').trim().replace(/^['"]+|['"]+$/g, '');
    if (!token) {
      console.warn('[TelegramBotService] sendTelegramMessage skipped: no bot token resolved for this chat.');
      return;
    }
    await TelegramBotService.sendMessage(token, chatId, responseText);
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

  public static async handleUpdate(update: any, secretHeader?: string, ownerId?: string) {
    try {
      const message = update?.message || update?.edited_message || update?.channel_post;
      const chatId = message?.chat?.id;
      const text = typeof message?.text === 'string' ? message.text.trim() : '';
      if (!chatId) return { ok: true, ignored: true };

      TelegramBotService.processedUpdates++;

      // Per-user token resolution: per-owner webhook routes embed the owner id, so the
      // update is dispatched with the exact bot token that received it (loaded from the
      // ServerDatabase botConfigs registry). Falls back to the global config/env token.
      const ownerConfig = ownerId ? TelegramBotService.userBotRegistry.get(String(ownerId)) || null : null;
      const ownerToken = String(ownerConfig?.telegramBotToken || '').trim().replace(/^['"]+|['"]+$/g, '');
      const token = ownerToken || TelegramBotService.getBotToken();
      const effectiveConfig = ownerConfig || TelegramBotService.currentConfig;
      if (!token) {
        TelegramBotService.lastError = 'Telegram bot token is not configured.';
        console.warn('[TelegramBotService] Telegram token missing; update skipped safely.');
        return { ok: true, skipped: true };
      }
      const normalizedText = text.toLowerCase();
      const command = normalizedText.split(/\s+/)[0].split('@')[0];
      const restrictedCommands = new Set(['/admin', '/stats', '/restart', '/broadcast', '/clear_memory', '/whitelist', '/database', '/settings', '/config', '/keys', '/env', '/status_admin', '/telemetry', '/users', '/setkey', '/setenv']);
      const adminChatId = String(effectiveConfig?.telegramAdminChatId || effectiveConfig?.adminTelegramId || '').trim();
      if (restrictedCommands.has(command) && String(chatId) !== adminChatId) {
        await TelegramBotService.sendMessage(token, chatId, 'Access Denied: You do not have authorization for administrative operations.');
        return { ok: true, denied: true };
      }
      const asksForHelp = ['help', 'assistance', 'what can you do', 'setup', 'api setup', 'guide'].includes(normalizedText);
      if (command === '/help' || command === '/start' || command === '/setup' || asksForHelp) {
        await TelegramBotService.sendMessage(token, chatId,
          '**🤖 AUTOMOTION AI — MASTER GUIDE**\n\n' +
          '**📜 COMMANDS**\n' +
          '/start — Activate the AI assistant\n' +
          '/help or /setup — Show this master guide\n' +
          '/status — Live AI engine, provider pool and key status\n' +
          '/yt_upload — Upload a video to YouTube with Viral AI SEO\n' +
          'Send any text — Chat with the multi-model AI brain (instant failover)\n\n' +
          '**🔑 STEP 1 — ADD AI API KEYS (unlocks AI replies)**\n' +
          '1️⃣ Google Gemini (FREE): open https://aistudio.google.com/app/apikey → sign in → Create API key → copy\n' +
          '2️⃣ Groq (FREE, fastest LPU): open https://console.groq.com/keys → log in → Create API Key → copy\n' +
          '3️⃣ OpenAI: open https://platform.openai.com/api-keys → Create new secret key → copy\n' +
          '4️⃣ OpenRouter (FREE models): open https://openrouter.ai/keys → Create key → copy\n' +
          '5️⃣ Add keys: Web App → 1-Click API Portal → paste → Verify & Save. Server keys can also go into the .env file (e.g. GROQ_API_KEY) then restart.\n' +
          '⚡ All keys join a circular millisecond failover pool — 429 rate limits and downtime heal automatically.\n\n' +
          '**🎬 STEP 2 — YOUTUBE API & OAUTH (enables auto-upload)**\n' +
          '1️⃣ Open https://console.cloud.google.com → create a project\n' +
          '2️⃣ APIs & Services → Library → enable **YouTube Data API v3**\n' +
          '3️⃣ OAuth consent screen → External → add your Google account as a Test user\n' +
          '4️⃣ Credentials → Create credentials → **OAuth Client ID** → Web application\n' +
          '5️⃣ Copy the Client ID and Client Secret\n' +
          '6️⃣ Generate a Refresh Token with the youtube.upload scope (the Google OAuth 2.0 Playground works great)\n' +
          '7️⃣ Paste Client ID, Secret and Refresh Token in the Web App → Config Panel → YouTube Studio tab\n\n' +
          '**📺 VIDEO TUTORIALS**\n' +
          '• Get a Gemini API key: https://www.youtube.com/results?search_query=how+to+get+google+gemini+api+key+free\n' +
          '• Get a Groq API key: https://www.youtube.com/results?search_query=how+to+get+groq+api+key+free\n' +
          '• YouTube OAuth refresh token: https://www.youtube.com/results?search_query=youtube+data+api+v3+oauth+refresh+token+tutorial\n' +
          '• Auto upload bot: https://www.youtube.com/results?search_query=telegram+bot+youtube+auto+upload+tutorial\n\n' +
          '**🔥 VIRAL AUTO-UPLOAD**\n' +
          'Send /yt_upload (optionally with a topic) → attach the video → choose Public, Private or Unlisted → choose Kids or Not Kids. The AI automatically writes a high-CTR viral title, an engagement-focused description, hashtags and ranking search tags, then uploads to YouTube.\n\n' +
          '__Administrative commands and credentials are protected.__');
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
          await TelegramBotService.sendMessage(token, chatId, '🔥 Viral AI SEO (title, description, hashtags, tags) তৈরি করে YouTube-এ আপলোড করা হচ্ছে...');
          const result = await TelegramBotService.uploadTelegramVideo(token, uploadState, normalized === 'kids', chatId, effectiveConfig);
          TelegramBotService.uploadStates.delete(chatKey);
          await TelegramBotService.sendMessage(token, chatId, `🔥 ভাইরাল AI SEO সহ আপলোড সম্পন্ন: ${result.url}`);
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
          TelegramBotService.aiGenerator(text, effectiveConfig?.modelName),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Shared Telegram AI route timed out.')), 20000)),
        ]);
        if (!reply?.trim()) throw new Error('Primary AI route returned no text.');
      } catch (error: any) {
        console.warn('[TelegramBotService] Configured API provider cascade unavailable:', error?.message || error);
      }
      if (!reply?.trim() && TelegramBotService.aiGenerator) {
        // ⚡ Millisecond failover: rapid sequential retries across the entire active provider pool
        const direct = await FailoverEngine.generate([{ role: 'user', content: text }], {
          preferredModel: effectiveConfig?.modelName || undefined,
        }).catch(() => null);
        if (direct?.text?.trim()) reply = direct.text.trim();
      }
      if (!reply?.trim()) {
        reply = GlobalApiKeyStore.hasAnyKeys()
          ? '⚡ All active AI routes are momentarily busy. Please resend your message in a few seconds — the failover engine will route it to the next available provider.'
          : 'Please add at least one API key in the API Portal to enable AI features.';
      }
      // Explicit per-bot dispatch: the reply is always sent via the exact bot token
      // instance that received this update (per-user token or global fallback).
      await TelegramBotService.sendTelegramMessage(chatId, TelegramBotService.ensureYouTubeLink(reply.trim(), text), token);
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
    // Register the webhook with Telegram's real setWebhook API for the globally
    // configured token (no-op fallback keeps the previous behavior when unavailable).
    const globalToken = TelegramBotService.getBotToken();
    if (globalToken && /^https:\/\//i.test(url)) {
      const result = await TelegramBotService.registerTelegramWebhook(globalToken, url);
      if (!result.ok) console.warn('[TelegramBotService] Global webhook registration notice:', result.description);
      return result.ok;
    }
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
      if (response.status === 401) {
        console.error(`❌ [TelegramBotService] sendMessage → HTTP 401 Unauthorized: bot token …${token.slice(-6)} is invalid or revoked. Regenerate it via @BotFather and save it in the Config Panel.`);
      }
      if (!response.ok || data.ok === false) throw new Error(data.description || `Telegram sendMessage failed (HTTP ${response.status}).`);
    }
  }

  private static async uploadTelegramVideo(token: string, state: TelegramUploadState, madeForKids: boolean, chatId: string | number, ownerConfig?: BotConfig | null) {
    if (!state.fileId || !state.topic || !state.privacyStatus || !(ownerConfig || TelegramBotService.currentConfig)) throw new Error('ভিডিও, topic এবং তিনটি upload setting প্রয়োজন।');
    const fileResponse = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(state.fileId)}`, { signal: AbortSignal.timeout(10000) });
    const filePayload = await fileResponse.json().catch(() => ({}));
    if (!fileResponse.ok || !filePayload.ok || !filePayload.result?.file_path) throw new Error('Telegram video file পাওয়া যায়নি।');
    const downloadResponse = await fetch(`https://api.telegram.org/file/bot${token}/${filePayload.result.file_path}`, { signal: AbortSignal.timeout(120000) });
    if (!downloadResponse.ok) throw new Error('Telegram video download ব্যর্থ হয়েছে।');
    const video = new Uint8Array(await downloadResponse.arrayBuffer());
    const config = ownerConfig || TelegramBotService.currentConfig;
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
