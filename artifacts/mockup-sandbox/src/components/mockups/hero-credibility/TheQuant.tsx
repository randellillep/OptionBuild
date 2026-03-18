import React, { useState } from 'react';

const STRATEGIES = {
  "Iron Condor": {
    name: "Iron Condor",
    delta: "0.00",
    theta: "+$14.20/day",
    gamma: "-0.02",
    vega: "-$28.40",
    probProfit: "68%",
    maxRisk: "$380",
    chart: "M 0 120 L 40 120 L 60 30 L 100 30 L 120 120 L 160 120"
  },
  "Long Straddle": {
    name: "Long Straddle",
    delta: "0.00",
    theta: "-$12.50/day",
    gamma: "0.04",
    vega: "+$32.10",
    probProfit: "32%",
    maxRisk: "$450",
    chart: "M 0 10 L 80 120 L 160 10"
  },
  "Bull Call Spread": {
    name: "Bull Call Spread",
    delta: "0.24",
    theta: "-$2.10/day",
    gamma: "0.01",
    vega: "+$4.50",
    probProfit: "52%",
    maxRisk: "$285",
    chart: "M 0 120 L 60 120 L 100 30 L 160 30"
  },
  "Long Call": {
    name: "Long Call",
    delta: "0.45",
    theta: "-$6.30/day",
    gamma: "0.03",
    vega: "+$14.20",
    probProfit: "38%",
    maxRisk: "$285",
    chart: "M 0 120 L 80 120 L 160 0"
  }
};

type StrategyKey = keyof typeof STRATEGIES;

