import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, TrendingUp, TrendingDown, Loader2, X, Star, Clock, BarChart3, Landmark, Fuel, ListOrdered, Bookmark } from "lucide-react";
import type { SymbolInfo } from "@/hooks/useStrategyEngine";
import { useQuery } from "@tanstack/react-query";
import { PositionsModal } from "@/components/PositionsModal";
import type { OptionLeg } from "@shared/schema";

interface TradingViewSearchProps {
  symbolInfo: SymbolInfo;
  onSymbolChange: (info: SymbolInfo) => void;
  renderAddButton?: () => React.ReactNode;
  onSaveTrade?: () => void;
  legsCount?: number;
  legs?: OptionLeg[];
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

// Get logo URL - uses backend proxy that fetches from FinancialModelingPrep
const getLogoUrl = (symbol: string): string => {
  return `/api/logo/${symbol.toUpperCase()}`;
};

const popularStocks = [
  { symbol: "AAPL", name: "Apple Inc" },
  { symbol: "MSFT", name: "Microsoft Corporation" },
  { symbol: "GOOGL", name: "Alphabet Inc" },
  { symbol: "AMZN", name: "Amazon.com Inc" },
  { symbol: "NVDA", name: "NVIDIA Corporation" },
  { symbol: "TSLA", name: "Tesla Inc" },
  { symbol: "META", name: "Meta Platforms Inc" },
  { symbol: "JPM", name: "JPMorgan Chase & Co" },
  { symbol: "V", name: "Visa Inc" },
  { symbol: "WMT", name: "Walmart Inc" },
  { symbol: "UNH", name: "UnitedHealth Group" },
  { symbol: "JNJ", name: "Johnson & Johnson" },
];

const mostTradedStocks = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF" },
  { symbol: "QQQ", name: "Invesco QQQ Trust" },
  { symbol: "AMD", name: "Advanced Micro Devices" },
  { symbol: "PLTR", name: "Palantir Technologies" },
  { symbol: "SOFI", name: "SoFi Technologies" },
  { symbol: "NIO", name: "NIO Inc" },
  { symbol: "COIN", name: "Coinbase Global" },
  { symbol: "RIVN", name: "Rivian Automotive" },
];

