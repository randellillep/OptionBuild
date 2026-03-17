import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, TrendingUp, Calculator, BookOpen, ArrowRight, GitBranch, CheckCircle2 } from 'lucide-react';

// Polish 2: Split layout — copy left, terminal right
// Left: breadcrumb, headline+cursor, description, three feature bullets
// Right: terminal panel that shows staggered output then the form
// Different structural feel from centered — more editorial, less "card on a page"

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

const OUTPUT_LINES = [
  { text: 'Connecting to market feed...', done: false },
  { text: '✓ AAPL chain loaded (1,240 contracts)', done: true },
  { text: '✓ Greeks engine ready · IV surface built', done: true },
];

export function Polish2() {
  const [ticker, setTicker] = useState('AAPL');
  const [tickerInput, setTickerInput] = useState('');
  const [showTicker, setShowTicker] = useState(false);
  const [strategy, setStrategy] = useState('Iron Condor');
  const [showStrategy, setShowStrategy] = useState(false);
  const [cursorOn, setCursorOn] = useState(true);
  const [visibleLines, setVisibleLines] = useState(0);
  const tickerRef = useRef<HTMLDivElement>(null);
  const stratRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setCursorOn(v => !v), 530);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    [350, 900, 1550].forEach((d, i) =>
      setTimeout(() => setVisibleLines(i + 1), d)
    );
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

  const features = [
    { icon: TrendingUp, label: 'Real-time P/L heatmaps across price & time', color: PRIMARY },
    { icon: Calculator, label: 'Δ Γ Θ V ρ — all Greeks computed live', color: '#60a5fa' },
    { icon: BookOpen, label: '30+ pre-built strategy templates', color: '#a78bfa' },
  ];

  return (
    <section style={{ background: BG, minHeight: 560, fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'stretch', position: 'relative', overflow: 'hidden' }}>

      {/* Grid */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.065,
        backgroundImage: `linear-gradient(to right, ${FG} 1px, transparent 1px), linear-gradient(to bottom, ${FG} 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse 100% 100% at 60% 50%, black 10%, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(ellipse 100% 100% at 60% 50%, black 10%, transparent 70%)',
      }} />

      {/* Glow — right-leaning */}
      <div style={{ position: 'absolute', top: '50%', left: '58%', transform: 'translate(-50%, -50%)',
        width: 600, height: 400, borderRadius: '50%', pointerEvents: 'none',
        background: `radial-gradient(ellipse at center, ${PRIMARY}2a 0%, transparent 65%)`,
        filter: 'blur(30px)',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, padding: '72px 40px', alignItems: 'center' }}>

        {/* LEFT — copy */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'monospace' }}>
            <GitBranch style={{ width: 11, height: 11, color: MFG }} />
            <span style={{ fontSize: 10, color: MFG }}>options</span>
            <span style={{ fontSize: 10, color: BORDER }}>／</span>
            <span style={{ fontSize: 10, color: MFG }}>strategy</span>
            <span style={{ fontSize: 10, color: BORDER }}>／</span>
            <span style={{ fontSize: 10, color: PRIMARY, fontWeight: 700 }}>build</span>
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.75rem)', fontWeight: 800, color: FG, lineHeight: 1.1, margin: 0, letterSpacing: '-0.025em' }}>
            Build & Visualize<br />
            <span style={{ color: PRIMARY }}>Options Strategies</span>
            <span style={{ display: 'inline-block', width: 3, height: '0.75em', background: PRIMARY, marginLeft: 6, verticalAlign: 'middle', marginBottom: 3, opacity: cursorOn ? 1 : 0, transition: 'opacity 0.07s' }} />
          </h1>

          <p style={{ color: MFG, fontSize: 14, lineHeight: 1.7, margin: 0, maxWidth: 380 }}>
            Professional options analysis with real-time P/L charts, Greeks calculator, and strategy templates. Free to start.
          </p>

          {/* Feature bullets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            {features.map(({ icon: Icon, label, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ marginTop: 2, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon style={{ width: 14, height: 14, color }} />
                </div>
                <span style={{ fontSize: 13, color: MFG, lineHeight: 1.5 }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Ghost CTA — secondary link */}
          <div style={{ marginTop: 8 }}>
            <button
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: MFG, fontSize: 12, fontFamily: 'monospace', cursor: 'pointer', padding: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = FG)}
              onMouseLeave={e => (e.currentTarget.style.color = MFG)}
            >
              View strategy templates
              <ArrowRight style={{ width: 12, height: 12 }} />
            </button>
          </div>
        </div>

        {/* RIGHT — terminal */}
        <div style={{ width: '100%', border: `1px solid ${BORDER}`, background: CARD, boxShadow: `0 0 60px rgba(0,0,0,0.5), 0 0 20px ${PRIMARY}0a` }}>

          {/* Chrome */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderBottom: `1px solid ${BORDER}`, background: MUTED_BG }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f87171', opacity: 0.8 }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fbbf24', opacity: 0.8 }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: PRIMARY, opacity: 0.8 }} />
            </div>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: MFG, flex: 1, textAlign: 'center', userSelect: 'none' }}>
              optionbuild — strategy/builder
            </span>
          </div>

          {/* Prompt + staggered output */}
          <div style={{ padding: '14px 20px 0', fontFamily: 'monospace', fontSize: 11, borderBottom: `1px solid ${BORDER}40` }}>
            <div style={{ marginBottom: 6, color: FG }}>
              <span style={{ color: MFG }}>user@optionbuild</span>
              <span style={{ color: MFG }}>:</span>
              <span style={{ color: '#60a5fa' }}>~/strategies</span>
              <span style={{ color: MFG }}>$ </span>
              <span style={{ opacity: 0.85 }}>build --interactive --symbol=AAPL</span>
            </div>
            <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {OUTPUT_LINES.map((line, i) => (
                <div key={i} style={{
                  color: line.done ? PRIMARY : MFG,
                  opacity: i < visibleLines ? 0.85 : 0,
                  transition: 'opacity 0.3s ease',
                  fontSize: 10,
                }}>
                  {line.text}
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Ticker */}
            <div ref={tickerRef} style={{ position: 'relative' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'monospace', fontSize: 10, color: MFG, marginBottom: 6, letterSpacing: '0.05em' }}>
                <Search style={{ width: 10, height: 10, color: PRIMARY }} />
                Underlying
              </label>
              <div
                onClick={() => setShowTicker(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${showTicker ? PRIMARY + '99' : BORDER}`, background: BG, padding: '0 12px', cursor: 'text', transition: 'border-color 0.15s' }}
              >
                <span style={{ color: PRIMARY, fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>$</span>
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
                      style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 13, color: FG, cursor: 'pointer' }}
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
                Strategy
              </label>
              <button
                onClick={() => setShowStrategy(!showStrategy)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${showStrategy ? PRIMARY + '99' : BORDER}`, background: BG, padding: '10px 12px', color: FG, fontFamily: 'monospace', fontSize: 13, cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}
              >
                <span>{strategy}</span>
                <ChevronDown style={{ width: 14, height: 14, color: MFG, transform: showStrategy ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {showStrategy && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: CARD, border: `1px solid ${BORDER}`, zIndex: 50, marginTop: 1, maxHeight: 200, overflowY: 'auto' }}>
                  {STRATEGIES.map(s => (
                    <div key={s} onMouseDown={() => { setStrategy(s); setShowStrategy(false); }}
                      style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 13, color: s === strategy ? PRIMARY : FG, background: s === strategy ? `${PRIMARY}15` : 'transparent', cursor: 'pointer' }}
                      onMouseEnter={e => { if (s !== strategy) e.currentTarget.style.background = MUTED_BG; }}
                      onMouseLeave={e => { if (s !== strategy) e.currentTarget.style.background = 'transparent'; }}
                    >{s}</div>
                  ))}
                </div>
              )}
            </div>

            {/* CTA */}
            <button
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: PRIMARY, color: '#040b18', fontFamily: 'monospace', fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', padding: '11px 20px', border: 'none', cursor: 'pointer', boxShadow: `0 0 24px ${PRIMARY}40` }}
              onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.08)')}
              onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
            >
              BUILD STRATEGY
              <ArrowRight style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
