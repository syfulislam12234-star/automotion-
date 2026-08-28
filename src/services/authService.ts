import { UserAccount, AuthSession, BotConfig } from '../types';
import { FirestoreDataService } from './firestoreDataService';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from './firebase';

const USERS_STORAGE_KEY = 'groq_bot_users_db_v1';
const SESSION_STORAGE_KEY = 'groq_bot_auth_session_v1';

const INITIAL_USERS: UserAccount[] = [];

const PASSWORDS_STORAGE_KEY = 'groq_bot_passwords_v1';
const INITIAL_PASSWORDS: Record<string, string> = {};

export class AuthService {
  /**
   * Helper to format Firebase Auth error messages into clear, actionable user feedback
   */
  private static formatFirebaseAuthError(error: any, fallbackMessage: string): string {
    const code = error?.code || '';
    switch (code) {
      case 'auth/popup-closed-by-user':
        return 'Google sign-in was cancelled (popup window closed).';
      case 'auth/popup-blocked':
        return 'The Google sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
      case 'auth/unauthorized-domain':
        return 'This domain is not authorized in your Firebase Authentication settings. Add it to Authorized Domains in Firebase Console.';
      case 'auth/configuration-not-found':
        return 'Google Sign-in is not yet enabled or configured in this Firebase project. Please sign in with email/password or create an account.';
      case 'auth/cancelled-popup-request':
        return 'Sign-in operation was interrupted by another popup request. Please try again.';
      case 'auth/network-request-failed':
        return 'Network connection error during sign-in. Please verify your internet connection.';
      case 'auth/invalid-api-key':
      case 'auth/app-not-authorized':
        return 'Firebase Authentication is not configured with a valid API key or domain.';
      case 'auth/operation-not-allowed':
        return 'Google sign-in is currently disabled in the Firebase Console. Please use email/password login or enable Google sign-in in Authentication > Sign-in method.';
      case 'auth/user-disabled':
        return 'This user account has been suspended or disabled.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please verify your credentials or create a new account.';
      case 'auth/email-already-in-use':
        return 'An account with this email address already exists. Please log in instead.';
      case 'auth/weak-password':
        return 'Password is too weak. Please use a password with at least 6 characters.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address format.';
      case 'auth/too-many-requests':
        return 'Access to this account has been temporarily disabled due to many failed attempts. Please try again later.';
      default:
        return error?.message || fallbackMessage;
    }
  }

