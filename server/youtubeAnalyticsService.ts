/**
 * YouTube Analytics & Status Service (Multi-Tenant)
 *
 * OAuth-backed fetchers built on:
 *   â€¢ YouTube Data API v3        â€” channel statistics, snippet and status/audit signals
 *   â€¢ YouTube Analytics API v2   â€” impressions, impression CTR, watch time, traffic sources
 *
 * Every call exchanges the user's saved OAuth refresh token for a short-lived access
 * token (cached in memory until just before its Google-issued expiry, then silently
 * re-refreshed). Tokens are strictly scoped to the credentials passed in â€” a caller
 * can only ever read the channel that its own saved tokens own.
 */

/** Full OAuth credential set resolved from a user's saved BotConfig (per-tenant). */
export interface YouTubeCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/** Status/audit report derived from the channel resource's status signals. */
export interface ChannelAudit {
  /** 'clean' = no restriction signals, 'warning'/'restricted' = degraded signals found. */
  health: 'clean' | 'warning' | 'restricted';
  healthEmoji: string;
  /** Public API does not expose strike counters directly; 0 = no degradation signals. */
  communityGuidelineStrikes: number;
  /** 'clean' | 'review' | 'restricted' inferred from live API status signals. */
  copyrightStatus: string;
  privacyStatus: string;
  isLinked: boolean;
  longUploadsStatus: string;
  madeForKids: boolean | null;
  auditNotes: string[];
}

export interface ChannelStatsAndAudit {
  channelId: string;
  title: string;
  description: string;
  customUrl: string;
  publishedAt: string;
  country: string;
  thumbnailUrl: string;
  totalViews: number;
  subscriberCount: number | null;
  subscriberCountHidden: boolean;
  videoCount: number;
  status: string;
  audit: ChannelAudit;
}

export interface TrafficSourceStat {
  source: string;
  label: string;
  views: number;
  watchTimeMinutes: number;
}

export interface ChannelAnalytics {
  startDate: string;
  endDate: string;
  totalViews: number;
  /** null when the OAuth token lacks the analytics scope needed for impressions. */
  impressions: number | null;
  /** Percentage 0-100, null when unavailable. */
  impressionCtr: number | null;
  watchTimeMinutes: number;
  averageViewDurationSeconds: number;
  averageViewPercentage: number | null;
  trafficSources: TrafficSourceStat[];
  /** Non-fatal degradation notice (e.g. impressions metric unavailable for this token). */
  note: string | null;
}

export interface LatestVideoInfo {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
  publishedAt: string;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
}

export interface ChannelSeoContext {
  channelId: string;
  title: string;
  description: string;
  customUrl: string;
  country: string;
  publishedAt: string;
  totalViews: number;
  subscriberCount: number | null;
  videoCount: number;
  keywords: string[];
  latestVideos: LatestVideoInfo[];
}

export class YouTubeAnalyticsError extends Error {
  /** True when the failure is caused by a missing/invalid OAuth scope or token. */
  readonly authorizationIssue: boolean;
  constructor(message: string, authorizationIssue = false) {
    super(message);
    this.name = 'YouTubeAnalyticsError';
    this.authorizationIssue = authorizationIssue;
  }
}

const YOUTUBE_TIMEOUT_MS = 30000;

// ==========================================
// OAUTH ACCESS TOKEN RESOLUTION (AUTO-REFRESH)
// ==========================================

/** refresh token â†’ cached access token. Refreshed silently before Google expiry. */
const accessTokenCache = new Map<string, { token: string; expiresAt: number }>();
/** Refresh the access token at least this many ms before Google's reported expiry. */
const TOKEN_EXPIRY_SAFETY_MARGIN_MS = 5 * 60 * 1000;

/** Test/diagnostic hook: drops every cached access token so the next call re-refreshes. */
export function clearAccessTokenCache(): void {
  accessTokenCache.clear();
}

/**
 * Resolves a fresh (or cached) OAuth2 access token for the exact credentials passed in.
 * Multi-tenant safe: the cache key is the tenant's own refresh token, so two users with
 * different channels never share â€” or leak â€” an access token.
 */
