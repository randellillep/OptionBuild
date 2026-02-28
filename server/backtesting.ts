import { storage } from "./storage";
import type {
  BacktestConfigData,
  BacktestTradeData,
  BacktestDailyLog,
  BacktestSummaryMetrics,
  BacktestDetailMetrics,
  BacktestLegConfig,
  TradeCloseReason,
  OptionLeg,
  BacktestRequest,
  BacktestResult,
  BacktestDataPoint,
  BacktestMetrics,
} from "@shared/schema";

const ALPACA_API_KEY = process.env.ALPACA_API_KEY;
const ALPACA_API_SECRET = process.env.ALPACA_API_SECRET;
const RISK_FREE_RATE = 0.05;
const DEFAULT_FEE_PER_CONTRACT = 0;

function cumulativeNormalDistribution(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

function blackScholesCall(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0) return Math.max(S - K, 0);
  if (S <= 0 || K <= 0 || sigma <= 0) return Math.max(S - K, 0);
  
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  return S * cumulativeNormalDistribution(d1) - K * Math.exp(-r * T) * cumulativeNormalDistribution(d2);
}

function blackScholesPut(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0) return Math.max(K - S, 0);
  if (S <= 0 || K <= 0 || sigma <= 0) return Math.max(K - S, 0);
  
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  return K * Math.exp(-r * T) * cumulativeNormalDistribution(-d2) - S * cumulativeNormalDistribution(-d1);
}

function calculateOptionPrice(
  type: "call" | "put",
  underlyingPrice: number,
  strike: number,
  daysToExpiration: number,
  volatility: number = 0.3
): number {
  const T = daysToExpiration / 365;
  if (type === "call") {
    return blackScholesCall(underlyingPrice, strike, T, RISK_FREE_RATE, volatility);
  } else {
    return blackScholesPut(underlyingPrice, strike, T, RISK_FREE_RATE, volatility);
  }
}

function calculateDelta(
  type: "call" | "put",
  underlyingPrice: number,
  strike: number,
  daysToExpiration: number,
  volatility: number = 0.3
): number {
  const T = daysToExpiration / 365;
  if (T <= 0 || underlyingPrice <= 0 || strike <= 0 || volatility <= 0) {
    return type === "call" ? (underlyingPrice > strike ? 1 : 0) : (underlyingPrice < strike ? -1 : 0);
  }
  
  const d1 = (Math.log(underlyingPrice / strike) + (RISK_FREE_RATE + volatility * volatility / 2) * T) / (volatility * Math.sqrt(T));
  
  if (type === "call") {
    return cumulativeNormalDistribution(d1);
  } else {
    return cumulativeNormalDistribution(d1) - 1;
  }
}

function findStrikeByDelta(
  underlyingPrice: number,
  targetDelta: number,
  type: "call" | "put",
  daysToExpiration: number,
  volatility: number = 0.3
): number {
  // Normalize delta: accept both fractional (0.30) and whole-number (30) inputs
  // If > 1, assume it's a percentage (30 means 0.30)
  // If <= 1, assume it's already fractional
  const targetDeltaAbs = Math.abs(targetDelta) > 1 
    ? Math.abs(targetDelta) / 100 
    : Math.abs(targetDelta);
  
  let low = underlyingPrice * 0.5;
  let high = underlyingPrice * 1.5;
  
  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    const delta = Math.abs(calculateDelta(type, underlyingPrice, mid, daysToExpiration, volatility));
    
    if (Math.abs(delta - targetDeltaAbs) < 0.001) {
      const increment = getStrikeIncrement(underlyingPrice);
      return snapToStrikeIncrement(mid, increment, type);
    }
    
    if (type === "call") {
      if (delta > targetDeltaAbs) high = mid;
      else low = mid;
    } else {
      if (delta > targetDeltaAbs) low = mid;
      else high = mid;
    }
  }
  
  const rawStrike = (low + high) / 2;
  const increment = getStrikeIncrement(underlyingPrice);
  return snapToStrikeIncrement(rawStrike, increment, type);
}

function getStrikeIncrement(underlyingPrice: number): number {
  if (underlyingPrice < 25) return 0.5;
  if (underlyingPrice < 50) return 1;
  if (underlyingPrice < 200) return 2.5;
  return 5;
}

function snapToStrikeIncrement(rawStrike: number, increment: number, type: "call" | "put"): number {
  return Math.round(rawStrike / increment) * increment;
}

function findStrikeByPercentOTM(
  underlyingPrice: number,
  percentOTM: number,
  type: "call" | "put"
): number {
  const offset = underlyingPrice * (percentOTM / 100);
  let rawStrike = type === "call" 
    ? underlyingPrice + offset 
    : underlyingPrice - offset;
  const increment = getStrikeIncrement(underlyingPrice);
  return snapToStrikeIncrement(rawStrike, increment, type);
}

