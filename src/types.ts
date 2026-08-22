export interface BotConfig {
  modelName: string;
  maxMemoryTurns: number;
  memoryTtlMinutes: number;
  temperature: number;
  maxOutputTokens: number;
  systemPrompt: string;
  botName: string;
  enableAdminWhitelist: boolean;
  adminUserIds: string;
  enableStreamTyping: boolean;
  enableMarkdownV2: boolean;
  enableStatsCommand: boolean;
  enableCustomPromptCommand: boolean;
  
  // Multi-Provider & Key Rotation (20 AI Providers)
  enableMultiProviderFallback: boolean;
  groqKeysCount: number;
  keyCooldownSeconds: number;
  
  // 1. Google AI Studio
  enableGeminiFallback: boolean;
  geminiModel: string;
  geminiApiKey?: string;

  // 2. Groq
  groqModel: string;
  groqApiKey?: string;
  
  // 3. OpenRouter
  enableOpenRouterFallback: boolean;
  openrouterModel: string;
  openrouterApiKey?: string;

  // 4. Cerebras
  enableCerebrasFallback: boolean;
  cerebrasModel: string;
  cerebrasApiKey?: string;

  // 5. Mistral AI
  enableMistralFallback: boolean;
  mistralModel: string;
  mistralApiKey?: string;

  // 6. Cloudflare Workers AI
  enableCloudflareFallback: boolean;
  cloudflareAccountId: string;
  cloudflareApiToken: string;
  cloudflareModel: string;

  // 7. GitHub Models
  enableGithubModelsFallback: boolean;
  githubToken: string;
  githubModel: string;

  // 8. Hugging Face
  enableHuggingFaceFallback: boolean;
  huggingfaceApiKey: string;
  huggingfaceModel: string;

  // 9. Pollinations AI (Zero key free)
  enablePollinationsFallback: boolean;
  pollinationsModel: string;

  // 10. Cohere
  enableCohereFallback: boolean;
  cohereApiKey: string;
  cohereModel: string;

  // 11. NVIDIA NIM
  enableNvidiaNimFallback: boolean;
  nvidiaNimApiKey: string;
  nvidiaNimModel: string;

  // 12. Together AI
  enableTogetherFallback: boolean;
  togetherModel: string;
  togetherApiKey?: string;

  // 13. SambaNova
  enableSambaNovaFallback: boolean;
  sambanovaApiKey: string;
  sambanovaModel: string;

  // 14. DeepInfra
  enableDeepInfraFallback: boolean;
  deepinfraApiKey: string;
  deepinfraModel: string;

  // 15. Chutes AI
  enableChutesFallback: boolean;
  chutesApiKey: string;
  chutesModel: string;

  // 16. Voyage AI
  enableVoyageFallback: boolean;
  voyageApiKey: string;
  voyageModel: string;

  // 17. Replicate
  enableReplicateFallback: boolean;
  replicateApiToken: string;
  replicateModel: string;

  // 18. Vercel AI Gateway
  enableVercelAiFallback: boolean;
  vercelAiToken: string;
  vercelAiModel: string;

  // 19. DeepSeek Official
  enableDeepSeekFallback: boolean;
  deepseekApiKey: string;
  deepseekModel: string;

  // 20. Ollama Local Server
  enableOllamaFallback: boolean;
  ollamaBaseUrl: string;
  ollamaModel: string;

  // Admin Alerting & Heartbeat System
  adminTelegramId: string;
  discordAdminWebhookUrl: string;
  enableAdminAlerts: boolean;
  enableHeartbeatNotifications: boolean;
  
  // 10 Platform Messaging Gateways
  // 1. Telegram
  enableTelegram: boolean;
  telegramBotToken?: string;

  // 2. Discord
  enableDiscord: boolean;
  discordBotToken: string;

  // 3. Slack
  enableSlack: boolean;
  slackBotToken: string;
  slackAppToken: string;
  slackSigningSecret: string;

  // 4. WhatsApp Cloud API
  enableWhatsApp: boolean;
  whatsappPhoneNumberId: string;
  whatsappAccessToken: string;
  whatsappVerifyToken: string;

  // 5. Twilio API
  enableTwilio: boolean;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  twilioToNumber: string;

  // 6. Pushover API
  enablePushover: boolean;
  pushoverUserKey: string;
  pushoverAppToken: string;

  // 7. Pyrogram MTProto
  enablePyrogram: boolean;
  pyrogramApiId: string;
  pyrogramApiHash: string;
  pyrogramSessionString: string;

  // 8. Line Messaging API
  enableLine: boolean;
  lineChannelSecret: string;
  lineChannelAccessToken: string;

  // 9. Matrix / Element API
  enableMatrix: boolean;
  matrixHomeserver: string;
  matrixUserId: string;
  matrixAccessToken: string;
  matrixRoomId: string;

  // 10. Apprise Notification API
  enableApprise: boolean;
  appriseUrls: string;

  // YouTube OAuth & Automation Suite
  enableYouTubeAutomation: boolean;
  youtubeClientId: string;
  youtubeClientSecret: string;
  youtubeRefreshToken: string;
  youtubeChannelId: string;
  youtubeDefaultCategory: string;
  youtubeDefaultPrivacy: 'public' | 'unlisted' | 'private';
  enableYtAutoSeo: boolean;
  enableYtAutoUploadQueue: boolean;

  // Cloud & Deployment Settings
  deploymentMode: 'polling_with_health' | 'webhook' | 'pure_polling';
  serverPort: number;
  webhookUrl: string;

  // Architecture & Operating Model (Hybrid Managed Pro Plan vs Self-Managed)
  architectureMode?: 'hybrid_managed_pro' | 'self_managed';
  useCentralizedAiEngine?: boolean;
  useCentralizedVpsCluster?: boolean;
  userProfileName?: string;
  userPlanTier?: 'pro_managed' | 'free_custom' | 'enterprise';

  // Code Studio Privacy & Admin Security Gate
  adminPin?: string;
  hideCodeStudioTab?: boolean;
  requireAdminPinForCode?: boolean;

  // VPS / Cloud Server Management & Monitoring
  vpsServerName?: string;
  vpsApiBaseUrl?: string;
  vpsAuthBearerToken?: string;
  vpsPollIntervalSeconds?: number;
  vpsAutoReconnect?: boolean;

  // n8n Webhook & Automation Integration
  n8nWebhookUrl?: string;
  n8nAlertsEnabled?: boolean;
  n8nEventTriggers?: {
    onStatusChange?: boolean;
    onHighCpu?: boolean;
    onRestart?: boolean;
    onFailover?: boolean;
    onSecurityAlert?: boolean;
  };
}

