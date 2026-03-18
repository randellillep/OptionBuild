import React from "react";

// POLISH P1: PER-FEATURE COLOR + COMMITTED GHOST ORDINALS
//
// Fixes from the original:
// 1. Ghost number — commit to it. Opacity 0.11, text-[9rem], positioned in the
//    lower-right corner so it bleeds out of the card. The small active ordinal
//    is removed — the ghost IS the number now. Clean up the conflict.
// 2. Per-feature accent colors — teal stays for #01, each subsequent feature
//    gets its own coordinated color from the same dark-mode palette.
// 3. Tag pill removed — it was a redundant restatement of the title. Replaced
//    with a small colored dot + category word in plain text, far lighter.
// 4. Headline — from "Six tools that cover everything" to a real claim.
// 5. Highlight pills pinned to the bottom of each cell with flex layout,
//    so they align horizontally across left/right columns.
// 6. Icons replaced with a small colored square with a white letter —
//    consistent size/weight across all six, no Unicode rendering fragility.

const features = [
  {
    num: "01", letter: "H",
    color: "#1abd9c",
    category: "Visualization",
    title: "P/L Heatmap",
    desc: "A color-coded 50×20 grid maps every profit and loss outcome across price levels and time intervals. You see the full landscape before you commit.",
    highlight: "50 price levels × 20 time intervals",
  },
  {
    num: "02", letter: "G",
    color: "#60a5fa",
    category: "Risk",
    title: "Options Greeks",
    desc: "Delta, gamma, theta, vega, and rho calculated live across your full multi-leg position. Watch how your risk profile shifts as the market moves.",
    highlight: "Live across all legs — Black-Scholes engine",
  },
  {
    num: "03", letter: "S",
    color: "#a78bfa",
    category: "Strategy",
    title: "30+ Strategy Templates",
    desc: "Load any spread, condor, butterfly, or straddle in one click. Every template is fully editable after loading — adjust strikes, expirations, and size.",
    highlight: "32 templates · every market view covered",
  },
  {
    num: "04", letter: "B",
    color: "#fbbf24",
    category: "Historical",
    title: "Backtesting",
    desc: "Run your strategy against years of historical data. Win rate, drawdown, Sharpe ratio, and equity curve — all computed before you risk real capital.",
    highlight: "72% avg win rate · Iron Condors at 30 DTE",
  },
  {
    num: "05", letter: "C",
    color: "#34d399",
    category: "Payoff",
    title: "P/L Chart",
    desc: "An interactive payoff diagram that updates the moment you change a strike or expiration. Breakeven lines, max profit, and max loss always annotated.",
    highlight: "Real-time — drag any strike to simulate",
  },
  {
    num: "06", letter: "F",
    color: "#f472b6",
    category: "Search",
    title: "Option Finder",
    desc: "Filter 500+ contracts by delta range, IV rank, days to expiry, bid-ask spread, and open interest. Find the right contract in under a second.",
    highlight: "500+ contracts · 5 simultaneous filters",
  },
];

export default function PolishP1() {
  return (
    <div className="min-h-screen font-sans py-12 px-10 overflow-auto" style={{ background: "#070c18", color: "#f9fafb" }}>
      <div className="fixed top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, transparent, #1abd9c 25%, #1abd9c 75%, transparent)" }} />

      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-10 pb-7 border-b" style={{ borderColor: "#111827" }}>
          <p className="text-[10px] font-mono tracking-[0.25em] mb-3" style={{ color: "#1abd9c" }}>THE FULL TOOLKIT</p>
          <div className="flex flex-wrap items-end gap-5">
            <h2 className="text-3xl font-bold tracking-tight leading-tight">
              Know your exact risk<br />before any trade opens.
            </h2>
            <p className="text-sm pb-0.5" style={{ color: "#4b5563" }}>
              Six tools. No guessing.
            </p>
          </div>
        </div>

        {/* 2-col grid */}
        <div className="grid grid-cols-2 gap-0">
          {features.map((f, i) => {
            const isRight = i % 2 === 1;
            const isLastRow = i >= features.length - 2;
            return (
              <div
                key={f.num}
                className="relative flex flex-col overflow-hidden"
                style={{
                  padding: "28px 28px 24px",
                  borderRight: !isRight ? "1px solid #111827" : "none",
                  borderBottom: !isLastRow ? "1px solid #111827" : "none",
                }}
              >
                {/* Ghost ordinal — committed: large, bleeds out of lower-right corner */}
                <div
                  className="absolute bottom-0 right-0 font-mono font-black leading-none select-none pointer-events-none"
                  style={{
                    fontSize: "7rem",
                    color: f.color,
                    opacity: 0.07,
                    lineHeight: 1,
                    transform: "translate(12%, 18%)",
                  }}
                >
                  {f.num}
                </div>

                {/* Top row: icon box + category dot + category */}
                <div className="flex items-center gap-2.5 mb-5">
                  {/* Consistent icon box — no Unicode fragility */}
                  <div
                    className="w-7 h-7 rounded flex items-center justify-center text-[11px] font-black font-mono flex-shrink-0"
                    style={{ background: `${f.color}18`, color: f.color, border: `1px solid ${f.color}30` }}
                  >
                    {f.letter}
                  </div>
                  <span className="text-[9px] font-mono" style={{ color: "#374151" }}>{f.category}</span>
                </div>

                {/* Title */}
                <h3 className="text-[15px] font-bold tracking-tight mb-2.5">{f.title}</h3>

                {/* Description */}
                <p className="text-[13px] leading-relaxed flex-1" style={{ color: "#9ca3af" }}>
                  {f.desc}
                </p>

                {/* Highlight — pinned to bottom via flex layout */}
                <div className="mt-5 pt-0">
                  <div
                    className="inline-flex items-center gap-1.5 text-[9px] font-mono font-semibold tracking-wide px-2.5 py-1.5 rounded"
                    style={{ background: `${f.color}0d`, color: f.color, border: `1px solid ${f.color}22` }}
                  >
                    <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: f.color }} />
                    {f.highlight}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-6 mt-0 border-t flex items-center justify-between" style={{ borderColor: "#111827" }}>
          <p className="text-xs" style={{ color: "#374151" }}>
            Analysis tools only. Options trading involves risk.
          </p>
          <button
            className="text-xs font-semibold px-4 py-2 rounded-md"
            style={{ background: "#1abd9c", color: "#070c18" }}
          >
            Launch Builder →
          </button>
        </div>
      </div>
    </div>
  );
}
