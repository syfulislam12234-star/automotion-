/// <reference path="../ambient-modules.d.ts" />
declare const process: any;

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface DbUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'developer' | 'operator';
  isVerified: boolean;
  verificationCode?: string;
  passwordHash: string;
  passwordSalt: string;
  passwordAlgorithm?: 'scrypt' | 'pbkdf2';
  createdAt: string;
  lastLoginAt: string;
  avatarUrl?: string;
  bio?: string;
}

export interface DbSession {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: number;
  isVerified: boolean;
  adminAuthorized?: boolean;
}

interface PendingAdminRegistration {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  passwordAlgorithm: 'scrypt';
  otpHash: string;
  otpSalt: string;
  expiresAt: number;
  attempts: number;
  createdAt: string;
}

export interface DbChannelConnection {
  id: string;
  userId: string;
  platform: string;
  enabled: boolean;
  mode: 'polling' | 'webhook';
  credentials: Record<string, string>;
  modelId?: string;
  systemPrompt?: string;
  status: 'configured' | 'running' | 'error' | 'stopped';
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbSchema {
  version: number;
  lastSaved: string;
  users: DbUser[];
  sessions: DbSession[];
  botConfigs: Record<string, any>; // keyed by userId or email
  channels: Record<string, DbChannelConnection>;
    pendingAdminRegistrations?: Record<string, PendingAdminRegistration>;
  backupMetadata: {
    lastBackupAt?: string;
    backupCount: number;
  };
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'bot_database.json');

function hashPassword(password: string, salt?: string): { hash: string; salt: string; algorithm: 'scrypt' } {
  const finalSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, finalSalt, 64).toString('hex');
  return { hash, salt: finalSalt, algorithm: 'scrypt' };
}

function verifyPassword(password: string, hash: string, salt: string, algorithm?: 'scrypt' | 'pbkdf2'): boolean {
  const result = algorithm === 'scrypt'
    ? crypto.scryptSync(password, salt, 64).toString('hex')
    : crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return result === hash;
}

const INITIAL_DB: DbSchema = {
  version: 3,
  lastSaved: new Date().toISOString(),
  users: [],
  sessions: [],
  botConfigs: {},
  channels: {},
          pendingAdminRegistrations: {}, // Load pending administrator registration state from the database safely
  backupMetadata: {
    lastBackupAt: new Date().toISOString(),
    backupCount: 1,
  },
};

export class ServerDatabase {
  private static memoryDb: DbSchema = INITIAL_DB;
  private static isInitialized = false;

