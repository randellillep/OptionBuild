import React, { useState } from "react";

// VARIATION D: ANNOTATED PRODUCT PREVIEW
// Concept: Show the actual tool, not a description of it.
// IA: One cohesive "product screenshot" (SVG-approximated), with numbered callout pins.
// Interaction model: Hover a pin → feature detail expands next to it.
// Hypothesis: "Seeing is believing." A credible product mockup with annotations is more persuasive than any card grid.

const TEAL = "#1abd9c";

const callouts = [
  {
    id: 1,
    x: "8%", y: "18%",
    name: "P/L Heatmap",
    icon: "▦",
    color: "#1abd9c",
    desc: "Color-coded P/L grid across 50 price × 20 time intervals.",
  },
  {
    id: 2,
    x: "72%", y: "10%",
    name: "Options Greeks",
    icon: "∂",
    color: "#60a5fa",
    desc: "Live delta, gamma, theta, vega for your full position.",
  },
  {
    id: 3,
    x: "8%", y: "72%",
    name: "Strategy Templates",
    icon: "◈",
    color: "#a78bfa",
    desc: "Load any of 32 pre-built strategies in one click.",
  },
  {
    id: 4,
    x: "38%", y: "82%",
    name: "P/L Chart",
    icon: "⌇",
    color: "#34d399",
    desc: "Real-time payoff diagram. Drag to simulate market moves.",
  },
  {
    id: 5,
    x: "55%", y: "58%",
    name: "Backtesting",
    icon: "↗",
    color: "#fbbf24",
    desc: "Historical simulation with win rate and equity curve.",
  },
  {
    id: 6,
    x: "82%", y: "65%",
    name: "Option Finder",
    icon: "⌕",
    color: "#f472b6",
    desc: "Filter 500+ contracts by delta, IV rank, and expiry.",
  },
];

