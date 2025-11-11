import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import type { MarketOptionQuote, MarketOptionChainSummary, OptionType } from "@shared/schema";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

const MARKETDATA_API_KEY = process.env.MARKETDATA_API_KEY;
const MARKETDATA_BASE_URL = "https://api.marketdata.app/v1";

const optionsChainQuerySchema = z.object({
  expiration: z.string().optional(),
  strike: z.string().transform(Number).optional(),
  side: z.enum(["call", "put"]).optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Stock quote endpoint - fetches real-time price for a symbol
  app.get("/api/stock/quote/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      
      if (!FINNHUB_API_KEY) {
        return res.status(500).json({ error: "API key not configured" });
      }

      const response = await fetch(
        `${FINNHUB_BASE_URL}/quote?symbol=${symbol.toUpperCase()}&token=${FINNHUB_API_KEY}`
      );

      if (!response.ok) {
        throw new Error(`Finnhub API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Finnhub returns c (current price), pc (previous close), etc.
      // Calculate percentage change
      const changePercent = data.pc > 0 ? ((data.c - data.pc) / data.pc) * 100 : 0;

      res.json({
        symbol: symbol.toUpperCase(),
        price: data.c,
        previousClose: data.pc,
        change: data.c - data.pc,
        changePercent: changePercent,
        high: data.h,
        low: data.l,
        open: data.o,
        timestamp: data.t,
      });
    } catch (error) {
      console.error("Error fetching stock quote:", error);
      res.status(500).json({ error: "Failed to fetch stock quote" });
    }
  });

  // Stock symbol search endpoint
  app.get("/api/stock/search", async (req, res) => {
    try {
      const { q } = req.query;
      
      if (!q || typeof q !== "string") {
        return res.status(400).json({ error: "Query parameter required" });
      }

      if (!FINNHUB_API_KEY) {
        return res.status(500).json({ error: "API key not configured" });
      }

      const response = await fetch(
        `${FINNHUB_BASE_URL}/search?q=${encodeURIComponent(q)}&token=${FINNHUB_API_KEY}`
      );

      if (!response.ok) {
        throw new Error(`Finnhub API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Finnhub returns { count, result: [{ description, displaySymbol, symbol, type }] }
      // Filter to only US stocks and limit results
      const results = (data.result || [])
        .filter((item: any) => item.type === "Common Stock")
        .slice(0, 10)
        .map((item: any) => ({
          symbol: item.symbol,
          name: item.description,
          displaySymbol: item.displaySymbol,
        }));

      res.json({ results });
    } catch (error) {
      console.error("Error searching stocks:", error);
      res.status(500).json({ error: "Failed to search stocks" });
    }
  });

  // Options expirations endpoint - fetches real options expiration dates
  app.get("/api/options/expirations/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      
      // Build URL with optional API key
      const url = new URL(`${MARKETDATA_BASE_URL}/options/expirations/${symbol.toUpperCase()}`);
      if (MARKETDATA_API_KEY) {
        url.searchParams.append("token", MARKETDATA_API_KEY);
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Market Data API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Market Data returns { s: "ok", expirations: ["2024-11-15", ...], updated: timestamp }
      if (data.s !== "ok") {
        throw new Error("Market Data API returned error status");
      }

      res.json({
        symbol: symbol.toUpperCase(),
        expirations: data.expirations || [],
        updated: data.updated,
      });
    } catch (error) {
      console.error("Error fetching options expirations:", error);
      res.status(500).json({ error: "Failed to fetch options expirations" });
    }
  });

  // Options chain endpoint - fetches real options chain data with caching
  app.get("/api/options/chain/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const queryParseResult = optionsChainQuerySchema.safeParse(req.query);
      
      if (!queryParseResult.success) {
        return res.status(400).json({ 
          error: "Invalid query parameters", 
          details: queryParseResult.error.issues 
        });
      }

      const { expiration, strike, side } = queryParseResult.data;
      
      // Create cache key from params
      const cacheKey = `${symbol.toUpperCase()}-${expiration || 'all'}-${strike || 'all'}-${side || 'all'}`;
      
      // Check cache first
      const cachedData = await storage.getOptionsChainCache(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }

      // Build URL with optional API key and filters
      const url = new URL(`${MARKETDATA_BASE_URL}/options/chain/${symbol.toUpperCase()}`);
      if (MARKETDATA_API_KEY) {
        url.searchParams.append("token", MARKETDATA_API_KEY);
      }
      if (expiration) {
        url.searchParams.append("expiration", expiration);
      }
      if (strike !== undefined) {
        url.searchParams.append("strike", strike.toString());
      }
      if (side) {
        url.searchParams.append("side", side);
      }

      const response = await fetch(url.toString());

      if (response.status === 429) {
        return res.status(429).json({ 
          error: "Rate limit exceeded",
          retryAfter: response.headers.get("Retry-After") || "60"
        });
      }

      if (!response.ok) {
        throw new Error(`Market Data API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Market Data returns arrays for each field
      if (data.s !== "ok") {
        throw new Error("Market Data API returned error status");
      }

      // Transform array-based response to object-based quotes
      const quotes: MarketOptionQuote[] = [];
      const length = data.optionSymbol?.length || 0;
      
      for (let i = 0; i < length; i++) {
        quotes.push({
          optionSymbol: data.optionSymbol[i],
          underlying: data.underlying[i],
          expiration: data.expiration[i],
          side: data.side[i] as OptionType,
          strike: data.strike[i],
          bid: data.bid[i],
          bidSize: data.bidSize[i],
          mid: data.mid[i],
          ask: data.ask[i],
          askSize: data.askSize[i],
          last: data.last[i],
          openInterest: data.openInterest[i],
          volume: data.volume[i],
          inTheMoney: data.inTheMoney[i],
          intrinsicValue: data.intrinsicValue[i],
          extrinsicValue: data.extrinsicValue[i],
          underlyingPrice: data.underlyingPrice[i],
          iv: data.iv[i],
          delta: data.delta[i],
          gamma: data.gamma[i],
          theta: data.theta[i],
          vega: data.vega[i],
          rho: data.rho[i],
          dte: data.dte[i],
          updated: data.updated[i],
        });
      }

      // Compute metadata
      const expirations = Array.from(new Set(quotes.map(q => new Date(q.expiration * 1000).toISOString().split('T')[0])));
      const strikes = quotes.map(q => q.strike);
      const minStrike = strikes.length > 0 ? Math.min(...strikes) : 0;
      const maxStrike = strikes.length > 0 ? Math.max(...strikes) : 0;

      const summary: MarketOptionChainSummary = {
        symbol: symbol.toUpperCase(),
        expirations,
        minStrike,
        maxStrike,
        quotes,
        cachedAt: Date.now(),
      };

      // Cache for 60 seconds
      await storage.setOptionsChainCache(cacheKey, summary, 60);

      res.json(summary);
    } catch (error) {
      console.error("Error fetching options chain:", error);
      res.status(500).json({ error: "Failed to fetch options chain" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
