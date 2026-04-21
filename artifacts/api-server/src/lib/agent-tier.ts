import { db } from "@workspace/db";
import { usersTable, transactionsTable } from "@workspace/db";
import { eq, sql, and, or, isNull, lt } from "drizzle-orm";
import { getSetting } from "./settings.js";
import { logger } from "./logger.js";

export interface AgentTier {
  minActiveDeposits: number;
  reward: number;
  label: string;
}

function parseTiers(raw: string): AgentTier[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((t: any) => ({
        minActiveDeposits: Math.max(1, Math.floor(Number(t?.minActiveDeposits) || 0)),
        reward: Math.max(0, Number(t?.reward) || 0),
        label: String(t?.label || `Agent Tier ${t?.minActiveDeposits || ""}`),
      }))
      .filter((t) => t.minActiveDeposits > 0)
      .sort((a, b) => a.minActiveDeposits - b.minActiveDeposits);
  } catch {
    return [];
  }
}

export async function getAgentTiers(): Promise<AgentTier[]> {
  return parseTiers(await getSetting("agentTiers"));
}

/**
 * Called after every successful settlement that credits the L1 referrer.
 * Counts the agent's distinct active invitees today (= referredBy = agent
 * AND have at least one confirmed buy chunk today). Awards the highest
 * tier whose threshold is reached and which hasn't been awarded yet today.
 * Cumulative within a day: if the agent jumps from 49 → 50 active invitees,
 * they get the Silver delta on top of any previously-claimed Bronze.
 */
export async function evaluateAgentTier(agentId: number): Promise<void> {
  const tiers = await getAgentTiers();
  if (tiers.length === 0) return;

  const [agent] = await db.select().from(usersTable).where(eq(usersTable.id, agentId)).limit(1);
  if (!agent) return;

  // Today (DB-side, server local TZ). We use postgres CURRENT_DATE in the
  // conditional update to avoid client/server clock-skew races.
  const today = new Date().toISOString().slice(0, 10);

  // For admin accounts, every user who confirms a deposit on the platform
  // today counts — no referral filter needed. For regular agents, only their
  // own invitees (referredBy = agentId) count.
  const isAdmin = agent.role === "admin";
  const rows = await db.execute(
    isAdmin
      ? sql`
          SELECT COUNT(DISTINCT o.locked_by_user_id)::int AS active_count
          FROM orders o
          WHERE o.status = 'confirmed'
            AND COALESCE(o.confirmed_at, o.updated_at) >= CURRENT_DATE
        `
      : sql`
          SELECT COUNT(DISTINCT o.locked_by_user_id)::int AS active_count
          FROM orders o
          JOIN users u ON u.id = o.locked_by_user_id
          WHERE u.referred_by = ${agentId}
            AND o.status = 'confirmed'
            AND COALESCE(o.confirmed_at, o.updated_at) >= CURRENT_DATE
        `
  );
  const activeCount: number = Number((rows as any).rows?.[0]?.active_count || 0);

  // Highest tier index reached (0-indexed). tiers are stored 1-indexed in
  // agentTierAwardedLevel (0 = "none awarded today").
  let reached = -1;
  for (let i = 0; i < tiers.length; i++) {
    if (activeCount >= tiers[i].minActiveDeposits) reached = i;
  }
  if (reached < 0) return;
  const newLevel = reached + 1;

  // Sum reward across every tier band we're claiming this run. To keep the
  // total deterministic and race-safe, we always sum from level 1 → newLevel
  // and use the conditional UPDATE below to ensure we only credit the DELTA
  // that wasn't credited yet. Two concurrent runs can both compute the same
  // newLevel — only the first WHERE-matching UPDATE will affect a row, the
  // second sees agent_tier_awarded_level >= newLevel and is a no-op.
  let cumulativeReward = 0;
  const labels: string[] = [];
  for (let i = 0; i < newLevel; i++) {
    cumulativeReward += tiers[i].reward;
    labels.push(tiers[i].label);
  }
  cumulativeReward = parseFloat(cumulativeReward.toFixed(2));

  // Compute previously-credited reward today so we only add the delta.
  const awardedDate = agent.agentTierAwardedDate ? String(agent.agentTierAwardedDate).slice(0, 10) : null;
  const isSameDay = awardedDate === today;
  const previousLevel = isSameDay ? (agent.agentTierAwardedLevel || 0) : 0;
  if (newLevel <= previousLevel) return; // Nothing to upgrade.

  let alreadyPaid = 0;
  for (let i = 0; i < previousLevel; i++) alreadyPaid += tiers[i].reward;
  const delta = parseFloat((cumulativeReward - alreadyPaid).toFixed(2));

  // Conditional update: only succeeds when the agent's row still reflects a
  // strictly-lower level for today (or a stale day). This makes the read →
  // compute → write idempotent across concurrent settlements.
  const updated = await db
    .update(usersTable)
    .set({
      balance: sql`${usersTable.balance} + ${delta}`,
      isVerifiedAgent: true,
      agentTierAwardedDate: today,
      agentTierAwardedLevel: newLevel,
    })
    .where(and(
      eq(usersTable.id, agentId),
      or(
        isNull(usersTable.agentTierAwardedDate),
        sql`${usersTable.agentTierAwardedDate} <> ${today}`,
        lt(usersTable.agentTierAwardedLevel, newLevel),
      ),
    ))
    .returning({ id: usersTable.id });

  if (updated.length === 0) {
    // Concurrent race — another evaluation already credited at least this
    // level. Nothing to do.
    return;
  }

  if (delta > 0) {
    await db.insert(transactionsTable).values({
      userId: agentId,
      type: "credit",
      amount: String(delta),
      description: `Agent Reward: ${labels.slice(previousLevel).join(", ")} (${activeCount} active invitees today)`,
    });
  }
  logger.info({ agentId, activeCount, newLevel, delta }, "agent tier awarded");
}