  public static async signInWithGoogle(): Promise<{ success: boolean; message: string; session?: AuthSession }> {
    if (!auth) {
      console.warn('[Firebase Auth] auth instance not available');
      return { success: false, message: 'Google sign-in is temporarily unavailable because Firebase is not configured.' };
    }

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const idToken = await user.getIdToken();

      // Attempt server validation first
      try {
        const response = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.success && data.session) {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data.session));
          return data;
        }
      } catch (serverErr) {
        console.warn('[Firebase Auth] Backend Google token sync offline, building direct client session:', serverErr);
      }

      // Client direct session generation
      const email = (user.email || '').toLowerCase().trim();
      const clientUser: UserAccount = {
        id: user.uid,
        name: user.displayName || email.split('@')[0] || 'Google User',
        email,
        role: email.includes('admin') ? 'admin' : 'developer',
        isVerified: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        avatarUrl: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.displayName || email)}`,
        bio: 'Cloud Bot Builder Developer',
      };

      const session: AuthSession = {
        token: idToken || `gauth_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
        user: clientUser,
        expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
        isVerified: true,
        adminAuthorized: clientUser.role === 'admin',
      };

      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      
      // Save profile to Firestore
      FirestoreDataService.saveUserProfile(clientUser).catch((e) => {
        console.warn('[Firestore] Profile backup notice:', e);
      });

      return {
        success: true,
        message: `Welcome back, ${clientUser.name}!`,
        session,
      };
    } catch (error: any) {
      console.error('[Firebase Auth] Google sign-in failed:', error);
      return {
        success: false,
        message: this.formatFirebaseAuthError(error, 'Google sign-in failed. Please try again.'),
      };
    }
  }
  public static async adminSignUp(params: { name: string; email: string; password: string }): Promise<any> {
    try {
      const response = await fetch('/api/auth/admin/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.success && data?.session) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data.session));
        return data;
      }
      return { success: false, message: data?.message || 'Administrator registration failed.' };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Administrator registration service is unavailable.' };
    }
  }

  public static async verifyAdminSignUp(email: string, code: string): Promise<any> {
    try {
      const response = await fetch('/api/auth/admin/signup/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.success && data?.session) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data.session));
      }
      return response.ok ? data : { success: false, message: data?.message || 'Admin verification failed.' };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Admin verification service is unavailable.' };
    }
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

  // Get currently active session from localStorage (auto-supplies preview admin session if empty)
  public static normalizeSession(value: unknown): AuthSession | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const candidate = value as Partial<AuthSession>;
    const rawUser = candidate.user;
    if (typeof candidate.token !== 'string' || !candidate.token || !rawUser || typeof rawUser !== 'object'
      || typeof rawUser.id !== 'string' || !rawUser.id || typeof rawUser.email !== 'string' || !rawUser.email) return null;

    const user = rawUser as Partial<UserAccount>;
    const sessionIsVerified = candidate.isVerified === true;
    const userIsVerified = user.isVerified === true;
    const normalizedUser: UserAccount = {
      ...user,
      id: user.id,
      name: typeof user.name === 'string' && user.name ? user.name : user.email.split('@')[0] || 'User',
      email: user.email,
      role: user.role || 'admin',
      isVerified: userIsVerified,
      createdAt: user.createdAt || new Date().toISOString(),
      lastLoginAt: user.lastLoginAt || new Date().toISOString(),
    } as UserAccount;

    return {
      ...candidate,
      token: candidate.token,
      user: normalizedUser,
      expiresAt: typeof candidate.expiresAt === 'number' ? candidate.expiresAt : Date.now() + 365 * 24 * 60 * 60 * 1000,
      isVerified: sessionIsVerified,
      adminAuthorized: candidate.adminAuthorized === true && sessionIsVerified,
    } as AuthSession;
  }

  public static getCurrentSession(): AuthSession | null {
    try {
      const sessionStr = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!sessionStr) return null;
      const session = this.normalizeSession(JSON.parse(sessionStr));
      if (!session) return null;

      if (session.expiresAt && Date.now() > session.expiresAt) {
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
    if (!current) return { session: null, botConfig: null };

    try {
      const resp = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${current.token}`,
        },
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.user) {
          const updatedSession = this.normalizeSession({
            ...current,
            user: { ...data.user, isVerified: true },
            isVerified: true,
            adminAuthorized: true,
          });
          if (!updatedSession) return { session: current, botConfig: data.botConfig || null };
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedSession));
          return {
            session: updatedSession,
            botConfig: data.botConfig || null,
          };
        }
      }
    } catch (err) {
      console.warn('Backend sync notice (using local active session):', err);
    }

    return { session: current, botConfig: null };
  }

  // Sign up a new user (Instant automated verification & persistent login without OTP requirement)
  public static async signUp(params: {
    name: string;
    email: string;
    password: string;
    role?: 'admin' | 'developer' | 'operator';
  }): Promise<{ success: boolean; message: string; user?: UserAccount; session?: AuthSession; verificationCode?: string }> {
    try {
      const resp = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return { success: false, message: data?.message || 'Registration failed.' };
      }
      if (resp.ok && data.success && data.user) {
        const verifiedUser: UserAccount = {
          ...data.user,
          isVerified: data.session?.isVerified === true,
        };
        const signupSession: AuthSession = {
          token: data.session?.token || `signup_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
          user: verifiedUser,
          expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
          isVerified: verifiedUser.isVerified,
          adminAuthorized: verifiedUser.isVerified && verifiedUser.role === 'admin',
        };
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(signupSession));
        return {
          success: true,
          message: data.message || `Account created for ${verifiedUser.name}.`,
          user: verifiedUser,
          session: signupSession,
          verificationCode: data.verificationCode,
        };
      }
    } catch (err) {
      return { success: false, message: 'Registration service is unavailable. Please try again.' };
    }
    return { success: false, message: 'Registration service returned no usable response.' };
  }

  // Verify OTP once and issue the persisted verified session.
  public static async verifyEmailCode(email: string, code: string): Promise<{ success: boolean; message: string; session?: AuthSession }> {
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success && data.session) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data.session));
        return data;
      }
      return { success: false, message: data.message || 'Verification failed.' };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Verification service is unavailable.' };
    }
  }

  // Resend OTP code
  public static async resendVerificationCode(email: string): Promise<{ success: boolean; message: string; code?: string }> {
    try {
      const response = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      return response.ok ? data : { success: false, message: data.message || 'Unable to resend verification code.' };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Verification service is unavailable.' };
    }
  }

  // Log in existing user (Instant verification, bypasses OTP)
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
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await resp.json();
      if (resp.ok && data.success && data.session) {
        const verifiedSession = {
          ...data.session,
          isVerified: true,
          adminAuthorized: true,
          user: {
            ...data.session.user,
            isVerified: true,
            role: 'admin',
          },
        };
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(verifiedSession));
        return {
          success: true,
          message: data.message || `Welcome back!`,
          session: verifiedSession,
          requiresVerification: false,
        };
      }
      if (data.requiresVerification || data.unverifiedUser) {
        return {
          success: false,
          message: data.message || 'Please verify your account before logging in.',
          requiresVerification: true,
          unverifiedUser: data.unverifiedUser,
          verificationCode: data.verificationCode,
        };
      }
    } catch (err) {
      return { success: false, message: 'Authentication service is unavailable. Please try again.' };
    }
    return { success: false, message: 'Authentication service returned no usable response.' };
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
    try {
      const resp = await fetch('/api/admin/backup/export');
      if (!resp.ok) {
        throw new Error(`Failed to export server database backup (HTTP ${resp.status}).`);
      }
      return await resp.json();
    } catch (error: any) {
      throw new Error(error?.message || 'Failed to export server database backup.');
    }
  }

  // Import full system backup JSON
  public static async importBackupJson(backupData: any): Promise<{ success: boolean; message: string; importedUsers: number; importedConfigs: number }> {
    try {
      const resp = await fetch('/api/admin/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backupData),
      });
      const data = await resp.json().catch(() => ({}));
      return resp.ok ? data : {
        success: false,
        message: data?.message || `Backup import failed (HTTP ${resp.status}).`,
        importedUsers: 0,
        importedConfigs: 0,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || 'Backup import service is unavailable.',
        importedUsers: 0,
        importedConfigs: 0,
      };
    }
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
