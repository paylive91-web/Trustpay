import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, ordersTable, transactionsTable, depositTasksTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { signToken, requireAdmin, formatUser } from "../lib/auth.js";
import { getSetting, getAllSettings, setSetting } from "../lib/settings.js";
import {
  AdminLoginBody,
  AdminApproveOrderBody,
  AdminUpdateOrderBody,
  AdminCreateDepositTaskBody,
  AdminUpdateUserBalanceBody,
} from "@workspace/api-zod";

const router = Router();

router.post("/login", async (req, res) => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { username, password } = parsed.data;

  const storedUsername = await getSetting("adminUsername");
  const storedHash = await getSetting("adminPasswordHash");

  if (username !== storedUsername) {
    // Try DB admin user
    const [adminUser] = await db.select().from(usersTable)
      .where(and(eq(usersTable.username, username), eq(usersTable.role, "admin"))).limit(1);
    if (!adminUser) { res.status(401).json({ error: "Invalid credentials" }); return; }
    const valid = await bcrypt.compare(password, adminUser.passwordHash);
    if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }
    const token = signToken(adminUser.id, "admin");
    res.json({ user: formatUser(adminUser), token });
    return;
  }

  const valid = await bcrypt.compare(password, storedHash);
  if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }

  // Create/find virtual admin user
  let adminUser = await db.select().from(usersTable).where(eq(usersTable.username, "admin")).limit(1);
  if (!adminUser[0]) {
    const [newAdmin] = await db.insert(usersTable).values({
      username: "admin",
      passwordHash: storedHash,
      role: "admin",
    }).returning();
    adminUser = [newAdmin];
  } else if (adminUser[0].role !== "admin") {
    await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, adminUser[0].id));
    adminUser[0].role = "admin";
  }

  const token = signToken(adminUser[0].id, "admin");
  res.json({ user: formatUser(adminUser[0]), token });
});

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
    notes: order.notes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
  if (user) {
    return {
      ...base,
      user: { id: user.id, username: user.username, phone: user.phone, balance: parseFloat(user.balance), totalDeposits: parseFloat(user.totalDeposits), totalWithdrawals: parseFloat(user.totalWithdrawals), role: user.role },
    };
  }
  return base;
}

router.get("/orders", requireAdmin, async (req, res) => {
  const { type, status } = req.query as { type?: string; status?: string };
  let conditions: any[] = [];
  if (type) conditions.push(eq(ordersTable.type, type as any));
  if (status) conditions.push(eq(ordersTable.status, status as any));
  const query = conditions.length > 0
    ? db.select().from(ordersTable).where(and(...conditions)).orderBy(sql`${ordersTable.createdAt} desc`)
    : db.select().from(ordersTable).orderBy(sql`${ordersTable.createdAt} desc`);
  const orders = await query;
  const userIds = [...new Set(orders.map((o) => o.userId))];
  const users = userIds.length > 0
    ? await db.select().from(usersTable).where(sql`${usersTable.id} = ANY(${sql.raw(`ARRAY[${userIds.join(",")}]`)})`)
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  res.json(orders.map((o) => formatOrder(o, userMap.get(o.userId))));
});

router.post("/orders/:id/approve", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const parsed = AdminApproveOrderBody.safeParse(req.body || {});
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Not found" }); return; }

  let rewardPercent = parseFloat(order.rewardPercent);
  if (parsed.success && parsed.data.rewardPercent != null) {
    rewardPercent = parsed.data.rewardPercent;
  }
  const amount = parseFloat(order.amount);
  const rewardAmount = parseFloat((amount * rewardPercent / 100).toFixed(2));
  const totalAmount = parseFloat((amount + rewardAmount).toFixed(2));

  await db.update(ordersTable).set({
    status: "approved",
    rewardPercent: String(rewardPercent),
    rewardAmount: String(rewardAmount),
    totalAmount: String(totalAmount),
    notes: parsed.success ? parsed.data.notes || order.notes : order.notes,
    updatedAt: new Date(),
  }).where(eq(ordersTable.id, id));

  if (order.type === "deposit") {
    await db.update(usersTable).set({
      balance: sql`${usersTable.balance} + ${totalAmount}`,
      totalDeposits: sql`${usersTable.totalDeposits} + ${amount}`,
    }).where(eq(usersTable.id, order.userId));
    await db.insert(transactionsTable).values({
      userId: order.userId,
      orderId: id,
      type: "credit",
      amount: String(totalAmount),
      description: `Deposit approved for order #${id} (+${rewardPercent}% reward)`,
    });
  }

  const [updated] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  res.json(formatOrder(updated));
});

