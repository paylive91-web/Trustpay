import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, usersTable, disputesTable, tradePairBlocksTable, userNotificationsTable, utrIndexTable, imageHashesTable, transactionsTable } from "@workspace/db";
import { eq, and, sql, inArray, ne, or, gte, like } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { getSettings } from "../lib/settings.js";
import { releaseExpiredLocks, autoConfirmExpired, regenerateChunksForUser, getMatchingDiagnostics } from "../lib/matching.js";
import { settleConfirmedTrade } from "../lib/settle.js";
import { applyTrustDelta } from "../lib/trust.js";
import {
  checkUtrFraud, checkImageHash, checkVelocity, checkCancelRate,
  checkRapidLockRelease, checkBalanceDrain, checkOcrFraud, logAlert,
  checkAndApplyBuyerCooldown, getBuyerCooldownStatus,
} from "../lib/fraud.js";
import { runOcr } from "../lib/ocr.js";

const router = Router();

// --- In-memory mutex: prevents concurrent lock attempts on the same chunk ---
// Node.js is single-threaded so Map operations are atomic — no two requests
// can pass the "has" check simultaneously for the same chunk ID.
const chunkLockInProgress = new Set<number>();

// --- Rate Limiter: screenshot uploads per user ---
// Max 10 submissions per 10-minute sliding window per user
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 10;
const uploadRateMap = new Map<number, number[]>();

function checkUploadRateLimit(userId: number): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (uploadRateMap.get(userId) ?? []).filter((t) => t > cutoff);
  if (timestamps.length >= RATE_LIMIT_MAX) return false;
  uploadRateMap.set(userId, [...timestamps, now]);
  // Cleanup old entries occasionally to prevent memory leak
  if (uploadRateMap.size > 5000) {
    for (const [uid, ts] of uploadRateMap) {
      if (ts.every((t) => t <= cutoff)) uploadRateMap.delete(uid);
    }
  }
  return true;
}

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
  // Sell-side bonus snapshot — populated by settle.ts on confirmation. Sent
  // on every chunk so the frontend can render an "earned ₹X bonus" line on
  // confirmed orders without an extra round-trip.
  const sellRewardAmount = parseFloat(o.sellRewardAmount || "0");
  const sellRewardPercent = parseFloat(o.sellRewardPercent || "0");
  return {
    id: o.id,
    sellerId: o.userId,
    amount,
    rewardPercent,
    rewardAmount,
    sellRewardAmount,
    sellRewardPercent,
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
    updatedAt: o.updatedAt,
    qrImageUrl: undefined as string | undefined,
    seller: sellerInfo ? {
      id: sellerInfo.id,
      username: sellerInfo.username,
      trustScore: sellerInfo.trustScore,
      lastSeenAt: sellerInfo.lastSeenAt,
    } : undefined,
  };
}

