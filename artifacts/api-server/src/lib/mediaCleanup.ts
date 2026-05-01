import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";

/**
 * Auto-cleanup of payment media (screenshots, videos, dispute proofs).
 *
 * Policy decided with the user (Hinglish translation):
 *
 *   1. Buyer payment screenshots — once the seller confirms the order,
 *      keep the screenshot for 5 minutes (so the seller can re-open the
 *      receipt one last time if needed) and then delete it from the DB.
 *      The OCR result text is preserved forever; only the raw image bytes
 *      are dropped.
 *
 *   2. Disputes — keep the linked order's screenshot, plus the dispute's
 *      bank-statement / recording / last-txn screenshot proofs, for 24
 *      hours after the dispute was opened. After that the user is
 *      expected to send fresh proofs to TrustPay support on Telegram, so
 *      retaining them in the DB is pure dead weight.
 *
 * Net effect: the DB only ever holds screenshots/videos for active orders
 * that haven't been confirmed yet (max ~minutes), plus a 5-minute tail
 * after confirmation, plus a 24-hour tail for active disputes. Everything
 * else is NULL.
 *
 * NOTE: We use UPDATE ... SET column = NULL rather than DELETE rows so
 * that the audit trail (UTR, OCR result, status, amounts) survives. Only
 * the heavy media bytes are removed. Postgres autovacuum will reclaim the
 * physical disk space in the background.
 */

function rowCount(result: unknown): number {
  const r = result as { rowCount?: number; count?: number };
  return r?.rowCount ?? r?.count ?? 0;
}

/**
 * Clean buyer payment media for orders that the seller already confirmed
 * more than 5 minutes ago. Also defensively scrubs cancelled/expired
 * orders after the same window — there's no reason to keep those proofs
 * either.
 */
async function cleanConfirmedOrderMedia() {
  const r = await db.execute(sql`
    UPDATE orders
       SET screenshot_url = NULL,
           recording_url  = NULL
     WHERE (screenshot_url IS NOT NULL OR recording_url IS NOT NULL)
       AND (
            (confirmed_at IS NOT NULL AND confirmed_at < NOW() - INTERVAL '5 minutes')
         OR (status IN ('cancelled', 'expired', 'refunded')
             AND updated_at < NOW() - INTERVAL '5 minutes')
       )
  `);
  return rowCount(r);
}

/**
 * Clean every dispute-side proof column 24 hours after the dispute was
 * opened. These columns may not exist on every deployment (older schemas)
 * — if a column is missing, the DO block silently skips it so the job
 * never crashes the server.
 */
async function cleanDisputeMedia() {
  const r = await db.execute(sql`
    DO $$
    DECLARE
      cols text[] := ARRAY[
        'buyer_bank_statement_url',
        'buyer_tx_history_url',
        'buyer_recording_url',
        'seller_bank_statement_url',
        'seller_recording_url',
        'seller_last_txn_screenshot_url'
      ];
      c text;
      sets text := '';
    BEGIN
      FOREACH c IN ARRAY cols LOOP
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_name = 'p2p_disputes' AND column_name = c
        ) THEN
          IF length(sets) > 0 THEN sets := sets || ', '; END IF;
          sets := sets || c || ' = NULL';
        END IF;
      END LOOP;
      IF length(sets) > 0 THEN
        EXECUTE format(
          'UPDATE p2p_disputes SET %s WHERE created_at < NOW() - INTERVAL ''24 hours'' AND (%s)',
          sets,
          (SELECT string_agg(c2 || ' IS NOT NULL', ' OR ') FROM unnest(cols) c2 WHERE EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_name = 'p2p_disputes' AND column_name = c2
          ))
        );
      END IF;
    END $$;
  `);
  return rowCount(r);
}

/**
 * Also clean the underlying order's screenshot for orders that have a
 * dispute opened more than 24 hours ago. The 5-minute rule above won't
 * touch these because disputed orders typically aren't in 'confirmed'
 * status.
 */
async function cleanDisputedOrderMedia() {
  const r = await db.execute(sql`
    UPDATE orders o
       SET screenshot_url = NULL,
           recording_url  = NULL
      FROM p2p_disputes d
     WHERE d.order_id = o.id
       AND d.created_at < NOW() - INTERVAL '24 hours'
       AND (o.screenshot_url IS NOT NULL OR o.recording_url IS NOT NULL)
  `);
  return rowCount(r);
}

export async function runMediaCleanup() {
  const start = Date.now();
  try {
    const confirmedCleared = await cleanConfirmedOrderMedia()
      .catch((err) => { logger.warn({ err }, "cleanConfirmedOrderMedia failed"); return 0; });
    const disputeCleared = await cleanDisputeMedia()
      .catch((err) => { logger.warn({ err }, "cleanDisputeMedia failed"); return 0; });
    const disputedOrderCleared = await cleanDisputedOrderMedia()
      .catch((err) => { logger.warn({ err }, "cleanDisputedOrderMedia failed"); return 0; });

    if (confirmedCleared || disputeCleared || disputedOrderCleared) {
      logger.info(
        { confirmedCleared, disputeCleared, disputedOrderCleared, ms: Date.now() - start },
        "Media cleanup complete",
      );
    }
  } catch (err) {
    logger.error({ err }, "Media cleanup failed");
  }
}

let mediaCleanupTimer: NodeJS.Timeout | null = null;

export function startMediaCleanupJob() {
  if (mediaCleanupTimer) return;
  // Run shortly after boot (catches anything left over from previous
  // deploys) and then every 2 minutes so the 5-minute SLA on confirmed
  // orders is honoured tightly.
  setTimeout(() => { void runMediaCleanup(); }, 30_000);
  mediaCleanupTimer = setInterval(() => { void runMediaCleanup(); }, 2 * 60 * 1000);
  logger.info("Media auto-cleanup job scheduled (every 2 minutes)");
}