export async function resolveAccessToken(credentials: YouTubeCredentials): Promise<string> {
  if (!credentials.clientId || !credentials.clientSecret || !credentials.refreshToken) {
    throw new YouTubeAnalyticsError('YouTube OAuth client ID, client secret, and refresh token are required.');
  }
  const cacheKey = credentials.refreshToken;
  const cached = accessTokenCache.get(cacheKey);
  if (cached && cached.expiresAt - TOKEN_EXPIRY_SAFETY_MARGIN_MS > Date.now()) {
    return cached.token;
  }
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(YOUTUBE_TIMEOUT_MS),
  });
  const tokenPayload = await tokenResponse.json().catch(() => ({})) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    const detail = tokenPayload.error_description || tokenPayload.error || `HTTP ${tokenResponse.status}`;
    const unauthorized = tokenResponse.status === 401 || tokenResponse.status === 403 || /invalid_grant|invalid_client/i.test(detail);
    throw new YouTubeAnalyticsError(`YouTube OAuth token refresh failed: ${detail}`, unauthorized);
  }
  const expiresAt = Date.now() + Math.max(60, Number(tokenPayload.expires_in) || 3600) * 1000;
  accessTokenCache.set(cacheKey, { token: tokenPayload.access_token, expiresAt });
  return tokenPayload.access_token;
}

/**
 * Extracts the tenant's exact YouTube OAuth credentials from a saved BotConfig shape.
 * Returns null when the user has not connected a channel yet (callers show a connect guide).
 */
export function extractYouTubeCredentials(source: Record<string, unknown> | null | undefined): YouTubeCredentials | null {
  if (!source || typeof source !== 'object') return null;
  const clean = (value: unknown): string => String(value ?? '').trim().replace(/^['\"]+|['\"]+$/g, '');
  const refreshToken = clean(source.youtubeRefreshToken);
  if (!refreshToken) return null;
  return {
    clientId: clean(source.youtubeClientId),
    clientSecret: clean(source.youtubeClientSecret),
    refreshToken,
  };
}

/** Normalizes full credentials or a bare refresh token (env OAuth client fallback). */
function normalizeCredentials(credentials: YouTubeCredentials | string): YouTubeCredentials {
  if (typeof credentials === 'string') {
    return {
      clientId: String(process.env.OWNER_YOUTUBE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '').trim(),
      clientSecret: String(process.env.OWNER_YOUTUBE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '').trim(),
      refreshToken: credentials.trim(),
    };
  }
  return {
    clientId: String(credentials?.clientId || '').trim(),
    clientSecret: String(credentials?.clientSecret || '').trim(),
    refreshToken: String(credentials?.refreshToken || '').trim(),
  };
}

// ==========================================
// SHARED INTERNAL HELPERS
// ==========================================

async function googleApiGetJson(url: string, accessToken: string): Promise<{ status: number; ok: boolean; data: any }> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(YOUTUBE_TIMEOUT_MS),
  });
  const data = await response.json().catch(() => ({})) as any;
  return { status: response.status, ok: response.ok, data };
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** UTC yyyy-mm-dd for `daysAgo` days before today (Analytics API accepts UTC dates). */
function yyyymmddDaysAgoUtc(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
}

