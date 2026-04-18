import { db } from "@workspace/db";
import { ordersTable, usersTable, transactionsTable, referralsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { applyTrustDelta, bumpSuccessfulTrade } from "./trust.js";

function getRewardPercent(amount: number): number {
  if (amount >= 2001) return 3;
  if (amount >= 1001) return 4;
  return 5;
}

/**
 * Settle a pending_confirmation chunk: buyer credited (amount + reward),
 * seller's heldBalance debited and balance reduced.
 * Trust deltas applied: both +1 normally; on auto-confirm seller gets -2 (late) instead of +1.
 */
export async function settleConfirmedTrade(chunkOrderId: number, isAutoConfirm = false) {
  const [chunk] = await db.select().from(ordersTable).where(eq(ordersTable.id, chunkOrderId)).limit(1);
  if (!chunk) return;
  if (chunk.status !== "pending_confirmation" && chunk.status !== "locked" && chunk.status !== "disputed") return;

  const sellerId = chunk.userId;
  const buyerId = chunk.lockedByUserId!;
  const amount = parseFloat(chunk.amount);
  const rewardPercent = getRewardPercent(amount);
  const rewardAmount = parseFloat((amount * rewardPercent / 100).toFixed(2));
  const totalCredit = parseFloat((amount + rewardAmount).toFixed(2));

  // Update chunk
  await db.update(ordersTable).set({
    status: "confirmed",
    rewardPercent: String(rewardPercent),
    rewardAmount: String(rewardAmount),
    totalAmount: String(totalCredit),
    confirmedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(ordersTable.id, chunkOrderId));

  // Buyer: credit
  await db.update(usersTable).set({
    balance: sql`${usersTable.balance} + ${totalCredit}`,
    totalDeposits: sql`${usersTable.totalDeposits} + ${amount}`,
  }).where(eq(usersTable.id, buyerId));

  // Seller: debit (the chunk amount was reserved from balance via held? No — we just deduct now)
  await db.update(usersTable).set({
    balance: sql`${usersTable.balance} - ${amount}`,
    totalWithdrawals: sql`${usersTable.totalWithdrawals} + ${amount}`,
  }).where(eq(usersTable.id, sellerId));

  // Transactions
  await db.insert(transactionsTable).values({
    userId: buyerId, orderId: chunkOrderId, type: "credit",
    amount: String(totalCredit),
    description: `Buy confirmed +${rewardPercent}% reward (chunk #${chunkOrderId})`,
  });
  await db.insert(transactionsTable).values({
    userId: sellerId, orderId: chunkOrderId, type: "debit",
    amount: String(amount),
    description: `Chunk sold to buyer #${buyerId} (chunk #${chunkOrderId})`,
  });

  // Trust + counters
  if (isAutoConfirm) {
    await applyTrustDelta(buyerId, 1, "auto_confirm_win", chunkOrderId);
    await applyTrustDelta(sellerId, -2, "late_confirm", chunkOrderId);
  } else {
    await applyTrustDelta(buyerId, 1, "trade_success", chunkOrderId);
    await applyTrustDelta(sellerId, 1, "trade_success", chunkOrderId);
  }
  await bumpSuccessfulTrade(buyerId);
  await bumpSuccessfulTrade(sellerId);

  // Referral commissions for buyer's deposit
  const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, buyerId)).limit(1);
  if (buyer && buyer.referredBy) {
    const l1 = parseFloat((amount * 0.01).toFixed(2));
    if (l1 > 0) {
      await db.update(usersTable).set({
        balance: sql`${usersTable.balance} + ${l1}`,
        inviteEarnings: sql`${usersTable.inviteEarnings} + ${l1}`,
      }).where(eq(usersTable.id, buyer.referredBy));
      await db.insert(referralsTable).values({
        referrerId: buyer.referredBy, referredUserId: buyer.id, orderId: chunkOrderId,
        level: 1, commissionAmount: String(l1),
      });
      await db.insert(transactionsTable).values({
        userId: buyer.referredBy, orderId: chunkOrderId, type: "credit",
        amount: String(l1), description: `Invite L1 1% from #${buyer.id}`,
      });
      const [l1Ref] = await db.select().from(usersTable).where(eq(usersTable.id, buyer.referredBy)).limit(1);
      if (l1Ref && l1Ref.referredBy) {
        const l2 = parseFloat((amount * 0.001).toFixed(2));
        if (l2 > 0) {
          await db.update(usersTable).set({
            balance: sql`${usersTable.balance} + ${l2}`,
            inviteEarningsL2: sql`${usersTable.inviteEarningsL2} + ${l2}`,
          }).where(eq(usersTable.id, l1Ref.referredBy));
          await db.insert(referralsTable).values({
            referrerId: l1Ref.referredBy, referredUserId: buyer.id, orderId: chunkOrderId,
            level: 2, commissionAmount: String(l2),
          });
          await db.insert(transactionsTable).values({
            userId: l1Ref.referredBy, orderId: chunkOrderId, type: "credit",
            amount: String(l2), description: `Invite L2 0.1% from #${buyer.id}`,
          });
        }
      }
    }
  }

  // After settling, regenerate chunks for buyer (their deposit increased available balance)
  const { regenerateChunksForUser } = await import("./matching.js");
  await regenerateChunksForUser(buyerId);
}
