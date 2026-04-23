-- ============================================================================
-- TrustPay — Complete Supabase Setup (idempotent)
-- Paste this entire file into Supabase → SQL Editor → Run.
-- Safe to run multiple times. It will not duplicate or overwrite data.
-- ============================================================================

-- ── Enums (create only if missing) ──────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE fraud_severity AS ENUM ('info','low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Core: users ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE,
  password TEXT,
  phone TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_install_app BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified_agent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_tier_awarded_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_tier_awarded_level INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unique ON users(google_sub) WHERE google_sub IS NOT NULL;

-- Backfill username from phone for legacy rows
UPDATE users SET username = phone
WHERE (username IS NULL OR username = '') AND phone IS NOT NULL AND phone <> '';

-- Seed default admin (admin / password) if missing
INSERT INTO users (username, password, role)
SELECT 'admin', 'password', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

-- ── Orders ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  buyer_id INTEGER REFERENCES users(id),
  seller_id INTEGER REFERENCES users(id),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS held_amount NUMERIC(12,2) NOT NULL DEFAULT '0';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ocr_utr TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ocr_amount TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ocr_timestamp TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ocr_bank TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ocr_raw_text TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ocr_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ocr_amount_match TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ocr_utr_match TEXT;

-- ── device_fingerprints ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS device_fingerprints (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  fingerprint TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE device_fingerprints ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE device_fingerprints ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE device_fingerprints ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP NOT NULL DEFAULT NOW();
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='device_fingerprints' AND column_name='ip_address') THEN
    UPDATE device_fingerprints SET ip = COALESCE(ip, ip_address);
    ALTER TABLE device_fingerprints DROP COLUMN ip_address;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS device_fingerprints_fp_idx ON device_fingerprints(fingerprint);
CREATE INDEX IF NOT EXISTS device_fingerprints_user_idx ON device_fingerprints(user_id);

-- ── high_value_events ───────────────────────────────────────────────────────
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
);
CREATE INDEX IF NOT EXISTS high_value_events_user_idx ON high_value_events(user_id);
CREATE INDEX IF NOT EXISTS high_value_events_tier_idx ON high_value_events(tier);
CREATE INDEX IF NOT EXISTS high_value_events_created_idx ON high_value_events(created_at);

-- ── fraud_alerts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fraud_alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  order_id INTEGER,
  kind TEXT NOT NULL,
  severity fraud_severity NOT NULL DEFAULT 'info',
  details TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE fraud_alerts ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP;
ALTER TABLE fraud_alerts ADD COLUMN IF NOT EXISTS notified_by INTEGER;

-- ── user_notifications ──────────────────────────────────────────────────────
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
);
CREATE INDEX IF NOT EXISTS user_notifications_user_idx ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS user_notifications_read_idx ON user_notifications(user_id, read_at);

-- ── SMS Safe Learning ───────────────────────────────────────────────────────
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
);
ALTER TABLE sms_learning_queue ADD COLUMN IF NOT EXISTS reason TEXT;
CREATE INDEX IF NOT EXISTS sms_queue_sender_key_idx ON sms_learning_queue(sender_key);
CREATE INDEX IF NOT EXISTS sms_queue_template_hash_idx ON sms_learning_queue(template_hash);
CREATE INDEX IF NOT EXISTS sms_queue_status_idx ON sms_learning_queue(status);

CREATE TABLE IF NOT EXISTS sms_safe_senders (
  id SERIAL PRIMARY KEY,
  sender_key TEXT NOT NULL,
  label TEXT,
  added_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS sms_safe_senders_key_unique ON sms_safe_senders(sender_key);

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
);
CREATE UNIQUE INDEX IF NOT EXISTS sms_candidates_hash_unique ON sms_candidate_patterns(sender_key, template_hash);

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
);
CREATE UNIQUE INDEX IF NOT EXISTS sms_active_patterns_dedup ON sms_active_patterns(sender_key, utr_regex);

-- ── settings (key/value) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Cleanup duplicate admin (id=22) ─────────────────────────────────────────
DELETE FROM users WHERE id = 22 AND role = 'admin';

-- ── Done ────────────────────────────────────────────────────────────────────
SELECT 'TrustPay schema setup complete' AS status;
