import crypto from 'crypto';
import { ServerDatabase } from './db';
import { AI_PROVIDER_GATEWAYS_100 } from '../src/data/aiProviders100';

/**
 * Global Server-Side API Key Store
 *
 * A single in-memory, high-speed registry that merges API keys from every source:
 *   1. `environment` — server .env variables (PROVIDER_API_KEY / _TOKEN / _KEY, numbered variants)
 *   2. `database`    — persistent ServerDatabase botConfigs (apiGatewayKeys + legacy key fields)
 *   3. `runtime`     — keys saved live through /api/ai/save-key and /api/user/config
 *
 * Every backend consumer (Telegram bot worker, multi-channel gateway, cron workers,
 * centralized AI proxy) resolves keys through this store, so a key saved anywhere
 * instantly becomes available everywhere. Key material is never logged in full.
 */

export type ApiKeySource = 'database' | 'environment' | 'runtime';

export interface ApiKeyEntry {
  provider: string;
  key: string;
  source: ApiKeySource;
  label: string;
  registeredAt: number;
}

export interface ApiKeyPoolStats {
  providers: number;
  keys: number;
  bySource: Record<ApiKeySource, number>;
  activeProviders: string[];
  updatedAt: string;
}

/** Messaging platform credentials must never be treated as AI provider keys. */
const MESSAGING_PROVIDER_IDS = new Set([
  'telegram', 'discord', 'slack', 'whatsapp', 'twilio', 'line', 'matrix', 'openai-compatible',
]);

/** Normalizes provider id spelling variants (e.g. gemini -> google, xai -> xai-grok). */
const PROVIDER_ALIASES: Record<string, string> = {
  gemini: 'google',
  google_ai: 'google',
  googleai: 'google',
  nvidia_nim: 'nvidia',
  xai: 'xai-grok',
  grok: 'xai-grok',
  hf: 'huggingface',
  hugging_face: 'huggingface',
  dashscope: 'qwen',
  github_models: 'github',
  vercelai: 'vercel',
  perplexity_sonar: 'perplexity-sonar',
};

/** ENV-name fragment -> canonical provider id (covers all 100 gateways + aliases). */
const NAME_TO_PROVIDER: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const gateway of AI_PROVIDER_GATEWAYS_100) {
    map[gateway.id.toUpperCase()] = gateway.id;
    map[gateway.id.toUpperCase().replace(/-/g, '_')] = gateway.id;
  }
  Object.assign(map, {
    GEMINI: 'google',
    GOOGLE: 'google',
    GOOGLE_AI: 'google',
    GOOGLE_GENERATIVE_AI: 'google',
    NVIDIA_NIM: 'nvidia',
    XAI: 'xai-grok',
    GROK: 'xai-grok',
    HF: 'huggingface',
    HUGGING_FACE: 'huggingface',
    DASHSCOPE: 'qwen',
    GITHUB_MODELS: 'github',
    VERCELAI: 'vercel',
    PERPLEXITY_SONAR: 'perplexity-sonar',
  });
  return map;
})();

