import { db } from "@workspace/db";
import { ordersTable, usersTable, userUpiIdsTable, disputesTable } from "@workspace/db";
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
  if (!user || !user.autoSellEnabled || user.isBlocked || user.isFrozen) return;
  // Pause auto-sell if user has any open dispute
  const [openDispute] = await db.select().from(disputesTable).where(and(
    or(eq(disputesTable.buyerId, userId), eq(disputesTable.sellerId, userId)),
    eq(disputesTable.status, "open"),
  )).limit(1);
  if (openDispute) return;
  const [upi] = await db.select().from(userUpiIdsTable)
    .where(and(eq(userUpiIdsTable.userId, userId), eq(userUpiIdsTable.isActive, true))).limit(1);
  if (!upi) return;

  // Available balance = balance - heldBalance - sum of in-queue chunks
  const balance = parseFloat(user.balance);
  const held = parseFloat(user.heldBalance);
  const existingChunks = await db.select().from(ordersTable).where(and(
    eq(ordersTable.userId, userId),
    eq(ordersTable.type, "withdrawal"),
    sql`${ordersTable.status} IN ('available', 'locked', 'pending_confirmation', 'disputed')`,
  ));
  const inQueueAmt = existingChunks.reduce((s, o) => s + parseFloat(o.amount), 0);
  let avail = balance - held - inQueueAmt;
  if (avail < 99) return;

  const settings = await getSettings(["chunkMin", "chunkMax", "newUserChunkCap", "newUserTradeThreshold"]);
  let chunkMin = parseInt(settings.chunkMin) || 99;
  let chunkMax = parseInt(settings.chunkMax) || 499;
  const newUserCap = parseInt(settings.newUserChunkCap) || 500;
  const tradeThreshold = parseInt(settings.newUserTradeThreshold) || 5;
  if ((user.successfulTrades || 0) < tradeThreshold) chunkMax = Math.min(chunkMax, newUserCap);

  const chunks: number[] = [];
  while (avail >= chunkMin) {
    const size = Math.min(rand(chunkMin, chunkMax), avail);
    chunks.push(size);
    avail -= size;
  }
  if (chunks.length === 0) return;

  for (const amt of chunks) {
    await db.insert(ordersTable).values({
      userId,
      type: "withdrawal",
      amount: String(amt),
      rewardPercent: "0",
      rewardAmount: "0",
      totalAmount: String(amt),
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
