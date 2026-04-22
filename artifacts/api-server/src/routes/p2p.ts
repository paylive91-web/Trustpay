import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, usersTable, disputesTable } from "@workspace/db";
import { eq, and, sql, inArray, ne, or } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { getSettings } from "../lib/settings.js";
import { releaseExpiredLocks, autoConfirmExpired, regenerateChunksForUser } from "../lib/matching.js";
import { settleConfirmedTrade } from "../lib/settle.js";
import { applyTrustDelta } from "../lib/trust.js";
import {
  checkUtrFraud, checkImageHash, checkVelocity, checkCancelRate,
  checkRapidLockRelease, checkBalanceDrain,
} from "../lib/fraud.js";

const router = Router();

function parseMultipleUpiIds(raw: string | undefined) {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((u: any) => ({
        upiId: String(u?.upiId || "").trim(),
        upiName: String(u?.upiName || "").trim(),
        qrImageUrl: String(u?.qrImageUrl || "").trim(),
      }))
      .filter((u) => u.upiId);
  } catch {
    return [];
  }
}

function rewardForAmount(amount: number) {
  // Tiered buyer reward: smaller chunks get a higher % to make them attractive
  // even though the absolute payout is small. Mirrors the computation used
  // when enriching the public queue.
  const rp = amount >= 2001 ? 3 : amount >= 1001 ? 4 : 5;
  const ra = parseFloat((amount * rp / 100).toFixed(2));
  return { rewardPercent: rp, rewardAmount: ra };
}

function asString(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v || "";
}

function f(o: any, sellerInfo?: any) {
  const amount = parseFloat(o.amount);
  // Always compute reward dynamically: stored rewardAmount on chunk rows is
  // 0 because matching.ts doesn't know which buyer will lock. Computing
  // here guarantees the buyer's payment page never shows ₹0 reward.
  const { rewardPercent, rewardAmount } = rewardForAmount(amount);
  return {
    id: o.id,
    sellerId: o.userId,
    amount,
    rewardPercent,
    rewardAmount,
    totalAmount: parseFloat((amount + rewardAmount).toFixed(2)),
    status: o.status,
    upiId: o.userUpiId,
    upiName: o.userUpiName,
    holderName: o.userName,
    lockedAt: o.lockedAt,
    lockedByUserId: o.lockedByUserId,
    confirmDeadline: o.confirmDeadline,
    submittedAt: o.submittedAt,
    utrNumber: o.utrNumber,
    screenshotUrl: o.screenshotUrl,
    recordingUrl: o.recordingUrl,
    createdAt: o.createdAt,
    seller: sellerInfo ? {
      id: sellerInfo.id,
      username: sellerInfo.username,
      trustScore: sellerInfo.trustScore,
      lastSeenAt: sellerInfo.lastSeenAt,
    } : undefined,
  };
}

async function getActiveBuy(userId: number) {
  const [r] = await db.select().from(ordersTable).where(and(
    eq(ordersTable.lockedByUserId, userId),
    inArray(ordersTable.status, ["locked", "pending_confirmation", "disputed"]),
  )).limit(1);
  return r || null;
}

// User has any open dispute (buyer or seller side)?
async function hasOpenDispute(userId: number): Promise<boolean> {
  const [d] = await db.select().from(disputesTable).where(and(
    or(eq(disputesTable.buyerId, userId), eq(disputesTable.sellerId, userId)),
    eq(disputesTable.status, "open"),
  )).limit(1);
  return !!d;
}