router.post("/orders/:id/reject", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Not found" }); return; }

  if (order.type === "withdrawal" && order.status === "pending") {
    // Refund balance
    await db.update(usersTable).set({
      balance: sql`${usersTable.balance} + ${parseFloat(order.amount)}`,
      totalWithdrawals: sql`${usersTable.totalWithdrawals} - ${parseFloat(order.amount)}`,
    }).where(eq(usersTable.id, order.userId));
  }

  await db.update(ordersTable).set({ status: "rejected", updatedAt: new Date() }).where(eq(ordersTable.id, id));
  const [updated] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  res.json(formatOrder(updated));
});

router.put("/orders/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const parsed = AdminUpdateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const updates: any = { updatedAt: new Date() };
  if (parsed.data.rewardPercent != null) updates.rewardPercent = String(parsed.data.rewardPercent);
  if (parsed.data.amount != null) updates.amount = String(parsed.data.amount);
  if (parsed.data.notes != null) updates.notes = parsed.data.notes;
  if (parsed.data.status != null) updates.status = parsed.data.status;

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Not found" }); return; }

  const amount = parseFloat(parsed.data.amount != null ? String(parsed.data.amount) : order.amount);
  const rewardPercent = parsed.data.rewardPercent != null ? parsed.data.rewardPercent : parseFloat(order.rewardPercent);
  updates.rewardAmount = String(parseFloat((amount * rewardPercent / 100).toFixed(2)));
  updates.totalAmount = String(parseFloat((amount + parseFloat(updates.rewardAmount)).toFixed(2)));

  await db.update(ordersTable).set(updates).where(eq(ordersTable.id, id));
  const [updated] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  res.json(formatOrder(updated));
});

router.get("/users", requireAdmin, async (req, res) => {
  const users = await db.select().from(usersTable).orderBy(sql`${usersTable.createdAt} desc`);
  res.json(users.map(formatUser));
});

router.put("/users/:id/balance", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const parsed = AdminUpdateUserBalanceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  await db.update(usersTable).set({ balance: String(parsed.data.balance) }).where(eq(usersTable.id, id));
  if (parsed.data.reason) {
    await db.insert(transactionsTable).values({
      userId: id,
      type: parsed.data.balance >= 0 ? "credit" : "debit",
      amount: String(Math.abs(parsed.data.balance)),
      description: parsed.data.reason || "Admin balance update",
    });
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  res.json(formatUser(user));
});

function formatSettingsResponse(s: any) {
  let multipleUpiIds = [];
  try { multipleUpiIds = JSON.parse(s.multipleUpiIds || "[]"); } catch {}
  return {
    upiId: s.upiId || "trustpay@upi",
    upiName: s.upiName || "TrustPay",
    multipleUpiIds,
    popupMessage: s.popupMessage || "",
    popupImageUrl: s.popupImageUrl || "",
    telegramLink: s.telegramLink || "",
    bannerImages: JSON.parse(s.bannerImages || "[]"),
    appName: s.appName || "TrustPay",
    buyRules: s.buyRules || "",
    sellRules: s.sellRules || "",
  };
}

router.get("/settings", requireAdmin, async (req, res) => {
  const s = await getAllSettings();
  res.json(formatSettingsResponse(s));
});

router.put("/settings", requireAdmin, async (req, res) => {
  const body = req.body;
  const { upiId, upiName, multipleUpiIds, popupMessage, popupImageUrl, telegramLink, bannerImages, adminPassword, buyRules, sellRules } = body;
  if (upiId != null) await setSetting("upiId", upiId);
  if (upiName != null) await setSetting("upiName", upiName);
  if (multipleUpiIds != null) await setSetting("multipleUpiIds", JSON.stringify(multipleUpiIds));
  if (popupMessage != null) await setSetting("popupMessage", popupMessage);
  if (popupImageUrl != null) await setSetting("popupImageUrl", popupImageUrl);
  if (telegramLink != null) await setSetting("telegramLink", telegramLink);
  if (bannerImages != null) await setSetting("bannerImages", JSON.stringify(bannerImages));
  if (buyRules != null) await setSetting("buyRules", buyRules);
  if (sellRules != null) await setSetting("sellRules", sellRules);
  if (adminPassword != null) {
    const hash = await bcrypt.hash(adminPassword, 10);
    await setSetting("adminPasswordHash", hash);
  }
  const s = await getAllSettings();
  res.json(formatSettingsResponse(s));
});

