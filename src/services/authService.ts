import { UserAccount, AuthSession } from '../types';

const USERS_STORAGE_KEY = 'groq_bot_users_db_v1';
const SESSION_STORAGE_KEY = 'groq_bot_auth_session_v1';

// Seed initial users if none exist in localStorage
const INITIAL_USERS: UserAccount[] = [
  {
    id: 'usr_admin_syful',
    name: 'Syful Islam',
    email: 'syfulislam12234@gmail.com',
    role: 'admin',
    isVerified: true,
    verificationCode: '749201',
    createdAt: '2026-08-20T10:00:00.000Z',
    lastLoginAt: '2026-08-22T02:00:00.000Z',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    bio: 'Lead System Architect & Admin',
  },
  {
    id: 'usr_demo_dev',
    name: 'Alex Rivera',
    email: 'demo@groqbot.io',
    role: 'developer',
    isVerified: true,
    verificationCode: '749201',
    createdAt: '2026-08-21T12:00:00.000Z',
    lastLoginAt: '2026-08-22T01:30:00.000Z',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    bio: 'Bot Engineer & AI Specialist',
  },
];

// Simple password store in localStorage for demo authentication
const PASSWORDS_STORAGE_KEY = 'groq_bot_passwords_v1';
const INITIAL_PASSWORDS: Record<string, string> = {
  'syfulislam12234@gmail.com': 'admin123456',
  'demo@groqbot.io': 'demo123456',
};

export class AuthService {
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

      // Check if session has expired (e.g. 7 days)
      if (session.expiresAt && Date.now() > session.expiresAt) {
        this.logOut();
        return null;
      }

      // Verify user still exists in DB
      const users = this.getStoredUsers();
      const user = users.find(u => u.id === session.user.id || u.email.toLowerCase() === session.user.email.toLowerCase());
      if (!user) {
        this.logOut();
        return null;
      }

      return {
        ...session,
        user,
      };
    } catch {
      return null;
    }
  }

  // Sign up a new user and generate a verification OTP
  public static signUp(params: {
    name: string;
    email: string;
    password: string;
    role?: 'admin' | 'developer' | 'operator';
  }): { success: boolean; message: string; user?: UserAccount; verificationCode?: string } {
    const cleanEmail = params.email.toLowerCase().trim();
    const users = this.getStoredUsers();

    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return {
        success: false,
        message: 'An account with this email address already exists. Please log in or use another email.',
      };
    }

    // Generate a 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const newUser: UserAccount = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: params.name.trim(),
      email: cleanEmail,
      role: params.role || (cleanEmail.includes('admin') ? 'admin' : 'developer'),
      isVerified: false,
      verificationCode,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(params.name)}`,
      bio: 'Cloud Bot Builder Member',
    };

    users.push(newUser);
    this.saveUsers(users);
    this.savePassword(cleanEmail, params.password);

    return {
      success: true,
      message: 'Account created! Please enter the 6-digit verification code sent to your email.',
      user: newUser,
      verificationCode,
    };
  }

  // Verify OTP and issue session token
  public static verifyEmailCode(email: string, code: string): { success: boolean; message: string; session?: AuthSession } {
    const cleanEmail = email.toLowerCase().trim();
    const users = this.getStoredUsers();
    const userIndex = users.findIndex(u => u.email.toLowerCase() === cleanEmail);

    if (userIndex === -1) {
      return { success: false, message: 'User account not found. Please sign up first.' };
    }

    const user = users[userIndex];

    // Check code (or default master test code '749201' for easy developer testing)
    if (user.verificationCode !== code && code !== '749201') {
      return {
        success: false,
        message: 'Invalid verification code. Please check your 6-digit OTP and try again.',
      };
    }

    // Mark as verified
    user.isVerified = true;
    user.lastLoginAt = new Date().toISOString();
    users[userIndex] = user;
    this.saveUsers(users);

    // Create session
    const session: AuthSession = {
      token: `gauth_${Date.now()}_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`,
      user,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

    return {
      success: true,
      message: 'Email successfully verified! Welcome to Groq Telegram Bot Builder.',
      session,
    };
  }

  // Resend OTP code
  public static resendVerificationCode(email: string): { success: boolean; message: string; code?: string } {
    const cleanEmail = email.toLowerCase().trim();
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
      message: `A new 6-digit verification code (${newCode}) has been generated.`,
      code: newCode,
    };
  }

  // Log in existing user
  public static logIn(params: {
    email: string;
    password: string;
  }): {
    success: boolean;
    message: string;
    session?: AuthSession;
    requiresVerification?: boolean;
    unverifiedUser?: UserAccount;
  } {
    const cleanEmail = params.email.toLowerCase().trim();
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

    // If password doesn't match and not using default fallback password
    if (savedPassword && savedPassword !== params.password && params.password !== 'admin123456' && params.password !== 'demo123456') {
      return {
        success: false,
        message: 'Incorrect password. Please try again or use the demo credentials.',
      };
    }

    // If user is not yet verified, request verification
    if (!user.isVerified) {
      return {
        success: false,
        message: 'Your email address is not yet verified. Please enter your 6-digit verification code.',
        requiresVerification: true,
        unverifiedUser: user,
      };
    }

    // Update last login
    user.lastLoginAt = new Date().toISOString();
    this.saveUsers(users);

    const session: AuthSession = {
      token: `gauth_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      user,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

    return {
      success: true,
      message: `Welcome back, ${user.name}!`,
      session,
    };
  }

  // Quick 1-click test login for quick preview / demo
  public static quickLogin(type: 'admin' | 'developer'): AuthSession {
    const users = this.getStoredUsers();
    const targetEmail = type === 'admin' ? 'syfulislam12234@gmail.com' : 'demo@groqbot.io';
    let user = users.find(u => u.email.toLowerCase() === targetEmail);

    if (!user) {
      user = type === 'admin' ? INITIAL_USERS[0] : INITIAL_USERS[1];
      users.push(user);
      this.saveUsers(users);
    }

    user.isVerified = true;
    user.lastLoginAt = new Date().toISOString();
    this.saveUsers(users);

    const session: AuthSession = {
      token: `gauth_${Date.now()}_quick_${type}`,
      user,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    return session;
  }

  // Log out current session
  public static logOut() {
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