router.get("/queue", requireAuth, async (req, res) => {
  const u = (req as any).user;
  await releaseExpiredLocks();
  await autoConfirmExpired();
  const chunks = await db.select().from(ordersTable).where(and(
    eq(ordersTable.type, "withdrawal"),
    eq(ordersTable.status, "available"),
    ne(ordersTable.userId, u.id),
  )).orderBy(ordersTable.createdAt).limit(50);
  // Fetch seller info for online-presence indicator
  const sellerIds = [...new Set(chunks.map((c) => c.userId))];
  const sellers = sellerIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, sellerIds))
    : [];
  const sellerMap = new Map(sellers.map((s) => [s.id, s]));
  // Separate online vs offline chunks — cancel offline sellers' chunks immediately
  const offlineChunkIds: number[] = [];
  const enriched = chunks.map((c) => {
    const seller = sellerMap.get(c.userId);
    const isOffline = !seller?.lastSeenAt || Date.now() - new Date(seller.lastSeenAt).getTime() > 2 * 60 * 1000;
    const matchingExpired = !seller?.matchingExpiresAt || new Date(seller.matchingExpiresAt).getTime() < Date.now();
    if (isOffline || matchingExpired) {
      offlineChunkIds.push(c.id);
      return null;
    }
    const a = parseFloat(c.amount);
    const rp = a >= 2001 ? 3 : a >= 1001 ? 4 : 5;
    const ra = parseFloat((a * rp / 100).toFixed(2));
    return { ...f(c, seller), rewardPercent: rp, rewardAmount: ra, totalAmount: parseFloat((a + ra).toFixed(2)) };
  }).filter(Boolean);

  // Cancel offline seller chunks so they're gone from DB, not just hidden
  if (offlineChunkIds.length > 0) {
    await db.update(ordersTable).set({ status: "cancelled", updatedAt: new Date() })
      .where(and(
        inArray(ordersTable.id, offlineChunkIds),
        eq(ordersTable.status, "available"),
      ));
  }

  res.json(enriched);
});

router.get("/my-buy", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const r = await getActiveBuy(u.id);
  if (!r) { res.json(null); return; }
  const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, r.userId)).limit(1);
  res.json(f(r, seller));
});

router.post("/lock/:id", requireAuth, async (req, res) => {
  const u = (req as any).user;
  if (u.isFrozen) { res.status(403).json({ error: "Account frozen due to low trust score" }); return; }
  if (u.isBlocked) { res.status(403).json({ error: "Account blocked" }); return; }
  if (await hasOpenDispute(u.id)) {
    res.status(403).json({ error: "Account paused — you have an open dispute. Resolve it before starting a new buy." });
    return;
  }
  const id = parseInt(asString(req.params.id));

  const existing = await getActiveBuy(u.id);
  if (existing) {
    res.status(400).json({ error: "You already have an active buy. Complete it first." });
    return;
  }

  const settings = await getSettings(["buyLockMinutes", "multipleUpiIds"]);
  const lockMin = parseInt(settings.buyLockMinutes) || 15;
  const activeUpis = parseMultipleUpiIds(settings.multipleUpiIds);

  const [chunk] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!chunk || chunk.status !== "available" || chunk.type !== "withdrawal") {
    res.status(400).json({ error: "Chunk no longer available" });
    return;
  }
  if (chunk.userId === u.id) {
    res.status(400).json({ error: "Cannot buy your own chunk" });
    return;
  }
  // Seller must be online — reject lock if seller went offline
  const [sellerNow] = await db.select({ lastSeenAt: usersTable.lastSeenAt, matchingExpiresAt: usersTable.matchingExpiresAt })
    .from(usersTable).where(eq(usersTable.id, chunk.userId)).limit(1);
  const sellerOffline = !sellerNow?.lastSeenAt || Date.now() - new Date(sellerNow.lastSeenAt).getTime() > 2 * 60 * 1000;
  const sellerMatchingGone = !sellerNow?.matchingExpiresAt || new Date(sellerNow.matchingExpiresAt).getTime() < Date.now();
  if (sellerOffline || sellerMatchingGone) {
    // Cancel this chunk so it's cleaned up
    await db.update(ordersTable).set({ status: "cancelled", updatedAt: new Date() }).where(and(eq(ordersTable.id, id), eq(ordersTable.status, "available")));
    res.status(400).json({ error: "Seller is offline. This order has been removed." });
    return;
  }

  const now = new Date();
  const deadline = new Date(now.getTime() + lockMin * 60 * 1000);
  // Atomic: claim chunk + move seller funds balance -> heldBalance.
  let lockedRow: any = null;
  await db.transaction(async (tx) => {
    const upd = await tx.update(ordersTable).set({
      status: "locked",
      lockedAt: now,
      lockedByUserId: u.id,
      confirmDeadline: deadline,
      updatedAt: now,
    }).where(and(eq(ordersTable.id, id), eq(ordersTable.status, "available"))).returning();
    if (upd.length === 0) return;
    lockedRow = upd[0];
    const amt = parseFloat(upd[0].amount);
    await tx.update(usersTable).set({
      balance: sql`${usersTable.balance} - ${amt}`,
      heldBalance: sql`${usersTable.heldBalance} + ${amt}`,
    }).where(eq(usersTable.id, upd[0].userId));
    // Record per-order reservation so release/settle paths know exactly
    // how much to debit from heldBalance vs main balance.
    await tx.update(ordersTable).set({
      heldAmount: String(amt),
    }).where(eq(ordersTable.id, upd[0].id));
  });
  if (!lockedRow) { res.status(409).json({ error: "Race - chunk just taken" }); return; }
  const upd = [lockedRow];

  await checkVelocity(u.id);
  await checkCancelRate(u.id);
  const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, upd[0].userId)).limit(1);
  const base = f(upd[0], seller);
  const response = activeUpis.length > 0
    ? activeUpis.map((upi, idx) => ({
        ...base,
        id: `${base.id}-${idx + 1}`,
        upiId: upi.upiId,
        upiName: upi.upiName || base.upiName,
        qrImageUrl: upi.qrImageUrl || base.qrImageUrl,
      }))
    : [base];
  res.json(response);
});

