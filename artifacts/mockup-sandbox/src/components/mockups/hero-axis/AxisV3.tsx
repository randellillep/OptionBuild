import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, ArrowRight } from 'lucide-react';

// AXIS V3 — Causal Split: Before → After
// Left half: the dark, waiting form (the setup)
// Right half: the illuminated, alive result (the payoff chart)
// Visual language: cause and effect. Left is inactive, right is active.
// The chart on the right responds to what you pick on the left.
// Neither half works without the other — that's the point.

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

const METRICS: Record<string, { bp: string; mp: string; ml: string; sentiment: string; color: string }> = {
  'Long Call':         { bp: 'Strike + Premium', mp: 'Unlimited', ml: 'Premium', sentiment: 'Bullish', color: PRIMARY },
  'Long Put':          { bp: 'Strike − Premium', mp: 'Strike − Prem', ml: 'Premium', sentiment: 'Bearish', color: RED },
  'Bull Call Spread':  { bp: 'Lower + Net Debit', mp: 'Spread − Debit', ml: 'Net Debit', sentiment: 'Bullish', color: PRIMARY },
  'Bear Put Spread':   { bp: 'Upper − Net Debit', mp: 'Spread − Debit', ml: 'Net Debit', sentiment: 'Bearish', color: RED },
  'Iron Condor':       { bp: 'Two points (±)', mp: 'Net Credit', ml: 'Spread − Credit', sentiment: 'Neutral', color: '#60a5fa' },
  'Iron Butterfly':    { bp: 'Two points (±)', mp: 'Net Credit', ml: 'Spread − Credit', sentiment: 'Neutral', color: '#60a5fa' },
  'Long Straddle':     { bp: '± Net Debit', mp: 'Unlimited', ml: 'Both Premiums', sentiment: 'Volatile', color: '#a78bfa' },
  'Long Strangle':     { bp: '± Net Debit', mp: 'Unlimited', ml: 'Net Debit', sentiment: 'Volatile', color: '#a78bfa' },
  'Covered Call':      { bp: 'Stock − Premium', mp: 'Capped at Strike', ml: 'Stock − Premium', sentiment: 'Bullish', color: PRIMARY },
  'Protective Put':    { bp: 'Stock + Premium', mp: 'Unlimited', ml: 'Put Premium', sentiment: 'Hedged', color: '#60a5fa' },
  'Cash-Secured Put':  { bp: 'Strike − Premium', mp: 'Premium Received', ml: 'Strike − Premium', sentiment: 'Bullish', color: PRIMARY },
  'Collar':            { bp: 'Stock Cost', mp: 'Call − Stock Cost', ml: 'Stock − Put', sentiment: 'Neutral', color: '#60a5fa' },
};