/** Formats integers with thousand separators for report readability. */
function formatCount(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/** 1234567 â†’ "1.23M" (used in AI prompts and compact UI labels). */
export function formatCompactNumber(value: number | null | undefined): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2).replace(/\.00$/, '')}B`;
  if (abs >= 1_000_000) return `${(num / 1_000_000).toFixed(2).replace(/\.00$/, '')}M`;
  if (abs >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(num));
}

const TRAFFIC_SOURCE_LABELS: Record<string, string> = {
  YT_SEARCH: 'YouTube Search', SUBSCRIBER: 'Subscribers & Feed', RELATED_VIDEO: 'Suggested Videos',
  YT_CHANNEL: 'Channel Pages', EXTERNAL: 'External Apps', NOTIFICATION: 'Notifications',
  PLAYLIST: 'Playlists', YT_OTHER_PAGE: 'Other YouTube Pages', SHORTS: 'Shorts Feed',
  ADVERTISING: 'Advertising', EXT_URL: 'External Websites', NO_LINK_EMBEDDED: 'Embedded Player',
  NO_LINK_OTHER: 'Direct / Unknown', HASHTAGS: 'Hashtags', SOUND_PAGE: 'Sound Pages',
  LIVE_REDIRECT: 'Live Redirects', PRODUCT_PAGE: 'Product Pages', CAMPAIGN_CARD: 'Campaign Cards',
  VIDEO_REMIX: 'Video Remix', ANNOTATION: 'Annotations', PROMOTED: 'Promoted', SUBSCRIBER_TEASER: 'Subscriber Teaser',
};

/** Human-readable label for a YouTube Analytics traffic source id. */
function trafficSourceLabel(source: string): string {
  if (TRAFFIC_SOURCE_LABELS[source]) return TRAFFIC_SOURCE_LABELS[source];
  const cleaned = String(source || '').replace(/^YT_/, '').replace(/_/g, ' ').toLowerCase();
  return cleaned ? cleaned.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Other';
}

// ==========================================
// YOUTUBE DATA API v3 â€” CHANNEL RESOURCE
// ==========================================

interface ChannelResource {
  id: string;
  snippet: any;
  statistics: any;
  status: any;
  contentDetails?: any;
  contentOwnerDetails?: any;
}

/** Fetches the authenticated user's own channel resource (mine=true) via Data API v3. */
async function fetchOwnChannelResource(accessToken: string): Promise<ChannelResource> {
  const { status, ok, data } = await googleApiGetJson(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,status,contentDetails,contentOwnerDetails&mine=true&maxResults=1',
    accessToken,
  );
  if (!ok || status === 401 || status === 403) {
    const reason = String(data?.error?.errors?.[0]?.reason || data?.error?.message || `HTTP ${status}`);
    throw new YouTubeAnalyticsError(`YouTube channel lookup failed: ${reason}`, status === 401 || status === 403);
  }
  const items: any[] = Array.isArray(data?.items) ? data.items : [];
  if (!items.length) {
    throw new YouTubeAnalyticsError('No YouTube channel is associated with this Google account.');
  }
  return items[0] as ChannelResource;
}

/** Builds a channel health/audit report from the resource's live status signals. */
function buildChannelAudit(resource: ChannelResource): ChannelAudit {
  const status = resource?.status || {};
  const notes: string[] = [];
  const isLinked = status.isLinked === true;
  const privacyStatus = String(status.privacyStatus || 'public');
  const longUploadsStatus = String(status.longUploadsStatus || 'longUploadsUnspecified');
  const madeForKids = typeof status.madeForKids === 'boolean' ? status.madeForKids : null;

  if (!isLinked) notes.push('Channel is not linked to a Brand Account â€” some Studio features may be limited.');
  if (privacyStatus && privacyStatus !== 'public') notes.push(`Channel visibility is "${privacyStatus}".`);
  if (longUploadsStatus === 'longUploadsUnspecified') notes.push('Long uploads (>15 min) are not enabled for this channel yet.');

  // The public Data API never exposes strike counters directly. Restriction-shaped
  // signals (upload blocked / terminated flag) are the available degradation evidence.
  const uploadBlocked = Object.values(status || {}).some((v) => String(v) === 'blocked' || String(v) === 'terminated');
  const restricted = uploadBlocked || String(status.channelState || '').toLowerCase() === 'terminated';
  const health: ChannelAudit['health'] = restricted ? 'restricted' : notes.length ? 'warning' : 'clean';
  if (restricted) notes.unshift('Restriction signals detected on the channel status â€” review Studio â†’ Community Guidelines.');
  if (health === 'clean') notes.push('No restriction signals found: channel is in good standing.');

  return {
    health,
    healthEmoji: health === 'clean' ? 'âœ…' : health === 'warning' ? 'âš ï¸' : 'â›”',
    communityGuidelineStrikes: 0,
    copyrightStatus: restricted ? 'review' : 'clean',
    privacyStatus: privacyStatus || 'public',
    isLinked,
    longUploadsStatus,
    madeForKids,
    auditNotes: notes,
  };
}

// ==========================================
// PUBLIC FETCHER 1 â€” CHANNEL STATS & AUDIT
// ==========================================

/**
 * Fetches the tenant's channel statistics plus a status/audit report:
 * total views, subscriber count, total video count, and health signals
 * (community guideline / copyright restriction evidence, privacy, linkage).
 * Auto-refreshes the OAuth access token as needed.
 */
export async function getChannelStatsAndAudit(credentials: YouTubeCredentials | string): Promise<ChannelStatsAndAudit> {
  const normalized = normalizeCredentials(credentials);
  const accessToken = await resolveAccessToken(normalized);
  const resource = await fetchOwnChannelResource(accessToken);
  const snippet = resource.snippet || {};
  const statistics = resource.statistics || {};
  const thumbnails = snippet?.thumbnails || {};
  const thumbnailUrl = thumbnails?.high?.url || thumbnails?.medium?.url || thumbnails?.default?.url || '';
  return {
    channelId: String(resource.id || ''),
    title: String(snippet?.title || 'Unknown Channel'),
    description: String(snippet?.description || ''),
    customUrl: String(snippet?.customUrl || ''),
    publishedAt: String(snippet?.publishedAt || ''),
    country: String(snippet?.country || ''),
    thumbnailUrl,
    totalViews: toNumber(statistics.viewCount),
    subscriberCount: statistics.subscriberCount !== undefined && statistics.subscriberCount !== null
      ? toNumber(statistics.subscriberCount)
      : null,
    subscriberCountHidden: statistics.hiddenSubscriberCount === true,
    videoCount: toNumber(statistics.videoCount),
    status: String(resource?.status?.privacyStatus || 'public'),
    audit: buildChannelAudit(resource),
  };
}

// ==========================================
// YOUTUBE ANALYTICS API v2 â€” CORE REPORTING
// ==========================================

/** One flattened row of an Analytics API report. */
interface AnalyticsRow {
  metrics: Record<string, number | null>;
  dimensions: Record<string, string>;
}

/**
 * Executes a YouTube Analytics API v2 query. Returns null when the query cannot run
 * (missing scope / bad request) so callers can degrade gracefully instead of failing.
 */
async function runAnalyticsQuery(accessToken: string, params: Record<string, string>): Promise<{ rows: AnalyticsRow[]; columnHeaders: any[] } | null> {
  const query = new URLSearchParams(params);
  const { status, ok, data } = await googleApiGetJson(`https://youtubeanalytics.googleapis.com/v2/reports?${query.toString()}`, accessToken);
  if (!ok) {
    const reason = String(data?.error?.errors?.[0]?.reason || data?.error?.message || `HTTP ${status}`);
    // Forbidden/quota errors on Analytics usually mean the OAuth token lacks the
    // yt-analytics readonly scope â€” degrade gracefully rather than throwing.
    console.warn('[YouTubeAnalyticsService] Analytics query skipped:', reason);
    return null;
  }
  const rows: any[] = Array.isArray(data?.rows) ? data.rows : [];
  const columnHeaders: any[] = Array.isArray(data?.columnHeaders) ? data.columnHeaders : [];
  if (!rows.length) return { rows: [], columnHeaders };
  const metricNames: string[] = [];
  const dimensionNames: string[] = [];
  for (const header of columnHeaders) {
    if (header?.columnType === 'METRIC' && header?.name) metricNames.push(String(header.name));
    else if (header?.columnType === 'DIMENSION' && header?.name) dimensionNames.push(String(header.name));
  }
  const parsed: AnalyticsRow[] = rows.map((row: any[]) => {
    const metrics: Record<string, number | null> = {};
    const dimensions: Record<string, string> = {};
    metricNames.forEach((name, idx) => {
      const raw = row[dimensionNames.length + idx];
      metrics[name] = raw === null || raw === undefined ? null : toNumber(raw);
    });
    dimensionNames.forEach((name, idx) => {
      dimensions[name] = String(row[idx] ?? '');
    });
    return { metrics, dimensions };
  });
  return { rows: parsed, columnHeaders };
}