/** Canonical provider id -> every known environment variable alias for that provider. */
const PROVIDER_ENV_ALIASES: Record<string, string[]> = {
  openai: ['OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
  google: ['GEMINI_API_KEY', 'GOOGLE_AI_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
  groq: ['GROQ_API_KEY'],
  openrouter: ['OPENROUTER_API_KEY'],
  cerebras: ['CEREBRAS_API_KEY'],
  sambanova: ['SAMBANOVA_API_KEY'],
  mistral: ['MISTRAL_API_KEY'],
  deepseek: ['DEEPSEEK_API_KEY'],
  together: ['TOGETHER_API_KEY', 'TOGETHERAI_API_KEY'],
  nvidia: ['NVIDIA_API_KEY', 'NVIDIA_NIM_API_KEY'],
  huggingface: ['HUGGINGFACE_API_KEY', 'HUGGING_FACE_API_KEY', 'HF_TOKEN'],
  'xai-grok': ['XAI_API_KEY', 'GROK_API_KEY'],
  github: ['GITHUB_TOKEN', 'GITHUB_MODELS_TOKEN', 'GITHUB_API_KEY'],
  replicate: ['REPLICATE_API_TOKEN', 'REPLICATE_API_KEY'],
  cloudflare: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_KEY'],
  qwen: ['QWEN_API_KEY', 'DASHSCOPE_API_KEY'],
  chutes: ['CHUTES_API_KEY'],
  vercel: ['VERCEL_AI_TOKEN'],
  fal: ['FAL_KEY'],
  friendli: ['FRIENDLI_TOKEN', 'FRIENDLI_API_KEY'],
  voyage: ['VOYAGE_API_KEY'],
  cohere: ['COHERE_API_KEY'],
  moonshot: ['MOONSHOT_API_KEY'],
  zhipu: ['ZHIPU_API_KEY'],
  minimax: ['MINIMAX_API_KEY'],
  upstage: ['UPSTAGE_API_KEY'],
  jina: ['JINA_API_KEY'],
  writer: ['WRITER_API_KEY'],
  lepton: ['LEPTON_API_KEY'],
  ai21: ['AI21_API_KEY'],
  anyscale: ['ANYSCALE_API_KEY'],
  perplexity: ['PERPLEXITY_API_KEY'],
  fireworks: ['FIREWORKS_API_KEY'],
  hyperbolic: ['HYPERBOLIC_API_KEY'],
  novita: ['NOVITA_API_KEY'],
  siliconflow: ['SILICONFLOW_API_KEY'],
  deepinfra: ['DEEPINFRA_API_KEY'],
};

/** Legacy BotConfig field -> canonical provider id (botConfigs saved by the dashboard). */
const CONFIG_FIELD_PROVIDER: Record<string, string> = {
  groqApiKey: 'groq',
  geminiApiKey: 'google',
  cerebrasApiKey: 'cerebras',
  openrouterApiKey: 'openrouter',
  mistralApiKey: 'mistral',
  sambanovaApiKey: 'sambanova',
  huggingfaceApiKey: 'huggingface',
  deepseekApiKey: 'deepseek',
  cohereApiKey: 'cohere',
  nvidiaNimApiKey: 'nvidia',
  togetherApiKey: 'together',
  deepinfraApiKey: 'deepinfra',
  chutesApiKey: 'chutes',
  voyageApiKey: 'voyage',
  replicateApiToken: 'replicate',
  vercelAiToken: 'vercel',
  githubToken: 'github',
  cloudflareApiToken: 'cloudflare',
};

function normalizeProviderId(rawProvider: string): string {
  const normalized = String(rawProvider || '').trim().toLowerCase().replace(/\s+/g, '-');
  if (!normalized) return '';
  return PROVIDER_ALIASES[normalized] || normalized;
}

function isValidKeyCandidate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < 8 || trimmed.length > 512) return false;
  if (/\s/.test(trimmed)) return false;
  if (/^(your_|xxx+|placeholder|none|null|undefined|sample|test)/i.test(trimmed)) return false;
  return true;
}

export function maskKey(key: string): string {
  const trimmed = String(key || '');
  if (trimmed.length <= 10) return `${trimmed.slice(0, 2)}***`;
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}

function hashKey(key: string): string {
  return crypto.createHash('sha1').update(key).digest('hex').slice(0, 12);
}

export class GlobalApiKeyStore {
  private static providerKeys = new Map<string, Map<string, ApiKeyEntry>>();
  private static nameIndex = new Map<string, Set<string>>();
  private static lastSyncedAt = '';

  public static normalizeProvider(rawProvider: string): string {
    return normalizeProviderId(rawProvider);
  }

  /** Resolves an env-style name (e.g. GEMINI_API_KEY_2) to its canonical provider id. */
  public static resolveProviderFromName(rawName: string): string | null {
    const base = String(rawName || '')
      .toUpperCase()
      .replace(/_(API_KEY|APIKEY|TOKEN|KEY)$/, '')
      .replace(/_\d{1,2}$/, '');
    return NAME_TO_PROVIDER[base] || null;
  }

  public static register(rawProvider: string, rawKey: string, source: ApiKeySource, originName?: string): boolean {
    const provider = normalizeProviderId(rawProvider);
    if (!provider || MESSAGING_PROVIDER_IDS.has(provider)) return false;
    if (!isValidKeyCandidate(rawKey)) return false;
    const key = String(rawKey).trim();

    if (!GlobalApiKeyStore.providerKeys.has(provider)) {
      GlobalApiKeyStore.providerKeys.set(provider, new Map());
    }
    GlobalApiKeyStore.providerKeys.get(provider)!.set(key, {
      provider,
      key,
      source,
      label: `${provider}:${hashKey(key)}`,
      registeredAt: Date.now(),
    });

    const names = new Set<string>([
      `${provider.toUpperCase()}_API_KEY`,
      `${provider.toUpperCase()}_TOKEN`,
      `${provider.toUpperCase()}_KEY`,
      ...(PROVIDER_ENV_ALIASES[provider] || []),
    ]);
    if (originName) names.add(originName.toUpperCase());
    for (const name of names) {
      if (!GlobalApiKeyStore.nameIndex.has(name)) GlobalApiKeyStore.nameIndex.set(name, new Set());
      GlobalApiKeyStore.nameIndex.get(name)!.add(key);
    }
    return true;
  }

