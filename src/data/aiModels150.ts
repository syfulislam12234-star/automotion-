import { AiModelCatalogItem } from '../types';

const MODEL_IDS = [
  'openrouter/deepseek/deepseek-r1:free', 'openrouter/deepseek/deepseek-chat-v3-0324:free', 'openrouter/meta-llama/llama-3.3-70b-instruct:free', 'openrouter/meta-llama/llama-3.1-8b-instruct:free', 'openrouter/qwen/qwen3-32b:free', 'openrouter/qwen/qwen3-14b:free', 'openrouter/qwen/qwen2.5-vl-72b-instruct:free', 'openrouter/google/gemma-3-27b-it:free', 'openrouter/google/gemma-3-12b-it:free', 'openrouter/google/gemma-3-4b-it:free',
  'openrouter/mistralai/mistral-small-3.1-24b-instruct:free', 'openrouter/mistralai/mistral-7b-instruct:free', 'openrouter/microsoft/phi-4:free', 'openrouter/microsoft/phi-3.5-mini-128k-instruct:free', 'openrouter/nvidia/llama-3.1-nemotron-ultra-253b-v1:free', 'openrouter/nvidia/llama-3.1-nemotron-nano-8b-v1:free', 'openrouter/arcee-ai/trinity-mini:free', 'openrouter/arcee-ai/trinity-large-preview:free', 'openrouter/allenai/olmo-3-32b-think:free', 'openrouter/allenai/olmo-3-7b-instruct:free',
  'openrouter/undi95/toppy-m-7b:free', 'openrouter/openchat/openchat-7b:free', 'openrouter/huggingfaceh4/zephyr-7b-beta:free', 'openrouter/nousresearch/nous-hermes-2-mixtral-8x7b-dpo:free', 'openrouter/gryphe/mythomax-l2-13b:free', 'openrouter/teknium/openhermes-2.5-mistral-7b:free', 'openrouter/undi95/remm-slerp-l2-13b:free', 'openrouter/pygmalionai/mythalion-13b:free', 'openrouter/01-ai/yi-1.5-34b-chat:free', 'openrouter/01-ai/yi-1.5-9b-chat:free',
  'openrouter/phi/phi-4-reasoning-plus:free', 'openrouter/deepseek/deepseek-r1-distill-qwen-32b:free', 'openrouter/deepseek/deepseek-r1-distill-llama-70b:free', 'openrouter/deepseek/deepseek-r1-distill-qwen-14b:free', 'openrouter/deepseek/deepseek-r1-distill-qwen-7b:free', 'openrouter/qwen/qwq-32b:free', 'openrouter/qwen/qwen2.5-72b-instruct:free', 'openrouter/qwen/qwen2.5-32b-instruct:free', 'openrouter/qwen/qwen2.5-14b-instruct:free', 'openrouter/qwen/qwen2.5-7b-instruct:free',
  'groq/llama-3.3-70b-versatile', 'groq/llama-3.1-8b-instant', 'groq/gemma2-9b-it', 'groq/mixtral-8x7b-32768', 'groq/deepseek-r1-distill-llama-70b', 'groq/llama-guard-3-8b', 'groq/llama-3.2-90b-vision-preview', 'groq/llama-3.2-11b-vision-preview', 'groq/llama-3.2-3b-preview', 'groq/llama-3.2-1b-preview',
  'cerebras/llama3.1-8b', 'cerebras/llama3.1-70b', 'cerebras/llama3.3-70b', 'cerebras/qwen-3-32b', 'cerebras/qwen-3-235b-a22b', 'cerebras/deepseek-r1-distill-llama-70b', 'cerebras/llama-3.1-8b', 'cerebras/llama-3.1-70b', 'cerebras/llama-3.3-70b-instruct', 'cerebras/qwen-2.5-32b-instruct',
  'together/meta-llama/Llama-3.3-70B-Instruct-Turbo', 'together/meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo', 'together/meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo', 'together/meta-llama/Llama-3.2-3B-Instruct-Turbo', 'together/Qwen/Qwen2.5-72B-Instruct-Turbo', 'together/Qwen/Qwen2.5-32B-Instruct', 'together/Qwen/Qwen2.5-Coder-32B-Instruct', 'together/deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free', 'together/mistralai/Mistral-7B-Instruct-v0.3', 'together/google/gemma-2-27b-it',
  'huggingface/meta-llama/Llama-3.1-8B-Instruct', 'huggingface/meta-llama/Llama-3.1-70B-Instruct', 'huggingface/Qwen/Qwen2.5-7B-Instruct', 'huggingface/Qwen/Qwen2.5-14B-Instruct', 'huggingface/Qwen/Qwen2.5-32B-Instruct', 'huggingface/Qwen/Qwen2.5-Coder-7B-Instruct', 'huggingface/microsoft/Phi-3.5-mini-instruct', 'huggingface/microsoft/Phi-4-mini-instruct', 'huggingface/google/gemma-2-9b-it', 'huggingface/HuggingFaceH4/zephyr-7b-beta',
  'google/gemini-2.5-flash', 'google/gemini-2.0-flash', 'google/gemini-2.0-flash-lite', 'google/gemini-1.5-flash', 'google/gemma-3-27b-it', 'google/gemma-3-12b-it', 'google/gemma-3-4b-it', 'google/gemma-2-27b-it', 'google/gemma-2-9b-it', 'google/gemma-2-2b-it',
  'mistral/mistral-small-latest', 'mistral/mistral-7b-instruct', 'mistral/open-mistral-7b', 'mistral/codestral-latest', 'mistral/pixtral-12b', 'mistral/ministral-8b-latest', 'mistral/ministral-3b-latest', 'mistral/open-mixtral-8x7b', 'mistral/open-mixtral-8x22b', 'mistral/mistral-nemo',
  'sambanova/Meta-Llama-3.1-8B-Instruct', 'sambanova/Meta-Llama-3.1-70B-Instruct', 'sambanova/Meta-Llama-3.3-70B-Instruct', 'sambanova/Qwen2.5-72B-Instruct', 'sambanova/DeepSeek-R1-Distill-Llama-70B', 'sambanova/Meta-Llama-3.2-3B-Instruct', 'sambanova/Meta-Llama-3.2-11B-Vision-Instruct', 'sambanova/DeepSeek-V3', 'sambanova/Qwen2.5-Coder-32B-Instruct', 'sambanova/Mistral-Small-24B-Instruct-2501',
  'nvidia/llama-3.1-nemotron-70b-instruct', 'nvidia/llama-3.1-nemotron-51b-instruct', 'nvidia/mistral-nemo-minitron-8b', 'nvidia/llama-3.2-nv-70b', 'nvidia/llama-3.2-nv-8b', 'nvidia/mistral-7b-instruct', 'nvidia/gemma-2-9b-it', 'nvidia/qwen2.5-coder-32b-instruct', 'nvidia/phi-3-mini-128k-instruct', 'nvidia/llama-3.1-8b-instruct',
  'deepseek/deepseek-chat', 'deepseek/deepseek-reasoner', 'deepseek/deepseek-coder', 'deepseek/deepseek-v2.5', 'deepseek/deepseek-math', 'deepseek/deepseek-r1', 'cohere/command-r', 'cohere/command-r-plus', 'cohere/command-a', 'cohere/aya-expanse-8b',
  'cloudflare/@cf/meta/llama-3.1-8b-instruct', 'cloudflare/@cf/meta/llama-3.2-3b-instruct', 'cloudflare/@cf/qwen/qwen1.5-14b-chat-awq', 'cloudflare/@cf/mistral/mistral-7b-instruct-v0.2', 'cloudflare/@cf/google/gemma-7b-it', 'cloudflare/@cf/thebloke/neural-chat-v1-7b-v3-gptq', 'cloudflare/@cf/microsoft/phi-2', 'cloudflare/@cf/defog/sqlcoder-7b-2', 'cloudflare/@cf/baai/bge-base-en-v1.5', 'cloudflare/@cf/tiiuae/falcon-7b-instruct',
  'github/gpt-4o-mini', 'github/phi-3-medium-128k-instruct', 'github/phi-3-mini-128k-instruct', 'github/meta-llama-3.1-405b-instruct', 'github/meta-llama-3.1-70b-instruct', 'github/mistral-nemo', 'github/cohere-command-r', 'github/ai21-jamba-1.5-large', 'github/ai21-jamba-1.5-mini', 'github/mai-ds-r1',
  'ollama/llama3.2', 'ollama/llama3.1', 'ollama/qwen2.5', 'ollama/qwen2.5-coder', 'ollama/deepseek-r1', 'ollama/gemma3', 'ollama/phi4', 'ollama/mistral', 'ollama/mixtral', 'ollama/smollm2',
] as const;

export const GLOBAL_150_FREE_AI_MODELS: AiModelCatalogItem[] = MODEL_IDS.slice(0, 150).map((modelId, index) => ({
  id: `free-${index + 1}-${modelId.replace(/[^a-z0-9]+/gi, '-')}`,
  name: `${modelId.split('/').pop() || modelId} (${modelId.split('/')[0]})`,
  provider: modelId.split('/')[0],
  modelId,
  contextWindow: 32768,
  speedRating: 'variable',
  description: 'Free-tier model in the Universal Bot failover catalog.',
  freeTier: true,
  category: index % 5 === 0 ? 'reasoning' : index % 3 === 0 ? 'coding' : 'balanced',
}));

if (GLOBAL_150_FREE_AI_MODELS.length !== 150 || new Set(GLOBAL_150_FREE_AI_MODELS.map((model) => model.modelId)).size !== 150) {
  throw new Error(`Expected 150 free AI models, found ${GLOBAL_150_FREE_AI_MODELS.length}.`);
}
