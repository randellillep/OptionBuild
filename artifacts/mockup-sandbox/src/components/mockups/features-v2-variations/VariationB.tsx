import React from "react";

// VARIATION B: PROBLEM → SOLUTION PAIRS
// Concept: Features are justified by the pain they remove.
// IA: Each feature = a named problem + its resolution. No feature cards — instead, complaint rows.
// Interaction model: Static. The structure itself does the persuasion.
// Hypothesis: Users identify with the problem, not the capability. "I hate not knowing my Greeks" > "Here's a Greeks panel."

const TEAL = "#1abd9c";

const pairs = [
  {
    icon: "▦",
    problem: "You adjust a strike and have no idea how the whole P/L landscape changes.",
    feature: "P/L Heatmap",
    solution: "A 50×20 color grid maps every profit and loss outcome, across every price level and every time interval, the moment you make a change.",
    gain: "+Full visibility",
    color: "#1abd9c",
  },
  {
    icon: "∂",
    problem: "Your multi-leg position has five different risk exposures. You're tracking them in your head.",
    feature: "Options Greeks",
    solution: "Delta, gamma, theta, vega, and rho are calculated and aggregated across your entire position in real time — no spreadsheet needed.",
    gain: "+5 Greeks. Live.",
    color: "#60a5fa",
  },
  {
    icon: "◈",
    problem: "You build the same Iron Condor from scratch every time you open the app.",
    feature: "Strategy Templates",
    solution: "Load any of 32 pre-built strategies in one click. Every template is fully editable after loading — change strikes, expirations, and quantity.",
    gain: "+32 instant setups",
    color: "#a78bfa",
  },
  {
    icon: "↗",
    problem: "You don't know if your strategy has a positive edge until you've already traded it.",
    feature: "Backtesting",
    solution: "Run any strategy against years of historical data and see win rate, drawdown, and net P/L before you risk a dollar.",
    gain: "+Historical confidence",
    color: "#fbbf24",
  },
  {
    icon: "⌇",
    problem: "The standard payoff diagram updates only after you submit the full form.",
    feature: "P/L Chart",
    solution: "Our payoff diagram updates in real time as you drag strikes and adjust expirations. Breakevens and max profit always annotated.",
    gain: "+Instant feedback",
    color: "#34d399",
  },
  {
    icon: "⌕",
    problem: "You want the 30-delta put expiring in 3 weeks. Finding it in the chain takes forever.",
    feature: "Option Finder",
    solution: "Filter 500+ contracts by delta range, IV rank, days to expiry, and open interest simultaneously. Your contract in under a second.",
    gain: "+Search in 1 second",
    color: "#f472b6",
  },
];

export default function VariationB() {
  return (
    <div className="min-h-screen font-sans py-10 px-8 overflow-auto" style={{ background: "#070c18", color: "#f9fafb" }}>
      <div className="fixed top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${TEAL} 30%, ${TEAL} 70%, transparent)` }} />

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-[10px] font-mono tracking-[0.2em] mb-2" style={{ color: TEAL }}>THE FULL TOOLKIT</p>
          <h2 className="text-2xl font-bold tracking-tight mb-1">Every tool solves a real problem.</h2>
          <p className="text-xs" style={{ color: "#4b5563" }}>Here's exactly which ones.</p>
        </div>

        {/* Problem/Solution pairs */}
        <div className="space-y-0">
          {pairs.map((p, i) => (
            <div key={i} className="group" style={{ borderTop: i > 0 ? "1px solid #111827" : "none" }}>
              <div className="grid grid-cols-[1fr_1px_1fr] gap-0 py-5">
                {/* Problem */}
                <div className="pr-6">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[9px] font-mono tracking-[0.15em] px-1.5 py-0.5 rounded" style={{ background: "#1a1a2e", color: "#6b7280", border: "1px solid #1e2d3d" }}>WITHOUT</span>
                  </div>
                  <p className="text-sm leading-relaxed italic" style={{ color: "#9ca3af" }}>
                    "{p.problem}"
                  </p>
                </div>

                {/* Divider */}
                <div className="flex items-center justify-center relative">
                  <div className="w-px h-full" style={{ background: "#1e2d3d" }} />
                  <div
                    className="absolute w-7 h-7 rounded-full flex items-center justify-center text-sm z-10"
                    style={{ background: "#0a0f1c", border: `1px solid ${p.color}40`, color: p.color }}
                  >
                    {p.icon}
                  </div>
                </div>

                {/* Solution */}
                <div className="pl-6">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[9px] font-mono tracking-[0.15em] px-1.5 py-0.5 rounded" style={{ background: `${p.color}12`, color: p.color, border: `1px solid ${p.color}30` }}>
                      {p.feature.toUpperCase()}
                    </span>
                    <span className="text-[9px] font-mono font-bold" style={{ color: p.color }}>{p.gain}</span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "#d1d5db" }}>{p.solution}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-6 flex items-center justify-between border-t" style={{ borderColor: "#111827" }}>
          <p className="text-[11px]" style={{ color: "#374151" }}>Free to try. No account required.</p>
          <button className="px-4 py-2 rounded-md text-xs font-semibold" style={{ background: TEAL, color: "#070c18" }}>
            Launch Builder →
          </button>
        </div>
      </div>
    </div>
  );
}