// ==========================================
// PUBLIC FETCHER 2 â€” CHANNEL ANALYTICS REPORT
// ==========================================

/**
 * Queries the YouTube Analytics API for the tenant's performance report:
 * impressions, impression CTR, estimated watch time (minutes) and top traffic
 * sources. Tries a 90-day window first, then falls back to 28 days (impressions
 * have limited retention on some accounts) so the report always degrades
 * gracefully instead of failing.
 */
export async function getChannelAnalytics(credentials: YouTubeCredentials | string): Promise<ChannelAnalytics> {
  const normalized = normalizeCredentials(credentials);
  const accessToken = await resolveAccessToken(normalized);
  const resource = await fetchOwnChannelResource(accessToken);
  const channelId = String(resource.id || '');

  const baseMetrics = 'views,estimatedMinutesWatched,averageViewDuration';
  const extendedMetrics = 'views,estimatedMinutesWatched,averageViewDuration,cardImpressions';
  // impressions + impressionCtr require extra scopes on some accounts, so they are
  // requested in a dedicated query that is allowed to fail independently.
  const impressionMetrics = 'views,impressions,impressionsCtr,estimatedMinutesWatched,averageViewDuration';

  const buildParams = (metrics: string, startDate: string, filters?: string): Record<string, string> => ({
    ids: 'channel==MINE',
    startDate,
    endDate: yyyymmddDaysAgoUtc(0),
    metrics,
    sort: '-views',
    ...(filters ? { filters } : {}),
  });

  // Window fallback: 90d â†’ 28d (brand-new channels or restricted scopes may only
  // support the shorter window). Scope fallback: extended â†’ base metrics.
  const windows = [90, 28];
  let summary: { row: AnalyticsRow | null; windowDays: number } | null = null;
  for (const days of windows) {
    const startDate = yyyymmddDaysAgoUtc(days);
    const extended = await runAnalyticsQuery(accessToken, buildParams(extendedMetrics, startDate, `channel==${channelId}`));
    const extendedRow = extended?.rows?.[0] || null;
    if (extended && extendedRow) {
      summary = { row: extendedRow, windowDays: days };
      break;
    }
    const basic = await runAnalyticsQuery(accessToken, buildParams(baseMetrics, startDate, `channel==${channelId}`));
    const basicRow = basic?.rows?.[0] || null;
    if (basic && basicRow) {
      summary = { row: basicRow, windowDays: days };
      break;
    }
  }

  const startDate = yyyymmddDaysAgoUtc(summary?.windowDays ?? 90);
  const endDate = yyyymmddDaysAgoUtc(0);
  const metricRow = summary?.row || null;

  let totalViews = 0;
  let watchTimeMinutes = 0;
  let averageViewDurationSeconds = 0;
  if (metricRow) {
    totalViews = toNumber(metricRow.metrics.views ?? 0);
    watchTimeMinutes = toNumber(metricRow.metrics.estimatedMinutesWatched ?? 0);
    averageViewDurationSeconds = toNumber(metricRow.metrics.averageViewDuration ?? 0);
  }

  // Dedicated impressions query (may 403 without the analytics scope family).
  let impressions: number | null = null;
  let impressionCtr: number | null = null;
  for (const days of windows) {
    const impressionReport = await runAnalyticsQuery(
      accessToken,
      buildParams(impressionMetrics, yyyymmddDaysAgoUtc(days), `channel==${channelId}`),
    );
    const impressionRow = impressionReport?.rows?.[0] || null;
    if (impressionRow && impressionRow.metrics.impressions !== null && impressionRow.metrics.impressions !== undefined) {
      impressions = toNumber(impressionRow.metrics.impressions);
      impressionCtr = impressionRow.metrics.impressionsCtr !== null && impressionRow.metrics.impressionsCtr !== undefined
        ? toNumber(impressionRow.metrics.impressionsCtr)
        : null;
      break;
    }
  }

  // Top traffic sources (dimension query; also allowed to fail independently).
  const trafficSources: TrafficSourceStat[] = [];
  const trafficReport = await runAnalyticsQuery(accessToken, {
    ids: 'channel==MINE',
    startDate,
    endDate,
    metrics: 'views,estimatedMinutesWatched',
    dimensions: 'insightTrafficSourceType',
    sort: '-views',
    maxResults: '10',
    filters: `channel==${channelId}`,
  });
  for (const row of trafficReport?.rows || []) {
    const source = row.dimensions.insightTrafficSourceType || 'UNKNOWN';
    trafficSources.push({
      source,
      label: trafficSourceLabel(source),
      views: toNumber(row.metrics.views ?? 0),
      watchTimeMinutes: toNumber(row.metrics.estimatedMinutesWatched ?? 0),
    });
  }

  let note: string | null = null;
  if (!metricRow) {
    note = 'Watch-time analytics are unavailable for this token (the YouTube Analytics readonly scope may be missing). Re-generate the refresh token with yt-analytics.readonly to unlock full reporting.';
  } else if (impressions === null) {
    note = 'Impression metrics are not available for this account/scope â€” Views, CTR and watch time below still reflect live data.';
  }

  const averageViewPercentage = impressions !== null && impressions > 0
    ? Math.min(100, (totalViews / impressions) * 100)
    : null;

  return {
    startDate,
    endDate,
    totalViews,
    impressions,
    impressionCtr,
    watchTimeMinutes,
    averageViewDurationSeconds,
    averageViewPercentage,
    trafficSources,
    note,
  };
}

