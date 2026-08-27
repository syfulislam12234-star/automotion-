export interface TelegramAdminConfig {
  enabled: boolean;
  isEnabled?: boolean;
  botToken?: string;
  adminBotToken?: string;
  adminChatId: string;
  strictWhitelist: boolean;
  allowedCommands: string[];
  autoRestartOnCrash: boolean;
  allowRestart?: boolean;
}

export class TelegramAdminService {
  private static config: TelegramAdminConfig = {
    enabled: true,
    isEnabled: true,
    botToken: '',
    adminBotToken: '',
    adminChatId: '',
    strictWhitelist: true,
    allowedCommands: ['/status', '/restart', '/stats', '/broadcast', '/clear_memory', '/whitelist'],
    autoRestartOnCrash: true,
    allowRestart: true,
  };

  private static logs: Array<{ id: string; timestamp: string; level: string; message: string; user?: string }> = [
    { id: '1', timestamp: new Date().toISOString(), level: 'info', message: 'Telegram Admin Controller service initialized.' },
  ];

  public static getConfig(): TelegramAdminConfig {
    return {
      ...TelegramAdminService.config,
      adminBotToken: TelegramAdminService.config.adminBotToken || TelegramAdminService.config.botToken || '',
      isEnabled: TelegramAdminService.config.enabled,
    };
  }

  public static updateConfig(partial: Partial<TelegramAdminConfig>): TelegramAdminConfig {
    if (partial.isEnabled !== undefined && partial.enabled === undefined) {
      partial.enabled = partial.isEnabled;
    }
    if (partial.adminBotToken !== undefined && partial.botToken === undefined) {
      partial.botToken = partial.adminBotToken;
    }
    if (partial.allowRestart !== undefined) {
      partial.autoRestartOnCrash = partial.allowRestart;
    }
    TelegramAdminService.config = { ...TelegramAdminService.config, ...partial };
    TelegramAdminService.logs.unshift({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Telegram Admin configuration updated.',
    });
    return TelegramAdminService.getConfig();
  }

  public static getLogs() {
    return TelegramAdminService.logs.slice(0, 50);
  }

  public static executeCommand(params: {
    command: string;
    args?: string;
    adminUserId?: string;
    chatId?: string;
    username?: string;
    source?: string;
  }) {
    const { command, args, adminUserId, username, source } = params;
    const logEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Admin command executed (${source || 'dashboard'}): ${command} ${args || ''}`.trim(),
      user: adminUserId || username || 'system',
    };
    TelegramAdminService.logs.unshift(logEntry);

    const outText = `[AdminBot] Command ${command} executed successfully. Timestamp: ${new Date().toISOString()}`;
    return {
      success: true,
      command,
      output: outText,
      response: outText,
      timestamp: new Date().toISOString(),
    };
  }
}
