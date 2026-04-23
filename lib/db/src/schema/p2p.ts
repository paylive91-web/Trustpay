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
  // "seller_offline" = auto-dispute raised because seller went offline during lock
  triggerReason: text("trigger_reason"),
  status: disputeStatusEnum("status").notNull().default("open"),
  buyerBankStatementUrl: text("buyer_bank_statement_url"),
  // Buyer's last 3 transactions screenshot (for seller_offline disputes)
  buyerTxHistoryUrl: text("buyer_tx_history_url"),
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

export const adminLogsTable = pgTable("admin_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull().references(() => usersTable.id),
  actionType: text("action_type").notNull(),
  targetType: text("target_type"),
  targetId: integer("target_id"),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tradePairBlocksTable = pgTable("trade_pair_blocks", {
  id: serial("id").primaryKey(),
  userId1: integer("user_id_1").notNull().references(() => usersTable.id),
  userId2: integer("user_id_2").notNull().references(() => usersTable.id),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const smsLearningQueueTable = pgTable("sms_learning_queue", {
  id: serial("id").primaryKey(),
  sender: text("sender").notNull(),
  senderKey: text("sender_key").notNull(),
  body: text("body").notNull(),
  bucket: text("bucket").notNull(),
  parsedUtr: text("parsed_utr"),
  parsedAmount: text("parsed_amount"),
  isDebit: boolean("is_debit").notNull().default(false),
  hasReversal: boolean("has_reversal").notNull().default(false),
  templateBody: text("template_body"),
  templateHash: text("template_hash"),
  userId: integer("user_id").references(() => usersTable.id),
  status: text("status").notNull().default("pending"),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const smsSafeSendersTable = pgTable("sms_safe_senders", {
  id: serial("id").primaryKey(),
  senderKey: text("sender_key").notNull(),
  label: text("label"),
  addedBy: integer("added_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const smsCandidatePatternsTable = pgTable("sms_candidate_patterns", {
  id: serial("id").primaryKey(),
  senderKey: text("sender_key").notNull(),
  templateHash: text("template_hash").notNull(),
  templateBody: text("template_body").notNull(),
  utrSample: text("utr_sample"),
  amountSample: text("amount_sample"),
  sampleCount: integer("sample_count").notNull().default(0),
  sampleIds: text("sample_ids"),
  status: text("status").notNull().default("proposed"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const smsActivePatternsTable = pgTable("sms_active_patterns", {
  id: serial("id").primaryKey(),
  senderKey: text("sender_key").notNull(),
  templateLabel: text("template_label").notNull(),
  utrRegex: text("utr_regex").notNull(),
  amountRegex: text("amount_regex").notNull(),
  creditOnly: boolean("credit_only").notNull().default(true),
  reversalBlocked: boolean("reversal_blocked").notNull().default(true),
  sourceCandidateId: integer("source_candidate_id"),
  createdBy: integer("created_by").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type UserUpiIdRow = typeof userUpiIdsTable.$inferSelect;
export type Dispute = typeof disputesTable.$inferSelect;
export type FraudAlert = typeof fraudAlertsTable.$inferSelect;
export type TrustEvent = typeof trustEventsTable.$inferSelect;
export type UserNotification = typeof userNotificationsTable.$inferSelect;
export type AdminLog = typeof adminLogsTable.$inferSelect;
export type TradePairBlock = typeof tradePairBlocksTable.$inferSelect;
export type SmsLearningQueue = typeof smsLearningQueueTable.$inferSelect;
export type SmsSafeSender = typeof smsSafeSendersTable.$inferSelect;
export type SmsCandidatePattern = typeof smsCandidatePatternsTable.$inferSelect;
export type SmsActivePattern = typeof smsActivePatternsTable.$inferSelect;