function findStrikeByPriceOffset(
  underlyingPrice: number,
  priceOffset: number,
  type: "call" | "put"
): number {
  let rawStrike = type === "call"
    ? underlyingPrice + priceOffset
    : underlyingPrice - priceOffset;
  const increment = getStrikeIncrement(underlyingPrice);
  return snapToStrikeIncrement(rawStrike, increment, type);
}

interface HistoricalBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

async function fetchHistoricalPrices(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<HistoricalBar[]> {
  const cachedPrices = await storage.getHistoricalPrices(symbol, startDate, endDate);
  
  const cachedMap = new Map(cachedPrices.map(p => [p.date, p]));
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const missingDates: string[] = [];
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    
    const dateStr = d.toISOString().split('T')[0];
    if (!cachedMap.has(dateStr)) {
      missingDates.push(dateStr);
    }
  }
  
  console.log(`[BACKTEST] Cache check for ${symbol}: ${cachedPrices.length} cached, ${missingDates.length} missing dates`);
  
  if (missingDates.length > 0 && (!ALPACA_API_KEY || !ALPACA_API_SECRET)) {
    console.log(`[BACKTEST] WARNING: Alpaca API keys not configured, cannot fetch missing historical data`);
  }
  
  if (missingDates.length > 0 && ALPACA_API_KEY && ALPACA_API_SECRET) {
    try {
      const alpacaUrl = `https://data.alpaca.markets/v2/stocks/${symbol.toUpperCase()}/bars?timeframe=1Day&start=${startDate}&end=${endDate}&limit=10000&adjustment=split&feed=iex`;
      
      console.log(`[BACKTEST] Fetching historical prices for ${symbol} from ${startDate} to ${endDate}`);
      
      const response = await fetch(alpacaUrl, {
        headers: {
          'APCA-API-KEY-ID': ALPACA_API_KEY,
          'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[BACKTEST] Alpaca API error: ${response.status}`, errorText);
        throw new Error(`Alpaca API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      console.log(`[BACKTEST] Alpaca response: ${data.bars?.length || 0} bars received`);
      
      if (data.bars && data.bars.length > 0) {
        const newPrices: { symbol: string; date: string; open: number; high: number; low: number; close: number; volume?: number }[] = [];
        
        for (const bar of data.bars) {
          const date = bar.t.split('T')[0];
          newPrices.push({
            symbol: symbol.toUpperCase(),
            date,
            open: bar.o,
            high: bar.h,
            low: bar.l,
            close: bar.c,
            volume: bar.v,
          });
        }
        
        console.log(`[BACKTEST] Saving ${newPrices.length} price bars for ${symbol}`);
        await storage.saveHistoricalPrices(newPrices);
        
        for (const p of newPrices) {
          cachedMap.set(p.date, {
            id: '',
            symbol: p.symbol,
            date: p.date,
            open: p.open,
            high: p.high,
            low: p.low,
            close: p.close,
            volume: p.volume ?? null,
            cachedAt: new Date(),
          });
        }
      } else {
        console.log(`[BACKTEST] Alpaca returned no bars for ${symbol}`);
      }
    } catch (error) {
      console.error('[BACKTEST] Error fetching historical prices from Alpaca:', error);
    }
  }
  
  const result: HistoricalBar[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    
    const dateStr = d.toISOString().split('T')[0];
    const cached = cachedMap.get(dateStr);
    if (cached) {
      result.push({
        date: cached.date,
        open: cached.open,
        high: cached.high,
        low: cached.low,
        close: cached.close,
        volume: cached.volume ?? 0,
      });
    }
  }
  
  console.log(`[BACKTEST] Final result for ${symbol}: ${result.length} price bars`);
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

function estimateVolatility(priceHistory: HistoricalBar[], lookback: number = 30): number {
  if (priceHistory.length < 2) return 0.3;
  
  const returns: number[] = [];
  const historySlice = priceHistory.slice(-Math.min(lookback + 1, priceHistory.length));
  
  for (let i = 1; i < historySlice.length; i++) {
    const ret = Math.log(historySlice[i].close / historySlice[i - 1].close);
    returns.push(ret);
  }
  
  if (returns.length < 2) return 0.3;
  
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  const dailyVol = Math.sqrt(variance);
  
  const annualizedVol = dailyVol * Math.sqrt(252);
  
  // Apply Volatility Risk Premium (VRP): implied volatility is typically 15-20%
  // higher than realized/historical volatility. This better approximates actual 
  // market option prices which embed this premium.
  // tastytrade mid prices reflect IV, so we need to approximate that.
  const vrpMultiplier = 1.15;
  const impliedVolApprox = annualizedVol * vrpMultiplier;
  
  return Math.max(0.1, Math.min(1.5, impliedVolApprox));
}

function calculateBuyingPower(
  legs: BacktestLegConfig[],
  strikes: number[],
  premiums: number[],
  underlyingPrice: number
): number {
  // tastytrade-style BPR (Buying Power Reduction) for naked options
  // Standard margin formula: max(Method A, Method B)
  // Method A: 20% of underlying - OTM amount + premium
  // Method B: 10% of strike price + premium
  // Minimum: $50 per contract (not modeled here as it's negligible)
  
  let totalBPR = 0;
  const widthRisk = calculateSpreadWidth(legs, strikes);
  
  if (widthRisk > 0) {
    // For spreads, BPR = spread width * 100 * quantity
    return widthRisk;
  }
  
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const premium = premiums[i] * leg.quantity * 100;
    
    if (leg.direction === "sell") {
      if (leg.optionType === "put") {
        const otmAmount = Math.max(0, underlyingPrice - strikes[i]) * leg.quantity * 100;
        const methodA = (underlyingPrice * 0.20 * leg.quantity * 100) - otmAmount + premium;
        const methodB = (strikes[i] * 0.10 * leg.quantity * 100) + premium;
        totalBPR += Math.max(methodA, methodB);
      } else {
        const otmAmount = Math.max(0, strikes[i] - underlyingPrice) * leg.quantity * 100;
        const methodA = (underlyingPrice * 0.20 * leg.quantity * 100) - otmAmount + premium;
        const methodB = (underlyingPrice * 0.10 * leg.quantity * 100) + premium;
        totalBPR += Math.max(methodA, methodB);
      }
    }
  }
  
  return totalBPR;
}

function calculateSpreadWidth(legs: BacktestLegConfig[], strikes: number[]): number {
  // Only treat as a spread if we have both buy and sell legs of the same type
  const legsWithStrikes = legs.map((l, i) => ({ ...l, strike: strikes[i] }));
  const puts = legsWithStrikes.filter(l => l.optionType === "put");
  const calls = legsWithStrikes.filter(l => l.optionType === "call");
  
  let width = 0;
  
  // Check for vertical put spreads (has both buy and sell puts)
  const putBuys = puts.filter(p => p.direction === "buy");
  const putSells = puts.filter(p => p.direction === "sell");
  if (putBuys.length > 0 && putSells.length > 0) {
    const putStrikes = puts.map(p => p.strike).sort((a, b) => a - b);
    const qty = Math.min(...puts.map(p => p.quantity));
    width = Math.max(width, (putStrikes[putStrikes.length - 1] - putStrikes[0]) * qty);
  }
  
  // Check for vertical call spreads (has both buy and sell calls)
  const callBuys = calls.filter(c => c.direction === "buy");
  const callSells = calls.filter(c => c.direction === "sell");
  if (callBuys.length > 0 && callSells.length > 0) {
    const callStrikes = calls.map(c => c.strike).sort((a, b) => a - b);
    const qty = Math.min(...calls.map(c => c.quantity));
    width = Math.max(width, (callStrikes[callStrikes.length - 1] - callStrikes[0]) * qty);
  }
  
  return width * 100;
}

interface ActiveTrade {
  tradeNumber: number;
  openedDate: string;
  expirationDate: string;
  legs: {
    leg: BacktestLegConfig;
    strike: number;
    entryPrice: number;
    dte: number;
  }[];
  premium: number;
  buyingPower: number;
  daysInTrade: number;
  underlyingPriceAtOpen: number;
}

const US_MARKET_HOLIDAYS: Set<string> = new Set([
  '2024-01-01', '2024-01-15', '2024-02-19', '2024-03-29', '2024-05-27',
  '2024-06-19', '2024-07-04', '2024-09-02', '2024-11-28', '2024-12-25',
  '2025-01-01', '2025-01-20', '2025-02-17', '2025-04-18', '2025-05-26',
  '2025-06-19', '2025-07-04', '2025-09-01', '2025-11-27', '2025-12-25',
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25',
  '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31',
  '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
]);

function isMarketHoliday(dateStr: string): boolean {
  return US_MARKET_HOLIDAYS.has(dateStr);
}

function adjustForHoliday(date: Date): Date {
  const dateStr = date.toISOString().split('T')[0];
  if (isMarketHoliday(dateStr)) {
    date.setDate(date.getDate() - 1);
    const dow = date.getDay();
    if (dow === 0) date.setDate(date.getDate() - 2);
    if (dow === 6) date.setDate(date.getDate() - 1);
  }
  return date;
}

function calculateExpirationDate(entryDate: string, dte: number): string {
  const target = new Date(entryDate);
  target.setDate(target.getDate() + dte);
  const targetTime = target.getTime();
  
  const dayOfWeek = target.getDay();
  
  const nextFri = new Date(target);
  const daysToNext = dayOfWeek === 5 ? 0 : (5 - dayOfWeek + 7) % 7;
  nextFri.setDate(nextFri.getDate() + daysToNext);
  
  const prevFri = new Date(target);
  const daysToPrev = dayOfWeek === 5 ? 0 : (dayOfWeek - 5 + 7) % 7;
  prevFri.setDate(prevFri.getDate() - daysToPrev);
  
  adjustForHoliday(nextFri);
  adjustForHoliday(prevFri);
  
  const distNext = Math.abs(nextFri.getTime() - targetTime);
  const distPrev = Math.abs(prevFri.getTime() - targetTime);
  
  const result = distNext <= distPrev ? nextFri : prevFri;
  return result.toISOString().split('T')[0];
}

function getDTE(currentDate: string, expirationDate: string): number {
  const current = new Date(currentDate);
  const expiration = new Date(expirationDate);
  const diffTime = expiration.getTime() - current.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function shouldEnterTrade(
  date: string,
  config: BacktestConfigData,
  activeTrades: ActiveTrade[]
): boolean {
  const { entryConditions } = config;
  
  if (entryConditions.maxActiveTrades !== undefined && 
      activeTrades.length >= entryConditions.maxActiveTrades) {
    return false;
  }
  
  const dayOfWeek = new Date(date).getDay();
  
  if (entryConditions.frequency === "specificDays") {
    if (!entryConditions.specificDays?.includes(dayOfWeek)) {
      return false;
    }
  }
  
  return true;
}

function shouldExitTrade(
  trade: ActiveTrade,
  currentDate: string,
  currentPrice: number,
  volatility: number,
  config: BacktestConfigData
): { shouldExit: boolean; reason: TradeCloseReason } {
  const { exitConditions } = config;
  
  const dte = getDTE(currentDate, trade.expirationDate);
  
  if (dte <= 0) {
    return { shouldExit: true, reason: "expired" };
  }
  
  if (exitConditions.exitAtDTE !== undefined && dte <= exitConditions.exitAtDTE) {
    return { shouldExit: true, reason: "exitDTE" };
  }
  
  if (exitConditions.exitAfterDays !== undefined && trade.daysInTrade >= exitConditions.exitAfterDays) {
    return { shouldExit: true, reason: "daysInTrade" };
  }
  
  let currentValue = 0;
  for (const legData of trade.legs) {
    const { leg, strike } = legData;
    const price = calculateOptionPrice(leg.optionType, currentPrice, strike, dte, volatility);
    
    if (leg.direction === "sell") {
      currentValue += price * leg.quantity * 100;
    } else {
      currentValue -= price * leg.quantity * 100;
    }
  }
  
  const pnl = trade.premium - currentValue;
  const premiumAbs = Math.abs(trade.premium);
  
  if (exitConditions.takeProfitPercent !== undefined && premiumAbs > 0) {
    const profitPercent = (pnl / premiumAbs) * 100;
    if (profitPercent >= exitConditions.takeProfitPercent) {
      return { shouldExit: true, reason: "takeProfit" };
    }
  }
  
  if (exitConditions.stopLossPercent !== undefined && premiumAbs > 0) {
    const lossPercent = (-pnl / premiumAbs) * 100;
    if (lossPercent >= exitConditions.stopLossPercent) {
      return { shouldExit: true, reason: "stopLoss" };
    }
  }
  
  return { shouldExit: false, reason: "expired" };
}

function closeTrade(
  trade: ActiveTrade,
  currentDate: string,
  currentPrice: number,
  volatility: number,
  reason: TradeCloseReason,
  feePerContract: number
): BacktestTradeData {
  const dte = Math.max(0, getDTE(currentDate, trade.expirationDate));
  
  let isExercised = false;
  const closedLegs = trade.legs.map(({ leg, strike, entryPrice, dte: originalDte }) => {
    let exitPrice: number;
    
    if (dte <= 0 || reason === "expired") {
      if (leg.optionType === "call") {
        exitPrice = Math.max(0, currentPrice - strike);
      } else {
        exitPrice = Math.max(0, strike - currentPrice);
      }
      if (exitPrice > 0) {
        isExercised = true;
      }
    } else {
      exitPrice = calculateOptionPrice(leg.optionType, currentPrice, strike, dte, volatility);
    }
    
    return {
      direction: leg.direction,
      optionType: leg.optionType,
      strike,
      quantity: leg.quantity,
      entryPrice,
      exitPrice,
      dte: originalDte,
    };
  });
  
  let exitValue = 0;
  let totalContracts = 0;
  
  for (const leg of closedLegs) {
    const legValue = leg.exitPrice * leg.quantity * 100;
    if (leg.direction === "sell") {
      exitValue += legValue;
    } else {
      exitValue -= legValue;
    }
    totalContracts += leg.quantity;
  }
  
  const fees = totalContracts * feePerContract * 2;
  const profitLoss = trade.premium - exitValue - fees;
  const roi = trade.buyingPower > 0 ? (profitLoss / trade.buyingPower) * 100 : 0;
  
  const finalReason = (reason === "expired" && isExercised) ? "exercised" as TradeCloseReason : reason;
  
  return {
    tradeNumber: trade.tradeNumber,
    openedDate: trade.openedDate,
    closedDate: currentDate,
    legs: closedLegs,
    premium: trade.premium,
    fees,
    buyingPower: trade.buyingPower,
    profitLoss,
    closeReason: finalReason,
    roi,
    daysInTrade: trade.daysInTrade,
    underlyingPriceAtOpen: trade.underlyingPriceAtOpen,
    underlyingPriceAtClose: currentPrice,
    expirationDate: trade.expirationDate,
  };
}

export async function runTastyworksBacktest(
  backtestId: string,
  config: BacktestConfigData
): Promise<void> {
  try {
    await storage.updateBacktestRun(backtestId, { status: "running", progress: 0 });
    
    const priceHistory = await fetchHistoricalPrices(config.symbol, config.startDate, config.endDate);
    
    if (priceHistory.length === 0) {
      await storage.updateBacktestRun(backtestId, {
        status: "error",
        errorMessage: `No historical price data found for ${config.symbol} between ${config.startDate} and ${config.endDate}`,
      });
      return;
    }
    
    await storage.updateBacktestRun(backtestId, { progress: 10 });
    
    const feePerContract = config.feePerContract ?? DEFAULT_FEE_PER_CONTRACT;
    const trades: BacktestTradeData[] = [];
    const dailyLogs: BacktestDailyLog[] = [];
    const pnlHistory: { date: string; cumulativePnL: number; underlyingPrice: number }[] = [];
    
    let activeTrades: ActiveTrade[] = [];
    let tradeNumber = 0;
    let cumulativePnL = 0;
    let peakValue = 0;
    let maxDrawdown = 0;
    let maxDrawdownDate = config.startDate;
    let totalCapitalUsed = 0;
    
    for (let i = 0; i < priceHistory.length; i++) {
      const bar = priceHistory[i];
      const currentPrice = bar.close;
      const currentDate = bar.date;
      
      const historicalSlice = priceHistory.slice(0, i + 1);
      const volatility = estimateVolatility(historicalSlice, 30);
      
      for (const trade of activeTrades) {
        trade.daysInTrade++;
      }
      
      const tradesToClose: { trade: ActiveTrade; reason: TradeCloseReason }[] = [];
      
      for (const trade of activeTrades) {
        const { shouldExit, reason } = shouldExitTrade(trade, currentDate, currentPrice, volatility, config);
        if (shouldExit) {
          tradesToClose.push({ trade, reason });
        }
      }
      
      for (const { trade, reason } of tradesToClose) {
        const closedTrade = closeTrade(trade, currentDate, currentPrice, volatility, reason, feePerContract);
        trades.push(closedTrade);
        cumulativePnL += closedTrade.profitLoss;
        activeTrades = activeTrades.filter(t => t.tradeNumber !== trade.tradeNumber);
      }
      
      if (shouldEnterTrade(currentDate, config, activeTrades)) {
        const strikes: number[] = [];
        const premiums: number[] = [];
        
        for (const leg of config.legs) {
          let strike: number;
          
          switch (leg.strikeSelection) {
            case "delta":
              strike = findStrikeByDelta(currentPrice, leg.strikeValue, leg.optionType, leg.dte, volatility);
              break;
            case "percentOTM":
              strike = findStrikeByPercentOTM(currentPrice, leg.strikeValue, leg.optionType);
              break;
            case "priceOffset":
              strike = findStrikeByPriceOffset(currentPrice, leg.strikeValue, leg.optionType);
              break;
            case "premium":
            default:
              strike = findStrikeByDelta(currentPrice, 30, leg.optionType, leg.dte, volatility);
              break;
          }
          
          strikes.push(strike);
          
          const premium = calculateOptionPrice(leg.optionType, currentPrice, strike, leg.dte, volatility);
          premiums.push(premium);
        }
        
        const expirationDate = calculateExpirationDate(currentDate, config.legs[0].dte);
        
        tradeNumber++;
        
        let netPremium = 0;
        for (let j = 0; j < config.legs.length; j++) {
          const leg = config.legs[j];
          const legPremium = premiums[j] * leg.quantity * 100;
          if (leg.direction === "sell") {
            netPremium += legPremium;
          } else {
            netPremium -= legPremium;
          }
        }
        
        const buyingPower = calculateBuyingPower(config.legs, strikes, premiums, currentPrice);
        
        const newTrade: ActiveTrade = {
          tradeNumber,
          openedDate: currentDate,
          expirationDate,
          legs: config.legs.map((leg, j) => ({
            leg,
            strike: strikes[j],
            entryPrice: premiums[j],
            dte: leg.dte,
          })),
          premium: netPremium,
          buyingPower,
          daysInTrade: 0,
          underlyingPriceAtOpen: currentPrice,
        };
        
        activeTrades.push(newTrade);
      }
      
      // Calculate open P/L for each active trade individually
      let openPnL = 0;
      let currentTotalBPR = 0;
      for (const trade of activeTrades) {
        const dte = getDTE(currentDate, trade.expirationDate);
        let currentValue = 0;
        for (const { leg, strike } of trade.legs) {
          const price = calculateOptionPrice(leg.optionType, currentPrice, strike, Math.max(0, dte), volatility);
          if (leg.direction === "sell") {
            currentValue += price * leg.quantity * 100;
          } else {
            currentValue -= price * leg.quantity * 100;
          }
        }
        openPnL += trade.premium - currentValue;
        currentTotalBPR += trade.buyingPower;
      }
      
      // Track max capital used as sum of all concurrent BPR (tastytrade "used capital")
      totalCapitalUsed = Math.max(totalCapitalUsed, currentTotalBPR);
      
      const totalPnL = cumulativePnL + openPnL;
      
      if (totalPnL > peakValue) {
        peakValue = totalPnL;
      }
      
      // tastytrade-style drawdown: dollar drawdown from peak, expressed as percentage of used capital
      const drawdownDollars = peakValue - totalPnL;
      const currentDrawdown = currentTotalBPR > 0 ? (drawdownDollars / currentTotalBPR) * 100 : 0;
      if (currentDrawdown > maxDrawdown) {
        maxDrawdown = currentDrawdown;
        maxDrawdownDate = currentDate;
      }
      
      const netLiquidity = (config.manualCapital ?? totalCapitalUsed) + totalPnL;
      const roi = totalCapitalUsed > 0 ? (totalPnL / totalCapitalUsed) * 100 : 0;
      
      dailyLogs.push({
        date: currentDate,
        underlyingPrice: currentPrice,
        totalProfitLoss: totalPnL,
        netLiquidity,
        drawdown: currentDrawdown,
        roi,
        activeTrades: activeTrades.length,
      });
      
      pnlHistory.push({ date: currentDate, cumulativePnL: totalPnL, underlyingPrice: currentPrice });
      
      const progress = 10 + Math.floor((i / priceHistory.length) * 80);
      if (i % 10 === 0) {
        await storage.updateBacktestRun(backtestId, { progress });
      }
    }
    
    for (const trade of activeTrades) {
      const lastBar = priceHistory[priceHistory.length - 1];
      const volatility = estimateVolatility(priceHistory, 30);
      const closedTrade = closeTrade(trade, lastBar.date, lastBar.close, volatility, "endOfBacktest", feePerContract);
      trades.push(closedTrade);
      cumulativePnL += closedTrade.profitLoss;
    }
    
    const summary = calculateSummaryMetrics(trades, dailyLogs, totalCapitalUsed, config);
    const details = calculateDetailMetrics(trades);
    
    const priceHistoryForChart = priceHistory.map(p => ({ date: p.date, price: p.close }));
    
    await storage.updateBacktestRun(backtestId, {
      status: "completed",
      progress: 100,
      summary: summary as any,
      details: details as any,
      trades: trades as any,
      dailyLogs: dailyLogs as any,
      priceHistory: priceHistoryForChart as any,
      pnlHistory: pnlHistory as any,
      completedAt: new Date(),
    });
    
  } catch (error) {
    console.error('Backtest error:', error);
    await storage.updateBacktestRun(backtestId, {
      status: "error",
      errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}

function calculateSummaryMetrics(
  trades: BacktestTradeData[],
  dailyLogs: BacktestDailyLog[],
  totalCapitalUsed: number,
  config: BacktestConfigData
): BacktestSummaryMetrics {
  const totalProfitLoss = trades.reduce((sum, t) => sum + t.profitLoss, 0);
  
  let maxDrawdown = 0;
  let maxDrawdownDate = config.startDate;
  for (const log of dailyLogs) {
    if (log.drawdown > maxDrawdown) {
      maxDrawdown = log.drawdown;
      maxDrawdownDate = log.date;
    }
  }
  
  const usedCapital = config.capitalMethod === "manual" && config.manualCapital 
    ? config.manualCapital 
    : totalCapitalUsed;
  
  const returnOnCapital = usedCapital > 0 ? (totalProfitLoss / usedCapital) * 100 : 0;
  
  const startDate = new Date(config.startDate);
  const endDate = new Date(config.endDate);
  const years = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
  
  const cagr = years > 0 && usedCapital > 0
    ? (Math.pow((usedCapital + totalProfitLoss) / usedCapital, 1 / years) - 1) * 100
    : 0;
  
  const marRatio = maxDrawdown > 0 ? cagr / maxDrawdown : 0;
  
  return {
    totalProfitLoss,
    maxDrawdown,
    maxDrawdownDate,
    returnOnCapital,
    marRatio,
    usedCapital,
    cagr,
  };
}

function calculateDetailMetrics(trades: BacktestTradeData[]): BacktestDetailMetrics {
  const numberOfTrades = trades.length;
  
  if (numberOfTrades === 0) {
    return {
      numberOfTrades: 0,
      tradesWithProfits: 0,
      tradesWithLosses: 0,
      profitRate: 0,
      lossRate: 0,
      largestProfit: 0,
      largestLoss: 0,
      avgReturnPerTrade: 0,
      avgDaysInTrade: 0,
      avgBuyingPower: 0,
      avgPremium: 0,
      avgProfitLossPerTrade: 0,
      avgWinSize: 0,
      avgLossSize: 0,
      totalPremium: 0,
      totalFees: 0,
    };
  }
  
  const profits = trades.filter(t => t.profitLoss > 0);
  const losses = trades.filter(t => t.profitLoss <= 0);
  
  const tradesWithProfits = profits.length;
  const tradesWithLosses = losses.length;
  const profitRate = (tradesWithProfits / numberOfTrades) * 100;
  const lossRate = (tradesWithLosses / numberOfTrades) * 100;
  
  const profitAmounts = profits.map(t => t.profitLoss);
  const lossAmounts = losses.map(t => t.profitLoss);
  
  const largestProfit = profitAmounts.length > 0 ? Math.max(...profitAmounts) : 0;
  const largestLoss = lossAmounts.length > 0 ? Math.min(...lossAmounts) : 0;
  
  const totalProfitLoss = trades.reduce((sum, t) => sum + t.profitLoss, 0);
  const avgProfitLossPerTrade = totalProfitLoss / numberOfTrades;
  
  const avgReturnPerTrade = trades.reduce((sum, t) => sum + t.roi, 0) / numberOfTrades;
  const avgDaysInTrade = trades.reduce((sum, t) => sum + t.daysInTrade, 0) / numberOfTrades;
  const avgBuyingPower = trades.reduce((sum, t) => sum + t.buyingPower, 0) / numberOfTrades;
  const avgPremium = trades.reduce((sum, t) => sum + t.premium, 0) / numberOfTrades;
  
  const avgWinSize = tradesWithProfits > 0 
    ? profitAmounts.reduce((a, b) => a + b, 0) / tradesWithProfits 
    : 0;
  const avgLossSize = tradesWithLosses > 0 
    ? lossAmounts.reduce((a, b) => a + b, 0) / tradesWithLosses 
    : 0;
  
  const totalPremium = trades.reduce((sum, t) => sum + t.premium, 0);
  const totalFees = trades.reduce((sum, t) => sum + t.fees, 0);
  
  return {
    numberOfTrades,
    tradesWithProfits,
    tradesWithLosses,
    profitRate,
    lossRate,
    largestProfit,
    largestLoss,
    avgReturnPerTrade,
    avgDaysInTrade,
    avgBuyingPower,
    avgPremium,
    avgProfitLossPerTrade,
    avgWinSize,
    avgLossSize,
    totalPremium,
    totalFees,
  };
}

// ============================================================================
// LEGACY SIMPLE BACKTEST (kept for backwards compatibility)
// ============================================================================

const ALPACA_DATA_URL = "https://data.alpaca.markets/v2";

interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface AlpacaBarsResponse {
  bars: { [symbol: string]: AlpacaBar[] };
  next_page_token?: string;
}

export async function fetchHistoricalBars(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<AlpacaBar[]> {
  if (!ALPACA_API_KEY || !ALPACA_API_SECRET) {
    throw new Error("Alpaca API credentials not configured");
  }

  const allBars: AlpacaBar[] = [];
  let nextPageToken: string | undefined;

  do {
    const url = new URL(`${ALPACA_DATA_URL}/stocks/bars`);
    url.searchParams.set('symbols', symbol.toUpperCase());
    url.searchParams.set('timeframe', '1Day');
    url.searchParams.set('start', `${startDate}T00:00:00Z`);
    url.searchParams.set('end', `${endDate}T23:59:59Z`);
    url.searchParams.set('adjustment', 'split');
    url.searchParams.set('feed', 'iex');
    url.searchParams.set('limit', '10000');
    
    if (nextPageToken) {
      url.searchParams.set('page_token', nextPageToken);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BACKTEST] Alpaca bars error:', response.status, errorText);
      throw new Error(`Alpaca API error: ${response.status}`);
    }

    const data: AlpacaBarsResponse = await response.json();
    const symbolBars = data.bars[symbol.toUpperCase()] || [];
    allBars.push(...symbolBars);
    
    nextPageToken = data.next_page_token;
  } while (nextPageToken);

  console.log(`[BACKTEST] Fetched ${allBars.length} bars for ${symbol} from ${startDate} to ${endDate}`);
  return allBars;
}

function calculateStrategyValueAtPrice(
  legs: OptionLeg[],
  underlyingPrice: number,
  entryPrice: number,
  daysToExpiration: number,
  volatility: number
): number {
  let totalValue = 0;
  
  for (const leg of legs) {
    if (leg.isExcluded) continue;
    
    const remainingQty = leg.closingTransaction?.isEnabled 
      ? leg.quantity - (leg.closingTransaction.quantity || 0)
      : leg.quantity;
    
    if (remainingQty <= 0) continue;
    
    const dte = Math.max(0, daysToExpiration);
    const currentPrice = calculateOptionPrice(
      leg.type as "call" | "put",
      underlyingPrice,
      leg.strike,
      dte,
      volatility
    );
    
    const multiplier = leg.position === "long" ? 1 : -1;
    totalValue += multiplier * currentPrice * remainingQty * 100;
  }
  
  return totalValue;
}

function calculateEntryValue(legs: OptionLeg[]): number {
  let totalCost = 0;
  
  for (const leg of legs) {
    if (leg.isExcluded) continue;
    
    const remainingQty = leg.closingTransaction?.isEnabled 
      ? leg.quantity - (leg.closingTransaction.quantity || 0)
      : leg.quantity;
    
    if (remainingQty <= 0) continue;
    
    const multiplier = leg.position === "long" ? -1 : 1;
    totalCost += multiplier * leg.premium * remainingQty * 100;
  }
  
  return totalCost;
}

function calculateMaxRisk(legs: OptionLeg[], entryPrice: number): number {
  let maxLoss = 0;
  
  for (const leg of legs) {
    if (leg.isExcluded) continue;
    
    const remainingQty = leg.closingTransaction?.isEnabled 
      ? leg.quantity - (leg.closingTransaction.quantity || 0)
      : leg.quantity;
    
    if (remainingQty <= 0) continue;
    
    if (leg.position === "long") {
      maxLoss += leg.premium * remainingQty * 100;
    } else {
      if (leg.type === "call") {
        maxLoss += entryPrice * remainingQty * 100;
      } else {
        maxLoss += leg.strike * remainingQty * 100;
      }
    }
  }
  
  return Math.abs(maxLoss) || 1;
}

export async function runBacktest(request: BacktestRequest): Promise<BacktestResult> {
  const { symbol, legs, startDate, endDate, initialVolatility, entryPrice } = request;
  
  const bars = await fetchHistoricalBars(symbol, startDate, endDate);
  
  if (bars.length === 0) {
    throw new Error(`No historical data available for ${symbol} in the specified date range`);
  }
  
  const startDateTime = new Date(startDate);
  const expirationDate = legs[0]?.expirationDate 
    ? new Date(legs[0].expirationDate)
    : new Date(startDateTime.getTime() + (legs[0]?.expirationDays || 30) * 24 * 60 * 60 * 1000);
  
  const entryCost = calculateEntryValue(legs);
  const maxRisk = calculateMaxRisk(legs, entryPrice);
  
  const dataPoints: BacktestDataPoint[] = [];
  let peakValue = entryCost;
  let maxDrawdown = 0;
  let maxGain = 0;
  let profitableDays = 0;
  const dailyReturns: number[] = [];
  let previousValue = entryCost;
  
  for (const bar of bars) {
    const barDate = new Date(bar.t);
    const daysToExp = Math.max(0, Math.ceil((expirationDate.getTime() - barDate.getTime()) / (24 * 60 * 60 * 1000)));
    
    const strategyValue = calculateStrategyValueAtPrice(
      legs,
      bar.c,
      entryPrice,
      daysToExp,
      initialVolatility
    );
    
    const pnl = strategyValue - entryCost;
    const pnlPercent = (pnl / maxRisk) * 100;
    
    dataPoints.push({
      date: bar.t.split('T')[0],
      underlyingPrice: bar.c,
      strategyValue,
      pnl,
      pnlPercent,
      daysToExpiration: daysToExp,
    });
    
    if (strategyValue > peakValue) {
      peakValue = strategyValue;
    }
    const currentDrawdown = peakValue - strategyValue;
    if (currentDrawdown > maxDrawdown) {
      maxDrawdown = currentDrawdown;
    }
    
    if (pnl > maxGain) {
      maxGain = pnl;
    }
    
    if (pnl > 0) {
      profitableDays++;
    }
    
    if (previousValue !== 0) {
      const dailyReturn = (strategyValue - previousValue) / Math.abs(previousValue);
      dailyReturns.push(dailyReturn);
    }
    previousValue = strategyValue;
  }
  
  const finalDataPoint = dataPoints[dataPoints.length - 1];
  const totalReturn = finalDataPoint?.pnl || 0;
  const totalReturnPercent = (totalReturn / maxRisk) * 100;
  
  const avgDailyReturn = dailyReturns.length > 0 
    ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length 
    : 0;
  
  const variance = dailyReturns.length > 1
    ? dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) / (dailyReturns.length - 1)
    : 0;
  const volatility = Math.sqrt(variance) * Math.sqrt(252);
  
  const sharpeRatio = volatility > 0 
    ? (avgDailyReturn * 252) / volatility 
    : 0;
  
  const metrics: BacktestMetrics = {
    totalReturn,
    totalReturnPercent,
    maxDrawdown,
    maxDrawdownPercent: (maxDrawdown / maxRisk) * 100,
    maxGain,
    winRate: dataPoints.length > 0 ? (profitableDays / dataPoints.length) * 100 : 0,
    sharpeRatio,
    avgDailyReturn: avgDailyReturn * 100,
    volatility: volatility * 100,
    daysInTrade: dataPoints.length,
  };
  
  return {
    symbol,
    startDate,
    endDate,
    entryPrice,
    exitPrice: finalDataPoint?.underlyingPrice || entryPrice,
    dataPoints,
    metrics,
    legs,
  };
}
