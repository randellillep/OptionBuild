import React, { useState } from "react";

// V3: CAPABILITY SPOTLIGHT
// Uniform 3×2 grid. Each card = large icon in gradient ring,
// feature name, a bold "proof stat", and description.
// Hover reveals an expanded visual detail (pure CSS/SVG).
// Clean product-marketing feel — think Linear, Vercel, or Stripe.

const TEAL = "#1abd9c";

const features = [
  {
    icon: "▦",
    color: "#1abd9c",
    title: "P/L Heatmap",
    stat: "50 × 20",
    statLabel: "price × time cells",
    desc: "Color-coded profit/loss grid across every price level and time interval. See the full landscape, not just the breakevens.",
    detail: (
      <svg viewBox="0 0 100 50" className="w-full h-full" preserveAspectRatio="none">
        {Array.from({ length: 50 }, (_, i) => {
          const x = (i % 10) * 10, y = Math.floor(i / 10) * 10;
          const t = (Math.sin(i * 0.6) + 1) / 2;
          const r = t > 0.5 ? Math.round(26 + (t - 0.5) * 2 * 80) : 26;
          const g = t > 0.5 ? Math.round(189 - (t - 0.5) * 2 * 50) : Math.round(189 * t * 2);
          const b = t < 0.5 ? Math.round(156 * (1 - t * 2)) : 0;
          return <rect key={i} x={x + 0.5} y={y + 0.5} width={9} height={9} rx={1} fill={`rgb(${r},${g},${b})`} opacity={0.9} />;
        })}
      </svg>
    ),
  },
  {
    icon: "∂",
    color: "#60a5fa",
    title: "Options Greeks",
    stat: "5",
    statLabel: "Greeks tracked live",
    desc: "Delta, gamma, theta, vega, rho — calculated in real time for your full multi-leg position using the Black-Scholes model.",
    detail: (
      <div className="grid grid-cols-5 gap-1 h-full">
        {[["Δ", "0.45", "#1abd9c"], ["Γ", "0.08", "#60a5fa"], ["Θ", "-2.31", "#f87171"], ["V", "0.03", "#a78bfa"], ["ρ", "0.02", "#fbbf24"]].map(([name, val, col]) => (
          <div key={String(name)} className="flex flex-col items-center justify-center rounded" style={{ background: `${col}12`, border: `1px solid ${col}30` }}>
            <span className="text-[10px] font-mono" style={{ color: "#6b7280" }}>{name}</span>
            <span className="text-xs font-mono font-bold" style={{ color: col as string }}>{val}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: "◈",
    color: "#a78bfa",
    title: "Strategy Templates",
    stat: "32",
    statLabel: "pre-built strategies",
    desc: "Load any spread, condor, butterfly, or straddle in one click. Each template is fully customizable — adjust strikes, expirations, and size.",
    detail: (
      <svg viewBox="0 0 200 60" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sp-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1abd9c" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#1abd9c" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="30" x2="200" y2="30" stroke="#374151" strokeWidth="1" strokeDasharray="3 3" />
        <path d="M 0 48 L 50 48 L 80 12 L 120 12 L 150 48 L 200 48 L 200 60 L 0 60 Z" fill="url(#sp-g)" />
        <path d="M 0 48 L 50 48 L 80 12 L 120 12 L 150 48 L 200 48" fill="none" stroke="#1abd9c" strokeWidth="2" />
      </svg>
    ),
  },
  {
    icon: "↗",
    color: "#fbbf24",
    title: "Backtesting",
    stat: "72%",
    statLabel: "avg. win rate on short premium",
    desc: "Simulate your strategy against 5+ years of historical data. Win rate, drawdowns, Sharpe ratio, and equity curve — all before you trade.",
    detail: (
      <svg viewBox="0 0 200 60" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="bt-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1abd9c" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#1abd9c" stopOpacity="0" />
          </linearGradient>
        </defs>
        {(() => {
          const pts = [0, 8, 5, 18, 14, 28, 22, 40, 35, 52, 44, 58].map((y, i) => ({ x: (i / 11) * 200, y: 58 - y }));
          const p = pts.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ");
          const f = p + ` L ${pts[pts.length - 1].x} 60 L 0 60 Z`;
          return <>
            <path d={f} fill="url(#bt-g)" />
            <path d={p} fill="none" stroke="#1abd9c" strokeWidth="2" strokeLinejoin="round" />
            <rect x="160" y="20" width="3" height="40" fill="#f87171" opacity="0.5" rx="1" />
          </>;
        })()}
      </svg>
    ),
  },
  {
    icon: "⌇",
    color: "#34d399",
    title: "P/L Chart",
    stat: "Real-time",
    statLabel: "payoff diagram updates",
    desc: "Interactive payoff diagram — drag strikes and watch the chart update instantly. Breakeven points, max profit, and max loss annotated automatically.",
    detail: (
      <svg viewBox="0 0 200 60" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="pl-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1abd9c" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#1abd9c" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="pl-loss" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f87171" stopOpacity="0" />
            <stop offset="100%" stopColor="#f87171" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <line x1="0" y1="30" x2="200" y2="30" stroke="#374151" strokeWidth="1" strokeDasharray="3 3" />
        <path d="M 0 50 L 0 60 L 200 60 L 200 50 L 120 10 Z" fill="url(#pl-g)" />
        <path d="M 0 50 L 0 60 L 200 60 L 200 50" fill="url(#pl-loss)" />
        <path d="M 0 50 L 120 10 L 200 50" fill="none" stroke="#1abd9c" strokeWidth="2" />
        <line x1="120" y1="10" x2="120" y2="60" stroke="#1abd9c" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
      </svg>
    ),
  },
  {
    icon: "⌕",
    color: "#f472b6",
    title: "Option Finder",
    stat: "< 1s",
    statLabel: "to filter 500+ contracts",
    desc: "Search the full options chain by delta range, IV rank, days to expiry, and open interest. Find exactly the right contract for your strategy.",
    detail: (
      <div className="flex flex-col gap-0.5 h-full">
        {[["260C", "28%", "Δ 0.45"], ["255C", "30%", "Δ 0.58"], ["265C", "26%", "Δ 0.33"]].map(([sym, iv, d]) => (
          <div key={sym} className="flex items-center justify-between px-1.5 py-0.5 rounded" style={{ background: "#111827" }}>
            <span className="text-[9px] font-mono" style={{ color: TEAL }}>{sym}</span>
            <span className="text-[9px] font-mono" style={{ color: "#6b7280" }}>{iv}</span>
            <span className="text-[9px] font-mono" style={{ color: "#9ca3af" }}>{d}</span>
          </div>
        ))}
      </div>
    ),
  },
];

export default function FeaturesV3Spotlight() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="min-h-screen font-sans py-12 px-8 relative overflow-hidden" style={{ background: "#070c18", color: "#f9fafb" }}>
      {/* top accent */}
      <div className="fixed top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${TEAL} 25%, ${TEAL} 75%, transparent)` }} />
      {/* glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full pointer-events-none" style={{ background: `radial-gradient(ellipse at center, ${TEAL}10 0%, transparent 65%)` }} />

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="mb-10">
          <p className="text-[10px] font-mono tracking-[0.25em] mb-2.5" style={{ color: TEAL }}>THE FULL TOOLKIT</p>
          <h2 className="text-2xl font-bold tracking-tight mb-1.5">Six capabilities. Zero compromises.</h2>
          <p className="text-sm" style={{ color: "#6b7280" }}>Built for real analysis — not toy diagrams.</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {features.map((f, i) => (
            <div
              key={i}
              className="rounded-xl flex flex-col cursor-default overflow-hidden"
              style={{
                background: hovered === i ? "#0d1524" : "#0b1220",
                border: `1px solid ${hovered === i ? f.color + "40" : "#1e2d3d"}`,
                transition: "border-color 0.2s, background 0.2s",
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* icon ring */}
              <div className="px-4 pt-5 pb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-4"
                  style={{ background: `${f.color}15`, border: `1px solid ${f.color}30`, color: f.color }}
                >
                  {f.icon}
                </div>
                <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
                {/* stat */}
                <div className="flex items-baseline gap-1.5 mb-3">
                  <span className="text-xl font-mono font-black" style={{ color: f.color }}>{f.stat}</span>
                  <span className="text-[10px]" style={{ color: "#4b5563" }}>{f.statLabel}</span>
                </div>
                <p className="text-[11px] leading-relaxed mb-3" style={{ color: "#9ca3af" }}>{f.desc}</p>
              </div>

              {/* visual block */}
              <div
                className="mx-3 mb-3 rounded-lg overflow-hidden flex-shrink-0"
                style={{ height: 60, background: "#070c18", border: "1px solid #1a2a3a", padding: 6 }}
              >
                {f.detail}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
