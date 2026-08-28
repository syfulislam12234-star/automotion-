export interface YouTubeUploadOptions {
  video: Uint8Array;
  mimeType: string;
  titlePrompt: string;
  privacyStatus: 'public' | 'private' | 'unlisted';
  madeForKids: boolean;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  channelId?: string;
  categoryId?: string;
}

export interface YouTubeSeoMetadata {
  title: string;
  description: string;
  tags: string[];
}

const YOUTUBE_TIMEOUT_MS = 120000;

async function fetchWithTimeout(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(YOUTUBE_TIMEOUT_MS) });
}

function cleanJsonText(value: string): string {
  return value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

export async function generateYouTubeSeo(prompt: string, generateAi: (input: string) => Promise<string | null>): Promise<YouTubeSeoMetadata> {
  const aiText = await generateAi(`Return ONLY valid JSON for YouTube metadata for this video topic: "${prompt}". Shape: {"title":"high CTR title under 100 characters","description":"search optimized description with useful formatting, hashtags and links","tags":["15 relevant search tags"]}. Do not include markdown fences.`);
  if (!aiText) throw new Error('AI SEO generation returned no metadata.');

  let parsed: Partial<YouTubeSeoMetadata>;
  try {
    parsed = JSON.parse(cleanJsonText(aiText)) as Partial<YouTubeSeoMetadata>;
  } catch {
    throw new Error('AI SEO generation returned invalid metadata.');
  }
  const title = typeof parsed.title === 'string' ? parsed.title.trim().slice(0, 100) : '';
  const description = typeof parsed.description === 'string' ? parsed.description.trim() : '';
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean).slice(0, 500)
    : [];
  if (!title || !description || tags.length === 0) throw new Error('AI SEO metadata is incomplete.');
  return { title, description, tags };
}

export async function uploadYouTubeVideo(options: YouTubeUploadOptions, generateAi: (input: string) => Promise<string | null>) {
  if (!options.video.length) throw new Error('A video file is required.');
  if (!options.clientId || !options.clientSecret || !options.refreshToken) {
    throw new Error('YouTube OAuth client ID, client secret, and refresh token are required.');
  }

  const tokenResponse = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: options.clientId,
      client_secret: options.clientSecret,
      refresh_token: options.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const tokenPayload = await tokenResponse.json().catch(() => ({})) as { access_token?: string; error_description?: string };
  if (!tokenResponse.ok || !tokenPayload.access_token) throw new Error(tokenPayload.error_description || 'YouTube OAuth token refresh failed.');

  const seo = await generateYouTubeSeo(options.titlePrompt, generateAi);
  const metadata = {
    snippet: {
      title: seo.title,
      description: seo.description,
      tags: seo.tags,
      categoryId: options.categoryId || '22',
    },
    status: {
      privacyStatus: options.privacyStatus,
      selfDeclaredMadeForKids: options.madeForKids,
    },
  };

  const initiateResponse = await fetchWithTimeout('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenPayload.access_token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': options.mimeType || 'video/mp4',
      'X-Upload-Content-Length': String(options.video.length),
    },
    body: JSON.stringify(metadata),
  });
  const uploadUrl = initiateResponse.headers.get('location');
  if (!initiateResponse.ok || !uploadUrl) {
    const errorText = await initiateResponse.text().catch(() => '');
    throw new Error(`YouTube upload session could not be created: ${errorText || initiateResponse.statusText}`);
  }

  const uploadResponse = await fetchWithTimeout(uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenPayload.access_token}`, 'Content-Type': options.mimeType || 'video/mp4' },
    body: options.video,
  });
  const uploadPayload = await uploadResponse.json().catch(() => ({})) as { id?: string; error?: { message?: string } };
  if (!uploadResponse.ok || !uploadPayload.id) throw new Error(uploadPayload.error?.message || `YouTube video upload failed (HTTP ${uploadResponse.status}).`);
  if (options.channelId && uploadPayload.id) return { ...seo, videoId: uploadPayload.id, url: `https://www.youtube.com/watch?v=${uploadPayload.id}`, channelId: options.channelId };
  return { ...seo, videoId: uploadPayload.id, url: `https://www.youtube.com/watch?v=${uploadPayload.id}` };
}
