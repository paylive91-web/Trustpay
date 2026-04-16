import { pgTable, serial, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const depositTasksTable = pgTable("deposit_tasks", {
  id: serial("id").primaryKey(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  rewardPercent: numeric("reward_percent", { precision: 5, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDepositTaskSchema = createInsertSchema(depositTasksTable).omit({ id: true, createdAt: true });
export type InsertDepositTask = z.infer<typeof insertDepositTaskSchema>;
export type DepositTask = typeof depositTasksTable.$inferSelect;
