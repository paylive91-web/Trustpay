import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, usersTable, depositTasksTable, transactionsTable, referralsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { getSettings } from "../lib/settings.js";

const router = Router();

function formatOrder(order: any, user?: any) {
  const base = {
    id: order.id,
    userId: order.userId,
    type: order.type,
    amount: parseFloat(order.amount),
    rewardPercent: parseFloat(order.rewardPercent),
    rewardAmount: parseFloat(order.rewardAmount),
    totalAmount: parseFloat(order.totalAmount),
    status: order.status,
    upiId: order.upiId,
    upiName: order.upiName,
    userUpiId: order.userUpiId,
    userUpiName: order.userUpiName,
    userName: order.userName,
    utrNumber: order.utrNumber,
    screenshotUrl: order.screenshotUrl,
    notes: order.notes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
  if (user) {
    return { ...base, user: { id: user.id, username: user.username, phone: user.phone, balance: parseFloat(user.balance), totalDeposits: parseFloat(user.totalDeposits), totalWithdrawals: parseFloat(user.totalWithdrawals), role: user.role } };
  }
  return base;
}

function getWithdrawalRewardPercent(amount: number): number {
  if (amount >= 2001) return 3;
  if (amount >= 1001) return 4;
  return 5;
}

router.get("/deposit-tasks", requireAuth, async (req, res) => {
  const tasks = await db.select().from(depositTasksTable).where(eq(depositTasksTable.isActive, true));
  const formatted = tasks.map((t) => {
    const amount = parseFloat(t.amount);
    const rewardPercent = parseFloat(t.rewardPercent);
    const rewardAmount = parseFloat((amount * rewardPercent / 100).toFixed(2));
    const totalAmount = parseFloat((amount + rewardAmount).toFixed(2));
    return { id: t.id, amount, rewardPercent, rewardAmount, totalAmount, isActive: t.isActive };
  });
  res.json(formatted);
});

router.get("/withdrawal-orders", requireAuth, async (req, res) => {
  const currentUser = (req as any).user;
  const orders = await db.select().from(ordersTable)
    .where(and(
      eq(ordersTable.type, "withdrawal"),
      eq(ordersTable.status, "pending"),
      sql`${ordersTable.userId} != ${currentUser.id}`
    ));
  const settings = await getSettings(["upiId", "upiName"]);
  res.json(orders.map((o) => ({
    ...formatOrder(o),
    upiId: settings.upiId,
    upiName: settings.upiName,
  })));
});

router.get("/active-deposit", requireAuth, async (req, res) => {
  const currentUser = (req as any).user;
  const [order] = await db.select().from(ordersTable).where(
    and(
      eq(ordersTable.userId, currentUser.id),
      eq(ordersTable.type, "deposit"),
      eq(ordersTable.status, "pending")
    )
  ).limit(1);
  res.json(order ? formatOrder(order) : null);
});

router.get("/", requireAuth, async (req, res) => {
  const currentUser = (req as any).user;
  const { type, status } = req.query as { type?: string; status?: string };
  let conditions: any[] = [eq(ordersTable.userId, currentUser.id)];
  if (type) conditions.push(eq(ordersTable.type, type as any));
  if (status) conditions.push(eq(ordersTable.status, status as any));
  const orders = await db.select().from(ordersTable).where(and(...conditions)).orderBy(sql`${ordersTable.createdAt} desc`);
  res.json(orders.map(formatOrder));
});

router.get("/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const currentUser = (req as any).user;
  const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, id), eq(ordersTable.userId, currentUser.id))).limit(1);
  if (!order) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatOrder(order));
});

