import { db } from "@workspace/db";
import { ordersTable, usersTable, userUpiIdsTable, disputesTable, transactionsTable, settingsTable, userNotificationsTable, trustEventsTable } from "@workspace/db";
import { eq, and, sql, or } from "drizzle-orm";
import { getSettings } from "./settings.js";

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

type FeeTier = { min: number; max: number; fee: number };

/**
 * Look up the per-chunk platform fee for a given gross chunk amount.
 * Iterates the admin-configured tier list (loaded from settings.feeTiers)
 * and returns the first tier whose [min, max] inclusive range contains the
 * amount. Falls back to the legacy flat platformCommissionPerChunk value
 * when no tier matches (or the tier list is empty / malformed).
 */
function feeForAmount(amount: number, tiers: FeeTier[], fallback: number): number {
  if (Array.isArray(tiers)) {
    for (const t of tiers) {
      if (typeof t?.min !== "number" || typeof t?.max !== "number" || typeof t?.fee !== "number") continue;
      if (amount >= t.min && amount <= t.max) {
        return Math.max(0, Math.floor(t.fee));
      }
    }
  }
  return Math.max(0, Math.floor(fallback));
}

function parseFeeTiers(raw: string): FeeTier[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((t: any) => ({ min: Number(t?.min), max: Number(t?.max), fee: Number(t?.fee) }))
      .filter((t) => Number.isFinite(t.min) && Number.isFinite(t.max) && Number.isFinite(t.fee) && t.min <= t.max);
  } catch {
    return [];
  }
}

/**
 * Convert seller's available balance into random chunks (₹99-₹499) added to the buy queue.
 * Each chunk is an order row with type=withdrawal status=available.
 * Reservations the chunk amounts via heldBalance.
 */
