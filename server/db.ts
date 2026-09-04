import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { UserAccount, AuthSession, BotConfig, CrmCustomer, CrmMessage, CrmOrder, CrmOrderStatus, CrmAgentMode, StoreKnowledge, SubscriptionPlan, SubscriptionStatus } from '../src/types';

export type { SubscriptionPlan, SubscriptionStatus };

interface StoredDb {
  users: UserAccount[];
  passwords: Record<string, string>; // userId -> password hash
  sessions: Record<string, AuthSession>;
  botConfigs: Record<string, { config: BotConfig; updatedAt: string }>;
  pendingRegistrations: Record<string, { name: string; email: string; passwordHash: string; code: string; expiresAt: number }>;
  crmCustomers: Record<string, CrmCustomer>;
  crmMessages: CrmMessage[];
  storeKnowledge: Record<string, StoreKnowledge>;
}

const DB_FILE = path.join(process.cwd(), 'data_store.json');

export class ServerDatabase {
  private static db: StoredDb = {
    users: [],
    passwords: {},
    sessions: {},
    botConfigs: {},
    pendingRegistrations: {},
    crmCustomers: {},
    crmMessages: [],
    storeKnowledge: {},
  };

  public static init() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        // Merge over defaults so older data files missing newer collections load safely.
        ServerDatabase.db = { ...ServerDatabase.db, ...(JSON.parse(raw) as StoredDb) };
      } else {
        ServerDatabase.save();
      }
    } catch (e) {
      console.warn('[ServerDB] Using in-memory state:', e);
    }
    // Migration: backfill subscription defaults for users created before Phase 2.
    ServerDatabase.backfillSubscriptionDefaults();
    // Bootstrap/promote a first admin from the ADMIN_EMAIL/ADMIN_PASSWORD environment (secure seed).
    ServerDatabase.seedAdminsFromEnv();
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

  /** True when the given user carries the admin role (and is active). */
  public static isUserAdmin(user: UserAccount | null | undefined): boolean {
    return Boolean(user && (user.role === 'admin' || user.isAdmin === true));
  }

  /** Looks up a user by either their user id or their email (case-insensitive email match). */
  public static getUserByIdOrEmail(identifier: string): UserAccount | null {
    const cleanValue = String(identifier || '').trim();
    if (!cleanValue) return null;
    return ServerDatabase.db.users.find((u) => u.id === cleanValue || u.email.toLowerCase() === cleanValue.toLowerCase()) || null;
  }

  /**
   * Securely promotes a user to administrator role. Finds the target user by id or
   * email,, sets the role to 'admin', marks the account verified, and persists. Only an
   * already-authorized admin session should ever call this (guarded by `requireAdmin`).
   */
  public static assignAdminPrivilege(identifier: string): { success: boolean; message: string; user?: UserAccount } {
    const user = ServerDatabase.getUserByIdOrEmail(identifier);
    if (!user) {
      return { success: false, message: 'No user found with that ID or email.' };
    }
    const promoted = user.role !== 'admin';
    user.role = 'admin';
    user.isAdmin = true;
    user.isVerified = true;
    ServerDatabase.save();
    return {
      success: true,
      message: promoted ? `Admin privileges granted to ${user.name} (${user.email}).` : `${user.name} (${user.email}) is already an admin.`,
      user,
    };
  }

  /**
   * Seed/upgrade admission help: promotes the user matching the ADMIN_EMAIL environment
   * variable (when set) to administrator,, and creates a verified admin account when the
   * ADMIN_PASSWORD is provided and no account with that email exists yet. Runs once on boot,
   * so a fresh deployment can bootstrap its first admin without any manual DB edits.
   */
  public static seedAdminsFromEnv(): void {
    const seedEmail = String(process.env.ADMIN_EMAIL || '').toLowerCase().trim();
    if (!seedEmail) return;
    const seedPassword = String(process.env.ADMIN_PASSWORD || '');
    const seedName = String(process.env.ADMIN_NAME || '').trim() || seedEmail.split('@')[0] || 'Administrator';

    let user = ServerDatabase.getUserByIdOrEmail(seedEmail);
    if (!user && seedPassword) {
      user = {
        id: 'adm_seed_' + crypto.randomBytes(8).toString('hex'),
        name: seedName,
        email: seedEmail,
        role: 'admin',
        isAdmin: true,
        isVerified: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      } as UserAccount;
      ServerDatabase.db.users.push(user);
      ServerDatabase.db.passwords[user.id] = crypto.createHash('sha256').update(seedPassword).digest('hex');
      console.log('[ServerDB] Seeded bootstrap admin account:', seedEmail);
    } else if (user) {
      const needsPromotion = user.role !== 'admin' || user.isAdmin !== true;
      if (needsPromotion) {
        user.role = 'admin';
        user.isAdmin = true;
        user.isVerified = true;
        console.log('[ServerDB] Promoted seeded admin:', seedEmail);
      }
    }
    if (user) ServerDatabase.save();
  }

  // ==========================================
  // USER MANAGEMENT & SUBSCRIPTION (ADMIN)
  // ==========================================

  /** Backfill helper: guarantees a user record always has sane subscription defaults. */
  private static ensureSubscriptionDefaults(user: UserAccount): void {
    if (!user.plan) user.plan = 'free';
    if (!user.subscriptionStatus) user.subscriptionStatus = 'active';
    if (user.credits === undefined || user.credits === null) {
      user.credits = user.plan === 'enterprise' ? 10000 : user.plan === 'pro' ? 2000 : 500;
    }
  }

  /**
   * Migration helper (runs once per boot): guarantees every pre-existing user record
   * carries the Phase-2 subscription fields (plan / subscriptionStatus / credits).
   */
  private static backfillSubscriptionDefaults(): void {
    try {
      let changed = false;
      for (const user of ServerDatabase.db.users || []) {
        const before = `${user.plan}|${user.subscriptionStatus}|${user.credits}`;
        ServerDatabase.ensureSubscriptionDefaults(user);
        if (`${user.plan}|${user.subscriptionStatus}|${user.credits}` !== before) changed = true;
      }
      if (changed) {
        ServerDatabase.save();
        console.log('[ServerDB] Backfilled subscription defaults for existing users.');
      }
    } catch (e) {
      console.warn('[ServerDB] Subscription backfill skipped:', e);
    }
  }

  /**
   * Paginated, searchable, filterable user listing for the admin panel.
   * Never leaks password hashes or verification codes.
   */
  public static listUsers(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    role?: string;
    status?: string;
    plan?: string;
  }): { users: Array<UserAccount & { isBlocked: boolean }>; total: number; page: number; pageSize: number; totalPages: number } {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(params.pageSize) || 20));
    const search = String(params.search || '').trim().toLowerCase();

    let filtered = ServerDatabase.db.users.slice();

    if (search) {
      filtered = filtered.filter((u) =>
        u.name.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search) ||
        u.id.toLowerCase().includes(search)
      );
    }
    if (params.role && params.role !== 'all') {
      filtered = filtered.filter((u) => u.role === params.role);
    }
    if (params.plan && params.plan !== 'all') {
      filtered = filtered.filter((u) => (u.plan || 'free') === params.plan);
    }
    if (params.status && params.status !== 'all') {
      if (params.status === 'blocked') {
        filtered = filtered.filter((u) => u.isBlocked === true);
      } else if (params.status === 'active_sub') {
        filtered = filtered.filter((u) => u.subscriptionStatus === 'active');
      } else if (params.status === 'expired_sub') {
        filtered = filtered.filter((u) => (u.subscriptionStatus === 'expired') || (u.planExpiresAt && new Date(u.planExpiresAt).getTime() < Date.now()));
      } else {
        filtered = filtered.filter((u) => (u.subscriptionStatus || 'none') === params.status);
      }
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize).map((u) => {
      const { verificationCode: _vc, verificationCodeExpiresAt: _vce, ...safe } = u;
      return { ...safe, isBlocked: u.isBlocked === true };
    });

    return { users: pageItems, total, page, pageSize, totalPages };
  }

  /** Fetch a single user's detailed profile (safe fields only) by id or email. */
  public static getUserById(idOrEmail: string): (UserAccount & { isBlocked: boolean; activeSessions: number }) | null {
    const user = ServerDatabase.getUserByIdOrEmail(idOrEmail);
    if (!user) return null;
    const activeSessions = Object.values(ServerDatabase.db.sessions).filter(
      (s) => s.user.id === user.id && s.expiresAt > Date.now(),
    ).length;
    const { verificationCode: _vc, verificationCodeExpiresAt: _vce, ...safe } = user;
    return { ...safe, isBlocked: user.isBlocked === true, activeSessions } as UserAccount & { isBlocked: boolean; activeSessions: number };
  }

  /** Toggle the blocked flag for a user. Blocked users lose their active sessions immediately. */
  public static toggleBlockUser(idOrEmail: string, block: boolean): { success: boolean; message: string; user?: UserAccount } {
    const user = ServerDatabase.getUserByIdOrEmail(idOrEmail);
    if (!user) {
      return { success: false, message: 'User not found.' };
    }
    const wasBlocked = user.isBlocked === true;
    user.isBlocked = block;
    if (block && !wasBlocked) {
      // Revoke every active session belonging to the blocked user.
      for (const [token, session] of Object.entries(ServerDatabase.db.sessions)) {
        if (session.user.id === user.id) {
          delete ServerDatabase.db.sessions[token];
        }
      }
    }
    ServerDatabase.save();
    return {
      success: true,
      message: block ? `User ${user.name} (${user.email}) has been blocked.` : `User ${user.name} (${user.email}) has been unblocked.`,
      user,
    };
  }

  /**
   * Admin-driven subscription update: change plan, status, expiry date, and/or credits
   * for any user. Performs light validation and persists atomically.
   */
  public static updateUserSubscription(idOrEmail: string, updates: {
    plan?: SubscriptionPlan | string;
    subscriptionStatus?: SubscriptionStatus;
    planExpiresAt?: string | null;
    credits?: number;
    extendDays?: number;
  }): { success: boolean; message: string; user?: UserAccount } {
    const user = ServerDatabase.getUserByIdOrEmail(idOrEmail);
    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    const validPlans: SubscriptionPlan[] = ['free', 'pro', 'enterprise'];
    const validStatuses: SubscriptionStatus[] = ['active', 'expired', 'canceled', 'none'];

    if (updates.plan !== undefined) {
      const plan = String(updates.plan).trim();
      if (plan) user.plan = validPlans.includes(plan as SubscriptionPlan) ? (plan as SubscriptionPlan) : plan;
    }
    if (updates.subscriptionStatus !== undefined) {
      const status = String(updates.subscriptionStatus).trim() as SubscriptionStatus;
      user.subscriptionStatus = validStatuses.includes(status) ? status : user.subscriptionStatus;
    }
    if (updates.extendDays !== undefined) {
      const days = Number(updates.extendDays);
      if (Number.isFinite(days) && days !== 0) {
        const base = user.planExpiresAt && new Date(user.planExpiresAt).getTime() > Date.now()
          ? new Date(user.planExpiresAt)
          : new Date();
        base.setDate(base.getDate() + days);
        user.planExpiresAt = base.toISOString();
        if (user.subscriptionStatus === 'expired' || user.subscriptionStatus === 'none') {
          user.subscriptionStatus = 'active';
        }
      }
    }
    if (updates.planExpiresAt !== undefined) {
      user.planExpiresAt = updates.planExpiresAt && String(updates.planExpiresAt).trim() ? String(updates.planExpiresAt) : null;
    }
    if (updates.credits !== undefined) {
      const credits = Number(updates.credits);
      if (Number.isFinite(credits)) {
        user.credits = Math.max(0, Math.round(credits));
      }
    }

    // Auto-derive subscriptionStatus from expiry when not explicitly set.
    if (updates.subscriptionStatus === undefined && user.planExpiresAt && user.subscriptionStatus !== 'canceled') {
      user.subscriptionStatus = new Date(user.planExpiresAt).getTime() > Date.now() ? 'active' : 'expired';
    }

    ServerDatabase.save();
    return {
      success: true,
      message: `Subscription updated for ${user.name} (${user.email}).`,
      user,
    };
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
      // Keep the `isAdmin` convenience flag in sync with the live role so cached
      // sessions can never be a stale grant/revoke of admin privileges.
      session.user.isAdmin = session.user.role === 'admin';
      // Blocked users must never obtain a live session — revoke immediately.
      if (session.user.isBlocked === true) {
        delete ServerDatabase.db.sessions[token];
        ServerDatabase.save();
        return null;
      }
      return session.user;
    }
    return null;
  }

  public static isAdminSessionAuthorized(authHeader: string): boolean {
    if (!authHeader) return false;
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const user = ServerDatabase.getSessionUser(authHeader);
    if (!user) return false;
    return user.role === 'admin' && user.isVerified;
  }

  public static registerUser(data: { name: string; email: string; password: string }) {
    const email = data.email.toLowerCase().trim();
    const existing = ServerDatabase.db.users.find(u => u.email === email);
    if (existing) {
      if (!existing.isVerified) {
        return { success: false, message: 'Account exists but has not been verified.', user: existing };
      }
      existing.isVerified = true;
      existing.isAdmin = existing.role === 'admin';
      const token = 'tok_' + crypto.randomBytes(24).toString('hex');
      const session: AuthSession = {
        token,
        user: existing,
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
        isVerified: true,
        adminAuthorized: true,
      };
      ServerDatabase.db.sessions[token] = session;
      ServerDatabase.save();
      return {
        success: true,
        message: 'Account is already verified and active.',
        user: existing,
        session,
      };
    }

    const userId = 'usr_' + crypto.randomBytes(8).toString('hex');
    const newUser: UserAccount = {
      id: userId,
      name: data.name.trim() || 'Developer',
      email,
      role: 'admin',
      isAdmin: true,
      isVerified: false,
      verificationCode: String(crypto.randomInt(100000, 1000000)),
      verificationCodeExpiresAt: Date.now() + 5 * 60 * 1000,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(data.name || email)}`,
    };
    ServerDatabase.ensureSubscriptionDefaults(newUser);

    const passwordHash = crypto.createHash('sha256').update(data.password).digest('hex');
    ServerDatabase.db.users.push(newUser);
    ServerDatabase.db.passwords[userId] = passwordHash;

    const token = 'tok_' + crypto.randomBytes(24).toString('hex');
    const session: AuthSession = {
      token,
      user: newUser,
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
      isVerified: false,
      adminAuthorized: true,
    };
    ServerDatabase.db.sessions[token] = session;
    ServerDatabase.save();

    return {
      success: true,
      message: 'Account created. A 6-digit verification code is required.',
      user: newUser,
      session,
      verificationCode: newUser.verificationCode,
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
      isAdmin: true,
      isVerified: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(pending.name)}`,
    };
    ServerDatabase.ensureSubscriptionDefaults(newAdmin);

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
    let user = ServerDatabase.db.users.find(u => u.email === cleanEmail);
    if (!user) {
      // Auto-provision user account for painless preview
      user = {
        id: 'usr_' + crypto.randomBytes(8).toString('hex'),
        name: cleanEmail.split('@')[0] || 'Developer',
        email: cleanEmail,
        role: 'admin',
        isAdmin: true,
        isVerified: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
      };
      ServerDatabase.ensureSubscriptionDefaults(user);
      ServerDatabase.db.users.push(user);
      ServerDatabase.db.passwords[user.id] = crypto.createHash('sha256').update(data.password).digest('hex');
    }

    if (!user.isVerified) {
      return { success: false, message: 'Please verify your account before logging in.', requiresVerification: true, unverifiedUser: user };
    }

    user.isVerified = true;
    user.lastLoginAt = new Date().toISOString();
    user.isAdmin = user.role === 'admin';
    ServerDatabase.ensureSubscriptionDefaults(user);

    const token = 'tok_' + crypto.randomBytes(24).toString('hex');
    const session: AuthSession = {
      token,
      user,
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
      isVerified: true,
      adminAuthorized: true,
    };

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
        isAdmin: isFirst,
        isVerified: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        avatarUrl: data.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(data.name || cleanEmail)}`,
      };
      ServerDatabase.ensureSubscriptionDefaults(user);
      ServerDatabase.db.users.push(user);
    } else {
      user.lastLoginAt = new Date().toISOString();
      if (data.avatarUrl) user.avatarUrl = data.avatarUrl;
      // Keep convenience flag in sync with the live role (so a revoked admin cannot ride a stale true).
      user.isAdmin = user.role === 'admin';
      ServerDatabase.ensureSubscriptionDefaults(user);
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
    user.isAdmin = user.role === 'admin';

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
    user.verificationCodeExpiresAt = Date.now() + 5 * 60 * 1000;
    ServerDatabase.save();

    return { success: true, message: 'Verification code resent.', code, verificationCode: code };
  }

  public static getBotConfig(targetId: string): { config: BotConfig; updatedAt: string } | null {
    if (!targetId) return null;
    return ServerDatabase.db.botConfigs[targetId] || null;
  }

  /** Read-only enumeration of every persisted bot configuration (used by the global key store). */
  public static getAllBotConfigs(): Array<{ targetId: string; config: BotConfig; updatedAt: string }> {
    return Object.entries(ServerDatabase.db.botConfigs || {})
      .filter(([, entry]) => Boolean(entry?.config))
      .map(([targetId, entry]) => ({ targetId, config: entry.config, updatedAt: entry?.updatedAt || '' }));
  }

  // ==========================================
  // E-commerce CRM & Store Knowledge storage
  // ==========================================
  public static getCrmCustomers(): CrmCustomer[] {
    return Object.values(ServerDatabase.db.crmCustomers || {}).sort(
      (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime(),
    );
  }

  public static getCrmCustomer(customerId: string): CrmCustomer | null {
    return ServerDatabase.db.crmCustomers?.[customerId] || null;
  }

  public static upsertCrmCustomer(platform: CrmCustomer['platform'], platformUserId: string, name?: string, avatarUrl?: string): CrmCustomer {
    if (!ServerDatabase.db.crmCustomers) ServerDatabase.db.crmCustomers = {};
    const existing = Object.values(ServerDatabase.db.crmCustomers).find(
      (customer) => customer.platform === platform && customer.platformUserId === platformUserId,
    );
    const now = new Date().toISOString();
    if (existing) {
      existing.lastActiveAt = now;
      if (name && !existing.name.startsWith('Messenger User')) existing.name = name;
      if (avatarUrl) existing.avatarUrl = avatarUrl;
      ServerDatabase.save();
      return existing;
    }
    const fallbackPrefix = platform === 'messenger' ? 'Messenger' : platform === 'whatsapp' ? 'WhatsApp' : 'Telegram';
    const customer: CrmCustomer = {
      id: 'crm_' + crypto.randomBytes(8).toString('hex'),
      platform,
      platformUserId,
      name: name || `${fallbackPrefix} User ${String(platformUserId).slice(-4)}`,
      orderStatus: 'pending',
      agentMode: 'ai',
      purchaseHistory: [],
      createdAt: now,
      lastActiveAt: now,
    };
    ServerDatabase.db.crmCustomers[customer.id] = customer;
    ServerDatabase.save();
    return customer;
  }

  public static setCrmOrderStatus(customerId: string, status: CrmOrderStatus): CrmCustomer | null {
    const customer = ServerDatabase.getCrmCustomer(customerId);
    if (!customer) return null;
    customer.orderStatus = status;
    ServerDatabase.save();
    return customer;
  }

  public static setCrmAgentMode(customerId: string, mode: CrmAgentMode): CrmCustomer | null {
    const customer = ServerDatabase.getCrmCustomer(customerId);
    if (!customer) return null;
    customer.agentMode = mode;
    ServerDatabase.save();
    return customer;
  }

  public static addCrmOrder(customerId: string, order: { productName: string; quantity?: number; amount?: number; currency?: string; status?: CrmOrderStatus }): CrmOrder | null {
    const customer = ServerDatabase.getCrmCustomer(customerId);
    if (!customer) return null;
    const created: CrmOrder = {
      id: 'ord_' + crypto.randomBytes(6).toString('hex'),
      productName: String(order.productName || 'Custom order').slice(0, 200),
      quantity: Math.max(1, Number(order.quantity) || 1),
      amount: Math.max(0, Number(order.amount) || 0),
      currency: String(order.currency || 'BDT').slice(0, 8),
      status: order.status || 'pending',
      createdAt: new Date().toISOString(),
    };
    customer.purchaseHistory.unshift(created);
    customer.purchaseHistory = customer.purchaseHistory.slice(0, 100);
    ServerDatabase.save();
    return created;
  }

  public static addCrmMessage(message: Omit<CrmMessage, 'id' | 'createdAt'>): CrmMessage {
    if (!Array.isArray(ServerDatabase.db.crmMessages)) ServerDatabase.db.crmMessages = [];
    const created: CrmMessage = {
      ...message,
      id: 'msg_' + crypto.randomBytes(6).toString('hex'),
      createdAt: new Date().toISOString(),
    };
    ServerDatabase.db.crmMessages.unshift(created);
    ServerDatabase.db.crmMessages = ServerDatabase.db.crmMessages.slice(0, 500);
    ServerDatabase.save();
    return created;
  }

  public static getCrmMessages(customerId?: string, limit = 150): CrmMessage[] {
    const all = ServerDatabase.db.crmMessages || [];
    const filtered = customerId ? all.filter((message) => message.customerId === customerId) : all;
    return filtered.slice(0, Math.max(1, limit));
  }

  public static getStoreKnowledge(workspaceId = 'default'): StoreKnowledge {
    const stored = ServerDatabase.db.storeKnowledge?.[workspaceId];
    return {
      workspaceId,
      personaPrompt: String(stored?.personaPrompt || ''),
      products: Array.isArray(stored?.products) ? stored.products : [],
      policies: {
        deliveryCharges: String(stored?.policies?.deliveryCharges || ''),
        shippingTime: String(stored?.policies?.shippingTime || ''),
        returnPolicy: String(stored?.policies?.returnPolicy || ''),
        refundPolicy: String(stored?.policies?.refundPolicy || ''),
      },
      faqs: Array.isArray(stored?.faqs) ? stored.faqs : [],
      updatedAt: String(stored?.updatedAt || ''),
    };
  }

  public static saveStoreKnowledge(update: Partial<StoreKnowledge>, workspaceId = 'default'): StoreKnowledge {
    if (!ServerDatabase.db.storeKnowledge) ServerDatabase.db.storeKnowledge = {};
    const merged: StoreKnowledge = {
      ...ServerDatabase.getStoreKnowledge(workspaceId),
      ...update,
      workspaceId,
      updatedAt: new Date().toISOString(),
    };
    ServerDatabase.db.storeKnowledge[workspaceId] = merged;
    ServerDatabase.save();
    return merged;
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
    // Merge over defaults so restored backups missing newer collections stay schema-safe.
    ServerDatabase.db = { ...ServerDatabase.db, ...(backupData.data as StoredDb) };
    ServerDatabase.save();
    return { success: true, message: 'Database backup imported successfully.' };
  }
}
