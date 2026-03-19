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
  const [symbolInfo, setSymbolInfo] = useState<SymbolInfo>(
    { symbol: "AAPL", price: 230 }
  );
  
  const [legs, setLegs] = useState<OptionLeg[]>([]);
  const [hasFetchedInitialPrice, setHasFetchedInitialPrice] = useState(false);
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
      
      // Reset manual IV lock so the new symbol's market IV is used
      setIsManualVolatility(false);
      
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

  const [volatility, setVolatilityInternal] = useState(0.3);
  const [isManualVolatility, setIsManualVolatility] = useState(false);
  const [selectedExpirationDays, setSelectedExpirationDays] = useState<number | null>(null);
  const [selectedExpirationDate, setSelectedExpirationDate] = useState<string>("");
  
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
  


  // Calculate average implied volatility from legs first (needed for auto-sync)
  // Include ALL legs with IV (market, manual, saved) so saved trades use their saved IV
  const calculatedIV = useMemo(() => {
    if (legs.length === 0) {
      console.log('[IV-CALC] No legs, returning default 0.3');
      return 0.3;
    }
    
    // Quantity-weighted average IV (matches OptionStrat behavior)
    // Each leg's IV is weighted by its contract quantity, so a 20x position
    // contributes 20x more to the average than a 1x position
    const MAX_REASONABLE_IV = 2.0; // 200% - allow high IV for deep OTM
    const MIN_REASONABLE_IV = 0.05; // 5% - lower values are likely calculation errors
    
    const legsWithIV = legs.filter(leg => leg.impliedVolatility && leg.impliedVolatility > 0);
    const legsWithReasonableIV = legsWithIV.filter(leg => 
      leg.impliedVolatility! >= MIN_REASONABLE_IV && leg.impliedVolatility! <= MAX_REASONABLE_IV
    );
    
    console.log('[IV-CALC] Legs with IV:', legsWithIV.length, 'of', legs.length, '| Reasonable IV:', legsWithReasonableIV.length);
    legsWithIV.forEach(leg => {
      const isReasonable = leg.impliedVolatility! >= MIN_REASONABLE_IV && leg.impliedVolatility! <= MAX_REASONABLE_IV;
      console.log(`[IV-CALC] Leg ${leg.type} ${leg.strike} x${leg.quantity}: IV=${leg.impliedVolatility} (${(leg.impliedVolatility || 0) * 100}%) source=${leg.premiumSource}${!isReasonable ? ' [FILTERED]' : ''}`);
    });
    
    const legsToUse = legsWithReasonableIV.length > 0 ? legsWithReasonableIV : legsWithIV;
    
    if (legsToUse.length === 0) {
      console.log('[IV-CALC] No legs with IV, returning default 0.3');
      return 0.3;
    }
    
    // Quantity-weighted IV: sum(IV_i * qty_i) / sum(qty_i)
    const totalQty = legsToUse.reduce((sum, leg) => sum + Math.abs(leg.quantity), 0);
    const weightedIV = legsToUse.reduce((sum, leg) => sum + (leg.impliedVolatility || 0.3) * Math.abs(leg.quantity), 0);
    const avgIV = totalQty > 0 ? weightedIV / totalQty : 0.3;
    console.log('[IV-CALC] Quantity-weighted IV:', avgIV, `(${(avgIV * 100).toFixed(1)}%) totalQty=${totalQty}`);
    return avgIV;
  }, [legs]);

  // Debounce timer ref for IV sync — prevents heatmap flickering while user drags a strike
  const ivSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-sync volatility to calculated IV when legs with IV exist
  // Skip if user has manually set volatility (isManualVolatility = true)
  // Debounced: waits 280ms after the last change before applying, so rapid drag
  // events don't re-render the heatmap for every intermediate strike position.
  useEffect(() => {
    // Respect manual volatility setting - don't overwrite user's choice
    if (isManualVolatility) {
      console.log('[IV-SYNC] Skipping auto-sync - manual volatility is locked');
      return;
    }
    
    const legsWithIV = legs.filter(leg => leg.impliedVolatility && leg.impliedVolatility > 0);
    console.log('[IV-SYNC] Effect triggered. Legs with IV:', legsWithIV.length, 'calculatedIV:', calculatedIV, `(${(calculatedIV * 100).toFixed(1)}%)`);

    if (ivSyncTimerRef.current) clearTimeout(ivSyncTimerRef.current);

    if (legsWithIV.length > 0) {
      ivSyncTimerRef.current = setTimeout(() => {
        console.log('[IV-SYNC] Setting volatility to:', calculatedIV);
        setVolatilityInternal(calculatedIV);
      }, 280);
    } else {
      console.log('[IV-SYNC] No legs with IV, skipping sync');
    }

    return () => {
      if (ivSyncTimerRef.current) clearTimeout(ivSyncTimerRef.current);
    };
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
    return calculateStrategyMetrics(legs, symbolInfo.price, volatility, calculatedIV);
  }, [legs, symbolInfo.price, volatility, calculatedIV]);

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

  const nearestExpirationDate = useMemo(() => {
    const activeLegs = legs.filter(leg => {
      if (leg.type === 'stock') return false;
      if (leg.quantity <= 0) return false;
      return true;
    });
    if (activeLegs.length === 0) return null;
    const nearest = activeLegs.reduce((a, b) => a.expirationDays < b.expirationDays ? a : b);
    return nearest.expirationDate?.split('T')[0] || null;
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

    // OptionStrat-style: use the NEAREST active expiration as the primary heatmap target.
    // This focuses on the most relevant near-term P/L. When the nearest leg expires
    // or is fully closed, uniqueExpirationDays drops it, automatically shifting
    // the heatmap to the next remaining expiration.
    const minLegExpiration = Math.min(...uniqueExpirationDays);
    const maxLegExpiration = Math.max(...uniqueExpirationDays);
    const targetDays = minLegExpiration;

    // Detect "fully expired in the past" — distinct from "0DTE today".
    // When ALL option legs have expirationDate strictly before today midnight,
    // the position is settled and we show a single frozen column rather than
    // the intraday 0DTE hourly view which makes no sense for a closed trade.
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const optionLegsForExpCheck = legs.filter(l => l.type !== 'stock');
    const isFullyExpiredPast = optionLegsForExpCheck.length > 0 && optionLegsForExpCheck.every(l => {
      // Only treat as "fully expired past" when we have an explicit expiration date
      // that is strictly before today midnight. Without a date, we cannot distinguish
      // "0DTE today" from "expired yesterday", so we default to NOT expired.
      if (!l.expirationDate) return false;
      return new Date(l.expirationDate.split('T')[0] + 'T00:00:00') < todayMidnight;
    });
    
    // Match OptionStrat: show hourly intervals for options with 7 days or less
    // This gives traders better visibility into theta decay for weekly options
    const useHours = targetDays <= 7 && !isFullyExpiredPast;
    const timeSteps: number[] = [];

    // For fully-expired past trades, skip all time-step generation and return
    // a single frozen column at t=0 (the expiration moment).
    if (isFullyExpiredPast) {
      timeSteps.push(0);
    } else if (useHours) {
      const totalHours = Math.max(0, targetDays * 24);
      
      if (totalHours <= 0) {
        const now = new Date();
        const etFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false });
        const etParts = etFormatter.formatToParts(now);
        const etHour = parseInt(etParts.find(p => p.type === 'hour')?.value || '0');
        const etMin = parseInt(etParts.find(p => p.type === 'minute')?.value || '0');
        const etHours = etHour + etMin / 60;
        
        const etDayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' });
        const etDayStr = etDayFormatter.format(now);
        const isWeekend = etDayStr === 'Sat' || etDayStr === 'Sun';
        
        const marketOpenET = 9.5;
        const marketCloseET = 16;
        const isWithinSession = !isWeekend && etHours >= marketOpenET && etHours < marketCloseET;
        
        const startET = isWithinSession ? etHours : marketOpenET;
        const sessionMinutes = (marketCloseET - startET) * 60;
        const targetColumns = 20;
        const rawInterval = sessionMinutes / targetColumns;
        const intervalMinutes = rawInterval <= 5 ? 5 : rawInterval <= 10 ? 10 : rawInterval <= 15 ? 15 : 20;
        
        const stepCount = Math.floor(sessionMinutes / intervalMinutes);
        for (let i = 0; i <= stepCount; i++) {
          const minutesFromStart = i * intervalMinutes;
          const minutesRemaining = sessionMinutes - minutesFromStart;
          timeSteps.push(minutesRemaining / (24 * 60));
        }
        if (timeSteps.length === 0) timeSteps.push(0);
      } else {
        const now = new Date();
        
        const etFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false, hourCycle: 'h23' });
        const etDayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' });

        const getETComponents = (date: Date) => {
          const parts = etFormatter.formatToParts(date);
          const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
          const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
          const dayParts = etDayFormatter.formatToParts(date);
          const weekday = dayParts.find(p => p.type === 'weekday')?.value || '';
          return { h, m, hours: h + m / 60, weekday };
        };

        const marketOpenET = 9.5;
        const marketCloseET = 16;

        const getNextMarketOpen = (from: Date): Date => {
          let d = new Date(from);
          const { hours: etH, weekday } = getETComponents(d);
          const isWeekend = weekday === 'Sat' || weekday === 'Sun';
          if (!isWeekend && etH < marketCloseET && etH >= marketOpenET) {
            return d;
          }
          if (!isWeekend && etH < marketOpenET) {
            const offsetMs = (marketOpenET - etH) * 3600000;
            return new Date(d.getTime() + offsetMs);
          }
          d = new Date(d);
          const offsetToMidnight = (24 - etH) * 3600000;
          d = new Date(d.getTime() + offsetToMidnight);
          for (let i = 0; i < 7; i++) {
            const comp = getETComponents(d);
            const isWE = comp.weekday === 'Sat' || comp.weekday === 'Sun';
            if (!isWE) {
              const offsetMs = (marketOpenET - comp.hours) * 3600000;
              return new Date(d.getTime() + offsetMs);
            }
            d = new Date(d.getTime() + 24 * 3600000);
          }
          return d;
        };

        const getMarketClose = (openTime: Date): Date => {
          const { hours: etH } = getETComponents(openTime);
          const offsetMs = (marketCloseET - etH) * 3600000;
          return new Date(openTime.getTime() + offsetMs);
        };

        let expirationTime: Date;
        if (nearestExpirationDate) {
          const [ey, em, ed] = nearestExpirationDate.split('-').map(Number);
          const expNoonUTC = new Date(Date.UTC(ey, em - 1, ed, 12, 0, 0));
          const { hours: noonETH } = getETComponents(expNoonUTC);
          const msToMarketClose = (marketCloseET - noonETH) * 3600000;
          expirationTime = new Date(expNoonUTC.getTime() + msToMarketClose);
        } else {
          expirationTime = new Date(now.getTime() + totalHours * 3600000);
        }

        const sessions: Array<{ openMs: number; closeMs: number }> = [];
        let cursor = getNextMarketOpen(now);
        while (cursor.getTime() < expirationTime.getTime()) {
          const close = getMarketClose(cursor);
          const sessionEnd = Math.min(close.getTime(), expirationTime.getTime());
          if (sessionEnd > cursor.getTime()) {
            sessions.push({ openMs: cursor.getTime(), closeMs: sessionEnd });
          }
          const nextDay = new Date(close.getTime() + 1000);
          cursor = getNextMarketOpen(nextDay);
        }
        
        if (sessions.length === 0) {
          timeSteps.push(0);
        } else {
          const slotsPerDay = Math.max(2, Math.min(10, Math.round(20 / sessions.length)));
          for (const session of sessions) {
            const span = session.closeMs - session.openMs;
            for (let s = 0; s < slotsPerDay; s++) {
              const ms = session.openMs + (span * s) / (slotsPerDay - 1);
              timeSteps.push((ms - now.getTime()) / (24 * 3600000));
            }
          }
        }
      }
    } else {
      const today = new Date();
      const dateCount = targetDays <= 7 ? 6 : targetDays <= 14 ? 14 : targetDays <= 30 ? 22 : targetDays <= 60 ? 30 : 36;
      const dayStep = targetDays / (dateCount - 1);
      const candidateSteps: number[] = [];
      for (let i = 0; i < dateCount; i++) {
        candidateSteps.push(Math.max(0, Math.round(i * dayStep)));
      }
      const seen = new Set<number>();
      for (const step of candidateSteps) {
        if (seen.has(step)) continue;
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + step);
        const dayOfWeek = targetDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;
        seen.add(step);
        timeSteps.push(step);
      }
    }

    // Compute date groupings for hour mode
    const dateGroups: Array<{ dateLabel: string; startIdx: number; count: number }> = [];
    if (useHours) {
      const now = new Date();
      let lastDateKey = '';
      
      timeSteps.forEach((daysValue, idx) => {
        let targetTime: Date;
        if (targetDays <= 0) {
          targetTime = now;
        } else {
          targetTime = new Date(now.getTime() + daysValue * 24 * 60 * 60 * 1000);
        }
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
        pnl: calculateProfitLossAtDate(legs, symbolInfo.price, strike, daysFromNow, volatility, 0.05, calculatedIV),
      }))
    );

    return { 
      grid, 
      strikes, 
      days: timeSteps,
      useHours,
      targetDays,
      dateGroups,
      isFullyExpired: isFullyExpiredPast,
    };
  }, [legs, symbolInfo.price, strikeRange, uniqueExpirationDays, nearestExpirationDate, volatility, calculatedIV]);

  const setSelectedExpiration = (days: number, date: string) => {
    setSelectedExpirationDays(days);
    setSelectedExpirationDate(date);
  };

  // Note: Timeline selection is controlled solely by ExpirationTimeline's auto-select effect.
  // The timeline snaps to the nearest valid API date when the current selection is invalid.
  // A separate snap-to-nearest effect in Builder.tsx updates leg expirations to match
  // available dates after symbol changes.

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
    hasFetchedInitialPrice,
  };
}
