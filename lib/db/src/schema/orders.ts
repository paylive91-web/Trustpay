import { pgTable, serial, integer, numeric, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const orderTypeEnum = pgEnum("order_type", ["deposit", "withdrawal"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "approved", "rejected"]);

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  type: orderTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
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
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
