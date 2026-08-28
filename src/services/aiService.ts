
export interface AiTextRequest {
  prompt: string;
  model?: string;
  systemPrompt?: string;
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
}

export class AiService {
  private static readonly DEFAULT_SYSTEM_PROMPT = 'You are a world-class, multi-disciplinary expert AI: scientist, philosopher, senior code architect, and theoretical physicist. For difficult questions, reason carefully and systematically internally, test assumptions, compare alternatives, and provide a comprehensive, accurate, nuanced final answer without exposing private chain-of-thought. Be authoritative but state meaningful uncertainty. Answer naturally in the user\'s input language, including Bengali or Banglish. Whenever the user asks for a tutorial, video, course, or video link (for example React tutorial, Python video, ভিডিও দাও, or টিউটোরিয়াল লিংক), you MUST construct and return a direct, clickable Markdown link using this format: [📺 টিউটোরিয়াল ভিডিও দেখতে এখানে ক্লিক করুন](https://www.youtube.com/results?search_query=SEARCH_TERMS).';
  private static readonly MANDATORY_LANGUAGE_PROMPT = 'You are an intelligent multi-lingual AI assistant. You MUST strictly follow the user\'s language choice. If the user asks to reply in Bengali (বাংলা) or Banglish, always respond in Bengali.';

  private static readonly KEY_STORAGE_KEY = 'user_api_keys';
  private static readonly DRAFT_STORAGE_KEY = 'user_api_key_drafts';
  private static readonly CONFIG_STORAGE_KEY = 'universal_bot_config_v2';

  /** BotConfig field -> canonical provider id (used by the Configuration Engine inputs). */
  private static readonly FIELD_TO_PROVIDER: Record<string, string> = {
    groqApiKey: 'groq',
    geminiApiKey: 'google',
    cerebrasApiKey: 'cerebras',
    openrouterApiKey: 'openrouter',
    sambanovaApiKey: 'sambanova',
    mistralApiKey: 'mistral',
    githubToken: 'github',
    togetherApiKey: 'together',
    deepseekApiKey: 'deepseek',
    cohereApiKey: 'cohere',
    nvidiaNimApiKey: 'nvidia',
    huggingfaceApiKey: 'huggingface',
    deepinfraApiKey: 'deepinfra',
    chutesApiKey: 'chutes',
    voyageApiKey: 'voyage',
    replicateApiToken: 'replicate',
    vercelAiToken: 'vercel',
    telegramBotToken: 'telegram',
    whatsappAccessToken: 'whatsapp',
    lineChannelAccessToken: 'line',
  };

  private static readJsonStorage(key: string): Record<string, string> {
    try {
      return JSON.parse(localStorage.getItem(key) || '{}') as Record<string, string>;
    } catch {
      return {};
    }
  }

  /** All verified keys saved locally (localStorage vault merged with the workspace config vault). */
  public static getStoredApiKeys(): Record<string, string> {
    const stored = AiService.readJsonStorage(AiService.KEY_STORAGE_KEY);
    const configVault = (AiService.readJsonStorage(AiService.CONFIG_STORAGE_KEY) as { apiGatewayKeys?: Record<string, string> }).apiGatewayKeys || {};
    return { ...configVault, ...stored };
  }

  public static getStoredKey(provider: string): string {
    const normalized = String(provider || '').trim().toLowerCase();
    return String(AiService.getStoredApiKeys()[normalized] || '').trim();
  }

  public static getStoredKeyForField(field: string): string {
    const provider = AiService.FIELD_TO_PROVIDER[String(field)];
    return provider ? AiService.getStoredKey(provider) : '';
  }

  /** Clean masked preview (e.g. `sk-••••••••`) — the raw key is never revealed. */
  public static maskKeyPreview(key: string): string {
    const trimmed = String(key || '').trim();
    if (!trimmed) return '';
    const prefixMatch = trimmed.match(/^[A-Za-z0-9_-]{2,4}/);
    return `${prefixMatch ? prefixMatch[0] : '••'}••••••••`;
  }

  public static maskStoredKey(provider: string): string {
    return AiService.maskKeyPreview(AiService.getStoredKey(provider));
  }

  public static maskStoredKeyForField(field: string): string {
    return AiService.maskKeyPreview(AiService.getStoredKeyForField(field));
  }

  /** In-progress input drafts survive re-renders, telemetry pings and remounts. */
  public static saveKeyDraft(provider: string, token: string): void {
    try {
      const normalized = String(provider || '').trim();
      if (!normalized) return;
      const drafts = AiService.readJsonStorage(AiService.DRAFT_STORAGE_KEY);
      if (String(token || '').trim()) drafts[normalized] = String(token).trim();
      else delete drafts[normalized];
      localStorage.setItem(AiService.DRAFT_STORAGE_KEY, JSON.stringify(drafts));
    } catch {
      // localStorage unavailable — local component state still preserves the draft.
    }
  }

