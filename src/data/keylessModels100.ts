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

export interface KeylessProbeRoute {
  name: string;
  provider: 'openrouter' | 'pollinations' | 'duckduckgo' | 'huggingface';
  probeUrl: string;
  modelId?: string;
}

export const KEYLESS_PROBE_ROUTES: KeylessProbeRoute[] = [
  { name: 'DeepSeek R1 (Free)', provider: 'openrouter', probeUrl: 'https://openrouter.ai/api/v1/models', modelId: 'deepseek/deepseek-r1:free' },
  { name: 'Llama 3.3 70B (Free)', provider: 'openrouter', probeUrl: 'https://openrouter.ai/api/v1/models', modelId: 'meta-llama/llama-3.3-70b-instruct:free' },
  { name: 'Gemma 2 9B (Free)', provider: 'openrouter', probeUrl: 'https://openrouter.ai/api/v1/models', modelId: 'google/gemma-2-9b-it:free' },
  { name: 'Qwen 2.5 Coder 32B (Free)', provider: 'openrouter', probeUrl: 'https://openrouter.ai/api/v1/models', modelId: 'qwen/qwen-2.5-coder-32b-instruct:free' },
  { name: 'Mistral 7B (Free)', provider: 'openrouter', probeUrl: 'https://openrouter.ai/api/v1/models', modelId: 'mistralai/mistral-7b-instruct:free' },
  { name: 'Qwen 2.5 72B (Free)', provider: 'openrouter', probeUrl: 'https://openrouter.ai/api/v1/models', modelId: 'qwen/qwen-2.5-72b-instruct:free' },
  { name: 'Gemma 3 27B (Free)', provider: 'openrouter', probeUrl: 'https://openrouter.ai/api/v1/models', modelId: 'google/gemma-3-27b-it:free' },
  { name: 'DeepSeek Chat (Free)', provider: 'openrouter', probeUrl: 'https://openrouter.ai/api/v1/models', modelId: 'deepseek/deepseek-chat:free' },
  { name: 'Llama 3.1 8B (Free)', provider: 'openrouter', probeUrl: 'https://openrouter.ai/api/v1/models', modelId: 'meta-llama/llama-3.1-8b-instruct:free' },
  { name: 'Hermes 3 405B (Free)', provider: 'openrouter', probeUrl: 'https://openrouter.ai/api/v1/models', modelId: 'nousresearch/hermes-3-llama-3.1-405b:free' },
  { name: 'Pollinations Text AI', provider: 'pollinations', probeUrl: 'https://text.pollinations.ai/health' },
  { name: 'Pollinations OpenAI Route', provider: 'pollinations', probeUrl: 'https://text.pollinations.ai/health?model=openai' },
  { name: 'Pollinations Qwen Route', provider: 'pollinations', probeUrl: 'https://text.pollinations.ai/health?model=qwen' },
  { name: 'Pollinations Mistral Route', provider: 'pollinations', probeUrl: 'https://text.pollinations.ai/health?model=mistral' },
  { name: 'Pollinations Llama Route', provider: 'pollinations', probeUrl: 'https://text.pollinations.ai/health?model=llama' },
  { name: 'DuckDuckGo GPT-4o Mini', provider: 'duckduckgo', probeUrl: 'https://duckduckgo.com/duckchat/v1/status' },
  { name: 'Hugging Face Llama 3.1', provider: 'huggingface', probeUrl: 'https://router.huggingface.co/novita/v1/models', modelId: 'meta-llama/llama-3.1-8b-instruct' },
  { name: 'Hugging Face Qwen Coder', provider: 'huggingface', probeUrl: 'https://router.huggingface.co/novita/v1/models', modelId: 'Qwen/Qwen2.5-Coder-32B-Instruct' },
  { name: 'Hugging Face Gemma', provider: 'huggingface', probeUrl: 'https://router.huggingface.co/novita/v1/models', modelId: 'google/gemma-2-9b-it' },
  { name: 'Hugging Face Mistral', provider: 'huggingface', probeUrl: 'https://router.huggingface.co/novita/v1/models', modelId: 'mistralai/Mistral-7B-Instruct-v0.3' },
];
