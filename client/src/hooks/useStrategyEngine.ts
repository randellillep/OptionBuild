import { useState, useMemo } from "react";
import type { OptionLeg, Greeks, StrategyMetrics } from "@shared/schema";
import { calculateGreeks, calculateStrategyMetrics, calculateProfitLoss, calculateProfitLossAtDate } from "@/lib/options-pricing";

export interface SymbolInfo {
  symbol: string;
  price: number;
}

export interface ScenarioPoint {
  strike: number;
  daysToExpiration: number;
  pnl: number;
}

export function useStrategyEngine() {
  const [symbolInfo, setSymbolInfo] = useState<SymbolInfo>({
    symbol: "SPY",
    price: 100,
  });
  
  const [legs, setLegs] = useState<OptionLeg[]>([
    {
      id: "1",
      type: "call",
      position: "long",
      strike: 105,
      quantity: 1,
      premium: 3.5,
      expirationDays: 30,
    },
  ]);

  const [volatility, setVolatility] = useState(0.3);
  const [selectedExpirationDays, setSelectedExpirationDays] = useState<number | null>(null);
  const [selectedExpirationDate, setSelectedExpirationDate] = useState<string>("");

  const totalGreeks: Greeks = useMemo(() => {
    return legs.reduce(
      (acc, leg) => {
        const legGreeks = calculateGreeks(leg, symbolInfo.price, volatility);
        return {
          delta: acc.delta + legGreeks.delta,
          gamma: acc.gamma + legGreeks.gamma,
          theta: acc.theta + legGreeks.theta,
          vega: acc.vega + legGreeks.vega,
          rho: acc.rho + legGreeks.rho,
        };
      },
      { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 }
    );
  }, [legs, symbolInfo.price, volatility]);

  const metrics: StrategyMetrics = useMemo(() => {
    return calculateStrategyMetrics(legs, symbolInfo.price);
  }, [legs, symbolInfo.price]);

  const uniqueExpirationDays = useMemo(() => {
    const days = Array.from(new Set(legs.map(leg => leg.expirationDays))).sort((a, b) => a - b);
    return days.length > 0 ? days : [30];
  }, [legs]);

  const strikeRange = useMemo(() => {
    if (legs.length === 0) {
      return {
        min: symbolInfo.price * 0.85,
        max: symbolInfo.price * 1.15,
      };
    }
    
    const strikes = legs.map(leg => leg.strike);
    const minStrike = Math.min(...strikes);
    const maxStrike = Math.max(...strikes);
    const buffer = (maxStrike - minStrike) * 0.2 || symbolInfo.price * 0.1;
    
    return {
      min: Math.max(minStrike - buffer, symbolInfo.price * 0.7),
      max: maxStrike + buffer,
    };
  }, [legs, symbolInfo.price]);

  const scenarioGrid = useMemo(() => {
    const strikeCount = 15;
    const dateCount = 8;
    
    const strikeStep = (strikeRange.max - strikeRange.min) / (strikeCount - 1);
    const strikes = Array.from({ length: strikeCount }, (_, i) => 
      strikeRange.min + i * strikeStep
    );

    const maxDays = Math.max(...uniqueExpirationDays);
    const dayStep = maxDays / (dateCount - 1);
    const days = Array.from({ length: dateCount }, (_, i) => 
      Math.max(0, Math.round(i * dayStep))
    );

    const grid: ScenarioPoint[][] = strikes.map(strike => 
      days.map(daysLeft => ({
        strike,
        daysToExpiration: daysLeft,
        pnl: calculateProfitLossAtDate(legs, symbolInfo.price, strike, daysLeft, volatility),
      }))
    );

    return { grid, strikes, days };
  }, [legs, symbolInfo.price, strikeRange, uniqueExpirationDays, volatility]);

  const setSelectedExpiration = (days: number, date: string) => {
    setSelectedExpirationDays(days);
    setSelectedExpirationDate(date);
  };

  return {
    symbolInfo,
    setSymbolInfo,
    legs,
    setLegs,
    volatility,
    setVolatility,
    totalGreeks,
    metrics,
    uniqueExpirationDays,
    strikeRange,
    scenarioGrid,
    selectedExpirationDays,
    selectedExpirationDate,
    setSelectedExpiration,
  };
}
