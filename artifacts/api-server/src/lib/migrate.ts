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

    // orders OCR fields — populated by Tesseract.js after screenshot submission
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS ocr_utr TEXT`);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS ocr_amount TEXT`);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS ocr_timestamp TEXT`);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS ocr_bank TEXT`);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS ocr_raw_text TEXT`);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS ocr_status TEXT`);
    // Persisted match outcomes for immutable audit trail
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS ocr_amount_match TEXT`);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS ocr_utr_match TEXT`);

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

    // Google verification: bind the user account to a verified Gmail.
    //  - email: verified address from Google ID token
    //  - google_sub: Google's stable per-user subject id; UNIQUE so the same
    //    Gmail can't bind to two TrustPay accounts.
    // Forgot-password reset gates on a non-null google_sub (account "verified").
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unique ON users(google_sub) WHERE google_sub IS NOT NULL`);

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

    // Agent reward tiers — must match users.ts schema additions.
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified_agent BOOLEAN NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_tier_awarded_date DATE`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_tier_awarded_level INTEGER NOT NULL DEFAULT 0`);

    // ── SMS Safe Learning tables ──────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sms_learning_queue (
        id SERIAL PRIMARY KEY,
        sender TEXT NOT NULL,
        sender_key TEXT NOT NULL,
        body TEXT NOT NULL,
        bucket TEXT NOT NULL,
        parsed_utr TEXT,
        parsed_amount TEXT,
        is_debit BOOLEAN NOT NULL DEFAULT false,
        has_reversal BOOLEAN NOT NULL DEFAULT false,
        template_body TEXT,
        template_hash TEXT,
        user_id INTEGER REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS sms_queue_sender_key_idx ON sms_learning_queue(sender_key)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS sms_queue_template_hash_idx ON sms_learning_queue(template_hash)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS sms_queue_status_idx ON sms_learning_queue(status)`);
    await db.execute(sql`ALTER TABLE sms_learning_queue ADD COLUMN IF NOT EXISTS reason TEXT`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sms_safe_senders (
        id SERIAL PRIMARY KEY,
        sender_key TEXT NOT NULL,
        label TEXT,
        added_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS sms_safe_senders_key_unique ON sms_safe_senders(sender_key)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sms_candidate_patterns (
        id SERIAL PRIMARY KEY,
        sender_key TEXT NOT NULL,
        template_hash TEXT NOT NULL,
        template_body TEXT NOT NULL,
        utr_sample TEXT,
        amount_sample TEXT,
        sample_count INTEGER NOT NULL DEFAULT 0,
        sample_ids TEXT,
        status TEXT NOT NULL DEFAULT 'proposed',
        reviewed_by INTEGER,
        reviewed_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS sms_candidates_hash_unique ON sms_candidate_patterns(sender_key, template_hash)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sms_active_patterns (
        id SERIAL PRIMARY KEY,
        sender_key TEXT NOT NULL,
        template_label TEXT NOT NULL,
        utr_regex TEXT NOT NULL,
        amount_regex TEXT NOT NULL,
        credit_only BOOLEAN NOT NULL DEFAULT true,
        reversal_blocked BOOLEAN NOT NULL DEFAULT true,
        source_candidate_id INTEGER,
        created_by INTEGER NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS sms_active_patterns_dedup ON sms_active_patterns(sender_key, utr_regex)`);

    // ── One-time cleanup: remove duplicate admin account (ID 22, username "admin") ──
    // The real admin is ID 1 ("Storehsswis"). ID 22 is a leftover duplicate with
    // no rows in any FK-constrained table, so a direct delete is safe.
    // Scoped tightly to id=22 AND role='admin' — no-op if the user doesn't exist.
    await db.execute(sql`
      DELETE FROM users WHERE id = 22 AND role = 'admin'
    `);

    logger.info("ensureSchema OK");
  } catch (err) {
    logger.error({ err }, "ensureSchema failed");
  }
}
