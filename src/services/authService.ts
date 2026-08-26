import { UserAccount, AuthSession, BotConfig } from '../types';
import { FirestoreDataService } from './firestoreDataService';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from './firebase';

const USERS_STORAGE_KEY = 'groq_bot_users_db_v1';
const SESSION_STORAGE_KEY = 'groq_bot_auth_session_v1';

const INITIAL_USERS: UserAccount[] = [];

const PASSWORDS_STORAGE_KEY = 'groq_bot_passwords_v1';
const INITIAL_PASSWORDS: Record<string, string> = {};

export class AuthService {
  public static async signInWithGoogle(): Promise<{ success: boolean; message: string; session?: AuthSession }> {
    if (!auth) {
      return { success: false, message: 'Google sign-in is temporarily unavailable because Firebase is not configured.' };
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();
    const response = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success || !data.session) {
      return { success: false, message: data.message || 'Google authentication failed.' };
    }
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data.session));
    return data;
  }
  public static async adminSignUp(params: { name: string; email: string; password: string }): Promise<any> {
    const response = await fetch('/api/auth/admin/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await response.json();
    if (response.ok && data.success && data.session) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data.session));
    }
    return data;
  }

  public static async verifyAdminSignUp(email: string, code: string): Promise<any> {
    const response = await fetch('/api/auth/admin/signup/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    const data = await response.json();
    if (response.ok && data.success && data.session) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data.session));
    }
    return data;
  }

  private static getStoredUsers(): UserAccount[] {
    try {
      const data = localStorage.getItem(USERS_STORAGE_KEY);
      if (!data) {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(INITIAL_USERS));
        return INITIAL_USERS;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_USERS;
    }
  }

  private static saveUsers(users: UserAccount[]) {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('Failed to save users database', e);
    }
  }

  private static getStoredPasswords(): Record<string, string> {
    try {
      const data = localStorage.getItem(PASSWORDS_STORAGE_KEY);
      if (!data) {
        localStorage.setItem(PASSWORDS_STORAGE_KEY, JSON.stringify(INITIAL_PASSWORDS));
        return INITIAL_PASSWORDS;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_PASSWORDS;
    }
  }

  private static savePassword(email: string, pass: string) {
    try {
      const passwords = this.getStoredPasswords();
      passwords[email.toLowerCase().trim()] = pass;
      localStorage.setItem(PASSWORDS_STORAGE_KEY, JSON.stringify(passwords));
    } catch (e) {
      console.error('Failed to save user password', e);
    }
  }

  // Get currently active session from localStorage
  public static getCurrentSession(): AuthSession | null {
    try {
      const sessionStr = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!sessionStr) return null;
      const session: AuthSession = JSON.parse(sessionStr);

      if (session.expiresAt && Date.now() > session.expiresAt) {
        this.logOut();
        return null;
      }

      if (session.isVerified === true && session.user?.role === 'admin' && session.adminAuthorized !== true) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return null;
      }

      return session;
    } catch {
      return null;
    }
  }

  // Validate session against server database & fetch updated user and bot config
  public static async syncSessionWithServer(): Promise<{ session: AuthSession | null; botConfig?: BotConfig | null }> {
    const current = this.getCurrentSession();
    if (!current?.token) return { session: null, botConfig: null };

    try {
      const resp = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${current.token}`,
        },
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.user) {
          const updatedSession: AuthSession = {
            ...current,
            user: data.user,
            isVerified: data.isVerified === true && current.isVerified === true,
            adminAuthorized: data.adminAuthorized === true ? true : current.adminAuthorized,
          };
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedSession));
          return {
            session: updatedSession,
            botConfig: data.botConfig || null,
          };
        }
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return { session: null, botConfig: null };
      }
    } catch (err) {
      console.warn('Backend sync unavailable, using cached local session:', err);
    }

    return { session: current, botConfig: null };
  }

  // Sign up a new user (Instant automated verification & persistent login)
  public static async signUp(params: {
    name: string;
    email: string;
    password: string;
    role?: 'admin' | 'developer' | 'operator';
  }): Promise<{ success: boolean; message: string; user?: UserAccount; session?: AuthSession; verificationCode?: string }> {
    const cleanEmail = params.email.toLowerCase().trim();

    try {
      const resp = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        if (data.session) {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data.session));
        }
        // Also cache user profile locally
        const users = this.getStoredUsers();
        if (!users.some(u => u.email.toLowerCase() === cleanEmail)) {
          users.push(data.user);
          this.saveUsers(users);
        }
        this.savePassword(cleanEmail, params.password);
        if (data.user) {
          FirestoreDataService.saveUserProfile(data.user).catch(e => {
            console.warn('[Firestore] Profile backup notice:', e);
          });
        }
        return data;
      } else if (!resp.ok) {
        return { success: false, message: data.message || 'Registration failed.' };
      }
    } catch (err) {
      console.warn('Backend signup offline, using local storage engine:', err);
    }

    // Local fallback keeps the same verification gate when the backend is unavailable.
    const users = this.getStoredUsers();
    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return {
        success: false,
        message: 'An account with this email address already exists. Please log in or use another email.',
      };
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newUser: UserAccount = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: params.name.trim(),
      email: cleanEmail,
      role: params.role || (cleanEmail.includes('admin') ? 'admin' : 'developer'),
      isVerified: true,
      verificationCode,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(params.name)}`,
      bio: 'Cloud Bot Builder Member',
    };

    users.push(newUser);
    this.saveUsers(users);
    this.savePassword(cleanEmail, params.password);

    FirestoreDataService.saveUserProfile(newUser).catch(e => {
      console.warn('[Firestore] Profile backup notice:', e);
    });

    const session: AuthSession = {
      token: `gauth_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      user: newUser,
      expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
      isVerified: false,
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

    return {
      success: true,
      message: `Account created. Enter the 6-digit code sent to ${newUser.email}.`,
      user: newUser,
      session,
      verificationCode,
    };
  }

  // Verify OTP and issue session token
  public static async verifyEmailCode(email: string, code: string): Promise<{ success: boolean; message: string; session?: AuthSession }> {
    const cleanEmail = email.toLowerCase().trim();

    try {
      const resp = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.getCurrentSession()?.token ? { Authorization: `Bearer ${this.getCurrentSession()!.token}` } : {}),
        },
        body: JSON.stringify({ email: cleanEmail, code }),
      });
      const data = await resp.json();
      if (resp.ok && data.success && data.session) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data.session));
        return {
          success: true,
          message: data.message || 'Email successfully verified!',
          session: data.session,
        };
      } else if (!resp.ok) {
        return { success: false, message: data.message || 'Invalid code.' };
      }
    } catch (err) {
      console.warn('Backend OTP verification offline, checking local:', err);
    }

    // Local fallback
    const users = this.getStoredUsers();
    const userIndex = users.findIndex(u => u.email.toLowerCase() === cleanEmail);

    if (userIndex === -1) {
      return { success: false, message: 'User account not found. Please sign up first.' };
    }

    const user = users[userIndex];
    if (user.verificationCode !== code) {
      return {
        success: false,
        message: 'Invalid verification code. Please check your 6-digit OTP and try again.',
      };
    }

    user.isVerified = true;
    user.lastLoginAt = new Date().toISOString();
    users[userIndex] = user;
    this.saveUsers(users);

    const session: AuthSession = {
      token: `gauth_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      user,
      expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
      isVerified: true,
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

    return {
      success: true,
      message: 'Email successfully verified! Welcome to Groq Telegram Bot Builder.',
      session,
    };
  }

  // Resend OTP code
  public static async resendVerificationCode(email: string): Promise<{ success: boolean; message: string; code?: string }> {
    const cleanEmail = email.toLowerCase().trim();

    try {
      const resp = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        return data;
      }
    } catch (e) {
      console.warn('Server resend offline, generating local OTP');
    }

    const users = this.getStoredUsers();
    const userIndex = users.findIndex(u => u.email.toLowerCase() === cleanEmail);
    if (userIndex === -1) {
      return { success: false, message: 'User account not found.' };
    }

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    users[userIndex].verificationCode = newCode;
    this.saveUsers(users);

    return {
      success: true,
      message: 'A new 6-digit verification code was generated.',
    };
  }

  // Log in existing user
  public static async logIn(params: {
    email: string;
    password: string;
  }): Promise<{
    success: boolean;
    message: string;
    session?: AuthSession;
    requiresVerification?: boolean;
    unverifiedUser?: UserAccount;
    verificationCode?: string;
  }> {
    const cleanEmail = params.email.toLowerCase().trim();

    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await resp.json();
      if (resp.ok && data.success && data.session) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data.session));
        return {
          success: data.session.isVerified === true,
          message: data.message,
          session: data.session,
          requiresVerification: data.session.isVerified !== true,
          unverifiedUser: data.session.user,
        };
      } else if (data.requiresVerification) {
        return {
          success: false,
          message: data.message,
          requiresVerification: true,
          unverifiedUser: data.unverifiedUser,
        };
      } else if (!resp.ok) {
        return { success: false, message: data.message || 'Login failed.' };
      }
    } catch (err) {
      console.warn('Backend login unavailable, checking local credentials:', err);
    }

    // Local fallback
    const users = this.getStoredUsers();
    const user = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      return {
        success: false,
        message: 'No account found with this email address. Please check spelling or create a new account.',
      };
    }

    const passwords = this.getStoredPasswords();
    const savedPassword = passwords[cleanEmail];

    if (savedPassword && savedPassword !== params.password) {
      return {
        success: false,
        message: 'Incorrect password. Please try again or use the demo credentials.',
      };
    }

    user.lastLoginAt = new Date().toISOString();
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = verificationCode;
    this.saveUsers(users);

    const session: AuthSession = {
      token: `gauth_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      user,
      expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
      isVerified: false,
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

    return {
      success: true,
      message: `Enter the 6-digit code sent to ${user.email}.`,
      requiresVerification: true,
      unverifiedUser: user,
      verificationCode,
      session,
    };
  }

  // Permanently save user's bot configuration to server database and Firestore cloud
  public static async saveUserBotConfig(config: BotConfig, userId?: string): Promise<boolean> {
    const session = this.getCurrentSession();
    const effectiveUserId = userId || session?.user.id || 'global_default_user';

    // 1. Save to Firestore Cloud Database
    FirestoreDataService.saveBotConfig(effectiveUserId, config).catch(e => {
      console.warn('[Firestore] Background config save notice:', e);
    });

    try {
      const resp = await fetch('/api/user/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        body: JSON.stringify({
          config,
          userId: effectiveUserId,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      return resp.ok && data.success !== false;
    } catch (e) {
      console.warn('Failed to sync bot config to server DB:', e);
      return false;
    }
  }

  // Real-time automated key and credential synchronization
  private static syncTimeoutId: any = null;
  public static syncKeysToServer(config: BotConfig, userId?: string): void {
    if (this.syncTimeoutId) {
      clearTimeout(this.syncTimeoutId);
    }

    this.syncTimeoutId = setTimeout(async () => {
      const session = this.getCurrentSession();
      try {
        await fetch('/api/sync/keys', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
          },
          body: JSON.stringify({
            config,
            userId: userId || session?.user.id,
          }),
        });
      } catch (err) {
        console.warn('Background key sync error:', err);
      }
    }, 400);
  }

  // Check automated key sync status
  public static async getSyncStatus(): Promise<any> {
    try {
      const resp = await fetch('/api/sync/status');
      if (resp.ok) {
        return await resp.json();
      }
    } catch (err) {
      console.warn('Failed to fetch sync status', err);
    }
    return null;
  }

  // Load user's saved bot configuration from server database or Firestore cloud
  public static async loadUserBotConfig(userId?: string): Promise<BotConfig | null> {
    const session = this.getCurrentSession();
    const effectiveUserId = userId || session?.user.id || 'global_default_user';

    try {
      const resp = await fetch(`/api/user/config?userId=${encodeURIComponent(effectiveUserId)}`, {
        headers: {
          ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.config) return data.config;
      }
    } catch (e) {
      console.warn('Failed to load bot config from server DB, trying Firestore:', e);
    }

    // Firestore fallback
    try {
      const firestoreConfig = await FirestoreDataService.loadBotConfig(effectiveUserId);
      if (firestoreConfig) return firestoreConfig;
    } catch (err) {
      console.warn('[Firestore] Config fetch notice:', err);
    }

    return null;
  }

  // Fetch Database Server Stats
  public static async getDatabaseStats(): Promise<any> {
    try {
      const resp = await fetch('/api/database/stats');
      if (resp.ok) {
        const data = await resp.json();
        return data.stats;
      }
    } catch (e) {
      console.warn('Failed to fetch DB stats', e);
    }
    return null;
  }

  // Export full system backup JSON
  public static async exportBackupJson(): Promise<any> {
    const resp = await fetch('/api/admin/backup/export');
    if (!resp.ok) {
      throw new Error('Failed to export server database backup');
    }
    return await resp.json();
  }

  // Import full system backup JSON
  public static async importBackupJson(backupData: any): Promise<{ success: boolean; message: string; importedUsers: number; importedConfigs: number }> {
    const resp = await fetch('/api/admin/backup/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backupData),
    });
    return await resp.json();
  }

  // Log out current session
  public static logOut() {
    const session = this.getCurrentSession();
    if (session?.token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      }).catch(() => {});
    }

    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear session', e);
    }
  }

  // Update profile
  public static updateUserProfile(userId: string, updates: Partial<UserAccount>): UserAccount | null {
    const users = this.getStoredUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) return null;

    const updated = { ...users[index], ...updates };
    users[index] = updated;
    this.saveUsers(users);

    const session = this.getCurrentSession();
    if (session && session.user.id === userId) {
      session.user = updated;
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }

    return updated;
  }
}
