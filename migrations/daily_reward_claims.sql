-- Migration: Create daily_reward_claims table for Daily Task Reward feature
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS daily_reward_claims (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  claim_date DATE NOT NULL,
  tier_index INTEGER NOT NULL,
  reward_amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, claim_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_reward_claims_user_date
  ON daily_reward_claims(user_id, claim_date);
