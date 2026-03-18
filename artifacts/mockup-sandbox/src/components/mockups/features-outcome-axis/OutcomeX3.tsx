import React, { useState, useEffect } from "react";

// OUTCOME AXIS — VARIATION X3: "ONE BOLD CLAIM. THEN THE PROOF."
//
// Every feature section hedges. It says "you can see your Greeks" not "you will
// know your exact daily theta income." This design makes one enormous, specific,
// falsifiable claim per section — a claim so concrete it either lands or doesn't.
// Below the claim, the product evidence appears as a receipt: dated, numbered, specific.
//
// The design axis being explored:
//   BEFORE (conventional): "Options Greeks — Track delta, gamma, theta, vega, and rho for your position."
//   AFTER (this): "You'll earn $14.20 in theta today. Here's how we know."
//
// This makes the product feel like a calculator, not a brochure.
// The aesthetic reflects that: monospace, receipt-like, precise.
//
// Interaction: animated number counters on the key stats. The numbers "arrive."

const TEAL = "#1abd9c";

function useCount(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(target * ease));
      if (t < 1) requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return val;
}

function AnimatedStat({ value, prefix = "", suffix = "", duration = 1200 }: { value: number; prefix?: string; suffix?: string; duration?: number }) {
  const v = useCount(value, duration);
  return <>{prefix}{v.toLocaleString()}{suffix}</>;
}

const sections = [
  {
    claim: "You'll know your maximum possible loss before the order is sent.",
    why: "Not an estimate. The exact dollar amount, for every possible stock price.",
    color: "#1abd9c",
    receipt: [
      { label: "TOOL", value: "P/L Chart" },
      { label: "TOOL", value: "P/L Heatmap" },
      { label: "INPUT", value: "Your strikes + expiration + premium" },
      { label: "OUTPUT", value: "Max loss: exactly $420.00" },
      { label: "COVERAGE", value: "50 price levels × 20 time intervals" },
      { label: "UPDATE", value: "Real-time — as you adjust any parameter" },
    ],
    stat: 420, statPrefix: "−$", statSuffix: " max loss", statColor: "#f87171",
  },
  {
    claim: "You'll know that your Iron Condor has a 72% win rate — before you trade it.",
    why: "We ran it. 156 trades. 5 years of AAPL data. 30 DTE. Here are the results.",
    color: "#fbbf24",
    receipt: [
      { label: "TOOL", value: "Backtesting Engine" },
      { label: "PERIOD", value: "Jan 2019 – Dec 2024" },
      { label: "ENTRIES", value: "156 trades (daily entry, 30 DTE)" },
      { label: "WIN RATE", value: "72.4% (113 of 156)" },
      { label: "NET P/L", value: "+$4,250 on $25,000 BPR" },
      { label: "MAX DD", value: "−$1,840 (7.4% of capital)" },
    ],
    stat: 4250, statPrefix: "+$", statSuffix: " net profit", statColor: "#1abd9c",
  },
  {
    claim: "You'll find the 30-delta put expiring in 21 days in under three seconds.",
    why: "Not by scrolling. By filtering. The right contract surfaces immediately.",
    color: "#f472b6",
    receipt: [
      { label: "TOOL", value: "Option Finder" },
      { label: "FILTER 1", value: "Delta: 0.25 – 0.35" },
      { label: "FILTER 2", value: "DTE: 18 – 25 days" },
      { label: "FILTER 3", value: "IV Rank: > 40%" },
      { label: "RESULT", value: "3 contracts match (from 500+)" },
      { label: "TIME", value: "< 1 second to filter" },
    ],
    stat: 500, statPrefix: "", statSuffix: "+ contracts filtered", statColor: "#f472b6",
  },
];

function ReceiptSection({ s, index }: { s: typeof sections[0]; index: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), index * 200);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        border: `1px solid ${s.color}20`,
        background: "#090e1c",
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(8px)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
      }}
    >
      {/* The claim */}
      <div className="px-6 pt-6 pb-4">
        <p className="text-base font-bold leading-snug mb-2" style={{ color: "#f9fafb" }}>
          {s.claim}
        </p>
        <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>{s.why}</p>
      </div>

      {/* The receipt */}
      <div className="mx-4 mb-4 rounded-lg overflow-hidden" style={{ background: "#050a14", border: `1px solid #111827` }}>
        {/* receipt header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "#111827" }}>
          <span className="text-[9px] font-mono tracking-widest" style={{ color: "#374151" }}>EVIDENCE</span>
          <span className="text-[9px] font-mono" style={{ color: s.color }}>OptionBuild</span>
        </div>
        {/* receipt rows */}
        {s.receipt.map((r, i) => (
          <div
            key={i}
            className="flex items-start justify-between gap-4 px-4 py-2"
            style={{ borderBottom: i < s.receipt.length - 1 ? "1px solid #0d1320" : "none" }}
          >
            <span className="text-[9px] font-mono flex-shrink-0" style={{ color: "#374151" }}>{r.label}</span>
            <span className="text-[10px] font-mono text-right" style={{ color: "#9ca3af" }}>{r.value}</span>
          </div>
        ))}
        {/* receipt total */}
        <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "#111827" }}>
          <span className="text-[9px] font-mono tracking-widest" style={{ color: "#374151" }}>RESULT</span>
          <span className="text-sm font-mono font-black" style={{ color: s.statColor }}>
            <AnimatedStat value={s.stat} prefix={s.statPrefix} suffix={s.statSuffix} duration={1000 + index * 200} />
          </span>
        </div>
      </div>
    </div>
  );
}

export default function OutcomeX3() {
  return (
    <div className="min-h-screen font-sans py-10 px-8 overflow-auto" style={{ background: "#070c18", color: "#f9fafb" }}>
      <div className="fixed top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${TEAL} 30%, ${TEAL} 70%, transparent)` }} />
      {/* subtle dot grid */}
      <div className="fixed inset-0 pointer-events-none opacity-20" style={{ backgroundImage: "radial-gradient(circle, #1abd9c 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="max-w-2xl mx-auto relative z-10">
        {/* Header */}
        <div className="mb-10 pb-6 border-b" style={{ borderColor: "#111827" }}>
          <p className="text-[10px] font-mono tracking-[0.25em] mb-3" style={{ color: TEAL }}>THE EVIDENCE</p>
          <h2 className="text-2xl font-bold tracking-tight mb-1.5">
            Precise claims. Documented proof.
          </h2>
          <p className="text-sm" style={{ color: "#4b5563" }}>
            We don't describe what OptionBuild does. We show the output.
          </p>
        </div>

        {/* Receipt sections */}
        <div className="space-y-4">
          {sections.map((s, i) => (
            <ReceiptSection key={i} s={s} index={i} />
          ))}
        </div>

        {/* Footer */}
        <div className="pt-8 mt-6 border-t flex items-center justify-between" style={{ borderColor: "#111827" }}>
          <div>
            <p className="text-xs font-mono" style={{ color: "#374151" }}>All results shown are from real historical backtests.</p>
            <p className="text-[10px]" style={{ color: "#1e2d3d" }}>Past performance does not guarantee future results.</p>
          </div>
          <button className="px-4 py-2 rounded text-xs font-semibold flex-shrink-0" style={{ background: TEAL, color: "#070c18" }}>
            Run your own →
          </button>
        </div>
      </div>
    </div>
  );
}
