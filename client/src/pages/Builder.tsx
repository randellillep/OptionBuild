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
import type { OptionLeg, MarketOptionChainSummary } from "@shared/schema";
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
  // Using STATE (not ref) so auto-update re-fires after snap-to-nearest processes
  const [lastProcessedSymbolChangeId, setLastProcessedSymbolChangeId] = useState(symbolChangeId);
  
  // Smooth transition when loading a saved trade - prevents flashing as
  // dates/strikes snap to available values and chain data loads
  const [savedTradeSettling, setSavedTradeSettling] = useState(false);
  const savedTradeSettlingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Track the leg whose expiration was most recently edited (added or changed via panel)
  const [lastEditedLegId, setLastEditedLegId] = useState<string | null>(null);
  
  // Color palette for multi-expiration visual coding (OptionStrat-style)
  // Each unique expiration gets a distinct color to help identify legs
  const EXPIRATION_COLORS = [
    '#a855f7', // Purple (first expiration)
    '#22c55e', // Green (second expiration)
    '#3b82f6', // Blue
    '#f97316', // Orange
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#eab308', // Yellow
  ];
  
  // Create a mapping from expiration days to colors (sorted by days, earliest first)
  // ONLY color-code when 2+ legs have DIFFERENT expirations
  const expirationColorMap = useMemo(() => {
    const activeOptionLegs = legs.filter(l => {
      if (l.type === "stock") return false;
      if (l.quantity <= 0) return false;
      if (l.closingTransaction?.isEnabled) {
        const closedQty = (l.closingTransaction.entries || []).reduce((sum, e) => sum + e.quantity, 0);
        if (closedQty >= l.quantity) return false;
      }
      return true;
    });
    const uniqueDaysArr = Array.from(new Set(activeOptionLegs.map(l => l.expirationDays)));
    if (uniqueDaysArr.length < 2) return new Map<number, string>();
    
    const sorted = uniqueDaysArr.sort((a, b) => a - b);
    const map = new Map<number, string>();
    sorted.forEach((days, idx) => {
      map.set(days, EXPIRATION_COLORS[idx % EXPIRATION_COLORS.length]);
    });
    return map;
  }, [legs]);

  // Build leg expiration info for timeline (includes expired/expiring-today dates)
  const legExpirationDates = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const seen = new Set<string>();
    return legs
      .filter(l => l.type !== 'stock' && l.expirationDate && l.quantity > 0)
      .map(l => {
        const date = l.expirationDate!.split('T')[0];
        if (seen.has(date)) return null;
        seen.add(date);
        const expDate = new Date(date + 'T00:00:00');
        return {
          date,
          days: l.expirationDays,
          isExpired: expDate < todayStart,
          isToday: expDate.getTime() === todayStart.getTime(),
        };
      })
      .filter(Boolean) as { date: string; days: number; isExpired: boolean; isToday: boolean }[];
  }, [legs]);

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
            // Start settling transition - hides intermediate flashing as dates/strikes snap
            setSavedTradeSettling(true);
            if (savedTradeSettlingTimerRef.current) clearTimeout(savedTradeSettlingTimerRef.current);
            // Safety fallback: clear after 2s max in case snap-to-nearest doesn't fire
            savedTradeSettlingTimerRef.current = setTimeout(() => setSavedTradeSettling(false), 2000);
            
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
            const todayDate = new Date();
            todayDate.setHours(0, 0, 0, 0);
            
            const normalizedLegs: OptionLeg[] = trade.legs.map((leg: Partial<OptionLeg>, index: number) => {
              const expDate = leg.expirationDate?.split('T')[0];
              const isLegExpired = expDate
                ? new Date(expDate + 'T00:00:00') < todayDate
                : false; // Legacy legs without expirationDate are not treated as expired
              
              const normalLeg: OptionLeg = {
                id: leg.id || `saved-${Date.now()}-${index}`,
                type: leg.type || 'call',
                position: leg.position || 'long',
                strike: leg.strike || trade.price || 100,
                quantity: leg.quantity || 1,
                premium: leg.premium || 0,
                expirationDays: recalculateExpirationDays(leg.expirationDate, leg.expirationDays),
                premiumSource: 'saved' as const,
                costBasisLocked: true,
                impliedVolatility: leg.impliedVolatility,
                entryUnderlyingPrice: leg.entryUnderlyingPrice ?? trade.price,
                expirationDate: leg.expirationDate,
                isExcluded: leg.isExcluded,
                closingTransaction: leg.closingTransaction,
                marketBid: leg.marketBid,
                marketAsk: leg.marketAsk,
                marketMark: leg.marketMark,
                marketLast: leg.marketLast,
                visualOrder: leg.visualOrder ?? index,
              };
              
              // Auto-close expired legs at $0 (expired worthless) if not already closed
              // We use $0 as the closing price because we don't have the actual
              // underlying price at expiration. User can edit the closing price
              // in the leg details panel if the option expired with intrinsic value.
              if (isLegExpired && !leg.closingTransaction?.isEnabled) {
                normalLeg.closingTransaction = {
                  quantity: normalLeg.quantity,
                  closingPrice: 0,
                  isEnabled: true,
                  entries: [{
                    id: `exp-${normalLeg.id}`,
                    quantity: normalLeg.quantity,
                    closingPrice: 0,
                    strike: normalLeg.strike,
                    openingPrice: normalLeg.premium,
                    closedAt: expDate || new Date().toISOString().split('T')[0],
                  }],
                };
                normalLeg.marketBid = 0;
                normalLeg.marketAsk = 0;
                normalLeg.marketMark = 0;
                normalLeg.marketLast = 0;
              }
              
              return normalLeg;
            });
            
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
            setSavedTradeSettling(true);
            if (savedTradeSettlingTimerRef.current) clearTimeout(savedTradeSettlingTimerRef.current);
            savedTradeSettlingTimerRef.current = setTimeout(() => setSavedTradeSettling(false), 2000);
            
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
              expirationDays: selectedExpirationDays || leg.expirationDays || 30,
              expirationDate: selectedExpirationDate || undefined,
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
    
    // On symbol change, always reset to a single ATM call option
    // Previous strategy should not carry over to the new symbol
    setLegs(currentLegs => {
      console.log('[AUTO-ADJUST] Current legs count:', currentLegs.length);
      
      // Skip if these are saved/loaded legs - don't adjust their strikes
      const hasSavedLegs = currentLegs.some(leg => leg.premiumSource === 'saved');
      if (hasSavedLegs) {
        console.log('[AUTO-ADJUST] Skipping - saved trade legs should keep original strikes');
        return currentLegs;
      }
      
      // Reset to a single ATM call for the new symbol
      // Use a near-term placeholder date (tomorrow) - snap-to-nearest will
      // update this to the actual nearest available expiration from the API
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 1);
      const expDateStr = targetDate.toISOString().split('T')[0];
      
      // Calculate fractional days to expiration (4pm ET close)
      const [ey, em, ed] = expDateStr.split('-').map(Number);
      const expDateUTC = new Date(Date.UTC(ey, em - 1, ed, 21, 0, 0));
      const daysToExp = Math.max(1, (expDateUTC.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      
      const newPremium = Math.max(0.01, Number(
        calculateOptionPrice('call', current.price, atmStrike, daysToExp, 0.3).toFixed(2)
      ));
      
      console.log(`[AUTO-ADJUST] Resetting to single ATM call: strike ${atmStrike}, premium ${newPremium}, exp ${expDateStr}`);
      
      const newLeg: OptionLeg = {
        id: `auto-${Date.now()}`,
        type: 'call',
        position: 'long',
        strike: atmStrike,
        quantity: 1,
        premium: newPremium,
        expirationDays: daysToExp,
        expirationDate: expDateStr,
        visualOrder: 0,
      };
      
      return [newLeg];
    });
    
    // Don't clear selectedExpirationDate here - the snap-to-nearest effect
    // will update it to the correct nearest future date for the new symbol.
    // Clearing it disables the chain query and delays heatmap updates.
    
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

  // Multi-expiration chain data: fetch separate chains for each unique leg expiration
  // This ensures each leg gets prices from its own expiration's chain
  const [multiChainData, setMultiChainData] = useState<Map<string, MarketOptionChainSummary>>(new Map());
  const multiChainFetchRef = useRef<string>('');
  
  // Compute unique expiration dates from active option legs only
  const uniqueLegExpirationDates = useMemo(() => {
    const dates = new Set<string>();
    legs.forEach(leg => {
      if (leg.type === 'stock' || leg.quantity <= 0 || !leg.expirationDate) return;
      if (leg.closingTransaction?.isEnabled) {
        const closedQty = (leg.closingTransaction.entries || []).reduce((sum, e) => sum + e.quantity, 0);
        if (closedQty >= leg.quantity) return;
      }
      dates.add(leg.expirationDate);
    });
    return Array.from(dates).sort();
  }, [legs]);

  // Fetch chains for leg expirations not covered by the primary chain query.
  // The primary chain fetches for selectedExpirationDate; any leg with a different
  // expiration needs its own chain data via this multi-chain mechanism.
  const expirationsNeedingFetch = useMemo(() => {
    return uniqueLegExpirationDates.filter(d => d !== selectedExpirationDate);
  }, [uniqueLegExpirationDates, selectedExpirationDate]);

  useEffect(() => {
    if (!symbolInfo.symbol || expirationsNeedingFetch.length === 0) {
      if (multiChainData.size > 0) {
        setMultiChainData(new Map());
        multiChainFetchRef.current = '';
      }
      return;
    }

    const fetchKey = `${symbolInfo.symbol}-${expirationsNeedingFetch.join(',')}`;
    if (multiChainFetchRef.current === fetchKey) return;
    multiChainFetchRef.current = fetchKey;

    const fetchChains = async () => {
      const newMap = new Map<string, MarketOptionChainSummary>();
      
      const results = await Promise.allSettled(
        expirationsNeedingFetch.map(async (expDate) => {
          const params = new URLSearchParams({ expiration: expDate });
          const url = `/api/options/chain/${encodeURIComponent(symbolInfo.symbol)}?${params}`;
          const response = await fetch(url, { credentials: 'include' });
          if (!response.ok) return null;
          const data = await response.json();
          return { expDate, data };
        })
      );

      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          newMap.set(result.value.expDate, result.value.data);
        }
      });

      if (newMap.size > 0) {
        console.log('[MULTI-CHAIN] Fetched chains for', newMap.size, 'expirations:', Array.from(newMap.keys()));
        setMultiChainData(newMap);
      }
    };

    fetchChains();
  }, [symbolInfo.symbol, expirationsNeedingFetch]);

  // Helper: get the correct chain data for a leg based on its expiration
  const getChainForLeg = (leg: OptionLeg): MarketOptionChainSummary | undefined => {
    const legExpDate = leg.expirationDate;
    
    // If leg has its own expiration and multi-chain data is available, use it
    if (multiChainData.size > 0 && legExpDate) {
      const legChain = multiChainData.get(legExpDate);
      if (legChain) return legChain;
    }
    
    // Only fall back to primary chain if the leg's expiration matches the global expiration
    // This prevents pricing a leg from the wrong expiration's chain
    if (legExpDate && selectedExpirationDate && legExpDate !== selectedExpirationDate) {
      // Leg has a different expiration than the primary chain - don't use wrong chain
      // Return undefined so the market-update effect skips this leg until correct chain arrives
      return undefined;
    }
    
    return optionsChainData;
  };

  // Fetch available expirations from the same endpoint ExpirationTimeline uses
  // This ensures Change Expiration picker shows same dates as the top bar
  const { data: optionsExpirationsData } = useQuery<{ expirations: string[] }>({
    queryKey: ["/api/options/expirations", symbolInfo.symbol],
    enabled: !!symbolInfo.symbol,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // When symbol changes, snap leg expirations to nearest valid date for the new symbol
  // e.g., AAPL has Feb 23 but JPM only has Feb 24 → update legs to Feb 24
  useEffect(() => {
    if (symbolChangeId <= lastProcessedSymbolChangeId) return;
    if (!optionsExpirationsData?.expirations || optionsExpirationsData.expirations.length === 0) return;
    
    const optionLegs = legs.filter(l => l.type !== 'stock' && l.quantity > 0);
    if (optionLegs.length === 0) {
      setLastProcessedSymbolChangeId(symbolChangeId);
      return;
    }
    
    const availableDates = optionsExpirationsData.expirations;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Find nearest future expiration (first date >= today, sorted ascending)
    const nearestFutureDate = availableDates.find(d => d >= todayStr) || availableDates[0];
    
    const findNearestDate = (targetDate: string): string => {
      if (availableDates.includes(targetDate)) return targetDate;
      
      const targetTime = new Date(targetDate).getTime();
      let nearest = availableDates[0];
      let minDiff = Math.abs(new Date(nearest).getTime() - targetTime);
      
      for (const d of availableDates) {
        const diff = Math.abs(new Date(d).getTime() - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          nearest = d;
        }
      }
      return nearest;
    };
    
    const recalcDays = (dateStr: string): number => {
      const dateOnly = dateStr.split('T')[0];
      const [year, month, day] = dateOnly.split('-').map(Number);
      const expDateUTC = new Date(Date.UTC(year, month - 1, day, 21, 0, 0));
      const diffMs = expDateUTC.getTime() - today.getTime();
      return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
    };
    
    let anyChanged = false;
    const updatedLegs = legs.map(leg => {
      if (leg.type === 'stock') return leg;
      
      // Handle legs without expiration date or with dates not in available list
      const legDate = leg.expirationDate?.split('T')[0];
      
      // Preserve expired/expiring-today dates for saved trades - don't snap them
      if (legDate) {
        const legDateTime = new Date(legDate + 'T00:00:00');
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        if (legDateTime <= todayStart && leg.premiumSource === 'saved') {
          return leg;
        }
      }
      
      // For non-saved legs, default to nearest future expiration
      // This ensures symbol changes always pick the closest available date
      const isFreshLeg = !leg.premiumSource || leg.premiumSource === 'theoretical';
      
      if (!legDate || !availableDates.includes(legDate)) {
        const nearestDate = isFreshLeg ? nearestFutureDate : findNearestDate(legDate || availableDates[0]);
        anyChanged = true;
        return {
          ...leg,
          expirationDate: nearestDate,
          expirationDays: recalcDays(nearestDate),
        };
      }
      
      return leg;
    });
    
    if (anyChanged) {
      setLegs(updatedLegs);
    }
    
    // Always sync the timeline selection with the first leg's expiration
    const firstOptionLeg = updatedLegs.find(l => l.type !== 'stock' && l.expirationDate);
    if (firstOptionLeg?.expirationDate) {
      setSelectedExpiration(
        firstOptionLeg.expirationDays,
        firstOptionLeg.expirationDate
      );
    }
    
    setLastProcessedSymbolChangeId(symbolChangeId);
    
    // Clear the saved trade settling transition after snap completes
    // Small delay allows chain-dependent premium updates to also settle
    if (savedTradeSettling) {
      if (savedTradeSettlingTimerRef.current) clearTimeout(savedTradeSettlingTimerRef.current);
      savedTradeSettlingTimerRef.current = setTimeout(() => {
        setSavedTradeSettling(false);
      }, 300);
    }
  }, [symbolChangeId, optionsExpirationsData, legs, setLegs, setSelectedExpiration]);

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
  // Supports multi-expiration: each leg uses its own expiration's chain data
  useEffect(() => {
    // Need at least primary chain data OR multi-chain data
    const hasPrimaryChain = optionsChainData?.quotes && optionsChainData.quotes.length > 0;
    const hasMultiChain = multiChainData.size > 0;
    if (!hasPrimaryChain && !hasMultiChain) return;

    // Skip if chain data might be stale from previous symbol
    // The snap-to-nearest effect must process the symbol change first
    if (symbolChangeId > lastProcessedSymbolChangeId) return;

    // Verify chain data belongs to the current symbol (prevents stale data from previous symbol)
    if (hasPrimaryChain && optionsChainData?.symbol && optionsChainData.symbol !== symbolInfo.symbol) return;

    // Helper: calculate DTE from a date string
    const calcDTE = (dateStr: string | undefined): number => {
      if (!dateStr) return 30;
      const expDate = new Date(dateStr);
      const today = new Date();
      const expDateUTC = Date.UTC(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
      const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
      return Math.max(1, Math.round((expDateUTC - todayUTC) / (1000 * 60 * 60 * 24)));
    };

    setLegs(currentLegs => {
      let updated = false;
      const nowDate = new Date();
      nowDate.setHours(0, 0, 0, 0);
      const newLegs = currentLegs.map(leg => {
        if (leg.type === "stock") return leg;
        
        // Skip expired legs - no market data to update
        if (leg.expirationDate) {
          const legExp = new Date(leg.expirationDate.split('T')[0] + 'T00:00:00');
          if (legExp < nowDate) return leg;
        }

        // Get the correct chain for THIS leg's expiration
        const legChain = getChainForLeg(leg);
        if (!legChain?.quotes || legChain.quotes.length === 0) return leg;

        // Use THIS leg's DTE for IV calculations (not the global one)
        const legDTE = calcDTE(leg.expirationDate || selectedExpirationDate);
        const effectiveDTE = Math.max(0.5, legDTE);
        const theoreticalDTE = Math.max(14, legDTE);

        // Find matching market quote from this leg's chain
        let matchingQuote = legChain.quotes.find(
          q => Math.abs(q.strike - leg.strike) < 0.01 && q.side.toLowerCase() === leg.type
        );

        // If no exact strike match, snap to nearest available strike
        // This fixes cases where roundStrike produces strikes that don't exist (e.g., 187.5 when only 185/190 available)
        if (!matchingQuote) {
          const sameTypeQuotes = legChain.quotes.filter(q => q.side.toLowerCase() === leg.type);
          if (sameTypeQuotes.length > 0) {
            const nearestQuote = sameTypeQuotes.reduce((closest, q) =>
              Math.abs(q.strike - leg.strike) < Math.abs(closest.strike - leg.strike) ? q : closest
            );
            if (Math.abs(nearestQuote.strike - leg.strike) > 0.01) {
              updated = true;
              const snappedStrike = nearestQuote.strike;
              matchingQuote = nearestQuote;
              return deepCopyLeg(leg, {
                strike: snappedStrike,
                premium: Number(Math.max(0.01, nearestQuote.mid).toFixed(2)),
                marketQuoteId: nearestQuote.optionSymbol,
                premiumSource: 'market' as const,
                impliedVolatility: nearestQuote.mid > 0 && symbolInfo?.price
                  ? calculateImpliedVolatility(
                      nearestQuote.side as 'call' | 'put',
                      symbolInfo.price,
                      snappedStrike,
                      effectiveDTE,
                      nearestQuote.mid
                    )
                  : (nearestQuote.iv || 0.3),
                entryUnderlyingPrice: symbolInfo.price,
                marketBid: nearestQuote.bid,
                marketAsk: nearestQuote.ask,
                marketMark: nearestQuote.mid,
                marketLast: nearestQuote.last,
                costBasisLocked: true,
              });
            }
          }
        }

        const underlyingPriceChanged = (leg.entryUnderlyingPrice && symbolInfo?.price &&
          Math.abs(leg.entryUnderlyingPrice - symbolInfo.price) / symbolInfo.price > 0.20);

        // For legs with locked cost basis, ONLY update market fields
        if ((leg.costBasisLocked || leg.premiumSource === 'manual' || leg.premiumSource === 'saved') && !underlyingPriceChanged) {
          if (matchingQuote) {
            const marketNeedsUpdate = 
              leg.marketBid !== matchingQuote.bid ||
              leg.marketAsk !== matchingQuote.ask ||
              leg.marketMark !== matchingQuote.mid ||
              leg.marketLast !== matchingQuote.last;
            
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
                impliedVolatility: currentIV,
              });
            }
          }
          return leg;
        }

        if (matchingQuote && matchingQuote.mid > 0) {
          const newPremium = Number(matchingQuote.mid.toFixed(2));
          
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
            
            let calculatedIV = 0.3;
            if (matchingQuote.mid > 0 && symbolInfo?.price) {
              calculatedIV = calculateImpliedVolatility(
                matchingQuote.side as 'call' | 'put',
                symbolInfo.price,
                matchingQuote.strike,
                effectiveDTE,
                matchingQuote.mid
              );
            } else if (matchingQuote.iv) {
              calculatedIV = matchingQuote.iv;
            }
            
            return deepCopyLeg(leg, {
              premium: newPremium,
              marketQuoteId: matchingQuote.optionSymbol,
              premiumSource: 'market' as const,
              impliedVolatility: calculatedIV,
              entryUnderlyingPrice: symbolInfo.price,
              marketBid: matchingQuote.bid,
              marketAsk: matchingQuote.ask,
              marketMark: matchingQuote.mid,
              marketLast: matchingQuote.last,
              costBasisLocked: true,
            });
          }
        } else if (!isFinite(leg.premium) || leg.premium <= 0 || (!matchingQuote && underlyingPriceChanged)) {
          if (symbolInfo?.price && symbolInfo.price > 0 && leg.strike > 0) {
            const currentVol = volatility || 0.3;
            const theoreticalPremium = calculateOptionPrice(
              leg.type as "call" | "put",
              symbolInfo.price,
              leg.strike,
              theoreticalDTE,
              currentVol
            );
            
            if (isFinite(theoreticalPremium) && theoreticalPremium >= 0) {
              updated = true;
              return deepCopyLeg(leg, {
                premium: Number(Math.max(0.01, theoreticalPremium).toFixed(2)),
                premiumSource: 'theoretical' as const,
                entryUnderlyingPrice: symbolInfo.price,
              });
            }
          }
          
          updated = true;
          return deepCopyLeg(leg, {
            premium: 0.01,
            premiumSource: 'theoretical' as const,
            entryUnderlyingPrice: symbolInfo.price,
          });
        }
        
        return leg;
      });

      return updated ? newLegs : currentLegs;
    });
  }, [optionsChainData, multiChainData, selectedExpirationDate, symbolInfo?.price, volatility, symbolChangeId, lastProcessedSymbolChangeId]);

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

        // Calculate theoretical price using leg's own DTE if available
        const legDTE = leg.expirationDays > 0 ? Math.max(14, leg.expirationDays) : daysToExpiration;
        if (leg.strike > 0) {
          const theoreticalPremium = calculateOptionPrice(
            leg.type as "call" | "put",
            symbolInfo.price,
            leg.strike,
            legDTE,
            currentVol
          );

          if (isFinite(theoreticalPremium) && theoreticalPremium >= 0) {
            updated = true;
            return deepCopyLeg(leg, {
              premium: Number(Math.max(0.01, theoreticalPremium).toFixed(2)),
              premiumSource: 'theoretical' as const,
              entryUnderlyingPrice: symbolInfo.price,
            });
          }
        }

        // Ultimate fallback
        updated = true;
        return deepCopyLeg(leg, {
          premium: 0.01,
          premiumSource: 'theoretical' as const,
          entryUnderlyingPrice: symbolInfo.price,
        });
      });

      return updated ? newLegs : currentLegs;
    });
  }, [legs.length, symbolInfo?.price, volatility, optionsChainData?.quotes?.length, selectedExpirationDate]);

  // Multi-expiration support: Each leg keeps its own expiration date
  // The global expiration controls the timeline view and is used for new legs
  // Heatmap calculates each leg based on its individual expiration
  // No automatic sync - legs maintain independent expirations for multi-expiration strategies

  // Auto-sync selected expiration when it becomes orphaned (e.g., after deleting legs)
  // This prevents phantom timeline highlights on dates that no longer have any legs
  useEffect(() => {
    const activeOptionLegs = legs.filter(l => l.type !== 'stock' && l.quantity > 0);
    if (activeOptionLegs.length === 0) return;
    
    const remainingDates = new Set(activeOptionLegs.map(l => l.expirationDate).filter(Boolean));
    if (remainingDates.size === 0) return;
    
    // If the currently selected date still has a leg, no sync needed
    if (remainingDates.has(selectedExpirationDate)) return;
    
    // Also check with rounded day comparison for fractional days
    const remainingDayRounds = new Set(activeOptionLegs.map(l => Math.round(l.expirationDays)));
    if (selectedExpirationDays !== null && remainingDayRounds.has(Math.round(selectedExpirationDays))) return;
    
    // Selected date is orphaned - sync to first remaining leg's expiration
    const firstLeg = activeOptionLegs[0];
    if (firstLeg.expirationDate) {
      setSelectedExpiration(firstLeg.expirationDays, firstLeg.expirationDate);
    }
  }, [legs, selectedExpirationDate, selectedExpirationDays, setSelectedExpiration]);

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
      
      // Get the correct chain for THIS leg's expiration
      const legChain = getChainForLeg(leg);

      // For legs with locked cost basis, ONLY update market fields (never touch premium)
      if (leg.costBasisLocked || leg.premiumSource === 'saved') {
        const matchingQuote = legChain?.quotes?.find(
          (q: any) => Math.abs(q.strike - leg.strike) < 0.01 && q.side.toLowerCase() === leg.type
        );
        
        if (matchingQuote) {
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
            closingTransaction: preservedClosingTransaction,
          };
        }
        return { ...leg, closingTransaction: preservedClosingTransaction };
      }
      
      // Try to find matching market quote from this leg's chain
      const matchingQuote = legChain?.quotes?.find(
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
        
        // Preserve leg's own expirationDays if already set, otherwise use global DTE
        const legExpDays = leg.expirationDays > 0 ? leg.expirationDays : actualDTE;
        
        return {
          ...leg,
          premium: newPremium,
          marketQuoteId: matchingQuote.optionSymbol,
          premiumSource: 'market' as const,
          impliedVolatility: calculatedIV,
          expirationDays: legExpDays,
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
      
      // Preserve leg's own expirationDays if already set, otherwise use global DTE
      const legExpDays = leg.expirationDays > 0 ? leg.expirationDays : actualDTE;
      const legTheoreticalDTE = Math.max(14, legExpDays);
      
      // Use minimum 14 days for theoretical pricing to show realistic premiums
      if (symbolInfo?.price && symbolInfo.price > 0 && leg.strike > 0) {
        const theoreticalPremium = calculateOptionPrice(
          leg.type as "call" | "put",
          symbolInfo.price,
          leg.strike,
          legTheoreticalDTE,
          currentVol
        );
        
        // Ensure we have a valid, finite premium
        if (isFinite(theoreticalPremium) && theoreticalPremium >= 0) {
          return {
            ...leg,
            premium: Number(Math.max(0.01, theoreticalPremium).toFixed(2)),
            premiumSource: 'theoretical' as const,
            expirationDays: legExpDays,
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
        expirationDays: legExpDays,
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
    setLastEditedLegId(newId);
    setInitialPLFromSavedTrade(null);
  };

  const updateLeg = (id: string, updates: Partial<OptionLeg>) => {
    if ('expirationDate' in updates || 'expirationDays' in updates) {
      setLastEditedLegId(id);
    }
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
    if (lastEditedLegId === id) setLastEditedLegId(null);
    setLegs(prevLegs => prevLegs.filter((leg) => {
      if (leg.id !== id) return true;
      
      const closedEntries = leg.closingTransaction?.entries || [];
      const hasClosedEntries = closedEntries.length > 0 && leg.closingTransaction?.isEnabled;
      const closedQty = closedEntries.reduce((sum, e) => sum + e.quantity, 0);
      
      if (leg.type === "stock" && hasClosedEntries && closedQty >= leg.quantity) {
        return false;
      }
      
      if (hasClosedEntries) {
        return true;
      }
      
      return false;
    }).map((leg) => {
      if (leg.id !== id) return leg;
      
      const closedEntries = leg.closingTransaction?.entries || [];
      const closedQty = closedEntries.reduce((sum, e) => sum + e.quantity, 0);
      return deepCopyLeg(leg, { quantity: closedQty });
    }));
    setInitialPLFromSavedTrade(null);
  };

  // Handler for clicking a date on the main ExpirationTimeline
  // - Single-expiration strategies (all legs same date): all legs move together
  // - Multi-expiration strategies with tracked leg: only the most recently edited leg changes
  // - Multi-expiration strategies with no tracked leg: only update global selection (don't overwrite legs)
  const handleTimelineExpirationChange = (days: number, dateStr: string) => {
    setSelectedExpiration(days, dateStr);
    
    setLegs(currentLegs => {
      const optionLegs = currentLegs.filter(l => l.type !== "stock");
      if (optionLegs.length === 0) return currentLegs;
      
      const uniqueExpDates = new Set(optionLegs.map(l => l.expirationDate).filter(Boolean));
      const isSingleExpiration = uniqueExpDates.size <= 1;
      
      // Multi-expiration: only change a specific leg if we're tracking one
      if (!isSingleExpiration) {
        if (!lastEditedLegId) {
          return currentLegs;
        }
        return currentLegs.map(leg => {
          if (leg.type === "stock" || leg.id !== lastEditedLegId) return leg;
          return deepCopyLeg(leg, {
            expirationDays: days,
            expirationDate: dateStr,
            costBasisLocked: false,
            premiumSource: undefined,
          });
        });
      }
      
      // Single-expiration: move all legs together
      // Clear costBasisLocked so auto-update can refresh premiums for the new date
      return currentLegs.map(leg => {
        if (leg.type === "stock") return leg;
        return deepCopyLeg(leg, {
          expirationDays: days,
          expirationDate: dateStr,
          costBasisLocked: false,
          premiumSource: undefined,
        });
      });
    });
  };

  const loadTemplate = (templateIndex: number) => {
    const template = strategyTemplates[templateIndex];
    const currentPrice = symbolInfo.price;
    setLastEditedLegId(null);
    
    if (!currentPrice || !isFinite(currentPrice) || currentPrice <= 0) {
      const fallbackLegs = template.legs.map((leg, index) => deepCopyLeg(leg, { 
        id: Date.now().toString() + leg.id + index,
        expirationDays: selectedExpirationDays || leg.expirationDays || 30,
        expirationDate: selectedExpirationDate || undefined,
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
        expirationDays: selectedExpirationDays || leg.expirationDays || 30,
        expirationDate: selectedExpirationDate || undefined,
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

      <div className={`container mx-auto px-3 md:px-4 py-2 transition-opacity duration-300 ${savedTradeSettling ? 'opacity-40' : 'opacity-100'}`}>
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
                selectedExpirationDays={selectedExpirationDays}
                selectedExpirationDate={selectedExpirationDate}
              />
            )}
          />

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 items-start">
            <div className="lg:col-span-3 space-y-2">
              <ExpirationTimeline
                expirationDays={uniqueExpirationDays}
                selectedDays={selectedExpirationDays}
                onSelectDays={handleTimelineExpirationChange}
                onAutoSelect={setSelectedExpiration}
                symbol={symbolInfo.symbol}
                activeLegsExpirations={legs.some(l => l.type !== 'stock' && l.quantity > 0) ? uniqueExpirationDays : []}
                expirationColorMap={expirationColorMap}
                legExpirationDates={legExpirationDates}
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
                expirationColorMap={expirationColorMap}
                getChainForLeg={getChainForLeg}
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