  public static getKeyDraft(provider: string): string {
    const normalized = String(provider || '').trim();
    return String(AiService.readJsonStorage(AiService.DRAFT_STORAGE_KEY)[normalized] || '').trim();
  }

  public static getKeyDraftForField(field: string): string {
    const provider = AiService.FIELD_TO_PROVIDER[String(field)];
    return provider ? AiService.getKeyDraft(provider) : '';
  }

  public static saveKeyDraftForField(field: string, token: string): void {
    const provider = AiService.FIELD_TO_PROVIDER[String(field)];
    if (provider) AiService.saveKeyDraft(provider, token);
  }

  public static async saveApiKey(provider: string, token: string): Promise<boolean> {
    const normalizedProvider = provider.trim().toLowerCase();
    const normalizedToken = token.trim();
    try {
      const storedKeys = JSON.parse(localStorage.getItem('user_api_keys') || '{}') as Record<string, string>;
      localStorage.setItem('user_api_keys', JSON.stringify({ ...storedKeys, [normalizedProvider]: normalizedToken }));
      // Mirror into the persisted workspace config vault so background restores keep the key.
      try {
        const workspaceConfig = JSON.parse(localStorage.getItem('universal_bot_config_v2') || '{}') as { apiGatewayKeys?: Record<string, string> };
        workspaceConfig.apiGatewayKeys = { ...(workspaceConfig.apiGatewayKeys || {}), [normalizedProvider]: normalizedToken };
        localStorage.setItem('universal_bot_config_v2', JSON.stringify(workspaceConfig));
      } catch {
        // Config vault mirror is best-effort only.
      }
      window.dispatchEvent(new CustomEvent('ai-api-key-updated', { detail: { provider: normalizedProvider } }));
    } catch (error) {
      console.warn('[AI Key Save] Local key persistence unavailable:', error);
    }
    const session = (() => {
      try {
        const raw = localStorage.getItem('groq_bot_auth_session_v1');
        return raw ? JSON.parse(raw) as { token?: string } : null;
      } catch {
        return null;
      }
    })();
    try {
      const response = await fetch('/api/ai/save-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        body: JSON.stringify({ provider: normalizedProvider, token: normalizedToken }),
      });
      const data = await response.json().catch(() => ({}));
      return response.ok && data?.success === true;
    } catch (error) {
      console.warn('[AI Key Save] Backend unavailable; local configuration remains active.', error);
      return false;
    }
  }

  private static withYouTubeLink(response: string, userQuery: string): string {
    const videoIntentKeywords = ['video', 'tutorial', 'youtube', 'ভিডিও', 'টিউটোরিয়াল', 'লিংক', 'link'];
    const hasVideoIntent = videoIntentKeywords.some((keyword) => userQuery.toLowerCase().includes(keyword.toLowerCase()));
    if (!hasVideoIntent || /youtube\.com\//i.test(response)) return response;
    const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(userQuery)}`;
    return `${response}\n\n📺 **সরাসরি ইউটিউব টিউটোরিয়াল দেখতে পারেন:**\n${youtubeUrl}`;
  }

  public static async generateText(request: AiTextRequest): Promise<string> {
    const prompt = request.prompt.trim();
    if (!prompt) return 'Please enter a question so I can help.';
    const systemPrompt = `${AiService.MANDATORY_LANGUAGE_PROMPT}\n${request.systemPrompt || AiService.DEFAULT_SYSTEM_PROMPT}`;
    const messages = request.messages?.length
      ? request.messages.map((message) => ({ ...message, content: String(message.content || '') }))
      : [{ role: 'user' as const, content: prompt }];
    const messagesWithSystem = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.filter((message) => message.role !== 'system'),
    ];
    const primaryTimeoutMs = 20000;

    // ⚡ Millisecond multi-model failover: cycle through model routes with generous
    // deadlines while the backend Millisecond Failover Engine cycles the entire
    // active provider pool internally on every attempt.
    const modelCandidates = Array.from(new Set([
      request.model || 'openrouter/deepseek/deepseek-r1',
      'llama-3.1-8b-instant',
      'gemini-2.5-flash',
    ]));

    for (const model of modelCandidates) {
      try {
        const response = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            model,
            systemPrompt,
            messages: messagesWithSystem,
            enableEnsemble: false,
            isChatAssistant: true,
          }),
          signal: AbortSignal.timeout(primaryTimeoutMs),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && typeof data?.text === 'string' && data.text.trim()) {
          return this.withYouTubeLink(data.text.trim(), prompt);
        }
        console.warn(`[AI Chat] Route (${model}) returned no text; instant failover to next route.`);
      } catch (error) {
        console.warn(`[AI Chat] Route (${model}) unavailable; instant failover to next route.`, error);
      }
    }

    throw new Error('No configured AI provider returned a usable response. Please add at least one API key in the API Portal to enable AI features.');
  }

}
