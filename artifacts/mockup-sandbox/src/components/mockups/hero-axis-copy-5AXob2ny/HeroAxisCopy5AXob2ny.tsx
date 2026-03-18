import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

// AXIS V2 — Inline Sentence Form
// The form fields live INSIDE the headline sentence.
// No terminal chrome. No window frame. No box.
// The form IS the headline. Radically different from every variant so far.
// Precedent: Superhuman's "built for ___" interactive hero, Linear's editorial landing.

const PRIMARY = '#1abd9c';
const BG = '#040b18';
const CARD = '#070e1b';
const BORDER = '#162035';
const MFG = '#525e6e';
const FG = '#f0f5fa';
const MUTED_BG = '#0a1428';

const STRATEGIES = [
  'Long Call', 'Long Put', 'Bull Call Spread', 'Bear Put Spread',
  'Iron Condor', 'Iron Butterfly', 'Long Straddle', 'Long Strangle',
  'Covered Call', 'Protective Put', 'Cash-Secured Put', 'Collar',
];
const TICKERS = ['AAPL', 'TSLA', 'NVDA', 'SPY', 'MSFT', 'QQQ', 'AMZN', 'META'];

const STRATEGY_META: Record<string, { sentiment: string; desc: string }> = {
  'Long Call':         { sentiment: 'bullish', desc: 'Profit if price rises above strike' },
  'Long Put':          { sentiment: 'bearish', desc: 'Profit if price falls below strike' },
  'Bull Call Spread':  { sentiment: 'bullish', desc: 'Defined risk bullish play' },
  'Bear Put Spread':   { sentiment: 'bearish', desc: 'Defined risk bearish play' },
  'Iron Condor':       { sentiment: 'neutral', desc: 'Profit if price stays in range' },
  'Iron Butterfly':    { sentiment: 'neutral', desc: 'Profit near current price at expiry' },
  'Long Straddle':     { sentiment: 'volatile', desc: 'Profit from large move either way' },
  'Long Strangle':     { sentiment: 'volatile', desc: 'Cheaper straddle, wider breakevens' },
  'Covered Call':      { sentiment: 'bullish', desc: 'Income on stock you own' },
  'Protective Put':    { sentiment: 'bullish', desc: 'Insurance for existing stock position' },
  'Cash-Secured Put':  { sentiment: 'bullish', desc: 'Get paid to buy stock at a discount' },
  'Collar':            { sentiment: 'neutral', desc: 'Cap losses and gains with options' },
};

function sentimentColor(s: string) {
  if (s === 'bullish') return PRIMARY;
  if (s === 'bearish') return '#f87171';
  if (s === 'volatile') return '#a78bfa';
  return '#60a5fa';
}

