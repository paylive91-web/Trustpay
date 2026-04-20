import { pgTable, serial, integer, numeric, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const orderTypeEnum = pgEnum("order_type", ["deposit", "withdrawal"]);
// Status flow:
// available -> locked (buyer locks chunk, 15min) -> pending_confirmation (buyer submitted UTR) -> confirmed | disputed
// disputed -> confirmed | refunded (admin or auto)
// also: expired, cancelled, rejected, approved, pending (legacy)
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "approved",
  "rejected",
  "available",
  "locked",
  "pending_confirmation",
  "confirmed",
  "disputed",
  "refunded",
  "expired",
  "cancelled",
]);

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  type: orderTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  // Amount actually moved to seller.heldBalance at lock time. 0 for legacy
  // locks created before held-balance semantics — use this instead of
  // global heldBalance to decide what to release/debit per-order.
  heldAmount: numeric("held_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  rewardPercent: numeric("reward_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  rewardAmount: numeric("reward_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  status: orderStatusEnum("status").notNull().default("pending"),
  upiId: text("upi_id"),
  upiName: text("upi_name"),
  userUpiId: text("user_upi_id"),
  userUpiName: text("user_upi_name"),
  userName: text("user_name"),
  utrNumber: text("utr_number"),
  screenshotUrl: text("screenshot_url"),
  recordingUrl: text("recording_url"),
  notes: text("notes"),
  // Per-chunk platform fee, computed from feeTiers at chunk creation. Only
  // charged when the chunk successfully settles (status -> confirmed). If the
  // chunk expires/cancels, no fee is charged. Stored on the order so admin
  // tier-edits after creation don't change what gets charged at settle time.
  feeAmount: numeric("fee_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  // P2P chunk fields
  parentSellId: integer("parent_sell_id"),
  lockedAt: timestamp("locked_at"),
  lockedByUserId: integer("locked_by_user_id"),
  submittedAt: timestamp("submitted_at"),
  confirmDeadline: timestamp("confirm_deadline"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
