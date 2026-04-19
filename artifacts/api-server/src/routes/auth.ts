import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { signToken, requireAuth, formatUser } from "../lib/auth.js";
import { recordDeviceFingerprint, checkAccountFraud, checkReferralSelfLoop } from "../lib/fraud.js";

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
    res.status(400).json({ error: "Mobile number already registered" });
    return;
  }

  const normalizedReferralCode = String(referralCode || "").trim().toUpperCase() || ADMIN_REFERRAL_CODE;
  const [referrer] = await db.select().from(usersTable).where(eq(usersTable.referralCode, normalizedReferralCode)).limit(1);
  if (!referrer) {
    res.status(400).json({ error: "Valid referral code required" });
    return;
  }
  const referredById = referrer.id;

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

router.get("/me", requireAuth, (req, res) => {
  res.json(formatUser((req as any).user));
});

// Lightweight heartbeat — keeps lastSeenAt fresh (called every ~30s from frontend).
router.post("/heartbeat", requireAuth, async (req, res) => {
  const u = (req as any).user;
  await db.update(usersTable).set({ lastSeenAt: new Date() }).where(eq(usersTable.id, u.id));
  res.json({ ok: true });
});

export default router;
