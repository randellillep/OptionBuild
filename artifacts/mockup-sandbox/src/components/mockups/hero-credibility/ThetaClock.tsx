import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';

export default function ThetaClock() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let start = Date.now();
    const duration = 8000;
    
    const tick = () => {
      const now = Date.now();
      const elapsed = (now - start) % duration;
      setProgress(elapsed / duration);
      requestAnimationFrame(tick);
    };
    
    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Calculate values based on progress (0 to 1)
  const dte = Math.max(0, Math.round(30 * (1 - progress)));
  
  let pnl = 0;
  if (progress < 0.5) {
    pnl = 186 + (214 - 186) * (progress / 0.5);
  } else if (progress < 0.833) {
    pnl = 214 + (228 - 214) * ((progress - 0.5) / 0.333);
  } else {
    pnl = 228 + (220 - 228) * ((progress - 0.833) / 0.167);
  }
  
  const prob = Math.round(68 + 14 * progress);

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white font-sans overflow-hidden relative flex flex-col items-center justify-center pt-20 pb-16">
      {/* Background Orbs & Grid */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#1abd9c] opacity-20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-600 opacity-10 rounded-full blur-[150px] pointer-events-none" />
      
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:52px_52px] pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-[1px] bg-[#1abd9c] opacity-50" />

      {/* Top Center Section */}
      <div className="relative z-10 text-center max-w-2xl mx-auto px-4 mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111827] border border-[#1e2d3d] text-xs font-medium text-gray-400 mb-6">
          <span className="text-[#1abd9c]">AAPL</span>
          <span>·</span>
          <span>Iron Condor</span>
          <span>·</span>
          <span>30 DTE</span>
        </div>
        
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 text-white">
          Watch your P&L <span className="text-[#1abd9c]">evolve</span> in real time.
        </h1>
        <p className="text-lg md:text-xl text-gray-400">
          Theta works for you — or against you. See exactly how.
        </p>
      </div>

      {/* Center: Animated Chart Section */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 mb-12">
        <div className="bg-[#111827]/80 backdrop-blur-sm border border-[#1e2d3d] rounded-2xl p-6 shadow-2xl">
          
          <div className="relative h-[200px] w-full mt-8 mb-4">
            {/* Base SVG Payoff Chart */}
            <svg viewBox="0 0 800 200" className="w-full h-full overflow-visible" preserveAspectRatio="none">
              {/* Zero line */}
              <line x1="0" y1="100" x2="800" y2="100" stroke="#1e2d3d" strokeWidth="2" strokeDasharray="4 4" />
              
              {/* Iron Condor Shape */}
              <path 
                d="M 0 160 L 150 160 L 250 40 L 550 40 L 650 160 L 800 160" 
                fill="none" 
                stroke="#374151" 
                strokeWidth="3" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
              
              <path 
                d="M 0 140 L 170 140 L 270 50 L 530 50 L 630 140 L 800 140" 
                fill="none" 
                stroke="#1abd9c" 
                strokeWidth="3" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="opacity-50"
              />

              {/* Shaded Profit Area */}
              <path 
                d="M 216 100 L 250 40 L 550 40 L 584 100 Z" 
                fill="url(#profit-gradient)" 
                opacity="0.2"
              />
              <path 
                d="M 240 100 L 270 50 L 530 50 L 560 100 Z" 
                fill="url(#profit-gradient)" 
                opacity="0.2"
              />

              <defs>
                <linearGradient id="profit-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1abd9c" stopOpacity="1" />
                  <stop offset="100%" stopColor="#1abd9c" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>

            {/* Animated Cursor Line */}
            <div 
              className="absolute top-0 bottom-0 w-[2px] bg-[#1abd9c] transition-all duration-75 ease-linear z-20 pointer-events-none"
              style={{ left: `${progress * 100}%` }}
            >
              {/* Pulsing Dot at top */}
              <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-[#1abd9c] rounded-full">
                <div className="absolute inset-0 bg-[#1abd9c] rounded-full animate-ping opacity-75" />
              </div>
              
              {/* Floating Label */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#1abd9c] text-[#0a0f1e] text-xs font-bold px-2 py-1 rounded whitespace-nowrap shadow-[0_0_10px_rgba(26,189,156,0.5)]">
                Day {30 - dte}
                {/* Arrow pointing down */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#1abd9c]" />
              </div>
            </div>
            
            {/* DTE Counter (visual placement) */}
            <div className="absolute -bottom-8 left-0 right-0 flex justify-between text-xs font-mono text-gray-500">
              <span>30 DTE</span>
              <span className="text-[#1abd9c] font-bold">{dte} DTE</span>
              <span>0 DTE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Below Chart: Stat Boxes */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        <div className="bg-[#111827] border border-[#1e2d3d] rounded-xl p-5 flex flex-col items-center justify-center text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-b from-[#1abd9c]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="text-sm text-gray-400 mb-2">P&L Today</span>
          <span className="text-3xl font-mono font-bold text-[#1abd9c]">
            +${pnl.toFixed(0)}
          </span>
        </div>
        
        <div className="bg-[#111827] border border-[#1e2d3d] rounded-xl p-5 flex flex-col items-center justify-center text-center">
          <span className="text-sm text-gray-400 mb-2">Theta/Day</span>
          <span className="text-3xl font-mono font-bold text-white">
            +$14.20
          </span>
        </div>

        <div className="bg-[#111827] border border-[#1e2d3d] rounded-xl p-5 flex flex-col items-center justify-center text-center">
          <span className="text-sm text-gray-400 mb-2">Prob. Profit</span>
          <div className="flex items-center gap-2 text-3xl font-mono font-bold">
            <span className="text-gray-500 line-through text-2xl">68%</span>
            <ArrowRight className="w-5 h-5 text-gray-600" />
            <span className="text-[#1abd9c]">{prob}%</span>
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 mt-4">
        <button className="px-8 py-3.5 bg-[#1abd9c] hover:bg-[#15a386] text-[#0a0f1e] font-semibold rounded-lg shadow-[0_0_20px_rgba(26,189,156,0.3)] transition-all flex items-center gap-2">
          Analyze AAPL <ArrowRight className="w-4 h-4" />
        </button>
        <button className="px-8 py-3.5 bg-transparent border border-[#1e2d3d] hover:bg-[#1e2d3d] text-white font-medium rounded-lg transition-all">
          Try another strategy
        </button>
      </div>

      {/* Tagline */}
      <p className="relative z-10 mt-12 text-sm text-gray-500">
        Iron Condor wins 68% of the time at 30 DTE.
      </p>
    </div>
  );
}
