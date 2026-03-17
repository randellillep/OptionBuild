import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Terminal, Activity, Zap, Play, ShieldAlert, Cpu } from 'lucide-react';

export function CommandCenter() {
  const [ticker, setTicker] = useState("AAPL");
  const [strategy, setStrategy] = useState("Long Call");
  const [isStrategyOpen, setIsStrategyOpen] = useState(false);
  const [isTickerFocus, setIsTickerFocus] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const tickers = ["AAPL", "TSLA", "NVDA", "SPY", "MSFT", "QQQ"];
  const strategies = [
    "Long Call", "Long Put", "Bull Call Spread", "Bear Put Spread", 
    "Iron Condor", "Long Straddle", "Covered Call", "Protective Put"
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', { hour12: false }) + 
        '.' + now.getMilliseconds().toString().padStart(3, '0').substring(0, 2)
      );
    }, 47);
    return () => clearInterval(timer);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsStrategyOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <section className="relative min-h-[500px] w-full bg-[#030712] flex flex-col items-center justify-center overflow-hidden text-slate-300 font-sans selection:bg-emerald-500/30 py-20 lg:py-32">
      {/* Top Status Bar */}
      <div className="absolute top-0 left-0 w-full flex items-center justify-between px-4 py-1.5 border-b border-slate-800/60 bg-[#0f172a]/80 backdrop-blur font-mono text-[10px] sm:text-xs text-slate-400 z-20">
        <div className="flex items-center space-x-4 sm:space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-500 font-medium">SYS.ONLINE</span>
          </div>
          <div className="hidden sm:block">MARKET: <span className="text-emerald-500">OPEN</span></div>
          <div className="w-[80px]">T: {currentTime || "00:00:00.00"}</div>
        </div>
        <div className="flex items-center space-x-4 sm:space-x-6">
          <div>SPX <span className="text-emerald-500">▲ 5,123.45</span></div>
          <div>NDX <span className="text-emerald-500">▲ 18,042.12</span></div>
          <div className="hidden sm:block">VIX <span className="text-rose-500">▼ 13.24</span></div>
        </div>
      </div>

      {/* Grid Background */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.15]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #475569 1px, transparent 1px),
            linear-gradient(to bottom, #475569 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)'
        }}
      />
      
      {/* Decorative ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-900/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-blue-900/20 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center w-full max-w-5xl px-4">
        {/* Headline */}
        <div className="text-center mb-10 flex flex-col items-center">
          <div className="inline-flex items-center space-x-2 border border-blue-500/30 bg-blue-500/10 px-3 py-1 mb-6 text-blue-400 font-mono text-xs uppercase tracking-wider">
            <Terminal className="w-3 h-3" />
            <span>Terminal Initialization_</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-6">
            Architect Advanced <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Option Strategies</span>
            <span className="inline-block w-3 h-8 sm:h-12 lg:h-14 bg-emerald-500 animate-[pulse_1s_step-end_infinite] ml-2 sm:ml-4 align-middle translate-y-[-4px]"></span>
          </h1>
          <p className="text-slate-400 max-w-2xl text-sm sm:text-base font-mono">
            &gt; Initialize real-time data feeds, execute complex multi-leg options, and visualize 
            potential outcomes in a high-performance command environment.
          </p>
        </div>

        {/* Command Palette Form */}
        <div className="w-full max-w-4xl bg-[#0f172a] border border-slate-800 shadow-2xl shadow-emerald-900/5 overflow-hidden flex flex-col rounded-sm relative">
          {/* Form Header */}
          <div className="flex items-center px-4 py-2.5 border-b border-slate-800 bg-[#0b1120] space-x-4">
            <div className="flex space-x-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
            </div>
            <div className="text-[10px] text-slate-500 font-mono flex-1 text-center pr-8">
              root@optionbuild: ~/strategy/init
            </div>
          </div>
          
          {/* Form Body */}
          <div className="p-5 sm:p-6 lg:p-8 flex flex-col md:flex-row gap-5 items-end relative z-20">
            
            {/* Ticker Input */}
            <div className="w-full md:w-1/3 flex flex-col relative group">
              <label className="text-[10px] font-mono text-slate-400 mb-2 uppercase tracking-wider flex items-center">
                <Search className="w-3 h-3 mr-1.5 text-emerald-500" />
                Target Asset
              </label>
              <div className={`relative flex items-center border ${isTickerFocus ? 'border-emerald-500 ring-1 ring-emerald-500/20' : 'border-slate-700'} bg-[#030712] transition-all`}>
                <div className="pl-3 text-emerald-500 font-mono font-bold">$</div>
                <input 
                  type="text" 
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  onFocus={() => setIsTickerFocus(true)}
                  onBlur={() => setIsTickerFocus(false)}
                  data-testid="ticker-input"
                  className="w-full bg-transparent border-none outline-none text-white font-mono p-3 uppercase placeholder-slate-600 focus:ring-0"
                  placeholder="TICKER"
                />
              </div>
              
              {/* Ticker Suggestions - shows on focus if empty or partially matched */}
              {isTickerFocus && ticker.length > 0 && (
                <div className="absolute top-[100%] mt-1 left-0 w-full bg-[#0f172a] border border-slate-700 shadow-xl z-50">
                  {tickers.filter(t => t.startsWith(ticker)).map(t => (
                    <div 
                      key={t}
                      onMouseDown={() => setTicker(t)}
                      className="px-4 py-2 font-mono text-sm text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
                    >
                      {t}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Strategy Dropdown */}
            <div className="w-full md:w-1/3 flex flex-col relative" ref={dropdownRef}>
              <label className="text-[10px] font-mono text-slate-400 mb-2 uppercase tracking-wider flex items-center">
                <Cpu className="w-3 h-3 mr-1.5 text-blue-400" />
                Strategy Profile
              </label>
              <button
                onClick={() => setIsStrategyOpen(!isStrategyOpen)}
                data-testid="strategy-dropdown"
                className={`w-full flex items-center justify-between border ${isStrategyOpen ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-slate-700'} bg-[#030712] p-3 text-white font-mono text-left hover:border-slate-500 transition-colors`}
              >
                <span className="truncate">{strategy}</span>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isStrategyOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isStrategyOpen && (
                <div className="absolute top-[100%] mt-1 left-0 w-full bg-[#0f172a] border border-slate-700 shadow-xl z-50 py-1 max-h-[200px] overflow-y-auto custom-scrollbar">
                  {strategies.map((s) => (
                    <button
                      key={s}
                      className="w-full text-left px-4 py-2 text-sm font-mono text-slate-300 hover:bg-[#1e293b] hover:text-white transition-colors"
                      onClick={() => {
                        setStrategy(s);
                        setIsStrategyOpen(false);
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Execute Button */}
            <div className="w-full md:w-1/3 pt-4 md:pt-0">
              <button 
                data-testid="build-strategy-button"
                className="relative w-full flex items-center justify-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 p-3 font-bold font-mono transition-colors border border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] h-[46px] group overflow-hidden"
              >
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.3)_50%,transparent_75%,transparent_100%)] bg-[length:250%_250%] animate-[shimmer_2s_linear_infinite]" />
                <span className="relative z-10">COMPILE_</span>
                <Play className="w-4 h-4 fill-slate-950 relative z-10" />
              </button>
            </div>
          </div>
        </div>

        {/* Status / Feature Indicators */}
        <div className="w-full max-w-4xl mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border border-slate-800 bg-[#0f172a]/60 backdrop-blur p-4 flex flex-col border-l-2 border-l-blue-500 hover:bg-slate-800/60 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Module_01</div>
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-sm font-medium text-slate-200 font-mono">Real-time P/L Charts</div>
          </div>
          
          <div className="border border-slate-800 bg-[#0f172a]/60 backdrop-blur p-4 flex flex-col border-l-2 border-l-purple-500 hover:bg-slate-800/60 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Module_02</div>
              <Zap className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-sm font-medium text-slate-200 font-mono">Advanced Greeks</div>
          </div>

          <div className="border border-slate-800 bg-[#0f172a]/60 backdrop-blur p-4 flex flex-col border-l-2 border-l-amber-500 hover:bg-slate-800/60 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Module_03</div>
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-sm font-medium text-slate-200 font-mono">Strategy Templates</div>
          </div>
        </div>

      </div>
      
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0f172a;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}</style>
    </section>
  );
}