  public static getKeysForProvider(rawProvider: string): string[] {
    const provider = normalizeProviderId(rawProvider);
    if (!provider) return [];
    return Array.from(GlobalApiKeyStore.providerKeys.get(provider)?.keys() || []);
  }

  /** Looks keys up by exact env-style name, falling back to the resolved provider bucket. */
  public static lookupByName(rawName: string): string[] {
    const name = String(rawName || '').trim().toUpperCase();
    const direct = GlobalApiKeyStore.nameIndex.get(name);
    if (direct && direct.size > 0) return Array.from(direct);
    const provider = GlobalApiKeyStore.resolveProviderFromName(name);
    return provider ? GlobalApiKeyStore.getKeysForProvider(provider) : [];
  }

  public static hasAnyKeys(): boolean {
    for (const bucket of GlobalApiKeyStore.providerKeys.values()) {
      if (bucket.size > 0) return true;
    }
    return false;
  }

  public static getActiveProviderIds(): string[] {
    return Array.from(GlobalApiKeyStore.providerKeys.entries())
      .filter(([, bucket]) => bucket.size > 0)
      .map(([provider]) => provider)
      .sort();
  }

  public static getStats(): ApiKeyPoolStats {
    let total = 0;
    const bySource: Record<ApiKeySource, number> = { database: 0, environment: 0, runtime: 0 };
    for (const bucket of GlobalApiKeyStore.providerKeys.values()) {
      for (const entry of bucket.values()) {
        total += 1;
        bySource[entry.source] += 1;
      }
    }
    return {
      providers: GlobalApiKeyStore.getActiveProviderIds().length,
      keys: total,
      bySource,
      activeProviders: GlobalApiKeyStore.getActiveProviderIds(),
      updatedAt: GlobalApiKeyStore.lastSyncedAt,
    };
  }

  public static bootstrap(): ApiKeyPoolStats {
    GlobalApiKeyStore.loadFromEnvironment();
    return GlobalApiKeyStore.syncFromDatabase();
  }

  public static loadFromEnvironment(): number {
    let loaded = 0;
    for (const [envName, envValue] of Object.entries(process.env)) {
      if (!envValue) continue;
      const match = envName.match(/^([A-Z][A-Z0-9_]+)_(API_KEY|APIKEY|TOKEN|KEY)(?:_(\d{1,2}))?$/);
      const provider = match ? GlobalApiKeyStore.resolveProviderFromName(match[1]) : null;
      if (!provider) continue;
      if (GlobalApiKeyStore.register(provider, envValue, 'environment', envName)) loaded += 1;
    }
    return loaded;
  }

  /** Pulls keys from every persisted bot configuration in the server database. */
  public static syncFromDatabase(): ApiKeyPoolStats {
    try {
      const configs = ServerDatabase.getAllBotConfigs();
      let loaded = 0;
      for (const { config } of configs) {
        if (!config || typeof config !== 'object') continue;
        const gatewayKeys = (config as { apiGatewayKeys?: Record<string, unknown> }).apiGatewayKeys;
        if (gatewayKeys && typeof gatewayKeys === 'object') {
          for (const [provider, value] of Object.entries(gatewayKeys)) {
            if (GlobalApiKeyStore.register(provider, String(value ?? ''), 'database')) loaded += 1;
          }
        }
        for (const [field, value] of Object.entries(config)) {
          const provider = CONFIG_FIELD_PROVIDER[field] || GlobalApiKeyStore.resolveProviderFromField(field);
          if (!provider) continue;
          if (GlobalApiKeyStore.register(provider, String(value ?? ''), 'database')) loaded += 1;
        }
      }
      GlobalApiKeyStore.lastSyncedAt = new Date().toISOString();
      const stats = GlobalApiKeyStore.getStats();
      console.log(
        `🔑 [KeyStore] Global pool synced — ${stats.providers} provider(s), ${stats.keys} key(s) ` +
        `[database: ${stats.bySource.database}, environment: ${stats.bySource.environment}, runtime: ${stats.bySource.runtime}] (+${loaded} from DB).`,
      );
      return stats;
    } catch (error: any) {
      console.warn('[KeyStore] Database sync skipped safely:', error?.message || error);
      return GlobalApiKeyStore.getStats();
    }
  }

  private static resolveProviderFromField(field: string): string | null {
    const match = String(field).match(/^(.+?)(ApiKey|ApiToken|Token|Key)$/);
    if (!match) return null;
    return NAME_TO_PROVIDER[match[1].toUpperCase()] || null;
  }
}

