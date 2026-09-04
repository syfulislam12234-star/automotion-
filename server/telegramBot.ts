import { BotConfig } from '../src/types';
import { uploadYouTubeVideo } from './youtubeService';
import {
  getChannelStatsAndAudit,
  getChannelAnalytics,
  getChannelSeoContext,
  getRecentVideoHistory,
  getViralVideoPredictions,
  type ViralVideoPrediction,
  extractYouTubeCredentials,
  YouTubeAnalyticsError,
  formatCompactNumber,
  type YouTubeCredentials,
} from './youtubeAnalyticsService';
import { GlobalApiKeyStore } from './keyStore';
import { FailoverEngine } from './aiFailoverEngine';
import { StoreKnowledgeEngine } from './aiKnowledgeEngine';
import { ServerDatabase } from './db';

interface TelegramUploadState {
  step: 'file' | 'privacy' | 'kids';
  fileId?: string;
  topic?: string;
  privacyStatus?: 'public' | 'private' | 'unlisted';
}

/** Interactive menu context: which inline-keyboard flow a chat is currently in. */
interface CallbackQueryContext {
  flow: 'menu' | 'settings';
}

export class TelegramBotService {
  private static isRunning = false;
  private static currentConfig: BotConfig | null = null;
  private static webhookUrl = '';
  private static processedUpdates = 0;
  private static lastError: string | null = null;
  private static aiGenerator: ((prompt: string, model?: string, systemPromptSuffix?: string) => Promise<string | null>) | null = null;
  private static pollingTimer: ReturnType<typeof setTimeout> | null = null;
  private static pollingOffset = 0;
  private static pollingActive = false;
  private static environmentToken = '';
  private static uploadStates = new Map<string, TelegramUploadState>();
  private static callbackQueryStates = new Map<string, CallbackQueryContext>();
  /** Per-owner registry: ownerId → bot config holding that user's exact Telegram token. */
  private static userBotRegistry = new Map<string, BotConfig>();
  /** Owner ids whose per-user webhook is currently registered with Telegram. */
  private static userWebhooks = new Set<string>();

