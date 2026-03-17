import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { TrendingUp, Calculator, BookOpen, ChevronDown, Search, ArrowRight, GitBranch, Zap, ShieldCheck, BarChart3 } from "lucide-react";
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

const STRATEGY_META: Record<string, { sentiment: string; riskLabel: string; legs: string }> = {
  "Long Call":         { sentiment: "Bullish", riskLabel: "Defined",   legs: "1-leg" },
  "Long Put":          { sentiment: "Bearish", riskLabel: "Defined",   legs: "1-leg" },
  "Bull Call Spread":  { sentiment: "Bullish", riskLabel: "Defined",   legs: "2-leg" },
  "Bear Put Spread":   { sentiment: "Bearish", riskLabel: "Defined",   legs: "2-leg" },
  "Iron Condor":       { sentiment: "Neutral",  riskLabel: "Defined",   legs: "4-leg" },
  "Iron Butterfly":    { sentiment: "Neutral",  riskLabel: "Defined",   legs: "4-leg" },
  "Long Straddle":     { sentiment: "Neutral",  riskLabel: "Defined",   legs: "2-leg" },
  "Long Strangle":     { sentiment: "Neutral",  riskLabel: "Defined",   legs: "2-leg" },
  "Covered Call":      { sentiment: "Bullish", riskLabel: "Defined",   legs: "2-leg" },
  "Protective Put":    { sentiment: "Bullish", riskLabel: "Defined",   legs: "2-leg" },
  "Cash-Secured Put":  { sentiment: "Bullish", riskLabel: "Defined",   legs: "1-leg" },
};

function getSentimentColor(sentiment: string) {
  if (sentiment === "Bullish") return "text-emerald-400";
  if (sentiment === "Bearish") return "text-rose-400";
  return "text-blue-400";
}

const GREEKS = [
  { sym: "Δ", name: "Delta" },
  { sym: "Γ", name: "Gamma" },
  { sym: "Θ", name: "Theta" },
  { sym: "V", name: "Vega" },
  { sym: "ρ", name: "Rho" },
];

