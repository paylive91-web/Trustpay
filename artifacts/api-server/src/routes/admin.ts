import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, ordersTable, transactionsTable, depositTasksTable, fraudAlertsTable, trustEventsTable, highValueEventsTable, userNotificationsTable, deviceFingerprintsTable, userUpiIdsTable, disputesTable, utrIndexTable, imageHashesTable, referralsTable } from "@workspace/db";
import { eq, and, sql, inArray, or } from "drizzle-orm";
import { signToken, requireAdmin, formatUser } from "../lib/auth.js";
import { getSetting, getAllSettings, setSetting } from "../lib/settings.js";
import { listFraudRules, setFraudRuleEnabled } from "../lib/fraud.js";

const router = Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) { res.status(400).json({ error: "Username and password required" }); return; }

  const storedUsername = await getSetting("adminUsername");
  const storedHash = await getSetting("adminPasswordHash");

  if (username !== storedUsername) {
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

  let adminUser = await db.select().from(usersTable).where(eq(usersTable.username, "admin")).limit(1);
  if (!adminUser[0]) {
    const [newAdmin] = await db.insert(usersTable).values({
      username: "admin", passwordHash: storedHash, role: "admin",
    }).returning();
    adminUser = [newAdmin];
  } else if (adminUser[0].role !== "admin") {
    await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, adminUser[0].id));
    adminUser[0].role = "admin";
  }

  const token = signToken(adminUser[0].id, "admin");
  res.json({ user: formatUser(adminUser[0]), token });
});

function fOrder(o: any, user?: any) {
  const base = {
    id: o.id, userId: o.userId, type: o.type,
    amount: parseFloat(o.amount), rewardPercent: parseFloat(o.rewardPercent),
    rewardAmount: parseFloat(o.rewardAmount), totalAmount: parseFloat(o.totalAmount),
    status: o.status, upiId: o.upiId, upiName: o.upiName,
    userUpiId: o.userUpiId, userUpiName: o.userUpiName, userName: o.userName,
    utrNumber: o.utrNumber, screenshotUrl: o.screenshotUrl, recordingUrl: o.recordingUrl,
    notes: o.notes, lockedByUserId: o.lockedByUserId,
    createdAt: o.createdAt, updatedAt: o.updatedAt,
  };
  if (user) return { ...base, user: formatUser(user) };
  return base;
}

router.get("/orders", requireAdmin, async (req, res) => {
  const { type, status } = req.query as { type?: string; status?: string };
  let conditions: any[] = [];
  if (type) conditions.push(eq(ordersTable.type, type as any));
  if (status) conditions.push(eq(ordersTable.status, status as any));
  const orders = conditions.length > 0
    ? await db.select().from(ordersTable).where(and(...conditions)).orderBy(sql`${ordersTable.createdAt} desc`).limit(300)
    : await db.select().from(ordersTable).orderBy(sql`${ordersTable.createdAt} desc`).limit(300);
  const userIds = [...new Set(orders.map((o) => o.userId))];
  const users = userIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  res.json(orders.map((o) => fOrder(o, userMap.get(o.userId))));
});

router.get("/users", requireAdmin, async (req, res) => {
  const users = await db.select().from(usersTable).orderBy(sql`${usersTable.createdAt} desc`);
  res.json(users.map(formatUser));
});

router.get("/users/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.userId, id)).orderBy(sql`${ordersTable.createdAt} desc`).limit(50);
  const trustEvents = await db.select().from(trustEventsTable).where(eq(trustEventsTable.userId, id)).orderBy(sql`${trustEventsTable.createdAt} desc`).limit(30);
  const fraudAlerts = await db.select().from(fraudAlertsTable).where(eq(fraudAlertsTable.userId, id)).orderBy(sql`${fraudAlertsTable.createdAt} desc`).limit(30);
  res.json({ user: formatUser(user), orders: orders.map((o) => fOrder(o)), trustEvents, fraudAlerts });
});