  private static ensureYouTubeLink(reply: string, userQuery: string): string {
    const videoIntentKeywords = ['video', 'tutorial', 'youtube', 'ভিডিও', 'টিউটোরিয়াল', 'লিংক', 'link'];
    if (!videoIntentKeywords.some((keyword) => userQuery.toLowerCase().includes(keyword.toLowerCase())) || /youtube\.com\//i.test(reply)) return reply;
    return `${reply}\n\n📺 **সরাসরি ইউটিউব টিউটোরিয়াল দেখতে পারেন:**\nhttps://www.youtube.com/results?search_query=${encodeURIComponent(userQuery)}`;
  }

  public static setAiGenerator(generator: (prompt: string, model?: string, systemPromptSuffix?: string) => Promise<string | null>) {
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

  /** Whether a per-user webhook URL is currently registered for this owner. */
  public static hasUserWebhook(ownerId: string): boolean {
    return TelegramBotService.userWebhooks.has(String(ownerId || '').trim());
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
    if (result.ok) TelegramBotService.userWebhooks.add(id);
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

  // ==========================================
  // INTERACTIVE SLASH COMMANDS & INLINE MENUS
  // ==========================================

  /** Main interactive menu keyboard (YouTube Upload / AI SEO / Status / Settings). */
  private static buildMainMenuKeyboard(): Record<string, any> {
    return {
      inline_keyboard: [
        [
          { text: '📤 YouTube Upload', callback_data: 'menu:upload' },
          { text: '🔥 AI SEO', callback_data: 'menu:seo' },
        ],
        [
          { text: '📊 Status', callback_data: 'menu:status' },
          { text: '⚙️ Settings', callback_data: 'menu:settings' },
        ],
      ],
    };
  }

  /** Settings menu keyboard (Auto-Upload ON/OFF toggle + back to main menu). */
  private static buildSettingsKeyboard(config: BotConfig | null): Record<string, any> {
    const autoUpload = config?.enableYtAutoUploadQueue !== false;
    return {
      inline_keyboard: [
        [{ text: `🔄 Auto-Upload: ${autoUpload ? 'ON ✅' : 'OFF ❌'}`, callback_data: 'settings:toggle_autoupload' }],
        [{ text: '⬅️ Back to Main Menu', callback_data: 'menu:home' }],
      ],
    };
  }

  private static buildWelcomeText(): string {
    return [
      '**🤖 AUTOMOTION AI — WELCOME**',
      '',
      'Your multi-platform AI automation studio. Pick an action below, or just send me any message to chat.',
      '',
      '📤 **YouTube Upload** — attach a video and it is published with viral AI SEO.',
      '🔥 **AI SEO** — high-CTR titles, descriptions, hashtags & ranking tags, generated automatically.',
      '📊 **Status** — live engine + YouTube connection report.',
      '⚙️ **Settings** — Auto-Upload ON/OFF and preferences.',
      '',
      'Quick commands: /upload • /youtube • /status • /settings • /help',
    ].join('\n');
  }

  /** Sends the welcome message together with the interactive inline main menu. */
  private static async sendMainMenu(token: string, chatId: string | number): Promise<void> {
    await TelegramBotService.sendMessage(token, chatId, TelegramBotService.buildWelcomeText(), TelegramBotService.buildMainMenuKeyboard());
  }

  /** Builds the user's connected YouTube OAuth token status report from their saved config. */
  private static getYoutubeStatusReport(config: BotConfig | null): string {
    const hasOAuth = Boolean(config?.youtubeClientId && config?.youtubeClientSecret && config?.youtubeRefreshToken);
    const lines = [
      '**📺 YouTube Connection Status**',
      '',
      `OAuth 2.0: **${hasOAuth ? '✅ Connected' : '❌ Not connected'}**`,
    ];
    if (hasOAuth) {
      lines.push(`Client ID: **${TelegramBotService.escapeHtml(String(config!.youtubeClientId).slice(0, 24))}…**`);
    }
    lines.push(
      `Channel ID: **${config?.youtubeChannelId ? TelegramBotService.escapeHtml(String(config.youtubeChannelId)) : 'default channel'}**`,
      `Default privacy: **${TelegramBotService.escapeHtml(String(config?.youtubeDefaultPrivacy || 'public'))}**`,
      `Auto SEO: **${config?.enableYtAutoSeo !== false ? 'ON ✅' : 'OFF ❌'}**`,
      `Auto-Upload queue: **${config?.enableYtAutoUploadQueue !== false ? 'ON ✅' : 'OFF ❌'}**`,
      '',
      hasOAuth
        ? 'Ready: send /upload to attach a video and publish with viral AI SEO.'
        : 'To connect: Web App → Config Panel → YouTube OAuth (Client ID, Secret, Refresh Token), then save.',
    );
    return lines.join('\n');
  }

  /**
   * Multi-tenant YouTube credential resolution: reads ONLY this user's saved OAuth
   * credentials (never another tenant's). Returns null when the user has not
   * connected a channel yet.
   */
  private static resolveTenantYouTubeCredentials(config: BotConfig | null): YouTubeCredentials | string | null {
    const extracted = extractYouTubeCredentials(config as unknown as Record<string, unknown> | null);
    if (!extracted) return null;
    // Client credentials missing → pass the bare refresh token so the analytics
    // service can fall back to the deployment's OAuth client. The refresh token
    // itself remains the isolation boundary (access tokens cache per refresh token).
    if (extracted.clientId && extracted.clientSecret) return extracted;
    return extracted.refreshToken;
  }

    /** Inline quick actions attached to the /yt_check analytics report. */
  private static buildYtCheckKeyboard(): Record<string, any> {
    return {
      inline_keyboard: [
        [
          { text: '🔄 Refresh', callback_data: 'yt:analytics' },
          { text: '🔥 AI SEO Boost', callback_data: 'yt:seo' },
        ],
        [
          { text: '📤 Upload Video', callback_data: 'menu:upload' },
          { text: '🔮 Viral Ideas', callback_data: 'yt:viral' },
          { text: '⬅️ Main Menu', callback_data: 'menu:home' },
        ],
      ],
    };
  }

  /** Inline quick actions attached to the /yt_seo AI recommendations. */
  private static buildSeoActionsKeyboard(): Record<string, any> {
    return {
      inline_keyboard: [
        [
          { text: '📤 Upload with this SEO', callback_data: 'menu:upload' },
          { text: '📊 View Analytics', callback_data: 'yt:analytics' },
        ],
        [
          { text: '🔥 Regenerate SEO', callback_data: 'yt:seo' },
          { text: '⬅️ Main Menu', callback_data: 'menu:home' },
        ],
      ],
    };
  }

  /** Not-connected guide shown instead of analytics when the tenant has no OAuth tokens. */
  private static buildYtConnectGuide(): string {
    return [
      '**📺 YouTube Not Connected Yet**',
      '',
      'To unlock live analytics and AI SEO I need your YouTube OAuth credentials:',
      '',
      '1️⃣ Open https://console.cloud.google.com → enable **YouTube Data API v3**',
      '2️⃣ OAuth consent screen → External → add your Google account as a Test user',
      '3️⃣ Credentials → **OAuth Client ID** → Web application → copy ID + Secret',
      '4️⃣ Generate a **Refresh Token** (the Google OAuth 2.0 Playground works great)',
      '5️⃣ Web App → Config Panel → YouTube Studio tab → paste → Save',
      '',
      'Then send /yt_check again for your live channel report! ✨',
    ].join('\n');
  }

  /** Emojis for a single traffic source id (falls back to a generic bar). */
  private static trafficSourceEmoji(source: string): string {
    const emojiMap: Record<string, string> = {
      YT_SEARCH: '🔎', SUBSCRIBER: '👥', RELATED_VIDEO: '🔗', YT_CHANNEL: '📺',
      NOTIFICATION: '🔔', PLAYLIST: '🎧', EXT_URL: '🌐', SHORTS: '⚡',
      ADVERTISING: '💰', YT_OTHER_PAGE: '📄', NO_LINK_OTHER: '🔗', HASHTAGS: '#️⃣',
    };
    return emojiMap[source] || '📈';
  }


  /** Formats the full /yt_check channel analytics + health report. */
  private static formatYtCheckReport(stats: import('./youtubeAnalyticsService').ChannelStatsAndAudit, analytics: import('./youtubeAnalyticsService').ChannelAnalytics): string {
    const lines: string[] = [
      '**📊 YouTube Channel Analytics & Health**',
      '',
      `📺 **${TelegramBotService.escapeHtml(stats.title)}**${stats.customUrl ? ` (${TelegramBotService.escapeHtml(stats.customUrl)})` : ''}`,
      '',
      '**👀 Performance**',
      `• Total Views: **${formatCompactNumber(stats.totalViews)}**`,
      `• Impressions (window): **${analytics.impressions === null ? 'N/A' : formatCompactNumber(analytics.impressions)}**`,
      `• Impression CTR: **${analytics.impressionCtr === null ? 'N/A' : `${analytics.impressionCtr.toFixed(2)}%`}**`,
      `• Watch Time: **${formatCompactNumber(Math.round(analytics.watchTimeMinutes))} min** (~${(analytics.watchTimeMinutes / 60).toFixed(1)} hrs)`,
      `• Avg. View Duration: **${Math.round(analytics.averageViewDurationSeconds)}s**`,
      `• Subscribers: **${stats.subscriberCountHidden ? 'hidden' : formatCompactNumber(stats.subscriberCount || 0)}**`,
      `• Videos: **${formatCompactNumber(stats.videoCount)}**`,
      '',
      '**🩺 Channel Health**',
      `• Status: ${stats.audit.healthEmoji} **${stats.audit.health === 'clean' ? 'Clean — no restriction signals' : stats.audit.health === 'warning' ? 'Warning — check audit notes' : 'Restricted'}**`,
      `• Community guideline strikes: **${stats.audit.communityGuidelineStrikes}**`,
      `• Copyright status: **${TelegramBotService.escapeHtml(stats.audit.copyrightStatus)}**`,
    ];
    if (stats.audit.auditNotes.length) {
      lines.push(`• Notes: ${stats.audit.auditNotes.map((note) => TelegramBotService.escapeHtml(note)).join(' · ')}`);
    }
    if (analytics.trafficSources.length) {
      lines.push('', '**🚦 Top Traffic Sources**');
      for (const source of analytics.trafficSources.slice(0, 5)) {
        lines.push(`${TelegramBotService.trafficSourceEmoji(source.source)} ${TelegramBotService.escapeHtml(source.label)}: **${formatCompactNumber(source.views)}** views`);
      }
    }
    lines.push('', `📅 Window: ${analytics.startDate} → ${analytics.endDate}`);
    if (analytics.note) lines.push(`ℹ️ ${TelegramBotService.escapeHtml(analytics.note)}`);
    lines.push('', '💡 Tip: run /yt_seo to let the AI optimize your channel metadata.');
    return lines.join('\n');
  }

  /** /yt_check (alias /analytics) — live channel stats, impressions, CTR and security audit. */
  /** Phase 4: resolve the owning user id for a bot token (in-memory registry first, then database). */
  private static resolveOwnerIdByToken(token: string): string | null {
    const cleanToken = String(token || '').trim();
    if (!cleanToken) return null;
    for (const [ownerId, config] of TelegramBotService.userBotRegistry.entries()) {
      if (String(config?.telegramBotToken || '').trim() === cleanToken) return ownerId;
    }
    try {
      const match = ServerDatabase.getAllBotConfigs().find((entry) => String(entry.config?.telegramBotToken || '').trim() === cleanToken);
      return match?.targetId || null;
    } catch {
      return null;
    }
  }

  /**
   * Phase 4 credit gate: charges the admin-configured credit cost for a premium AI
   * feature against the bot owner's balance. Returns null when the caller may proceed,
   * or a ready-to-send refusal message when the owner is out of credits. Enforcement
   * failures can never break the feature (fail-open by design).
   */
  private static async chargeFeatureCredits(token: string, chatId: string | number, feature: 'ytSeo' | 'ytViral' | 'ytCheck', featureLabel: string): Promise<string | null> {
    try {
      const ownerId = TelegramBotService.resolveOwnerIdByToken(token);
      if (!ownerId) return null; // cannot attribute the bot to a user → never block
      const gate = ServerDatabase.deductCredits(ownerId, ServerDatabase.getFeatureCreditCost(feature), featureLabel);
      if (gate.success) return null;
      await TelegramBotService.sendMessage(token, chatId, gate.message);
      return gate.message;
    } catch {
      return null;
    }
  }

  /**
   * Phase 5 platform gate: returns true (and sends a notice) when the feature should be
   * blocked — either because maintenance mode is active or the admin disabled the feature
   * toggle. Admins always bypass maintenance mode. When it returns true the caller must
   * return immediately.
   */
  private static async platformFeatureGuard(token: string, chatId: string | number, feature: 'ytCheck' | 'ytSeo' | 'ytViral' | 'autoUpload', featureLabel: string): Promise<boolean> {
    try {
      const isAdmin = ServerDatabase.isUserAdmin((() => {
        try {
          const ownerId = TelegramBotService.resolveOwnerIdByToken(token);
          return ownerId ? ServerDatabase.getUserByIdOrEmail(ownerId) : null;
        } catch {
          return null;
        }
      })());
      if (ServerDatabase.isMaintenanceActive() && !isAdmin) {
        await TelegramBotService.sendMessage(token, chatId, ServerDatabase.getMaintenanceMessage());
        return true;
      }
      if (!ServerDatabase.isFeatureEnabled(feature)) {
        await TelegramBotService.sendMessage(token, chatId, `🚫 "${featureLabel}" is currently disabled by the platform admin. Please try again later.`);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private static async handleYtCheckCommand(token: string, chatId: string | number, effectiveConfig: BotConfig | null): Promise<void> {
    const credentials = TelegramBotService.resolveTenantYouTubeCredentials(effectiveConfig);
    if (!credentials) {
      await TelegramBotService.sendMessage(token, chatId, TelegramBotService.buildYtConnectGuide(), TelegramBotService.buildMainMenuKeyboard());
      return;
    }
    const ytCheckCreditBlock = await TelegramBotService.chargeFeatureCredits(token, chatId, 'ytCheck', 'Channel Analytics (/yt_check)');
    if (ytCheckCreditBlock) return;
    if (await TelegramBotService.platformFeatureGuard(token, chatId, 'ytCheck', 'Channel Analytics')) return;
    await TelegramBotService.sendChatAction(token, chatId);
    await TelegramBotService.sendMessage(token, chatId, '📊 লাইভ YouTube অ্যানালিটিক্স আনা হচ্ছে... এক মুহূর্ত!');
    try {
      const [stats, analytics] = await Promise.all([
        getChannelStatsAndAudit(credentials),
        getChannelAnalytics(credentials),
      ]);
      await TelegramBotService.sendMessage(token, chatId, TelegramBotService.formatYtCheckReport(stats, analytics), TelegramBotService.buildYtCheckKeyboard());
    } catch (error: any) {
      const authorizationIssue = error instanceof YouTubeAnalyticsError && error.authorizationIssue;
      const message = authorizationIssue
        ? '🔐 YouTube OAuth token টি expired বা invalid। অনুগ্রহ করে Web App → Config Panel → YouTube Studio-তে একটি নতুন Refresh Token যোগ করুন, তারপর আবার /yt_check পাঠান।'
        : `⚠️ YouTube analytics আনতে ব্যর্থ: ${TelegramBotService.escapeHtml(String(error?.message || error))}`;
      await TelegramBotService.sendMessage(token, chatId, message, TelegramBotService.buildMainMenuKeyboard());
    }
  }

  /** Tolerant JSON extraction from an AI response (strips fences / prose). */
  private static extractJsonObject(raw: string): Record<string, any> | null {
    if (!raw) return null;
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = (fenced ? fenced[1] : raw).trim();
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1));
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  /** /yt_seo — AI channel SEO audit: keywords, viral bio, tags and structural recommendations. */
  private static async handleYtSeoCommand(token: string, chatId: string | number, effectiveConfig: BotConfig | null): Promise<void> {
    const credentials = TelegramBotService.resolveTenantYouTubeCredentials(effectiveConfig);
    if (!credentials) {
      await TelegramBotService.sendMessage(token, chatId, TelegramBotService.buildYtConnectGuide(), TelegramBotService.buildMainMenuKeyboard());
      return;
    }
    const ytSeoCreditBlock = await TelegramBotService.chargeFeatureCredits(token, chatId, 'ytSeo', 'AI Channel SEO (/yt_seo)');
    if (ytSeoCreditBlock) return;
    if (await TelegramBotService.platformFeatureGuard(token, chatId, 'ytSeo', 'AI Channel SEO')) return;
    if (!TelegramBotService.aiGenerator) {
      await TelegramBotService.sendMessage(token, chatId, '⚠️ AI engine is not connected yet. Add an AI API key (Web App → 1-Click API Portal) and try /yt_seo again.');
      return;
    }
    await TelegramBotService.sendChatAction(token, chatId);
    await TelegramBotService.sendMessage(token, chatId, '🔥 AI SEO অডিট চলছে... চ্যানেল স্নিপেট ও সর্বশেষ ভিডিও বিশ্লেষণ করা হচ্ছে!');
    try {
      const context = await getChannelSeoContext(credentials);
      const latest = context.latestVideos.slice(0, 5).map((video) => ({
        title: video.title, publishedAt: video.publishedAt, tags: video.tags.slice(0, 10), views: video.viewCount,
      }));
      const seoPrompt = [
        'You are an elite YouTube growth strategist. Audit this channel and return ONLY valid JSON (no markdown fences) with this exact shape:',
        '{"keywords":["10 high-converting channel keywords"],"bio":"viral channel description/bio (2-4 short paragraphs, hooks + value + CTA, include hashtags)","tags":["15 ranking tags mixing broad and long-tail"],"recommendations":["5 structural SEO recommendations (playlists, titles formula, upload cadence, shorts strategy, community tab)"]}',
        '',
        'CHANNEL CONTEXT:',
        `Name: ${context.title}`,
        `Handle: ${context.customUrl || 'n/a'}`,
        `Current description: ${(context.description || 'empty').slice(0, 600)}`,
        `Current channel keywords: ${context.keywords.join(', ') || 'none set'}`,
        `Country: ${context.country || 'n/a'} | Created: ${context.publishedAt}`,
        `Stats: ${context.subscriberCount ?? '?'} subscribers, ${context.totalViews} total views, ${context.videoCount} videos`,
        `Latest videos: ${JSON.stringify(latest)}`,
      ].join('\n');
      const aiText = await TelegramBotService.aiGenerator(seoPrompt, effectiveConfig?.modelName || undefined);
      if (!aiText || !aiText.trim()) throw new Error('AI engine returned an empty SEO plan.');
      const parsed = TelegramBotService.extractJsonObject(aiText);
      const lines: string[] = [
        '**🔥 AI Channel SEO Recommendations**',
        '',
        `📺 **${TelegramBotService.escapeHtml(context.title)}** — ${formatCompactNumber(context.subscriberCount || 0)} subs · ${formatCompactNumber(context.videoCount)} videos`,
      ];
      if (parsed) {
        const keywords: string[] = Array.isArray(parsed.keywords) ? parsed.keywords.map(String).filter(Boolean) : [];
        const tags: string[] = Array.isArray(parsed.tags) ? parsed.tags.map(String).filter(Boolean) : [];
        const recommendations: string[] = Array.isArray(parsed.recommendations) ? parsed.recommendations.map(String).filter(Boolean) : [];
        if (keywords.length) {
          lines.push('', '**🎯 High-Converting Keywords**', keywords.map((keyword) => `• ${TelegramBotService.escapeHtml(keyword)}`).join('\n'));
        }
        if (parsed.bio) {
          lines.push('', '**✍️ Viral Bio / Description**', TelegramBotService.escapeHtml(String(parsed.bio).slice(0, 1200)));
        }
        if (tags.length) {
          lines.push('', '**🏷️ Tag List (copy-paste)**', `\`${tags.map((tag) => String(tag).replace(/[`\\]/g, '')).join('`, `')}\``);
        }
        if (recommendations.length) {
          lines.push('', '**🏗️ Structural SEO Recommendations**', recommendations.map((rec, index) => `${index + 1}. ${TelegramBotService.escapeHtml(rec)}`).join('\n'));
        }
      } else {
        // AI answered in prose — surface it verbatim so the user still gets value.
        lines.push('', TelegramBotService.escapeHtml(aiText.slice(0, 2500)));
      }
      lines.push('', '⚡ Quick actions below — upload with this SEO or view your analytics.');
      await TelegramBotService.sendMessage(token, chatId, lines.join('\n'), TelegramBotService.buildSeoActionsKeyboard());
    } catch (error: any) {
      const authorizationIssue = error instanceof YouTubeAnalyticsError && error.authorizationIssue;
      const message = authorizationIssue
        ? '🔐 YouTube OAuth token টি expired বা invalid। Config Panel → YouTube Studio-তে নতুন Refresh Token যোগ করে আবার চেষ্টা করুন।'
        : `⚠️ AI SEO তৈরি করতে ব্যর্থ: ${TelegramBotService.escapeHtml(String(error?.message || error))}`;
      await TelegramBotService.sendMessage(token, chatId, message, TelegramBotService.buildMainMenuKeyboard());
    }
  }

  /** Inline keyboard for the /yt_viral report. */
  private static buildYtViralKeyboard(): Record<string, any> {
    return {
      inline_keyboard: [
        [
          { text: '📤 Use for New Upload', callback_data: 'menu:upload' },
          { text: '📊 Video History', callback_data: 'yt:analytics' },
        ],
        [
          { text: '🔁 Regenerate Ideas', callback_data: 'yt:viral' },
          { text: '🔥 AI SEO Boost', callback_data: 'yt:seo' },
        ],
        [
          { text: '⬅️ Main Menu', callback_data: 'menu:home' },
        ],
      ],
    };
  }

  /** Formats the AI viral video prediction report for /yt_viral. */
  private static formatYtViralReport(
    channelName: string,
    predictions: ViralVideoPrediction[],
    videoCount: number,
  ): string {
    const lines: string[] = [
      '🔮 **AI Viral Video Predictions**',
      '',
      `📺 **${TelegramBotService.escapeHtml(channelName)}** — based on ${videoCount} recent videos`,
      '',
    ];
    predictions.forEach((prediction, index) => {
      lines.push(
        `**🔥 Concept ${index + 1}: ${TelegramBotService.escapeHtml(prediction.title)}**`,
        `🎣 **Hook:** ${TelegramBotService.escapeHtml(prediction.hook)}`,
        `⏱ **Length:** ${TelegramBotService.escapeHtml(prediction.recommendedLength)} (${TelegramBotService.escapeHtml(prediction.format)})`,
        `👥 **Audience:** ${TelegramBotService.escapeHtml(prediction.targetAudienceInterest)}`,
        `📅 **Timing:** ${TelegramBotService.escapeHtml(prediction.uploadTiming)}`,
        `💡 **Why:** ${TelegramBotService.escapeHtml(prediction.whyItWillPerform)}`,
        '',
      );
    });
    lines.push('⚡ Quick actions below — use a concept for upload, view analytics, or regenerate.');
    return lines.join('\n');
  }

  /** /yt_viral — AI-powered viral video concept predictions for the channel. */
  private static async handleYtViralCommand(token: string, chatId: string | number, effectiveConfig: BotConfig | null): Promise<void> {
    const credentials = TelegramBotService.resolveTenantYouTubeCredentials(effectiveConfig);
    if (!credentials) {
      await TelegramBotService.sendMessage(token, chatId, TelegramBotService.buildYtConnectGuide(), TelegramBotService.buildMainMenuKeyboard());
      return;
    }
    if (!TelegramBotService.aiGenerator) {
      await TelegramBotService.sendMessage(token, chatId, '⚠️ AI engine is not connected yet. Add an AI API key (Web App → 1-Click API Portal) and try /yt_viral again.');
      return;
    }
    const ytViralCreditBlock = await TelegramBotService.chargeFeatureCredits(token, chatId, 'ytViral', 'AI Viral Predictor (/yt_viral)');
    if (ytViralCreditBlock) return;
    if (await TelegramBotService.platformFeatureGuard(token, chatId, 'ytViral', 'AI Viral Predictor')) return;
    await TelegramBotService.sendChatAction(token, chatId);
    await TelegramBotService.sendMessage(token, chatId, '🔮 AI ভিরাল ভিডিও ধারণা বিশ্লেষণ করা হচ্ছে... এক মুহূর্ত!');
    try {
      const [stats, videoHistory] = await Promise.all([
        getChannelStatsAndAudit(credentials),
        getRecentVideoHistory(credentials, 15),
      ]);
      const predictions = await getViralVideoPredictions(
        credentials,
        TelegramBotService.aiGenerator,
        effectiveConfig?.modelName || undefined,
      );
      if (!predictions || !predictions.length) {
        await TelegramBotService.sendMessage(
          token,
          chatId,
          '⚠️ AI কোনো ভিরাল ধারণা তৈরি করতে পারল না। চ্যানেলটি যথেষ্ট ডেটা নিয়ে গঠন করুন, তারপর আবার চেষ্টা করুন।',
          TelegramBotService.buildMainMenuKeyboard(),
        );
        return;
      }
      await TelegramBotService.sendMessage(
        token,
        chatId,
        TelegramBotService.formatYtViralReport(stats.title, predictions, videoHistory.length),
        TelegramBotService.buildYtViralKeyboard(),
      );
    } catch (error: any) {
      const authorizationIssue = error instanceof YouTubeAnalyticsError && error.authorizationIssue;
      const message = authorizationIssue
        ? '🔐 YouTube OAuth token টি expired বা invalid। Config Panel → YouTube Studio-তে নতুন Refresh Token যোগ করে আবার চেষ্টা করুন।'
        : `⚠️ ভিরাল প্রকল্পন তৈরিতে ব্যর্য: ${TelegramBotService.escapeHtml(String(error?.message || error))}`;
      await TelegramBotService.sendMessage(token, chatId, message, TelegramBotService.buildMainMenuKeyboard());
    }
  }

  private static async answerCallbackQuery(token: string, callbackQueryId: string, text?: string): Promise<void> {
    try {
      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQueryId, show_alert: false, ...(text ? { text } : {}) }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (error: any) {
      console.warn('[TelegramBotService] answerCallbackQuery failed:', error?.message || error);
    }
  }

  /** Routes inline-keyboard callback queries for the interactive menus. */
  private static async handleCallbackQuery(
    callbackQuery: any,
    token: string,
    chatId: string | number,
    effectiveConfig: BotConfig | null,
  ): Promise<void> {
    const data = String(callbackQuery?.data || '').trim();
    await TelegramBotService.answerCallbackQuery(token, String(callbackQuery?.id || ''));
    switch (data) {
      case 'menu:upload':
        TelegramBotService.uploadStates.set(String(chatId), { step: 'file' });
        await TelegramBotService.sendMessage(
          token,
          chatId,
          '📤 **Upload a Video**\n\nPlease attach your video file now (send it as a video or document). Put your topic in the message caption if you like.\n\nNext: privacy → kids settings → publish with viral AI SEO.',
          TelegramBotService.buildMainMenuKeyboard(),
        );
        return;
      case 'menu:seo':
        await TelegramBotService.sendMessage(
          token,
          chatId,
          '🔥 **AI SEO**\n\nEvery upload automatically gets a high-CTR viral title, an engagement-focused description, hashtags and ranking search tags — generated by the multi-model AI cascade. Just start with /upload.',
          TelegramBotService.buildMainMenuKeyboard(),
        );
        return;
      case 'menu:status':
        await TelegramBotService.sendMessage(token, chatId, TelegramBotService.getYoutubeStatusReport(effectiveConfig), TelegramBotService.buildMainMenuKeyboard());
        return;
      case 'menu:settings':
        TelegramBotService.callbackQueryStates.set(String(chatId), { flow: 'settings' });
        await TelegramBotService.sendMessage(token, chatId, '⚙️ **Settings**\n\nTap the toggle to change it:', TelegramBotService.buildSettingsKeyboard(effectiveConfig));
        return;
      case 'yt:analytics':
        await TelegramBotService.handleYtCheckCommand(token, chatId, effectiveConfig);
        return;
            case 'yt:seo':
        await TelegramBotService.handleYtSeoCommand(token, chatId, effectiveConfig);
        return;
      case 'yt:viral':
        await TelegramBotService.handleYtViralCommand(token, chatId, effectiveConfig);
        return;
      case 'settings:toggle_autoupload': {
        if (effectiveConfig && typeof effectiveConfig === 'object') {
          effectiveConfig.enableYtAutoUploadQueue = !(effectiveConfig.enableYtAutoUploadQueue !== false);
          TelegramBotService.callbackQueryStates.set(String(chatId), { flow: 'settings' });
          await TelegramBotService.sendMessage(
            token,
            chatId,
            `⚙️ Auto-Upload is now **${effectiveConfig.enableYtAutoUploadQueue ? 'ON ✅' : 'OFF ❌'}**\n\n(Runtime preference for this session — save the Config Panel to persist it.)`,
            TelegramBotService.buildSettingsKeyboard(effectiveConfig),
          );
        } else {
          await TelegramBotService.sendMessage(token, chatId, 'Settings are unavailable: no bot configuration found.');
        }
        return;
      }
      case 'menu:home':
        TelegramBotService.callbackQueryStates.delete(String(chatId));
        await TelegramBotService.sendMainMenu(token, chatId);
        return;
      default:
        await TelegramBotService.sendMainMenu(token, chatId);
        return;
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
      const callbackQuery = update?.callback_query || null;
      const message = update?.message || update?.edited_message || update?.channel_post || callbackQuery?.message || null;
      const chatId = message?.chat?.id;
      const text = typeof message?.text === 'string' ? message.text.trim() : '';
      if (!chatId) return { ok: true, ignored: true };

      TelegramBotService.processedUpdates++;

      // Per-user token resolution: per-owner webhook routes embed the owner id, so the
      // update is dispatched with the exact bot token that received it. Resolution order:
      // (1) in-memory userBotRegistry, (2) direct ServerDatabase.getBotConfig(ownerId)
      // fallback lookup (which also re-hydrates the registry on demand). STRICT
      // ISOLATION: an owner route NEVER falls back to the global config/env token — if
      // the owner's token cannot be resolved, dispatch is skipped with an explicit warning.
      let ownerConfig = ownerId ? TelegramBotService.userBotRegistry.get(String(ownerId)) || null : null;
      let ownerToken = String(ownerConfig?.telegramBotToken || '').trim().replace(/^['"]+|['"]+$/g, '');
      if (ownerId && !ownerToken) {
        try {
          const dbEntry = ServerDatabase.getBotConfig(String(ownerId));
          const dbConfig = dbEntry?.config || null;
          if (dbConfig?.telegramBotToken) {
            TelegramBotService.registerUserBot(String(ownerId), dbConfig);
            ownerConfig = dbConfig;
            ownerToken = String(dbConfig.telegramBotToken || '').trim().replace(/^['"]+|['"]+$/g, '');
            console.log(`🔗 [Telegram Dispatch] Owner "${ownerId}" token hydrated from the persistent database on-demand.`);
          }
        } catch (dbError: any) {
          console.warn(`[Telegram Dispatch] Database fallback lookup failed for owner "${ownerId}":`, dbError?.message || dbError);
        }
      }
      if (ownerId && !ownerToken) {
        TelegramBotService.lastError = `No Telegram bot token registered for owner "${ownerId}".`;
        console.warn(`⚠️ [Telegram Dispatch] Owner ${ownerId} token missing — update skipped without touching the global env token. Other active users are unaffected.`);
        return { ok: true, skipped: true, reason: 'owner-token-missing' };
      }
      const token = ownerToken || TelegramBotService.getBotToken();
      const effectiveConfig = ownerConfig || TelegramBotService.currentConfig;
      if (!token) {
        TelegramBotService.lastError = 'Telegram bot token is not configured.';
        console.warn('[TelegramBotService] Telegram token missing; update skipped safely.');
        return { ok: true, skipped: true };
      }
      // Interactive inline-keyboard callback queries (main menu / settings buttons).
      if (callbackQuery) {
        await TelegramBotService.handleCallbackQuery(callbackQuery, token, chatId, effectiveConfig || null);
        TelegramBotService.lastError = null;
        return { ok: true };
      }

      // Command extraction: prefer message.text, then fall back to Telegram command
      // ENTITIES (bot_command) so "/cmd@BotName" style commands always route, even
      // when the command arrives through caption_entities instead of plain text.
      let commandSource = text;
      if (!commandSource) {
        const caption = typeof message?.caption === 'string' ? message.caption.trim() : '';
        const entityList: any[] = Array.isArray(message?.entities) ? message.entities : Array.isArray(message?.caption_entities) ? message.caption_entities : [];
        const commandEntity = entityList.find((entity) => entity?.type === 'bot_command' && Number(entity?.offset) === 0);
        if (commandEntity && caption.startsWith('/')) {
          commandSource = caption.slice(0, Number(commandEntity.length) || caption.length);
        }
      }
      const normalizedText = commandSource.toLowerCase();
      const command = normalizedText.split(/\s+/)[0].split('@')[0];
      const restrictedCommands = new Set(['/admin', '/stats', '/restart', '/broadcast', '/clear_memory', '/whitelist', '/database', '/config', '/keys', '/env', '/status_admin', '/telemetry', '/users', '/setkey', '/setenv']);
      const adminChatId = String(effectiveConfig?.telegramAdminChatId || effectiveConfig?.adminTelegramId || '').trim();
      if (restrictedCommands.has(command) && String(chatId) !== adminChatId) {
        await TelegramBotService.sendMessage(token, chatId, 'Access Denied: You do not have authorization for administrative operations.');
        return { ok: true, denied: true };
      }
      // /start — welcome message with the interactive inline main menu.
      if (command === '/start') {
        await TelegramBotService.sendMainMenu(token, chatId);
        return { ok: true };
      }
      const asksForHelp = ['help', 'assistance', 'what can you do', 'setup', 'api setup', 'guide'].includes(normalizedText);
      if (command === '/help' || command === '/setup' || asksForHelp) {
        await TelegramBotService.sendMessage(token, chatId,
          '**🤖 AUTOMOTION AI — MASTER GUIDE**\n\n' +
          '**📜 COMMANDS**\n' +
          '/start — Activate the AI assistant\n' +
          '/help or /setup — Show this master guide\n' +
          '/status — Live AI engine, provider pool and key status\n' +
          '/upload or /yt_upload — Upload a video to YouTube with Viral AI SEO\n' +
          '/yt_check or /analytics — Live channel views, impressions, CTR, watch time & health audit\n' +
          '/yt_seo — AI-generated channel keywords, viral bio, tags & SEO recommendations\n' +
          '/yt_viral — AI-powered viral video concept predictions for your channel\n' +
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
      // /youtube — report the user's connected YouTube OAuth token status (DB-backed config).
      if (command === '/youtube') {
        await TelegramBotService.sendMessage(token, chatId, TelegramBotService.getYoutubeStatusReport(effectiveConfig), TelegramBotService.buildMainMenuKeyboard());
        return { ok: true };
      }
      // /yt_check (alias /analytics) — live channel stats, impressions, CTR and security audit.
      if (command === '/yt_check' || command === '/analytics') {
        await TelegramBotService.handleYtCheckCommand(token, chatId, effectiveConfig || null);
        TelegramBotService.lastError = null;
        return { ok: true };
      }
      // /yt_seo — AI channel SEO audit through the failover AI cascade.
      if (command === '/yt_seo') {
        await TelegramBotService.handleYtSeoCommand(token, chatId, effectiveConfig || null);
        TelegramBotService.lastError = null;
        return { ok: true };
      }
      // /yt_viral — AI-powered viral video concept predictions for the channel.
      if (command === '/yt_viral') {
        await TelegramBotService.handleYtViralCommand(token, chatId, effectiveConfig || null);
        TelegramBotService.lastError = null;
        return { ok: true };
      }
      // /settings — interactive configuration options (Auto-Upload ON/OFF).
      if (command === '/settings') {
        TelegramBotService.callbackQueryStates.set(String(chatId), { flow: 'settings' });
        await TelegramBotService.sendMessage(token, chatId, '⚙️ **Settings**\n\nTap the toggle to change it:', TelegramBotService.buildSettingsKeyboard(effectiveConfig));
        return { ok: true };
      }
      // /upload — ask the user to attach their video file (topic optional as arguments).
      if (command === '/upload') {
        TelegramBotService.uploadStates.set(String(chatId), { step: 'file', topic: commandSource.slice('/upload'.length).trim() || undefined });
        await TelegramBotService.sendMessage(
          token,
          chatId,
          '📤 **Upload a Video**\n\nPlease attach your video file now (send it as a video or document). Put your topic in the message caption if you like.\n\nNext: privacy → kids settings → publish with viral AI SEO.',
          TelegramBotService.buildMainMenuKeyboard(),
        );
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

      // 🧠 Per-owner knowledge isolation: this user's bot replies quote ONLY the AI Store
      // Trainer context trained by THIS owner (workspaceId = ownerId) — never another
      // user's catalog, policies or FAQ. Untrained owners simply get no knowledge block.
      const ownerKnowledgeBlock = ownerId ? StoreKnowledgeEngine.buildSystemPromptBlock(String(ownerId)) : null;

      let reply: string | null = null;
      try {
        reply = await Promise.race([
          TelegramBotService.aiGenerator(text, effectiveConfig?.modelName, ownerKnowledgeBlock || undefined),
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
          ...(ownerId ? { knowledgeWorkspaceId: String(ownerId) } : {}),
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
      if (ownerId) {
        console.error(`❌ [TelegramBotService] Owner "${ownerId}" bot failed (token invalid, revoked, or Telegram API error): ${TelegramBotService.lastError}. Other active users are unaffected.`);
      } else {
        console.error('❌ [TelegramBotService] Update handling failed:', error?.message || error);
      }
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

  private static async sendMessage(token: string, chatId: string | number, text: string, replyMarkup?: Record<string, any>): Promise<void> {
    const formattedText = TelegramBotService.formatTelegramHtml(text);
    for (let index = 0; index < formattedText.length; index += 3900) {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: formattedText.slice(index, index + 3900),
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          // Attach the inline keyboard to the first chunk so long replies keep a single menu.
          ...(index === 0 && replyMarkup ? { reply_markup: replyMarkup } : {}),
        }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        // Detailed Telegram API error diagnostics — HTTP 400/401/403 ("chat not found",
        // "invalid token", "bot blocked by user", ...) are logged with the token prefix
        // so the exact failing bot instance is identifiable without leaking the secret.
        const description = String(data?.description || `HTTP ${response.status}`);
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          console.error(`❌ [Telegram API Error] Failed to reply for bot token ${token.slice(0, 10)}...: ${description}`);
        }
        if (response.status === 401) {
          console.error(`❌ [TelegramBotService] sendMessage → HTTP 401 Unauthorized: bot token …${token.slice(-6)} is invalid or revoked. Regenerate it via @BotFather and save it in the Config Panel.`);
        }
        throw new Error(description);
      }
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
        const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?timeout=25&allowed_updates=${encodeURIComponent(JSON.stringify(['message', 'edited_message', 'channel_post', 'callback_query']))}&offset=${TelegramBotService.pollingOffset}`, {
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
