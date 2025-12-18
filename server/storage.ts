import { type User, type UpsertUser, type MarketOptionChainSummary, type InsertSavedTrade, type SavedTrade, users, savedTrades } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

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
}

export const storage = new DatabaseStorage();
