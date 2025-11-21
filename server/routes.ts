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

  // Options expirations endpoint - generates standard monthly/weekly expirations
  app.get("/api/options/expirations/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      
      // Generate comprehensive expiration dates (weekly + monthly for next 2 years)
      const now = new Date();
      const expirations: string[] = [];
      
      // Add weekly expirations for next 52 weeks (1 year of Fridays)
      for (let i = 0; i < 52; i++) {
        const date = new Date(now);
        // Find next Friday
        const daysUntilFriday = (5 - date.getDay() + 7) % 7 || 7;
        date.setDate(date.getDate() + daysUntilFriday + (i * 7));
        expirations.push(date.toISOString().split('T')[0]);
      }
      
      // Add monthly expirations for next 24 months (3rd Friday of each month for 2 years)
      for (let i = 0; i < 24; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
        // Find 3rd Friday of the month
        const firstDay = date.getDay();
        const thirdFriday = 1 + (5 - firstDay + 7) % 7 + 14;
        date.setDate(thirdFriday);
        const expDate = date.toISOString().split('T')[0];
        if (!expirations.includes(expDate)) {
          expirations.push(expDate);
        }
      }
      
      // Add quarterly expirations (3rd Friday of Mar, Jun, Sep, Dec) for next 3 years
      const quarterlyMonths = [2, 5, 8, 11]; // March, June, September, December (0-indexed)
      for (let year = 0; year < 3; year++) {
        for (const month of quarterlyMonths) {
          const date = new Date(now.getFullYear() + year, month, 1);
          const firstDay = date.getDay();
          const thirdFriday = 1 + (5 - firstDay + 7) % 7 + 14;
          date.setDate(thirdFriday);
          const expDate = date.toISOString().split('T')[0];
          if (!expirations.includes(expDate)) {
            expirations.push(expDate);
          }
        }
      }
      
      // Sort and deduplicate
      const uniqueExpirations = Array.from(new Set(expirations)).sort();

      res.json({
        symbol: symbol.toUpperCase(),
        expirations: uniqueExpirations,
        updated: Date.now(),
      });
    } catch (error) {
      console.error("Error generating options expirations:", error);
      res.status(500).json({ error: "Failed to generate options expirations" });
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

      // Fetch pricing/greeks data using snapshots endpoint
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
      const allExpirations = new Set<string>();
      
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
        
        // Track all expirations found
        allExpirations.add(parsed.isoDate);

        // Apply filters
        if (side && parsed.side !== side) continue;
        if (strike && Math.abs(parsed.strike - strike) > 0.01) continue;
        // Don't filter by expiration - return all available options and let frontend handle it
        // The frontend may request a specific date but Alpaca only has limited expirations
        // if (expiration && parsed.isoDate !== expiration) continue;

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
        
        // Estimate IV if not provided by Alpaca (their free tier doesn't include IV)
        // Use a rough approximation: IV ≈ (option price / √(days to expiration / 365)) * constant
        // This is a very rough estimate but better than 0
        let estimatedIV = snapshot.impliedVolatility || 0;
        if (!estimatedIV && mid > 0) {
          // Rough formula: annualized option price volatility
          // For ATM options, extrinsic value ≈ underlying * IV * √(T)
          // So IV ≈ extrinsic / (underlying * √T)
          // We'll use a simplified version: IV ≈ premium% * √(365/dte) * 2
          // Use minimum 1 day to avoid division by zero for same-day expirations
          const effectiveDTE = Math.max(1, dte);
          const timeToExpiration = effectiveDTE / 365;
          const sqrtTime = Math.sqrt(timeToExpiration);
          // Assume underlying is around $600 for SPY (we could fetch this but want to keep it fast)
          const estimatedUnderlying = parsed.strike; // Use strike as proxy for underlying
          const premiumPercent = mid / estimatedUnderlying;
          estimatedIV = Math.min(2.0, Math.max(0.05, premiumPercent / sqrtTime * 1.5)); // Clamp between 5% and 200%
          
          // Log first few estimations
          if (quotes.length < 3) {
            console.log(`[IV-EST] Strike ${parsed.strike} ${parsed.side}: mid=$${mid.toFixed(2)}, dte=${dte}, estimatedIV=${(estimatedIV * 100).toFixed(1)}%`);
          }
        }
        
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
          iv: estimatedIV,
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
      
      const expirations = Array.from(new Set(quotes.map(q => new Date(q.expiration * 1000).toISOString().split('T')[0])));
      console.log(`[Options Chain] After filtering: ${quotes.length} quotes, expirations in filtered results:`, expirations.slice(0, 5));
      if (expiration && quotes.length === 0) {
        console.log(`[Options Chain] WARNING: Requested expiration ${expiration} not found.`);
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