router.post("/submit/:id", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const id = parseInt(asString(req.params.id));
  const { utrNumber, screenshotUrl, recordingUrl } = req.body;
  if (!utrNumber || !/^[A-Z0-9]{12}$/i.test(String(utrNumber).trim())) {
    res.status(400).json({ error: "Invalid UTR format. UTR must be exactly 12 alphanumeric characters (e.g. T12345678901)." });
    return;
  }
  if (!screenshotUrl) { res.status(400).json({ error: "Payment screenshot required" }); return; }

  const [chunk] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!chunk || chunk.status !== "locked" || chunk.lockedByUserId !== u.id) {
    res.status(400).json({ error: "Cannot submit on this chunk" });
    return;
  }

  const [sellerPresence] = await db.select({ lastSeenAt: usersTable.lastSeenAt }).from(usersTable).where(eq(usersTable.id, chunk.userId)).limit(1);
  if (!sellerPresence?.lastSeenAt || Date.now() - new Date(sellerPresence.lastSeenAt).getTime() > 2 * 60 * 1000) {
    res.status(400).json({ error: "Seller is offline right now. Please wait until seller comes online." });
    return;
  }

  const utrIssues = await checkUtrFraud(utrNumber, u.id, id);
  await checkImageHash(screenshotUrl, u.id, id, "screenshot");
  if (recordingUrl) await checkImageHash(recordingUrl, u.id, id, "recording");
  if (utrIssues.includes("fake_utr_repeated_digits")) {
    await applyTrustDelta(u.id, -5, "fake_utr", id);
    res.status(400).json({ error: "UTR rejected: looks fake" });
    return;
  }

  const settings = await getSettings(["sellerConfirmMinutes"]);
  const confirmMin = parseInt(settings.sellerConfirmMinutes) || 15;
  const now = new Date();
  const deadline = new Date(now.getTime() + confirmMin * 60 * 1000);
  await db.update(ordersTable).set({
    status: "pending_confirmation",
    utrNumber, screenshotUrl, recordingUrl: recordingUrl || null,
    submittedAt: now,
    confirmDeadline: deadline,
    updatedAt: now,
  }).where(eq(ordersTable.id, id));
  const [updated] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  res.json(f(updated));
});

