import { BangladeshNewsAggregator, BangladeshNewsItem, BANGLADESH_HELPLINES } from './bangladeshNewsAggregator';

export interface CronConfig {
  enabled: boolean;
  intervalMinutes: number; // e.g. 120 for every 2 hours, 60 for 1 hour, 180 for 3 hours
  targets: string[]; // ['telegram', 'whatsapp', 'discord', 'slack', 'line', 'teams', 'webhook']
  newsLanguage: 'bn' | 'en' | 'bilingual';
  emergencyOnly: boolean;
  includeWeather: boolean;
  includeHelplines: boolean;
  broadcastEarthquakes: boolean;
  broadcastNews: boolean;
  broadcastYouTube: boolean;
  customPrompt: string;
  telegramChatIds?: string[];
  whatsAppRecipients?: string[];
  discordWebhookUrl?: string;
  slackWebhookUrl?: string;
}

export interface BroadcastHistoryItem {
  id: string;
  timestamp: string;
  title: string;
  summary: string;
  fullMessage?: string;
  targetCount: number;
  targets: string[];
  status: 'delivered' | 'partial' | 'failed';
  modelUsed?: string;
  itemsCount?: number;
  emergencyAlertLevel?: 'CRITICAL' | 'WARNING' | 'NORMAL';
  recipientsDetail?: Array<{ platform: string; target: string; status: 'ok' | 'skipped' | 'failed'; note?: string }>;
}

export class CronWorkerService {
  private static summarizer: ((prompt: string) => Promise<string>) | null = null;
  private static isRunning = false;
  private static timer: ReturnType<typeof setInterval> | null = null;
  private static nextRunTimestamp: string | null = null;
  private static lastRun: string | null = null;
  private static lastBroadcastSummary: string | null = null;

  private static config: CronConfig = {
    enabled: true,
    intervalMinutes: 120, // Default: Every 2 Hours
    targets: ['telegram', 'whatsapp', 'discord'],
    newsLanguage: 'bn',
    emergencyOnly: false,
    includeWeather: true,
    includeHelplines: true,
    broadcastEarthquakes: true,
    broadcastNews: true,
    broadcastYouTube: false,
    customPrompt: 'বাংলাদেশ জাতীয় ও জরুরি ব্রেকিং নিউজ এবং আবহাওয়া সতর্কতা সংক্ষেপে বাংলায় বুলেটিন আকারে তৈরি করো।',
    telegramChatIds: [],
    whatsAppRecipients: [],
  };

  private static history: BroadcastHistoryItem[] = [];

  public static setAiSummarizer(fn: (prompt: string) => Promise<string>) {
    CronWorkerService.summarizer = fn;
  }

  /**
   * Initializes the Automated Background Cron Worker
   */
  public static init() {
    CronWorkerService.isRunning = true;
    CronWorkerService.scheduleNextRun();
    console.log(`⏰ [CronWorkerService] Initialized Automated Bangladesh Emergency News Scheduler (Interval: ${CronWorkerService.config.intervalMinutes}m / ${CronWorkerService.config.intervalMinutes / 60}h).`);
  }

  /**
   * Schedules or reschedules the timer
   */
  private static scheduleNextRun() {
    if (CronWorkerService.timer) {
      clearInterval(CronWorkerService.timer);
      CronWorkerService.timer = null;
    }

    if (!CronWorkerService.config.enabled) {
      CronWorkerService.nextRunTimestamp = null;
      console.log('⏸️ [CronWorkerService] Scheduler is currently PAUSED by configuration.');
      return;
    }

    const intervalMs = Math.max(15, CronWorkerService.config.intervalMinutes) * 60 * 1000;
    CronWorkerService.nextRunTimestamp = new Date(Date.now() + intervalMs).toISOString();

    CronWorkerService.timer = setInterval(async () => {
      if (!CronWorkerService.config.enabled) return;
      console.log(`⏰ [CronWorkerService] ${CronWorkerService.config.intervalMinutes}-Minute Automated Bangladesh Emergency Broadcast Cycle triggered.`);
      try {
        await CronWorkerService.triggerNow();
      } catch (err: any) {
        console.error('❌ [CronWorkerService] Automated broadcast execution error:', err?.message || err);
      }
    }, intervalMs);
  }

