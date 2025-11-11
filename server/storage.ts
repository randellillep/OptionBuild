import { type User, type InsertUser, type MarketOptionChainSummary } from "@shared/schema";
import { randomUUID } from "crypto";

interface CachedOptionsChain {
  data: MarketOptionChainSummary;
  expiresAt: number;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getOptionsChainCache(cacheKey: string): Promise<MarketOptionChainSummary | undefined>;
  setOptionsChainCache(cacheKey: string, data: MarketOptionChainSummary, ttlSeconds: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private optionsChainCache: Map<string, CachedOptionsChain>;

  constructor() {
    this.users = new Map();
    this.optionsChainCache = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
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
}

export const storage = new MemStorage();
