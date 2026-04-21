import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.SESSION_SECRET || "trustpay-secret-key";

export function signToken(userId: number, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): { userId: number; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  const user = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
  if (!user[0]) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  if (user[0].isBlocked && user[0].role !== "admin") {
    res.status(403).json({ error: "Account blocked", reason: user[0].blockedReason || "Contact support" });
    return;
  }
  if (!user[0].referralCode) {
    const code = "TP" + String(user[0].id).padStart(6, "0");
    await db.update(usersTable).set({ referralCode: code }).where(eq(usersTable.id, user[0].id));
    user[0].referralCode = code;
  }
  (req as any).user = user[0];
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    const user = (req as any).user;
    if (user.role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  });
}

export function formatUser(user: any) {
  return {
    id: user.id,
    username: user.username,
    phone: user.phone,
    balance: parseFloat(user.balance),
    heldBalance: parseFloat(user.heldBalance || "0"),
    totalDeposits: parseFloat(user.totalDeposits),
    totalWithdrawals: parseFloat(user.totalWithdrawals),
    inviteEarnings: parseFloat(user.inviteEarnings || "0"),
    inviteEarningsL2: parseFloat(user.inviteEarningsL2 || "0"),
    referralCode: user.referralCode,
    referredBy: user.referredBy,
    role: user.role,
    trustScore: user.trustScore ?? 0,
    successfulTrades: user.successfulTrades ?? 0,
    isBlocked: !!user.isBlocked,
    isFrozen: !!user.isFrozen,
    autoSellEnabled: !!user.autoSellEnabled,
    mustInstallApp: !!user.mustInstallApp,
    email: user.email || null,
    googleVerified: !!user.googleSub,
    blockedReason: user.blockedReason,
    matchingExpiresAt: user.matchingExpiresAt || null,
    displayName: user.displayName || null,
    fraudWarningCount: user.fraudWarningCount ?? 0,
    isVerifiedAgent: user.agentTierAwardedDate === new Date().toISOString().slice(0, 10),
    createdAt: user.createdAt,
  };
}
