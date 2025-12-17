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

// Calculate implied volatility using Newton-Raphson method
export function calculateImpliedVolatility(
  type: "call" | "put",
  underlyingPrice: number,
  strike: number,
  daysToExpiration: number,
  marketPrice: number,
  riskFreeRate: number = 0.05
): number {
  const T = daysToExpiration / 365;
  
  // Handle edge cases
  if (T <= 0 || marketPrice <= 0) return 0.3; // Default 30%
  
  // Initial guess based on at-the-moneyness
  let sigma = 0.3;
  
  // Newton-Raphson iteration
  const maxIterations = 100;
  const tolerance = 0.0001;
  
  for (let i = 0; i < maxIterations; i++) {
    // Calculate option price with current sigma
    const theoreticalPrice = type === "call" 
      ? blackScholesCall(underlyingPrice, strike, T, riskFreeRate, sigma)
      : blackScholesPut(underlyingPrice, strike, T, riskFreeRate, sigma);
    
    // Calculate vega (derivative of price w.r.t. volatility)
    const d1 = (Math.log(underlyingPrice / strike) + (riskFreeRate + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
    const nprime_d1 = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-d1 * d1 / 2);
    const vega = underlyingPrice * nprime_d1 * Math.sqrt(T);
    
    // Price difference
    const priceDiff = theoreticalPrice - marketPrice;
    
    // Check convergence
    if (Math.abs(priceDiff) < tolerance) {
      return sigma;
    }
    
    // Avoid division by zero
    if (Math.abs(vega) < 1e-10) break;
    
    // Newton-Raphson update: sigma_new = sigma_old - f(sigma)/f'(sigma)
    sigma = sigma - priceDiff / vega;
    
    // Constrain sigma to reasonable range (1% to 300%)
    sigma = Math.max(0.01, Math.min(3.0, sigma));
  }
  
  return sigma;
}

export function calculateGreeks(
  leg: OptionLeg,
  underlyingPrice: number,
  volatility: number = 0.3,
  riskFreeRate: number = 0.05
): Greeks {
  // Return zero Greeks for excluded legs
  if (leg.isExcluded) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
  }
  
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
  
  // Use effective quantity (accounting for closing transaction)
  // ALL closing entries reduce quantity (excluded entries still count as sold, just hide P/L)
  const closing = leg.closingTransaction;
  const closedQty = closing?.isEnabled && closing.entries
    ? closing.entries.reduce((sum, e) => sum + e.quantity, 0)
    : (closing?.isEnabled ? (closing.quantity || 0) : 0);
  const effectiveQuantity = Math.max(0, leg.quantity - closedQty);
  
  return {
    delta: delta * multiplier * effectiveQuantity,
    gamma: gamma * multiplier * effectiveQuantity,
    theta: theta * multiplier * effectiveQuantity,
    vega: vega * multiplier * effectiveQuantity,
    rho: rho * multiplier * effectiveQuantity,
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
    
    // Handle closing transaction if present and enabled
    const closing = leg.closingTransaction;
    if (closing?.isEnabled && closing.entries && closing.entries.length > 0) {
      // Calculate realized P/L from non-excluded entries only
      let totalClosedPnl = 0;
      // Calculate total closed quantity from ALL entries (for remaining qty calculation)
      const allClosedQty = closing.entries.reduce((sum, e) => sum + e.quantity, 0);
      
      for (const entry of closing.entries) {
        // Skip excluded entries for P/L calculation (but they still count toward closed quantity)
        if (entry.isExcluded) continue;
        
        // Use entry's IMMUTABLE openingPrice (cost basis captured at close time)
        // Fall back to leg.premium only for legacy entries that don't have openingPrice
        const entryCostBasis = entry.openingPrice ?? premium;
        
        const entryPnl = leg.position === "long"
          ? (entry.closingPrice - entryCostBasis) * entry.quantity * 100
          : (entryCostBasis - entry.closingPrice) * entry.quantity * 100;
        
        totalClosedPnl += entryPnl;
      }
      
      // Remaining quantity is based on ALL closed entries (excluded or not)
      const remainingQty = leg.quantity - allClosedQty;
      
      // Unrealized P/L for remaining quantity (only if leg is NOT excluded)
      const remainingPnl = (remainingQty > 0 && !leg.isExcluded)
        ? (leg.position === "long"
            ? (intrinsicValue - premium) * remainingQty * 100
            : (premium - intrinsicValue) * remainingQty * 100)
        : 0;
      
      pnl += totalClosedPnl + remainingPnl;
    } else if (closing?.isEnabled && closing.quantity > 0) {
      // Legacy: aggregated closing transaction without entries
      const closedQty = Math.min(closing.quantity, leg.quantity);
      const remainingQty = leg.quantity - closedQty;
      
      // Realized P/L from closed portion (ALWAYS included - closed trades always count)
      const closingPrice = closing.closingPrice;
      const closedPnl = leg.position === "long"
        ? (closingPrice - premium) * closedQty * 100
        : (premium - closingPrice) * closedQty * 100;
      
      // Unrealized P/L for remaining quantity (only if leg is NOT excluded)
      const remainingPnl = (remainingQty > 0 && !leg.isExcluded)
        ? (leg.position === "long"
            ? (intrinsicValue - premium) * remainingQty * 100
            : (premium - intrinsicValue) * remainingQty * 100)
        : 0;
      
      pnl += closedPnl + remainingPnl;
    } else {
      // Skip excluded legs for standard calculation (no closing transactions)
      if (leg.isExcluded) continue;
      
      // Standard calculation for full quantity
      const legPnl = leg.position === "long"
        ? (intrinsicValue - premium) * Math.abs(leg.quantity) * 100
        : (premium - intrinsicValue) * Math.abs(leg.quantity) * 100;
      
      pnl += legPnl;
    }
  }
  
  return pnl;
}

