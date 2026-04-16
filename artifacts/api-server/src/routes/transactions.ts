import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const currentUser = (req as any).user;
  const txns = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.userId, currentUser.id))
    .orderBy(sql`${transactionsTable.createdAt} desc`)
    .limit(50);
  res.json(txns.map((t) => ({
    id: t.id,
    userId: t.userId,
    orderId: t.orderId,
    type: t.type,
    amount: parseFloat(t.amount),
    description: t.description,
    createdAt: t.createdAt,
  })));
});

export default router;
