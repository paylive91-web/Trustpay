import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";

/**
 * Auto-cleanup of learning tables to keep memory & DB lean.
 *
 * The learning tables (image_hashes, utr_index, sms_learning_queue,
 * admin_logs) grow unboundedly over time. On a 512MB Render instance, an
 * unbounded table forces every duplicate-check / stats query to scan more
 * rows → more memory pressure → OOM.
 *
 * Policy (system-wide, runs every 6 hours + at boot):
 *
 *  - image_hashes: keep VERIFIED rows (legitimate fraud reference) for 30
 *    days; UNVERIFIED rows (most are noise) for 7 days. Hard cap: 5000 most
 *    recent rows total — anything older is deleted.
 *
 *  - utr_index: keep VERIFIED UTRs for 60 days (these are the actual fraud
 *    signal — same UTR reused across orders). Unverified for 7 days. Hard
 *    cap: 5000 rows.
 *
 *  - sms_learning_queue: rows with status='promoted' or status='rejected'
 *    older than 7 days are dead weight (the pattern was already learned or
 *    discarded). Pending older than 30 days is stale. Hard cap: 2000 rows.
 *
 *  - admin_logs: keep last 30 days only.
 *
 * The intent: the system *learns the patterns* (kept in code as fraud rules
 * and SMS templates) and then *forgets the raw data* — exactly the user's
 * requirement that "nothing should stay in the system causing load."
 */

async function cleanImageHashes() {
  // Delete unverified screenshots older than 7 days
  const r1 = await db.execute(sql`
    DELETE FROM image_hashes
    WHERE verified_at IS NULL
      AND created_at < NOW() - INTERVAL '7 days'
  `);
  // Delete verified screenshots older than 30 days
  const r2 = await db.execute(sql`
    DELETE FROM image_hashes
    WHERE verified_at IS NOT NULL
      AND created_at < NOW() - INTERVAL '30 days'
  `);
  // Hard cap: keep only the 5000 most recent rows
  const r3 = await db.execute(sql`
    DELETE FROM image_hashes
    WHERE id IN (
      SELECT id FROM image_hashes
      ORDER BY created_at DESC
      OFFSET 5000
    )
  `);
  return { unverified: rowCount(r1), verified: rowCount(r2), capped: rowCount(r3) };
}

async function cleanUtrIndex() {
  const r1 = await db.execute(sql`
    DELETE FROM utr_index
    WHERE verified_at IS NULL
      AND created_at < NOW() - INTERVAL '7 days'
  `);
  const r2 = await db.execute(sql`
    DELETE FROM utr_index
    WHERE verified_at IS NOT NULL
      AND created_at < NOW() - INTERVAL '60 days'
  `);
  const r3 = await db.execute(sql`
    DELETE FROM utr_index
    WHERE id IN (
      SELECT id FROM utr_index
      ORDER BY created_at DESC
      OFFSET 5000
    )
  `);
  return { unverified: rowCount(r1), verified: rowCount(r2), capped: rowCount(r3) };
}

async function cleanSmsLearningQueue() {
  // Promoted/rejected rows older than 7 days — pattern already learned
  const r1 = await db.execute(sql`
    DELETE FROM sms_learning_queue
    WHERE status IN ('promoted', 'rejected')
      AND created_at < NOW() - INTERVAL '7 days'
  `);
  // Pending older than 30 days — stale
  const r2 = await db.execute(sql`
    DELETE FROM sms_learning_queue
    WHERE status = 'pending'
      AND created_at < NOW() - INTERVAL '30 days'
  `);
  // Hard cap: 2000 rows
  const r3 = await db.execute(sql`
    DELETE FROM sms_learning_queue
    WHERE id IN (
      SELECT id FROM sms_learning_queue
      ORDER BY created_at DESC
      OFFSET 2000
    )
  `);
  return { resolved: rowCount(r1), staleP: rowCount(r2), capped: rowCount(r3) };
}

async function cleanAdminLogs() {
  const r = await db.execute(sql`
    DELETE FROM admin_logs
    WHERE created_at < NOW() - INTERVAL '30 days'
  `);
  return { old: rowCount(r) };
}

function rowCount(result: unknown): number {
  const r = result as { rowCount?: number; count?: number };
  return r?.rowCount ?? r?.count ?? 0;
}

export async function runLearningCleanup() {
  const start = Date.now();
  try {
    const [images, utrs, sms, logs] = await Promise.all([
      cleanImageHashes().catch((err) => { logger.warn({ err }, "cleanImageHashes failed"); return null; }),
      cleanUtrIndex().catch((err) => { logger.warn({ err }, "cleanUtrIndex failed"); return null; }),
      cleanSmsLearningQueue().catch((err) => { logger.warn({ err }, "cleanSmsLearningQueue failed"); return null; }),
      cleanAdminLogs().catch((err) => { logger.warn({ err }, "cleanAdminLogs failed"); return null; }),
    ]);
    // Reclaim space periodically (lightweight; no exclusive lock).
    await db.execute(sql`VACUUM (ANALYZE) image_hashes, utr_index, sms_learning_queue, admin_logs`)
      .catch(() => { /* VACUUM may fail mid-transaction in some configs; ignore */ });
    logger.info({ images, utrs, sms, logs, ms: Date.now() - start }, "Learning cleanup complete");
  } catch (err) {
    logger.error({ err }, "Learning cleanup failed");
  }
}

let cleanupTimer: NodeJS.Timeout | null = null;

export function startLearningCleanupJob() {
  if (cleanupTimer) return;
  // Run once shortly after boot (after migrations settle), then every 6 hours.
  setTimeout(() => { void runLearningCleanup(); }, 60_000);
  cleanupTimer = setInterval(() => { void runLearningCleanup(); }, 6 * 60 * 60 * 1000);
  logger.info("Learning auto-cleanup job scheduled (every 6 hours)");
}
