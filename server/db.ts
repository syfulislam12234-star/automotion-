import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { UserAccount, AuthSession, BotConfig, CrmCustomer, CrmMessage, CrmOrder, CrmOrderStatus, CrmAgentMode, StoreKnowledge, SubscriptionPlan, SubscriptionStatus, PaymentTransaction, PaymentStatus, PaymentMethod, SystemConfig, AdPlacement, AiProviderConfig, FeatureCreditCosts, SystemAlert, RevenueStats, AuditLog, SupportTicket } from '../src/types';

export type { SubscriptionPlan, SubscriptionStatus, PaymentTransaction, PaymentStatus, PaymentMethod, SystemConfig, AdPlacement, AiProviderConfig, FeatureCreditCosts, SystemAlert, RevenueStats };

interface StoredDb {
  users: UserAccount[];
  passwords: Record<string, string>; // userId -> password hash
  sessions: Record<string, AuthSession>;
  botConfigs: Record<string, { config: BotConfig; updatedAt: string }>;
  pendingRegistrations: Record<string, { name: string; email: string; passwordHash: string; code: string; expiresAt: number }>;
  crmCustomers: Record<string, CrmCustomer>;
  crmMessages: CrmMessage[];
  storeKnowledge: Record<string, StoreKnowledge>;
  payments: PaymentTransaction[];
  systemConfig: SystemConfig;
  systemAlerts: SystemAlert[];
  auditLogs: AuditLog[];
  supportTickets: SupportTicket[];
}

