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

    try {
      const response = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}?system=${encodeURIComponent(request.systemPrompt || AiService.DEFAULT_SYSTEM_PROMPT)}&model=openai`, {
        signal: AbortSignal.timeout(2500),
      });
      const text = await response.text();
      if (response.ok && text.trim() && !text.includes('<html')) return text.trim();
    } catch (error) {
      console.warn('[AI Chat] Public fallback unavailable; using local response.', error);
    }

    return `I received your question: "${prompt.slice(0, 160)}${prompt.length > 160 ? '...' : ''}". The AI routes are temporarily busy; please try again in a moment.`;
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