export async function regenerateChunksForUser(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.isBlocked || user.isFrozen) return;
  // Admin liquidity is always-on. Regular sellers must have an active matching
  // session (started by clicking "Sell" on the home page, valid for 15 min).
  const isAdminSeller = user.role === "admin";
  if (!isAdminSeller) {
    if (!user.matchingExpiresAt || new Date(user.matchingExpiresAt).getTime() < Date.now()) return;
  }
  // Pause auto-sell if user has any open dispute
  const [openDispute] = await db.select().from(disputesTable).where(and(
    or(eq(disputesTable.buyerId, userId), eq(disputesTable.sellerId, userId)),
    eq(disputesTable.status, "open"),
  )).limit(1);
  if (openDispute) return;
  // Pull EVERY active UPI for this seller — chunks are distributed across them
  // round-robin so no single UPI bears all the inbound payment volume.
  const upis = await db.select().from(userUpiIdsTable)
    .where(and(eq(userUpiIdsTable.userId, userId), eq(userUpiIdsTable.isActive, true)));
  if (upis.length === 0) return;

  // Available balance = balance - heldBalance - sum of in-queue chunks (held by
  // gross amount, including the ₹1 platform fee that will be deducted at
  // chunk-creation time below).
  const balance = parseFloat(user.balance);
  const held = parseFloat(user.heldBalance);
  const existingChunks = await db.select().from(ordersTable).where(and(
    eq(ordersTable.userId, userId),
    eq(ordersTable.type, "withdrawal"),
    sql`${ordersTable.status} IN ('available', 'locked', 'pending_confirmation', 'disputed')`,
  ));
  const settings = await getSettings([
    "chunkMin", "chunkMax", "newUserChunkCap", "newUserTradeThreshold",
    "platformCommissionPerChunk", "adminChunkMin", "adminChunkMax",
    "chunkSweetMin", "chunkSweetMax", "chunkSweetBias", "feeTiers",
  ]);
  let chunkMin = parseInt(settings.chunkMin) || 100;
  let chunkMax = parseInt(settings.chunkMax) || 50000;
  const flatCommission = parseInt(settings.platformCommissionPerChunk) || 1;
  const feeTiers = parseFeeTiers(settings.feeTiers);
  // Sweet-spot band: most chunks fall in this range so we maximize the
  // per-chunk ₹1 platform fee while avoiding both tiny dust chunks and
  // oversized single chunks. Bias = probability a chunk is drawn from the
  // sweet band vs the full [chunkMin, chunkMax] tail range.
  const sweetMin = parseInt(settings.chunkSweetMin) || 300;
  const sweetMax = parseInt(settings.chunkSweetMax) || 1500;
  const sweetBias = Math.min(1, Math.max(0, parseFloat(settings.chunkSweetBias) || 0.85));
  // Admin's own chunks are pushed into the buy queue as large-only amounts
  // so admin liquidity acts as bulk supply, not retail.
  if (isAdminSeller) {
    chunkMin = parseInt(settings.adminChunkMin) || 5000;
    chunkMax = parseInt(settings.adminChunkMax) || 50000;
  }
  // For in-queue chunks: each row stores `amount` = net buyer amount; the
  // platform fee was deducted from seller balance at creation time. We don't
  // store the fee on the row, so to keep `avail` *conservative* (and avoid
  // over-generating new chunks) we add back the maximum tier fee currently
  // configured — this can only over-count consumed balance, never under-count.
  const maxTierFee = feeTiers.reduce((m, t) => Math.max(m, t.fee), flatCommission);
  const inQueueAmt = existingChunks.reduce((s, o) => s + parseFloat(o.amount) + maxTierFee, 0);
  let avail = balance - held - inQueueAmt;
  const newUserCap = parseInt(settings.newUserChunkCap) || 10000;
  const tradeThreshold = parseInt(settings.newUserTradeThreshold) || 5;
  if (!isAdminSeller && (user.successfulTrades || 0) < tradeThreshold) {
    chunkMax = Math.min(chunkMax, newUserCap);
  }

  if (avail < chunkMin) return;

  // Pick chunk gross amounts (each consumes `gross` from seller balance:
  // ₹1 → admin, gross-1 → buyer). Sweet-spot biased: most picks fall in
  // [sweetMin, sweetMax] to maximize order count (= more ₹1 fees) while
  // avoiding floods of tiny dust or single huge chunks.
  const lo = Math.max(chunkMin, Math.min(sweetMin, chunkMax));
  const hi = Math.max(lo, Math.min(sweetMax, chunkMax));
  function pickSize(maxAvail: number): number {
    const useSweet = Math.random() < sweetBias;
    if (useSweet) {
      const a = Math.min(lo, maxAvail);
      const b = Math.min(hi, maxAvail);
      if (b >= a && b >= chunkMin) return rand(a, b);
    }
    // Tail: anywhere in [chunkMin, chunkMax] for variety, capped by maxAvail.
    const a = chunkMin;
    const b = Math.min(chunkMax, maxAvail);
    return rand(a, b);
  }
  const chunks: number[] = [];
  while (avail >= chunkMin) {
    let size = pickSize(avail);
    // Avoid leaving an unusable dust remainder smaller than chunkMin —
    // either fold it into this chunk (if total still ≤ chunkMax) or trim
    // size so the leftover stays ≥ chunkMin.
    const remainder = avail - size;
    if (remainder > 0 && remainder < chunkMin) {
      if (size + remainder <= chunkMax) {
        size = size + remainder;
      } else {
        size = Math.max(chunkMin, size - (chunkMin - remainder));
      }
    }
    if (size < chunkMin) break;
    if (size > avail) size = avail;
    chunks.push(size);
    avail -= size;
  }
  if (chunks.length === 0) return;

  for (let i = 0; i < chunks.length; i++) {
    const gross = chunks[i];
    // Assign each chunk to a random active UPI so chunks spread naturally
    // across all active IDs instead of landing on the same one repeatedly.
    const upi = upis[rand(0, upis.length - 1)];
    // Per-chunk tier fee: computed at creation time and STORED on the chunk
    // (feeAmount). The fee is NOT charged here — it is only deducted from
    // the seller and credited to admin when the chunk successfully settles
    // (see settle.ts). If the chunk expires/cancels, no fee is ever charged.
    const tierFee = feeForAmount(gross, feeTiers, flatCommission);
    const buyerAmount = gross - tierFee;
    await db.insert(ordersTable).values({
      userId,
      type: "withdrawal",
      amount: String(buyerAmount),
      feeAmount: String(tierFee),
      rewardPercent: "0",
      rewardAmount: "0",
      totalAmount: String(buyerAmount),
      status: "available",
      userUpiId: upi.upiId,
      userUpiName: upi.holderName,
      userName: upi.holderName,
    });
  }
}

