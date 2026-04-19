import { Router } from "express";
import { db } from "@workspace/db";
import { userUpiIdsTable, usersTable, ordersTable, transactionsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { regenerateChunksForUser } from "../lib/matching.js";
import { checkUpiReuse } from "../lib/fraud.js";

const router = Router();

// List all UPIs for the user (including inactive so the manage page shows history)
router.get("/", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const rows = await db.select().from(userUpiIdsTable)
    .where(eq(userUpiIdsTable.userId, u.id))
    .orderBy(userUpiIdsTable.createdAt);
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

// Activate a specific UPI (deactivates all others)
router.post("/:id/activate", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const id = parseInt(String(req.params.id));
  const [row] = await db.select().from(userUpiIdsTable).where(
    and(eq(userUpiIdsTable.id, id), eq(userUpiIdsTable.userId, u.id)),
  ).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  // Deactivate all others, activate this one
  await db.update(userUpiIdsTable).set({ isActive: false }).where(eq(userUpiIdsTable.userId, u.id));
  await db.update(userUpiIdsTable).set({ isActive: true }).where(eq(userUpiIdsTable.id, id));
  await db.update(usersTable).set({ autoSellEnabled: true }).where(eq(usersTable.id, u.id));
  // Cancel available chunks so they get re-generated with new UPI
  await db.update(ordersTable).set({ status: "cancelled", updatedAt: new Date() }).where(and(
    eq(ordersTable.userId, u.id), eq(ordersTable.type, "withdrawal"), eq(ordersTable.status, "available"),
  ));
  await regenerateChunksForUser(u.id);
  res.json({ success: true });
});

router.get("/presence", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const [row] = await db.select({ lastSeenAt: usersTable.lastSeenAt }).from(usersTable).where(eq(usersTable.id, u.id)).limit(1);
  const [activeUpi] = await db.select({ id: userUpiIdsTable.id }).from(userUpiIdsTable).where(and(
    eq(userUpiIdsTable.userId, u.id),
    eq(userUpiIdsTable.isActive, true),
  )).limit(1);
  const active = !!row?.lastSeenAt && !!activeUpi && Date.now() - new Date(row.lastSeenAt).getTime() < 2 * 60 * 1000;
  res.json({ active });
});

// Delete a specific UPI (cannot delete if it's the only active one mid-trade)
router.delete("/:id", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const id = parseInt(String(req.params.id));
  const [row] = await db.select().from(userUpiIdsTable).where(
    and(eq(userUpiIdsTable.id, id), eq(userUpiIdsTable.userId, u.id)),
  ).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await db.update(userUpiIdsTable).set({ isActive: false }).where(eq(userUpiIdsTable.id, id));
  // If this was the active UPI, disable auto-sell and cancel available chunks
  if (row.isActive) {
    const remaining = await db.select().from(userUpiIdsTable).where(
      and(eq(userUpiIdsTable.userId, u.id), eq(userUpiIdsTable.isActive, true)),
    ).limit(1);
    if (remaining.length === 0) {
      await db.update(usersTable).set({ autoSellEnabled: false }).where(eq(usersTable.id, u.id));
      await db.update(ordersTable).set({ status: "cancelled", updatedAt: new Date() }).where(and(
        eq(ordersTable.userId, u.id), eq(ordersTable.type, "withdrawal"), eq(ordersTable.status, "available"),
      ));
    }
  }
  res.json({ success: true });
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
