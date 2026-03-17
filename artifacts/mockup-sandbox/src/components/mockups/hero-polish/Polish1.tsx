import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, TrendingUp, Calculator, BookOpen, Play, GitBranch, Wifi } from 'lucide-react';

// Polish 1: Centered — same layout, sharper details
// Changes vs current:
//   · Chrome gets a live "CONNECTED" status badge top-right
//   · Prompt section adds a single green output line under the command
//   · Form field labels are inline with a separator glyph › instead of uppercase
//   · Feature section is a bordered three-cell strip instead of floating pills
//   · Glow is larger and more visible
//   · Panel width extended to max-w-xl for more breathing room
//   · Headline is a single tighter line

const PRIMARY = '#1abd9c';
const BG = '#040b18';
const CARD = '#070e1b';
const BORDER = '#162035';
const MFG = '#525e6e';
const FG = '#f0f5fa';
const MUTED_BG = '#0a1428';

const STRATEGIES = [
  'Long Call','Long Put','Bull Call Spread','Bear Put Spread',
  'Iron Condor','Iron Butterfly','Long Straddle','Long Strangle',
  'Covered Call','Protective Put','Cash-Secured Put','Collar',
];

const TICKERS = ['AAPL','TSLA','NVDA','SPY','MSFT','QQQ','AMZN','META'];

