import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import type { MarketOptionQuote, MarketOptionChainSummary, OptionType, BacktestRequest, BacktestConfigData } from "@shared/schema";
import { setupGoogleAuth, isAuthenticated } from "./googleAuth";
import { runBacktest, runTastyworksBacktest } from "./backtesting";
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
  
  do {
    // Build URL with optional expiration filter and pagination
    let url = `${ALPACA_BASE_URL}/options/snapshots/${symbol.toUpperCase()}?feed=indicative&limit=100`;
    if (options?.expiration) {
      url += `&expiration_date=${options.expiration}`;
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
  // Setup Google OAuth authentication
  await setupGoogleAuth(app);

  // Auth routes - get current user
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      // With Google OAuth, user object is directly available from passport
      const user = req.user;
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Saved trades routes - user-specific trade storage
  app.get('/api/trades', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
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
      const userId = req.user?.id;
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

  app.delete('/api/trades/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
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
  app.get("/api/stock/quote/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      
      if (!ALPACA_API_KEY || !ALPACA_API_SECRET) {
        return res.status(500).json({ error: "Alpaca API keys not configured" });
      }

      // Fetch latest trade and previous day bar for change calculation
      // Use snapshot endpoint to get current price AND previous day's close
      const snapshotRes = await fetch(`https://data.alpaca.markets/v2/stocks/${symbol.toUpperCase()}/snapshot?feed=iex`, {
        headers: {
          'APCA-API-KEY-ID': ALPACA_API_KEY,
          'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
        },
      });

      if (!snapshotRes.ok) {
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
        symbol: symbol.toUpperCase(),
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

  // Stock symbol search endpoint (using local list - Alpaca doesn't have search API)
  const POPULAR_STOCKS = [
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'MSFT', name: 'Microsoft Corporation' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.' },
    { symbol: 'META', name: 'Meta Platforms Inc.' },
    { symbol: 'TSLA', name: 'Tesla Inc.' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation' },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
    { symbol: 'V', name: 'Visa Inc.' },
    { symbol: 'JNJ', name: 'Johnson & Johnson' },
    { symbol: 'WMT', name: 'Walmart Inc.' },
    { symbol: 'PG', name: 'Procter & Gamble Co.' },
    { symbol: 'MA', name: 'Mastercard Inc.' },
    { symbol: 'UNH', name: 'UnitedHealth Group Inc.' },
    { symbol: 'HD', name: 'Home Depot Inc.' },
    { symbol: 'DIS', name: 'Walt Disney Co.' },
    { symbol: 'BAC', name: 'Bank of America Corp.' },
    { symbol: 'XOM', name: 'Exxon Mobil Corporation' },
    { symbol: 'PFE', name: 'Pfizer Inc.' },
    { symbol: 'KO', name: 'Coca-Cola Co.' },
    { symbol: 'NFLX', name: 'Netflix Inc.' },
    { symbol: 'AMD', name: 'Advanced Micro Devices Inc.' },
    { symbol: 'INTC', name: 'Intel Corporation' },
    { symbol: 'CRM', name: 'Salesforce Inc.' },
    { symbol: 'CSCO', name: 'Cisco Systems Inc.' },
    { symbol: 'ORCL', name: 'Oracle Corporation' },
    { symbol: 'IBM', name: 'International Business Machines' },
    { symbol: 'GS', name: 'Goldman Sachs Group Inc.' },
    { symbol: 'CVX', name: 'Chevron Corporation' },
    { symbol: 'MRK', name: 'Merck & Co. Inc.' },
    { symbol: 'ABBV', name: 'AbbVie Inc.' },
    { symbol: 'LLY', name: 'Eli Lilly and Company' },
    { symbol: 'COST', name: 'Costco Wholesale Corporation' },
    { symbol: 'AVGO', name: 'Broadcom Inc.' },
    { symbol: 'PEP', name: 'PepsiCo Inc.' },
    { symbol: 'TMO', name: 'Thermo Fisher Scientific' },
    { symbol: 'MCD', name: 'McDonald\'s Corporation' },
    { symbol: 'ADBE', name: 'Adobe Inc.' },
    { symbol: 'NKE', name: 'Nike Inc.' },
    { symbol: 'T', name: 'AT&T Inc.' },
    { symbol: 'VZ', name: 'Verizon Communications' },
    { symbol: 'CMCSA', name: 'Comcast Corporation' },
    { symbol: 'ABT', name: 'Abbott Laboratories' },
    { symbol: 'DHR', name: 'Danaher Corporation' },
    { symbol: 'TXN', name: 'Texas Instruments Inc.' },
    { symbol: 'QCOM', name: 'Qualcomm Inc.' },
    { symbol: 'NEE', name: 'NextEra Energy Inc.' },
    { symbol: 'PM', name: 'Philip Morris International' },
    { symbol: 'RTX', name: 'Raytheon Technologies' },
    { symbol: 'UNP', name: 'Union Pacific Corporation' },
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
    { symbol: 'IWM', name: 'iShares Russell 2000 ETF' },
    { symbol: 'GLD', name: 'SPDR Gold Trust' },
    { symbol: 'SLV', name: 'iShares Silver Trust' },
  ];

  app.get("/api/stock/search", async (req, res) => {
    try {
      const { q } = req.query;
      
      if (!q || typeof q !== "string") {
        return res.status(400).json({ error: "Query parameter required" });
      }

      const query = q.toUpperCase();
      
      // Search in our local list of popular stocks
      const results = POPULAR_STOCKS
        .filter(stock => 
          stock.symbol.includes(query) || 
          stock.name.toUpperCase().includes(query)
        )
        .slice(0, 10)
        .map(stock => ({
          symbol: stock.symbol,
          name: stock.name,
          displaySymbol: stock.symbol,
        }));

      // If no matches found but query looks like a valid symbol, add it as a custom entry
      if (results.length === 0 && /^[A-Z]{1,5}$/.test(query)) {
        results.push({
          symbol: query,
          name: `${query} (Custom Symbol)`,
          displaySymbol: query,
        });
      }

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
      
      // Use shared helper to fetch snapshots and extract expirations
      const { availableExpirations, count } = await fetchAlpacaSnapshots(symbol);
      
      if (availableExpirations.length === 0) {
        return res.status(404).json({ 
          error: `No options found for ${symbol.toUpperCase()}`,
          expirations: []
        });
      }

      res.json({
        symbol: symbol.toUpperCase(),
        expirations: availableExpirations,
        count,
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
        // Validate cached data - check if requested expiration is still available
        if (expiration && cachedData.availableExpirations && !cachedData.availableExpirations.includes(expiration)) {
          // Expiration no longer available - return 404 even from cache
          return res.status(404).json({
            error: `Expiration date ${expiration} not available`,
            message: `The requested expiration date (${expiration}) is not available from Alpaca. This may be due to API snapshot limits.`,
            availableExpirations: cachedData.availableExpirations.slice(0, 10),
            symbol: symbol.toUpperCase(),
          });
        }
        return res.json(cachedData);
      }

      // Use shared helper to fetch snapshots with pagination
      // Pass expiration to filter on server-side for better efficiency
      const { snapshots, availableExpirations, count } = await fetchAlpacaSnapshots(symbol, 
        expiration ? { expiration } : undefined
      );
      
      console.log(`[Options Chain] Fetched ${count} snapshots for ${symbol.toUpperCase()}`);
      console.log(`[Options Chain] Available expirations:`, availableExpirations.slice(0, 5));
      
      // Check if requested expiration exists in Alpaca data
      if (expiration && !availableExpirations.includes(expiration)) {
        console.log(`[Options Chain] ⚠️  WARNING: Requested expiration ${expiration} not found in Alpaca data`);
        console.log(`[Options Chain] ⚠️  Available expirations:`, availableExpirations);
        console.log(`[Options Chain] ⚠️  This may be due to Alpaca API limits (max ~100 snapshots)`);
        
        // Return 404 with actionable message for the frontend
        return res.status(404).json({
          error: `Expiration date ${expiration} not available`,
          message: `The requested expiration date (${expiration}) is not available from Alpaca. This may be due to API snapshot limits.`,
          availableExpirations: availableExpirations.slice(0, 10), // Show first 10 available dates
          symbol: symbol.toUpperCase(),
        });
      }
      
      // Log sample option symbols to debug PUT availability
      const sampleSymbols = Object.keys(snapshots).slice(0, 10);
      console.log(`[Options Chain] Sample option symbols:`, sampleSymbols);
      const callCount = sampleSymbols.filter(s => s.includes('C')).length;
      const putCount = sampleSymbols.filter(s => s.includes('P')).length;
      console.log(`[Options Chain] Sample breakdown: ${callCount} calls, ${putCount} puts in first 10 symbols`);
      
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
        // Filter by expiration to ensure we only return options for the requested date
        if (expiration && parsed.isoDate !== expiration) continue;

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
        expirations: availableExpirations, // Use expirations from Alpaca snapshots
        minStrike,
        maxStrike,
        strikes: uniqueStrikes,  // Pass actual available strikes
        quotes,
        cachedAt: Date.now(),
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

  const httpServer = createServer(app);

  return httpServer;
}