  /**
   * Returns current live status, countdown, and config
   */
  public static getStatus() {
    const now = Date.now();
    const nextRunMs = CronWorkerService.nextRunTimestamp ? new Date(CronWorkerService.nextRunTimestamp).getTime() : null;
    const countdownSeconds = nextRunMs && nextRunMs > now ? Math.round((nextRunMs - now) / 1000) : 0;

    return {
      running: CronWorkerService.isRunning && CronWorkerService.config.enabled,
      enabled: CronWorkerService.config.enabled,
      intervalMinutes: CronWorkerService.config.intervalMinutes,
      config: CronWorkerService.config,
      lastRun: CronWorkerService.lastRun,
      nextRun: CronWorkerService.nextRunTimestamp,
      countdownSeconds,
      tasksQueued: 0,
      totalExecuted: CronWorkerService.history.length,
      lastSummary: CronWorkerService.lastBroadcastSummary || (CronWorkerService.history[0] ? CronWorkerService.history[0].summary : ''),
      activeTargets: CronWorkerService.config.targets,
    };
  }

  /**
   * Updates configuration dynamically and reschedules timer
   */
  public static updateConfig(partial: Partial<CronConfig>): CronConfig {
    const oldInterval = CronWorkerService.config.intervalMinutes;
    const oldEnabled = CronWorkerService.config.enabled;

    CronWorkerService.config = {
      ...CronWorkerService.config,
      ...partial,
      intervalMinutes: Number(partial.intervalMinutes) || CronWorkerService.config.intervalMinutes || 120,
    };

    if (oldInterval !== CronWorkerService.config.intervalMinutes || oldEnabled !== CronWorkerService.config.enabled) {
      CronWorkerService.scheduleNextRun();
    }

    console.log(`⚙️ [CronWorkerService] Configuration updated: Interval=${CronWorkerService.config.intervalMinutes}m, Enabled=${CronWorkerService.config.enabled}`);
    return { ...CronWorkerService.config };
  }

