import React from "react";

// V2: EDITORIAL / NUMBERED
// Clean numbered layout — big teal ordinals, icon, title, description.
// No screenshots. Typography-first, Bloomberg Terminal x Vercel aesthetic.
// 2-column grid with full-bleed accent numbers.

const features = [
  {
    num: "01",
    icon: "▦",
    title: "P/L Heatmap",
    tag: "Price × Time Analysis",
    desc: "A color-coded matrix that maps every possible profit and loss outcome across 50 price levels and 20 time intervals. Know exactly where you win before the trade.",
    highlight: "See profit at every strike price — instantly.",
  },
  {
    num: "02",
    icon: "∂",
    icon_label: "delta",
    title: "Options Greeks",
    tag: "Risk Sensitivity",
    desc: "Delta, gamma, theta, vega, and rho calculated live across your entire multi-leg position. Watch how your strategy responds as the market moves.",
    highlight: "Full Greek breakdown. Real market data.",
  },
  {
    num: "03",
    icon: "◈",
    title: "30+ Strategy Templates",
    tag: "Strategy Library",
    desc: "Pre-built spreads, straddles, iron condors, butterflies, and more. Load any template in one click, then customize strikes, expirations, and quantity.",
    highlight: "32 templates covering every market view.",
  },
  {
    num: "04",
    icon: "↗",
    title: "Backtesting",
    tag: "Historical Simulation",
    desc: "Run any strategy against years of historical data. See win rate, max drawdown, Sharpe ratio, and net P/L before you risk real capital.",
    highlight: "72% average win rate on short premium.",
  },
  {
    num: "05",
    icon: "⌇",
    title: "P/L Chart",
    tag: "Payoff Visualization",
    desc: "An interactive payoff diagram that updates in real time as you adjust strikes, expirations, and volatility. Breakeven lines, max profit, and max loss annotated.",
    highlight: "Real-time diagram. Drag to simulate.",
  },
  {
    num: "06",
    icon: "⌕",
    title: "Option Finder",
    tag: "Chain Filter",
    desc: "Filter the full options chain by strike, expiration, delta, IV rank, and open interest. Surface the best contract for your strategy in seconds.",
    highlight: "Filter 500+ contracts in under a second.",
  },
];

export default function FeaturesV2Editorial() {
  return (
    <div className="min-h-screen font-sans py-12 px-10" style={{ background: "#070c18", color: "#f9fafb" }}>
      {/* teal top accent */}
      <div className="fixed top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, transparent, #1abd9c 25%, #1abd9c 75%, transparent)" }} />

      <div className="max-w-4xl mx-auto">
        {/* Section header */}
        <div className="mb-10 pb-6 border-b" style={{ borderColor: "#1e2d3d" }}>
          <p className="text-[10px] font-mono tracking-[0.25em] mb-3" style={{ color: "#1abd9c" }}>THE FULL TOOLKIT</p>
          <div className="flex flex-wrap items-end gap-6">
            <h2 className="text-3xl font-bold tracking-tight">Six tools that cover everything</h2>
            <p className="text-sm pb-1" style={{ color: "#6b7280" }}>Professional options analysis. No fluff.</p>
          </div>
        </div>

        {/* 2-col editorial grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {features.map((f, i) => {
            const isRight = i % 2 === 1;
            const isLast = i >= features.length - 2;
            return (
              <div
                key={f.num}
                className="relative py-8 px-6 group"
                style={{
                  borderRight: !isRight ? `1px solid #1e2d3d` : "none",
                  borderBottom: !isLast ? `1px solid #1e2d3d` : "none",
                }}
              >
                {/* Big number */}
                <div
                  className="absolute top-6 right-6 font-mono font-black leading-none select-none text-5xl pointer-events-none"
                  style={{ color: "#1abd9c", opacity: 0.08 }}
                >
                  {f.num}
                </div>

                {/* Ordinal */}
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="font-mono text-sm font-bold" style={{ color: "#1abd9c" }}>{f.num}</span>
                  <span
                    className="text-[9px] font-mono tracking-[0.15em] px-2 py-0.5 rounded"
                    style={{ background: "#1abd9c15", color: "#1abd9c", border: "1px solid #1abd9c30" }}
                  >
                    {f.tag.toUpperCase()}
                  </span>
                </div>

                {/* Icon + Title */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg" style={{ color: "#1abd9c" }}>{f.icon}</span>
                  <h3 className="text-base font-bold">{f.title}</h3>
                </div>

                {/* Description */}
                <p className="text-sm leading-relaxed mb-4" style={{ color: "#9ca3af" }}>{f.desc}</p>

                {/* Highlight */}
                <div
                  className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold tracking-wide px-2.5 py-1.5 rounded"
                  style={{ background: "#111827", color: "#1abd9c", border: "1px solid #1abd9c20" }}
                >
                  <span className="w-1 h-1 rounded-full" style={{ background: "#1abd9c" }} />
                  {f.highlight}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom rule */}
        <div className="mt-0 pt-6 border-t" style={{ borderColor: "#1e2d3d" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: "#4b5563" }}>Options trading involves risk. OptionBuild provides analysis tools only.</p>
            <button className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-md" style={{ background: "#1abd9c", color: "#070c18" }}>
              Launch Builder →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
