import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Footer } from "@/components/Footer";
import { TrendingUp, Download, Star, Settings, ArrowLeft, Trash2, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery, useMutation, useQueries } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { OptionLeg, SavedTrade, MarketOptionChainSummary } from "@shared/schema";
import { calculateRealizedUnrealizedPL } from "@/lib/options-pricing";

export default function SavedTrades() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [group, setGroup] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [showFilter, setShowFilter] = useState("active");

  const { data: trades = [], isLoading } = useQuery<SavedTrade[]>({
    queryKey: ['/api/trades'],
    enabled: isAuthenticated,
  });

  // Get unique symbols from all trades to fetch current prices
  const uniqueSymbols = useMemo(() => {
    return Array.from(new Set(trades.map(t => t.symbol)));
  }, [trades]);

  // Get unique (symbol, expiration) pairs for fetching options chain data
  // IMPORTANT: Collect expirations from BOTH trade.expirationDate AND individual leg.expirationDate
  // This ensures multi-expiration strategies (spreads, rolls) get market data for all legs
  const uniqueSymbolExpirations = useMemo(() => {
    const pairs: { symbol: string; expiration: string }[] = [];
    const seen = new Set<string>();
    trades.forEach(trade => {
      // Add trade-level expiration
      if (trade.expirationDate) {
        const key = `${trade.symbol}|${trade.expirationDate}`;
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push({ symbol: trade.symbol, expiration: trade.expirationDate });
        }
      }
      // Also add each leg's individual expiration (for multi-expiration strategies)
      const legs = (trade.legs as OptionLeg[]) || [];
      legs.forEach(leg => {
        if (leg.expirationDate) {
          const key = `${trade.symbol}|${leg.expirationDate}`;
          if (!seen.has(key)) {
            seen.add(key);
            pairs.push({ symbol: trade.symbol, expiration: leg.expirationDate });
          }
        }
      });
    });
    return pairs;
  }, [trades]);

  // Fetch current prices for all unique symbols
  const priceQueries = useQueries({
    queries: uniqueSymbols.map(symbol => ({
      queryKey: ['/api/stock/quote', symbol],
      enabled: !!symbol,
      refetchInterval: 10000, // Refresh every 10 seconds for live updates
      refetchIntervalInBackground: true, // Keep refreshing even when tab is in background
      refetchOnMount: 'always' as const, // Always fetch fresh data on mount
      staleTime: 5000,
    })),
  });

  // Fetch options chain for each unique (symbol, expiration) pair
  const optionsChainQueries = useQueries({
    queries: uniqueSymbolExpirations.map(({ symbol, expiration }) => ({
      queryKey: ['/api/options/chain', symbol, expiration] as const,
      queryFn: async () => {
        const url = `/api/options/chain/${encodeURIComponent(symbol)}?expiration=${encodeURIComponent(expiration)}`;
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) return null;
        return await response.json() as MarketOptionChainSummary;
      },
      enabled: !!symbol && !!expiration,
      refetchInterval: 30000, // Refresh every 30 seconds
      staleTime: 15000,
    })),
  });

  // Build a map of (symbol, expiration) -> options quotes
  const optionsChainMap = useMemo(() => {
    const chainMap: Record<string, MarketOptionChainSummary> = {};
    uniqueSymbolExpirations.forEach(({ symbol, expiration }, index) => {
      const queryResult = optionsChainQueries[index];
      if (queryResult?.data) {
        chainMap[`${symbol}|${expiration}`] = queryResult.data;
      }
    });
    return chainMap;
  }, [uniqueSymbolExpirations, optionsChainQueries]);

  // Build a map of symbol -> current price
  const currentPrices = useMemo(() => {
    const priceMap: Record<string, number> = {};
    uniqueSymbols.forEach((symbol, index) => {
      const queryResult = priceQueries[index];
      if (queryResult?.data && typeof queryResult.data === 'object' && 'price' in queryResult.data) {
        priceMap[symbol] = (queryResult.data as { price: number }).price;
      }
    });
    return priceMap;
  }, [uniqueSymbols, priceQueries]);

  const deleteMutation = useMutation({
    mutationFn: async (tradeId: string) => {
      await apiRequest('DELETE', `/api/trades/${tradeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trades'] });
    },
  });

  const deleteTrade = (tradeId: string) => {
    deleteMutation.mutate(tradeId);
  };

  const isLegFullyClosed = useCallback((leg: OptionLeg): boolean => {
    if (!leg.closingTransaction?.isEnabled) return false;
    const entriesQty = (leg.closingTransaction.entries || []).reduce((sum: number, e: any) => sum + (e.quantity || 0), 0);
    if (entriesQty >= leg.quantity) return true;
    if (leg.closingTransaction.quantity && leg.closingTransaction.quantity >= leg.quantity) return true;
    return false;
  }, []);

  const isTradeFullyExpiredOrClosed = useCallback((trade: SavedTrade): boolean => {
    const rawLegs = (trade.legs as OptionLeg[]) || [];
    if (rawLegs.length === 0) return false;
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    return rawLegs.every(leg => {
      if (isLegFullyClosed(leg)) return true;
      const expDateStr = (leg.expirationDate || trade.expirationDate)?.split('T')[0];
      if (expDateStr) {
        return new Date(expDateStr + 'T00:00:00') < todayDate;
      }
      return false;
    });
  }, [isLegFullyClosed]);

  // Determine the state of a trade dynamically at runtime (per spec)
  // closed: all legs have exit data (closing transactions)
  // expired: no exit data but all legs are past expiry date
  // live: some or all legs are before expiry
  const getTradeState = useCallback((trade: SavedTrade): 'live' | 'expired' | 'closed' => {
    const rawLegs = (trade.legs as OptionLeg[]) || [];
    if (rawLegs.length === 0) return 'live';
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const allClosed = rawLegs.every(leg => isLegFullyClosed(leg));
    if (allClosed) return 'closed';
    const allExpired = rawLegs.every(leg => {
      if (isLegFullyClosed(leg)) return true;
      const expDateStr = (leg.expirationDate || trade.expirationDate)?.split('T')[0];
      if (!expDateStr) return false;
      return new Date(expDateStr + 'T00:00:00') < todayDate;
    });
    if (allExpired) return 'expired';
    return 'live';
  }, [isLegFullyClosed]);

  // Returns true if the trade has at least one option leg whose expiration is still
  // in the future AND which has not been fully closed (sold). These are the only legs
  // that can be meaningfully "reopened" as a live simulation — expired contracts no
  // longer exist and cannot be traded again.
  const hasAnyReopenableLegs = useCallback((trade: SavedTrade): boolean => {
    const rawLegs = (trade.legs as OptionLeg[]) || [];
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    return rawLegs.some(leg => {
      if (leg.type === 'stock') return false; // Stock positions always re-openable if kept
      if (isLegFullyClosed(leg)) return false; // Already sold — not an open position to reopen
      const expDateStr = (leg.expirationDate || trade.expirationDate)?.split('T')[0];
      if (!expDateStr) return false;
      return new Date(expDateStr + 'T00:00:00') >= todayDate;
    });
  }, [isLegFullyClosed]);

  // Get the exit underlying price from stored closing entries (underlyingPriceAtClose)
  const getExitUnderlyingPrice = useCallback((trade: SavedTrade): number | undefined => {
    const rawLegs = (trade.legs as OptionLeg[]) || [];
    for (const leg of rawLegs) {
      const entries = leg.closingTransaction?.entries || [];
      for (const entry of entries) {
        if ((entry as any).underlyingPriceAtClose != null) {
          return (entry as any).underlyingPriceAtClose as number;
        }
      }
    }
    return undefined;
  }, []);

  const autoClosedTradesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!trades.length) return;
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    trades.forEach(trade => {
      if (autoClosedTradesRef.current.has(trade.id)) return;

      const price = currentPrices[trade.symbol];
      if (!price) return;

      const rawLegs = (trade.legs as OptionLeg[]) || [];
      let hasChanges = false;

      const updatedLegs = rawLegs.map(leg => {
        if (isLegFullyClosed(leg)) return leg;

        const expDateStr = (leg.expirationDate || trade.expirationDate)?.split('T')[0];
        const isExpired = expDateStr
          ? new Date(expDateStr + 'T00:00:00') < todayDate
          : false;

        if (isExpired) {
          hasChanges = true;
          const intrinsicValue = leg.type === 'call'
            ? Math.max(0, price - leg.strike)
            : Math.max(0, leg.strike - price);
          const savedMarket = leg.marketMark ?? leg.marketLast;
          const closingPrice = savedMarket != null && savedMarket > 0
            ? savedMarket
            : intrinsicValue;
          return {
            ...leg,
            expirationDays: 0,
            marketBid: closingPrice,
            marketAsk: closingPrice,
            marketMark: closingPrice,
            marketLast: closingPrice,
            closingTransaction: {
              quantity: leg.quantity,
              closingPrice,
              isEnabled: true,
              entries: [{
                id: `exp-${leg.id}`,
                quantity: leg.quantity,
                closingPrice,
                strike: leg.strike,
                openingPrice: leg.premium,
                closedAt: expDateStr || new Date().toISOString().split('T')[0],
                expirationDate: leg.expirationDate,
                type: leg.type,
                underlyingPriceAtClose: price, // Store underlying at expiry for historical accuracy
              }],
            },
          };
        }
        return leg;
      });

      if (!hasChanges) {
        autoClosedTradesRef.current.add(trade.id);
        return;
      }

      apiRequest('PATCH', `/api/trades/${trade.id}`, { legs: updatedLegs })
        .then(() => {
          autoClosedTradesRef.current.add(trade.id);
          queryClient.invalidateQueries({ queryKey: ['/api/trades'] });
        })
        .catch(err => {
          console.error('Failed to auto-close expired legs for trade:', trade.id, err);
        });
    });
  }, [trades, currentPrices, isLegFullyClosed]);

  const getDaysUntilExpiration = (expirationDate: string | null): { days: number; dateStr: string } | null => {
    if (!expirationDate) return null;
    const expDate = new Date(expirationDate);
    const today = new Date();
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const dateStr = expDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
    return { days: diffDays, dateStr };
  };

  const formatDate = (dateVal: Date | string | null | undefined) => {
    if (!dateVal) return "N/A";
    const date = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Helper to recalculate expirationDays from expirationDate
  // Uses leg's expirationDate first, then falls back to trade's expirationDate
  // Uses fractional days for same-day options to enable time decay visualization
  const recalculateExpirationDays = (leg: OptionLeg, tradeExpirationDate?: string | null): number => {
    const expDateStr = leg.expirationDate || tradeExpirationDate;
    if (expDateStr) {
      try {
        // Parse expiration date - handle both YYYY-MM-DD and ISO datetime formats
        const dateOnly = expDateStr.split('T')[0]; // Extract date part
        const [year, month, day] = dateOnly.split('-').map(Number);
        
        if (isNaN(year) || isNaN(month) || isNaN(day)) {
          return leg.expirationDays || 30;
        }
        
        // Set expiration to 4pm ET (21:00 UTC during EST, 20:00 UTC during EDT)
        const expDateUTC = new Date(Date.UTC(year, month - 1, day, 21, 0, 0));
        
        const now = new Date();
        const diffMs = expDateUTC.getTime() - now.getTime();
        
        // Use fractional days for intraday precision
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return Math.max(0, diffDays);
      } catch {
        return leg.expirationDays || 30;
      }
    }
    return leg.expirationDays || 30;
  };

  const calculateTotalReturn = (trade: SavedTrade): { value: number; percent: number } => {
    // Get current price for this trade's symbol
    const currentPrice = currentPrices[trade.symbol];
    if (!currentPrice) {
      return { value: 0, percent: 0 }; // No price available yet
    }

    // Parse legs from the trade (stored as JSONB)
    const rawLegs = (trade.legs as OptionLeg[]) || [];
    if (rawLegs.length === 0) {
      return { value: 0, percent: 0 };
    }

    // Normalize legs with recalculated expirationDays and market prices
    // IMPORTANT: Always force premiumSource to 'saved' for saved trades
    // This ensures P/L calculation uses the stored premium as cost basis
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const legs = rawLegs.map(leg => {
      const legExpiration = leg.expirationDate || trade.expirationDate;
      const chainKey = legExpiration ? `${trade.symbol}|${legExpiration}` : null;
      const chainData = chainKey ? optionsChainMap[chainKey] : null;
      
      const matchingQuote = chainData?.quotes?.find(
        q => Math.abs(q.strike - leg.strike) < 0.01 && q.side.toLowerCase() === leg.type
      );
      
      const expDateStr = (leg.expirationDate || trade.expirationDate)?.split('T')[0];
      const isExpired = expDateStr
        ? new Date(expDateStr + 'T00:00:00') < todayDate
        : false;

      if (isExpired && !matchingQuote && !leg.closingTransaction?.isEnabled) {
        const intrinsicValue = leg.type === 'call'
          ? Math.max(0, currentPrice - leg.strike)
          : Math.max(0, leg.strike - currentPrice);
        const savedMarket = leg.marketMark ?? leg.marketLast;
        const closingPrice = savedMarket != null && savedMarket > 0
          ? savedMarket
          : intrinsicValue;
        return {
          ...leg,
          expirationDays: 0,
          premiumSource: 'saved' as const,
          marketBid: closingPrice,
          marketAsk: closingPrice,
          marketMark: closingPrice,
          marketLast: closingPrice,
          closingTransaction: {
            quantity: leg.quantity,
            closingPrice,
            isEnabled: true,
            entries: [{
              id: `exp-${leg.id}`,
              quantity: leg.quantity,
              closingPrice,
              strike: leg.strike,
              openingPrice: leg.premium,
              closedAt: expDateStr || new Date().toISOString().split('T')[0],
              expirationDate: leg.expirationDate,
              type: leg.type,
            }],
          },
        };
      }
      
      return {
        ...leg,
        expirationDays: recalculateExpirationDays(leg, trade.expirationDate),
        premiumSource: 'saved' as const,
        marketBid: matchingQuote?.bid,
        marketAsk: matchingQuote?.ask,
        marketMark: matchingQuote?.mid,
        marketLast: matchingQuote?.last,
      };
    });

    // Use EXACTLY the same function as Builder's unrealizedPL display:
    // calculateRealizedUnrealizedPL with the leg's saved IV as fallback
    // This ensures Total Return matches what Builder shows
    const avgIV = legs.reduce((sum, leg) => sum + (leg.impliedVolatility || 0.30), 0) / legs.length;
    const { realizedPL, unrealizedPL } = calculateRealizedUnrealizedPL(legs, currentPrice, avgIV);
    
    const totalReturn = realizedPL + unrealizedPL;
    
    // Calculate total cost basis for percent calculation
    const totalCostBasis = legs.reduce((sum, leg) => {
      const premium = Math.abs(leg.premium) * leg.quantity * 100;
      return sum + premium;
    }, 0);
    
    const percent = totalCostBasis > 0 ? (totalReturn / totalCostBasis) * 100 : 0;
    
    return { value: totalReturn, percent };
  };

  const filteredTrades = trades
    .filter(trade => group === "all" || trade.tradeGroup === group)
    .filter(trade => {
      if (showFilter === "all") return true;
      const fullyDone = isTradeFullyExpiredOrClosed(trade);
      if (showFilter === "active") return !fullyDone;
      if (showFilter === "expired") return fullyDone;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "date") {
        const dateA = a.savedAt ? new Date(a.savedAt).getTime() : 0;
        const dateB = b.savedAt ? new Date(b.savedAt).getTime() : 0;
        return dateB - dateA;
      }
      return a.name.localeCompare(b.name);
    });

  const handleExport = () => {
    const csv = [
      ["Name", "Symbol", "Group", "Expiration", "Created At"].join(","),
      ...filteredTrades.map(t => [
        `"${t.name}"`,
        t.symbol,
        t.tradeGroup || "all",
        t.expirationDate || "N/A",
        t.savedAt ? new Date(t.savedAt).toISOString() : ""
      ].join(","))
    ].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "saved-trades.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const openTradeInBuilder = (trade: SavedTrade) => {
    // Get the current price for this trade's symbol
    const currentPrice = currentPrices[trade.symbol];
    
    // Parse and enrich legs with market data (same as calculateTotalReturn)
    const rawLegs = (trade.legs as OptionLeg[]) || [];
    const todayForBuilder = new Date();
    todayForBuilder.setHours(0, 0, 0, 0);
    const enrichedLegs = rawLegs.map(leg => {
      const legExpiration = leg.expirationDate || trade.expirationDate;
      const chainKey = legExpiration ? `${trade.symbol}|${legExpiration}` : null;
      const chainData = chainKey ? optionsChainMap[chainKey] : null;
      
      const matchingQuote = chainData?.quotes?.find(
        q => Math.abs(q.strike - leg.strike) < 0.01 && q.side.toLowerCase() === leg.type
      );
      
      let expirationDays = leg.expirationDays || 30;
      const expDateStr = (leg.expirationDate || trade.expirationDate)?.split('T')[0];
      if (expDateStr) {
        try {
          const expDate = new Date(expDateStr);
          const today = new Date();
          const diffTime = expDate.getTime() - today.getTime();
          expirationDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        } catch {
          // Keep default
        }
      }
      
      const isExpired = expDateStr
        ? new Date(expDateStr + 'T00:00:00') < todayForBuilder
        : false;

      if (isExpired && !matchingQuote && !leg.closingTransaction?.isEnabled) {
        const price = currentPrice || 0;
        const intrinsicValue = leg.type === 'call'
          ? Math.max(0, price - leg.strike)
          : Math.max(0, leg.strike - price);
        const savedMarket = leg.marketMark ?? leg.marketLast;
        const closingPrice = savedMarket != null && savedMarket > 0
          ? savedMarket
          : intrinsicValue;
        return {
          ...leg,
          expirationDays: 0,
          premiumSource: 'saved' as const,
          marketBid: closingPrice,
          marketAsk: closingPrice,
          marketMark: closingPrice,
          marketLast: closingPrice,
          closingTransaction: {
            quantity: leg.quantity,
            closingPrice,
            isEnabled: true,
            entries: [{
              id: `exp-${leg.id}`,
              quantity: leg.quantity,
              closingPrice,
              strike: leg.strike,
              openingPrice: leg.premium,
              closedAt: expDateStr || new Date().toISOString().split('T')[0],
              expirationDate: leg.expirationDate,
              type: leg.type,
            }],
          },
        };
      }
      
      return {
        ...leg,
        expirationDays,
        premiumSource: 'saved' as const,
        costBasisLocked: true,          // Prevent market data from overriding entry price/quantity
        marketBid: matchingQuote?.bid,
        marketAsk: matchingQuote?.ask,
        marketMark: matchingQuote?.mid,
        marketLast: matchingQuote?.last,
      };
    });
    
    // Calculate the EXACT Total Return value to pass to Builder
    // This ensures Builder shows the identical value without any recalculation differences
    const avgIV = enrichedLegs.reduce((sum, leg) => sum + (leg.impliedVolatility || 0.30), 0) / enrichedLegs.length;
    const { realizedPL, unrealizedPL } = calculateRealizedUnrealizedPL(enrichedLegs, currentPrice || 0, avgIV);
    const totalReturnValue = realizedPL + unrealizedPL;
    
    // Determine the trade state for heatmap rendering in Builder
    const tradeState = getTradeState(trade);
    const exitUnderlyingPrice = getExitUnderlyingPrice(trade);

    // Store enriched trade data with current price and pre-calculated Total Return
    // Builder will use _totalReturn directly for the heatmap's current-scenario cell
    const enrichedTrade = {
      ...trade,
      legs: enrichedLegs,
      _currentPrice: currentPrice, // Pass current price to Builder
      _totalReturn: totalReturnValue, // Pass exact Total Return value for immediate consistency
      _realizedPL: realizedPL,
      _unrealizedPL: unrealizedPL,
      _savedTradeMode: tradeState, // 'live' | 'expired' | 'closed' — for heatmap rendering
      _entryUnderlyingPrice: trade.price, // Underlying at save/entry time
      _exitUnderlyingPrice: exitUnderlyingPrice, // Underlying at close/expiry (if available)
    };
    
    localStorage.setItem('loadTrade', JSON.stringify(enrichedTrade));
    setLocation('/builder?loadSaved=true');
  };

  // "Reopen" a closed/expired trade as a fresh live simulation
  // Creates a clone without exit data so Builder fetches current market prices
  // The original saved trade is NOT modified
  const reopenTradeInBuilder = (trade: SavedTrade, e: React.MouseEvent) => {
    e.stopPropagation();
    const rawLegs = (trade.legs as OptionLeg[]) || [];
    const currentPrice = currentPrices[trade.symbol] || trade.price;
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    // Only include legs that are still relevant for a live simulation:
    //   1. Non-expired open legs → strip closing transactions so Builder fetches live prices
    //   2. Fully-closed (manually sold) legs with future expirations → keep as historical sub-legs
    // Expired non-closed legs are excluded — those contracts no longer exist
    const strippedLegs = rawLegs
      .filter(leg => {
        if (leg.type === 'stock') return true; // Always keep stock positions
        const expDateStr = (leg.expirationDate || trade.expirationDate)?.split('T')[0];
        const isExpiredDate = expDateStr
          ? new Date(expDateStr + 'T00:00:00') < todayDate
          : false;
        // Exclude expired non-closed legs (nothing left to simulate)
        if (isExpiredDate && !isLegFullyClosed(leg)) return false;
        return true;
      })
      .map(leg => {
        const expDateStr = (leg.expirationDate || trade.expirationDate)?.split('T')[0];
        const isExpiredDate = expDateStr
          ? new Date(expDateStr + 'T00:00:00') < todayDate
          : false;
        // Fully-closed legs (sold) and expired ones keep their record as-is
        if (isLegFullyClosed(leg) || isExpiredDate) {
          return { ...leg, premiumSource: 'saved' as const, costBasisLocked: true };
        }
        // Open legs with future expirations: strip exit data for fresh live pricing
        return {
          ...leg,
          premiumSource: 'saved' as const,
          costBasisLocked: true,
          closingTransaction: undefined,
          expirationDays: 30, // Will be recalculated in Builder from expirationDate
          marketBid: undefined,
          marketAsk: undefined,
          marketMark: undefined,
          marketLast: undefined,
        };
      });

    const reopenPayload = {
      ...trade,
      legs: strippedLegs,
      _currentPrice: currentPrice,
      _savedTradeMode: 'live', // Always live for a reopen
      _entryUnderlyingPrice: trade.price,
      _isReopen: true, // Signals Builder that this is a reopened simulation
    };

    localStorage.setItem('loadTrade', JSON.stringify(reopenPayload));
    setLocation('/builder?loadSaved=true');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/builder" className="flex items-center gap-1 sm:gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs sm:text-sm hidden sm:inline">Back to Builder</span>
            </Link>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <div className="flex items-center gap-1 sm:gap-2">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <span className="font-bold text-sm sm:text-lg">OptionBuild</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {isAuthenticated && user && (
              <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || 'User'} />
                <AvatarFallback className="text-xs">{user.firstName?.[0] || 'U'}</AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2" data-testid="text-page-title">Saved Trades</h1>
          <p className="text-sm sm:text-base text-muted-foreground">View and manage your saved option strategies</p>
        </div>

        <Card className="p-3 sm:p-4">
          {/* Mobile-friendly filter controls with better wrapping */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
            <div className="grid grid-cols-3 sm:flex gap-2 sm:gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">Group:</span>
                <Select value={group} onValueChange={setGroup}>
                  <SelectTrigger className="w-full sm:w-[120px] h-8 sm:h-9 text-xs sm:text-sm" data-testid="select-filter-group">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="favorites">Favorites</SelectItem>
                    <SelectItem value="watchlist">Watchlist</SelectItem>
                    <SelectItem value="earnings">Earnings</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">Sort:</span>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-[140px] h-8 sm:h-9 text-xs sm:text-sm" data-testid="select-sort-by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date created</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">Show:</span>
                <Select value={showFilter} onValueChange={setShowFilter}>
                  <SelectTrigger className="w-full sm:w-[160px] h-8 sm:h-9 text-xs sm:text-sm" data-testid="select-show-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired or Closed</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="hidden sm:flex flex-1" />

            <Button 
              variant="default" 
              size="sm" 
              onClick={handleExport}
              className="w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm"
              data-testid="button-export"
            >
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
              Export
            </Button>
          </div>

          {filteredTrades.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-muted-foreground mb-4">No saved trades yet</p>
              <Button variant="outline" onClick={() => setLocation('/builder')} data-testid="button-go-to-builder">
                Go to Builder to create trades
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 sm:py-3 px-2 text-xs sm:text-sm font-medium text-muted-foreground">Name</th>
                    <th className="text-right py-2 sm:py-3 px-2 text-xs sm:text-sm font-medium text-muted-foreground">Total Return</th>
                    <th className="text-right py-2 sm:py-3 px-2 text-xs sm:text-sm font-medium text-muted-foreground hidden sm:table-cell">Today's Return</th>
                    <th className="text-left py-2 sm:py-3 px-2 text-xs sm:text-sm font-medium text-muted-foreground hidden md:table-cell">Created</th>
                    <th className="text-left py-2 sm:py-3 px-2 text-xs sm:text-sm font-medium text-muted-foreground">Expires</th>
                    <th className="text-right py-2 sm:py-3 px-2 text-xs sm:text-sm font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map((trade) => {
                    const totalReturn = calculateTotalReturn(trade);
                    const expInfo = getDaysUntilExpiration(trade.expirationDate);
                    const tradeState = getTradeState(trade);
                    const isHistorical = tradeState === 'closed' || tradeState === 'expired';
                    
                    return (
                      <tr 
                        key={trade.id} 
                        className="border-b border-border/50 hover-elevate cursor-pointer"
                        onClick={() => openTradeInBuilder(trade)}
                        data-testid={`row-trade-${trade.id}`}
                      >
                        <td className="py-2 sm:py-3 px-2">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <button 
                              className="text-muted-foreground/50 hover:text-yellow-500 transition-colors hidden sm:block"
                              onClick={(e) => { e.stopPropagation(); }}
                              data-testid={`button-favorite-${trade.id}`}
                            >
                              <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </button>
                            <button 
                              className="text-muted-foreground/50 hover:text-foreground transition-colors hidden sm:block"
                              onClick={(e) => { e.stopPropagation(); }}
                              data-testid={`button-settings-${trade.id}`}
                            >
                              <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </button>
                            <span className="text-xs sm:text-sm text-primary font-medium hover:underline truncate max-w-[120px] sm:max-w-none" data-testid={`text-trade-name-${trade.id}`}>
                              {trade.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-2 text-right">
                          <span className={`text-xs sm:text-sm font-mono ${totalReturn.value >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}>
                            {totalReturn.value >= 0 ? '+' : ''}${Math.round(totalReturn.value).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                            <span className="hidden sm:inline"> ({totalReturn.percent >= 0 ? '+' : ''}{Math.round(totalReturn.percent)}%)</span>
                          </span>
                        </td>
                        <td className="py-2 sm:py-3 px-2 text-right hidden sm:table-cell">
                          <span className="text-xs sm:text-sm text-muted-foreground">
                            —
                          </span>
                        </td>
                        <td className="py-2 sm:py-3 px-2 text-xs sm:text-sm text-muted-foreground hidden md:table-cell">
                          {formatDate(trade.savedAt)}
                        </td>
                        <td className="py-2 sm:py-3 px-2 text-xs sm:text-sm">
                          {isTradeFullyExpiredOrClosed(trade) ? (
                            <span className="text-muted-foreground">
                              {((trade.legs as OptionLeg[]) || []).every(leg => isLegFullyClosed(leg)) ? 'Closed' : 'Expired'}
                            </span>
                          ) : expInfo ? (
                            <span className={expInfo.days <= 7 ? 'text-amber-600 dark:text-amber-500 font-medium' : 'text-muted-foreground'}>
                              {expInfo.days}d
                              <span className="hidden sm:inline"> ({expInfo.dateStr})</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </td>
                        <td className="py-2 sm:py-3 px-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isHistorical && (() => {
                              const canReopen = hasAnyReopenableLegs(trade);
                              return (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className={`h-7 w-7 sm:h-8 sm:w-8 ${canReopen ? 'text-muted-foreground hover:text-primary' : 'text-muted-foreground/40 cursor-not-allowed'}`}
                                        onClick={canReopen ? (e) => reopenTradeInBuilder(trade, e) : (e) => e.stopPropagation()}
                                        disabled={!canReopen}
                                        data-testid={`button-reopen-${trade.id}`}
                                      >
                                        <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[200px] text-center text-xs">
                                    {canReopen
                                      ? "Reopen as live simulation"
                                      : "All contracts have expired — nothing left to reopen"}
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })()}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-destructive"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                deleteTrade(trade.id);
                              }}
                              data-testid={`button-delete-${trade.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>

      <Footer />
    </div>
  );
}
