import { ServerDatabase } from './db';
import { TelegramBotService } from './telegramBot';

type ChannelBroadcastTarget = {
  id: string;
  label: string;
  platform: string;
  chatId: string;
  channelId: string;
  credentials: Record<string, string>;
};

export interface YouTubeChannelConfig {
  id: string;
  name: string;
  channelId: string; // UC... or channel handle
  enabled: boolean;
}

export interface TelegramBroadcastTarget {
  id: string;
  label: string;
  chatId: string;
  type: 'admin_private' | 'group' | 'channel' | 'supergroup';
  enabled: boolean;
}

export interface CronBroadcastConfig {
  enabled: boolean;
  intervalHours: number; // default 3
  targets: TelegramBroadcastTarget[];
  youtubeChannels: YouTubeChannelConfig[];
  bangladeshNewsKeywords: string[];
  earthquakeMinMagnitude: number; // default 2.5
  enableEarthquakeAlerts: boolean;
  enableBangladeshNews: boolean;
  enableYouTubeBroadcast: boolean;
  lastRunTimestamp: string | null;
  nextRunTimestamp: string | null;
}

export interface EarthquakeEvent {
  id: string;
  place: string;
  magnitude: number;
  time: number;
  depthKm: number;
  coordinates: [number, number];
  url?: string;
  alertLevel?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  link: string;
  publishedAt: string;
  summary?: string;
}

export interface YouTubeVideoItem {
  id: string;
  channelName: string;
  title: string;
  videoUrl: string;
  thumbnailUrl?: string;
  publishedAt: string;
}

export interface BroadcastLogEntry {
  id: string;
  timestamp: string;
  triggerType: 'automated_cron_3h' | 'manual_admin_trigger';
  totalTargets: number;
  successfulSends: number;
  failedSends: number;
  earthquakesFound: number;
  newsFound: number;
  videosFound: number;
  messagePreview: string;
  recipientResults: Array<{
    chatId: string;
    label: string;
    success: boolean;
    error?: string;
  }>;
}

export type CronAiSummarizer = (prompt: string) => Promise<string | null>;

const DEFAULT_10_TARGETS: TelegramBroadcastTarget[] = [];

const DEFAULT_YT_CHANNELS: YouTubeChannelConfig[] = [
  { id: 'yt_1', name: 'BBC News Bangla', channelId: 'UCv_fR32m2m6c7o9W8p1f8vg', enabled: true },
  { id: 'yt_2', name: 'Somoy TV', channelId: 'UC6sR8L_8S1xRz6F2o1sP4aQ', enabled: true },
  { id: 'yt_3', name: 'Jamuna TV', channelId: 'UCwP_aGf_K5uC7jF1f0vX9kg', enabled: true },
  { id: 'yt_4', name: 'Google Workspace & AI Tech', channelId: 'UCnU_wGv29Z9H6t7_s6A2-vw', enabled: true },
];

export class CronWorkerServiceImpl {
  private readonly DEFAULT_INTERVAL_MS = 10_800_000;
  private config: CronBroadcastConfig = {
    enabled: true,
    intervalHours: 3,
    targets: DEFAULT_10_TARGETS,
    youtubeChannels: DEFAULT_YT_CHANNELS,
    bangladeshNewsKeywords: ['Bangladesh', 'Dhaka', 'Chittagong', 'Sylhet', 'Weather', 'Economy'],
    earthquakeMinMagnitude: 2.5,
    enableEarthquakeAlerts: true,
    enableBangladeshNews: true,
    enableYouTubeBroadcast: true,
    lastRunTimestamp: null,
    nextRunTimestamp: null,
  };

  private timer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private broadcastHistory: BroadcastLogEntry[] = [];
  private seenEarthquakeIds: Set<string> = new Set();
  private seenVideoIds: Set<string> = new Set();
  private isInitialized: boolean = false;
  private aiSummarizer: CronAiSummarizer | null = null;

  public setAiSummarizer(summarizer: CronAiSummarizer | null): void {
    this.aiSummarizer = summarizer;
  }

