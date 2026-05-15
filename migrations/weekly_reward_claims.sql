CREATE TABLE IF NOT EXISTS weekly_reward_claims (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  week_start DATE NOT NULL,
  tier_index INTEGER NOT NULL,
  reward_amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_reward_claims_user_week
  ON weekly_reward_claims(user_id, week_start);
