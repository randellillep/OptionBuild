import { type User, type UpsertUser, type MarketOptionChainSummary, type InsertSavedTrade, type SavedTrade, type InsertBacktestRun, type BacktestRun, type BacktestRunResult, type HistoricalPrice, type InsertBrokerageConnection, type BrokerageConnection, type InsertBlogPost, type BlogPost, type BlogImage, type DeletionToken, type InsertDeletionToken, users, savedTrades, backtestRuns, historicalPrices, brokerageConnections, blogPosts, blogImages, deletionTokens } from "@shared/schema";
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
  updateSavedTrade(id: string, userId: string, updates: Partial<InsertSavedTrade>): Promise<SavedTrade | undefined>;
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
  
  // Brokerage connections
  getBrokerageConnections(userId: string): Promise<BrokerageConnection[]>;
  getBrokerageConnection(id: string, userId: string): Promise<BrokerageConnection | undefined>;
  createBrokerageConnection(connection: InsertBrokerageConnection): Promise<BrokerageConnection>;
  deleteBrokerageConnection(id: string, userId: string): Promise<boolean>;

  // Blog
  getBlogPosts(publishedOnly?: boolean): Promise<BlogPost[]>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  getBlogPost(id: string): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: string, updates: Partial<InsertBlogPost>): Promise<BlogPost | undefined>;
  deleteBlogPost(id: string): Promise<boolean>;
  saveBlogImage(image: { authorId: string; filename: string; mimeType: string; data: string }): Promise<BlogImage>;
  getBlogImage(id: string): Promise<BlogImage | undefined>;

  createDeletionToken(tokenData: InsertDeletionToken): Promise<DeletionToken>;
  getDeletionToken(token: string): Promise<DeletionToken | undefined>;
  deleteDeletionToken(token: string): Promise<boolean>;
  deleteUser(id: string): Promise<boolean>;
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
    // Check for existing user by email first to avoid unique constraint violations
    // (can happen when the auth provider changes the sub/ID for the same email)
    if (userData.email) {
      const [existingByEmail] = await db
        .select()
        .from(users)
        .where(eq(users.email, userData.email));
      if (existingByEmail) {
        const [user] = await db
          .update(users)
          .set({
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingByEmail.id))
          .returning();
        return user;
      }
    }

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

  async updateSavedTrade(id: string, userId: string, updates: Partial<InsertSavedTrade>): Promise<SavedTrade | undefined> {
    const [updated] = await db.update(savedTrades)
      .set(updates)
      .where(and(eq(savedTrades.id, id), eq(savedTrades.userId, userId)))
      .returning();
    return updated;
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
  async getBrokerageConnections(userId: string): Promise<BrokerageConnection[]> {
    return await db.select().from(brokerageConnections).where(eq(brokerageConnections.userId, userId)).orderBy(desc(brokerageConnections.createdAt));
  }

  async getBrokerageConnection(id: string, userId: string): Promise<BrokerageConnection | undefined> {
    const [conn] = await db.select().from(brokerageConnections).where(
      and(eq(brokerageConnections.id, id), eq(brokerageConnections.userId, userId))
    );
    return conn;
  }

  async createBrokerageConnection(connection: InsertBrokerageConnection): Promise<BrokerageConnection> {
    const [newConn] = await db.insert(brokerageConnections).values(connection).returning();
    return newConn;
  }

  async deleteBrokerageConnection(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(brokerageConnections).where(
      and(eq(brokerageConnections.id, id), eq(brokerageConnections.userId, userId))
    ).returning();
    return result.length > 0;
  }

  async getBlogPosts(publishedOnly = false): Promise<BlogPost[]> {
    if (publishedOnly) {
      return await db.select().from(blogPosts).where(eq(blogPosts.published, 1)).orderBy(desc(blogPosts.publishedAt));
    }
    return await db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    return post;
  }

  async getBlogPost(id: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return post;
  }

  async createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
    const [newPost] = await db.insert(blogPosts).values(post).returning();
    return newPost;
  }

  async updateBlogPost(id: string, updates: Partial<InsertBlogPost>): Promise<BlogPost | undefined> {
    const [updated] = await db.update(blogPosts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(blogPosts.id, id))
      .returning();
    return updated;
  }

  async deleteBlogPost(id: string): Promise<boolean> {
    const result = await db.delete(blogPosts).where(eq(blogPosts.id, id)).returning();
    return result.length > 0;
  }

  async saveBlogImage(image: { authorId: string; filename: string; mimeType: string; data: string }): Promise<BlogImage> {
    const [saved] = await db.insert(blogImages).values(image).returning();
    return saved;
  }

  async getBlogImage(id: string): Promise<BlogImage | undefined> {
    const [image] = await db.select().from(blogImages).where(eq(blogImages.id, id));
    return image;
  }

  async createDeletionToken(tokenData: InsertDeletionToken): Promise<DeletionToken> {
    const [newToken] = await db.insert(deletionTokens).values(tokenData).returning();
    return newToken;
  }

  async getDeletionToken(token: string): Promise<DeletionToken | undefined> {
    const [record] = await db.select().from(deletionTokens).where(eq(deletionTokens.token, token));
    return record;
  }

  async deleteDeletionToken(token: string): Promise<boolean> {
    const result = await db.delete(deletionTokens).where(eq(deletionTokens.token, token)).returning();
    return result.length > 0;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