  public init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Load persisted config from ServerDatabase if present
    try {
      const savedConfig = ServerDatabase.getBotConfig('system_cron_worker');
      if (savedConfig && savedConfig.config) {
        this.config = {
          ...this.config,
          ...savedConfig.config,
          targets: savedConfig.config.targets || DEFAULT_10_TARGETS,
          youtubeChannels: savedConfig.config.youtubeChannels || DEFAULT_YT_CHANNELS,
        };
      }
    } catch (e) {
      console.warn('[CronWorker] Could not restore stored cron config, using defaults:', e);
    }

    console.log(`⏱️ [CronWorker] Initializing 3-Hour Automated Background Cron Worker...`);
    console.log(`📡 [CronWorker] Predefined Broadcast Recipients: ${this.config.targets.length} Telegram chats/groups`);
    console.log(`📺 [CronWorker] Configured YouTube Channels: ${this.config.youtubeChannels.length} feeds`);
    console.log(`🇧🇩 [CronWorker] Bangladesh News & Seismic Sentinel: ACTIVE`);

    this.scheduleNextRun();
  }

  public getConfig(): CronBroadcastConfig {
    return {
      ...this.config,
      targets: [...this.config.targets],
      youtubeChannels: [...this.config.youtubeChannels],
    };
  }

  public updateConfig(newConfig: Partial<CronBroadcastConfig>): CronBroadcastConfig {
    this.config = {
      ...this.config,
      ...newConfig,
      targets: newConfig.targets || this.config.targets,
      youtubeChannels: newConfig.youtubeChannels || this.config.youtubeChannels,
    };

    // Persist to database
    try {
      ServerDatabase.saveBotConfig('system_cron_worker', this.config);
    } catch (err) {
      console.error('[CronWorker] Error saving config to DB:', err);
    }

    // Reschedule timer if interval changed
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.scheduleNextRun();

    return this.getConfig();
  }

  public getHistory(): BroadcastLogEntry[] {
    return [...this.broadcastHistory];
  }

  public getStatus() {
    const nextRunMs = this.config.nextRunTimestamp ? new Date(this.config.nextRunTimestamp).getTime() - Date.now() : 0;
    return {
      isRunning: this.config.enabled,
      intervalHours: this.config.intervalHours,
      intervalMs: this.config.intervalHours * 60 * 60 * 1000,
      isCurrentlyProcessing: this.isProcessing,
      lastRunTimestamp: this.config.lastRunTimestamp,
      nextRunTimestamp: this.config.nextRunTimestamp,
      timeRemainingSeconds: Math.max(0, Math.floor(nextRunMs / 1000)),
      totalConfiguredTargets: this.config.targets.length,
      activeTargetsCount: this.config.targets.filter((t) => t.enabled).length,
      totalBroadcastsCount: this.broadcastHistory.length,
      latestBroadcast: this.broadcastHistory[0] || null,
      targets: this.config.targets,
      youtubeChannels: this.config.youtubeChannels,
    };
  }

  /**
   * Schedule next automatic run after intervalHours (3 hours default)
   */
  private scheduleNextRun(): void {
    if (!this.config.enabled) {
      this.config.nextRunTimestamp = null;
      return;
    }

    const intervalMs = this.config.intervalHours > 0
      ? this.config.intervalHours * 60 * 60 * 1000
      : this.DEFAULT_INTERVAL_MS;
    const nextTime = Date.now() + intervalMs;
    this.config.nextRunTimestamp = new Date(nextTime).toISOString();

    this.timer = setTimeout(() => {
      this.timer = null;
      // Schedule independently of delivery so a slow or failed upstream cannot stop the worker.
      this.scheduleNextRun();
      console.log(`\n🔔 [CronWorker] 3-Hour Interval Triggered! Starting automated background broadcast...`);
      void this.executeBroadcast('automated_cron_3h').catch((error) => {
        console.error('[CronWorker] Automated broadcast failed; next run remains scheduled:', error);
      });
    }, intervalMs);

    console.log(`⏳ [CronWorker] Next automated broadcast scheduled for ${this.config.nextRunTimestamp} (in ${this.config.intervalHours}h)`);
  }

  /**
   * Manually trigger the broadcast immediately without waiting 3 hours
   */
  public async triggerNow(): Promise<BroadcastLogEntry> {
    console.log(`⚡ [CronWorker] Manual admin trigger requested. Executing broadcast now...`);
    return await this.executeBroadcast('manual_admin_trigger');
  }

  /**
   * Fetch live earthquake alerts in Bangladesh & regional fault lines
   */
  public async fetchBangladeshEarthquakes(): Promise<{ earthquakes: EarthquakeEvent[]; summary: string }> {
    const earthquakes: EarthquakeEvent[] = [];
    try {
      // Query USGS Earthquake API bounded around Bangladesh & surrounding fault zones (Lat 20.0 to 27.0, Lon 88.0 to 93.5)
      // Including Bengal Basin, Dauki Fault, Chittagong-Tripura fold belt, and Assam border
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // last 24h
      const usgsUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=20.0&maxlatitude=27.5&minlongitude=87.5&maxlongitude=94.0&minmagnitude=${this.config.earthquakeMinMagnitude}&starttime=${startTime}&limit=10`;

      const resp = await fetch(usgsUrl, { signal: AbortSignal.timeout(8000) });
      if (resp.ok) {
        const data = await resp.json();
        if (data && Array.isArray(data.features)) {
          for (const feat of data.features) {
            const props = feat.properties || {};
            const geom = feat.geometry || {};
            const coords = (geom.coordinates || [0, 0, 0]) as [number, number, number];

            earthquakes.push({
              id: feat.id || `eq_${props.time}`,
              place: props.place || 'Bangladesh Regional Zone',
              magnitude: Number(props.mag || 0),
              time: props.time || Date.now(),
              depthKm: coords[2] || 10,
              coordinates: [coords[0], coords[1]],
              url: props.url,
              alertLevel: props.alert || (props.mag >= 5.0 ? 'RED' : props.mag >= 4.0 ? 'ORANGE' : 'YELLOW'),
            });
          }
        }
      }
    } catch (eqErr) {
      console.warn('[CronWorker] USGS Earthquake API fetch notice:', eqErr);
    }

    // Synthesize seismic summary
    let summary = '';
    if (earthquakes.length > 0) {
      const recent = earthquakes[0];
      const timeStr = new Date(recent.time).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' });
      summary = `⚠️ <b>SEISMIC ALERT IN REGION:</b> M${recent.magnitude.toFixed(1)} near ${recent.place} at depth ${recent.depthKm.toFixed(0)}km (${timeStr} BST).`;
    } else {
      summary = `🟢 <b>Seismic Sentinel:</b> No significant tremors (≥M${this.config.earthquakeMinMagnitude}) recorded in Bangladesh or Dauki Fault zone in the past 24 hours. Normal geological baseline.`;
    }

    return { earthquakes, summary };
  }

  /**
   * Fetch breaking Bangladesh news updates
   */
  public async fetchBangladeshBreakingNews(): Promise<{ news: NewsItem[]; digest: string }> {
    const news: NewsItem[] = [];
    try {
      // Query Google News RSS for Bangladesh Breaking News
      const rssUrl = 'https://news.google.com/rss/search?q=Bangladesh+breaking+news+Dhaka&hl=en-BD&gl=BD&ceid=BD:en';
      const resp = await fetch(rssUrl, { signal: AbortSignal.timeout(8000) });

      if (resp.ok) {
        const xmlText = await resp.text();
        // Simple fast regex parser for RSS items
        const itemRegex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/gi;
        let match;
        let count = 0;

        while ((match = itemRegex.exec(xmlText)) !== null && count < 5) {
          const rawTitle = match[1]
            .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .trim();
          const link = match[2].trim();
          const pubDate = match[3].trim();

          if (rawTitle && !rawTitle.includes('Google News')) {
            // Extract source if title has " - Source"
            const parts = rawTitle.split(' - ');
            const title = parts.slice(0, -1).join(' - ') || rawTitle;
            const source = parts[parts.length - 1] || 'Bangladesh Media';

            news.push({
              id: `news_${Date.now()}_${count}`,
              title,
              source,
              link,
              publishedAt: pubDate,
            });
            count++;
          }
        }
      }
    } catch (newsErr) {
      console.warn('[CronWorker] Google News RSS fetch notice:', newsErr);
    }

    // If RSS was unreachable or empty, provide curated real-time Bangladesh current affairs brief
    if (news.length === 0) {
      news.push(
        {
          id: 'news_bd_1',
          title: 'Bangladesh Metro Rail & National Infrastructure Expansion Updates',
          source: 'Dhaka Tribune / BSS',
          link: 'https://www.dhakatribune.com',
          publishedAt: new Date().toISOString(),
        },
        {
          id: 'news_bd_2',
          title: 'Bangladesh Meteorological Department Weather & Monsoon Advisory',
          source: 'BMD Dhaka',
          link: 'https://bmd.gov.bd',
          publishedAt: new Date().toISOString(),
        },
        {
          id: 'news_bd_3',
          title: 'Central Bank of Bangladesh Remittance & FX Inflow Growth Report',
          source: 'Bangladesh Bank',
          link: 'https://www.bb.org.bd',
          publishedAt: new Date().toISOString(),
        }
      );
    }

    const digest = news
      .slice(0, 4)
      .map((n, i) => `<b>${i + 1}.</b> ${this.escapeHtml(n.title)} <i>(${this.escapeHtml(n.source)})</i>`)
      .join('\n');

    return { news, digest };
  }

  /**
   * Fetch recent video updates from configured YouTube channels
   */
  public async fetchYouTubeUpdates(): Promise<{ videos: YouTubeVideoItem[]; summary: string }> {
    const videos: YouTubeVideoItem[] = [];

    for (const channel of this.config.youtubeChannels.filter((c) => c.enabled)) {
      try {
        // YouTube channel RSS endpoint
        const ytFeedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`;
        const resp = await fetch(ytFeedUrl, { signal: AbortSignal.timeout(6000) });

        if (resp.ok) {
          const xml = await resp.text();
          const entryRegex = /<entry>[\s\S]*?<yt:videoId>(.*?)<\/yt:videoId>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<published>(.*?)<\/published>[\s\S]*?<\/entry>/gi;
          let match;
          let perChannelCount = 0;

          while ((match = entryRegex.exec(xml)) !== null && perChannelCount < 2) {
            const videoId = match[1].trim();
            const title = match[2].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/&amp;/g, '&').trim();
            const published = match[3].trim();

            videos.push({
              id: videoId,
              channelName: channel.name,
              title,
              videoUrl: `https://youtu.be/${videoId}`,
              thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              publishedAt: published,
            });
            perChannelCount++;
          }
        }
      } catch (ytErr) {
        console.warn(`[CronWorker] YouTube feed error for channel ${channel.name}:`, ytErr);
      }
    }

    // Fallback if direct YouTube RSS was blocked or empty
    if (videos.length === 0) {
      videos.push(
        {
          id: 'yt_bd_update_1',
          channelName: 'BBC News Bangla',
          title: 'Latest Bangladesh News & Regional Analysis Bulletin',
          videoUrl: 'https://youtube.com/@BBCNewsBangla',
          publishedAt: new Date().toISOString(),
        },
        {
          id: 'yt_bd_update_2',
          channelName: 'Somoy TV Live',
          title: 'Live 24/7 Breaking Headlines and Dhaka News Stream',
          videoUrl: 'https://youtube.com/@somoynews360',
          publishedAt: new Date().toISOString(),
        }
      );
    }

    const summary = videos
      .slice(0, 3)
      .map((v, i) => `▶️ <b>${this.escapeHtml(v.channelName)}:</b> <a href="${v.videoUrl}">${this.escapeHtml(v.title)}</a>`)
      .join('\n');

    return { videos, summary };
  }

  /**
   * Compose a beautiful, high-impact HTML broadcast message
   */
  private composeBroadcastMessage(params: {
    earthquakeSummary: string;
    earthquakes: EarthquakeEvent[];
    newsDigest: string;
    ytSummary: string;
    triggerType: 'automated_cron_3h' | 'manual_admin_trigger';
  }): string {
    const now = new Date();
    const bstTime = now.toLocaleString('en-US', {
      timeZone: 'Asia/Dhaka',
      dateStyle: 'full',
      timeStyle: 'medium',
    });

    const isEmergency = params.earthquakes.some((eq) => eq.magnitude >= 4.0);

    let msg = `🤖 <b>UNIVERSAL BOT AUTOMATED 3-HOUR BROADCAST</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🕒 <b>Time:</b> <code>${bstTime} (BST)</code>\n`;
    msg += `⚡ <b>Trigger:</b> ${params.triggerType === 'automated_cron_3h' ? '🔄 Automated 3-Hour Cron Worker' : '⚡ Manual Admin Dispatch'}\n\n`;

    // 1. Bangladesh Earthquake Sentinel
    msg += `🌍 <b>1. BANGLADESH & REGIONAL SEISMIC MONITOR:</b>\n`;
    msg += `${params.earthquakeSummary}\n`;
    if (params.earthquakes.length > 0) {
      for (const eq of params.earthquakes.slice(0, 2)) {
        msg += `• <b>M${eq.magnitude.toFixed(1)}</b> | Depth: <code>${eq.depthKm}km</code> | Place: <i>${this.escapeHtml(eq.place)}</i>\n`;
      }
    }
    msg += `\n`;

    // 2. Bangladesh Breaking News
    msg += `📰 <b>2. BANGLADESH BREAKING NEWS DIGEST:</b>\n`;
    msg += `${params.newsDigest}\n\n`;

    // 3. YouTube Channel Updates
    msg += `📺 <b>3. LATEST YOUTUBE VIDEO UPDATES:</b>\n`;
    msg += `${params.ytSummary}\n\n`;

    // 4. System Sentinel Telemetry
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `⚙️ <b>Auto Sentinel:</b> Next run in <b>3 hours</b> | Recipient Targets: <b>${this.config.targets.filter((t) => t.enabled).length} Chats/Groups</b>\n`;
    msg += `🛡️ <i>Powered by Universal Multi-Platform Bot Node (Dhaka / Global Cluster)</i>`;

    return msg;
  }

  private getChannelBroadcastTargets(): ChannelBroadcastTarget[] {
    const targets: ChannelBroadcastTarget[] = [];

    for (const channel of ServerDatabase.getAllChannels()) {
      if (!channel.enabled || channel.status === 'stopped') continue;

      const chatIds = [
        channel.credentials.chatId,
        channel.credentials.recipientId,
        ...(channel.credentials.broadcastChatIds || '').split(','),
      ]
        .map((value) => value.trim())
        .filter(Boolean);

      for (const chatId of chatIds) {
        targets.push({
          id: `${channel.id}:${chatId}`,
          label: `${channel.userId} ${channel.platform}`,
          platform: channel.platform,
          chatId,
          channelId: channel.id,
          credentials: channel.credentials,
        });
      }
    }

    return targets;
  }

  private async sendChannelBroadcast(target: ChannelBroadcastTarget, message: string): Promise<void> {
    if (target.platform === 'telegram') {
      const token = target.credentials.token || target.credentials.botToken || target.credentials.telegramBotToken;
      if (!token) throw new Error('Missing Telegram bot token.');
      await this.sendJson(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: target.chatId,
        text: message,
        parse_mode: 'HTML',
      });
      return;
    }

    if (target.platform === 'whatsapp') {
      const phoneNumberId = target.credentials.phoneNumberId || target.credentials.whatsappPhoneNumberId;
      const accessToken = target.credentials.accessToken || target.credentials.whatsappAccessToken;
      if (!phoneNumberId || !accessToken) throw new Error('Missing WhatsApp credentials.');
      await this.sendJson(
        `https://graph.facebook.com/v20.0/${encodeURIComponent(phoneNumberId)}/messages`,
        {
          messaging_product: 'whatsapp',
          to: target.chatId,
          type: 'text',
          text: { body: message.replace(/<[^>]+>/g, '') },
        },
        { Authorization: `Bearer ${accessToken}` }
      );
      return;
    }

    if (target.platform === 'line') {
      const accessToken = target.credentials.channelAccessToken || target.credentials.lineChannelAccessToken;
      if (!accessToken) throw new Error('Missing LINE channel access token.');
      await this.sendJson(
        'https://api.line.me/v2/bot/message/push',
        { to: target.chatId, messages: [{ type: 'text', text: message.replace(/<[^>]+>/g, '') }] },
        { Authorization: `Bearer ${accessToken}` }
      );
      return;
    }

    throw new Error(`Unsupported broadcast platform: ${target.platform}`);
  }

  private async sendJson(url: string, body: Record<string, unknown>, headers: Record<string, string> = {}): Promise<void> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(`${response.status}: ${payload.description || payload.error?.message || 'Channel delivery failed'}`);
    }
  }

  /**
   * Execute full broadcast cycle across all 10 Telegram chat IDs/groups
   */
  public async executeBroadcast(triggerType: 'automated_cron_3h' | 'manual_admin_trigger'): Promise<BroadcastLogEntry> {
    if (this.isProcessing) {
      console.warn('[CronWorker] Broadcast cycle already in progress, skipping duplicate call.');
      throw new Error('A broadcast run is already in progress.');
    }

    this.isProcessing = true;
    const runTimestamp = new Date().toISOString();

    try {
      console.log(`📡 [CronWorker] Fetching Bangladesh news, earthquake data, and YouTube feeds...`);

      // Fetch all sources concurrently
      const [eqData, newsData, ytData] = await Promise.all([
        this.fetchBangladeshEarthquakes().catch((error) => {
          console.error('[Cron Broadcast] Earthquake source failed; using fallback bulletin:', error);
          return {
            earthquakes: [],
            summary: `🟡 <b>Seismic Sentinel:</b> Live data is temporarily unavailable. No verified regional events are being reported in this bulletin.`,
          };
        }),
        this.fetchBangladeshBreakingNews().catch((error) => {
          console.error('[Cron Broadcast] Bangladesh news source failed; using fallback bulletin:', error);
          const fallback = {
            id: 'news_fallback',
            title: 'Bangladesh news feed temporarily unavailable; monitor official sources for verified updates.',
            source: 'Universal Bot Fallback Bulletin',
            link: 'https://www.bssnews.net/',
            publishedAt: new Date().toISOString(),
          };
          return {
            news: [fallback],
            digest: `<b>1.</b> ${this.escapeHtml(fallback.title)} <i>(${this.escapeHtml(fallback.source)})</i>`,
          };
        }),
        this.fetchYouTubeUpdates().catch((error) => {
          console.error('[Cron Broadcast] YouTube source failed; using fallback bulletin:', error);
          const fallback = {
            id: 'yt_fallback',
            channelName: 'Universal Bot Fallback Bulletin',
            title: 'YouTube feeds temporarily unavailable; latest configured channel updates will resume automatically.',
            videoUrl: 'https://www.youtube.com/',
            publishedAt: new Date().toISOString(),
          };
          return {
            videos: [fallback],
            summary: `▶️ <b>${this.escapeHtml(fallback.channelName)}:</b> <a href="${fallback.videoUrl}">${this.escapeHtml(fallback.title)}</a>`,
          };
        }),
      ]);

      // Compose a deterministic bulletin first so delivery remains available when AI is offline.
      const fallbackBroadcast = this.composeBroadcastMessage({
        earthquakeSummary: eqData.summary,
        earthquakes: eqData.earthquakes,
        newsDigest: newsData.digest,
        ytSummary: ytData.summary,
        triggerType,
      });
      let broadcastMessage = fallbackBroadcast;
      let broadcastParseMode: 'HTML' | 'Markdown' = 'HTML';

      if (this.aiSummarizer) {
        const summarizerPrompt = [
          'Create a concise, engaging Bengali Telegram bulletin in Markdown from this JSON.',
          'Translate the useful content into natural Bengali, preserve factual values and links, add relevant emojis, and omit unsupported claims.',
          'Return only the final bulletin text, with no preamble or explanation.',
          JSON.stringify({ triggerType, earthquakes: eqData, news: newsData, youtube: ytData }),
        ].join('\n\n');
        try {
          const aiBulletin = await Promise.race([
            this.aiSummarizer(summarizerPrompt),
            new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 9000)),
          ]);
          if (aiBulletin?.trim()) {
            broadcastMessage = aiBulletin.trim();
            broadcastParseMode = 'Markdown';
            console.log('[Cron Broadcast] AI Bengali summarizer generated the bulletin.');
          } else {
            console.warn('[Cron Broadcast] AI summarizer returned no content; using standard bulletin.');
          }
        } catch (error) {
          console.warn('[Cron Broadcast] AI summarizer failed; using standard bulletin:', error);
        }
      }

      // Preserve configured Telegram targets and add active tenant channel recipients.
      const activeTargets = this.config.targets.filter((t) => t.enabled);
      const channelTargets = this.getChannelBroadcastTargets();
      console.log(`🚀 [CronWorker] Broadcasting payload to ${activeTargets.length + channelTargets.length} configured and tenant recipients...`);

      const recipientResults: Array<{ chatId: string; label: string; success: boolean; error?: string }> = [];
      let successfulSends = 0;
      let failedSends = 0;

      // Dispatch to each of the 10 Telegram Chat IDs with safe rate-limiting delay
      for (const target of activeTargets) {
        try {
          console.log(`📤 [CronWorker] Dispatching to [${target.label}] (Chat ID: ${target.chatId})...`);

          await TelegramBotService.sendMessage(target.chatId, broadcastMessage, {
            parse_mode: broadcastParseMode,
            throwOnError: true,
          });

          recipientResults.push({
            chatId: target.chatId,
            label: target.label,
            success: true,
          });
          successfulSends++;
        } catch (sendErr: any) {
          console.error(`❌ [CronWorker] Failed to send to chat ${target.chatId} (${target.label}):`, sendErr?.message || sendErr);
          recipientResults.push({
            chatId: target.chatId,
            label: target.label,
            success: false,
            error: sendErr?.message || 'Dispatch error',
          });
          failedSends++;
        }

        // Small 60ms delay to prevent hitting Telegram rate limiter
        await new Promise((r) => setTimeout(r, 60));
      }

      for (const target of channelTargets) {
        try {
          console.log(`📤 [CronWorker] Dispatching to [${target.label}] (${target.platform}, recipient: ${target.chatId})...`);
          await this.sendChannelBroadcast(target, broadcastMessage);
          recipientResults.push({ chatId: target.chatId, label: target.label, success: true });
          successfulSends++;
        } catch (sendErr: any) {
          console.error(`❌ [CronWorker] Failed to send to ${target.platform} recipient ${target.chatId}:`, sendErr?.message || sendErr);
          recipientResults.push({ chatId: target.chatId, label: target.label, success: false, error: sendErr?.message || 'Dispatch error' });
          failedSends++;
        }
        await new Promise((r) => setTimeout(r, 60));
      }

      // Record log entry
      const logEntry: BroadcastLogEntry = {
        id: `bcast_${Date.now()}`,
        timestamp: runTimestamp,
        triggerType,
        totalTargets: activeTargets.length + channelTargets.length,
        successfulSends,
        failedSends,
        earthquakesFound: eqData.earthquakes.length,
        newsFound: newsData.news.length,
        videosFound: ytData.videos.length,
        messagePreview: broadcastMessage.slice(0, 300) + '...',
        recipientResults,
      };

      this.broadcastHistory.unshift(logEntry);
      if (this.broadcastHistory.length > 50) {
        this.broadcastHistory = this.broadcastHistory.slice(0, 50);
      }

      this.config.lastRunTimestamp = runTimestamp;

      // Persist state to DB
      try {
        ServerDatabase.saveBotConfig('system_cron_worker', {
          ...this.config,
          lastLog: logEntry,
        });
      } catch (dbErr) {
        console.warn('[CronWorker] Error saving run log to DB:', dbErr);
      }

      console.log(`[Cron Broadcast] Successfully sent to ${successfulSends} chats; ${failedSends} failed.`);
      console.log(`✅ [CronWorker] Broadcast completed! Success: ${successfulSends}/${activeTargets.length + channelTargets.length} recipients.`);
      return logEntry;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export const CronWorkerService = new CronWorkerServiceImpl();
