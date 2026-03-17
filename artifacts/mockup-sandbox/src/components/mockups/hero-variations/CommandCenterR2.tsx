import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, TrendingUp, BarChart2, Layers, ArrowRight } from 'lucide-react';

export function CommandCenterR2() {
  const [ticker, setTicker] = useState("AAPL");
  const [strategy, setStrategy] = useState("Iron Condor");
  const [isStrategyOpen, setIsStrategyOpen] = useState(false);
  const [isTickerFocus, setIsTickerFocus] = useState(false);
  const [cursorOn, setCursorOn] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const tickers = ["AAPL", "TSLA", "NVDA", "SPY", "MSFT", "QQQ"];
  const strategies = [
    "Long Call", "Long Put", "Bull Call Spread", "Bear Put Spread",
    "Iron Condor", "Long Straddle", "Covered Call", "Protective Put"
  ];

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

  const metrics = [
    { label: 'Max Profit', value: '+$840', color: 'text-emerald-400' },
    { label: 'Max Loss', value: '-$160', color: 'text-rose-400' },
    { label: 'Breakeven', value: '$411.60', color: 'text-slate-300' },
    { label: 'Prob. Profit', value: '68%', color: 'text-blue-400' },
  ];

  return (
    <section className="relative min-h-[500px] w-full bg-[#02080f] flex flex-col items-center justify-center overflow-hidden text-slate-300 font-sans py-16 lg:py-24">

      {/* Status bar — minimal */}
      <div className="absolute top-0 left-0 w-full flex items-center justify-between px-5 py-1.5 border-b border-slate-800/60 bg-[#060e1a]/80 backdrop-blur font-mono text-[10px] text-slate-500 z-20">
        <div className="flex items-center gap-4">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_#34d399] inline-block animate-pulse" />
          <span className="text-emerald-500 tracking-widest font-medium">MARKETS OPEN</span>
        </div>
        <div className="flex items-center gap-6">
          <span>SPX <span className="text-emerald-400">▲ 5,123</span></span>
          <span>VIX <span className="text-slate-400">13.24</span></span>
          <span className="hidden sm:inline">IV30 <span className="text-blue-400">18.6%</span></span>
        </div>
      </div>

      {/* Fine grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(rgba(51,65,85,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(51,65,85,0.12) 1px, transparent 1px)`,
        backgroundSize: '32px 32px',
        maskImage: 'radial-gradient(ellipse 90% 80% at 50% 50%, black 10%, transparent 72%)',
        WebkitMaskImage: 'radial-gradient(ellipse 90% 80% at 50% 50%, black 10%, transparent 72%)',
      }} />

      {/* Glow */}
      <div className="absolute top-[45%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[640px] h-[320px] bg-emerald-950/35 blur-[110px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center w-full max-w-4xl px-4">

        {/* Eyebrow */}
        <div className="flex items-center gap-2 mb-8">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-emerald-600" />
          <span className="font-mono text-[10px] text-emerald-500 tracking-[0.2em] uppercase">Options Strategy Builder</span>
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-emerald-600" />
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-bold text-white tracking-tight text-center leading-[1.1] mb-4">
          Build. Analyze. Execute<span
            className={`inline-block w-[3px] h-[0.82em] bg-emerald-400 ml-1.5 align-middle translate-y-[-3px] transition-opacity`}
            style={{ opacity: cursorOn ? 1 : 0 }}
          />
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Options Strategies</span>
        </h1>

        <p className="text-slate-500 text-sm text-center font-mono max-w-lg mb-10 leading-relaxed">
          Institutional-grade options analytics. Real-time data. Multi-leg strategy builder with P/L visualization.
        </p>

        {/* Command panel */}
        <div className="w-full border border-slate-800 bg-[#080f1c] shadow-[0_2px_60px_rgba(0,0,0,0.7)]">

          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/70 bg-[#050b15]">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/75" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/75" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/75" />
              </div>
              <span className="font-mono text-[10px] text-slate-600 ml-2">strategy.init</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] text-slate-600">
              {['file', 'edit', 'run'].map(m => (
                <span key={m} className="hover:text-slate-400 cursor-default transition-colors uppercase tracking-wider">{m}</span>
              ))}
            </div>
          </div>

          {/* Live metrics strip */}
          <div className="flex items-center gap-0 border-b border-slate-800/50">
            {metrics.map((m, i) => (
              <div key={m.label} className={`flex-1 px-4 py-2.5 ${i < metrics.length - 1 ? 'border-r border-slate-800/50' : ''} flex flex-col`}>
                <span className="font-mono text-[9px] text-slate-600 uppercase tracking-widest mb-0.5">{m.label}</span>
                <span className={`font-mono text-sm font-semibold ${m.color}`}>{m.value}</span>
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="p-5 sm:p-6 flex flex-col sm:flex-row gap-4 items-end">

            {/* Ticker */}
            <div className="w-full sm:w-[26%] flex flex-col relative">
              <label className="text-[9px] font-mono text-slate-600 mb-1.5 uppercase tracking-[0.15em] flex items-center gap-1.5">
                <Search className="w-2.5 h-2.5" /> Symbol
              </label>
              <div className={`flex items-center border ${isTickerFocus ? 'border-emerald-500/60 bg-[#030c14]' : 'border-slate-700/70 bg-[#040b14]'} transition-all`}>
                <span className="pl-3 text-emerald-500 font-mono text-sm">$</span>
                <input
                  type="text"
                  value={ticker}
                  onChange={e => setTicker(e.target.value.toUpperCase())}
                  onFocus={() => setIsTickerFocus(true)}
                  onBlur={() => setIsTickerFocus(false)}
                  data-testid="ticker-input"
                  className="w-full bg-transparent border-none outline-none text-white font-mono p-2.5 text-sm uppercase placeholder-slate-700 focus:ring-0"
                  placeholder="AAPL"
                />
              </div>
              {isTickerFocus && ticker.length > 0 && (
                <div className="absolute top-full mt-px left-0 w-full bg-[#080f1c] border border-slate-700/80 z-50">
                  {tickers.filter(t => t.startsWith(ticker)).map(t => (
                    <div key={t} onMouseDown={() => setTicker(t)}
                      className="px-4 py-2 font-mono text-sm text-slate-400 hover:bg-slate-800/60 hover:text-emerald-400 cursor-pointer transition-colors">
                      {t}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Strategy */}
            <div className="w-full sm:flex-1 flex flex-col relative" ref={dropdownRef}>
              <label className="text-[9px] font-mono text-slate-600 mb-1.5 uppercase tracking-[0.15em] flex items-center gap-1.5">
                <Layers className="w-2.5 h-2.5" /> Strategy
              </label>
              <button
                onClick={() => setIsStrategyOpen(!isStrategyOpen)}
                data-testid="strategy-dropdown"
                className={`w-full flex items-center justify-between border ${isStrategyOpen ? 'border-blue-500/50 bg-[#030c14]' : 'border-slate-700/70 bg-[#040b14]'} px-3 py-2.5 text-white font-mono text-sm text-left transition-all hover:border-slate-600`}
              >
                <span>{strategy}</span>
                <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${isStrategyOpen ? 'rotate-180' : ''}`} />
              </button>
              {isStrategyOpen && (
                <div className="absolute top-full mt-px left-0 w-full bg-[#080f1c] border border-slate-700/80 shadow-2xl z-50 py-1 max-h-[200px] overflow-y-auto">
                  {strategies.map(s => (
                    <button key={s} onClick={() => { setStrategy(s); setIsStrategyOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm font-mono text-slate-400 hover:bg-[#0f1829] hover:text-white transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="w-full sm:w-auto sm:min-w-[200px]">
              <button
                data-testid="build-strategy-button"
                className="group w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-6 py-2.5 font-bold font-mono text-sm tracking-wide transition-all border border-emerald-400/40 shadow-[0_0_24px_rgba(16,185,129,0.12)] hover:shadow-[0_0_32px_rgba(16,185,129,0.3)]"
              >
                BUILD STRATEGY
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom feature row */}
        <div className="w-full mt-5 flex flex-col sm:flex-row items-stretch gap-3">
          {[
            { icon: TrendingUp, accent: 'emerald', stat: '12K+', label: 'Strategies Analyzed', desc: 'Across all users this month' },
            { icon: BarChart2, accent: 'blue', stat: '6 Greeks', label: 'Full Sensitivity Suite', desc: 'Δ Γ Θ V ρ + charm' },
            { icon: Layers, accent: 'purple', stat: '4-leg max', label: 'Multi-Leg Builder', desc: 'Complex spreads, condors, flies' },
          ].map(({ icon: Icon, accent, stat, label, desc }) => (
            <div key={label} className="flex-1 border border-slate-800/70 bg-[#060d18]/50 px-4 py-4 flex items-start gap-3 hover:border-slate-700/70 transition-colors">
              <Icon className={`w-4 h-4 text-${accent}-400 flex-shrink-0 mt-0.5`} />
              <div>
                <div className={`font-mono text-sm font-bold text-${accent}-400 mb-0.5`}>{stat}</div>
                <div className="font-mono text-xs text-slate-300 mb-0.5">{label}</div>
                <div className="font-mono text-[10px] text-slate-600">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