// SVG representation of the builder UI
function ProductMockSVG({ hovered }: { hovered: number | null }) {
  return (
    <svg viewBox="0 0 900 480" className="w-full h-full" style={{ borderRadius: 12 }}>
      {/* App chrome */}
      <rect width="900" height="480" fill="#070c18" rx="8" />
      {/* Top bar */}
      <rect width="900" height="40" fill="#0a0f1c" />
      <rect x="12" y="14" width="8" height="8" rx="2" fill="#1abd9c" opacity="0.7" />
      <rect x="26" y="16" width="60" height="5" rx="2" fill="#1e2d3d" />
      <rect x="90" y="16" width="40" height="5" rx="2" fill="#1e2d3d" />
      {/* Symbol input */}
      <rect x="380" y="11" width="140" height="18" rx="4" fill="#111827" />
      <text x="395" y="23" fontSize="8" fill="#1abd9c" fontFamily="monospace" fontWeight="bold">AAPL</text>
      <text x="440" y="23" fontSize="8" fill="#4b5563" fontFamily="monospace">$252.49</text>
      {/* Tabs */}
      {["Builder", "Analysis", "Trade", "Saved"].map((t, i) => (
        <g key={t}>
          <rect x={580 + i * 78} y="10" width="70" height="20" rx="4" fill={i === 1 ? "#1e2d3d" : "transparent"} />
          <text x={615 + i * 78} y="23" fontSize="7" fill={i === 1 ? "#f9fafb" : "#4b5563"} textAnchor="middle" fontFamily="sans-serif">{t}</text>
        </g>
      ))}

      {/* Left sidebar: strategy list */}
      <rect x="0" y="40" width="180" height="440" fill="#080d18" />
      <rect x="0" y="40" width="180" height="1" fill="#111827" />
      {["Long Call", "Long Put", "Bull Call Spread", "Bear Put Spread", "Iron Condor", "Long Straddle", "Covered Call"].map((s, i) => (
        <g key={s}>
          <rect x="8" y={52 + i * 28} width="164" height="24" rx="4" fill={i === 4 ? "#1e2d3d" : "transparent"} />
          <text x="20" y={68 + i * 28} fontSize="8" fill={i === 4 ? "#f9fafb" : "#6b7280"} fontFamily="sans-serif">{s}</text>
        </g>
      ))}

      {/* Main area: Heatmap */}
      <rect x="184" y="44" width="440" height="180" rx="4" fill="#0a0f1c" stroke="#111827" strokeWidth="1" />
      {Array.from({ length: 80 }, (_, i) => {
        const col = i % 10, row = Math.floor(i / 10);
        const t = (Math.sin(col * 0.7 + row * 0.4) + 1) / 2;
        const r = t > 0.5 ? Math.round(26 + (t - 0.5) * 2 * 90) : 26;
        const g = t > 0.5 ? Math.round(189 - (t - 0.5) * 2 * 50) : Math.round(170 * t * 2);
        const b = t < 0.5 ? Math.round(130 * (1 - t * 2)) : 0;
        return <rect key={i} x={188 + col * 40} y={54 + row * 16} width={38} height={14} rx={2} fill={`rgb(${r},${g},${b})`} opacity={0.8} />;
      })}
      <text x="196" y="242" fontSize="8" fill="#6b7280" fontFamily="monospace">P/L Heatmap — AAPL Iron Condor</text>

      {/* Right panel: Greeks */}
      <rect x="630" y="44" width="266" height="180" rx="4" fill="#0a0f1c" stroke="#111827" strokeWidth="1" />
      <text x="645" y="62" fontSize="9" fill="#9ca3af" fontFamily="sans-serif" fontWeight="bold">Options Greeks</text>
      {[["Delta", "0.45", "#1abd9c"], ["Gamma", "0.08", "#60a5fa"], ["Theta", "-2.31", "#f87171"], ["Vega", "0.03", "#a78bfa"]].map(([n, v, c], i) => (
        <g key={String(n)}>
          <rect x="638" y={72 + i * 32} width="120" height="26" rx="4" fill="#111827" />
          <text x="648" y={89 + i * 32} fontSize="7" fill="#6b7280" fontFamily="sans-serif">{n}</text>
          <text x="648" y={100 + i * 32} fontSize="11" fill={c as string} fontFamily="monospace" fontWeight="bold">{v}</text>
          {/* sparkline */}
          <polyline points={`775,${84 + i * 32} 782,${80 + i * 32} 790,${88 + i * 32} 798,${76 + i * 32} 806,${82 + i * 32} 814,${77 + i * 32}`}
            fill="none" stroke={c as string} strokeWidth="1.5" opacity="0.8" />
        </g>
      ))}

      {/* Left panel: strategy positions */}
      <rect x="184" y="232" width="170" height="200" rx="4" fill="#0a0f1c" stroke="#111827" strokeWidth="1" />
      <text x="196" y="250" fontSize="8" fill="#9ca3af" fontFamily="sans-serif" fontWeight="bold">Legs</text>
      {[["Sell 235 Put", "-1", "#f87171"], ["Sell 225 Put", "-1", "#f87171"], ["Sell 270 Call", "-1", "#f87171"], ["Sell 280 Call", "-1", "#f87171"]].map(([n, q, c], i) => (
        <g key={String(n)}>
          <rect x="192" y={258 + i * 40} width="154" height="32" rx="3" fill="#111827" />
          <text x="200" y={272 + i * 40} fontSize="7" fill="#9ca3af" fontFamily="sans-serif">{n}</text>
          <text x="200" y={283 + i * 40} fontSize="9" fill={c as string} fontFamily="monospace">{q}</text>
          <text x="315" y={275 + i * 40} fontSize="7" fill="#6b7280" fontFamily="sans-serif" textAnchor="middle">$3.40</text>
        </g>
      ))}

      {/* Center: P/L chart */}
      <rect x="360" y="232" width="264" height="170" rx="4" fill="#0a0f1c" stroke="#111827" strokeWidth="1" />
      <text x="372" y="250" fontSize="8" fill="#9ca3af" fontFamily="sans-serif" fontWeight="bold">P/L Chart — Iron Condor</text>
      <line x1="368" y1="317" x2="616" y2="317" stroke="#1e2d3d" strokeWidth="1" strokeDasharray="3 3" />
      <path d="M 368 345 L 420 345 L 450 270 L 536 270 L 566 345 L 616 345" fill="none" stroke="#1abd9c" strokeWidth="2" strokeLinejoin="round" />
      <defs>
        <linearGradient id="ann-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1abd9c" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#1abd9c" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M 420 345 L 450 270 L 536 270 L 566 345 Z" fill="url(#ann-g)" />
      <text x="490" y="265" fontSize="7" fill="#1abd9c" textAnchor="middle" fontFamily="monospace">+$420</text>

      {/* Right: Backtest & Finder */}
      <rect x="630" y="232" width="266" height="80" rx="4" fill="#0a0f1c" stroke="#111827" strokeWidth="1" />
      <text x="645" y="250" fontSize="8" fill="#9ca3af" fontFamily="sans-serif" fontWeight="bold">Backtest Summary</text>
      {[["Win Rate", "72%", "#1abd9c"], ["Trades", "156", "#9ca3af"], ["Net P/L", "+$4,250", "#1abd9c"]].map(([n, v, c], i) => (
        <g key={String(n)}>
          <text x={648 + i * 86} y="270" fontSize="7" fill="#6b7280" fontFamily="sans-serif">{n}</text>
          <text x={648 + i * 86} y="285" fontSize="11" fill={c as string} fontFamily="monospace" fontWeight="bold">{v}</text>
        </g>
      ))}

      <rect x="630" y="320" width="266" height="112" rx="4" fill="#0a0f1c" stroke="#111827" strokeWidth="1" />
      <text x="645" y="338" fontSize="8" fill="#9ca3af" fontFamily="sans-serif" fontWeight="bold">Option Finder</text>
      <rect x="638" y="344" width="250" height="16" rx="3" fill="#111827" />
      <text x="648" y="355" fontSize="7" fill="#4b5563" fontFamily="sans-serif">Filter by delta, IV rank, expiration...</text>
      {[["AAPL 260C", "28%", "0.45", "$3.40"], ["AAPL 255C", "30%", "0.58", "$5.20"]].map(([s, iv, d, p], i) => (
        <g key={String(s)}>
          <rect x="638" y={364 + i * 28} width="250" height="22" rx="3" fill="#111827" />
          <text x="646" y={378 + i * 28} fontSize="7" fill="#1abd9c" fontFamily="monospace">{s}</text>
          <text x="718" y={378 + i * 28} fontSize="7" fill="#6b7280" fontFamily="monospace">{iv}</text>
          <text x="760" y={378 + i * 28} fontSize="7" fill="#9ca3af" fontFamily="monospace">{d}</text>
          <text x="810" y={378 + i * 28} fontSize="7" fill="#9ca3af" fontFamily="monospace">{p}</text>
        </g>
      ))}

      {/* Bottom status bar */}
      <rect x="0" y="440" width="900" height="40" fill="#080d18" />
      <text x="12" y="463" fontSize="7" fill="#1abd9c" fontFamily="monospace">● Live data</text>
      <text x="80" y="463" fontSize="7" fill="#6b7280" fontFamily="monospace">AAPL $252.49</text>
      <text x="200" y="463" fontSize="7" fill="#6b7280" fontFamily="monospace">Iron Condor · 32 DTE · IV: 30%</text>

      {/* Hover highlight overlays */}
      {hovered === 1 && <rect x="184" y="44" width="440" height="180" rx="4" fill="#1abd9c" opacity="0.06" />}
      {hovered === 2 && <rect x="630" y="44" width="266" height="180" rx="4" fill="#60a5fa" opacity="0.08" />}
      {hovered === 3 && <rect x="184" y="232" width="170" height="200" rx="4" fill="#a78bfa" opacity="0.08" />}
      {hovered === 4 && <rect x="360" y="232" width="264" height="170" rx="4" fill="#34d399" opacity="0.08" />}
      {hovered === 5 && <rect x="630" y="232" width="266" height="80" rx="4" fill="#fbbf24" opacity="0.08" />}
      {hovered === 6 && <rect x="630" y="320" width="266" height="112" rx="4" fill="#f472b6" opacity="0.08" />}
    </svg>
  );
}

