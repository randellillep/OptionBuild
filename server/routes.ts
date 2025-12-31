import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import type { MarketOptionQuote, MarketOptionChainSummary, OptionType, BacktestRequest } from "@shared/schema";
import { setupGoogleAuth, isAuthenticated } from "./googleAuth";
import { runBacktest } from "./backtesting";

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

// Shared helper to fetch option snapshots from Alpaca
// Returns snapshots object and list of available expirations
async function fetchAlpacaSnapshots(symbol: string) {
  if (!ALPACA_API_KEY || !ALPACA_API_SECRET) {
    throw new Error("Alpaca API credentials not configured");
  }
  
  const url = `${ALPACA_BASE_URL}/options/snapshots/${symbol.toUpperCase()}?feed=indicative`;
  
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
  const snapshots = data.snapshots || {};
  
  // Parse option symbols to extract unique expiration dates
  const expirationSet = new Set<string>();
  const parseOptionSymbol = (optionSymbol: string) => {
    const match = optionSymbol.match(/^([A-Z]+)(\d{6})([CP])(\d{8})$/);
    if (!match) return null;
    
    const [, , dateStr] = match;
    const year = 2000 + parseInt(dateStr.substring(0, 2));
    const month = parseInt(dateStr.substring(2, 4));
    const day = parseInt(dateStr.substring(4, 6));
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };
  
  for (const optionSymbol of Object.keys(snapshots)) {
    const isoDate = parseOptionSymbol(optionSymbol);
    if (isoDate) {
      expirationSet.add(isoDate);
    }
  }
  
  const availableExpirations = Array.from(expirationSet).sort();
  
  return {
    snapshots,
    availableExpirations,
    count: Object.keys(snapshots).length,
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

  // Company profile and fundamentals endpoint
  app.get("/api/stock/fundamentals/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      
      if (!FINNHUB_API_KEY) {
        return res.status(500).json({ error: "API key not configured" });
      }

      // Fetch company profile and basic financials in parallel
      const [profileRes, metricsRes] = await Promise.all([
        fetch(`${FINNHUB_BASE_URL}/stock/profile2?symbol=${symbol.toUpperCase()}&token=${FINNHUB_API_KEY}`),
        fetch(`${FINNHUB_BASE_URL}/stock/metric?symbol=${symbol.toUpperCase()}&metric=all&token=${FINNHUB_API_KEY}`)
      ]);

      if (!profileRes.ok || !metricsRes.ok) {
        throw new Error("Failed to fetch company data from Finnhub");
      }

      const [profile, metrics] = await Promise.all([
        profileRes.json(),
        metricsRes.json()
      ]);

      // Extract relevant financial metrics
      const metric = metrics.metric || {};
      
      res.json({
        symbol: symbol.toUpperCase(),
        name: profile.name || symbol.toUpperCase(),
        logo: profile.logo,
        exchange: profile.exchange,
        industry: profile.finnhubIndustry,
        marketCap: profile.marketCapitalization ? profile.marketCapitalization * 1000000 : null, // Finnhub returns in millions
        currency: profile.currency,
        country: profile.country,
        weburl: profile.weburl,
        ipo: profile.ipo,
        shareOutstanding: profile.shareOutstanding,
        // Key financial metrics
        peRatio: metric['peNormalizedAnnual'] || metric['peBasicExclExtraTTM'] || null,
        eps: metric['epsNormalizedAnnual'] || metric['epsBasicExclExtraItemsTTM'] || null,
        epsGrowth: metric['epsGrowthTTMYoy'] || null,
        revenueGrowth: metric['revenueGrowthTTMYoy'] || null,
        profitMargin: metric['netProfitMarginTTM'] || null,
        roe: metric['roeTTM'] || null,
        roa: metric['roaTTM'] || null,
        debtToEquity: metric['totalDebt/totalEquityQuarterly'] || null,
        currentRatio: metric['currentRatioQuarterly'] || null,
        quickRatio: metric['quickRatioQuarterly'] || null,
        dividendYield: metric['dividendYieldIndicatedAnnual'] || null,
        beta: metric['beta'] || null,
        high52Week: metric['52WeekHigh'] || null,
        low52Week: metric['52WeekLow'] || null,
        priceToBook: metric['pbQuarterly'] || null,
        priceToSales: metric['psTTM'] || null,
        updated: Date.now(),
      });
    } catch (error) {
      console.error("Error fetching company fundamentals:", error);
      res.status(500).json({ error: "Failed to fetch company fundamentals" });
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

      // Use shared helper to fetch snapshots
      const { snapshots, availableExpirations, count } = await fetchAlpacaSnapshots(symbol);
      
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
        
        // Log MSFT 480 Call specifically for debugging
        if (optionSymbol.includes('MSFT') && parsed.strike === 480 && parsed.side === 'call') {
          console.log(`[PRICE-DEBUG-MSFT480C] Symbol: ${optionSymbol}`);
          console.log(`[PRICE-DEBUG-MSFT480C] Raw quote object:`, JSON.stringify(quote, null, 2));
          console.log(`[PRICE-DEBUG-MSFT480C] Extracted: bid=${bid}, ask=${ask}, mid=${mid}`);
        }
        
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
        
        // Fetch underlying stock price from Finnhub
        let underlyingPrice = 0;
        try {
          const stockResponse = await fetch(
            `${FINNHUB_BASE_URL}/quote?symbol=${symbol.toUpperCase()}&token=${FINNHUB_API_KEY}`
          );
          if (stockResponse.ok) {
            const stockData = await stockResponse.json();
            underlyingPrice = stockData.c || 0;
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
      
      // Calculate strike range and extrapolate if limited by API
      const strikes = quotes.map(q => q.strike).sort((a, b) => a - b);
      let minStrike = strikes.length > 0 ? Math.min(...strikes) : 0;
      let maxStrike = strikes.length > 0 ? Math.max(...strikes) : 0;
      
      // If we got exactly 100 or 200 snapshots (API limit), extrapolate beyond the range
      // This ensures users can see strikes beyond what Alpaca's free tier provides
      if (quotes.length >= 100 && strikes.length > 10) {
        // Detect strike interval from existing data
        const intervals = new Set<number>();
        for (let i = 1; i < Math.min(strikes.length, 20); i++) {
          intervals.add(Number((strikes[i] - strikes[i-1]).toFixed(2)));
        }
        const commonInterval = Array.from(intervals).sort((a, b) => a - b)[0] || 2.5;
        
        // Extrapolate ~50% more strikes above and below
        const extrapolateCount = Math.floor(strikes.length * 0.5);
        minStrike = Math.max(5, minStrike - (extrapolateCount * commonInterval));
        maxStrike = maxStrike + (extrapolateCount * commonInterval);
        
        console.log(`[Options Chain] Extrapolated strike range: $${minStrike.toFixed(2)} - $${maxStrike.toFixed(2)} (interval: $${commonInterval}, added ${extrapolateCount} strikes each side)`);
      } else {
        console.log(`[Options Chain] Using strike range from ${quotes.length} quotes: $${minStrike} - $${maxStrike}`);
      }

      const summary: MarketOptionChainSummary = {
        symbol: symbol.toUpperCase(),
        expirations: availableExpirations, // Use expirations from Alpaca snapshots
        minStrike,
        maxStrike,
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
      
      if (start >= end) {
        return res.status(400).json({ error: "Start date must be before end date" });
      }
      
      if (end > now) {
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

  const httpServer = createServer(app);

  return httpServer;
}
