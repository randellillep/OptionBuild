import React, { useState, useEffect } from "react";
import { BarChart3, Calculator, Layers, Search, LineChart, TrendingUp, ArrowRight } from "lucide-react";

// V1: INSTRUMENT PANEL
// Each card is a live-looking terminal panel with mini SVG visualizations.
// No screenshots — every feature proves itself with an actual data visual.

function MiniHeatmap() {
  const cols = 10, rows = 5;
  const vals = Array.from({ length: cols * rows }, (_, i) => {
    const x = i % cols, y = Math.floor(i / cols);
    const raw = Math.sin(x * 0.7 + y * 0.5) * 0.5 + Math.cos(x * 0.3 - y * 0.8) * 0.5;
    return raw;
  });
  const min = Math.min(...vals), max = Math.max(...vals);
  return (
    <svg viewBox={`0 0 ${cols * 14} ${rows * 10}`} className="w-full h-full">
      {vals.map((v, i) => {
        const x = (i % cols) * 14, y = Math.floor(i / cols) * 10;
        const t = (v - min) / (max - min);
        const r = t > 0.5 ? Math.round(26 + (t - 0.5) * 2 * 80) : 26;
        const g = t > 0.5 ? Math.round(189 - (t - 0.5) * 2 * 50) : Math.round(189 * t * 2);
        const b = t < 0.5 ? Math.round(156 * (1 - t * 2)) : 0;
        return <rect key={i} x={x + 1} y={y + 1} width={12} height={8} rx={1} fill={`rgb(${r},${g},${b})`} opacity={0.85} />;
      })}
    </svg>
  );
}

