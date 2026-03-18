import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { TrendingUp, Zap, BookOpen, ChevronDown, Search, ArrowRight, GitBranch } from "lucide-react";
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

// Sentiment → Tailwind class (for text labels)
function getSentimentColor(sentiment: string) {
  if (sentiment === "Bullish") return "text-emerald-400";
  if (sentiment === "Bearish") return "text-rose-400";
  if (sentiment === "Volatile") return "text-purple-400";
  return "text-blue-400";
}

// Sentiment → hex for SVG (Tailwind can't be used inside SVG attrs)
const SENTIMENT_HEX: Record<string, string> = {
  Bullish:  "#34d399",
  Bearish:  "#f87171",
  Neutral:  "#60a5fa",
  Volatile: "#a78bfa",
  Hedged:   "#60a5fa",
};

// Strategy metadata: sentiment, concise description, payoff labels
const STRATEGY_META: Record<string, {
  sentiment: string;
  riskLabel: string;
  desc: string;
  bp: string;
  mp: string;
  ml: string;
}> = {
  "Long Call": {
    sentiment: "Bullish", riskLabel: "Defined",
    desc: "Buy a call option above the current price. Pay a premium upfront and own the right to buy. Profit if the stock rises past your strike before expiration. Maximum loss is limited to the premium paid.",
    bp: "Strike + Premium", mp: "Unlimited", ml: "Premium paid",
  },
  "Long Put": {
    sentiment: "Bearish", riskLabel: "Defined",
    desc: "Buy a put option below the current price. Pay a premium upfront and own the right to sell. Profit if the stock falls past your strike before expiration. Maximum loss is limited to the premium paid.",
    bp: "Strike − Premium", mp: "Strike − Premium", ml: "Premium paid",
  },
  "Bull Call Spread": {
    sentiment: "Bullish", riskLabel: "Defined",
    desc: "Buy a call and sell a higher call at the same expiration. Reduce your cost basis with the premium collected. Profit if the stock rises toward your upper strike. All risk and reward are defined.",
    bp: "Lower + Net Debit", mp: "Spread − Debit", ml: "Net Debit",
  },
  "Bear Put Spread": {
    sentiment: "Bearish", riskLabel: "Defined",
    desc: "Buy a put and sell a lower put at the same expiration. Reduce your cost basis with the premium collected. Profit if the stock falls toward your lower strike. All risk and reward are defined.",
    bp: "Upper − Net Debit", mp: "Spread − Debit", ml: "Net Debit",
  },
  "Iron Condor": {
    sentiment: "Neutral", riskLabel: "Defined",
    desc: "Sell an OTM put spread and call spread. Collect premium from both sides. Profit when the stock stays in a range. All risk and reward are defined.",
    bp: "Two breakevens (±)", mp: "Net Credit", ml: "Spread − Credit",
  },
  "Iron Butterfly": {
    sentiment: "Neutral", riskLabel: "Defined",
    desc: "Sell an ATM straddle and buy protective outer wings. Collect maximum premium if price pins at the center strike. Profit from low volatility in a narrow band. All risk and reward are defined.",
    bp: "Two breakevens (±)", mp: "Net Credit", ml: "Spread − Credit",
  },
  "Long Straddle": {
    sentiment: "Volatile", riskLabel: "Defined",
    desc: "Buy both a call and a put at the same strike and expiration. Pay premiums on both sides for upside in either direction. Profit from a large move before expiration. Loss is limited to the net premium paid.",
    bp: "± Net Debit", mp: "Unlimited", ml: "Both Premiums",
  },
  "Long Strangle": {
    sentiment: "Volatile", riskLabel: "Defined",
    desc: "Buy an OTM call and an OTM put at different strikes. Pay less than a straddle with wider breakeven points. Profit from a large move in either direction. Loss is limited to the net premium paid.",
    bp: "± Net Debit", mp: "Unlimited", ml: "Net Debit",
  },
  "Covered Call": {
    sentiment: "Bullish", riskLabel: "Defined",
    desc: "Own the underlying stock and sell a call against it. Collect premium to reduce cost basis and generate income. Upside is capped at the call strike price. Downside is partially offset by premium received.",
    bp: "Stock − Premium", mp: "Call Strike − Cost", ml: "Stock − Premium",
  },
  "Protective Put": {
    sentiment: "Hedged", riskLabel: "Defined",
    desc: "Own the underlying stock and buy a put for downside protection. Pay a premium to guarantee a minimum exit price. Upside remains unlimited above the put strike. Maximum loss is limited by the put strike.",
    bp: "Stock + Premium", mp: "Unlimited", ml: "Put Premium",
  },
  "Cash-Secured Put": {
    sentiment: "Bullish", riskLabel: "Defined",
    desc: "Sell a put and hold cash to cover a potential assignment. Collect premium as immediate income. If assigned, you acquire the stock at an effective discount. All risk and reward are defined.",
    bp: "Strike − Premium", mp: "Premium received", ml: "Strike − Premium",
  },
  "Collar": {
    sentiment: "Neutral", riskLabel: "Defined",
    desc: "Own stock, sell a call, and buy a put at the same expiration. Cap both your upside potential and your downside risk. A low-cost way to hedge an existing stock position. Risk and reward are both bounded.",
    bp: "Stock Cost", mp: "Call − Stock Cost", ml: "Stock − Put",
  },
};