  public static init() {
    if (this.isInitialized) return;

    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.memoryDb = {
          ...INITIAL_DB,
          ...parsed,
          users: parsed.users || INITIAL_DB.users,
          sessions: parsed.sessions || [],
          botConfigs: parsed.botConfigs || {},
            channels: parsed.channels || {},
            pendingAdminRegistrations: parsed.pendingAdminRegistrations || INITIAL_DB.pendingAdminRegistrations,
          backupMetadata: parsed.backupMetadata || INITIAL_DB.backupMetadata,
        };
        if ((parsed.version || 1) < 3) {
          const legacyAdminIds = new Set(this.memoryDb.users.filter((user) => user.role === 'admin').map((user) => user.id));
          this.memoryDb.users = this.memoryDb.users.filter((user) => user.role !== 'admin');
          this.memoryDb.sessions = this.memoryDb.sessions.filter((session) => !legacyAdminIds.has(session.userId));
          this.memoryDb.version = 3;
          this.saveToFile();
        }
      } else {
        this.saveToFile();
      }
      this.isInitialized = true;
    } catch (err) {
      console.error('Error initializing ServerDatabase from file, using fallback memory DB:', err);
      this.memoryDb = INITIAL_DB;
      this.isInitialized = true;
    }
  }

  private static saveToFile() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      this.memoryDb.lastSaved = new Date().toISOString();
      const content = JSON.stringify(this.memoryDb, null, 2);
      fs.writeFileSync(DB_FILE, content, 'utf-8');
    } catch (err) {
      console.error('Failed to write database to file:', err);
    }
  }

  public static getStats() {
    this.init();
    let fileSizeBytes = 0;
    try {
      if (fs.existsSync(DB_FILE)) {
        const stat = fs.statSync(DB_FILE);
        fileSizeBytes = stat.size;
      }
    } catch (e) {
      // ignore
    }

    return {
      storageEngine: 'Node.js Persistent High-Speed File Database (JSON/SQLite Engine)',
      databaseFile: DB_FILE,
      sizeBytes: fileSizeBytes,
      usersCount: this.memoryDb.users.length,
      activeSessionsCount: this.memoryDb.sessions.filter(s => s.expiresAt > Date.now()).length,
      savedBotConfigsCount: Object.keys(this.memoryDb.botConfigs).length,
      lastSaved: this.memoryDb.lastSaved,
      backupCount: this.memoryDb.backupMetadata.backupCount,
      lastBackupAt: this.memoryDb.backupMetadata.lastBackupAt,
      isPermanent: true,
    };
  }

  public static getUserByEmail(email: string): DbUser | undefined {
    this.init();
    const clean = email.toLowerCase().trim();
    return this.memoryDb.users.find(u => u.email.toLowerCase() === clean);
  }

  public static findOrCreateGoogleUser(profile: { email: string; name: string; avatarUrl?: string }): { user: any; session: DbSession; verificationCode: string } {
    this.init();
    const cleanEmail = profile.email.toLowerCase().trim();
    let user = this.getUserByEmail(cleanEmail);
    if (!user) {
      user = {
        id: `google_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
        name: profile.name.trim() || cleanEmail,
        email: cleanEmail,
        role: 'developer' as const,
        isVerified: true,
        passwordHash: '',
        passwordSalt: '',
        passwordAlgorithm: 'scrypt' as const,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        avatarUrl: profile.avatarUrl,
        bio: 'Google account',
      };
      this.memoryDb.users.push(user);
    } else {
      user.name = profile.name.trim() || user.name;
      user.avatarUrl = profile.avatarUrl || user.avatarUrl;
      user.lastLoginAt = new Date().toISOString();
    }
    const verificationCode = this.issueVerificationCode(user);
    const session = this.createSession(user.id, false);
    this.saveToFile();
    return { user: this.sanitizeUser(user), session, verificationCode };
  }

  public static getUserById(id: string): DbUser | undefined {
    this.init();
    return this.memoryDb.users.find(u => u.id === id);
  }

  public static hasAdminUsers(): boolean {
    this.init();
    return this.memoryDb.users.some((user) => user.role === 'admin');
  }

  public static createPendingAdminRegistration(name: string, email: string, password: string, otp: string): boolean {
    this.init();
    const cleanEmail = email.toLowerCase().trim();
    if (this.hasAdminUsers() || this.getUserByEmail(cleanEmail)) return false;
    const passwordData = hashPassword(password);
    const otpSalt = crypto.randomBytes(16).toString('hex');
    const otpHash = crypto.scryptSync(otp, otpSalt, 32).toString('hex');
    this.memoryDb.pendingAdminRegistrations = this.memoryDb.pendingAdminRegistrations || {};
    this.memoryDb.pendingAdminRegistrations[cleanEmail] = {
      id: `pending_admin_${Date.now()}`,
      name: name.trim(),
      email: cleanEmail,
      passwordHash: passwordData.hash,
      passwordSalt: passwordData.salt,
      passwordAlgorithm: passwordData.algorithm,
      otpHash,
      otpSalt,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
      createdAt: new Date().toISOString(),
    };
    this.saveToFile();
    return true;
  }

  public static completePendingAdminRegistration(email: string, otp: string): { success: boolean; message: string; session?: any; user?: any } {
    this.init();
    const cleanEmail = email.toLowerCase().trim();
    const pending = this.memoryDb.pendingAdminRegistrations?.[cleanEmail];
    if (!pending || pending.expiresAt < Date.now()) return { success: false, message: 'Registration code expired. Please start again.' };
    if (pending.attempts >= 5) return { success: false, message: 'Too many verification attempts. Please start again.' };
    pending.attempts += 1;
    const suppliedHash = crypto.scryptSync(otp, pending.otpSalt, 32).toString('hex');
    if (suppliedHash !== pending.otpHash) {
      this.saveToFile();
      return { success: false, message: 'Invalid registration code.' };
    }
    if (this.hasAdminUsers() || this.getUserByEmail(cleanEmail)) {
      delete this.memoryDb.pendingAdminRegistrations![cleanEmail];
      this.saveToFile();
      return { success: false, message: 'A primary administrator already exists.' };
    }
    const user = {
      id: `admin_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
      name: pending.name,
      email: pending.email,
      role: 'admin' as const,
      isVerified: true,
      passwordHash: pending.passwordHash,
      passwordSalt: pending.passwordSalt,
      passwordAlgorithm: pending.passwordAlgorithm,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    this.memoryDb.users.push(user);
    delete this.memoryDb.pendingAdminRegistrations![cleanEmail];
    const session = this.createSession(user.id, true);
    session.adminAuthorized = true;
    this.saveToFile();
    return { success: true, message: 'Administrator account verified and created.', user: this.sanitizeUser(user), session };
  }

  public static sanitizeUser(user: DbUser) {
    const { passwordHash, passwordSalt, verificationCode, ...safe } = user;
    return safe;
  }

  public static registerUser(params: {
    name: string;
    email: string;
    password: string;
    role?: 'admin' | 'developer' | 'operator';
  }): {
    success: boolean;
    message: string;
    user?: any;
    session?: { token: string; user: any; expiresAt: number; isVerified: boolean };
    verificationCode?: string;
  } {
    this.init();
    const cleanEmail = params.email.toLowerCase().trim();

    if (this.getUserByEmail(cleanEmail)) {
      return {
        success: false,
        message: 'An account with this email address already exists. Please log in or use another email.',
      };
    }

    const { hash, salt, algorithm } = hashPassword(params.password);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const newUser: DbUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: params.name.trim(),
      email: cleanEmail,
      role: params.role || 'developer',
      isVerified: true,
      verificationCode,
      passwordHash: hash,
      passwordSalt: salt,
      passwordAlgorithm: algorithm,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(params.name)}`,
      bio: 'Cloud Bot Builder Member',
    };

    this.memoryDb.users.push(newUser);
    
    const session = this.createSession(newUser.id, false);
    this.saveToFile();

    return {
      success: true,
      message: 'Account created. A 6-digit verification code was sent to your email.',
      user: this.sanitizeUser(newUser),
      session: {
        token: session.token,
        user: this.sanitizeUser(newUser),
        expiresAt: session.expiresAt,
        isVerified: session.isVerified,
      },
      verificationCode,
    };
  }

  public static verifyPasswordAndLogin(params: {
    email: string;
    password: string;
  }): {
    success: boolean;
    message: string;
    session?: { token: string; user: any; expiresAt: number; isVerified: boolean };
    requiresVerification?: boolean;
    unverifiedUser?: any;
    verificationCode?: string;
  } {
    this.init();
    const cleanEmail = params.email.toLowerCase().trim();
    const user = this.getUserByEmail(cleanEmail);

    if (!user) {
      return {
        success: false,
        message: 'No account found with this email address. Please check spelling or create a new account.',
      };
    }

    const isMatch = verifyPassword(params.password, user.passwordHash, user.passwordSalt, user.passwordAlgorithm);
    if (!isMatch) {
      return {
        success: false,
        message: 'Incorrect password. Please verify credentials.',
      };
    }

    // Update last login
    user.lastLoginAt = new Date().toISOString();
    const verificationCode = this.issueVerificationCode(user);
    
    // Create session
    const session = this.createSession(user.id, false);
    this.saveToFile();

    return {
      success: true,
      message: `A 6-digit verification code was sent to ${user.email}.`,
      requiresVerification: true,
      unverifiedUser: this.sanitizeUser(user),
      session: {
        token: session.token,
        user: this.sanitizeUser(user),
        expiresAt: session.expiresAt,
        isVerified: session.isVerified,
      },
      verificationCode,
    };
  }

  public static verifyOtp(email: string, code: string, token?: string): {
    success: boolean;
    message: string;
    session?: { token: string; user: any; expiresAt: number; isVerified: boolean };
  } {
    this.init();
    const cleanEmail = email.toLowerCase().trim();
    const user = this.getUserByEmail(cleanEmail);

    if (!user) {
      return { success: false, message: 'User account not found.' };
    }

    if (user.verificationCode !== code || code.length !== 6) {
      return {
        success: false,
        message: 'Invalid verification code. Please check your 6-digit OTP.',
      };
    }

    user.isVerified = true;
    user.lastLoginAt = new Date().toISOString();
    const cleanToken = token?.replace(/^Bearer\s+/i, '').trim();
    const existingSession = cleanToken
      ? this.memoryDb.sessions.find((entry) => entry.token === cleanToken && entry.userId === user.id && entry.expiresAt > Date.now())
      : undefined;
    const session = existingSession || this.createSession(user.id, false);
    session.isVerified = true;
    if (user.role === 'admin') session.adminAuthorized = true;
    user.verificationCode = undefined;
    this.saveToFile();

    return {
      success: true,
      message: 'Email successfully verified! Session permanently activated.',
      session: {
        token: session.token,
        user: this.sanitizeUser(user),
        expiresAt: session.expiresAt,
        isVerified: session.isVerified,
      },
    };
  }

  public static resendOtp(email: string): { success: boolean; message: string; code?: string } {
    this.init();
    const cleanEmail = email.toLowerCase().trim();
    const user = this.getUserByEmail(cleanEmail);

    if (!user) {
      return { success: false, message: 'User account not found.' };
    }

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = newCode;
    this.saveToFile();

    return {
      success: true,
      message: 'A new 6-digit verification code was generated.',
    };
  }

  private static issueVerificationCode(user: DbUser): string {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    user.verificationCode = code;
    return code;
  }

  public static createSession(userId: string, isVerified = false): DbSession {
    this.init();
    const token = `gauth_${Date.now()}_${crypto.randomBytes(24).toString('hex')}`;
    const expiresAt = Date.now() + 14 * 24 * 60 * 60 * 1000; // 14 days

    const session: DbSession = {
      token,
      userId,
      createdAt: new Date().toISOString(),
      expiresAt,
      isVerified,
    };

    // Clean old expired sessions
    this.memoryDb.sessions = this.memoryDb.sessions.filter(s => s.expiresAt > Date.now());
    this.memoryDb.sessions.push(session);
    this.saveToFile();

    return session;
  }

  public static authorizeAdminSession(token: string): boolean {
    this.init();
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    const session = this.memoryDb.sessions.find((entry) => entry.token === cleanToken && entry.expiresAt > Date.now());
    if (!session) return false;
    session.adminAuthorized = true;
    this.saveToFile();
    return true;
  }

  public static isAdminSessionAuthorized(token: string): boolean {
    this.init();
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    return this.memoryDb.sessions.some((entry) => entry.token === cleanToken && entry.expiresAt > Date.now() && entry.adminAuthorized === true);
  }

  public static getSessionUser(token: string): any | null {
    this.init();
    if (!token) return null;
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    const session = this.memoryDb.sessions.find(s => s.token === cleanToken);

    if (!session || session.expiresAt < Date.now()) {
      return null;
    }

    const user = this.getUserById(session.userId);
    if (!user) return null;

    return { ...this.sanitizeUser(user), isVerified: session.isVerified === true };
  }

  public static removeSession(token: string) {
    this.init();
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    this.memoryDb.sessions = this.memoryDb.sessions.filter(s => s.token !== cleanToken);
    this.saveToFile();
  }

  public static quickLogin(type: 'admin' | 'developer') {
    void type;
    return null;
  }

  // Save per-user Bot Configurations permanently
  public static saveBotConfig(userIdOrEmail: string, config: any) {
    this.init();
    this.memoryDb.botConfigs[userIdOrEmail.toLowerCase().trim()] = {
      config,
      updatedAt: new Date().toISOString(),
    };
    this.saveToFile();
    return { success: true, updatedAt: new Date().toISOString() };
  }

  public static getBotConfig(userIdOrEmail: string) {
    this.init();
    return this.memoryDb.botConfigs[userIdOrEmail.toLowerCase().trim()] || null;
  }

  public static getAllBotConfigs(): Record<string, any> {
    this.init();
    return { ...this.memoryDb.botConfigs };
  }

  public static saveChannel(channel: DbChannelConnection) {
    this.init();
    this.memoryDb.channels[channel.id] = channel;
    this.saveToFile();
    return channel;
  }

  public static getChannel(channelId: string): DbChannelConnection | null {
    this.init();
    return this.memoryDb.channels[channelId] || null;
  }

  public static getChannelsForUser(userId: string): DbChannelConnection[] {
    this.init();
    return Object.values(this.memoryDb.channels).filter(channel => channel.userId === userId);
  }

  public static getAllChannels(): DbChannelConnection[] {
    this.init();
    return Object.values(this.memoryDb.channels);
  }

  public static deleteChannel(channelId: string): boolean {
    this.init();
    if (!this.memoryDb.channels[channelId]) return false;
    delete this.memoryDb.channels[channelId];
    this.saveToFile();
    return true;
  }

  // Export full backup for easy migration to any new VPS
  public static exportBackup() {
    this.init();
    this.memoryDb.backupMetadata.lastBackupAt = new Date().toISOString();
    this.memoryDb.backupMetadata.backupCount += 1;
    this.saveToFile();

    return {
      app: 'Groq & Multi-Platform AI Bot Builder',
      version: this.memoryDb.version,
      exportedAt: new Date().toISOString(),
      serverHost: 'Universal-Cloud-Node-01',
      stats: {
        totalUsers: this.memoryDb.users.length,
        totalBotConfigs: Object.keys(this.memoryDb.botConfigs).length,
      },
      data: {
        users: this.memoryDb.users,
        botConfigs: this.memoryDb.botConfigs,
        channels: this.memoryDb.channels,
      },
    };
  }

  // Import full backup to restore users and configurations
  public static importBackup(backupJson: any): { success: boolean; message: string; importedUsers: number; importedConfigs: number } {
    this.init();
    try {
      if (!backupJson || !backupJson.data) {
        return { success: false, message: 'Invalid backup file structure. Missing "data" payload.', importedUsers: 0, importedConfigs: 0 };
      }

      const usersToImport: DbUser[] = backupJson.data.users || [];
      const configsToImport: Record<string, any> = backupJson.data.botConfigs || {};
      const channelsToImport: Record<string, DbChannelConnection> = backupJson.data.channels || {};

      let importedUsers = 0;
      let importedConfigs = 0;

      // Merge or update users
      for (const u of usersToImport) {
        const existingIdx = this.memoryDb.users.findIndex(ex => ex.email.toLowerCase() === u.email.toLowerCase());
        if (existingIdx >= 0) {
          this.memoryDb.users[existingIdx] = { ...this.memoryDb.users[existingIdx], ...u };
        } else {
          this.memoryDb.users.push(u);
        }
        importedUsers++;
      }

      // Merge bot configs
      for (const [key, val] of Object.entries(configsToImport)) {
        this.memoryDb.botConfigs[key.toLowerCase()] = val;
        importedConfigs++;
      }

      for (const [key, val] of Object.entries(channelsToImport)) {
        this.memoryDb.channels[key] = val;
      }

      this.memoryDb.backupMetadata.lastBackupAt = new Date().toISOString();
      this.saveToFile();

      return {
        success: true,
        message: `Successfully restored ${importedUsers} user profiles and ${importedConfigs} bot configurations into permanent storage.`,
        importedUsers,
        importedConfigs,
      };
    } catch (e: any) {
      return {
        success: false,
        message: `Failed to restore backup: ${e?.message || 'Parse error'}`,
        importedUsers: 0,
        importedConfigs: 0,
      };
    }
  }
}