router.get("/my-seller-alerts", requireAuth, async (req, res) => {
  const u = (req as any).user;
  await releaseExpiredLocks();
  await autoConfirmExpired();
  const rows = await db.select().from(ordersTable).where(and(
    eq(ordersTable.userId, u.id),
    eq(ordersTable.type, "withdrawal"),
    inArray(ordersTable.status, ["locked", "pending_confirmation"]),
  )).orderBy(ordersTable.confirmDeadline);
  const buyerIds = [...new Set(rows.map((r) => r.lockedByUserId).filter(Boolean))] as number[];
  const buyers = buyerIds.length ? await db.select().from(usersTable).where(inArray(usersTable.id, buyerIds)) : [];
  const byId = new Map(buyers.map((b) => [b.id, b]));
  res.json(rows.map((r) => ({
    ...f(r),
    buyer: byId.get(r.lockedByUserId!) ? { id: r.lockedByUserId, username: byId.get(r.lockedByUserId!)!.username, trustScore: byId.get(r.lockedByUserId!)!.trustScore } : undefined,
  })));
});

router.get("/my-pending-confirmations", requireAuth, async (req, res) => {
  const u = (req as any).user;
  await autoConfirmExpired();
  const rows = await db.select().from(ordersTable).where(and(
    eq(ordersTable.userId, u.id),
    eq(ordersTable.type, "withdrawal"),
    eq(ordersTable.status, "pending_confirmation"),
  )).orderBy(ordersTable.confirmDeadline);
  const buyerIds = [...new Set(rows.map((r) => r.lockedByUserId).filter(Boolean))] as number[];
  const buyers = buyerIds.length ? await db.select().from(usersTable).where(inArray(usersTable.id, buyerIds)) : [];
  const byId = new Map(buyers.map((b) => [b.id, b]));
  res.json(rows.map((r) => ({
    ...f(r),
    buyer: byId.get(r.lockedByUserId!) ? { id: r.lockedByUserId, username: byId.get(r.lockedByUserId!)!.username, trustScore: byId.get(r.lockedByUserId!)!.trustScore } : undefined,
  })));
});

router.post("/confirm/:id", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const id = parseInt(asString(req.params.id));
  const [chunk] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!chunk || chunk.userId !== u.id || chunk.status !== "pending_confirmation") {
    res.status(400).json({ error: "Cannot confirm this chunk" });
    return;
  }
  await settleConfirmedTrade(id, false);
  res.json({ success: true });
});

router.post("/dispute/:id", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const id = parseInt(asString(req.params.id));
  const { reason } = req.body;
  const [chunk] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!chunk || chunk.userId !== u.id || chunk.status !== "pending_confirmation") {
    res.status(400).json({ error: "Cannot dispute this chunk" });
    return;
  }
  const settings = await getSettings(["disputeWindowHours"]);
  const winHrs = parseInt(settings.disputeWindowHours) || 24;
  const now = new Date();
  const proofDeadline = new Date(now.getTime() + winHrs * 60 * 60 * 1000);
  await db.update(ordersTable).set({ status: "disputed", updatedAt: now }).where(eq(ordersTable.id, id));
  await db.insert(disputesTable).values({
    orderId: id,
    buyerId: chunk.lockedByUserId!,
    sellerId: u.id,
    reason: reason || "Seller did not receive payment",
    status: "open",
    buyerProofDeadline: proofDeadline,
    sellerProofDeadline: proofDeadline,
  });
  res.json({ success: true });
});

router.post("/cancel/:id", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const id = parseInt(asString(req.params.id));
  const [chunk] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!chunk || chunk.lockedByUserId !== u.id || chunk.status !== "locked") {
    res.status(400).json({ error: "Cannot cancel" });
    return;
  }
  // Atomic: release seller's hold using per-order reserved amount
  // (heldAmount = 0 for legacy locks, in which case nothing was held).
  const heldAmt = parseFloat(chunk.heldAmount || "0");
  const { releaseHold } = await import("../lib/hold.js");
  await db.transaction(async (tx) => {
    await releaseHold(chunk.userId, heldAmt, tx);
    await tx.update(ordersTable).set({
      status: "available",
      lockedAt: null, lockedByUserId: null, confirmDeadline: null,
      updatedAt: new Date(),
    }).where(eq(ordersTable.id, id));
  });

  await checkRapidLockRelease(u.id);
  await checkBalanceDrain(u.id);
  res.json({ success: true });
});

