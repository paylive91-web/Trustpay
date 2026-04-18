import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const deviceFingerprintsTable = pgTable("device_fingerprints", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  fingerprint: text("fingerprint").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const highValueEventsTable = pgTable("high_value_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  orderId: integer("order_id"),
  amount: text("amount").notNull(),
  tier: text("tier").notNull(), // "warn" | "critical"
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type DeviceFingerprint = typeof deviceFingerprintsTable.$inferSelect;
export type HighValueEvent = typeof highValueEventsTable.$inferSelect;
