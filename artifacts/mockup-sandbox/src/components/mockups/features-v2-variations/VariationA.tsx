import React, { useState } from "react";

// VARIATION A: TABBED SPOTLIGHT
// Concept: One feature at a time gets full attention.
// IA: Tabs as navigation — selected feature owns the entire content area.
// Interaction model: Click-to-reveal. User drives pacing.
// Hypothesis: Users scan tabs to find what they care about, then go deep on that one thing.

const TEAL = "#1abd9c";

const features = [
  {
    tab: "Heatmap",
    icon: "▦",
    color: "#1abd9c",
    title: "P/L Heatmap",
    tag: "Price × Time",
    headline: "See every outcome at a glance.",
    desc: "A 50×20 color-coded matrix maps profit and loss across price levels and time intervals simultaneously. At expiration, you see the full picture — not just a single chart line.",
    proof: ["50 price levels", "20 time intervals", "Live color rescaling"],
    visual: (
      <svg viewBox="0 0 200 80" className="w-full h-full" preserveAspectRatio="none">
        {Array.from({ length: 80 }, (_, i) => {
          const x = (i % 10) * 20, y = Math.floor(i / 10) * 10;
          const t = (Math.sin(i * 0.5 + 1) + 1) / 2;
          const r = t > 0.5 ? Math.round(26 + (t - 0.5) * 2 * 100) : 26;
          const g = t > 0.5 ? Math.round(189 - (t - 0.5) * 2 * 60) : Math.round(189 * t * 2);
          const b = t < 0.5 ? Math.round(156 * (1 - t * 2)) : 0;
          return <rect key={i} x={x + 1} y={y + 1} width={18} height={8} rx={1.5} fill={`rgb(${r},${g},${b})`} opacity={0.88} />;
        })}
      </svg>
    ),
  },
  {
    tab: "Greeks",
    icon: "∂",
    color: "#60a5fa",
    title: "Options Greeks",
    tag: "Risk Sensitivity",
    headline: "Understand exactly how risk moves.",
    desc: "Delta, gamma, theta, vega, and rho are calculated in real time across your full multi-leg position using the Black-Scholes model. As the market moves, so does your Greek panel.",
    proof: ["5 Greeks tracked", "Multi-leg aggregation", "Black-Scholes engine"],
    visual: (
      <div className="grid grid-cols-5 gap-2 h-full">
        {[["Δ", "0.45", "#1abd9c"], ["Γ", "0.08", "#60a5fa"], ["Θ", "-2.31", "#f87171"], ["V", "0.03", "#a78bfa"], ["ρ", "0.02", "#fbbf24"]].map(([n, v, c]) => (
          <div key={String(n)} className="flex flex-col items-center justify-center rounded-xl" style={{ background: `${c}15`, border: `1px solid ${c}35` }}>
            <span className="text-[11px] font-mono mb-1" style={{ color: "#6b7280" }}>{n}</span>
            <span className="text-base font-mono font-bold" style={{ color: c as string }}>{v}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    tab: "Templates",
    icon: "◈",
    color: "#a78bfa",
    title: "Strategy Templates",
    tag: "Instant Setup",
    headline: "32 strategies. One click to load.",
    desc: "Pre-built spreads, iron condors, butterflies, straddles, and more. Every template is fully editable — adjust strikes, expirations, and quantity after loading.",
    proof: ["32 strategies", "Bullish, bearish, neutral", "All 4 expirations"],
    visual: (
      <svg viewBox="0 0 300 90" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="tp-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1abd9c" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#1abd9c" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="45" x2="300" y2="45" stroke="#374151" strokeWidth="1" strokeDasharray="3 3" />
        <path d="M 0 72 L 75 72 L 120 18 L 180 18 L 225 72 L 300 72 L 300 92 L 0 92 Z" fill="url(#tp-g)" />
        <path d="M 0 72 L 75 72 L 120 18 L 180 18 L 225 72 L 300 72" fill="none" stroke="#1abd9c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="120" y1="18" x2="120" y2="92" stroke="#1abd9c" strokeDasharray="2 3" strokeWidth="1" opacity="0.4" />
        <line x1="225" y1="18" x2="225" y2="92" stroke="#1abd9c" strokeDasharray="2 3" strokeWidth="1" opacity="0.4" />
        <text x="148" y="12" fontSize="8" fill="#1abd9c" textAnchor="middle" fontFamily="monospace">MAX PROFIT</text>
      </svg>
    ),
  },
  {
    tab: "Backtest",
    icon: "↗",
    color: "#fbbf24",
    title: "Backtesting",
    tag: "Historical Sim",
    headline: "Know before you trade.",
    desc: "Run any strategy against years of historical data. The engine selects realistic expiration dates, applies volatility estimates, and tracks every open/close. Win rate, drawdown, and ROI in seconds.",
    proof: ["5+ years of data", "Daily entry simulation", "Realistic BPR tracking"],
    visual: (
      <svg viewBox="0 0 300 80" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="bt-g2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1abd9c" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#1abd9c" stopOpacity="0" />
          </linearGradient>
        </defs>
        {(() => {
          const ys = [78, 70, 65, 58, 60, 52, 45, 50, 42, 35, 38, 30, 25, 20, 22, 18];
          const pts = ys.map((y, i) => ({ x: (i / 15) * 300, y }));
          const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
          const fill = path + ` L 300 80 L 0 80 Z`;
          return <>
            <path d={fill} fill="url(#bt-g2)" />
            <path d={path} fill="none" stroke="#1abd9c" strokeWidth="2" strokeLinejoin="round" />
            <rect x="120" y="35" width="4" height="45" fill="#f87171" opacity="0.5" rx="1" />
            <rect x="200" y="25" width="4" height="55" fill="#f87171" opacity="0.3" rx="1" />
          </>;
        })()}
      </svg>
    ),
  },
  {
    tab: "P/L Chart",
    icon: "⌇",
    color: "#34d399",
    title: "P/L Chart",
    tag: "Payoff Diagram",
    headline: "Every outcome. Instantly.",
    desc: "An interactive payoff diagram that updates the moment you change a strike or expiration. Breakeven points, max profit, and max loss are always annotated. Drag to simulate market moves.",
    proof: ["Real-time updates", "Drag-to-simulate", "Max/min annotated"],
    visual: (
      <svg viewBox="0 0 300 80" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="pl-g2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1abd9c" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#1abd9c" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="pl-loss2" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#f87171" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#f87171" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="40" x2="300" y2="40" stroke="#374151" strokeWidth="1" strokeDasharray="3 3" />
        <path d="M 0 65 L 0 80 L 300 80 L 300 65 Z" fill="url(#pl-loss2)" />
        <path d="M 0 65 L 180 15 L 300 65 L 300 80 L 0 80 Z" fill="url(#pl-g2)" />
        <path d="M 0 65 L 180 15 L 300 65" fill="none" stroke="#1abd9c" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="180" cy="15" r="3" fill="#1abd9c" />
        <text x="180" y="10" fontSize="7" fill="#1abd9c" textAnchor="middle" fontFamily="monospace">+$1,200</text>
      </svg>
    ),
  },
  {
    tab: "Finder",
    icon: "⌕",
    color: "#f472b6",
    title: "Option Finder",
    tag: "Chain Filter",
    headline: "Find the right contract fast.",
    desc: "Filter the full options chain by delta range, IV rank, days to expiry, bid-ask spread, and open interest. Surface the exact contract you need in under a second.",
    proof: ["500+ contracts", "5 filter dimensions", "Real-time chain"],
    visual: (
      <div className="flex flex-col gap-1.5 h-full justify-center">
        <div className="grid grid-cols-5 text-[9px] font-mono px-2 pb-1 border-b" style={{ color: "#4b5563", borderColor: "#1e2d3d" }}>
          <span>Strike</span><span>Exp</span><span>Bid/Ask</span><span>IV</span><span>Δ</span>
        </div>
        {[["260C", "Mar 21", "3.40 / 3.60", "28%", "0.45"], ["255C", "Mar 21", "5.20 / 5.40", "30%", "0.58"], ["270C", "Apr 4", "1.80 / 2.00", "26%", "0.33"]].map(r => (
          <div key={r[0]} className="grid grid-cols-5 text-[10px] font-mono px-2 py-1 rounded" style={{ background: "#0d1320", color: "#9ca3af" }}>
            <span style={{ color: TEAL }}>{r[0]}</span><span>{r[1]}</span><span>{r[2]}</span><span>{r[3]}</span><span>{r[4]}</span>
          </div>
        ))}
      </div>
    ),
  },
];

export default function VariationA() {
  const [active, setActive] = useState(0);
  const f = features[active];

  return (
    <div className="h-screen font-sans flex flex-col px-8 py-8 relative overflow-hidden" style={{ background: "#070c18", color: "#f9fafb" }}>
      <div className="fixed top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${TEAL} 30%, ${TEAL} 70%, transparent)` }} />

      {/* Header */}
      <div className="flex items-end justify-between mb-6 flex-shrink-0">
        <div>
          <p className="text-[10px] font-mono tracking-[0.2em] mb-1.5" style={{ color: TEAL }}>THE FULL TOOLKIT</p>
          <h2 className="text-xl font-bold tracking-tight">Select a tool to explore</h2>
        </div>
        <p className="text-xs pb-0.5" style={{ color: "#4b5563" }}>6 capabilities</p>
      </div>

      {/* Tab strip */}
      <div className="flex gap-1.5 mb-5 flex-shrink-0 flex-wrap">
        {features.map((ft, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className="px-3 py-1.5 rounded-full text-xs font-mono font-semibold transition-all"
            style={{
              background: active === i ? ft.color : "#111827",
              color: active === i ? "#070c18" : "#6b7280",
              border: `1px solid ${active === i ? ft.color : "#1e2d3d"}`,
            }}
          >
            {ft.tab}
          </button>
        ))}
      </div>

      {/* Spotlight content */}
      <div className="flex-1 grid grid-cols-2 gap-5 min-h-0">
        {/* Left: detail */}
        <div className="flex flex-col justify-between py-1">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl" style={{ color: f.color }}>{f.icon}</span>
              <span className="text-[10px] font-mono tracking-[0.15em] px-2 py-0.5 rounded" style={{ background: `${f.color}15`, color: f.color, border: `1px solid ${f.color}30` }}>{f.tag.toUpperCase()}</span>
            </div>
            <h3 className="text-2xl font-bold tracking-tight mb-2">{f.headline}</h3>
            <p className="text-sm leading-relaxed mb-5" style={{ color: "#9ca3af" }}>{f.desc}</p>
          </div>
          <div className="space-y-2">
            {f.proof.map(p => (
              <div key={p} className="flex items-center gap-2 text-xs font-mono" style={{ color: "#6b7280" }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: f.color }} />
                {p}
              </div>
            ))}
          </div>
        </div>
        {/* Right: visual */}
        <div className="rounded-xl overflow-hidden" style={{ background: "#0a0f1c", border: `1px solid ${f.color}25` }}>
          {/* terminal bar */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b" style={{ borderColor: "#1a2a3a", background: "#070c18" }}>
            {["#f87171", "#fbbf24", f.color].map(c => <span key={c} className="w-2 h-2 rounded-full" style={{ background: c }} />)}
            <span className="ml-2 text-[9px] font-mono" style={{ color: "#4b5563" }}>{f.title.toLowerCase().replace(/\s+/g, "_")}.tsx</span>
          </div>
          <div className="p-4 h-[calc(100%-36px)]">{f.visual}</div>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 mt-4 flex-shrink-0">
        {features.map((_, i) => (
          <button key={i} onClick={() => setActive(i)} className="w-1.5 h-1.5 rounded-full transition-all" style={{ background: i === active ? TEAL : "#374151" }} />
        ))}
      </div>
    </div>
  );
}
