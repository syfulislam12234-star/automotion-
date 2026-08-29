export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'developer' | 'operator' | 'viewer';
  isVerified: boolean;
  verificationCode?: string;
  verificationCodeExpiresAt?: number;
  createdAt: string;
  lastLoginAt: string;
  avatarUrl?: string;
  bio?: string;
}

export interface AuthSession {
  token: string;
  user: UserAccount;
  expiresAt: number;
  isVerified: boolean;
  adminAuthorized?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot' | 'system';
  text: string;
  timestamp: string;
  platform?: string;
  provider?: string;
  isCommand?: boolean;
  imageUrl?: string;
  fileName?: string;
  tokensCount?: number;
  latencyMs?: number;
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  messages: ChatMessage[];
  pinned?: boolean;
}

export type MessengerPlatformId =
  | 'telegram'
  | 'whatsapp'
  | 'line'
  | 'discord'
  | 'slack'
  | 'messenger'
  | 'signal'
  | 'viber'
  | 'teams'
  | 'webhook';

export interface MessengerProtocolInfo {
  id: MessengerPlatformId;
  name: string;
  iconName: string;
  badge: string;
  themeColor: string;
  bubbleColor: string;
  endpoint: string;
  keyField: string;
  enabledField: string;
  formatGuide: string;
  sampleMessage: string;
}

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

  // Hybrid AI Ensemble & Super-Brain System
  enableHybridEnsemble: boolean;
  ensembleStrategy: string;
  ensemblePrimaryProviders: string[];
  ensembleTimeoutMs: number;
  enableEnsembleComparisonTelemetry: boolean;

  // Multi-Provider & Key Rotation (100 AI Providers)
  enableMultiProviderFallback: boolean;
  groqKeysCount: number;
  keyCooldownSeconds: number;
  apiGatewayKeys: Record<string, string>;

  // 1. Google AI Studio
  enableGeminiFallback: boolean;
  geminiModel: string;
  geminiApiKey: string;

  // 2. Groq
  groqModel: string;
  groqApiKey: string;

  // 3. OpenRouter
  enableOpenRouterFallback: boolean;
  openrouterModel: string;
  openrouterApiKey: string;

  // 4. Cerebras
  enableCerebrasFallback: boolean;
  cerebrasModel: string;
  cerebrasApiKey: string;

  // 5. Mistral AI
  enableMistralFallback: boolean;
  mistralModel: string;
  mistralApiKey: string;

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

  // 9. Cohere
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
  togetherApiKey: string;

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

  // Admin Alerting & Heartbeats
  adminTelegramId: string;
  discordAdminWebhookUrl: string;
  enableAdminAlerts: boolean;
  enableHeartbeatNotifications: boolean;

  // Telegram Admin Bot Controller
  enableTelegramAdminController: boolean;
  telegramAdminBotToken: string;
  telegramAdminChatId: string;
  telegramAdminStrictWhitelist: boolean;
  telegramAdminAllowRestart: boolean;

  // 10 Platform Messaging Gateways
  enableTelegram: boolean;
  telegramBotToken: string;

  enableDiscord: boolean;
  discordBotToken: string;

  enableSlack: boolean;
  slackBotToken: string;
  slackAppToken: string;
  slackSigningSecret: string;

  enableWhatsApp: boolean;
  whatsappPhoneNumberId: string;
  whatsappAccessToken: string;
  whatsappVerifyToken: string;

  enableTwilio: boolean;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  twilioToNumber: string;

  enableLine: boolean;
  lineChannelSecret: string;
  lineChannelAccessToken: string;

  enableMatrix: boolean;
  matrixHomeserver: string;
  matrixUserId: string;
  matrixAccessToken: string;
  matrixRoomId: string;

  enablePyrogram: boolean;
  pyrogramApiId: string;
  pyrogramApiHash: string;
  pyrogramSessionString: string;

  enableApprise: boolean;
  appriseUrls: string;

  enablePushover: boolean;
  pushoverUserKey: string;
  pushoverAppToken: string;

  // YouTube OAuth2 & AI SEO Automation
  enableYouTubeAutomation: boolean;
  youtubeApiKey: string;
  youtubeClientId: string;
  youtubeClientSecret: string;
  youtubeRefreshToken: string;
  youtubeChannelId: string;
  youtubeDefaultCategory: string;
  youtubeDefaultPrivacy: string;
  enableYtAutoSeo: boolean;
  enableYtAutoUploadQueue: boolean;

  // Cloud & Deployment Settings
  deploymentMode: string;
  serverPort: number;
  webhookUrl: string;

  // Pro SaaS Customer Profile & Subscription Tiers
  userProfileName: string;
  userPlanTier: string;

  // VPS / Cloud Server Management & Monitoring
  vpsServerName: string;
  vpsApiBaseUrl: string;
  vpsAuthBearerToken: string;
  vpsPollIntervalSeconds: number;
  vpsAutoReconnect: boolean;

  // n8n Webhook & Automation Integration
  n8nWebhookUrl: string;
  n8nAlertsEnabled: boolean;
  n8nEventTriggers: {
    onStatusChange: boolean;
    onHighCpu: boolean;
    onRestart: boolean;
    onFailover: boolean;
    onSecurityAlert: boolean;
  };

  // Facebook Messenger API Configuration
  messengerPageAccessToken: string;
  messengerAppSecret: string;
  messengerVerifyToken: string;
  messengerGraphApiVersion: string;
  messengerGetStartedEnabled: boolean;
  messengerGetStartedPayload: string;
  messengerGreetingText: string;
  messengerPersistentMenu: string;
}

