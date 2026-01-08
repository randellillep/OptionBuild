import type { OptionLeg, Greeks, StrategyMetrics } from "@shared/schema";

/**
 * Get the current market price for an option leg.
 * Priority: marketMark > midpoint(bid/ask) > marketLast > undefined (fallback to theoretical)
 * This ensures P/L calculations use actual market prices when available.
 */
export function getLegMarketPrice(leg: OptionLeg): number | undefined {
  // Best: use mark/mid price directly from options chain
  if (leg.marketMark !== undefined && leg.marketMark > 0) {
    return leg.marketMark;
  }
  // Second best: calculate midpoint from bid/ask
  if (leg.marketBid !== undefined && leg.marketAsk !== undefined && leg.marketBid > 0 && leg.marketAsk > 0) {
    return (leg.marketBid + leg.marketAsk) / 2;
  }
  // Third: use last traded price
  if (leg.marketLast !== undefined && leg.marketLast > 0) {
    return leg.marketLast;
  }
  // No market data available
  return undefined;
}

function cumulativeNormalDistribution(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/**
 * Bjerksund-Stensland 2002 American Options Pricing Model
 * More accurate than Black-Scholes for American-style options (most US equity options)
 * Uses a closed-form approximation with early exercise boundary
 */

function phi(S: number, T: number, gamma: number, H: number, I: number, b: number, r: number, sigma: number): number {
  if (T <= 0) return 0;
  
  const kappa = 2 * b / (sigma * sigma) + (2 * gamma - 1);
  const lambda = (-r + gamma * b + 0.5 * gamma * (gamma - 1) * sigma * sigma) * T;
  
  const sqrtT = Math.sqrt(T);
  const d = (Math.log(S / H) + (b + (gamma - 0.5) * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d - 2 * Math.log(I / S) / (sigma * sqrtT);
  
  const result = Math.exp(lambda) * Math.pow(S, gamma) * 
                 (cumulativeNormalDistribution(d) - Math.pow(I / S, kappa) * cumulativeNormalDistribution(d2));
  
  return isFinite(result) ? result : 0;
}

function bjerksundStensland2002Call(S: number, K: number, T: number, r: number, b: number, sigma: number): number {
  if (T <= 0) return Math.max(S - K, 0);
  if (S <= 0 || K <= 0 || sigma <= 0) return Math.max(S - K, 0);
  
  // If b >= r, American call equals European call (no early exercise benefit for calls on non-dividend stocks)
  if (b >= r) {
    return europeanCall(S, K, T, r, b, sigma);
  }
  
  const sigmaSq = sigma * sigma;
  const beta = (0.5 - b / sigmaSq) + Math.sqrt(Math.pow(b / sigmaSq - 0.5, 2) + 2 * r / sigmaSq);
  
  const BInfinity = (beta / (beta - 1)) * K;
  const B0 = Math.max(K, (r / (r - b)) * K);
  
  // Correct h(T) formula per Bjerksund-Stensland 2002 paper
  const sqrtT = Math.sqrt(T);
  const hT = -(b * T + 2 * sigma * sqrtT) * (B0 / (BInfinity - B0));
  const I = B0 + (BInfinity - B0) * (1 - Math.exp(hT));
  
  // Bjerksund-Stensland 2002: two-period approximation for better accuracy
  const t1 = 0.5 * (Math.sqrt(5) - 1) * T; // Optimal split point (golden ratio)
  
  // First period trigger with correct h(t1) formula
  const hT1 = -(b * t1 + 2 * sigma * Math.sqrt(t1)) * (B0 / (BInfinity - B0));
  const I1 = B0 + (BInfinity - B0) * (1 - Math.exp(hT1));
  
  // If S >= I, exercise immediately
  if (S >= I) {
    return S - K;
  }
  
  const alpha1 = (I1 - K) * Math.pow(I1, -beta);
  const alpha2 = (I - K) * Math.pow(I, -beta);
  
  // 2002 two-period formula per Bjerksund & Stensland paper
  // Second period terms (involving I, I2) use full maturity T
  // First period correction terms use t1
  const callValue = alpha2 * Math.pow(S, beta)
                  - alpha2 * phi(S, T, beta, I, I, b, r, sigma)
                  + phi(S, T, 1, I, I, b, r, sigma)
                  - phi(S, T, 1, K, I, b, r, sigma)
                  - K * phi(S, T, 0, I, I, b, r, sigma)
                  + K * phi(S, T, 0, K, I, b, r, sigma)
                  // First period corrections - use t1 for φ terms per equation (21)
                  + alpha1 * phi(S, t1, beta, I1, I1, b, r, sigma)
                  - alpha1 * psi(S, T, beta, I1, I, I1, t1, b, r, sigma)
                  + psi(S, T, 1, I1, I, I1, t1, b, r, sigma)
                  - psi(S, T, 1, K, I, I1, t1, b, r, sigma)
                  - K * psi(S, T, 0, I1, I, I1, t1, b, r, sigma)
                  + K * psi(S, T, 0, K, I, I1, t1, b, r, sigma);
  
  return Math.max(0, callValue);
}

function psi(S: number, T: number, gamma: number, H: number, I2: number, I1: number, t1: number, b: number, r: number, sigma: number): number {
  if (T <= 0 || t1 <= 0) return 0;
  
  const sigmaSq = sigma * sigma;
  const sqrtT = Math.sqrt(T);
  const sqrt_t1 = Math.sqrt(t1);
  
  const e1 = (Math.log(S / I1) + (b + (gamma - 0.5) * sigmaSq) * t1) / (sigma * sqrt_t1);
  const e2 = (Math.log(I2 * I2 / (S * I1)) + (b + (gamma - 0.5) * sigmaSq) * t1) / (sigma * sqrt_t1);
  const e3 = (Math.log(S / I1) - (b + (gamma - 0.5) * sigmaSq) * t1) / (sigma * sqrt_t1);
  const e4 = (Math.log(I2 * I2 / (S * I1)) - (b + (gamma - 0.5) * sigmaSq) * t1) / (sigma * sqrt_t1);
  
  const f1 = (Math.log(S / H) + (b + (gamma - 0.5) * sigmaSq) * T) / (sigma * sqrtT);
  const f2 = (Math.log(I2 * I2 / (S * H)) + (b + (gamma - 0.5) * sigmaSq) * T) / (sigma * sqrtT);
  const f3 = (Math.log(I1 * I1 / (S * H)) + (b + (gamma - 0.5) * sigmaSq) * T) / (sigma * sqrtT);
  const f4 = (Math.log(S * I1 * I1 / (H * I2 * I2)) + (b + (gamma - 0.5) * sigmaSq) * T) / (sigma * sqrtT);
  
  const kappa = 2 * b / sigmaSq + (2 * gamma - 1);
  const lambda = -r + gamma * b + 0.5 * gamma * (gamma - 1) * sigmaSq;
  
  const rho = Math.sqrt(t1 / T);
  
  const result = Math.exp(lambda * T) * Math.pow(S, gamma) * (
    bivariateNormal(-e1, -f1, rho)
    - Math.pow(I2 / S, kappa) * bivariateNormal(-e2, -f2, rho)
    - Math.pow(I1 / S, kappa) * bivariateNormal(-e3, -f3, -rho)
    + Math.pow(I1 / I2, kappa) * bivariateNormal(-e4, -f4, -rho)
  );
  
  return isFinite(result) ? result : 0;
}

function bivariateNormal(a: number, b: number, rho: number): number {
  // Drezner-Wesolowsky approximation for bivariate normal CDF
  const x = [0.24840615, 0.39233107, 0.21141819, 0.03324666, 0.00082485];
  const y = [0.10024215, 0.48281397, 1.0609498, 1.7797294, 2.6697604];
  
  let sum = 0;
  const detSign = a * b >= 0 ? 1 : -1;
  
  if (Math.abs(rho) < 0.925) {
    const aSq = a * a;
    const bSq = b * b;
    const ab = a * b;
    
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        sum += x[i] * x[j] * Math.exp(
          ((2 * y[i] * y[j] * rho - aSq - bSq) / (2 * (1 - rho * rho)))
        );
      }
    }
    sum *= Math.sqrt(1 - rho * rho) / Math.PI;
    return sum + cumulativeNormalDistribution(a) * cumulativeNormalDistribution(b);
  }
  
  // High correlation case
  const rhoSign = rho >= 0 ? 1 : -1;
  const bPrime = rhoSign * b;
  
  if (rho * detSign >= 0) {
    return cumulativeNormalDistribution(Math.min(a, bPrime));
  } else {
    return Math.max(0, cumulativeNormalDistribution(a) + cumulativeNormalDistribution(bPrime) - 1);
  }
}

function europeanCall(S: number, K: number, T: number, r: number, b: number, sigma: number): number {
  if (T <= 0) return Math.max(S - K, 0);
  
  const d1 = (Math.log(S / K) + (b + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  return S * Math.exp((b - r) * T) * cumulativeNormalDistribution(d1) - K * Math.exp(-r * T) * cumulativeNormalDistribution(d2);
}

function europeanPut(S: number, K: number, T: number, r: number, b: number, sigma: number): number {
  if (T <= 0) return Math.max(K - S, 0);
  
  const d1 = (Math.log(S / K) + (b + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  return K * Math.exp(-r * T) * cumulativeNormalDistribution(-d2) - S * Math.exp((b - r) * T) * cumulativeNormalDistribution(-d1);
}

function bjerksundStensland2002Put(S: number, K: number, T: number, r: number, b: number, sigma: number): number {
  if (T <= 0) return Math.max(K - S, 0);
  if (S <= 0 || K <= 0 || sigma <= 0) return Math.max(K - S, 0);
  
  // Use put-call transformation: Put(S, X, T, r, b, σ) = Call(X, S, T, r-b, -b, σ)
  return bjerksundStensland2002Call(K, S, T, r - b, -b, sigma);
}

// Wrapper functions to maintain backward compatibility with existing code
// These use cost of carry b = r (no dividends) which is standard for most US equities
export function blackScholesCall(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number
): number {
  // Use Bjerksund-Stensland 2002 for American-style options
  // b = r assumes no dividends (standard for most equity options)
  return bjerksundStensland2002Call(S, K, T, r, r, sigma);
}

export function blackScholesPut(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number
): number {
  // Use Bjerksund-Stensland 2002 for American-style options
  // b = r assumes no dividends (standard for most equity options)
  return bjerksundStensland2002Put(S, K, T, r, r, sigma);
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
  
  // Option prices can never be negative - ensure minimum of 0
  if (type === "call") {
    return Math.max(0, blackScholesCall(underlyingPrice, strike, T, riskFreeRate, volatility));
  } else {
    return Math.max(0, blackScholesPut(underlyingPrice, strike, T, riskFreeRate, volatility));
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
  
  const priceFunc = type === "call" ? blackScholesCall : blackScholesPut;
  
  for (let i = 0; i < maxIterations; i++) {
    // Calculate option price with current sigma using Bjerksund-Stensland
    const theoreticalPrice = priceFunc(underlyingPrice, strike, T, riskFreeRate, sigma);
    
    // Calculate vega numerically (derivative of price w.r.t. volatility)
    const dSigma = 0.001;
    const priceUp = priceFunc(underlyingPrice, strike, T, riskFreeRate, sigma + dSigma);
    const priceDown = priceFunc(underlyingPrice, strike, T, riskFreeRate, Math.max(0.01, sigma - dSigma));
    const vega = (priceUp - priceDown) / (2 * dSigma);
    
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
  
  // Use numerical differentiation for Bjerksund-Stensland model
  // This provides accurate Greeks for American-style options
  const priceFunc = leg.type === "call" ? blackScholesCall : blackScholesPut;
  const basePrice = priceFunc(S, K, T, r, sigma);
  
  // Delta: dV/dS (central difference)
  const dS = S * 0.01; // 1% of spot price
  const priceUp = priceFunc(S + dS, K, T, r, sigma);
  const priceDown = priceFunc(S - dS, K, T, r, sigma);
  const delta = (priceUp - priceDown) / (2 * dS);
  
  // Gamma: d²V/dS² (central second derivative)
  const gamma = (priceUp - 2 * basePrice + priceDown) / (dS * dS);
  
  // Theta: -dV/dT (forward difference, per day)
  const dT = 1 / 365; // One day
  // Use proper intrinsic value for each option type at expiration
  const intrinsicValue = leg.type === "call" ? Math.max(S - K, 0) : Math.max(K - S, 0);
  const priceTimeDecay = T > dT ? priceFunc(S, K, T - dT, r, sigma) : intrinsicValue;
  const theta = (priceTimeDecay - basePrice); // Already per day
  
  // Vega: dV/dσ (central difference, per 1% vol change)
  const dSigma = 0.01; // 1% change
  const priceVolUp = priceFunc(S, K, T, r, sigma + dSigma);
  const priceVolDown = priceFunc(S, K, T, r, Math.max(0.01, sigma - dSigma));
  const vega = (priceVolUp - priceVolDown) / (2 * dSigma) / 100; // Per 1% vol
  
  // Rho: dV/dr (central difference, per 1% rate change)
  const dR = 0.01; // 1% change
  const priceRateUp = priceFunc(S, K, T, r + dR, sigma);
  const priceRateDown = priceFunc(S, K, T, Math.max(0.001, r - dR), sigma);
  const rho = (priceRateUp - priceRateDown) / (2 * dR) / 100; // Per 1% rate
  
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
    // Use slider volatility for scenario valuation (what-if analysis)
    // This applies to ALL cells including "current" - the heatmap is a what-if tool
    const scenarioVolatility = volatility;
    
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
        scenarioVolatility,
        riskFreeRate
      );
    }
    
    // Normalize premium to always be positive (absolute value)
    const premium = Math.abs(leg.premium);
    
    // Always use premium as baseline - this is the actual cost/credit for the position
    // This ensures:
    // - P/L = 0 when option is worth the same as when position was opened
    // - Max profit for short positions = premium received (can't profit more than credit)
    // - Max loss for long positions = premium paid (can't lose more than debit)
    const baselineValue = premium;
    
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
      // Use baselineValue for proper anchoring so P/L = 0 at entry point
      const remainingPnl = (remainingQty > 0 && !leg.isExcluded)
        ? (leg.position === "long"
            ? (optionValue - baselineValue) * remainingQty * 100
            : (baselineValue - optionValue) * remainingQty * 100)
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
      // Use baselineValue for proper anchoring so P/L = 0 at entry point
      const remainingPnl = (remainingQty > 0 && !leg.isExcluded)
        ? (leg.position === "long"
            ? (optionValue - baselineValue) * remainingQty * 100
            : (baselineValue - optionValue) * remainingQty * 100)
        : 0;
      
      pnl += closedPnl + remainingPnl;
    } else {
      // Skip excluded legs for standard calculation (no closing transactions)
      if (leg.isExcluded) continue;
      
      // Standard calculation for full quantity
      // Use baselineValue for proper anchoring so P/L = 0 at entry point
      const legPnl = leg.position === "long"
        ? (optionValue - baselineValue) * Math.abs(leg.quantity) * 100
        : (baselineValue - optionValue) * Math.abs(leg.quantity) * 100;
      
      pnl += legPnl;
    }
  }
  
  return pnl;
}

export function calculateStrategyMetrics(
  legs: OptionLeg[],
  underlyingPrice: number,
  volatility: number = 0.30
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
  
  // Find max DTE across all legs for time range
  const maxDte = Math.max(...legsWithActivity.map(leg => leg.expirationDays || 0), 1);
  
  // Scan across time AND price to find max profit/loss
  // This ensures consistency with heatmap which shows values at all time points
  const allPnlValues: number[] = [];
  
  // Sample time points: 0 (today), several intermediate points, and expiration
  const timePoints = [0, Math.floor(maxDte / 4), Math.floor(maxDte / 2), Math.floor(maxDte * 3 / 4), maxDte];
  
  for (const daysFromNow of timePoints) {
    for (const price of priceRange) {
      const pnl = calculateProfitLossAtDate(legs, underlyingPrice, price, daysFromNow, volatility);
      allPnlValues.push(pnl);
    }
  }
  
  const maxProfit = Math.max(...allPnlValues);
  const maxLoss = Math.min(...allPnlValues);
  
  // For breakeven, use expiration values (intrinsic-based)
  const pnlValues = priceRange.map(price => calculateProfitLoss(legs, underlyingPrice, price));
  
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
  underlyingPrice: number,
  strategyVolatility: number = 0.30
): { realizedPL: number; unrealizedPL: number; hasRealizedPL: boolean; hasUnrealizedPL: boolean } {
  let realizedPL = 0;
  let unrealizedPL = 0;
  let hasClosingTransactions = false;
  let hasOpenPositionsWithSavedBasis = false;
  
  for (const leg of legs) {
    // For unrealized P/L, we need to compare cost basis to current option price
    // For saved trades: cost basis = leg.premium, current price = market price (or Black-Scholes fallback)
    // For live trades: cost basis = current price (both are leg.premium), so unrealized = 0
    
    const costBasis = Math.abs(leg.premium);
    
    // Use shared helper to get market price, fall back to Black-Scholes only if no market data
    const marketPrice = getLegMarketPrice(leg);
    let currentPrice: number;
    
    if (marketPrice !== undefined) {
      currentPrice = marketPrice;
    } else {
      // Fallback: Calculate theoretical option price using Black-Scholes
      // Only used when no market data is available
      const daysToExpiry = leg.expirationDays || 30;
      const volatility = leg.impliedVolatility || strategyVolatility;
      const riskFreeRate = 0.05;
      
      currentPrice = calculateOptionPrice(
        leg.type as "call" | "put",
        underlyingPrice,
        leg.strike,
        daysToExpiry,
        volatility,
        riskFreeRate
      );
    }
    
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
      
      // Only calculate unrealized if this is a saved trade with preserved cost basis OR manually edited
      if (leg.premiumSource === 'saved' || leg.premiumSource === 'manual') {
        hasOpenPositionsWithSavedBasis = true;
        const legPnl = leg.position === "long"
          ? (currentPrice - costBasis) * Math.abs(leg.quantity) * 100
          : (costBasis - currentPrice) * Math.abs(leg.quantity) * 100;
        unrealizedPL += legPnl;
      }
      // For non-saved trades with market prices, current price = cost basis, so unrealized = 0
    }
  }
  
  return { 
    realizedPL, 
    unrealizedPL, 
    hasRealizedPL: hasClosingTransactions, 
    hasUnrealizedPL: hasOpenPositionsWithSavedBasis 
  };
}
