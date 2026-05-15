import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, referralsTable, ordersTable, transactionsTable } from "@workspace/db";
import { eq, or, desc, and, sql, inArray } from "drizzle-orm";
import { signToken, requireAuth, formatUser } from "../lib/auth.js";
import { recordDeviceFingerprint, checkAccountFraud, checkReferralSelfLoop } from "../lib/fraud.js";
import { issueOtp, verifyOtpAndIssueToken, consumeVerifiedToken } from "../lib/otp.js";
import { verifyGoogleIdToken } from "../lib/google.js";
import { getSetting } from "../lib/settings.js";

const router = Router();

const PHONE_RE = /^[6-9]\d{9}$/;
const ADMIN_REFERRAL_CODE = "TP000001";

async function ensureAdminReferralCode() {
  const [admin] = await db.select().from(usersTable).where(eq(usersTable.username, "admin")).limit(1);
  if (!admin) return null;
  if (admin.referralCode !== ADMIN_REFERRAL_CODE) {
    await db.update(usersTable).set({ referralCode: ADMIN_REFERRAL_CODE }).where(eq(usersTable.id, admin.id));
    admin.referralCode = ADMIN_REFERRAL_CODE;
  }
  return admin;
}

function clientIp(req: any): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "";
}

// ---------------------------------------------------------------------------
// OTP — phone verification for register & forgot-password
// ---------------------------------------------------------------------------
//
// Flow:
//   1. POST /otp/send        body: { phone, purpose: "register"|"forgot", honeypot? }
//   2. POST /otp/verify      body: { phone, purpose, code }   -> { verifiedToken }
//   3. POST /register        body: { ..., verifiedToken }     (purpose=register)
//   3a. POST /forgot-password body: { phone, newPassword, verifiedToken } (purpose=forgot)
//
// Anti-spam (in lib/otp.ts):
//   - 60s resend cooldown per phone+purpose
//   - 3 OTP/hour per phone, 5/hour per IP
//   - Active OTP invalidated when a new one is issued
//   - 5 attempts max per OTP, then it's burned
//   - 5 minute OTP validity, 10 minute verifiedToken validity
//   - Honeypot field "website" — if present, silently 200 without sending

router.post("/otp/send", async (req, res) => {
  const { phone, purpose, website } = req.body || {};
  // Honeypot — bots fill hidden fields. Pretend success but do nothing.
  if (website) { res.json({ success: true }); return; }
  if (!phone || !PHONE_RE.test(String(phone))) {
    res.status(400).json({ error: "Valid 10-digit mobile number required" });
    return;
  }
  if (purpose !== "register" && purpose !== "forgot") {
    res.status(400).json({ error: "Invalid OTP purpose" });
    return;
  }
  // For register, fail fast if the phone is already taken (saves an SMS).
  if (purpose === "register") {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.phone, String(phone))).limit(1);
    if (existing) {
      res.status(400).json({ error: "This mobile number is already registered. Please login instead." });
      return;
    }
  }
  // For forgot, fail fast if no account exists for this phone.
  if (purpose === "forgot") {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.phone, String(phone))).limit(1);
    if (!existing) {
      res.status(404).json({ error: "No account found for this mobile number." });
      return;
    }
  }
  const result = await issueOtp({ phone: String(phone), purpose, ip: clientIp(req) });
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({ success: true, message: "OTP sent to your mobile number" });
});

router.post("/otp/verify", async (req, res) => {
  const { phone, purpose, code } = req.body || {};
  if (!phone || !PHONE_RE.test(String(phone))) {
    res.status(400).json({ error: "Valid 10-digit mobile number required" });
    return;
  }
  if (purpose !== "register" && purpose !== "forgot") {
    res.status(400).json({ error: "Invalid OTP purpose" });
    return;
  }
  const result = await verifyOtpAndIssueToken({ phone: String(phone), purpose, code: String(code || "") });
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({ success: true, verifiedToken: result.verifiedToken });
});

