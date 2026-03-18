import { useState, useEffect } from "react";
import { HeroSection } from "@/components/HeroSection";
import { StrategyTemplateCard } from "@/components/StrategyTemplateCard";
import { Button } from "@/components/ui/button";

import {
  TrendingUp,
  ArrowRight,
  Menu,
  X,
  ChevronRight,
  Clock,
  Zap,
} from "lucide-react";
import { strategyTemplates } from "@/lib/strategy-templates";
import { useLocation } from "wouter";


// ── Inline Theta Clock logic ──────────────────────────────────────────────────
function useThetaProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const duration = 8000;
    let raf: number;
    const tick = () => {
      setProgress(((Date.now() - start) % duration) / duration);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return progress;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// ─────────────────────────────────────────────────────────────────────────────

const featuresEditorial = [
  {
    num: "01",
    icon: "▦",
    tag: "Price × Time Analysis",
    title: "P/L Heatmap",
    desc: "A color-coded matrix that maps every possible profit and loss outcome across 50 price levels and 20 time intervals. Know exactly where you win before the trade.",
    highlight: "See profit at every strike price — instantly.",
  },
  {
    num: "02",
    icon: "∂",
    tag: "Risk Sensitivity",
    title: "Options Greeks",
    desc: "Delta, gamma, theta, vega, and rho calculated live across your entire multi-leg position. Watch how your strategy responds as the market moves.",
    highlight: "Full Greek breakdown. Real market data.",
  },
  {
    num: "03",
    icon: "◈",
    tag: "Strategy Library",
    title: "30+ Strategy Templates",
    desc: "Pre-built spreads, straddles, iron condors, butterflies, and more. Load any template in one click, then customize strikes, expirations, and quantity.",
    highlight: "32 templates covering every market view.",
  },
  {
    num: "04",
    icon: "↗",
    tag: "Historical Simulation",
    title: "Backtesting",
    desc: "Run any strategy against years of historical data. See win rate, max drawdown, Sharpe ratio, and net P/L before you risk real capital.",
    highlight: "72% average win rate on short premium.",
  },
  {
    num: "05",
    icon: "⌇",
    tag: "Payoff Visualization",
    title: "P/L Chart",
    desc: "An interactive payoff diagram that updates in real time as you adjust strikes, expirations, and volatility. Breakeven lines, max profit, and max loss annotated.",
    highlight: "Real-time diagram. Drag to simulate.",
  },
  {
    num: "06",
    icon: "⌕",
    tag: "Chain Filter",
    title: "Option Finder",
    desc: "Filter the full options chain by strike, expiration, delta, IV rank, and open interest. Surface the best contract for your strategy in seconds.",
    highlight: "Filter 500+ contracts in under a second.",
  },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const thetaProgress = useThetaProgress();

  const dte = Math.max(0, Math.round(30 * (1 - thetaProgress)));
  let pnl = 0;
  if (thetaProgress < 0.5) pnl = lerp(186, 214, thetaProgress / 0.5);
  else if (thetaProgress < 0.833) pnl = lerp(214, 228, (thetaProgress - 0.5) / 0.333);
  else pnl = lerp(228, 220, (thetaProgress - 0.833) / 0.167);
  const prob = Math.round(lerp(68, 82, thetaProgress));

  const getRiskLevel = (legCount: number): "Low" | "Medium" | "High" => {
    if (legCount === 1) return "Medium";
    if (legCount === 2) return "Low";
    return "High";
  };

  const getSentiment = (template: typeof strategyTemplates[0]): string => {
    const meta = template.metadata;
    if (!meta) return "neutral";
    if (meta.category === "bullish") return "bullish";
    if (meta.category === "bearish") return "bearish";
    return "neutral";
  };

  const featuredStrategies = [0, 1, 6, 10, 16, 22, 26, 4, 2].filter(i => i < strategyTemplates.length);

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">

      {/* ── Global ambient background ─────────────────────────────────────── */}
      {/* Faint dot grid */}
      <div className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: "radial-gradient(circle, hsl(var(--primary)/0.12) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "linear-gradient(to bottom, transparent 0%, black 10%, black 85%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 10%, black 85%, transparent 100%)",
        }}
      />
      {/* Top-left orb */}
      <div className="pointer-events-none fixed z-0 rounded-full"
        style={{ width: 500, height: 500, top: -100, left: -150, background: "radial-gradient(ellipse, hsl(var(--primary)/0.06) 0%, transparent 70%)" }} />
      {/* Mid-right orb (features area) */}
      <div className="pointer-events-none fixed z-0 rounded-full"
        style={{ width: 600, height: 400, top: "60vh", right: -200, background: "radial-gradient(ellipse, hsl(220 60% 50%/0.05) 0%, transparent 70%)" }} />
      {/* Lower-left orb (strategies area) */}
      <div className="pointer-events-none fixed z-0 rounded-full"
        style={{ width: 500, height: 500, top: "150vh", left: -100, background: "radial-gradient(ellipse, hsl(var(--primary)/0.04) 0%, transparent 70%)" }} />

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 md:px-6 flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold">OptionBuild</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-features">Features</a>
            <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-strategies">Strategies</button>
            <button onClick={() => setLocation("/tutorial")} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="button-nav-tutorial">Tutorial</button>
            <button onClick={() => setLocation("/blog")} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="button-nav-blog">Blog</button>
            <Button onClick={() => setLocation("/builder")} data-testid="button-nav-builder">Launch Builder</Button>
          </nav>
          <div className="flex md:hidden items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} data-testid="button-menu">
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background px-4 py-3 space-y-1">
            <a href="#features" className="block py-2 text-sm font-medium text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <button onClick={() => { setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="block py-2 text-sm font-medium text-muted-foreground w-full text-left">Strategies</button>
            <button onClick={() => { setMobileMenuOpen(false); setLocation("/tutorial"); }} className="block py-2 text-sm font-medium text-muted-foreground w-full text-left">Tutorial</button>
            <button onClick={() => { setMobileMenuOpen(false); setLocation("/blog"); }} className="block py-2 text-sm font-medium text-muted-foreground w-full text-left">Blog</button>
            <Button className="w-full mt-2" onClick={() => { setMobileMenuOpen(false); setLocation("/builder"); }}>Launch Builder</Button>
          </div>
        )}
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <HeroSection
        onGetStarted={() => setLocation("/builder")}
        onBuildStrategy={(symbol, strategyIndex) => {
          setLocation(`/builder?symbol=${encodeURIComponent(symbol)}&strategy=${strategyIndex}`);
        }}
      />

      {/* ── Features Editorial Grid ───────────────────────────────────────────── */}
      <section id="features" className="py-20 md:py-28">
        <div className="container mx-auto px-4 md:px-6">

          {/* Header */}
          <div className="mb-10 pb-6 border-b border-border">
            <p className="text-xs font-mono font-semibold tracking-[0.2em] text-primary/80 uppercase mb-3">The Full Toolkit</p>
            <div className="flex flex-wrap items-end gap-6">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Six tools that cover everything</h2>
              <p className="text-sm text-muted-foreground pb-1">Professional options analysis. No fluff.</p>
            </div>
          </div>

          {/* 2-col editorial grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {featuresEditorial.map((f, i) => {
              const isRight = i % 2 === 1;
              const isLast = i >= featuresEditorial.length - 2;
              return (
                <div
                  key={f.num}
                  data-testid={`card-feature-${f.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  className="relative py-8 px-6 group"
                  style={{
                    borderRight: !isRight ? "1px solid hsl(var(--border))" : "none",
                    borderBottom: !isLast ? "1px solid hsl(var(--border))" : "none",
                  }}
                >
                  {/* Ghost ordinal — top-right, large, uniform primary tint */}
                  <div
                    className="absolute top-6 right-6 font-mono font-black leading-none select-none text-5xl pointer-events-none text-primary"
                    style={{ opacity: 0.08 }}
                  >
                    {f.num}
                  </div>

                  {/* Ordinal + tag pill */}
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="font-mono text-sm font-bold text-primary">{f.num}</span>
                    <span className="text-[9px] font-mono tracking-[0.15em] px-2 py-0.5 rounded bg-primary/[0.08] text-primary border border-primary/20">
                      {f.tag.toUpperCase()}
                    </span>
                  </div>

                  {/* Icon glyph + title */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg text-primary leading-none">{f.icon}</span>
                    <h3 className="text-base font-bold">{f.title}</h3>
                  </div>

                  {/* Description */}
                  <p className="text-sm leading-relaxed text-muted-foreground mb-4">{f.desc}</p>

                  {/* Highlight pill */}
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold tracking-wide px-2.5 py-1.5 rounded bg-muted text-primary border border-primary/20">
                    <span className="w-1 h-1 rounded-full bg-primary" />
                    {f.highlight}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-0 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground/60">Options trading involves risk. OptionBuild provides analysis tools only.</p>
            <Button onClick={() => setLocation("/builder")} data-testid="button-features-cta">
              Launch Builder <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>

        </div>
      </section>

      {/* ── Theta Clock: P&L over time ──────────────────────────────────────── */}
      <section className="py-20 md:py-28 relative overflow-hidden bg-muted/10 border-y border-border">

        {/* subtle orb */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] pointer-events-none rounded-full"
          style={{ background: "radial-gradient(ellipse at center, hsl(var(--primary)/0.08) 0%, transparent 65%)" }} />

        <div className="container mx-auto px-4 md:px-6 relative z-10">

          <div className="text-center mb-10">
            <p className="text-xs font-mono font-semibold tracking-[0.2em] text-primary/80 uppercase mb-3">Time Decay, Visualized</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              Your P&L evolves with every day
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Theta works for you — or against you. Watch an Iron Condor unfold from 30 DTE to expiration.
            </p>
          </div>

          {/* Chart panel */}
          <div className="max-w-3xl mx-auto border border-border bg-card rounded-lg overflow-hidden shadow-xl">

            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-xs text-muted-foreground/70">AAPL · Iron Condor · P/L over time</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="font-mono text-xs font-semibold text-primary">{dte} DTE</span>
              </div>
            </div>

            {/* Animated chart */}
            <div className="px-5 pt-5 pb-2 relative">
              <div className="relative h-[160px]">
                <svg viewBox="0 0 800 160" className="w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="tc-profit-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* zero line */}
                  <line x1="0" y1="80" x2="800" y2="80" stroke="hsl(var(--border))" strokeWidth="1.5" strokeDasharray="4 4" />
                  {/* grid verticals */}
                  {[200, 400, 600].map(x => (
                    <line key={x} x1={x} y1="0" x2={x} y2="160" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.5" />
                  ))}
                  {/* Iron Condor shape — profit fill */}
                  <path d="M 0 128 L 120 128 L 200 32 L 600 32 L 680 128 L 800 128 L 800 160 L 0 160 Z" fill="url(#tc-profit-grad)" />
                  {/* Iron Condor shape — line */}
                  <path d="M 0 128 L 120 128 L 200 32 L 600 32 L 680 128 L 800 128" fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  {/* breakeven labels */}
                  <text x="8" y="14" fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="monospace" opacity="0.5">PROFIT</text>
                  <text x="8" y="152" fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="monospace" opacity="0.5">LOSS</text>
                </svg>

                {/* Animated cursor */}
                <div
                  className="absolute top-0 bottom-0 w-[2px] z-10 pointer-events-none"
                  style={{
                    left: `${thetaProgress * 100}%`,
                    background: "hsl(var(--primary))",
                    boxShadow: "0 0 8px hsl(var(--primary)/0.5)",
                    transition: "left 60ms linear",
                  }}
                >
                  {/* pulsing dot */}
                  <div className="absolute -top-1 -left-[5px] w-3 h-3 rounded-full bg-primary">
                    <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-60" />
                  </div>
                  {/* floating label */}
                  <div
                    className="absolute -top-9 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-mono font-bold px-2 py-1 rounded whitespace-nowrap"
                    style={{ boxShadow: "0 0 10px hsl(var(--primary)/0.4)" }}
                  >
                    Day {30 - dte}
                  </div>
                </div>
              </div>

              {/* DTE axis labels */}
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground/50 mt-3 mb-3">
                <span>Entry (Day 0)</span>
                <span className="text-primary font-semibold">{dte} DTE remaining</span>
                <span>Expiration</span>
              </div>
            </div>

            {/* Metrics strip */}
            <div className="grid grid-cols-3 border-t border-border">
              {[
                { label: "P&L at Day " + (30 - dte), value: `+$${pnl.toFixed(0)}`, cls: "text-primary" },
                { label: "Theta / Day", value: "+$14.20", cls: "text-foreground" },
                { label: "Prob. Profit", value: `${prob}%`, cls: "text-primary" },
              ].map(({ label, value, cls }, i) => (
                <div key={label} className={`px-5 py-3.5 ${i > 0 ? "border-l border-border" : ""}`}>
                  <div className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-1">{label}</div>
                  <div className={`font-mono text-sm font-bold ${cls}`}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center mt-8">
            <Button onClick={() => setLocation("/builder")} data-testid="button-theta-cta">
              Analyze your own position
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── Trade Directly ──────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">

            <div>
              <p className="text-xs font-mono font-semibold tracking-[0.2em] text-primary/80 uppercase mb-3">Brokerage Integration</p>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
                Trade directly from the builder
              </h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Connect your brokerage account and execute trades without leaving OptionBuild.
                Build your strategy, analyze the risk, and place the order — all in one workflow.
              </p>

              <div className="space-y-3 mb-7">
                {[
                  { name: "Alpaca", desc: "Paper + Live Trading", Icon: Zap },
                  { name: "tastytrade", desc: "Sandbox + Live Trading", Icon: TrendingUp },
                ].map(({ name, desc, Icon }) => (
                  <div key={name} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md border border-border bg-muted/30 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold">{name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{desc}</span>
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="outline" onClick={() => setLocation("/builder?tab=trade")} data-testid="button-connect-brokerage">
                Connect Your Broker
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {/* Mock brokerage card */}
            <div className="rounded-lg border border-border bg-card p-6 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Account Status</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Connected
                </span>
              </div>
              <div className="h-px bg-border" />
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Buying Power</p>
                  <p className="text-xl font-bold font-mono">$25,430</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Portfolio Value</p>
                  <p className="text-xl font-bold font-mono">$52,180</p>
                </div>
              </div>
              <div className="h-px bg-border" />
              <div className="space-y-2.5">
                {[
                  { label: "AAPL 260C Mar 21", qty: "+2 contracts", status: "Filled", gain: "+$480", pos: true },
                  { label: "SPY Iron Condor", qty: "+1 spread", status: "Open", gain: "+$214", pos: true },
                  { label: "TSLA 200P Mar 28", qty: "+1 contract", status: "Filled", gain: "-$130", pos: false },
                ].map(({ label, qty, status, gain, pos }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-mono font-medium text-foreground">{label}</span>
                      <span className="text-xs text-muted-foreground ml-2">{qty}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-semibold ${pos ? "text-emerald-500" : "text-rose-400"}`}>{gain}</span>
                      <span className="text-xs text-muted-foreground">{status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Strategy Templates ──────────────────────────────────────────────── */}
      <section id="strategies" className="py-20 md:py-28 bg-muted/10 border-t border-border">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-10">
            <p className="text-xs font-mono font-semibold tracking-[0.2em] text-primary/80 uppercase mb-3">Strategy Library</p>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Popular strategy templates</h2>
                <p className="text-muted-foreground">Start with a proven structure. Customize to your market view.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setLocation("/builder?openStrategies=1")} data-testid="button-view-all-strategies">
                View all {strategyTemplates.length}
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredStrategies.map((templateIdx) => {
              const template = strategyTemplates[templateIdx];
              return (
                <StrategyTemplateCard
                  key={templateIdx}
                  name={template.name}
                  description={template.description}
                  legCount={template.legs.length}
                  riskLevel={getRiskLevel(template.legs.length)}
                  sentiment={getSentiment(template)}
                  onSelect={() => setLocation(`/builder?strategy=${templateIdx}`)}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────────── */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        {/* background glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%, hsl(var(--primary)/0.07) 0%, transparent 70%)" }} />
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(to right, transparent, hsl(var(--primary)/0.4) 30%, hsl(var(--primary)/0.4) 70%, transparent)" }} />

        <div className="container mx-auto px-4 md:px-6 text-center relative z-10">
          <p className="text-xs font-mono font-semibold tracking-[0.2em] text-primary/80 uppercase mb-4">Get Started Free</p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Start building smarter strategies
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto mb-10 text-lg">
            No account required. Real-time market data, 30+ strategy templates, and professional analysis — all free to start.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" onClick={() => setLocation("/builder")} data-testid="button-cta-launch" className="px-8">
              Launch Builder
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => setLocation("/tutorial")} data-testid="button-cta-tutorial">
              Watch Tutorial
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-12 bg-muted/10">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="font-bold text-sm">OptionBuild</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[180px]">
                Professional options analysis tools for serious traders.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><button onClick={() => setLocation("/builder")} className="hover:text-foreground transition-colors">Builder</button></li>
                <li><button onClick={() => setLocation("/backtest")} className="hover:text-foreground transition-colors">Backtest</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><button onClick={() => setLocation("/tutorial")} className="hover:text-foreground transition-colors">Tutorial</button></li>
                <li><button onClick={() => setLocation("/faq")} className="hover:text-foreground transition-colors">FAQ</button></li>
                <li><button onClick={() => setLocation("/blog")} className="hover:text-foreground transition-colors">Blog</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><button onClick={() => setLocation("/about")} className="hover:text-foreground transition-colors">About</button></li>
                <li><a href="mailto:support@optionbuild.com" className="hover:text-foreground transition-colors">Contact</a></li>
                <li><button onClick={() => setLocation("/terms")} className="hover:text-foreground transition-colors">Terms & Privacy</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-6">
            <p className="text-xs text-muted-foreground text-center">
              Options trading involves risk and is not suitable for all investors. OptionBuild provides analysis tools only and does not provide investment advice.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
