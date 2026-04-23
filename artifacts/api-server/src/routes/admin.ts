import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, ordersTable, transactionsTable, depositTasksTable, fraudAlertsTable, trustEventsTable, highValueEventsTable, userNotificationsTable, deviceFingerprintsTable, userUpiIdsTable, disputesTable, utrIndexTable, imageHashesTable, referralsTable, adminLogsTable, tradePairBlocksTable, smsLearningQueueTable, smsSafeSendersTable, smsCandidatePatternsTable, smsActivePatternsTable } from "@workspace/db";
import { eq, and, sql, inArray, or, desc, gte, lte } from "drizzle-orm";
import { signToken, requireAdmin, formatUser } from "../lib/auth.js";
import { getSetting, getAllSettings, setSetting } from "../lib/settings.js";
import { listFraudRules, setFraudRuleEnabled } from "../lib/fraud.js";
import { proposePatterns, normalizeSenderKey, buildContextRegex } from "../lib/sms-bridge.js";

function asString(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

async function logAdminAction(adminId: number, actionType: string, targetType?: string, targetId?: number, details?: string) {
  try {
    await db.insert(adminLogsTable).values({ adminId, actionType, targetType, targetId, details });
  } catch {}
}

const router = Router();

async function getCanonicalAdmin() {
  const storedUsername = await getSetting("adminUsername");
  const storedHash = await getSetting("adminPasswordHash");
  const admins = await db.select().from(usersTable).where(eq(usersTable.role, "admin")).orderBy(sql`${usersTable.id} asc`);
  const byUsername = admins.find((u) => u.username === storedUsername);
  return { storedUsername, storedHash, admins, canonical: byUsername || admins[0] || null };
}

async function dedupeAdminUsers(canonicalId: number) {
  const admins = await db.select().from(usersTable).where(eq(usersTable.role, "admin")).orderBy(sql`${usersTable.id} asc`);
  const extras = admins.filter((u) => u.id !== canonicalId);
  for (const admin of extras) {
    await db.update(usersTable).set({ role: "user" }).where(eq(usersTable.id, admin.id));
  }
}

async function ensureSingleAdminUser() {
  const { canonical } = await getCanonicalAdmin();
  if (!canonical) return null;
  await dedupeAdminUsers(canonical.id);
  return canonical;
}

router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) { res.status(400).json({ error: "Username and password required" }); return; }

  const { storedUsername, storedHash, canonical } = await getCanonicalAdmin();

  if (!canonical) {
    res.status(500).json({ error: "Admin account missing" });
    return;
  }

  if (username !== storedUsername) {
    if (username !== canonical.username) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const valid = await bcrypt.compare(password, canonical.passwordHash);
    if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }
    const token = signToken(canonical.id, "admin");
    res.json({ user: formatUser(canonical), token });
    return;
  }

  const valid = await bcrypt.compare(password, storedHash);
  if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }

  if (canonical.username !== storedUsername) {
    await db.update(usersTable).set({ username: storedUsername, passwordHash: storedHash, role: "admin" }).where(eq(usersTable.id, canonical.id));
    canonical.username = storedUsername;
    canonical.passwordHash = storedHash;
  }
  await dedupeAdminUsers(canonical.id);

  const token = signToken(canonical.id, "admin");
  res.json({ user: formatUser(canonical), token });
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
    ocrUtr: o.ocrUtr ?? null,
    ocrAmount: o.ocrAmount ?? null,
    ocrTimestamp: o.ocrTimestamp ?? null,
    ocrBank: o.ocrBank ?? null,
    ocrRawText: o.ocrRawText ?? null,
    ocrStatus: o.ocrStatus ?? null,
    ocrAmountMatch: o.ocrAmountMatch ?? null,
    ocrUtrMatch: o.ocrUtrMatch ?? null,
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

router.get("/agents", requireAdmin, async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // All verified agents (isVerifiedAgent = true)
  const agents = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    displayName: usersTable.displayName,
    phone: usersTable.phone,
    isVerifiedAgent: usersTable.isVerifiedAgent,
    agentTierAwardedDate: usersTable.agentTierAwardedDate,
    agentTierAwardedLevel: usersTable.agentTierAwardedLevel,
    inviteEarnings: usersTable.inviteEarnings,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.isVerifiedAgent, true)).orderBy(sql`${usersTable.createdAt} desc`);

  if (agents.length === 0) { res.json([]); return; }

  const agentIds = agents.map((a) => a.id);

  // Count total invitees per agent
  const inviteeCounts = await db.select({
    referredBy: usersTable.referredBy,
    count: sql<string>`COUNT(*)`,
  }).from(usersTable).where(inArray(usersTable.referredBy, agentIds)).groupBy(usersTable.referredBy);

  const inviteeCountMap = new Map(inviteeCounts.map((r) => [r.referredBy, parseInt(r.count)]));

  // Today's active invitees per agent (invitees who confirmed a buy order today)
  // Step 1: get all invitee ids grouped by referrer
  const allInvitees = await db.select({
    id: usersTable.id,
    referredBy: usersTable.referredBy,
  }).from(usersTable).where(inArray(usersTable.referredBy, agentIds));

  const inviteeIds = allInvitees.map((i) => i.id);

  let todayActiveMap = new Map<number, number>();
  if (inviteeIds.length > 0) {
    const activeToday = await db.select({
      buyerId: ordersTable.lockedByUserId,
    }).from(ordersTable).where(and(
      eq(ordersTable.status, "confirmed"),
      inArray(ordersTable.lockedByUserId, inviteeIds),
      sql`${ordersTable.confirmedAt} >= ${startOfDay}`,
    )).groupBy(ordersTable.lockedByUserId);

    const activeTodayIds = new Set(activeToday.map((r) => r.buyerId));

    // Group active invitees back to their referrers
    for (const inv of allInvitees) {
      if (inv.referredBy && activeTodayIds.has(inv.id)) {
        todayActiveMap.set(inv.referredBy, (todayActiveMap.get(inv.referredBy) || 0) + 1);
      }
    }
  }

  res.json(agents.map((a) => ({
    id: a.id,
    username: a.username,
    displayName: a.displayName,
    phone: a.phone,
    isVerifiedAgent: a.isVerifiedAgent,
    agentTierAwardedDate: a.agentTierAwardedDate,
    agentTierAwardedLevel: a.agentTierAwardedLevel,
    inviteEarnings: parseFloat(a.inviteEarnings || "0"),
    totalInvitees: inviteeCountMap.get(a.id) || 0,
    todayActiveInvitees: todayActiveMap.get(a.id) || 0,
    createdAt: a.createdAt,
  })));
});

