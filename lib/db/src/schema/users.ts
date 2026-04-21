import { pgTable, serial, text, numeric, timestamp, pgEnum, integer, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phone: text("phone"),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  heldBalance: numeric("held_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  totalDeposits: numeric("total_deposits", { precision: 12, scale: 2 }).notNull().default("0"),
  totalWithdrawals: numeric("total_withdrawals", { precision: 12, scale: 2 }).notNull().default("0"),
  inviteEarnings: numeric("invite_earnings", { precision: 12, scale: 2 }).notNull().default("0"),
  inviteEarningsL2: numeric("invite_earnings_l2", { precision: 12, scale: 2 }).notNull().default("0"),
  referralCode: text("referral_code").unique(),
  referredBy: integer("referred_by"),
  role: userRoleEnum("role").notNull().default("user"),
  trustScore: integer("trust_score").notNull().default(0),
  successfulTrades: integer("successful_trades").notNull().default(0),
  isBlocked: boolean("is_blocked").notNull().default(false),
  blockedReason: text("blocked_reason"),
  blockedAt: timestamp("blocked_at"),
  isFrozen: boolean("is_frozen").notNull().default(false),
  fraudWarningCount: integer("fraud_warning_count").notNull().default(0),
  autoSellEnabled: boolean("auto_sell_enabled").notNull().default(false),
  email: text("email"),
  googleSub: text("google_sub").unique(),
  // True until the user logs in from a request whose User-Agent contains the
  // Capacitor APK marker ("TrustPayAndroid"). Drives the post-registration
  // install lock; flipped back to false on the first authenticated request
  // from inside the APK so the lock disappears across all of the user's
  // browsers.
  mustInstallApp: boolean("must_install_app").notNull().default(false),
  lastSeenAt: timestamp("last_seen_at"),
  matchingExpiresAt: timestamp("matching_expires_at"),
  displayName: text("display_name"),
  // Agent reward tier system. isVerifiedAgent stays true once any tier has
  // ever been earned (drives the red "Verified Agent" badge on home).
  // The "awarded" pair is reset at the top of each day so an agent can
  // claim a higher tier as their daily active-deposit count grows, but
  // can't double-claim the same tier within a single day.
  isVerifiedAgent: boolean("is_verified_agent").notNull().default(false),
  agentTierAwardedDate: date("agent_tier_awarded_date"),
  agentTierAwardedLevel: integer("agent_tier_awarded_level").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
