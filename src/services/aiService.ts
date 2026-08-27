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

export class AiService {
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