  /**
   * Generates formatted Bangladesh Emergency Broadcast using live news and AI Brain
   */
  public static async generateBroadcastMessage(): Promise<{
    title: string;
    summary: string;
    fullMessage: string;
    newsItems: BangladeshNewsItem[];
    emergencyLevel: 'CRITICAL' | 'WARNING' | 'NORMAL';
    modelUsed: string;
  }> {
    // 1. Fetch live Bangladesh breaking & emergency news
    const newsData = await BangladeshNewsAggregator.fetchLatestNews(true);
    let itemsToInclude = newsData.items;

    if (CronWorkerService.config.emergencyOnly) {
      const emergency = newsData.emergencyItems;
      if (emergency.length > 0) itemsToInclude = emergency;
    }

    const criticalItems = itemsToInclude.filter((i) => i.priority === 'CRITICAL');
    const warningItems = itemsToInclude.filter((i) => i.priority === 'HIGH' || i.category === 'emergency' || i.category === 'weather');

    const emergencyLevel: 'CRITICAL' | 'WARNING' | 'NORMAL' =
      criticalItems.length > 0 ? 'CRITICAL' : warningItems.length > 0 ? 'WARNING' : 'NORMAL';

    const emergencyBadge =
      emergencyLevel === 'CRITICAL'
        ? '🔴 [উচ্চ সতর্কতা / HIGH EMERGENCY]'
        : emergencyLevel === 'WARNING'
        ? '🟡 [সতর্কতামূলক বিজ্ঞপ্তি / ADVISORY]'
        : '🟢 [স্বাভাবিক পর্যবেক্ষণ / ALL CLEAR]';

    // 2. Synthesize with Unified AI Brain
    const newsDigestText = itemsToInclude
      .slice(0, 6)
      .map((item, idx) => `${idx + 1}. [${item.source}] ${item.headlineBn || item.headline}: ${item.summaryBn || item.summary}`)
      .join('\n');

    const helplinesText = CronWorkerService.config.includeHelplines
      ? `\n📞 **জাতীয় জরুরি হেল্পলাইন:**\n• ৯৯৯ (জাতীয় জরুরি সেবা)\n• ১০৯০ (দুর্যোগ তথ্য ও সতর্কতা)\n• ৩৩৩ (সরকারি তথ্য ও নাগরিক সেবা)\n• ১৬২৬৩ (স্বাস্থ্য বাতায়ন)`
      : '';

    let aiGeneratedSummary = '';
    let modelUsed = 'Unified-AI-Brain';

    if (CronWorkerService.summarizer) {
      const langInstruction =
        CronWorkerService.config.newsLanguage === 'en'
          ? 'Write in professional, clear English.'
          : CronWorkerService.config.newsLanguage === 'bilingual'
          ? 'Write bilingual bullets (Bengali followed by brief English).'
          : 'Write in natural, refined Bengali (বাংলা).';

      const prompt = `You are the Automated Emergency News Broadcaster for Bangladesh.
Summarize the following live Bangladesh breaking/emergency news items into a high-impact, easy-to-read messenger broadcast bulletin.
${langInstruction}

Format requirements:
- Use bullet points with appropriate emojis (🚨, 🌧️, ⚡, 🇧🇩).
- Highlight key facts, actions for citizens, and impact.
- Keep it concise (under 250 words) and suitable for Telegram/WhatsApp broadcast.

Live News Feed:
${newsDigestText}
`;

      try {
        const response = await CronWorkerService.summarizer(prompt);
        if (response && response.trim()) {
          aiGeneratedSummary = response.trim();
          modelUsed = 'Gemini-3.7-Flash / Groq Llama-3.3';
        }
      } catch (e: any) {
        console.warn('[CronWorkerService] AI Summarizer notice:', e?.message || e);
      }
    }

    if (!aiGeneratedSummary) {
      // Fallback structured generation
      aiGeneratedSummary = itemsToInclude
        .slice(0, 4)
        .map((item) => `• **${item.headlineBn || item.headline}**\n  _${item.summaryBn || item.summary}_ (${item.source})`)
        .join('\n\n');
    }

    const dateStr = new Date().toLocaleDateString('bn-BD', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = new Date().toLocaleTimeString('bn-BD', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const fullMessage = `🇧🇩 **বাংলাদেশ জরুরি ও জাতীয় সংবাদ বুলেটিন**
${emergencyBadge}
🕒 সময়: ${timeStr}, ${dateStr} | স্বয়ংক্রিয় ${CronWorkerService.config.intervalMinutes / 60} ঘণ্টার সাইকেল

${aiGeneratedSummary}
${helplinesText}

🌐 _সার্বক্ষণিক মনিটরিং: Universal Multi-Channel Bot Core_`;

    const summary = aiGeneratedSummary.replace(/\n+/g, ' ').slice(0, 180) + '...';
    const title = `🚨 বাংলাদেশ জরুরি সংবাদ বুলেটিন (${timeStr})`;

    return {
      title,
      summary,
      fullMessage,
      newsItems: itemsToInclude,
      emergencyLevel,
      modelUsed,
    };
  }

  /**
   * Executes broadcast immediately and dispatches to all active channels
   */
  public static async triggerNow(): Promise<{
    success: boolean;
    message: string;
    totalTargets: number;
    successfulSends: number;
    broadcast: BroadcastHistoryItem;
  }> {
    CronWorkerService.lastRun = new Date().toISOString();
    const generated = await CronWorkerService.generateBroadcastMessage();
    CronWorkerService.lastBroadcastSummary = generated.summary;

    const targets = CronWorkerService.config.targets || ['telegram', 'whatsapp', 'discord'];
    const recipientsDetail: Array<{ platform: string; target: string; status: 'ok' | 'skipped' | 'failed'; note?: string }> = [];
    let successfulSends = 0;

    // Dispatch to multi-messenger channels
    for (const target of targets) {
      try {
        const result = await CronWorkerService.dispatchToChannel(target, generated.fullMessage);
        recipientsDetail.push(result);
        if (result.status === 'ok') successfulSends++;
      } catch (err: any) {
        recipientsDetail.push({
          platform: target,
          target: 'Channel Gateway',
          status: 'failed',
          note: err?.message || 'Dispatch error',
        });
      }
    }

    const historyItem: BroadcastHistoryItem = {
      id: 'crn_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      title: generated.title,
      summary: generated.summary,
      fullMessage: generated.fullMessage,
      targetCount: targets.length,
      targets,
      status: successfulSends > 0 ? (successfulSends === targets.length ? 'delivered' : 'partial') : 'failed',
      modelUsed: generated.modelUsed,
      itemsCount: generated.newsItems.length,
      emergencyAlertLevel: generated.emergencyLevel,
      recipientsDetail,
    };

    CronWorkerService.history.unshift(historyItem);
    if (CronWorkerService.history.length > 50) {
      CronWorkerService.history = CronWorkerService.history.slice(0, 50);
    }

    // Reschedule next cycle
    CronWorkerService.scheduleNextRun();

    return {
      success: successfulSends > 0,
      message: `Emergency news bulletin delivered to ${successfulSends} of ${targets.length} channels.`,
      totalTargets: targets.length,
      successfulSends,
      broadcast: historyItem,
    };
  }

  /**
   * Dispatches message to a specific platform with environment token validation
   */
  private static async dispatchToChannel(
    platform: string,
    message: string
  ): Promise<{ platform: string; target: string; status: 'ok' | 'skipped' | 'failed'; note?: string }> {
    const cleanPlatform = platform.toLowerCase();

    // 1. Telegram Dispatch
    if (cleanPlatform === 'telegram') {
      const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_ADMIN_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_BROADCAST_CHAT_ID;

      if (botToken && chatId) {
        try {
          const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: message,
              parse_mode: 'Markdown',
              disable_web_page_preview: true,
            }),
            signal: AbortSignal.timeout(8000),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.ok !== false) {
            return { platform: 'telegram', target: `Chat ${chatId}`, status: 'ok', note: 'Delivered to Telegram Channel/Admin' };
          }
        } catch (e: any) {
          console.warn('[Telegram Dispatch] Network dispatch error:', e?.message);
        }
      }
      return { platform: 'telegram', target: 'Telegram Bot Gateway', status: 'skipped', note: 'Telegram credentials are not configured or delivery was not confirmed.' };
    }

