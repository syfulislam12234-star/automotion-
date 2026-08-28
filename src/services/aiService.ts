
export interface AiTextRequest {
  prompt: string;
  model?: string;
  systemPrompt?: string;
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
}

export class AiService {
  private static readonly DEFAULT_SYSTEM_PROMPT = 'You are a world-class, multi-disciplinary expert AI: scientist, philosopher, senior code architect, and theoretical physicist. For difficult questions, reason carefully and systematically internally, test assumptions, compare alternatives, and provide a comprehensive, accurate, nuanced final answer without exposing private chain-of-thought. Be authoritative but state meaningful uncertainty. Answer naturally in the user\'s input language, including Bengali or Banglish. Whenever the user asks for a tutorial, video, course, or video link (for example React tutorial, Python video, ভিডিও দাও, or টিউটোরিয়াল লিংক), you MUST construct and return a direct, clickable Markdown link using this format: [📺 টিউটোরিয়াল ভিডিও দেখতে এখানে ক্লিক করুন](https://www.youtube.com/results?search_query=SEARCH_TERMS).';
  private static readonly MANDATORY_LANGUAGE_PROMPT = 'You are an intelligent multi-lingual AI assistant. You MUST strictly follow the user\'s language choice. If the user asks to reply in Bengali (বাংলা) or Banglish, always respond in Bengali.';

  public static async saveApiKey(provider: string, token: string): Promise<boolean> {
    const normalizedProvider = provider.trim().toLowerCase();
    const normalizedToken = token.trim();
    try {
      const storedKeys = JSON.parse(localStorage.getItem('user_api_keys') || '{}') as Record<string, string>;
      localStorage.setItem('user_api_keys', JSON.stringify({ ...storedKeys, [normalizedProvider]: normalizedToken }));
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
    const primaryTimeoutMs = 450;

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: request.model || 'openrouter/deepseek/deepseek-r1',
          systemPrompt,
          messages: messagesWithSystem,
          enableEnsemble: false,
          isChatAssistant: true,
        }),
        signal: AbortSignal.timeout(primaryTimeoutMs),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && typeof data?.text === 'string' && data.text.trim()) return this.withYouTubeLink(data.text.trim(), prompt);
    } catch (error) {
      console.warn('[AI Chat] Primary route unavailable; switching to public fallback.', error);
    }

    throw new Error('No configured AI provider returned a usable response. Please add at least one API key in the API Portal to enable AI features.');
  }

}
