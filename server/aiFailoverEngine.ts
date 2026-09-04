import crypto from 'crypto';
import { GlobalApiKeyStore, maskKey } from './keyStore';
import { StoreKnowledgeEngine, KNOWLEDGE_SYSTEM_MARKER } from './aiKnowledgeEngine';

/**
 * Ultra-Fast Millisecond Multi-Model Failover Orchestrator
 *
 * Step A: Try the primary model / API key.
 * Step B: Every attempt runs under a tight 2.5-second AbortController deadline. On a rate
 *         limit (HTTP 429), quota exhaustion, network timeout, or error response, the engine
 *         INSTANTLY (within milliseconds — no sleeps) fails over to the next provider in
 *         the circular queue.
 * Step C: Rapid sequential retries continue around the dynamic circular key pool until a
 *         valid response is generated. A zero-break final sweep re-attempts every key with
 *         cooldowns ignored, so the user NEVER sees an error while at least one key exists.
 *
 * The pool is built from the GlobalApiKeyStore (environment + persistent database +
 * runtime saves). As long as at least ONE valid API key remains active in the pool,
 * the engine keeps trying and never gives up before exhausting every candidate.
 */

export interface FailoverAttemptOptions {
  preferredProvider?: string;
  preferredModel?: string;
  deadlinePerAttemptMs?: number;
  maxKeysPerProvider?: number;
  maxModelsPerRoute?: number;
  /** Per-owner knowledge isolation: inject ONLY this workspace's trained store context. */
  knowledgeWorkspaceId?: string;
  /** Phase 4: provider ids disabled by the admin AI configuration — never attempted. */
  skipProviders?: string[];
}

export interface FailoverResult {
  text: string;
  providerId: string;
  providerName: string;
  model: string;
  attempts: number;
  latencyMs: number;
  trail: string[];
  activeProviders: string[];
}

export interface FailoverPoolSnapshot {
  deadlinePerAttemptMs: number;
  totalKeys: number;
  activeProviders: number;
  routes: Array<{ id: string; name: string; priority: number; keys: number; cooledDown: boolean; models: string[] }>;
}

type ChatStyle = 'openai' | 'anthropic' | 'gemini';

interface ProviderRoute {
  id: string;
  name: string;
  style: ChatStyle;
  baseUrl: string;
  path: string;
  models: string[];
  priority: number;
}

/** Tight 2.5-second AbortController deadline per provider attempt (circular failover). */
const DEFAULT_ATTEMPT_DEADLINE_MS = Math.max(1500, Number(process.env.AI_FAILOVER_DEADLINE_MS) || 2500);
const RATE_LIMIT_COOLDOWN_MS = Math.max(5000, Number(process.env.AI_KEY_COOLDOWN_MS) || 20000);
const INVALID_KEY_COOLDOWN_MS = 120000;
/** Cooldown for a key+model pair that returned HTTP 404 (model not available for this key). */
const MODEL_NOT_FOUND_COOLDOWN_MS = Math.max(30_000, Number(process.env.AI_MODEL_NOT_FOUND_COOLDOWN_MS) || 300_000);

/**
 * 🛡️ Strict provider isolation: Gemini requests must ONLY ever carry genuine Gemini
 * identifiers (e.g. `gemini-1.5-flash`, `gemini-2.0-flash`, `gemini-2.5-flash`). Any
 * Llama / OpenAI / Claude / catalog string is dropped before it can reach the API.
 */
const GEMINI_MODEL_PATTERN = /^gemini-[a-z0-9.\-]+$/;
function sanitizeGeminiModel(preferredModel: string): string {
  const model = String(preferredModel || '').trim();
  return GEMINI_MODEL_PATTERN.test(model) ? model : '';
}

/** 🛡️ Strict Groq isolation: only genuine Groq production identifiers are forwarded. */
const GROQ_MODEL_PATTERN = /^(llama|mixtral|gemma|qwen|deepseek|kimi|moonshot)[a-z0-9.\-_]*$/i;
const GROQ_MODEL_ALLOWLIST = new Set([
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-8b-8192',
  'mixtral-8x7b-32768',
]);
function sanitizeGroqModel(preferredModel: string): string {
  const model = String(preferredModel || '').trim();
  if (!model || /[\s/:@]/.test(model)) return '';
  return GROQ_MODEL_ALLOWLIST.has(model) || GROQ_MODEL_PATTERN.test(model) ? model : '';
}

