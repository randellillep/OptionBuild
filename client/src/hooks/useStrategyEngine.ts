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
  
  // Symbol change counter - increments whenever symbol changes
  // Used to coordinate between useStrategyEngine and Builder effects
  const [symbolChangeId, setSymbolChangeId] = useState(0);
  
  // Track symbol changes and CLEAR pricing flags from legs
  // This is the key fix: when symbol changes, we must clear costBasisLocked
  // and premiumSource='saved' so fresh prices can be calculated
  useEffect(() => {
    if (prevSymbolRef.current !== symbolInfo.symbol) {
      console.log('[SYMBOL-CHANGE] Detected symbol change:', prevSymbolRef.current, '->', symbolInfo.symbol);
      
      // Don't clear flags if loading a saved trade (user wants to keep saved pricing)
      if (!isLoadingSavedTradeRef.current && legs.length > 0) {
        console.log('[SYMBOL-CHANGE] Clearing pricing flags from', legs.length, 'legs');
        
        // Clear pricing flags so AUTO-ADJUST can set fresh theoretical prices
        setLegs(currentLegs => currentLegs.map(leg => ({
          ...leg,
          costBasisLocked: false,
          premiumSource: undefined, // Clear 'saved' or 'manual' to allow fresh pricing
          closingTransaction: undefined,
          isExcluded: false,
        })));
      }
      
      // Reset the saved trade flag and update the ref
      isLoadingSavedTradeRef.current = false;
      prevSymbolRef.current = symbolInfo.symbol;
      
      // Increment symbol change ID to signal other effects
      setSymbolChangeId(prev => prev + 1);
    }
  }, [symbolInfo.symbol, legs.length]);
  
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
    const activeLegs = legs.filter(leg => {
      if (leg.type === 'stock') return false;
      if (leg.quantity <= 0) return false;
      if (leg.closingTransaction?.isEnabled) {
        const closedQty = (leg.closingTransaction.entries || []).reduce((sum, e) => sum + e.quantity, 0);
        if (closedQty >= leg.quantity) return false;
      }
      return true;
    });
    const days = Array.from(new Set(activeLegs.map(leg => leg.expirationDays))).sort((a, b) => a - b);
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
    
    const strikeStep = (strikeRange.max - strikeRange.min) / (strikeCount - 1);
    const strikes = Array.from({ length: strikeCount }, (_, i) => 
      strikeRange.max - i * strikeStep  // Reverse order: start from max, go down to min
    );

    // For multi-expiration strategies: use the MAXIMUM expiration across all legs
    // This ensures the heatmap shows the full range needed to visualize all positions
    // The P/L calculations use each leg's individual expirationDays
    const maxLegExpiration = Math.max(...uniqueExpirationDays);
    const targetDays = selectedExpirationDays !== null && selectedExpirationDays >= maxLegExpiration
      ? selectedExpirationDays 
      : maxLegExpiration;
    
    // Match OptionStrat: show hourly intervals for options with 7 days or less
    // This gives traders better visibility into theta decay for weekly options
    const useHours = targetDays <= 7;
    const timeSteps: number[] = [];
    
    if (useHours) {
      // OptionStrat-style: show ~3 time slots per day for near-term options
      // This lets traders see intraday P/L movement throughout today and future days
      const actualHours = Math.max(0, targetDays * 24);
      
      if (actualHours <= 0) {
        // Option is expired - show expiration value
        timeSteps.push(0);
      } else {
        // Generate time steps day by day, ~3 columns per day like OptionStrat
        // Ensures TODAY has multiple time slots showing intraday movement
        const now = new Date();
        const currentHour = now.getHours() + now.getMinutes() / 60;
        
        // Hours remaining today (until midnight)
        const hoursLeftToday = 24 - currentHour;
        
        // Generate 3 time slots for TODAY (now, +4h, +8h or until midnight)
        const todaySlots = Math.min(3, Math.ceil(hoursLeftToday / 3));
        const todayHourStep = hoursLeftToday / todaySlots;
        for (let i = 0; i < todaySlots; i++) {
          timeSteps.push((i * todayHourStep) / 24);
        }
        
        // Then add time slots for subsequent days (3 per day: morning, afternoon, evening)
        // Starting from tomorrow morning
        let dayOffset = 1;
        const numDays = Math.ceil(targetDays);
        while (timeSteps.length < 15 && dayOffset <= numDays) {
          // Add 3 time slots per day: ~9am, ~3pm, ~9pm (relative to day start)
          const dailyHours = [9, 15, 21]; // 9am, 3pm, 9pm
          for (const hour of dailyHours) {
            const hoursFromNow = (dayOffset * 24) - currentHour + hour;
            if (hoursFromNow > 0 && hoursFromNow <= actualHours && timeSteps.length < 15) {
              timeSteps.push(hoursFromNow / 24);
            }
          }
          dayOffset++;
        }
        
        // Sort time steps to ensure proper order
        timeSteps.sort((a, b) => a - b);
      }
    } else {
      // For longer-dated options, show daily intervals
      const dateCount = 8;
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
          // Generate OptionStrat-style date label: "26 M", "27 T", "28 w", etc.
          const day = targetTime.getDate();
          const weekdayFull = targetTime.toLocaleString('default', { weekday: 'short' });
          // Get weekday initial: Mon->M, Tue->T, Wed->w, Thu->Th, Fri->F, Sat->Sa, Sun->Su
          const weekdayInitial = weekdayFull === 'Wed' ? 'w' : 
                                  weekdayFull === 'Thu' ? 'Th' : 
                                  weekdayFull === 'Sat' ? 'Sa' : 
                                  weekdayFull === 'Sun' ? 'Su' : 
                                  weekdayFull.charAt(0);
          
          // Start new group
          dateGroups.push({
            dateLabel: `${day} ${weekdayInitial}`,
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

  // Auto-snap selected expiration to nearest active leg when current selection
  // doesn't match any active leg (e.g. after removing a leg)
  useEffect(() => {
    if (uniqueExpirationDays.length === 0) return;
    if (selectedExpirationDays !== null && uniqueExpirationDays.includes(selectedExpirationDays)) return;
    
    // Find the active leg whose expirationDays matches the first unique day
    const targetDays = uniqueExpirationDays[0];
    const matchingLeg = legs.find(l => l.type !== 'stock' && l.expirationDays === targetDays && l.expirationDate);
    if (matchingLeg && matchingLeg.expirationDate) {
      setSelectedExpirationDays(targetDays);
      setSelectedExpirationDate(matchingLeg.expirationDate);
    }
  }, [uniqueExpirationDays, selectedExpirationDays, legs]);

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
    symbolChangeId, // Used to coordinate effects after symbol changes
  };
}
