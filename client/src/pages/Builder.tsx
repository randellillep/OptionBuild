import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfitLossChart } from "@/components/ProfitLossChart";
import { TradingViewSearch } from "@/components/TradingViewSearch";
import { ExpirationTimeline } from "@/components/ExpirationTimeline";
import { StrikeLadder } from "@/components/StrikeLadder";
import { PLHeatmap } from "@/components/PLHeatmap";
import { AddLegDropdown } from "@/components/AddLegDropdown";
import { AnalysisTabs } from "@/components/AnalysisTabs";
import { Footer } from "@/components/Footer";
import { TrendingUp, ChevronDown, BookOpen, FileText, User, LogOut, BarChart3, Bookmark, Search } from "lucide-react";
import { AIChatAssistant } from "@/components/AIChatAssistant";
import { SaveTradeModal } from "@/components/SaveTradeModal";
import { StrategySelector } from "@/components/StrategySelector";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { OptionLeg } from "@shared/schema";
import type { CommissionSettings } from "@/components/PositionsModal";
import { strategyTemplates } from "@/lib/strategy-templates";
import { useLocation, useSearch } from "wouter";
import { useStrategyEngine } from "@/hooks/useStrategyEngine";
import { useOptionsChain } from "@/hooks/useOptionsChain";
import { calculateImpliedVolatility, calculateOptionPrice, calculateRealizedUnrealizedPL } from "@/lib/options-pricing";
import { useAuth } from "@/hooks/useAuth";

// Helper to deep copy a leg, preserving immutable closingTransaction entries
// This prevents cost basis (openingPrice) and strike from being mutated
// when the leg is updated after partial closes
const deepCopyLeg = (leg: OptionLeg, updates: Partial<OptionLeg> = {}): OptionLeg => {
  const preservedClosingTransaction = leg.closingTransaction ? {
    ...leg.closingTransaction,
    entries: leg.closingTransaction.entries?.map(entry => ({ ...entry }))
  } : undefined;
  
  return {
    ...leg,
    ...updates,
    // Preserve existing closingTransaction unless explicitly updated
    closingTransaction: updates.closingTransaction ?? preservedClosingTransaction
  };
};

