import { pgTable, serial, integer, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { ordersTable } from "./orders";

export const userUpiIdsTable = pgTable("user_upi_ids", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  upiId: text("upi_id").notNull(),
  platform: text("platform").notNull(),
  bankName: text("bank_name").notNull(),
  holderName: text("holder_name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const disputeStatusEnum = pgEnum("dispute_status", [
  "open",
  "buyer_won",
  "seller_won",
  "auto_resolved",
]);

export const disputesTable = pgTable("disputes", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  buyerId: integer("buyer_id").notNull().references(() => usersTable.id),
  sellerId: integer("seller_id").notNull().references(() => usersTable.id),
  reason: text("reason"),
  status: disputeStatusEnum("status").notNull().default("open"),
  buyerBankStatementUrl: text("buyer_bank_statement_url"),
  sellerBankStatementUrl: text("seller_bank_statement_url"),
  sellerRecordingUrl: text("seller_recording_url"),
  sellerLastTxnScreenshotUrl: text("seller_last_txn_screenshot_url"),
  buyerProofDeadline: timestamp("buyer_proof_deadline"),
  sellerProofDeadline: timestamp("seller_proof_deadline"),
  buyerProofAt: timestamp("buyer_proof_at"),
  sellerProofAt: timestamp("seller_proof_at"),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: integer("resolved_by"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const fraudSeverityEnum = pgEnum("fraud_severity", ["info", "warn", "critical"]);

export const fraudAlertsTable = pgTable("fraud_alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  orderId: integer("order_id").references(() => ordersTable.id),
  rule: text("rule").notNull(),
  severity: fraudSeverityEnum("severity").notNull().default("warn"),
  evidence: text("evidence"),
  resolved: boolean("resolved").notNull().default(false),
  notifiedAt: timestamp("notified_at"),
  notifiedBy: integer("notified_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userNotificationsTable = pgTable("user_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  severity: fraudSeverityEnum("severity").notNull().default("info"),
  fraudAlertId: integer("fraud_alert_id"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const trustEventsTable = pgTable("trust_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  orderId: integer("order_id").references(() => ordersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const utrIndexTable = pgTable("utr_index", {
  id: serial("id").primaryKey(),
  utr: text("utr").notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const imageHashesTable = pgTable("image_hashes", {
  id: serial("id").primaryKey(),
  hash: text("hash").notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  kind: text("kind").notNull(), // "screenshot" | "recording"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type UserUpiIdRow = typeof userUpiIdsTable.$inferSelect;
export type Dispute = typeof disputesTable.$inferSelect;
export type FraudAlert = typeof fraudAlertsTable.$inferSelect;
export type TrustEvent = typeof trustEventsTable.$inferSelect;
export type UserNotification = typeof userNotificationsTable.$inferSelect;