export interface VpsServerStatus {
  isOnline: boolean;
  statusText: 'running' | 'stopped' | 'restarting' | 'degraded' | 'offline';
  uptimeSeconds: number;
  cpuPercent: number;
  cpuCores: number;
  ramUsedMb: number;
  ramTotalMb: number;
  diskUsedGb: number;
  diskTotalGb: number;
  networkInKbps: number;
  networkOutKbps: number;
  activeProcesses: number;
  pythonVersion: string;
  osName: string;
  ipAddress: string;
  lastPingMs: number;
  lastUpdated: string;
}

export interface VpsServerLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SYSTEM' | 'CRON' | 'AUTH';
  source: string;
  message: string;
}

export interface GeneratedFile {
  name: string;
  filename: string;
  language: string;
  description: string;
  content: string;
  isImportant?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot' | 'system' | 'admin_alert';
  text: string;
  timestamp: string;
  platform?: 
    | 'telegram' 
    | 'discord' 
    | 'slack' 
    | 'whatsapp' 
    | 'twilio' 
    | 'pushover' 
    | 'pyrogram' 
    | 'line' 
    | 'matrix' 
    | 'apprise';
  isCommand?: boolean;
  chunks?: string[];
  providerUsed?: string;
  keyUsed?: string;
  alertType?: 'failover' | 'ratelimit' | 'startup' | 'shutdown' | 'error' | 'youtube_upload';
}

export interface UserMemoryItem {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface AIProviderStatus {
  id: string;
  name: string;
  category: 'primary' | 'ultra_fast' | 'reasoning' | 'vision_multimodal' | 'local_server' | 'zero_key';
  model: string;
  status: 'active' | 'standby' | 'rate_limited' | 'disabled' | 'testing';
  latencyMs: number;
  freeTierLimit: string;
  priority: number;
  endpoint: string;
  docsUrl: string;
}

export interface MessagingPlatformStatus {
  id: string;
  name: string;
  protocol: 'Polling' | 'WebSocket' | 'REST Webhook' | 'MTProto' | 'Matrix Matrix-Nio' | 'Universal Push';
  status: 'connected' | 'idle' | 'unconfigured' | 'error';
  messagesProcessed: number;
  activeWebhookUrl: string;
  icon: string;
}

export interface YouTubeUploadQueueItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  privacyStatus: 'public' | 'unlisted' | 'private';
  scheduledTime?: string;
  status: 'queued' | 'processing' | 'uploaded' | 'failed';
  videoFile: string;
  thumbnailFile?: string;
  videoId?: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'developer' | 'operator';
  isVerified: boolean;
  verificationCode?: string;
  createdAt: string;
  lastLoginAt: string;
  avatarUrl?: string;
  bio?: string;
}

export interface AuthSession {
  token: string;
  user: UserAccount;
  expiresAt: number;
}

export interface MediaProvenanceScanResult {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'audio';
  scannedAt: string;
  isAiGenerated: boolean;
  aiProbability: number;
  confidencePercentage: number;
  verdict: 'AI_SYNTHETIC' | 'AI_ASSISTED' | 'AUTHENTIC_NATURAL' | 'DEEPFAKE_MODIFIED';
  likelyModel: string;
  modelFamily: string;
  c2paManifestStatus: 'valid_c2pa' | 'synthid_detected' | 'stripped_metadata' | 'no_credentials';
  analysisStages: {
    metadata: { score: number; status: string; details: string };
    spectralFrequency: { score: number; status: string; checkerboardArtifacts: boolean; details: string };
    latentDiffusionResiduals: { score: number; status: string; details: string };
    anatomicalTemporalCoherence?: { score: number; status: string; details: string };
    acousticPhaseConsistency?: { score: number; status: string; details: string };
  };
  forensicIndicators: {
    name: string;
    level: 'low' | 'moderate' | 'high' | 'critical';
    description: string;
  }[];
  provenanceChain: {
    step: string;
    status: string;
    details: string;
  }[];
}
