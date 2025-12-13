import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type OptionType = "call" | "put";
export type PositionType = "long" | "short";
export type PremiumSource = "market" | "theoretical" | "manual" | "saved";

// Represents a single closing transaction (partial close)
export interface ClosingEntry {
  id: string;              // Unique ID for this closing entry
  quantity: number;        // Number of contracts closed in this transaction
  closingPrice: number;    // Price at which contracts were closed
  closedAt?: string;       // ISO date when closed (optional)
}

// Represents all closing transactions for an option leg
// Supports multiple partial closes at different prices
export interface ClosingTransaction {
  quantity: number;        // Total number of contracts closed (sum of all entries)
  closingPrice: number;    // Weighted average closing price (for display)
  isEnabled: boolean;      // Whether any closing transactions are active
  entries?: ClosingEntry[]; // Individual closing entries (for partial closes at different prices)
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
