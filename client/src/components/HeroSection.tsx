import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { TrendingUp, Calculator, BookOpen, ChevronDown, Search, Play, GitBranch } from "lucide-react";
import { strategyTemplates } from "@/lib/strategy-templates";
import { useQuery } from "@tanstack/react-query";

interface SearchResult {
  symbol: string;
  name: string;
  displaySymbol: string;
}

interface HeroSectionProps {
  onGetStarted: () => void;
  onBuildStrategy?: (symbol: string, strategyIndex: number) => void;
}

const defaultSuggestions = ["AAPL", "TSLA", "NVDA", "SPY", "MSFT", "QQQ"];

export function HeroSection({ onGetStarted, onBuildStrategy }: HeroSectionProps) {
  const [ticker, setTicker] = useState("AAPL");
  const [tickerInput, setTickerInput] = useState("");
  const [showTickerDropdown, setShowTickerDropdown] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState(0);
  const [showStrategyDropdown, setShowStrategyDropdown] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stableResults, setStableResults] = useState<SearchResult[]>([]);
  const [stableResultsQuery, setStableResultsQuery] = useState("");
  const [cursorOn, setCursorOn] = useState(true);
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

  // Blinking cursor
  useEffect(() => {
    const t = setInterval(() => setCursorOn(v => !v), 530);
    return () => clearInterval(t);
  }, []);

  const { data: searchResults, isFetching: isSearchFetching } = useQuery<{ results: SearchResult[] }>({
    queryKey: ["/api/stock/search", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch) return { results: [] };
      const response = await fetch(`/api/stock/search?q=${encodeURIComponent(debouncedSearch)}`);
      if (!response.ok) return { results: [] };
      return await response.json();
    },
    enabled: debouncedSearch.length > 0,
    staleTime: 60000,
  });

  useEffect(() => {
    if (searchResults?.results && searchResults.results.length > 0 && !isSearchFetching) {
      setStableResults(searchResults.results);
      setStableResultsQuery(debouncedSearch);
    }
    if (tickerInput.length === 0) {
      setStableResults([]);
      setStableResultsQuery("");
    }
  }, [searchResults, isSearchFetching, debouncedSearch, tickerInput]);

  const isSearchPending = tickerInput.length > 0 && (
    tickerInput !== debouncedSearch || isSearchFetching
  );
  const hasMatchedResults = stableResults.length > 0 && tickerInput.length > 0;
  const showNoResults = tickerInput.length > 0 && !isSearchPending && !hasMatchedResults && debouncedSearch.length > 0;

  const handleSelectTicker = (symbol: string) => {
    setTicker(symbol);
    setTickerInput("");
    setShowTickerDropdown(false);
    setStableResults([]);
    setStableResultsQuery("");
  };

  const handleBuildStrategy = () => {
    if (onBuildStrategy) {
      onBuildStrategy(ticker, selectedStrategy);
    }
  };

  const features = [
    { icon: TrendingUp, label: "Real-time P/L Charts", color: "text-primary" },
    { icon: Calculator, label: "Greeks Analysis", color: "text-blue-400" },
    { icon: BookOpen, label: "30+ Strategy Templates", color: "text-purple-400" },
  ];

  return (
    <section className="relative flex items-center overflow-hidden bg-background">

      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.045] dark:opacity-[0.09]"
        style={{
          backgroundImage: "linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 90% 80% at 50% 50%, black 15%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 50% 50%, black 15%, transparent 75%)",
        }}
      />

      {/* Glow blob */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full pointer-events-none opacity-20 dark:opacity-25"
        style={{ background: "radial-gradient(ellipse at center, hsl(var(--primary) / 0.4) 0%, transparent 70%)" }}
      />

      <div className="container relative z-10 mx-auto px-4 md:px-6 py-14 md:py-20">
        <div className="flex flex-col items-center text-center gap-6 max-w-3xl mx-auto">

          {/* Breadcrumb badge */}
          <div className="inline-flex items-center gap-1.5">
            <GitBranch className="w-3 h-3 text-muted-foreground" />
            <span className="font-mono text-[10px] text-muted-foreground">options</span>
            <span className="font-mono text-[10px] text-muted-foreground/40">/</span>
            <span className="font-mono text-[10px] text-muted-foreground">strategy</span>
            <span className="font-mono text-[10px] text-muted-foreground/40">/</span>
            <span className="font-mono text-[10px] text-primary font-semibold">build</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-bold tracking-tight leading-[1.1] text-foreground">
            Build & Visualize
            <br />
            <span className="text-primary">Options Strategies</span>
            <span
              className="inline-block w-[3px] h-[0.8em] bg-primary ml-2 align-middle translate-y-[-2px] transition-opacity duration-75"
              style={{ opacity: cursorOn ? 1 : 0 }}
            />
          </h1>

          <p className="text-muted-foreground max-w-xl leading-relaxed">
            Professional analysis with real-time P/L charts, Greeks calculator, and 30+ strategy templates. Free to start.
          </p>

          {/* Terminal panel */}
          <div className="w-full max-w-lg mt-2">
            <div className="border border-border bg-card shadow-lg">

              {/* Terminal chrome */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-primary/60" />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground flex-1 text-center pr-8 select-none">
                  optionbuild — strategy/builder
                </span>
              </div>

              {/* Prompt history */}
              <div className="px-5 pt-3.5 pb-1 font-mono text-[11px] border-b border-border/40 space-y-0.5">
                <div>
                  <span className="text-muted-foreground/50">user@optionbuild</span>
                  <span className="text-muted-foreground/40">:~/strategies$ </span>
                  <span className="text-muted-foreground/40">list --recent</span>
                </div>
                <div className="pb-1">
                  <span className="text-primary/70">user@optionbuild</span>
                  <span className="text-muted-foreground/60">:</span>
                  <span className="text-blue-400/70">~/strategies</span>
                  <span className="text-muted-foreground/60">$ </span>
                  <span className="text-foreground/70">build --interactive</span>
                </div>
              </div>

              {/* Form */}
              <div className="p-5 space-y-4">
                {/* Ticker */}
                <div ref={tickerRef}>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1.5 uppercase tracking-widest flex items-center gap-1.5">
                    <Search className="w-3 h-3 text-primary" />
                    Underlying
                  </label>
                  <div className="relative">
                    <div
                      className={`flex items-center gap-2 border ${showTickerDropdown ? "border-primary/60" : "border-border"} bg-background px-3 cursor-text transition-colors`}
                      onClick={() => setShowTickerDropdown(true)}
                      data-testid="input-hero-ticker"
                    >
                      <span className="text-primary font-mono font-bold text-sm shrink-0">$</span>
                      <input
                        type="text"
                        value={tickerInput || (showTickerDropdown ? "" : ticker)}
                        onChange={(e) => {
                          setTickerInput(e.target.value.toUpperCase());
                          setShowTickerDropdown(true);
                        }}
                        onFocus={() => setShowTickerDropdown(true)}
                        placeholder={ticker}
                        className="w-full bg-transparent border-0 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none font-mono"
                        data-testid="input-hero-ticker-field"
                      />
                    </div>
                    {showTickerDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-px border border-border bg-popover shadow-xl z-50 overflow-hidden">
                        <div className="max-h-48 overflow-y-auto">
                          {!(hasMatchedResults || showNoResults) && defaultSuggestions.map((sym) => (
                            <button
                              key={sym}
                              className="w-full text-left px-3 py-2 text-sm font-mono text-foreground hover:bg-muted transition-colors"
                              onClick={() => handleSelectTicker(sym)}
                              data-testid={`option-ticker-${sym}`}
                            >
                              {sym}
                            </button>
                          ))}
                          {hasMatchedResults && stableResults.slice(0, 8).map((result) => (
                            <button
                              key={result.symbol}
                              className="w-full text-left px-3 py-2 text-sm font-mono hover:bg-muted transition-colors flex items-center justify-between gap-2"
                              onClick={() => handleSelectTicker(result.symbol)}
                              data-testid={`option-ticker-${result.symbol}`}
                            >
                              <span className="font-semibold text-foreground">{result.symbol}</span>
                              <span className="text-muted-foreground text-xs truncate max-w-[160px]">{result.name}</span>
                            </button>
                          ))}
                          {showNoResults && (
                            <div className="px-3 py-3 text-sm text-muted-foreground text-center font-mono">No results found</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Strategy */}
                <div ref={strategyRef}>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1.5 uppercase tracking-widest">
                    Strategy
                  </label>
                  <div className="relative">
                    <button
                      className={`w-full flex items-center justify-between border ${showStrategyDropdown ? "border-primary/60" : "border-border"} bg-background px-3 py-2.5 text-sm text-foreground font-mono transition-colors hover:border-border/80`}
                      onClick={() => setShowStrategyDropdown(!showStrategyDropdown)}
                      data-testid="select-hero-strategy"
                    >
                      <span>{strategyTemplates[selectedStrategy]?.name || "Long Call"}</span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showStrategyDropdown ? "rotate-180" : ""}`} />
                    </button>
                    {showStrategyDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-px border border-border bg-popover shadow-xl z-50 max-h-56 overflow-y-auto">
                        {strategyTemplates.map((template, index) => (
                          <button
                            key={template.name}
                            className={`w-full text-left px-3 py-2 text-sm font-mono transition-colors flex items-center gap-2 ${
                              index === selectedStrategy
                                ? "bg-primary/10 text-primary"
                                : "text-foreground hover:bg-muted"
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

                {/* CTA */}
                <Button
                  className="w-full font-mono font-bold tracking-wide gap-2"
                  onClick={handleBuildStrategy}
                  data-testid="button-hero-build-strategy"
                >
                  Build Strategy
                  <Play className="w-3.5 h-3.5 fill-current" />
                </Button>
              </div>
            </div>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground mt-1">
            {features.map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <span>{label}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