router.get("/stats/daily", requireAdmin, async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDeposits = await db.select({ sum: sql<string>`COALESCE(SUM(${ordersTable.amount}), 0)`, count: sql<string>`COUNT(*)` })
    .from(ordersTable)
    .where(and(eq(ordersTable.type, "deposit"), eq(ordersTable.status, "approved"), sql`${ordersTable.createdAt} >= ${today}`));
  const todayWithdrawals = await db.select({ sum: sql<string>`COALESCE(SUM(${ordersTable.amount}), 0)`, count: sql<string>`COUNT(*)` })
    .from(ordersTable)
    .where(and(eq(ordersTable.type, "withdrawal"), eq(ordersTable.status, "approved"), sql`${ordersTable.createdAt} >= ${today}`));
  const totalUsers = await db.select({ count: sql<string>`COUNT(*)` }).from(usersTable);
  const pendingOrders = await db.select({ count: sql<string>`COUNT(*)` }).from(ordersTable).where(eq(ordersTable.status, "pending"));
  res.json({
    todayDeposits: parseFloat(String(todayDeposits[0]?.sum || "0")),
    todayWithdrawals: parseFloat(String(todayWithdrawals[0]?.sum || "0")),
    todayDepositCount: parseInt(String(todayDeposits[0]?.count || "0")),
    todayWithdrawalCount: parseInt(String(todayWithdrawals[0]?.count || "0")),
    totalUsers: parseInt(String(totalUsers[0]?.count || "0")),
    pendingOrders: parseInt(String(pendingOrders[0]?.count || "0")),
  });
});

router.get("/deposit-tasks", requireAdmin, async (req, res) => {
  const tasks = await db.select().from(depositTasksTable).orderBy(depositTasksTable.amount);
  res.json(tasks.map((t) => {
    const amount = parseFloat(t.amount);
    const rewardPercent = parseFloat(t.rewardPercent);
    const rewardAmount = parseFloat((amount * rewardPercent / 100).toFixed(2));
    return { id: t.id, amount, rewardPercent, rewardAmount, totalAmount: amount + rewardAmount, isActive: t.isActive };
  }));
});

router.post("/deposit-tasks", requireAdmin, async (req, res) => {
  const parsed = AdminCreateDepositTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const { amount, rewardPercent, isActive } = parsed.data;
  const [task] = await db.insert(depositTasksTable).values({
    amount: String(amount),
    rewardPercent: String(rewardPercent),
    isActive: isActive ?? true,
  }).returning();
  const amt = parseFloat(task.amount);
  const pct = parseFloat(task.rewardPercent);
  const reward = parseFloat((amt * pct / 100).toFixed(2));
  res.json({ id: task.id, amount: amt, rewardPercent: pct, rewardAmount: reward, totalAmount: amt + reward, isActive: task.isActive });
});

router.put("/deposit-tasks/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const parsed = AdminCreateDepositTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const { amount, rewardPercent, isActive } = parsed.data;
  await db.update(depositTasksTable).set({
    amount: String(amount),
    rewardPercent: String(rewardPercent),
    isActive: isActive ?? true,
  }).where(eq(depositTasksTable.id, id));
  const [task] = await db.select().from(depositTasksTable).where(eq(depositTasksTable.id, id)).limit(1);
  if (!task) { res.status(404).json({ error: "Not found" }); return; }
  const amt = parseFloat(task.amount);
  const pct = parseFloat(task.rewardPercent);
  const reward = parseFloat((amt * pct / 100).toFixed(2));
  res.json({ id: task.id, amount: amt, rewardPercent: pct, rewardAmount: reward, totalAmount: amt + reward, isActive: task.isActive });
});

router.delete("/deposit-tasks/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(depositTasksTable).where(eq(depositTasksTable.id, id));
  res.json({ message: "Deleted" });
});

export default router;
