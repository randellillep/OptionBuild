import type { Strategy } from "@shared/schema";

export type StrategyCategory = "basic" | "credit_spreads" | "debit_spreads" | "volatility" | "neutral";
export type StrategySentiment = "very_bearish" | "bearish" | "neutral" | "directional" | "bullish" | "very_bullish";
export type RiskLevel = "limited" | "unlimited" | "capped";

export interface StrategyMetadata {
  category: StrategyCategory;
  sentiment: StrategySentiment[];
  tags: string[];
  riskLevel: RiskLevel;
  profitPotential: RiskLevel;
  maxProfit: string;
  maxLoss: string;
  breakeven: string;
}

export interface ExtendedStrategy extends Omit<Strategy, "id" | "underlyingPrice"> {
  metadata: StrategyMetadata;
}

export const categoryLabels: Record<StrategyCategory, string> = {
  basic: "Basic",
  credit_spreads: "Credit Spreads",
  debit_spreads: "Debit Spreads",
  volatility: "Volatility",
  neutral: "Neutral",
};

export const sentimentLabels: Record<StrategySentiment, string> = {
  very_bearish: "Very Bearish",
  bearish: "Bearish",
  neutral: "Neutral",
  directional: "Directional",
  bullish: "Bullish",
  very_bullish: "Very Bullish",
};

