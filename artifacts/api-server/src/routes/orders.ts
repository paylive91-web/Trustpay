import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, depositTasksTable } from "@workspace/db";
import { eq, and, sql, or } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

function f(o: any) {
  return {
    id: o.id,
    userId: o.userId,
    type: o.type,
    amount: parseFloat(o.amount),
    rewardPercent: parseFloat(o.rewardPercent),
    rewardAmount: parseFloat(o.rewardAmount),
    totalAmount: parseFloat(o.totalAmount),
    sellRewardPercent: parseFloat(o.sellRewardPercent || "0"),
    sellRewardAmount: parseFloat(o.sellRewardAmount || "0"),
    status: o.status,
    upiId: o.upiId,
    upiName: o.upiName,
    userUpiId: o.userUpiId,
    userUpiName: o.userUpiName,
    userName: o.userName,
    utrNumber: o.utrNumber,
    screenshotUrl: o.screenshotUrl,
    recordingUrl: o.recordingUrl,
    notes: o.notes,
    lockedByUserId: o.lockedByUserId,
    confirmDeadline: o.confirmDeadline,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

// Deposit tasks - kept for backward compatibility (legacy direct-deposit flow)
router.get("/deposit-tasks", requireAuth, async (req, res) => {
  const tasks = await db.select().from(depositTasksTable).where(eq(depositTasksTable.isActive, true));
  res.json(tasks.map((t) => {
    const a = parseFloat(t.amount);
    const rp = parseFloat(t.rewardPercent);
    const ra = parseFloat((a * rp / 100).toFixed(2));
    return { id: t.id, amount: a, rewardPercent: rp, rewardAmount: ra, totalAmount: a + ra, isActive: t.isActive };
  }));
});

// User's order history: chunks they bought (as buyer) + chunks they sold (as seller)
router.get("/", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const orders = await db.select().from(ordersTable).where(or(
    eq(ordersTable.userId, u.id),
    eq(ordersTable.lockedByUserId, u.id),
  )).orderBy(sql`${ordersTable.createdAt} desc`).limit(100);
  // Tag the role
  res.json(orders.map((o) => ({
    ...f(o),
    role: o.userId === u.id ? "seller" : "buyer",
    // For history display, present the buyer-side as "deposit"
    type: o.userId === u.id ? "withdrawal" : "deposit",
  })));
});

// Legacy: stay compatible with old buy.tsx frontend that polls active-deposit
router.get("/active-deposit", requireAuth, async (req, res) => {
  res.json(null); // legacy flow removed; new buyers track via /api/p2p/my-buy
});

// Legacy: empty list
router.get("/withdrawal-orders", requireAuth, async (_req, res) => {
  res.json([]);
});

router.get("/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const u = (req as any).user;
  const [o] = await db.select().from(ordersTable).where(and(
    eq(ordersTable.id, id),
    or(eq(ordersTable.userId, u.id), eq(ordersTable.lockedByUserId, u.id)),
  )).limit(1);
  if (!o) { res.status(404).json({ error: "Not found" }); return; }
  res.json(f(o));
});

export default router;