router.post("/", requireAuth, async (req, res) => {
  const { type, amount, depositTaskId, userUpiId, userUpiName, userName, utrNumber, screenshotUrl, notes } = req.body;
  if (!type || !amount) { res.status(400).json({ error: "Type and amount required" }); return; }
  const currentUser = (req as any).user;
  const settings = await getSettings(["upiId", "upiName"]);

  if (type === "withdrawal") {
    if (parseFloat(String(currentUser.balance)) < amount) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }
    if (!userUpiId || !userUpiName) {
      res.status(400).json({ error: "UPI ID and name required for withdrawal" });
      return;
    }
    const rewardPercent = getWithdrawalRewardPercent(amount);
    const rewardAmount = parseFloat((amount * rewardPercent / 100).toFixed(2));
    const totalAmount = parseFloat((amount + rewardAmount).toFixed(2));
    await db.update(usersTable).set({
      balance: sql`${usersTable.balance} - ${amount}`,
      totalWithdrawals: sql`${usersTable.totalWithdrawals} + ${amount}`,
    }).where(eq(usersTable.id, currentUser.id));
    const [order] = await db.insert(ordersTable).values({
      userId: currentUser.id,
      type: "withdrawal",
      amount: String(amount),
      rewardPercent: String(0),
      rewardAmount: String(0),
      totalAmount: String(amount),
      status: "pending",
      userUpiId,
      userUpiName,
      userName: userName || currentUser.username,
      upiId: settings.upiId,
      upiName: settings.upiName,
    }).returning();
    res.json(formatOrder(order));
    return;
  }

  // deposit - check for active pending deposit
  const [existing] = await db.select().from(ordersTable).where(
    and(
      eq(ordersTable.userId, currentUser.id),
      eq(ordersTable.type, "deposit"),
      eq(ordersTable.status, "pending")
    )
  ).limit(1);
  if (existing) {
    res.status(400).json({ error: "You already have a pending deposit order. Please complete or cancel it first." });
    return;
  }

  let rewardPercent = 4;
  if (depositTaskId) {
    const [task] = await db.select().from(depositTasksTable).where(eq(depositTasksTable.id, depositTaskId)).limit(1);
    if (task) rewardPercent = parseFloat(task.rewardPercent);
  }
  const rewardAmount = parseFloat((amount * rewardPercent / 100).toFixed(2));
  const totalAmount = parseFloat((amount + rewardAmount).toFixed(2));
  const [order] = await db.insert(ordersTable).values({
    userId: currentUser.id,
    type: "deposit",
    amount: String(amount),
    rewardPercent: String(rewardPercent),
    rewardAmount: String(rewardAmount),
    totalAmount: String(totalAmount),
    status: "pending",
    upiId: settings.upiId,
    upiName: settings.upiName,
    userName: userName || currentUser.username,
    utrNumber: utrNumber || null,
    screenshotUrl: screenshotUrl || null,
    notes: notes || null,
  }).returning();
  res.json(formatOrder(order));
});

router.post("/:id/cancel", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const currentUser = (req as any).user;
  const [order] = await db.select().from(ordersTable).where(
    and(eq(ordersTable.id, id), eq(ordersTable.userId, currentUser.id), eq(ordersTable.status, "pending"))
  ).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found or cannot be cancelled" }); return; }
  await db.update(ordersTable).set({ status: "rejected", updatedAt: new Date() }).where(eq(ordersTable.id, id));
  res.json({ success: true });
});

router.post("/:id/pay", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const currentUser = (req as any).user;
  const [order] = await db.select().from(ordersTable).where(
    and(eq(ordersTable.id, id), eq(ordersTable.type, "withdrawal"), eq(ordersTable.status, "pending"))
  ).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found or not payable" }); return; }
  if (order.userId === currentUser.id) { res.status(400).json({ error: "Cannot pay your own order" }); return; }

  const totalAmount = parseFloat(order.totalAmount);
  if (parseFloat(String(currentUser.balance)) < totalAmount) {
    res.status(400).json({ error: "Insufficient balance" });
    return;
  }

  await db.update(ordersTable).set({ status: "approved", updatedAt: new Date() }).where(eq(ordersTable.id, id));
  await db.update(usersTable).set({
    balance: sql`${usersTable.balance} - ${totalAmount}`,
  }).where(eq(usersTable.id, currentUser.id));

  const rewardAmount = parseFloat(order.rewardAmount);
  await db.update(usersTable).set({
    balance: sql`${usersTable.balance} + ${rewardAmount}`,
  }).where(eq(usersTable.id, order.userId));

  await db.insert(transactionsTable).values({
    userId: currentUser.id,
    orderId: id,
    type: "debit",
    amount: String(totalAmount),
    description: `Paid withdrawal order #${id}`,
  });
  await db.insert(transactionsTable).values({
    userId: order.userId,
    orderId: id,
    type: "credit",
    amount: String(rewardAmount),
    description: `Withdrawal reward for order #${id}`,
  });

  const [updated] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  res.json(formatOrder(updated));
});

export default router;
