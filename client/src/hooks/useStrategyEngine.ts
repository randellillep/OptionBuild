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
  
  const [legs, setLegs] = useState<OptionLeg[]>([]);

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
    // Use fixed buffer based on price to prevent bar shifting during drag
    const buffer = symbolInfo.price * 0.15;
    
    return {
      min: Math.max(minStrike - buffer, symbolInfo.price * 0.7),
      max: Math.max(maxStrike + buffer, symbolInfo.price * 1.3),
    };
  }, [legs, symbolInfo.price]);

  const scenarioGrid = useMemo(() => {
    const strikeCount = 15;
    const dateCount = 8;
    
    const strikeStep = (strikeRange.max - strikeRange.min) / (strikeCount - 1);
    const strikes = Array.from({ length: strikeCount }, (_, i) => 
      strikeRange.min + i * strikeStep
    );

    // Use selected expiration if available, otherwise fall back to max from legs
    const targetDays = selectedExpirationDays !== null 
      ? selectedExpirationDays 
      : Math.max(...uniqueExpirationDays);
    
    // If expiration is very near (< 3 days), show hours instead of days
    const useHours = targetDays < 3;
    const timeSteps: number[] = [];
    
    if (useHours) {
      // Generate hourly intervals up to expiration
      const totalHours = targetDays * 24;
      const hourStep = totalHours / (dateCount - 1);
      for (let i = 0; i < dateCount; i++) {
        const hours = Math.round(i * hourStep);
        timeSteps.push(hours / 24); // Convert back to fractional days for calculations
      }
    } else {
      // Generate day intervals
      const dayStep = targetDays / (dateCount - 1);
      for (let i = 0; i < dateCount; i++) {
        timeSteps.push(Math.max(0, Math.round(i * dayStep)));
      }
    }

    const grid: ScenarioPoint[][] = strikes.map(strike => 
      timeSteps.map(daysLeft => ({
        strike,
        daysToExpiration: daysLeft,
        pnl: calculateProfitLossAtDate(legs, symbolInfo.price, strike, daysLeft, volatility),
      }))
    );

    return { 
      grid, 
      strikes, 
      days: timeSteps,
      useHours,
      targetDays,
    };
  }, [legs, symbolInfo.price, strikeRange, uniqueExpirationDays, volatility, selectedExpirationDays]);

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
