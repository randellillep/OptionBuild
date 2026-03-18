import React, { useState } from "react";

// VARIATION C: WORKFLOW MAP
// Concept: Features aren't independent tools — they form a trading workflow.
// IA: Linear flow: Find → Build → Analyze → Trade. Features live inside the steps.
// Interaction model: Click a step to expand its features. Shows how the tools connect.
// Hypothesis: Users don't think in feature lists. They think in steps of a process.

const TEAL = "#1abd9c";

const steps = [
  {
    step: "01",
    verb: "Find",
    label: "Discover the right contract",
    color: "#f472b6",
    features: [
      { icon: "⌕", name: "Option Finder", desc: "Filter 500+ contracts by delta, IV rank, and expiration." },
    ],
    connector: "You spot a trade idea",
  },
  {
    step: "02",
    verb: "Build",
    label: "Construct your strategy",
    color: "#a78bfa",
    features: [
      { icon: "◈", name: "Strategy Templates", desc: "Load from 32 pre-built strategies or build from scratch." },
    ],
    connector: "Strategy is structured",
  },
  {
    step: "03",
    verb: "Analyze",
    label: "Understand the full risk",
    color: "#1abd9c",
    features: [
      { icon: "⌇", name: "P/L Chart", desc: "Interactive payoff diagram with breakeven annotations." },
      { icon: "▦", name: "P/L Heatmap", desc: "Color grid across all price levels × time intervals." },
      { icon: "∂", name: "Options Greeks", desc: "Live delta, gamma, theta, vega, and rho." },
    ],
    connector: "Risk is understood",
  },
  {
    step: "04",
    verb: "Validate",
    label: "Confirm it has historical edge",
    color: "#fbbf24",
    features: [
      { icon: "↗", name: "Backtesting", desc: "Historical win rate, drawdown, and equity curve." },
    ],
    connector: "Ready to execute",
  },
];

export default function VariationC() {
  const [active, setActive] = useState(2);

  return (
    <div className="h-screen font-sans flex flex-col px-8 py-8 overflow-hidden" style={{ background: "#070c18", color: "#f9fafb" }}>
      <div className="fixed top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${TEAL} 30%, ${TEAL} 70%, transparent)` }} />

      <div className="mb-6 flex-shrink-0">
        <p className="text-[10px] font-mono tracking-[0.2em] mb-1.5" style={{ color: TEAL }}>THE FULL TOOLKIT</p>
        <h2 className="text-xl font-bold tracking-tight">One workflow. Six tools.</h2>
      </div>

      {/* Step flow */}
      <div className="flex gap-0 flex-1 min-h-0">
        {steps.map((s, i) => {
          const isActive = active === i;
          return (
            <React.Fragment key={i}>
              {/* Step column */}
              <div
                className="flex flex-col cursor-pointer transition-all duration-300 relative"
                style={{ flex: isActive ? "2.5 1 0" : "1 1 0", minWidth: 80 }}
                onClick={() => setActive(i)}
              >
                {/* Step header */}
                <div
                  className="px-4 py-4 border-t-2 transition-colors h-full flex flex-col rounded-lg mr-2"
                  style={{
                    borderTopColor: isActive ? s.color : "#1e2d3d",
                    background: isActive ? "#0b1220" : "#080d18",
                    border: `1px solid ${isActive ? s.color + "30" : "#111827"}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-[10px] font-bold" style={{ color: isActive ? s.color : "#374151" }}>{s.step}</span>
                    {isActive && <span className="text-[9px] font-mono tracking-widest px-1.5 py-0.5 rounded" style={{ background: `${s.color}15`, color: s.color }}>{s.verb.toUpperCase()}</span>}
                  </div>

                  <h3
                    className="font-semibold text-sm mb-0 leading-snug"
                    style={{ color: isActive ? "#f9fafb" : "#4b5563", whiteSpace: isActive ? "normal" : "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {isActive ? s.label : s.verb}
                  </h3>

                  {isActive && (
                    <div className="mt-4 space-y-3 flex-1">
                      {s.features.map(f => (
                        <div key={f.name} className="rounded-lg p-3" style={{ background: "#0a0f1c", border: `1px solid ${s.color}20` }}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-base" style={{ color: s.color }}>{f.icon}</span>
                            <span className="text-xs font-semibold">{f.name}</span>
                          </div>
                          <p className="text-[11px] leading-relaxed" style={{ color: "#9ca3af" }}>{f.desc}</p>
                        </div>
                      ))}

                      {/* connector label */}
                      {i < steps.length - 1 && (
                        <div className="pt-2">
                          <div className="flex items-center gap-2 text-[10px] font-mono" style={{ color: "#374151" }}>
                            <span className="flex-1 h-px" style={{ background: "#1e2d3d" }} />
                            <span style={{ color: s.color }}>{s.connector}</span>
                            <span>→</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Feature count strip */}
      <div className="flex items-center gap-4 mt-4 flex-shrink-0 pt-3 border-t" style={{ borderColor: "#111827" }}>
        <span className="text-[10px] font-mono" style={{ color: "#374151" }}>6 tools across 4 steps</span>
        {steps.map((s, i) => (
          <button key={i} onClick={() => setActive(i)} className="text-[10px] font-mono transition-colors" style={{ color: active === i ? s.color : "#374151" }}>
            {s.verb}
          </button>
        ))}
        <div className="ml-auto">
          <button className="px-3 py-1.5 rounded text-xs font-semibold" style={{ background: TEAL, color: "#070c18" }}>Open Builder →</button>
        </div>
      </div>
    </div>
  );
}