export function Polish1() {
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

  const filtered = tickerInput
    ? TICKERS.filter(t => t.startsWith(tickerInput))
    : TICKERS;

  return (
    <section style={{ background: BG, minHeight: 540, fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '72px 24px', position: 'relative', overflow: 'hidden' }}>

      {/* Grid */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.07,
        backgroundImage: `linear-gradient(to right, ${FG} 1px, transparent 1px), linear-gradient(to bottom, ${FG} 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse 90% 80% at 50% 50%, black 15%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse 90% 80% at 50% 50%, black 15%, transparent 75%)',
      }} />

      {/* Glow — more prominent */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 700, height: 350, borderRadius: '50%', pointerEvents: 'none',
        background: `radial-gradient(ellipse at center, ${PRIMARY}33 0%, transparent 65%)`,
        filter: 'blur(20px)',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 580, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'monospace' }}>
          <GitBranch style={{ width: 12, height: 12, color: MFG }} />
          <span style={{ fontSize: 10, color: MFG }}>options</span>
          <span style={{ fontSize: 10, color: BORDER }}>／</span>
          <span style={{ fontSize: 10, color: MFG }}>strategy</span>
          <span style={{ fontSize: 10, color: BORDER }}>／</span>
          <span style={{ fontSize: 10, color: PRIMARY, fontWeight: 700 }}>build</span>
        </div>

        {/* Headline — single tighter line */}
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 800, color: FG, textAlign: 'center', lineHeight: 1.1, margin: 0, letterSpacing: '-0.02em' }}>
          Architect Options Strategies{' '}
          <span style={{ color: PRIMARY }}>Precisely</span>
          <span style={{ display: 'inline-block', width: 3, height: '0.8em', background: PRIMARY, marginLeft: 6, verticalAlign: 'middle', marginBottom: 4, opacity: cursorOn ? 1 : 0, transition: 'opacity 0.07s' }} />
        </h1>

        <p style={{ color: MFG, textAlign: 'center', maxWidth: 440, lineHeight: 1.6, fontSize: 14, margin: 0 }}>
          Real-time P/L charts, Black-Scholes Greeks, and 30+ strategy templates. Free to start.
        </p>

        {/* Terminal panel */}
        <div style={{ width: '100%', border: `1px solid ${BORDER}`, background: CARD, boxShadow: `0 0 60px rgba(0,0,0,0.5), 0 0 30px ${PRIMARY}0d` }}>

          {/* Chrome — with live badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, background: MUTED_BG }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f87171', opacity: 0.8 }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fbbf24', opacity: 0.8 }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: PRIMARY, opacity: 0.8 }} />
            </div>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: MFG, flex: 1, textAlign: 'center', userSelect: 'none' }}>
              optionbuild — strategy/builder
            </span>
            {/* Connected badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', border: `1px solid ${PRIMARY}40`, background: `${PRIMARY}10` }}>
              <Wifi style={{ width: 9, height: 9, color: PRIMARY }} />
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: PRIMARY, fontWeight: 700, letterSpacing: '0.1em' }}>LIVE</span>
            </div>
          </div>

          {/* Prompt + output */}
          <div style={{ padding: '14px 20px 0', fontFamily: 'monospace', fontSize: 11, borderBottom: `1px solid ${BORDER}40` }}>
            <div style={{ marginBottom: 4, opacity: 0.45, color: FG }}>
              <span style={{ color: MFG }}>user@optionbuild</span>
              <span style={{ color: MFG }}>:~/strategies$ </span>
              <span>build --interactive</span>
            </div>
            {/* Output line */}
            <div style={{ color: PRIMARY, opacity: 0.8, marginBottom: 12 }}>
              ✓ strategy engine ready · chain data loaded · awaiting input_
            </div>
          </div>

          {/* Form */}
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Ticker */}
            <div ref={tickerRef} style={{ position: 'relative' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'monospace', fontSize: 10, color: MFG, marginBottom: 6, letterSpacing: '0.05em' }}>
                <span style={{ color: PRIMARY }}>›</span> underlying
              </label>
              <div
                onClick={() => setShowTicker(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${showTicker ? PRIMARY + '99' : BORDER}`, background: BG, padding: '0 12px', cursor: 'text', transition: 'border-color 0.15s' }}
              >
                <span style={{ color: PRIMARY, fontFamily: 'monospace', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>$</span>
                <input
                  type="text"
                  value={tickerInput || (showTicker ? '' : ticker)}
                  onChange={e => { setTickerInput(e.target.value.toUpperCase()); setShowTicker(true); }}
                  onFocus={() => setShowTicker(true)}
                  placeholder={ticker}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: FG, fontFamily: 'monospace', fontSize: 13, padding: '10px 0' }}
                />
              </div>
              {showTicker && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: CARD, border: `1px solid ${BORDER}`, zIndex: 50, marginTop: 1 }}>
                  {filtered.map(sym => (
                    <div key={sym} onMouseDown={() => { setTicker(sym); setTickerInput(''); setShowTicker(false); }}
                      style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 13, color: FG, cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = MUTED_BG)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >{sym}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Strategy */}
            <div ref={stratRef} style={{ position: 'relative' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'monospace', fontSize: 10, color: MFG, marginBottom: 6, letterSpacing: '0.05em' }}>
                <span style={{ color: PRIMARY }}>›</span> strategy
              </label>
              <button
                onClick={() => setShowStrategy(!showStrategy)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${showStrategy ? PRIMARY + '99' : BORDER}`, background: BG, padding: '10px 12px', color: FG, fontFamily: 'monospace', fontSize: 13, cursor: 'pointer', transition: 'border-color 0.15s', textAlign: 'left' }}
              >
                <span>{strategy}</span>
                <ChevronDown style={{ width: 14, height: 14, color: MFG, transform: showStrategy ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {showStrategy && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: CARD, border: `1px solid ${BORDER}`, zIndex: 50, marginTop: 1, maxHeight: 200, overflowY: 'auto' }}>
                  {STRATEGIES.map(s => (
                    <div key={s} onMouseDown={() => { setStrategy(s); setShowStrategy(false); }}
                      style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 13, color: s === strategy ? PRIMARY : FG, background: s === strategy ? `${PRIMARY}15` : 'transparent', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => { if (s !== strategy) e.currentTarget.style.background = MUTED_BG; }}
                      onMouseLeave={e => { if (s !== strategy) e.currentTarget.style.background = 'transparent'; }}
                    >{s}</div>
                  ))}
                </div>
              )}
            </div>

            {/* CTA */}
            <button
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: PRIMARY, color: '#040b18', fontFamily: 'monospace', fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', padding: '11px 20px', border: 'none', cursor: 'pointer', boxShadow: `0 0 24px ${PRIMARY}40`, transition: 'box-shadow 0.2s, filter 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1)'; }}
            >
              BUILD STRATEGY
              <Play style={{ width: 12, height: 12, fill: '#040b18', strokeWidth: 0 }} />
            </button>
          </div>
        </div>

        {/* Feature strip — bordered cells */}
        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', border: `1px solid ${BORDER}`, background: MUTED_BG }}>
          {[
            { icon: TrendingUp, label: 'Real-time P/L Charts', color: PRIMARY },
            { icon: Calculator, label: 'Greeks Analysis', color: '#60a5fa' },
            { icon: BookOpen, label: '30+ Strategy Templates', color: '#a78bfa' },
          ].map(({ icon: Icon, label, color }, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderLeft: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
              <Icon style={{ width: 13, height: 13, color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: MFG, fontFamily: 'monospace', lineHeight: 1.3 }}>{label}</span>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