function LiveChart({ strategy, ticker }: { strategy: string; ticker: string }) {
  const W = 360, H = 170;
  const pts = PAYOFFS[strategy] ?? PAYOFFS['Iron Condor'];
  const svgPts = pts.map(([x, y]): [number, number] => [x * W, (1 - y) * H]);
  const linePath = svgPts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const fillPath = linePath + ` L${W},${H} L0,${H} Z`;
  const breakevenY = H * 0.5;
  const m = METRICS[strategy] ?? METRICS['Iron Condor'];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: FG }}>{ticker}</div>
          <div style={{ fontFamily: 'monospace', fontSize: 10, color: m.color, fontWeight: 700, letterSpacing: '0.08em' }}>{m.sentiment.toUpperCase()}</div>
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: MFG, textAlign: 'right' }}>
          <div style={{ color: FG, fontWeight: 600 }}>{strategy}</div>
          <div style={{ fontSize: 10, opacity: 0.6 }}>P/L Payoff</div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ flex: 1, marginBottom: 16 }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none">
          <defs>
            <linearGradient id="splitFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PRIMARY} stopOpacity="0.22" />
              <stop offset="44%" stopColor={PRIMARY} stopOpacity="0.07" />
              <stop offset="56%" stopColor={RED} stopOpacity="0.07" />
              <stop offset="100%" stopColor={RED} stopOpacity="0.22" />
            </linearGradient>
          </defs>

          {/* Grid */}
          {[0.25, 0.5, 0.75].map(x => <line key={x} x1={x * W} y1={0} x2={x * W} y2={H} stroke={BORDER} strokeWidth="1" />)}
          {[0.3, 0.7].map(y => <line key={y} x1={0} y1={y * H} x2={W} y2={y * H} stroke={BORDER} strokeWidth="1" />)}

          {/* Breakeven */}
          <line x1={0} y1={breakevenY} x2={W} y2={breakevenY} stroke={MFG} strokeWidth="1" strokeDasharray="4,3" strokeOpacity="0.5" />

          {/* Fill + line */}
          <path d={fillPath} fill="url(#splitFill)" />
          <path d={linePath} fill="none" stroke={m.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

          <text x="6" y="12" fontSize="8" fill={MFG} fontFamily="monospace" opacity="0.6">PROFIT</text>
          <text x="6" y={H - 4} fontSize="8" fill={MFG} fontFamily="monospace" opacity="0.6">LOSS</text>
          <text x={W / 2 - 16} y={breakevenY - 4} fontSize="8" fill={MFG} fontFamily="monospace" opacity="0.5">B/E</text>
        </svg>
      </div>

      {/* Metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
        {[
          { l: 'Breakeven', v: m.bp, c: FG },
          { l: 'Max Profit', v: m.mp, c: PRIMARY },
          { l: 'Max Loss', v: m.ml, c: RED },
        ].map(({ l, v, c }, i) => (
          <div key={l} style={{ paddingLeft: i > 0 ? 12 : 0, borderLeft: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 8, color: MFG, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 3 }}>{l}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: c, fontWeight: 700, lineHeight: 1.3 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AxisV3() {
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

  const filtered = tickerInput ? TICKERS.filter(t => t.startsWith(tickerInput)) : TICKERS;

  return (
    <section style={{ background: BG, minHeight: 560, fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '52px 32px', position: 'relative', overflow: 'hidden' }}>

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.055,
        backgroundImage: `linear-gradient(to right, ${FG} 1px, transparent 1px), linear-gradient(to bottom, ${FG} 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
      }} />

      {/* Right-leaning glow for the output side */}
      <div style={{ position: 'absolute', top: '50%', right: '15%', transform: 'translateY(-50%)', width: 500, height: 400, borderRadius: '50%', pointerEvents: 'none', background: `radial-gradient(ellipse at center, ${PRIMARY}18 0%, transparent 60%)`, filter: 'blur(20px)' }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 920, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Label row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 9, color: MFG, letterSpacing: '0.15em', textTransform: 'uppercase', paddingLeft: 2 }}>01 — Configure</div>
          <div style={{ fontFamily: 'monospace', fontSize: 9, color: PRIMARY, letterSpacing: '0.15em', textTransform: 'uppercase', paddingLeft: 24 }}>02 — Analyze</div>
        </div>

        {/* Split panel */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', border: `1px solid ${BORDER}`, background: CARD, boxShadow: `0 0 60px rgba(0,0,0,0.5)` }}>

          {/* LEFT — form (dim, waiting) */}
          <div style={{ padding: '28px 28px', opacity: 0.9 }}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: FG, margin: '0 0 6px', lineHeight: 1.1 }}>
                Build & Visualize<br />
                <span style={{ color: PRIMARY }}>Options Strategies</span>
                <span style={{ display: 'inline-block', width: 2, height: '0.75em', background: PRIMARY, marginLeft: 5, verticalAlign: 'middle', marginBottom: 2, opacity: cursorOn ? 1 : 0, transition: 'opacity 0.07s' }} />
              </h2>
              <p style={{ fontFamily: 'monospace', fontSize: 10, color: MFG, margin: 0, lineHeight: 1.6 }}>
                Select a symbol and strategy — <br />see your payoff live on the right.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Ticker */}
              <div ref={tickerRef} style={{ position: 'relative' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'monospace', fontSize: 9, color: MFG, marginBottom: 6, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  <Search style={{ width: 9, height: 9, color: PRIMARY }} />
                  Underlying Symbol
                </label>
                <div onClick={() => setShowTicker(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${showTicker ? PRIMARY + '80' : BORDER}`, background: BG, padding: '0 12px', cursor: 'text', transition: 'border-color 0.15s' }}>
                  <span style={{ color: PRIMARY, fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>$</span>
                  <input
                    value={tickerInput || (showTicker ? '' : ticker)}
                    onChange={e => { setTickerInput(e.target.value.toUpperCase()); setShowTicker(true); }}
                    onFocus={() => setShowTicker(true)}
                    placeholder={ticker}
                    style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: FG, fontFamily: 'monospace', fontSize: 13, padding: '10px 0' }}
                  />
                </div>
                {showTicker && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: CARD, border: `1px solid ${BORDER}`, zIndex: 50, marginTop: 1 }}>
                    {filtered.map(s => (
                      <div key={s} onMouseDown={() => { setTicker(s); setTickerInput(''); setShowTicker(false); }}
                        style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: FG, cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = MUTED_BG)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >{s}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Strategy */}
              <div ref={stratRef} style={{ position: 'relative' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'monospace', fontSize: 9, color: MFG, marginBottom: 6, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Strategy Type
                </label>
                <button onClick={() => setShowStrategy(!showStrategy)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${showStrategy ? PRIMARY + '80' : BORDER}`, background: BG, padding: '10px 12px', color: FG, fontFamily: 'monospace', fontSize: 13, cursor: 'pointer', transition: 'border-color 0.15s' }}>
                  <span>{strategy}</span>
                  <ChevronDown style={{ width: 13, height: 13, color: MFG, transform: showStrategy ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {showStrategy && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: CARD, border: `1px solid ${BORDER}`, zIndex: 50, marginTop: 1, maxHeight: 200, overflowY: 'auto' }}>
                    {STRATEGIES.map(s => (
                      <div key={s} onMouseDown={() => { setStrategy(s); setShowStrategy(false); }}
                        style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: s === strategy ? PRIMARY : FG, background: s === strategy ? `${PRIMARY}15` : 'transparent', cursor: 'pointer' }}
                        onMouseEnter={e => { if (s !== strategy) e.currentTarget.style.background = MUTED_BG; }}
                        onMouseLeave={e => { if (s !== strategy) e.currentTarget.style.background = 'transparent'; }}
                      >{s}</div>
                    ))}
                  </div>
                )}
              </div>

              <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: PRIMARY, color: BG, fontFamily: 'monospace', fontWeight: 800, fontSize: 12, letterSpacing: '0.06em', padding: '11px 20px', border: 'none', cursor: 'pointer', boxShadow: `0 0 20px ${PRIMARY}35`, transition: 'filter 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')}
                onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
              >
                BUILD FULL STRATEGY
                <ArrowRight style={{ width: 13, height: 13 }} />
              </button>
            </div>
          </div>

          {/* Divider with arrow */}
          <div style={{ background: BORDER, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', width: 24, height: 24, borderRadius: '50%', background: CARD, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
              <ArrowRight style={{ width: 10, height: 10, color: PRIMARY }} />
            </div>
          </div>

          {/* RIGHT — live output (lit up) */}
          <div style={{ padding: '28px 28px', background: `${PRIMARY}04`, position: 'relative' }}>
            <LiveChart strategy={strategy} ticker={ticker} />
          </div>
        </div>

        {/* Footer label */}
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: MFG, letterSpacing: '0.05em' }}>
            Black-Scholes · Live chain data · Greeks engine · 30+ templates · Free to start
          </span>
        </div>
      </div>
    </section>
  );
}