async function getActiveBuy(userId: number) {
  // Only "locked" and "pending_confirmation" block a new buy.
  // "disputed" orders are already in admin review — the buyer should be
  // free to make new purchases while the dispute is being resolved.
  const [r] = await db.select().from(ordersTable).where(and(
    eq(ordersTable.lockedByUserId, userId),
    inArray(ordersTable.status, ["locked", "pending_confirmation"]),
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
  // Admin priority: any chunk posted for sale by an admin user is shown
  // FIRST in the buy queue, so admin sells complete faster. We pull a
  // wider slice (100) to make sure admin chunks are captured even when
  // many newer non-admin chunks exist, then re-sort in JS so admin
  // chunks win regardless of createdAt, and trim back to 50.
  const adminUsers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
  const adminIdSet = new Set(adminUsers.map((a) => a.id));
  const rawChunks = await db.select().from(ordersTable).where(and(
    eq(ordersTable.type, "withdrawal"),
    eq(ordersTable.status, "available"),
    ne(ordersTable.userId, u.id),
  )).orderBy(ordersTable.createdAt).limit(100);
  rawChunks.sort((a, b) => {
    const aIsAdmin = adminIdSet.has(a.userId) ? 0 : 1;
    const bIsAdmin = adminIdSet.has(b.userId) ? 0 : 1;
    if (aIsAdmin !== bIsAdmin) return aIsAdmin - bIsAdmin;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  const chunks = rawChunks.slice(0, 50);
  // Fetch seller info for online-presence indicator
  const sellerIds = [...new Set(chunks.map((c) => c.userId))];
  const sellers = sellerIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, sellerIds))
    : [];
  const sellerMap = new Map(sellers.map((s) => [s.id, s]));
  // HIDE (don't cancel) offline-seller chunks. Keeping them as 'available' in
  // DB means: when seller resumes (heartbeat fires, app comes back to
  // foreground, or they navigate back to /sell), their chunks immediately
  // re-appear in the buyer queue without losing the matching session. This
  // also means a brief network hiccup or a long dispute popup doesn't wipe a
  // seller's queue and force them to click "Sell" again.
  const enriched = chunks.map((c) => {
    const seller = sellerMap.get(c.userId);
    const isOffline = !seller?.lastSeenAt || Date.now() - new Date(seller.lastSeenAt).getTime() > 2 * 60 * 1000;
    const matchingExpired = !seller?.matchingExpiresAt || new Date(seller.matchingExpiresAt).getTime() < Date.now();
    if (isOffline || matchingExpired) return null;
    const a = parseFloat(c.amount);
    const rp = a >= 2001 ? 3 : a >= 1001 ? 4 : 5;
    const ra = parseFloat((a * rp / 100).toFixed(2));
    return { ...f(c, seller), rewardPercent: rp, rewardAmount: ra, totalAmount: parseFloat((a + ra).toFixed(2)) };
  }).filter(Boolean);

  res.json(enriched);
});

router.get("/my-buy", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const r = await getActiveBuy(u.id);
  if (!r) { res.json(null); return; }
  const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, r.userId)).limit(1);
  res.json(f(r, seller));
});

router.get("/buyer-cooldown", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const status = await getBuyerCooldownStatus(u.id);
  res.json(status);
});

