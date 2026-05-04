import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, ordersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/summary", requireAuth, async (req, res) => {
  const currentUser = (req as any).user;

  // Run all three independent reads in parallel — they previously ran
  // sequentially, adding ~150-300ms latency on every dashboard load.
  const [totalRewards, pending, recentTxns] = await Promise.all([
    db.select({ sum: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.userId, currentUser.id),
        eq(transactionsTable.type, "credit"),
        sql`${transactionsTable.description} LIKE '%reward%'`
      )),
    db.select({ count: sql<string>`COUNT(*)` })
      .from(ordersTable)
      .where(and(
        eq(ordersTable.userId, currentUser.id),
        eq(ordersTable.status, "pending")
      )),
    db.select().from(transactionsTable)
      .where(eq(transactionsTable.userId, currentUser.id))
      .orderBy(sql`${transactionsTable.createdAt} desc`)
      .limit(5),
  ]);

  res.json({
    balance: parseFloat(String(currentUser.balance)),
    totalDeposits: parseFloat(String(currentUser.totalDeposits)),
    totalWithdrawals: parseFloat(String(currentUser.totalWithdrawals)),
    totalRewards: parseFloat(String(totalRewards[0]?.sum || "0")),
    pendingOrders: parseInt(String(pending[0]?.count || "0")),
    recentTransactions: recentTxns.map((t) => ({
      id: t.id,
      userId: t.userId,
      orderId: t.orderId,
      type: t.type,
      amount: parseFloat(t.amount),
      description: t.description,
      createdAt: t.createdAt,
    })),
  });
});

export default router;
