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

// Saved trades table - stores user's saved option strategies
export const savedTrades = pgTable("saved_trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  description: text("description"),
  tradeGroup: varchar("trade_group").default("all"),
  symbol: varchar("symbol").notNull(),
  price: real("price").notNull(),
  legs: jsonb("legs").notNull(),
  expirationDate: varchar("expiration_date"),
  savedAt: timestamp("saved_at").defaultNow(),
}, (table) => [index("IDX_saved_trades_user").on(table.userId)]);

export const insertSavedTradeSchema = createInsertSchema(savedTrades).omit({
  id: true,
  savedAt: true,
});

export type InsertSavedTrade = z.infer<typeof insertSavedTradeSchema>;
export type SavedTrade = typeof savedTrades.$inferSelect;

export type OptionType = "call" | "put" | "stock";
export type PositionType = "long" | "short";
export type PremiumSource = "market" | "theoretical" | "manual" | "saved";

// Represents a single closing transaction (partial close)
export interface ClosingEntry {
  id: string;              // Unique ID for this closing entry
  quantity: number;        // Number of contracts closed in this transaction
  closingPrice: number;    // Price at which contracts were closed
  closedAt?: string;       // ISO date when closed (optional)
  strike: number;          // Strike price at time of close (immutable - doesn't move with leg)
  openingPrice: number;    // Cost basis per contract at time of close (immutable - doesn't change when leg moves)
  isExcluded?: boolean;    // Whether this closed portion is excluded from P/L calculations
  visualOrder?: number;    // Stable visual position (0, 1, 2...) preserved when entries are removed
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
  premium: number;                  // Entry premium (cost basis) - IMMUTABLE after entry
  expirationDays: number;
  marketQuoteId?: string;
  premiumSource?: PremiumSource;
  impliedVolatility?: number;
  entryUnderlyingPrice?: number;   // Stock price when position was opened (for P/L anchoring)
  costBasisLocked?: boolean;       // When true, premium never updates (locked at entry time)
  // Live market price fields - refreshed on each price poll
  marketBid?: number;              // Current bid price from options chain
  marketAsk?: number;              // Current ask price from options chain
  marketMark?: number;             // Current mark/mid price from options chain
  marketLast?: number;             // Last traded price from options chain
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
  strikes: number[];  // Actual available strikes from options chain data
  quotes: MarketOptionQuote[];
  cachedAt: number;
  availableExpirations?: string[]; // Available expirations from data source (for validation)
}

// Backtesting types
export interface BacktestRequest {
  symbol: string;
  legs: OptionLeg[];
  startDate: string;       // ISO date string (YYYY-MM-DD)
  endDate: string;         // ISO date string (YYYY-MM-DD)
  initialVolatility: number; // IV assumption (0.0-1.0)
  entryPrice: number;      // Underlying price at strategy entry
}

export interface BacktestDataPoint {
  date: string;            // ISO date string
  underlyingPrice: number;
  strategyValue: number;   // Current value of strategy
  pnl: number;             // P/L from entry
  pnlPercent: number;      // P/L as percentage of max risk
  daysToExpiration: number;
}

export interface BacktestMetrics {
  totalReturn: number;     // Total P/L in dollars
  totalReturnPercent: number;
  maxDrawdown: number;     // Maximum drawdown in dollars
  maxDrawdownPercent: number;
  maxGain: number;         // Peak profit achieved
  winRate: number;         // Percentage of profitable days
  sharpeRatio: number;     // Risk-adjusted return (simplified)
  avgDailyReturn: number;
  volatility: number;      // Standard deviation of daily returns
  daysInTrade: number;
}

export interface BacktestResult {
  symbol: string;
  startDate: string;
  endDate: string;
  entryPrice: number;
  exitPrice: number;
  dataPoints: BacktestDataPoint[];
  metrics: BacktestMetrics;
  legs: OptionLeg[];       // Original legs for reference
}

// ============================================
// TASTYWORKS-STYLE BACKTESTING SYSTEM
// ============================================

// Strike selection method for backtesting (price-based only - no Greeks)
export type StrikeSelectionMethod = "percentOTM" | "priceOffset";

// Entry frequency options
export type EntryFrequency = "everyDay" | "specificDays" | "exactDTE";

// Exit condition types
export type ExitConditionType = "dte" | "daysInTrade" | "stopLoss" | "takeProfit" | "expiration";

// Trade close reasons
export type TradeCloseReason = "expired" | "exercised" | "exitDTE" | "daysInTrade" | "stopLoss" | "takeProfit" | "endOfBacktest";

// Backtest leg configuration (defines how to select options)
export interface BacktestLegConfig {
  id: string;
  direction: "buy" | "sell";
  optionType: "call" | "put";
  quantity: number;
  strikeSelection: StrikeSelectionMethod;
  strikeValue: number;           // % OTM (0-50) or price offset ($)
  dte: number;                   // Days to expiration target
  linkedToLegId?: string;        // For linked legs (same expiration/strike offset)
}

// Entry conditions for backtesting
export interface BacktestEntryConditions {
  frequency: EntryFrequency;
  specificDays?: number[];       // Days of week (0=Sunday, 6=Saturday) if frequency is 'specificDays'
  exactDTEMatch?: boolean;       // Only enter when exact DTE is available
  maxActiveTrades?: number;      // Limit concurrent trades (null = unlimited)
  useVix?: boolean;              // Filter by VIX
  vixMin?: number;               // Min VIX to enter
  vixMax?: number;               // Max VIX to enter
}