export const strategyTemplates: ExtendedStrategy[] = [
  {
    name: "Long Call",
    description: "A basic bullish strategy for beginners with potential for significant returns involves buying a call option. This option grants the right, not the obligation, to purchase a stock at a predetermined price. You can profit by trading the call before it expires, capitalizing on price fluctuations. The option's value decreases over time and reacts to volatility shifts.",
    legs: [
      {
        id: "1",
        type: "call",
        position: "long",
        strike: 105,
        quantity: 1,
        premium: 3.5,
        expirationDays: 30,
      },
    ],
    metadata: {
      category: "basic",
      sentiment: ["bullish", "very_bullish"],
      tags: ["Bullish", "Limited Loss", "Unlimited Profit"],
      riskLevel: "limited",
      profitPotential: "unlimited",
      maxProfit: "Unlimited",
      maxLoss: "Premium Paid",
      breakeven: "Strike + Premium",
    },
  },
  {
    name: "Long Put",
    description: "A bearish strategy where you buy a put option expecting the underlying asset to decrease in value. You have the right to sell the asset at the strike price. Your maximum loss is limited to the premium paid, while profit potential is substantial if the stock drops significantly.",
    legs: [
      {
        id: "1",
        type: "put",
        position: "long",
        strike: 95,
        quantity: 1,
        premium: 3.0,
        expirationDays: 30,
      },
    ],
    metadata: {
      category: "basic",
      sentiment: ["bearish", "very_bearish"],
      tags: ["Bearish", "Limited Loss", "High Profit"],
      riskLevel: "limited",
      profitPotential: "capped",
      maxProfit: "Strike - Premium (if stock goes to $0)",
      maxLoss: "Premium Paid",
      breakeven: "Strike - Premium",
    },
  },
  {
    name: "Short Call",
    description: "Sell a call option to collect premium income. You are obligated to sell shares at the strike price if assigned. Best used when you expect the stock to stay flat or decline. Risk is unlimited if the stock rises significantly.",
    legs: [
      {
        id: "1",
        type: "call",
        position: "short",
        strike: 110,
        quantity: 1,
        premium: 2.5,
        expirationDays: 30,
      },
    ],
    metadata: {
      category: "basic",
      sentiment: ["bearish", "neutral"],
      tags: ["Bearish", "Income", "Unlimited Risk"],
      riskLevel: "unlimited",
      profitPotential: "limited",
      maxProfit: "Premium Received",
      maxLoss: "Unlimited",
      breakeven: "Strike + Premium",
    },
  },
  {
    name: "Short Put",
    description: "Sell a put option to collect premium. You are obligated to buy shares at the strike price if assigned. This is a bullish to neutral strategy that profits when the stock stays above the strike price.",
    legs: [
      {
        id: "1",
        type: "put",
        position: "short",
        strike: 95,
        quantity: 1,
        premium: 2.5,
        expirationDays: 30,
      },
    ],
    metadata: {
      category: "basic",
      sentiment: ["bullish", "neutral"],
      tags: ["Bullish", "Income", "Limited Profit"],
      riskLevel: "capped",
      profitPotential: "limited",
      maxProfit: "Premium Received",
      maxLoss: "Strike - Premium (if stock goes to $0)",
      breakeven: "Strike - Premium",
    },
  },
  {
    name: "Bull Call Spread",
    description: "Buy a call at a lower strike and sell a call at a higher strike. This reduces the cost of entry compared to a simple long call. Both profit and loss are limited. A moderately bullish strategy.",
    legs: [
      {
        id: "1",
        type: "call",
        position: "long",
        strike: 100,
        quantity: 1,
        premium: 5.0,
        expirationDays: 30,
      },
      {
        id: "2",
        type: "call",
        position: "short",
        strike: 110,
        quantity: 1,
        premium: 2.0,
        expirationDays: 30,
      },
    ],
    metadata: {
      category: "debit_spreads",
      sentiment: ["bullish"],
      tags: ["Bullish", "Limited Profit", "Limited Loss"],
      riskLevel: "limited",
      profitPotential: "limited",
      maxProfit: "Width of Strikes - Net Debit",
      maxLoss: "Net Debit Paid",
      breakeven: "Long Strike + Net Debit",
    },
  },
  {
    name: "Bear Put Spread",
    description: "Buy a put at a higher strike and sell a put at a lower strike. This is a moderately bearish strategy with limited risk and limited reward. Reduces cost compared to buying a put outright.",
    legs: [
      {
        id: "1",
        type: "put",
        position: "long",
        strike: 100,
        quantity: 1,
        premium: 5.0,
        expirationDays: 30,
      },
      {
        id: "2",
        type: "put",
        position: "short",
        strike: 90,
        quantity: 1,
        premium: 2.0,
        expirationDays: 30,
      },
    ],
    metadata: {
      category: "debit_spreads",
      sentiment: ["bearish"],
      tags: ["Bearish", "Limited Profit", "Limited Loss"],
      riskLevel: "limited",
      profitPotential: "limited",
      maxProfit: "Width of Strikes - Net Debit",
      maxLoss: "Net Debit Paid",
      breakeven: "Long Strike - Net Debit",
    },
  },
  {
    name: "Bull Put Spread",
    description: "Sell a put at a higher strike and buy a put at a lower strike. Collect a net credit upfront. Profit when stock stays above the short strike. A credit spread with limited risk.",
    legs: [
      {
        id: "1",
        type: "put",
        position: "short",
        strike: 100,
        quantity: 1,
        premium: 4.0,
        expirationDays: 30,
      },
      {
        id: "2",
        type: "put",
        position: "long",
        strike: 90,
        quantity: 1,
        premium: 1.5,
        expirationDays: 30,
      },
    ],
    metadata: {
      category: "credit_spreads",
      sentiment: ["bullish", "neutral"],
      tags: ["Bullish", "Limited Profit", "Limited Loss"],
      riskLevel: "limited",
      profitPotential: "limited",
      maxProfit: "Net Credit Received",
      maxLoss: "Width of Strikes - Net Credit",
      breakeven: "Short Strike - Net Credit",
    },
  },
  {
    name: "Bear Call Spread",
    description: "Sell a call at a lower strike and buy a call at a higher strike. Collect a net credit. Profit when stock stays below the short strike. A bearish credit spread strategy.",
    legs: [
      {
        id: "1",
        type: "call",
        position: "short",
        strike: 100,
        quantity: 1,
        premium: 4.0,
        expirationDays: 30,
      },
      {
        id: "2",
        type: "call",
        position: "long",
        strike: 110,
        quantity: 1,
        premium: 1.5,
        expirationDays: 30,
      },
    ],
    metadata: {
      category: "credit_spreads",
      sentiment: ["bearish", "neutral"],
      tags: ["Bearish", "Limited Profit", "Limited Loss"],
      riskLevel: "limited",
      profitPotential: "limited",
      maxProfit: "Net Credit Received",
      maxLoss: "Width of Strikes - Net Credit",
      breakeven: "Short Strike + Net Credit",
    },
  },
  {
    name: "Long Straddle",
    description: "Buy both a call and put at the same strike price. Profit from large price moves in either direction. Maximum loss is limited to total premium paid. Best for high volatility events.",
    legs: [
      {
        id: "1",
        type: "call",
        position: "long",
        strike: 100,
        quantity: 1,
        premium: 5.0,
        expirationDays: 30,
      },
      {
        id: "2",
        type: "put",
        position: "long",
        strike: 100,
        quantity: 1,
        premium: 4.8,
        expirationDays: 30,
      },
    ],
    metadata: {
      category: "volatility",
      sentiment: ["directional"],
      tags: ["Volatility", "Limited Loss", "Unlimited Profit"],
      riskLevel: "limited",
      profitPotential: "unlimited",
      maxProfit: "Unlimited",
      maxLoss: "Total Premium Paid",
      breakeven: "Strike ± Total Premium",
    },
  },
  {
    name: "Long Strangle",
    description: "Buy an OTM call and an OTM put. Lower cost than a straddle but requires larger price movement to profit. Ideal when expecting significant volatility but unsure of direction.",
    legs: [
      {
        id: "1",
        type: "call",
        position: "long",
        strike: 110,
        quantity: 1,
        premium: 2.5,
        expirationDays: 30,
      },
      {
        id: "2",
        type: "put",
        position: "long",
        strike: 90,
        quantity: 1,
        premium: 2.3,
        expirationDays: 30,
      },
    ],
    metadata: {
      category: "volatility",
      sentiment: ["directional"],
      tags: ["Volatility", "Limited Loss", "High Profit"],
      riskLevel: "limited",
      profitPotential: "unlimited",
      maxProfit: "Unlimited",
      maxLoss: "Total Premium Paid",
      breakeven: "Call Strike + Premium / Put Strike - Premium",
    },
  },
  {
    name: "Short Strangle/Straddle",
    description: "Sell both an OTM call and put to collect premium. Profit when stock stays within a range. Maximum profit is premium received. Risk is unlimited if stock moves significantly.",
    legs: [
      {
        id: "1",
        type: "call",
        position: "short",
        strike: 110,
        quantity: 1,
        premium: 2.5,
        expirationDays: 30,
      },
      {
        id: "2",
        type: "put",
        position: "short",
        strike: 90,
        quantity: 1,
        premium: 2.3,
        expirationDays: 30,
      },
    ],
    metadata: {
      category: "neutral",
      sentiment: ["neutral"],
      tags: ["Neutral", "Income", "Unlimited Risk"],
      riskLevel: "unlimited",
      profitPotential: "limited",
      maxProfit: "Total Premium Received",
      maxLoss: "Unlimited",
      breakeven: "Call Strike + Premium / Put Strike - Premium",
    },
  },
  {
    name: "Iron Condor",
    description: "Sell an OTM put spread and call spread. Collect premium from both sides. Profit when stock stays in a range. All risk and reward are defined and limited.",
    legs: [
      {
        id: "1",
        type: "put",
        position: "short",
        strike: 95,
        quantity: 1,
        premium: 2.0,
        expirationDays: 30,
      },
      {
        id: "2",
        type: "put",
        position: "long",
        strike: 90,
        quantity: 1,
        premium: 1.0,
        expirationDays: 30,
      },
      {
        id: "3",
        type: "call",
        position: "short",
        strike: 105,
        quantity: 1,
        premium: 2.0,
        expirationDays: 30,
      },
      {
        id: "4",
        type: "call",
        position: "long",
        strike: 110,
        quantity: 1,
        premium: 1.0,
        expirationDays: 30,
      },
    ],
    metadata: {
      category: "neutral",
      sentiment: ["neutral"],
      tags: ["Neutral", "Limited Profit", "Limited Loss"],
      riskLevel: "limited",
      profitPotential: "limited",
      maxProfit: "Net Credit Received",
      maxLoss: "Width of Widest Spread - Net Credit",
      breakeven: "Short Strikes ± Net Credit",
    },
  },
  {
    name: "Butterfly Spread",
    description: "Buy 1 ITM option, sell 2 ATM options, buy 1 OTM option. Profit when stock closes at middle strike. Low cost with limited risk and limited profit potential.",
    legs: [
      {
        id: "1",
        type: "call",
        position: "long",
        strike: 95,
        quantity: 1,
        premium: 7.0,
        expirationDays: 30,
      },
      {
        id: "2",
        type: "call",
        position: "short",
        strike: 100,
        quantity: 2,
        premium: 5.0,
        expirationDays: 30,
      },
      {
        id: "3",
        type: "call",
        position: "long",
        strike: 105,
        quantity: 1,
        premium: 3.5,
        expirationDays: 30,
      },
    ],
    metadata: {
      category: "neutral",
      sentiment: ["neutral"],
      tags: ["Neutral", "Limited Profit", "Limited Loss"],
      riskLevel: "limited",
      profitPotential: "limited",
      maxProfit: "Width of Wing - Net Debit",
      maxLoss: "Net Debit Paid",
      breakeven: "Lower Strike + Debit / Upper Strike - Debit",
    },
  },
  {
    name: "Covered Call",
    description: "Own 100 shares and sell a call against them. Generate income while capping upside. If the stock rises above strike, you sell your shares at the strike price.",
    legs: [
      {
        id: "1",
        type: "call",
        position: "short",
        strike: 110,
        quantity: 1,
        premium: 2.5,
        expirationDays: 30,
      },
    ],
    metadata: {
      category: "basic",
      sentiment: ["neutral", "bullish"],
      tags: ["Income", "Limited Profit", "Stock Required"],
      riskLevel: "capped",
      profitPotential: "limited",
      maxProfit: "Premium + (Strike - Stock Price)",
      maxLoss: "Stock Price - Premium (if stock goes to $0)",
      breakeven: "Stock Price - Premium",
    },
  },
  {
    name: "Protective Put",
    description: "Own 100 shares and buy a put for protection. Insurance against downside while keeping upside potential. The put acts as a floor for your stock position.",
    legs: [
      {
        id: "1",
        type: "put",
        position: "long",
        strike: 95,
        quantity: 1,
        premium: 3.0,
        expirationDays: 30,
      },
    ],
    metadata: {
      category: "basic",
      sentiment: ["bullish"],
      tags: ["Protection", "Limited Loss", "Stock Required"],
      riskLevel: "limited",
      profitPotential: "unlimited",
      maxProfit: "Unlimited (stock upside)",
      maxLoss: "Stock Price - Strike + Premium",
      breakeven: "Stock Price + Premium",
    },
  },
  {
    name: "Cash-Secured Put",
    description: "Sell a put while holding enough cash to buy shares if assigned. Collect premium income. If assigned, you buy shares at a discount to current price.",
    legs: [
      {
        id: "1",
        type: "put",
        position: "short",
        strike: 95,
        quantity: 1,
        premium: 3.0,
        expirationDays: 30,
      },
    ],
    metadata: {
      category: "basic",
      sentiment: ["bullish", "neutral"],
      tags: ["Income", "Cash Required", "Limited Profit"],
      riskLevel: "capped",
      profitPotential: "limited",
      maxProfit: "Premium Received",
      maxLoss: "Strike - Premium (if stock goes to $0)",
      breakeven: "Strike - Premium",
    },
  },
];

// Helper function to get strategies by category
export function getStrategiesByCategory(category: StrategyCategory): ExtendedStrategy[] {
  return strategyTemplates.filter((s) => s.metadata.category === category);
}

// Helper function to get strategies by sentiment
export function getStrategiesBySentiment(sentiment: StrategySentiment): ExtendedStrategy[] {
  return strategyTemplates.filter((s) => s.metadata.sentiment.includes(sentiment));
}
