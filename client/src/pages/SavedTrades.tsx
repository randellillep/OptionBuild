import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { TrendingUp, Download, Star, Settings, ArrowLeft, Trash2 } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery, useMutation, useQueries } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { OptionLeg, SavedTrade } from "@shared/schema";
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
  const recalculateExpirationDays = (leg: OptionLeg, tradeExpirationDate?: string | null): number => {
    const expDateStr = leg.expirationDate || tradeExpirationDate;
    if (expDateStr) {
      try {
        const expDate = new Date(expDateStr);
        const today = new Date();
        const diffTime = expDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

    // Normalize legs with recalculated expirationDays based on current date
    // IMPORTANT: Always force premiumSource to 'saved' for saved trades
    // This ensures P/L calculation uses the stored premium as cost basis
    const legs = rawLegs.map(leg => ({
      ...leg,
      expirationDays: recalculateExpirationDays(leg, trade.expirationDate),
      premiumSource: 'saved' as const,  // Force 'saved' - these are saved trades with stored cost basis
    }));

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
      if (showFilter === "active") {
        const exp = getDaysUntilExpiration(trade.expirationDate);
        return exp ? exp.days >= 0 : true;
      }
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
    // Store the trade data to load in builder
    localStorage.setItem('loadTrade', JSON.stringify(trade));
    setLocation('/builder?loadSaved=true');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/builder" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back to Builder</span>
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="font-bold text-lg">OptionFlow</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isAuthenticated && user && (
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || 'User'} />
                <AvatarFallback>{user.firstName?.[0] || 'U'}</AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2" data-testid="text-page-title">Saved Trades</h1>
          <p className="text-muted-foreground">View and manage your saved option strategies</p>
        </div>

        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Group:</span>
              <Select value={group} onValueChange={setGroup}>
                <SelectTrigger className="w-[120px]" data-testid="select-filter-group">
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

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[140px]" data-testid="select-sort-by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date created</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Show:</span>
              <Select value={showFilter} onValueChange={setShowFilter}>
                <SelectTrigger className="w-[100px]" data-testid="select-show-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1" />

            <Button 
              variant="default" 
              size="sm" 
              onClick={handleExport}
              data-testid="button-export"
            >
              <Download className="h-4 w-4 mr-1.5" />
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Name</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Total Return</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Today's Return</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Created At</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Days Until Expiration</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map((trade) => {
                    const totalReturn = calculateTotalReturn(trade);
                    const expInfo = getDaysUntilExpiration(trade.expirationDate);
                    
                    return (
                      <tr 
                        key={trade.id} 
                        className="border-b border-border/50 hover-elevate cursor-pointer"
                        onClick={() => openTradeInBuilder(trade)}
                        data-testid={`row-trade-${trade.id}`}
                      >
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <button 
                              className="text-muted-foreground/50 hover:text-yellow-500 transition-colors"
                              onClick={(e) => { e.stopPropagation(); }}
                              data-testid={`button-favorite-${trade.id}`}
                            >
                              <Star className="h-4 w-4" />
                            </button>
                            <button 
                              className="text-muted-foreground/50 hover:text-foreground transition-colors"
                              onClick={(e) => { e.stopPropagation(); }}
                              data-testid={`button-settings-${trade.id}`}
                            >
                              <Settings className="h-4 w-4" />
                            </button>
                            <span className="text-primary font-medium hover:underline" data-testid={`text-trade-name-${trade.id}`}>
                              {trade.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className={totalReturn.value >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}>
                            {totalReturn.value >= 0 ? '+' : ''}${totalReturn.value.toFixed(2)} ({totalReturn.percent >= 0 ? '+' : ''}{totalReturn.percent.toFixed(0)}%)
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className="text-muted-foreground">
                            —
                          </span>
                        </td>
                        <td className="py-3 px-2 text-sm text-muted-foreground">
                          {formatDate(trade.savedAt)}
                        </td>
                        <td className="py-3 px-2 text-sm">
                          {expInfo ? (
                            <span className={expInfo.days <= 7 ? 'text-amber-600 dark:text-amber-500 font-medium' : 'text-muted-foreground'}>
                              {expInfo.days}d ({expInfo.dateStr})
                            </span>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              deleteTrade(trade.id);
                            }}
                            data-testid={`button-delete-${trade.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
