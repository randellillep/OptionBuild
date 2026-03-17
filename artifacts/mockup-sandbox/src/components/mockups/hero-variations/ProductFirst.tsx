import React, { useState } from 'react';
import { Search, ChevronDown, BarChart2, Zap, LayoutTemplate, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ProductFirst() {
  const [ticker, setTicker] = useState('SPY');
  const [strategy, setStrategy] = useState('Bull Call Spread');
  
  const strategies = [
    "Long Call", "Long Put", "Bull Call Spread", "Bear Put Spread", 
    "Iron Condor", "Long Straddle", "Covered Call", "Protective Put"
  ];
  
  return (
    <section className="min-h-[500px] w-full bg-slate-950 text-slate-50 relative overflow-hidden flex flex-col items-center pt-24 pb-20 px-4">
      {/* Subtle Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none opacity-60" />
      <div className="absolute bottom-[-100px] right-0 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none opacity-40" />

      {/* Hero Header */}
      <div className="text-center z-10 max-w-4xl mb-12">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-br from-white via-slate-200 to-slate-500 bg-clip-text text-transparent leading-tight">
          Visualize options. <br className="hidden md:block" /> Master the trade.
        </h1>
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto font-light">
          The ultimate strategy builder. Design, analyze, and optimize your options trades with interactive payoff charts and real-time pricing.
        </p>
      </div>

      {/* Product Preview Mockup containing the Interactive Form */}
      <div className="w-full max-w-6xl z-10 relative">
        {/* Glow effect behind the product window */}
        <div className="absolute -inset-0.5 bg-gradient-to-b from-blue-500/20 to-transparent rounded-2xl blur-xl opacity-50" />
        
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col relative">
          
          {/* Top Toolbar (The Form) */}
          <div className="h-16 border-b border-slate-800 bg-slate-950/50 flex items-center px-4 md:px-6 gap-3 overflow-x-auto w-full">
            <div className="flex items-center gap-2 text-blue-500 font-bold mr-2 md:mr-6 shrink-0">
              <Activity className="h-6 w-6" />
              <span className="hidden sm:inline">OptionBuild</span>
            </div>
            
            <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700/50 px-3 py-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/30 transition-all shrink-0 w-32 md:w-48 shadow-inner">
              <Search className="h-4 w-4 text-slate-400 mr-2" />
              <input 
                type="text" 
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="Ticker..." 
                className="bg-transparent border-none outline-none text-sm text-white w-full uppercase placeholder:text-slate-500 font-mono"
                data-testid="hero-ticker-input"
              />
            </div>

            <div className="relative group shrink-0">
              <select 
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="appearance-none bg-slate-900 border border-slate-700/50 rounded-lg py-2 pl-4 pr-10 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 cursor-pointer shadow-inner font-medium transition-all hover:bg-slate-800"
                data-testid="hero-strategy-select"
              >
                {strategies.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="h-4 w-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-slate-300" />
            </div>

            <Button 
              className="bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)] border-0 ml-auto whitespace-nowrap px-6 rounded-lg font-semibold transition-all hover:scale-[1.02]"
              data-testid="hero-cta-button"
            >
              Build Strategy
            </Button>
          </div>

          {/* Builder Content Mockup */}
          <div className="flex-1 flex flex-col md:flex-row min-h-[450px]">
            {/* Sidebar Legs Mock */}
            <div className="w-full md:w-72 border-r border-slate-800 bg-slate-900/40 p-5 space-y-5 flex flex-col">
              <div className="space-y-3">
                <div className="flex justify-between items-center mb-4">
                  <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Strategy Legs</div>
                </div>
                
                {/* Leg 1 */}
                <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/50 border-l-4 border-l-emerald-500 shadow-sm relative overflow-hidden group hover:border-slate-600 transition-colors cursor-default">
                  <div className="absolute top-0 right-0 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="h-2 w-2 rounded-full bg-slate-600" />
                  </div>
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">B</span>
                      <span className="text-sm font-semibold text-slate-200">1 Call</span>
                    </div>
                    <span className="text-sm text-white font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">410.00</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 font-mono">
                    <span>14 DTE</span>
                    <span>$3.45</span>
                  </div>
                </div>

                {/* Leg 2 */}
                <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/50 border-l-4 border-l-rose-500 shadow-sm relative overflow-hidden group hover:border-slate-600 transition-colors cursor-default">
                  <div className="absolute top-0 right-0 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="h-2 w-2 rounded-full bg-slate-600" />
                  </div>
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded">S</span>
                      <span className="text-sm font-semibold text-slate-200">1 Call</span>
                    </div>
                    <span className="text-sm text-white font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">420.00</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 font-mono">
                    <span>14 DTE</span>
                    <span>$1.20</span>
                  </div>
                </div>
              </div>

              {/* Metrics Mock */}
              <div className="mt-auto pt-5 border-t border-slate-800/50 space-y-3">
                 <div className="flex justify-between items-center text-sm bg-slate-950/50 p-2 rounded-lg border border-slate-800/50">
                   <span className="text-slate-400 font-medium">Max Profit</span>
                   <span className="text-emerald-400 font-mono font-semibold">+$775.00</span>
                 </div>
                 <div className="flex justify-between items-center text-sm bg-slate-950/50 p-2 rounded-lg border border-slate-800/50">
                   <span className="text-slate-400 font-medium">Max Loss</span>
                   <span className="text-rose-400 font-mono font-semibold">-$225.00</span>
                 </div>
                 <div className="flex justify-between items-center text-sm bg-slate-950/50 p-2 rounded-lg border border-slate-800/50">
                   <span className="text-slate-400 font-medium">Win Prob</span>
                   <span className="text-slate-200 font-mono font-semibold">42.5%</span>
                 </div>
              </div>
            </div>

            {/* Main Chart Area Mock */}
            <div className="flex-1 p-6 lg:p-8 relative overflow-hidden flex flex-col bg-slate-950/20">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                  <BarChart2 className="h-5 w-5 text-slate-400" />
                  Payoff Profile
                </h3>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800">
                   <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse"></span>
                   <span className="text-xs font-mono text-slate-300">Spot: $408.50</span>
                </div>
              </div>
              
              {/* Fake P/L Chart */}
              <div className="flex-1 relative border-l border-b border-slate-800 mt-2 ml-10 mb-8 rounded-bl-sm">
                 {/* Grid Lines */}
                 <div className="absolute inset-0 flex flex-col justify-between opacity-10 pointer-events-none">
                    <div className="w-full h-[1px] bg-slate-400"></div>
                    <div className="w-full h-[1px] bg-slate-400"></div>
                    <div className="w-full h-[1px] bg-slate-400"></div>
                    <div className="w-full h-[1px] bg-slate-400"></div>
                    <div className="w-full h-[1px] bg-slate-400"></div>
                 </div>

                 {/* Zero line */}
                 <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-slate-600/60 z-10" />
                 
                 {/* Current price line */}
                 <div className="absolute top-0 bottom-0 left-[35%] border-l-2 border-dotted border-blue-500/40 z-10" />
                 
                 {/* Fake Payoff Line - Bull Call Spread shape */}
                 <svg className="absolute inset-0 w-full h-full z-20" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(16, 185, 129, 0.2)" />
                        <stop offset="50%" stopColor="rgba(16, 185, 129, 0.05)" />
                        <stop offset="100%" stopColor="transparent" />
                      </linearGradient>
                      <linearGradient id="lossGradient" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="rgba(225, 29, 72, 0.15)" />
                        <stop offset="50%" stopColor="rgba(225, 29, 72, 0.05)" />
                        <stop offset="100%" stopColor="transparent" />
                      </linearGradient>
                    </defs>
                    
                    {/* Loss area fill */}
                    <path 
                      d="M 0,80 L 40,80 L 40,50 L 0,50 Z" 
                      fill="url(#lossGradient)" 
                    />
                    
                    {/* Profit area fill */}
                    <path 
                      d="M 55,50 L 70,20 L 100,20 L 100,50 Z" 
                      fill="url(#profitGradient)" 
                    />

                    {/* The main line */}
                    <path 
                      d="M 0,80 L 40,80 L 70,20 L 100,20" 
                      fill="none" 
                      stroke="#3b82f6" 
                      strokeWidth="2.5" 
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="drop-shadow-[0_0_6px_rgba(59,130,246,0.6)]"
                    />
                    
                    {/* Break-even point marker */}
                    <circle cx="55" cy="50" r="3" fill="#10b981" />
                 </svg>

                 {/* Y-axis labels */}
                 <div className="absolute -left-12 top-0 bottom-0 flex flex-col justify-between text-[11px] text-slate-500 font-mono py-1 pr-2 text-right w-10">
                    <span className="text-emerald-500/70">+$1k</span>
                    <span className="text-emerald-500/70">+$500</span>
                    <span className="text-slate-400">$0</span>
                    <span className="text-rose-500/70">-$500</span>
                    <span className="text-rose-500/70">-$1k</span>
                 </div>

                 {/* X-axis labels */}
                 <div className="absolute left-0 right-0 -bottom-8 flex justify-between text-[11px] text-slate-500 font-mono px-2">
                    <span>380</span>
                    <span>390</span>
                    <span>400</span>
                    <span className="text-blue-400 bg-blue-500/10 px-1 rounded">410</span>
                    <span className="text-slate-300 bg-slate-800 px-1 rounded">420</span>
                    <span>430</span>
                 </div>
                 
                 {/* Annotations */}
                 <div className="absolute top-1/4 right-[15%] text-[10px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-1 rounded shadow-sm backdrop-blur-sm">
                   Max Profit
                 </div>
                 <div className="absolute bottom-[10%] left-[10%] text-[10px] font-medium text-rose-400 bg-rose-950/60 border border-rose-800/50 px-2 py-1 rounded shadow-sm backdrop-blur-sm">
                   Max Loss
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Badges below the mock */}
      <div className="mt-12 flex flex-wrap justify-center gap-4 z-10">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/60 border border-slate-800 text-sm text-slate-300 backdrop-blur-md shadow-sm hover:bg-slate-800/80 transition-colors">
          <BarChart2 className="h-4 w-4 text-emerald-400" />
          Interactive P/L Charts
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/60 border border-slate-800 text-sm text-slate-300 backdrop-blur-md shadow-sm hover:bg-slate-800/80 transition-colors">
          <Zap className="h-4 w-4 text-yellow-400" />
          Real-time Greeks
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/60 border border-slate-800 text-sm text-slate-300 backdrop-blur-md shadow-sm hover:bg-slate-800/80 transition-colors">
          <LayoutTemplate className="h-4 w-4 text-blue-400" />
          20+ Strategy Templates
        </div>
      </div>
    </section>
  );
}
