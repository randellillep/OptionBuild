import type { OptionLeg, BacktestRequest, BacktestResult, BacktestDataPoint, BacktestMetrics } from "@shared/schema";

const ALPACA_API_KEY = process.env.ALPACA_API_KEY;
const ALPACA_API_SECRET = process.env.ALPACA_API_SECRET;
const ALPACA_DATA_URL = "https://data.alpaca.markets/v2";

interface HistoricalBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface AlpacaBarsResponse {
  bars: { [symbol: string]: HistoricalBar[] };
  next_page_token?: string;
}

function cumulativeNormalDistribution(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

function blackScholesCall(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0) return Math.max(S - K, 0);
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return S * cumulativeNormalDistribution(d1) - K * Math.exp(-r * T) * cumulativeNormalDistribution(d2);
}

function blackScholesPut(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0) return Math.max(K - S, 0);
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return K * Math.exp(-r * T) * cumulativeNormalDistribution(-d2) - S * cumulativeNormalDistribution(-d1);
}

function calculateOptionPrice(
  type: "call" | "put",
  underlyingPrice: number,
  strike: number,
  daysToExpiration: number,
  volatility: number = 0.3,
  riskFreeRate: number = 0.05
): number {
  const T = daysToExpiration / 365;
  if (type === "call") {
    return blackScholesCall(underlyingPrice, strike, T, riskFreeRate, volatility);
  } else {
    return blackScholesPut(underlyingPrice, strike, T, riskFreeRate, volatility);
  }
}

export async function fetchHistoricalBars(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<HistoricalBar[]> {
  if (!ALPACA_API_KEY || !ALPACA_API_SECRET) {
    throw new Error("Alpaca API credentials not configured");
  }

  const allBars: HistoricalBar[] = [];
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
