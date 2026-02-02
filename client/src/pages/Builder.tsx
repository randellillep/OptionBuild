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
import { EquityPanel } from "@/components/EquityPanel";
import { AddLegDropdown } from "@/components/AddLegDropdown";
import { AnalysisTabs } from "@/components/AnalysisTabs";
import { Footer } from "@/components/Footer";
import { TrendingUp, ChevronDown, BookOpen, FileText, User, LogOut, BarChart3, Bookmark, Search, HelpCircle } from "lucide-react";
import { TutorialOverlay, useTutorial } from "@/components/TutorialOverlay";
import { AIChatAssistant } from "@/components/AIChatAssistant";
import { SaveTradeModal } from "@/components/SaveTradeModal";
import { StrategySelector } from "@/components/StrategySelector";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { OptionLeg } from "@shared/schema";
import type { CommissionSettings } from "@/components/PositionsModal";
import { strategyTemplates } from "@/lib/strategy-templates";
import { useLocation, useSearch, Link } from "wouter";
import { useStrategyEngine } from "@/hooks/useStrategyEngine";
import { useOptionsChain } from "@/hooks/useOptionsChain";
import { calculateImpliedVolatility, calculateOptionPrice, calculateRealizedUnrealizedPL } from "@/lib/options-pricing";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

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
  // This is captured ONCE per symbol and NEVER affected by IV slider or strategy changes
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
    expirationDate: string;
  } | null>(null);
  
  // Stable cache Map to prevent recalculation on react-query refreshes
  const expectedMoveCacheRef = useRef<Map<string, typeof frozenExpectedMove>>(new Map());
  
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { showTutorial, hasSeenTutorial, startTutorial, closeTutorial } = useTutorial();
  
  const {
    symbolInfo,
    setSymbolInfo,
    setSymbolInfoForSavedTrade,
    legs,
    setLegs,
    volatility,
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
  } = useStrategyEngine(range);
  
  // Track the last processed symbolChangeId to gate effects
  const lastProcessedSymbolChangeIdRef = useRef(symbolChangeId);

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
    setVolatilityManual(percent / 100);
  };
  
  const handleResetIV = () => {
    resetToMarketIV();
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
            // Uses fractional days for same-day options to enable time decay visualization
            // Expiration is set to 4pm ET (NYSE market close) for accuracy
            const recalculateExpirationDays = (legExpDate?: string, fallback?: number): number => {
              if (legExpDate) {
                try {
                  // Parse expiration date - handle both YYYY-MM-DD and ISO datetime formats
                  const dateOnly = legExpDate.split('T')[0]; // Extract date part
                  const [year, month, day] = dateOnly.split('-').map(Number);
                  
                  if (isNaN(year) || isNaN(month) || isNaN(day)) {
                    return fallback || 30;
                  }
                  
                  // Set expiration to 4pm ET (21:00 UTC during EST, 20:00 UTC during EDT)
                  // Use 21:00 UTC as approximation (accurate during EST, 1hr off during EDT)
                  const expDateUTC = new Date(Date.UTC(year, month - 1, day, 21, 0, 0));
                  
                  const now = new Date();
                  const diffMs = expDateUTC.getTime() - now.getTime();
                  
                  // Use fractional days for intraday precision
                  const diffDays = diffMs / (1000 * 60 * 60 * 24);
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
            // Lock cost basis so premium never updates - only market fields will update
            // CRITICAL: Backfill visualOrder for legacy legs to maintain position stability
            const normalizedLegs: OptionLeg[] = trade.legs.map((leg: Partial<OptionLeg>, index: number) => ({
              id: leg.id || `saved-${Date.now()}-${index}`,
              type: leg.type || 'call',
              position: leg.position || 'long',
              strike: leg.strike || trade.price || 100,
              quantity: leg.quantity || 1,
              premium: leg.premium || 0,
              expirationDays: recalculateExpirationDays(leg.expirationDate, leg.expirationDays),
              premiumSource: 'saved' as const,  // Preserve original cost basis
              costBasisLocked: true,            // Lock so premium never updates
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
              // Backfill visualOrder for legacy legs - use index to preserve original order
              visualOrder: leg.visualOrder ?? index,
            }));
            
            setLegs(normalizedLegs);
            
            // Set expiration - use FRACTIONAL days for accurate time decay visualization
            let expirationDays = 30; // Default fallback
            let expirationDateStr = '';
            
            if (trade.expirationDate) {
              // Parse expiration date - handle both YYYY-MM-DD and ISO datetime formats
              const dateOnly = trade.expirationDate.split('T')[0];
              const [year, month, day] = dateOnly.split('-').map(Number);
              
              if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                // Set expiration to 4pm ET (21:00 UTC as approximation)
                const expDateUTC = new Date(Date.UTC(year, month - 1, day, 21, 0, 0));
                const now = new Date();
                const diffMs = expDateUTC.getTime() - now.getTime();
                const diffDaysFractional = diffMs / (1000 * 60 * 60 * 24);
                
                if (diffDaysFractional > 0) {
                  // Valid future expiration - use fractional days
                  expirationDays = diffDaysFractional;
                  expirationDateStr = dateOnly;
                } else {
                  // Expired - use 7-day forward as default
                  expirationDays = 7;
                  const futureDate = new Date();
                  futureDate.setDate(futureDate.getDate() + 7);
                  expirationDateStr = futureDate.toISOString().split('T')[0];
                }
              } else {
                expirationDays = 30;
                expirationDateStr = trade.expirationDate;
              }
            } else {
              // No expiration stored - derive from legs (which have fractional days) or use default
              const legDays = normalizedLegs.map(l => l.expirationDays).filter(d => d > 0);
              expirationDays = legDays.length > 0 ? Math.max(...legDays) : 30;
              const futureDate = new Date();
              futureDate.setDate(futureDate.getDate() + Math.ceil(expirationDays));
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
            // Uses fractional days for same-day options to enable time decay visualization
            // Expiration is set to 4pm ET (NYSE market close) for accuracy
            const recalculateSharedExpirationDays = (legExpDate?: string, fallback?: number): number => {
              if (legExpDate) {
                try {
                  // Parse expiration date - handle both YYYY-MM-DD and ISO datetime formats
                  const dateOnly = legExpDate.split('T')[0]; // Extract date part
                  const [year, month, day] = dateOnly.split('-').map(Number);
                  
                  if (isNaN(year) || isNaN(month) || isNaN(day)) {
                    return fallback || 30;
                  }
                  
                  // Set expiration to 4pm ET (21:00 UTC during EST, 20:00 UTC during EDT)
                  const expDateUTC = new Date(Date.UTC(year, month - 1, day, 21, 0, 0));
                  
                  const now = new Date();
                  const diffMs = expDateUTC.getTime() - now.getTime();
                  
                  // Use fractional days for intraday precision
                  const diffDays = diffMs / (1000 * 60 * 60 * 24);
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
            // CRITICAL: Backfill visualOrder for legacy legs to maintain position stability
            const normalizedLegs: OptionLeg[] = strategy.legs.map((leg: Partial<OptionLeg>, index: number) => ({
              id: leg.id || `shared-${Date.now()}-${index}`,
              type: leg.type || 'call',
              position: leg.position || 'long',
              strike: leg.strike || strategy.price || 100,
              quantity: leg.quantity || 1,
              premium: leg.premium || 0,
              expirationDays: recalculateSharedExpirationDays(leg.expirationDate, leg.expirationDays),
              premiumSource: 'saved' as const,  // Preserve original cost basis
              costBasisLocked: true,            // Lock so premium never updates
              impliedVolatility: leg.impliedVolatility,
              entryUnderlyingPrice: leg.entryUnderlyingPrice ?? strategy.price,
              expirationDate: leg.expirationDate,
              isExcluded: leg.isExcluded,
              closingTransaction: leg.closingTransaction,
              // Backfill visualOrder for legacy legs - use index to preserve original order
              visualOrder: leg.visualOrder ?? index,
            }));
            
            setLegs(normalizedLegs);
            
            // Set expiration - use FRACTIONAL days for accurate time decay visualization
            let expirationDays = 30;
            let expirationDateStr = '';
            
            if (strategy.expirationDate) {
              // Parse expiration date - handle both YYYY-MM-DD and ISO datetime formats
              const dateOnly = strategy.expirationDate.split('T')[0];
              const [year, month, day] = dateOnly.split('-').map(Number);
              
              if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                // Set expiration to 4pm ET (21:00 UTC as approximation)
                const expDateUTC = new Date(Date.UTC(year, month - 1, day, 21, 0, 0));
                const now = new Date();
                const diffMs = expDateUTC.getTime() - now.getTime();
                const diffDaysFractional = diffMs / (1000 * 60 * 60 * 24);
                
                if (diffDaysFractional > 0) {
                  expirationDays = diffDaysFractional;
                  expirationDateStr = dateOnly;
                } else {
                  expirationDays = 7;
                  const futureDate = new Date();
                  futureDate.setDate(futureDate.getDate() + 7);
                  expirationDateStr = futureDate.toISOString().split('T')[0];
                }
              } else {
                expirationDays = 30;
                expirationDateStr = strategy.expirationDate;
              }
            } else {
              // Use fractional days from legs
              const legDays = normalizedLegs.map(l => l.expirationDays).filter(d => d > 0);
              expirationDays = legDays.length > 0 ? Math.max(...legDays) : 30;
              const futureDate = new Date();
              futureDate.setDate(futureDate.getDate() + Math.ceil(expirationDays));
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
            // For stock legs, set entry price to current price
            if (leg.type === "stock") {
              return deepCopyLeg(leg, {
                strike: 0,
                premium: basePrice,
                entryUnderlyingPrice: basePrice,
                costBasisLocked: true,
                id: Date.now().toString() + leg.id + index,
              });
            }
            
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

  // Helper to check if current legs match any strategy template
  const isKnownStrategyTemplate = (currentLegs: OptionLeg[]): boolean => {
    if (currentLegs.length === 0) return false;
    
    // Check if legs match any template by structure (number of legs, types, positions)
    return strategyTemplates.some(template => {
      if (template.legs.length !== currentLegs.length) return false;
      
      // Sort by type and position for comparison
      const sortKey = (leg: { type: string; position: string }) => `${leg.type}-${leg.position}`;
      const templateSorted = [...template.legs].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
      const currentSorted = [...currentLegs].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
      
      // Check if each leg matches by type and position
      return templateSorted.every((tLeg, i) => 
        tLeg.type === currentSorted[i].type && tLeg.position === currentSorted[i].position
      );
    });
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
    const atmStrike = roundStrike(current.price, 'nearest');
    console.log('[AUTO-ADJUST] Adjusting strikes, ATM:', atmStrike);
    
    // Note: useStrategyEngine now handles clearing costBasisLocked/premiumSource
    // when symbol changes, so we don't need a manual flag here
    
    // IMPORTANT: Use setLegs with function form to get current legs
    // This avoids stale closure issues when legs is not in dependency array
    setLegs(currentLegs => {
      console.log('[AUTO-ADJUST] Current legs count:', currentLegs.length);
      
      // Skip if these are saved/loaded legs - don't adjust their strikes
      const hasSavedLegs = currentLegs.some(leg => leg.premiumSource === 'saved');
      if (hasSavedLegs) {
        console.log('[AUTO-ADJUST] Skipping - saved trade legs should keep original strikes');
        return currentLegs;
      }
      
      // Check if current strategy matches a known template
      const isKnownTemplate = isKnownStrategyTemplate(currentLegs);
      
      // If strategy doesn't match any template, clear legs and let user rebuild
      // This avoids pricing issues when market data doesn't have matching strikes
      if (!isKnownTemplate && currentLegs.length > 0) {
        console.log('[AUTO-ADJUST] Unknown strategy, clearing - user can add via Add button');
        return [];
      }
      
      // Skip if no legs - let user add via Add button
      // This avoids pricing issues when market data doesn't have matching strikes
      if (currentLegs.length === 0) {
        console.log('[AUTO-ADJUST] No legs to adjust, user can add via Add button');
        return currentLegs;
      }
      
      // Adjust existing legs for the new symbol
      // IMPORTANT: Calculate premium directly here to avoid race conditions
      const adjustedLegs = currentLegs.map((leg) => {
        // Reset all strikes to be close to the new ATM price
        let newStrike: number;
        
        if (currentLegs.length === 1) {
          // Single leg - just use ATM
          newStrike = atmStrike;
        } else {
          // Multiple legs - maintain relative spacing
          const avgStrike = currentLegs.reduce((sum, l) => sum + l.strike, 0) / currentLegs.length;
          const relativePosition = (leg.strike - avgStrike) / prev.price;
          
          const offset = relativePosition * current.price;
          const targetStrike = atmStrike + offset;
          
          const direction = leg.type === 'call' && offset > 0 ? 'up' : 
                           leg.type === 'put' && offset < 0 ? 'down' : 'nearest';
          newStrike = roundStrike(targetStrike, direction);
        }
        
        // Calculate new theoretical premium using Black-Scholes
        const daysToExp = leg.expirationDays || 30;
        const theoreticalDTE = Math.max(14, daysToExp); // Use min 14 days for realistic premiums
        const newPremium = leg.type === 'stock' ? leg.premium :
          calculateOptionPrice(leg.type as 'call' | 'put', current.price, newStrike, theoreticalDTE, 0.3);
        const finalPremium = leg.type === 'stock' ? leg.premium : Math.max(0.01, Number(newPremium.toFixed(2)));
        
        console.log(`[AUTO-ADJUST] Leg ${leg.type} ${leg.position}: strike ${leg.strike} -> ${newStrike}, premium ${leg.premium} -> ${finalPremium}`);
        
        // Return leg with all fields properly set for new symbol
        return {
          ...leg,
          id: leg.id, // Keep same ID
          strike: newStrike,
          premium: finalPremium,
          premiumSource: 'theoretical' as const,
          entryUnderlyingPrice: current.price,
          costBasisLocked: false,
          marketQuoteId: undefined,
          impliedVolatility: undefined,
          // Clear closing transactions and exclusions for new symbol
          closingTransaction: undefined,
          isExcluded: false,
          // Preserve these
          type: leg.type,
          position: leg.position,
          quantity: leg.quantity,
          expirationDays: leg.expirationDays,
        };
      });
      
      console.log('[AUTO-ADJUST] Returning adjusted legs:', adjustedLegs.map(l => ({ strike: l.strike, premium: l.premium })));
      return adjustedLegs;
    });
    
    // Only update prevSymbolRef after successful adjustment
    prevSymbolRef.current = current;
  }, [symbolInfo.symbol, symbolInfo.price]);

  // Options chain for the STRATEGY (requires user to select expiration)
  const { data: optionsChainData, isLoading: isLoadingChain, error: chainError } = useOptionsChain({
    symbol: symbolInfo.symbol,
    expiration: selectedExpirationDate || undefined,
    enabled: !!symbolInfo.symbol && !!selectedExpirationDate,
  });

  // Separate options chain for EXPECTED MOVE - fetched WITHOUT expiration filter
  // This is ALWAYS enabled when we have a symbol, independent of strategy expiration
  const { data: expectedMoveChainData } = useOptionsChain({
    symbol: symbolInfo.symbol,
    enabled: !!symbolInfo.symbol,
  });

  // Fetch available expirations from the same endpoint ExpirationTimeline uses
  // This ensures Change Expiration picker shows same dates as the top bar
  const { data: optionsExpirationsData } = useQuery<{ expirations: string[] }>({
    queryKey: ["/api/options/expirations", symbolInfo.symbol],
    enabled: !!symbolInfo.symbol,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // Calculate frozen Expected Move INDEPENDENTLY of the strategy
  // Uses the NEAREST available expiration from the options chain, NOT the strategy expiration
  // This value is NEVER affected by IV slider or strategy changes - purely market data
  useEffect(() => {
    // Use expectedMoveChainData which is fetched independently of strategy expiration
    if (!expectedMoveChainData?.quotes || expectedMoveChainData.quotes.length === 0 || !symbolInfo.price) {
      return;
    }
    
    // Get the nearest available expiration from options chain data (independent of strategy)
    const availableExpirations = expectedMoveChainData.expirations || [];
    if (availableExpirations.length === 0) {
      return;
    }
    
    // Auto-select the nearest expiration for Expected Move calculation
    const nearestExpiration = availableExpirations[0]; // Already sorted by date
    
    // Create a key based on symbol and the NEAREST expiration (NOT strategy expiration)
    const currentKey = `${symbolInfo.symbol}@${nearestExpiration}`;
    
    // Check if we already have cached data for this key
    if (expectedMoveCacheRef.current.has(currentKey)) {
      // Use cached data without recalculating - always ensure state is set
      const cached = expectedMoveCacheRef.current.get(currentKey);
      if (cached) {
        setFrozenExpectedMove(cached);
      }
      return;
    }
    
    const quotes = expectedMoveChainData.quotes;
    const currentPrice = symbolInfo.price;
    
    // Calculate days to expiration using the nearest expiration
    let daysToExpiration = 30;
    if (nearestExpiration) {
      const expDate = new Date(nearestExpiration);
      const today = new Date();
      daysToExpiration = Math.max(1, Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    }
    
    // Get unique strikes sorted
    const uniqueStrikes = Array.from(new Set(quotes.map(q => q.strike))).sort((a, b) => a - b);
    
    if (uniqueStrikes.length === 0) return;
    
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
    
    // Calculate and store frozen expected move
    // Prefer both ATM call and put, but fall back to approximation if one is missing
    let atmStraddle: number | null = null;
    
    if (atmCall !== null && atmPut !== null && atmCall > 0 && atmPut > 0) {
      // Ideal case: we have both ATM call and put
      atmStraddle = atmCall + atmPut;
    } else if (atmCall !== null && atmCall > 0) {
      // Fallback: only have call, approximate straddle as 2x call price
      atmStraddle = atmCall * 2;
    } else if (atmPut !== null && atmPut > 0) {
      // Fallback: only have put, approximate straddle as 2x put price
      atmStraddle = atmPut * 2;
    }
    
    if (atmStraddle !== null) {
      const actualAtmCall = atmCall ?? atmStraddle / 2;
      const actualAtmPut = atmPut ?? atmStraddle / 2;
      
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
        atmCall: actualAtmCall,
        atmPut: actualAtmPut,
        otm1Strangle,
        otm2Strangle,
        lowerBound: currentPrice - expectedMoveValue,
        upperBound: currentPrice + expectedMoveValue,
        movePercent: (expectedMoveValue / currentPrice) * 100,
        currentPrice,
        daysToExpiration,
        expirationDate: nearestExpiration,
      };
      
      // Cache it and set state
      expectedMoveCacheRef.current.set(currentKey, payload);
      setFrozenExpectedMove(payload);
    }
  }, [expectedMoveChainData, symbolInfo.symbol, symbolInfo.price]);

  // Auto-update leg premiums with market data when chain loads or refreshes
  useEffect(() => {
    if (!optionsChainData?.quotes || optionsChainData.quotes.length === 0) {
      return;
    }

    // If symbolChangeId changed since last processed, update our tracking ref
    // This ensures we don't skip legitimate market updates after the first one post-symbol-change
    if (symbolChangeId !== lastProcessedSymbolChangeIdRef.current) {
      console.log('[MARKET-UPDATE] New symbolChangeId detected:', symbolChangeId, '- updating tracking ref');
      lastProcessedSymbolChangeIdRef.current = symbolChangeId;
      // Continue processing - the legs have been reset by useStrategyEngine
    }
    
    // Debug: Log the symbol of the options chain data
    console.log('[MARKET-UPDATE] Processing options chain data, current symbol:', symbolInfo.symbol, 'quotes count:', optionsChainData.quotes.length);

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

    // Use ACTUAL DTE for IV calculation (critical for accuracy)
    const actualDTE = calculateDTE();
    // Use minimum 14 days for THEORETICAL pricing only
    const theoreticalDTE = Math.max(14, actualDTE);

    // Update legs with market prices and populate market fields
    setLegs(currentLegs => {
      let updated = false;
      const newLegs = currentLegs.map(leg => {
        // Find matching market quote (same strike and type)
        const matchingQuote = optionsChainData.quotes.find(
          q => Math.abs(q.strike - leg.strike) < 0.01 && q.side.toLowerCase() === leg.type
        );

        // Check if underlying price changed significantly (symbol change indicator)
        // If entryUnderlyingPrice differs by >20% from current price, it's likely a different symbol
        const underlyingPriceChanged = (leg.entryUnderlyingPrice && symbolInfo?.price &&
          Math.abs(leg.entryUnderlyingPrice - symbolInfo.price) / symbolInfo.price > 0.20);

        // For legs with locked cost basis, ONLY update market fields (never touch premium)
        // UNLESS the underlying price changed significantly (symbol change) - then recalculate
        // Cost basis is locked after initial entry to preserve P/L accuracy
        if ((leg.costBasisLocked || leg.premiumSource === 'manual' || leg.premiumSource === 'saved') && !underlyingPriceChanged) {
          if (matchingQuote) {
            // Check if market fields need updating
            const marketNeedsUpdate = 
              leg.marketBid !== matchingQuote.bid ||
              leg.marketAsk !== matchingQuote.ask ||
              leg.marketMark !== matchingQuote.mid ||
              leg.marketLast !== matchingQuote.last;
            
            // Calculate fresh IV from current market price for display purposes
            const effectiveDTE = Math.max(0.5, actualDTE);
            let currentIV = leg.impliedVolatility || 0.3;
            if (matchingQuote.mid > 0 && symbolInfo?.price) {
              currentIV = calculateImpliedVolatility(
                matchingQuote.side as 'call' | 'put',
                symbolInfo.price,
                matchingQuote.strike,
                effectiveDTE,
                matchingQuote.mid
              );
            }
            
            if (marketNeedsUpdate || leg.impliedVolatility !== currentIV) {
              updated = true;
              return deepCopyLeg(leg, {
                marketBid: matchingQuote.bid,
                marketAsk: matchingQuote.ask,
                marketMark: matchingQuote.mid,
                marketLast: matchingQuote.last,
                expirationDays: actualDTE,
                impliedVolatility: currentIV,
              });
            }
          }
          return leg;
        }

        if (matchingQuote && matchingQuote.mid > 0) {
          const newPremium = Number(matchingQuote.mid.toFixed(2));
          console.log('[MARKET-UPDATE] Found matching quote for', leg.type, leg.strike, 'mid:', matchingQuote.mid, 'newPremium:', newPremium);
          
          // Update if: price changed, source isn't market, or current premium is missing/invalid
          // Also update if underlying price changed significantly (symbol change)
          const needsUpdate = leg.premium !== newPremium || 
                              leg.premiumSource !== 'market' || 
                              !isFinite(leg.premium) || 
                              leg.premium <= 0 ||
                              leg.marketBid !== matchingQuote.bid ||
                              leg.marketAsk !== matchingQuote.ask ||
                              leg.marketMark !== matchingQuote.mid ||
                              underlyingPriceChanged;
          
          if (needsUpdate) {
            updated = true;
            
            // ALWAYS calculate IV from market price using European Black-Scholes
            // API-provided IV is often unreliable and doesn't match industry standards (OptionStrat)
            // Use at least 0.5 DTE for very short-dated options to avoid solver issues
            const effectiveDTE = Math.max(0.5, actualDTE);
            let calculatedIV = 0.3; // Default fallback
            
            if (matchingQuote.mid > 0 && symbolInfo?.price) {
              calculatedIV = calculateImpliedVolatility(
                matchingQuote.side as 'call' | 'put',
                symbolInfo.price,
                matchingQuote.strike,
                effectiveDTE,
                matchingQuote.mid
              );
            } else if (matchingQuote.iv) {
              // Fallback to API IV only if we can't calculate
              calculatedIV = matchingQuote.iv;
            }
            
            return deepCopyLeg(leg, {
              premium: newPremium,
              marketQuoteId: matchingQuote.optionSymbol,
              premiumSource: 'market' as const,
              impliedVolatility: calculatedIV,
              expirationDays: actualDTE,
              entryUnderlyingPrice: symbolInfo.price,
              marketBid: matchingQuote.bid,
              marketAsk: matchingQuote.ask,
              marketMark: matchingQuote.mid,
              marketLast: matchingQuote.last,
            });
          }
        } else if (!isFinite(leg.premium) || leg.premium <= 0 || (!matchingQuote && underlyingPriceChanged)) {
          // Fallback to theoretical pricing if:
          // 1. Leg has no valid premium, OR
          // 2. No matching quote found AND underlying price changed significantly (symbol change)
          // Stock legs don't need theoretical pricing - they use entry price
          if (leg.type === "stock") return leg;
          
          // Use minimum 14 days for theoretical pricing to show realistic premiums
          if (symbolInfo?.price && symbolInfo.price > 0 && leg.strike > 0) {
            const currentVol = volatility || 0.3;
            const theoreticalPremium = calculateOptionPrice(
              leg.type as "call" | "put",
              symbolInfo.price,
              leg.strike,
              theoreticalDTE,  // Use inflated DTE for theoretical pricing only
              currentVol
            );
            
            if (isFinite(theoreticalPremium) && theoreticalPremium >= 0) {
              updated = true;
              return deepCopyLeg(leg, {
                premium: Number(Math.max(0.01, theoreticalPremium).toFixed(2)),
                premiumSource: 'theoretical' as const,
                expirationDays: actualDTE,  // Store actual DTE even for theoretical
                entryUnderlyingPrice: symbolInfo.price,
              });
            }
          }
          
          // Ultimate fallback: minimal placeholder premium
          updated = true;
          return deepCopyLeg(leg, {
            premium: 0.01,
            premiumSource: 'theoretical' as const,
            expirationDays: actualDTE,
            entryUnderlyingPrice: symbolInfo.price,
          });
        }
        
        return leg;
      });

      return updated ? newLegs : currentLegs;
    });
  }, [optionsChainData, selectedExpirationDate, symbolInfo?.price, volatility, symbolChangeId]);

  // Ensure all legs have valid premiums (fallback to theoretical even when chain data partial)
  // IMPORTANT: Use callback pattern to get current legs state and avoid race conditions
  useEffect(() => {
    // Skip if symbolInfo.price is not valid yet
    if (!symbolInfo?.price || symbolInfo.price <= 0) return;

    const rawDTE = selectedExpirationDate 
      ? Math.max(1, Math.round((new Date(selectedExpirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 30;
    // Use minimum 14 days for theoretical pricing to show realistic premiums
    const daysToExpiration = Math.max(14, rawDTE);
    const currentVol = volatility || 0.3;

    setLegs(currentLegs => {
      if (currentLegs.length === 0) return currentLegs;
      
      // Check if any legs have invalid premiums using CURRENT state
      const hasInvalidPremiums = currentLegs.some(
        leg => leg.premiumSource !== 'manual' && (!isFinite(leg.premium) || leg.premium <= 0)
      );
      
      if (!hasInvalidPremiums) return currentLegs;

      let updated = false;
      const newLegs = currentLegs.map(leg => {
        if (leg.premiumSource === 'manual') return leg;
        if (isFinite(leg.premium) && leg.premium > 0) return leg;
        // Stock legs don't need theoretical pricing
        if (leg.type === "stock") return leg;

        // Calculate theoretical price
        if (leg.strike > 0) {
          const theoreticalPremium = calculateOptionPrice(
            leg.type as "call" | "put",
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
  }, [legs.length, symbolInfo?.price, volatility, optionsChainData?.quotes?.length, selectedExpirationDate]);

  // Sync ALL legs when global expiration changes
  // This ensures heatmap and P/L calculations use consistent expiration across all legs
  const prevExpirationRef = useRef<{ days: number | null; date: string }>({ days: null, date: '' });
  useEffect(() => {
    // Skip if no valid expiration or no legs
    if (!selectedExpirationDate || selectedExpirationDays === null || legs.length === 0) {
      return;
    }
    
    // Skip if expiration hasn't actually changed
    if (prevExpirationRef.current.days === selectedExpirationDays && 
        prevExpirationRef.current.date === selectedExpirationDate) {
      return;
    }
    
    console.log('[EXPIRATION-SYNC] Global expiration changed:', {
      from: prevExpirationRef.current,
      to: { days: selectedExpirationDays, date: selectedExpirationDate }
    });
    
    // Update the ref
    prevExpirationRef.current = { days: selectedExpirationDays, date: selectedExpirationDate };
    
    // Update all legs with the new expiration
    setLegs(currentLegs => {
      let updated = false;
      const newLegs = currentLegs.map(leg => {
        // Skip if leg already has the correct expiration
        if (leg.expirationDate === selectedExpirationDate && leg.expirationDays === selectedExpirationDays) {
          return leg;
        }
        
        updated = true;
        return {
          ...leg,
          expirationDate: selectedExpirationDate,
          expirationDays: selectedExpirationDays,
        };
      });
      
      if (updated) {
        console.log('[EXPIRATION-SYNC] Updated', newLegs.length, 'legs with new expiration:', selectedExpirationDate);
      }
      
      return updated ? newLegs : currentLegs;
    });
  }, [selectedExpirationDate, selectedExpirationDays, legs.length, setLegs]);

  // Use only actual available strikes from API (no extrapolation)
  const availableStrikes = useMemo(() => {
    if (!optionsChainData?.quotes || optionsChainData.quotes.length === 0) return null;
    
    // Use strikes array from API if available, otherwise extract from quotes
    const strikes = optionsChainData.strikes || 
      Array.from(new Set(optionsChainData.quotes.map((q: any) => q.strike))).sort((a: number, b: number) => a - b);
    
    return {
      min: optionsChainData.minStrike,
      max: optionsChainData.maxStrike,
      strikes: strikes as number[],
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
  // IMPORTANT: Use callback to avoid race condition with AUTO-ADJUST effect
  useEffect(() => {
    if (!availableStrikes) return;
    
    setLegs(currentLegs => {
      if (currentLegs.length === 0) return currentLegs;
      
      // Check if any strikes are outside market limits
      const hasOutOfBoundsStrikes = currentLegs.some(
        leg => leg.strike < availableStrikes.min || leg.strike > availableStrikes.max
      );
      
      if (hasOutOfBoundsStrikes) {
        return currentLegs.map(leg => deepCopyLeg(leg, {
          strike: constrainToMarketLimits(leg.strike),
          // Reset premium source since we changed the strike
          premiumSource: 'theoretical' as const,
        }));
      }
      
      return currentLegs; // No change needed
    });
  }, [availableStrikes?.min, availableStrikes?.max]);

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
    // Use ACTUAL DTE for IV calculation (critical for accuracy)
    const actualDTE = rawDTE;
    // Use minimum 14 days for THEORETICAL pricing only
    // (very short DTE causes near-zero prices for OTM options in theoretical mode)
    const theoreticalDTE = Math.max(14, rawDTE);
    const currentVol = volatility || 0.3; // Default IV if not set

    return legsToUpdate.map(leg => {
      // Deep copy closing transaction to preserve immutable entry data
      const preservedClosingTransaction = leg.closingTransaction ? {
        ...leg.closingTransaction,
        entries: leg.closingTransaction.entries?.map(entry => ({ ...entry }))
      } : undefined;
      
      // For legs with locked cost basis, ONLY update market fields (never touch premium)
      // This preserves the original entry price for accurate P/L calculation
      if (leg.costBasisLocked || leg.premiumSource === 'saved') {
        const matchingQuote = optionsChainData?.quotes?.find(
          (q: any) => Math.abs(q.strike - leg.strike) < 0.01 && q.side.toLowerCase() === leg.type
        );
        
        if (matchingQuote) {
          // Update market fields but NOT premium
          const effectiveDTE = Math.max(0.5, actualDTE);
          let currentIV = leg.impliedVolatility || 0.3;
          if (matchingQuote.mid > 0 && symbolInfo?.price) {
            currentIV = calculateImpliedVolatility(
              matchingQuote.side as 'call' | 'put',
              symbolInfo.price,
              matchingQuote.strike,
              effectiveDTE,
              matchingQuote.mid
            );
          }
          
          return {
            ...leg,
            marketBid: matchingQuote.bid,
            marketAsk: matchingQuote.ask,
            marketMark: matchingQuote.mid,
            marketLast: matchingQuote.last,
            impliedVolatility: currentIV,
            expirationDays: actualDTE,
            closingTransaction: preservedClosingTransaction,
          };
        }
        // No matching quote - return leg unchanged
        return { ...leg, closingTransaction: preservedClosingTransaction };
      }
      
      // Try to find matching market quote (same strike and type)
      const matchingQuote = optionsChainData?.quotes?.find(
        (q: any) => Math.abs(q.strike - leg.strike) < 0.01 && q.side.toLowerCase() === leg.type
      );

      if (matchingQuote && matchingQuote.mid > 0) {
        const newPremium = Number(matchingQuote.mid.toFixed(2));
        
        // ALWAYS calculate IV from market price using European Black-Scholes
        // API-provided IV is often unreliable and doesn't match industry standards (OptionStrat)
        // Use at least 0.5 DTE for very short-dated options to avoid solver issues
        const effectiveDTE = Math.max(0.5, actualDTE);
        let calculatedIV = 0.3; // Default fallback
        
        if (matchingQuote.mid > 0 && symbolInfo?.price) {
          calculatedIV = calculateImpliedVolatility(
            matchingQuote.side as 'call' | 'put',
            symbolInfo.price,
            matchingQuote.strike,
            effectiveDTE,
            matchingQuote.mid
          );
          
        } else if (matchingQuote.iv) {
          // Fallback to API IV only if we can't calculate
          calculatedIV = matchingQuote.iv;
        }
        
        return {
          ...leg,
          premium: newPremium,
          marketQuoteId: matchingQuote.optionSymbol,
          premiumSource: 'market' as const,
          impliedVolatility: calculatedIV,
          expirationDays: actualDTE,
          entryUnderlyingPrice: symbolInfo.price,
          closingTransaction: preservedClosingTransaction,
        };
      }
      
      // Fallback: Calculate theoretical price using Black-Scholes
      // Stock legs don't need theoretical pricing - they use entry price
      if (leg.type === "stock") {
        return {
          ...leg,
          closingTransaction: preservedClosingTransaction,
        };
      }
      
      // Use minimum 14 days for theoretical pricing to show realistic premiums
      if (symbolInfo?.price && symbolInfo.price > 0 && leg.strike > 0) {
        const theoreticalPremium = calculateOptionPrice(
          leg.type as "call" | "put",
          symbolInfo.price,
          leg.strike,
          theoreticalDTE,  // Use inflated DTE for theoretical pricing only
          currentVol
        );
        
        // Ensure we have a valid, finite premium
        if (isFinite(theoreticalPremium) && theoreticalPremium >= 0) {
          return {
            ...leg,
            premium: Number(Math.max(0.01, theoreticalPremium).toFixed(2)),
            premiumSource: 'theoretical' as const,
            expirationDays: actualDTE,  // Store actual DTE even for theoretical
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
        expirationDays: actualDTE,
        entryUnderlyingPrice: symbolInfo?.price,
        closingTransaction: preservedClosingTransaction,
      };
    });
  };

  const addLeg = (legTemplate: Omit<OptionLeg, "id">, preserveOrderFromId?: string) => {
    const newId = Date.now().toString();
    
    // Use setLegs with callback to properly access current legs state
    setLegs(prevLegs => {
      // Calculate visualOrder: if template has one, use it; otherwise get next available
      let visualOrder = legTemplate.visualOrder;
      if (visualOrder === undefined) {
        // Assign next visual order (max existing + 1)
        const existingOrders = prevLegs.map(l => l.visualOrder ?? 0);
        visualOrder = existingOrders.length > 0 ? Math.max(...existingOrders) + 1 : 0;
      }
      
      const newLeg: OptionLeg = {
        ...legTemplate,
        id: newId,
        visualOrder,
      };
      // Apply market prices immediately to get accurate pricing
      const [legWithPrice] = applyMarketPrices([newLeg]);
      // Lock the cost basis so premium never updates after entry
      const legWithLockedCostBasis: OptionLeg = {
        ...legWithPrice,
        costBasisLocked: true,
      };
      return [...prevLegs, legWithLockedCostBasis];
    });
    // Clear frozen P/L values so live calculations take over
    setInitialPLFromSavedTrade(null);
  };

  const updateLeg = (id: string, updates: Partial<OptionLeg>) => {
    setLegs(prevLegs => prevLegs.map((leg) => {
      if (leg.id !== id) return leg;
      
      // Check if closingTransaction is explicitly being updated (even to undefined)
      const hasClosingTransactionUpdate = 'closingTransaction' in updates;
      
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
        // Use the update's closingTransaction if explicitly provided (even if undefined),
        // otherwise preserve the existing one
        closingTransaction: hasClosingTransactionUpdate 
          ? updates.closingTransaction 
          : preservedClosingTransaction
      };
    }));
    // Clear frozen P/L values so live calculations take over
    setInitialPLFromSavedTrade(null);
  };

  const removeLeg = (id: string) => {
    setLegs(prevLegs => prevLegs.filter((leg) => {
      if (leg.id !== id) return true; // Keep other legs
      
      // Check if this leg has closed entries
      const closedEntries = leg.closingTransaction?.entries || [];
      const hasClosedEntries = closedEntries.length > 0 && leg.closingTransaction?.isEnabled;
      const closedQty = closedEntries.reduce((sum, e) => sum + e.quantity, 0);
      
      // For stock legs that are FULLY closed (sold), allow complete deletion
      if (leg.type === "stock" && hasClosedEntries && closedQty >= leg.quantity) {
        return false; // Remove completely
      }
      
      // For options with closed entries, don't remove - just zero out open position
      if (hasClosedEntries) {
        // This case shouldn't happen with new architecture but keep for safety
        return true;
      }
      
      // No closed entries - remove completely
      return false;
    }).map((leg) => {
      if (leg.id !== id) return leg;
      
      // If we're here, it's an option with partial close - set quantity to closed qty
      const closedEntries = leg.closingTransaction?.entries || [];
      const closedQty = closedEntries.reduce((sum, e) => sum + e.quantity, 0);
      return deepCopyLeg(leg, { quantity: closedQty });
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
      
      // For stock legs, set entry price to current price and strike to 0
      if (leg.type === "stock") {
        return deepCopyLeg(leg, {
          strike: 0,
          premium: currentPrice,
          entryUnderlyingPrice: currentPrice,
          costBasisLocked: true,
          id: Date.now().toString() + leg.id + index,
        });
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
        <div className="container mx-auto px-2 sm:px-4 md:px-6 flex h-10 items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <div 
              className="flex items-center gap-1 sm:gap-1.5 cursor-pointer" 
              onClick={() => setLocation("/")}
            >
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <span className="text-sm sm:text-lg font-bold">OptionBuild</span>
            </div>

            {/* Desktop navigation */}
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
            
            {/* Mobile navigation dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs md:hidden" data-testid="button-mobile-menu">
                  <ChevronDown className="h-3 w-3" />
                  Menu
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => setLocation(`/option-finder?symbol=${symbolInfo.symbol}`)}>
                  <Search className="h-3 w-3 mr-2" />
                  Option Finder
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/backtest")}>
                  <BarChart3 className="h-3 w-3 mr-2" />
                  Backtest
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/saved-trades")}>
                  <Bookmark className="h-3 w-3 mr-2" />
                  Saved Trades
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1">
            <Link href="/tutorial">
              <Button variant="ghost" size="sm" className="h-7 px-1 sm:px-2 text-xs hidden sm:flex" data-testid="button-tutorials">
                <BookOpen className="h-3 w-3 sm:mr-1" />
                <span className="hidden lg:inline">Tutorials</span>
              </Button>
            </Link>
            <Button variant="ghost" size="sm" className="h-7 px-1 sm:px-2 text-xs hidden sm:flex" data-testid="button-blog">
              <FileText className="h-3 w-3 sm:mr-1" />
              <span className="hidden lg:inline">Blog</span>
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
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={startTutorial}
              title="Tutorial"
              data-testid="button-help-tutorial"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
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

              <EquityPanel
                legs={legs}
                currentPrice={symbolInfo.price}
                symbol={symbolInfo.symbol}
                onUpdateLeg={updateLeg}
                onRemoveLeg={removeLeg}
                onAddStockLeg={() => {
                  addLeg({
                    type: "stock",
                    strike: 0,
                    position: "long",
                    quantity: 100,
                    premium: symbolInfo.price,
                    expirationDays: 0,
                    entryUnderlyingPrice: symbolInfo.price,
                    costBasisLocked: true,
                  });
                }}
                onAddStockLegWithDetails={(quantity, entryPrice, position, closingTransaction) => {
                  addLeg({
                    type: "stock",
                    strike: 0,
                    position: position,
                    quantity: quantity,
                    premium: entryPrice,
                    expirationDays: 0,
                    entryUnderlyingPrice: entryPrice,
                    costBasisLocked: true,
                    closingTransaction: closingTransaction,
                  });
                }}
              />

              <StrikeLadder
                legs={legs.filter(l => l.type !== "stock")}
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
                allAvailableExpirations={optionsExpirationsData?.expirations || []}
                onChangeGlobalExpiration={setSelectedExpiration}
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
                  isManualVolatility={isManualVolatility}
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
                  isManualVolatility={isManualVolatility}
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

      <TutorialOverlay isOpen={showTutorial} onClose={closeTutorial} />

      <Footer />
    </div>
  );
}