export default function Builder() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [range, setRange] = useState(14);
  const [activeTab, setActiveTab] = useState<"heatmap" | "chart">("heatmap");
  const [isSaveTradeOpen, setIsSaveTradeOpen] = useState(false);
  const [commissionSettings, setCommissionSettings] = useState<CommissionSettings>({
    perTrade: 0,
    perContract: 0,
    roundTrip: false
  });
  const prevSymbolRef = useRef<{ symbol: string; price: number } | null>(null);
  const urlParamsProcessed = useRef(false);
  
  // Store initial P/L values from SavedTrades for immediate consistency
  // These values are used for the heatmap's current-scenario cell until user makes changes
  const [initialPLFromSavedTrade, setInitialPLFromSavedTrade] = useState<{
    realizedPL: number;
    unrealizedPL: number;
  } | null>(null);
  
  // Store frozen Expected Move calculation in a stable cache
  // This is captured ONCE per symbol/expiration and NEVER affected by IV slider or strategy changes
  const [frozenExpectedMove, setFrozenExpectedMove] = useState<{
    expectedMove: number;
    atmStrike: number;
    atmCall: number;
    atmPut: number;
    otm1Strangle: number | null;
    otm2Strangle: number | null;
    lowerBound: number;
    upperBound: number;
    movePercent: number;
    currentPrice: number;
    daysToExpiration: number;
  } | null>(null);
  
  // Stable cache Map to prevent recalculation on react-query refreshes
  const expectedMoveCacheRef = useRef<Map<string, typeof frozenExpectedMove>>(new Map());
  
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const {
    symbolInfo,
    setSymbolInfo,
    setSymbolInfoForSavedTrade,
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
  } = useStrategyEngine(range);

  const volatilityPercent = Math.round(volatility * 100);
  const calculatedIVPercent = Math.round(calculatedIV * 100);
  
  // Calculate realized and unrealized P/L
  const { realizedPL, unrealizedPL, hasRealizedPL, hasUnrealizedPL } = useMemo(() => {
    if (!symbolInfo.price || legs.length === 0) {
      return { realizedPL: 0, unrealizedPL: 0, hasRealizedPL: false, hasUnrealizedPL: false };
    }
    return calculateRealizedUnrealizedPL(legs, symbolInfo.price, volatility);
  }, [legs, symbolInfo.price, volatility]);
  
  const handleVolatilityChange = (percent: number) => {
    setVolatility(percent / 100);
  };
  
  const handleResetIV = () => {
    setVolatility(calculatedIV);
  };

  // Handle URL params from Option Finder (strategy and symbol)
  useEffect(() => {
    if (urlParamsProcessed.current || !searchString) return;
    
    const params = new URLSearchParams(searchString);
    const strategyIndex = params.get('strategy');
    const urlSymbol = params.get('symbol');
    const loadSaved = params.get('loadSaved');
    
    // Handle loading saved trade from localStorage
    if (loadSaved === 'true') {
      urlParamsProcessed.current = true;
      try {
        const savedTradeData = localStorage.getItem('loadTrade');
        if (savedTradeData) {
          const trade = JSON.parse(savedTradeData);
          if (trade.symbol && trade.legs && Array.isArray(trade.legs)) {
            // Use the current price passed from SavedTrades (if available) for immediate consistency
            // This ensures the heatmap shows the EXACT same P/L as Total Return in Saved Trades
            const initialPrice = trade._currentPrice || trade.price || 100;
            setSymbolInfoForSavedTrade({ symbol: trade.symbol, price: initialPrice });
            
            // Don't immediately override with fetched price - keep the passed price for consistency
            // The 10-second price poll will update it later if needed
            
            // Helper to recalculate expirationDays from expirationDate
            const recalculateExpirationDays = (legExpDate?: string, fallback?: number): number => {
              if (legExpDate) {
                try {
                  const expDate = new Date(legExpDate);
                  const today = new Date();
                  const diffTime = expDate.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  return Math.max(0, diffDays);
                } catch {
                  return fallback || 30;
                }
              }
              return fallback || 30;
            };

            // Normalize legs to ensure required fields exist
            // Mark as 'saved' to preserve the original cost basis from when trade was saved
            // Preserve all leg properties including isExcluded, closingTransaction, market data, etc.
            // IMPORTANT: Preserve marketBid/Ask/Mark/Last from SavedTrades for immediate P/L consistency
            const normalizedLegs: OptionLeg[] = trade.legs.map((leg: Partial<OptionLeg>, index: number) => ({
              id: leg.id || `saved-${Date.now()}-${index}`,
              type: leg.type || 'call',
              position: leg.position || 'long',
              strike: leg.strike || trade.price || 100,
              quantity: leg.quantity || 1,
              premium: leg.premium || 0,
              expirationDays: recalculateExpirationDays(leg.expirationDate, leg.expirationDays),
              premiumSource: 'saved' as const,  // Preserve original cost basis
              impliedVolatility: leg.impliedVolatility,
              entryUnderlyingPrice: leg.entryUnderlyingPrice ?? trade.price,
              expirationDate: leg.expirationDate,
              isExcluded: leg.isExcluded,
              closingTransaction: leg.closingTransaction,
              // Preserve market data from SavedTrades for immediate consistency
              marketBid: leg.marketBid,
              marketAsk: leg.marketAsk,
              marketMark: leg.marketMark,
              marketLast: leg.marketLast,
            }));
            
            setLegs(normalizedLegs);
            
            // Set expiration - always set one to ensure chain/heatmap recalculates
            let expirationDays = 30; // Default fallback
            let expirationDateStr = '';
            
            if (trade.expirationDate) {
              const expDate = new Date(trade.expirationDate);
              const today = new Date();
              const diffTime = expDate.getTime() - today.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              if (diffDays > 0) {
                // Valid future expiration
                expirationDays = diffDays;
                expirationDateStr = trade.expirationDate;
              } else {
                // Expired - use 7-day forward as default
                expirationDays = 7;
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + 7);
                expirationDateStr = futureDate.toISOString().split('T')[0];
              }
            } else {
              // No expiration stored - derive from legs or use default
              const legDays = normalizedLegs.map(l => l.expirationDays).filter(d => d > 0);
              expirationDays = legDays.length > 0 ? Math.max(...legDays) : 30;
              const futureDate = new Date();
              futureDate.setDate(futureDate.getDate() + expirationDays);
              expirationDateStr = futureDate.toISOString().split('T')[0];
            }
            
            setSelectedExpiration(expirationDays, expirationDateStr);
            
            // Store the EXACT P/L values calculated by SavedTrades for immediate consistency
            // This ensures the heatmap's current-scenario cell shows the SAME value as Total Return
            if (trade._realizedPL !== undefined && trade._unrealizedPL !== undefined) {
              setInitialPLFromSavedTrade({
                realizedPL: trade._realizedPL,
                unrealizedPL: trade._unrealizedPL,
              });
            }
            
            localStorage.removeItem('loadTrade');
          }
        }
      } catch {
        // Silent fail if parse fails
      }
      window.history.replaceState({}, '', '/builder');
      return;
    }
    
    // Handle loading shared strategy from sessionStorage
    const isShared = params.get('shared');
    if (isShared === 'true') {
      urlParamsProcessed.current = true;
      try {
        const sharedData = sessionStorage.getItem('sharedStrategy');
        if (sharedData) {
          const strategy = JSON.parse(sharedData);
          if (strategy.symbol && strategy.legs && Array.isArray(strategy.legs)) {
            // IMMEDIATELY fetch current price so heatmap shows accurate P/L from the start
            setSymbolInfoForSavedTrade({ symbol: strategy.symbol, price: strategy.price || 100 });
            
            // Fetch current price right away (don't wait for 10s poll interval)
            fetch(`/api/stock/quote/${strategy.symbol}`)
              .then(res => res.ok ? res.json() : null)
              .then(data => {
                if (data && data.price && data.price > 0) {
                  setSymbolInfo({ symbol: strategy.symbol, price: data.price });
                }
              })
              .catch(() => { /* Use saved price as fallback */ });
            
            // Helper to recalculate expirationDays from expirationDate
            const recalculateSharedExpirationDays = (legExpDate?: string, fallback?: number): number => {
              if (legExpDate) {
                try {
                  const expDate = new Date(legExpDate);
                  const today = new Date();
                  const diffTime = expDate.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  return Math.max(0, diffDays);
                } catch {
                  return fallback || 30;
                }
              }
              return fallback || 30;
            };

            // Normalize legs from shared format
            // Mark as 'saved' to preserve the original cost basis from when trade was shared
            // Preserve all leg properties including isExcluded, closingTransaction, etc.
            // IMPORTANT: Recalculate expirationDays from expirationDate to reflect current time
            const normalizedLegs: OptionLeg[] = strategy.legs.map((leg: Partial<OptionLeg>, index: number) => ({
              id: leg.id || `shared-${Date.now()}-${index}`,
              type: leg.type || 'call',
              position: leg.position || 'long',
              strike: leg.strike || strategy.price || 100,
              quantity: leg.quantity || 1,
              premium: leg.premium || 0,
              expirationDays: recalculateSharedExpirationDays(leg.expirationDate, leg.expirationDays),
              premiumSource: 'saved' as const,  // Preserve original cost basis
              impliedVolatility: leg.impliedVolatility,
              entryUnderlyingPrice: leg.entryUnderlyingPrice ?? strategy.price,
              expirationDate: leg.expirationDate,
              isExcluded: leg.isExcluded,
              closingTransaction: leg.closingTransaction,
            }));
            
            setLegs(normalizedLegs);
            
            // Set expiration
            let expirationDays = 30;
            let expirationDateStr = '';
            
            if (strategy.expirationDate) {
              const expDate = new Date(strategy.expirationDate);
              const today = new Date();
              const diffTime = expDate.getTime() - today.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              if (diffDays > 0) {
                expirationDays = diffDays;
                expirationDateStr = strategy.expirationDate;
              } else {
                expirationDays = 7;
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + 7);
                expirationDateStr = futureDate.toISOString().split('T')[0];
              }
            } else {
              const legDays = normalizedLegs.map(l => l.expirationDays).filter(d => d > 0);
              expirationDays = legDays.length > 0 ? Math.max(...legDays) : 30;
              const futureDate = new Date();
              futureDate.setDate(futureDate.getDate() + expirationDays);
              expirationDateStr = futureDate.toISOString().split('T')[0];
            }
            
            setSelectedExpiration(expirationDays, expirationDateStr);
            sessionStorage.removeItem('sharedStrategy');
          }
        }
      } catch {
        // Silent fail if parse fails
      }
      window.history.replaceState({}, '', '/builder');
      return;
    }
    
    if (strategyIndex !== null || urlSymbol) {
      urlParamsProcessed.current = true;
      
      // Load symbol from URL if different
      if (urlSymbol && urlSymbol !== symbolInfo.symbol) {
        setSymbolInfo(prev => ({ ...prev, symbol: urlSymbol }));
      }
      
      // Load strategy template if specified
      if (strategyIndex !== null) {
        const templateIndex = parseInt(strategyIndex, 10);
        if (!isNaN(templateIndex) && templateIndex >= 0 && templateIndex < strategyTemplates.length) {
          const template = strategyTemplates[templateIndex];
          const basePrice = symbolInfo.price > 0 ? symbolInfo.price : 100;
          const atmStrike = Math.round(basePrice / 5) * 5;
          
          const adjustedLegs: OptionLeg[] = template.legs.map((leg, index) => {
            const strikeOffset = leg.strike - 100;
            const newStrike = atmStrike + strikeOffset;
            
            return deepCopyLeg(leg, {
              strike: newStrike,
              id: Date.now().toString() + leg.id + index,
            });
          });
          
          setLegs(adjustedLegs);
        }
      }
      
      // Clear URL params after processing - stay on /builder route
      window.history.replaceState({}, '', '/builder');
    }
  }, [searchString, symbolInfo.symbol, symbolInfo.price, setSymbolInfo, setLegs]);

  // Helper to round strike to valid increments
  const roundStrike = (strike: number, direction: 'up' | 'down' | 'nearest' = 'nearest'): number => {
    let increment: number;
    if (strike < 25) increment = 0.5;
    else if (strike < 100) increment = 1;
    else if (strike < 200) increment = 2.5;
    else increment = 5;
    
    if (direction === 'up') {
      return Math.ceil(strike / increment) * increment;
    } else if (direction === 'down') {
      return Math.floor(strike / increment) * increment;
    } else {
      return Math.round(strike / increment) * increment;
    }
  };

  // Auto-adjust strategy strikes when symbol changes
  useEffect(() => {
    const prev = prevSymbolRef.current;
    const current = symbolInfo;
    
    console.log('[AUTO-ADJUST]', {
      prev: prev ? `${prev.symbol} $${prev.price}` : 'null',
      current: `${current.symbol} $${current.price}`,
    });
    
    // On initial mount, just store the current info
    if (!prev) {
      console.log('[AUTO-ADJUST] Initial mount, storing symbol');
      prevSymbolRef.current = current;
      return;
    }
    
    // If symbol hasn't changed, update price but don't adjust strikes
    if (prev.symbol === current.symbol) {
      console.log('[AUTO-ADJUST] Same symbol, skipping');
      prevSymbolRef.current = current;
      return;
    }
    
    // Symbol changed - but wait for valid price before adjusting
    // Don't update prevSymbolRef yet so we can retry when price arrives
    if (!prev.price || !current.price || prev.price <= 0 || current.price <= 0) {
      console.log('[AUTO-ADJUST] Waiting for valid price');
      return; // Don't update prevSymbolRef - wait for valid price
    }
    
    // Now we have: different symbol, valid prices, and legs to adjust
    // User wants strikes adjusted to be "close to current price" - not proportional
    const atmStrike = roundStrike(current.price, 'nearest');
    console.log('[AUTO-ADJUST] Adjusting strikes, ATM:', atmStrike);
    
    // IMPORTANT: Use setLegs with function form to get current legs
    // This avoids stale closure issues when legs is not in dependency array
    setLegs(currentLegs => {
      console.log('[AUTO-ADJUST] Current legs count:', currentLegs.length);
      // Skip if no legs to adjust
      if (currentLegs.length === 0) {
        console.log('[AUTO-ADJUST] No legs, skipping');
        return currentLegs;
      }
      
      // Skip if these are saved/loaded legs - don't adjust their strikes
      const hasSavedLegs = currentLegs.some(leg => leg.premiumSource === 'saved');
      if (hasSavedLegs) {
        console.log('[AUTO-ADJUST] Skipping - saved trade legs should keep original strikes');
        return currentLegs;
      }
      
      const adjustedLegs = currentLegs.map((leg, index) => {
        // Reset all strikes to be close to the new ATM price
        // Spread them slightly based on their relative position in the original strategy
        let newStrike: number;
        
        if (currentLegs.length === 1) {
          // Single leg - just use ATM
          newStrike = atmStrike;
        } else {
          // Multiple legs - maintain relative spacing
          // Determine if this was a higher or lower strike in the original strategy
          const avgStrike = currentLegs.reduce((sum, l) => sum + l.strike, 0) / currentLegs.length;
          const relativePosition = (leg.strike - avgStrike) / prev.price; // as percentage
          
          // Apply small offset from ATM
          const offset = relativePosition * current.price;
          const targetStrike = atmStrike + offset;
          
          // Round based on option type for proper spacing
          const direction = leg.type === 'call' && offset > 0 ? 'up' : 
                           leg.type === 'put' && offset < 0 ? 'down' : 'nearest';
          newStrike = roundStrike(targetStrike, direction);
        }
        
        return deepCopyLeg(leg, {
          strike: newStrike,
          // Reset premium source to theoretical since we changed the strike
          premiumSource: 'theoretical' as const,
        });
      });
      
      return adjustedLegs;
    });
    
    // Only update prevSymbolRef after successful adjustment
    prevSymbolRef.current = current;
  }, [symbolInfo.symbol, symbolInfo.price]);

  const { data: optionsChainData, isLoading: isLoadingChain, error: chainError } = useOptionsChain({
    symbol: symbolInfo.symbol,
    expiration: selectedExpirationDate || undefined,
    enabled: !!symbolInfo.symbol && !!selectedExpirationDate,
  });

  // Capture frozen Expected Move ONLY when symbol or expiration changes
  // Uses Binary formula: 60% ATM Straddle + 30% 1st OTM Strangle + 10% 2nd OTM Strangle
  // This value is NEVER affected by IV slider or strategy changes - purely market data
  useEffect(() => {
    if (!optionsChainData?.quotes || optionsChainData.quotes.length === 0 || !symbolInfo.price) {
      return;
    }
    
    // Create a key based on symbol and expiration only (NOT price or IV)
    const currentKey = `${symbolInfo.symbol}@${selectedExpirationDate || ''}`;
    
    // Check if we already have cached data for this key
    if (expectedMoveCacheRef.current.has(currentKey)) {
      // Use cached data without recalculating
      const cached = expectedMoveCacheRef.current.get(currentKey);
      if (cached && frozenExpectedMove?.currentPrice !== cached.currentPrice) {
        setFrozenExpectedMove(cached);
      }
      return;
    }
    
    const quotes = optionsChainData.quotes;
    const currentPrice = symbolInfo.price;
    
    // Calculate days to expiration
    let daysToExpiration = 30;
    if (selectedExpirationDate) {
      const expDate = new Date(selectedExpirationDate);
      const today = new Date();
      daysToExpiration = Math.max(1, Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    }
    
    // Get unique strikes sorted
    const uniqueStrikes = Array.from(new Set(quotes.map(q => q.strike))).sort((a, b) => a - b);
    
    // Find ATM strike (closest to current price)
    const atmStrike = uniqueStrikes.reduce((closest, strike) => 
      Math.abs(strike - currentPrice) < Math.abs(closest - currentPrice) ? strike : closest
    , uniqueStrikes[0]);
    
    const atmIndex = uniqueStrikes.indexOf(atmStrike);
    
    // Find OTM strikes
    const otm1StrikeAbove = uniqueStrikes[atmIndex + 1];
    const otm1StrikeBelow = uniqueStrikes[atmIndex - 1];
    const otm2StrikeAbove = uniqueStrikes[atmIndex + 2];
    const otm2StrikeBelow = uniqueStrikes[atmIndex - 2];
    
    // Helper to find mid price for a specific strike and side
    const getMidPrice = (strike: number, side: 'call' | 'put'): number | null => {
      const quote = quotes.find(q => q.strike === strike && q.side === side);
      return quote ? quote.mid : null;
    };
    
    // Get ATM call and put prices
    const atmCall = getMidPrice(atmStrike, 'call');
    const atmPut = getMidPrice(atmStrike, 'put');
    
    // Get OTM strangle prices
    const otm1Call = otm1StrikeAbove ? getMidPrice(otm1StrikeAbove, 'call') : null;
    const otm1Put = otm1StrikeBelow ? getMidPrice(otm1StrikeBelow, 'put') : null;
    const otm2Call = otm2StrikeAbove ? getMidPrice(otm2StrikeAbove, 'call') : null;
    const otm2Put = otm2StrikeBelow ? getMidPrice(otm2StrikeBelow, 'put') : null;
    
    // Calculate and store frozen expected move if we have ATM straddle
    if (atmCall !== null && atmPut !== null && atmCall > 0 && atmPut > 0) {
      const atmStraddle = atmCall + atmPut;
      
      // OTM strangles (both legs required)
      const hasOtm1 = otm1Call !== null && otm1Put !== null;
      const otm1Strangle = hasOtm1 ? otm1Call + otm1Put : null;
      const hasOtm2 = otm2Call !== null && otm2Put !== null;
      const otm2Strangle = hasOtm2 ? otm2Call + otm2Put : null;
      
      // Binary weighted formula: 60% ATM + 30% OTM1 + 10% OTM2
      // Redistribute weights if components are missing
      let expectedMoveValue: number;
      if (hasOtm1 && hasOtm2) {
        expectedMoveValue = 0.6 * atmStraddle + 0.3 * otm1Strangle! + 0.1 * otm2Strangle!;
      } else if (hasOtm1) {
        expectedMoveValue = 0.7 * atmStraddle + 0.3 * otm1Strangle!;
      } else if (hasOtm2) {
        expectedMoveValue = 0.9 * atmStraddle + 0.1 * otm2Strangle!;
      } else {
        expectedMoveValue = atmStraddle;
      }
      
      const payload = {
        expectedMove: expectedMoveValue,
        atmStrike,
        atmCall,
        atmPut,
        otm1Strangle,
        otm2Strangle,
        lowerBound: currentPrice - expectedMoveValue,
        upperBound: currentPrice + expectedMoveValue,
        movePercent: (expectedMoveValue / currentPrice) * 100,
        currentPrice,
        daysToExpiration,
      };
      
      // Cache it and set state
      expectedMoveCacheRef.current.set(currentKey, payload);
      setFrozenExpectedMove(payload);
    }
  }, [optionsChainData, symbolInfo.symbol, symbolInfo.price, selectedExpirationDate]);

  // Auto-update leg premiums with market data when chain loads or refreshes
  useEffect(() => {
    if (!optionsChainData?.quotes || optionsChainData.quotes.length === 0) {
      return;
    }

    // Calculate days to expiration from selected date
    const calculateDTE = (): number => {
      if (!selectedExpirationDate) return 30;
      const expDate = new Date(selectedExpirationDate);
      const today = new Date();
      const expDateUTC = Date.UTC(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
      const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
      const diffTime = expDateUTC - todayUTC;
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(1, diffDays);
    };

    const daysToExpiration = calculateDTE();

    // Update legs with market prices and populate market fields
    setLegs(currentLegs => {
      let updated = false;
      const newLegs = currentLegs.map(leg => {
        // Find matching market quote (same strike and type)
        const matchingQuote = optionsChainData.quotes.find(
          q => Math.abs(q.strike - leg.strike) < 0.01 && q.side.toLowerCase() === leg.type
        );

        // For saved/manual legs, ONLY update market fields (preserve entry premium)
        if (leg.premiumSource === 'manual' || leg.premiumSource === 'saved') {
          if (matchingQuote) {
            // Check if market fields need updating
            const marketNeedsUpdate = 
              leg.marketBid !== matchingQuote.bid ||
              leg.marketAsk !== matchingQuote.ask ||
              leg.marketMark !== matchingQuote.mid ||
              leg.marketLast !== matchingQuote.last;
            
            if (marketNeedsUpdate) {
              updated = true;
              return deepCopyLeg(leg, {
                marketBid: matchingQuote.bid,
                marketAsk: matchingQuote.ask,
                marketMark: matchingQuote.mid,
                marketLast: matchingQuote.last,
                expirationDays: daysToExpiration,
              });
            }
          }
          return leg;
        }

        if (matchingQuote && matchingQuote.mid > 0) {
          const newPremium = Number(matchingQuote.mid.toFixed(2));
          
          // Update if: price changed, source isn't market, or current premium is missing/invalid
          const needsUpdate = leg.premium !== newPremium || 
                              leg.premiumSource !== 'market' || 
                              !isFinite(leg.premium) || 
                              leg.premium <= 0 ||
                              leg.marketBid !== matchingQuote.bid ||
                              leg.marketAsk !== matchingQuote.ask ||
                              leg.marketMark !== matchingQuote.mid;
          
          if (needsUpdate) {
            updated = true;
            
            // Calculate IV from market price if not provided by API
            let calculatedIV = matchingQuote.iv;
            if (!calculatedIV && matchingQuote.mid > 0 && symbolInfo?.price) {
              calculatedIV = calculateImpliedVolatility(
                matchingQuote.side as 'call' | 'put',
                symbolInfo.price,
                matchingQuote.strike,
                daysToExpiration,
                matchingQuote.mid
              );
            }
            
            return deepCopyLeg(leg, {
              premium: newPremium,
              marketQuoteId: matchingQuote.optionSymbol,
              premiumSource: 'market' as const,
              impliedVolatility: calculatedIV,
              expirationDays: daysToExpiration,
              entryUnderlyingPrice: symbolInfo.price,
              marketBid: matchingQuote.bid,
              marketAsk: matchingQuote.ask,
              marketMark: matchingQuote.mid,
              marketLast: matchingQuote.last,
            });
          }
        } else if (!isFinite(leg.premium) || leg.premium <= 0) {
          // Fallback to theoretical pricing if leg has no valid premium
          if (symbolInfo?.price && symbolInfo.price > 0 && leg.strike > 0) {
            const currentVol = volatility || 0.3;
            const theoreticalPremium = calculateOptionPrice(
              leg.type,
              symbolInfo.price,
              leg.strike,
              daysToExpiration,
              currentVol
            );
            
            if (isFinite(theoreticalPremium) && theoreticalPremium >= 0) {
              updated = true;
              return deepCopyLeg(leg, {
                premium: Number(Math.max(0.01, theoreticalPremium).toFixed(2)),
                premiumSource: 'theoretical' as const,
                expirationDays: daysToExpiration,
                entryUnderlyingPrice: symbolInfo.price,
              });
            }
          }
          
          // Ultimate fallback: minimal placeholder premium
          updated = true;
          return deepCopyLeg(leg, {
            premium: 0.01,
            premiumSource: 'theoretical' as const,
            expirationDays: daysToExpiration,
            entryUnderlyingPrice: symbolInfo.price,
          });
        }
        
        return leg;
      });

      return updated ? newLegs : currentLegs;
    });
  }, [optionsChainData, selectedExpirationDate, symbolInfo?.price, volatility]);

  // Ensure all legs have valid premiums (fallback to theoretical even when chain data partial)
  useEffect(() => {
    // Skip if no legs
    if (legs.length === 0) return;
    // Skip if symbolInfo.price is not valid yet
    if (!symbolInfo?.price || symbolInfo.price <= 0) return;

    // Check if any legs have invalid premiums (regardless of chain data availability)
    const hasInvalidPremiums = legs.some(
      leg => leg.premiumSource !== 'manual' && (!isFinite(leg.premium) || leg.premium <= 0)
    );

    if (hasInvalidPremiums) {
      const rawDTE = selectedExpirationDate 
        ? Math.max(1, Math.round((new Date(selectedExpirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 30;
      // Use minimum 14 days for theoretical pricing to show realistic premiums
      const daysToExpiration = Math.max(14, rawDTE);
      const currentVol = volatility || 0.3;

      setLegs(currentLegs => {
        let updated = false;
        const newLegs = currentLegs.map(leg => {
          if (leg.premiumSource === 'manual') return leg;
          if (isFinite(leg.premium) && leg.premium > 0) return leg;

          // Calculate theoretical price
          if (leg.strike > 0) {
            const theoreticalPremium = calculateOptionPrice(
              leg.type,
              symbolInfo.price,
              leg.strike,
              daysToExpiration,
              currentVol
            );

            if (isFinite(theoreticalPremium) && theoreticalPremium >= 0) {
              updated = true;
              return deepCopyLeg(leg, {
                premium: Number(Math.max(0.01, theoreticalPremium).toFixed(2)),
                premiumSource: 'theoretical' as const,
                expirationDays: daysToExpiration,
                entryUnderlyingPrice: symbolInfo.price,
              });
            }
          }

          // Ultimate fallback
          updated = true;
          return deepCopyLeg(leg, {
            premium: 0.01,
            premiumSource: 'theoretical' as const,
            expirationDays: daysToExpiration,
            entryUnderlyingPrice: symbolInfo.price,
          });
        });

        return updated ? newLegs : currentLegs;
      });
    }
  }, [legs.length, symbolInfo?.price, volatility, optionsChainData?.quotes?.length, selectedExpirationDate]);

  // Calculate available strikes from market data
  // Use minStrike/maxStrike from API (which includes extrapolated range)
  // and generate full strike array to fill the extrapolated range
  const availableStrikes = useMemo(() => {
    if (!optionsChainData?.quotes || optionsChainData.quotes.length === 0) return null;
    
    const actualStrikes = Array.from(new Set(optionsChainData.quotes.map((q: any) => q.strike))).sort((a, b) => a - b);
    const min = optionsChainData.minStrike;
    const max = optionsChainData.maxStrike;
    
    // If range is extrapolated beyond actual quotes, generate placeholder strikes
    if (actualStrikes.length > 10 && (min < actualStrikes[0] || max > actualStrikes[actualStrikes.length - 1])) {
      // Detect common interval from actual strikes
      const intervals = new Set<number>();
      for (let i = 1; i < Math.min(actualStrikes.length, 20); i++) {
        intervals.add(Number((actualStrikes[i] - actualStrikes[i-1]).toFixed(2)));
      }
      const commonInterval = Array.from(intervals).sort((a, b) => a - b)[0] || 2.5;
      
      // Generate full strike array from min to max
      const fullStrikes = new Set(actualStrikes); // Start with actual strikes
      for (let strike = Math.ceil(min / commonInterval) * commonInterval; strike <= max; strike += commonInterval) {
        fullStrikes.add(Number(strike.toFixed(2)));
      }
      
      return {
        min,
        max,
        strikes: Array.from(fullStrikes).sort((a, b) => a - b),
      };
    }
    
    // No extrapolation needed, use actual strikes
    return {
      min,
      max,
      strikes: actualStrikes,
    };
  }, [optionsChainData]);
  
  // Helper to constrain strike to market limits
  const constrainToMarketLimits = (strike: number): number => {
    if (!availableStrikes) return strike;
    
    // Clamp to min/max range
    if (strike < availableStrikes.min) return availableStrikes.min;
    if (strike > availableStrikes.max) return availableStrikes.max;
    
    // Find nearest available strike
    const nearest = availableStrikes.strikes.reduce((closest: number, current: number) => {
      return Math.abs(current - strike) < Math.abs(closest - strike) ? current : closest;
    });
    
    return nearest;
  };
  
  // Constrain existing strikes when new options chain data loads
  useEffect(() => {
    if (!availableStrikes || legs.length === 0) return;
    
    // Check if any strikes are outside market limits
    const hasOutOfBoundsStrikes = legs.some(
      leg => leg.strike < availableStrikes.min || leg.strike > availableStrikes.max
    );
    
    if (hasOutOfBoundsStrikes) {
      const constrainedLegs = legs.map(leg => deepCopyLeg(leg, {
        strike: constrainToMarketLimits(leg.strike),
        // Reset premium source since we changed the strike
        premiumSource: 'theoretical' as const,
      }));
      setLegs(constrainedLegs);
    }
  }, [availableStrikes?.min, availableStrikes?.max, legs.length]);

  // Constrain strike range to available strikes when market data exists
  const displayStrikeRange = availableStrikes
    ? {
        min: availableStrikes.min,
        max: availableStrikes.max,
      }
    : strikeRange;

  // Helper function to apply market prices to legs (with theoretical fallback)
  // Defined before addLeg so it can be used when adding new legs
  const applyMarketPrices = (legsToUpdate: OptionLeg[]): OptionLeg[] => {
    // Calculate days to expiration from selected date
    const calculateDTE = (): number => {
      if (!selectedExpirationDate) return 30;
      const expDate = new Date(selectedExpirationDate);
      const today = new Date();
      const expDateUTC = Date.UTC(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
      const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
      const diffTime = expDateUTC - todayUTC;
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(1, diffDays);
    };

    const rawDTE = calculateDTE();
    // Use minimum 14 days for theoretical pricing to show realistic premiums
    // (very short DTE causes near-zero prices for OTM options)
    const daysToExpiration = Math.max(14, rawDTE);
    const currentVol = volatility || 0.3; // Default IV if not set

    return legsToUpdate.map(leg => {
      // Deep copy closing transaction to preserve immutable entry data
      const preservedClosingTransaction = leg.closingTransaction ? {
        ...leg.closingTransaction,
        entries: leg.closingTransaction.entries?.map(entry => ({ ...entry }))
      } : undefined;
      
      // Try to find matching market quote (same strike and type)
      const matchingQuote = optionsChainData?.quotes?.find(
        (q: any) => Math.abs(q.strike - leg.strike) < 0.01 && q.side.toLowerCase() === leg.type
      );

      if (matchingQuote && matchingQuote.mid > 0) {
        const newPremium = Number(matchingQuote.mid.toFixed(2));
        
        // Calculate IV from market price if not provided by API
        let calculatedIV = matchingQuote.iv;
        if (!calculatedIV && matchingQuote.mid > 0 && symbolInfo?.price) {
          calculatedIV = calculateImpliedVolatility(
            matchingQuote.side as 'call' | 'put',
            symbolInfo.price,
            matchingQuote.strike,
            daysToExpiration,
            matchingQuote.mid
          );
        }
        
        return {
          ...leg,
          premium: newPremium,
          marketQuoteId: matchingQuote.optionSymbol,
          premiumSource: 'market' as const,
          impliedVolatility: calculatedIV,
          expirationDays: daysToExpiration,
          entryUnderlyingPrice: symbolInfo.price,
          closingTransaction: preservedClosingTransaction,
        };
      }
      
      // Fallback: Calculate theoretical price using Black-Scholes
      if (symbolInfo?.price && symbolInfo.price > 0 && leg.strike > 0) {
        const theoreticalPremium = calculateOptionPrice(
          leg.type,
          symbolInfo.price,
          leg.strike,
          daysToExpiration,
          currentVol
        );
        
        // Ensure we have a valid, finite premium
        if (isFinite(theoreticalPremium) && theoreticalPremium >= 0) {
          return {
            ...leg,
            premium: Number(Math.max(0.01, theoreticalPremium).toFixed(2)),
            premiumSource: 'theoretical' as const,
            expirationDays: daysToExpiration,
            entryUnderlyingPrice: symbolInfo.price,
            closingTransaction: preservedClosingTransaction,
          };
        }
      }
      
      // Ultimate fallback: set a minimal placeholder premium so metrics can calculate
      return {
        ...leg,
        premium: leg.premium ?? 0.01,
        premiumSource: 'theoretical' as const,
        expirationDays: daysToExpiration,
        entryUnderlyingPrice: symbolInfo?.price,
        closingTransaction: preservedClosingTransaction,
      };
    });
  };

  const addLeg = (legTemplate: Omit<OptionLeg, "id">) => {
    const newLeg: OptionLeg = {
      ...legTemplate,
      id: Date.now().toString(),
    };
    // Apply market prices immediately to get accurate pricing
    const [legWithPrice] = applyMarketPrices([newLeg]);
    setLegs(prevLegs => [...prevLegs, legWithPrice]);
    // Clear frozen P/L values so live calculations take over
    setInitialPLFromSavedTrade(null);
  };

  const updateLeg = (id: string, updates: Partial<OptionLeg>) => {
    setLegs(prevLegs => prevLegs.map((leg) => {
      if (leg.id !== id) return leg;
      
      // Deep copy the closing transaction to preserve immutable entry data
      // This prevents mutations from affecting stored openingPrice/strike values
      const preservedClosingTransaction = leg.closingTransaction ? {
        ...leg.closingTransaction,
        // Deep copy entries array to prevent reference mutations
        entries: leg.closingTransaction.entries?.map(entry => ({ ...entry }))
      } : undefined;
      
      return { 
        ...leg, 
        ...updates,
        // Always preserve the existing closing transaction (with deep-copied entries)
        // unless the update explicitly includes closing transaction changes
        closingTransaction: updates.closingTransaction ?? preservedClosingTransaction
      };
    }));
    // Clear frozen P/L values so live calculations take over
    setInitialPLFromSavedTrade(null);
  };

  const removeLeg = (id: string) => {
    setLegs(prevLegs => prevLegs.map((leg) => {
      if (leg.id !== id) return leg;
      
      // Check if this leg has closed entries
      const closedEntries = leg.closingTransaction?.entries || [];
      const hasClosedEntries = closedEntries.length > 0 && leg.closingTransaction?.isEnabled;
      
      if (hasClosedEntries) {
        // Don't delete - just set quantity to match closed quantity so open position is 0
        const closedQty = closedEntries.reduce((sum, e) => sum + e.quantity, 0);
        return deepCopyLeg(leg, { quantity: closedQty });
      }
      
      // No closed entries - mark for removal by setting quantity to 0
      return deepCopyLeg(leg, { quantity: 0 });
    }).filter(leg => {
      // Remove legs with 0 quantity that have no closed entries
      const closedEntries = leg.closingTransaction?.entries || [];
      const hasClosedEntries = closedEntries.length > 0 && leg.closingTransaction?.isEnabled;
      return leg.quantity > 0 || hasClosedEntries;
    }));
    // Clear frozen P/L values so live calculations take over
    setInitialPLFromSavedTrade(null);
  };

  const loadTemplate = (templateIndex: number) => {
    const template = strategyTemplates[templateIndex];
    const currentPrice = symbolInfo.price;
    
    // Validate price before proceeding
    if (!currentPrice || !isFinite(currentPrice) || currentPrice <= 0) {
      // Fallback to template's original strikes if no valid price
      // Still apply market prices where possible (uses fallback logic)
      const fallbackLegs = template.legs.map((leg, index) => deepCopyLeg(leg, { 
        id: Date.now().toString() + leg.id + index 
      }));
      setLegs(applyMarketPrices(fallbackLegs));
      return;
    }
    
    // Calculate ATM strike
    const atmStrike = roundStrike(currentPrice, 'nearest');
    
    // Map template legs to current price-relative strikes
    const adjustedLegs = template.legs.map((leg, index) => {
      let newStrike = atmStrike;
      
      // Strategy-specific strike adjustments
      switch (template.name) {
        case "Long Call":
          newStrike = atmStrike; // ATM
          break;
        case "Long Put":
          newStrike = atmStrike; // ATM
          break;
        case "Covered Call":
          newStrike = roundStrike(currentPrice * 1.05, 'up'); // 5% OTM (round up)
          break;
        case "Protective Put":
          newStrike = roundStrike(currentPrice * 0.95, 'down'); // 5% OTM (round down)
          break;
        case "Bull Call Spread":
          newStrike = index === 0 ? atmStrike : roundStrike(currentPrice * 1.05, 'up'); // ATM + 5% OTM
          break;
        case "Bear Put Spread":
          newStrike = index === 0 ? atmStrike : roundStrike(currentPrice * 0.95, 'down'); // ATM + 5% OTM (matched to bull spread)
          break;
        case "Long Straddle":
          newStrike = atmStrike; // Both at ATM
          break;
        case "Long Strangle":
          newStrike = leg.type === "call" ? roundStrike(currentPrice * 1.05, 'up') : roundStrike(currentPrice * 0.95, 'down');
          break;
        case "Iron Condor":
          // Short put, long put, short call, long call
          if (index === 0) newStrike = roundStrike(currentPrice * 0.95, 'down'); // Short put -5%
          else if (index === 1) newStrike = roundStrike(currentPrice * 0.90, 'down'); // Long put -10%
          else if (index === 2) newStrike = roundStrike(currentPrice * 1.05, 'up'); // Short call +5%
          else if (index === 3) newStrike = roundStrike(currentPrice * 1.10, 'up'); // Long call +10%
          break;
        case "Butterfly Spread":
          // Low wing, body (2x), high wing
          if (index === 0) newStrike = roundStrike(currentPrice * 0.95, 'down'); // -5%
          else if (index === 1) newStrike = atmStrike; // ATM
          else if (index === 2) newStrike = roundStrike(currentPrice * 1.05, 'up'); // +5%
          break;
      }
      
      return deepCopyLeg(leg, {
        strike: newStrike,
        id: Date.now().toString() + leg.id + index,
      });
    });
    
    // Apply market prices immediately if options chain data is available
    const legsWithMarketPrices = applyMarketPrices(adjustedLegs);
    setLegs(legsWithMarketPrices);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 md:px-6 flex h-10 items-center justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="flex items-center gap-1.5 cursor-pointer" 
              onClick={() => setLocation("/")}
            >
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold">OptionFlow</span>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              <StrategySelector onSelectStrategy={loadTemplate} />

              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2 text-sm" 
                onClick={() => setLocation(`/option-finder?symbol=${symbolInfo.symbol}`)}
                data-testid="button-option-finder"
              >
                <Search className="h-3 w-3 mr-1" />
                Option Finder
              </Button>

              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2 text-sm" 
                onClick={() => setLocation("/backtest")}
                data-testid="button-backtest"
              >
                <BarChart3 className="h-3 w-3 mr-1" />
                Backtest
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-sm" data-testid="button-market-trends">
                    Market Trends
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem data-testid="menu-market-movers">
                    Market Movers
                  </DropdownMenuItem>
                  <DropdownMenuItem data-testid="menu-volatility-leaders">
                    Volatility Leaders
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" data-testid="button-tutorials">
              <BookOpen className="h-3 w-3 mr-1" />
              Tutorials
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" data-testid="button-blog">
              <FileText className="h-3 w-3 mr-1" />
              Blog
            </Button>
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" data-testid="button-user-menu">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={user?.profileImageUrl ?? undefined} className="object-cover" />
                      <AvatarFallback className="text-[10px]">
                        {user?.firstName?.[0] ?? user?.email?.[0]?.toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline">{user?.firstName ?? "Account"}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                    {user?.email}
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="/saved-trades" className="flex items-center" data-testid="link-saved-trades">
                      <Bookmark className="h-3 w-3 mr-2" />
                      Saved Trades
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="/account" className="flex items-center" data-testid="link-account-details">
                      <User className="h-3 w-3 mr-2" />
                      Account Details
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="/api/logout" className="flex items-center" data-testid="button-logout">
                      <LogOut className="h-3 w-3 mr-2" />
                      Sign Out
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2 text-xs" 
                data-testid="button-sign-in"
                onClick={() => window.location.href = "/api/login"}
              >
                <User className="h-3 w-3 mr-1" />
                Sign In
              </Button>
            )}
<ThemeToggle />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 md:px-4 py-2">
        <div className="space-y-2">
          <TradingViewSearch 
            symbolInfo={symbolInfo} 
            onSymbolChange={setSymbolInfo}
            onSaveTrade={() => setIsSaveTradeOpen(true)}
            legsCount={legs.length}
            legs={legs}
            volatility={volatility}
            commissionSettings={commissionSettings}
            onCommissionChange={setCommissionSettings}
            unrealizedPL={unrealizedPL}
            hasUnrealizedPL={hasUnrealizedPL}
            renderAddButton={() => (
              <AddLegDropdown 
                currentPrice={symbolInfo.price} 
                onAddLeg={addLeg}
                optionsChainData={optionsChainData}
              />
            )}
          />

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 items-start">
            <div className="lg:col-span-3 space-y-2">
              <ExpirationTimeline
                expirationDays={uniqueExpirationDays}
                selectedDays={selectedExpirationDays}
                onSelectDays={setSelectedExpiration}
                symbol={symbolInfo.symbol}
              />

              <StrikeLadder
                legs={legs}
                currentPrice={symbolInfo.price}
                strikeRange={displayStrikeRange}
                symbol={symbolInfo.symbol}
                expirationDate={selectedExpirationDate}
                volatility={volatility}
                onUpdateLeg={updateLeg}
                onRemoveLeg={removeLeg}
                onAddLeg={addLeg}
                optionsChainData={optionsChainData}
                availableStrikes={availableStrikes}
              />

              {activeTab === "heatmap" ? (
                <PLHeatmap
                  grid={scenarioGrid.grid}
                  strikes={scenarioGrid.strikes}
                  days={scenarioGrid.days}
                  currentPrice={symbolInfo.price}
                  useHours={scenarioGrid.useHours}
                  targetDays={scenarioGrid.targetDays}
                  dateGroups={scenarioGrid.dateGroups}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  range={range}
                  onRangeChange={setRange}
                  impliedVolatility={volatilityPercent}
                  onVolatilityChange={handleVolatilityChange}
                  calculatedIV={calculatedIVPercent}
                  onResetIV={handleResetIV}
                  metrics={metrics}
                  commissionSettings={commissionSettings}
                  numTrades={legs.filter(l => !l.isExcluded).length}
                  totalContracts={legs.filter(l => !l.isExcluded).reduce((sum, l) => sum + Math.abs(l.quantity), 0)}
                  realizedPL={initialPLFromSavedTrade?.realizedPL ?? realizedPL}
                  unrealizedPL={initialPLFromSavedTrade?.unrealizedPL ?? unrealizedPL}
                  hasRealizedPL={hasRealizedPL}
                  hasUnrealizedPL={initialPLFromSavedTrade !== null || hasUnrealizedPL}
                />
              ) : (
                <ProfitLossChart 
                  legs={legs} 
                  underlyingPrice={symbolInfo.price}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  range={range}
                  onRangeChange={setRange}
                  impliedVolatility={volatilityPercent}
                  onVolatilityChange={handleVolatilityChange}
                  calculatedIV={calculatedIVPercent}
                  onResetIV={handleResetIV}
                  metrics={metrics}
                />
              )}

              <AnalysisTabs 
                greeks={totalGreeks}
                symbol={symbolInfo.symbol}
                currentPrice={symbolInfo.price}
                volatility={volatility}
                expirationDate={selectedExpirationDate}
                optionsChainData={optionsChainData}
                legs={legs}
                metrics={metrics}
                frozenExpectedMove={frozenExpectedMove}
              />
            </div>

            <div className="space-y-2">
              <AIChatAssistant 
                onNavigate={setLocation}
                strategyContext={{
                  symbolInfo,
                  legs,
                  volatility,
                  expirationDays: uniqueExpirationDays[0] || 30,
                  currentPrice: symbolInfo.price,
                  greeks: totalGreeks,
                }}
                onLookupPrice={async (symbol, strike, type) => {
                  // Use existing options chain data if available
                  if (optionsChainData && symbol.toUpperCase() === symbolInfo.symbol.toUpperCase()) {
                    const quote = optionsChainData.quotes.find(
                      q => q.strike === strike && q.side === type
                    );
                    if (quote) {
                      return { bid: quote.bid, ask: quote.ask, mid: quote.mid };
                    }
                  }
                  // Otherwise try to fetch from API
                  try {
                    const res = await fetch(`/api/options/chain/${symbol.toUpperCase()}`);
                    if (res.ok) {
                      const data = await res.json();
                      const quote = data.quotes?.find(
                        (q: { strike: number; side: string }) => q.strike === strike && q.side === type
                      );
                      if (quote) {
                        return { bid: quote.bid, ask: quote.ask, mid: quote.mid };
                      }
                    }
                  } catch (e) {
                    console.error('Price lookup failed:', e);
                  }
                  return null;
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <SaveTradeModal
        isOpen={isSaveTradeOpen}
        onClose={() => setIsSaveTradeOpen(false)}
        symbolInfo={symbolInfo}
        legs={legs}
        selectedExpirationDate={selectedExpirationDate}
        isAuthenticated={isAuthenticated}
      />


      <Footer />
    </div>
  );
}