// ==========================================
// PUBLIC FETCHER 3 â€” CHANNEL SEO CONTEXT (SNIPPET + LATEST VIDEOS)
// ==========================================

/** Fetches the channel snippet plus its latest public uploads for the AI SEO engine. */
export async function getChannelSeoContext(credentials: YouTubeCredentials | string): Promise<ChannelSeoContext> {
  const normalized = normalizeCredentials(credentials);
  const accessToken = await resolveAccessToken(normalized);
  const resource = await fetchOwnChannelResource(accessToken);
  const snippet = resource.snippet || {};
  const statistics = resource.statistics || {};
  const channelId = String(resource.id || '');

  // Latest uploads: playlistItems against the uploads playlist, then hydrate metadata.
  const latestVideos: LatestVideoInfo[] = [];
  try {
    // The authenticated channel resource carries the uploads playlist id; fall back to
    // a dedicated contentDetails lookup only when the resource omitted it.
    let uploadsPlaylistId = String(resource?.contentDetails?.relatedPlaylists?.uploads || '');
    if (!uploadsPlaylistId) {
      const details = await googleApiGetJson(
        `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${encodeURIComponent(channelId)}`,
        accessToken,
      );
      uploadsPlaylistId = String(details?.data?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || '');
    }
    if (uploadsPlaylistId) {
      const itemsReport = await googleApiGetJson(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${encodeURIComponent(uploadsPlaylistId)}&maxResults=5`,
        accessToken,
      );
      const videoIds: string[] = (Array.isArray(itemsReport?.data?.items) ? itemsReport.data.items : [])
        .map((item: any) => String(item?.contentDetails?.videoId || ''))
        .filter(Boolean);
      if (videoIds.length) {
        const videosReport = await googleApiGetJson(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds.map((id) => encodeURIComponent(id)).join(',')}&maxResults=5`,
          accessToken,
        );
        for (const item of Array.isArray(videosReport?.data?.items) ? videosReport.data.items : []) {
          const videoStatistics = item?.statistics || {};
          latestVideos.push({
            videoId: String(item?.id || ''),
            title: String(item?.snippet?.title || ''),
            description: String(item?.snippet?.description || ''),
            tags: Array.isArray(item?.snippet?.tags) ? item.snippet.tags.map(String).slice(0, 30) : [],
            publishedAt: String(item?.snippet?.publishedAt || ''),
            viewCount: videoStatistics.viewCount !== undefined ? toNumber(videoStatistics.viewCount) : null,
            likeCount: videoStatistics.likeCount !== undefined ? toNumber(videoStatistics.likeCount) : null,
            commentCount: videoStatistics.commentCount !== undefined ? toNumber(videoStatistics.commentCount) : null,
          });
        }
      }
    }
  } catch (error: any) {
    // Non-fatal: the SEO audit continues with channel-level context only.
    console.warn('[YouTubeAnalyticsService] Latest uploads fetch skipped:', error?.message || error);
  }

  // Channel keywords arrive as a quoted-string list â€” parse both quoted and plain forms.
  const rawKeywords = String(snippet?.keywords || '');
  const keywords: string[] = rawKeywords.includes('"')
    ? (rawKeywords.match(/"[^"]+"/g) || []).map((keyword) => keyword.slice(1, -1).trim()).filter(Boolean)
    : rawKeywords.split(',').map((keyword) => keyword.trim()).filter(Boolean);

    return {
    channelId,
    title: String(snippet?.title || 'Unknown Channel'),
    description: String(snippet?.description || ''),
    customUrl: String(snippet?.customUrl || ''),
    country: String(snippet?.country || ''),
    publishedAt: String(snippet?.publishedAt || ''),
    totalViews: toNumber(statistics.viewCount),
    subscriberCount: statistics.subscriberCount !== undefined ? toNumber(statistics.subscriberCount) : null,
    videoCount: toNumber(statistics.videoCount),
    keywords,
    latestVideos,
  };
}

