import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import type { SymbolInfo } from "@/hooks/useStrategyEngine";
import { useQuery } from "@tanstack/react-query";

interface SymbolSearchBarProps {
  symbolInfo: SymbolInfo;
  onSymbolChange: (info: SymbolInfo) => void;
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

export function SymbolSearchBar({ symbolInfo, onSymbolChange }: SymbolSearchBarProps) {
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

  return (
    <Card className="px-3 py-2">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search symbol..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              className="pl-8 h-8 text-sm"
              data-testid="input-symbol-search"
            />
            {isSearching && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
          </div>

          {showSuggestions && searchTerm && (
            <Card className="absolute top-full mt-2 w-full z-50 max-h-96 overflow-y-auto">
              {isSearching ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                  Searching...
                </div>
              ) : searchResults?.results && searchResults.results.length > 0 ? (
                <div className="p-2">
                  {searchResults.results.map((result) => (
                    <button
                      key={result.symbol}
                      onClick={() => handleSymbolSelect(result.symbol)}
                      className="w-full text-left p-3 hover-elevate active-elevate-2 rounded-md transition-colors"
                      data-testid={`button-symbol-${result.symbol.toLowerCase()}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold font-mono">{result.displaySymbol || result.symbol}</div>
                          <div className="text-sm text-muted-foreground">{result.name}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No symbols found
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="flex items-center gap-3 border-l border-border pl-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold font-mono">{symbolInfo.symbol}</span>
            <span className="text-base font-semibold font-mono">${symbolInfo.price.toFixed(2)}</span>
            {currentQuote && (
              <span className={`text-xs flex items-center gap-0.5 ${currentQuote.changePercent >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                {currentQuote.changePercent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {currentQuote.changePercent >= 0 ? '+' : ''}{currentQuote.changePercent.toFixed(2)}%
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 mt-2 flex-wrap">
        <span className="text-xs text-muted-foreground self-center">Quick:</span>
        {popularSymbols.map((symbol) => {
          const quote = popularQuotes.data?.find(q => q.symbol === symbol);
          return (
            <Button
              key={symbol}
              variant="outline"
              size="sm"
              onClick={() => handleSymbolSelect(symbol)}
              data-testid={`button-quick-${symbol.toLowerCase()}`}
              className="gap-1 h-7 px-2 text-xs"
            >
              {symbol}
              {quote && (
                <span className={`text-[10px] ${quote.changePercent >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                  {quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(1)}%
                </span>
              )}
            </Button>
          );
        })}
      </div>
    </Card>
  );
}