const indexes = [
  { symbol: "SPX", name: "S&P 500 Index", displayName: "S&P 500" },
  { symbol: "NDX", name: "Nasdaq 100 Index", displayName: "Nasdaq 100" },
  { symbol: "DJI", name: "Dow Jones Industrial Average", displayName: "Dow Jones" },
  { symbol: "RUT", name: "Russell 2000 Index", displayName: "Russell 2000" },
  { symbol: "VIX", name: "CBOE Volatility Index", displayName: "VIX" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", displayName: "Russell 2000 ETF" },
  { symbol: "DIA", name: "SPDR Dow Jones ETF", displayName: "Dow Jones ETF" },
];

const commodities = [
  { symbol: "GLD", name: "SPDR Gold Shares", displayName: "Gold" },
  { symbol: "SLV", name: "iShares Silver Trust", displayName: "Silver" },
  { symbol: "USO", name: "United States Oil Fund", displayName: "Crude Oil" },
  { symbol: "UNG", name: "United States Natural Gas Fund", displayName: "Natural Gas" },
  { symbol: "CORN", name: "Teucrium Corn Fund", displayName: "Corn" },
  { symbol: "WEAT", name: "Teucrium Wheat Fund", displayName: "Wheat" },
  { symbol: "CPER", name: "United States Copper Index", displayName: "Copper" },
];

const etfs = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust" },
  { symbol: "QQQ", name: "Invesco QQQ Trust" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF" },
  { symbol: "EEM", name: "iShares MSCI Emerging Markets" },
  { symbol: "XLF", name: "Financial Select Sector SPDR" },
  { symbol: "XLE", name: "Energy Select Sector SPDR" },
  { symbol: "XLK", name: "Technology Select Sector SPDR" },
  { symbol: "XLV", name: "Health Care Select Sector SPDR" },
];

export function TradingViewSearch({ symbolInfo, onSymbolChange, renderAddButton, onSaveTrade, legsCount = 0, legs = [] }: TradingViewSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState("stocks");
  const [isPositionsModalOpen, setIsPositionsModalOpen] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const modalRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const { data: searchResults, isLoading: isSearching } = useQuery<{ results: SearchResult[] }>({
    queryKey: ["/api/stock/search", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch) return { results: [] };
      const response = await fetch(`/api/stock/search?q=${encodeURIComponent(debouncedSearch)}`);
      if (!response.ok) return { results: [] };
      return response.json();
    },
    enabled: debouncedSearch.length > 0,
  });

  const { data: currentQuote } = useQuery<StockQuote>({
    queryKey: ["/api/stock/quote", symbolInfo.symbol],
    enabled: !!symbolInfo.symbol,
  });

  const handleSymbolSelect = async (symbol: string) => {
    try {
      const response = await fetch(`/api/stock/quote/${symbol}`);
      if (response.ok) {
        const quote: StockQuote = await response.json();
        onSymbolChange({
          symbol: quote.symbol,
          price: quote.price,
        });
      } else {
        onSymbolChange({
          symbol,
          price: symbolInfo.price,
        });
      }
    } catch (error) {
      onSymbolChange({
        symbol,
        price: symbolInfo.price,
      });
    }
    setIsOpen(false);
    setSearchTerm("");
  };

  const SymbolRow = ({ symbol, name, displayName }: { symbol: string; name: string; displayName?: string }) => {
    const [logoError, setLogoError] = useState(false);
    const logoUrl = getLogoUrl(symbol);
    
    return (
      <button
        onClick={() => handleSymbolSelect(symbol)}
        className="w-full flex items-center justify-between p-2.5 hover-elevate active-elevate-2 rounded-md transition-colors group"
        data-testid={`button-symbol-${symbol.toLowerCase()}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center overflow-hidden">
            {!logoError ? (
              <img 
                src={logoUrl} 
                alt={symbol}
                className="w-6 h-6 object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <span className="text-xs font-bold text-primary">{symbol.slice(0, 2)}</span>
            )}
          </div>
          <div className="text-left">
            <div className="font-semibold text-sm">{displayName || symbol}</div>
            <div className="text-xs text-muted-foreground">{name}</div>
          </div>
        </div>
        <Star className="h-4 w-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  };

  return (
    <div className="relative" ref={modalRef}>
      <Card className="px-2 py-1.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border hover-elevate active-elevate-2 transition-colors min-w-[140px]"
            data-testid="button-open-search"
          >
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Search...</span>
          </button>

          <div className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-md bg-muted/50">
            <span className="text-sm font-bold font-mono">{symbolInfo.symbol}</span>
            <span className="text-sm font-semibold font-mono">${symbolInfo.price.toFixed(2)}</span>
            {currentQuote && (
              <span className={`text-[10px] flex items-center gap-0.5 ${currentQuote.changePercent >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                {currentQuote.changePercent >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                {currentQuote.changePercent >= 0 ? '+' : ''}{currentQuote.changePercent.toFixed(2)}%
              </span>
            )}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1.5 shrink-0 mr-4">
            {renderAddButton && renderAddButton()}
            
            <Button 
              variant="outline" 
              size="sm"
              className="bg-sky-100 dark:bg-sky-900/30 border-sky-200 dark:border-sky-800 hover:bg-sky-200 dark:hover:bg-sky-800/50 text-foreground"
              data-testid="button-positions"
              onClick={() => setIsPositionsModalOpen(true)}
            >
              <ListOrdered className="h-3.5 w-3.5 mr-1.5" />
              Positions ({legsCount})
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              className="bg-sky-100 dark:bg-sky-900/30 border-sky-200 dark:border-sky-800 hover:bg-sky-200 dark:hover:bg-sky-800/50 text-foreground"
              onClick={onSaveTrade}
              data-testid="button-save-trade"
            >
              <Bookmark className="h-3.5 w-3.5 mr-1.5" />
              Save Trade
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              className="bg-sky-100 dark:bg-sky-900/30 border-sky-200 dark:border-sky-800 hover:bg-sky-200 dark:hover:bg-sky-800/50 text-foreground"
              data-testid="button-historical-chart"
            >
              <Clock className="h-3.5 w-3.5 mr-1.5" />
              Historical Chart
            </Button>
          </div>
        </div>
      </Card>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50">
          <Card className="w-full max-w-2xl mx-4 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Search stocks, indexes, commodities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 border-0 shadow-none focus-visible:ring-0 text-lg"
                  data-testid="input-search-modal"
                />
                {isSearching && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  data-testid="button-close-search"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {searchTerm && debouncedSearch ? (
                <div className="p-4">
                  <div className="text-xs font-medium text-muted-foreground mb-3">SEARCH RESULTS</div>
                  {isSearching ? (
                    <div className="py-8 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Searching...</p>
                    </div>
                  ) : searchResults?.results && searchResults.results.length > 0 ? (
                    <div className="space-y-1">
                      {searchResults.results.map((result) => (
                        <SymbolRow
                          key={result.symbol}
                          symbol={result.displaySymbol || result.symbol}
                          name={result.name}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-sm text-muted-foreground">No results found for "{searchTerm}"</p>
                    </div>
                  )}
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <div className="border-b border-border px-4">
                    <TabsList className="h-12 bg-transparent p-0 gap-1">
                      <TabsTrigger
                        value="stocks"
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4"
                        data-testid="tab-stocks"
                      >
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Stocks
                      </TabsTrigger>
                      <TabsTrigger
                        value="indexes"
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4"
                        data-testid="tab-indexes"
                      >
                        <Landmark className="h-4 w-4 mr-2" />
                        Indexes
                      </TabsTrigger>
                      <TabsTrigger
                        value="commodities"
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4"
                        data-testid="tab-commodities"
                      >
                        <Fuel className="h-4 w-4 mr-2" />
                        Commodities
                      </TabsTrigger>
                      <TabsTrigger
                        value="etfs"
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4"
                        data-testid="tab-etfs"
                      >
                        <TrendingUp className="h-4 w-4 mr-2" />
                        ETFs
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="stocks" className="m-0 p-4">
                    <div className="mb-6">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3">
                        <Star className="h-3.5 w-3.5" />
                        POPULAR STOCKS
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                        {popularStocks.map((stock) => (
                          <SymbolRow key={stock.symbol} symbol={stock.symbol} name={stock.name} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3">
                        <Clock className="h-3.5 w-3.5" />
                        MOST TRADED
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                        {mostTradedStocks.map((stock) => (
                          <SymbolRow key={stock.symbol} symbol={stock.symbol} name={stock.name} />
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="indexes" className="m-0 p-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3">
                      <Landmark className="h-3.5 w-3.5" />
                      MAJOR INDEXES
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                      {indexes.map((index) => (
                        <SymbolRow
                          key={index.symbol}
                          symbol={index.symbol}
                          name={index.name}
                          displayName={index.displayName}
                        />
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="commodities" className="m-0 p-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3">
                      <Fuel className="h-3.5 w-3.5" />
                      COMMODITIES
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                      {commodities.map((commodity) => (
                        <SymbolRow
                          key={commodity.symbol}
                          symbol={commodity.symbol}
                          name={commodity.name}
                          displayName={commodity.displayName}
                        />
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="etfs" className="m-0 p-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3">
                      <TrendingUp className="h-3.5 w-3.5" />
                      POPULAR ETFs
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                      {etfs.map((etf) => (
                        <SymbolRow key={etf.symbol} symbol={etf.symbol} name={etf.name} />
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>

            <div className="p-3 border-t border-border bg-muted/30">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↑</kbd> <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↓</kbd> to navigate</span>
                  <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> to select</span>
                  <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> to close</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      <PositionsModal
        isOpen={isPositionsModalOpen}
        onClose={() => setIsPositionsModalOpen(false)}
        legs={legs}
        symbol={symbolInfo.symbol}
        currentPrice={symbolInfo.price}
      />
    </div>
  );
}
