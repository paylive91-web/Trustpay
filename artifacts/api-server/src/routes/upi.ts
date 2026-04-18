import { Router } from "express";
import { db } from "@workspace/db";
import { userUpiIdsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { regenerateChunksForUser } from "../lib/matching.js";

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
  // enable auto-sell + chunk balance
  await db.update(usersTable).set({ autoSellEnabled: true }).where(eq(usersTable.id, u.id));
  await regenerateChunksForUser(u.id);
  res.json(row);
});

router.post("/disconnect", requireAuth, async (req, res) => {
  const u = (req as any).user;
  await db.update(userUpiIdsTable).set({ isActive: false }).where(eq(userUpiIdsTable.userId, u.id));
  await db.update(usersTable).set({ autoSellEnabled: false }).where(eq(usersTable.id, u.id));
  // chunks already in queue stay; new generation paused
  res.json({ success: true });
});

export default router;
