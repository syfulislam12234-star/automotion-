import { AiModelCatalogItem } from '../types';
import { GLOBAL_150_FREE_AI_MODELS } from '../data/aiModels150';

export interface FreeModelCatalog {
  count: number;
  models: AiModelCatalogItem[];
}

export interface FreeModelStatus {
  modelId: string;
  status: 'active' | 'inactive';
  reason?: string;
}

export interface AiTextRequest {
  prompt: string;
  model?: string;
  systemPrompt?: string;
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
}

export class AiService {
  private static readonly DEFAULT_SYSTEM_PROMPT = 'You are a precise, helpful AI assistant. Solve technical, coding, debugging, writing, and general knowledge questions clearly. Explain assumptions, provide safe actionable steps, and return concise Markdown. Never invent unavailable facts or credentials.';
  private static readonly MANDATORY_LANGUAGE_PROMPT = 'You are an intelligent multi-lingual AI assistant. You MUST strictly follow the user\'s language choice. If the user asks to reply in Bengali (বাংলা) or Banglish, always respond in Bengali.';

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

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: request.model || 'gemini-3.6-flash',
          systemPrompt,
          messages: messagesWithSystem,
          enableEnsemble: false,
          isChatAssistant: true,
        }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && typeof data?.text === 'string' && data.text.trim()) return data.text.trim();
    } catch (error) {
      console.warn('[AI Chat] Primary route unavailable; switching to public fallback.', error);
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const fallbackPrompt = messagesWithSystem.map((message) => `${message.role}: ${message.content}`).join('\n');
        const response = await fetch(`https://text.pollinations.ai/${encodeURIComponent(fallbackPrompt)}`, {
          signal: AbortSignal.timeout(5000),
        });
        const text = await response.text();
        if (response.ok && text.trim() && !text.includes('<html') && !text.startsWith('<!DOCTYPE')) return text.trim();
        console.warn(`[AI Chat] Public Pollinations fallback returned no usable text (attempt ${attempt}).`);
      } catch (error) {
        console.warn(`[AI Chat] Public Pollinations fallback unavailable (attempt ${attempt}).`, error);
      }
    }

    return 'দুঃখিত, এই মুহূর্তে এআই সেবা সাময়িকভাবে unavailable। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।';
  }

  public static async getFreeModelCatalog(): Promise<FreeModelCatalog> {
    try {
      const response = await fetch('/api/ai/models');
      const data = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(data.models)) {
        return {
          count: Number(data.count) || data.models.length,
          models: data.models as AiModelCatalogItem[],
        };
      }
    } catch (error) {
      console.warn('[AI Catalog] Dynamic catalog unavailable; using bundled free models.', error);
    }

    return { count: GLOBAL_150_FREE_AI_MODELS.length, models: GLOBAL_150_FREE_AI_MODELS };
  }

  public static async getFreeModelStatuses(): Promise<FreeModelStatus[]> {
    try {
      const response = await fetch('/api/ai/models/status');
      const data = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(data.statuses)) return data.statuses as FreeModelStatus[];
    } catch (error) {
      console.warn('[AI Status] Dynamic status check unavailable.', error);
    }
    return GLOBAL_150_FREE_AI_MODELS.map((model) => ({ modelId: model.modelId, status: 'inactive' as const, reason: 'Status service unavailable.' }));
  }
}
