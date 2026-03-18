import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

// UNIFIED — Combines V2 + V3's best elements
// · "Build & Visualize Options Strategies" — the anchoring product statement (from V3)
// · "Analyze [AAPL] using [Iron Condor]" — the interactive sentence headline (V2's core)
// · Live payoff chart below — shows the strategy shape immediately (from Axis V1)

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
const TICKERS = ['AAPL', 'TSLA', 'NVDA', 'SPY', 'MSFT', 'QQQ', 'AMZN', 'META'];

const STRATEGY_META: Record<string, { sentiment: string; sentimentColor: string; desc: string; bp: string; mp: string; ml: string }> = {
  'Long Call':         { sentiment: 'Bullish', sentimentColor: PRIMARY,    desc: 'Profit if price rises above strike', bp: 'Strike + Premium', mp: 'Unlimited', ml: 'Premium paid' },
  'Long Put':          { sentiment: 'Bearish', sentimentColor: RED,         desc: 'Profit if price falls below strike', bp: 'Strike − Premium', mp: 'Strike − Prem', ml: 'Premium paid' },
  'Bull Call Spread':  { sentiment: 'Bullish', sentimentColor: PRIMARY,    desc: 'Defined-risk bullish play, capped upside', bp: 'Lower + Net Debit', mp: 'Spread − Debit', ml: 'Net Debit' },
  'Bear Put Spread':   { sentiment: 'Bearish', sentimentColor: RED,         desc: 'Defined-risk bearish play, capped downside', bp: 'Upper − Net Debit', mp: 'Spread − Debit', ml: 'Net Debit' },
  'Iron Condor':       { sentiment: 'Neutral', sentimentColor: '#60a5fa',  desc: 'Profit if price stays within a defined range', bp: 'Two breakevens (±)', mp: 'Net Credit', ml: 'Spread − Credit' },
  'Iron Butterfly':    { sentiment: 'Neutral', sentimentColor: '#60a5fa',  desc: 'Profit when price pins near current level', bp: 'Two breakevens (±)', mp: 'Net Credit', ml: 'Spread − Credit' },
  'Long Straddle':     { sentiment: 'Volatile', sentimentColor: '#a78bfa', desc: 'Profit from a large move in either direction', bp: '± Net Debit', mp: 'Unlimited', ml: 'Both Premiums' },
  'Long Strangle':     { sentiment: 'Volatile', sentimentColor: '#a78bfa', desc: 'Cheaper straddle with wider breakevens', bp: '± Net Debit', mp: 'Unlimited', ml: 'Net Debit' },
  'Covered Call':      { sentiment: 'Bullish', sentimentColor: PRIMARY,    desc: 'Generate income on stock you already own', bp: 'Stock − Premium', mp: 'Call Strike − Cost', ml: 'Stock − Premium' },
  'Protective Put':    { sentiment: 'Hedged', sentimentColor: '#60a5fa',   desc: 'Insurance floor for an existing stock position', bp: 'Stock + Premium', mp: 'Unlimited', ml: 'Put Premium' },
  'Cash-Secured Put':  { sentiment: 'Bullish', sentimentColor: PRIMARY,    desc: 'Get paid to buy stock at a lower price', bp: 'Strike − Premium', mp: 'Premium received', ml: 'Strike − Premium' },
  'Collar':            { sentiment: 'Neutral', sentimentColor: '#60a5fa',  desc: 'Cap both losses and upside with options', bp: 'Stock Cost', mp: 'Call − Stock', ml: 'Stock − Put' },
};

