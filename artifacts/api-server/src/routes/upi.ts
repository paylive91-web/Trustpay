import { Router } from "express";
import { db } from "@workspace/db";
import { userUpiIdsTable, usersTable, ordersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { regenerateChunksForUser } from "../lib/matching.js";
import { checkUpiReuse } from "../lib/fraud.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const rows = await db.select().from(userUpiIdsTable)
    .where(and(eq(userUpiIdsTable.userId, u.id), eq(userUpiIdsTable.isActive, true)));
  res.json(rows);
});

router.post("/", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const { upiId, platform, bankName, holderName } = req.body;
  if (!upiId || !platform || !bankName || !holderName) {
    res.status(400).json({ error: "All fields required" });
    return;
  }
  if (!/^[\w.\-]+@[\w.\-]+$/.test(upiId)) {
    res.status(400).json({ error: "Invalid UPI ID format" });
    return;
  }
  const [row] = await db.insert(userUpiIdsTable).values({
    userId: u.id, upiId, platform, bankName, holderName, isActive: true,
  }).returning();
  // Fraud: detect UPI shared across accounts.
  await checkUpiReuse(upiId, u.id);
  // enable auto-sell + chunk balance
  await db.update(usersTable).set({ autoSellEnabled: true }).where(eq(usersTable.id, u.id));
  await regenerateChunksForUser(u.id);
  res.json(row);
});

router.post("/disconnect", requireAuth, async (req, res) => {
  const u = (req as any).user;
  // Cancel all unsold (available) chunks belonging to this user. Locked /
  // pending_confirmation / disputed chunks are left untouched (they are
  // already in flight with another buyer). Cancelled chunks have their amount
  // returned to the user's balance via a soft delete on the order row — they
  // were never debited from `balance` (debit happens at lock time only), so
  // we just remove them so the user's available balance recomputes correctly.
  await db.update(ordersTable).set({
    status: "cancelled",
    updatedAt: new Date(),
  }).where(and(
    eq(ordersTable.userId, u.id),
    eq(ordersTable.type, "withdrawal"),
    eq(ordersTable.status, "available"),
  ));
  await db.update(userUpiIdsTable).set({ isActive: false }).where(eq(userUpiIdsTable.userId, u.id));
  await db.update(usersTable).set({ autoSellEnabled: false }).where(eq(usersTable.id, u.id));
  res.json({ success: true });
});

export default router;
