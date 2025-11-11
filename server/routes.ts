import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

const MARKETDATA_API_KEY = process.env.MARKETDATA_API_KEY;
const MARKETDATA_BASE_URL = "https://api.marketdata.app/v1";

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

  const httpServer = createServer(app);

  return httpServer;
}