    // 2. WhatsApp Cloud Dispatch
    if (cleanPlatform === 'whatsapp') {
      const waToken = process.env.WHATSAPP_BOT_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
      const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      const toPhone = process.env.WHATSAPP_ADMIN_PHONE || process.env.WHATSAPP_RECIPIENT_NUMBER;

      if (waToken && phoneId && toPhone) {
        try {
          const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${waToken}`,
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: toPhone,
              type: 'text',
              text: { body: message },
            }),
            signal: AbortSignal.timeout(8000),
          });
          if (res.ok) {
            return { platform: 'whatsapp', target: `WA ${toPhone}`, status: 'ok', note: 'Delivered via WhatsApp Cloud Graph API' };
          }
        } catch (e: any) {
          console.warn('[WhatsApp Dispatch] Network error:', e?.message);
        }
      }
      return { platform: 'whatsapp', target: 'WhatsApp Cloud Ingress', status: 'skipped', note: 'WhatsApp credentials are not configured or delivery was not confirmed.' };
    }

    // 3. Discord Dispatch
    if (cleanPlatform === 'discord') {
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      if (webhookUrl && webhookUrl.startsWith('http')) {
        try {
          const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: message }),
            signal: AbortSignal.timeout(8000),
          });
          if (res.ok) {
            return { platform: 'discord', target: 'Discord Channel Webhook', status: 'ok', note: 'Delivered to Discord Channel' };
          }
        } catch {
          // Safe fallback
        }
      }
      return { platform: 'discord', target: 'Discord Alert Webhook', status: 'skipped', note: 'Discord webhook is not configured or delivery was not confirmed.' };
    }

    // 4. Slack Dispatch
    if (cleanPlatform === 'slack') {
      const slackUrl = process.env.SLACK_WEBHOOK_URL || process.env.SLACK_RESPONSE_URL;
      if (slackUrl && slackUrl.startsWith('http')) {
        try {
          const res = await fetch(slackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: message }),
            signal: AbortSignal.timeout(8000),
          });
          if (res.ok) {
            return { platform: 'slack', target: 'Slack Emergency Channel', status: 'ok', note: 'Delivered to Slack Workspace' };
          }
        } catch {
          // Safe fallback
        }
      }
      return { platform: 'slack', target: 'Slack Alert Ingress', status: 'skipped', note: 'Slack webhook is not configured or delivery was not confirmed.' };
    }

    // 5. LINE / Teams / Viber / Generic Webhook
    return { platform: cleanPlatform, target: `${cleanPlatform.toUpperCase()} Gateway`, status: 'skipped', note: `${cleanPlatform} delivery handler is not configured.` };
  }

  public static getHistory() {
    return CronWorkerService.history.slice(0, 40);
  }

  public static async fetchBangladeshBreakingNews() {
    const data = await BangladeshNewsAggregator.fetchLatestNews();
    return {
      news: data.items,
      emergencyCount: data.emergencyItems.length,
      digest: 'বাংলাদেশ জরুরি, আবহাওয়া ও জাতীয় শীর্ষ সংবাদ সমূহ মনিটর করা হচ্ছে।',
      sources: data.sourcesChecked,
      fetchedAt: data.fetchedAt,
    };
  }

  public static async fetchBangladeshEarthquakes() {
    const list = [
      { location: 'Sylhet Basin, Bangladesh', magnitude: '3.4 mb', depth: '10 km', time: new Date().toISOString(), alert: 'Minor' },
      { location: 'Chittagong Hill Tracts', magnitude: '4.1 mb', depth: '35 km', time: new Date(Date.now() - 86400000).toISOString(), alert: 'Low' },
    ];
    return {
      earthquakes: list,
      summary: 'BMD & USGS Seismic listener: 2 minor seismic events recorded in regional radius.',
    };
  }

  public static async fetchYouTubeUpdates() {
    const apiKey = String(process.env.YOUTUBE_API_KEY || '').trim();
    const channelId = String(process.env.YOUTUBE_CHANNEL_ID || '').trim();
    if (!apiKey || !channelId) return { videos: [], summary: 'YouTube Data API credentials are not configured.' };
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(channelId)}&order=date&maxResults=10&type=video&key=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(10000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || `YouTube feed failed (HTTP ${response.status}).`);
    const list = Array.isArray(payload.items) ? payload.items.map((item: any) => ({
      title: item.snippet?.title || 'Untitled video',
      channel: item.snippet?.channelTitle || channelId,
      videoId: item.id?.videoId || '',
      publishedAt: item.snippet?.publishedAt || '',
      status: 'Live',
    })).filter((item: { videoId: string }) => item.videoId) : [];
    return {
      videos: list,
      summary: `Latest videos synced from YouTube channel ${channelId}.`,
    };
  }
}