router.post("/lock/:id", requireAuth, async (req, res) => {
  const u = (req as any).user;
  if (u.isFrozen) { res.status(403).json({ error: "Account frozen due to low trust score" }); return; }
  if (u.isBlocked) { res.status(403).json({ error: "Account blocked" }); return; }

  // Progressive cooldown: buyer locked orders without paying too many times
  const cooldown = await getBuyerCooldownStatus(u.id);
  if (cooldown.inCooldown && cooldown.cooldownUntil) {
    res.status(429).json({
      error: "buyer_cooldown",
      cooldownUntil: cooldown.cooldownUntil.toISOString(),
      level: cooldown.level,
    });
    return;
  }

  const id = parseInt(asString(req.params.id));

  // Mutex check: if another request is already processing this chunk, reject instantly
  if (chunkLockInProgress.has(id)) {
    res.status(409).json({ error: "order_being_locked" });
    return;
  }
  chunkLockInProgress.add(id);

  try {

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
  // Check trade pair blocks — if this buyer-seller pair is blocked, skip
  const [pairBlock] = await db.select().from(tradePairBlocksTable).where(
    or(
      and(eq(tradePairBlocksTable.userId1, u.id), eq(tradePairBlocksTable.userId2, chunk.userId)),
      and(eq(tradePairBlocksTable.userId1, chunk.userId), eq(tradePairBlocksTable.userId2, u.id)),
    )
  ).limit(1);
  if (pairBlock) {
    res.status(403).json({ error: "This trade pair is blocked by TrustPay" });
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
  // After locking a chunk, try to regenerate new chunks from the seller's
  // remaining balance so their matching session continues uninterrupted.
  await regenerateChunksForUser(upd[0].userId);
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

  } finally {
    chunkLockInProgress.delete(id);
  }
});

router.post("/submit/:id", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const id = parseInt(asString(req.params.id));
  const { utrNumber, screenshotUrl, recordingUrl } = req.body;
  const utrClean = String(utrNumber || "").trim().toUpperCase();
  const BANK_UTR_PATTERNS = [/^[A-Z]{1,6}\d{6,11}$/, /^\d{12}$/, /^[A-Z]{2,4}[A-Z0-9]{8,10}$/];
  if (!/^[A-Z0-9]{12}$/.test(utrClean) || /^(.)\1+$/.test(utrClean)) {
    res.status(400).json({ error: "Invalid UTR format. UTR must be exactly 12 alphanumeric characters (e.g. T12345678901)." });
    return;
  }
  if (!BANK_UTR_PATTERNS.some((re) => re.test(utrClean))) {
    res.status(400).json({ error: "UTR does not match a recognised Indian bank format (e.g. T12345678901, HDFC12345678, 123456789012)." });
    return;
  }
  if (!screenshotUrl) { res.status(400).json({ error: "Payment screenshot required" }); return; }
  if (!screenshotUrl.startsWith("data:image/")) {
    res.status(400).json({ error: "Screenshot must be a base64-encoded image (data URL)" });
    return;
  }

  // Rate limit: max 10 screenshot submissions per user per 10 minutes
  if (!checkUploadRateLimit(u.id)) {
    await logAlert(u.id, id, "upload_rate_limit", "warn",
      `User exceeded screenshot upload rate limit (10 per 10 min)`);
    res.status(429).json({ error: "Too many payment submissions. Please wait a few minutes before trying again." });
    return;
  }

  const [chunk] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!chunk || chunk.status !== "locked" || chunk.lockedByUserId !== u.id) {
    res.status(400).json({ error: "Cannot submit on this chunk" });
    return;
  }

  // Track whether seller was offline at submission time. We no longer block
  // the submission, but if seller stays offline >15 min the buyer is allowed
  // to escalate the order to dispute (see /buyer-dispute/:id).
  const [sellerPresence] = await db.select({ lastSeenAt: usersTable.lastSeenAt }).from(usersTable).where(eq(usersTable.id, chunk.userId)).limit(1);
  const sellerOfflineMs = sellerPresence?.lastSeenAt
    ? Date.now() - new Date(sellerPresence.lastSeenAt).getTime()
    : Number.MAX_SAFE_INTEGER;
  const sellerWasOffline = sellerOfflineMs > 2 * 60 * 1000;

  const utrIssues = await checkUtrFraud(utrClean, u.id, id);
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
    utrNumber: utrClean, screenshotUrl, recordingUrl: recordingUrl || null,
    submittedAt: now,
    confirmDeadline: deadline,
    updatedAt: now,
    ocrStatus: "pending",
  }).where(eq(ordersTable.id, id));
  const [updated] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  res.json(f(updated));

  // Immediate critical alert to seller — drives the loud alarm sound on
  // their device. Sent regardless of OCR result so the seller wakes up
  // even if they had switched apps.
  await db.insert(userNotificationsTable).values({
    userId: chunk.userId,
    kind: "payment_pending_confirmation",
    title: sellerWasOffline
      ? `🚨 URGENT: Buyer paid ₹${chunk.amount} — confirm now!`
      : `Buyer paid ₹${chunk.amount} — please confirm`,
    body: sellerWasOffline
      ? `A buyer has submitted payment proof for order #${id} while you were away from the app. Open the app NOW and confirm the payment, otherwise the buyer can open a dispute in 15 minutes.`
      : `A buyer has submitted payment proof for order #${id}. Please review the screenshot and UTR, then confirm or dispute.`,
    severity: "critical",
  }).catch(() => {});

  // Run OCR asynchronously — don't block the response
  (async () => {
    try {
      const ocrResult = await runOcr(screenshotUrl);
      await db.update(ordersTable).set({
        ocrUtr: ocrResult.utr,
        ocrAmount: ocrResult.amount,
        ocrTimestamp: ocrResult.timestamp,
        ocrBank: ocrResult.bank,
        ocrRawText: ocrResult.rawText.slice(0, 4000),
        ocrStatus: ocrResult.status,
        updatedAt: new Date(),
      }).where(eq(ordersTable.id, id));

      const orderAmount = parseFloat(chunk.amount);
      const ocrFraud = await checkOcrFraud({
        orderId: id,
        buyerId: u.id,
        orderAmount,
        submittedUtr: utrClean,
        ocrAmount: ocrResult.amount,
        ocrUtr: ocrResult.utr,
        ocrStatus: ocrResult.status,
      });

      // Persist immutable match outcomes for audit trail
      await db.update(ordersTable).set({
        ocrAmountMatch: ocrFraud.amountMatch,
        ocrUtrMatch: ocrFraud.utrMatch,
        updatedAt: new Date(),
      }).where(eq(ordersTable.id, id));

      // Only mark as clean when OCR successfully completed AND raised no issues.
      // Any failed/unreadable/mismatch/no-data result is "flagged".
      const isClean = ocrResult.status === "done" && ocrFraud.issues.length === 0;
      const [buyerNotifTitle, buyerNotifBody] = isClean
        ? ["Payment proof received and verified", "Your payment screenshot has been successfully verified by our system. The seller will review and confirm shortly."]
        : ["Payment proof flagged — please resubmit", `Your payment screenshot was flagged by our system. Issues: ${ocrFraud.issues.join(", ")}. Please contact support if you believe this is a mistake.`];

      await db.insert(userNotificationsTable).values({
        userId: u.id,
        kind: "ocr_result",
        title: buyerNotifTitle,
        body: buyerNotifBody,
        severity: isClean ? "info" : "warn",
      });

      const [sellerNotifTitle, sellerNotifBody] = isClean
        ? ["Buyer payment screenshot verified", `The buyer's payment proof for order #${id} has been verified by our system. Please review and confirm the payment.`]
        : ["Buyer screenshot flagged by system", `The payment screenshot for order #${id} was flagged by our automated system. Please review carefully before confirming.`];

      await db.insert(userNotificationsTable).values({
        userId: chunk.userId,
        kind: "ocr_result",
        title: sellerNotifTitle,
        body: sellerNotifBody,
        severity: isClean ? "info" : "warn",
      });
    } catch (err) {
      // OCR failed — still flag the order as suspicious and notify both parties
      await db.update(ordersTable).set({ ocrStatus: "failed", updatedAt: new Date() }).where(eq(ordersTable.id, id)).catch(() => {});
      // Raise a fraud alert for the failed OCR (treated as suspicious screenshot)
      await checkOcrFraud({
        orderId: id,
        buyerId: u.id,
        orderAmount: parseFloat(chunk.amount),
        submittedUtr: utrClean,
        ocrAmount: null,
        ocrUtr: null,
        ocrStatus: "unreadable",
      }).catch(() => {});
      // Notify buyer and seller about the failure
      await db.insert(userNotificationsTable).values({
        userId: u.id,
        kind: "ocr_result",
        title: "Payment proof flagged — please resubmit",
        body: "We could not process your payment screenshot. Please resubmit a clearer image. Contact support if the problem persists.",
        severity: "warn",
      }).catch(() => {});
      await db.insert(userNotificationsTable).values({
        userId: chunk.userId,
        kind: "ocr_result",
        title: "Buyer screenshot flagged by system",
        body: `The payment screenshot for order #${id} could not be verified by our system. Please review carefully before confirming.`,
        severity: "warn",
      }).catch(() => {});
    }
  })();
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
  // Smart learning: seller confirmed payment is real → mark UTR & screenshots as verified
  const verifiedAt = new Date();
  await Promise.all([
    db.update(utrIndexTable).set({ verifiedAt }).where(eq(utrIndexTable.orderId, id)),
    db.update(imageHashesTable).set({ verifiedAt }).where(eq(imageHashesTable.orderId, id)),
  ]);
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
  if (!chunk.lockedByUserId) {
    res.status(400).json({ error: "Order has no buyer locked — cannot open dispute" });
    return;
  }
  const settings = await getSettings(["disputeWindowHours"]);
  const winHrs = parseInt(settings.disputeWindowHours) || 24;
  const now = new Date();
  const proofDeadline = new Date(now.getTime() + winHrs * 60 * 60 * 1000);
  // Atomic: status flip + dispute row must commit together. Without this,
  // a failed INSERT (e.g. missing column on a stale prod schema) used to
  // leave the order in 'disputed' state with no dispute row — meaning
  // /disputes/my returned nothing and admin saw "No disputes" while the
  // user saw a DISPUTED badge. The seller also got a "Failed" toast even
  // though the partial UPDATE had succeeded.
  try {
    await db.transaction(async (tx) => {
      await tx.update(ordersTable).set({ status: "disputed", updatedAt: now }).where(eq(ordersTable.id, id));
      await tx.insert(disputesTable).values({
        orderId: id,
        buyerId: chunk.lockedByUserId!,
        sellerId: u.id,
        reason: reason || "Seller did not receive payment",
        status: "open",
        buyerProofDeadline: proofDeadline,
        sellerProofDeadline: proofDeadline,
      });
    });
  } catch (err: any) {
    req.log?.error({ err, orderId: id }, "seller dispute creation failed");
    res.status(500).json({ error: "Could not open dispute. Please try again or contact TrustPay." });
    return;
  }
  res.json({ success: true });
});

