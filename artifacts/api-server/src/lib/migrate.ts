import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";

/**
 * Idempotent raw-SQL bootstrap. Tables here are kept in sync with
 * `lib/db/src/schema/devices.ts` and friends. Safe to run on every start.
 */
export async function ensureSchema(): Promise<void> {
  try {
    // device_fingerprints — must match deviceFingerprintsTable in devices.ts
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS device_fingerprints (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        fingerprint TEXT NOT NULL,
        ip TEXT,
        user_agent TEXT,
        last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    // Heal any older table created by a previous bootstrap with wrong column names.
    await db.execute(sql`ALTER TABLE device_fingerprints ADD COLUMN IF NOT EXISTS ip TEXT`);
    await db.execute(sql`ALTER TABLE device_fingerprints ADD COLUMN IF NOT EXISTS user_agent TEXT`);
    await db.execute(sql`ALTER TABLE device_fingerprints ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP NOT NULL DEFAULT NOW()`);
    // Migrate legacy ip_address -> ip if present.
    await db.execute(sql`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='device_fingerprints' AND column_name='ip_address') THEN
          UPDATE device_fingerprints SET ip = COALESCE(ip, ip_address);
          ALTER TABLE device_fingerprints DROP COLUMN ip_address;
        END IF;
      END $$;
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS device_fingerprints_fp_idx ON device_fingerprints(fingerprint)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS device_fingerprints_user_idx ON device_fingerprints(user_id)`);

    // high_value_events — must match highValueEventsTable in devices.ts
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS high_value_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        order_id INTEGER,
        amount TEXT NOT NULL,
        tier TEXT NOT NULL,
        reviewed_by INTEGER,
        reviewed_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS high_value_events_user_idx ON high_value_events(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS high_value_events_tier_idx ON high_value_events(tier)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS high_value_events_created_idx ON high_value_events(created_at)`);

    // orders.held_amount — per-order reservation tracking. Defaults to 0
    // for any pre-existing rows so legacy locks behave correctly in
    // settle/release paths (they treat 0 as "nothing to release/debit
    // from heldBalance, debit balance directly at settle time").
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS held_amount NUMERIC(12,2) NOT NULL DEFAULT '0'`);

    // Backfill: legacy users created before username column was required —
    // ensure username is populated (fall back to phone). Preserves uniqueness
    // because phone is itself unique.
    await db.execute(sql`
      UPDATE users SET username = phone
      WHERE (username IS NULL OR username = '') AND phone IS NOT NULL AND phone <> ''
    `);

    // users.must_install_app — gates the post-registration Android APK
    // install lock. Default false so existing users aren't suddenly locked
    // out; the register handler explicitly sets it true for new accounts and
    // /auth/me clears it once the user signs in from inside the APK.
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_install_app BOOLEAN NOT NULL DEFAULT false`);

    // fraud_alerts — add notification tracking columns
    await db.execute(sql`ALTER TABLE fraud_alerts ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE fraud_alerts ADD COLUMN IF NOT EXISTS notified_by INTEGER`);

    // user_notifications — must match userNotificationsTable in p2p.ts
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        severity fraud_severity NOT NULL DEFAULT 'info',
        fraud_alert_id INTEGER,
        read_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS user_notifications_user_idx ON user_notifications(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS user_notifications_read_idx ON user_notifications(user_id, read_at)`);

    logger.info("ensureSchema OK");
  } catch (err) {
    logger.error({ err }, "ensureSchema failed");
  }
}