export default function TheQuant() {
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyKey>("Iron Condor");
  const strategy = STRATEGIES[selectedStrategy];

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-300 font-sans relative overflow-hidden flex flex-col">
      {/* Background Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#1abd9c] rounded-full blur-[120px] opacity-20 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-600 rounded-full blur-[150px] opacity-10 pointer-events-none" />
      
      {/* Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:52px_52px] pointer-events-none" />

      {/* Top Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-[#1abd9c]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 lg:py-32 flex-1 flex flex-col justify-center w-full">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-20">
          
          {/* Left Column */}
          <div className="w-full lg:w-[60%] flex flex-col items-start">
            <div className="inline-flex items-center px-3 py-1 rounded-full border border-[#1abd9c]/30 bg-[#1abd9c]/10 text-[#1abd9c] text-sm font-medium mb-6">
              Professional options analysis
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-bold text-white tracking-tight mb-6 leading-[1.1]">
              Every strategy,<br />fully quantified.
            </h1>
            
            <p className="text-xl text-slate-400 mb-10 max-w-2xl leading-relaxed">
              Not just a payoff diagram — real pricing, real Greeks, real risk.
            </p>
            
            <div className="w-full max-w-md mb-10 relative z-20">
              <label className="block text-sm font-medium text-slate-400 mb-2">Select a strategy to analyze</label>
              <div className="relative">
                <select 
                  value={selectedStrategy}
                  onChange={(e) => setSelectedStrategy(e.target.value as StrategyKey)}
                  className="w-full appearance-none bg-[#111827] border border-slate-700 hover:border-slate-600 text-white px-4 py-3 sm:py-4 rounded-xl pr-10 focus:outline-none focus:ring-2 focus:ring-[#1abd9c] focus:border-transparent transition-colors font-medium text-lg cursor-pointer"
                >
                  {Object.keys(STRATEGIES).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            
            <button className="bg-[#1abd9c] hover:bg-[#15a386] text-white px-8 py-4 rounded-xl font-semibold text-lg flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(26,189,156,0.3)] hover:shadow-[0_0_30px_rgba(26,189,156,0.5)] cursor-pointer">
              Build Strategy
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>

          {/* Right Column */}
          <div className="w-full lg:w-[40%]">
            <div className="bg-[#111827] border border-[#1e2d3d] rounded-2xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
              
              <div className="relative">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-white font-semibold text-lg">AAPL — {strategy.name}</h3>
                  <div className="text-xs font-mono text-[#1abd9c] bg-[#1abd9c]/10 px-2 py-1 rounded border border-[#1abd9c]/20">LIVE</div>
                </div>

                {/* Chart Area */}
                <div className="h-[150px] w-full border-b border-t border-[#1e2d3d] py-4 relative mb-6">
                  {/* Zero line */}
                  <div className="absolute top-[75px] left-0 right-0 border-t border-dashed border-slate-600/50" />
                  
                  {/* Y Axis Labels */}
                  <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between py-1 text-[10px] text-slate-500 font-mono">
                    <span>+$500</span>
                    <span>$0</span>
                    <span>-$500</span>
                  </div>

                  {/* SVG Chart */}
                  <svg className="w-full h-full overflow-visible ml-6" viewBox="0 0 160 150" preserveAspectRatio="none">
                    <path 
                      d={strategy.chart} 
                      fill="none" 
                      stroke="#1abd9c" 
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-all duration-500 ease-in-out drop-shadow-[0_0_8px_rgba(26,189,156,0.5)]"
                    />
                  </svg>
                </div>

                {/* Greeks Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-[#0a0f1e] rounded-lg p-3 border border-[#1e2d3d]">
                    <div className="text-xs text-slate-500 mb-1 flex items-center justify-between">
                      <span>Δ Delta</span>
                    </div>
                    <div className="font-mono text-slate-300 font-medium text-sm">{strategy.delta}</div>
                  </div>
                  <div className="bg-[#0a0f1e] rounded-lg p-3 border border-[#1e2d3d]">
                    <div className="text-xs text-slate-500 mb-1 flex items-center justify-between">
                      <span>θ Theta</span>
                    </div>
                    <div className={`font-mono font-medium text-sm ${strategy.theta.startsWith('+') ? 'text-[#1abd9c]' : 'text-rose-400'}`}>
                      {strategy.theta}
                    </div>
                  </div>
                  <div className="bg-[#0a0f1e] rounded-lg p-3 border border-[#1e2d3d]">
                    <div className="text-xs text-slate-500 mb-1 flex items-center justify-between">
                      <span>Γ Gamma</span>
                    </div>
                    <div className="font-mono text-slate-300 font-medium text-sm">{strategy.gamma}</div>
                  </div>
                  <div className="bg-[#0a0f1e] rounded-lg p-3 border border-[#1e2d3d]">
                    <div className="text-xs text-slate-500 mb-1 flex items-center justify-between">
                      <span>ν Vega</span>
                    </div>
                    <div className={`font-mono font-medium text-sm ${strategy.vega.startsWith('+') ? 'text-[#1abd9c]' : 'text-rose-400'}`}>
                      {strategy.vega}
                    </div>
                  </div>
                </div>

                {/* Stat Pills */}
                <div className="flex gap-3 mb-6">
                  <div className="flex-1 bg-[#1abd9c]/10 border border-[#1abd9c]/20 rounded-lg p-3 text-center">
                    <div className="text-[10px] text-[#1abd9c] uppercase tracking-wider mb-1 font-semibold">Prob. of Profit</div>
                    <div className="font-mono text-xl text-white font-bold">{strategy.probProfit}</div>
                  </div>
                  <div className="flex-1 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 text-center">
                    <div className="text-[10px] text-rose-400 uppercase tracking-wider mb-1 font-semibold">Max Risk</div>
                    <div className="font-mono text-xl text-white font-bold">{strategy.maxRisk}</div>
                  </div>
                </div>

                {/* IV Sparkline */}
                <div className="pt-4 border-t border-[#1e2d3d]">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-400 font-mono">IV Rank: 42</span>
                    <span className="text-xs text-slate-500 font-medium">Neutral</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#0a0f1e] rounded-full overflow-hidden relative">
                    <div className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-slate-600 to-slate-400 w-[42%] rounded-full" />
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
