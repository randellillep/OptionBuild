import React, { useState } from "react";

// OUTCOME AXIS — VARIATION X2: "TRADE DECISIONS, MADE VISIBLE"
//
// Every options trade requires four sequential decisions:
//   Should I enter? → How should I structure it? → What's my risk? → When do I exit?
//
// This design abandons the feature inventory entirely. Instead, it organizes
// the product around the decision process. Features appear as answers to
// specific trade questions — not as a list of things the app has.
//
// Hypothesis: users don't want features. They want help making better decisions.
// If you frame the product as a decision support system, you're speaking the
// language traders already think in.
//
// Interaction: click a decision stage to expand the tools that serve it.

const TEAL = "#1abd9c";

const decisions = [
  {
    stage: "01",
    question: "Should I enter this trade?",
    subtext: "Validating the setup before you commit capital",
    color: "#fbbf24",
    tools: [
      {
        name: "Backtesting",
        icon: "↗",
        answer: "Run your exact strategy against historical data. If it lost money 70% of the time on this setup, you'll know before you trade it.",
        stat: "72% avg win rate — Iron Condors, 30 DTE",
      },
      {
        name: "Option Finder",
        icon: "⌕",
        answer: "Filter live IV rank to find high-premium environments where selling options has historically paid off.",
        stat: "Filter by IV rank, delta, OI simultaneously",
      },
    ],
  },
  {
    stage: "02",
    question: "How should I structure it?",
    subtext: "Choosing the right strategy for your market view",
    color: "#a78bfa",
    tools: [
      {
        name: "Strategy Templates",
        icon: "◈",
        answer: "32 pre-built strategies organized by market view. Load the structure that fits your thesis, then customize strikes.",
        stat: "32 strategies · bullish, bearish, neutral, volatile",
      },
    ],
  },
  {
    stage: "03",
    question: "What is my actual risk?",
    subtext: "Quantifying every scenario before committing",
    color: "#1abd9c",
    tools: [
      {
        name: "P/L Heatmap",
        icon: "▦",
        answer: "A 50×20 color grid shows your P/L at every possible stock price, across every time interval to expiration. No surprises.",
        stat: "50 price levels × 20 time intervals",
      },
      {
        name: "P/L Chart",
        icon: "⌇",
        answer: "Interactive payoff diagram with breakeven points and max loss annotated. Drag strikes in real time to see the risk change.",
        stat: "Breakeven, max profit, max loss — annotated live",
      },
      {
        name: "Options Greeks",
        icon: "∂",
        answer: "Delta, gamma, theta, vega, and rho aggregated across your position. Know exactly how a market move affects you.",
        stat: "Full Greek exposure · multi-leg aggregated",
      },
    ],
  },
  {
    stage: "04",
    question: "When should I exit?",
    subtext: "Knowing exactly where you stand on any given day",
    color: "#60a5fa",
    tools: [
      {
        name: "P/L Heatmap",
        icon: "▦",
        answer: "The heatmap's time axis shows your P/L at today's price, 5 days from now, 10 days — so you know your exit window precisely.",
        stat: "Time decay visualized — day by day",
      },
      {
        name: "Options Greeks",
        icon: "∂",
        answer: "Watch theta working for you as DTE ticks down. The Greek panel tells you exactly how much time decay earns per day.",
        stat: "Theta/day shown in real dollars",
      },
    ],
  },
];

export default function OutcomeX2() {
  const [open, setOpen] = useState<number>(2);

  return (
    <div className="min-h-screen font-sans py-10 px-8 overflow-auto" style={{ background: "#070c18", color: "#f9fafb" }}>
      <div className="fixed top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${TEAL} 30%, ${TEAL} 70%, transparent)` }} />

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8 pb-5 border-b" style={{ borderColor: "#111827" }}>
          <p className="text-[10px] font-mono tracking-[0.25em] mb-3" style={{ color: TEAL }}>FOUR TRADE DECISIONS</p>
          <h2 className="text-2xl font-bold tracking-tight mb-1.5">
            A tool for every decision you need to make.
          </h2>
          <p className="text-sm" style={{ color: "#4b5563" }}>
            Organized around how traders actually think — not around feature lists.
          </p>
        </div>

        {/* Decision accordion */}
        <div className="space-y-2">
          {decisions.map((d, i) => {
            const isOpen = open === i;
            return (
              <div
                key={i}
                className="rounded-xl overflow-hidden"
                style={{ border: `1px solid ${isOpen ? d.color + "30" : "#111827"}`, background: isOpen ? "#0b1220" : "#080d18" }}
              >
                {/* Header */}
                <button
                  className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                >
                  <span
                    className="font-mono text-xs font-black flex-shrink-0 w-6 text-center"
                    style={{ color: isOpen ? d.color : "#374151" }}
                  >
                    {d.stage}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: isOpen ? "#f9fafb" : "#9ca3af" }}>
                      {d.question}
                    </p>
                    {isOpen && (
                      <p className="text-[10px] mt-0.5" style={{ color: "#4b5563" }}>{d.subtext}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[9px] font-mono" style={{ color: "#374151" }}>
                      {d.tools.length} {d.tools.length === 1 ? "tool" : "tools"}
                    </span>
                    <span
                      className="text-xs font-mono transition-transform inline-block"
                      style={{ color: d.color, transform: isOpen ? "rotate(90deg)" : "none" }}
                    >→</span>
                  </div>
                </button>

                {/* Expanded tools */}
                {isOpen && (
                  <div className="px-5 pb-5 space-y-3" style={{ borderTop: `1px solid ${d.color}15` }}>
                    <div className="pt-4 space-y-3">
                      {d.tools.map(t => (
                        <div key={t.name} className="grid grid-cols-[28px_1fr] gap-3">
                          {/* icon */}
                          <div
                            className="w-7 h-7 rounded-md flex items-center justify-center text-sm flex-shrink-0 mt-0.5"
                            style={{ background: `${d.color}15`, border: `1px solid ${d.color}30`, color: d.color }}
                          >
                            {t.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold">{t.name}</span>
                            </div>
                            <p className="text-xs leading-relaxed mb-2" style={{ color: "#9ca3af" }}>{t.answer}</p>
                            <span
                              className="text-[9px] font-mono px-2 py-0.5 rounded inline-block"
                              style={{ background: `${d.color}10`, color: d.color, border: `1px solid ${d.color}20` }}
                            >
                              {t.stat}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-8 mt-6 border-t flex items-center justify-between" style={{ borderColor: "#111827" }}>
          <p className="text-xs" style={{ color: "#374151" }}>Every tool is available free. No account required.</p>
          <button className="px-4 py-2 rounded text-xs font-semibold" style={{ background: TEAL, color: "#070c18" }}>
            Start analyzing →
          </button>
        </div>
      </div>
    </div>
  );
}