/** Zero-break defaults: everything enabled exactly like the pre-Phase-4 behaviour. */
const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  adsEnabled: false,
  adsByPlan: { free: true, pro: false, enterprise: false },
  adPlacements: [],
  aiProviders: [
    { id: 'groq', name: 'Groq Cloud LPU', enabled: true, priority: 10 },
    { id: 'cerebras', name: 'Cerebras LPU', enabled: true, priority: 12 },
    { id: 'google', name: 'Google Gemini', enabled: true, priority: 14 },
    { id: 'openrouter', name: 'OpenRouter', enabled: true, priority: 18 },
    { id: 'pollinations', name: 'Pollinations AI', enabled: true, priority: 30 },
  ],
  featureCreditCosts: { ytSeoCost: 5, ytViralCost: 8, ytCheckCost: 2, autoUploadCost: 10 },
  // Phase 5 app-control defaults mirror the pre-Phase-5 behaviour exactly.
  maintenanceMode: false,
  maintenanceMessage: '🛠️ We are performing scheduled maintenance. Please check back shortly!',
  registrationOpen: true,
  freeTrial: { enabled: false, trialDays: 3, bonusCredits: 100 },
  featureToggles: { liveStreaming: true, ytCheck: true, ytSeo: true, ytViral: true, autoUpload: true },
  paymentMethods: {
    bkash: '01XXX-XXXXXX',
    nagad: '01XXX-XXXXXX',
    rocket: '01XXX-XXXXXX',
    instructions: 'Send the plan amount to the number shown above for your chosen method, then enter your bKash/Nagad/Rocket sender number and the Transaction (Txn) ID from your confirmation SMS below.',
  },
};

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
    payments: [],
    systemConfig: DEFAULT_SYSTEM_CONFIG,
    systemAlerts: [],
    auditLogs: [],
    supportTickets: [],
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

  /** Public: mint and persist a fresh authenticated session for the given user. */
  public static createSession(user: UserAccount, ttlMs: number = 365 * 24 * 60 * 60 * 1000): AuthSession {
    const token = 'tok_' + crypto.randomBytes(24).toString('hex');
    const session: AuthSession = {
      token,
      user,
      expiresAt: Date.now() + ttlMs,
      isVerified: true,
      adminAuthorized: user.role === 'admin',
    };
    ServerDatabase.db.sessions[token] = session;
    ServerDatabase.save();
    return session;
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
   * Securely promotes a user to administrator role. FINAL Phase single-admin rule:
   * ONLY the account whose email matches the ADMIN_EMAIL environment variable may
   * ever hold admin privileges. The already-authorized admin may call this for the
   * matching account (idempotent); any other target is hard-refused.
   */
  public static assignAdminPrivilege(identifier: string): { success: boolean; message: string; user?: UserAccount } {
    const user = ServerDatabase.getUserByIdOrEmail(identifier);
    if (!user) {
      return { success: false, message: 'No user found with that ID or email.' };
    }
    if (!ServerDatabase.isAdminEmail(user.email)) {
      return { success: false, message: 'Access denied: only the configured administrator (ADMIN_EMAIL) may hold admin privileges.' };
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

  /** True only when the given email (case-insensitive) equals ADMIN_EMAIL exactly. */
  public static isAdminEmail(email: string): boolean {
    const adminEmail = String(process.env.ADMIN_EMAIL || '').toLowerCase().trim();
    return Boolean(adminEmail && String(email || '').toLowerCase().trim() === adminEmail);
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


  // ==========================================
  // PAYMENTS & TRANSACTIONS (Phase 3)
  // ==========================================

  /** Plan-tier default monthly credits granted when a payment is approved. */
  private static planDefaultCredits(plan: string): number {
    const cleanPlan = String(plan || '').toLowerCase();
    if (cleanPlan === 'enterprise') return 10000;
    if (cleanPlan === 'pro') return 2000;
    return 500;
  }

  /**
   * Creates a manual payment verification request submitted by a signed-in user.
   * Duplicate Txn IDs (pending/approved) are rejected globally to prevent
   * double-spending the same proof of payment; rejected IDs may be resubmitted.
   */
  public static createPaymentRequest(data: {
    userId: string;
    amount: number;
    currency?: string;
    paymentMethod: string;
    transactionId: string;
    planId: string;
    notes?: string;
  }): { success: boolean; message: string; payment?: PaymentTransaction } {
    const user = ServerDatabase.getUserByIdOrEmail(data.userId);
    if (!user) {
      return { success: false, message: 'Authenticated user could not be resolved.' };
    }
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, message: 'A valid payment amount is required.' };
    }
    const transactionId = String(data.transactionId || '').trim();
    if (!transactionId) {
      return { success: false, message: 'A transaction (Txn) ID is required.' };
    }
    const planId = String(data.planId || '').trim().toLowerCase();
    if (!planId || planId === 'free') {
      return { success: false, message: 'Choose a paid plan (Pro or Enterprise) for your payment.' };
    }
    const paymentMethod = String(data.paymentMethod || '').trim();
    if (!paymentMethod) {
      return { success: false, message: 'A payment method is required.' };
    }
    const duplicate = (ServerDatabase.db.payments || []).find(
      (p) => p.transactionId.toLowerCase() === transactionId.toLowerCase() && p.status !== 'rejected',
    );
    if (duplicate) {
      return { success: false, message: 'This transaction ID has already been submitted.' };
    }
    const currency: 'BDT' | 'USD' = String(data.currency || 'BDT').trim().toUpperCase() === 'USD' ? 'USD' : 'BDT';
    const now = new Date().toISOString();
    const payment: PaymentTransaction = {
      id: 'pay_' + crypto.randomBytes(8).toString('hex'),
      userId: user.id,
      amount: Math.round(amount * 100) / 100,
      currency,
      paymentMethod,
      transactionId,
      status: 'pending',
      planId,
      createdAt: now,
      updatedAt: now,
      notes: String(data.notes || '').trim() || undefined,
      userEmail: user.email,
      userName: user.name,
    };
    if (!Array.isArray(ServerDatabase.db.payments)) ServerDatabase.db.payments = [];
    ServerDatabase.db.payments.unshift(payment);
    ServerDatabase.db.payments = ServerDatabase.db.payments.slice(0, 2000);
    ServerDatabase.save();
    return { success: true, message: 'Payment submitted for verification.', payment };
  }

  /** Admin payment listing with status filter and Txn ID / email / name / ID search. */
  public static listPayments(params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): { payments: PaymentTransaction[]; total: number; page: number; limit: number; totalPages: number } {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(params.limit) || 20));
    const search = String(params.search || '').trim().toLowerCase();
    let filtered = (ServerDatabase.db.payments || []).slice();
    if (params.status && params.status !== 'all') {
      filtered = filtered.filter((p) => p.status === params.status);
    }
    if (search) {
      filtered = filtered.filter((p) =>
        p.transactionId.toLowerCase().includes(search) ||
        (p.userEmail || '').toLowerCase().includes(search) ||
        (p.userName || '').toLowerCase().includes(search) ||
        p.id.toLowerCase().includes(search) ||
        (p.userId || '').toLowerCase().includes(search),
      );
    }
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    return { payments: filtered.slice(start, start + limit), total, page, limit, totalPages };
  }

  /** All payment requests belonging to one user (newest first). */
  public static getUserPayments(userId: string, limit = 50): PaymentTransaction[] {
    return (ServerDatabase.db.payments || []).filter((p) => p.userId === userId).slice(0, Math.max(1, limit));
  }

  /**
   * Approves a pending payment: marks it approved and automatically upgrades/extends
   * the payer's subscription (selected plan + 30-day expiry + plan-default credits)
   * through the Phase-2 subscription manager.
   */
  public static approvePayment(paymentId: string, adminUserId: string): { success: boolean; message: string; payment?: PaymentTransaction; user?: UserAccount } {
    const payment = (ServerDatabase.db.payments || []).find((p) => p.id === String(paymentId || '').trim());
    if (!payment) {
      return { success: false, message: 'Payment not found.' };
    }
    if (payment.status !== 'pending') {
      return { success: false, message: `Payment is already ${payment.status}.` };
    }
    const now = new Date().toISOString();
    payment.status = 'approved';
    payment.updatedAt = now;
    payment.reviewedBy = adminUserId || undefined;
    payment.reviewedAt = now;
    // Auto-apply the subscription upgrade (plan + extend 30 days + grant credits).
    const credits = ServerDatabase.planDefaultCredits(payment.planId);
    const sub = ServerDatabase.updateUserSubscription(payment.userId, {
      plan: payment.planId,
      extendDays: 30,
      credits,
    });
    ServerDatabase.save();
    const user = ServerDatabase.getUserByIdOrEmail(payment.userId) || undefined;
    return {
      success: true,
      message: sub.success
        ? `Payment approved — ${payment.planId} plan activated for ${user?.email || payment.userId} (30 days, ${credits} credits).`
        : `Payment approved, but the subscription upgrade failed: ${sub.message}`,
      payment,
      user: user || sub.user,
    };
  }

  /** Rejects a pending payment with a mandatory reason note. */
  public static rejectPayment(paymentId: string, reason: string, adminUserId?: string): { success: boolean; message: string; payment?: PaymentTransaction } {
    const payment = (ServerDatabase.db.payments || []).find((p) => p.id === String(paymentId || '').trim());
    if (!payment) {
      return { success: false, message: 'Payment not found.' };
    }
    if (payment.status !== 'pending') {
      return { success: false, message: `Payment is already ${payment.status}.` };
    }
    const cleanReason = String(reason || '').trim();
    if (!cleanReason) {
      return { success: false, message: 'A rejection reason is required.' };
    }
    const now = new Date().toISOString();
    payment.status = 'rejected';
    payment.updatedAt = now;
    payment.notes = cleanReason;
    payment.reviewedBy = adminUserId || undefined;
    payment.reviewedAt = now;
    ServerDatabase.save();
    return { success: true, message: 'Payment rejected.', payment };
  }

  // ==========================================
  // SYSTEM ADS & AI CONFIGURATION (Phase 4)
  // ==========================================

  /**
   * Normalized system configuration: stored values merged over zero-break defaults,
   * so pre-Phase-4 data files (and missing fields) always resolve to safe values.
   */
  public static getSystemConfig(): SystemConfig {
    const stored = (ServerDatabase.db.systemConfig || {}) as Partial<SystemConfig>;
    const defaults = DEFAULT_SYSTEM_CONFIG;

    const adsByPlan = { ...defaults.adsByPlan, ...(stored.adsByPlan || {}) };
    const featureCreditCosts = { ...defaults.featureCreditCosts, ...(stored.featureCreditCosts || {}) };

    const storedProviders = Array.isArray(stored.aiProviders) && stored.aiProviders.length > 0
      ? stored.aiProviders
      : defaults.aiProviders;
    // Union with defaults so providers introduced in later versions are never lost.
    const aiProviders = storedProviders.map((p) => ({ ...p }));
    for (const d of defaults.aiProviders) {
      if (!aiProviders.some((p) => p.id === d.id)) aiProviders.push({ ...d });
    }

    const adPlacements = (Array.isArray(stored.adPlacements) ? stored.adPlacements : []).map((p, index) => ({
      id: String(p?.id || `ad_${index + 1}`),
      name: String(p?.name || `Placement ${index + 1}`),
      code: String(p?.code || ''),
      frequency: Number.isFinite(Number(p?.frequency)) && Number(p.frequency) >= 1 ? Math.round(Number(p.frequency)) : 1,
      enabled: p?.enabled !== false,
    }));

    return {
      adsEnabled: stored.adsEnabled === true,
      adsByPlan,
      adPlacements,
      aiProviders: aiProviders.map((p) => ({
        id: String(p?.id || ''),
        name: String(p?.name || p?.id || 'Provider'),
        enabled: p?.enabled !== false,
        priority: Number.isFinite(Number(p?.priority)) ? Number(p.priority) : 50,
      })),
      featureCreditCosts,
      maintenanceMode: stored.maintenanceMode === true,
      maintenanceMessage: String(stored.maintenanceMessage || defaults.maintenanceMessage || ''),
      registrationOpen: stored.registrationOpen !== false,
      freeTrial: {
        enabled: stored.freeTrial?.enabled === true,
        trialDays: Number.isFinite(Number(stored.freeTrial?.trialDays)) ? Math.max(0, Math.round(Number(stored.freeTrial?.trialDays))) : defaults.freeTrial.trialDays,
        bonusCredits: Number.isFinite(Number(stored.freeTrial?.bonusCredits)) ? Math.max(0, Math.round(Number(stored.freeTrial?.bonusCredits))) : defaults.freeTrial.bonusCredits,
      },
      featureToggles: {
        liveStreaming: stored.featureToggles?.liveStreaming !== false,
        ytCheck: stored.featureToggles?.ytCheck !== false,
        ytSeo: stored.featureToggles?.ytSeo !== false,
        ytViral: stored.featureToggles?.ytViral !== false,
        autoUpload: stored.featureToggles?.autoUpload !== false,
      },
      paymentMethods: {
        bkash: String(stored.paymentMethods?.bkash || defaults.paymentMethods.bkash || ''),
        nagad: String(stored.paymentMethods?.nagad || defaults.paymentMethods.nagad || ''),
        rocket: String(stored.paymentMethods?.rocket || defaults.paymentMethods.rocket || ''),
        instructions: String(stored.paymentMethods?.instructions || defaults.paymentMethods.instructions || ''),
      },
    };
  }

  /** Update ads configuration (global toggle, plan eligibility, placements). */
  public static updateAdsConfig(patch: {
    adsEnabled?: boolean;
    adsByPlan?: Partial<SystemConfig['adsByPlan']>;
    adPlacements?: AdPlacement[];
  }): SystemConfig {
    const current = ServerDatabase.getSystemConfig();
    const adsByPlan = { ...current.adsByPlan };
    if (patch.adsByPlan && typeof patch.adsByPlan === 'object') {
      for (const key of ['free', 'pro', 'enterprise'] as const) {
        if (patch.adsByPlan[key] !== undefined) adsByPlan[key] = patch.adsByPlan[key] === true;
      }
    }
    const adPlacements = Array.isArray(patch.adPlacements) ? patch.adPlacements : current.adPlacements;
    const merged: SystemConfig = {
      ...current,
      adsEnabled: patch.adsEnabled === undefined ? current.adsEnabled : patch.adsEnabled === true,
      adsByPlan,
      adPlacements,
    };
    ServerDatabase.db.systemConfig = merged;
    ServerDatabase.save();
    return merged;
  }

  /** Update AI provider ordering/toggles and per-feature credit costs. */
  public static updateAiConfig(patch: {
    aiProviders?: AiProviderConfig[];
    featureCreditCosts?: Partial<FeatureCreditCosts>;
  }): SystemConfig {
    const current = ServerDatabase.getSystemConfig();
    const featureCreditCosts = { ...current.featureCreditCosts };
    if (patch.featureCreditCosts && typeof patch.featureCreditCosts === 'object') {
      for (const key of ['ytSeoCost', 'ytViralCost', 'ytCheckCost', 'autoUploadCost'] as const) {
        const value = Number(patch.featureCreditCosts[key]);
        if (patch.featureCreditCosts[key] !== undefined && Number.isFinite(value)) {
          featureCreditCosts[key] = Math.max(0, Math.round(value));
        }
      }
    }
    const aiProviders = Array.isArray(patch.aiProviders) && patch.aiProviders.length > 0
      ? patch.aiProviders
      : current.aiProviders;
    const merged: SystemConfig = {
      ...current,
      aiProviders,
      featureCreditCosts,
    };
    ServerDatabase.db.systemConfig = merged;
    ServerDatabase.save();
    return merged;
  }

  /** Credit cost for a named feature (from the admin-configured system settings). */
  public static getFeatureCreditCost(feature: 'ytSeo' | 'ytViral' | 'ytCheck' | 'autoUpload'): number {
    const costs = ServerDatabase.getSystemConfig().featureCreditCosts;
    const map: Record<string, number> = {
      ytSeo: Number(costs.ytSeoCost),
      ytViral: Number(costs.ytViralCost),
      ytCheck: Number(costs.ytCheckCost),
      autoUpload: Number(costs.autoUploadCost),
    };
    const value = Number(map[feature]);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
  }

  /**
   * Deducts feature credits from a user's balance (multi-tenant safe).
   * - Administrators always pass (unlimited credits, nothing deducted).
   * - Legacy accounts without a credits balance are grandfathered (allowed, no change)
   *   so pre-Phase-2 sessions can never be broken by the enforcement gate.
   * - Cost 0 (feature disabled pricing) is always free.
   */
  public static deductCredits(userId: string, amount: number, featureLabel = 'this feature'): { success: boolean; message: string; remaining?: number } {
    const cost = Math.max(0, Math.round(Number(amount) || 0));
    if (cost <= 0) {
      return { success: true, message: 'No credits required.' };
    }
    const user = ServerDatabase.getUserByIdOrEmail(userId);
    if (!user) {
      return { success: false, message: 'User account could not be resolved.' };
    }
    if (ServerDatabase.isUserAdmin(user)) {
      return { success: true, message: 'Administrators have unlimited credits.' };
    }
    if (user.credits === undefined || user.credits === null) {
      return { success: true, message: 'Legacy account — credit enforcement not applied.' };
    }
    if (user.credits < cost) {
      return {
        success: false,
        message: `💎 Not enough credits for ${featureLabel} — needs ${cost}, you have ${user.credits}. Please contact an administrator or upgrade your plan.`,
      };
    }
    user.credits = user.credits - cost;
    ServerDatabase.save();
    return { success: true, message: `${cost} credit(s) used for ${featureLabel}.`, remaining: user.credits };
  }

  // ==========================================
  // PHASE 5: APP CONTROL, TRIALS & BROADCASTS
  // ==========================================

  /** Update app-control platform toggles (maintenance, registration, trial, features). */
  public static updateAppControl(patch: {
    maintenanceMode?: boolean;
    maintenanceMessage?: string;
    registrationOpen?: boolean;
    freeTrial?: Partial<SystemConfig['freeTrial']>;
    featureToggles?: Partial<SystemConfig['featureToggles']>;
    paymentMethods?: Partial<SystemConfig['paymentMethods']>;
  }): SystemConfig {
    const current = ServerDatabase.getSystemConfig();
    const merged: SystemConfig = {
      ...current,
      maintenanceMode: patch.maintenanceMode === undefined ? current.maintenanceMode : patch.maintenanceMode === true,
      maintenanceMessage: patch.maintenanceMessage === undefined ? current.maintenanceMessage : String(patch.maintenanceMessage || '').trim() || current.maintenanceMessage,
      registrationOpen: patch.registrationOpen === undefined ? current.registrationOpen : patch.registrationOpen === true,
      freeTrial: { ...current.freeTrial },
      featureToggles: { ...current.featureToggles },
      paymentMethods: { ...current.paymentMethods },
    };
    if (patch.freeTrial && typeof patch.freeTrial === 'object') {
      if (patch.freeTrial.enabled !== undefined) merged.freeTrial.enabled = patch.freeTrial.enabled === true;
      if (patch.freeTrial.trialDays !== undefined) {
        const days = Number(patch.freeTrial.trialDays);
        if (Number.isFinite(days)) merged.freeTrial.trialDays = Math.max(0, Math.round(days));
      }
      if (patch.freeTrial.bonusCredits !== undefined) {
        const credits = Number(patch.freeTrial.bonusCredits);
        if (Number.isFinite(credits)) merged.freeTrial.bonusCredits = Math.max(0, Math.round(credits));
      }
    }
    if (patch.featureToggles && typeof patch.featureToggles === 'object') {
      for (const key of ['liveStreaming', 'ytCheck', 'ytSeo', 'ytViral', 'autoUpload'] as const) {
        if (patch.featureToggles[key] !== undefined) merged.featureToggles[key] = patch.featureToggles[key] === true;
      }
    }
    if (patch.paymentMethods && typeof patch.paymentMethods === 'object') {
      for (const key of ['bkash', 'nagad', 'rocket', 'instructions'] as const) {
        if (patch.paymentMethods[key] !== undefined) merged.paymentMethods[key] = String(patch.paymentMethods[key]).trim();
      }
    }
    ServerDatabase.db.systemConfig = merged;
    ServerDatabase.save();
    return merged;
  }

  /** True while maintenance mode is active (admins bypass — enforced at the middleware). */
  public static isMaintenanceActive(): boolean {
    return ServerDatabase.getSystemConfig().maintenanceMode === true;
  }

  public static getMaintenanceMessage(): string {
    return ServerDatabase.getSystemConfig().maintenanceMessage || DEFAULT_SYSTEM_CONFIG.maintenanceMessage;
  }

  /** True when the platform feature switch for the given feature is ON. */
  public static isFeatureEnabled(feature: keyof SystemConfig['featureToggles']): boolean {
    return ServerDatabase.getSystemConfig().featureToggles[feature] !== false;
  }

  /** True when new signups are permitted (registration toggle). */
  public static isRegistrationOpen(): boolean {
    return ServerDatabase.getSystemConfig().registrationOpen !== false;
  }

  /**
   * Phase 5 free trial: auto-grants the configured trial window (Pro plan) + bonus
   * credits to a freshly created account. Never touches admins.
   */
  private static applyFreeTrialToNewUser(user: UserAccount): void {
    try {
      const trial = ServerDatabase.getSystemConfig().freeTrial;
      if (!trial.enabled || ServerDatabase.isUserAdmin(user)) return;
      if (trial.trialDays > 0) {
        const expires = new Date();
        expires.setDate(expires.getDate() + trial.trialDays);
        user.plan = 'pro';
        user.subscriptionStatus = 'active';
        user.planExpiresAt = expires.toISOString();
      }
      if (trial.bonusCredits > 0) {
        user.credits = (user.credits || 0) + trial.bonusCredits;
      }
    } catch (e) {
      console.warn('[ServerDB] Free trial grant skipped:', e);
    }
  }

  // ==========================================
  // PHASE 5: REVENUE ANALYTICS & SYSTEM ALERTS
  // ==========================================

  /** Aggregated revenue & subscription financial statistics (admin dashboard). */
  public static getRevenueStats(): RevenueStats {
    const payments = ServerDatabase.db.payments || [];
    const now = Date.now();

    const revenueByCurrency: Record<string, number> = {};
    const monthlyRecurringByCurrency: Record<string, number> = {};
    let approvedPaymentsCount = 0;
    let pendingPaymentsCount = 0;
    let rejectedPaymentsCount = 0;

    const monthly: Record<string, Record<string, number>> = {};
    const months: string[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      months.push(key);
      monthly[key] = {};
    }

    for (const payment of payments) {
      const currency = String(payment.currency || 'BDT').toUpperCase();
      if (payment.status === 'approved') {
        approvedPaymentsCount += 1;
        const amount = Number(payment.amount) || 0;
        revenueByCurrency[currency] = (revenueByCurrency[currency] || 0) + amount;
        const createdAtMs = new Date(payment.createdAt).getTime();
        if (Number.isFinite(createdAtMs) && now - createdAtMs <= 30 * 24 * 60 * 60 * 1000) {
          monthlyRecurringByCurrency[currency] = (monthlyRecurringByCurrency[currency] || 0) + amount;
        }
        const key = String(payment.createdAt || '').slice(0, 7);
        if (monthly[key]) {
          monthly[key][currency] = (monthly[key][currency] || 0) + amount;
        }
      } else if (payment.status === 'pending') {
        pendingPaymentsCount += 1;
      } else if (payment.status === 'rejected') {
        rejectedPaymentsCount += 1;
      }
    }

    const activeSubscribers = { pro: 0, enterprise: 0, total: 0 };
    for (const user of ServerDatabase.db.users || []) {
      const plan = String(user.plan || 'free').toLowerCase();
      if (plan !== 'pro' && plan !== 'enterprise') continue;
      const statusOk = user.subscriptionStatus === 'active';
      const notExpired = !user.planExpiresAt || new Date(user.planExpiresAt).getTime() > now;
      if (statusOk && notExpired) {
        if (plan === 'pro') activeSubscribers.pro += 1;
        else activeSubscribers.enterprise += 1;
        activeSubscribers.total += 1;
      }
    }

    return {
      revenueByCurrency,
      monthlyRecurringByCurrency,
      approvedPaymentsCount,
      pendingPaymentsCount,
      rejectedPaymentsCount,
      activeSubscribers,
      monthlyBreakdown: months.map((month) => ({ month, byCurrency: monthly[month] || {} })),
    };
  }

  /** Stores a broadcast alert (in-app delivery) and returns the stored record. */
  public static createSystemAlert(message: string, sentBy: string, channel: 'in-app' | 'telegram' | 'both', telegramDelivered?: number): SystemAlert {
    const alert: SystemAlert = {
      id: 'alert_' + crypto.randomBytes(8).toString('hex'),
      message: String(message || '').trim(),
      channel,
      sentBy: sentBy || 'system',
      sentAt: new Date().toISOString(),
      telegramDelivered,
    };
    if (!Array.isArray(ServerDatabase.db.systemAlerts)) ServerDatabase.db.systemAlerts = [];
    ServerDatabase.db.systemAlerts.unshift(alert);
    ServerDatabase.db.systemAlerts = ServerDatabase.db.systemAlerts.slice(0, 200);
    ServerDatabase.save();
    return alert;
  }

  /** Latest broadcast alerts (newest first). */
  public static getSystemAlerts(limit = 10): SystemAlert[] {
    return (ServerDatabase.db.systemAlerts || []).slice(0, Math.max(1, limit));
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
    // Phase 5: honour the admin registration toggle.
    if (!ServerDatabase.isRegistrationOpen()) {
      return { success: false, message: '🚫 Registration is currently closed. Please check back later.' };
    }
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
    ServerDatabase.applyFreeTrialToNewUser(newUser);

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
      // Auto-provision user account for painless preview — but respect the
      // Phase 5 registration toggle: closed registration blocks NEW accounts only.
      if (!ServerDatabase.isRegistrationOpen()) {
        return { success: false, message: '🚫 Registration is currently closed. Existing accounts can still sign in.', registrationClosed: true };
      }
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
      ServerDatabase.applyFreeTrialToNewUser(user);
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
      // Phase 5: respect the registration toggle for brand-new Google signups.
      if (!ServerDatabase.isRegistrationOpen()) {
        throw new Error('🚫 Registration is currently closed. Existing accounts can still sign in.');
      }
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
      ServerDatabase.applyFreeTrialToNewUser(user);
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

  public static verifyLegacyOtp(email: string, code: string, authHeader?: string) {
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

  // ==========================================
  // PHASE 6: AUDIT LOGGING
  // ==========================================

  /** Records an immutable audit entry for a privileged admin mutation. */
  public static recordAuditLog(entry: {
    adminUserId: string;
    adminEmail?: string;
    action: AuditLog['action'];
    targetUserId?: string;
    details?: string;
    ipAddress?: string;
  }): AuditLog {
    const log: AuditLog = {
      id: 'aud_' + crypto.randomBytes(8).toString('hex'),
      adminUserId: entry.adminUserId,
      adminEmail: entry.adminEmail,
      action: entry.action,
      targetUserId: entry.targetUserId,
      details: entry.details,
      ipAddress: entry.ipAddress,
      createdAt: new Date().toISOString(),
    };
    if (!Array.isArray(ServerDatabase.db.auditLogs)) ServerDatabase.db.auditLogs = [];
    ServerDatabase.db.auditLogs.unshift(log);
    ServerDatabase.db.auditLogs = ServerDatabase.db.auditLogs.slice(0, 2000);
    ServerDatabase.save();
    return log;
  }

  /** Lists audit-log entries (newest first) with optional action + search filter. */
  public static listAuditLogs(params: { page?: number; limit?: number; action?: string; search?: string } = {}): {
    logs: AuditLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(params.limit) || 20));
    const search = String(params.search || '').trim().toLowerCase();
    let filtered = (ServerDatabase.db.auditLogs || []).slice();
    if (params.action && params.action !== 'all') {
      filtered = filtered.filter((l) => l.action === params.action);
    }
    if (search) {
      filtered = filtered.filter((l) =>
        (l.details || '').toLowerCase().includes(search) ||
        (l.adminEmail || '').toLowerCase().includes(search) ||
        (l.targetUserId || '').toLowerCase().includes(search) ||
        l.action.toLowerCase().includes(search),
      );
    }
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const logs = filtered.slice((page - 1) * limit, page * limit);
    return { logs, total, page, limit, totalPages };
  }


  // ==========================================
  // PHASE 6: SUPPORT TICKETING
  // ==========================================

  /** Creates a support ticket submitted by a signed-in user. */
  public static createSupportTicket(data: {
    userId: string;
    subject: string;
    category: SupportTicket['category'];
    description: string;
    priority?: SupportTicket['priority'];
  }): { success: boolean; message: string; ticket?: SupportTicket } {
    const user = ServerDatabase.getUserByIdOrEmail(data.userId);
    if (!user) return { success: false, message: 'Authenticated user could not be resolved.' };
    const subject = String(data.subject || '').trim();
    if (!subject) return { success: false, message: 'A subject is required.' };
    const description = String(data.description || '').trim();
    if (!description) return { success: false, message: 'A description is required.' };
    const now = new Date().toISOString();
    const ticket: SupportTicket = {
      id: 'tkt_' + crypto.randomBytes(8).toString('hex'),
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      subject,
      category: data.category || 'other',
      description,
      priority: data.priority || 'medium',
      status: 'open',
      createdAt: now,
      updatedAt: now,
      replies: [],
    };
    if (!Array.isArray(ServerDatabase.db.supportTickets)) ServerDatabase.db.supportTickets = [];
    ServerDatabase.db.supportTickets.unshift(ticket);
    ServerDatabase.db.supportTickets = ServerDatabase.db.supportTickets.slice(0, 2000);
    ServerDatabase.save();
    return { success: true, message: 'Support ticket submitted.', ticket };
  }

  /** Finds a single ticket by id (public access for route handlers). */
  public static findSupportTicket(id: string): SupportTicket | undefined {
    return (ServerDatabase.db.supportTickets || []).find((t) => t.id === id);
  }

  /** All tickets submitted by a given user (newest first). */
  public static getSupportTicketsByUser(userId: string): SupportTicket[] {
    return (ServerDatabase.db.supportTickets || []).filter((t) => t.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  /** All tickets across every user (admin view) with optional status filter. */
  public static listSupportTickets(status: 'all' | 'open' | 'resolved' = 'all'): SupportTicket[] {
    const tickets = (ServerDatabase.db.supportTickets || []).slice();
    const filtered = status === 'all' ? tickets : tickets.filter((t) => t.status === status);
    return filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  /** Adds a reply to a ticket and bumps updatedAt. */
  public static replyToTicket(ticketId: string, authorId: string, authorRole: 'user' | 'admin', message: string): { success: boolean; message: string; ticket?: SupportTicket } {
    const ticket = (ServerDatabase.db.supportTickets || []).find((t) => t.id === ticketId);
    if (!ticket) return { success: false, message: 'Ticket not found.' };
    const text = String(message || '').trim();
    if (!text) return { success: false, message: 'A reply message is required.' };
    ticket.replies.push({
      id: 'rpl_' + crypto.randomBytes(6).toString('hex'),
      authorId,
      authorRole,
      message: text,
      createdAt: new Date().toISOString(),
    });
    ticket.updatedAt = new Date().toISOString();
    ServerDatabase.save();
    return { success: true, message: 'Reply added.', ticket };
  }

  /** Toggles a ticket between open and resolved. */
  public static updateTicketStatus(ticketId: string, status: 'open' | 'resolved'): { success: boolean; message: string; ticket?: SupportTicket } {
    const ticket = (ServerDatabase.db.supportTickets || []).find((t) => t.id === ticketId);
    if (!ticket) return { success: false, message: 'Ticket not found.' };
    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    ServerDatabase.save();
    return { success: true, message: `Ticket marked ${status}.`, ticket };
  }


  // ==========================================
  // PHASE 6: SMART DUAL-CHANNEL OTP (data layer)
  // ==========================================

  /** Generates a fresh 6-digit OTP (5-minute TTL, max 3 attempts). */
  public static generateOtp(userId: string): { success: boolean; message: string; code?: string } {
    const user = ServerDatabase.getUserByIdOrEmail(userId);
    if (!user) return { success: false, message: 'User not found.' };
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.otpCode = code;
    user.otpExpiresAt = Date.now() + 5 * 60 * 1000;
    user.otpAttempts = 0;
    ServerDatabase.save();
    return { success: true, message: 'OTP generated.', code };
  }

  /** Verifies a submitted OTP (enforces expiry + 3-attempt cap). */
  public static verifyOtp(userId: string, code: string): { success: boolean; message: string } {
    const user = ServerDatabase.getUserByIdOrEmail(userId);
    if (!user) return { success: false, message: 'User not found.' };
    if (!user.otpCode || !user.otpExpiresAt) return { success: false, message: 'No active OTP. Request a new one.' };
    if (Date.now() > user.otpExpiresAt) {
      user.otpCode = undefined; user.otpAttempts = undefined; user.otpExpiresAt = undefined;
      ServerDatabase.save();
      return { success: false, message: 'OTP has expired. Request a new one.' };
    }
    const attempts = (user.otpAttempts || 0) + 1;
    user.otpAttempts = attempts;
    if (attempts > 3) {
      user.otpCode = undefined; user.otpAttempts = undefined; user.otpExpiresAt = undefined;
      ServerDatabase.save();
      return { success: false, message: 'Too many attempts. Request a new OTP.' };
    }
    if (String(code || '').trim() !== String(user.otpCode)) {
      ServerDatabase.save();
      return { success: false, message: `Invalid OTP. ${3 - attempts} attempt(s) remaining.` };
    }
    user.otpCode = undefined; user.otpAttempts = undefined; user.otpExpiresAt = undefined;
    ServerDatabase.save();
    return { success: true, message: 'OTP verified.' };
  }

  // ==========================================
  // PHASE 6: AUTOMATED EVENT NOTIFICATIONS (in-app)
  // ==========================================

  /** Creates an in-app system alert for a user (Telegram push handled in server.ts). */
  public static async notifyUser(userId: string, message: string): Promise<{ inApp: boolean }> {
    const user = ServerDatabase.getUserByIdOrEmail(userId);
    if (!user || !message) return { inApp: false };
    const alert: SystemAlert = {
      id: 'alr_' + crypto.randomBytes(6).toString('hex'),
      message,
      channel: 'in-app',
      sentBy: 'system',
      sentAt: new Date().toISOString(),
    };
    if (!Array.isArray(ServerDatabase.db.systemAlerts)) ServerDatabase.db.systemAlerts = [];
    ServerDatabase.db.systemAlerts.unshift(alert);
    ServerDatabase.db.systemAlerts = ServerDatabase.db.systemAlerts.slice(0, 500);
    ServerDatabase.save();
    return { inApp: true };
  }

  /** Active paid users whose plan expires within `days` days (subscription-reminder sweep). */
  public static getExpiringSubscriptions(days = 3): UserAccount[] {
    const horizon = Date.now() + days * 24 * 60 * 60 * 1000;
    return (ServerDatabase.db.users || []).filter((u) => {
      if (!u.planExpiresAt || u.subscriptionStatus !== 'active') return false;
      if (String(u.plan || '') === 'free') return false;
      const exp = new Date(u.planExpiresAt).getTime();
      return Number.isFinite(exp) && exp > Date.now() && exp <= horizon;
    });
  }

}
