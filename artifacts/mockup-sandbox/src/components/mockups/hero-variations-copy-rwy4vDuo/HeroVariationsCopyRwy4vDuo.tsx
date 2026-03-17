import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Activity, Zap, ShieldCheck, Play, GitBranch } from 'lucide-react';

export function HeroVariationsCopyRwy4vDuo() {
  const [ticker, setTicker] = useState("AAPL");
  const [strategy, setStrategy] = useState("Iron Condor");
  const [isStrategyOpen, setIsStrategyOpen] = useState(false);
  const [isTickerFocus, setIsTickerFocus] = useState(false);
  const [tick, setTick] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const tickers = ["AAPL", "TSLA", "NVDA", "SPY", "MSFT", "QQQ"];
  const strategies = [
    "Long Call", "Long Put", "Bull Call Spread", "Bear Put Spread",
    "Iron Condor", "Long Straddle", "Covered Call", "Protective Put"
  ];

  const times = ["14:32:07", "14:32:08", "14:32:09", "14:32:10", "14:32:11"];
  const currentTime = times[tick % times.length];

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
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

  return (
    <section className="relative min-h-[500px] w-full bg-[#020810] flex flex-col items-center justify-center overflow-hidden text-slate-300 font-sans py-20 lg:py-28">

      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)',
      }} />

      {/* Status Bar */}
      <div className="absolute top-0 left-0 w-full flex items-center justify-between px-5 py-1.5 border-b border-slate-800/80 bg-[#0a1122]/90 backdrop-blur font-mono text-[10px] text-slate-400 z-20">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
            <span className="text-emerald-400 font-semibold tracking-widest">LIVE</span>
          </div>
          <span className="text-slate-600">|</span>
          <span>MKT <span className="text-emerald-400">OPEN</span></span>
        </div>
        <div className="flex items-center gap-5">
          <span>SPX <span className="text-emerald-400">5,123.45</span></span>
          <span>VIX <span className="text-rose-400">13.24</span></span>
          <span className="hidden sm:inline">NDX <span className="text-emerald-400">18,042</span></span>
        </div>
      </div>

      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.12]" style={{
        backgroundImage: `linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 20%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 20%, transparent 75%)',
      }} />

      {/* Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-emerald-950/40 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[280px] h-[200px] bg-blue-950/30 blur-[90px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center w-full max-w-4xl px-4">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 border border-emerald-500/25 bg-emerald-500/8 px-3 py-1 mb-7 rounded-sm">
          <GitBranch className="w-3 h-3 text-emerald-500" />
          <span className="font-mono text-[10px] text-emerald-400 uppercase tracking-[0.15em]">OptionBuild v2 — Strategy Terminal</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-white tracking-tight text-center mb-5 leading-[1.1]">
          Architect Options Strategies<br className="hidden sm:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
            {' '}with Precision
          </span>
          <span className="inline-block w-[3px] h-[0.85em] bg-emerald-400 ml-2 align-middle translate-y-[-2px] animate-[blink_1.1s_step-end_infinite]" />
        </h1>

        <p className="text-slate-500 text-sm sm:text-base font-mono text-center max-w-xl mb-10 leading-relaxed">
          Real-time P/L heatmaps · Black-Scholes Greeks · Multi-leg execution
        </p>

        {/* Terminal Panel */}
        <div className="w-full bg-[#0c1422] border border-slate-800 shadow-[0_0_60px_rgba(0,0,0,0.6)] overflow-visible relative">

          {/* Window chrome */}
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

          {/* Prompt line */}
          <div className="px-5 py-3 border-b border-slate-800/40 font-mono text-[11px] text-slate-600">
            <span className="text-emerald-600">user@optionbuild</span>
            <span className="text-slate-600">:</span>
            <span className="text-blue-500">~/strategies</span>
            <span className="text-slate-600">$ </span>
            <span className="text-slate-400">build --interactive</span>
          </div>

          {/* Form */}
          <div className="p-5 sm:p-7 flex flex-col md:flex-row gap-4 items-end">

            {/* Ticker */}
            <div className="w-full md:w-[28%] flex flex-col relative group">
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
                <Activity className="w-3 h-3 text-blue-400" /> Strategy
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
            <div className="w-full md:w-auto md:min-w-[180px]">
              <button
                data-testid="build-strategy-button"
                className="relative w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-6 py-3 font-bold font-mono text-sm transition-all border border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_28px_rgba(16,185,129,0.35)] group overflow-hidden"
              >
                <span className="relative z-10 tracking-wide">RUN STRATEGY</span>
                <Play className="w-3.5 h-3.5 fill-slate-950 relative z-10" />
              </button>
            </div>
          </div>
        </div>

        {/* Feature cards */}
        <div className="w-full mt-5 grid grid-cols-3 gap-3">
          {[
            { label: 'P/L Heatmaps', sub: 'Real-time across strikes & time', icon: Activity, accent: 'emerald' },
            { label: 'Greeks Engine', sub: 'Black-Scholes, all sensitivities', icon: Zap, accent: 'blue' },
            { label: '25+ Templates', sub: 'Pre-built strategy profiles', icon: ShieldCheck, accent: 'purple' },
          ].map(({ label, sub, icon: Icon, accent }) => (
            <div key={label} className={`border border-slate-800/80 bg-[#0a1020]/60 px-4 py-3.5 flex items-start gap-3 hover:border-slate-700 transition-colors`}>
              <div className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-sm flex items-center justify-center bg-${accent}-950/60`}>
                <Icon className={`w-3.5 h-3.5 text-${accent}-400`} />
              </div>
              <div>
                <div className="text-slate-200 text-xs font-semibold font-mono mb-0.5">{label}</div>
                <div className="text-slate-600 text-[10px] font-mono leading-tight">{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </section>
  );
}