router.get("/users", requireAdmin, async (req, res) => {
  const users = await db.select().from(usersTable).orderBy(sql`${usersTable.createdAt} desc`);
  res.json(users.map(formatUser));
});

router.get("/users/:id", requireAdmin, async (req, res) => {
  const id = parseInt(asString(req.params.id));
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.userId, id)).orderBy(sql`${ordersTable.createdAt} desc`).limit(50);
  const trustEvents = await db.select().from(trustEventsTable).where(eq(trustEventsTable.userId, id)).orderBy(sql`${trustEventsTable.createdAt} desc`).limit(30);
  const fraudAlerts = await db.select().from(fraudAlertsTable).where(eq(fraudAlertsTable.userId, id)).orderBy(sql`${fraudAlertsTable.createdAt} desc`).limit(30);
  res.json({ user: formatUser(user), orders: orders.map((o) => fOrder(o)), trustEvents, fraudAlerts });
});

router.post("/users/:id/block", requireAdmin, async (req, res) => {
  const id = parseInt(asString(req.params.id));
  const { reason } = req.body || {};
  await db.update(usersTable).set({
    isBlocked: true, blockedReason: reason || "Blocked by admin", blockedAt: new Date(),
  }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

router.post("/users/:id/unblock", requireAdmin, async (req, res) => {
  const id = parseInt(asString(req.params.id));
  await db.update(usersTable).set({
    isBlocked: false, blockedReason: null, blockedAt: null,
  }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

router.post("/users/:id/freeze", requireAdmin, async (req, res) => {
  const id = parseInt(asString(req.params.id));
  const { reason } = req.body || {};
  const adminId = (req as any).user.id;
  await db.update(usersTable).set({ isFrozen: true, freezeReason: reason || null }).where(eq(usersTable.id, id));
  await logAdminAction(adminId, "freeze_user", "user", id, reason || undefined);
  res.json({ success: true });
});

router.post("/users/:id/unfreeze", requireAdmin, async (req, res) => {
  const id = parseInt(asString(req.params.id));
  const adminId = (req as any).user.id;
  await db.update(usersTable).set({ isFrozen: false, freezeReason: null }).where(eq(usersTable.id, id));
  await logAdminAction(adminId, "unfreeze_user", "user", id);
  res.json({ success: true });
});

// Rename a user (username + optional displayName). Username uniqueness is
// enforced at the DB level — we surface a friendly error on conflict.
router.put("/users/:id", requireAdmin, async (req, res): Promise<any> => {
  const id = parseInt(asString(req.params.id));
  const { username, displayName } = req.body || {};
  const patch: any = {};
  if (typeof username === "string") {
    const u = username.trim();
    if (u.length < 3) return res.status(400).json({ error: "Username must be at least 3 characters" });
    patch.username = u;
  }
  if (typeof displayName === "string") patch.displayName = displayName.trim() || null;
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: "Nothing to update" });
  try {
    await db.update(usersTable).set(patch).where(eq(usersTable.id, id));
  } catch (e: any) {
    if (String(e?.message || "").includes("duplicate")) {
      return res.status(409).json({ error: "Username already taken" });
    }
    return res.status(400).json({ error: e?.message || "Update failed" });
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(formatUser(user));
});

router.put("/users/:id/balance", requireAdmin, async (req, res) => {
  const id = parseInt(asString(req.params.id));
  const adminId = (req as any).user.id;
  const { balance, reason } = req.body || {};
  if (typeof balance !== "number") { res.status(400).json({ error: "balance number required" }); return; }
  await db.update(usersTable).set({ balance: String(balance) }).where(eq(usersTable.id, id));
  if (reason) {
    await db.insert(transactionsTable).values({
      userId: id, type: balance >= 0 ? "credit" : "debit",
      amount: String(Math.abs(balance)), description: reason || "Admin balance update",
    });
  }
  await logAdminAction(adminId, "balance_adjust", "user", id, `Set balance to ₹${balance}${reason ? ` — ${reason}` : ""}`);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  res.json(formatUser(user));
});

router.delete("/users/:id", requireAdmin, async (req, res) => {
  const id = parseInt(asString(req.params.id));
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
    // referrals and transactions from ANY user that reference these orders must
    // be removed before orders can be deleted (FK: orderId -> orders.id).
    await db.delete(referralsTable).where(inArray(referralsTable.orderId, orderIds));
    await db.delete(transactionsTable).where(inArray(transactionsTable.orderId, orderIds));
  } else {
    await db.delete(trustEventsTable).where(eq(trustEventsTable.userId, id));
    await db.delete(disputesTable).where(or(eq(disputesTable.buyerId, id), eq(disputesTable.sellerId, id)));
    await db.delete(fraudAlertsTable).where(eq(fraudAlertsTable.userId, id));
  }

  // Delete records referencing user directly (remaining after order-scoped deletes above)
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
  const id = parseInt(asString(req.params.id));
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
  const id = parseInt(asString(req.params.id));
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
  // Agent reward tiers (parsed for both admin + public app settings consumers).
  let agentTiers: Array<{ minActiveDeposits: number; reward: number; label: string }> = [];
  try {
    const raw = JSON.parse(s.agentTiers || "[]");
    if (Array.isArray(raw)) {
      agentTiers = raw
        .map((t: any) => ({
          minActiveDeposits: Number(t?.minActiveDeposits),
          reward: Number(t?.reward),
          label: String(t?.label || ""),
        }))
        .filter((t) => Number.isFinite(t.minActiveDeposits) && Number.isFinite(t.reward));
    }
  } catch {}
  return {
    upiId: s.upiId || "trustpay@upi",
    upiName: s.upiName || "TrustPay",
    multipleUpiIds, popupMessage: s.popupMessage || "", popupImageUrl: s.popupImageUrl || "",
    announcements, telegramLink: s.telegramLink || "",
    bannerImages: JSON.parse(s.bannerImages || "[]"),
    appName: s.appName || "TrustPay",
    appLogoUrl: s.appLogoUrl || "",
    popupSoundUrl: s.popupSoundUrl || "",
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
    agentTiers,
    apkDownloadUrl: process.env.APK_DOWNLOAD_URL || s.apkDownloadUrl || "",
    apkVersion: s.apkVersion || "1.0.0",
    forceAppDownload: (s.forceAppDownload ?? "false") === "true",
    buyRewardTiers: (() => {
      // Empty string = not yet configured in DB (legacy mode). Return null so the
      // UI can pre-populate default rows based on the legacy buyRewardPercent value.
      if (!s.buyRewardTiers) return null;
      try {
        const raw = JSON.parse(s.buyRewardTiers);
        if (Array.isArray(raw)) {
          return raw.map((t: any) => ({
            min: Number(t?.min),
            max: Number(t?.max),
            reward: Number(t?.reward),
          })).filter((t) => Number.isFinite(t.min) && Number.isFinite(t.max) && Number.isFinite(t.reward));
        }
      } catch {}
      return [];
    })(),
    buyRewardPercent: parseFloat(s.buyRewardPercent || "5"),
    sellRewardPercent: parseFloat(s.sellRewardPercent || "0"),
    deviceRegistrationLimit: parseInt(s.deviceRegistrationLimit || "3"),
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
      if (cleaned.min < 0 || cleaned.max <= cleaned.min) {
        return res.status(400).json({ error: `Invalid fee tier range: min must be strictly less than max (got ${cleaned.min}-${cleaned.max})` });
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
    telegramLink: b.telegramLink, inviteShareImageUrl: b.inviteShareImageUrl,
    appName: b.appName, appLogoUrl: b.appLogoUrl, popupSoundUrl: b.popupSoundUrl,
    buyRules: b.buyRules, sellRules: b.sellRules,
    chunkMin: b.chunkMin, chunkMax: b.chunkMax,
    adminChunkMin: b.adminChunkMin, adminChunkMax: b.adminChunkMax,
    newUserChunkCap: b.newUserChunkCap, newUserTradeThreshold: b.newUserTradeThreshold,
    buyLockMinutes: b.buyLockMinutes, sellerConfirmMinutes: b.sellerConfirmMinutes,
    disputeWindowHours: b.disputeWindowHours,
    sellRewardPercent: b.sellRewardPercent,
    deviceRegistrationLimit: b.deviceRegistrationLimit,
    smsAutoDeleteEnabled: b.smsAutoDeleteEnabled,
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
  if (Array.isArray(b.buyRewardTiers)) {
    const cleanedBuyTiers: Array<{ min: number; max: number; reward: number }> = [];
    for (const t of b.buyRewardTiers) {
      const min = Number(t?.min), max = Number(t?.max), reward = Number(t?.reward);
      if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(reward)) {
        return res.status(400).json({ error: "Each buy reward tier needs numeric min, max and reward" });
      }
      if (min < 0 || max <= min) {
        return res.status(400).json({ error: `Invalid buy reward tier range: min must be strictly less than max (got ${min}-${max})` });
      }
      if (reward < 0) {
        return res.status(400).json({ error: "Buy reward % cannot be negative" });
      }
      cleanedBuyTiers.push({ min: Math.floor(min), max: Math.floor(max), reward: Math.max(0, reward) });
    }
    cleanedBuyTiers.sort((a, b) => a.min - b.min);
    for (let i = 1; i < cleanedBuyTiers.length; i++) {
      if (cleanedBuyTiers[i].min <= cleanedBuyTiers[i - 1].max) {
        return res.status(400).json({ error: `Buy reward tiers overlap: ${cleanedBuyTiers[i - 1].min}-${cleanedBuyTiers[i - 1].max} and ${cleanedBuyTiers[i].min}-${cleanedBuyTiers[i].max}` });
      }
    }
    await setSetting("buyRewardTiers", JSON.stringify(cleanedBuyTiers));
  }
  if (Array.isArray(b.agentTiers)) {
    const cleanedAgent: Array<{ minActiveDeposits: number; reward: number; label: string }> = [];
    for (const t of b.agentTiers) {
      const minActiveDeposits = Math.max(1, Math.floor(Number(t?.minActiveDeposits) || 0));
      const reward = Math.max(0, Number(t?.reward) || 0);
      const label = String(t?.label || "").trim() || `Agent ${minActiveDeposits}`;
      if (!Number.isFinite(minActiveDeposits) || minActiveDeposits <= 0) {
        return res.status(400).json({ error: "Each agent tier needs a positive minActiveDeposits" });
      }
      if (reward < 0) {
        return res.status(400).json({ error: "Agent tier reward cannot be negative" });
      }
      cleanedAgent.push({ minActiveDeposits, reward, label });
    }
    cleanedAgent.sort((a, b) => a.minActiveDeposits - b.minActiveDeposits);
    // Reject duplicate or non-strictly-increasing thresholds so tier
    // semantics stay deterministic (one tier per active-deposit count).
    for (let i = 1; i < cleanedAgent.length; i++) {
      if (cleanedAgent[i].minActiveDeposits <= cleanedAgent[i - 1].minActiveDeposits) {
        return res.status(400).json({ error: `Agent tier thresholds must be strictly increasing (got ${cleanedAgent[i - 1].minActiveDeposits} and ${cleanedAgent[i].minActiveDeposits})` });
      }
    }
    await setSetting("agentTiers", JSON.stringify(cleanedAgent));
  }
  if (b.adminPassword) {
    const hash = await bcrypt.hash(b.adminPassword, 10);
    await setSetting("adminPasswordHash", hash);
  }
  res.json(fSettings(await getAllSettings()));
});

// Platform-fee transactions (per-chunk fees credited to the admin user).
// Returns a flat list ordered by recency along with running totals so the
// admin dashboard can show "lifetime / today / N most-recent fee credits"
// without further aggregation. Pagination is intentionally simple (limit
// only — fees grow slowly).
router.get("/fee-transactions", requireAdmin, async (req, res) => {
  const parsed = parseInt(String(req.query.limit || "100"));
  const limit = Math.min(500, Math.max(1, Number.isFinite(parsed) ? parsed : 100));
  const adminId = (req as any).user?.id as number;
  const rows = await db.select().from(transactionsTable).where(and(
    eq(transactionsTable.userId, adminId),
    eq(transactionsTable.type, "credit"),
    sql`${transactionsTable.description} ILIKE 'Platform fee%'`,
  )).orderBy(sql`${transactionsTable.createdAt} desc`).limit(limit);

  const totals = await db.select({
    sum: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)`,
    count: sql<string>`COUNT(*)`,
  }).from(transactionsTable).where(and(
    eq(transactionsTable.userId, adminId),
    eq(transactionsTable.type, "credit"),
    sql`${transactionsTable.description} ILIKE 'Platform fee%'`,
  ));

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayTotals = await db.select({
    sum: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)`,
    count: sql<string>`COUNT(*)`,
  }).from(transactionsTable).where(and(
    eq(transactionsTable.userId, adminId),
    eq(transactionsTable.type, "credit"),
    sql`${transactionsTable.description} ILIKE 'Platform fee%'`,
    sql`${transactionsTable.createdAt} >= ${today}`,
  ));

  res.json({
    totalAmount: parseFloat(totals[0]?.sum || "0"),
    totalCount: parseInt(totals[0]?.count || "0"),
    todayAmount: parseFloat(todayTotals[0]?.sum || "0"),
    todayCount: parseInt(todayTotals[0]?.count || "0"),
    items: rows.map((r) => ({
      id: r.id,
      amount: parseFloat(r.amount),
      description: r.description,
      orderId: r.orderId,
      createdAt: r.createdAt,
    })),
  });
});

// Agent-reward transactions credited to admin from the agent tier system.
router.get("/agent-transactions", requireAdmin, async (req, res) => {
  const parsed = parseInt(String(req.query.limit || "100"));
  const limit = Math.min(500, Math.max(1, Number.isFinite(parsed) ? parsed : 100));
  const adminId = (req as any).user?.id as number;

  const rows = await db.select().from(transactionsTable).where(and(
    eq(transactionsTable.userId, adminId),
    eq(transactionsTable.type, "credit"),
    sql`${transactionsTable.description} ILIKE 'Agent Reward%'`,
  )).orderBy(sql`${transactionsTable.createdAt} desc`).limit(limit);

  const totals = await db.select({
    sum: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)`,
    count: sql<string>`COUNT(*)`,
  }).from(transactionsTable).where(and(
    eq(transactionsTable.userId, adminId),
    eq(transactionsTable.type, "credit"),
    sql`${transactionsTable.description} ILIKE 'Agent Reward%'`,
  ));

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayTotals = await db.select({
    sum: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)`,
    count: sql<string>`COUNT(*)`,
  }).from(transactionsTable).where(and(
    eq(transactionsTable.userId, adminId),
    eq(transactionsTable.type, "credit"),
    sql`${transactionsTable.description} ILIKE 'Agent Reward%'`,
    sql`${transactionsTable.createdAt} >= ${today}`,
  ));

  res.json({
    totalAmount: parseFloat(totals[0]?.sum || "0"),
    totalCount: parseInt(totals[0]?.count || "0"),
    todayAmount: parseFloat(todayTotals[0]?.sum || "0"),
    todayCount: parseInt(todayTotals[0]?.count || "0"),
    items: rows.map((r) => ({
      id: r.id,
      amount: parseFloat(r.amount),
      description: r.description,
      createdAt: r.createdAt,
    })),
  });
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
  const id = parseInt(asString(req.params.id));
  const { amount, rewardPercent, isActive } = req.body || {};
  await db.update(depositTasksTable).set({
    amount: String(amount), rewardPercent: String(rewardPercent), isActive: isActive ?? true,
  }).where(eq(depositTasksTable.id, id));
  const [task] = await db.select().from(depositTasksTable).where(eq(depositTasksTable.id, id)).limit(1);
  res.json(task);
});

router.delete("/deposit-tasks/:id", requireAdmin, async (req, res) => {
  await db.delete(depositTasksTable).where(eq(depositTasksTable.id, parseInt(asString(req.params.id))));
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
  const id = parseInt(asString(req.params.id));
  const { notes } = req.body || {};
  await db.update(highValueEventsTable).set({
    reviewedAt: new Date(),
    reviewedBy: (req as any).user.id,
    notes: notes || null,
  }).where(eq(highValueEventsTable.id, id));
  res.json({ success: true });
});

// ── 1. Force-close stuck order ──────────────────────────────────────────────
router.post("/orders/:id/force-close", requireAdmin, async (req, res) => {
  const id = parseInt(asString(req.params.id));
  const adminId = (req as any).user.id;
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (!["locked", "pending_confirmation"].includes(order.status)) {
    res.status(400).json({ error: `Order status '${order.status}' cannot be force-closed. Only 'locked' or 'pending_confirmation' orders can be closed.` }); return;
  }
  const { releaseHold } = await import("../lib/hold.js");
  await db.transaction(async (tx) => {
    const heldAmt = parseFloat(order.heldAmount || "0");
    await releaseHold(order.userId, heldAmt, tx);
    await tx.update(ordersTable).set({
      status: "cancelled", lockedAt: null, lockedByUserId: null, confirmDeadline: null, updatedAt: new Date(),
    }).where(eq(ordersTable.id, id));
  });
  await logAdminAction(adminId, "force_close_order", "order", id, `Closed order #${id} from status '${order.status}'`);
  res.json({ success: true });
});

// ── 2. Trade pair blocks ─────────────────────────────────────────────────────
router.get("/trade-pair-blocks", requireAdmin, async (_req, res) => {
  const blocks = await db.select().from(tradePairBlocksTable).orderBy(desc(tradePairBlocksTable.createdAt));
  const userIds = [...new Set(blocks.flatMap((b) => [b.userId1, b.userId2]))];
  const users = userIds.length ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds)) : [];
  const byId = new Map(users.map((u) => [u.id, { id: u.id, username: u.username }]));
  res.json(blocks.map((b) => ({ ...b, user1: byId.get(b.userId1), user2: byId.get(b.userId2) })));
});

router.post("/trade-pair-blocks", requireAdmin, async (req, res) => {
  const adminId = (req as any).user.id;
  const { userId1, userId2, reason } = req.body || {};
  if (!userId1 || !userId2) { res.status(400).json({ error: "userId1 and userId2 required" }); return; }
  if (userId1 === userId2) { res.status(400).json({ error: "Cannot block a user with themselves" }); return; }
  const [block] = await db.insert(tradePairBlocksTable).values({ userId1, userId2, reason: reason || null }).returning();
  await logAdminAction(adminId, "trade_pair_block", "user", userId1, `Blocked pair ${userId1}↔${userId2}: ${reason || "no reason"}`);
  res.json(block);
});

router.delete("/trade-pair-blocks/:id", requireAdmin, async (req, res) => {
  const adminId = (req as any).user.id;
  const id = parseInt(asString(req.params.id));
  const [block] = await db.select().from(tradePairBlocksTable).where(eq(tradePairBlocksTable.id, id)).limit(1);
  if (!block) { res.status(404).json({ error: "Block not found" }); return; }
  await db.delete(tradePairBlocksTable).where(eq(tradePairBlocksTable.id, id));
  await logAdminAction(adminId, "trade_pair_unblock", "user", block.userId1, `Unblocked pair ${block.userId1}↔${block.userId2}`);
  res.json({ success: true });
});

// ── 3. Matching engine pause ─────────────────────────────────────────────────
router.get("/matching/status", requireAdmin, async (_req, res) => {
  const paused = (await getSetting("matchingPaused")) === "true";
  res.json({ paused });
});

router.post("/matching/pause", requireAdmin, async (req, res) => {
  const adminId = (req as any).user.id;
  const { paused } = req.body || {};
  if (typeof paused !== "boolean") { res.status(400).json({ error: "paused boolean required" }); return; }
  await setSetting("matchingPaused", paused ? "true" : "false");
  await logAdminAction(adminId, paused ? "matching_paused" : "matching_resumed", undefined, undefined, `Matching engine ${paused ? "paused" : "resumed"}`);
  res.json({ paused });
});

// ── 4. Bulk fraud alert resolve ──────────────────────────────────────────────
router.post("/users/:id/resolve-all-alerts", requireAdmin, async (req, res) => {
  const id = parseInt(asString(req.params.id));
  const adminId = (req as any).user.id;
  const result = await db.update(fraudAlertsTable).set({ resolved: true })
    .where(and(eq(fraudAlertsTable.userId, id), eq(fraudAlertsTable.resolved, false)));
  await db.update(usersTable).set({ isFrozen: false }).where(eq(usersTable.id, id));
  await logAdminAction(adminId, "bulk_resolve_alerts", "user", id, `Resolved all open alerts and unfroze user`);
  res.json({ success: true });
});

// ── 5. Trusted user (false positive protection) ──────────────────────────────
router.post("/users/:id/trust", requireAdmin, async (req, res) => {
  const id = parseInt(asString(req.params.id));
  const adminId = (req as any).user.id;
  const { isTrusted } = req.body || {};
  if (typeof isTrusted !== "boolean") { res.status(400).json({ error: "isTrusted boolean required" }); return; }
  await db.update(usersTable).set({ isTrusted }).where(eq(usersTable.id, id));
  await logAdminAction(adminId, isTrusted ? "mark_trusted" : "unmark_trusted", "user", id, `isTrusted set to ${isTrusted}`);
  res.json({ success: true });
});

// ── 6. Fraud warning count reset ─────────────────────────────────────────────
router.post("/users/:id/reset-fraud-warnings", requireAdmin, async (req, res) => {
  const id = parseInt(asString(req.params.id));
  const adminId = (req as any).user.id;
  await db.update(usersTable).set({ fraudWarningCount: 0 }).where(eq(usersTable.id, id));
  await logAdminAction(adminId, "reset_fraud_warnings", "user", id, `fraudWarningCount reset to 0`);
  res.json({ success: true });
});

// ── 7. Transaction reversal ──────────────────────────────────────────────────
router.post("/orders/:id/reverse", requireAdmin, async (req, res): Promise<any> => {
  const id = parseInt(asString(req.params.id));
  const adminId = (req as any).user.id;
  const { reason } = req.body || {};
  if (!reason) { return res.status(400).json({ error: "reason is required for reversal" }); }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { return res.status(404).json({ error: "Order not found" }); }
  if (order.status !== "confirmed") { return res.status(400).json({ error: "Only confirmed orders can be reversed" }); }
  if (!order.lockedByUserId) { return res.status(400).json({ error: "No buyer on this order" }); }
  const amount = parseFloat(order.amount);
  await db.transaction(async (tx) => {
    await tx.update(usersTable).set({ balance: sql`${usersTable.balance} - ${String(amount)}` }).where(eq(usersTable.id, order.lockedByUserId!));
    await tx.update(usersTable).set({ balance: sql`${usersTable.balance} + ${String(amount)}` }).where(eq(usersTable.id, order.userId));
    await tx.insert(transactionsTable).values([
      { userId: order.lockedByUserId!, type: "debit", amount: String(amount), description: `Reversal of order #${id}: ${reason}`, orderId: id },
      { userId: order.userId, type: "credit", amount: String(amount), description: `Reversal credit for order #${id}: ${reason}`, orderId: id },
    ]);
    await tx.update(ordersTable).set({ status: "cancelled", updatedAt: new Date() }).where(eq(ordersTable.id, id));
  });
  await logAdminAction(adminId, "transaction_reversal", "order", id, `Reversed ₹${amount} — reason: ${reason}`);
  res.json({ success: true });
});

// ── 9. Daily settlement report ───────────────────────────────────────────────
router.get("/reports/daily", requireAdmin, async (req, res) => {
  const dateStr = String(req.query.date || new Date().toISOString().slice(0, 10));
  const dayStart = new Date(dateStr + "T00:00:00.000Z");
  const dayEnd = new Date(dateStr + "T23:59:59.999Z");

  const deposits = await db.select({
    sum: sql<string>`COALESCE(SUM(${ordersTable.amount}), 0)`,
    count: sql<string>`COUNT(*)`,
  }).from(ordersTable).where(and(
    eq(ordersTable.type, "deposit"), eq(ordersTable.status, "confirmed"),
    gte(ordersTable.createdAt, dayStart), lte(ordersTable.createdAt, dayEnd),
  ));

  const withdrawals = await db.select({
    sum: sql<string>`COALESCE(SUM(${ordersTable.amount}), 0)`,
    count: sql<string>`COUNT(*)`,
  }).from(ordersTable).where(and(
    eq(ordersTable.type, "withdrawal"), eq(ordersTable.status, "confirmed"),
    gte(ordersTable.createdAt, dayStart), lte(ordersTable.createdAt, dayEnd),
  ));

  const fees = await db.select({
    sum: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)`,
    count: sql<string>`COUNT(*)`,
  }).from(transactionsTable).where(and(
    eq(transactionsTable.type, "credit"),
    sql`${transactionsTable.description} ILIKE 'Platform fee%'`,
    gte(transactionsTable.createdAt, dayStart), lte(transactionsTable.createdAt, dayEnd),
  ));

  const rewards = await db.select({
    sum: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)`,
    count: sql<string>`COUNT(*)`,
  }).from(transactionsTable).where(and(
    eq(transactionsTable.type, "credit"),
    sql`${transactionsTable.description} ILIKE '%reward%'`,
    gte(transactionsTable.createdAt, dayStart), lte(transactionsTable.createdAt, dayEnd),
  ));

  const disputes = await db.select({ count: sql<string>`COUNT(*)` })
    .from(disputesTable).where(and(gte(disputesTable.createdAt, dayStart), lte(disputesTable.createdAt, dayEnd)));

  res.json({
    date: dateStr,
    totalDeposits: parseFloat(deposits[0]?.sum || "0"),
    depositCount: parseInt(deposits[0]?.count || "0"),
    totalWithdrawals: parseFloat(withdrawals[0]?.sum || "0"),
    withdrawalCount: parseInt(withdrawals[0]?.count || "0"),
    feesCollected: parseFloat(fees[0]?.sum || "0"),
    feeCount: parseInt(fees[0]?.count || "0"),
    rewardsPaid: parseFloat(rewards[0]?.sum || "0"),
    rewardCount: parseInt(rewards[0]?.count || "0"),
    disputeCount: parseInt(disputes[0]?.count || "0"),
  });
});

