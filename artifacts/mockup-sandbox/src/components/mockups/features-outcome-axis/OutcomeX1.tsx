import React, { useState } from "react";

// OUTCOME AXIS — VARIATION X1: "WHAT YOU'LL KNOW"
//
// The conventional choice in every feature section is that the unit of
// communication is a FEATURE. This inverts it. The unit here is a CERTAINTY
// — something you'll know after using the product — and the tool is revealed
// only as the mechanism that delivers it.
//
// Reader's mental model shift:
//   BEFORE: "Here are 6 things OptionBuild has."
//   AFTER:  "Here are 6 things I'll no longer be guessing."
//
// Interaction: hover a certainty to reveal which tools enable it.

const TEAL = "#1abd9c";

const certainties = [
  {
    certainty: "You'll know your exact breakeven price before the trade opens.",
    tools: ["P/L Chart", "Options Greeks"],
    evidence: "Interactive payoff diagram with annotated breakeven lines, updated in real time as you adjust strikes.",
    icon: "⌇",
    color: "#1abd9c",
  },
  {
    certainty: "You'll know how much you lose if the stock moves against you — at every price level.",
    tools: ["P/L Heatmap"],
    evidence: "A 50×20 color-coded grid shows the full profit/loss landscape across all price levels and time intervals.",
    icon: "▦",
    color: "#60a5fa",
  },
  {
    certainty: "You'll know exactly how theta is working for or against you, daily.",
    tools: ["Options Greeks"],
    evidence: "Live delta, gamma, theta, vega, and rho aggregated across your full multi-leg position.",
    icon: "∂",
    color: "#a78bfa",
  },
  {
    certainty: "You'll know whether this strategy has a proven edge — before risking real capital.",
    tools: ["Backtesting"],
    evidence: "Historical simulation with daily entry, win rate, drawdown, and equity curve across 5+ years of data.",
    icon: "↗",
    color: "#fbbf24",
  },
  {
    certainty: "You'll know the right contract to buy — not the first one you scroll to.",
    tools: ["Option Finder"],
    evidence: "Filter 500+ contracts by delta range, IV rank, expiration, and open interest simultaneously.",
    icon: "⌕",
    color: "#f472b6",
  },
  {
    certainty: "You'll know which strategy fits your market view — not just which one you remember.",
    tools: ["Strategy Templates"],
    evidence: "32 pre-built strategies organized by market view: bullish, bearish, neutral, volatile.",
    icon: "◈",
    color: "#34d399",
  },
];

export default function OutcomeX1() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="min-h-screen font-sans py-10 px-8 relative overflow-hidden" style={{ background: "#070c18", color: "#f9fafb" }}>
      <div className="fixed top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${TEAL} 30%, ${TEAL} 70%, transparent)` }} />

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-10 pb-6 border-b" style={{ borderColor: "#111827" }}>
          <p className="text-[10px] font-mono tracking-[0.25em] mb-3" style={{ color: TEAL }}>WHAT YOU'LL KNOW</p>
          <h2 className="text-2xl font-bold tracking-tight mb-1.5">
            Six things you won't have to guess anymore.
          </h2>
          <p className="text-sm" style={{ color: "#4b5563" }}>
            Hover any certainty to see what makes it possible.
          </p>
        </div>

        {/* Certainty rows */}
        <div className="space-y-0">
          {certainties.map((c, i) => {
            const isHovered = hovered === i;
            return (
              <div
                key={i}
                className="py-5 cursor-default transition-all"
                style={{ borderBottom: i < certainties.length - 1 ? "1px solid #0f1626" : "none" }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="grid grid-cols-[28px_1fr] gap-4 items-start">
                  {/* Left: icon in color */}
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center text-sm mt-0.5 flex-shrink-0 transition-all"
                    style={{
                      background: isHovered ? `${c.color}20` : "#0d1320",
                      border: `1px solid ${isHovered ? c.color + "50" : "#1e2d3d"}`,
                      color: isHovered ? c.color : "#374151",
                    }}
                  >
                    {c.icon}
                  </div>

                  {/* Right: certainty + expanded evidence */}
                  <div>
                    {/* The certainty */}
                    <p
                      className="text-sm font-medium leading-snug mb-0 transition-colors"
                      style={{ color: isHovered ? "#f9fafb" : "#9ca3af" }}
                    >
                      {c.certainty}
                    </p>

                    {/* Expanded: which tools + how */}
                    <div
                      className="overflow-hidden transition-all"
                      style={{ maxHeight: isHovered ? 80 : 0, opacity: isHovered ? 1 : 0, marginTop: isHovered ? 10 : 0 }}
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {c.tools.map(t => (
                            <span
                              key={t}
                              className="text-[9px] font-mono font-bold px-2 py-0.5 rounded"
                              style={{ background: `${c.color}15`, color: c.color, border: `1px solid ${c.color}30` }}
                            >
                              {t.toUpperCase()}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>{c.evidence}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-8 mt-4 border-t flex items-center justify-between" style={{ borderColor: "#111827" }}>
          <p className="text-xs" style={{ color: "#374151" }}>Free to start. No account required.</p>
          <button className="px-4 py-2 rounded text-xs font-semibold" style={{ background: TEAL, color: "#070c18" }}>
            Build your first position →
          </button>
        </div>
      </div>
    </div>
  );
}
