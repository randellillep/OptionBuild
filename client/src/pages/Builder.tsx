import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ProfitLossChart } from "@/components/ProfitLossChart";
import { TradingViewSearch } from "@/components/TradingViewSearch";
import { ExpirationTimeline } from "@/components/ExpirationTimeline";
import { StrikeLadder } from "@/components/StrikeLadder";
import { PLHeatmap } from "@/components/PLHeatmap";
import { EquityPanel } from "@/components/EquityPanel";
import { AddLegDropdown } from "@/components/AddLegDropdown";
import { AnalysisTabs } from "@/components/AnalysisTabs";
import { Footer } from "@/components/Footer";
import { TrendingUp, ChevronDown, BookOpen, FileText, User, LogOut, BarChart3, Bookmark, Search, HelpCircle, Loader2 } from "lucide-react";
import { TutorialOverlay, useTutorial } from "@/components/TutorialOverlay";
import { AIChatAssistant } from "@/components/AIChatAssistant";
import { SaveTradeModal } from "@/components/SaveTradeModal";
import { ExecuteTradeModal } from "@/components/ExecuteTradeModal";
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
  const [isExecuteTradeOpen, setIsExecuteTradeOpen] = useState(false);
  const [legConfigVersion, setLegConfigVersion] = useState(0);
  const [analysisTab, setAnalysisTab] = useState("greeks");
  const analysisTabsRef = useRef<HTMLDivElement>(null);
  const [commissionSettings, setCommissionSettings] = useState<CommissionSettings>({
    perTrade: 0,
    perContract: 0,
    roundTrip: false
  });
  const prevSymbolRef = useRef<{ symbol: string; price: number } | null>(null);
  const urlParamsProcessed = useRef(false);
  const [isInitialLoading, setIsInitialLoading] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return !!(params.get('symbol') || params.get('strategy') || sessionStorage.getItem('sharedStrategy'));
  });
  const [openStrategiesOnMount] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('openStrategies') === '1';
  });
  
  useEffect(() => {
    if (isInitialLoading) {
      const safetyTimer = setTimeout(() => setIsInitialLoading(false), 5000);
      return () => clearTimeout(safetyTimer);
    }
  }, [isInitialLoading]);
  
  // Store initial P/L values from SavedTrades for immediate consistency
  // These values are used for the heatmap's current-scenario cell until user makes changes
  const [initialPLFromSavedTrade, setInitialPLFromSavedTrade] = useState<{
    realizedPL: number;
    unrealizedPL: number;
  } | null>(null);

  // Store the saved trade mode and reference prices for heatmap rendering
  const [savedTradeMode, setSavedTradeMode] = useState<'live' | 'expired' | 'closed' | null>(null);
  const [savedTradeEntryPrice, setSavedTradeEntryPrice] = useState<number | null>(null);
  const [savedTradeExitPrice, setSavedTradeExitPrice] = useState<number | null>(null);
  
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
    hasFetchedInitialPrice,
  } = useStrategyEngine(range);
  
  // Track the last processed symbolChangeId to gate effects
  // Using STATE (not ref) so auto-update re-fires after snap-to-nearest processes
  // Start at -1 so the initial symbolChangeId (0) triggers the first ATM leg creation
  const [lastProcessedSymbolChangeId, setLastProcessedSymbolChangeId] = useState(-1);
  
  // Smooth transition when loading a saved trade - prevents flashing as
  // dates/strikes snap to available values and chain data loads
  const [savedTradeSettling, setSavedTradeSettling] = useState(false);
  const savedTradeSettlingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Smooth transition during symbol changes - prevents flickering as
  // multiple effects fire sequentially (AUTO-ADJUST → snap-to-nearest → chain load → premium update)
  const [symbolTransitioning, setSymbolTransitioning] = useState(false);
  const symbolTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Track the leg whose expiration was most recently edited (added or changed via panel)
  const [lastEditedLegId, setLastEditedLegId] = useState<string | null>(null);
  
  // Color palette for multi-expiration visual coding (OptionStrat-style)
  // Slate grey for the first expiration; distinct colors for subsequent ones
  const FIRST_EXPIRATION_COLOR = '#64748b'; // slate-500
  const EXPIRATION_COLORS = [
    '#a855f7', // Purple
    '#22c55e', // Green
    '#3b82f6', // Blue
    '#f97316', // Orange
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#eab308', // Yellow
  ];
  
  // Stable color assignment keyed by leg ID. Each leg keeps its color even when
  // its expiration date changes. The first leg gets slate; subsequent legs get
  // palette colors in order they were first seen.
  const legColorAssignments = useRef<Map<string, string>>(new Map());
  const nextColorIndex = useRef(0);
  
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
    if (uniqueDaysArr.length < 2) {
      if (uniqueDaysArr.length <= 1) {
        legColorAssignments.current.clear();
        nextColorIndex.current = 0;
      }
      return new Map<number, string>();
    }
    
    // Remove assignments for legs that no longer exist
    const activeLegIds = new Set(activeOptionLegs.map(l => l.id));
    for (const key of legColorAssignments.current.keys()) {
      if (!activeLegIds.has(key)) {
        legColorAssignments.current.delete(key);
      }
    }
    
    // Assign a color to each leg (by leg ID) in order of appearance
    for (const leg of activeOptionLegs) {
      if (!legColorAssignments.current.has(leg.id)) {
        const isFirst = legColorAssignments.current.size === 0;
        const color = isFirst
          ? FIRST_EXPIRATION_COLOR
          : EXPIRATION_COLORS[nextColorIndex.current % EXPIRATION_COLORS.length];
        if (!isFirst) {
          nextColorIndex.current++;
        }
        legColorAssignments.current.set(leg.id, color);
      }
    }
    
    // Build the days->color map. For each unique expiration day, use the color
    // of the earliest leg (by position) that has that expiration.
    const map = new Map<number, string>();
    for (const leg of activeOptionLegs) {
      if (!map.has(leg.expirationDays)) {
        const color = legColorAssignments.current.get(leg.id);
        if (color) map.set(leg.expirationDays, color);
      }
    }
    
    return map;
  }, [legs]);

  // Build leg expiration info for timeline (includes expired/expiring-today dates)
  // Only include legs that are still active (not fully closed/sold)
  const legExpirationDates = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const seen = new Set<string>();
    return legs
      .filter(l => {
        if (l.type === 'stock' || !l.expirationDate || l.quantity <= 0) return false;
        if (l.premiumSource === 'saved') return true;
        if (l.closingTransaction?.isEnabled) {
          const closedQty = (l.closingTransaction.entries || []).reduce((sum: number, e: any) => sum + e.quantity, 0);
          if (closedQty >= l.quantity) return false;
        }
        return true;
      })
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

  const volatilityPercent = Math.round(volatility * 1000) / 10;
  const calculatedIVPercent = Math.round(calculatedIV * 1000) / 10;
  
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

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const tabParam = params.get('tab');
    if (tabParam === 'trade') {
      setAnalysisTab('trade');
    }
  }, []);

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
            // Only settle (fade to 40% opacity) for non-expired trades.
            // Expired trades have locked legs that snap-to-nearest won't change,
            // so there is nothing to "settle" and the fade causes visible flickering.
            const legArr = trade.legs as Partial<OptionLeg>[];
            const today0 = new Date();
            today0.setHours(0, 0, 0, 0);
            const allLegsExpired = legArr.length > 0 && legArr.every((l) => {
              if (l.type === 'stock') return false;
              const expDate = l.expirationDate?.split('T')[0];
              if (!expDate) return false;
              return new Date(expDate + 'T00:00:00') < today0;
            });
            if (!allLegsExpired) {
              // Start settling transition - hides intermediate flashing as dates/strikes snap
              setSavedTradeSettling(true);
              if (savedTradeSettlingTimerRef.current) clearTimeout(savedTradeSettlingTimerRef.current);
              // Safety fallback: clear after 2s max in case snap-to-nearest doesn't fire
              savedTradeSettlingTimerRef.current = setTimeout(() => setSavedTradeSettling(false), 2000);
            }
            
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
              
              if (isLegExpired && !leg.closingTransaction?.isEnabled) {
                const underlyingAtExpiry = trade.price || 0;
                const strike = normalLeg.strike;
                const intrinsicValue = normalLeg.type === 'call'
                  ? Math.max(0, underlyingAtExpiry - strike)
                  : Math.max(0, strike - underlyingAtExpiry);
                const lastMarketPrice = normalLeg.marketMark ?? normalLeg.marketLast;
                const closingPrice = lastMarketPrice != null && lastMarketPrice > 0
                  ? lastMarketPrice
                  : intrinsicValue;
                normalLeg.closingTransaction = {
                  quantity: normalLeg.quantity,
                  closingPrice,
                  isEnabled: true,
                  entries: [{
                    id: `exp-${normalLeg.id}`,
                    quantity: normalLeg.quantity,
                    closingPrice,
                    strike: normalLeg.strike,
                    openingPrice: normalLeg.premium,
                    closedAt: expDate || new Date().toISOString().split('T')[0],
                    expirationDate: normalLeg.expirationDate,
                    type: normalLeg.type,
                  }],
                };
                normalLeg.marketBid = closingPrice > 0 ? closingPrice : 0;
                normalLeg.marketAsk = closingPrice > 0 ? closingPrice : 0;
                normalLeg.marketMark = closingPrice > 0 ? closingPrice : 0;
                normalLeg.marketLast = closingPrice > 0 ? closingPrice : 0;
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
                const expDateUTC = new Date(Date.UTC(year, month - 1, day, 21, 0, 0));
                const now = new Date();
                const diffMs = expDateUTC.getTime() - now.getTime();
                const diffDaysFractional = diffMs / (1000 * 60 * 60 * 24);
                
                if (diffDaysFractional > 0) {
                  expirationDays = diffDaysFractional;
                  expirationDateStr = dateOnly;
                } else {
                  const activeFutureLegs = normalizedLegs.filter(l => l.type !== 'stock' && l.expirationDays > 0);
                  if (activeFutureLegs.length > 0) {
                    const latestLeg = activeFutureLegs.reduce((a, b) => a.expirationDays > b.expirationDays ? a : b);
                    expirationDays = latestLeg.expirationDays;
                    expirationDateStr = latestLeg.expirationDate?.split('T')[0] || dateOnly;
                  } else {
                    expirationDays = 0;
                    expirationDateStr = dateOnly;
                  }
                }
              } else {
                expirationDays = 30;
                expirationDateStr = trade.expirationDate;
              }
            } else {
              const activeFutureLegs = normalizedLegs.filter(l => l.type !== 'stock' && l.expirationDays > 0);
              if (activeFutureLegs.length > 0) {
                const latestLeg = activeFutureLegs.reduce((a, b) => a.expirationDays > b.expirationDays ? a : b);
                expirationDays = latestLeg.expirationDays;
                expirationDateStr = latestLeg.expirationDate?.split('T')[0] || '';
                if (!expirationDateStr) {
                  const futureDate = new Date();
                  futureDate.setDate(futureDate.getDate() + Math.ceil(expirationDays));
                  expirationDateStr = futureDate.toISOString().split('T')[0];
                }
              } else {
                const legWithDate = normalizedLegs.find(l => l.type !== 'stock' && l.expirationDate);
                if (legWithDate?.expirationDate) {
                  expirationDateStr = legWithDate.expirationDate.split('T')[0];
                  expirationDays = legWithDate.expirationDays;
                } else {
                  expirationDays = 30;
                  const futureDate = new Date();
                  futureDate.setDate(futureDate.getDate() + 30);
                  expirationDateStr = futureDate.toISOString().split('T')[0];
                }
              }
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

            // Set saved trade mode and reference prices for heatmap rendering
            // This controls whether the heatmap renders as closed/expired/live historical view
            if (trade._savedTradeMode) {
              setSavedTradeMode(trade._savedTradeMode as 'live' | 'expired' | 'closed');
            }
            if (trade._entryUnderlyingPrice != null) {
              setSavedTradeEntryPrice(trade._entryUnderlyingPrice as number);
            }
            if (trade._exitUnderlyingPrice != null) {
              setSavedTradeExitPrice(trade._exitUnderlyingPrice as number);
            } else {
              setSavedTradeExitPrice(null);
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
                const expDateUTC = new Date(Date.UTC(year, month - 1, day, 21, 0, 0));
                const now = new Date();
                const diffMs = expDateUTC.getTime() - now.getTime();
                const diffDaysFractional = diffMs / (1000 * 60 * 60 * 24);
                
                if (diffDaysFractional > 0) {
                  expirationDays = diffDaysFractional;
                  expirationDateStr = dateOnly;
                } else {
                  const activeFutureLegs = normalizedLegs.filter(l => l.type !== 'stock' && l.expirationDays > 0);
                  if (activeFutureLegs.length > 0) {
                    const latestLeg = activeFutureLegs.reduce((a, b) => a.expirationDays > b.expirationDays ? a : b);
                    expirationDays = latestLeg.expirationDays;
                    expirationDateStr = latestLeg.expirationDate?.split('T')[0] || dateOnly;
                  } else {
                    expirationDays = 0;
                    expirationDateStr = dateOnly;
                  }
                }
              } else {
                expirationDays = 30;
                expirationDateStr = strategy.expirationDate;
              }
            } else {
              const activeFutureLegs = normalizedLegs.filter(l => l.type !== 'stock' && l.expirationDays > 0);
              if (activeFutureLegs.length > 0) {
                const latestLeg = activeFutureLegs.reduce((a, b) => a.expirationDays > b.expirationDays ? a : b);
                expirationDays = latestLeg.expirationDays;
                expirationDateStr = latestLeg.expirationDate?.split('T')[0] || '';
                if (!expirationDateStr) {
                  const futureDate = new Date();
                  futureDate.setDate(futureDate.getDate() + Math.ceil(expirationDays));
                  expirationDateStr = futureDate.toISOString().split('T')[0];
                }
              } else {
                const legWithDate = normalizedLegs.find(l => l.type !== 'stock' && l.expirationDate);
                if (legWithDate?.expirationDate) {
                  expirationDateStr = legWithDate.expirationDate.split('T')[0];
                  expirationDays = legWithDate.expirationDays;
                } else {
                  expirationDays = 30;
                  const futureDate = new Date();
                  futureDate.setDate(futureDate.getDate() + 30);
                  expirationDateStr = futureDate.toISOString().split('T')[0];
                }
              }
            }
            
            setSelectedExpiration(expirationDays, expirationDateStr);
            sessionStorage.removeItem('sharedStrategy');
            setTimeout(() => setIsInitialLoading(false), 400);
          }
        }
      } catch {
        setIsInitialLoading(false);
      }
      window.history.replaceState({}, '', '/builder');
      return;
    }
    
    if (strategyIndex !== null || urlSymbol) {
      urlParamsProcessed.current = true;
      
      const applyTemplateWithPrice = (templateIndex: number, price: number) => {
        if (templateIndex < 0 || templateIndex >= strategyTemplates.length) return;
        const template = strategyTemplates[templateIndex];
        const currentPrice = price > 0 ? price : 100;
        const atmStrike = roundStrike(currentPrice, 'nearest');
        
        const adjustedLegs: OptionLeg[] = template.legs.map((leg, index) => {
          if (leg.type === "stock") {
            return deepCopyLeg(leg, {
              strike: 0,
              premium: currentPrice,
              entryUnderlyingPrice: currentPrice,
              costBasisLocked: true,
              id: Date.now().toString() + leg.id + index,
            });
          }
          
          let newStrike = atmStrike;
          switch (template.name) {
            case "Long Call":
            case "Long Put":
            case "Short Call":
            case "Short Put":
            case "Cash-Secured Put":
              newStrike = atmStrike;
              break;
            case "Covered Call":
              newStrike = roundStrike(currentPrice * 1.05, 'up');
              break;
            case "Protective Put":
              newStrike = roundStrike(currentPrice * 0.95, 'down');
              break;
            case "Collar":
              if (leg.type === "call") newStrike = roundStrike(currentPrice * 1.05, 'up');
              else if (leg.type === "put") newStrike = roundStrike(currentPrice * 0.95, 'down');
              break;
            case "Bull Call Spread":
              newStrike = index === 0 ? atmStrike : roundStrike(currentPrice * 1.05, 'up');
              break;
            case "Bull Put Spread":
              newStrike = leg.position === "short" ? atmStrike : roundStrike(currentPrice * 0.95, 'down');
              break;
            case "Bear Put Spread":
              newStrike = index === 0 ? atmStrike : roundStrike(currentPrice * 0.95, 'down');
              break;
            case "Bear Call Spread":
              newStrike = leg.position === "short" ? atmStrike : roundStrike(currentPrice * 1.05, 'up');
              break;
            case "Bull Call Ladder":
              if (index === 0) newStrike = atmStrike;
              else if (index === 1) newStrike = roundStrike(currentPrice * 1.05, 'up');
              else newStrike = roundStrike(currentPrice * 1.10, 'up');
              break;
            case "Bear Put Ladder":
              if (index === 0) newStrike = atmStrike;
              else if (index === 1) newStrike = roundStrike(currentPrice * 0.95, 'down');
              else newStrike = roundStrike(currentPrice * 0.90, 'down');
              break;
            case "Long Synthetic Future":
            case "Short Synthetic Future":
              newStrike = atmStrike;
              break;
            case "Long Straddle":
            case "Short Straddle":
              newStrike = atmStrike;
              break;
            case "Long Strangle":
            case "Short Strangle":
              newStrike = leg.type === "call" ? roundStrike(currentPrice * 1.05, 'up') : roundStrike(currentPrice * 0.95, 'down');
              break;
            case "Iron Condor":
            case "Inverse Iron Condor":
              if (index === 0) newStrike = roundStrike(currentPrice * 0.95, 'down');
              else if (index === 1) newStrike = roundStrike(currentPrice * 0.90, 'down');
              else if (index === 2) newStrike = roundStrike(currentPrice * 1.05, 'up');
              else if (index === 3) newStrike = roundStrike(currentPrice * 1.10, 'up');
              break;
            case "Iron Butterfly":
              if (leg.position === "short") newStrike = atmStrike;
              else if (leg.type === "put") newStrike = roundStrike(currentPrice * 0.95, 'down');
              else newStrike = roundStrike(currentPrice * 1.05, 'up');
              break;
            case "Long Call Butterfly":
            case "Long Put Butterfly":
            case "Butterfly Spread":
              if (index === 0) newStrike = roundStrike(currentPrice * 0.95, 'down');
              else if (index === 1) newStrike = atmStrike;
              else newStrike = roundStrike(currentPrice * 1.05, 'up');
              break;
            case "Broken Wing Butterfly":
              if (index === 0) newStrike = roundStrike(currentPrice * 0.95, 'down');
              else if (index === 1) newStrike = atmStrike;
              else newStrike = roundStrike(currentPrice * 1.10, 'up');
              break;
            case "Jade Lizard":
              if (index === 0) newStrike = roundStrike(currentPrice * 1.05, 'up');
              else if (index === 1) newStrike = roundStrike(currentPrice * 0.95, 'down');
              else newStrike = roundStrike(currentPrice * 0.90, 'down');
              break;
            case "Call Ratio Backspread":
              newStrike = index === 0 ? atmStrike : roundStrike(currentPrice * 1.05, 'up');
              break;
            case "Put Ratio Backspread":
              newStrike = index === 0 ? atmStrike : roundStrike(currentPrice * 0.95, 'down');
              break;
            case "Strip":
            case "Strap":
            case "Guts":
            case "Short Guts":
              newStrike = leg.type === "call" ? roundStrike(currentPrice * 1.05, 'up') : roundStrike(currentPrice * 0.95, 'down');
              break;
            case "Calendar Spread":
            case "Diagonal Spread":
              newStrike = atmStrike;
              break;
            case "Double Diagonal":
              newStrike = leg.type === "call" ? roundStrike(currentPrice * 1.05, 'up') : roundStrike(currentPrice * 0.95, 'down');
              break;
            default: {
              const strikeOffset = leg.strike - 100;
              newStrike = roundStrike(atmStrike + strikeOffset, 'nearest');
              break;
            }
          }
          
          return deepCopyLeg(leg, {
            strike: newStrike,
            id: Date.now().toString() + leg.id + index,
            expirationDays: selectedExpirationDays || leg.expirationDays || 30,
            expirationDate: selectedExpirationDate || undefined,
          });
        });
        
        setLegs(adjustedLegs);
      };
      
      const targetSymbol = urlSymbol || symbolInfo.symbol;
      const parsedTemplateIndex = strategyIndex !== null ? parseInt(strategyIndex, 10) : -1;
      
      fetch(`/api/stock/quote/${encodeURIComponent(targetSymbol)}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          const realPrice = data?.price || 100;
          prevSymbolRef.current = { symbol: targetSymbol, price: realPrice };
          setSymbolInfo({ symbol: targetSymbol, price: realPrice });
          if (!isNaN(parsedTemplateIndex) && parsedTemplateIndex >= 0) {
            applyTemplateWithPrice(parsedTemplateIndex, realPrice);
          }
          setTimeout(() => setIsInitialLoading(false), 600);
        })
        .catch(() => {
          prevSymbolRef.current = { symbol: targetSymbol, price: symbolInfo.price };
          setSymbolInfo(prev => ({ ...prev, symbol: targetSymbol }));
          if (!isNaN(parsedTemplateIndex) && parsedTemplateIndex >= 0) {
            applyTemplateWithPrice(parsedTemplateIndex, symbolInfo.price);
          }
          setTimeout(() => setIsInitialLoading(false), 600);
        });
      
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
    
    console.log('[AUTO-ADJUST] Symbol changed, clearing legs for clean transition');
    
    // Start smooth transition - dims UI while data loads
    setSymbolTransitioning(true);
    if (symbolTransitionTimerRef.current) clearTimeout(symbolTransitionTimerRef.current);
    
    // Skip during saved trade settling - the loaded legs should keep their original strikes
    // But allow clearing when user searches a NEW ticker after a saved trade is loaded
    if (savedTradeSettling) {
      console.log('[AUTO-ADJUST] Skipping - saved trade settling, keeping original strikes');
      prevSymbolRef.current = current;
      return;
    }
    
    // Clear legs entirely - snap-to-nearest will create the ATM leg
    // with the correct expiration date in a single step (no intermediate dates)
    setLegs([]);
    
    // Only update prevSymbolRef after successful adjustment
    prevSymbolRef.current = current;
  }, [symbolInfo.symbol, symbolInfo.price]);

  // Options chain for the STRATEGY (requires user to select expiration)
  // Disabled for expired/closed historical saved trades — the expired date no longer has chain
  // data, and fetching it from the API would return wrong (future) expiration quotes.
  const isHistoricalSavedTrade = savedTradeMode === 'expired' || savedTradeMode === 'closed';
  const { data: optionsChainData, isLoading: isLoadingChain, error: chainError } = useOptionsChain({
    symbol: symbolInfo.symbol,
    expiration: selectedExpirationDate || undefined,
    enabled: !!symbolInfo.symbol && !!selectedExpirationDate && !isHistoricalSavedTrade,
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
  // Increments every 30s to trigger periodic re-fetch of multi-expiration chain data
  const [multiChainRevision, setMultiChainRevision] = useState(0);
  
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
    if (!symbolInfo.symbol || expirationsNeedingFetch.length === 0 || isHistoricalSavedTrade) {
      if (multiChainData.size > 0) {
        setMultiChainData(new Map());
        multiChainFetchRef.current = '';
      }
      return;
    }

    const fetchKey = `${symbolInfo.symbol}-${expirationsNeedingFetch.join(',')}-r${multiChainRevision}`;
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
  }, [symbolInfo.symbol, expirationsNeedingFetch, multiChainRevision]);

  // Two live-update timers:
  // 1. Every 30s: bump multiChainRevision to re-fetch multi-expiration chain data
  // 2. Every 60s: recalculate leg.expirationDays from expirationDate so heatmap
  //    theta decay stays accurate throughout the trading session (critical for 0DTE/1DTE)
  useEffect(() => {
    const multiChainTimer = setInterval(() => {
      setMultiChainRevision(r => r + 1);
    }, 30000);

    const dteTimer = setInterval(() => {
      setLegs(currentLegs => {
        const now = Date.now();
        let changed = false;
        const newLegs = currentLegs.map(leg => {
          if (leg.type === 'stock' || !leg.expirationDate) return leg;
          const dateOnly = leg.expirationDate.split('T')[0];
          const parts = dateOnly.split('-').map(Number);
          if (parts.length !== 3) return leg;
          const [y, m, d] = parts;
          // Options expire at 4pm ET = 21:00 UTC (approximation)
          const expUTC = new Date(Date.UTC(y, m - 1, d, 21, 0, 0));
          const liveDTE = Math.max(0, (expUTC.getTime() - now) / (1000 * 60 * 60 * 24));
          // Only update if DTE changed by more than ~1.4 minutes (0.001 days)
          if (Math.abs(liveDTE - (leg.expirationDays ?? 0)) > 0.001) {
            changed = true;
            return { ...leg, expirationDays: liveDTE };
          }
          return leg;
        });
        return changed ? newLegs : currentLegs;
      });
    }, 60000);

    return () => {
      clearInterval(multiChainTimer);
      clearInterval(dteTimer);
    };
  }, []); // Empty deps - safe because setLegs uses callback form

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
  // If legs are empty (cleared by AUTO-ADJUST), create fresh ATM leg with correct date
  useEffect(() => {
    if (symbolChangeId <= lastProcessedSymbolChangeId) return;
    if (!optionsExpirationsData?.expirations || optionsExpirationsData.expirations.length === 0) return;
    // Wait for real price before creating initial ATM leg (avoid using hardcoded default)
    if (!hasFetchedInitialPrice && symbolChangeId === 0) return;
    // Wait for URL params to be processed before creating default legs
    if (isInitialLoading) return;
    // Don't snap dates while a saved trade is settling - prevents flickering.
    // Mark the current symbolChangeId as processed so this effect doesn't re-fire
    // when savedTradeSettling clears — the expired-leg guard already protects leg values.
    if (savedTradeSettling) {
      setLastProcessedSymbolChangeId(symbolChangeId);
      return;
    }
    // For expired/closed historical saved trades, preserve the original leg expirations
    // and strikes exactly as saved — never snap to the nearest available date/strike.
    if (savedTradeMode === 'expired' || savedTradeMode === 'closed') {
      setLastProcessedSymbolChangeId(symbolChangeId);
      return;
    }
    
    const availableDates = optionsExpirationsData.expirations;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Find a good default expiration: prefer ~2-3 weeks out for better premium/theta
    const futureDates = availableDates.filter(d => d >= todayStr);
    const targetDaysOut = 18;
    let preferredFutureDate = futureDates[0] || availableDates[0];
    if (futureDates.length > 1) {
      const targetTime = today.getTime() + targetDaysOut * 24 * 60 * 60 * 1000;
      let bestDate = futureDates[0];
      let bestDiff = Math.abs(new Date(futureDates[0]).getTime() - targetTime);
      for (const d of futureDates) {
        const diff = Math.abs(new Date(d).getTime() - targetTime);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestDate = d;
        }
      }
      preferredFutureDate = bestDate;
    }
    
    const recalcDays = (dateStr: string): number => {
      const dateOnly = dateStr.split('T')[0];
      const [year, month, day] = dateOnly.split('-').map(Number);
      const expDateUTC = new Date(Date.UTC(year, month - 1, day, 21, 0, 0));
      const diffMs = expDateUTC.getTime() - today.getTime();
      return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
    };
    
    const optionLegs = legs.filter(l => l.type !== 'stock' && l.quantity > 0);
    
    if (optionLegs.length === 0 && symbolInfo.price > 0) {
      const atmStrike = roundStrike(symbolInfo.price, 'nearest');
      const expDays = recalcDays(preferredFutureDate);
      const theoreticalDTE = Math.max(14, expDays);
      const newPremium = Math.max(0.01, Number(
        calculateOptionPrice('call', symbolInfo.price, atmStrike, theoreticalDTE, 0.3).toFixed(2)
      ));
      
      console.log(`[SNAP] Creating ATM leg: ${atmStrike}C, exp ${preferredFutureDate}, premium $${newPremium}`);
      
      const newLeg: OptionLeg = {
        id: `auto-${Date.now()}`,
        type: 'call',
        position: 'long',
        strike: atmStrike,
        quantity: 1,
        premium: newPremium,
        expirationDays: expDays,
        expirationDate: preferredFutureDate,
        visualOrder: 0,
      };
      
      setLegs([newLeg]);
      setSelectedExpiration(expDays, preferredFutureDate);
      setLastProcessedSymbolChangeId(symbolChangeId);
      
      // Safety timeout - premium update effect will clear it sooner when chain loads
      if (symbolTransitioning) {
        symbolTransitionTimerRef.current = setTimeout(() => {
          setSymbolTransitioning(false);
        }, 3000);
      }
      return;
    }
    
    // Existing legs: snap their dates to available dates for the new symbol
    const findNearestDate = (targetDate: string): string => {
      if (availableDates.includes(targetDate)) return targetDate;
      const targetTime = new Date(targetDate).getTime();
      let nearest = availableDates[0];
      let minDiff = Math.abs(new Date(nearest).getTime() - targetTime);
      for (const d of availableDates) {
        const diff = Math.abs(new Date(d).getTime() - targetTime);
        if (diff < minDiff) { minDiff = diff; nearest = d; }
      }
      return nearest;
    };
    
    let anyChanged = false;
    const updatedLegs = legs.map(leg => {
      if (leg.type === 'stock') return leg;
      const legDate = leg.expirationDate?.split('T')[0];
      
      if (legDate) {
        const legDateTime = new Date(legDate + 'T00:00:00');
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        if (legDateTime <= todayStart && leg.premiumSource === 'saved') return leg;
      }
      
      const isFreshLeg = !leg.premiumSource || leg.premiumSource === 'theoretical';
      
      if (!legDate || !availableDates.includes(legDate)) {
        const nearestDate = isFreshLeg ? preferredFutureDate : findNearestDate(legDate || availableDates[0]);
        anyChanged = true;
        return { ...leg, expirationDate: nearestDate, expirationDays: recalcDays(nearestDate) };
      }
      
      return leg;
    });
    
    if (anyChanged) setLegs(updatedLegs);
    
    const firstOptionLeg = updatedLegs.find(l => l.type !== 'stock' && l.expirationDate);
    if (firstOptionLeg?.expirationDate) {
      setSelectedExpiration(firstOptionLeg.expirationDays, firstOptionLeg.expirationDate);
    }
    
    setLastProcessedSymbolChangeId(symbolChangeId);
    
    if (symbolTransitioning) {
      symbolTransitionTimerRef.current = setTimeout(() => setSymbolTransitioning(false), 3000);
    }
  }, [symbolChangeId, optionsExpirationsData, legs, setLegs, setSelectedExpiration, hasFetchedInitialPrice, isInitialLoading, savedTradeSettling]);

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
    
    // Chain data loaded for current symbol - clear symbol transition
    // This fires whether or not legs were updated (handles case where
    // chain data arrives but legs already have correct values)
    if (symbolTransitioning) {
      if (symbolTransitionTimerRef.current) clearTimeout(symbolTransitionTimerRef.current);
      setTimeout(() => setSymbolTransitioning(false), 150);
    }
  }, [optionsChainData, multiChainData, selectedExpirationDate, symbolInfo?.price, volatility, symbolChangeId, lastProcessedSymbolChangeId, legConfigVersion]);

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
  // Ignore stale chain data from a previous symbol during transitions
  const availableStrikes = useMemo(() => {
    if (!optionsChainData?.quotes || optionsChainData.quotes.length === 0) return null;
    if (optionsChainData.symbol && optionsChainData.symbol.toUpperCase() !== symbolInfo.symbol.toUpperCase()) return null;
    
    // Use strikes array from API if available, otherwise extract from quotes
    const strikes = optionsChainData.strikes || 
      Array.from(new Set(optionsChainData.quotes.map((q: any) => q.strike))).sort((a: number, b: number) => a - b);
    
    return {
      min: optionsChainData.minStrike,
      max: optionsChainData.maxStrike,
      strikes: strikes as number[],
    };
  }, [optionsChainData, symbolInfo.symbol]);
  
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
    setSavedTradeMode(null);
  };

  const updateLeg = (id: string, updates: Partial<OptionLeg>) => {
    if ('expirationDate' in updates || 'expirationDays' in updates) {
      setLastEditedLegId(id);
    }
    // If config-significant fields change (strike, type, expiration), we need to
    // re-run the market data effect so the new leg config gets matched to fresh
    // quote data. Increment legConfigVersion to trigger that effect.
    const isConfigChange = 'strike' in updates || 'type' in updates || 'expirationDate' in updates;
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
      
      // When the user moves the strike, changes the type, or changes the expiration,
      // clear stale market data so the heatmap shows correct theoretical P/L immediately
      // instead of a mix of new config + old market data.
      const marketDataClear = isConfigChange ? {
        marketMark: undefined,
        marketBid: undefined,
        marketAsk: undefined,
        marketLast: undefined,
        impliedVolatility: undefined,
        costBasisLocked: false,
        premiumSource: undefined,
      } : {};
      
      return { 
        ...leg, 
        ...marketDataClear,
        ...updates,
        // Use the update's closingTransaction if explicitly provided (even if undefined),
        // otherwise preserve the existing one
        closingTransaction: hasClosingTransactionUpdate 
          ? updates.closingTransaction 
          : preservedClosingTransaction
      };
    }));
    if (isConfigChange) {
      setLegConfigVersion(v => v + 1);
    }
    // Clear frozen P/L values so live calculations take over
    setInitialPLFromSavedTrade(null);
    setSavedTradeMode(null);
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
    setSavedTradeMode(null);
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
      
      switch (template.name) {
        case "Long Call":
        case "Long Put":
        case "Short Call":
        case "Short Put":
        case "Cash-Secured Put":
          newStrike = atmStrike;
          break;
        case "Covered Call":
          newStrike = roundStrike(currentPrice * 1.05, 'up');
          break;
        case "Protective Put":
          newStrike = roundStrike(currentPrice * 0.95, 'down');
          break;
        case "Collar":
          if (leg.type === "call") newStrike = roundStrike(currentPrice * 1.05, 'up');
          else if (leg.type === "put") newStrike = roundStrike(currentPrice * 0.95, 'down');
          break;
        case "Bull Call Spread":
          newStrike = index === 0 ? atmStrike : roundStrike(currentPrice * 1.05, 'up');
          break;
        case "Bull Put Spread":
          newStrike = leg.position === "short" ? atmStrike : roundStrike(currentPrice * 0.95, 'down');
          break;
        case "Bear Put Spread":
          newStrike = index === 0 ? atmStrike : roundStrike(currentPrice * 0.95, 'down');
          break;
        case "Bear Call Spread":
          newStrike = leg.position === "short" ? atmStrike : roundStrike(currentPrice * 1.05, 'up');
          break;
        case "Bull Call Ladder":
          if (index === 0) newStrike = atmStrike;
          else if (index === 1) newStrike = roundStrike(currentPrice * 1.05, 'up');
          else newStrike = roundStrike(currentPrice * 1.10, 'up');
          break;
        case "Bear Put Ladder":
          if (index === 0) newStrike = atmStrike;
          else if (index === 1) newStrike = roundStrike(currentPrice * 0.95, 'down');
          else newStrike = roundStrike(currentPrice * 0.90, 'down');
          break;
        case "Long Synthetic Future":
        case "Short Synthetic Future":
          newStrike = atmStrike;
          break;
        case "Long Straddle":
        case "Short Straddle":
          newStrike = atmStrike;
          break;
        case "Long Strangle":
        case "Short Strangle":
          newStrike = leg.type === "call" ? roundStrike(currentPrice * 1.05, 'up') : roundStrike(currentPrice * 0.95, 'down');
          break;
        case "Iron Condor":
        case "Inverse Iron Condor":
          if (index === 0) newStrike = roundStrike(currentPrice * 0.95, 'down');
          else if (index === 1) newStrike = roundStrike(currentPrice * 0.90, 'down');
          else if (index === 2) newStrike = roundStrike(currentPrice * 1.05, 'up');
          else if (index === 3) newStrike = roundStrike(currentPrice * 1.10, 'up');
          break;
        case "Iron Butterfly":
          if (leg.position === "short") newStrike = atmStrike;
          else if (leg.type === "put") newStrike = roundStrike(currentPrice * 0.95, 'down');
          else newStrike = roundStrike(currentPrice * 1.05, 'up');
          break;
        case "Long Call Butterfly":
        case "Long Put Butterfly":
        case "Butterfly Spread":
          if (index === 0) newStrike = roundStrike(currentPrice * 0.95, 'down');
          else if (index === 1) newStrike = atmStrike;
          else newStrike = roundStrike(currentPrice * 1.05, 'up');
          break;
        case "Broken Wing Butterfly":
          if (index === 0) newStrike = roundStrike(currentPrice * 0.95, 'down');
          else if (index === 1) newStrike = atmStrike;
          else newStrike = roundStrike(currentPrice * 1.10, 'up');
          break;
        case "Jade Lizard":
          if (index === 0) newStrike = roundStrike(currentPrice * 1.05, 'up');
          else if (index === 1) newStrike = roundStrike(currentPrice * 0.95, 'down');
          else newStrike = roundStrike(currentPrice * 0.90, 'down');
          break;
        case "Call Ratio Backspread":
          newStrike = index === 0 ? atmStrike : roundStrike(currentPrice * 1.05, 'up');
          break;
        case "Put Ratio Backspread":
          newStrike = index === 0 ? atmStrike : roundStrike(currentPrice * 0.95, 'down');
          break;
        case "Strip":
        case "Strap":
        case "Guts":
        case "Short Guts":
          newStrike = leg.type === "call" ? roundStrike(currentPrice * 1.05, 'up') : roundStrike(currentPrice * 0.95, 'down');
          break;
        case "Calendar Spread":
        case "Diagonal Spread":
          newStrike = atmStrike;
          break;
        case "Double Diagonal":
          newStrike = leg.type === "call" ? roundStrike(currentPrice * 1.05, 'up') : roundStrike(currentPrice * 0.95, 'down');
          break;
        default: {
          const strikeOffset = leg.strike - 100;
          newStrike = roundStrike(atmStrike + strikeOffset, 'nearest');
          break;
        }
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
    <div className="min-h-screen bg-background min-w-[768px]">
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
              <StrategySelector onSelectStrategy={loadTemplate} initialOpen={openStrategiesOnMount} />

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
            <Link href="/blog">
              <Button variant="ghost" size="sm" className="h-7 px-1 sm:px-2 text-xs hidden sm:flex" data-testid="button-blog">
                <FileText className="h-3 w-3 sm:mr-1" />
                <span className="hidden lg:inline">Blog</span>
              </Button>
            </Link>
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
          </div>
        </div>
      </header>

      {isInitialLoading && (
        <div className="fixed inset-0 top-10 z-[60] bg-background flex items-center justify-center" data-testid="loading-overlay">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading strategy...</span>
          </div>
        </div>
      )}

      <div className={`container mx-auto px-3 md:px-4 py-2 transition-opacity duration-300 ${(savedTradeSettling || symbolTransitioning) ? 'opacity-40' : 'opacity-100'}`}>
        <div className="space-y-2">
          <TradingViewSearch 
            symbolInfo={symbolInfo} 
            onSymbolChange={(info) => {
              if (info.symbol !== symbolInfo.symbol && isHistoricalSavedTrade) {
                setSavedTradeMode(null);
                setInitialPLFromSavedTrade(null);
                setSavedTradeEntryPrice(null);
                setSavedTradeExitPrice(null);
              }
              setSymbolInfo(info);
            }}
            onSaveTrade={() => setIsSaveTradeOpen(true)}
            onExecuteTrade={() => setIsExecuteTradeOpen(true)}
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
              {isHistoricalSavedTrade ? (
                <div className="flex items-center gap-2 px-1 py-1 text-sm" data-testid="historical-expiration-label">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Expiration:</span>
                  {selectedExpirationDate && (() => {
                    const [y, m, d] = selectedExpirationDate.split('-').map(Number);
                    const dateObj = new Date(y, m - 1, d);
                    const label = dateObj.toLocaleString('default', { month: 'short', day: 'numeric', year: 'numeric' });
                    return (
                      <span className="font-semibold text-foreground font-mono">{label}</span>
                    );
                  })()}
                  <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${
                    savedTradeMode === 'expired'
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                      : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                  }`}>
                    {savedTradeMode === 'expired' ? 'Expired' : 'Closed'}
                  </span>
                </div>
              ) : (
              <ExpirationTimeline
                expirationDays={uniqueExpirationDays}
                selectedDays={selectedExpirationDays}
                onSelectDays={handleTimelineExpirationChange}
                onAutoSelect={setSelectedExpiration}
                symbol={symbolInfo.symbol}
                activeLegsExpirations={legs.some(l => l.type !== 'stock' && l.quantity > 0) ? uniqueExpirationDays : []}
                expirationColorMap={expirationColorMap}
                legExpirationDates={legExpirationDates}
                suppressAutoSelect={symbolTransitioning || savedTradeMode === 'expired' || savedTradeMode === 'closed'}
              />
              )}

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
                isHistoricalMode={isHistoricalSavedTrade}
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
                  savedTradeMode={savedTradeMode ?? undefined}
                  entryUnderlyingPrice={savedTradeEntryPrice ?? undefined}
                  exitUnderlyingPrice={savedTradeExitPrice ?? undefined}
                  selectedExpirationDate={selectedExpirationDate ?? undefined}
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

              <div ref={analysisTabsRef}>
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
                  calculatedIV={calculatedIV}
                  activeTab={analysisTab}
                  onTabChange={setAnalysisTab}
                />
              </div>
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

      <ExecuteTradeModal
        isOpen={isExecuteTradeOpen}
        onClose={() => setIsExecuteTradeOpen(false)}
        legs={legs}
        symbol={symbolInfo.symbol}
        currentPrice={symbolInfo.price}
        onGoToTradeTab={() => {
          setAnalysisTab("trade");
          setTimeout(() => {
            analysisTabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 100);
        }}
      />

      <TutorialOverlay isOpen={showTutorial} onClose={closeTutorial} />

      <Footer />
    </div>
  );
}
