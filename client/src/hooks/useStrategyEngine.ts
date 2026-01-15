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

// Key for localStorage persistence
const STRATEGY_STORAGE_KEY = 'currentStrategy';

// Load initial state from localStorage if available
const loadPersistedState = (): { symbolInfo: SymbolInfo; legs: OptionLeg[]; volatility: number; isManualVolatility: boolean; expirationDays: number | null; expirationDate: string } | null => {
  try {
    const saved = localStorage.getItem(STRATEGY_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.symbolInfo && Array.isArray(parsed.legs)) {
        return parsed;
      }
    }
  } catch {
    // Silent fail
  }
  return null;
};

export function useStrategyEngine(rangePercent: number = 14) {
  // Try to restore from localStorage on initial load
  const persistedState = useRef(loadPersistedState());
  
  const [symbolInfo, setSymbolInfo] = useState<SymbolInfo>(
    persistedState.current?.symbolInfo ?? { symbol: "AAPL", price: 230 }
  );
  
  const [legs, setLegs] = useState<OptionLeg[]>(persistedState.current?.legs ?? []);
  const [hasFetchedInitialPrice, setHasFetchedInitialPrice] = useState(!!persistedState.current);
  const prevSymbolRef = useRef<string>(symbolInfo.symbol);
  const isLoadingSavedTradeRef = useRef<boolean>(false);
  
  // Clear closing transactions and exclusions when symbol changes via user action (not when loading saved trade)
  useEffect(() => {
    if (prevSymbolRef.current !== symbolInfo.symbol) {
      // Skip clearing if we're loading a saved trade - we want to preserve the saved data
      if (!isLoadingSavedTradeRef.current) {
        // Symbol changed via user action - clear all closing transactions and exclusions from legs
        setLegs(currentLegs => 
          currentLegs.map(leg => ({
            ...leg,
            closingTransaction: undefined,
            isExcluded: false,
          }))
        );
      }
      isLoadingSavedTradeRef.current = false; // Reset the flag after the check
      prevSymbolRef.current = symbolInfo.symbol;
    }
  }, [symbolInfo.symbol]);
  
  // Wrapper to set symbol when loading saved trades (skips clearing)
  const setSymbolInfoForSavedTrade = (info: SymbolInfo) => {
    isLoadingSavedTradeRef.current = true;
    setSymbolInfo(info);
  };

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

  // Poll for price updates every 10 seconds for live heatmap updates
  useEffect(() => {
    if (!symbolInfo.symbol) return;
    
    const pollPrice = async () => {
      try {
        const res = await fetch(`/api/stock/quote/${symbolInfo.symbol}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.price && data.price > 0) {
          setSymbolInfo(prev => {
            // Only update if price actually changed (avoid unnecessary re-renders)
            if (prev.price !== data.price) {
              console.log('[PRICE-POLL] Updated price:', prev.price, '->', data.price);
              return { ...prev, price: data.price };
            }
            return prev;
          });
        }
      } catch (err) {
        console.error('[PRICE-POLL] Failed to fetch price:', err);
      }
    };
    
    // Poll every 10 seconds
    const intervalId = setInterval(pollPrice, 10000);
    
    return () => clearInterval(intervalId);
  }, [symbolInfo.symbol]);

  const [volatility, setVolatilityInternal] = useState(persistedState.current?.volatility ?? 0.3);
  const [isManualVolatility, setIsManualVolatility] = useState(persistedState.current?.isManualVolatility ?? false);
  const [selectedExpirationDays, setSelectedExpirationDays] = useState<number | null>(persistedState.current?.expirationDays ?? null);
  const [selectedExpirationDate, setSelectedExpirationDate] = useState<string>(persistedState.current?.expirationDate ?? "");
  
  // Set volatility without triggering manual lock (for internal/system use)
  const setVolatility = (value: number) => {
    setVolatilityInternal(value);
  };
  
  // Set volatility with manual lock (for user slider interactions only)
  const setVolatilityManual = (value: number) => {
    setVolatilityInternal(value);
    setIsManualVolatility(true);
    console.log('[IV-MANUAL] User set manual IV:', value, `(${(value * 100).toFixed(1)}%)`);
  };
  
  // Persist strategy state to localStorage whenever it changes
  useEffect(() => {
    const stateToSave = {
      symbolInfo,
      legs,
      volatility,
      isManualVolatility,
      expirationDays: selectedExpirationDays,
      expirationDate: selectedExpirationDate,
    };
    localStorage.setItem(STRATEGY_STORAGE_KEY, JSON.stringify(stateToSave));
  }, [symbolInfo, legs, volatility, isManualVolatility, selectedExpirationDays, selectedExpirationDate]);

  // Calculate average implied volatility from legs first (needed for auto-sync)
  // Include ALL legs with IV (market, manual, saved) so saved trades use their saved IV
  const calculatedIV = useMemo(() => {
    if (legs.length === 0) {
      console.log('[IV-CALC] No legs, returning default 0.3');
      return 0.3;
    }
    
    // Average the IV from ALL legs that have impliedVolatility set
    // This includes market, manual, and saved legs
    // Filter out extreme IV values (>100%) which occur with deep ITM options
    const MAX_REASONABLE_IV = 1.0; // 100% - higher values are likely calculation errors
    const MIN_REASONABLE_IV = 0.05; // 5% - lower values are likely calculation errors
    
    const legsWithIV = legs.filter(leg => leg.impliedVolatility && leg.impliedVolatility > 0);
    const legsWithReasonableIV = legsWithIV.filter(leg => 
      leg.impliedVolatility! >= MIN_REASONABLE_IV && leg.impliedVolatility! <= MAX_REASONABLE_IV
    );
    
    console.log('[IV-CALC] Legs with IV:', legsWithIV.length, 'of', legs.length, '| Reasonable IV:', legsWithReasonableIV.length);
    legsWithIV.forEach(leg => {
      const isReasonable = leg.impliedVolatility! >= MIN_REASONABLE_IV && leg.impliedVolatility! <= MAX_REASONABLE_IV;
      console.log(`[IV-CALC] Leg ${leg.type} ${leg.strike}: IV=${leg.impliedVolatility} (${(leg.impliedVolatility || 0) * 100}%) source=${leg.premiumSource}${!isReasonable ? ' [FILTERED]' : ''}`);
    });
    
    // Use legs with reasonable IV, fallback to all legs if none are reasonable
    const legsToUse = legsWithReasonableIV.length > 0 ? legsWithReasonableIV : legsWithIV;
    
    if (legsToUse.length === 0) {
      console.log('[IV-CALC] No legs with IV, returning default 0.3');
      return 0.3; // Default fallback
    }
    
    const avgIV = legsToUse.reduce((sum, leg) => sum + (leg.impliedVolatility || 0.3), 0) / legsToUse.length;
    console.log('[IV-CALC] Calculated average IV:', avgIV, `(${(avgIV * 100).toFixed(1)}%)`);
    return avgIV;
  }, [legs]);

  // Auto-sync volatility to calculated IV when legs with IV exist
  // Skip if user has manually set volatility (isManualVolatility = true)
  useEffect(() => {
    // Respect manual volatility setting - don't overwrite user's choice
    if (isManualVolatility) {
      console.log('[IV-SYNC] Skipping auto-sync - manual volatility is locked');
      return;
    }
    
    const legsWithIV = legs.filter(leg => leg.impliedVolatility && leg.impliedVolatility > 0);
    console.log('[IV-SYNC] Effect triggered. Legs with IV:', legsWithIV.length, 'calculatedIV:', calculatedIV, `(${(calculatedIV * 100).toFixed(1)}%)`);
    if (legsWithIV.length > 0) {
      console.log('[IV-SYNC] Setting volatility to:', calculatedIV);
      setVolatilityInternal(calculatedIV);
    } else {
      console.log('[IV-SYNC] No legs with IV, skipping sync');
    }
  }, [calculatedIV, legs, isManualVolatility]);
  
  // Reset to market IV (clears manual lock)
  const resetToMarketIV = () => {
    setIsManualVolatility(false);
    setVolatilityInternal(calculatedIV);
    console.log('[IV-RESET] Reset to market IV:', calculatedIV, `(${(calculatedIV * 100).toFixed(1)}%)`);
  };

  const totalGreeks: Greeks = useMemo(() => {
    return legs.reduce(
      (acc, leg) => {
        // Use each leg's own implied volatility for accurate per-leg Greeks
        // This ensures Greeks tab matches the strike ladder display
        const legIV = leg.impliedVolatility && leg.impliedVolatility > 0 
          ? leg.impliedVolatility 
          : volatility;
        const legGreeks = calculateGreeks(leg, symbolInfo.price, legIV);
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
    return calculateStrategyMetrics(legs, symbolInfo.price, volatility);
  }, [legs, symbolInfo.price, volatility]);

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
      // For same-day or very short-dated options, show hourly intervals
      // Use actual remaining hours - show progression from now to expiration
      const actualHours = Math.max(0, targetDays * 24);
      
      if (actualHours <= 0) {
        // Option is expired - all columns show intrinsic value at expiration
        // Use exactly 0 for all time steps so P/L shows pure intrinsic value
        for (let i = 0; i < dateCount; i++) {
          timeSteps.push(0); // All at expiration - intrinsic value only
        }
      } else {
        // Normal case: show time decay from now (0) to expiration (actualHours)
        // Each column represents a step closer to expiration
        const hourStep = actualHours / (dateCount - 1);
        for (let i = 0; i < dateCount; i++) {
          const hoursFromNow = i * hourStep;
          timeSteps.push(hoursFromNow / 24); // Convert to fractional days for calculations
        }
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

    // Build the P/L grid for heatmap visualization
    // Time steps represent "days from now" - how much time will pass
    // With fractional DTE from leg.expirationDays, this shows proper theta decay
    // Shows full position P/L values (not normalized) to match OptionStrat
    const grid: ScenarioPoint[][] = strikes.map(strike => 
      timeSteps.map(daysFromNow => ({
        strike,
        daysToExpiration: daysFromNow,
        pnl: calculateProfitLossAtDate(legs, symbolInfo.price, strike, daysFromNow, volatility),
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
    setSymbolInfoForSavedTrade,
    legs,
    setLegs,
    volatility,
    setVolatility,
    setVolatilityManual,
    isManualVolatility,
    resetToMarketIV,
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
