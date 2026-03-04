import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { TrendingUp, Calculator, BookOpen, ChevronDown, Search, Loader2 } from "lucide-react";
import { strategyTemplates } from "@/lib/strategy-templates";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import heroImage from "@assets/generated_images/Trading_workspace_hero_image_f5851d25.png";

interface SearchResult {
  symbol: string;
  name: string;
  displaySymbol: string;
}

interface HeroSectionProps {
  onGetStarted: () => void;
  onBuildStrategy?: (symbol: string, strategyIndex: number) => void;
}

export function HeroSection({ onGetStarted, onBuildStrategy }: HeroSectionProps) {
  const [ticker, setTicker] = useState("AAPL");
  const [tickerInput, setTickerInput] = useState("");
  const [showTickerDropdown, setShowTickerDropdown] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState(0);
  const [showStrategyDropdown, setShowStrategyDropdown] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const tickerRef = useRef<HTMLDivElement>(null);
  const strategyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(tickerInput);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [tickerInput]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tickerRef.current && !tickerRef.current.contains(e.target as Node)) {
        setShowTickerDropdown(false);
      }
      if (strategyRef.current && !strategyRef.current.contains(e.target as Node)) {
        setShowStrategyDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: searchResults, isLoading: isSearching, isFetching: isSearchFetching } = useQuery<{ results: SearchResult[] }>({
    queryKey: ["/api/stock/search", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch) return { results: [] };
      const response = await fetch(`/api/stock/search?q=${encodeURIComponent(debouncedSearch)}`);
      if (!response.ok) return { results: [] };
      return await response.json();
    },
    enabled: debouncedSearch.length > 0,
    staleTime: 60000,
    placeholderData: keepPreviousData,
  });

  const handleSelectTicker = (symbol: string) => {
    setTicker(symbol);
    setTickerInput("");
    setShowTickerDropdown(false);
  };

  const handleBuildStrategy = () => {
    if (onBuildStrategy) {
      onBuildStrategy(ticker, selectedStrategy);
    }
  };

  return (
    <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${heroImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/70 to-black/60" />
      </div>

      <div className="container relative z-10 mx-auto px-4 md:px-6 py-20">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Build & Visualize Options Strategies
            </h1>
            <p className="text-xl md:text-2xl text-gray-200 mb-8">
              Professional options analysis with real-time P/L charts, Greeks calculator, and 30+ strategy templates. Free to start.
            </p>

            <div className="flex flex-wrap gap-6 text-white/90">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
                <span className="text-sm">Real-time P/L Charts</span>
              </div>
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-blue-400" />
                <span className="text-sm">Greeks Analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-purple-400" />
                <span className="text-sm">30+ Strategy Templates</span>
              </div>
            </div>
          </div>

          <div className="w-full max-w-sm">
            <div className="rounded-lg border border-white/15 bg-black/50 backdrop-blur-md p-5 shadow-2xl">
              <div className="mb-4" ref={tickerRef}>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Ticker</label>
                <div className="relative">
                  <div
                    className="flex items-center gap-2 rounded-md border border-white/20 bg-white/5 px-3 cursor-text"
                    onClick={() => {
                      setShowTickerDropdown(true);
                    }}
                    data-testid="input-hero-ticker"
                  >
                    <Search className="h-4 w-4 text-white/40 shrink-0" />
                    <input
                      type="text"
                      value={tickerInput || (showTickerDropdown ? "" : ticker)}
                      onChange={(e) => {
                        setTickerInput(e.target.value.toUpperCase());
                        setShowTickerDropdown(true);
                      }}
                      onFocus={() => setShowTickerDropdown(true)}
                      placeholder={ticker}
                      className="w-full bg-transparent border-0 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none"
                      data-testid="input-hero-ticker-field"
                    />
                  </div>
                  {showTickerDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-md border border-white/15 bg-[hsl(222,47%,11%)] shadow-xl z-50 max-h-48 overflow-y-auto transition-opacity duration-150">
                      {tickerInput.length > 0 && searchResults?.results && searchResults.results.length > 0 ? (
                        <div className={`transition-opacity duration-150 ${isSearchFetching ? 'opacity-70' : 'opacity-100'}`}>
                          {searchResults.results.slice(0, 8).map((result) => (
                            <button
                              key={result.symbol}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors flex items-center justify-between gap-2"
                              onClick={() => handleSelectTicker(result.symbol)}
                              data-testid={`option-ticker-${result.symbol}`}
                            >
                              <span className="font-medium text-white">{result.symbol}</span>
                              <span className="text-white/50 text-xs truncate max-w-[160px]">{result.name}</span>
                            </button>
                          ))}
                        </div>
                      ) : tickerInput.length > 0 && (isSearching || isSearchFetching || tickerInput !== debouncedSearch) ? (
                        <div className="flex items-center justify-center py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-white/50" />
                        </div>
                      ) : tickerInput.length > 0 && (!searchResults?.results || searchResults.results.length === 0) ? (
                        <div className="px-3 py-3 text-sm text-white/40 text-center">No results found</div>
                      ) : (
                        ["AAPL", "TSLA", "NVDA", "SPY", "MSFT", "QQQ"].map((sym) => (
                          <button
                            key={sym}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors text-white font-medium"
                            onClick={() => handleSelectTicker(sym)}
                            data-testid={`option-ticker-${sym}`}
                          >
                            {sym}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-5" ref={strategyRef}>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Strategy</label>
                <div className="relative">
                  <button
                    className="w-full flex items-center justify-between rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
                    onClick={() => setShowStrategyDropdown(!showStrategyDropdown)}
                    data-testid="select-hero-strategy"
                  >
                    <span>{strategyTemplates[selectedStrategy]?.name || "Long Call"}</span>
                    <ChevronDown className={`h-4 w-4 text-white/50 transition-transform ${showStrategyDropdown ? "rotate-180" : ""}`} />
                  </button>
                  {showStrategyDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-md border border-white/15 bg-[hsl(222,47%,11%)] shadow-xl z-50 max-h-56 overflow-y-auto">
                      {strategyTemplates.map((template, index) => (
                        <button
                          key={template.name}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                            index === selectedStrategy
                              ? "bg-primary/20 text-primary"
                              : "text-white hover:bg-white/10"
                          }`}
                          onClick={() => {
                            setSelectedStrategy(index);
                            setShowStrategyDropdown(false);
                          }}
                          data-testid={`option-strategy-${index}`}
                        >
                          {template.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Button
                className="w-full bg-primary text-primary-foreground"
                onClick={handleBuildStrategy}
                data-testid="button-hero-build-strategy"
              >
                Build Strategy
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