/**
 * Release locks past their deadline: chunks back to available, attempt is cancelled.
 */
export async function releaseExpiredLocks() {
  const now = new Date();
  const expired = await db.select().from(ordersTable)
    .where(and(
      eq(ordersTable.type, "withdrawal"),
      eq(ordersTable.status, "locked"),
      sql`${ordersTable.confirmDeadline} < ${now}`,
    ));
  const { releaseHold } = await import("./hold.js");
  for (const o of expired) {
    const heldAmt = parseFloat(o.heldAmount || "0");
    // Atomic: release seller hold using per-order reserved amount
    // (legacy locks have heldAmount=0 so nothing is released).
    await db.transaction(async (tx) => {
      await releaseHold(o.userId, heldAmt, tx);
      await tx.update(ordersTable).set({
        status: "available",
        lockedAt: null,
        lockedByUserId: null,
        confirmDeadline: null,
        updatedAt: now,
      }).where(eq(ordersTable.id, o.id));
    });
  }
}

/**
 * Auto-confirm pending_confirmation orders whose seller-confirm window expired.
 * If the seller was offline (lastSeenAt > 5 min ago), create a dispute instead
 * of auto-confirming — buyer gets extra +1 trust, seller gets -1 trust with a
 * warning notification. If seller was online, buyer auto-wins normally.
 */
export async function autoConfirmExpired() {
  const now = new Date();
  const offlineCutoff = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
  const expired = await db.select().from(ordersTable)
    .where(and(
      eq(ordersTable.type, "withdrawal"),
      eq(ordersTable.status, "pending_confirmation"),
      sql`${ordersTable.confirmDeadline} < ${now}`,
    ));
  const { settleConfirmedTrade } = await import("./settle.js");
  const { applyTrustDelta } = await import("./trust.js");

  for (const o of expired) {
    if (!o.lockedByUserId) { await settleConfirmedTrade(o.id, true); continue; }

    // Check if seller is offline (lastSeenAt not set or > 5 min ago)
    const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, o.userId)).limit(1);
    const sellerOffline = !seller?.lastSeenAt || new Date(seller.lastSeenAt) < offlineCutoff;

    if (!sellerOffline) {
      // Seller was online → standard auto-confirm (buyer wins)
      await settleConfirmedTrade(o.id, true);
      continue;
    }

    // Seller was offline → escalate to dispute instead
    const disputeWindowHours = 24;
    const buyerDeadline = new Date(now.getTime() + disputeWindowHours * 60 * 60 * 1000);
    const sellerDeadline = new Date(now.getTime() + disputeWindowHours * 60 * 60 * 1000);

    // Open dispute — order moves to "disputed" status
    await db.update(ordersTable).set({ status: "disputed", updatedAt: now }).where(eq(ordersTable.id, o.id));
    await db.insert(disputesTable).values({
      orderId: o.id,
      buyerId: o.lockedByUserId,
      sellerId: o.userId,
      reason: "Auto-dispute: seller was offline when confirm window expired",
      triggerReason: "seller_offline",
      buyerProofDeadline: buyerDeadline,
      sellerProofDeadline: sellerDeadline,
    });

    // Seller penalty: -1 trust + notification
    await applyTrustDelta(o.userId, -1, "seller_offline_dispute", o.id);
    await db.insert(userNotificationsTable).values({
      userId: o.userId,
      kind: "seller_offline_penalty",
      title: "⚠️ -1 Trust — Order Dispute",
      body: `Aapka order ₹${parseFloat(o.amount).toFixed(2)} dispute mein chala gaya kyunki aap matching ke dauran offline ho gaye. Agla baar order lock ho to online rahiye.`,
      severity: "warn",
    });

    // Buyer notification — let them know they need to submit proof
    await db.insert(userNotificationsTable).values({
      userId: o.lockedByUserId,
      kind: "seller_offline_dispute_buyer",
      title: "Seller Offline — Dispute Khula",
      body: `Seller offline the isliye aapka ₹${parseFloat(o.amount).toFixed(2)} ka order dispute mein gaya. Apna payment proof 24 ghante mein upload karein.`,
      severity: "info",
    });
  }
}
