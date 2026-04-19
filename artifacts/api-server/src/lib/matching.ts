import { db } from "@workspace/db";
import { ordersTable, usersTable, userUpiIdsTable, disputesTable, transactionsTable, settingsTable } from "@workspace/db";
import { eq, and, sql, or } from "drizzle-orm";
import { getSettings } from "./settings.js";

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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
  ]);
  let chunkMin = parseInt(settings.chunkMin) || 100;
  let chunkMax = parseInt(settings.chunkMax) || 50000;
  const commission = parseInt(settings.platformCommissionPerChunk) || 1;
  // Admin's own chunks are pushed into the buy queue as large-only amounts
  // so admin liquidity acts as bulk supply, not retail.
  if (isAdminSeller) {
    chunkMin = parseInt(settings.adminChunkMin) || 5000;
    chunkMax = parseInt(settings.adminChunkMax) || 50000;
  }
  // For in-queue chunks: each consumed (amount + commission) of seller
  // balance at creation (commission → admin, amount → buyer at settle).
  const inQueueAmt = existingChunks.reduce((s, o) => s + parseFloat(o.amount) + commission, 0);
  let avail = balance - held - inQueueAmt;
  const newUserCap = parseInt(settings.newUserChunkCap) || 10000;
  const tradeThreshold = parseInt(settings.newUserTradeThreshold) || 5;
  if (!isAdminSeller && (user.successfulTrades || 0) < tradeThreshold) {
    chunkMax = Math.min(chunkMax, newUserCap);
  }

  if (avail < chunkMin) return;

  // Pick chunk gross amounts (each consumes `gross` from seller balance:
  // ₹1 → admin, gross-1 → buyer).
  const chunks: number[] = [];
  while (avail >= chunkMin) {
    const size = Math.min(rand(chunkMin, chunkMax), avail);
    if (size < chunkMin) break;
    chunks.push(size);
    avail -= size;
  }
  if (chunks.length === 0) return;

  // Resolve the admin account that receives the per-chunk platform fee.
  // Pick the lowest-id admin so the destination is deterministic.
  const [adminUser] = await db.select().from(usersTable)
    .where(eq(usersTable.role, "admin"))
    .orderBy(usersTable.id)
    .limit(1);

  for (let i = 0; i < chunks.length; i++) {
    const gross = chunks[i];
    // Round-robin distribute across every active UPI so payments aren't
    // funneled to one account.
    const upi = upis[i % upis.length];
    const buyerAmount = gross - commission;
    await db.transaction(async (tx) => {
      // Debit ₹1 from seller balance immediately (platform fee). The remaining
      // (gross - 1) stays on seller balance until lock time, when it moves to
      // heldBalance.
      await tx.update(usersTable).set({
        balance: sql`${usersTable.balance} - ${commission}`,
      }).where(eq(usersTable.id, userId));
      // NOTE: deliberately not inserting a seller-side transaction row for
      // the platform fee — the deduction is silent so users don't see a
      // ₹1 fee entry per chunk in their transaction history.
      // Credit the platform fee to the admin user's wallet so the money
      // physically lands in an account the operator controls.
      if (adminUser) {
        await tx.update(usersTable).set({
          balance: sql`${usersTable.balance} + ${commission}`,
        }).where(eq(usersTable.id, adminUser.id));
        await tx.insert(transactionsTable).values({
          userId: adminUser.id, type: "credit", amount: String(commission),
          description: `Platform fee from seller #${userId} (chunk ₹${gross})`,
        });
      }
      // Atomic increment of platform commission counter via SQL upsert
      // (avoids lost-update races under concurrent chunk creation).
      await tx.insert(settingsTable).values({
        key: "platformCommissionTotal",
        value: String(commission),
      }).onConflictDoUpdate({
        target: settingsTable.key,
        set: {
          value: sql`(COALESCE(NULLIF(${settingsTable.value}, '')::numeric, 0) + ${commission})::text`,
          updatedAt: new Date(),
        },
      });
      await tx.insert(ordersTable).values({
        userId,
        type: "withdrawal",
        amount: String(buyerAmount),
        rewardPercent: "0",
        rewardAmount: "0",
        totalAmount: String(buyerAmount),
        status: "available",
        userUpiId: upi.upiId,
        userUpiName: upi.holderName,
        userName: upi.holderName,
      });
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
 * Buyer auto-wins.
 */
export async function autoConfirmExpired() {
  const now = new Date();
  const expired = await db.select().from(ordersTable)
    .where(and(
      eq(ordersTable.type, "withdrawal"),
      eq(ordersTable.status, "pending_confirmation"),
      sql`${ordersTable.confirmDeadline} < ${now}`,
    ));
  const { settleConfirmedTrade } = await import("./settle.js");
  for (const o of expired) {
    await settleConfirmedTrade(o.id, true);
  }
}