export function HeroAxisCopy5AXob2ny() {
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
  const color = sentimentColor(meta.sentiment);

  return (
    <section style={{
      background: BG, minHeight: 560,
      fontFamily: "'Inter', system-ui, sans-serif",
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '64px 32px', position: 'relative', overflow: 'hidden',
    }}>

      {/* Very subtle grid */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.04,
        backgroundImage: `linear-gradient(to right, ${FG} 1px, transparent 1px), linear-gradient(to bottom, ${FG} 1px, transparent 1px)`,
        backgroundSize: '64px 64px',
      }} />

      {/* Gentle glow */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 300, borderRadius: '50%', pointerEvents: 'none', background: `radial-gradient(ellipse at center, ${PRIMARY}15 0%, transparent 65%)` }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 780, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>

        {/* The sentence headline */}
        <div style={{ textAlign: 'center', lineHeight: 1.2 }}>

          <div style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.4rem)', fontWeight: 800, color: MFG, letterSpacing: '-0.02em', marginBottom: 12 }}>
            Analyze
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '12px 10px', fontSize: 'clamp(2rem, 5vw, 3.6rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>

            {/* Ticker inline input */}
            <div ref={tickerRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <div
                onClick={() => setShowTicker(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  color: PRIMARY,
                  borderBottom: `2px solid ${PRIMARY}60`,
                  paddingBottom: 2,
                  cursor: 'text',
                  minWidth: 80,
                }}
              >
                <span style={{ fontSize: '0.7em', opacity: 0.8 }}>$</span>
                <input
                  value={tickerInput || (showTicker ? '' : ticker)}
                  onChange={e => { setTickerInput(e.target.value.toUpperCase()); setShowTicker(true); }}
                  onFocus={() => setShowTicker(true)}
                  placeholder={ticker}
                  style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    color: PRIMARY, fontFamily: 'inherit', fontSize: 'inherit',
                    fontWeight: 800, letterSpacing: 'inherit', width: '3ch',
                    minWidth: 60, maxWidth: 140,
                  }}
                />
              </div>
              {showTicker && (
                <div style={{ position: 'absolute', top: '110%', left: '50%', transform: 'translateX(-50%)', background: CARD, border: `1px solid ${BORDER}`, zIndex: 50, minWidth: 120, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  {filteredTickers.map(s => (
                    <div key={s} onMouseDown={() => { setTicker(s); setTickerInput(''); setShowTicker(false); }}
                      style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 14, color: FG, cursor: 'pointer', fontWeight: 600 }}
                      onMouseEnter={e => (e.currentTarget.style.background = MUTED_BG)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >{s}</div>
                  ))}
                </div>
              )}
            </div>

            <span style={{ color: MFG, fontSize: '0.7em', fontWeight: 400 }}>using</span>

            {/* Strategy inline dropdown */}
            <div ref={stratRef} style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                onClick={() => setShowStrategy(!showStrategy)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'transparent', border: 'none',
                  color, fontFamily: 'inherit', fontSize: 'inherit',
                  fontWeight: 800, letterSpacing: 'inherit',
                  borderBottom: `2px solid ${color}60`,
                  paddingBottom: 2, cursor: 'pointer',
                }}
              >
                {strategy}
                <ChevronDown style={{ width: '0.4em', height: '0.4em', opacity: 0.7, transform: showStrategy ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>
              {showStrategy && (
                <div style={{ position: 'absolute', top: '110%', left: '50%', transform: 'translateX(-50%)', background: CARD, border: `1px solid ${BORDER}`, zIndex: 50, minWidth: 200, maxHeight: 280, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
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

            {/* Cursor */}
            <span style={{ display: 'inline-block', width: '0.06em', height: '0.8em', background: color, marginLeft: 4, verticalAlign: 'middle', marginBottom: '0.05em', opacity: cursorOn ? 1 : 0, transition: 'opacity 0.07s' }} />
          </div>
        </div>

        {/* Strategy description — updates live */}
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <p style={{ color: MFG, fontSize: 15, lineHeight: 1.6, margin: 0 }}>
            <span style={{ color, fontWeight: 600 }}>{meta.sentiment.charAt(0).toUpperCase() + meta.sentiment.slice(1)}. </span>
            {meta.desc}. Real-time P/L charts, Greeks, and breakeven analysis.
          </p>
        </div>

        {/* CTA — minimal, typographic */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <button style={{
            background: PRIMARY, color: BG, fontFamily: 'monospace', fontWeight: 800,
            fontSize: 14, letterSpacing: '0.08em', padding: '13px 36px',
            border: 'none', cursor: 'pointer',
            boxShadow: `0 0 30px ${PRIMARY}35`,
            transition: 'filter 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')}
            onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
          >
            BUILD STRATEGY →
          </button>
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: MFG, letterSpacing: '0.05em' }}>
            free · no account required · real-time data
          </span>
        </div>

        {/* Stats — minimal inline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, marginTop: 8 }}>
          {[
            { num: '30+', label: 'strategies' },
            { num: '6', label: 'greeks computed' },
            { num: '<50ms', label: 'chart render' },
          ].map(({ num, label }, i) => (
            <React.Fragment key={label}>
              {i > 0 && <div style={{ width: 1, height: 24, background: BORDER }} />}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: FG }}>{num}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: MFG, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