router.get("/my-chunks", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const rows = await db.select().from(ordersTable).where(and(
    eq(ordersTable.userId, u.id),
    eq(ordersTable.type, "withdrawal"),
    inArray(ordersTable.status, ["available", "locked", "pending_confirmation", "disputed", "confirmed"]),
  )).orderBy(sql`${ordersTable.createdAt} desc`).limit(50);
  res.json(rows.map((r) => f(r)));
});

router.post("/regenerate-chunks", requireAuth, async (req, res) => {
  const u = (req as any).user;
  await regenerateChunksForUser(u.id);
  res.json({ success: true });
});

// Start a 15-minute matching session: turns auto-sell on, sets the expiry,
// and immediately tries to push chunks into the buy queue. Sellers must
// stay online during the window or buyers can't submit payments to them.
router.post("/start-matching", requireAuth, async (req, res) => {
  const u = (req as any).user;
  if (u.isFrozen) { res.status(403).json({ error: "Account frozen" }); return; }
  if (u.isBlocked) { res.status(403).json({ error: "Account blocked" }); return; }
  // Need at least one active UPI to receive payments.
  const { userUpiIdsTable } = await import("@workspace/db");
  const [upi] = await db.select().from(userUpiIdsTable).where(and(
    eq(userUpiIdsTable.userId, u.id),
    eq(userUpiIdsTable.isActive, true),
  )).limit(1);
  if (!upi) {
    res.status(400).json({ error: "No active UPI. Add one before starting matching." });
    return;
  }
  const settings = await getSettings(["matchingSessionMinutes"]);
  const mins = parseInt(settings.matchingSessionMinutes) || 15;
  const expires = new Date(Date.now() + mins * 60 * 1000);
  await db.update(usersTable).set({
    matchingExpiresAt: expires,
    autoSellEnabled: true,
    lastSeenAt: new Date(),
  }).where(eq(usersTable.id, u.id));
  await regenerateChunksForUser(u.id);
  res.json({ success: true, matchingExpiresAt: expires });
});

router.post("/stop-matching", requireAuth, async (req, res) => {
  const u = (req as any).user;
  await db.update(usersTable).set({
    matchingExpiresAt: null,
    autoSellEnabled: false,
  }).where(eq(usersTable.id, u.id));
  // Cancel still-available chunks so they leave the buy queue. Locked /
  // pending chunks stay because they're already mid-trade.
  await db.update(ordersTable).set({
    status: "cancelled",
    updatedAt: new Date(),
  }).where(and(
    eq(ordersTable.userId, u.id),
    eq(ordersTable.type, "withdrawal"),
    eq(ordersTable.status, "available"),
  ));
  res.json({ success: true });
});

router.get("/matching-status", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, u.id)).limit(1);
  const expiresAt = user?.matchingExpiresAt || null;
  const isOnline = !!user?.lastSeenAt && Date.now() - new Date(user.lastSeenAt).getTime() < 2 * 60 * 1000;
  const isActive = !!expiresAt && new Date(expiresAt).getTime() > Date.now() && isOnline;
  // Counts for the live status panel.
  const counts = await db.select({
    status: ordersTable.status,
    c: sql<string>`COUNT(*)`,
  }).from(ordersTable).where(and(
    eq(ordersTable.userId, u.id),
    eq(ordersTable.type, "withdrawal"),
    inArray(ordersTable.status, ["available", "locked", "pending_confirmation"]),
  )).groupBy(ordersTable.status);
  const byStatus: Record<string, number> = {};
  for (const r of counts) byStatus[r.status] = parseInt(String(r.c));
  res.json({
    isActive,
    matchingExpiresAt: expiresAt,
    available: byStatus.available || 0,
    locked: byStatus.locked || 0,
    pendingConfirmation: byStatus.pending_confirmation || 0,
  });
});

export default router;