function MiniGreeks() {
  const greeks = [
    { name: "Δ", value: "0.45", color: "#1abd9c" },
    { name: "Γ", value: "0.08", color: "#60a5fa" },
    { name: "Θ", value: "-2.31", color: "#f87171" },
    { name: "V", value: "0.03", color: "#a78bfa" },
  ];
  return (
    <div className="grid grid-cols-4 gap-2 h-full">
      {greeks.map(({ name, value, color }) => (
        <div key={name} className="flex flex-col items-center justify-center rounded" style={{ background: `${color}10`, border: `1px solid ${color}30` }}>
          <span className="text-[10px] font-mono mb-1" style={{ color: "#6b7280" }}>{name}</span>
          <span className="text-sm font-mono font-bold" style={{ color }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function MiniEquityCurve() {
  const pts = [0, 12, 8, 25, 20, 35, 30, 50, 45, 65, 58, 80, 72, 88, 82, 100].map((y, i) => ({
    x: (i / 15) * 200, y: 60 - y * 0.55,
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const fill = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + ` L ${pts[pts.length - 1].x} 65 L 0 65 Z`;
  return (
    <svg viewBox="0 0 200 65" className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="eq-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1abd9c" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#1abd9c" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#eq-g)" />
      <path d={path} fill="none" stroke="#1abd9c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MiniPayoff() {
  return (
    <svg viewBox="0 0 200 70" className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="pay-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1abd9c" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#1abd9c" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="loss-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f87171" stopOpacity="0" />
          <stop offset="100%" stopColor="#f87171" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <line x1="0" y1="35" x2="200" y2="35" stroke="#374151" strokeWidth="1" strokeDasharray="3 3" />
      <path d="M 0 55 L 60 55 L 100 15 L 140 15 L 200 55 L 200 70 L 0 70 Z" fill="url(#loss-g)" />
      <path d="M 60 55 L 60 35 L 140 35 L 140 55 L 100 15 Z" fill="url(#pay-g)" />
      <path d="M 0 55 L 60 55 L 100 15 L 140 15 L 200 55" fill="none" stroke="#1abd9c" strokeWidth="1.5" />
    </svg>
  );
}

function MiniChain() {
  const rows = [
    { strike: "260C", iv: "28.4%", bid: "3.40", ask: "3.60", delta: "0.45" },
    { strike: "255C", iv: "30.1%", bid: "5.20", ask: "5.40", delta: "0.58" },
    { strike: "265C", iv: "26.8%", bid: "2.10", ask: "2.25", delta: "0.33" },
  ];
  return (
    <div className="flex flex-col gap-1 h-full">
      <div className="grid grid-cols-5 text-[8px] font-mono text-gray-600 px-1 pb-0.5 border-b border-gray-800">
        <span>Strike</span><span>IV</span><span>Bid</span><span>Ask</span><span>Δ</span>
      </div>
      {rows.map(r => (
        <div key={r.strike} className="grid grid-cols-5 text-[9px] font-mono text-gray-300 px-1 py-0.5 rounded hover:bg-gray-800/40">
          <span className="text-[#1abd9c]">{r.strike}</span>
          <span>{r.iv}</span>
          <span>{r.bid}</span>
          <span>{r.ask}</span>
          <span>{r.delta}</span>
        </div>
      ))}
    </div>
  );
}

const features = [
  {
    icon: BarChart3, title: "P/L Heatmap", size: "large",
    desc: "Color-coded grid across price × time. See every profit and loss scenario instantly.",
    stat: "50×20 grid",
    visual: <MiniHeatmap />,
  },
  {
    icon: Calculator, title: "Options Greeks", size: "small",
    desc: "Live delta, gamma, theta, vega for your entire position.",
    stat: "Real-time",
    visual: <MiniGreeks />,
  },
  {
    icon: Layers, title: "30+ Strategy Templates", size: "small",
    desc: "Spreads, straddles, condors, butterflies — load any template instantly.",
    stat: "32 strategies",
    visual: <MiniPayoff />,
  },
  {
    icon: BarChart3, title: "Backtesting", size: "large",
    desc: "Historical simulation with equity curves, drawdowns, and win rates.",
    stat: "72% avg win rate",
    visual: <MiniEquityCurve />,
  },
  {
    icon: LineChart, title: "P/L Chart", size: "large",
    desc: "Interactive payoff diagram with breakeven points, max profit, max loss zones.",
    stat: "Real-time update",
    visual: <MiniPayoff />,
  },
  {
    icon: Search, title: "Option Finder", size: "small",
    desc: "Filter by strike, expiration, Greeks. Surface the best contract fast.",
    stat: "Full chain",
    visual: <MiniChain />,
  },
];

function FeatureCard({ feature, large }: { feature: typeof features[0]; large: boolean }) {
  const Icon = feature.icon;
  return (
    <div
      className={`rounded-xl border flex flex-col overflow-hidden ${large ? "" : ""}`}
      style={{ background: "#0d1320", borderColor: "#1e2d3d" }}
    >
      {/* terminal bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "#1a2a3a", background: "#0a0f1c" }}>
        <div className="flex items-center gap-2">
          <Icon className="w-3 h-3" style={{ color: "#1abd9c" }} />
          <span className="text-[10px] font-mono" style={{ color: "#6b7280" }}>{feature.title.toUpperCase()}</span>
        </div>
        <span className="text-[9px] font-mono" style={{ color: "#1abd9c" }}>{feature.stat}</span>
      </div>
      {/* visual */}
      <div className="flex-1 p-3" style={{ minHeight: large ? 90 : 70 }}>
        {feature.visual}
      </div>
      {/* description */}
      <div className="px-3 pb-3">
        <p className="text-[11px] leading-relaxed" style={{ color: "#9ca3af" }}>{feature.desc}</p>
      </div>
    </div>
  );
}

export default function FeaturesV1InstrumentPanel() {
  return (
    <div className="min-h-screen font-sans px-8 py-10" style={{ background: "#080d19", color: "#f9fafb" }}>
      {/* teal accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(to right, transparent, #1abd9c 20%, #1abd9c 80%, transparent)" }} />

      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <p className="text-[10px] font-mono tracking-[0.2em] mb-2.5" style={{ color: "#1abd9c" }}>THE FULL TOOLKIT</p>
          <h2 className="text-2xl font-bold tracking-tight mb-1.5">Every tool. Live data. No diagrams.</h2>
          <p className="text-sm" style={{ color: "#6b7280" }}>Visualizations are the real thing — not screenshots.</p>
        </div>

        {/* Bento alternating */}
        <div className="grid grid-cols-3 gap-3">
          {/* Row 1: large + small */}
          <div className="col-span-2"><FeatureCard feature={features[0]} large={true} /></div>
          <div className="col-span-1"><FeatureCard feature={features[1]} large={false} /></div>
          {/* Row 2: small + large */}
          <div className="col-span-1"><FeatureCard feature={features[2]} large={false} /></div>
          <div className="col-span-2"><FeatureCard feature={features[3]} large={true} /></div>
          {/* Row 3: large + small */}
          <div className="col-span-2"><FeatureCard feature={features[4]} large={true} /></div>
          <div className="col-span-1"><FeatureCard feature={features[5]} large={false} /></div>
        </div>
      </div>
    </div>
  );
}