export function HeroSection({ onGetStarted, onBuildStrategy }: HeroSectionProps) {
  const [ticker, setTicker] = useState("AAPL");
  const [tickerInput, setTickerInput] = useState("");
  const [showTickerDropdown, setShowTickerDropdown] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState(16);
  const [showStrategyDropdown, setShowStrategyDropdown] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stableResults, setStableResults] = useState<SearchResult[]>([]);
  const [cursorOn, setCursorOn] = useState(true);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const tickerRef = useRef<HTMLDivElement>(null);
  const strategyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(tickerInput), 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [tickerInput]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (tickerRef.current && !tickerRef.current.contains(e.target as Node)) setShowTickerDropdown(false);
      if (strategyRef.current && !strategyRef.current.contains(e.target as Node)) setShowStrategyDropdown(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setCursorOn(v => !v), 530);
    return () => clearInterval(t);
  }, []);

  const { data: searchResults, isFetching: isSearchFetching } = useQuery<{ results: SearchResult[] }>({
    queryKey: ["/api/stock/search", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch) return { results: [] };
      const r = await fetch(`/api/stock/search?q=${encodeURIComponent(debouncedSearch)}`);
      if (!r.ok) return { results: [] };
      return r.json();
    },
    enabled: debouncedSearch.length > 0,
    staleTime: 60000,
  });

  useEffect(() => {
    if (searchResults?.results && searchResults.results.length > 0 && !isSearchFetching) {
      setStableResults(searchResults.results);
    }
    if (tickerInput.length === 0) setStableResults([]);
  }, [searchResults, isSearchFetching, debouncedSearch, tickerInput]);

  const isSearchPending = tickerInput.length > 0 && (tickerInput !== debouncedSearch || isSearchFetching);
  const hasMatchedResults = stableResults.length > 0 && tickerInput.length > 0;
  const showNoResults = tickerInput.length > 0 && !isSearchPending && !hasMatchedResults && debouncedSearch.length > 0;

  const handleSelectTicker = (symbol: string) => {
    setTicker(symbol);
    setTickerInput("");
    setShowTickerDropdown(false);
    setStableResults([]);
  };

  const handleBuildStrategy = () => {
    if (onBuildStrategy) onBuildStrategy(ticker, selectedStrategy);
  };

  const currentTemplate = strategyTemplates[selectedStrategy];
  const meta = STRATEGY_META[currentTemplate?.name] ?? { sentiment: "Neutral", riskLabel: "Defined", legs: "multi-leg" };

  return (
    <section className="relative overflow-hidden bg-background">

      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04] dark:opacity-[0.08]"
        style={{
          backgroundImage: "linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
          maskImage: "radial-gradient(ellipse 100% 90% at 50% 50%, black 10%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse 100% 90% at 50% 50%, black 10%, transparent 70%)",
        }}
      />

      {/* Glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, hsl(var(--primary) / 0.12) 0%, transparent 65%)" }}
      />

      <div className="container mx-auto px-4 md:px-6 pt-16 pb-14 md:pt-20 md:pb-18 relative z-10">
        <div className="flex flex-col items-center gap-8">

          {/* ── Top text block ── */}
          <div className="flex flex-col items-center gap-4 text-center max-w-3xl">

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 font-mono text-[10px]">
              <GitBranch className="w-3 h-3 text-muted-foreground/60" />
              <span className="text-muted-foreground/60">options</span>
              <span className="text-muted-foreground/30">/</span>
              <span className="text-muted-foreground/60">strategy</span>
              <span className="text-muted-foreground/30">/</span>
              <span className="text-primary font-semibold">build</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.08] text-foreground">
              Build & Visualize
              <br />
              <span className="text-primary">Options Strategies</span>
              <span
                className="inline-block w-[3px] h-[0.78em] bg-primary ml-2 align-middle translate-y-[-3px]"
                style={{ opacity: cursorOn ? 1 : 0, transition: "opacity 0.07s" }}
              />
            </h1>

            <p className="text-muted-foreground text-base leading-relaxed max-w-xl">
              Professional analysis with real-time P/L charts, Greeks calculator, and 30+ strategy templates. Free to start.
            </p>

            {/* Two CTAs */}
            <div className="flex items-center gap-3 flex-wrap justify-center mt-1">
              <Button size="lg" onClick={onGetStarted} data-testid="button-hero-launch" className="gap-2 font-mono font-semibold">
                Launch Builder
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => {
                document.getElementById("strategies")?.scrollIntoView({ behavior: "smooth" });
              }} data-testid="button-hero-templates" className="font-mono">
                View Templates
              </Button>
            </div>
          </div>

          {/* ── Wide terminal panel ── */}
          <div className="w-full max-w-4xl">
            <div className="border border-border bg-card shadow-xl overflow-hidden">

              {/* Chrome */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/20">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-destructive/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-primary/70" />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground flex-1 text-center pr-10 select-none">
                  optionbuild — strategy/builder
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="font-mono text-[9px] text-primary font-semibold tracking-widest">LIVE</span>
                </div>
              </div>

              {/* Two-column body */}
              <div className="grid md:grid-cols-[1fr_1px_1fr]">

                {/* LEFT — form */}
                <div className="p-6 flex flex-col gap-5">

                  {/* Prompt history */}
                  <div className="font-mono text-[10px] space-y-0.5 border-b border-border/30 pb-4">
                    <div className="text-muted-foreground/40">
                      <span>user@optionbuild</span><span>:~/strategies$ </span><span>list --saved</span>
                    </div>
                    <div>
                      <span className="text-primary/60">user@optionbuild</span>
                      <span className="text-muted-foreground/50">:</span>
                      <span className="text-blue-400/60">~/strategies</span>
                      <span className="text-muted-foreground/50">$ </span>
                      <span className="text-foreground/60">build --interactive</span>
                    </div>
                    <div className="text-primary/50 text-[9px] pt-0.5">
                      ✓ engine ready · chain data loaded · awaiting input
                    </div>
                  </div>

                  {/* Ticker */}
                  <div ref={tickerRef}>
                    <label className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-widest">
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
                          onChange={e => { setTickerInput(e.target.value.toUpperCase()); setShowTickerDropdown(true); }}
                          onFocus={() => setShowTickerDropdown(true)}
                          placeholder={ticker}
                          className="w-full bg-transparent border-0 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none font-mono"
                          data-testid="input-hero-ticker-field"
                        />
                      </div>
                      {showTickerDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-px border border-border bg-popover shadow-xl z-50 overflow-hidden">
                          <div className="max-h-44 overflow-y-auto">
                            {!(hasMatchedResults || showNoResults) && defaultSuggestions.map(sym => (
                              <button key={sym} className="w-full text-left px-3 py-2 text-sm font-mono text-foreground hover:bg-muted transition-colors" onClick={() => handleSelectTicker(sym)} data-testid={`option-ticker-${sym}`}>{sym}</button>
                            ))}
                            {hasMatchedResults && stableResults.slice(0, 8).map(r => (
                              <button key={r.symbol} className="w-full text-left px-3 py-2 text-sm font-mono hover:bg-muted transition-colors flex items-center justify-between gap-2" onClick={() => handleSelectTicker(r.symbol)} data-testid={`option-ticker-${r.symbol}`}>
                                <span className="font-semibold text-foreground">{r.symbol}</span>
                                <span className="text-muted-foreground text-xs truncate max-w-[140px]">{r.name}</span>
                              </button>
                            ))}
                            {showNoResults && <div className="px-3 py-3 text-sm text-muted-foreground text-center font-mono">No results found</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Strategy */}
                  <div ref={strategyRef}>
                    <label className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-widest">
                      Strategy
                    </label>
                    <div className="relative">
                      <button
                        className={`w-full flex items-center justify-between border ${showStrategyDropdown ? "border-primary/60" : "border-border"} bg-background px-3 py-2.5 text-sm text-foreground font-mono transition-colors`}
                        onClick={() => setShowStrategyDropdown(!showStrategyDropdown)}
                        data-testid="select-hero-strategy"
                      >
                        <span>{currentTemplate?.name || "Iron Condor"}</span>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showStrategyDropdown ? "rotate-180" : ""}`} />
                      </button>
                      {showStrategyDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-px border border-border bg-popover shadow-xl z-50 max-h-52 overflow-y-auto">
                          {strategyTemplates.map((template, index) => (
                            <button
                              key={template.name}
                              className={`w-full text-left px-3 py-2 text-sm font-mono transition-colors ${index === selectedStrategy ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}
                              onClick={() => { setSelectedStrategy(index); setShowStrategyDropdown(false); }}
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
                    className="w-full font-mono font-bold tracking-wide gap-2 mt-1"
                    onClick={handleBuildStrategy}
                    data-testid="button-hero-build-strategy"
                  >
                    Build Strategy
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>

                {/* Divider */}
                <div className="hidden md:block bg-border" />

                {/* RIGHT — strategy preview panel */}
                <div className="hidden md:flex flex-col p-6 gap-5 bg-muted/[0.04]">
                  <div className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest border-b border-border/30 pb-3">
                    Strategy Preview
                  </div>

                  <div className="flex flex-col gap-4 flex-1">
                    {/* Strategy title */}
                    <div>
                      <div className="text-foreground font-bold text-lg font-mono leading-tight">
                        {currentTemplate?.name || "Iron Condor"}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`font-mono text-xs font-semibold ${getSentimentColor(meta.sentiment)}`}>
                          {meta.sentiment}
                        </span>
                        <span className="text-muted-foreground/30 text-xs">·</span>
                        <span className="font-mono text-xs text-muted-foreground">{meta.riskLabel} Risk</span>
                        <span className="text-muted-foreground/30 text-xs">·</span>
                        <span className="font-mono text-xs text-muted-foreground">{currentTemplate?.legs?.length ?? 4}-leg</span>
                      </div>
                    </div>

                    {/* Description */}
                    {currentTemplate?.description && (
                      <p className="text-muted-foreground text-xs leading-relaxed line-clamp-3">
                        {currentTemplate.description}
                      </p>
                    )}

                    {/* Greeks strip */}
                    <div>
                      <div className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-2">Greeks</div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {GREEKS.map(({ sym, name }) => (
                          <div key={sym} className="flex flex-col items-center gap-0.5 border border-border/60 bg-background/40 py-2 px-1">
                            <span className="font-mono text-base font-bold text-primary leading-none">{sym}</span>
                            <span className="font-mono text-[8px] text-muted-foreground/60 uppercase">{name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Quick metrics */}
                    <div className="grid grid-cols-2 gap-2 mt-auto">
                      <div className="border border-border/50 bg-background/30 px-3 py-2">
                        <div className="font-mono text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Max Profit</div>
                        <div className="font-mono text-xs text-primary font-semibold">Defined</div>
                      </div>
                      <div className="border border-border/50 bg-background/30 px-3 py-2">
                        <div className="font-mono text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Max Loss</div>
                        <div className="font-mono text-xs text-muted-foreground font-semibold">Defined</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Feature strip ── */}
          <div className="w-full max-w-4xl grid grid-cols-3 border border-border/60 bg-muted/[0.04]">
            {[
              { icon: TrendingUp, label: "Real-time P/L Charts", sub: "Heatmaps across price & time", color: "text-primary" },
              { icon: Zap, label: "Greeks Analysis", sub: "Δ Γ Θ V ρ — all sensitivities", color: "text-blue-400" },
              { icon: BookOpen, label: "30+ Strategy Templates", sub: "Pre-built, fully customizable", color: "text-purple-400" },
            ].map(({ icon: Icon, label, sub, color }, i) => (
              <div key={label} className={`flex items-start gap-3 px-4 py-3.5 ${i > 0 ? "border-l border-border/60" : ""}`}>
                <Icon className={`w-4 h-4 ${color} mt-0.5 shrink-0`} />
                <div>
                  <div className="font-mono text-xs font-semibold text-foreground">{label}</div>
                  <div className="font-mono text-[10px] text-muted-foreground mt-0.5 leading-tight">{sub}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