// ==========================================
// E-commerce Business Client CRM
// ==========================================
export type CrmPlatform = 'messenger' | 'whatsapp' | 'telegram';
export type CrmOrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered';
export type CrmAgentMode = 'ai' | 'human';

export interface CrmOrder {
  id: string;
  productName: string;
  quantity: number;
  amount: number;
  currency: string;
  status: CrmOrderStatus;
  createdAt: string;
}

export interface CrmCustomer {
  id: string;
  platform: CrmPlatform;
  platformUserId: string;
  name: string;
  avatarUrl?: string;
  orderStatus: CrmOrderStatus;
  agentMode: CrmAgentMode;
  purchaseHistory: CrmOrder[];
  createdAt: string;
  lastActiveAt: string;
}

export interface CrmMessage {
  id: string;
  customerId: string;
  customerName: string;
  platform: CrmPlatform;
  direction: 'inbound' | 'outbound';
  text: string;
  createdAt: string;
}

// ==========================================
// Custom AI Knowledge Base & Store Trainer
// ==========================================
export interface KnowledgeProduct {
  id: string;
  name: string;
  price: string;
  specs: string;
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock';
}

export interface StorePolicyInfo {
  deliveryCharges: string;
  shippingTime: string;
  returnPolicy: string;
  refundPolicy: string;
}

export interface KnowledgeFaq {
  id: string;
  question: string;
  answer: string;
}

export interface StoreKnowledge {
  workspaceId: string;
  personaPrompt: string;
  products: KnowledgeProduct[];
  policies: StorePolicyInfo;
  faqs: KnowledgeFaq[];
  updatedAt: string;
}

export interface AiModelCatalogItem {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  contextWindow: number;
  costPer1kTokens?: number;
  speedRating: string;
  description: string;
  freeTier: boolean;
  category: 'ultra_fast' | 'reasoning' | 'balanced' | 'multimodal' | 'coding';
}

export interface VpsServerStatus {
  isOnline: boolean;
  statusText: string;
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
  level: string;
  source: string;
  message: string;
}

export interface MediaProvenanceScanResult {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'audio' | 'video';
  scannedAt: string;
  isAiGenerated: boolean;
  aiProbability: number;
  confidencePercentage: number;
  verdict: string;
  likelyModel: string;
  modelFamily: string;
  c2paManifestStatus: string;
  analysisStages: {
    metadata: { score: number; status: string; details: string };
    spectralFrequency: { score: number; status: string; checkerboardArtifacts: boolean; details: string };
    latentDiffusionResiduals: { score: number; status: string; details: string };
    anatomicalTemporalCoherence: { score: number; status: string; details: string };
  };
  forensicIndicators: Array<{ name: string; level: string; description: string }>;
  provenanceChain?: Array<{ step: string; status: string; details: string }>;
}

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  isUnread: boolean;
  isStarred: boolean;
  isDraft: boolean;
}

export interface GmailMessageDetail extends GmailMessageSummary {
  cc?: string;
  bcc?: string;
  bodyHtml?: string;
  bodyText?: string;
  headers: Record<string, string>;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }>;
}

export interface GmailLabel {
  id: string;
  name: string;
  type: 'system' | 'user';
  messagesTotal?: number;
  messagesUnread?: number;
}

