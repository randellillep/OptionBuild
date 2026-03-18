import React, { useState } from 'react';
import { ArrowUpRight, ArrowRight, ArrowDownRight, TrendingUp, Minus, TrendingDown, Edit2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Mock data
type View = 'Bullish' | 'Neutral' | 'Bearish';

interface StrategyStat {
  name: string;
  maxProfit: string;
  maxLoss: string;
  winRate: string;
  shape: 'call' | 'put' | 'bull-spread' | 'bear-spread' | 'condor' | 'strangle' | 'butterfly';
  badgeColor: string;
}

const strategies: Record<View, StrategyStat[]> = {
  Bullish: [
    { name: 'Long Call', maxProfit: 'Unlimited', maxLoss: '$285', winRate: '~38%', shape: 'call', badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
    { name: 'Bull Call Spread', maxProfit: '$415', maxLoss: '$285', winRate: '~52%', shape: 'bull-spread', badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
    { name: 'Cash-Secured Put', maxProfit: '$190', maxLoss: '$4,810', winRate: '~72%', shape: 'put', badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  ],
  Neutral: [
    { name: 'Iron Condor', maxProfit: '$220', maxLoss: '$280', winRate: '~68%', shape: 'condor', badgeColor: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
    { name: 'Iron Butterfly', maxProfit: '$310', maxLoss: '$190', winRate: '~55%', shape: 'butterfly', badgeColor: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
    { name: 'Short Strangle', maxProfit: '$280', maxLoss: 'Unlimited', winRate: '~65%', shape: 'strangle', badgeColor: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  ],
  Bearish: [
    { name: 'Long Put', maxProfit: '$14,200', maxLoss: '$285', winRate: '~35%', shape: 'put', badgeColor: 'text-rose-400 bg-rose-400/10 border-rose-400/20' },
    { name: 'Bear Put Spread', maxProfit: '$415', maxLoss: '$285', winRate: '~48%', shape: 'bear-spread', badgeColor: 'text-rose-400 bg-rose-400/10 border-rose-400/20' },
    { name: 'Bear Call Spread', maxProfit: '$185', maxLoss: '$315', winRate: '~58%', shape: 'bear-spread', badgeColor: 'text-rose-400 bg-rose-400/10 border-rose-400/20' },
  ]
};

// SVG shapes generator
const PayoffChart = ({ shape }: { shape: string }) => {
  let path = '';
  switch (shape) {
    case 'call': path = "M 10 70 L 100 70 L 190 10"; break;
    case 'put': path = "M 10 10 L 100 70 L 190 70"; break;
    case 'bull-spread': path = "M 10 70 L 70 70 L 130 20 L 190 20"; break;
    case 'bear-spread': path = "M 10 20 L 70 20 L 130 70 L 190 70"; break;
    case 'condor': path = "M 10 70 L 50 20 L 150 20 L 190 70"; break;
    case 'strangle': path = "M 10 10 L 60 70 L 140 70 L 190 10"; break;
    case 'butterfly': path = "M 10 70 L 100 10 L 190 70"; break;
    default: path = "M 10 70 L 190 70";
  }

  return (
    <div className="w-full h-20 flex items-center justify-center bg-[#0a0f1e]/50 rounded-lg border border-[#1e2d3d] overflow-hidden relative">
      {/* Zero line */}
      <div className="absolute top-[70px] left-0 w-full border-t border-dashed border-[#1e2d3d]" />
      
      <svg width="200" height="80" viewBox="0 0 200 80" className="opacity-90 drop-shadow-[0_0_8px_rgba(26,189,156,0.3)]">
        <path d={path} fill="none" stroke="#1abd9c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d={`${path} L 190 80 L 10 80 Z`} fill="url(#teal-glow)" className="opacity-20" />
        <defs>
          <linearGradient id="teal-glow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1abd9c" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#1abd9c" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

export default function MarketViewRouter() {
  const [activeView, setActiveView] = useState<View>('Bullish');
  const [ticker, setTicker] = useState('AAPL');
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white font-sans overflow-hidden relative flex flex-col items-center">
      
      {/* Background Orbs & Grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#1abd9c] opacity-[0.15] blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-600 opacity-[0.1] blur-[100px] rounded-full mix-blend-screen" />
        <div 
          className="absolute inset-0 opacity-[0.03]" 
          style={{
            backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
            backgroundSize: '52px 52px'
          }}
        />
      </div>

      {/* Permanent top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#1abd9c] to-transparent opacity-50 z-10" />

      {/* Main Content */}
      <div className="w-full max-w-6xl mx-auto px-6 z-10 flex flex-col h-screen py-12">
        
        {/* Top Section - 40% */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[40vh] pt-10">
          <div className="text-[#1abd9c] uppercase tracking-wider text-xs font-semibold mb-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#1abd9c] animate-pulse"></span>
            What's your market view?
          </div>

          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {(['Bullish', 'Neutral', 'Bearish'] as View[]).map((view) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={`
                  relative px-8 py-4 rounded-full text-lg font-medium transition-all duration-300 flex items-center gap-3 border
                  ${activeView === view 
                    ? 'bg-[#1abd9c] text-white border-[#1abd9c] shadow-[0_0_30px_rgba(26,189,156,0.3)]' 
                    : 'bg-[#111827]/80 text-gray-400 border-[#1e2d3d] hover:border-gray-500 hover:text-gray-200'
                  }
                `}
              >
                {view === 'Bullish' && <TrendingUp size={24} className={activeView === view ? 'text-white' : 'text-emerald-400'} />}
                {view === 'Neutral' && <Minus size={24} className={activeView === view ? 'text-white' : 'text-blue-400'} />}
                {view === 'Bearish' && <TrendingDown size={24} className={activeView === view ? 'text-white' : 'text-rose-400'} />}
                {view}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-gray-400 text-sm bg-[#111827]/50 px-4 py-2 rounded-full border border-[#1e2d3d]">
            <span>for</span>
            {isEditing ? (
              <input 
                type="text" 
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onBlur={() => setIsEditing(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
                className="bg-transparent border-b border-[#1abd9c] text-white font-mono w-16 outline-none focus:ring-0 text-center"
                autoFocus
              />
            ) : (
              <span className="font-mono text-white font-bold">{ticker}</span>
            )}
            {!isEditing && (
              <button onClick={() => setIsEditing(true)} className="ml-2 hover:text-[#1abd9c] transition-colors flex items-center gap-1">
                <Edit2 size={12} /> change
              </button>
            )}
          </div>
        </div>

        {/* Bottom Section - Strategy Grid - 60% */}
        <div className="flex-[1.5] w-full mt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full"
            >
              {strategies[activeView].map((strategy, idx) => (
                <div 
                  key={idx} 
                  className="bg-[#111827]/80 backdrop-blur-md border border-[#1e2d3d] rounded-2xl p-6 flex flex-col transition-all duration-300 hover:border-[#1abd9c]/50 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] group"
                >
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="text-xl font-bold font-mono tracking-tight group-hover:text-[#1abd9c] transition-colors">{strategy.name}</h3>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${strategy.badgeColor}`}>
                      {activeView}
                    </span>
                  </div>

                  <div className="mb-8">
                    <PayoffChart shape={strategy.shape} />
                  </div>

                  <div className="space-y-4 mb-8 flex-1">
                    <div className="flex justify-between items-center border-b border-[#1e2d3d]/50 pb-3">
                      <span className="text-gray-400 text-sm">Max Profit</span>
                      <span className="font-mono font-medium text-emerald-400">{strategy.maxProfit}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-[#1e2d3d]/50 pb-3">
                      <span className="text-gray-400 text-sm">Max Loss</span>
                      <span className="font-mono font-medium text-rose-400">{strategy.maxLoss}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Win Rate</span>
                      <span className="font-mono font-medium text-white">{strategy.winRate}</span>
                    </div>
                  </div>

                  <button className="w-full py-3 rounded-lg border border-[#1e2d3d] text-white hover:bg-[#1abd9c] hover:border-[#1abd9c] hover:text-white transition-all duration-300 flex items-center justify-center gap-2 group/btn font-medium">
                    Analyze
                    <ChevronRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>

          <div className="mt-12 text-center">
            <button className="text-gray-500 hover:text-[#1abd9c] text-sm transition-colors inline-flex items-center gap-2 group border-b border-transparent hover:border-[#1abd9c] pb-0.5">
              Build any strategy in seconds 
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