// Normalized payoff shapes [x, y] — y=1 top (profit), y=0 bottom (loss)
const PAYOFFS: Record<string, [number, number][]> = {
  'Long Call':        [[0, 0.14], [0.50, 0.14], [1.0, 0.96]],
  'Long Put':         [[0, 0.96], [0.50, 0.14], [1.0, 0.14]],
  'Bull Call Spread': [[0, 0.14], [0.38, 0.14], [0.62, 0.88], [1.0, 0.88]],
  'Bear Put Spread':  [[0, 0.88], [0.38, 0.88], [0.62, 0.14], [1.0, 0.14]],
  'Iron Condor':      [[0, 0.14], [0.20, 0.14], [0.32, 0.88], [0.68, 0.88], [0.80, 0.14], [1.0, 0.14]],
  'Iron Butterfly':   [[0, 0.10], [0.28, 0.10], [0.50, 0.92], [0.72, 0.10], [1.0, 0.10]],
  'Long Straddle':    [[0, 0.90], [0.50, 0.10], [1.0, 0.90]],
  'Long Strangle':    [[0, 0.90], [0.34, 0.14], [0.66, 0.14], [1.0, 0.90]],
  'Covered Call':     [[0, 0.14], [0.45, 0.70], [0.68, 0.70], [1.0, 0.70]],
  'Protective Put':   [[0, 0.30], [0.42, 0.30], [1.0, 0.90]],
  'Cash-Secured Put': [[0, 0.90], [0.42, 0.90], [0.68, 0.14], [1.0, 0.14]],
  'Collar':           [[0, 0.30], [0.30, 0.30], [0.55, 0.65], [0.75, 0.75], [1.0, 0.75]],
};

function PayoffChart({ strategy, color }: { strategy: string; color: string }) {
  const W = 720, H = 130;
  const pts = PAYOFFS[strategy] ?? PAYOFFS['Iron Condor'];
  const svgPts = pts.map(([x, y]): [number, number] => [x * W, (1 - y) * H]);
  const linePath = svgPts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const fillPath = linePath + ` L${W},${H} L0,${H} Z`;
  const beY = H * 0.5;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="unifGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.20" />
          <stop offset="44%" stopColor={color} stopOpacity="0.05" />
          <stop offset="56%" stopColor={RED} stopOpacity="0.05" />
          <stop offset="100%" stopColor={RED} stopOpacity="0.18" />
        </linearGradient>
      </defs>

      {/* Subtle vertical grid */}
      {[0.25, 0.5, 0.75].map(x => (
        <line key={x} x1={x * W} y1={0} x2={x * W} y2={H} stroke={BORDER} strokeWidth="1" />
      ))}

      {/* Breakeven dashed */}
      <line x1={0} y1={beY} x2={W} y2={beY} stroke={MFG} strokeWidth="1" strokeDasharray="4,3" strokeOpacity="0.55" />

      {/* Fill */}
      <path d={fillPath} fill="url(#unifGrad)" />

      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* Corner labels */}
      <text x="6" y="13" fontSize="8.5" fill={MFG} fontFamily="monospace" opacity="0.6">PROFIT</text>
      <text x="6" y={H - 4} fontSize="8.5" fill={MFG} fontFamily="monospace" opacity="0.6">LOSS</text>
      <text x={W / 2 - 14} y={beY - 5} fontSize="8.5" fill={MFG} fontFamily="monospace" opacity="0.45">breakeven</text>
    </svg>
  );
}