router.get("/reports/daily/export.csv", requireAdmin, async (req, res) => {
  const dateStr = String(req.query.date || new Date().toISOString().slice(0, 10));
  const dayStart = new Date(dateStr + "T00:00:00.000Z");
  const dayEnd = new Date(dateStr + "T23:59:59.999Z");
  const rows = await db.select().from(ordersTable).where(and(
    eq(ordersTable.status, "confirmed"),
    gte(ordersTable.createdAt, dayStart), lte(ordersTable.createdAt, dayEnd),
  )).orderBy(desc(ordersTable.createdAt));
  const escape = (v: any) => v == null ? "" : `"${String(v).replace(/"/g, '""')}"`;
  const header = "id,type,amount,userId,lockedByUserId,upiId,utrNumber,createdAt";
  const body = rows.map((r) => [r.id, r.type, r.amount, r.userId, r.lockedByUserId, r.upiId, r.utrNumber, new Date(r.createdAt).toISOString()].map(escape).join(","));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="settlement-${dateStr}.csv"`);
  res.send([header, ...body].join("\n"));
});

// ── 10. Admin action log ─────────────────────────────────────────────────────
router.get("/action-logs", requireAdmin, async (req, res) => {
  const { adminId: adminIdQ, actionType, from, to, limit: limitQ } = req.query as any;
  const conds: any[] = [];
  if (adminIdQ) conds.push(eq(adminLogsTable.adminId, parseInt(adminIdQ)));
  if (actionType) conds.push(eq(adminLogsTable.actionType, actionType));
  if (from) conds.push(gte(adminLogsTable.createdAt, new Date(from)));
  if (to) conds.push(lte(adminLogsTable.createdAt, new Date(to)));
  const limitN = Math.min(500, Math.max(1, parseInt(limitQ || "100") || 100));
  const rows = conds.length
    ? await db.select().from(adminLogsTable).where(and(...conds)).orderBy(desc(adminLogsTable.createdAt)).limit(limitN)
    : await db.select().from(adminLogsTable).orderBy(desc(adminLogsTable.createdAt)).limit(limitN);
  const adminIds = [...new Set(rows.map((r) => r.adminId))];
  const admins = adminIds.length ? await db.select().from(usersTable).where(inArray(usersTable.id, adminIds)) : [];
  const byId = new Map(admins.map((u) => [u.id, u.username]));
  res.json(rows.map((r) => ({ ...r, adminUsername: byId.get(r.adminId) || `#${r.adminId}` })));
});

