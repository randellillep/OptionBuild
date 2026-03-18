import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, Search, ArrowRight } from "lucide-react";
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

const SENTIMENT_HEX: Record<string, string> = {
  Bullish:  "#34d399",
  Bearish:  "#f87171",
  Neutral:  "#60a5fa",
  Volatile: "#a78bfa",
  Hedged:   "#60a5fa",
};

function getSentimentColor(sentiment: string) {
  if (sentiment === "Bullish") return "text-emerald-400";
  if (sentiment === "Bearish") return "text-rose-400";
  if (sentiment === "Volatile") return "text-purple-400";
  return "text-blue-400";
}

const STRATEGY_META: Record<string, {
  sentiment: string;
  desc: string;
  bp: string;
  mp: string;
  ml: string;
}> = {
  "Long Call":        { sentiment: "Bullish", desc: "Buy a call option above the current price. Pay a premium upfront and own the right to buy. Profit if the stock rises past your strike before expiration. Maximum loss is limited to the premium paid.", bp: "Strike + Premium", mp: "Unlimited", ml: "Premium paid" },
  "Long Put":         { sentiment: "Bearish", desc: "Buy a put option below the current price. Pay a premium upfront and own the right to sell. Profit if the stock falls past your strike before expiration. Maximum loss is limited to the premium paid.", bp: "Strike − Premium", mp: "Strike − Premium", ml: "Premium paid" },
  "Bull Call Spread": { sentiment: "Bullish", desc: "Buy a call and sell a higher call at the same expiration. Reduce your cost basis with the premium collected. Profit if the stock rises toward your upper strike. All risk and reward are defined.", bp: "Lower + Net Debit", mp: "Spread − Debit", ml: "Net Debit" },
  "Bear Put Spread":  { sentiment: "Bearish", desc: "Buy a put and sell a lower put at the same expiration. Reduce your cost basis with the premium collected. Profit if the stock falls toward your lower strike. All risk and reward are defined.", bp: "Upper − Net Debit", mp: "Spread − Debit", ml: "Net Debit" },
  "Iron Condor":      { sentiment: "Neutral", desc: "Sell an OTM put spread and call spread. Collect premium from both sides. Profit when the stock stays in a range. All risk and reward are defined.", bp: "Two breakevens (±)", mp: "Net Credit", ml: "Spread − Credit" },
  "Iron Butterfly":   { sentiment: "Neutral", desc: "Sell an ATM straddle and buy protective outer wings. Collect maximum premium if price pins at the center strike. Profit from low volatility in a narrow band. All risk and reward are defined.", bp: "Two breakevens (±)", mp: "Net Credit", ml: "Spread − Credit" },
  "Long Straddle":    { sentiment: "Volatile", desc: "Buy both a call and a put at the same strike and expiration. Pay premiums on both sides for upside in either direction. Profit from a large move before expiration. Loss is limited to the net premium paid.", bp: "± Net Debit", mp: "Unlimited", ml: "Both Premiums" },
  "Long Strangle":    { sentiment: "Volatile", desc: "Buy an OTM call and an OTM put at different strikes. Pay less than a straddle with wider breakeven points. Profit from a large move in either direction. Loss is limited to the net premium paid.", bp: "± Net Debit", mp: "Unlimited", ml: "Net Debit" },
  "Covered Call":     { sentiment: "Bullish", desc: "Own the underlying stock and sell a call against it. Collect premium to reduce your cost basis and generate income. Upside is capped at the call strike price. Downside is partially offset by the premium received.", bp: "Stock − Premium", mp: "Call Strike − Cost", ml: "Stock − Premium" },
  "Protective Put":   { sentiment: "Hedged", desc: "Own the underlying stock and buy a put for downside protection. Pay a premium to guarantee a minimum exit price. Upside remains unlimited above the put strike. Maximum loss is limited by the put strike.", bp: "Stock + Premium", mp: "Unlimited", ml: "Put Premium" },
  "Cash-Secured Put": { sentiment: "Bullish", desc: "Sell a put and hold cash to cover a potential assignment. Collect premium as immediate income. If assigned, you acquire the stock at an effective discount. All risk and reward are defined.", bp: "Strike − Premium", mp: "Premium received", ml: "Strike − Premium" },
  "Collar":           { sentiment: "Neutral", desc: "Own stock, sell a call, and buy a put at the same expiration. Cap both your upside potential and your downside risk. A low-cost way to hedge an existing stock position. Risk and reward are both bounded.", bp: "Stock Cost", mp: "Call − Stock Cost", ml: "Stock − Put" },
};

