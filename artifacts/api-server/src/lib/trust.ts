import { db } from "@workspace/db";
import { usersTable, trustEventsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export const TRUST_FREEZE_THRESHOLD = -80;
export const TRUST_MAX = 100;

export async function applyTrustDelta(userId: number, delta: number, reason: string, orderId?: number) {
  await db.insert(trustEventsTable).values({ userId, delta, reason, orderId });
  // clamp at max 100
  await db.update(usersTable).set({
    trustScore: sql`LEAST(${usersTable.trustScore} + ${delta}, ${TRUST_MAX})`,
  }).where(eq(usersTable.id, userId));
  // Apply freeze if threshold crossed
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (u && u.trustScore <= TRUST_FREEZE_THRESHOLD && !u.isFrozen) {
    await db.update(usersTable).set({ isFrozen: true }).where(eq(usersTable.id, userId));
  }
}

export async function bumpSuccessfulTrade(userId: number) {
  await db.update(usersTable).set({
    successfulTrades: sql`${usersTable.successfulTrades} + 1`,
  }).where(eq(usersTable.id, userId));
}