// Normalized payoff shapes: [x, y] where y=1 = max profit, y=0 = max loss
const PAYOFFS: Record<string, [number, number][]> = {
  "Long Call":         [[0, 0.14], [0.50, 0.14], [1.0, 0.96]],
  "Long Put":          [[0, 0.96], [0.50, 0.14], [1.0, 0.14]],
  "Bull Call Spread":  [[0, 0.14], [0.38, 0.14], [0.62, 0.88], [1.0, 0.88]],
  "Bear Put Spread":   [[0, 0.88], [0.38, 0.88], [0.62, 0.14], [1.0, 0.14]],
  "Iron Condor":       [[0, 0.14], [0.20, 0.14], [0.32, 0.88], [0.68, 0.88], [0.80, 0.14], [1.0, 0.14]],
  "Iron Butterfly":    [[0, 0.10], [0.28, 0.10], [0.50, 0.92], [0.72, 0.10], [1.0, 0.10]],
  "Long Straddle":     [[0, 0.90], [0.50, 0.10], [1.0, 0.90]],
  "Long Strangle":     [[0, 0.90], [0.34, 0.14], [0.66, 0.14], [1.0, 0.90]],
  "Covered Call":      [[0, 0.14], [0.45, 0.70], [0.68, 0.70], [1.0, 0.70]],
  "Protective Put":    [[0, 0.30], [0.42, 0.30], [1.0, 0.90]],
  "Cash-Secured Put":  [[0, 0.90], [0.42, 0.90], [0.68, 0.14], [1.0, 0.14]],
  "Collar":            [[0, 0.30], [0.30, 0.30], [0.55, 0.65], [0.75, 0.75], [1.0, 0.75]],
};