// ==========================================
// YOUTUBE DATA API v3 â€” VIDEO HISTORY & AI VIRAL PREDICTOR
// ==========================================

export interface VideoHistoryItem {
  id: string;
  title: string;
  publishedAt: string;
  views: number;
  likes: number;
  comments: number;
  duration: string;             // ISO 8601 (e.g. "PT1M30S")
  durationText: string;         // Human readable (e.g. "1:30")
  thumbnailUrl: string;
  performanceTag: 'ðŸ”¥ High' | 'ðŸ“Š Normal' | 'ðŸ“‰ Low';
  performanceScore: number;     // 0-100 relative to channel average (50 = channel avg)
}

/** Parse an ISO 8601 duration (PT1H2M3S) into a human-readable mm:ss / hh:mm:ss string. */
function formatDuration(iso8601: string): string {
  if (!iso8601) return '';
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(iso8601);
  if (!match) return '';
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Fetches the tenant's recent uploaded videos (up to `limit`, capped at 50 per
 * API page), hydrates each with snippet + statistics + contentDetails, and
 * computes a performance score + tag relative to the channel's average view count.
 */
export async function getRecentVideoHistory(
  credentials: YouTubeCredentials | string,
  limit: number = 10,
): Promise<VideoHistoryItem[]> {
  const normalized = normalizeCredentials(credentials);
  const accessToken = await resolveAccessToken(normalized);
  const resource = await fetchOwnChannelResource(accessToken);

  // Resolve the uploads playlist id (the authenticated channel resource carries it).
  let uploadsPlaylistId = String(resource?.contentDetails?.relatedPlaylists?.uploads || '');
  if (!uploadsPlaylistId) {
    const channelId = String(resource.id || '');
    const details = await googleApiGetJson(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${encodeURIComponent(channelId)}`,
      accessToken,
    );
    uploadsPlaylistId = String(details?.data?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || '');
  }
  if (!uploadsPlaylistId) return [];

  const pageSize = Math.min(Math.max(limit, 1), 50);
  const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${encodeURIComponent(uploadsPlaylistId)}&maxResults=${pageSize}`;
  const playlistReport = await googleApiGetJson(playlistUrl, accessToken);
  const videoIds: string[] = (Array.isArray(playlistReport?.data?.items) ? playlistReport.data.items : [])
    .map((item: any) => String(item?.contentDetails?.videoId || ''))
    .filter(Boolean);
  if (!videoIds.length) return [];

  const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.map((id) => encodeURIComponent(id)).join(',')}&maxResults=${videoIds.length}`;
  const videosReport = await googleApiGetJson(videosUrl, accessToken);
  const items: any[] = Array.isArray(videosReport?.data?.items) ? videosReport.data.items : [];

  // Channel average views (from the videos we actually fetched).
  let avgViews = 0;
  for (const item of items) {
    const stats = item?.statistics || {};
    avgViews += toNumber(stats.viewCount);
  }
  avgViews = items.length ? avgViews / items.length : 0;

  return items.map((item) => {
    const snippet = item?.snippet || {};
    const stats = item?.statistics || {};
    const contentDetails = item?.contentDetails || {};
    const duration = String(contentDetails?.duration || '');
    const views = toNumber(stats.viewCount);
    let tag: 'ðŸ”¥ High' | 'ðŸ“Š Normal' | 'ðŸ“‰ Low';
    if (avgViews > 0) {
      const ratio = views / avgViews;
      tag = ratio >= 1.5 ? 'ðŸ”¥ High' : ratio <= 0.5 ? 'ðŸ“‰ Low' : 'ðŸ“Š Normal';
    } else {
      tag = 'ðŸ“Š Normal';
    }
    // Performance score: 0-100 where 50 = channel average, 0 = no views, 100 = 2Ã— average.
    const score = avgViews > 0 ? Math.max(0, Math.min(100, Math.round((views / avgViews) * 50))) : 50;

    const thumbnails = snippet?.thumbnails || {};
    const thumbnailUrl = thumbnails?.high?.url || thumbnails?.medium?.url || thumbnails?.default?.url || '';

    return {
      id: String(item?.id || ''),
      title: String(snippet?.title || ''),
      publishedAt: String(snippet?.publishedAt || ''),
      views,
      likes: toNumber(stats.likeCount),
      comments: toNumber(stats.commentCount),
      duration,
      durationText: formatDuration(duration),
      thumbnailUrl,
      performanceTag: tag,
      performanceScore: score,
    };
  });
}

// ==========================================
// AI VIRAL VIDEO PREDICTOR
// ==========================================

export interface ViralVideoPrediction {
  title: string;
  hook: string;
  recommendedLength: string;
  format: string;
  targetAudienceInterest: string;
  uploadTiming: string;
  whyItWillPerform: string;
}

/** AI generator signature used by getViralVideoPredictions (matches the bot's cascade). */
export type AiGeneratorFn = (prompt: string, model?: string, systemPromptSuffix?: string) => Promise<string | null>;

/**
 * Generates 3-5 high-potential viral video concepts for the tenant's channel
 * by passing channel niche, top-performing video themes, and traffic sources
 * through the AI failover cascade. Returns a structured array on success, or
 * null when the AI cascade cannot fulfil the request (the caller should degrade).
 */
export async function getViralVideoPredictions(
  credentials: YouTubeCredentials | string,
  aiGenerator: AiGeneratorFn,
  modelName?: string,
): Promise<ViralVideoPrediction[] | null> {
  // Gather supporting context (token is cached per refresh token — safe to parallelise).
  const [stats, videoHistory, seoContext] = await Promise.all([
    getChannelStatsAndAudit(credentials),
    getRecentVideoHistory(credentials, 15),
    getChannelSeoContext(credentials),
  ]);

  // Analytics traffic sources are best-effort (scope may be missing).
  let analytics: ChannelAnalytics | null = null;
  try { analytics = await getChannelAnalytics(credentials); } catch { analytics = null; }

  const sortedByViews = [...videoHistory].sort((a, b) => b.views - a.views);
  const topPerformers = sortedByViews.slice(0, 5);
  const recentVideos = videoHistory.slice(0, 10);
  const trafficSources = analytics?.trafficSources
    ? analytics.trafficSources.map((ts) => `${ts.label} (${formatCompactNumber(ts.views)} views)`).join(', ')
    : 'data unavailable';

  const prompt = [
    'You are an elite YouTube growth strategist. Analyze this channel\'s content history and performance data, then generate 3-5 high-potential viral video concepts that will maximize views, watch time, and click-through rate. Return ONLY valid JSON (no markdown fences) with this exact shape:',
    '{"concepts":[',
    '{"title":"Proposed video title that grabs attention (max 70 chars)","hook":"The viral hook - first 15 seconds that will stop the scroll","recommendedLength":"e.g. \'8-10 min long-form\' or \'Short (<60s)\'","format":"e.g. \'long-form tutorial\' or \'Short\'","targetAudienceInterest":"What specific need/curiosity this taps into and why the channel\'s audience will engage","uploadTiming":"Best day/time to post based on audience patterns","whyItWillPerform":"Why this concept will outperform the channel\'s current average"},',
    ']}',
    '',
    `CHANNEL: ${stats.title} (${stats.customUrl || 'n/a'})`,
    `Niche/Description: ${(stats.description || 'n/a').slice(0, 500)}`,
    `Channel keywords: ${seoContext.keywords.join(', ') || 'none'}`,
    `Stats: ${stats.subscriberCountHidden ? 'subscribers hidden' : formatCompactNumber(stats.subscriberCount || 0)} subscribers · ${formatCompactNumber(stats.totalViews)} total views · ${formatCompactNumber(stats.videoCount)} videos`,
    '',
    'TOP-PERFORMING VIDEOS (by views):',
    topPerformers.map((v) => `- "${v.title}" — ${formatCompactNumber(v.views)} views, ${v.performanceTag} ${v.publishedAt}`).join('\n'),
    '',
    'RECENT VIDEOS:',
    recentVideos.map((v) => `- "${v.title}" — ${formatCompactNumber(v.views)} views (${v.durationText}) ${v.performanceTag}`).join('\n'),
    '',
    'TRAFFIC SOURCES:',
    trafficSources,
  ].join('\n');

  const aiText = await aiGenerator(prompt, modelName);
  if (!aiText || !aiText.trim()) return null;

  // Tolerant JSON extraction (strips fences / prose).
  const fenced = aiText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : aiText).trim();

  let concepts: any[] = [];
  // Try array format first.
  const arrStart = candidate.indexOf('[');
  const arrEnd = candidate.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) {
    try {
      const parsed = JSON.parse(candidate.slice(arrStart, arrEnd + 1));
      if (Array.isArray(parsed)) concepts = parsed;
    } catch { /* fall through to object format */ }
  }
  // Try object format { "concepts": [...] }.
  if (!concepts.length) {
    const objStart = candidate.indexOf('{');
    const objEnd = candidate.lastIndexOf('}');
    if (objStart !== -1 && objEnd > objStart) {
      try {
        const parsed = JSON.parse(candidate.slice(objStart, objEnd + 1));
        if (parsed && Array.isArray((parsed as any).concepts)) concepts = (parsed as any).concepts;
        else if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) concepts = [parsed];
      } catch { /* fall through */ }
    }
  }

  if (!concepts.length) return null;

  return concepts
    .filter((c: any) => c && typeof c === 'object')
    .map((c: any) => ({
      title: String(c.title || '').trim(),
      hook: String(c.hook || '').trim(),
      recommendedLength: String(c.recommendedLength || '').trim(),
      format: String(c.format || '').trim(),
      targetAudienceInterest: String(c.targetAudienceInterest || '').trim(),
      uploadTiming: String(c.uploadTiming || '').trim(),
      whyItWillPerform: String(c.whyItWillPerform || '').trim(),
    }))
    .filter((p) => p.title || p.hook)
    .slice(0, 5);
}

