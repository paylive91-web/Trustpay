import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { signToken, requireAuth, formatUser } from "../lib/auth.js";

const router = Router();

router.post("/register", async (req, res) => {
  const { phone, password, referralCode } = req.body;
  if (!phone || !password) {
    res.status(400).json({ error: "Phone and password are required" });
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

  let referredById: number | null = null;
  if (referralCode) {
    const [referrer] = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode.toUpperCase())).limit(1);
    if (referrer) referredById = referrer.id;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    username: phone,
    passwordHash,
    phone,
    referredBy: referredById || undefined,
  }).returning();

  const code = "TP" + String(user.id).padStart(6, "0");
  await db.update(usersTable).set({ referralCode: code }).where(eq(usersTable.id, user.id));
  user.referralCode = code;

  const token = signToken(user.id, user.role);
  res.json({ user: formatUser(user), token });
});

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
  if (user.isBlocked) {
    res.status(403).json({ error: "Account blocked", reason: user.blockedReason || "Contact support" });
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

router.post("/logout", (_req, res) => {
  res.json({ message: "Logged out" });
});

router.get("/me", requireAuth, (req, res) => {
  res.json(formatUser((req as any).user));
});

export default router;
