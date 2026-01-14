import { type User, type UpsertUser, type MarketOptionChainSummary, type InsertSavedTrade, type SavedTrade, type InsertBacktestRun, type BacktestRun, type BacktestRunResult, type HistoricalPrice, users, savedTrades, backtestRuns, historicalPrices } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte } from "drizzle-orm";

interface CachedOptionsChain {
  data: MarketOptionChainSummary;
  expiresAt: number;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getOptionsChainCache(cacheKey: string): Promise<MarketOptionChainSummary | undefined>;
  setOptionsChainCache(cacheKey: string, data: MarketOptionChainSummary, ttlSeconds: number): Promise<void>;
  getSavedTrades(userId: string): Promise<SavedTrade[]>;
  createSavedTrade(trade: InsertSavedTrade): Promise<SavedTrade>;
  deleteSavedTrade(id: string, userId: string): Promise<boolean>;
  
  // Backtest operations
  createBacktestRun(run: InsertBacktestRun): Promise<BacktestRun>;
  getBacktestRun(id: string): Promise<BacktestRun | undefined>;
  getBacktestRuns(userId?: string): Promise<BacktestRun[]>;
  updateBacktestRun(id: string, updates: Partial<InsertBacktestRun>): Promise<BacktestRun | undefined>;
  deleteBacktestRun(id: string): Promise<boolean>;
  
  // Historical price cache
  getHistoricalPrices(symbol: string, startDate: string, endDate: string): Promise<HistoricalPrice[]>;
  saveHistoricalPrices(prices: { symbol: string; date: string; open: number; high: number; low: number; close: number; volume?: number }[]): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private optionsChainCache: Map<string, CachedOptionsChain>;

  constructor() {
    this.optionsChainCache = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getOptionsChainCache(cacheKey: string): Promise<MarketOptionChainSummary | undefined> {
    const cached = this.optionsChainCache.get(cacheKey);
    if (!cached) return undefined;
    
    if (Date.now() > cached.expiresAt) {
      this.optionsChainCache.delete(cacheKey);
      return undefined;
    }
    
    return cached.data;
  }

  async setOptionsChainCache(cacheKey: string, data: MarketOptionChainSummary, ttlSeconds: number): Promise<void> {
    this.optionsChainCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    
    if (this.optionsChainCache.size > 10) {
      const firstKey = this.optionsChainCache.keys().next();
      if (firstKey.value) {
        this.optionsChainCache.delete(firstKey.value);
      }
    }
  }

  async getSavedTrades(userId: string): Promise<SavedTrade[]> {
    return await db.select().from(savedTrades).where(eq(savedTrades.userId, userId)).orderBy(desc(savedTrades.savedAt));
  }

  async createSavedTrade(trade: InsertSavedTrade): Promise<SavedTrade> {
    const [newTrade] = await db.insert(savedTrades).values(trade).returning();
    return newTrade;
  }

  async deleteSavedTrade(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(savedTrades).where(
      and(eq(savedTrades.id, id), eq(savedTrades.userId, userId))
    ).returning();
    return result.length > 0;
  }

  async createBacktestRun(run: InsertBacktestRun): Promise<BacktestRun> {
    const [newRun] = await db.insert(backtestRuns).values(run).returning();
    return newRun;
  }

  async getBacktestRun(id: string): Promise<BacktestRun | undefined> {
    const [run] = await db.select().from(backtestRuns).where(eq(backtestRuns.id, id));
    return run;
  }

  async getBacktestRuns(userId?: string): Promise<BacktestRun[]> {
    if (userId) {
      return await db.select().from(backtestRuns).where(eq(backtestRuns.userId, userId)).orderBy(desc(backtestRuns.createdAt));
    }
    return await db.select().from(backtestRuns).orderBy(desc(backtestRuns.createdAt));
  }

  async updateBacktestRun(id: string, updates: Partial<InsertBacktestRun>): Promise<BacktestRun | undefined> {
    const [updated] = await db.update(backtestRuns).set(updates).where(eq(backtestRuns.id, id)).returning();
    return updated;
  }

  async deleteBacktestRun(id: string): Promise<boolean> {
    const result = await db.delete(backtestRuns).where(eq(backtestRuns.id, id)).returning();
    return result.length > 0;
  }

  async getHistoricalPrices(symbol: string, startDate: string, endDate: string): Promise<HistoricalPrice[]> {
    return await db.select().from(historicalPrices).where(
      and(
        eq(historicalPrices.symbol, symbol.toUpperCase()),
        gte(historicalPrices.date, startDate),
        lte(historicalPrices.date, endDate)
      )
    ).orderBy(historicalPrices.date);
  }

  async saveHistoricalPrices(prices: { symbol: string; date: string; open: number; high: number; low: number; close: number; volume?: number }[]): Promise<void> {
    if (prices.length === 0) return;
    
    // Insert with conflict handling (upsert)
    for (const price of prices) {
      await db.insert(historicalPrices).values({
        symbol: price.symbol.toUpperCase(),
        date: price.date,
        open: price.open,
        high: price.high,
        low: price.low,
        close: price.close,
        volume: price.volume ?? null,
      }).onConflictDoNothing();
    }
  }
}

export const storage = new DatabaseStorage();
