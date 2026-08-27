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
}

export class AiService {
  private static readonly DEFAULT_SYSTEM_PROMPT = 'You are a precise, helpful AI assistant. Solve technical, coding, debugging, writing, and general knowledge questions clearly. Explain assumptions, provide safe actionable steps, and return concise Markdown. Never invent unavailable facts or credentials.';

  public static async generateText(request: AiTextRequest): Promise<string> {
    const prompt = request.prompt.trim();
    if (!prompt) return 'Please enter a question so I can help.';

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: request.model,
          systemPrompt: request.systemPrompt || AiService.DEFAULT_SYSTEM_PROMPT,
          enableEnsemble: false,
          isChatAssistant: true,
        }),
        signal: AbortSignal.timeout(2500),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && typeof data?.text === 'string' && data.text.trim()) return data.text.trim();
    } catch (error) {
      console.warn('[AI Chat] Primary route unavailable; switching to public fallback.', error);
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, {
          signal: AbortSignal.timeout(2500),
        });
        const text = await response.text();
        if (response.ok && text.trim() && !text.includes('<html') && !text.startsWith('<!DOCTYPE')) return text.trim();
        console.warn(`[AI Chat] Public Pollinations fallback returned no usable text (attempt ${attempt}).`);
      } catch (error) {
        console.warn(`[AI Chat] Public Pollinations fallback unavailable (attempt ${attempt}).`, error);
      }
    }

    throw new Error('No live AI response was returned by the configured or public provider routes.');
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
