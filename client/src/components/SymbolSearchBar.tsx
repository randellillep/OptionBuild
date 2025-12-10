import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, TrendingUp, TrendingDown, Loader2, Plus, ListOrdered, Bookmark, Clock } from "lucide-react";
import type { SymbolInfo } from "@/hooks/useStrategyEngine";
import { useQuery } from "@tanstack/react-query";

interface SymbolSearchBarProps {
  symbolInfo: SymbolInfo;
  onSymbolChange: (info: SymbolInfo) => void;
  compact?: boolean; // Minimal search-only mode for Option Finder
  renderAddButton?: () => React.ReactNode; // Optional slot for Add button
}

interface SearchResult {
  symbol: string;
  name: string;
  displaySymbol: string;
}

interface StockQuote {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  timestamp: number;
}

const popularSymbols = ["SPY", "AAPL", "TSLA", "NVDA", "QQQ", "MSFT"];

export function SymbolSearchBar({ symbolInfo, onSymbolChange, compact = false, renderAddButton }: SymbolSearchBarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounce search input
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Search for symbols
  const { data: searchResults, isLoading: isSearching } = useQuery<{ results: SearchResult[] }>({
    queryKey: ["/api/stock/search", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch) return { results: [] };
      const response = await fetch(`/api/stock/search?q=${encodeURIComponent(debouncedSearch)}`);
      if (!response.ok) {
        console.error("Failed to search symbols");
        return { results: [] };
      }
      return await response.json();
    },
    enabled: debouncedSearch.length > 0,
    staleTime: 60000,
  });

  // Fetch current symbol quote
  const { data: currentQuote } = useQuery<StockQuote>({
    queryKey: ["/api/stock/quote", symbolInfo.symbol],
    queryFn: async () => {
      const response = await fetch(`/api/stock/quote/${symbolInfo.symbol}`);
      if (!response.ok) {
        console.error(`Failed to fetch quote for ${symbolInfo.symbol}`);
        throw new Error("Failed to fetch quote");
      }
      return await response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch quotes for popular symbols
  const popularQuotes = useQuery({
    queryKey: ["/api/stock/quotes/popular"],
    queryFn: async () => {
      const quotes = await Promise.all(
        popularSymbols.map(async (symbol) => {
          try {
            const response = await fetch(`/api/stock/quote/${symbol}`);
            if (!response.ok) {
              console.error(`Failed to fetch quote for ${symbol}`);
              return null;
            }
            return await response.json();
          } catch (error) {
            console.error(`Error fetching quote for ${symbol}:`, error);
            return null;
          }
        })
      );
      return quotes.filter((q): q is StockQuote => q !== null);
    },
    staleTime: 60000,
  });

  const handleSymbolSelect = async (symbol: string) => {
    try {
      const response = await fetch(`/api/stock/quote/${symbol}`);
      if (!response.ok) throw new Error("Failed to fetch quote");
      
      const quote: StockQuote = await response.json();
      onSymbolChange({
        symbol: quote.symbol,
        price: quote.price,
      });
      setSearchTerm("");
      setShowSuggestions(false);
    } catch (error) {
      console.error("Error fetching quote:", error);
    }
  };

  // Compact mode: just search input with dropdown
  if (compact) {
    return (
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={symbolInfo.symbol || "Search..."}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            className="pl-8 h-9 text-sm bg-white dark:bg-background border-slate-300 dark:border-border"
            data-testid="input-symbol-search"
          />
          {isSearching && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {showSuggestions && searchTerm && (
          <Card className="absolute top-full mt-1 left-0 w-64 z-[100] max-h-80 overflow-y-auto shadow-lg">
            {isSearching ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                Searching...
              </div>
            ) : searchResults?.results && searchResults.results.length > 0 ? (
              <div className="p-1.5">
                {searchResults.results.map((result) => (
                  <button
                    key={result.symbol}
                    onClick={() => handleSymbolSelect(result.symbol)}
                    className="w-full text-left p-2.5 hover:bg-slate-100 dark:hover:bg-muted rounded-md transition-colors"
                    data-testid={`button-symbol-${result.symbol.toLowerCase()}`}
                  >
                    <div className="font-semibold font-mono text-sm">{result.displaySymbol || result.symbol}</div>
                    <div className="text-xs text-muted-foreground">{result.name}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center text-sm text-muted-foreground">
                No symbols found
              </div>
            )}
          </Card>
        )}
      </div>
    );
  }

  // Full mode with Quick symbols and current price
  return (
    <Card className="px-2 py-1.5">
      <div className="flex items-center gap-2">
        <div className="relative w-32 shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search symbol..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              className="pl-7 h-7 text-xs"
              data-testid="input-symbol-search"
            />
            {isSearching && (
              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>

          {showSuggestions && searchTerm && (
            <Card className="absolute top-full mt-1 w-64 z-50 max-h-80 overflow-y-auto">
              {isSearching ? (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin mx-auto mb-1" />
                  Searching...
                </div>
              ) : searchResults?.results && searchResults.results.length > 0 ? (
                <div className="p-1.5">
                  {searchResults.results.map((result) => (
                    <button
                      key={result.symbol}
                      onClick={() => handleSymbolSelect(result.symbol)}
                      className="w-full text-left p-2 hover-elevate active-elevate-2 rounded-md transition-colors"
                      data-testid={`button-symbol-${result.symbol.toLowerCase()}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold font-mono text-sm">{result.displaySymbol || result.symbol}</div>
                          <div className="text-xs text-muted-foreground">{result.name}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  No symbols found
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-sm font-bold font-mono">{symbolInfo.symbol}</span>
          <span className="text-sm font-semibold font-mono">${symbolInfo.price.toFixed(2)}</span>
          {currentQuote && (
            <span className={`text-[10px] flex items-center gap-0.5 ${currentQuote.changePercent >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
              {currentQuote.changePercent >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              {currentQuote.changePercent >= 0 ? '+' : ''}{currentQuote.changePercent.toFixed(2)}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">Quick:</div>
        <div className="flex items-center gap-1 shrink-0">
          {popularSymbols.map((symbol) => {
            const quote = popularQuotes.data?.find(q => q.symbol === symbol);
            return (
              <Button
                key={symbol}
                variant="outline"
                size="sm"
                onClick={() => handleSymbolSelect(symbol)}
                data-testid={`button-quick-${symbol.toLowerCase()}`}
                className="gap-0.5 h-6 px-1.5 text-[10px]"
              >
                {symbol}
                {quote && (
                  <span className={`text-[9px] ${quote.changePercent >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                    {quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(1)}%
                  </span>
                )}
              </Button>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 border-l border-border pl-2">
          {renderAddButton && renderAddButton()}
          
          <Button 
            variant="default" 
            size="sm" 
            className="h-5 px-1 text-[9px]"
            data-testid="button-positions"
          >
            <ListOrdered className="h-2.5 w-2.5 mr-0.5" />
            Positions (0)
          </Button>
          
          <Button 
            variant="default" 
            size="sm" 
            className="h-5 px-1 text-[9px]"
            data-testid="button-save-trade"
          >
            <Bookmark className="h-2.5 w-2.5 mr-0.5" />
            Save Trade
          </Button>
          
          <Button 
            variant="default" 
            size="sm" 
            className="h-5 px-1 text-[9px]"
            data-testid="button-historical-chart"
          >
            <Clock className="h-2.5 w-2.5 mr-0.5" />
            Historical Chart
          </Button>
        </div>
      </div>
    </Card>
  );
}