export default function VariationD() {
  const [hovered, setHovered] = useState<number | null>(null);
  const active = callouts.find(c => c.id === hovered);

  return (
    <div className="h-screen font-sans flex flex-col px-6 py-6 overflow-hidden" style={{ background: "#070c18", color: "#f9fafb" }}>
      <div className="fixed top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${TEAL} 30%, ${TEAL} 70%, transparent)` }} />

      {/* Header */}
      <div className="flex items-end justify-between mb-4 flex-shrink-0">
        <div>
          <p className="text-[10px] font-mono tracking-[0.2em] mb-1.5" style={{ color: TEAL }}>THE FULL TOOLKIT</p>
          <h2 className="text-lg font-bold tracking-tight">Here's what you're actually getting.</h2>
        </div>
        <p className="text-xs pb-0.5" style={{ color: "#4b5563" }}>Hover the pins to explore</p>
      </div>

      {/* Product mockup + pins layer */}
      <div className="relative flex-1 min-h-0">
        <div className="w-full h-full rounded-xl overflow-hidden" style={{ border: "1px solid #1e2d3d" }}>
          <ProductMockSVG hovered={hovered} />
        </div>

        {/* Callout pins */}
        {callouts.map(c => (
          <div
            key={c.id}
            className="absolute z-20 cursor-pointer"
            style={{ left: c.x, top: c.y, transform: "translate(-50%, -50%)" }}
            onMouseEnter={() => setHovered(c.id)}
            onMouseLeave={() => setHovered(null)}
          >
            {/* Pin */}
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-black shadow-lg transition-transform"
              style={{
                background: c.color,
                color: "#070c18",
                transform: hovered === c.id ? "scale(1.25)" : "scale(1)",
                boxShadow: hovered === c.id ? `0 0 12px ${c.color}80` : "none",
              }}
            >
              {c.id}
            </div>

            {/* Tooltip */}
            {hovered === c.id && (
              <div
                className="absolute z-30 rounded-lg px-3 py-2.5 pointer-events-none whitespace-nowrap"
                style={{
                  background: "#0b1220",
                  border: `1px solid ${c.color}40`,
                  boxShadow: `0 8px 24px rgba(0,0,0,0.5)`,
                  left: "50%",
                  transform: "translateX(-50%)",
                  top: 30,
                  minWidth: 180,
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span style={{ color: c.color }}>{c.icon}</span>
                  <span className="text-xs font-semibold">{c.name}</span>
                </div>
                <p className="text-[10px] leading-snug" style={{ color: "#9ca3af", whiteSpace: "normal", maxWidth: 200 }}>{c.desc}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom legend */}
      <div className="flex items-center gap-4 mt-3 flex-shrink-0 overflow-x-auto">
        {callouts.map(c => (
          <div
            key={c.id}
            className="flex items-center gap-1.5 cursor-pointer flex-shrink-0"
            onMouseEnter={() => setHovered(c.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-mono font-black flex-shrink-0" style={{ background: c.color, color: "#070c18" }}>{c.id}</span>
            <span className="text-[10px] font-medium" style={{ color: hovered === c.id ? c.color : "#6b7280" }}>{c.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