router.post("/users/:id/block", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { reason } = req.body || {};
  await db.update(usersTable).set({
    isBlocked: true, blockedReason: reason || "Blocked by admin", blockedAt: new Date(),
  }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

router.post("/users/:id/unblock", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  await db.update(usersTable).set({
    isBlocked: false, blockedReason: null, blockedAt: null,
  }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

router.post("/users/:id/freeze", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  await db.update(usersTable).set({ isFrozen: true }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

router.post("/users/:id/unfreeze", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  await db.update(usersTable).set({ isFrozen: false }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

router.put("/users/:id/balance", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { balance, reason } = req.body || {};
  if (typeof balance !== "number") { res.status(400).json({ error: "balance number required" }); return; }
  await db.update(usersTable).set({ balance: String(balance) }).where(eq(usersTable.id, id));
  if (reason) {
    await db.insert(transactionsTable).values({
      userId: id, type: balance >= 0 ? "credit" : "debit",
      amount: String(Math.abs(balance)), description: reason || "Admin balance update",
    });
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  res.json(formatUser(user));
});

router.delete("/users/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  if (user.role === "admin") { res.status(400).json({ error: "Admin users cannot be deleted" }); return; }

  // Get all order IDs belonging to this user (as buyer or seller)
  const userOrders = await db.select({ id: ordersTable.id }).from(ordersTable)
    .where(or(eq(ordersTable.userId, id), eq(ordersTable.lockedByUserId, id)));
  const orderIds = userOrders.map((o) => o.id);

  // Delete records referencing orders first (deeper dependencies)
  if (orderIds.length > 0) {
    await db.delete(utrIndexTable).where(inArray(utrIndexTable.orderId, orderIds));
    await db.delete(imageHashesTable).where(inArray(imageHashesTable.orderId, orderIds));
    await db.delete(trustEventsTable).where(inArray(trustEventsTable.orderId, orderIds));
    await db.delete(disputesTable).where(or(
      inArray(disputesTable.orderId, orderIds),
      eq(disputesTable.buyerId, id),
      eq(disputesTable.sellerId, id),
    ));
    await db.delete(fraudAlertsTable).where(or(
      inArray(fraudAlertsTable.orderId, orderIds),
      eq(fraudAlertsTable.userId, id),
    ));
  } else {
    await db.delete(trustEventsTable).where(eq(trustEventsTable.userId, id));
    await db.delete(disputesTable).where(or(eq(disputesTable.buyerId, id), eq(disputesTable.sellerId, id)));
    await db.delete(fraudAlertsTable).where(eq(fraudAlertsTable.userId, id));
  }

  // Delete records referencing user directly
  await db.delete(userNotificationsTable).where(eq(userNotificationsTable.userId, id));
  await db.delete(deviceFingerprintsTable).where(eq(deviceFingerprintsTable.userId, id));
  await db.delete(highValueEventsTable).where(eq(highValueEventsTable.userId, id));
  await db.delete(userUpiIdsTable).where(eq(userUpiIdsTable.userId, id));
  await db.delete(referralsTable).where(or(eq(referralsTable.referrerId, id), eq(referralsTable.referredUserId, id)));
  await db.delete(transactionsTable).where(eq(transactionsTable.userId, id));

  // Now delete orders and finally the user
  await db.delete(ordersTable).where(or(eq(ordersTable.userId, id), eq(ordersTable.lockedByUserId, id)));
  await db.delete(usersTable).where(eq(usersTable.id, id));

  res.json({ success: true });
});

router.get("/fraud-alerts", requireAdmin, async (req, res) => {
  const { resolved } = req.query as { resolved?: string };
  const conds: any[] = [];
  if (resolved === "true") conds.push(eq(fraudAlertsTable.resolved, true));
  if (resolved === "false") conds.push(eq(fraudAlertsTable.resolved, false));
  const rows = conds.length > 0
    ? await db.select().from(fraudAlertsTable).where(and(...conds)).orderBy(sql`${fraudAlertsTable.createdAt} desc`).limit(200)
    : await db.select().from(fraudAlertsTable).orderBy(sql`${fraudAlertsTable.createdAt} desc`).limit(200);
  const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as number[];
  const users = userIds.length ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds)) : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  res.json(rows.map((r) => ({
    ...r,
    user: r.userId && byId.get(r.userId) ? { id: r.userId, username: byId.get(r.userId)!.username, trustScore: byId.get(r.userId)!.trustScore } : null,
  })));
});

router.post("/fraud-alerts/:id/resolve", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const [alert] = await db.select().from(fraudAlertsTable).where(eq(fraudAlertsTable.id, id)).limit(1);
  await db.update(fraudAlertsTable).set({ resolved: true }).where(eq(fraudAlertsTable.id, id));
  // Auto-unfreeze the user when ALL of their alerts are resolved, so admins
  // don't need a separate "Unfreeze" action. If other open alerts remain on
  // the user, leave the freeze in place.
  if (alert?.userId) {
    const stillOpen = await db.select().from(fraudAlertsTable).where(and(
      eq(fraudAlertsTable.userId, alert.userId),
      eq(fraudAlertsTable.resolved, false),
    )).limit(1);
    if (stillOpen.length === 0) {
      await db.update(usersTable).set({ isFrozen: false }).where(eq(usersTable.id, alert.userId));
    }
  }
  res.json({ success: true });
});

// Admin marks alert as notified (or sends a fresh in-app notice if not yet sent).
// Idempotent: marking again does not create a second notification.
router.post("/fraud-alerts/:id/notify", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const adminId = (req as any).user.id;
  const [alert] = await db.select().from(fraudAlertsTable).where(eq(fraudAlertsTable.id, id)).limit(1);
  if (!alert) { res.status(404).json({ error: "Alert not found" }); return; }
  if (!alert.userId) { res.status(400).json({ error: "Alert has no associated user" }); return; }

  if (!alert.notifiedAt) {
    const sevLabel = alert.severity === "critical" ? "Critical" : alert.severity === "warn" ? "Warning" : "Notice";
    await db.insert(userNotificationsTable).values({
      userId: alert.userId,
      kind: "fraud_alert",
      title: `${sevLabel}: Account flagged (${alert.rule})`,
      body: `An admin has reviewed activity on your account and asked us to notify you.${alert.evidence ? `\n\nDetails: ${alert.evidence}` : ""}`,
      severity: alert.severity,
      fraudAlertId: alert.id,
    });
  }
  await db.update(fraudAlertsTable)
    .set({ notifiedAt: new Date(), notifiedBy: adminId })
    .where(eq(fraudAlertsTable.id, id));
  res.json({ success: true });
});

// List every fraud rule the engine knows about, plus its current enabled flag.
router.get("/fraud-rules", requireAdmin, async (_req, res) => {
  res.json(await listFraudRules());
});

// Toggle one rule on/off. Disabled rules produce no alerts, no notifications,
// and never auto-freeze users until re-enabled.
router.post("/fraud-rules/toggle", requireAdmin, async (req, res) => {
  const { rule, enabled } = req.body || {};
  if (typeof rule !== "string" || typeof enabled !== "boolean") {
    res.status(400).json({ error: "rule (string) and enabled (boolean) required" });
    return;
  }
  try {
    await setFraudRuleEnabled(rule, enabled);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Failed to toggle rule" });
    return;
  }
  res.json({ success: true });
});

router.post("/notify-all", requireAdmin, async (req, res) => {
  const { message, title } = req.body;
  if (!message) { res.status(400).json({ error: "Message is required" }); return; }
  const notification = { title: title || "TrustPay", message, sentAt: new Date().toISOString() };
  await setSetting("broadcastNotification", JSON.stringify(notification));
  res.json({ success: true, notification });
});

function fSettings(s: any) {
  let multipleUpiIds: any[] = [];
  try { multipleUpiIds = JSON.parse(s.multipleUpiIds || "[]"); } catch {}
  let announcements: any[] = [];
  try { announcements = JSON.parse(s.announcements || "[]"); } catch {}
  let broadcastNotification: any = null;
  try { broadcastNotification = JSON.parse(s.broadcastNotification || "null"); } catch {}
  // Fee tiers: admin-configured per-chunk fee bands. Stored as JSON, parsed
  // here so the admin UI gets a typed array. Empty array = use legacy flat fee.
  let feeTiers: Array<{ min: number; max: number; fee: number }> = [];
  try {
    const raw = JSON.parse(s.feeTiers || "[]");
    if (Array.isArray(raw)) {
      feeTiers = raw
        .map((t: any) => ({ min: Number(t?.min), max: Number(t?.max), fee: Number(t?.fee) }))
        .filter((t) => Number.isFinite(t.min) && Number.isFinite(t.max) && Number.isFinite(t.fee));
    }
  } catch {}
  return {
    upiId: s.upiId || "trustpay@upi",
    upiName: s.upiName || "TrustPay",
    multipleUpiIds, popupMessage: s.popupMessage || "", popupImageUrl: s.popupImageUrl || "",
    announcements, telegramLink: s.telegramLink || "",
    bannerImages: JSON.parse(s.bannerImages || "[]"),
    appName: s.appName || "TrustPay",
    buyRules: s.buyRules || "", sellRules: s.sellRules || "",
    chunkMin: parseInt(s.chunkMin || "100"),
    chunkMax: parseInt(s.chunkMax || "50000"),
    adminChunkMin: parseInt(s.adminChunkMin || "5000"),
    adminChunkMax: parseInt(s.adminChunkMax || "50000"),
    newUserChunkCap: parseInt(s.newUserChunkCap || "10000"),
    newUserTradeThreshold: parseInt(s.newUserTradeThreshold || "5"),
    buyLockMinutes: parseInt(s.buyLockMinutes || "15"),
    sellerConfirmMinutes: parseInt(s.sellerConfirmMinutes || "15"),
    disputeWindowHours: parseInt(s.disputeWindowHours || "24"),
    highValueThreshold: parseInt(s.highValueThreshold || "5000"),
    highValueCriticalThreshold: parseInt(s.highValueCriticalThreshold || "10000"),
    platformCommissionPerChunk: parseInt(s.platformCommissionPerChunk || "1"),
    feeTiers,
    apkDownloadUrl: s.apkDownloadUrl || "",
    apkVersion: s.apkVersion || "1.0.0",
    forceAppDownload: (s.forceAppDownload ?? "false") === "true",
    broadcastNotification,
  };
}

router.get("/settings", requireAdmin, async (_req, res) => {
  res.json(fSettings(await getAllSettings()));
});

router.put("/settings", requireAdmin, async (req, res): Promise<any> => {
  const b = req.body || {};
  // VALIDATE FIRST, WRITE LATER — never persist a partial update if any
  // section is invalid. Fee tiers are the only field with cross-row
  // constraints (overlap-free, fee < min so buyerAmount stays positive).
  let cleanedTiers: Array<{ min: number; max: number; fee: number }> | null = null;
  if (Array.isArray(b.feeTiers)) {
    cleanedTiers = [];
    for (const t of b.feeTiers) {
      const min = Number(t?.min), max = Number(t?.max), fee = Number(t?.fee);
      if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(fee)) {
        return res.status(400).json({ error: "Each fee tier needs numeric min, max and fee" });
      }
      const cleaned = { min: Math.floor(min), max: Math.floor(max), fee: Math.max(0, Math.floor(fee)) };
      if (cleaned.min < 0 || cleaned.max < cleaned.min) {
        return res.status(400).json({ error: `Invalid fee tier range: ${cleaned.min}-${cleaned.max}` });
      }
      // Guarantee buyerAmount = gross - fee > 0 for every chunk this tier
      // could match — i.e. fee must be strictly less than the smallest
      // gross in the band.
      if (cleaned.fee >= cleaned.min) {
        return res.status(400).json({ error: `Fee ₹${cleaned.fee} must be less than min ₹${cleaned.min} so buyer amount stays positive` });
      }
      cleanedTiers.push(cleaned);
    }
    cleanedTiers.sort((a, b) => a.min - b.min);
    for (let i = 1; i < cleanedTiers.length; i++) {
      if (cleanedTiers[i].min <= cleanedTiers[i - 1].max) {
        return res.status(400).json({ error: `Fee tiers overlap: ${cleanedTiers[i - 1].min}-${cleanedTiers[i - 1].max} and ${cleanedTiers[i].min}-${cleanedTiers[i].max}` });
      }
    }
  }
  const map: Record<string, any> = {
    upiId: b.upiId, upiName: b.upiName,
    popupMessage: b.popupMessage, popupImageUrl: b.popupImageUrl,
    telegramLink: b.telegramLink,
    appName: b.appName, buyRules: b.buyRules, sellRules: b.sellRules,
    chunkMin: b.chunkMin, chunkMax: b.chunkMax,
    adminChunkMin: b.adminChunkMin, adminChunkMax: b.adminChunkMax,
    newUserChunkCap: b.newUserChunkCap, newUserTradeThreshold: b.newUserTradeThreshold,
    buyLockMinutes: b.buyLockMinutes, sellerConfirmMinutes: b.sellerConfirmMinutes,
    disputeWindowHours: b.disputeWindowHours,
    highValueThreshold: b.highValueThreshold, highValueCriticalThreshold: b.highValueCriticalThreshold,
    platformCommissionPerChunk: b.platformCommissionPerChunk,
    apkDownloadUrl: b.apkDownloadUrl, apkVersion: b.apkVersion,
    forceAppDownload: typeof b.forceAppDownload === "boolean" ? String(b.forceAppDownload) : b.forceAppDownload,
  };
  for (const [k, v] of Object.entries(map)) {
    if (v != null) await setSetting(k, String(v));
  }
  if (b.multipleUpiIds != null) await setSetting("multipleUpiIds", JSON.stringify(b.multipleUpiIds));
  if (b.announcements != null) await setSetting("announcements", JSON.stringify(b.announcements));
  if (b.bannerImages != null) await setSetting("bannerImages", JSON.stringify(b.bannerImages));
  if (cleanedTiers) {
    await setSetting("feeTiers", JSON.stringify(cleanedTiers));
  }
  if (b.adminPassword) {
    const hash = await bcrypt.hash(b.adminPassword, 10);
    await setSetting("adminPasswordHash", hash);
  }
  res.json(fSettings(await getAllSettings()));
});

router.get("/stats/daily", requireAdmin, async (_req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayConfirmed = await db.select({ sum: sql<string>`COALESCE(SUM(${ordersTable.amount}), 0)`, count: sql<string>`COUNT(*)` })
    .from(ordersTable).where(and(eq(ordersTable.status, "confirmed"), sql`${ordersTable.createdAt} >= ${today}`));
  const totalUsers = await db.select({ count: sql<string>`COUNT(*)` }).from(usersTable);
  const openDisputes = await db.select({ count: sql<string>`COUNT(*)` }).from(ordersTable).where(eq(ordersTable.status, "disputed"));
  const fraudOpen = await db.select({ count: sql<string>`COUNT(*)` }).from(fraudAlertsTable).where(eq(fraudAlertsTable.resolved, false));
  res.json({
    todayDeposits: parseFloat(String(todayConfirmed[0]?.sum || "0")),
    todayWithdrawals: parseFloat(String(todayConfirmed[0]?.sum || "0")),
    todayDepositCount: parseInt(String(todayConfirmed[0]?.count || "0")),
    todayWithdrawalCount: parseInt(String(todayConfirmed[0]?.count || "0")),
    totalUsers: parseInt(String(totalUsers[0]?.count || "0")),
    pendingOrders: parseInt(String(openDisputes[0]?.count || "0")),
    openDisputes: parseInt(String(openDisputes[0]?.count || "0")),
    openFraudAlerts: parseInt(String(fraudOpen[0]?.count || "0")),
  });
});

router.get("/deposit-tasks", requireAdmin, async (_req, res) => {
  const tasks = await db.select().from(depositTasksTable).orderBy(depositTasksTable.amount);
  res.json(tasks.map((t) => {
    const a = parseFloat(t.amount); const rp = parseFloat(t.rewardPercent);
    const ra = parseFloat((a * rp / 100).toFixed(2));
    return { id: t.id, amount: a, rewardPercent: rp, rewardAmount: ra, totalAmount: a + ra, isActive: t.isActive };
  }));
});

router.post("/deposit-tasks", requireAdmin, async (req, res) => {
  const { amount, rewardPercent, isActive } = req.body || {};
  const [task] = await db.insert(depositTasksTable).values({
    amount: String(amount), rewardPercent: String(rewardPercent), isActive: isActive ?? true,
  }).returning();
  res.json(task);
});

router.put("/deposit-tasks/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { amount, rewardPercent, isActive } = req.body || {};
  await db.update(depositTasksTable).set({
    amount: String(amount), rewardPercent: String(rewardPercent), isActive: isActive ?? true,
  }).where(eq(depositTasksTable.id, id));
  const [task] = await db.select().from(depositTasksTable).where(eq(depositTasksTable.id, id)).limit(1);
  res.json(task);
});

router.delete("/deposit-tasks/:id", requireAdmin, async (req, res) => {
  await db.delete(depositTasksTable).where(eq(depositTasksTable.id, parseInt(req.params.id)));
  res.json({ message: "Deleted" });
});

// High-value tracking — supports tier/reviewed/search/date-range filters.
async function loadHighValue(query: any) {
  const { tier, reviewed, search, from, to } = query as { tier?: string; reviewed?: string; search?: string; from?: string; to?: string };
  const conds: any[] = [];
  if (tier) conds.push(eq(highValueEventsTable.tier, tier));
  if (reviewed === "true") conds.push(sql`${highValueEventsTable.reviewedAt} IS NOT NULL`);
  if (reviewed === "false") conds.push(sql`${highValueEventsTable.reviewedAt} IS NULL`);
  if (from) conds.push(sql`${highValueEventsTable.createdAt} >= ${new Date(from)}`);
  if (to) conds.push(sql`${highValueEventsTable.createdAt} <= ${new Date(to)}`);
  const rows = conds.length > 0
    ? await db.select().from(highValueEventsTable).where(and(...conds)).orderBy(sql`${highValueEventsTable.createdAt} desc`).limit(1000)
    : await db.select().from(highValueEventsTable).orderBy(sql`${highValueEventsTable.createdAt} desc`).limit(1000);
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const users = userIds.length ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds)) : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  let enriched = rows.map((r) => ({
    ...r,
    amount: parseFloat(r.amount),
    user: byId.get(r.userId) ? { id: r.userId, username: byId.get(r.userId)!.username, trustScore: byId.get(r.userId)!.trustScore } : null,
  }));
  if (search) {
    const q = search.toLowerCase();
    enriched = enriched.filter((r) => r.user?.username?.toLowerCase().includes(q) || String(r.orderId).includes(q));
  }
  return enriched;
}

