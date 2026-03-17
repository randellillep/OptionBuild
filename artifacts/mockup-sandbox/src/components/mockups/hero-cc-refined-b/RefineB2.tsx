import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, TrendingUp, Cpu, GitBranch, ArrowRight } from 'lucide-react';

// Refined B2: Data-Forward / Alive
// The terminal prompt shows computed output lines (it ran something).
// Feature section is replaced with a stat strip.
// Badge becomes a breadcrumb path. Status bar is minimal.

const OUTPUT_LINES = [
  { text: 'Loading strategy engine...', color: 'text-slate-600' },
  { text: '✓ Fetched AAPL chain  (1,240 contracts)', color: 'text-emerald-700' },
  { text: '✓ Computed Greeks · IV surface ready', color: 'text-emerald-700' },
  { text: 'Ready. Select a strategy to continue_', color: 'text-slate-400' },
];

export function RefineB2() {
  const [ticker, setTicker] = useState("AAPL");
  const [strategy, setStrategy] = useState("Iron Condor");
  const [isStrategyOpen, setIsStrategyOpen] = useState(false);
  const [isTickerFocus, setIsTickerFocus] = useState(false);
  const [visibleLines, setVisibleLines] = useState(0);
  const [cursorOn, setCursorOn] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const tickers = ["AAPL", "TSLA", "NVDA", "SPY", "MSFT", "QQQ"];
  const strategies = [
    "Long Call", "Long Put", "Bull Call Spread", "Bear Put Spread",
    "Iron Condor", "Long Straddle", "Covered Call", "Protective Put"
  ];

  // Stagger output lines appearing
  useEffect(() => {
    const delays = [200, 600, 1100, 1700];
    const timers = delays.map((d, i) =>
      setTimeout(() => setVisibleLines(i + 1), d)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  // Cursor blink
  useEffect(() => {
    const t = setInterval(() => setCursorOn(v => !v), 530);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setIsStrategyOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const stats = [
    { value: '12,400+', label: 'Strategies built' },
    { value: '6', label: 'Greeks computed' },
    { value: '4-leg', label: 'Max complexity' },
    { value: '<50ms', label: 'Chart render' },
  ];

  return (
    <section className="relative min-h-[500px] w-full bg-[#020810] flex flex-col items-center justify-center overflow-hidden text-slate-300 font-sans py-20 lg:py-28">

      {/* Scanlines */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
      }} />

      {/* Status bar — extremely minimal */}
      <div className="absolute top-0 left-0 w-full flex items-center justify-between px-5 py-1.5 border-b border-slate-800/70 bg-[#0a1122]/90 backdrop-blur font-mono text-[10px] z-20">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_#34d399] animate-pulse" />
          <span className="text-emerald-400 tracking-widest font-medium">LIVE</span>
        </div>
        <div className="flex items-center gap-5 text-slate-500">
          <span>SPX <span className="text-emerald-400">5,123</span></span>
          <span>VIX <span className="text-slate-400">13.24</span></span>
          <span className="hidden sm:inline">NDX <span className="text-emerald-400">18,042</span></span>
        </div>
      </div>

      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.11]" style={{
        backgroundImage: 'linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 20%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 20%, transparent 75%)',
      }} />

      {/* Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[280px] bg-emerald-950/40 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center w-full max-w-4xl px-4">

        {/* Breadcrumb badge */}
        <div className="inline-flex items-center gap-1.5 mb-7">
          <GitBranch className="w-3 h-3 text-slate-600" />
          <span className="font-mono text-[10px] text-slate-600">options</span>
          <span className="font-mono text-[10px] text-slate-700">/</span>
          <span className="font-mono text-[10px] text-slate-500">strategy</span>
          <span className="font-mono text-[10px] text-slate-700">/</span>
          <span className="font-mono text-[10px] text-emerald-500 font-semibold">build</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-white tracking-tight text-center mb-4 leading-[1.1]">
          Architect Options Strategies
          <br className="hidden sm:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400"> with Precision</span>
          <span
            className="inline-block w-[3px] h-[0.85em] bg-emerald-400 ml-2 align-middle translate-y-[-2px] transition-opacity duration-75"
            style={{ opacity: cursorOn ? 1 : 0 }}
          />
        </h1>

        <p className="text-slate-500 text-sm font-mono text-center max-w-lg mb-10 leading-relaxed">
          Real-time P/L heatmaps · Black-Scholes Greeks · Multi-leg execution
        </p>

        {/* Terminal Panel */}
        <div className="w-full bg-[#0c1422] border border-slate-800 shadow-[0_0_60px_rgba(0,0,0,0.6)] relative">

          {/* Chrome */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800/80 bg-[#080f1c]">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            </div>
            <span className="font-mono text-[10px] text-slate-500 flex-1 text-center pr-8">
              optionbuild — strategy/builder — 80×24
            </span>
          </div>

          {/* Prompt with staggered output lines */}
          <div className="px-5 pt-3.5 pb-0 border-b border-slate-800/40 font-mono text-[11px]">
            <div className="mb-2">
              <span className="text-emerald-700">user@optionbuild</span>
              <span className="text-slate-600">:</span>
              <span className="text-blue-600">~/strategies</span>
              <span className="text-slate-600">$ </span>
              <span className="text-slate-300">build --interactive --symbol=AAPL</span>
            </div>
            <div className="mb-3 space-y-0.5">
              {OUTPUT_LINES.map((line, i) => (
                <div
                  key={i}
                  className={`${line.color} transition-opacity duration-300 ${i < visibleLines ? 'opacity-100' : 'opacity-0'}`}
                >
                  {line.text}
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="p-5 sm:p-6 flex flex-col md:flex-row gap-4 items-end">

            {/* Ticker */}
            <div className="w-full md:w-[28%] flex flex-col relative">
              <label className="text-[10px] font-mono text-slate-500 mb-2 uppercase tracking-widest flex items-center gap-1.5">
                <Search className="w-3 h-3 text-emerald-500" /> Underlying
              </label>
              <div className={`flex items-center border ${isTickerFocus ? 'border-emerald-500/70' : 'border-slate-700/80'} bg-[#060d18] transition-all`}>
                <span className="pl-3 text-emerald-500 font-mono font-bold text-sm">$</span>
                <input
                  type="text"
                  value={ticker}
                  onChange={e => setTicker(e.target.value.toUpperCase())}
                  onFocus={() => setIsTickerFocus(true)}
                  onBlur={() => setIsTickerFocus(false)}
                  data-testid="ticker-input"
                  className="w-full bg-transparent border-none outline-none text-white font-mono p-3 text-sm uppercase placeholder-slate-700 focus:ring-0"
                  placeholder="TICKER"
                />
              </div>
              {isTickerFocus && ticker.length > 0 && (
                <div className="absolute top-full mt-px left-0 w-full bg-[#0c1422] border border-slate-700 z-50">
                  {tickers.filter(t => t.startsWith(ticker)).map(t => (
                    <div key={t} onMouseDown={() => setTicker(t)}
                      className="px-4 py-2 font-mono text-sm text-slate-300 hover:bg-slate-800 hover:text-emerald-400 cursor-pointer transition-colors">
                      {t}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Strategy */}
            <div className="w-full md:flex-1 flex flex-col relative" ref={dropdownRef}>
              <label className="text-[10px] font-mono text-slate-500 mb-2 uppercase tracking-widest flex items-center gap-1.5">
                <Cpu className="w-3 h-3 text-blue-400" /> Strategy
              </label>
              <button
                onClick={() => setIsStrategyOpen(!isStrategyOpen)}
                data-testid="strategy-dropdown"
                className={`w-full flex items-center justify-between border ${isStrategyOpen ? 'border-blue-500/60' : 'border-slate-700/80'} bg-[#060d18] px-3 py-3 text-white font-mono text-sm text-left transition-colors hover:border-slate-600`}
              >
                <span>{strategy}</span>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isStrategyOpen ? 'rotate-180' : ''}`} />
              </button>
              {isStrategyOpen && (
                <div className="absolute top-full mt-px left-0 w-full bg-[#0c1422] border border-slate-700 shadow-xl z-50 py-1 max-h-[180px] overflow-y-auto">
                  {strategies.map(s => (
                    <button key={s} onClick={() => { setStrategy(s); setIsStrategyOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm font-mono text-slate-400 hover:bg-slate-800/80 hover:text-white transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="w-full md:w-auto md:min-w-[190px]">
              <button
                data-testid="build-strategy-button"
                className="group w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-6 py-3 font-bold font-mono text-sm transition-all border border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_32px_rgba(16,185,129,0.38)]"
              >
                <span className="tracking-wide">RUN STRATEGY</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Stat strip — replaces cards */}
        <div className="w-full mt-5 grid grid-cols-4 border border-slate-800/70 divide-x divide-slate-800/70 bg-[#080f1c]/60">
          {stats.map(({ value, label }) => (
            <div key={label} className="px-4 py-3.5 flex flex-col items-start">
              <span className="font-mono text-base font-bold text-emerald-400 leading-none mb-1">{value}</span>
              <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
