import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type OptionType = "call" | "put";
export type PositionType = "long" | "short";

export interface OptionLeg {
  id: string;
  type: OptionType;
  position: PositionType;
  strike: number;
  quantity: number;
  premium: number;
  expirationDays: number;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  legs: OptionLeg[];
  underlyingPrice: number;
}

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

export interface StrategyMetrics {
  maxProfit: number | null;
  maxLoss: number | null;
  breakeven: number[];
  netPremium: number;
  riskRewardRatio: number | null;
}