// Buyer-initiated dispute: only allowed when buyer has submitted payment
// proof, the order is still pending_confirmation, AND the seller has been
// offline for at least 15 minutes since submission. Buyer must attach a
// bank statement screenshot proving the debit.
router.post("/buyer-dispute/:id", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const id = parseInt(asString(req.params.id));
  const { bankStatementUrl, txHistoryUrl, recordingUrl, reason } = req.body || {};
  const bankUrl = String(bankStatementUrl || "");
  if (!bankUrl || !bankUrl.startsWith("data:application/pdf")) {
    res.status(400).json({ error: "Bank statement is required (PDF only)" });
    return;
  }
  if (recordingUrl && !String(recordingUrl).startsWith("data:video/")) {
    res.status(400).json({ error: "Screen recording must be a video file" });
    return;
  }
  const [chunk] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!chunk || chunk.lockedByUserId !== u.id || chunk.status !== "pending_confirmation") {
    res.status(400).json({ error: "You can only dispute an order you have submitted payment for" });
    return;
  }
  const submittedAt = chunk.submittedAt ? new Date(chunk.submittedAt).getTime() : 0;
  const sinceSubmissionMs = Date.now() - submittedAt;
  const MIN_WAIT_MS = 15 * 60 * 1000;
  if (!submittedAt || sinceSubmissionMs < MIN_WAIT_MS) {
    const minsLeft = Math.ceil((MIN_WAIT_MS - sinceSubmissionMs) / 60000);
    res.status(400).json({ error: `Please wait ${Math.max(1, minsLeft)} more minute(s) before opening a dispute. Sellers have 15 minutes to confirm.` });
    return;
  }
  // Check seller has actually been offline since submission. If they've
  // logged in during the wait window we still allow it (they had time to act).
  const [sellerPresence] = await db.select({ lastSeenAt: usersTable.lastSeenAt }).from(usersTable).where(eq(usersTable.id, chunk.userId)).limit(1);
  const sellerLastSeen = sellerPresence?.lastSeenAt ? new Date(sellerPresence.lastSeenAt).getTime() : 0;

  await checkImageHash(bankStatementUrl, u.id, id, "screenshot").catch(() => {});
  if (txHistoryUrl && String(txHistoryUrl).startsWith("data:image/")) {
    await checkImageHash(txHistoryUrl, u.id, id, "screenshot").catch(() => {});
  }

  const settings = await getSettings(["disputeWindowHours"]);
  const winHrs = parseInt(settings.disputeWindowHours) || 24;
  const now = new Date();
  const proofDeadline = new Date(now.getTime() + winHrs * 60 * 60 * 1000);
  // Atomic — see /dispute/:id for the same rationale (avoid zombie
  // disputed orders with no matching dispute row).
  try {
    await db.transaction(async (tx) => {
      await tx.update(ordersTable).set({ status: "disputed", updatedAt: now }).where(eq(ordersTable.id, id));
      await tx.insert(disputesTable).values({
        orderId: id,
        buyerId: u.id,
        sellerId: chunk.userId,
        reason: reason || "Seller did not confirm payment within 15 minutes (was offline)",
        triggerReason: "seller_offline",
        status: "open",
        buyerBankStatementUrl: bankStatementUrl,
        buyerTxHistoryUrl: txHistoryUrl || null,
        buyerRecordingUrl: recordingUrl || null,
        buyerProofAt: now,
        buyerProofDeadline: proofDeadline,
        sellerProofDeadline: proofDeadline,
      });
    });
  } catch (err: any) {
    req.log?.error({ err, orderId: id }, "buyer dispute creation failed");
    res.status(500).json({ error: "Could not open dispute. Please try again or contact TrustPay." });
    return;
  }
  // Notify both parties
  await db.insert(userNotificationsTable).values({
    userId: chunk.userId,
    kind: "buyer_opened_dispute",
    title: `⚠️ Buyer opened a dispute for order #${id}`,
    body: `The buyer has opened a dispute because you did not confirm their payment of ₹${chunk.amount} within 15 minutes. Upload your bank statement and proof in the disputes section before the deadline, or admin will rule in the buyer's favor.`,
    severity: "critical",
  }).catch(() => {});
  await db.insert(userNotificationsTable).values({
    userId: u.id,
    kind: "dispute_opened",
    title: `Dispute opened for order #${id}`,
    body: `Your dispute has been submitted to admin for review. Please keep your payment proof ready in case admin asks for more details.`,
    severity: "info",
  }).catch(() => {});
  // Telemetry: log how long the seller stayed offline
  await logAlert(chunk.userId, id, "seller_offline_dispute", "warn",
    `Buyer opened dispute. Seller last seen ${sellerLastSeen ? `${Math.round((Date.now() - sellerLastSeen) / 60000)} min ago` : "never"}, submission was ${Math.round(sinceSubmissionMs / 60000)} min ago.`).catch(() => {});
  res.json({ success: true });
});

