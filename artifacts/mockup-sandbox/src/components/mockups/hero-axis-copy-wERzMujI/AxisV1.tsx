import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';

// AXIS V1 — Output-First
// The payoff diagram is the hero. The form is a compact toolbar at the top.
// Every variant so far made the form the star. This inverts the hierarchy:
// show them what they GET first, let them configure it second.

const PRIMARY = '#1abd9c';
const BG = '#040b18';
const CARD = '#070e1b';
const BORDER = '#162035';
const MFG = '#525e6e';
const FG = '#f0f5fa';
const MUTED_BG = '#0a1428';
const RED = '#f87171';

const STRATEGIES = [
  'Long Call', 'Long Put', 'Bull Call Spread', 'Bear Put Spread',
  'Iron Condor', 'Iron Butterfly', 'Long Straddle', 'Long Strangle',
  'Covered Call', 'Protective Put', 'Cash-Secured Put', 'Collar',
];
const TICKERS = ['AAPL', 'TSLA', 'NVDA', 'SPY', 'MSFT', 'QQQ'];

// Normalized payoff points [x, y] where y=1 = max profit (top), y=0 = max loss (bottom)
const PAYOFFS: Record<string, [number, number][]> = {
  'Long Call':         [[0, 0.14], [0.50, 0.14], [1.0, 0.96]],
  'Long Put':          [[0, 0.96], [0.50, 0.14], [1.0, 0.14]],
  'Bull Call Spread':  [[0, 0.14], [0.38, 0.14], [0.62, 0.86], [1.0, 0.86]],
  'Bear Put Spread':   [[0, 0.86], [0.38, 0.86], [0.62, 0.14], [1.0, 0.14]],
  'Iron Condor':       [[0, 0.14], [0.20, 0.14], [0.32, 0.86], [0.68, 0.86], [0.80, 0.14], [1.0, 0.14]],
  'Iron Butterfly':    [[0, 0.10], [0.28, 0.10], [0.50, 0.92], [0.72, 0.10], [1.0, 0.10]],
  'Long Straddle':     [[0, 0.90], [0.50, 0.10], [1.0, 0.90]],
  'Long Strangle':     [[0, 0.90], [0.34, 0.14], [0.66, 0.14], [1.0, 0.90]],
  'Covered Call':      [[0, 0.14], [0.45, 0.68], [0.68, 0.68], [1.0, 0.68]],
  'Protective Put':    [[0, 0.30], [0.42, 0.30], [1.0, 0.90]],
  'Cash-Secured Put':  [[0, 0.90], [0.42, 0.90], [0.68, 0.14], [1.0, 0.14]],
  'Collar':            [[0, 0.30], [0.30, 0.30], [0.55, 0.65], [0.75, 0.75], [1.0, 0.75]],
};

const STRATEGY_LABELS: Record<string, { sentiment: string; color: string; breakeven: string; maxProfit: string; maxLoss: string }> = {
  'Long Call':         { sentiment: 'Bullish', color: PRIMARY, breakeven: 'Strike + Premium', maxProfit: 'Unlimited', maxLoss: 'Premium Paid' },
  'Long Put':          { sentiment: 'Bearish', color: RED, breakeven: 'Strike − Premium', maxProfit: '(Strike − Prem)', maxLoss: 'Premium Paid' },
  'Bull Call Spread':  { sentiment: 'Bullish', color: PRIMARY, breakeven: 'Lower + Net Debit', maxProfit: 'Spread − Debit', maxLoss: 'Net Debit' },
  'Bear Put Spread':   { sentiment: 'Bearish', color: RED, breakeven: 'Upper − Net Debit', maxProfit: 'Spread − Debit', maxLoss: 'Net Debit' },
  'Iron Condor':       { sentiment: 'Neutral', color: '#60a5fa', breakeven: '2 points (±)', maxProfit: 'Net Credit', maxLoss: 'Spread − Credit' },
  'Iron Butterfly':    { sentiment: 'Neutral', color: '#60a5fa', breakeven: '2 points (±)', maxProfit: 'Net Credit', maxLoss: 'Spread − Credit' },
  'Long Straddle':     { sentiment: 'Volatile', color: '#a78bfa', breakeven: '± Premium', maxProfit: 'Unlimited', maxLoss: 'Both Premiums' },
  'Long Strangle':     { sentiment: 'Volatile', color: '#a78bfa', breakeven: '± Net Debit', maxProfit: 'Unlimited', maxLoss: 'Net Debit' },
  'Covered Call':      { sentiment: 'Bullish', color: PRIMARY, breakeven: 'Stock − Premium', maxProfit: 'Strike − Cost + Prem', maxLoss: 'Stock Price − Prem' },
  'Protective Put':    { sentiment: 'Bullish', color: PRIMARY, breakeven: 'Stock + Premium', maxProfit: 'Unlimited', maxLoss: 'Put Premium' },
  'Cash-Secured Put':  { sentiment: 'Bullish', color: PRIMARY, breakeven: 'Strike − Premium', maxProfit: 'Premium Received', maxLoss: 'Strike − Premium' },
  'Collar':            { sentiment: 'Neutral', color: '#60a5fa', breakeven: 'Stock Price', maxProfit: 'Call Strike − Cost', maxLoss: 'Cost − Put Strike' },
};

