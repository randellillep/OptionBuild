import React, { useState } from 'react';
import { Search, ChevronDown, TrendingUp, Zap, Shield } from 'lucide-react';
import { Button } from '../../ui/button';

const TICKER_SUGGESTIONS = ["AAPL", "TSLA", "NVDA", "SPY", "MSFT", "QQQ"];
const STRATEGIES = [
  "Long Call", "Long Put", "Bull Call Spread", "Bear Put Spread", 
  "Iron Condor", "Long Straddle", "Covered Call", "Protective Put"
];

export function SocialProofLed() {
  const [ticker, setTicker] = useState('SPY');
  const [isTickerFocused, setIsTickerFocused] = useState(false);
  const [strategy, setStrategy] = useState(STRATEGIES[4]); // Default to Iron Condor
  const [isStrategyOpen, setIsStrategyOpen] = useState(false);

  return (
    <section className="relative min-h-[600px] w-full bg-slate-950 flex flex-col items-center justify-center overflow-hidden py-20 px-4 font-sans text-slate-50">
      {/* Background with radial spotlight effect */}
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
        <div className="w-[800px] h-[800px] rounded-full bg-emerald-900/10 blur-[120px] opacity-70 animate-pulse-slow" />
      </div>

      <div className="relative z-10 max-w-5xl w-full flex flex-col items-center text-center space-y-12">
        
        {/* Headline */}
        <div className="space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Zap className="w-3 h-3" /> Trusted by professional traders
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-tight">
            Visualize your edge in <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              real-time
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">
            The institutional-grade options builder built for everyone. No paywalls, no delayed data, just raw analytical power.
          </p>
        </div>

        {/* Stat Counters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 w-full max-w-4xl py-6 border-y border-slate-800/60 bg-slate-900/30 backdrop-blur-sm rounded-3xl px-8 shadow-2xl shadow-emerald-900/5">
          <div className="flex flex-col items-center justify-center space-y-1">
            <div className="text-3xl md:text-4xl font-mono font-bold text-emerald-400 tracking-tighter drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">
              10k+
            </div>
            <div className="text-xs md:text-sm text-slate-400 font-medium uppercase tracking-wider">Strategies Built</div>
          </div>
          <div className="flex flex-col items-center justify-center space-y-1">
            <div className="text-3xl md:text-4xl font-mono font-bold text-emerald-400 tracking-tighter drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">
              30+
            </div>
            <div className="text-xs md:text-sm text-slate-400 font-medium uppercase tracking-wider">Templates</div>
          </div>
          <div className="flex flex-col items-center justify-center space-y-1">
            <div className="text-3xl md:text-4xl font-mono font-bold text-emerald-400 tracking-tighter drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">
              Live
            </div>
            <div className="text-xs md:text-sm text-slate-400 font-medium uppercase tracking-wider">Market Data</div>
          </div>
          <div className="flex flex-col items-center justify-center space-y-1">
            <div className="text-3xl md:text-4xl font-mono font-bold text-emerald-400 tracking-tighter drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">
              $0
            </div>
            <div className="text-xs md:text-sm text-slate-400 font-medium uppercase tracking-wider">Platform Fee</div>
          </div>
        </div>

        {/* Interactive Form */}
        <div className="w-full max-w-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl p-2 rounded-2xl shadow-2xl shadow-black/50">
          <div className="flex flex-col sm:flex-row gap-2">
            
            {/* Ticker Input */}
            <div className="relative flex-1 group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className={`w-4 h-4 transition-colors ${isTickerFocused ? 'text-emerald-400' : 'text-slate-500'}`} />
              </div>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onFocus={() => setIsTickerFocused(true)}
                onBlur={() => setTimeout(() => setIsTickerFocused(false), 200)}
                className="w-full h-14 pl-11 pr-4 bg-slate-950/50 border border-slate-800 rounded-xl text-white font-mono text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all uppercase placeholder:text-slate-600"
                placeholder="Ticker (e.g. AAPL)"
                data-testid="hero-ticker-input"
              />
              
              {/* Ticker Suggestions Dropdown */}
              {isTickerFocused && (
                <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-2">
                    <div className="text-xs font-semibold text-slate-500 px-3 pb-2 pt-1 uppercase tracking-wider">Popular</div>
                    {TICKER_SUGGESTIONS.map(t => (
                      <button
                        key={t}
                        className="w-full text-left px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg font-mono text-sm transition-colors"
                        onClick={() => {
                          setTicker(t);
                          setIsTickerFocused(false);
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Strategy Dropdown */}
            <div className="relative flex-1">
              <button
                onClick={() => setIsStrategyOpen(!isStrategyOpen)}
                className="w-full h-14 px-4 bg-slate-950/50 border border-slate-800 rounded-xl flex items-center justify-between hover:border-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                data-testid="hero-strategy-dropdown"
              >
                <div className="flex flex-col items-start">
                  <span className="text-xs text-slate-500 font-medium">Strategy</span>
                  <span className="text-slate-200 font-medium">{strategy}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isStrategyOpen ? 'rotate-180' : ''}`} />
              </button>

              {isStrategyOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden z-50 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-2 flex flex-col gap-1">
                    {STRATEGIES.map(s => (
                      <button
                        key={s}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          strategy === s 
                            ? 'bg-emerald-500/10 text-emerald-400 font-medium' 
                            : 'text-slate-300 hover:text-white hover:bg-slate-800'
                        }`}
                        onClick={() => {
                          setStrategy(s);
                          setIsStrategyOpen(false);
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* CTA Button */}
            <Button 
              className="h-14 px-8 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-lg rounded-xl shadow-[0_0_20px_rgba(52,211,153,0.3)] hover:shadow-[0_0_25px_rgba(52,211,153,0.5)] transition-all whitespace-nowrap"
              data-testid="hero-cta-button"
            >
              Build Strategy
            </Button>

          </div>
        </div>

        {/* Feature Badges / Trust Signals */}
        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border border-slate-800/80 rounded-full text-sm text-slate-300 backdrop-blur-sm">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Interactive P/L Charts</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border border-slate-800/80 rounded-full text-sm text-slate-300 backdrop-blur-sm">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>Real-time Greeks</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border border-slate-800/80 rounded-full text-sm text-slate-300 backdrop-blur-sm">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Bank-grade Analytics</span>
          </div>
        </div>

      </div>
    </section>
  );
}