const PAYOFFS: Record<string, [number, number][]> = {
  "Long Call":        [[0, 0.14], [0.50, 0.14], [1.0, 0.96]],
  "Long Put":         [[0, 0.96], [0.50, 0.14], [1.0, 0.14]],
  "Bull Call Spread": [[0, 0.14], [0.38, 0.14], [0.62, 0.88], [1.0, 0.88]],
  "Bear Put Spread":  [[0, 0.88], [0.38, 0.88], [0.62, 0.14], [1.0, 0.14]],
  "Iron Condor":      [[0, 0.14], [0.20, 0.14], [0.32, 0.88], [0.68, 0.88], [0.80, 0.14], [1.0, 0.14]],
  "Iron Butterfly":   [[0, 0.10], [0.28, 0.10], [0.50, 0.92], [0.72, 0.10], [1.0, 0.10]],
  "Long Straddle":    [[0, 0.90], [0.50, 0.10], [1.0, 0.90]],
  "Long Strangle":    [[0, 0.90], [0.34, 0.14], [0.66, 0.14], [1.0, 0.90]],
  "Covered Call":     [[0, 0.14], [0.45, 0.70], [0.68, 0.70], [1.0, 0.70]],
  "Protective Put":   [[0, 0.30], [0.42, 0.30], [1.0, 0.90]],
  "Cash-Secured Put": [[0, 0.90], [0.42, 0.90], [0.68, 0.14], [1.0, 0.14]],
  "Collar":           [[0, 0.30], [0.30, 0.30], [0.55, 0.65], [0.75, 0.75], [1.0, 0.75]],
};

