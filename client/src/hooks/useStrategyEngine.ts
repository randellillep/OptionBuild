import { useState, useMemo, useEffect, useRef } from "react";
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

export function useStrategyEngine(rangePercent: number = 14) {
  const [symbolInfo, setSymbolInfo] = useState<SymbolInfo>({
    symbol: "AAPL",
    price: 230,
  });
  
  const [legs, setLegs] = useState<OptionLeg[]>([]);
  const [hasFetchedInitialPrice, setHasFetchedInitialPrice] = useState(false);
  const prevSymbolRef = useRef<string>(symbolInfo.symbol);
  
  // Clear closing transactions and exclusions when symbol changes
  useEffect(() => {
    if (prevSymbolRef.current !== symbolInfo.symbol) {
      // Symbol changed - clear all closing transactions and exclusions from legs
      setLegs(currentLegs => 
        currentLegs.map(leg => ({
          ...leg,
          closingTransaction: undefined,
          isExcluded: false,
        }))
      );
      prevSymbolRef.current = symbolInfo.symbol;
    }
  }, [symbolInfo.symbol]);

  useEffect(() => {
    if (!hasFetchedInitialPrice) {
      setHasFetchedInitialPrice(true);
      fetch(`/api/stock/quote/AAPL`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.json();
        })
        .then(data => {
          if (data && data.price && data.price > 0) {
            // Only update if still using default AAPL - avoid overwriting loaded strategies
            setSymbolInfo(prev => {
              if (prev.symbol === "AAPL") {
                return { symbol: "AAPL", price: data.price };
              }
              console.log('[STRATEGY-ENGINE] Skipping AAPL price update - different symbol loaded:', prev.symbol);
              return prev;
            });
          }
        })
        .catch(err => {
          console.error("Failed to fetch initial AAPL price:", err);
        });
    }
  }, [hasFetchedInitialPrice]);

  const [volatility, setVolatility] = useState(0.3);
  const [selectedExpirationDays, setSelectedExpirationDays] = useState<number | null>(null);
  const [selectedExpirationDate, setSelectedExpirationDate] = useState<string>("");

  // Calculate average implied volatility from legs first (needed for auto-sync)
  const calculatedIV = useMemo(() => {
    if (legs.length === 0) {
      console.log('[IV-CALC] No legs, returning default 0.3');
      return 0.3;
    }
    
    // Average the IV from all legs that have real market data (premiumSource === 'market')
    const marketLegs = legs.filter(leg => leg.premiumSource === 'market' && leg.impliedVolatility);
    
    console.log('[IV-CALC] Market legs with IV:', marketLegs.length, 'of', legs.length);
    marketLegs.forEach(leg => {
      console.log(`[IV-CALC] Leg ${leg.type} ${leg.strike}: IV=${leg.impliedVolatility} (${(leg.impliedVolatility || 0) * 100}%)`);
    });
    
    if (marketLegs.length === 0) {
      console.log('[IV-CALC] No market legs with IV, returning default 0.3');
      return 0.3; // Default fallback
    }
    
    const avgIV = marketLegs.reduce((sum, leg) => sum + (leg.impliedVolatility || 0.3), 0) / marketLegs.length;
    console.log('[IV-CALC] Calculated average IV:', avgIV, `(${(avgIV * 100).toFixed(1)}%)`);
    return avgIV;
  }, [legs]);

  // Auto-sync volatility to calculated IV when market legs change
  useEffect(() => {
    const marketLegs = legs.filter(leg => leg.premiumSource === 'market' && leg.impliedVolatility);
    console.log('[IV-SYNC] Effect triggered. Market legs:', marketLegs.length, 'calculatedIV:', calculatedIV, `(${(calculatedIV * 100).toFixed(1)}%)`);
    if (marketLegs.length > 0) {
      console.log('[IV-SYNC] Setting volatility to:', calculatedIV);
      setVolatility(calculatedIV);
    } else {
      console.log('[IV-SYNC] No market legs with IV, skipping sync');
    }
  }, [calculatedIV, legs]);

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
    // Center around current price using the range percent - user has full control
    const rangeMultiplier = rangePercent / 100;
    const min = symbolInfo.price * (1 - rangeMultiplier);
    const max = symbolInfo.price * (1 + rangeMultiplier);
    
    return { min, max };
  }, [symbolInfo.price, rangePercent]);

  const scenarioGrid = useMemo(() => {
    const strikeCount = 15;
    const dateCount = 8;
    
    const strikeStep = (strikeRange.max - strikeRange.min) / (strikeCount - 1);
    const strikes = Array.from({ length: strikeCount }, (_, i) => 
      strikeRange.max - i * strikeStep  // Reverse order: start from max, go down to min
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

    // Compute date groupings for hour mode
    const dateGroups: Array<{ dateLabel: string; startIdx: number; count: number }> = [];
    if (useHours) {
      const now = new Date();
      let lastDateKey = '';
      
      timeSteps.forEach((daysValue, idx) => {
        const totalHours = Math.round(daysValue * 24);
        const targetTime = new Date(now.getTime() + totalHours * 60 * 60 * 1000);
        const dateKey = `${targetTime.getMonth()}-${targetTime.getDate()}`;
        
        if (dateKey !== lastDateKey) {
          // Generate date label
          const month = targetTime.toLocaleString('default', { month: 'short' });
          const day = targetTime.getDate();
          const suffix = day === 1 || day === 21 || day === 31 ? 'st' :
                        day === 2 || day === 22 ? 'nd' :
                        day === 3 || day === 23 ? 'rd' : 'th';
          
          // Start new group
          dateGroups.push({
            dateLabel: `${month} ${day}${suffix}`,
            startIdx: idx,
            count: 1,
          });
          lastDateKey = dateKey;
        } else {
          // Increment count of current group
          if (dateGroups.length > 0) {
            dateGroups[dateGroups.length - 1].count++;
          }
        }
      });
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
      dateGroups,
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
    calculatedIV,
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