// Live orders for the home screen — only orders currently in progress
// (locked / pending_confirmation / disputed). Completed, expired,
// cancelled, or refunded orders are NOT shown here — those live in the
// full Orders history page.
router.get("/recent-orders", requireAuth, async (req, res) => {
  const u = (req as any).user;
  const limit = Math.min(20, parseInt(asString(req.query.limit)) || 5);
  const ACTIVE_STATUSES = ["locked", "pending_confirmation", "disputed"] as const;
  // Buys: orders user locked (regardless of who created the sell chunk)
  const buys = await db.select().from(ordersTable).where(and(
    eq(ordersTable.lockedByUserId, u.id),
    eq(ordersTable.type, "withdrawal"),
    inArray(ordersTable.status, [...ACTIVE_STATUSES]),
  )).orderBy(sql`${ordersTable.updatedAt} desc`).limit(limit);
  // Sells: chunks user owns (created) that are mid-trade
  const sells = await db.select().from(ordersTable).where(and(
    eq(ordersTable.userId, u.id),
    eq(ordersTable.type, "withdrawal"),
    inArray(ordersTable.status, [...ACTIVE_STATUSES]),
  )).orderBy(sql`${ordersTable.updatedAt} desc`).limit(limit);
  const merged = [...buys.map((r) => ({ ...f(r), side: "buy" as const })), ...sells.map((r) => ({ ...f(r), side: "sell" as const }))];
  // Dedup by id (a row could match both, keep buy if user locked their own — rare)
  const seen = new Set<number>();
  const unique = merged.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
  unique.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  res.json(unique.slice(0, limit));
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

  await checkAndApplyBuyerCooldown(u.id);
  res.json({ success: true });
});

