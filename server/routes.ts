import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import type { MarketOptionQuote, MarketOptionChainSummary, OptionType, BacktestRequest, BacktestConfigData } from "@shared/schema";
import { setupAuth, isAuthenticated as replitIsAuthenticated } from "./replitAuth";
import { setupGoogleAuth, isGoogleAuthenticated } from "./googleAuth";
import { runBacktest, runTastyworksBacktest } from "./backtesting";
import { Resend } from "resend";
import { 
  Backtester, 
  ShortPutStrategy, 
  AlpacaDataLoader,
  CSVDataLoader,
  OptionChain,
  OptionSnapshotImpl
} from "./backtesting/index";

const ALPACA_API_KEY = process.env.ALPACA_API_KEY;
const ALPACA_API_SECRET = process.env.ALPACA_API_SECRET;
const ALPACA_BASE_URL = "https://data.alpaca.markets/v1beta1";


const optionsChainQuerySchema = z.object({
  expiration: z.string().optional(),
  strike: z.string().transform(Number).optional(),
  side: z.enum(["call", "put"]).optional(),
});

// Parse option symbol to extract expiration date
function parseOptionSymbolExpiration(optionSymbol: string): string | null {
  const match = optionSymbol.match(/^([A-Z]+)(\d{6})([CP])(\d{8})$/);
  if (!match) return null;
  
  const [, , dateStr] = match;
  const year = 2000 + parseInt(dateStr.substring(0, 2));
  const month = parseInt(dateStr.substring(2, 4));
  const day = parseInt(dateStr.substring(4, 6));
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Shared helper to fetch option snapshots from Alpaca with pagination
// Returns snapshots object and list of available expirations
async function fetchAlpacaSnapshots(symbol: string, options?: { expiration?: string }) {
  if (!ALPACA_API_KEY || !ALPACA_API_SECRET) {
    throw new Error("Alpaca API credentials not configured");
  }
  
  const allSnapshots: Record<string, any> = {};
  let pageToken: string | null = null;
  let pageCount = 0;
  const maxPages = 10; // Limit to prevent infinite loops (1000 options max)
  const todayStr = new Date().toISOString().split('T')[0];
  
  do {
    // Build URL with optional expiration filter and pagination
    // Include expiration_date_gte=today to ensure same-day expirations are returned
    let url = `${ALPACA_BASE_URL}/options/snapshots/${symbol.toUpperCase()}?feed=indicative&limit=100`;
    if (options?.expiration) {
      url += `&expiration_date=${options.expiration}`;
    } else {
      url += `&expiration_date_gte=${todayStr}`;
    }
    if (pageToken) {
      url += `&page_token=${encodeURIComponent(pageToken)}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
      }
    });
    
    if (response.status === 429) {
      const error: any = new Error("Rate limit exceeded");
      error.status = 429;
      error.retryAfter = response.headers.get("Retry-After") || "60";
      throw error;
    }
    
    if (!response.ok) {
      if (response.status === 404) {
        const error: any = new Error(`No options data available for ${symbol.toUpperCase()}`);
        error.status = 404;
        throw error;
      }
      throw new Error(`Alpaca API error: ${response.status}`);
    }
    
    const data = await response.json();
    const pageSnapshots = data.snapshots || {};
    
    // Merge snapshots
    Object.assign(allSnapshots, pageSnapshots);
    
    // Check for next page
    pageToken = data.next_page_token || null;
    pageCount++;
    
    if (pageToken && pageCount < maxPages) {
      console.log(`[Options Chain] Fetching page ${pageCount + 1} for ${symbol}... (${Object.keys(allSnapshots).length} options so far)`);
    }
  } while (pageToken && pageCount < maxPages);
  
  if (pageCount > 1) {
    console.log(`[Options Chain] Fetched ${pageCount} pages with ${Object.keys(allSnapshots).length} total options for ${symbol}`);
  }
  
  // Parse option symbols to extract unique expiration dates
  const expirationSet = new Set<string>();
  
  for (const optionSymbol of Object.keys(allSnapshots)) {
    const isoDate = parseOptionSymbolExpiration(optionSymbol);
    if (isoDate) {
      expirationSet.add(isoDate);
    }
  }
  
  const availableExpirations = Array.from(expirationSet).sort();
  
  return {
    snapshots: allSnapshots,
    availableExpirations,
    count: Object.keys(allSnapshots).length,
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Detect environment: use Replit Auth when running in Replit, Google OAuth otherwise (e.g., Render)
  const useReplitAuth = !!process.env.REPL_ID;
  
  if (useReplitAuth) {
    console.log("[Auth] Using Replit Auth (Replit environment detected)");
    await setupAuth(app);
  } else {
    console.log("[Auth] Using Google OAuth (external deployment detected)");
    await setupGoogleAuth(app);
  }

  // Helper to get user ID from request (works with both auth systems)
  const getUserId = (req: any): string | null => {
    if (useReplitAuth) {
      return req.user?.claims?.sub || null;
    }
    return req.user?.id || null;
  };

  // Use the appropriate auth middleware
  const isAuthenticated = useReplitAuth ? replitIsAuthenticated : isGoogleAuthenticated;

  // Auth routes - get current user
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Saved trades routes - user-specific trade storage
  app.get('/api/trades', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const trades = await storage.getSavedTrades(userId);
      res.json(trades);
    } catch (error) {
      console.error("Error fetching saved trades:", error);
      res.status(500).json({ error: "Failed to fetch saved trades" });
    }
  });

  app.post('/api/trades', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const tradeSchema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        tradeGroup: z.string().optional().default("all"),
        symbol: z.string().min(1),
        price: z.number().positive(),
        legs: z.array(z.any()),
        expirationDate: z.string().nullable().optional(),
      });

      const validation = tradeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid trade data", details: validation.error.errors });
      }

      const trade = await storage.createSavedTrade({
        userId,
        ...validation.data,
      });

      res.status(201).json(trade);
    } catch (error) {
      console.error("Error saving trade:", error);
      res.status(500).json({ error: "Failed to save trade" });
    }
  });

  app.patch('/api/trades/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { id } = req.params;
      const updateSchema = z.object({
        legs: z.array(z.any()).optional(),
        price: z.number().optional(),
        expirationDate: z.string().nullable().optional(),
      });

      const validation = updateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid update data", details: validation.error.errors });
      }

      const updated = await storage.updateSavedTrade(id, userId, validation.data);
      if (!updated) {
        return res.status(404).json({ error: "Trade not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating trade:", error);
      res.status(500).json({ error: "Failed to update trade" });
    }
  });

  app.delete('/api/trades/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { id } = req.params;
      const deleted = await storage.deleteSavedTrade(id, userId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Trade not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting trade:", error);
      res.status(500).json({ error: "Failed to delete trade" });
    }
  });

  // Stock quote endpoint - fetches real-time price for a symbol (using Alpaca)
  // Known index symbols that don't have stock quotes in Alpaca
  const INDEX_SYMBOLS = new Set(['SPX', 'NDX', 'RUT', 'DJX', 'VIX', 'OEX', 'XSP', 'SPXW']);
  
  // Infer index price from options chain using put-call parity at ATM
  async function inferIndexPriceFromOptions(symbol: string): Promise<number | null> {
    try {
      const { snapshots } = await fetchAlpacaSnapshots(symbol);
      const optionSymbols = Object.keys(snapshots);
      if (optionSymbols.length === 0) return null;
      
      // Group options by strike and type
      const strikeData: Record<number, { call?: { bid: number; ask: number }; put?: { bid: number; ask: number } }> = {};
      
      for (const sym of optionSymbols) {
        const match = sym.match(/^[A-Z]+\d{6}([CP])(\d{8})$/);
        if (!match) continue;
        const type = match[1] === 'C' ? 'call' : 'put';
        const strike = parseInt(match[2]) / 1000;
        const snap = snapshots[sym];
        const bid = snap?.latestQuote?.bp || 0;
        const ask = snap?.latestQuote?.ap || 0;
        if (bid <= 0 && ask <= 0) continue;
        
        if (!strikeData[strike]) strikeData[strike] = {};
        strikeData[strike][type] = { bid, ask };
      }
      
      // Find ATM using put-call parity: S ≈ Strike + CallMid - PutMid
      let bestEstimate = 0;
      let smallestDiff = Infinity;
      
      for (const [strikeStr, data] of Object.entries(strikeData)) {
        if (!data.call || !data.put) continue;
        const strike = parseFloat(strikeStr);
        const callMid = (data.call.bid + data.call.ask) / 2;
        const putMid = (data.put.bid + data.put.ask) / 2;
        const diff = Math.abs(callMid - putMid);
        
        if (diff < smallestDiff) {
          smallestDiff = diff;
          bestEstimate = strike + callMid - putMid;
        }
      }
      
      if (bestEstimate > 0) {
        console.log(`[Index Price] Inferred ${symbol} price from options: $${bestEstimate.toFixed(2)}`);
        return bestEstimate;
      }
      return null;
    } catch (e) {
      console.error(`[Index Price] Failed to infer price for ${symbol}:`, e);
      return null;
    }
  }

  app.get("/api/stock/quote/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const upperSymbol = symbol.toUpperCase();
      
      if (!ALPACA_API_KEY || !ALPACA_API_SECRET) {
        return res.status(500).json({ error: "Alpaca API keys not configured" });
      }

      // For index symbols, infer price from options and get change from ETF proxy
      if (INDEX_SYMBOLS.has(upperSymbol)) {
        const inferredPrice = await inferIndexPriceFromOptions(upperSymbol);
        if (inferredPrice && inferredPrice > 0) {
          // Use ETF proxy for price change data (SPX->SPY, NDX->QQQ, RUT->IWM, etc.)
          const etfProxy: Record<string, string> = { SPX: 'SPY', SPXW: 'SPY', XSP: 'SPY', NDX: 'QQQ', RUT: 'IWM', DJX: 'DIA', VIX: 'VIXY' };
          const proxySymbol = etfProxy[upperSymbol];
          let changePercent = 0;
          
          if (proxySymbol && ALPACA_API_KEY && ALPACA_API_SECRET) {
            try {
              const proxyRes = await fetch(`https://data.alpaca.markets/v2/stocks/${proxySymbol}/snapshot?feed=iex`, {
                headers: {
                  'APCA-API-KEY-ID': ALPACA_API_KEY,
                  'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
                },
              });
              if (proxyRes.ok) {
                const proxyData = await proxyRes.json();
                const proxyPrice = proxyData.latestTrade?.p || 0;
                const proxyPrevClose = proxyData.prevDailyBar?.c || proxyPrice;
                if (proxyPrevClose > 0) {
                  changePercent = ((proxyPrice - proxyPrevClose) / proxyPrevClose) * 100;
                }
              }
            } catch (e) {
              console.error(`[Index Price] Failed to get ETF proxy change for ${upperSymbol}:`, e);
            }
          }
          
          const roundedPrice = Math.round(inferredPrice * 100) / 100;
          const previousClose = roundedPrice / (1 + changePercent / 100);
          const change = roundedPrice - previousClose;
          
          return res.json({
            symbol: upperSymbol,
            price: roundedPrice,
            previousClose: Math.round(previousClose * 100) / 100,
            change: Math.round(change * 100) / 100,
            changePercent: Math.round(changePercent * 100) / 100,
            high: roundedPrice,
            low: roundedPrice,
            open: Math.round(previousClose * 100) / 100,
            timestamp: Date.now() / 1000,
            isIndex: true,
          });
        }
        return res.status(404).json({ error: `Unable to get price for index ${upperSymbol}` });
      }

      // Fetch latest trade and previous day bar for change calculation
      // Use snapshot endpoint to get current price AND previous day's close
      const snapshotRes = await fetch(`https://data.alpaca.markets/v2/stocks/${upperSymbol}/snapshot?feed=iex`, {
        headers: {
          'APCA-API-KEY-ID': ALPACA_API_KEY,
          'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
        },
      });

      if (!snapshotRes.ok) {
        // If stock quote fails, try inferring from options (might be an unlisted index)
        const inferredPrice = await inferIndexPriceFromOptions(upperSymbol);
        if (inferredPrice && inferredPrice > 0) {
          return res.json({
            symbol: upperSymbol,
            price: Math.round(inferredPrice * 100) / 100,
            previousClose: inferredPrice,
            change: 0,
            changePercent: 0,
            high: inferredPrice,
            low: inferredPrice,
            open: inferredPrice,
            timestamp: Date.now() / 1000,
            isIndex: true,
          });
        }
        throw new Error(`Alpaca API error: ${snapshotRes.status}`);
      }

      const snapshot = await snapshotRes.json();
      
      // Current price from latest trade
      const currentPrice = snapshot.latestTrade?.p || 0;
      
      // Previous day's close from prevDailyBar
      const prevDailyBar = snapshot.prevDailyBar;
      const dailyBar = snapshot.dailyBar;
      const previousClose = prevDailyBar?.c || currentPrice;
      
      // Calculate change from previous day's close
      const change = currentPrice - previousClose;
      const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

      res.json({
        symbol: upperSymbol,
        price: currentPrice,
        previousClose: previousClose,
        change: change,
        changePercent: changePercent,
        high: dailyBar?.h || currentPrice,
        low: dailyBar?.l || currentPrice,
        open: dailyBar?.o || currentPrice,
        timestamp: snapshot.latestTrade?.t ? new Date(snapshot.latestTrade.t).getTime() / 1000 : Date.now() / 1000,
      });
    } catch (error) {
      console.error("Error fetching stock quote:", error);
      res.status(500).json({ error: "Failed to fetch stock quote" });
    }
  });

  // In-memory cache for Alpaca assets (loaded once, refreshed periodically)
  let alpacaAssetsCache: { symbol: string; name: string }[] = [];
  let alpacaAssetsCacheTime = 0;
  const ASSETS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  async function loadAlpacaAssets(): Promise<{ symbol: string; name: string }[]> {
    const now = Date.now();
    if (alpacaAssetsCache.length > 0 && (now - alpacaAssetsCacheTime) < ASSETS_CACHE_TTL) {
      return alpacaAssetsCache;
    }

    if (!ALPACA_API_KEY || !ALPACA_API_SECRET) {
      console.log("[Search] No Alpaca API keys, using fallback list");
      return [];
    }

    try {
      console.log("[Search] Loading assets from Alpaca API...");
      const response = await fetch(
        `https://paper-api.alpaca.markets/v2/assets?status=active&asset_class=us_equity`,
        {
          headers: {
            'APCA-API-KEY-ID': ALPACA_API_KEY,
            'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
          },
        }
      );

      if (!response.ok) {
        console.error("[Search] Alpaca assets API error:", response.status);
        return alpacaAssetsCache;
      }

      const assets = await response.json() as any[];
      const allTradable = assets.filter((a: any) => a.tradable && a.symbol && !a.symbol.includes('/'));
      alpacaAssetsCache = allTradable
        .filter((a: any) => Array.isArray(a.attributes) && a.attributes.includes('has_options'))
        .map((a: any) => ({
          symbol: a.symbol,
          name: a.name || a.symbol,
        }));
      alpacaAssetsCacheTime = now;
      console.log(`[Search] Cached ${alpacaAssetsCache.length} optionable assets (filtered from ${allTradable.length} tradable)`);
      return alpacaAssetsCache;
    } catch (error) {
      console.error("[Search] Failed to load Alpaca assets:", error);
      return alpacaAssetsCache;
    }
  }

  // Pre-load assets on startup
  loadAlpacaAssets();

  const SEARCH_INDEX_SYMBOLS = [
    { symbol: 'SPX', name: 'S&P 500 Index' },
    { symbol: 'NDX', name: 'Nasdaq-100 Index' },
    { symbol: 'RUT', name: 'Russell 2000 Index' },
    { symbol: 'DJX', name: 'Dow Jones Industrial Index' },
    { symbol: 'VIX', name: 'CBOE Volatility Index' },
    { symbol: 'XSP', name: 'S&P 500 Mini Index' },
  ];

  app.get("/api/stock/search", async (req, res) => {
    try {
      const { q } = req.query;
      
      if (!q || typeof q !== "string") {
        return res.status(400).json({ error: "Query parameter required" });
      }

      const query = q.toUpperCase();
      const assets = await loadAlpacaAssets();
      const allAssets = [...SEARCH_INDEX_SYMBOLS, ...assets];

      // Exact symbol matches first, then prefix matches, then contains matches
      const exactMatches: { symbol: string; name: string }[] = [];
      const prefixMatches: { symbol: string; name: string }[] = [];
      const containsMatches: { symbol: string; name: string }[] = [];

      for (const stock of allAssets) {
        if (!stock.symbol) continue;
        if (stock.symbol === query) {
          exactMatches.push(stock);
        } else if (stock.symbol.startsWith(query)) {
          prefixMatches.push(stock);
        } else if (stock.symbol.includes(query) || (stock.name && stock.name.toUpperCase().includes(query))) {
          containsMatches.push(stock);
        }
      }

      const results = [...exactMatches, ...prefixMatches, ...containsMatches]
        .slice(0, 15)
        .map(stock => ({
          symbol: stock.symbol,
          name: stock.name,
          displaySymbol: stock.symbol,
        }));

      res.json({ results });
    } catch (error) {
      console.error("Error searching stocks:", error);
      res.status(500).json({ error: "Failed to search stocks" });
    }
  });

  // Historical stock candles endpoint for charts (using Alpaca API)
  app.get("/api/stock/candles/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const { resolution = 'D', from, to } = req.query;
      
      if (!ALPACA_API_KEY || !ALPACA_API_SECRET) {
        return res.status(500).json({ error: "Alpaca API keys not configured" });
      }

      // Default to last 6 months of daily data
      const toTimestamp = to ? parseInt(to as string) : Math.floor(Date.now() / 1000);
      const fromTimestamp = from ? parseInt(from as string) : toTimestamp - (180 * 24 * 60 * 60);

      // Convert timestamps to ISO 8601 format for Alpaca
      const startDate = new Date(fromTimestamp * 1000).toISOString();
      const endDate = new Date(toTimestamp * 1000).toISOString();

      // Map resolution to Alpaca timeframe
      let timeframe = '1Day';
      if (resolution === '1' || resolution === '5') {
        timeframe = '5Min';
      } else if (resolution === '15') {
        timeframe = '15Min';
      } else if (resolution === '60') {
        timeframe = '1Hour';
      }

      const alpacaUrl = `https://data.alpaca.markets/v2/stocks/${symbol.toUpperCase()}/bars?timeframe=${timeframe}&start=${startDate}&end=${endDate}&limit=1000&adjustment=split&feed=iex`;

      const response = await fetch(alpacaUrl, {
        headers: {
          'APCA-API-KEY-ID': ALPACA_API_KEY,
          'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Alpaca bars API error:", response.status, errorText);
        throw new Error(`Alpaca API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.bars || data.bars.length === 0) {
        return res.json({ candles: [] });
      }

      // Transform Alpaca response to array of candles
      const candles = data.bars.map((bar: any) => ({
        timestamp: new Date(bar.t).getTime(),
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
      }));

      res.json({
        symbol: symbol.toUpperCase(),
        resolution,
        candles,
      });
    } catch (error) {
      console.error("Error fetching stock candles:", error);
      res.status(500).json({ error: "Failed to fetch stock candles" });
    }
  });

  // Options expirations endpoint - fetches ACTUAL available expirations from Alpaca
  app.get("/api/options/expirations/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      
      // Fetch general snapshots AND check today's date specifically in parallel
      // The general fetch may miss today due to the 1000-option limit on popular stocks
      const todayStr = new Date().toISOString().split('T')[0];
      const [generalResult, todayResult] = await Promise.all([
        fetchAlpacaSnapshots(symbol),
        fetchAlpacaSnapshots(symbol, { expiration: todayStr }).catch(() => ({ availableExpirations: [], count: 0 })),
      ]);
      
      // Merge expirations: add today if it has options but wasn't in general results
      const expirationSet = new Set(generalResult.availableExpirations);
      todayResult.availableExpirations.forEach((exp: string) => expirationSet.add(exp));
      const mergedExpirations = Array.from(expirationSet).sort();
      
      if (mergedExpirations.length === 0) {
        return res.status(404).json({ 
          error: `No options found for ${symbol.toUpperCase()}`,
          expirations: []
        });
      }

      res.json({
        symbol: symbol.toUpperCase(),
        expirations: mergedExpirations,
        count: generalResult.count + todayResult.count,
        updated: Date.now(),
      });
    } catch (error: any) {
      console.error("Error fetching options expirations:", error);
      
      // Handle specific error types
      if (error.status === 429) {
        return res.status(429).json({ 
          error: error.message,
          retryAfter: error.retryAfter 
        });
      }
      if (error.status === 404) {
        return res.status(404).json({ error: error.message });
      }
      
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
      const CACHE_VERSION = '2'; // Increment when response schema changes
      const cacheKey = `alpaca-v${CACHE_VERSION}-${symbol.toUpperCase()}-${expiration || 'all'}-${strike || 'all'}-${side || 'all'}`;
      
      // Check cache first - cache key includes version so old entries are automatically invalidated
      const cachedData = await storage.getOptionsChainCache(cacheKey);
      if (cachedData && cachedData.availableExpirations) {
        // If requested expiration isn't in cache but other expirations are available,
        // skip cache and do a fresh fetch with fallback logic
        if (expiration && cachedData.availableExpirations && !cachedData.availableExpirations.includes(expiration)) {
          // Don't use this cache entry — let the fallback logic below handle it
        } else {
          return res.json(cachedData);
        }
      }

      // Use shared helper to fetch snapshots with pagination
      // Pass expiration to filter on server-side for better efficiency
      const { snapshots, availableExpirations: rawExpirations, count } = await fetchAlpacaSnapshots(symbol, 
        expiration ? { expiration } : undefined
      );
      
      // When fetching without a specific expiration, also check today's date
      // The 1000-option limit may cause today's expiration to be missed for popular stocks
      let availableExpirations = rawExpirations;
      if (!expiration) {
        const todayStr = new Date().toISOString().split('T')[0];
        if (!rawExpirations.includes(todayStr)) {
          try {
            const todayCheck = await fetchAlpacaSnapshots(symbol, { expiration: todayStr });
            if (todayCheck.count > 0) {
              availableExpirations = Array.from(new Set([todayStr, ...rawExpirations])).sort();
            }
          } catch (e) {
            // Today has no options for this symbol - that's fine
          }
        }
      }
      
      console.log(`[Options Chain] Fetched ${count} snapshots for ${symbol.toUpperCase()}`);
      console.log(`[Options Chain] Available expirations:`, availableExpirations.slice(0, 5));
      
      // Check if requested expiration exists in Alpaca data
      // If not found, fall back to the nearest available expiration instead of returning 404
      let effectiveExpiration = expiration;
      if (expiration && !availableExpirations.includes(expiration)) {
        if (availableExpirations.length === 0) {
          // No expirations at all — need to do a broader fetch
          console.log(`[Options Chain] ⚠️  Requested expiration ${expiration} not found and no expirations from initial fetch. Trying broader fetch...`);
          try {
            const broadFetch = await fetchAlpacaSnapshots(symbol);
            if (broadFetch.count > 0 && broadFetch.availableExpirations.length > 0) {
              availableExpirations = broadFetch.availableExpirations;
              Object.assign(snapshots, broadFetch.snapshots);
              console.log(`[Options Chain] Broader fetch found ${broadFetch.count} snapshots with expirations:`, availableExpirations.slice(0, 5));
            }
          } catch (e) {
            // Broader fetch also failed
          }
        }
        
        if (availableExpirations.length > 0) {
          // Find the nearest available expiration to the requested date
          const requestedTime = new Date(expiration).getTime();
          let nearestDate = availableExpirations[0];
          let nearestDiff = Math.abs(new Date(nearestDate).getTime() - requestedTime);
          for (const d of availableExpirations) {
            const diff = Math.abs(new Date(d).getTime() - requestedTime);
            if (diff < nearestDiff) {
              nearestDiff = diff;
              nearestDate = d;
            }
          }
          
          console.log(`[Options Chain] Requested expiration ${expiration} not found, falling back to nearest: ${nearestDate}`);
          effectiveExpiration = nearestDate;
          
          // If we don't already have data for the nearest date, fetch it
          const existingForNearest = Object.keys(snapshots).filter(sym => {
            const isoDate = parseOptionSymbolExpiration(sym);
            return isoDate === nearestDate;
          });
          
          if (existingForNearest.length === 0) {
            try {
              const nearestFetch = await fetchAlpacaSnapshots(symbol, { expiration: nearestDate });
              Object.assign(snapshots, nearestFetch.snapshots);
              console.log(`[Options Chain] Fetched ${nearestFetch.count} snapshots for fallback expiration ${nearestDate}`);
            } catch (e) {
              console.log(`[Options Chain] Failed to fetch fallback expiration ${nearestDate}`);
            }
          }
        } else {
          // Truly no options data available
          return res.status(404).json({
            error: `No options data available for ${symbol.toUpperCase()}`,
            message: `No options expirations found for ${symbol.toUpperCase()} from Alpaca.`,
            availableExpirations: [],
            symbol: symbol.toUpperCase(),
          });
        }
      }
      
      // Log sample option symbols to debug PUT availability
      const sampleSymbols = Object.keys(snapshots).slice(0, 10);
      console.log(`[Options Chain] Sample option symbols:`, sampleSymbols);
      const callCount = sampleSymbols.filter(s => s.includes('C')).length;
      const putCount = sampleSymbols.filter(s => s.includes('P')).length;
      console.log(`[Options Chain] Sample breakdown: ${callCount} calls, ${putCount} puts in first 10 symbols`);
      
      if (effectiveExpiration) {
        console.log(`[Options Chain] Filtering for expiration: ${effectiveExpiration}`);
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
        // Use UTC to avoid timezone issues
        const expDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        const strike = parseInt(strikeStr) / 1000;
        const side = callPut === 'C' ? 'call' : 'put';
        // Also return ISO date string for easier comparison
        const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        return { strike, expiration: Math.floor(expDate.getTime() / 1000), side, isoDate };
      };

      for (const [optionSymbol, snapshot] of Object.entries(snapshots) as [string, any][]) {
        const parsed = parseOptionSymbol(optionSymbol);
        if (!parsed) continue;

        // Apply filters
        if (side && parsed.side !== side) continue;
        if (strike && Math.abs(parsed.strike - strike) > 0.01) continue;
        // Filter by expiration to ensure we only return options for the requested/fallback date
        if (effectiveExpiration && parsed.isoDate !== effectiveExpiration) continue;

        const quote = snapshot.latestQuote || {};
        const trade = snapshot.latestTrade || {};
        const greeks = snapshot.greeks || {};
        
        // Log first snapshot to see what data is available
        if (quotes.length === 0) {
          console.log('[Options Chain] Sample snapshot structure:', JSON.stringify({
            optionSymbol,
            hasLatestQuote: !!snapshot.latestQuote,
            hasGreeks: !!snapshot.greeks,
            hasImpliedVolatility: !!snapshot.impliedVolatility,
            impliedVolatility: snapshot.impliedVolatility,
            greeksKeys: Object.keys(greeks),
          }));
        }
        
        const bid = quote.bp || 0;
        const ask = quote.ap || 0;
        const mid = (bid + ask) / 2;
        
        // Calculate DTE first
        const dte = Math.max(0, Math.floor((parsed.expiration * 1000 - Date.now()) / (1000 * 60 * 60 * 24)));
        
        // Use IV from Alpaca if available, otherwise will be calculated client-side
        const impliedVol = snapshot.impliedVolatility || undefined;
        
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
          iv: impliedVol, // Let client calculate IV from market price if undefined
          delta: greeks.delta || 0,
          gamma: greeks.gamma || 0,
          theta: greeks.theta || 0,
          vega: greeks.vega || 0,
          rho: greeks.rho || 0,
          dte,
          updated: Date.now(),
        });
      }

      // Compute metadata and log PUT/CALL breakdown
      const callQuotes = quotes.filter(q => q.side === 'call');
      const putQuotes = quotes.filter(q => q.side === 'put');
      console.log(`[Options Chain] ${symbol} Summary: ${quotes.length} total quotes (${callQuotes.length} calls, ${putQuotes.length} puts)`);
      
      // If no PUT options, synthesize them from CALL options using Put-Call Parity
      // P = C - S + K * e^(-rt) where r is risk-free rate, t is time to expiration
      if (putQuotes.length === 0 && callQuotes.length > 0) {
        console.warn(`[Options Chain] WARNING: No PUT options from Alpaca. Synthesizing ${callQuotes.length} PUTs using Put-Call Parity...`);
        
        // Fetch underlying stock price from Alpaca
        let underlyingPrice = 0;
        try {
          const stockResponse = await fetch(
            `https://data.alpaca.markets/v2/stocks/${symbol.toUpperCase()}/trades/latest?feed=iex`,
            {
              headers: {
                'APCA-API-KEY-ID': ALPACA_API_KEY!,
                'APCA-API-SECRET-KEY': ALPACA_API_SECRET!,
              },
            }
          );
          if (stockResponse.ok) {
            const stockData = await stockResponse.json();
            underlyingPrice = stockData.trade?.p || 0;
            console.log(`[Options Chain] Fetched underlying price for ${symbol}: $${underlyingPrice}`);
          }
        } catch (err) {
          console.error(`[Options Chain] Failed to fetch underlying price:`, err);
        }
        
        // Group calls by strike and expiration
        const callsByStrikeExp = new Map<string, MarketOptionQuote>();
        callQuotes.forEach(call => {
          const key = `${call.strike}-${call.expiration}`;
          callsByStrikeExp.set(key, call);
        });
        
        // Synthesize PUT for each CALL
        const riskFreeRate = 0.05; // Assume 5% annual risk-free rate
        callsByStrikeExp.forEach((call, key) => {
          const dte = Math.max(0, Math.floor((call.expiration * 1000 - Date.now()) / (1000 * 60 * 60 * 24)));
          const timeToExpiration = dte / 365; // Convert days to years
          
          // Put-Call Parity: P = C - S + K * e^(-rt)
          const discountFactor = Math.exp(-riskFreeRate * timeToExpiration);
          const callMid = call.mid;
          const theoreticalPutMid = callMid - underlyingPrice + (call.strike * discountFactor);
          
          // Create synthetic PUT option
          // Use theoretical pricing with reasonable spread
          const spread = Math.max(0.05, theoreticalPutMid * 0.02); // 2% spread or $0.05 minimum
          const putBid = Math.max(0, theoreticalPutMid - spread / 2);
          const putAsk = theoreticalPutMid + spread / 2;
          
          // Replace 'C' with 'P' in option symbol
          const putSymbol = call.optionSymbol.replace(/C(\d{8})$/, 'P$1');
          
          const syntheticPut: MarketOptionQuote = {
            ...call,
            optionSymbol: putSymbol,
            side: 'put',
            bid: putBid,
            ask: putAsk,
            mid: theoreticalPutMid,
            bidSize: 0, // Synthetic, no actual market size
            askSize: 0,
            // PUT greeks are inverse of CALL greeks
            delta: call.delta - 1, // Put delta = Call delta - 1
            gamma: call.gamma, // Gamma is same for puts and calls
            theta: call.theta, // Approximate (slight difference in practice)
            vega: call.vega, // Vega is same for puts and calls
            rho: -call.rho, // Rho is negative for puts
          };
          
          quotes.push(syntheticPut);
        });
        
        console.log(`[Options Chain] Synthesized ${callsByStrikeExp.size} PUT options from calls`);
      }
      
      // Use available expirations from helper (more comprehensive than filtered results)
      console.log(`[Options Chain] After filtering: ${quotes.length} quotes from ${availableExpirations.length} available expirations`);
      if (expiration && quotes.length === 0) {
        console.log(`[Options Chain] WARNING: Requested expiration ${expiration} returned no quotes (available: ${availableExpirations.join(', ')})`);
      }
      
      // Calculate strike range from actual available strikes only (no extrapolation)
      const strikes = quotes.map(q => q.strike).sort((a, b) => a - b);
      const uniqueStrikes = Array.from(new Set(strikes)).sort((a, b) => a - b);
      const minStrike = uniqueStrikes.length > 0 ? Math.min(...uniqueStrikes) : 0;
      const maxStrike = uniqueStrikes.length > 0 ? Math.max(...uniqueStrikes) : 0;
      
      console.log(`[Options Chain] Using actual strike range from ${quotes.length} quotes: $${minStrike} - $${maxStrike} (${uniqueStrikes.length} unique strikes)`);

      const summary: MarketOptionChainSummary = {
        symbol: symbol.toUpperCase(),
        expirations: availableExpirations,
        minStrike,
        maxStrike,
        strikes: uniqueStrikes,
        quotes,
        cachedAt: Date.now(),
        ...(effectiveExpiration !== expiration && effectiveExpiration ? { 
          requestedExpiration: expiration,
          effectiveExpiration: effectiveExpiration,
        } : {}),
      };

      // Cache for 60 seconds
      await storage.setOptionsChainCache(cacheKey, summary, 60);

      res.json(summary);
    } catch (error: any) {
      console.error("Error fetching options chain:", error);
      
      // Propagate specific error types from helper
      if (error.status === 429) {
        return res.status(429).json({ 
          error: error.message,
          retryAfter: error.retryAfter 
        });
      }
      if (error.status === 404) {
        return res.status(404).json({ 
          error: error.message,
          message: "No options data available from Alpaca for this symbol. This may be due to API limits or the symbol may not have options."
        });
      }
      
      res.status(500).json({ error: "Failed to fetch options chain" });
    }
  });

  // Open Interest endpoint - fetches OI data from Alpaca contracts API
  app.get("/api/options/open-interest/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const expiration = req.query.expiration as string | undefined;

      if (!ALPACA_API_KEY || !ALPACA_API_SECRET) {
        return res.status(500).json({ error: "Alpaca API credentials not configured" });
      }

      const cacheKey = `oi-${symbol.toUpperCase()}-${expiration || 'nearest'}`;
      const cachedData = await storage.getOptionsChainCache(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }

      // Fetch contracts with OI from Alpaca Trading API
      const ALPACA_TRADING_URL = process.env.ALPACA_TRADING_URL || "https://paper-api.alpaca.markets/v2";
      
      const allContracts: any[] = [];
      let pageToken: string | null = null;
      let pageCount = 0;
      const maxPages = expiration ? 10 : 5;

      do {
        let url = `${ALPACA_TRADING_URL}/options/contracts?underlying_symbols=${symbol.toUpperCase()}&status=active&limit=100`;
        if (expiration) {
          url += `&expiration_date=${expiration}`;
        } else {
          // Get contracts for the nearest expiration by default
          const today = new Date().toISOString().split('T')[0];
          url += `&expiration_date_gte=${today}`;
        }
        if (pageToken) {
          url += `&page_token=${encodeURIComponent(pageToken)}`;
        }

        const response = await fetch(url, {
          headers: {
            'APCA-API-KEY-ID': ALPACA_API_KEY!,
            'APCA-API-SECRET-KEY': ALPACA_API_SECRET!,
          }
        });

        if (response.status === 429) {
          return res.status(429).json({ error: "Rate limit exceeded", retryAfter: response.headers.get("Retry-After") || "60" });
        }
        if (!response.ok) {
          console.error(`[Open Interest] Alpaca contracts API error: ${response.status}`);
          const text = await response.text();
          console.error(`[Open Interest] Response: ${text}`);
          return res.status(response.status).json({ error: `Alpaca API error: ${response.status}`, details: text });
        }

        const data = await response.json();
        const contracts = data.option_contracts || [];
        allContracts.push(...contracts);
        
        pageToken = data.next_page_token || null;
        pageCount++;
      } while (pageToken && pageCount < maxPages);

      console.log(`[Open Interest] Fetched ${allContracts.length} contracts for ${symbol.toUpperCase()}`);

      // Group by expiration date and extract available expirations
      const expirationSet = new Set<string>();
      const oiData: Array<{
        strike: number;
        type: string;
        openInterest: number;
        expiration: string;
        closePrice: number;
      }> = [];

      for (const contract of allContracts) {
        const oi = parseInt(contract.open_interest) || 0;
        const strike = parseFloat(contract.strike_price) || 0;
        const type = contract.type; // "call" or "put"
        const exp = contract.expiration_date;
        const closePrice = parseFloat(contract.close_price) || 0;

        expirationSet.add(exp);
        oiData.push({
          strike,
          type,
          openInterest: oi,
          expiration: exp,
          closePrice,
        });
      }

      const availableExpirations = Array.from(expirationSet).sort();
      
      // If no specific expiration requested, filter to nearest one
      let filteredData = oiData;
      if (!expiration && availableExpirations.length > 0) {
        const nearestExp = availableExpirations[0];
        filteredData = oiData.filter(d => d.expiration === nearestExp);
      }

      // Aggregate by strike
      const strikeMap = new Map<number, { callOI: number; putOI: number }>();
      for (const item of filteredData) {
        const existing = strikeMap.get(item.strike) || { callOI: 0, putOI: 0 };
        if (item.type === 'call') {
          existing.callOI += item.openInterest;
        } else {
          existing.putOI += item.openInterest;
        }
        strikeMap.set(item.strike, existing);
      }

      const strikes = Array.from(strikeMap.entries())
        .map(([strike, data]) => ({ strike, callOI: data.callOI, putOI: data.putOI }))
        .sort((a, b) => a.strike - b.strike);

      const totalCallOI = strikes.reduce((sum, s) => sum + s.callOI, 0);
      const totalPutOI = strikes.reduce((sum, s) => sum + s.putOI, 0);
      const totalOI = totalCallOI + totalPutOI;
      const putCallRatio = totalCallOI > 0 ? (totalPutOI / totalCallOI) : 0;

      const result = {
        symbol: symbol.toUpperCase(),
        expiration: expiration || (availableExpirations[0] ?? null),
        availableExpirations,
        strikes,
        stats: {
          totalCallOI,
          totalPutOI,
          totalOI,
          putCallRatio: Math.round(putCallRatio * 100) / 100,
        },
      };

      // Cache for 5 minutes (cast to any since this is a different shape than MarketOptionChainSummary)
      await storage.setOptionsChainCache(cacheKey, result as any, 5 * 60 * 1000);
      res.json(result);
    } catch (error: any) {
      console.error("[Open Interest] Error:", error);
      res.status(500).json({ error: "Failed to fetch open interest data" });
    }
  });

  // Company logo proxy endpoint to avoid CORS issues
  const symbolToDomain: Record<string, string> = {
    AAPL: "apple.com",
    MSFT: "microsoft.com",
    GOOGL: "google.com",
    AMZN: "amazon.com",
    NVDA: "nvidia.com",
    TSLA: "tesla.com",
    META: "meta.com",
    JPM: "jpmorganchase.com",
    V: "visa.com",
    WMT: "walmart.com",
    UNH: "unitedhealthgroup.com",
    JNJ: "jnj.com",
    SPY: "ssga.com",
    QQQ: "invesco.com",
    AMD: "amd.com",
    PLTR: "palantir.com",
    SOFI: "sofi.com",
    NIO: "nio.com",
    COIN: "coinbase.com",
    RIVN: "rivian.com",
    IWM: "ishares.com",
    EEM: "ishares.com",
    XLF: "ssga.com",
    XLE: "ssga.com",
    XLK: "ssga.com",
    XLV: "ssga.com",
    GLD: "ssga.com",
    SLV: "ishares.com",
    DIA: "ssga.com",
    NFLX: "netflix.com",
    INTC: "intel.com",
    BA: "boeing.com",
    DIS: "disney.com",
    UBER: "uber.com",
    PYPL: "paypal.com",
    BABA: "alibaba.com",
    CRM: "salesforce.com",
    ORCL: "oracle.com",
    CSCO: "cisco.com",
    IBM: "ibm.com",
    GE: "ge.com",
    F: "ford.com",
    GM: "gm.com",
    KO: "coca-colacompany.com",
    PEP: "pepsico.com",
    MCD: "mcdonalds.com",
    SBUX: "starbucks.com",
    NKE: "nike.com",
  };

  app.get("/api/logo/:symbol", async (req, res) => {
    const { symbol } = req.params;
    const upperSymbol = symbol.toUpperCase();
    
    try {
      // Use Financial Modeling Prep for stock logos (free, no auth required)
      const logoUrl = `https://financialmodelingprep.com/image-stock/${upperSymbol}.png`;
      
      const response = await fetch(logoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.ok) {
        const contentType = response.headers.get("content-type") || "image/png";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=86400");
        
        const buffer = await response.arrayBuffer();
        return res.send(Buffer.from(buffer));
      }
      
      res.status(404).json({ error: "Logo not found" });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch logo" });
    }
  });

  // ============================================================================
  // TASTYWORKS-STYLE BACKTESTING API
  // ============================================================================

  const backtestLegConfigSchema = z.object({
    id: z.string(),
    direction: z.enum(["buy", "sell"]),
    optionType: z.enum(["call", "put"]),
    quantity: z.number().int().positive(),
    strikeSelection: z.enum(["percentOTM", "priceOffset"]),
    strikeValue: z.number(),
    dte: z.number().int().positive(),
    linkedToLegId: z.string().optional(),
  });

  const backtestConfigSchema = z.object({
    symbol: z.string().min(1).max(10),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    legs: z.array(backtestLegConfigSchema).min(1),
    entryConditions: z.object({
      frequency: z.enum(["everyDay", "specificDays", "exactDTE"]),
      specificDays: z.array(z.number().int().min(0).max(6)).optional(),
      exactDTEMatch: z.boolean().optional(),
      maxActiveTrades: z.number().int().positive().optional(),
      useVix: z.boolean().optional(),
      vixMin: z.number().optional(),
      vixMax: z.number().optional(),
    }),
    exitConditions: z.object({
      exitAtDTE: z.number().int().min(0).optional(),
      exitAfterDays: z.number().int().positive().optional(),
      stopLossPercent: z.number().min(0).max(500).optional(),
      takeProfitPercent: z.number().min(0).max(500).optional(),
      useVix: z.boolean().optional(),
      vixExitAbove: z.number().optional(),
    }),
    capitalMethod: z.enum(["auto", "manual"]),
    manualCapital: z.number().positive().optional(),
    feePerContract: z.number().min(0).optional(),
  });

  // Create a new backtest run
  app.post("/api/backtest/tastyworks", async (req, res) => {
    try {
      const validation = backtestConfigSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid backtest configuration", 
          details: validation.error.errors 
        });
      }

      const config: BacktestConfigData = validation.data as BacktestConfigData;
      
      // Validate strike values based on selection method
      for (const leg of config.legs) {
        if (leg.strikeSelection === "percentOTM") {
          // % OTM should be between 0 and 50
          if (leg.strikeValue < 0 || leg.strikeValue > 50) {
            return res.status(400).json({ 
              error: `Invalid % OTM value ${leg.strikeValue}. Use 0-50%.` 
            });
          }
        } else if (leg.strikeSelection === "priceOffset") {
          // Price offset should be positive
          if (leg.strikeValue < 0) {
            return res.status(400).json({ 
              error: `Invalid price offset ${leg.strikeValue}. Use a positive value.` 
            });
          }
        }
      }
      
      // Validate date range
      const start = new Date(config.startDate);
      const end = new Date(config.endDate);
      const now = new Date();
      
      // Normalize dates to start of day for comparison
      const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (start >= end) {
        return res.status(400).json({ error: "Start date must be before end date" });
      }
      
      // Allow end date to be today (compare date portions only)
      if (endDateOnly > nowDateOnly) {
        return res.status(400).json({ error: "End date cannot be in the future" });
      }
      
      // Limit to 5 years of data
      const maxDays = 1825;
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > maxDays) {
        return res.status(400).json({ error: `Date range cannot exceed ${maxDays} days (5 years)` });
      }

      // Get user ID if authenticated
      const userId = (req as any).user?.id || null;

      // Create backtest run in database
      const backtestRun = await storage.createBacktestRun({
        userId,
        status: "pending",
        progress: 0,
        config: config as any,
      });

      console.log(`[BACKTEST] Created backtest run ${backtestRun.id} for ${config.symbol}`);

      // Start backtest asynchronously
      runTastyworksBacktest(backtestRun.id, config).catch(error => {
        console.error(`[BACKTEST] Async error for ${backtestRun.id}:`, error);
      });

      res.status(201).json({
        id: backtestRun.id,
        status: "pending",
        message: "Backtest started",
      });
    } catch (error: any) {
      console.error("[BACKTEST] Error creating backtest:", error);
      res.status(500).json({ 
        error: error.message || "Failed to create backtest" 
      });
    }
  });

  // Get backtest run status and results
  app.get("/api/backtest/tastyworks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const backtestRun = await storage.getBacktestRun(id);
      
      if (!backtestRun) {
        return res.status(404).json({ error: "Backtest not found" });
      }

      res.json({
        id: backtestRun.id,
        status: backtestRun.status,
        progress: backtestRun.progress,
        config: backtestRun.config,
        summary: backtestRun.summary,
        details: backtestRun.details,
        trades: backtestRun.trades,
        dailyLogs: backtestRun.dailyLogs,
        priceHistory: backtestRun.priceHistory,
        pnlHistory: backtestRun.pnlHistory,
        errorMessage: backtestRun.errorMessage,
        createdAt: backtestRun.createdAt,
        completedAt: backtestRun.completedAt,
      });
    } catch (error: any) {
      console.error("[BACKTEST] Error fetching backtest:", error);
      res.status(500).json({ 
        error: error.message || "Failed to fetch backtest" 
      });
    }
  });

  // List user's backtest runs
  app.get("/api/backtest/tastyworks", async (req, res) => {
    try {
      const userId = (req as any).user?.id || undefined;
      
      const backtestRuns = await storage.getBacktestRuns(userId);
      
      // Return summary info only (not full results)
      const runs = backtestRuns.map(run => ({
        id: run.id,
        status: run.status,
        progress: run.progress,
        config: run.config,
        summary: run.summary,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
      }));

      res.json(runs);
    } catch (error: any) {
      console.error("[BACKTEST] Error listing backtests:", error);
      res.status(500).json({ 
        error: error.message || "Failed to list backtests" 
      });
    }
  });

  // Delete a backtest run
  app.delete("/api/backtest/tastyworks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const deleted = await storage.deleteBacktestRun(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Backtest not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("[BACKTEST] Error deleting backtest:", error);
      res.status(500).json({ 
        error: error.message || "Failed to delete backtest" 
      });
    }
  });

  // ============================================================================
  // LEGACY SIMPLE BACKTEST (kept for backwards compatibility)
  // ============================================================================

  // Backtesting endpoint - runs strategy backtest against historical data
  const backtestRequestSchema = z.object({
    symbol: z.string().min(1).max(10),
    legs: z.array(z.object({
      id: z.string(),
      type: z.enum(["call", "put"]),
      position: z.enum(["long", "short"]),
      strike: z.number().positive(),
      quantity: z.number().int().positive(),
      premium: z.number().min(0),
      expirationDays: z.number().int().min(0),
      expirationDate: z.string().optional(),
      isExcluded: z.boolean().optional(),
      closingTransaction: z.object({
        quantity: z.number(),
        closingPrice: z.number(),
        isEnabled: z.boolean(),
        entries: z.array(z.any()).optional(),
      }).optional(),
    })).min(1),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    initialVolatility: z.number().min(0.01).max(3),
    entryPrice: z.number().positive(),
  });

  app.post("/api/backtest", async (req, res) => {
    try {
      const validation = backtestRequestSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid backtest request", 
          details: validation.error.errors 
        });
      }

      const request: BacktestRequest = validation.data as BacktestRequest;
      
      // Validate date range
      const start = new Date(request.startDate);
      const end = new Date(request.endDate);
      const now = new Date();
      
      // Normalize dates to start of day for comparison
      const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (start >= end) {
        return res.status(400).json({ error: "Start date must be before end date" });
      }
      
      // Allow end date to be today (compare date portions only)
      if (endDateOnly > nowDateOnly) {
        return res.status(400).json({ error: "End date cannot be in the future" });
      }
      
      // Limit to 2 years of data
      const maxDays = 730;
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > maxDays) {
        return res.status(400).json({ error: `Date range cannot exceed ${maxDays} days` });
      }

      console.log(`[BACKTEST] Running backtest for ${request.symbol} from ${request.startDate} to ${request.endDate}`);
      
      const result = await runBacktest(request);
      
      console.log(`[BACKTEST] Completed: ${result.dataPoints.length} data points, return: $${result.metrics.totalReturn.toFixed(2)}`);
      
      res.json(result);
    } catch (error: any) {
      console.error("[BACKTEST] Error:", error);
      res.status(500).json({ 
        error: error.message || "Failed to run backtest" 
      });
    }
  });

  // Price-based backtesting endpoint (uses real historical option prices)
  const priceBacktestConfigSchema = z.object({
    symbol: z.string().min(1).max(10),
    startDate: z.string(),
    endDate: z.string(),
    initialCash: z.number().min(1000).default(10000),
    strategy: z.object({
      type: z.enum(["short-put", "short-call", "covered-call", "iron-condor"]),
      params: z.record(z.any()).optional(),
    }),
  });

  app.post("/api/backtest/price-based", async (req, res) => {
    try {
      const validation = priceBacktestConfigSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid backtest configuration", 
          details: validation.error.errors 
        });
      }

      const config = validation.data;
      const startDate = new Date(config.startDate);
      const endDate = new Date(config.endDate);
      const now = new Date();
      
      const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (startDate >= endDate) {
        return res.status(400).json({ error: "Start date must be before end date" });
      }
      
      if (endDateOnly > nowDateOnly) {
        return res.status(400).json({ error: "End date cannot be in the future" });
      }

      if (!ALPACA_API_KEY || !ALPACA_API_SECRET) {
        return res.status(500).json({ error: "Alpaca API credentials not configured" });
      }

      console.log(`[PRICE-BACKTEST] Starting price-based backtest for ${config.symbol}`);
      console.log(`[PRICE-BACKTEST] Date range: ${config.startDate} to ${config.endDate}`);
      console.log(`[PRICE-BACKTEST] Strategy: ${config.strategy.type}`);

      // Create strategy based on type
      let strategy;
      switch (config.strategy.type) {
        case "short-put":
          strategy = new ShortPutStrategy(config.strategy.params);
          break;
        default:
          return res.status(400).json({ error: `Strategy type ${config.strategy.type} not yet implemented` });
      }

      // Fetch historical stock data from Alpaca
      const stockBarsUrl = `https://data.alpaca.markets/v2/stocks/${config.symbol}/bars?start=${config.startDate}&end=${config.endDate}&timeframe=1Day&adjustment=split`;
      const stockResponse = await fetch(stockBarsUrl, {
        headers: {
          "APCA-API-KEY-ID": ALPACA_API_KEY,
          "APCA-API-SECRET-KEY": ALPACA_API_SECRET,
        },
      });

      if (!stockResponse.ok) {
        const errorText = await stockResponse.text();
        console.error(`[PRICE-BACKTEST] Stock data error: ${errorText}`);
        return res.status(500).json({ error: "Failed to fetch stock price data" });
      }

      const stockData = await stockResponse.json();
      const stockPricesByDate = new Map<string, number>();
      
      if (stockData.bars) {
        for (const bar of stockData.bars) {
          const date = new Date(bar.t).toDateString();
          stockPricesByDate.set(date, bar.c);
        }
      }

      console.log(`[PRICE-BACKTEST] Loaded ${stockPricesByDate.size} days of stock prices`);

      if (stockPricesByDate.size === 0) {
        return res.status(400).json({ 
          error: "No stock data available for the specified date range",
          message: "Please check the date range and ensure Alpaca has data for this period"
        });
      }

      // Fetch historical options data from Alpaca
      // First, get available option contracts for this symbol
      const optionSnapshotsUrl = `${ALPACA_BASE_URL}/options/snapshots/${config.symbol.toUpperCase()}?feed=indicative`;
      const optionResponse = await fetch(optionSnapshotsUrl, {
        headers: {
          "APCA-API-KEY-ID": ALPACA_API_KEY,
          "APCA-API-SECRET-KEY": ALPACA_API_SECRET,
        },
      });

      const optionChainsByDate = new Map<string, OptionChain>();

      if (optionResponse.ok) {
        const optionData = await optionResponse.json();
        const snapshots = optionData.snapshots || {};
        
        // Parse option snapshots into our format
        for (const [optionSymbol, snapshot] of Object.entries(snapshots as Record<string, any>)) {
          const match = optionSymbol.match(/^([A-Z]+)(\d{6})([CP])(\d+)$/);
          if (!match) continue;

          const [, , dateStr, typeChar, strikeStr] = match;
          const year = 2000 + parseInt(dateStr.substring(0, 2));
          const month = parseInt(dateStr.substring(2, 4)) - 1;
          const day = parseInt(dateStr.substring(4, 6));
          const expiration = new Date(year, month, day);
          const optionType = typeChar === "C" ? "call" : "put";
          const strike = parseInt(strikeStr) / 1000;

          const quote = snapshot.latestQuote;
          if (!quote) continue;

          const timestamp = new Date(quote.t || new Date());
          const dateKey = timestamp.toDateString();
          const underlyingPrice = stockPricesByDate.get(dateKey) || 0;

          if (!optionChainsByDate.has(dateKey)) {
            optionChainsByDate.set(dateKey, new OptionChain(timestamp, underlyingPrice));
          }

          const chain = optionChainsByDate.get(dateKey)!;
          chain.addSnapshot(new OptionSnapshotImpl({
            timestamp,
            optionSymbol,
            optionType: optionType as "call" | "put",
            strike,
            expiration,
            bid: quote.bp || 0,
            ask: quote.ap || 0,
            underlyingPrice,
            impliedVolatility: snapshot.impliedVolatility,
            delta: snapshot.greeks?.delta,
            gamma: snapshot.greeks?.gamma,
            theta: snapshot.greeks?.theta,
            vega: snapshot.greeks?.vega,
          }));
        }

        console.log(`[PRICE-BACKTEST] Built ${optionChainsByDate.size} option chains from Alpaca data`);
      } else {
        console.log(`[PRICE-BACKTEST] No options data available from Alpaca (may require subscription)`);
      }

      // If we have option chains, run the backtest
      if (optionChainsByDate.size > 0) {
        const backtester = new Backtester({
          symbol: config.symbol,
          startDate,
          endDate,
          initialCash: config.initialCash,
          strategy,
        });

        const result = await backtester.runWithData(optionChainsByDate, stockPricesByDate);

        res.json({
          status: "completed",
          result,
          logs: backtester.getLogs(),
        });
      } else {
        // Return partial response if no options data available
        res.json({
          status: "partial",
          message: "Price-based backtesting requires historical options data. Stock price data loaded successfully.",
          stockDataDays: stockPricesByDate.size,
          dateRange: {
            start: config.startDate,
            end: config.endDate,
          },
          note: "Full historical options data (bid/ask prices) requires Alpaca Options Data subscription or CSV upload. Use /api/backtest/upload-csv to provide historical option prices.",
          engineStatus: "ready",
          strategy: config.strategy.type,
        });
      }

    } catch (error: any) {
      console.error("[PRICE-BACKTEST] Error:", error);
      res.status(500).json({ 
        error: error.message || "Failed to run price-based backtest" 
      });
    }
  });

  // Schema for CSV backtest upload
  const csvBacktestSchema = z.object({
    csvContent: z.string().min(1).max(10000000), // Max 10MB of CSV content
    symbol: z.string().min(1).max(10).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    initialCash: z.number().min(1000).max(10000000).default(10000),
    strategyType: z.enum(["short-put", "short-call", "covered-call", "iron-condor"]).default("short-put"),
    strategyParams: z.record(z.any()).optional(),
  });

  // Endpoint to upload CSV data for price-based backtesting
  app.post("/api/backtest/upload-csv", async (req, res) => {
    try {
      const validation = csvBacktestSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: validation.error.errors 
        });
      }

      const { csvContent, symbol, startDate, endDate, initialCash, strategyType, strategyParams } = validation.data;

      // Parse CSV data
      const rows = CSVDataLoader.parseCSV(csvContent);
      
      if (rows.length === 0) {
        return res.status(400).json({ error: "No valid data found in CSV" });
      }

      if (rows.length > 1000000) {
        return res.status(400).json({ error: "CSV file too large. Maximum 1 million rows allowed." });
      }

      console.log(`[CSV-BACKTEST] Parsed ${rows.length} rows from CSV`);

      // Build option chains
      const optionChainsByDate = CSVDataLoader.buildOptionChains(rows);
      
      // Build stock prices map
      const stockPricesByDate = new Map<string, number>();
      for (const row of rows) {
        const date = new Date(row.timestamp).toDateString();
        if (!stockPricesByDate.has(date)) {
          stockPricesByDate.set(date, row.underlyingPrice);
        }
      }

      console.log(`[CSV-BACKTEST] Built ${optionChainsByDate.size} option chains`);

      // Create strategy
      let strategy;
      switch (strategyType || "short-put") {
        case "short-put":
          strategy = new ShortPutStrategy(strategyParams || {});
          break;
        default:
          return res.status(400).json({ error: `Strategy type ${strategyType} not yet implemented` });
      }

      // Run backtest
      const backtester = new Backtester({
        symbol: symbol || "UNKNOWN",
        startDate: startDate ? new Date(startDate) : new Date(rows[0].timestamp),
        endDate: endDate ? new Date(endDate) : new Date(rows[rows.length - 1].timestamp),
        initialCash: initialCash || 10000,
        strategy,
      });

      const result = await backtester.runWithData(optionChainsByDate, stockPricesByDate);

      res.json({
        status: "completed",
        result,
        logs: backtester.getLogs(),
      });

    } catch (error: any) {
      console.error("[CSV-BACKTEST] Error:", error);
      res.status(500).json({ 
        error: error.message || "Failed to run CSV backtest" 
      });
    }
  });

  // ==========================================
  // Blog Routes
  // ==========================================

  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "randel.lillep@gmail.com").split(",").map(e => e.trim().toLowerCase());

  function isAdmin(req: any): boolean {
    const user = req.user || (req.session as any)?.passport?.user;
    if (!user) return false;
    const email = (user.email || "").toLowerCase();
    return ADMIN_EMAILS.includes(email);
  }

  function requireAdmin(req: any, res: any, next: any) {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  }

  app.get('/api/blog/posts', async (_req, res) => {
    try {
      const posts = await storage.getBlogPosts(true);
      const safePosts = posts.map(({ content, ...rest }) => rest);
      res.json({ posts: safePosts });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/blog/posts/:slug', async (req, res) => {
    try {
      const post = await storage.getBlogPostBySlug(req.params.slug);
      if (!post) return res.status(404).json({ error: "Post not found" });
      if (post.published !== 1) return res.status(404).json({ error: "Post not found" });
      res.json({ post });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/admin/blog/posts', isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const posts = await storage.getBlogPosts(false);
      res.json({ posts });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/admin/blog/posts/:id', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const post = await storage.getBlogPost(req.params.id);
      if (!post) return res.status(404).json({ error: "Post not found" });
      res.json({ post });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/blog/posts', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const schema = z.object({
        title: z.string().min(1),
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
        excerpt: z.string().optional(),
        content: z.string().min(1),
        coverImage: z.string().optional(),
        published: z.number().min(0).max(1).default(0),
      });
      const parsed = schema.parse(req.body);

      const existing = await storage.getBlogPostBySlug(parsed.slug);
      if (existing) return res.status(400).json({ error: "A post with this slug already exists" });

      const post = await storage.createBlogPost({
        ...parsed,
        authorId: userId,
        publishedAt: parsed.published === 1 ? new Date() : null,
      });
      res.json({ post });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid post data", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/admin/blog/posts/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const schema = z.object({
        title: z.string().min(1).optional(),
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
        excerpt: z.string().optional(),
        content: z.string().min(1).optional(),
        coverImage: z.string().nullable().optional(),
        published: z.number().min(0).max(1).optional(),
      });
      const parsed = schema.parse(req.body);

      if (parsed.slug) {
        const existing = await storage.getBlogPostBySlug(parsed.slug);
        if (existing && existing.id !== req.params.id) {
          return res.status(400).json({ error: "A post with this slug already exists" });
        }
      }

      const updates: any = { ...parsed };
      if (parsed.published === 1) {
        const current = await storage.getBlogPost(req.params.id);
        if (current && current.published !== 1) {
          updates.publishedAt = new Date();
        }
      }

      const post = await storage.updateBlogPost(req.params.id, updates);
      if (!post) return res.status(404).json({ error: "Post not found" });
      res.json({ post });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid post data", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/admin/blog/posts/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const deleted = await storage.deleteBlogPost(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Post not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/blog/upload', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const schema = z.object({
        filename: z.string().min(1),
        mimeType: z.string().min(1).refine(
          (val) => ALLOWED_MIME_TYPES.includes(val),
          { message: `Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}` }
        ),
        data: z.string().min(1),
      });
      const parsed = schema.parse(req.body);

      const maxSize = 5 * 1024 * 1024;
      const dataSize = Buffer.from(parsed.data, 'base64').length;
      if (dataSize > maxSize) {
        return res.status(400).json({ error: "Image too large (max 5MB)" });
      }

      const image = await storage.saveBlogImage({
        authorId: userId,
        filename: parsed.filename,
        mimeType: parsed.mimeType,
        data: parsed.data,
      });
      res.json({ id: image.id, url: `/api/blog/images/${image.id}` });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid upload data", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/blog/images/:id', async (req, res) => {
    try {
      const image = await storage.getBlogImage(req.params.id);
      if (!image) return res.status(404).json({ error: "Image not found" });
      const buffer = Buffer.from(image.data, 'base64');
      res.setHeader('Content-Type', image.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/admin/check', isAuthenticated, (req: any, res) => {
    res.json({ isAdmin: isAdmin(req) });
  });

  // ==========================================
  // Brokerage Integration Routes
  // ==========================================

  const ALPACA_PAPER_URL = "https://paper-api.alpaca.markets";
  const ALPACA_LIVE_URL = "https://api.alpaca.markets";
  const TASTYTRADE_API_URL = "https://api.tastytrade.com";
  const TASTYTRADE_SANDBOX_URL = "https://api.cert.tastytrade.com";

  function getAlpacaBaseUrl(isPaper: boolean): string {
    return isPaper ? ALPACA_PAPER_URL : ALPACA_LIVE_URL;
  }

  function getTastytradeBaseUrl(isPaper: boolean): string {
    return isPaper ? TASTYTRADE_SANDBOX_URL : TASTYTRADE_API_URL;
  }

  async function getTastytradeSession(baseUrl: string, username: string, password: string): Promise<{ sessionToken: string; accounts: any[] }> {
    const loginRes = await fetch(`${baseUrl}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: username, password }),
    });
    if (!loginRes.ok) {
      const err = await loginRes.text();
      throw new Error(`Tastytrade login failed: ${err}`);
    }
    const loginData = await loginRes.json();
    const sessionToken = loginData.data?.["session-token"];
    if (!sessionToken) throw new Error("No session token returned");

    const accountsRes = await fetch(`${baseUrl}/customers/me/accounts`, {
      headers: { Authorization: sessionToken },
    });
    if (!accountsRes.ok) throw new Error("Failed to fetch Tastytrade accounts");
    const accountsData = await accountsRes.json();
    return { sessionToken, accounts: accountsData.data?.items || [] };
  }

  function tastytradeHeaders(sessionToken: string): Record<string, string> {
    return { Authorization: sessionToken, "Content-Type": "application/json" };
  }

  function buildOccSymbol(underlying: string, expirationDate: string, optionType: "call" | "put", strike: number): string {
    const root = underlying.toUpperCase();
    const exp = expirationDate.replace(/-/g, '').slice(2);
    const side = optionType === "call" ? "C" : "P";
    const strikeInt = Math.round(strike * 1000);
    const strikeStr = strikeInt.toString().padStart(8, '0');
    return `${root}${exp}${side}${strikeStr}`;
  }

  function buildTastytradeSymbol(underlying: string, expirationDate: string, optionType: "call" | "put", strike: number): string {
    const root = underlying.toUpperCase().padEnd(6, ' ');
    const exp = expirationDate.replace(/-/g, '').slice(2);
    const side = optionType === "call" ? "C" : "P";
    const strikeInt = Math.round(strike * 1000);
    const strikeStr = strikeInt.toString().padStart(8, '0');
    return `${root}${exp}${side}${strikeStr}`;
  }

  app.get('/api/brokerage/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const connections = await storage.getBrokerageConnections(userId);
      const safe = connections.map(c => ({
        id: c.id,
        broker: c.broker,
        isPaper: c.isPaper,
        label: c.label,
        createdAt: c.createdAt,
        apiKeyLast4: c.apiKey.slice(-4),
      }));
      res.json({ connections: safe });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/brokerage/connect', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const schema = z.object({
        broker: z.enum(["alpaca", "tastytrade"]),
        apiKey: z.string().min(1),
        apiSecret: z.string().min(1),
        isPaper: z.number().min(0).max(1).default(1),
        label: z.string().optional(),
      });
      const parsed = schema.parse(req.body);

      if (parsed.broker === "tastytrade") {
        const baseUrl = getTastytradeBaseUrl(parsed.isPaper === 1);
        const { sessionToken, accounts } = await getTastytradeSession(baseUrl, parsed.apiKey, parsed.apiSecret);
        
        if (accounts.length === 0) {
          return res.status(400).json({ error: "No Tastytrade accounts found" });
        }
        const accountNumber = accounts[0].account?.["account-number"] || accounts[0]["account-number"];
        if (!accountNumber) {
          return res.status(400).json({ error: "Could not determine Tastytrade account number" });
        }

        const balRes = await fetch(`${baseUrl}/accounts/${accountNumber}/balances`, {
          headers: tastytradeHeaders(sessionToken),
        });
        const balData = balRes.ok ? await balRes.json() : null;
        const bal = balData?.data;

        const connection = await storage.createBrokerageConnection({
          userId,
          broker: "tastytrade",
          apiKey: parsed.apiKey,
          apiSecret: parsed.apiSecret,
          isPaper: parsed.isPaper,
          label: parsed.label || `tastytrade ${parsed.isPaper === 1 ? "Sandbox" : "Live"} (${accountNumber})`,
        });

        return res.json({
          connection: {
            id: connection.id,
            broker: connection.broker,
            isPaper: connection.isPaper,
            label: connection.label,
            apiKeyLast4: parsed.apiKey.slice(-4),
          },
          account: {
            id: accountNumber,
            status: "ACTIVE",
            buyingPower: parseFloat(bal?.["derivative-buying-power"] || bal?.["buying-power"] || "0"),
            cash: parseFloat(bal?.["cash-balance"] || "0"),
            equity: parseFloat(bal?.["net-liquidating-value"] || "0"),
            portfolioValue: parseFloat(bal?.["net-liquidating-value"] || "0"),
          },
        });
      }

      const baseUrl = getAlpacaBaseUrl(parsed.isPaper === 1);
      const verifyRes = await fetch(`${baseUrl}/v2/account`, {
        headers: {
          "APCA-API-KEY-ID": parsed.apiKey,
          "APCA-API-SECRET-KEY": parsed.apiSecret,
        },
      });

      if (!verifyRes.ok) {
        const errText = await verifyRes.text();
        return res.status(400).json({ error: `Failed to verify API credentials: ${errText}` });
      }

      const accountData = await verifyRes.json();

      const connection = await storage.createBrokerageConnection({
        userId,
        broker: parsed.broker,
        apiKey: parsed.apiKey,
        apiSecret: parsed.apiSecret,
        isPaper: parsed.isPaper,
        label: parsed.label || `${parsed.broker} ${parsed.isPaper === 1 ? "Paper" : "Live"}`,
      });

      res.json({
        connection: {
          id: connection.id,
          broker: connection.broker,
          isPaper: connection.isPaper,
          label: connection.label,
          apiKeyLast4: connection.apiKey.slice(-4),
        },
        account: {
          id: accountData.id,
          status: accountData.status,
          buyingPower: parseFloat(accountData.buying_power),
          cash: parseFloat(accountData.cash),
          equity: parseFloat(accountData.equity),
          portfolioValue: parseFloat(accountData.portfolio_value),
          patternDayTrader: accountData.pattern_day_trader,
          tradingBlocked: accountData.trading_blocked,
          accountBlocked: accountData.account_blocked,
        },
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/brokerage/disconnect/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const deleted = await storage.deleteBrokerageConnection(req.params.id, userId);
      if (!deleted) return res.status(404).json({ error: "Connection not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/brokerage/account/:connectionId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const conn = await storage.getBrokerageConnection(req.params.connectionId, userId);
      if (!conn) return res.status(404).json({ error: "Connection not found" });

      if (conn.broker === "tastytrade") {
        const baseUrl = getTastytradeBaseUrl(conn.isPaper === 1);
        const { sessionToken, accounts } = await getTastytradeSession(baseUrl, conn.apiKey, conn.apiSecret);
        const accountNumber = accounts[0]?.account?.["account-number"] || accounts[0]?.["account-number"];
        if (!accountNumber) return res.status(400).json({ error: "No account found" });

        const balRes = await fetch(`${baseUrl}/accounts/${accountNumber}/balances`, {
          headers: tastytradeHeaders(sessionToken),
        });
        if (!balRes.ok) return res.status(balRes.status).json({ error: "Failed to fetch balances" });
        const balData = await balRes.json();
        const bal = balData.data;
        return res.json({
          id: accountNumber,
          status: "ACTIVE",
          buyingPower: parseFloat(bal?.["derivative-buying-power"] || bal?.["buying-power"] || "0"),
          cash: parseFloat(bal?.["cash-balance"] || "0"),
          equity: parseFloat(bal?.["net-liquidating-value"] || "0"),
          portfolioValue: parseFloat(bal?.["net-liquidating-value"] || "0"),
        });
      }

      const baseUrl = getAlpacaBaseUrl(conn.isPaper === 1);
      const accountRes = await fetch(`${baseUrl}/v2/account`, {
        headers: {
          "APCA-API-KEY-ID": conn.apiKey,
          "APCA-API-SECRET-KEY": conn.apiSecret,
        },
      });
      if (!accountRes.ok) {
        return res.status(accountRes.status).json({ error: "Failed to fetch account data" });
      }
      const data = await accountRes.json();
      res.json({
        id: data.id,
        status: data.status,
        buyingPower: parseFloat(data.buying_power),
        cash: parseFloat(data.cash),
        equity: parseFloat(data.equity),
        portfolioValue: parseFloat(data.portfolio_value),
        patternDayTrader: data.pattern_day_trader,
        tradingBlocked: data.trading_blocked,
        accountBlocked: data.account_blocked,
        daytradeCount: data.daytrade_count,
        lastEquity: parseFloat(data.last_equity),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/brokerage/orders/:connectionId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const conn = await storage.getBrokerageConnection(req.params.connectionId, userId);
      if (!conn) return res.status(404).json({ error: "Connection not found" });

      if (conn.broker === "tastytrade") {
        const baseUrl = getTastytradeBaseUrl(conn.isPaper === 1);
        const { sessionToken, accounts } = await getTastytradeSession(baseUrl, conn.apiKey, conn.apiSecret);
        const accountNumber = accounts[0]?.account?.["account-number"] || accounts[0]?.["account-number"];
        if (!accountNumber) return res.status(400).json({ error: "No account found" });

        const ordersRes = await fetch(`${baseUrl}/accounts/${accountNumber}/orders?per-page=50`, {
          headers: tastytradeHeaders(sessionToken),
        });
        if (!ordersRes.ok) return res.status(ordersRes.status).json({ error: "Failed to fetch orders" });
        const ordersData = await ordersRes.json();
        const ttOrders = ordersData.data?.items || [];
        
        const ttStatusMap: Record<string, string> = {
          "Received": "new",
          "Routed": "accepted",
          "In Flight": "pending_new",
          "Live": "accepted",
          "Filled": "filled",
          "Cancelled": "canceled",
          "Expired": "expired",
          "Rejected": "rejected",
          "Contingent": "pending_new",
          "Partially Filled": "partially_filled",
          "Done": "done_for_day",
        };
        const normalizedOrders = ttOrders.map((o: any) => {
          const legs = (o.legs || []).map((leg: any) => ({
            id: leg.id || "",
            symbol: (leg.symbol || "").trim(),
            qty: String(leg.quantity || 0),
            side: (leg.action === "Sell to Open" || leg.action === "Sell to Close") ? "sell" : "buy",
            type: o["order-type"]?.toLowerCase() || "limit",
            status: ttStatusMap[o.status] || o.status?.toLowerCase()?.replace(/ /g, "_") || "",
            filled_qty: String(leg["remaining-quantity"] != null ? Math.max(0, (leg.quantity || 0) - (leg["remaining-quantity"] || 0)) : 0),
            filled_avg_price: o["average-fill-price"] ? String(o["average-fill-price"]) : null,
          }));
          const totalQty = legs.reduce((s: number, l: any) => s + parseInt(l.qty || "0"), 0);
          const totalFilled = legs.reduce((s: number, l: any) => s + parseInt(l.filled_qty || "0"), 0);
          return {
            id: String(o.id || ""),
            symbol: legs.length === 1 ? legs[0].symbol : "",
            qty: String(o.size || totalQty),
            side: legs.length === 1 ? legs[0].side : "",
            type: o["order-type"]?.toLowerCase() || "limit",
            status: ttStatusMap[o.status] || o.status?.toLowerCase()?.replace(/ /g, "_") || "",
            filled_qty: String(totalFilled),
            filled_avg_price: o["average-fill-price"] ? String(o["average-fill-price"]) : null,
            submitted_at: o["updated-at"] || o["created-at"] || "",
            created_at: o["created-at"] || "",
            updated_at: o["updated-at"] || "",
            order_class: legs.length > 1 ? "mleg" : "",
            legs: legs.length > 1 ? legs : undefined,
          };
        });
        return res.json({ orders: normalizedOrders });
      }

      const baseUrl = getAlpacaBaseUrl(conn.isPaper === 1);
      const status = (req.query.status as string) || "all";
      const limit = (req.query.limit as string) || "50";
      const ordersRes = await fetch(`${baseUrl}/v2/orders?status=${status}&limit=${limit}&direction=desc`, {
        headers: {
          "APCA-API-KEY-ID": conn.apiKey,
          "APCA-API-SECRET-KEY": conn.apiSecret,
        },
      });
      if (!ordersRes.ok) {
        return res.status(ordersRes.status).json({ error: "Failed to fetch orders" });
      }
      const orders = await ordersRes.json();
      res.json({ orders });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/brokerage/orders/:connectionId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const conn = await storage.getBrokerageConnection(req.params.connectionId, userId);
      if (!conn) return res.status(404).json({ error: "Connection not found" });

      const orderSchema = z.object({
        legs: z.array(z.object({
          symbol: z.string(),
          expirationDate: z.string(),
          optionType: z.enum(["call", "put"]),
          strike: z.number(),
          side: z.enum(["buy", "sell"]),
          quantity: z.number().int().min(1),
        })),
        type: z.enum(["market", "limit", "stop", "stop_limit"]).default("limit"),
        timeInForce: z.enum(["day", "gtc", "ioc"]).default("day"),
        limitPrice: z.number().optional(),
      });
      const parsed = orderSchema.parse(req.body);

      for (const leg of parsed.legs) {
        if (!leg.expirationDate || !/^\d{4}-\d{2}-\d{2}$/.test(leg.expirationDate)) {
          return res.status(400).json({ error: `Invalid expiration date for ${leg.symbol} $${leg.strike} ${leg.optionType}` });
        }
        if (leg.strike <= 0) {
          return res.status(400).json({ error: `Invalid strike price: ${leg.strike}` });
        }
      }

      if (conn.broker === "tastytrade") {
        const baseUrl = getTastytradeBaseUrl(conn.isPaper === 1);
        const { sessionToken, accounts } = await getTastytradeSession(baseUrl, conn.apiKey, conn.apiSecret);
        const accountNumber = accounts[0]?.account?.["account-number"] || accounts[0]?.["account-number"];
        if (!accountNumber) return res.status(400).json({ error: "No account found" });

        const ttLegs = parsed.legs.map(leg => {
          const ttSymbol = buildTastytradeSymbol(leg.symbol, leg.expirationDate, leg.optionType, leg.strike);
          return {
            "instrument-type": "Equity Option",
            symbol: ttSymbol,
            action: leg.side === "sell" ? "Sell to Open" : "Buy to Open",
            quantity: leg.quantity,
          };
        });

        const ttOrder: any = {
          "time-in-force": parsed.timeInForce === "gtc" ? "GTC" : "Day",
          "order-type": parsed.type === "market" ? "Market" : "Limit",
          legs: ttLegs,
        };
        if (parsed.type === "limit" && parsed.limitPrice != null) {
          ttOrder.price = parsed.limitPrice.toString();
          ttOrder["price-effect"] = parsed.limitPrice >= 0 ? "Credit" : "Debit";
          if (parsed.limitPrice < 0) {
            ttOrder.price = Math.abs(parsed.limitPrice).toString();
          }
        }

        const orderRes = await fetch(`${baseUrl}/accounts/${accountNumber}/orders`, {
          method: "POST",
          headers: tastytradeHeaders(sessionToken),
          body: JSON.stringify(ttOrder),
        });
        const result = await orderRes.json();
        if (!orderRes.ok) {
          const errMsg = result.error?.message || result.error?.errors?.[0]?.message || "Order rejected";
          return res.status(orderRes.status).json({ error: errMsg, details: result });
        }
        return res.json({ order: { id: result.data?.id || "unknown", status: result.data?.status || "submitted", ...result.data } });
      }

      const baseUrl = getAlpacaBaseUrl(conn.isPaper === 1);

      if (parsed.legs.length === 1) {
        const leg = parsed.legs[0];
        const occSymbol = buildOccSymbol(leg.symbol, leg.expirationDate, leg.optionType, leg.strike);
        const orderBody: any = {
          symbol: occSymbol,
          qty: leg.quantity.toString(),
          side: leg.side === "sell" ? "sell" : "buy",
          type: parsed.type,
          time_in_force: parsed.timeInForce,
        };
        if (parsed.type === "limit" && parsed.limitPrice != null) {
          orderBody.limit_price = parsed.limitPrice.toString();
        }

        const orderRes = await fetch(`${baseUrl}/v2/orders`, {
          method: "POST",
          headers: {
            "APCA-API-KEY-ID": conn.apiKey,
            "APCA-API-SECRET-KEY": conn.apiSecret,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(orderBody),
        });
        const result = await orderRes.json();
        if (!orderRes.ok) {
          return res.status(orderRes.status).json({ error: result.message || "Order rejected", details: result });
        }
        return res.json({ order: result });
      }

      const quantities = parsed.legs.map(l => l.quantity);
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
      const overallGcd = quantities.reduce((a, b) => gcd(a, b));

      const alpacaLegs = parsed.legs.map(leg => {
        const occSymbol = buildOccSymbol(leg.symbol, leg.expirationDate, leg.optionType, leg.strike);
        return {
          symbol: occSymbol,
          ratio_qty: (leg.quantity / overallGcd).toString(),
          side: leg.side === "sell" ? "sell" : "buy",
        };
      });

      const mloBody: any = {
        order_class: "mleg",
        qty: overallGcd.toString(),
        legs: alpacaLegs,
        type: parsed.type,
        time_in_force: parsed.timeInForce,
      };
      if (parsed.type === "limit" && parsed.limitPrice != null) {
        mloBody.limit_price = parsed.limitPrice.toString();
      }

      const orderRes = await fetch(`${baseUrl}/v2/orders`, {
        method: "POST",
        headers: {
          "APCA-API-KEY-ID": conn.apiKey,
          "APCA-API-SECRET-KEY": conn.apiSecret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mloBody),
      });
      const result = await orderRes.json();
      if (!orderRes.ok) {
        return res.status(orderRes.status).json({ error: result.message || "Order rejected", details: result });
      }
      res.json({ order: result });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid order data", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/brokerage/positions/:connectionId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const conn = await storage.getBrokerageConnection(req.params.connectionId, userId);
      if (!conn) return res.status(404).json({ error: "Connection not found" });

      if (conn.broker === "tastytrade") {
        const baseUrl = getTastytradeBaseUrl(conn.isPaper === 1);
        const { sessionToken, accounts } = await getTastytradeSession(baseUrl, conn.apiKey, conn.apiSecret);
        const accountNumber = accounts[0]?.account?.["account-number"] || accounts[0]?.["account-number"];
        if (!accountNumber) return res.status(400).json({ error: "No account found" });

        const posRes = await fetch(`${baseUrl}/accounts/${accountNumber}/positions`, {
          headers: tastytradeHeaders(sessionToken),
        });
        if (!posRes.ok) return res.status(posRes.status).json({ error: "Failed to fetch positions" });
        const posData = await posRes.json();
        const ttPositions = posData.data?.items || [];

        const positions = ttPositions.map((p: any) => {
          const isShort = p["quantity-direction"] === "Short";
          const qty = Math.abs(p.quantity || 0);
          const multiplier = p.multiplier || 100;
          const markPrice = parseFloat(p["mark-price"] || p["close-price"] || "0");
          const avgOpen = parseFloat(p["average-open-price"] || "0");
          const unrealizedPl = (markPrice - avgOpen) * qty * multiplier * (isShort ? -1 : 1);
          return {
            asset_id: p.symbol || p["instrument-type"],
            symbol: p.symbol || "",
            qty: String(isShort ? -qty : qty),
            side: isShort ? "short" : "long",
            market_value: String(markPrice * qty * multiplier),
            cost_basis: String(avgOpen * qty * multiplier),
            unrealized_pl: String(unrealizedPl),
            unrealized_plpc: avgOpen > 0 ? String(((markPrice - avgOpen) / avgOpen * 100 * (isShort ? -1 : 1)).toFixed(2)) : "0",
            current_price: String(markPrice),
            avg_entry_price: String(avgOpen),
          };
        });
        return res.json({ positions });
      }

      const baseUrl = getAlpacaBaseUrl(conn.isPaper === 1);
      const posRes = await fetch(`${baseUrl}/v2/positions`, {
        headers: {
          "APCA-API-KEY-ID": conn.apiKey,
          "APCA-API-SECRET-KEY": conn.apiSecret,
        },
      });
      if (!posRes.ok) {
        return res.status(posRes.status).json({ error: "Failed to fetch positions" });
      }
      const positions = await posRes.json();
      res.json({ positions });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/brokerage/orders/:connectionId/:orderId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const conn = await storage.getBrokerageConnection(req.params.connectionId, userId);
      if (!conn) return res.status(404).json({ error: "Connection not found" });

      if (conn.broker === "tastytrade") {
        const baseUrl = getTastytradeBaseUrl(conn.isPaper === 1);
        const { sessionToken, accounts } = await getTastytradeSession(baseUrl, conn.apiKey, conn.apiSecret);
        const accountNumber = accounts[0]?.account?.["account-number"] || accounts[0]?.["account-number"];
        if (!accountNumber) return res.status(400).json({ error: "No account found" });

        const cancelRes = await fetch(`${baseUrl}/accounts/${accountNumber}/orders/${req.params.orderId}`, {
          method: "DELETE",
          headers: tastytradeHeaders(sessionToken),
        });
        if (cancelRes.status === 204 || cancelRes.ok) {
          return res.json({ success: true });
        }
        const result = await cancelRes.json();
        return res.status(cancelRes.status).json({ error: result.error?.message || "Failed to cancel order" });
      }

      const baseUrl = getAlpacaBaseUrl(conn.isPaper === 1);
      const cancelRes = await fetch(`${baseUrl}/v2/orders/${req.params.orderId}`, {
        method: "DELETE",
        headers: {
          "APCA-API-KEY-ID": conn.apiKey,
          "APCA-API-SECRET-KEY": conn.apiSecret,
        },
      });
      if (cancelRes.status === 204) {
        return res.json({ success: true });
      }
      const result = await cancelRes.json();
      if (!cancelRes.ok) {
        return res.status(cancelRes.status).json({ error: result.message || "Failed to cancel order" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  app.post('/api/account/delete-request', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const user = await storage.getUser(userId);
      if (!user || !user.email) {
        return res.status(400).json({ error: "No email associated with your account" });
      }

      if (!resend) {
        return res.status(500).json({ error: "Email service not configured" });
      }

      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await storage.createDeletionToken({
        userId,
        token,
        expiresAt,
      });

      const baseUrl = process.env.REPLIT_DOMAINS
        ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
        : process.env.RENDER_EXTERNAL_URL || `https://${req.get('host')}`;

      const confirmUrl = `${baseUrl}/account/confirm-delete?token=${token}`;

      await resend.emails.send({
        from: "OptionBuild <onboarding@resend.dev>",
        to: user.email,
        subject: "Confirm Account Deletion - OptionBuild",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #dc2626; font-size: 24px; margin-bottom: 16px;">Account Deletion Request</h1>
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              We received a request to permanently delete your OptionBuild account. This action cannot be undone.
            </p>
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              <strong>The following data will be permanently deleted:</strong>
            </p>
            <ul style="color: #374151; font-size: 14px; line-height: 1.8;">
              <li>Your user account and profile</li>
              <li>All saved trading strategies</li>
              <li>Brokerage connections and API keys</li>
              <li>Backtest history and results</li>
              <li>Blog posts (if admin)</li>
            </ul>
            <div style="margin: 32px 0;">
              <a href="${confirmUrl}" style="background-color: #dc2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Confirm Account Deletion
              </a>
            </div>
            <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
              This link will expire in <strong>24 hours</strong>. If you did not request this, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
            <p style="color: #9ca3af; font-size: 12px;">
              &copy; ${new Date().getFullYear()} OptionBuild. All rights reserved.
            </p>
          </div>
        `,
      });

      res.json({ success: true, message: "Confirmation email sent" });
    } catch (error: any) {
      console.error("Delete request error:", error);
      res.status(500).json({ error: "Failed to send confirmation email" });
    }
  });

  app.get('/api/account/confirm-delete', async (req, res) => {
    try {
      const { token } = req.query;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Missing or invalid token" });
      }

      const deletionToken = await storage.getDeletionToken(token);
      if (!deletionToken) {
        return res.status(404).json({ error: "Invalid or expired deletion link" });
      }

      if (new Date() > deletionToken.expiresAt) {
        await storage.deleteDeletionToken(token);
        return res.status(410).json({ error: "This deletion link has expired. Please request a new one." });
      }

      await storage.deleteUser(deletionToken.userId);
      await storage.deleteDeletionToken(token);

      res.json({ success: true, message: "Your account has been permanently deleted" });
    } catch (error: any) {
      console.error("Confirm delete error:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