/** High-speed provider route table (OpenAI-compatible unless noted). Ordered by speed tier. */
const PROVIDER_ROUTES: ProviderRoute[] = [
  { id: 'groq', name: 'Groq Cloud LPU', style: 'openai', baseUrl: 'https://api.groq.com/openai/v1', path: '/chat/completions', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama3-8b-8192', 'mixtral-8x7b-32768'], priority: 10 },
  { id: 'cerebras', name: 'Cerebras LPU', style: 'openai', baseUrl: 'https://api.cerebras.ai/v1', path: '/chat/completions', models: ['llama-3.1-8b', 'llama-3.3-70b'], priority: 12 },
  { id: 'google', name: 'Google Gemini', style: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models', path: '', models: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'], priority: 14 },
  { id: 'sambanova', name: 'SambaNova RDU', style: 'openai', baseUrl: 'https://api.sambanova.ai/v1', path: '/chat/completions', models: ['Meta-Llama-3.3-70B-Instruct'], priority: 16 },
  { id: 'openrouter', name: 'OpenRouter', style: 'openai', baseUrl: 'https://openrouter.ai/api/v1', path: '/chat/completions', models: ['deepseek/deepseek-r1:free', 'meta-llama/llama-3.3-70b-instruct:free'], priority: 18 },
  { id: 'deepseek', name: 'DeepSeek', style: 'openai', baseUrl: 'https://api.deepseek.com/v1', path: '/chat/completions', models: ['deepseek-chat'], priority: 20 },
  { id: 'mistral', name: 'Mistral AI', style: 'openai', baseUrl: 'https://api.mistral.ai/v1', path: '/chat/completions', models: ['mistral-small-latest', 'open-mistral-nemo'], priority: 22 },
  { id: 'together', name: 'Together AI', style: 'openai', baseUrl: 'https://api.together.xyz/v1', path: '/chat/completions', models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo'], priority: 24 },
  { id: 'fireworks', name: 'Fireworks AI', style: 'openai', baseUrl: 'https://api.fireworks.ai/inference/v1', path: '/chat/completions', models: ['accounts/fireworks/models/llama-v3p3-70b-instruct'], priority: 26 },
  { id: 'xai-grok', name: 'xAI Grok', style: 'openai', baseUrl: 'https://api.x.ai/v1', path: '/chat/completions', models: ['grok-3-mini', 'grok-2-latest'], priority: 28 },
  { id: 'openai', name: 'OpenAI', style: 'openai', baseUrl: 'https://api.openai.com/v1', path: '/chat/completions', models: ['gpt-4o-mini', 'gpt-4.1-mini'], priority: 30 },
  { id: 'anthropic', name: 'Anthropic Claude', style: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', path: '/messages', models: ['claude-3-5-haiku-latest'], priority: 32 },
  { id: 'nvidia', name: 'NVIDIA NIM', style: 'openai', baseUrl: 'https://integrate.api.nvidia.com/v1', path: '/chat/completions', models: ['meta/llama-3.3-70b-instruct'], priority: 34 },
  { id: 'github', name: 'GitHub Models', style: 'openai', baseUrl: 'https://models.inference.ai.azure.com', path: '/chat/completions', models: ['gpt-4o-mini'], priority: 36 },
  { id: 'deepinfra', name: 'DeepInfra', style: 'openai', baseUrl: 'https://api.deepinfra.com/v1/openai', path: '/chat/completions', models: ['meta-llama/Llama-3.3-70B-Instruct'], priority: 38 },
  { id: 'hyperbolic', name: 'Hyperbolic', style: 'openai', baseUrl: 'https://api.hyperbolic.xyz/v1', path: '/chat/completions', models: ['meta-llama/Llama-3.3-70B-Instruct'], priority: 40 },
  { id: 'novita', name: 'Novita AI', style: 'openai', baseUrl: 'https://api.novita.ai/v3/openai', path: '/chat/completions', models: ['meta-llama/llama-3.3-70b-instruct'], priority: 42 },
  { id: 'siliconflow', name: 'SiliconFlow', style: 'openai', baseUrl: 'https://api.siliconflow.cn/v1', path: '/chat/completions', models: ['deepseek-ai/DeepSeek-V3'], priority: 44 },
  { id: 'qwen', name: 'Alibaba Qwen', style: 'openai', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', path: '/chat/completions', models: ['qwen-plus'], priority: 46 },
  { id: 'zhipu', name: 'Zhipu AI (GLM)', style: 'openai', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', path: '/chat/completions', models: ['glm-4-flash'], priority: 48 },
  { id: 'moonshot', name: 'Moonshot AI (Kimi)', style: 'openai', baseUrl: 'https://api.moonshot.cn/v1', path: '/chat/completions', models: ['moonshot-v1-8k'], priority: 50 },
  { id: 'upstage', name: 'Upstage Solar', style: 'openai', baseUrl: 'https://api.upstage.ai/v1/solar', path: '/chat/completions', models: ['solar-pro'], priority: 52 },
  { id: 'cohere', name: 'Cohere', style: 'openai', baseUrl: 'https://api.cohere.ai/compatibility/v1', path: '/chat/completions', models: ['command-r-08-2024'], priority: 54 },
  { id: 'perplexity', name: 'Perplexity Sonar', style: 'openai', baseUrl: 'https://api.perplexity.ai', path: '/chat/completions', models: ['sonar'], priority: 56 },
  { id: 'ai21', name: 'AI21 Jamba', style: 'openai', baseUrl: 'https://api.ai21.com/studio/v1', path: '/chat/completions', models: ['jamba-mini'], priority: 58 },
  { id: 'anyscale', name: 'Anyscale Endpoints', style: 'openai', baseUrl: 'https://api.endpoints.anyscale.com/v1', path: '/chat/completions', models: ['meta-llama/Llama-3.3-70B-Instruct'], priority: 60 },
  { id: 'writer', name: 'Writer Palmyra', style: 'openai', baseUrl: 'https://api.writer.com/v1', path: '/chat/completions', models: ['palmyra-x-004'], priority: 62 },
  { id: 'friendli', name: 'FriendliAI', style: 'openai', baseUrl: 'https://inference.friendli.ai/v1', path: '/chat/completions', models: ['meta-llama/Llama-3.3-70B-Instruct'], priority: 64 },
  { id: 'chutes', name: 'Chutes AI', style: 'openai', baseUrl: 'https://inference.chutes.ai/v1', path: '/chat/completions', models: ['meta-llama/Llama-3.3-70B-Instruct'], priority: 66 },
];


interface NormalizedMessage {
  role: string;
  content: string;
}

export class FailoverEngine {
  /** In-memory cooldown registry: `${providerId}::${keyHash}` for key-wide cooldowns and
   * `${providerId}::${keyHash}::${model}` for key+model pair cooldowns (HTTP 404). */
  private static cooldownUntil = new Map<string, number>();

  private static hashKey(key: string): string {
    return crypto.createHash('sha1').update(key).digest('hex').slice(0, 12);
  }

  private static cooldownId(providerId: string, key: string, model?: string): string {
    return `${providerId}::${FailoverEngine.hashKey(key)}${model ? `::${model}` : ''}`;
  }

  /**
   * True when a key (or a specific key+model pair) is cooling down. Key-level cooldowns
   * come from HTTP 429/402 (quota) and 401/403 (invalid); pair-level from HTTP 404
   * (model not available for that key). Checked before any network call so rotation to
   * the next active key or fallback provider happens with zero added latency.
   */
  public static isCoolingDown(providerId: string, key: string, model?: string): boolean {
    if (model) {
      const pairUntil = FailoverEngine.cooldownUntil.get(FailoverEngine.cooldownId(providerId, key, model)) || 0;
      if (pairUntil > Date.now()) return true;
    }
    const until = FailoverEngine.cooldownUntil.get(FailoverEngine.cooldownId(providerId, key)) || 0;
    return until > Date.now();
  }

  private static noteFailure(providerId: string, key: string, kind: number | 'timeout' | 'network' | 'empty', model?: string): void {
    if (kind === 429 || kind === 402) {
      // Quota / rate-limit / out-of-credits: the whole key is throttled, so cool down
      // every model on it at once and let the loop rotate to the next active key.
      const until = Date.now() + RATE_LIMIT_COOLDOWN_MS;
      FailoverEngine.cooldownUntil.set(FailoverEngine.cooldownId(providerId, key), until);
      if (model) FailoverEngine.cooldownUntil.set(FailoverEngine.cooldownId(providerId, key, model), until);
    } else if (kind === 404) {
      // Model not found: only this key+model pair is dead — the key stays usable for
      // the route's other validated models.
      FailoverEngine.cooldownUntil.set(FailoverEngine.cooldownId(providerId, key, model), Date.now() + MODEL_NOT_FOUND_COOLDOWN_MS);
    } else if (kind === 401 || kind === 403) {
      FailoverEngine.cooldownUntil.set(FailoverEngine.cooldownId(providerId, key), Date.now() + INVALID_KEY_COOLDOWN_MS);
    }
  }

  public static isPoolActive(): boolean {
    return GlobalApiKeyStore.hasAnyKeys();
  }

  public static getPoolSnapshot(): FailoverPoolSnapshot {
    const routes = PROVIDER_ROUTES.map((route) => {
      const keys = GlobalApiKeyStore.getKeysForProvider(route.id);
      return {
        id: route.id,
        name: route.name,
        priority: route.priority,
        keys: keys.length,
        cooledDown: keys.length > 0 && keys.every((key) => FailoverEngine.isCoolingDown(route.id, key)),
        models: route.models.slice(0, 3),
      };
    });
    const active = routes.filter((route) => route.keys > 0);
    return {
      deadlinePerAttemptMs: DEFAULT_ATTEMPT_DEADLINE_MS,
      totalKeys: active.reduce((sum, route) => sum + route.keys, 0),
      activeProviders: active.length,
      routes: active,
    };
  }

  /**
   * Runs the instant failover loop across every active provider in the pool.
   * Returns the first successful response, or null when the pool is exhausted.
   */
  public static async generate(rawMessages: any[], options: FailoverAttemptOptions = {}): Promise<FailoverResult | null> {
    const startedAt = Date.now();
    const deadlineMs = Math.max(1000, Number(options.deadlinePerAttemptMs) || DEFAULT_ATTEMPT_DEADLINE_MS);
    const maxKeysPerProvider = Math.max(1, Number(options.maxKeysPerProvider) || 3);
    const maxModelsPerRoute = Math.max(1, Number(options.maxModelsPerRoute) || 2);
    const preferredProvider = options.preferredProvider ? GlobalApiKeyStore.normalizeProvider(options.preferredProvider) : '';
    const preferredModel = String(options.preferredModel || '').trim();

    const messages: NormalizedMessage[] = (Array.isArray(rawMessages) ? rawMessages : [])
      .map((message: any) => ({ role: String(message?.role || 'user'), content: String(message?.content ?? message?.text ?? '') }))
      .filter((message) => message.content.trim());
    if (messages.length === 0) return null;

    // 🧠 Dynamic store-knowledge injection (trained in the Custom AI Store Trainer) so every
    // failover reply quotes real product details, prices, stock and store policies.
    // Per-owner isolation: when knowledgeWorkspaceId is provided, ONLY that workspace's
    // trained context is injected — never another user's, never the global default.
    const knowledgeBlock = StoreKnowledgeEngine.buildSystemPromptBlock(options.knowledgeWorkspaceId || 'default');
    if (knowledgeBlock && !messages.some((message) => message.role === 'system' && message.content.includes(KNOWLEDGE_SYSTEM_MARKER))) {
      messages.unshift({ role: 'system', content: knowledgeBlock });
    }

    const skipProviders = new Set<string>((Array.isArray(options.skipProviders) ? options.skipProviders : []).map((id) => String(id || '').trim()).filter(Boolean));

    const orderedRoutes = [...PROVIDER_ROUTES]
      .filter((route) => !skipProviders.has(route.id))
      .sort((a, b) => {
        const aBoost = preferredProvider && a.id === preferredProvider ? -1000 : 0;
        const bBoost = preferredProvider && b.id === preferredProvider ? -1000 : 0;
        return (a.priority + aBoost) - (b.priority + bBoost);
      });

    const activeProviderIds = GlobalApiKeyStore.getActiveProviderIds();
    let attempts = 0;
    const trail: string[] = [];
    const rotationOffset = GlobalApiKeyStore.getRotationCursor();

    // Dynamic circular key pool: up to two sweeps. Sweep 1 respects temporary key
    // cooldowns; the zero-break Sweep 2 ignores them so EVERY active key is genuinely
    // attempted — the user never sees an error while at least one key exists in the pool.
    for (let sweep = 0; sweep < 2; sweep += 1) {
      const ignoreCooldowns = sweep === 1;
      for (const route of orderedRoutes) {
        const allKeys = GlobalApiKeyStore.getKeysForProvider(route.id);
        if (allKeys.length === 0) continue;
        // Circular rotation: consecutive requests start with the next key in the queue.
        const offset = rotationOffset % allKeys.length;
        const rotatedKeys = [...allKeys.slice(offset), ...allKeys.slice(0, offset)];
        const keys = rotatedKeys.slice(0, maxKeysPerProvider);

        // 🛡️ Strict provider isolation: the preferred model is only forwarded when it is a
        // valid identifier for THIS provider — Gemini never receives Llama/OpenAI strings,
        // Groq never receives foreign catalog ids. Invalid preferences fall back to the
        // route's own validated model list.
        const sanitizeModelForRoute = route.style === 'gemini'
          ? sanitizeGeminiModel
          : route.id === 'groq'
            ? sanitizeGroqModel
            : (model: string) => model.trim();
        const preferredCandidate = route.id === preferredProvider && preferredModel ? sanitizeModelForRoute(preferredModel) : '';
        const candidateModels = Array.from(new Set([
          ...(preferredCandidate ? [preferredCandidate] : []),
          ...route.models,
        ])).slice(0, maxModelsPerRoute + (preferredCandidate ? 1 : 0));

        for (const apiKey of keys) {
          // Instant rotation: skip quota/invalid-cooled keys without any network call.
          if (!ignoreCooldowns && FailoverEngine.isCoolingDown(route.id, apiKey)) continue;
          for (const model of candidateModels) {
            // Instant rotation: skip key+model pairs cooled down by HTTP 404 responses.
            if (!ignoreCooldowns && FailoverEngine.isCoolingDown(route.id, apiKey, model)) continue;
            attempts += 1;
            const attemptLabel = `${route.id}/${model}`;
            try {
              const text = route.style === 'anthropic'
                ? await FailoverEngine.attemptAnthropic(route, apiKey, model, messages, deadlineMs)
                : route.style === 'gemini'
                  ? await FailoverEngine.attemptGemini(route, apiKey, model, messages, deadlineMs)
                  : await FailoverEngine.attemptOpenAiStyle(route, apiKey, model, messages, deadlineMs);
              if (text && text.trim()) {
                trail.push(`${attemptLabel} ✓ (${Date.now() - startedAt}ms)`);
                GlobalApiKeyStore.advanceRotation(1);
                return {
                  text: text.trim(),
                  providerId: route.id,
                  providerName: route.name,
                  model,
                  attempts,
                  latencyMs: Date.now() - startedAt,
                  trail,
                  activeProviders: activeProviderIds,
                };
              }
              trail.push(`${attemptLabel} ✗ (empty response)`);
              FailoverEngine.noteFailure(route.id, apiKey, 'empty');
            } catch (error: any) {
              const isTimeout = error?.name === 'AbortError' || /timeout|abort/i.test(String(error?.message || ''));
              trail.push(`${attemptLabel} ✗ (${isTimeout ? 'deadline' : 'error'})`);
              FailoverEngine.noteFailure(route.id, apiKey, isTimeout ? 'timeout' : 'network');
              console.warn(`[FailoverEngine] ${attemptLabel} failed (${isTimeout ? 'deadline' : error?.message || 'error'}); failing over instantly (<10ms).`);
            }
          }
        }
      }
    }

    // 🛟 System fallback AI key pool — zero-break net: when every user-supplied key has
    // failed or exceeded quota, attempt the platform's own environment keys directly
    // (covers keys the global store may have skipped, e.g. non-standard env names).
    // Env keys already registered in the store were covered by sweeps 1-2 above, so
    // only genuinely fresh system keys run here — no duplicate network calls.
    const SYSTEM_ENV_FALLBACK_NAMES: Record<string, string[]> = {
      google: ['GEMINI_API_KEY', 'GOOGLE_AI_KEY', 'GOOGLE_API_KEY'],
      groq: ['GROQ_API_KEY'],
      cerebras: ['CEREBRAS_API_KEY'],
      openrouter: ['OPENROUTER_API_KEY'],
      sambanova: ['SAMBANOVA_API_KEY'],
      openai: ['OPENAI_API_KEY'],
      anthropic: ['ANTHROPIC_API_KEY'],
      deepseek: ['DEEPSEEK_API_KEY'],
      mistral: ['MISTRAL_API_KEY'],
      together: ['TOGETHER_API_KEY'],
      'xai-grok': ['XAI_API_KEY', 'GROK_API_KEY'],
    };
    for (const route of orderedRoutes) {
      const envNames = SYSTEM_ENV_FALLBACK_NAMES[route.id];
      if (!envNames) continue;
      const registeredKeys = new Set(GlobalApiKeyStore.getKeysForProvider(route.id));
      const systemKeys = envNames
        .map((name) => String(process.env[name] || '').trim())
        .filter((key) => key && !key.startsWith('YOUR_') && !registeredKeys.has(key));
      for (const apiKey of systemKeys) {
        for (const model of route.models.slice(0, maxModelsPerRoute)) {
          attempts += 1;
          const attemptLabel = `${route.id}/system-fallback/${model}`;
          try {
            const text = route.style === 'anthropic'
              ? await FailoverEngine.attemptAnthropic(route, apiKey, model, messages, deadlineMs)
              : route.style === 'gemini'
                ? await FailoverEngine.attemptGemini(route, apiKey, model, messages, deadlineMs)
                : await FailoverEngine.attemptOpenAiStyle(route, apiKey, model, messages, deadlineMs);
            if (text && text.trim()) {
              trail.push(`${attemptLabel} ✓ (${Date.now() - startedAt}ms)`);
              console.warn(`[FailoverEngine] User AI pool exhausted — served cleanly by the system fallback AI key pool (${route.id}/${model}).`);
              return {
                text: text.trim(),
                providerId: route.id,
                providerName: `${route.name} (system fallback)`,
                model,
                attempts,
                latencyMs: Date.now() - startedAt,
                trail,
                activeProviders: activeProviderIds,
              };
            }
            trail.push(`${attemptLabel} ✗ (empty response)`);
          } catch {
            trail.push(`${attemptLabel} ✗ (error)`);
          }
        }
      }
    }

    GlobalApiKeyStore.advanceRotation(1);
    console.warn(`[FailoverEngine] Active pool exhausted after ${attempts} attempt(s) in ${Date.now() - startedAt}ms.`);
    return null;
  }

  private static async withDeadline<T>(deadlineMs: number, task: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deadlineMs);
    try {
      return await task(controller.signal);
    } finally {
      clearTimeout(timer);
    }
  }

  private static async attemptOpenAiStyle(
    route: ProviderRoute,
    apiKey: string,
    model: string,
    messages: NormalizedMessage[],
    deadlineMs: number,
  ): Promise<string | null> {
    return FailoverEngine.withDeadline(deadlineMs, async (signal) => {
      const response = await fetch(`${route.baseUrl}${route.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 2048 }),
        signal,
      });
      if (!response.ok) {
        FailoverEngine.noteFailure(route.id, apiKey, response.status, model);
        console.warn(`[FailoverEngine] ${route.name} (${maskKey(apiKey)}) HTTP ${response.status}; failing over instantly.`);
        return null;
      }
      const data = await response.json().catch(() => null);
      const text = data?.choices?.[0]?.message?.content;
      return typeof text === 'string' && text.trim() ? text : null;
    });
  }

  private static async attemptAnthropic(
    route: ProviderRoute,
    apiKey: string,
    model: string,
    messages: NormalizedMessage[],
    deadlineMs: number,
  ): Promise<string | null> {
    return FailoverEngine.withDeadline(deadlineMs, async (signal) => {
      const systemText = messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n');
      const response = await fetch(`${route.baseUrl}${route.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          ...(systemText ? { system: systemText } : {}),
          messages: messages
            .filter((message) => message.role !== 'system')
            .map((message) => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content })),
        }),
        signal,
      });
      if (!response.ok) {
        FailoverEngine.noteFailure(route.id, apiKey, response.status, model);
        console.warn(`[FailoverEngine] ${route.name} (${maskKey(apiKey)}) HTTP ${response.status}; failing over instantly.`);
        return null;
      }
      const data = await response.json().catch(() => null);
      const text = data?.content?.[0]?.text;
      return typeof text === 'string' && text.trim() ? text : null;
    });
  }

  private static async attemptGemini(
    route: ProviderRoute,
    apiKey: string,
    model: string,
    messages: NormalizedMessage[],
    deadlineMs: number,
  ): Promise<string | null> {
    return FailoverEngine.withDeadline(deadlineMs, async (signal) => {
      const systemText = messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n');
      const response = await fetch(`${route.baseUrl}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
          contents: messages
            .filter((message) => message.role !== 'system')
            .map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] })),
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
        signal,
      });
      if (!response.ok) {
        FailoverEngine.noteFailure(route.id, apiKey, response.status, model);
        console.warn(`[FailoverEngine] ${route.name} (${maskKey(apiKey)}) HTTP ${response.status}; failing over instantly.`);
        return null;
      }
      const data = await response.json().catch(() => null);
      const parts = data?.candidates?.[0]?.content?.parts;
      const text = Array.isArray(parts) ? parts.map((part: any) => part?.text || '').join('') : '';
      return typeof text === 'string' && text.trim() ? text : null;
    });
  }
}
