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
export type PremiumSource = "market" | "theoretical" | "manual";

// Represents a closing transaction for an option leg
export interface ClosingTransaction {
  quantity: number;        // Number of contracts to close
  closingPrice: number;    // Price at which to close
  isEnabled: boolean;      // Whether this closing transaction is active
}

export interface OptionLeg {
  id: string;
  type: OptionType;
  position: PositionType;
  strike: number;
  quantity: number;
  premium: number;
  expirationDays: number;
  marketQuoteId?: string;
  premiumSource?: PremiumSource;
  impliedVolatility?: number;
  // New fields for advanced features
  expirationDate?: string;         // ISO date string for expiration
  isExcluded?: boolean;            // Whether to exclude from P/L calculations
  closingTransaction?: ClosingTransaction; // Closing transaction details
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

export interface MarketOptionQuote {
  optionSymbol: string;
  underlying: string;
  expiration: number;
  side: OptionType;
  strike: number;
  bid: number;
  bidSize: number;
  mid: number;
  ask: number;
  askSize: number;
  last: number;
  openInterest: number;
  volume: number;
  inTheMoney: boolean;
  intrinsicValue: number;
  extrinsicValue: number;
  underlyingPrice: number;
  iv?: number; // Optional - calculated client-side if not provided by API
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  dte: number;
  updated: number;
}

export interface MarketOptionChainSummary {
  symbol: string;
  expirations: string[];
  minStrike: number;
  maxStrike: number;
  quotes: MarketOptionQuote[];
  cachedAt: number;
  availableExpirations?: string[]; // Available expirations from data source (for validation)
}