router.get("/my-chunks", requireAuth, async (req, res) => {
  const u = (req as any).user;
  // Determine whether seller's matching session is currently live. If not,
  // available chunks are stale (expired session, offline, or never started)
  // and should be cleaned up + omitted before returning. This guarantees
  // the seller never sees "active orders" on the My Orders / Pending /
  // Locked tabs unless they have actively clicked Sell and stayed online.
  const [user] = await db.select({
    matchingExpiresAt: usersTable.matchingExpiresAt,
    lastSeenAt: usersTable.lastSeenAt,
  }).from(usersTable).where(eq(usersTable.id, u.id)).limit(1);
  const isOnline = !!user?.lastSeenAt && Date.now() - new Date(user.lastSeenAt).getTime() < 2 * 60 * 1000;
  const isActive = !!user?.matchingExpiresAt && new Date(user.matchingExpiresAt).getTime() > Date.now() && isOnline;
  if (!isActive) {
    await db.update(ordersTable).set({
      status: "cancelled",
      updatedAt: new Date(),
    }).where(and(
      eq(ordersTable.userId, u.id),
      eq(ordersTable.type, "withdrawal"),
      eq(ordersTable.status, "available"),
    )).catch(() => {});
  }
  const statuses: ("available" | "locked" | "pending_confirmation" | "disputed" | "confirmed")[] = isActive
    ? ["available", "locked", "pending_confirmation", "disputed", "confirmed"]
    : ["locked", "pending_confirmation", "disputed", "confirmed"];
  const rows = await db.select().from(ordersTable).where(and(
    eq(ordersTable.userId, u.id),
    eq(ordersTable.type, "withdrawal"),
    inArray(ordersTable.status, statuses),
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
  // Self-heal: while matching is active, opportunistically regenerate chunks
  // on every status poll. The function is internally idempotent — it only
  // inserts new chunks when the seller has free balance ≥ chunkMin and no
  // existing 'available' chunks consume that capacity. This rescues sellers
  // whose initial regen at /start-matching ran under buggy code (e.g. the
  // historical balance/held double-deduction) without forcing them to Stop +
  // Start matching just to pick up new server logic.
  if (isActive) {
    await regenerateChunksForUser(u.id).catch(() => {});
  } else {
    // Inverse self-heal: when matching is NOT active (never started, stopped,
    // expired, or seller went offline), cancel any leftover 'available'
    // chunks so they vanish from the seller's screen and the buyer queue.
    // Locked / pending_confirmation / disputed chunks are mid-trade and
    // intentionally NOT touched — those need explicit resolution.
    await db.update(ordersTable).set({
      status: "cancelled",
      updatedAt: new Date(),
    }).where(and(
      eq(ordersTable.userId, u.id),
      eq(ordersTable.type, "withdrawal"),
      eq(ordersTable.status, "available"),
    )).catch(() => {});
  }
  // Counts for the live status panel — also include 'disputed' so we can
  // show the seller why their balance is stuck (held in pending disputes).
  const counts = await db.select({
    status: ordersTable.status,
    c: sql<string>`COUNT(*)`,
    sumHeld: sql<string>`COALESCE(SUM(CAST(held_amount AS NUMERIC)), 0)`,
  }).from(ordersTable).where(and(
    eq(ordersTable.userId, u.id),
    eq(ordersTable.type, "withdrawal"),
    inArray(ordersTable.status, ["available", "locked", "pending_confirmation", "disputed"]),
  )).groupBy(ordersTable.status);
  const byStatus: Record<string, number> = {};
  let disputedHeldAmount = 0;
  for (const r of counts) {
    byStatus[r.status] = parseInt(String(r.c));
    if (r.status === "disputed") disputedHeldAmount = parseFloat(String(r.sumHeld)) || 0;
  }
  // Compute "why is queue empty?" diagnostic using the shared helper that
  // mirrors regenerateChunksForUser exactly (same math, same UPI check).
  const diag = await getMatchingDiagnostics(u.id);
  let emptyReason: string | null = null;
  if (isActive && (byStatus.available || 0) === 0 && (byStatus.locked || 0) === 0) {
    if (diag.matchingPaused) emptyReason = "Matching is paused by TrustPay.";
    else if (diag.isFrozen) emptyReason = "Your account is frozen — sells paused.";
    else if (!diag.hasActiveUpi) emptyReason = "No active UPI ID found. Add a UPI ID to receive payments.";
    else if (diag.availableForChunks < diag.chunkMin) {
      const stuck = disputedHeldAmount > 0 ? ` (₹${disputedHeldAmount.toFixed(0)} stuck in open disputes)` : "";
      emptyReason = `Not enough free balance to create chunks. Available ₹${diag.availableForChunks.toFixed(0)} / minimum ₹${diag.chunkMin}${stuck}.`;
    }
  }
  res.json({
    isActive,
    matchingExpiresAt: expiresAt,
    available: byStatus.available || 0,
    locked: byStatus.locked || 0,
    pendingConfirmation: byStatus.pending_confirmation || 0,
    disputed: byStatus.disputed || 0,
    disputedHeldAmount,
    availableForChunks: diag.availableForChunks,
    chunkMin: diag.chunkMin,
    emptyReason,
  });
});

router.get("/my-stats", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [buyRewardRows, sellRewardRows, agentRewardRows, buyOrders, sellOrders] = await Promise.all([
    db.select({ total: sql<string>`coalesce(sum(amount::numeric),0)`, todayTotal: sql<string>`coalesce(sum(case when created_at >= ${todayStart} then amount::numeric else 0 end),0)` })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, "credit"), like(transactionsTable.description, "Buy confirmed%reward%"))),
    db.select({ total: sql<string>`coalesce(sum(amount::numeric),0)`, todayTotal: sql<string>`coalesce(sum(case when created_at >= ${todayStart} then amount::numeric else 0 end),0)` })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, "credit"), like(transactionsTable.description, "Sell reward%"))),
    db.select({ total: sql<string>`coalesce(sum(amount::numeric),0)` })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, "credit"), like(transactionsTable.description, "Agent Reward:%"))),
    db.select({
      id: ordersTable.id,
      amount: ordersTable.amount,
      rewardAmount: ordersTable.rewardAmount,
      status: ordersTable.status,
      createdAt: ordersTable.createdAt,
      updatedAt: ordersTable.updatedAt,
    }).from(ordersTable).where(and(
      eq(ordersTable.lockedByUserId, userId),
      inArray(ordersTable.status, ["confirmed", "disputed", "refunded"]),
    )).orderBy(sql`created_at desc`).limit(30),
    db.select({
      id: ordersTable.id,
      amount: ordersTable.amount,
      sellRewardAmount: ordersTable.sellRewardAmount,
      feeAmount: ordersTable.feeAmount,
      status: ordersTable.status,
      createdAt: ordersTable.createdAt,
      updatedAt: ordersTable.updatedAt,
    }).from(ordersTable).where(and(
      eq(ordersTable.userId, userId),
      eq(ordersTable.type, "withdrawal"),
      inArray(ordersTable.status, ["confirmed", "disputed", "refunded"]),
    )).orderBy(sql`created_at desc`).limit(30),
  ]);

  res.json({
    buyReward: {
      today: parseFloat(buyRewardRows[0]?.todayTotal || "0"),
      total: parseFloat(buyRewardRows[0]?.total || "0"),
    },
    sellReward: {
      today: parseFloat(sellRewardRows[0]?.todayTotal || "0"),
      total: parseFloat(sellRewardRows[0]?.total || "0"),
    },
    agentEarning: {
      total: parseFloat(agentRewardRows[0]?.total || "0"),
    },
    buyOrders,
    sellOrders,
  });
});

router.post("/check-screenshot", requireAuth, async (req, res) => {
  const { screenshotUrl } = req.body || {};
  if (!screenshotUrl || screenshotUrl.length < 100) {
    res.status(400).json({ error: "No screenshot provided" });
    return;
  }
  try {
    const { analyzeImage, checkDuplicate } = await import("../lib/imageAnalysis.js");
    const analysis = await analyzeImage(screenshotUrl);
    const dupResult = await checkDuplicate(analysis.hash, analysis.pHash, (req as any).user.id, -1, "screenshot");
    res.json({
      isExactDuplicate: dupResult.isExactDuplicate,
      isSimilarDuplicate: dupResult.isSimilarDuplicate,
      isSameUser: dupResult.isSameUser,
      pHashDistance: dupResult.pHashDistance,
      qualityIssue: analysis.qualityIssue,
      hasPaymentIndicators: analysis.hasPaymentIndicators,
      width: analysis.width,
      height: analysis.height,
    });
  } catch (e: any) {
    res.json({ isExactDuplicate: false, isSimilarDuplicate: false, isSameUser: false, qualityIssue: null, hasPaymentIndicators: true });
  }
});

export default router;