router.post("/register", async (req, res) => {
  const { phone, password, referralCode, deviceFingerprint, verifiedToken } = req.body || {};
  if (!phone || !password) {
    res.status(400).json({ error: "Mobile number and password are required" });
    return;
  }
  if (!PHONE_RE.test(phone)) {
    res.status(400).json({ error: "Valid 10-digit mobile number required" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }
  // OTP verification required before registration
  if (!verifiedToken || !consumeVerifiedToken(String(verifiedToken), "register", String(phone))) {
    res.status(400).json({ error: "Mobile number not verified. Please verify with OTP first." });
    return;
  }

  const existingPhone = await db.select().from(usersTable).where(eq(usersTable.phone, phone)).limit(1);
  if (existingPhone[0]) {
    res.status(400).json({ error: "Only 1 account is allowed per mobile number. Please login to your existing account." });
    return;
  }

  // Device-based registration cap. Counts the number of distinct user_ids
  // ever recorded against this fingerprint and rejects the registration
  // when the admin-configured limit is already reached. Skipped when the
  // client doesn't send a fingerprint (older clients) — their accounts
  // are still tracked through IP-based fraud alerts downstream.
  // Can be disabled by admin via deviceLimitEnabled=false setting.
  const deviceLimitEnabled = (await getSetting("deviceLimitEnabled")) !== "false";
  if (deviceLimitEnabled && deviceFingerprint && typeof deviceFingerprint === "string") {
    try {
      const maxStr = await getSetting("maxRegistrationsPerDevice");
      const maxAllowed = Math.max(1, Math.floor(Number(maxStr) || 3));
      const countRows = await db.execute(sql`
        SELECT COUNT(DISTINCT user_id)::int AS c
          FROM device_fingerprints
         WHERE fingerprint = ${deviceFingerprint}
      `);
      const distinctUsers = Number(((countRows as any).rows?.[0] || (countRows as any)[0])?.c || 0);
      if (distinctUsers >= maxAllowed) {
        res.status(429).json({
          error: `Maximum ${maxAllowed} accounts allowed per device. Please login to your existing account.`,
          code: "device_limit_reached",
        });
        return;
      }
    } catch (err) {
      req.log.warn({ err }, "device-fingerprint registration cap check failed; allowing through");
    }
  }

  const normalizedReferralCode = String(referralCode || "").trim().toUpperCase() || ADMIN_REFERRAL_CODE;
  const [referrer] = await db.select().from(usersTable).where(eq(usersTable.referralCode, normalizedReferralCode)).limit(1);
  if (!referrer) {
    res.status(400).json({ error: "Valid referral code required" });
    return;
  }
  const referredById = referrer.id;

  // Auto-generate a username from the phone (last 4 digits) so the user
  // never has to pick one. Collisions are extremely unlikely but we still
  // retry with a random suffix to guarantee uniqueness.
  let username = `user${phone.slice(-4)}${Math.floor(1000 + Math.random() * 9000)}`;
  for (let i = 0; i < 5; i++) {
    const clash = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    if (!clash[0]) break;
    username = `user${phone.slice(-4)}${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    username,
    passwordHash,
    phone,
    referredBy: referredById || undefined,
  }).returning();

  const code = "TP" + String(user.id).padStart(6, "0");
  await db.update(usersTable).set({ referralCode: code }).where(eq(usersTable.id, user.id));
  user.referralCode = code;

  const ip = clientIp(req);
  const ua = (req.headers["user-agent"] as string) || "";
  if (deviceFingerprint) {
    await recordDeviceFingerprint(user.id, deviceFingerprint, ip, ua);
  }
  if (referredById) {
    await checkReferralSelfLoop(referredById, user.id);
  }
  await checkAccountFraud(user.id, ip, ua);

  // Credit signup bonus if configured
  try {
    const bonusStr = await getSetting("signupBonus");
    const bonusAmount = parseFloat(bonusStr || "0");
    if (bonusAmount > 0) {
      await db.update(usersTable).set({
        balance: sql`${usersTable.balance} + ${bonusAmount}`,
      }).where(eq(usersTable.id, user.id));
      await db.insert(transactionsTable).values({
        userId: user.id,
        type: "credit",
        amount: String(bonusAmount),
        description: `Welcome bonus — ₹${bonusAmount} joining reward`,
      });
      user.balance = String((Number(user.balance) + bonusAmount).toFixed(2));
    }
  } catch (err) {
    req.log.warn({ err }, "signup bonus credit failed; user created successfully");
  }

  const token = signToken(user.id, user.role);
  res.json({ user: formatUser(user), token });
});

router.post("/login", async (req, res) => {
  const { phone, username, identifier, password, deviceFingerprint } = req.body || {};
  const id = identifier || username || phone;
  if (!id || !password) {
    res.status(400).json({ error: "Username/mobile and password are required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(
    or(eq(usersTable.phone, id), eq(usersTable.username, id))
  ).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  if (user.isBlocked) {
    res.status(403).json({ error: "Account blocked", reason: user.blockedReason || "Contact support" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const ip = clientIp(req);
  const ua = (req.headers["user-agent"] as string) || "";
  if (deviceFingerprint) {
    await recordDeviceFingerprint(user.id, deviceFingerprint, ip, ua);
  }
  await checkAccountFraud(user.id, ip, ua);

  const token = signToken(user.id, user.role);
  res.json({ user: formatUser(user), token });
});

// Reset password using OTP-verified phone. The verifiedToken must have been
// issued for THIS phone with purpose=forgot within the last 10 minutes.
router.post("/forgot-password", async (req, res) => {
  const { phone, newPassword, verifiedToken } = req.body || {};
  if (!phone || !PHONE_RE.test(String(phone))) {
    res.status(400).json({ error: "Valid 10-digit mobile number required" });
    return;
  }
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }
  if (!verifiedToken || !consumeVerifiedToken(String(verifiedToken), "forgot", String(phone))) {
    res.status(400).json({ error: "Mobile number not verified. Please verify with OTP first." });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, String(phone))).limit(1);
  if (!user) {
    res.status(404).json({ error: "No account found for this mobile number." });
    return;
  }
  if (user.isBlocked) {
    res.status(403).json({ error: "Account blocked", reason: user.blockedReason || "Contact support" });
    return;
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
  res.json({ message: "Password updated. Please login with your new password." });
});

// ---------------------------------------------------------------------------
// Google verification flow
// ---------------------------------------------------------------------------
//
// Two entry points, both consume a Google Identity Services credential
// (`idToken`) issued for our web client.
//
//  1. POST /google/link  (auth required) — bind the verified Gmail to the
//     currently logged-in user. Refuses to overwrite an existing binding,
//     refuses if the same Google account is already bound to a different user.
//
//  2. POST /google/reset-password  (no auth) — verify the Google credential,
//     find the matching user by google_sub, set a new password atomically.
//     Replaces the SMS-OTP forgot-password flow for users who have completed
//     Google verification in their profile.

router.post("/google/link", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const { idToken } = req.body || {};
  let identity;
  try {
    identity = await verifyGoogleIdToken(idToken);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Google verification failed" });
    return;
  }

  // Don't let one Gmail bind to multiple TrustPay accounts. The unique
  // partial index on google_sub also guards this at the DB level.
  const [other] = await db.select().from(usersTable).where(eq(usersTable.googleSub, identity.sub)).limit(1);
  if (other && other.id !== u.id) {
    res.status(409).json({ error: "This Google account is already linked to another user" });
    return;
  }

  await db.update(usersTable).set({
    email: identity.email,
    googleSub: identity.sub,
  }).where(eq(usersTable.id, u.id));

  res.json({ success: true, email: identity.email });
});

router.post("/google/unlink", requireAuth, async (req, res) => {
  const u = (req as any).user;
  await db.update(usersTable).set({ email: null, googleSub: null }).where(eq(usersTable.id, u.id));
  res.json({ success: true });
});

router.post("/google/reset-password", async (req, res) => {
  const { idToken, newPassword } = req.body || {};
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }
  let identity;
  try {
    identity = await verifyGoogleIdToken(idToken);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Google verification failed" });
    return;
  }

  // Lookup strictly by google_sub (stable Google user id). We deliberately
  // don't fall back to email-only matching because email aliasing /
  // re-assignment by Google for non-Workspace accounts is not guaranteed,
  // and sub is what proves possession of the verified Google account.
  const [user] = await db.select().from(usersTable).where(eq(usersTable.googleSub, identity.sub)).limit(1);
  if (!user) {
    res.status(404).json({ error: "No account is linked to this Gmail. Please log in with your password and complete Google verification in your profile first." });
    return;
  }
  if (user.isBlocked) {
    res.status(403).json({ error: "Account blocked", reason: user.blockedReason || "Contact support" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));

  res.json({ success: true });
});

router.post("/admin/seed-referral-code", async (_req, res) => {
  const admin = await ensureAdminReferralCode();
  if (!admin) {
    res.status(404).json({ error: "Admin user not found" });
    return;
  }
  res.json({ success: true, referralCode: admin.referralCode });
});

router.post("/logout", (_req, res) => {
  res.json({ message: "Logged out" });
});

router.get("/me", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const ua = (req.headers["user-agent"] as string) || "";
  if (u.mustInstallApp && ua.includes("TrustPayAndroid")) {
    await db.update(usersTable).set({ mustInstallApp: false }).where(eq(usersTable.id, u.id));
    u.mustInstallApp = false;
  }
  res.json(formatUser(u));
});

router.get("/invitees", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const directInvitees = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    displayName: usersTable.displayName,
    createdAt: usersTable.createdAt,
    totalDeposits: usersTable.totalDeposits,
  }).from(usersTable).where(eq(usersTable.referredBy, u.id)).orderBy(desc(usersTable.createdAt));

  if (directInvitees.length === 0) {
    res.json([]);
    return;
  }

  const inviteeIds = directInvitees.map((i) => i.id);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const commissionRows = await db.select({
    referredUserId: referralsTable.referredUserId,
    lifetime: sql<string>`COALESCE(SUM(${referralsTable.commissionAmount}), 0)`,
  }).from(referralsTable).where(and(
    eq(referralsTable.referrerId, u.id),
    eq(referralsTable.level, 1),
  )).groupBy(referralsTable.referredUserId);

  const todayCommissionRows = await db.select({
    referredUserId: referralsTable.referredUserId,
    today: sql<string>`COALESCE(SUM(${referralsTable.commissionAmount}), 0)`,
  }).from(referralsTable).where(and(
    eq(referralsTable.referrerId, u.id),
    eq(referralsTable.level, 1),
    sql`${referralsTable.createdAt} >= ${startOfDay}`,
  )).groupBy(referralsTable.referredUserId);

  const todayDepositRows = await db.select({
    buyerId: ordersTable.lockedByUserId,
    today: sql<string>`COALESCE(SUM(${ordersTable.amount}), 0)`,
  }).from(ordersTable).where(and(
    eq(ordersTable.status, "confirmed"),
    inArray(ordersTable.lockedByUserId, inviteeIds),
    sql`${ordersTable.createdAt} >= ${startOfDay}`,
  )).groupBy(ordersTable.lockedByUserId);

  const lifetimeMap = new Map(commissionRows.map((r) => [r.referredUserId, parseFloat(String(r.lifetime || "0"))]));
  const todayCommissionMap = new Map(todayCommissionRows.map((r) => [r.referredUserId, parseFloat(String(r.today || "0"))]));
  const todayDepositMap = new Map(todayDepositRows.map((r) => [r.buyerId, parseFloat(String(r.today || "0"))]));

  res.json(directInvitees.map((i) => ({
    id: i.id,
    username: i.username,
    displayName: i.displayName,
    createdAt: i.createdAt,
    totalDeposits: parseFloat(i.totalDeposits || "0"),
    todayDeposits: todayDepositMap.get(i.id) || 0,
    lifetimeCommission: lifetimeMap.get(i.id) || 0,
    todayCommission: todayCommissionMap.get(i.id) || 0,
  })));
});

router.post("/heartbeat", requireAuth, async (req, res) => {
  const u = (req as any).user;
  await db.update(usersTable).set({ lastSeenAt: new Date() }).where(eq(usersTable.id, u.id));
  res.json({ ok: true });
});

router.post("/update-name", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const raw = String(req.body?.displayName ?? "").trim();
  if (raw.length < 2 || raw.length > 40) {
    res.status(400).json({ error: "Display name must be 2-40 characters" });
    return;
  }
  await db.update(usersTable).set({ displayName: raw }).where(eq(usersTable.id, u.id));
  res.json({ success: true, displayName: raw });
});

export default router;