// Exit conditions for backtesting
export interface BacktestExitConditions {
  exitAtDTE?: number;            // Exit when DTE reaches this value
  exitAfterDays?: number;        // Exit after N days in trade
  stopLossPercent?: number;      // Exit if loss exceeds % of premium
  takeProfitPercent?: number;    // Exit if profit exceeds % of premium
  useVix?: boolean;              // Exit if VIX condition met
  vixExitAbove?: number;         // Exit if VIX goes above this
}

// Capital calculation method
export type CapitalMethod = "auto" | "manual";

// Complete backtest configuration
export interface BacktestConfigData {
  symbol: string;
  startDate: string;             // YYYY-MM-DD
  endDate: string;               // YYYY-MM-DD
  legs: BacktestLegConfig[];
  entryConditions: BacktestEntryConditions;
  exitConditions: BacktestExitConditions;
  capitalMethod: CapitalMethod;
  manualCapital?: number;        // If capitalMethod is 'manual'
  feePerContract?: number;       // Trading fees per contract (default $0.65)
}

// Individual trade in a backtest
export interface BacktestTradeData {
  tradeNumber: number;
  openedDate: string;            // YYYY-MM-DD
  closedDate: string;            // YYYY-MM-DD
  legs: {
    direction: "buy" | "sell";
    optionType: "call" | "put";
    strike: number;
    quantity: number;
    entryPrice: number;          // Premium per contract at entry
    exitPrice: number;           // Premium per contract at exit
    dte: number;                 // DTE at entry
  }[];
  premium: number;               // Net premium (positive=credit, negative=debit)
  fees: number;                  // Total fees for this trade
  buyingPower: number;           // Capital required
  profitLoss: number;            // Realized P/L
  closeReason: TradeCloseReason;
  roi: number;                   // Return on investment (%)
  daysInTrade: number;
}

// Daily log entry
export interface BacktestDailyLog {
  date: string;
  underlyingPrice: number;
  totalProfitLoss: number;       // Cumulative P/L
  netLiquidity: number;          // Total account value
  drawdown: number;              // Drawdown from peak (%)
  roi: number;                   // Cumulative ROI (%)
  activeTrades: number;          // Number of open trades
}

// Summary metrics
export interface BacktestSummaryMetrics {
  totalProfitLoss: number;
  maxDrawdown: number;
  maxDrawdownDate: string;
  returnOnCapital: number;       // % return on used capital
  marRatio: number;              // MAR ratio (CAGR / max drawdown)
  usedCapital: number;           // Total capital deployed
  cagr: number;                  // Compound annual growth rate
}

// Detailed metrics (for Details tab)
export interface BacktestDetailMetrics {
  numberOfTrades: number;
  tradesWithProfits: number;
  tradesWithLosses: number;
  profitRate: number;            // % of winning trades
  lossRate: number;              // % of losing trades
  largestProfit: number;
  largestLoss: number;
  avgReturnPerTrade: number;     // %
  avgDaysInTrade: number;
  avgBuyingPower: number;
  avgPremium: number;
  avgProfitLossPerTrade: number;
  avgWinSize: number;
  avgLossSize: number;
  totalPremium: number;
  totalFees: number;
}

// Complete backtest run result
export interface BacktestRunResult {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;              // 0-100
  config: BacktestConfigData;
  summary?: BacktestSummaryMetrics;
  details?: BacktestDetailMetrics;
  trades?: BacktestTradeData[];
  dailyLogs?: BacktestDailyLog[];
  priceHistory?: { date: string; price: number }[];  // For chart overlay
  pnlHistory?: { date: string; cumulativePnL: number; underlyingPrice: number }[];  // Strategy P/L and price over time
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

// Database table for backtest runs
export const backtestRuns = pgTable("backtest_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }),
  status: varchar("status").notNull().default("pending"),
  progress: integer("progress").default(0),
  config: jsonb("config").notNull(),
  summary: jsonb("summary"),
  details: jsonb("details"),
  trades: jsonb("trades"),
  dailyLogs: jsonb("daily_logs"),
  priceHistory: jsonb("price_history"),
  pnlHistory: jsonb("pnl_history"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [index("IDX_backtest_runs_user").on(table.userId)]);

export const insertBacktestRunSchema = createInsertSchema(backtestRuns).omit({
  id: true,
  createdAt: true,
});

export type InsertBacktestRun = z.infer<typeof insertBacktestRunSchema>;
export type BacktestRun = typeof backtestRuns.$inferSelect;

// Historical price cache table
export const historicalPrices = pgTable("historical_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  date: varchar("date").notNull(),  // YYYY-MM-DD
  open: real("open").notNull(),
  high: real("high").notNull(),
  low: real("low").notNull(),
  close: real("close").notNull(),
  volume: integer("volume"),
  cachedAt: timestamp("cached_at").defaultNow(),
}, (table) => [
  index("IDX_historical_prices_symbol_date").on(table.symbol, table.date),
]);

export type HistoricalPrice = typeof historicalPrices.$inferSelect;