// ── 11. Dispute deadline extend ───────────────────────────────────────────────
router.post("/disputes/:id/extend-deadline", requireAdmin, async (req, res) => {
  const id = parseInt(asString(req.params.id));
  const adminId = (req as any).user.id;
  const { hours = 24 } = req.body || {};
  const [dispute] = await db.select().from(disputesTable).where(eq(disputesTable.id, id)).limit(1);
  if (!dispute) { res.status(404).json({ error: "Dispute not found" }); return; }
  if (dispute.status !== "open") { res.status(400).json({ error: "Only open disputes can be extended" }); return; }
  const ms = Number(hours) * 60 * 60 * 1000;
  const newBuyerDeadline = dispute.buyerProofDeadline
    ? new Date(new Date(dispute.buyerProofDeadline).getTime() + ms)
    : new Date(Date.now() + ms);
  const newSellerDeadline = dispute.sellerProofDeadline
    ? new Date(new Date(dispute.sellerProofDeadline).getTime() + ms)
    : new Date(Date.now() + ms);
  await db.update(disputesTable).set({
    buyerProofDeadline: newBuyerDeadline, sellerProofDeadline: newSellerDeadline,
  }).where(eq(disputesTable.id, id));
  await logAdminAction(adminId, "extend_dispute_deadline", "dispute", id, `Extended by ${hours}h`);
  res.json({ success: true, buyerProofDeadline: newBuyerDeadline, sellerProofDeadline: newSellerDeadline });
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

// ── SMS Safe Learning ────────────────────────────────────────────────────────

router.get("/sms-learning/queue", requireAdmin, async (req, res) => {
  const { bucket, status = "pending", limit: lim } = req.query as Record<string, string>;
  const limitNum = Math.min(200, Math.max(1, parseInt(lim || "100") || 100));
  let q = db.select().from(smsLearningQueueTable).$dynamic();
  const conds: any[] = [];
  if (bucket) conds.push(eq(smsLearningQueueTable.bucket, bucket));
  if (status) conds.push(eq(smsLearningQueueTable.status, status));
  if (conds.length > 0) q = q.where(and(...conds)) as typeof q;
  const rows = await q.orderBy(desc(smsLearningQueueTable.createdAt)).limit(limitNum);
  res.json(rows.map((r) => ({
    id: r.id, sender: r.sender, senderKey: r.senderKey, body: r.body,
    bucket: r.bucket, parsedUtr: r.parsedUtr, parsedAmount: r.parsedAmount,
    isDebit: r.isDebit, hasReversal: r.hasReversal,
    templateBody: r.templateBody, templateHash: r.templateHash,
    userId: r.userId, status: r.status, reason: r.reason, createdAt: r.createdAt,
  })));
});

router.post("/sms-learning/queue/:id/dismiss", requireAdmin, async (req, res) => {
  const adminId = (req as any).user.id;
  const id = parseInt(asString(req.params.id));
  await db.update(smsLearningQueueTable).set({ status: "dismissed" })
    .where(eq(smsLearningQueueTable.id, id));
  await logAdminAction(adminId, "sms_queue_dismiss", "sms_queue", id, `Dismissed queue item ${id}`);
  res.json({ ok: true });
});

router.post("/sms-learning/queue/:id/approve-pattern", requireAdmin, async (req, res) => {
  const adminId = (req as any).user.id;
  const id = parseInt(asString(req.params.id));

  const [item] = await db.select().from(smsLearningQueueTable)
    .where(eq(smsLearningQueueTable.id, id)).limit(1);
  if (!item) return res.status(404).json({ error: "Queue item not found" });

  const senderKey = item.senderKey.toUpperCase();

  const safeExists = await db.select().from(smsSafeSendersTable)
    .where(eq(smsSafeSendersTable.senderKey, senderKey)).limit(1);
  if (safeExists.length === 0) {
    await db.insert(smsSafeSendersTable).values({
      senderKey,
      label: `Admin-approved: ${item.sender}`,
      addedBy: adminId,
    });
  }

  const { utrRegex, amountRegex } = buildContextRegex(item.templateBody || "");
  await db.insert(smsActivePatternsTable).values({
    senderKey,
    templateLabel: (item.templateBody || item.body).slice(0, 100),
    utrRegex,
    amountRegex,
    creditOnly: true,
    reversalBlocked: true,
    sourceCandidateId: null,
    createdBy: adminId,
    isActive: true,
  });

  await db.update(smsLearningQueueTable).set({ status: "approved" })
    .where(eq(smsLearningQueueTable.id, id));

  await logAdminAction(adminId, "sms_queue_approve_pattern", "sms_queue", id,
    `Approved pattern from queue item ${id} sender=${senderKey}`);
  res.json({ ok: true });
});

router.get("/sms-learning/candidates", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(smsCandidatePatternsTable)
    .orderBy(desc(smsCandidatePatternsTable.createdAt));
  res.json(rows.map((r) => ({
    id: r.id, senderKey: r.senderKey, templateHash: r.templateHash,
    templateBody: r.templateBody, utrSample: r.utrSample, amountSample: r.amountSample,
    sampleCount: r.sampleCount, status: r.status,
    reviewedBy: r.reviewedBy, reviewedAt: r.reviewedAt, notes: r.notes,
    createdAt: r.createdAt,
  })));
});

router.post("/sms-learning/propose", requireAdmin, async (req, res) => {
  const adminId = (req as any).user.id;
  const result = await proposePatterns();
  await logAdminAction(adminId, "sms_propose_patterns", undefined, undefined,
    `Proposed ${result.proposed} patterns, skipped ${result.skipped}`);
  res.json(result);
});

router.post("/sms-learning/candidates/:id/approve", requireAdmin, async (req, res) => {
  const adminId = (req as any).user.id;
  const id = parseInt(asString(req.params.id));
  const { notes } = req.body || {};
  const [candidate] = await db.select().from(smsCandidatePatternsTable)
    .where(eq(smsCandidatePatternsTable.id, id)).limit(1);
  if (!candidate) return res.status(404).json({ error: "Candidate not found" });
  if (candidate.status !== "proposed") return res.status(400).json({ error: "Already reviewed" });

  await db.update(smsCandidatePatternsTable).set({
    status: "approved", reviewedBy: adminId,
    reviewedAt: new Date(), notes: notes || null,
  }).where(eq(smsCandidatePatternsTable.id, id));

  const senderKey = candidate.senderKey.toUpperCase();

  const existing = await db.select().from(smsSafeSendersTable)
    .where(eq(smsSafeSendersTable.senderKey, senderKey)).limit(1);
  if (existing.length === 0) {
    await db.insert(smsSafeSendersTable).values({
      senderKey, label: `Auto: ${candidate.templateBody.slice(0, 40)}`,
      addedBy: adminId,
    });
  }

  const existingActive = await db.select().from(smsActivePatternsTable)
    .where(eq(smsActivePatternsTable.sourceCandidateId, id)).limit(1);
  if (existingActive.length === 0) {
    const { utrRegex, amountRegex } = buildContextRegex(candidate.templateBody || "");
    await db.insert(smsActivePatternsTable).values({
      senderKey,
      templateLabel: candidate.templateBody.slice(0, 100),
      utrRegex,
      amountRegex,
      creditOnly: true,
      reversalBlocked: true,
      sourceCandidateId: id,
      createdBy: adminId,
      isActive: true,
    });
  }

  await logAdminAction(adminId, "sms_candidate_approve", "sms_candidate", id,
    `Approved candidate ${id} sender=${candidate.senderKey} — safe sender + active pattern created`);
  res.json({ ok: true });
});

router.post("/sms-learning/candidates/:id/reject", requireAdmin, async (req, res) => {
  const adminId = (req as any).user.id;
  const id = parseInt(asString(req.params.id));
  const { notes } = req.body || {};
  const [candidate] = await db.select().from(smsCandidatePatternsTable)
    .where(eq(smsCandidatePatternsTable.id, id)).limit(1);
  if (!candidate) return res.status(404).json({ error: "Candidate not found" });
  if (candidate.status !== "proposed") return res.status(400).json({ error: "Already reviewed" });

  await db.update(smsCandidatePatternsTable).set({
    status: "rejected", reviewedBy: adminId,
    reviewedAt: new Date(), notes: notes || null,
  }).where(eq(smsCandidatePatternsTable.id, id));

  await logAdminAction(adminId, "sms_candidate_reject", "sms_candidate", id,
    `Rejected candidate ${id} sender=${candidate.senderKey}`);
  res.json({ ok: true });
});

router.get("/sms-learning/safe-senders", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(smsSafeSendersTable)
    .orderBy(desc(smsSafeSendersTable.createdAt));
  const adminIds = [...new Set(rows.map((r) => r.addedBy))];
  const admins = adminIds.length
    ? await db.select().from(usersTable).where(inArray(usersTable.id, adminIds))
    : [];
  const byId = new Map(admins.map((a) => [a.id, a.username]));
  res.json(rows.map((r) => ({
    id: r.id, senderKey: r.senderKey, label: r.label,
    addedBy: r.addedBy, addedByUsername: byId.get(r.addedBy) || "admin",
    createdAt: r.createdAt,
  })));
});