function PayoffChart({ strategyName, sentimentHex }: { strategyName: string; sentimentHex: string }) {
  const W = 720, H = 128;
  const pts = PAYOFFS[strategyName] ?? PAYOFFS["Long Call"];
  const svgPts = pts.map(([x, y]): [number, number] => [x * W, (1 - y) * H]);
  const linePath = svgPts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const fillPath = linePath + ` L${W},${H} L0,${H} Z`;
  const beY = H * 0.5;
  const gradId = `plGrad-${strategyName.replace(/\s+/g, "")}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={sentimentHex} stopOpacity="0.18" />
          <stop offset="44%"  stopColor={sentimentHex} stopOpacity="0.04" />
          <stop offset="56%"  stopColor="#f87171"       stopOpacity="0.04" />
          <stop offset="100%" stopColor="#f87171"       stopOpacity="0.16" />
        </linearGradient>
      </defs>

      {/* Vertical grid */}
      {[0.25, 0.5, 0.75].map(x => (
        <line
          key={x}
          x1={x * W} y1={0}
          x2={x * W} y2={H}
          stroke="hsl(var(--border))"
          strokeWidth="1"
        />
      ))}

      {/* Breakeven dashed line */}
      <line
        x1={0} y1={beY}
        x2={W} y2={beY}
        stroke="hsl(var(--muted-foreground))"
        strokeWidth="1"
        strokeDasharray="4,3"
        opacity="0.4"
      />

      {/* Gradient fill under the payoff line */}
      <path d={fillPath} fill={`url(#${gradId})`} />

      {/* Payoff line */}
      <path
        d={linePath}
        fill="none"
        stroke={sentimentHex}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Corner labels */}
      <text x="6"   y="13"       fontSize="8" fill="hsl(var(--muted-foreground))" fontFamily="monospace" opacity="0.55">PROFIT</text>
      <text x="6"   y={H - 4}    fontSize="8" fill="hsl(var(--muted-foreground))" fontFamily="monospace" opacity="0.55">LOSS</text>
      <text x={W / 2 - 18} y={beY - 5} fontSize="8" fill="hsl(var(--muted-foreground))" fontFamily="monospace" opacity="0.4">breakeven</text>
    </svg>
  );
}

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
  const meta = STRATEGY_META[currentTemplate?.name] ?? {
    sentiment: "Neutral", riskLabel: "Defined",
    desc: "Select a strategy to see a description of how it works, when to use it, and what your risk and reward profile looks like.",
    bp: "Varies", mp: "Varies", ml: "Varies",
  };
  const sentimentHex = SENTIMENT_HEX[meta.sentiment] ?? "#60a5fa";

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
              Build &amp; Visualize
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

          {/* ── Terminal panel ── */}
          <div className="w-full max-w-4xl">
            <div className="border border-border bg-card shadow-xl overflow-hidden">

              {/* Chrome — no colored circles */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/20">
                <span className="font-mono text-[10px] text-muted-foreground/50 select-none">
                  optionbuild — strategy/builder
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="font-mono text-[9px] text-primary font-semibold tracking-widest">LIVE</span>
                </div>
              </div>

              {/* Two-column body */}
              <div className="grid md:grid-cols-[1fr_1px_1fr]">

                {/* LEFT — form (all functionality preserved) */}
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

                {/* RIGHT — strategy preview with payoff chart */}
                <div className="hidden md:flex flex-col bg-muted/[0.03]">

                  {/* Panel header — no chrome dots */}
                  <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
                    <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
                      Strategy Preview
                    </span>
                    <span className={`font-mono text-[10px] font-semibold tracking-wider ${getSentimentColor(meta.sentiment)}`}>
                      {meta.sentiment.toUpperCase()}
                    </span>
                  </div>

                  {/* Concise description */}
                  <div className="px-5 py-4 border-b border-border/30">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {meta.desc}
                    </p>
                  </div>

                  {/* Payoff chart */}
                  <div className="h-[128px] border-b border-border/30">
                    <PayoffChart strategyName={currentTemplate?.name ?? "Iron Condor"} sentimentHex={sentimentHex} />
                  </div>

                  {/* Metrics strip */}
                  <div className="grid grid-cols-3 mt-auto">
                    {[
                      { label: "Breakeven", value: meta.bp, colorClass: "text-foreground" },
                      { label: "Max Profit", value: meta.mp, colorClass: "text-primary" },
                      { label: "Max Loss",   value: meta.ml, colorClass: "text-rose-400" },
                    ].map(({ label, value, colorClass }, i) => (
                      <div key={label} className={`px-4 py-3 ${i > 0 ? "border-l border-border/40" : ""}`}>
                        <div className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-1">{label}</div>
                        <div className={`font-mono text-xs font-semibold ${colorClass}`}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* ── Feature strip ── */}
          <div className="w-full max-w-4xl grid grid-cols-3 border border-border/60 bg-muted/[0.04]">
            {[
              { icon: TrendingUp, label: "Real-time P/L Charts",    sub: "Heatmaps across price & time",   color: "text-primary" },
              { icon: Zap,        label: "Greeks Analysis",          sub: "Δ Γ Θ V ρ — all sensitivities",  color: "text-blue-400" },
              { icon: BookOpen,   label: "30+ Strategy Templates",   sub: "Pre-built, fully customizable",  color: "text-purple-400" },
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