function PayoffSVG({ strategy, animKey }: { strategy: string; animKey: number }) {
  const W = 800, H = 200;
  const pts = PAYOFFS[strategy] ?? PAYOFFS['Iron Condor'];
  const svgPts = pts.map(([x, y]): [number, number] => [x * W, (1 - y) * H]);
  const linePath = svgPts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const fillPath = linePath + ` L${W},${H} L0,${H} Z`;

  const breakevenY = H * 0.5; // visual midpoint

  const gridXs = [0.2, 0.4, 0.6, 0.8];
  const gridYs = [0.25, 0.5, 0.75];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`plFill${animKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={PRIMARY} stopOpacity="0.18" />
          <stop offset="46%" stopColor={PRIMARY} stopOpacity="0.06" />
          <stop offset="54%" stopColor={RED} stopOpacity="0.06" />
          <stop offset="100%" stopColor={RED} stopOpacity="0.18" />
        </linearGradient>
        <clipPath id={`clip${animKey}`}>
          <rect x="0" y="0" width={W} height={H} />
        </clipPath>
      </defs>

      {/* Vertical grid */}
      {gridXs.map(x => (
        <line key={x} x1={x * W} y1={0} x2={x * W} y2={H} stroke={BORDER} strokeWidth="1" />
      ))}
      {/* Horizontal grid */}
      {gridYs.map(y => (
        <line key={y} x1={0} y1={y * H} x2={W} y2={y * H} stroke={BORDER} strokeWidth="1" />
      ))}

      {/* Breakeven dashed */}
      <line x1={0} y1={breakevenY} x2={W} y2={breakevenY} stroke={MFG} strokeWidth="1" strokeDasharray="5,4" strokeOpacity="0.6" />

      {/* P/L gradient fill */}
      <path d={fillPath} fill={`url(#plFill${animKey})`} clipPath={`url(#clip${animKey})`} />

      {/* Payoff line */}
      <path d={linePath} fill="none" stroke={PRIMARY} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* Labels */}
      <text x="8" y="14" fontSize="9" fill={MFG} fontFamily="monospace" opacity="0.7">PROFIT</text>
      <text x="8" y={H - 5} fontSize="9" fill={MFG} fontFamily="monospace" opacity="0.7">LOSS</text>
      <text x={W / 2 + 4} y={breakevenY - 4} fontSize="9" fill={MFG} fontFamily="monospace" opacity="0.5">breakeven</text>
    </svg>
  );
}