router.post("/sms-learning/safe-senders", requireAdmin, async (req, res) => {
  const adminId = (req as any).user.id;
  const { senderKey, label } = req.body || {};
  if (!senderKey || typeof senderKey !== "string") {
    return res.status(400).json({ error: "senderKey required" });
  }
  const key = normalizeSenderKey(senderKey);
  const existing = await db.select().from(smsSafeSendersTable)
    .where(eq(smsSafeSendersTable.senderKey, key)).limit(1);
  if (existing.length > 0) {
    return res.status(409).json({ error: "Sender already in safe list" });
  }
  const [row] = await db.insert(smsSafeSendersTable).values({
    senderKey: key, label: label || null, addedBy: adminId,
  }).returning();
  await logAdminAction(adminId, "sms_safe_sender_add", undefined, undefined,
    `Added safe sender ${key}`);
  res.json(row);
});

router.delete("/sms-learning/safe-senders/:id", requireAdmin, async (req, res) => {
  const adminId = (req as any).user.id;
  const id = parseInt(asString(req.params.id));
  const [row] = await db.select().from(smsSafeSendersTable)
    .where(eq(smsSafeSendersTable.id, id)).limit(1);
  if (!row) return res.status(404).json({ error: "Not found" });
  await db.delete(smsSafeSendersTable).where(eq(smsSafeSendersTable.id, id));
  await logAdminAction(adminId, "sms_safe_sender_remove", undefined, undefined,
    `Removed safe sender ${row.senderKey}`);
  res.json({ ok: true });
});

router.post("/sms-learning/queue/:id/safe-sender", requireAdmin, async (req, res) => {
  const adminId = (req as any).user.id;
  const id = parseInt(asString(req.params.id));
  const { label } = req.body || {};
  const [item] = await db.select().from(smsLearningQueueTable)
    .where(eq(smsLearningQueueTable.id, id)).limit(1);
  if (!item) return res.status(404).json({ error: "Queue item not found" });

  const key = item.senderKey.toUpperCase();
  const existing = await db.select().from(smsSafeSendersTable)
    .where(eq(smsSafeSendersTable.senderKey, key)).limit(1);
  if (existing.length === 0) {
    await db.insert(smsSafeSendersTable).values({
      senderKey: key, label: label || item.sender, addedBy: adminId,
    });
  }
  await db.update(smsLearningQueueTable).set({ status: "dismissed" })
    .where(eq(smsLearningQueueTable.senderKey, key));
  await logAdminAction(adminId, "sms_safe_sender_from_queue", "sms_queue", id,
    `Marked ${key} as safe sender from queue item ${id}`);
  res.json({ ok: true });
});

export default router;
