import type { OptionLeg, Greeks, StrategyMetrics } from "@shared/schema";

function cumulativeNormalDistribution(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

export function blackScholesCall(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number
): number {
  if (T <= 0) return Math.max(S - K, 0);
  
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  return S * cumulativeNormalDistribution(d1) - K * Math.exp(-r * T) * cumulativeNormalDistribution(d2);
}

export function blackScholesPut(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number
): number {
  if (T <= 0) return Math.max(K - S, 0);
  
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  return K * Math.exp(-r * T) * cumulativeNormalDistribution(-d2) - S * cumulativeNormalDistribution(-d1);
}

export function calculateOptionPrice(
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

export function calculateGreeks(
  leg: OptionLeg,
  underlyingPrice: number,
  volatility: number = 0.3,
  riskFreeRate: number = 0.05
): Greeks {
  const T = leg.expirationDays / 365;
  const S = underlyingPrice;
  const K = leg.strike;
  const sigma = volatility;
  const r = riskFreeRate;
  
  if (T <= 0) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
  }
  
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  const nd1 = cumulativeNormalDistribution(d1);
  const nd2 = cumulativeNormalDistribution(d2);
  const nprime_d1 = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-d1 * d1 / 2);
  
  let delta: number;
  let theta: number;
  let rho: number;
  
  if (leg.type === "call") {
    delta = nd1;
    theta = (-S * nprime_d1 * sigma / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * nd2) / 365;
    rho = K * T * Math.exp(-r * T) * nd2 / 100;
  } else {
    delta = nd1 - 1;
    theta = (-S * nprime_d1 * sigma / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * cumulativeNormalDistribution(-d2)) / 365;
    rho = -K * T * Math.exp(-r * T) * cumulativeNormalDistribution(-d2) / 100;
  }
  
  const gamma = nprime_d1 / (S * sigma * Math.sqrt(T));
  const vega = S * nprime_d1 * Math.sqrt(T) / 100;
  
  const multiplier = leg.position === "long" ? 1 : -1;
  
  return {
    delta: delta * multiplier * leg.quantity,
    gamma: gamma * multiplier * leg.quantity,
    theta: theta * multiplier * leg.quantity,
    vega: vega * multiplier * leg.quantity,
    rho: rho * multiplier * leg.quantity,
  };
}

export function calculateProfitLoss(
  legs: OptionLeg[],
  underlyingPrice: number,
  atPrice: number
): number {
  let pnl = 0;
  
  for (const leg of legs) {
    const intrinsicValue = leg.type === "call" 
      ? Math.max(atPrice - leg.strike, 0)
      : Math.max(leg.strike - atPrice, 0);
    
    // Normalize premium to always be positive (absolute value)
    const premium = Math.abs(leg.premium);
    
    const legPnl = leg.position === "long"
      ? (intrinsicValue - premium) * Math.abs(leg.quantity) * 100
      : (premium - intrinsicValue) * Math.abs(leg.quantity) * 100;
    
    pnl += legPnl;
  }
  
  return pnl;
}

export function calculateProfitLossAtDate(
  legs: OptionLeg[],
  underlyingPrice: number,
  atPrice: number,
  daysToExpiration: number,
  volatility: number = 0.3,
  riskFreeRate: number = 0.05
): number {
  let pnl = 0;
  
  for (const leg of legs) {
    const daysRemaining = Math.max(0, daysToExpiration);
    
    let optionValue: number;
    if (daysRemaining <= 0) {
      optionValue = leg.type === "call" 
        ? Math.max(atPrice - leg.strike, 0)
        : Math.max(leg.strike - atPrice, 0);
    } else {
      optionValue = calculateOptionPrice(
        leg.type,
        atPrice,
        leg.strike,
        daysRemaining,
        volatility,
        riskFreeRate
      );
    }
    
    // Normalize premium to always be positive (absolute value)
    const premium = Math.abs(leg.premium);
    
    const legPnl = leg.position === "long"
      ? (optionValue - premium) * Math.abs(leg.quantity) * 100
      : (premium - optionValue) * Math.abs(leg.quantity) * 100;
    
    pnl += legPnl;
  }
  
  return pnl;
}

export function calculateStrategyMetrics(
  legs: OptionLeg[],
  underlyingPrice: number
): StrategyMetrics {
  // Net premium: normalize premium to positive, then apply position multiplier
  const netPremium = legs.reduce((sum, leg) => {
    const premium = Math.abs(leg.premium);
    const quantity = Math.abs(leg.quantity);
    return sum + (leg.position === "long" ? -premium : premium) * quantity * 100;
  }, 0);
  
  // Include all leg strikes in the price range
  const allStrikes = legs.map(leg => leg.strike);
  const minStrike = Math.min(...allStrikes);
  const maxStrike = Math.max(...allStrikes);
  
  // Expand range to include strikes and some buffer
  const minPrice = Math.min(underlyingPrice * 0.5, minStrike * 0.8);
  const maxPrice = Math.max(underlyingPrice * 1.5, maxStrike * 1.2);
  
  const priceRange = Array.from({ length: 200 }, (_, i) => {
    return minPrice + (maxPrice - minPrice) * (i / 199);
  });
  
  const pnlValues = priceRange.map(price => calculateProfitLoss(legs, underlyingPrice, price));
  
  const maxProfit = Math.max(...pnlValues);
  const maxLoss = Math.min(...pnlValues);
  
  const breakeven: number[] = [];
  for (let i = 1; i < pnlValues.length; i++) {
    if ((pnlValues[i - 1] < 0 && pnlValues[i] >= 0) || (pnlValues[i - 1] > 0 && pnlValues[i] <= 0)) {
      const interpolatedPrice = priceRange[i - 1] + 
        (priceRange[i] - priceRange[i - 1]) * 
        (0 - pnlValues[i - 1]) / (pnlValues[i] - pnlValues[i - 1]);
      breakeven.push(interpolatedPrice);
    }
  }
  
  const riskRewardRatio = maxLoss < 0 && maxProfit > 0 
    ? maxProfit / Math.abs(maxLoss)
    : null;
  
  return {
    maxProfit: maxProfit > 0 ? maxProfit : null,
    maxLoss: maxLoss < 0 ? maxLoss : null,
    breakeven,
    netPremium,
    riskRewardRatio,
  };
}