export function Unified() {
  const [ticker, setTicker] = useState('AAPL');
  const [tickerInput, setTickerInput] = useState('');
  const [showTicker, setShowTicker] = useState(false);
  const [strategy, setStrategy] = useState('Iron Condor');
  const [showStrategy, setShowStrategy] = useState(false);
  const [cursorOn, setCursorOn] = useState(true);
  const tickerRef = useRef<HTMLDivElement>(null);
  const stratRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setCursorOn(v => !v), 530);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (tickerRef.current && !tickerRef.current.contains(e.target as Node)) setShowTicker(false);
      if (stratRef.current && !stratRef.current.contains(e.target as Node)) setShowStrategy(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const filteredTickers = tickerInput ? TICKERS.filter(t => t.startsWith(tickerInput)) : TICKERS;
  const meta = STRATEGY_META[strategy] ?? STRATEGY_META['Iron Condor'];

  return (
    <section style={{
      background: BG,
      fontFamily: "'Inter', system-ui, sans-serif",
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 32px 36px', position: 'relative', overflow: 'hidden',
      minHeight: 720,
    }}>

      {/* Grid */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.04,
        backgroundImage: `linear-gradient(to right, ${FG} 1px, transparent 1px), linear-gradient(to bottom, ${FG} 1px, transparent 1px)`,
        backgroundSize: '64px 64px',
      }} />

      {/* Glow — centered, tracks strategy sentiment color */}
      <div style={{ position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%, -50%)', width: 640, height: 320, borderRadius: '50%', pointerEvents: 'none', background: `radial-gradient(ellipse at center, ${meta.sentimentColor}14 0%, transparent 65%)`, transition: 'background 0.4s' }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

        {/* ① Product category label */}
        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: PRIMARY, boxShadow: `0 0 6px ${PRIMARY}` }} />
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: MFG, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Build &amp; Visualize Options Strategies
          </span>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: PRIMARY, boxShadow: `0 0 6px ${PRIMARY}` }} />
        </div>

        {/* ② Interactive sentence headline */}
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '10px 8px', fontSize: 'clamp(2rem, 4.5vw, 3.2rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>

            <span style={{ color: MFG, fontSize: '0.75em', fontWeight: 500 }}>Analyze</span>

            {/* Ticker */}
            <div ref={tickerRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <div onClick={() => setShowTicker(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: PRIMARY, borderBottom: `2.5px solid ${PRIMARY}55`, paddingBottom: 2, cursor: 'text', minWidth: 70 }}>
                <span style={{ fontSize: '0.65em', opacity: 0.85, fontFamily: 'monospace' }}>$</span>
                <input
                  value={tickerInput || (showTicker ? '' : ticker)}
                  onChange={e => { setTickerInput(e.target.value.toUpperCase()); setShowTicker(true); }}
                  onFocus={() => setShowTicker(true)}
                  placeholder={ticker}
                  style={{ background: 'transparent', border: 'none', outline: 'none', color: PRIMARY, fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 800, letterSpacing: 'inherit', width: `${Math.max(ticker.length, 3)}ch`, maxWidth: 140 }}
                />
              </div>
              {showTicker && (
                <div style={{ position: 'absolute', top: '115%', left: '50%', transform: 'translateX(-50%)', background: CARD, border: `1px solid ${BORDER}`, zIndex: 50, minWidth: 120, boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
                  {filteredTickers.map(s => (
                    <div key={s} onMouseDown={() => { setTicker(s); setTickerInput(''); setShowTicker(false); }}
                      style={{ padding: '9px 16px', fontFamily: 'monospace', fontSize: 13, color: FG, cursor: 'pointer', fontWeight: 600 }}
                      onMouseEnter={e => (e.currentTarget.style.background = MUTED_BG)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >{s}</div>
                  ))}
                </div>
              )}
            </div>

            <span style={{ color: MFG, fontSize: '0.68em', fontWeight: 400 }}>using</span>

            {/* Strategy */}
            <div ref={stratRef} style={{ position: 'relative', display: 'inline-flex' }}>
              <button onClick={() => setShowStrategy(!showStrategy)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', border: 'none', color: meta.sentimentColor, fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 800, letterSpacing: 'inherit', borderBottom: `2.5px solid ${meta.sentimentColor}55`, paddingBottom: 2, cursor: 'pointer', transition: 'color 0.25s, border-color 0.25s' }}>
                {strategy}
                <ChevronDown style={{ width: '0.38em', height: '0.38em', opacity: 0.65, transform: showStrategy ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
              </button>
              {showStrategy && (
                <div style={{ position: 'absolute', top: '115%', left: '50%', transform: 'translateX(-50%)', background: CARD, border: `1px solid ${BORDER}`, zIndex: 50, minWidth: 210, maxHeight: 270, overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
                  {STRATEGIES.map(s => (
                    <div key={s} onMouseDown={() => { setStrategy(s); setShowStrategy(false); }}
                      style={{ padding: '9px 16px', fontFamily: 'monospace', fontSize: 13, color: s === strategy ? PRIMARY : FG, background: s === strategy ? `${PRIMARY}15` : 'transparent', cursor: 'pointer' }}
                      onMouseEnter={e => { if (s !== strategy) e.currentTarget.style.background = MUTED_BG; }}
                      onMouseLeave={e => { if (s !== strategy) e.currentTarget.style.background = 'transparent'; }}
                    >{s}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Blinking cursor */}
            <span style={{ display: 'inline-block', width: '0.055em', height: '0.78em', background: meta.sentimentColor, marginLeft: 2, verticalAlign: 'middle', marginBottom: '0.06em', opacity: cursorOn ? 1 : 0, transition: 'opacity 0.07s, background 0.25s' }} />
          </div>
        </div>

        {/* ③ Live strategy description */}
        <p style={{ color: MFG, fontSize: 14, lineHeight: 1.65, margin: '0 0 20px', textAlign: 'center', maxWidth: 500, transition: 'all 0.2s' }}>
          <span style={{ color: meta.sentimentColor, fontWeight: 600, transition: 'color 0.25s' }}>{meta.sentiment}. </span>
          {meta.desc}. Real-time P/L charts, Black-Scholes Greeks, and breakeven analysis.
        </p>

        {/* ④ CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <button style={{ background: PRIMARY, color: BG, fontFamily: 'monospace', fontWeight: 800, fontSize: 13, letterSpacing: '0.08em', padding: '12px 34px', border: 'none', cursor: 'pointer', boxShadow: `0 0 28px ${PRIMARY}30`, transition: 'filter 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')}
            onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
          >
            BUILD STRATEGY →
          </button>
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: MFG, letterSpacing: '0.05em' }}>free · no account required · real-time data</span>
        </div>

        {/* ⑤ Live payoff chart panel */}
        <div style={{ width: '100%', border: `1px solid ${BORDER}`, background: CARD, boxShadow: `0 0 40px rgba(0,0,0,0.4), 0 0 20px ${meta.sentimentColor}08`, transition: 'box-shadow 0.35s' }}>

          {/* Chart chrome bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', borderBottom: `1px solid ${BORDER}`, background: MUTED_BG }}>
            <div style={{ display: 'flex', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171', opacity: 0.7 }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', opacity: 0.7 }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIMARY, opacity: 0.7 }} />
            </div>
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: MFG, letterSpacing: '0.08em' }}>
              {ticker} · {strategy} · P/L Payoff at Expiration
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: meta.sentimentColor, fontWeight: 700, letterSpacing: '0.1em' }}>{meta.sentiment.toUpperCase()}</span>
          </div>

          {/* Chart */}
          <div style={{ height: 130 }}>
            <PayoffChart strategy={strategy} color={meta.sentimentColor} />
          </div>

          {/* Metrics strip */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: `1px solid ${BORDER}` }}>
            {[
              { label: 'Breakeven', value: meta.bp, color: FG },
              { label: 'Max Profit', value: meta.mp, color: PRIMARY },
              { label: 'Max Loss',   value: meta.ml, color: RED },
            ].map(({ label, value, color }, i) => (
              <div key={label} style={{ padding: '10px 16px', borderLeft: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 8, color: MFG, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ⑥ Stat strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginTop: 18 }}>
          {[
            { num: '30+', label: 'strategies' },
            { num: '6', label: 'greeks' },
            { num: 'Live', label: 'chain data' },
            { num: 'Free', label: 'to start' },
          ].map(({ num, label }, i) => (
            <React.Fragment key={label}>
              {i > 0 && <div style={{ width: 1, height: 20, background: BORDER }} />}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 800, color: FG }}>{num}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 8, color: MFG, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
              </div>
            </React.Fragment>
          ))}
        </div>

      </div>
    </section>
  );
}
