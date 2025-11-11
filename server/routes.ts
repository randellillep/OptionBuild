import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import type { MarketOptionQuote, MarketOptionChainSummary, OptionType } from "@shared/schema";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

const MARKETDATA_API_KEY = process.env.MARKETDATA_API_KEY;
const MARKETDATA_BASE_URL = "https://api.marketdata.app/v1";

const ALPACA_API_KEY = process.env.ALPACA_API_KEY;
const ALPACA_API_SECRET = process.env.ALPACA_API_SECRET;
const ALPACA_BASE_URL = "https://data.alpaca.markets/v1beta1";

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

  // Options chain endpoint - fetches real options chain data with caching (Alpaca)
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

      if (!ALPACA_API_KEY || !ALPACA_API_SECRET) {
        return res.status(500).json({ error: "Alpaca API credentials not configured" });
      }

      const { expiration, strike, side } = queryParseResult.data;
      
      // Create cache key from params
      const cacheKey = `alpaca-${symbol.toUpperCase()}-${expiration || 'all'}-${strike || 'all'}-${side || 'all'}`;
      
      // Check cache first
      const cachedData = await storage.getOptionsChainCache(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }

      // Build Alpaca API URL with feed parameter for free tier (indicative pricing)
      const url = `${ALPACA_BASE_URL}/options/snapshots/${symbol.toUpperCase()}?feed=indicative`;

      const response = await fetch(url, {
        headers: {
          'APCA-API-KEY-ID': ALPACA_API_KEY,
          'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
        }
      });

      if (response.status === 429) {
        return res.status(429).json({ 
          error: "Rate limit exceeded",
          retryAfter: response.headers.get("Retry-After") || "60"
        });
      }

      if (!response.ok) {
        throw new Error(`Alpaca API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Alpaca returns { snapshots: { "SYMBOL": { latestQuote, latestTrade, greeks, impliedVolatility } } }
      const snapshots = data.snapshots || {};
      console.log(`[Options Chain] Fetched ${Object.keys(snapshots).length} snapshots for ${symbol.toUpperCase()}`);
      if (expiration) {
        console.log(`[Options Chain] Filtering for expiration: ${expiration}`);
      }
      const quotes: MarketOptionQuote[] = [];
      
      // Parse option symbol to extract strike, expiration, type
      // Format: AAPL251219C00225000 (ticker + YYMMDD + C/P + strike*1000)
      const parseOptionSymbol = (optionSymbol: string) => {
        const match = optionSymbol.match(/^([A-Z]+)(\d{6})([CP])(\d{8})$/);
        if (!match) return null;
        
        const [, , dateStr, callPut, strikeStr] = match;
        const year = 2000 + parseInt(dateStr.substring(0, 2));
        const month = parseInt(dateStr.substring(2, 4));
        const day = parseInt(dateStr.substring(4, 6));
        const expDate = new Date(year, month - 1, day);
        const strike = parseInt(strikeStr) / 1000;
        const side = callPut === 'C' ? 'call' : 'put';
        
        return { strike, expiration: Math.floor(expDate.getTime() / 1000), side };
      };

      for (const [optionSymbol, snapshot] of Object.entries(snapshots) as [string, any][]) {
        const parsed = parseOptionSymbol(optionSymbol);
        if (!parsed) continue;

        // Apply filters
        if (side && parsed.side !== side) continue;
        if (strike && Math.abs(parsed.strike - strike) > 0.01) continue;
        if (expiration) {
          const expDate = new Date(expiration);
          const targetExp = Math.floor(expDate.getTime() / 1000);
          if (Math.abs(parsed.expiration - targetExp) > 86400) continue; // Allow 1 day difference
        }

        const quote = snapshot.latestQuote || {};
        const trade = snapshot.latestTrade || {};
        const greeks = snapshot.greeks || {};
        
        const bid = quote.bp || 0;
        const ask = quote.ap || 0;
        const mid = (bid + ask) / 2;
        
        quotes.push({
          optionSymbol,
          underlying: symbol.toUpperCase(),
          expiration: parsed.expiration,
          side: parsed.side as OptionType,
          strike: parsed.strike,
          bid,
          bidSize: quote.bs || 0,
          mid,
          ask,
          askSize: quote.as || 0,
          last: trade.p || 0,
          openInterest: 0, // Alpaca doesn't provide OI in snapshots
          volume: 0, // Alpaca doesn't provide volume in snapshots
          inTheMoney: false, // Calculate this on frontend
          intrinsicValue: 0, // Calculate this on frontend
          extrinsicValue: mid, // Approximate
          underlyingPrice: 0, // Need to fetch separately or calculate
          iv: snapshot.impliedVolatility || 0,
          delta: greeks.delta || 0,
          gamma: greeks.gamma || 0,
          theta: greeks.theta || 0,
          vega: greeks.vega || 0,
          rho: greeks.rho || 0,
          dte: Math.max(0, Math.floor((parsed.expiration * 1000 - Date.now()) / (1000 * 60 * 60 * 24))),
          updated: Date.now(),
        });
      }

      // Compute metadata
      const expirations = Array.from(new Set(quotes.map(q => new Date(q.expiration * 1000).toISOString().split('T')[0])));
      console.log(`[Options Chain] After filtering: ${quotes.length} quotes, expirations found:`, expirations.slice(0, 5));
      const strikes = quotes.map(q => q.strike);
      const minStrike = strikes.length > 0 ? Math.min(...strikes) : 0;
      const maxStrike = strikes.length > 0 ? Math.max(...strikes) : 0;

      const summary: MarketOptionChainSummary = {
        symbol: symbol.toUpperCase(),
        expirations: expirations.sort(),
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