export function AxisV1() {
  const [ticker, setTicker] = useState('AAPL');
  const [tickerInput, setTickerInput] = useState('');
  const [showTicker, setShowTicker] = useState(false);
  const [strategy, setStrategy] = useState('Iron Condor');
  const [showStrategy, setShowStrategy] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const tickerRef = useRef<HTMLDivElement>(null);
  const stratRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (tickerRef.current && !tickerRef.current.contains(e.target as Node)) setShowTicker(false);
      if (stratRef.current && !stratRef.current.contains(e.target as Node)) setShowStrategy(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const filtered = tickerInput ? TICKERS.filter(t => t.startsWith(tickerInput)) : TICKERS;
  const meta = STRATEGY_LABELS[strategy] ?? STRATEGY_LABELS['Iron Condor'];

  return (
    <section style={{ background: BG, minHeight: 600, fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '52px 32px', position: 'relative', overflow: 'hidden' }}>

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.06,
        backgroundImage: `linear-gradient(to right, ${FG} 1px, transparent 1px), linear-gradient(to bottom, ${FG} 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%, black 10%, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%, black 10%, transparent 70%)',
      }} />

      <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', width: 700, height: 400, borderRadius: '50%', pointerEvents: 'none', background: `radial-gradient(ellipse at center, ${PRIMARY}1a 0%, transparent 65%)` }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* Compact headline above */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p style={{ fontFamily: 'monospace', fontSize: 10, color: MFG, letterSpacing: '0.15em', marginBottom: 10 }}>OPTIONS STRATEGY BUILDER</p>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 800, color: FG, margin: 0, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
            See Your Strategy. <span style={{ color: PRIMARY }}>Before You Trade It.</span>
          </h1>
        </div>

        {/* Terminal panel */}
        <div style={{ border: `1px solid ${BORDER}`, background: CARD, boxShadow: `0 0 80px rgba(0,0,0,0.6), 0 0 40px ${PRIMARY}0a` }}>

          {/* TOOLBAR — compact form row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0', borderBottom: `1px solid ${BORDER}`, background: MUTED_BG }}>

            {/* Terminal dots */}
            <div style={{ display: 'flex', gap: 5, padding: '10px 14px', borderRight: `1px solid ${BORDER}`, flexShrink: 0 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#f87171', opacity: 0.8 }} />
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#fbbf24', opacity: 0.8 }} />
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: PRIMARY, opacity: 0.8 }} />
            </div>

            {/* Ticker inline */}
            <div ref={tickerRef} style={{ position: 'relative', borderRight: `1px solid ${BORDER}` }}>
              <div onClick={() => setShowTicker(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', cursor: 'text', height: 38 }}>
                <span style={{ color: PRIMARY, fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>$</span>
                <input
                  value={tickerInput || (showTicker ? '' : ticker)}
                  onChange={e => { setTickerInput(e.target.value.toUpperCase()); setShowTicker(true); }}
                  onFocus={() => setShowTicker(true)}
                  placeholder={ticker}
                  style={{ background: 'transparent', border: 'none', outline: 'none', color: FG, fontFamily: 'monospace', fontSize: 12, width: 60 }}
                />
              </div>
              {showTicker && (
                <div style={{ position: 'absolute', top: '100%', left: 0, background: CARD, border: `1px solid ${BORDER}`, zIndex: 50, marginTop: 1, minWidth: 100 }}>
                  {filtered.map(s => (
                    <div key={s} onMouseDown={() => { setTicker(s); setTickerInput(''); setShowTicker(false); }}
                      style={{ padding: '7px 14px', fontFamily: 'monospace', fontSize: 12, color: FG, cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = MUTED_BG)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >{s}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Strategy inline */}
            <div ref={stratRef} style={{ position: 'relative', flex: 1, borderRight: `1px solid ${BORDER}` }}>
              <button onClick={() => setShowStrategy(!showStrategy)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'transparent', border: 'none', padding: '0 14px', height: 38, color: FG, fontFamily: 'monospace', fontSize: 12, cursor: 'pointer' }}>
                <span style={{ color: meta.color, fontWeight: 600 }}>{strategy}</span>
                <ChevronDown style={{ width: 12, height: 12, color: MFG, transform: showStrategy ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
              </button>
              {showStrategy && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: CARD, border: `1px solid ${BORDER}`, zIndex: 50, marginTop: 1, maxHeight: 220, overflowY: 'auto' }}>
                  {STRATEGIES.map(s => (
                    <div key={s} onMouseDown={() => { setStrategy(s); setShowStrategy(false); setAnimKey(k => k + 1); }}
                      style={{ padding: '7px 14px', fontFamily: 'monospace', fontSize: 12, color: s === strategy ? PRIMARY : FG, background: s === strategy ? `${PRIMARY}15` : 'transparent', cursor: 'pointer' }}
                      onMouseEnter={e => { if (s !== strategy) e.currentTarget.style.background = MUTED_BG; }}
                      onMouseLeave={e => { if (s !== strategy) e.currentTarget.style.background = 'transparent'; }}
                    >{s}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Sentiment badge */}
            <div style={{ padding: '0 14px', height: 38, display: 'flex', alignItems: 'center', borderRight: `1px solid ${BORDER}`, flexShrink: 0 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: meta.color, fontWeight: 700, letterSpacing: '0.08em' }}>{meta.sentiment.toUpperCase()}</span>
            </div>

            {/* Build CTA */}
            <button
              style={{ padding: '0 20px', height: 38, background: PRIMARY, color: BG, fontFamily: 'monospace', fontWeight: 800, fontSize: 12, border: 'none', cursor: 'pointer', letterSpacing: '0.06em', flexShrink: 0, transition: 'filter 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')}
              onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
            >
              BUILD →
            </button>
          </div>

          {/* CHART — the hero */}
          <div style={{ padding: '24px 24px 0', height: 200 }}>
            <PayoffSVG strategy={strategy} animKey={animKey} />
          </div>

          {/* Metrics strip */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: `1px solid ${BORDER}`, margin: '0 0' }}>
            {[
              { label: 'Breakeven', value: meta.breakeven },
              { label: 'Max Profit', value: meta.maxProfit },
              { label: 'Max Loss', value: meta.maxLoss },
            ].map(({ label, value }, i) => (
              <div key={label} style={{ padding: '12px 20px', borderLeft: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: MFG, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: i === 1 ? PRIMARY : i === 2 ? RED : FG, fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sub-label */}
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: MFG }}>Black-Scholes pricing · Live chain data · 30+ strategy templates</span>
        </div>
      </div>
    </section>
  );
}
