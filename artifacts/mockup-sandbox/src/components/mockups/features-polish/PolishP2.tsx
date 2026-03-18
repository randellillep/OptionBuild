import React from "react";

// POLISH P2: DOMINANT ORDINALS + THREE-COLUMN ROW LAYOUT
//
// The original is a 2-column cell grid. This variation resolves the alignment
// problem differently: instead of cells, it uses horizontal rows where each
// feature is a single scannable line — ordinal | content | proof.
//
// What this fixes from the original:
// 1. Ordinal conflict — there's now ONE ordinal per feature, large and dominant
//    in its own left column. The ghost number is retired entirely. No conflict.
// 2. Tag redundancy — gone. The three-column layout makes it unnecessary.
// 3. Highlight alignment — the proof pill is always in column 3, so it's
//    perfectly aligned across all six rows with no description-length variance.
// 4. Color uniformity — ordinals are teal throughout (a consistent thread).
//    Each row has a unique colored accent on the left border of the proof column.
// 5. Icons — consistent 6px letter in a box, no Unicode rendering fragility.
// 6. Headline — makes a real claim instead of counting.
//
// The layout:
//   [num]  [title + description]  [proof pill]
//   Each row is separated by a 1px border. Compact, scannable, decisive.

const TEAL = "#1abd9c";

const features = [
  {
    num: "01", letter: "H",
    color: "#1abd9c",
    title: "P/L Heatmap",
    desc: "Color-coded 50×20 grid mapping every P/L outcome across price and time. See the full landscape before you commit.",
    highlight: "50 price levels",
    highlightSub: "20 time intervals",
  },
  {
    num: "02", letter: "G",
    color: "#60a5fa",
    title: "Options Greeks",
    desc: "Delta, gamma, theta, vega, and rho aggregated live across your full multi-leg position. Real-time Black-Scholes engine.",
    highlight: "5 Greeks",
    highlightSub: "Full position · live",
  },
  {
    num: "03", letter: "S",
    color: "#a78bfa",
    title: "Strategy Templates",
    desc: "32 pre-built strategies — spreads, condors, straddles, butterflies. Load in one click, customize after.",
    highlight: "32 templates",
    highlightSub: "All market views",
  },
  {
    num: "04", letter: "B",
    color: "#fbbf24",
    title: "Backtesting",
    desc: "Historical simulation with daily entry, win rate, drawdown, and equity curve. Know your edge before you trade.",
    highlight: "72% win rate",
    highlightSub: "Iron Condors · 30 DTE",
  },
  {
    num: "05", letter: "C",
    color: "#34d399",
    title: "P/L Chart",
    desc: "Interactive payoff diagram — drag any strike to see the chart update instantly. Breakeven, max profit, max loss annotated.",
    highlight: "Real-time",
    highlightSub: "Drag to simulate",
  },
  {
    num: "06", letter: "F",
    color: "#f472b6",
    title: "Option Finder",
    desc: "Filter 500+ contracts by delta, IV rank, expiration, and open interest simultaneously. Your contract in under a second.",
    highlight: "500+ contracts",
    highlightSub: "5 filters at once",
  },
];

export default function PolishP2() {
  return (
    <div className="min-h-screen font-sans py-12 px-10 overflow-auto" style={{ background: "#070c18", color: "#f9fafb" }}>
      <div className="fixed top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${TEAL} 25%, ${TEAL} 75%, transparent)` }} />

      <div className="max-w-4xl mx-auto">

        {/* Header — two-line claim, left-aligned */}
        <div className="mb-10 pb-7 border-b" style={{ borderColor: "#111827" }}>
          <p className="text-[10px] font-mono tracking-[0.25em] mb-3" style={{ color: TEAL }}>THE FULL TOOLKIT</p>
          <h2 className="text-3xl font-bold tracking-tight leading-tight mb-2">
            Know your risk.<br />Before the trade opens.
          </h2>
          <p className="text-sm" style={{ color: "#4b5563" }}>
            Six tools. Built for real analysis, not toy diagrams.
          </p>
        </div>

        {/* Column headers */}
        <div
          className="grid mb-0"
          style={{ gridTemplateColumns: "48px 1fr 180px" }}
        >
          <div />
          <div className="pb-2 px-4">
            <span className="text-[9px] font-mono tracking-widest" style={{ color: "#1e2d3d" }}>TOOL · DESCRIPTION</span>
          </div>
          <div className="pb-2 px-4 text-right">
            <span className="text-[9px] font-mono tracking-widest" style={{ color: "#1e2d3d" }}>PROOF</span>
          </div>
        </div>

        {/* Feature rows */}
        <div>
          {features.map((f, i) => (
            <div
              key={f.num}
              className="grid items-start group transition-colors"
              style={{
                gridTemplateColumns: "48px 1fr 180px",
                borderTop: "1px solid #0f1626",
                paddingTop: 18,
                paddingBottom: 18,
              }}
            >
              {/* Column 1: Ordinal */}
              <div className="flex items-start pt-0.5">
                <span
                  className="font-mono font-black text-2xl leading-none"
                  style={{ color: TEAL, opacity: 0.7 }}
                >
                  {f.num}
                </span>
              </div>

              {/* Column 2: Icon box + title + description */}
              <div className="px-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-black flex-shrink-0"
                    style={{ background: `${f.color}18`, color: f.color, border: `1px solid ${f.color}30` }}
                  >
                    {f.letter}
                  </div>
                  <h3 className="text-sm font-bold tracking-tight">{f.title}</h3>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: "#6b7280" }}>
                  {f.desc}
                </p>
              </div>

              {/* Column 3: Proof — colored left border accent per feature */}
              <div
                className="px-4 self-start"
                style={{ borderLeft: `2px solid ${f.color}30` }}
              >
                <div className="font-mono font-black text-sm" style={{ color: f.color }}>
                  {f.highlight}
                </div>
                <div className="text-[10px] font-mono mt-0.5" style={{ color: "#374151" }}>
                  {f.highlightSub}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="pt-6 mt-0 border-t flex items-center justify-between"
          style={{ borderColor: "#111827" }}
        >
          <p className="text-xs" style={{ color: "#374151" }}>
            Analysis tools only. Options trading involves risk.
          </p>
          <button
            className="text-xs font-semibold px-4 py-2 rounded-md"
            style={{ background: TEAL, color: "#070c18" }}
          >
            Launch Builder →
          </button>
        </div>
      </div>
    </div>
  );
}
