import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { signToken, requireAuth, formatUser } from "../lib/auth.js";
import { RegisterBody, LoginBody } from "@workspace/api-zod";

const router = Router();

// In-memory OTP store: phone -> { otp, expiresAt }
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/auth/send-otp
router.post("/send-otp", async (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
    res.status(400).json({ error: "Valid 10-digit Indian mobile number required" });
    return;
  }
  const otp = generateOTP();
  otpStore.set(phone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });
  // In production, integrate with SMS provider (Twilio, MSG91, etc.)
  // For demo, OTP is returned in response
  res.json({ success: true, otp, message: "OTP sent successfully (demo mode)" });
});

// POST /api/auth/verify-otp
router.post("/verify-otp", async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    res.status(400).json({ error: "Phone and OTP are required" });
    return;
  }
  const stored = otpStore.get(phone);
  if (!stored) {
    res.status(400).json({ error: "OTP not found. Please request a new OTP." });
    return;
  }
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(phone);
    res.status(400).json({ error: "OTP expired. Please request a new OTP." });
    return;
  }
  if (stored.otp !== otp) {
    res.status(400).json({ error: "Invalid OTP" });
    return;
  }
  otpStore.delete(phone);
  res.json({ success: true, verified: true });
});

// POST /api/auth/register (phone + password, OTP must be verified externally)
router.post("/register", async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    // Fall back to old schema for backward compat
    const parsed = RegisterBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Phone and password are required" });
      return;
    }
    const { username, password: pw } = parsed.data;
    const existing = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    if (existing[0]) {
      res.status(400).json({ error: "Username already taken" });
      return;
    }
    const passwordHash = await bcrypt.hash(pw, 10);
    const [user] = await db.insert(usersTable).values({ username, passwordHash }).returning();
    const token = signToken(user.id, user.role);
    res.json({ user: formatUser(user), token });
    return;
  }
  if (!/^[6-9]\d{9}$/.test(phone)) {
    res.status(400).json({ error: "Valid 10-digit mobile number required" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }
  const existing = await db.select().from(usersTable).where(
    or(eq(usersTable.phone, phone), eq(usersTable.username, phone))
  ).limit(1);
  if (existing[0]) {
    res.status(400).json({ error: "Mobile number already registered" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    username: phone,
    passwordHash,
    phone,
  }).returning();
  const token = signToken(user.id, user.role);
  res.json({ user: formatUser(user), token });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { phone, username, password } = req.body;
  const identifier = phone || username;
  if (!identifier || !password) {
    res.status(400).json({ error: "Mobile number and password are required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(
    or(eq(usersTable.phone, identifier), eq(usersTable.username, identifier))
  ).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid mobile number or password" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid mobile number or password" });
    return;
  }
  const token = signToken(user.id, user.role);
  res.json({ user: formatUser(user), token });
});

// POST /api/auth/reset-password (OTP must be verified first)
router.post("/reset-password", async (req, res) => {
  const { phone, otp, newPassword } = req.body;
  if (!phone || !otp || !newPassword) {
    res.status(400).json({ error: "Phone, OTP, and new password are required" });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }
  // Re-verify OTP inline
  const stored = otpStore.get(`reset_${phone}`);
  if (!stored) {
    res.status(400).json({ error: "OTP not found. Please request a new OTP." });
    return;
  }
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(`reset_${phone}`);
    res.status(400).json({ error: "OTP expired. Please request a new OTP." });
    return;
  }
  if (stored.otp !== otp) {
    res.status(400).json({ error: "Invalid OTP" });
    return;
  }
  otpStore.delete(`reset_${phone}`);
  const [user] = await db.select().from(usersTable).where(
    or(eq(usersTable.phone, phone), eq(usersTable.username, phone))
  ).limit(1);
  if (!user) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
  res.json({ success: true, message: "Password updated successfully" });
});

// POST /api/auth/send-reset-otp
router.post("/send-reset-otp", async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    res.status(400).json({ error: "Phone is required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(
    or(eq(usersTable.phone, phone), eq(usersTable.username, phone))
  ).limit(1);
  if (!user) {
    res.status(404).json({ error: "No account found with this mobile number" });
    return;
  }
  const otp = generateOTP();
  otpStore.set(`reset_${phone}`, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });
  res.json({ success: true, otp, message: "Reset OTP sent (demo mode)" });
});

router.post("/logout", (req, res) => {
  res.json({ message: "Logged out" });
});

router.get("/me", requireAuth, (req, res) => {
  res.json(formatUser((req as any).user));
});

export default router;
