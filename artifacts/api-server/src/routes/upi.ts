import { Router } from "express";
import { db } from "@workspace/db";
import { userUpiIdsTable, usersTable, ordersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
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
  // NOTE: chunks are NOT auto-generated on UPI add anymore. Sellers must
  // explicitly start a matching session from the home page (Sell button).
  res.json(row);
});

// Activate a specific UPI. Multiple UPIs may now be active simultaneously —
// matching distributes incoming chunks round-robin across all active UPIs.
router.post("/:id/activate", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const id = parseInt(String(req.params.id));
  const [row] = await db.select().from(userUpiIdsTable).where(
    and(eq(userUpiIdsTable.id, id), eq(userUpiIdsTable.userId, u.id)),
  ).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await db.update(userUpiIdsTable).set({ isActive: true }).where(eq(userUpiIdsTable.id, id));
  res.json({ success: true });
});

// Deactivate a specific UPI without removing it. Doesn't disturb chunks
// already in flight; only stops new chunks from being routed to this UPI.
router.post("/:id/deactivate", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const id = parseInt(String(req.params.id));
  const [row] = await db.select().from(userUpiIdsTable).where(
    and(eq(userUpiIdsTable.id, id), eq(userUpiIdsTable.userId, u.id)),
  ).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await db.update(userUpiIdsTable).set({ isActive: false }).where(eq(userUpiIdsTable.id, id));
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

// Delete a specific UPI (soft — flips inactive). Does not cancel in-flight
// chunks; those are tied to the snapshot of upiId stored on the order row.
router.delete("/:id", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const id = parseInt(String(req.params.id));
  const [row] = await db.select().from(userUpiIdsTable).where(
    and(eq(userUpiIdsTable.id, id), eq(userUpiIdsTable.userId, u.id)),
  ).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await db.update(userUpiIdsTable).set({ isActive: false }).where(eq(userUpiIdsTable.id, id));
  res.json({ success: true });
});

router.post("/disconnect", requireAuth, async (req, res) => {
  const u = (req as any).user;
  // Stop matching session, cancel all unsold (available) chunks, and turn off
  // every active UPI. Locked / pending / disputed chunks are left untouched
  // because they're already mid-trade with another buyer.
  await db.update(ordersTable).set({
    status: "cancelled",
    updatedAt: new Date(),
  }).where(and(
    eq(ordersTable.userId, u.id),
    eq(ordersTable.type, "withdrawal"),
    eq(ordersTable.status, "available"),
  ));
  await db.update(userUpiIdsTable).set({ isActive: false }).where(eq(userUpiIdsTable.userId, u.id));
  await db.update(usersTable).set({
    autoSellEnabled: false,
    matchingExpiresAt: null,
  }).where(eq(usersTable.id, u.id));
  res.json({ success: true });
});

export default router;