export function calculateProfitLossAtDate(
  legs: OptionLeg[],
  underlyingPrice: number,
  atPrice: number,
  daysFromNow: number,
  volatility: number = 0.3,
  riskFreeRate: number = 0.05
): number {
  let pnl = 0;
  
  for (const leg of legs) {
    // Calculate remaining days to expiration from the given point in time
    // daysFromNow = 0 means today, so we have leg.expirationDays remaining
    // daysFromNow = 5 means 5 days from now, so we have leg.expirationDays - 5 remaining
    const daysRemaining = Math.max(0, leg.expirationDays - daysFromNow);
    
    let optionValue: number;
    if (daysRemaining <= 0) {
      // At or past expiration - use intrinsic value
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
    
    // Handle closing transaction if present and enabled
    const closing = leg.closingTransaction;
    if (closing?.isEnabled && closing.entries && closing.entries.length > 0) {
      // Calculate realized P/L from non-excluded entries only
      let totalClosedPnl = 0;
      // Calculate total closed quantity from ALL entries (for remaining qty calculation)
      const allClosedQty = closing.entries.reduce((sum, e) => sum + e.quantity, 0);
      
      for (const entry of closing.entries) {
        // Skip excluded entries for P/L calculation (but they still count toward closed quantity)
        if (entry.isExcluded) continue;
        
        // Use entry's IMMUTABLE openingPrice (cost basis captured at close time)
        // Fall back to leg.premium only for legacy entries that don't have openingPrice
        const entryCostBasis = entry.openingPrice ?? premium;
        
        const entryPnl = leg.position === "long"
          ? (entry.closingPrice - entryCostBasis) * entry.quantity * 100
          : (entryCostBasis - entry.closingPrice) * entry.quantity * 100;
        
        totalClosedPnl += entryPnl;
      }
      
      // Remaining quantity is based on ALL closed entries (excluded or not)
      const remainingQty = leg.quantity - allClosedQty;
      
      // Unrealized P/L for remaining quantity (only if leg is NOT excluded)
      const remainingPnl = (remainingQty > 0 && !leg.isExcluded)
        ? (leg.position === "long"
            ? (optionValue - premium) * remainingQty * 100
            : (premium - optionValue) * remainingQty * 100)
        : 0;
      
      pnl += totalClosedPnl + remainingPnl;
    } else if (closing?.isEnabled && closing.quantity > 0) {
      // Legacy: aggregated closing transaction
      const closedQty = Math.min(closing.quantity, leg.quantity);
      const remainingQty = leg.quantity - closedQty;
      
      // Realized P/L from closed portion (ALWAYS included - closed trades always count)
      const closingPrice = closing.closingPrice;
      const closedPnl = leg.position === "long"
        ? (closingPrice - premium) * closedQty * 100
        : (premium - closingPrice) * closedQty * 100;
      
      // Unrealized P/L for remaining quantity (only if leg is NOT excluded)
      const remainingPnl = (remainingQty > 0 && !leg.isExcluded)
        ? (leg.position === "long"
            ? (optionValue - premium) * remainingQty * 100
            : (premium - optionValue) * remainingQty * 100)
        : 0;
      
      pnl += closedPnl + remainingPnl;
    } else {
      // Skip excluded legs for standard calculation (no closing transactions)
      if (leg.isExcluded) continue;
      
      // Standard calculation for full quantity
      const legPnl = leg.position === "long"
        ? (optionValue - premium) * Math.abs(leg.quantity) * 100
        : (premium - optionValue) * Math.abs(leg.quantity) * 100;
      
      pnl += legPnl;
    }
  }
  
  return pnl;
}

export function calculateStrategyMetrics(
  legs: OptionLeg[],
  underlyingPrice: number
): StrategyMetrics {
  // For strike range calculation, use legs that have active positions or closed trades
  const legsWithActivity = legs.filter(leg => !leg.isExcluded || 
    (leg.closingTransaction?.isEnabled && (leg.closingTransaction?.entries?.length ?? 0) > 0));
  
  if (legsWithActivity.length === 0) {
    return {
      maxProfit: null,
      maxLoss: null,
      breakeven: [],
      netPremium: 0,
      riskRewardRatio: null,
    };
  }
  
  // Net premium: normalize premium to positive, then apply position multiplier
  // Also account for closing transactions
  const netPremium = legs.reduce((sum, leg) => {
    const premium = Math.abs(leg.premium);
    const closing = leg.closingTransaction;
    
    if (closing?.isEnabled && closing.entries && closing.entries.length > 0) {
      // Calculate realized premium from non-excluded entries only
      let closedPremiumEffect = 0;
      // Calculate ALL closed quantity (for remaining qty)
      const allClosedQty = closing.entries.reduce((s, e) => s + e.quantity, 0);
      
      for (const entry of closing.entries) {
        if (entry.isExcluded) continue;
        
        // Use entry's IMMUTABLE openingPrice (cost basis captured at close time)
        // Fall back to leg.premium only for legacy entries that don't have openingPrice
        const entryCostBasis = entry.openingPrice ?? premium;
        
        const entryPremiumEffect = leg.position === "long"
          ? (-entryCostBasis * entry.quantity + entry.closingPrice * entry.quantity) * 100
          : (entryCostBasis * entry.quantity - entry.closingPrice * entry.quantity) * 100;
        
        closedPremiumEffect += entryPremiumEffect;
      }
      
      // Remaining quantity is based on ALL closed entries
      const remainingQty = leg.quantity - allClosedQty;
      
      // Remaining position premium effect (only if leg is NOT excluded)
      const remainingPremiumEffect = (remainingQty > 0 && !leg.isExcluded)
        ? (leg.position === "long" ? -premium : premium) * remainingQty * 100
        : 0;
      
      return sum + closedPremiumEffect + remainingPremiumEffect;
    } else if (closing?.isEnabled && closing.quantity > 0) {
      // Legacy: aggregated closing transaction without entries
      if (leg.isExcluded) return sum; // Skip if leg excluded and no entries
      
      const closedQty = Math.min(closing.quantity, leg.quantity);
      const remainingQty = leg.quantity - closedQty;
      
      const closedPremiumEffect = leg.position === "long"
        ? (-premium * closedQty + closing.closingPrice * closedQty) * 100
        : (premium * closedQty - closing.closingPrice * closedQty) * 100;
      
      const remainingPremiumEffect = remainingQty > 0
        ? (leg.position === "long" ? -premium : premium) * remainingQty * 100
        : 0;
      
      return sum + closedPremiumEffect + remainingPremiumEffect;
    } else {
      // Skip excluded legs with no closing transactions
      if (leg.isExcluded) return sum;
      
      const quantity = Math.abs(leg.quantity);
      return sum + (leg.position === "long" ? -premium : premium) * quantity * 100;
    }
  }, 0);
  
  // Include all active leg strikes in the price range
  const allStrikes = legsWithActivity.map(leg => leg.strike);
  const minStrike = Math.min(...allStrikes);
  const maxStrike = Math.max(...allStrikes);
  
  // Expand range to include strikes and some buffer
  const minPrice = Math.min(underlyingPrice * 0.5, minStrike * 0.8);
  const maxPrice = Math.max(underlyingPrice * 1.5, maxStrike * 1.2);
  
  const priceRange = Array.from({ length: 200 }, (_, i) => {
    return minPrice + (maxPrice - minPrice) * (i / 199);
  });
  
  // Note: calculateProfitLoss already handles excluded legs and closing transactions
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

/**
 * Calculate realized and unrealized P/L separately
 * Realized: P/L from closed positions (actual gains/losses from sales)
 * Unrealized: P/L from open positions (hypothetical gains/losses at current price)
 * 
 * For unrealized P/L, we compare:
 * - Cost basis (original purchase price, stored as leg.premium for saved trades or entry.openingPrice)
 * - Current option price (calculated using Black-Scholes, or leg.premium if live)
 * 
 * For saved trades (premiumSource === 'saved'), leg.premium is the original cost basis.
 * For live trades, leg.premium updates with market, so unrealized = 0 (no saved cost basis).
 */
export function calculateRealizedUnrealizedPL(
  legs: OptionLeg[],
  underlyingPrice: number
): { realizedPL: number; unrealizedPL: number; hasRealizedPL: boolean; hasUnrealizedPL: boolean } {
  let realizedPL = 0;
  let unrealizedPL = 0;
  let hasClosingTransactions = false;
  let hasOpenPositionsWithSavedBasis = false;
  
  for (const leg of legs) {
    // For unrealized P/L, we need to compare cost basis to current option price
    // For saved trades: cost basis = leg.premium, current price = calculated from Black-Scholes
    // For live trades: cost basis = current price (both are leg.premium), so unrealized = 0
    
    const costBasis = Math.abs(leg.premium);
    
    // Calculate current option price using Black-Scholes
    // Use reasonable defaults: 30 DTE, 30% IV, 5% risk-free rate
    const daysToExpiry = leg.expirationDays || 30;
    const volatility = 0.30; // Default IV
    const riskFreeRate = 0.05;
    const timeToExpiry = daysToExpiry / 365;
    
    // Calculate current theoretical option price
    const currentPrice = calculateOptionPrice(
      leg.type as "call" | "put",
      underlyingPrice,
      leg.strike,
      daysToExpiry,
      volatility,
      riskFreeRate
    );
    
    const closing = leg.closingTransaction;
    
    if (closing?.isEnabled && closing.entries && closing.entries.length > 0) {
      const allClosedQty = closing.entries.reduce((sum, e) => sum + e.quantity, 0);
      
      for (const entry of closing.entries) {
        if (entry.isExcluded) continue;
        
        hasClosingTransactions = true;
        const entryCostBasis = entry.openingPrice ?? costBasis;
        const entryPnl = leg.position === "long"
          ? (entry.closingPrice - entryCostBasis) * entry.quantity * 100
          : (entryCostBasis - entry.closingPrice) * entry.quantity * 100;
        
        realizedPL += entryPnl;
      }
      
      const remainingQty = leg.quantity - allClosedQty;
      if (remainingQty > 0 && !leg.isExcluded) {
        // Calculate unrealized for remaining positions
        // Use the cost basis from the leg (which user may have edited)
        hasOpenPositionsWithSavedBasis = true;
        const remainingPnl = leg.position === "long"
          ? (currentPrice - costBasis) * remainingQty * 100
          : (costBasis - currentPrice) * remainingQty * 100;
        unrealizedPL += remainingPnl;
      }
    } else if (closing?.isEnabled && closing.quantity > 0) {
      hasClosingTransactions = true;
      const closedQty = Math.min(closing.quantity, leg.quantity);
      const remainingQty = leg.quantity - closedQty;
      
      const closedPnl = leg.position === "long"
        ? (closing.closingPrice - costBasis) * closedQty * 100
        : (costBasis - closing.closingPrice) * closedQty * 100;
      realizedPL += closedPnl;
      
      if (remainingQty > 0 && !leg.isExcluded) {
        // Calculate unrealized for remaining positions
        hasOpenPositionsWithSavedBasis = true;
        const remainingPnl = leg.position === "long"
          ? (currentPrice - costBasis) * remainingQty * 100
          : (costBasis - currentPrice) * remainingQty * 100;
        unrealizedPL += remainingPnl;
      }
    } else {
      if (leg.isExcluded) continue;
      
      // Only calculate unrealized if this is a saved trade with preserved cost basis
      if (leg.premiumSource === 'saved') {
        hasOpenPositionsWithSavedBasis = true;
        const legPnl = leg.position === "long"
          ? (currentPrice - costBasis) * Math.abs(leg.quantity) * 100
          : (costBasis - currentPrice) * Math.abs(leg.quantity) * 100;
        unrealizedPL += legPnl;
      }
      // For non-saved trades, current price = cost basis, so unrealized = 0
    }
  }
  
  return { 
    realizedPL, 
    unrealizedPL, 
    hasRealizedPL: hasClosingTransactions, 
    hasUnrealizedPL: hasOpenPositionsWithSavedBasis 
  };
}
