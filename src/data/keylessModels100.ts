import { AiModelCatalogItem } from '../types';
import { GLOBAL_100_AI_MODELS } from './aiModels100';

/**
 * The first 100 catalog entries are the built-in zero-cost routing pool.
 * Execution is performed only by the live providers implemented by the server;
 * catalog membership never implies a fabricated response.
 */
export const KEYLESS_AI_MODELS_100: AiModelCatalogItem[] = GLOBAL_100_AI_MODELS.slice(0, 100).map((model) => ({
  ...model,
  id: `keyless-${model.id}`,
  freeTier: true,
  description: `${model.description} Routed through the configured keyless free cascade.`,
}));
