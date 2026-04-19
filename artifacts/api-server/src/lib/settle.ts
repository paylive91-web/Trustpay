import { db } from "@workspace/db";
import { ordersTable, usersTable, transactionsTable, referralsTable, highValueEventsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { applyTrustDelta, bumpSuccessfulTrade } from "./trust.js";
import { getSettings } from "./settings.js";
import { checkNewAccountHighValue, checkDisputeRate } from "./fraud.js";
import { logger } from "./logger.js";

function getRewardPercent(amount: number): number {
  if (amount >= 2001) return 3;
  if (amount >= 1001) return 4;
  return 5;
}

/**
 * Settle a pending_confirmation chunk: buyer credited (amount + reward),
 * seller's heldBalance and balance both decremented (held was reserved on lock).
 */
export async function settleConfirmedTrade(chunkOrderId: number, isAutoConfirm = false) {
  const [chunk] = await db.select().from(ordersTable).where(eq(ordersTable.id, chunkOrderId)).limit(1);
  if (!chunk) return;
  if (chunk.status !== "pending_confirmation" && chunk.status !== "locked" && chunk.status !== "disputed") return;

  const sellerId = chunk.userId;
  const buyerId = chunk.lockedByUserId!;
  const amount = parseFloat(chunk.amount);

  // Per-order reservation tracking: chunk.heldAmount records exactly what was
  // moved into seller.heldBalance at lock time (0 for legacy locks created
  // before held-balance semantics). For legacy chunks the seller's main
  // balance was never debited at lock; we debit balance directly. New chunks
  // debit heldBalance for the previously-reserved amount.
  const heldDebit = parseFloat(chunk.heldAmount || "0");
  const balanceDebit = parseFloat((amount - heldDebit).toFixed(2));

  const rewardPercent = getRewardPercent(amount);
  const rewardAmount = parseFloat((amount * rewardPercent / 100).toFixed(2));
  const totalCredit = parseFloat((amount + rewardAmount).toFixed(2));

  // Atomic ledger update: order -> confirmed, buyer credit, seller hold released, transaction rows.
  // Seller balance was already debited at lock time (balance -> heldBalance), so settlement
  // only debits the held portion (NOT balance) to avoid double-debiting funds.
  await db.transaction(async (tx) => {
    await tx.update(ordersTable).set({
      status: "confirmed",
      rewardPercent: String(rewardPercent),
      rewardAmount: String(rewardAmount),
      totalAmount: String(totalCredit),
      confirmedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(ordersTable.id, chunkOrderId));

    // Buyer: credit
    await tx.update(usersTable).set({
      balance: sql`${usersTable.balance} + ${totalCredit}`,
      totalDeposits: sql`${usersTable.totalDeposits} + ${amount}`,
    }).where(eq(usersTable.id, buyerId));

    // Seller: debit heldBalance (preferred) and fall back to balance for any
    // shortfall (legacy locks created before held-balance semantics).
    await tx.update(usersTable).set({
      heldBalance: sql`GREATEST(${usersTable.heldBalance} - ${heldDebit}, 0)`,
      balance: sql`${usersTable.balance} - ${balanceDebit}`,
      totalWithdrawals: sql`${usersTable.totalWithdrawals} + ${amount}`,
    }).where(eq(usersTable.id, sellerId));

    await tx.insert(transactionsTable).values({
      userId: buyerId, orderId: chunkOrderId, type: "credit",
      amount: String(totalCredit),
      description: `Buy confirmed +${rewardPercent}% reward (chunk #${chunkOrderId})`,
    });
    await tx.insert(transactionsTable).values({
      userId: sellerId, orderId: chunkOrderId, type: "debit",
      amount: String(amount),
      description: `Chunk sold to buyer #${buyerId} (chunk #${chunkOrderId})`,
    });
  });

  if (isAutoConfirm) {
    await applyTrustDelta(buyerId, 1, "auto_confirm_win", chunkOrderId);
    await applyTrustDelta(sellerId, -2, "late_confirm", chunkOrderId);
  } else {
    await applyTrustDelta(buyerId, 1, "trade_success", chunkOrderId);
    await applyTrustDelta(sellerId, 1, "trade_success", chunkOrderId);
  }
  await bumpSuccessfulTrade(buyerId);
  await bumpSuccessfulTrade(sellerId);

  // High-value tracking — log + alert, but never block settlement on a logging failure.
  try {
    const s = await getSettings(["highValueThreshold", "highValueCriticalThreshold"]);
    const warnT = parseInt(s.highValueThreshold) || 5000;
    const critT = parseInt(s.highValueCriticalThreshold) || 10000;
    if (amount >= warnT) {
      const tier = amount >= critT ? "critical" : "warn";
      await db.insert(highValueEventsTable).values({
        userId: buyerId, orderId: chunkOrderId,
        amount: String(amount), tier,
      });
      await checkNewAccountHighValue(buyerId, amount);
    }
  } catch (err) {
    logger.error({ err, chunkOrderId, buyerId, amount }, "high-value tracking failed");
  }

  // Dispute-rate fraud check after each settlement.
  try {
    await checkDisputeRate(buyerId);
    await checkDisputeRate(sellerId);
  } catch (err) {
    logger.error({ err, chunkOrderId, buyerId, sellerId }, "dispute-rate check failed");
  }

  // Admin platform-wide override: admin always earns 1% of every settled
  // trade (regardless of referral chain). Skipped when buyer IS the admin
  // to avoid self-credit. This is on top of the per-chunk ₹1 platform fee
  // and the normal user invite/earn referral system below.
  const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, buyerId)).limit(1);
  try {
    const [adminUser] = await db.select().from(usersTable)
      .where(eq(usersTable.role, "admin"))
      .orderBy(usersTable.id)
      .limit(1);
    if (adminUser && adminUser.id !== buyerId) {
      const adminCut = parseFloat((amount * 0.01).toFixed(2));
      if (adminCut > 0) {
        await db.update(usersTable).set({
          balance: sql`${usersTable.balance} + ${adminCut}`,
        }).where(eq(usersTable.id, adminUser.id));
        await db.insert(transactionsTable).values({
          userId: adminUser.id, orderId: chunkOrderId, type: "credit",
          amount: String(adminCut),
          description: `Admin 1% override from buyer #${buyerId} (chunk #${chunkOrderId})`,
        });
      }
    }
  } catch (err) {
    logger.error({ err, chunkOrderId, buyerId }, "admin override commission failed");
  }

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

  const { regenerateChunksForUser } = await import("./matching.js");
  await regenerateChunksForUser(buyerId);
}
