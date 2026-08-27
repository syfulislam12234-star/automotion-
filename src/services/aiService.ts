import { AiModelCatalogItem } from '../types';
import { GLOBAL_100_AI_MODELS } from '../data/aiModels100';

export interface FreeModelCatalog {
  count: number;
  models: AiModelCatalogItem[];
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

    const models = GLOBAL_100_AI_MODELS.filter((model) => model.freeTier);
    return { count: models.length, models };
  }
}