router.get("/high-value", requireAdmin, async (req, res) => {
  res.json(await loadHighValue(req.query));
});

router.get("/high-value/export.csv", requireAdmin, async (req, res) => {
  const rows = await loadHighValue(req.query);
  const header = "id,createdAt,tier,amount,orderId,userId,username,trustScore,reviewedAt,notes";
  const escape = (v: any) => v == null ? "" : `"${String(v).replace(/"/g, '""')}"`;
  const body = rows.map((r) => [
    r.id, new Date(r.createdAt).toISOString(), r.tier, r.amount, r.orderId,
    r.userId, r.user?.username || "", r.user?.trustScore ?? "",
    r.reviewedAt ? new Date(r.reviewedAt).toISOString() : "", r.notes || "",
  ].map(escape).join(","));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="high-value-${Date.now()}.csv"`);
  res.send([header, ...body].join("\n"));
});

router.post("/high-value/:id/review", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { notes } = req.body || {};
  await db.update(highValueEventsTable).set({
    reviewedAt: new Date(),
    reviewedBy: (req as any).user.id,
    notes: notes || null,
  }).where(eq(highValueEventsTable.id, id));
  res.json({ success: true });
});

// Image upload (base64 data URL passthrough with size check, ~5MB)
router.post("/upload-image", requireAdmin, async (req, res) => {
  const { dataUrl, kind } = req.body || {};
  if (!dataUrl || typeof dataUrl !== "string") {
    res.status(400).json({ error: "dataUrl required" });
    return;
  }
  if (!/^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(dataUrl)) {
    res.status(400).json({ error: "Only PNG/JPEG/GIF/WEBP images supported" });
    return;
  }
  const sizeBytes = Math.ceil((dataUrl.length - dataUrl.indexOf(",") - 1) * 3 / 4);
  if (sizeBytes > 5 * 1024 * 1024) {
    res.status(400).json({ error: "Image must be under 5 MB" });
    return;
  }
  res.json({ url: dataUrl, kind: kind || "image", sizeBytes });
});

export default router;