function PayoffChart({ strategyName, sentimentHex }: { strategyName: string; sentimentHex: string }) {
  const W = 800, H = 140;
  const pts = PAYOFFS[strategyName] ?? PAYOFFS["Long Call"];
  const svgPts = pts.map(([x, y]): [number, number] => [x * W, (1 - y) * H]);
  const linePath = svgPts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const fillPath = linePath + ` L${W},${H} L0,${H} Z`;
  const beY = H * 0.5;
  const gradId = `plg-${strategyName.replace(/\W/g, "")}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={sentimentHex} stopOpacity="0.22" />
          <stop offset="44%"  stopColor={sentimentHex} stopOpacity="0.05" />
          <stop offset="56%"  stopColor="#f87171"      stopOpacity="0.05" />
          <stop offset="100%" stopColor="#f87171"      stopOpacity="0.20" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(x => (
        <line key={x} x1={x * W} y1={0} x2={x * W} y2={H} stroke="hsl(var(--border))" strokeWidth="1" />
      ))}
      <line x1={0} y1={beY} x2={W} y2={beY} stroke="hsl(var(--muted-foreground))" strokeWidth="1" strokeDasharray="5,4" opacity="0.35" />
      <path d={fillPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={sentimentHex} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <text x="8"       y="14"       fontSize="8.5" fill="hsl(var(--muted-foreground))" fontFamily="monospace" opacity="0.5">PROFIT</text>
      <text x="8"       y={H - 5}    fontSize="8.5" fill="hsl(var(--muted-foreground))" fontFamily="monospace" opacity="0.5">LOSS</text>
      <text x={W/2-20}  y={beY - 5}  fontSize="8.5" fill="hsl(var(--muted-foreground))" fontFamily="monospace" opacity="0.38">breakeven</text>
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
    sentiment: "Neutral",
    desc: "Select a strategy to see a description of how it works, when to use it, and what your risk and reward profile looks like.",
    bp: "Varies", mp: "Varies", ml: "Varies",
  };
  const sentimentHex = SENTIMENT_HEX[meta.sentiment] ?? "#60a5fa";

  return (
    <section className="relative overflow-hidden bg-background">

      {/* ── Background effects ── */}
      <style>{`
        @keyframes heroGlowPulse {
          0%, 100% { opacity: 0.75; }
          50%       { opacity: 1;    }
        }
        @keyframes heroGlowDrift {
          0%, 100% { transform: translate(-50%, -50%) scale(1);    }
          33%      { transform: translate(-52%, -48%) scale(1.04); }
          66%      { transform: translate(-48%, -52%) scale(0.97); }
        }
        .hero-glow-main  { animation: heroGlowPulse 7s ease-in-out infinite; }
        .hero-glow-drift { animation: heroGlowDrift 12s ease-in-out infinite; }
      `}</style>

      {/* Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.055] dark:opacity-[0.09]"
        style={{
          backgroundImage: "linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
          maskImage: "radial-gradient(ellipse 90% 85% at 50% 45%, black 10%, transparent 72%)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 85% at 50% 45%, black 10%, transparent 72%)",
        }}
      />

      {/* Primary glow — large, centered, pulsing */}
      <div
        className="hero-glow-main absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full"
        style={{ width: 900, height: 500, background: "radial-gradient(ellipse at center, hsl(var(--primary) / 0.16) 0%, hsl(var(--primary) / 0.06) 40%, transparent 70%)" }}
      />

      {/* Secondary accent glow — top-left, blue tinted */}
      <div
        className="hero-glow-drift absolute top-[15%] left-[18%] pointer-events-none rounded-full"
        style={{ width: 480, height: 320, background: "radial-gradient(ellipse at center, hsl(217 70% 55% / 0.08) 0%, transparent 65%)", transform: "translate(-50%, -50%)" }}
      />

      {/* Tertiary glow — bottom-right, faint primary */}
      <div
        className="absolute bottom-[8%] right-[12%] pointer-events-none rounded-full"
        style={{ width: 380, height: 260, background: "radial-gradient(ellipse at center, hsl(var(--primary) / 0.07) 0%, transparent 60%)" }}
      />

      <div className="container mx-auto px-4 md:px-6 pt-16 pb-14 md:pt-20 md:pb-18 relative z-10">
        <div className="flex flex-col items-center gap-6">

          {/* ── Headline ── */}
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight leading-[1.12] text-foreground">
              Build &amp; Visualize
              <br />
              <span className="text-foreground/80">Options Strategies</span>
              <span
                className="inline-block w-[3px] h-[0.78em] bg-primary ml-2 align-middle translate-y-[-3px]"
                style={{ opacity: cursorOn ? 1 : 0, transition: "opacity 0.07s" }}
              />
            </h1>
          </div>

          {/* ── Interactive sentence ── */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[clamp(1.6rem,4vw,2.8rem)] font-bold tracking-tight leading-none mt-2">

            <span className="text-muted-foreground font-medium text-[0.7em]">Analyze</span>

            {/* Ticker */}
            <div ref={tickerRef} className="relative inline-flex items-center">
              <div
                className="inline-flex items-center gap-1.5 cursor-text"
                style={{ borderBottom: "2.5px solid hsl(var(--primary) / 0.5)", paddingBottom: 2 }}
                onClick={() => setShowTickerDropdown(true)}
                data-testid="input-hero-ticker"
              >
                <span className="text-primary font-mono text-[0.6em] opacity-80">$</span>
                <input
                  type="text"
                  value={tickerInput || (showTickerDropdown ? "" : ticker)}
                  onChange={e => { setTickerInput(e.target.value.toUpperCase()); setShowTickerDropdown(true); }}
                  onFocus={() => setShowTickerDropdown(true)}
                  placeholder={ticker}
                  className="bg-transparent border-0 focus:outline-none text-primary font-bold placeholder:text-primary/60"
                  style={{ width: `${Math.max((tickerInput || ticker).length, 3) + 0.5}ch`, fontSize: "inherit", fontFamily: "inherit", letterSpacing: "inherit" }}
                  data-testid="input-hero-ticker-field"
                />
              </div>
              {showTickerDropdown && (
                <div className="absolute top-[110%] left-1/2 -translate-x-1/2 mt-1 border border-border bg-popover shadow-2xl z-50 min-w-[130px] overflow-hidden">
                  <div className="max-h-48 overflow-y-auto">
                    {!(hasMatchedResults || showNoResults) && defaultSuggestions.map(sym => (
                      <button
                        key={sym}
                        className="w-full text-left px-4 py-2.5 text-sm font-mono font-semibold text-foreground hover:bg-muted transition-colors"
                        onMouseDown={() => handleSelectTicker(sym)}
                        data-testid={`option-ticker-${sym}`}
                      >{sym}</button>
                    ))}
                    {hasMatchedResults && stableResults.slice(0, 8).map(r => (
                      <button
                        key={r.symbol}
                        className="w-full text-left px-4 py-2.5 text-sm font-mono hover:bg-muted transition-colors flex items-center justify-between gap-3"
                        onMouseDown={() => handleSelectTicker(r.symbol)}
                        data-testid={`option-ticker-${r.symbol}`}
                      >
                        <span className="font-semibold text-foreground">{r.symbol}</span>
                        <span className="text-muted-foreground text-xs truncate max-w-[150px]">{r.name}</span>
                      </button>
                    ))}
                    {showNoResults && (
                      <div className="px-4 py-3 text-sm text-muted-foreground text-center font-mono">No results</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <span className="text-muted-foreground/60 font-normal text-[0.62em]">using</span>

            {/* Strategy */}
            <div ref={strategyRef} className="relative inline-flex">
              <button
                className="inline-flex items-center gap-2 font-bold bg-transparent border-0 focus:outline-none"
                style={{
                  color: sentimentHex,
                  borderBottom: `2.5px solid ${sentimentHex}55`,
                  paddingBottom: 2,
                  fontSize: "inherit",
                  fontFamily: "inherit",
                  letterSpacing: "inherit",
                  cursor: "pointer",
                  transition: "color 0.25s",
                }}
                onClick={() => setShowStrategyDropdown(!showStrategyDropdown)}
                data-testid="select-hero-strategy"
              >
                {currentTemplate?.name || "Iron Condor"}
                <ChevronDown
                  className="shrink-0"
                  style={{
                    width: "0.38em",
                    height: "0.38em",
                    opacity: 0.65,
                    transform: showStrategyDropdown ? "rotate(180deg)" : "none",
                    transition: "transform 0.15s",
                  }}
                />
              </button>
              {showStrategyDropdown && (
                <div className="absolute top-[110%] left-1/2 -translate-x-1/2 mt-1 border border-border bg-popover shadow-2xl z-50 min-w-[210px] max-h-[260px] overflow-y-auto">
                  {strategyTemplates.map((template, index) => (
                    <button
                      key={template.name}
                      className={`w-full text-left px-4 py-2 text-sm font-mono transition-colors ${index === selectedStrategy ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}
                      onMouseDown={() => { setSelectedStrategy(index); setShowStrategyDropdown(false); }}
                      data-testid={`option-strategy-${index}`}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Strategy description ── */}
          <p className="text-sm text-muted-foreground leading-relaxed text-center max-w-lg -mt-1">
            <span className={`font-semibold ${getSentimentColor(meta.sentiment)}`}>{meta.sentiment}. </span>
            {meta.desc}
          </p>

          {/* ── CTA ── */}
          <div className="flex flex-col items-center gap-3">
            <Button
              size="lg"
              onClick={handleBuildStrategy}
              data-testid="button-hero-build-strategy"
              className="gap-2 font-mono font-bold tracking-wide px-10"
            >
              Build Strategy
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          {/* ── Payoff chart panel ── */}
          <div className="w-full max-w-3xl border border-border bg-card shadow-xl overflow-hidden">

            {/* Chart header — no circles */}
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-border bg-muted/20">
              <span className="font-mono text-[10px] text-muted-foreground/50 tracking-wide">
                {ticker} · {currentTemplate?.name ?? "Iron Condor"} · P/L Payoff at expiration
              </span>
              <span className={`font-mono text-[10px] font-semibold tracking-widest ${getSentimentColor(meta.sentiment)}`}>
                {meta.sentiment.toUpperCase()}
              </span>
            </div>

            {/* Chart */}
            <div className="h-[140px]">
              <PayoffChart strategyName={currentTemplate?.name ?? "Iron Condor"} sentimentHex={sentimentHex} />
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 border-t border-border">
              {[
                { label: "Breakeven", value: meta.bp, cls: "text-foreground" },
                { label: "Max Profit", value: meta.mp, cls: "text-primary" },
                { label: "Max Loss",   value: meta.ml, cls: "text-rose-400" },
              ].map(({ label, value, cls }, i) => (
                <div key={label} className={`px-5 py-3 ${i > 0 ? "border-l border-border" : ""}`}>
                  <div className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-1">{label}</div>
                  <div className={`font-mono text-xs font-bold ${cls}`}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Tagline below chart ── */}
          <p className="text-xs text-muted-foreground/40 text-center max-w-md leading-relaxed -mt-2">
            Professional analysis with real-time P/L charts, Greeks calculator, and 30+ strategy templates. Free to start.
          </p>

          {/* ── View Templates CTA (hidden, for accessibility / scroll) ── */}
          <button
            className="sr-only"
            onClick={() => document.getElementById("strategies")?.scrollIntoView({ behavior: "smooth" })}
            data-testid="button-hero-templates"
          >
            View Templates
          </button>

        </div>
      </div>
    </section>
  );
}
