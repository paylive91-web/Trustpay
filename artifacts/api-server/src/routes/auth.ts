import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, referralsTable, userNotificationsTable, ordersTable } from "@workspace/db";
import { eq, or, desc, and, sql, inArray } from "drizzle-orm";
import { signToken, requireAuth, formatUser } from "../lib/auth.js";
import { recordDeviceFingerprint, checkAccountFraud, checkReferralSelfLoop } from "../lib/fraud.js";
import { verifyGoogleIdToken, googleConfigured } from "../lib/google.js";

const router = Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
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

router.post("/register", async (req, res) => {
  const { username, phone, password, referralCode, deviceFingerprint } = req.body || {};
  if (!username || !phone || !password) {
    res.status(400).json({ error: "Username, mobile number, and password are required" });
    return;
  }
  if (!USERNAME_RE.test(username)) {
    res.status(400).json({ error: "Username must be 3-20 chars, letters/numbers/underscore" });
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

  // Check unique username AND unique phone
  const existingUser = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (existingUser[0]) {
    res.status(400).json({ error: "Username already taken" });
    return;
  }
  const existingPhone = await db.select().from(usersTable).where(eq(usersTable.phone, phone)).limit(1);
  if (existingPhone[0]) {
    res.status(400).json({ error: "Only 1 account is allowed per mobile number. Please login to your existing account." });
    return;
  }

  // Max N registrations per device fingerprint (admin-configurable, default 3).
  // Logging into an existing account from the same phone is always allowed —
  // only new registrations are counted against the per-device limit.
  if (deviceFingerprint) {
    const { deviceFingerprintsTable } = await import("@workspace/db");
    const { getSetting } = await import("../lib/settings.js");
    const deviceRows = await db
      .selectDistinct({ userId: deviceFingerprintsTable.userId })
      .from(deviceFingerprintsTable)
      .where(eq(deviceFingerprintsTable.fingerprint, deviceFingerprint));
    const deviceLimit = Math.max(1, parseInt(await getSetting("deviceRegistrationLimit")) || 3);
    if (deviceRows.length >= deviceLimit) {
      res.status(400).json({ error: `Only ${deviceLimit} accounts are allowed per mobile device. Please login to your existing account.` });
      return;
    }
  }

  const normalizedReferralCode = String(referralCode || "").trim().toUpperCase() || ADMIN_REFERRAL_CODE;
  const [referrer] = await db.select().from(usersTable).where(eq(usersTable.referralCode, normalizedReferralCode)).limit(1);
  if (!referrer) {
    res.status(400).json({ error: "Valid referral code required" });
    return;
  }
  const referredById = referrer.id;

  const passwordHash = await bcrypt.hash(password, 10);
  // mustInstallApp default left as false (force-install flow disabled).
  const [user] = await db.insert(usersTable).values({
    username,
    passwordHash,
    phone,
    referredBy: referredById || undefined,
  }).returning();

  const code = "TP" + String(user.id).padStart(6, "0");
  await db.update(usersTable).set({ referralCode: code }).where(eq(usersTable.id, user.id));
  user.referralCode = code;

  // Nudge the user to bind a Google account so password recovery is possible.
  // Without a verified Google email there is no self-serve "Forgot password".
  if (googleConfigured()) {
    try {
      await db.insert(userNotificationsTable).values({
        userId: user.id,
        kind: "google_verification",
        title: "Google verification kar lo",
        body: "Apna Gmail bind karo — bhulne par password apne aap reset kar sakoge. Profile → Google Verification.",
        severity: "info",
      });
    } catch {}
  }

  // Capture device fingerprint
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "";
  const ua = (req.headers["user-agent"] as string) || "";
  if (deviceFingerprint) {
    await recordDeviceFingerprint(user.id, deviceFingerprint, ip, ua);
  }
  if (referredById) {
    await checkReferralSelfLoop(referredById, user.id);
  }
  await checkAccountFraud(user.id, ip, ua);

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

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "";
  const ua = (req.headers["user-agent"] as string) || "";
  if (deviceFingerprint) {
    await recordDeviceFingerprint(user.id, deviceFingerprint, ip, ua);
  }
  await checkAccountFraud(user.id, ip, ua);

  const token = signToken(user.id, user.role);
  res.json({ user: formatUser(user), token });
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
  // Auto-clear the install lock the first time we see the user from inside
  // the Capacitor APK shell. The wrapper appends "TrustPayAndroid/<ver>" to
  // the User-Agent (see artifacts/trustpay/capacitor.config.ts).
  const ua = (req.headers["user-agent"] as string) || "";
  if (u.mustInstallApp && ua.includes("TrustPayAndroid")) {
    await db.update(usersTable).set({ mustInstallApp: false }).where(eq(usersTable.id, u.id));
    u.mustInstallApp = false;
  }
  res.json(formatUser(u));
});

router.get("/invitees", requireAuth, async (req, res) => {
  const u = (req as any).user;
  // Direct (L1) invitees: users whose referredBy = me. We pull aggregated
  // deposit + commission stats so the invite page can show a per-user
  // breakdown (today + lifetime).
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

  // Lifetime + today commission per invitee from referralsTable (level 1).
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

  // Today's deposit per invitee (sum of confirmed buy-side chunks where they
  // were the buyer, i.e. lockedByUserId = invitee.id).
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

// Lightweight heartbeat — keeps lastSeenAt fresh (called every ~30s from frontend).
// If seller was offline (lastSeenAt gap > 2 min) AND had active matching,
// auto-stop their matching + cancel available chunks.
router.post("/heartbeat", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const [current] = await db.select({
    lastSeenAt: usersTable.lastSeenAt,
    matchingExpiresAt: usersTable.matchingExpiresAt,
  }).from(usersTable).where(eq(usersTable.id, u.id)).limit(1);

  const wasOffline = !current?.lastSeenAt ||
    Date.now() - new Date(current.lastSeenAt).getTime() > 2 * 60 * 1000;
  const hadActiveMatching = !!current?.matchingExpiresAt &&
    new Date(current.matchingExpiresAt).getTime() > Date.now();

  if (wasOffline && hadActiveMatching) {
    await db.update(usersTable).set({
      matchingExpiresAt: null,
      autoSellEnabled: false,
      lastSeenAt: new Date(),
    }).where(eq(usersTable.id, u.id));
    await db.update(ordersTable).set({
      status: "cancelled",
      updatedAt: new Date(),
    }).where(and(
      eq(ordersTable.userId, u.id),
      eq(ordersTable.type, "withdrawal"),
      eq(ordersTable.status, "available"),
    ));
    res.json({ ok: true, matchingStopped: true });
    return;
  }

  await db.update(usersTable).set({ lastSeenAt: new Date() }).where(eq(usersTable.id, u.id));
  res.json({ ok: true });
});

// Edit display name — shown on the matching page in the "me" panel and to
// counterparties on trades. Username (login handle) is immutable.
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
//     Replaces the old phone/SMS-OTP forgot-password flow for users who have
//     completed Google verification.

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
    res.status(409).json({ error: "Yeh Google account pehle se kisi aur user se bind hai" });
    return;
  }

  await db.update(usersTable).set({
    email: identity.email,
    googleSub: identity.sub,
  }).where(eq(usersTable.id, u.id));

  // Mark the verification-nudge notification(s) as read so the bell stops
  // pestering the user once they've completed it.
  try {
    await db.update(userNotificationsTable)
      .set({ readAt: new Date() })
      .where(and(
        eq(userNotificationsTable.userId, u.id),
        eq(userNotificationsTable.kind, "google_verification"),
      ));
  } catch {}

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
    res.status(400).json({ error: "Naya password kam se kam 6 characters ka hona chahiye" });
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
    res.status(404).json({ error: "Is Gmail se koi account bind nahi hai. Pehle login karke Google verification karein." });
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

export default router;
