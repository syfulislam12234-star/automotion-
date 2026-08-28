export class TelemetryService {
  private static totalRequests = 0;
  private static successfulFailovers = 0;
  private static averageLatencyMs = 0;
  private static tokenCount = 0;
  private static interactions: Array<any> = [];

  public static getDashboardData() {
    const successfulInteractions = TelemetryService.interactions.filter((interaction) => interaction.success);
    const latencyTotal = TelemetryService.interactions.reduce((total, interaction) => total + interaction.latencyMs, 0);
    const providers = [...new Set(TelemetryService.interactions.map((interaction) => interaction.provider))];
    return {
      totalRequests: TelemetryService.totalRequests,
      successfulFailovers: TelemetryService.successfulFailovers,
      averageLatencyMs: TelemetryService.interactions.length ? Math.round(latencyTotal / TelemetryService.interactions.length) : 0,
      tokenCount: TelemetryService.tokenCount,
      uptimeSeconds: process.uptime(),
      providerHealth: providers.map((provider) => {
        const providerInteractions = TelemetryService.interactions.filter((interaction) => interaction.provider === provider);
        const providerFailures = providerInteractions.filter((interaction) => !interaction.success).length;
        const latency = Math.round(providerInteractions.reduce((total, interaction) => total + interaction.latencyMs, 0) / providerInteractions.length);
        return { provider, status: providerFailures ? 'degraded' : 'observed', latency: `${latency}ms`, uptime: `${(((providerInteractions.length - providerFailures) / providerInteractions.length) * 100).toFixed(2)}%` };
      }),
      recentInteractions: TelemetryService.interactions.slice(0, 20),
    };
  }

  public static async runLiveBenchmark(prompt?: string) {
    void prompt;
    return [];
  }

  public static recordInteraction(data: {
    provider?: string;
    providerId?: string;
    providerName?: string;
    model?: string;
    modelUsed?: string;
    latencyMs?: number;
    tokens?: number;
    success?: boolean;
    chatId?: string | number;
    error?: string;
    [key: string]: any;
  }) {
    TelemetryService.totalRequests++;
    TelemetryService.tokenCount += data.tokens || 0;
    TelemetryService.interactions.unshift({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      provider: data.provider || data.providerName || data.providerId || 'Groq',
      model: data.model || data.modelUsed || 'default',
      latencyMs: data.latencyMs || 0,
      tokens: data.tokens || 0,
      success: data.success === true,
      ...data,
    });
  }

  public static resetMetrics() {
    TelemetryService.totalRequests = 0;
    TelemetryService.successfulFailovers = 0;
    TelemetryService.interactions = [];
  }
}
