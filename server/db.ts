import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { UserAccount, AuthSession, BotConfig } from '../src/types';

interface StoredDb {
  users: UserAccount[];
  passwords: Record<string, string>; // userId -> password hash
  sessions: Record<string, AuthSession>;
  botConfigs: Record<string, { config: BotConfig; updatedAt: string }>;
  pendingRegistrations: Record<string, { name: string; email: string; passwordHash: string; code: string; expiresAt: number }>;
}

const DB_FILE = path.join(process.cwd(), 'data_store.json');

export class ServerDatabase {
  private static db: StoredDb = {
    users: [],
    passwords: {},
    sessions: {},
    botConfigs: {},
    pendingRegistrations: {},
  };

  public static init() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        ServerDatabase.db = JSON.parse(raw);
      } else {
        ServerDatabase.save();
      }
    } catch (e) {
      console.warn('[ServerDB] Using in-memory state:', e);
    }
  }

  private static save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(ServerDatabase.db, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[ServerDB] Failed to persist file store:', e);
    }
  }

  public static hasAdminUsers(): boolean {
    return ServerDatabase.db.users.some(u => u.role === 'admin' && u.isVerified);
  }

  public static getStats() {
    return {
      totalUsers: ServerDatabase.db.users.length,
      usersCount: ServerDatabase.db.users.length,
      activeSessions: Object.keys(ServerDatabase.db.sessions).length,
      activeSessionsCount: Object.keys(ServerDatabase.db.sessions).length,
      configsSaved: Object.keys(ServerDatabase.db.botConfigs).length,
      savedBotConfigsCount: Object.keys(ServerDatabase.db.botConfigs).length,
      adminUsers: ServerDatabase.db.users.filter(u => u.role === 'admin').length,
    };
  }

  public static getSessionUser(authHeader: string): UserAccount | null {
    if (!authHeader) return null;
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const session = ServerDatabase.db.sessions[token];
    if (session && session.expiresAt > Date.now()) {
      return session.user;
    }
    return null;
  }

  public static isAdminSessionAuthorized(authHeader: string): boolean {
    const user = ServerDatabase.getSessionUser(authHeader);
    if (!user) return false;
    return user.role === 'admin' && user.isVerified;
  }

  public static registerUser(data: { name: string; email: string; password: string }) {
    const email = data.email.toLowerCase().trim();
    if (ServerDatabase.db.users.some(u => u.email === email)) {
      return { success: false, message: 'An account with this email already exists.' };
    }

    const userId = 'usr_' + crypto.randomBytes(8).toString('hex');
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const isFirst = ServerDatabase.db.users.length === 0;

    const newUser: UserAccount = {
      id: userId,
      name: data.name.trim() || 'Developer',
      email,
      role: isFirst ? 'admin' : 'developer',
      isVerified: false,
      verificationCode,
      verificationCodeExpiresAt: Date.now() + 10 * 60 * 1000,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(data.name || email)}`,
    };

    const passwordHash = crypto.createHash('sha256').update(data.password).digest('hex');
    ServerDatabase.db.users.push(newUser);
    ServerDatabase.db.passwords[userId] = passwordHash;
    ServerDatabase.save();

    return {
      success: true,
      message: 'Account created. Verification code required.',
      user: newUser,
      verificationCode,
    };
  }

  public static createPendingAdminRegistration(name: string, email: string, password: string, code: string): boolean {
    const cleanEmail = email.toLowerCase().trim();
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    ServerDatabase.db.pendingRegistrations[cleanEmail] = {
      name,
      email: cleanEmail,
      passwordHash,
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    ServerDatabase.save();
    return true;
  }

  public static completePendingAdminRegistration(email: string, code: string) {
    const cleanEmail = email.toLowerCase().trim();
    const pending = ServerDatabase.db.pendingRegistrations[cleanEmail];
    if (!pending) {
      return { success: false, message: 'No pending registration found.' };
    }
    if (pending.code !== code.trim()) {
      return { success: false, message: 'Invalid verification code.' };
    }
    if (pending.expiresAt < Date.now()) {
      return { success: false, message: 'Verification code expired.' };
    }

    const userId = 'adm_' + crypto.randomBytes(8).toString('hex');
    const newAdmin: UserAccount = {
      id: userId,
      name: pending.name,
      email: cleanEmail,
      role: 'admin',
      isVerified: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(pending.name)}`,
    };

    ServerDatabase.db.users.push(newAdmin);
    ServerDatabase.db.passwords[userId] = pending.passwordHash;
    delete ServerDatabase.db.pendingRegistrations[cleanEmail];

    const token = 'tok_' + crypto.randomBytes(24).toString('hex');
    const session: AuthSession = {
      token,
      user: newAdmin,
      expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
      isVerified: true,
      adminAuthorized: true,
    };
    ServerDatabase.db.sessions[token] = session;
    ServerDatabase.save();

    return {
      success: true,
      message: 'Admin account verified and created successfully.',
      session,
    };
  }

  public static verifyPasswordAndLogin(data: { email: string; password: string }) {
    const cleanEmail = data.email.toLowerCase().trim();
    const user = ServerDatabase.db.users.find(u => u.email === cleanEmail);
    if (!user) {
      return { success: false, message: 'Invalid email or password.' };
    }

    const hash = crypto.createHash('sha256').update(data.password).digest('hex');
    if (ServerDatabase.db.passwords[user.id] !== hash) {
      return { success: false, message: 'Invalid email or password.' };
    }

    if (!user.isVerified) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      user.verificationCode = code;
      user.verificationCodeExpiresAt = Date.now() + 10 * 60 * 1000;
      ServerDatabase.save();
      return {
        success: false,
        requiresVerification: true,
        unverifiedUser: user,
        verificationCode: code,
        message: 'Account not verified. A new code has been issued.',
      };
    }

    const token = 'tok_' + crypto.randomBytes(24).toString('hex');
    const session: AuthSession = {
      token,
      user,
      expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
      isVerified: true,
      adminAuthorized: user.role === 'admin',
    };

    user.lastLoginAt = new Date().toISOString();
    ServerDatabase.db.sessions[token] = session;
    ServerDatabase.save();

    return {
      success: true,
      message: 'Logged in successfully.',
      session,
    };
  }

  public static findOrCreateGoogleUser(data: { email: string; name: string; avatarUrl?: string }) {
    const cleanEmail = data.email.toLowerCase().trim();
    let user = ServerDatabase.db.users.find(u => u.email === cleanEmail);

    if (!user) {
      const userId = 'gusr_' + crypto.randomBytes(8).toString('hex');
      const isFirst = ServerDatabase.db.users.length === 0;
      user = {
        id: userId,
        name: data.name || cleanEmail.split('@')[0],
        email: cleanEmail,
        role: isFirst ? 'admin' : 'developer',
        isVerified: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        avatarUrl: data.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(data.name || cleanEmail)}`,
      };
      ServerDatabase.db.users.push(user);
    } else {
      user.lastLoginAt = new Date().toISOString();
      if (data.avatarUrl) user.avatarUrl = data.avatarUrl;
    }

    const token = 'tok_' + crypto.randomBytes(24).toString('hex');
    const session: AuthSession = {
      token,
      user,
      expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
      isVerified: true,
      adminAuthorized: user.role === 'admin',
    };
    ServerDatabase.db.sessions[token] = session;
    ServerDatabase.save();

    return { user, session, verificationCode: undefined };
  }

  public static verifyOtp(email: string, code: string, authHeader?: string) {
    const cleanEmail = email.toLowerCase().trim();
    const user = ServerDatabase.db.users.find(u => u.email === cleanEmail);
    if (!user) return { success: false, message: 'User not found.' };

    if (user.verificationCode !== code.trim()) {
      return { success: false, message: 'Invalid verification code.' };
    }
    if (user.verificationCodeExpiresAt && user.verificationCodeExpiresAt < Date.now()) {
      return { success: false, message: 'Verification code has expired.' };
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpiresAt = undefined;

    const token = 'tok_' + crypto.randomBytes(24).toString('hex');
    const session: AuthSession = {
      token,
      user,
      expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
      isVerified: true,
      adminAuthorized: user.role === 'admin',
    };
    ServerDatabase.db.sessions[token] = session;
    ServerDatabase.save();

    return { success: true, message: 'Email verified successfully.', session };
  }

  public static resendOtp(email: string): { success: boolean; message: string; code?: string; verificationCode?: string } {
    const cleanEmail = email.toLowerCase().trim();
    const user = ServerDatabase.db.users.find(u => u.email === cleanEmail);
    if (!user) return { success: false, message: 'User not found.' };

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = code;
    user.verificationCodeExpiresAt = Date.now() + 10 * 60 * 1000;
    ServerDatabase.save();

    return { success: true, message: 'Verification code resent.', code, verificationCode: code };
  }

  public static getBotConfig(targetId: string): { config: BotConfig; updatedAt: string } | null {
    if (!targetId) return null;
    return ServerDatabase.db.botConfigs[targetId] || null;
  }

  public static saveBotConfig(targetId: string, config: BotConfig): boolean {
    if (!targetId || !config) return false;
    ServerDatabase.db.botConfigs[targetId] = {
      config,
      updatedAt: new Date().toISOString(),
    };
    ServerDatabase.save();
    return true;
  }

  public static removeSession(authHeader: string): void {
    if (!authHeader) return;
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    delete ServerDatabase.db.sessions[token];
    ServerDatabase.save();
  }

  public static exportBackup() {
    return {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      data: ServerDatabase.db,
    };
  }

  public static importBackup(backupData: any) {
    if (!backupData || !backupData.data) {
      return { success: false, message: 'Invalid backup file format.' };
    }
    ServerDatabase.db = backupData.data;
    ServerDatabase.save();
    return { success: true, message: 'Database backup imported successfully.' };
  }
}
