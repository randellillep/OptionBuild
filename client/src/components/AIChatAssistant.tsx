import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, User, Sparkles, TrendingUp, TrendingDown, HelpCircle, Lightbulb } from "lucide-react";
import type { OptionLeg } from "@shared/schema";
import type { SymbolInfo } from "@/hooks/useStrategyEngine";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface StrategyGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

interface StrategyContext {
  symbolInfo: SymbolInfo | null;
  legs: OptionLeg[];
  volatility: number;
  expirationDays: number;
  currentPrice?: number;
  greeks?: StrategyGreeks;
}

interface AIChatAssistantProps {
  onNavigate?: (page: string) => void;
  strategyContext?: StrategyContext;
  onLookupPrice?: (symbol: string, strike: number, type: 'call' | 'put', expiration?: string) => Promise<{ bid: number; ask: number; mid: number } | null>;
}

// Comprehensive options education database
const optionsEducation: Record<string, string> = {
  // Basic concepts
  "call option": "A **call option** gives you the right (not obligation) to BUY 100 shares at the strike price before expiration. You profit when the stock rises above your strike + premium paid. Calls are bullish bets.",
  "put option": "A **put option** gives you the right (not obligation) to SELL 100 shares at the strike price before expiration. You profit when the stock falls below your strike - premium paid. Puts are bearish bets or hedges.",
  "strike price": "The **strike price** is the price at which you can buy (call) or sell (put) the underlying stock. For calls, lower strikes are more expensive. For puts, higher strikes cost more.",
  "expiration": "**Expiration date** is when the option contract ends. After expiration, the option becomes worthless if out-of-the-money. Time value decays faster as expiration approaches (theta decay).",
  "premium": "The **premium** is the price you pay to buy an option (or receive when selling). It's made up of intrinsic value (real value) + time value (speculation). Premium is quoted per share, but you pay 100x for one contract.",
  "contract": "One options **contract** represents 100 shares of the underlying stock. If a call costs $2.50, one contract costs $250 ($2.50 × 100).",
  "underlying": "The **underlying** is the stock or ETF that the option is based on. AAPL options let you control AAPL shares at a fraction of the cost.",
  "exercise": "To **exercise** an option means to use your right to buy (call) or sell (put) shares at the strike price. Most traders sell options before expiration rather than exercising.",
  "assignment": "**Assignment** happens when you've sold an option and the buyer exercises it. You must deliver shares (sold call) or buy shares (sold put) at the strike price.",
  
  // Moneyness
  "in the money": "**In-the-money (ITM)** means the option has intrinsic value. Calls are ITM when stock > strike. Puts are ITM when stock < strike. ITM options are more expensive but have better odds.",
  "itm": "**In-the-money (ITM)**: Calls with strike below current price, puts with strike above. These have real value and higher probability of profit.",
  "out of the money": "**Out-of-the-money (OTM)** means no intrinsic value. Calls are OTM when stock < strike. Puts are OTM when stock > strike. OTM options are cheaper but riskier.",
  "otm": "**Out-of-the-money (OTM)**: Calls with strike above current price, puts with strike below. Cheaper but need bigger moves to profit.",
  "at the money": "**At-the-money (ATM)** means the strike equals (or is very close to) the current stock price. ATM options have the highest time value and gamma.",
  "atm": "**At-the-money (ATM)**: Strike price equals the current stock price. Maximum time value and gamma. Popular for directional plays.",
  "intrinsic value": "**Intrinsic value** is the real, tangible value of an option. For calls: max(0, stock - strike). For puts: max(0, strike - stock). ITM options have intrinsic value.",
  "extrinsic value": "**Extrinsic value** (time value) is the premium above intrinsic value. It represents hope/speculation. Extrinsic value decays to zero at expiration.",
  "time value": "**Time value** is what you pay for the possibility of the option becoming profitable. More time = more value. It erodes daily (theta decay).",
  
  // The Greeks
  "delta": "**Delta** measures how much the option price changes per $1 move in the stock.\n\n• Call delta: 0 to 1 (0.50 = moves $0.50 per $1 stock move)\n• Put delta: -1 to 0 (-0.30 = moves $0.30 opposite to stock)\n• ATM options have ~0.50 delta\n• Delta also approximates probability of expiring ITM",
  "gamma": "**Gamma** measures how fast delta changes. High gamma means your position becomes more sensitive as the stock moves.\n\n• Highest for ATM options near expiration\n• Gamma risk: sudden large moves hurt short gamma positions\n• Long options = positive gamma (good)\n• Short options = negative gamma (risky near expiration)",
  "theta": "**Theta** is time decay - how much value your option loses each day.\n\n• Always negative for long options (you lose value daily)\n• Positive for short options (you gain from decay)\n• Theta accelerates in the last 30 days before expiration\n• ATM options have highest theta",
  "vega": "**Vega** measures sensitivity to implied volatility changes.\n\n• +1% IV move = option price changes by vega amount\n• Long options benefit from rising IV\n• Short options benefit from falling IV\n• Highest for ATM options with more time to expiration",
  "rho": "**Rho** measures sensitivity to interest rate changes. Usually the least important Greek for short-term options. Higher rates increase call values and decrease put values.",
  "greeks": "The **Greeks** measure option risk:\n\n• **Delta**: Price change per $1 stock move\n• **Gamma**: Rate of delta change\n• **Theta**: Daily time decay\n• **Vega**: Sensitivity to volatility\n• **Rho**: Sensitivity to interest rates\n\nManaging Greeks helps control risk in your positions.",
  
  // Volatility
  "implied volatility": "**Implied Volatility (IV)** is the market's forecast of future price movement, derived from option prices.\n\n• High IV = expensive options (market expects big moves)\n• Low IV = cheap options (market expects calm)\n• IV tends to spike before earnings and events\n• Compare current IV to historical IV to gauge if options are cheap or expensive",
  "iv": "**Implied Volatility (IV)** reflects expected future price movement. High IV makes options expensive. IV often spikes before earnings and drops after (IV crush). Use IV Rank to compare.",
  "iv rank": "**IV Rank** shows where current IV stands relative to the past year (0-100%). If IV Rank is 80%, current IV is higher than 80% of the past year. High IV Rank = good time to sell premium.",
  "iv percentile": "**IV Percentile** shows what percentage of days had lower IV than today. 90% means only 10% of days had higher IV. Similar to IV Rank but calculated differently.",
  "iv crush": "**IV Crush** is the sharp drop in implied volatility after an expected event (like earnings). Options lose significant value even if you're right on direction. Avoid buying options before earnings unless the move exceeds IV expectations.",
  "historical volatility": "**Historical Volatility (HV)** measures actual past price movement. Compare HV to IV: if IV > HV, options may be overpriced. If IV < HV, options may be cheap.",
  "volatility skew": "**Volatility Skew** shows IV differs across strikes. Usually puts have higher IV than calls (downside protection demand). Steep skew means puts are relatively expensive.",
  "vix": "The **VIX** (Volatility Index) measures expected S&P 500 volatility. VIX > 20 suggests fear/uncertainty. VIX < 15 suggests complacency. VIX tends to spike during market drops.",
  
  // Basic strategies
  "covered call": "**Covered Call**: Own 100 shares + sell 1 call.\n\n• Outlook: Neutral to slightly bullish\n• Max profit: Premium + (strike - stock price) × 100\n• Max loss: Stock drops to $0 (minus premium received)\n• Good for: Generating income on stocks you own\n• Risk: Stock gets called away if it rallies past strike",
  "protective put": "**Protective Put**: Own 100 shares + buy 1 put.\n\n• Outlook: Bullish but want downside protection\n• Max profit: Unlimited (upside)\n• Max loss: (Stock price - strike + premium) × 100\n• Like insurance for your stock position\n• Cost: Premium paid reduces overall gains",
  "cash secured put": "**Cash-Secured Put**: Sell a put while holding enough cash to buy 100 shares.\n\n• Outlook: Bullish or neutral\n• Max profit: Premium received\n• Max loss: (Strike - premium) × 100 if stock goes to $0\n• Good for: Getting paid to wait for a stock at your target price\n• Assignment means you buy shares at the strike",
  "long call": "**Long Call**: Buy a call option.\n\n• Outlook: Bullish\n• Max profit: Unlimited\n• Max loss: Premium paid\n• Break-even: Strike + premium\n• Best when: You expect a significant upward move",
  "long put": "**Long Put**: Buy a put option.\n\n• Outlook: Bearish\n• Max profit: Strike - premium (if stock goes to $0)\n• Max loss: Premium paid\n• Break-even: Strike - premium\n• Best when: You expect a significant downward move",
  "short call": "**Short (Naked) Call**: Sell a call without owning shares.\n\n• Outlook: Bearish or neutral\n• Max profit: Premium received\n• Max loss: UNLIMITED (stock can rise infinitely)\n• Very risky strategy - requires significant margin\n• Only for experienced traders",
  "short put": "**Short Put**: Sell a put option.\n\n• Outlook: Bullish or neutral\n• Max profit: Premium received\n• Max loss: (Strike - premium) × 100\n• Similar to cash-secured put but may use margin\n• Assignment means buying shares at strike",
  
  // Spread strategies
  "vertical spread": "**Vertical Spread**: Buy and sell options at different strikes, same expiration.\n\n• Limits both risk and reward\n• Debit spread: Pay premium (directional bet)\n• Credit spread: Receive premium (bet against direction)\n• Max loss = width of strikes - credit received (for credit spreads)\n• More capital efficient than single options",
  "bull call spread": "**Bull Call Spread**: Buy lower strike call + sell higher strike call.\n\n• Outlook: Moderately bullish\n• Cost: Debit paid (less than buying call alone)\n• Max profit: (Strike width - debit) × 100\n• Max loss: Debit paid\n• Best when: Bullish but want to reduce cost",
  "bear put spread": "**Bear Put Spread**: Buy higher strike put + sell lower strike put.\n\n• Outlook: Moderately bearish\n• Cost: Debit paid\n• Max profit: (Strike width - debit) × 100\n• Max loss: Debit paid\n• Best when: Bearish but want to reduce cost",
  "bull put spread": "**Bull Put Spread** (Put Credit Spread): Sell higher strike put + buy lower strike put.\n\n• Outlook: Bullish or neutral\n• Receive: Credit upfront\n• Max profit: Credit received\n• Max loss: (Strike width - credit) × 100\n• Best when: You want stock to stay above the short put strike",
  "bear call spread": "**Bear Call Spread** (Call Credit Spread): Sell lower strike call + buy higher strike call.\n\n• Outlook: Bearish or neutral\n• Receive: Credit upfront\n• Max profit: Credit received\n• Max loss: (Strike width - credit) × 100\n• Best when: You want stock to stay below the short call strike",
  "iron condor": "**Iron Condor**: Sell OTM put spread + sell OTM call spread.\n\n• Outlook: Neutral (expect stock to stay in a range)\n• Receive: Credit from both sides\n• Max profit: Total credit received\n• Max loss: Width of wider spread - credit\n• Best when: Low volatility expected, range-bound stock",
  "iron butterfly": "**Iron Butterfly**: Sell ATM put + sell ATM call + buy OTM put + buy OTM call.\n\n• Outlook: Very neutral (expect stock to stay at current price)\n• Receive: Large credit (ATM options are expensive)\n• Max profit: Credit received (if stock stays exactly at short strikes)\n• Max loss: Width of wing - credit\n• More aggressive than iron condor",
  "straddle": "**Straddle**: Buy ATM call + buy ATM put (same strike).\n\n• Outlook: Expect BIG move, unsure of direction\n• Cost: Expensive (buying two ATM options)\n• Max profit: Unlimited\n• Max loss: Both premiums paid\n• Break-even: Strike ± total premium\n• Best before: High-impact events",
  "strangle": "**Strangle**: Buy OTM call + buy OTM put (different strikes).\n\n• Outlook: Expect big move, unsure of direction\n• Cost: Cheaper than straddle (OTM options)\n• Max profit: Unlimited\n• Max loss: Both premiums paid\n• Need bigger move than straddle to profit\n• Lower cost, lower probability",
  "butterfly": "**Butterfly Spread**: Buy 1 lower strike + sell 2 middle strikes + buy 1 higher strike.\n\n• Outlook: Expect stock to land exactly at middle strike\n• Low cost, low max loss\n• High max profit if target is hit precisely\n• Narrow profit zone\n• Good for pinning at specific price",
  "calendar spread": "**Calendar Spread** (Time Spread): Sell near-term option + buy same-strike longer-term option.\n\n• Outlook: Neutral near term, benefit from time decay\n• Profits from: Near-term option decaying faster\n• Max loss: Debit paid\n• Best when: Stock stays at strike price\n• Profits from IV increase in back month",
  "diagonal spread": "**Diagonal Spread**: Like calendar but with different strikes.\n\n• Combine directional bias with time decay\n• More complex than vertical or calendar alone\n• Example: Sell near-term OTM call, buy longer-term ATM call\n• Flexible for various outlooks",
  "ratio spread": "**Ratio Spread**: Buy 1 option, sell 2 (or more) at different strike.\n\n• Can be done for credit or debit\n• One side has more contracts than other\n• Risk: Unlimited if short side is uncovered\n• Example: Buy 1 call, sell 2 higher strike calls\n• Advanced strategy with significant risk",
  "collar": "**Collar**: Own stock + buy protective put + sell covered call.\n\n• Outlook: Neutral (willing to cap upside for downside protection)\n• Zero-cost collar: Put cost = call credit\n• Limits both gains and losses\n• Good for: Protecting gains on a stock you don't want to sell",
  
  // Trading concepts
  "buy to open": "**Buy to Open**: Initiate a new long position by purchasing an option. You're buying a new contract that you didn't previously own.",
  "sell to close": "**Sell to Close**: Exit a long position by selling an option you own. You're closing out a position you previously bought.",
  "sell to open": "**Sell to Open**: Initiate a new short position by selling an option. You're creating an obligation (not a right). Requires margin or cash collateral.",
  "buy to close": "**Buy to Close**: Exit a short position by buying back an option you previously sold. This removes your obligation.",
  "open interest": "**Open Interest** is the total number of outstanding option contracts. High OI = liquid market, tighter spreads. OI increases when new positions are created, decreases when positions are closed.",
  "volume": "**Volume** is the number of contracts traded today. High volume = active interest. Compare volume to open interest: volume > OI suggests new positions being created.",
  "bid ask spread": "**Bid-Ask Spread**: Bid is what buyers pay, ask is what sellers want. Tight spread = liquid option. Wide spread = illiquid, harder to get good fills. Always use limit orders.",
  "liquidity": "**Liquidity** refers to how easily you can enter/exit positions. Liquid options have: tight bid-ask spreads, high volume, high open interest. Stick to liquid options for better fills.",
  "margin": "**Margin** is collateral required for short options. Naked calls require substantial margin. Defined-risk spreads require less margin. Margin requirements vary by broker.",
  "assignment risk": "**Assignment Risk**: Short options can be exercised by the buyer anytime (American-style). Risk is highest when: options are deep ITM, near expiration, or around dividends. Close short options before they become deep ITM.",
  "early assignment": "**Early Assignment** happens when a short option is exercised before expiration. Most common for: deep ITM options, calls before ex-dividend dates. Be aware when selling options.",
  "pin risk": "**Pin Risk** occurs when a stock closes right at the strike at expiration. You don't know if you'll be assigned. Can result in unexpected positions Monday morning.",
  "roll": "**Rolling** means closing an existing option position and opening a new one, typically at a different strike or expiration.\n\n• Roll out: Move to later expiration\n• Roll up/down: Change strike price\n• Roll for credit: Collect more premium\n• Used to manage or repair positions",
  "leaps": "**LEAPS** (Long-Term Equity Anticipation Securities) are options with expiration over 1 year away. Used for: long-term directional bets, poor man's covered calls, reduced theta decay.",
  "weekly options": "**Weekly options** expire every Friday (or some days for popular stocks). Higher gamma, faster theta decay. Popular for short-term trades and income strategies. More risk than monthly options.",
  
  // Risk management
  "max loss": "**Max Loss** is the most you can lose on a position. For long options: premium paid. For spreads: width minus credit. Always know your max loss before entering a trade.",
  "max profit": "**Max Profit** is the most you can gain. For long calls: unlimited. For credit spreads: premium received. For debit spreads: width minus debit paid.",
  "breakeven": "**Break-even** is where you neither make nor lose money at expiration.\n\n• Long call: Strike + premium\n• Long put: Strike - premium\n• Spreads: Calculate based on credit/debit and strikes",
  "risk reward": "**Risk/Reward Ratio** compares potential loss to potential gain. A 1:2 ratio means risking $1 to make $2. Credit spreads often have poor risk/reward but high probability. Balance both.",
  "probability of profit": "**Probability of Profit (POP)** estimates the chance of making money. Higher POP usually means lower max profit. OTM credit spreads have high POP but risk big losses when wrong.",
  "position sizing": "**Position Sizing** is how much capital to allocate per trade. Common rules:\n\n• Risk 1-5% of account per trade\n• Never let one trade blow up your account\n• Smaller positions = more diversification",
  "stop loss": "**Stop Loss** is a predetermined exit point to limit losses. Can be based on: option price (e.g., close at 50% loss), stock price, or technical levels. Essential for risk management.",
  
  // Market concepts
  "earnings": "**Earnings** announcements cause big moves and IV spikes. IV typically drops sharply after earnings (IV crush). Options are expensive before earnings - be aware of this when buying.",
  "ex dividend": "**Ex-Dividend Date**: Short call holders may face early assignment if the dividend exceeds remaining time value. Deep ITM calls are most at risk. Consider closing before ex-div.",
  "after hours": "**After-Hours Trading**: Options don't trade after hours, but stocks do. Price gaps can affect your positions when the market opens. Exercise/assignment can happen based on after-hours prices.",
  
  // Misc helpful
  "what should i trade": "It depends on your outlook and risk tolerance:\n\n• **Very bullish**: Long calls or call debit spreads\n• **Slightly bullish**: Bull put spreads, covered calls\n• **Neutral**: Iron condors, iron butterflies\n• **Slightly bearish**: Bear call spreads\n• **Very bearish**: Long puts or put debit spreads\n• **Unsure but expect big move**: Straddles, strangles",
  "best strategy": "There's no single 'best' strategy - it depends on:\n\n• Your market outlook (bullish/bearish/neutral)\n• Expected move size\n• Time frame\n• Risk tolerance\n• Current IV levels\n\nHigh IV favors selling premium. Low IV favors buying options.",
  "how to start": "Getting started with options:\n\n1. Learn the basics (calls, puts, Greeks)\n2. Paper trade first to practice\n3. Start with defined-risk strategies (spreads)\n4. Trade liquid options (SPY, QQQ, AAPL, etc.)\n5. Keep position sizes small (1-5% of account)\n6. Always know your max loss before entering",
  "common mistakes": "**Common Options Mistakes**:\n\n• Buying OTM options without understanding odds\n• Ignoring theta decay\n• Trading illiquid options (wide spreads)\n• Not having an exit plan\n• Over-leveraging\n• Buying options before earnings without understanding IV crush\n• Not managing losers",
};

// Navigation commands
const navigationCommands: Record<string, { page: string; response: string }> = {
  "go to backtest": { page: "/backtest", response: "Taking you to the Backtest page where you can analyze historical performance." },
  "show backtest": { page: "/backtest", response: "Opening the Backtest page for historical analysis." },
  "backtest": { page: "/backtest", response: "Navigating to the Backtest page." },
  "go to option finder": { page: "/option-finder", response: "Opening Option Finder to help you discover strategies." },
  "option finder": { page: "/option-finder", response: "Taking you to Option Finder." },
  "find options": { page: "/option-finder", response: "Opening Option Finder to explore strategy opportunities." },
  "go to skew": { page: "/skew", response: "Opening the Volatility Skew analysis page." },
  "volatility skew": { page: "/skew", response: "Navigating to Volatility Skew analysis." },
  "skew": { page: "/skew", response: "Taking you to the Skew page." },
  "go to financials": { page: "/financials", response: "Opening Financials for company fundamentals." },
  "financials": { page: "/financials", response: "Navigating to the Financials page." },
  "fundamentals": { page: "/financials", response: "Taking you to company Financials." },
  "go home": { page: "/", response: "Taking you back to the Home page." },
  "home": { page: "/", response: "Navigating to Home." },
  "go to builder": { page: "/builder", response: "Opening the Strategy Builder." },
  "builder": { page: "/builder", response: "Navigating to the Builder page." },
};

// Strategy suggestions based on outlook
const strategySuggestions: Record<string, string> = {
  "bullish": "For a **bullish** outlook, consider:\n\n• **Long Call** - Simple, unlimited upside, risk = premium\n• **Bull Call Spread** - Lower cost, limited profit, defined risk\n• **Bull Put Spread** - Collect premium, profits if stock stays up\n• **Cash-Secured Put** - Get paid to wait for lower price\n\nHow aggressive do you want to be?",
  "bearish": "For a **bearish** outlook, consider:\n\n• **Long Put** - Simple, profits if stock drops, risk = premium\n• **Bear Put Spread** - Lower cost, limited profit, defined risk\n• **Bear Call Spread** - Collect premium, profits if stock stays down\n\nHow aggressive do you want to be?",
  "neutral": "For a **neutral** outlook, consider:\n\n• **Iron Condor** - Profit from range-bound stock, defined risk\n• **Iron Butterfly** - Max profit if stock stays at current price\n• **Short Straddle/Strangle** - Collect premium, undefined risk\n• **Covered Call** - Generate income on stock you own\n\nDo you expect the stock to stay in a tight or wide range?",
  "volatile": "If you expect a **big move** but unsure of direction:\n\n• **Long Straddle** - Buy ATM call + put, profits from large move either way\n• **Long Strangle** - Cheaper than straddle, needs bigger move\n• **Long Call + Long Put** at different strikes\n\nThese strategies benefit from IV increases and big price moves.",
};

// Quick tips based on keywords
const quickTips: Record<string, string> = {
  "earnings play": "**Earnings Plays**: Be aware that IV is typically elevated before earnings and drops sharply after (IV crush). Buying options before earnings means you need a bigger move than implied to profit. Consider selling premium to benefit from IV crush.",
  "weekly vs monthly": "**Weekly vs Monthly Options**:\n\n• Weeklies: Higher theta decay, more gamma risk, good for short-term income\n• Monthlies: Slower decay, more forgiving, better for directional bets\n• For beginners: Start with monthlies (30-45 DTE)",
  "dte": "**Days to Expiration (DTE)** matters:\n\n• 0-7 DTE: High gamma, fast theta, risky\n• 7-21 DTE: Popular for income strategies\n• 30-45 DTE: Sweet spot for credit spreads\n• 45+ DTE: Slower decay, more time to be right",
  "when to sell": "**When to Sell Options** (credit strategies):\n\n• High IV environment (IV Rank > 50%)\n• Range-bound stocks\n• 30-45 DTE for optimal theta decay\n• Manage at 50% profit or 21 DTE",
  "when to buy": "**When to Buy Options** (debit strategies):\n\n• Low IV environment (options are cheap)\n• Strong directional conviction\n• Give yourself enough time (45+ DTE)\n• Consider spreads to reduce cost",
};

export function AIChatAssistant({ onNavigate, strategyContext, onLookupPrice }: AIChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm your options trading assistant. I can help with:\n\n• **Education**: Ask about any options concept (Greeks, strategies, etc.)\n• **Your Strategy**: Questions about your current position\n• **Navigation**: Say 'go to backtest' or 'option finder'\n\nWhat would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Analyze current strategy
  const analyzeStrategy = useCallback((): string | null => {
    if (!strategyContext?.legs || strategyContext.legs.length === 0) {
      return null;
    }
    
    const { legs, symbolInfo, volatility, expirationDays, greeks } = strategyContext;
    const symbol = symbolInfo?.symbol || "Unknown";
    const price = symbolInfo?.price || strategyContext.currentPrice || 0;
    
    // Calculate position info
    let netPremium = 0;
    let calls = 0;
    let puts = 0;
    let longLegs = 0;
    let shortLegs = 0;
    
    legs.forEach(leg => {
      const qty = Math.abs(leg.quantity);
      const multiplier = qty * 100;
      
      // For net premium: long = pay (negative cash), short = receive (positive cash)
      if (leg.position === 'long') {
        netPremium -= leg.premium * multiplier;
      } else {
        netPremium += leg.premium * multiplier;
      }
      
      if (leg.type === 'call') calls++;
      else puts++;
      
      if (leg.position === 'long') longLegs++;
      else shortLegs++;
    });
    
    // Get actual Greeks from the engine (with NaN protection)
    const delta = (greeks?.delta != null && !isNaN(greeks.delta)) ? greeks.delta : 0;
    const gamma = (greeks?.gamma != null && !isNaN(greeks.gamma)) ? greeks.gamma : 0;
    const theta = (greeks?.theta != null && !isNaN(greeks.theta)) ? greeks.theta : 0;
    const vega = (greeks?.vega != null && !isNaN(greeks.vega)) ? greeks.vega : 0;
    
    
    // Determine position type
    let positionType = "Custom Strategy";
    let outlook = "neutral";
    
    if (legs.length === 1) {
      const leg = legs[0];
      if (leg.type === 'call' && leg.position === 'long') {
        positionType = "Long Call";
        outlook = "bullish";
      } else if (leg.type === 'put' && leg.position === 'long') {
        positionType = "Long Put";
        outlook = "bearish";
      } else if (leg.type === 'call' && leg.position === 'short') {
        positionType = "Short Call";
        outlook = "bearish";
      } else if (leg.type === 'put' && leg.position === 'short') {
        positionType = "Short Put";
        outlook = "bullish";
      }
    } else if (legs.length === 2) {
      const sorted = [...legs].sort((a, b) => a.strike - b.strike);
      if (calls === 2 && sorted[0].position === 'long' && sorted[1].position === 'short') {
        positionType = "Bull Call Spread";
        outlook = "bullish";
      } else if (puts === 2 && sorted[0].position === 'short' && sorted[1].position === 'long') {
        positionType = "Bull Put Spread";
        outlook = "bullish";
      } else if (calls === 2 && sorted[0].position === 'short' && sorted[1].position === 'long') {
        positionType = "Bear Call Spread";
        outlook = "bearish";
      } else if (puts === 2 && sorted[0].position === 'long' && sorted[1].position === 'short') {
        positionType = "Bear Put Spread";
        outlook = "bearish";
      } else if (calls === 1 && puts === 1) {
        const callLeg = legs.find(l => l.type === 'call')!;
        const putLeg = legs.find(l => l.type === 'put')!;
        if (callLeg.position === 'long' && putLeg.position === 'long') {
          if (callLeg.strike === putLeg.strike) {
            positionType = "Long Straddle";
          } else {
            positionType = "Long Strangle";
          }
          outlook = "volatile";
        } else if (callLeg.position === 'short' && putLeg.position === 'short') {
          if (callLeg.strike === putLeg.strike) {
            positionType = "Short Straddle";
          } else {
            positionType = "Short Strangle";
          }
          outlook = "neutral";
        }
      }
    } else if (legs.length === 4) {
      if (calls === 2 && puts === 2) {
        positionType = "Iron Condor/Butterfly";
        outlook = "neutral";
      }
    }
    
    return JSON.stringify({
      symbol,
      price: price.toFixed(2),
      positionType,
      outlook,
      legs: legs.length,
      netPremium: netPremium.toFixed(2),
      volatility: (volatility * 100).toFixed(1),
      daysToExpiration: expirationDays,
      longLegs,
      shortLegs,
      delta: delta.toFixed(2),
      gamma: gamma.toFixed(4),
      theta: theta.toFixed(2),
      vega: vega.toFixed(2),
    });
  }, [strategyContext]);

  // Parse price lookup request
  const parsePriceLookup = (text: string): { symbol: string; strike: number; type: 'call' | 'put'; expiration?: string } | null => {
    const lower = text.toLowerCase();
    
    // Pattern: "price of AAPL 255 call" or "AAPL 255 call price"
    const patterns = [
      /(?:price\s+(?:of|for)\s+)?(\w+)\s+(\d+(?:\.\d+)?)\s+(call|put)/i,
      /(\w+)\s+(\d+(?:\.\d+)?)\s+(call|put)\s+(?:price|quote)/i,
      /(?:what(?:'s| is)\s+(?:the\s+)?)?(\w+)\s+(\d+(?:\.\d+)?)\s+(call|put)/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          symbol: match[1].toUpperCase(),
          strike: parseFloat(match[2]),
          type: match[3].toLowerCase() as 'call' | 'put',
        };
      }
    }
    
    return null;
  };

  const processMessage = async (userInput: string): Promise<string> => {
    const lower = userInput.toLowerCase().trim();
    const words = lower.split(/\s+/);

    // Check for navigation commands first
    for (const [command, data] of Object.entries(navigationCommands)) {
      if (lower.includes(command)) {
        if (onNavigate) {
          setTimeout(() => onNavigate(data.page), 500);
        }
        return data.response;
      }
    }

    // Check for price lookup requests
    const priceLookup = parsePriceLookup(userInput);
    if (priceLookup && onLookupPrice) {
      try {
        const quote = await onLookupPrice(priceLookup.symbol, priceLookup.strike, priceLookup.type);
        if (quote) {
          return `**${priceLookup.symbol} $${priceLookup.strike} ${priceLookup.type.toUpperCase()}**\n\n` +
                 `• Bid: $${quote.bid.toFixed(2)}\n` +
                 `• Ask: $${quote.ask.toFixed(2)}\n` +
                 `• Mid: $${quote.mid.toFixed(2)}\n\n` +
                 `_Per contract (100 shares): $${(quote.mid * 100).toFixed(2)}_`;
        } else {
          return `I couldn't find a quote for ${priceLookup.symbol} $${priceLookup.strike} ${priceLookup.type}. The strike might not exist or the market may be closed.`;
        }
      } catch (error) {
        return `Sorry, I had trouble looking up that price. Please make sure the symbol and strike are valid.`;
      }
    }

    // Check for strategy context questions
    if (lower.includes("my position") || lower.includes("my strategy") || lower.includes("what am i") || 
        lower.includes("current position") || lower.includes("what do i have") || lower.includes("my trade")) {
      const analysis = analyzeStrategy();
      if (!analysis) {
        return "You don't have any positions open yet. Add some legs in the Strategy Builder to analyze your position.";
      }
      
      const data = JSON.parse(analysis);
      const legCount = Number(data.legs) || 0;
      
      // Check if we have actual legs (defensive check)
      if (legCount <= 0) {
        return "You don't have any positions open yet. Add some legs in the Strategy Builder to analyze your position.";
      }
      
      const netPremiumVal = parseFloat(data.netPremium) || 0;
      const deltaVal = parseFloat(data.delta) || 0;
      const thetaVal = parseFloat(data.theta) || 0;
      
      // Delta is per-contract (already multiplied by quantity)
      // Dollar P/L per $1 move = delta * 100 (100 shares per contract)
      const dollarDelta = Math.abs(deltaVal) * 100;
      const dollarTheta = Math.abs(thetaVal) * 100;
      
      // Use dollar impact for bias (e.g., $5+ exposure is material)
      const deltaDescription = dollarDelta >= 5 ? (deltaVal > 0 ? 'Bullish' : 'Bearish') : 'Neutral';
      
      // Build delta explanation with clear directional wording
      let deltaExplain = '';
      if (deltaVal > 0) {
        deltaExplain = `gains $${dollarDelta.toFixed(0)} if stock rises $1`;
      } else if (deltaVal < 0) {
        deltaExplain = `gains $${dollarDelta.toFixed(0)} if stock falls $1`;
      } else {
        deltaExplain = 'price-neutral';
      }
      
      // Build theta explanation
      let thetaExplain = '';
      if (thetaVal > 0) {
        thetaExplain = `earns $${dollarTheta.toFixed(0)}/day from time decay`;
      } else if (thetaVal < 0) {
        thetaExplain = `loses $${dollarTheta.toFixed(0)}/day to time decay`;
      } else {
        thetaExplain = 'time-neutral';
      }
      
      return `**Your Current Position: ${data.positionType}**\n\n` +
             `• Symbol: ${data.symbol} @ $${data.price}\n` +
             `• Legs: ${data.legs} (${data.longLegs} long, ${data.shortLegs} short)\n` +
             `• Directional Bias: ${deltaDescription}\n` +
             `• Days to Expiration: ${data.daysToExpiration}\n` +
             `• IV Setting: ${data.volatility}%\n\n` +
             `**Greeks:**\n` +
             `• Delta: ${data.delta} (${deltaExplain})\n` +
             `• Theta: ${data.theta} (${thetaExplain})\n` +
             `• Gamma: ${data.gamma}\n` +
             `• Vega: ${data.vega}\n\n` +
             (netPremiumVal !== 0 ? `**Net ${netPremiumVal > 0 ? 'Credit' : 'Debit'}:** $${Math.abs(netPremiumVal).toFixed(2)}` : '');
    }

    // Check for delta/Greek questions about current position
    if ((lower.includes("my delta") || lower.includes("my theta") || lower.includes("my vega") || lower.includes("my gamma") || lower.includes("my greeks"))) {
      const analysis = analyzeStrategy();
      if (!analysis) {
        return "Add some positions first to see your Greeks.";
      }
      
      const data = JSON.parse(analysis);
      const legCount = Number(data.legs) || 0;
      
      // Check if we have actual legs (defensive check)
      if (legCount <= 0) {
        return "Add some positions first to see your Greeks.";
      }
      
      const deltaVal = parseFloat(data.delta) || 0;
      const thetaVal = parseFloat(data.theta) || 0;
      const gammaVal = parseFloat(data.gamma) || 0;
      const vegaVal = parseFloat(data.vega) || 0;
      
      // Dollar impact calculations (100 shares per contract)
      const dollarDelta = Math.abs(deltaVal) * 100;
      const dollarTheta = Math.abs(thetaVal) * 100;
      const dollarVega = Math.abs(vegaVal) * 100;
      
      if (lower.includes("delta")) {
        const bias = dollarDelta >= 5 ? (deltaVal > 0 ? 'bullish' : 'bearish') : 'neutral';
        let directionExplain = '';
        if (deltaVal > 0) {
          directionExplain = `For every $1 the stock **rises**, your position gains approximately $${dollarDelta.toFixed(0)}.`;
        } else if (deltaVal < 0) {
          directionExplain = `For every $1 the stock **falls**, your position gains approximately $${dollarDelta.toFixed(0)}.`;
        } else {
          directionExplain = `Your position is relatively neutral to price changes.`;
        }
        return `**Your Position Delta: ${data.delta}**\n\n` +
               `This is a **${bias}** position. ${directionExplain}`;
      }
      if (lower.includes("theta")) {
        let thetaExplain = '';
        if (thetaVal > 0) {
          thetaExplain = `You're **earning** approximately $${dollarTheta.toFixed(0)} per day from time decay. This is positive because you have net short options.`;
        } else if (thetaVal < 0) {
          thetaExplain = `You're **losing** approximately $${dollarTheta.toFixed(0)} per day to time decay. This is negative because you have net long options.`;
        } else {
          thetaExplain = `Time decay is neutral for your position.`;
        }
        return `**Your Position Theta: ${data.theta}**\n\n${thetaExplain}`;
      }
      if (lower.includes("gamma")) {
        return `**Your Position Gamma: ${data.gamma}**\n\n` +
               (gammaVal > 0 ? `Positive gamma means your delta will increase as the stock rises and decrease as it falls. This benefits you when the stock makes big moves.` :
                gammaVal < 0 ? `Negative gamma means your delta will decrease as the stock rises and increase as it falls. This can hurt you during large price swings.` :
                `Gamma is neutral for your position.`);
      }
      if (lower.includes("vega")) {
        return `**Your Position Vega: ${data.vega}**\n\n` +
               (vegaVal > 0 ? `Positive vega means you benefit when implied volatility increases. For every 1% rise in IV, your position gains approximately $${dollarVega.toFixed(0)}.` :
                vegaVal < 0 ? `Negative vega means you benefit when implied volatility decreases. For every 1% drop in IV, your position gains approximately $${dollarVega.toFixed(0)}.` :
                `Vega is neutral for your position.`);
      }
      
      // General Greeks response - with directional explanations
      const deltaExplainShort = deltaVal > 0 ? 'bullish, profits on rise' : deltaVal < 0 ? 'bearish, profits on fall' : 'neutral';
      const thetaExplainShort = thetaVal > 0 ? `earns $${dollarTheta.toFixed(0)}/day` : thetaVal < 0 ? `loses $${dollarTheta.toFixed(0)}/day` : 'time-neutral';
      
      return `**Your Position Greeks:**\n\n` +
             `• **Delta:** ${data.delta} (${deltaExplainShort})\n` +
             `• **Theta:** ${data.theta} (${thetaExplainShort})\n` +
             `• **Gamma:** ${data.gamma}\n` +
             `• **Vega:** ${data.vega}\n\n` +
             `These values update in real-time as the underlying price changes.`;
    }

    // Check for strategy suggestions based on outlook
    for (const [outlook, suggestion] of Object.entries(strategySuggestions)) {
      if (lower.includes(outlook) && (lower.includes("strategy") || lower.includes("what should") || lower.includes("suggest") || lower.includes("recommend"))) {
        return suggestion;
      }
    }
    
    // Check for I'm bullish/bearish patterns
    if (lower.match(/i(?:'m| am)\s+(bullish|bearish|neutral)/)) {
      const match = lower.match(/i(?:'m| am)\s+(bullish|bearish|neutral)/);
      if (match) {
        const outlook = match[1];
        return strategySuggestions[outlook] || strategySuggestions["neutral"];
      }
    }

    // Check for quick tips
    for (const [keyword, tip] of Object.entries(quickTips)) {
      if (lower.includes(keyword)) {
        return tip;
      }
    }

    // Search education database with fuzzy matching
    const searchTerms = [
      lower,
      lower.replace("what is ", "").replace("what's ", "").replace("explain ", "").replace("tell me about ", ""),
      words.slice(-2).join(" "),
      words.slice(-1)[0],
    ];

    for (const term of searchTerms) {
      for (const [key, response] of Object.entries(optionsEducation)) {
        if (term.includes(key) || key.includes(term)) {
          return response;
        }
      }
    }

    // Check for partial matches
    for (const [key, response] of Object.entries(optionsEducation)) {
      const keyWords = key.split(" ");
      const matchCount = keyWords.filter(kw => words.includes(kw)).length;
      if (matchCount >= Math.min(2, keyWords.length)) {
        return response;
      }
    }

    // Help response
    if (lower.includes("help") || lower === "?") {
      return "I can help with:\n\n**Education:**\n• Greeks: 'what is delta', 'explain theta'\n• Strategies: 'what is iron condor', 'bull call spread'\n• Concepts: 'what is IV crush', 'assignment risk'\n\n**Your Position:**\n• 'What's my position?'\n• 'What's my delta?'\n• 'Am I bullish or bearish?'\n\n**Strategy Ideas:**\n• 'I'm bullish, what should I trade?'\n• 'Best strategy for neutral outlook'\n\n**Navigation:**\n• 'Go to backtest'\n• 'Option finder'\n• 'Skew analysis'";
    }

    // Greetings
    if (lower.match(/^(hello|hi|hey|greetings|good morning|good afternoon|good evening)/)) {
      return "Hello! I'm here to help with options trading. You can ask me about:\n\n• Greeks and strategies\n• Your current position\n• Strategy suggestions\n\nWhat would you like to know?";
    }

    // Thanks
    if (lower.includes("thank")) {
      return "You're welcome! Let me know if you have any other questions about options trading.";
    }

    // Default response with suggestions
    return "I'm not sure about that specific question. Try asking:\n\n• 'What is [delta/theta/vega/gamma]?'\n• 'Explain [iron condor/straddle/spread]'\n• 'What's my position?'\n• 'I'm bullish, what strategy should I use?'\n\nType 'help' for more options.";
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await processMessage(userMessage.content);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // Suggested prompts
  const suggestedPrompts = [
    { icon: HelpCircle, text: "What is delta?" },
    { icon: TrendingUp, text: "I'm bullish" },
    { icon: TrendingDown, text: "I'm bearish" },
    { icon: Lightbulb, text: "My position" },
  ];

  return (
    <Card className="flex flex-col h-[600px] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-primary/5">
        <div className="p-1.5 rounded-md bg-primary/10">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm font-semibold">Options Assistant</span>
      </div>

      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2 ${message.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {message.role === "user" ? (
                  <User className="h-3.5 w-3.5" />
                ) : (
                  <Bot className="h-3.5 w-3.5" />
                )}
              </div>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-2">
              <div className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick action buttons */}
      {messages.length <= 2 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {suggestedPrompts.map((prompt, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setInput(prompt.text)}
              data-testid={`button-suggested-prompt-${i}`}
            >
              <prompt.icon className="h-3 w-3" />
              {prompt.text}
            </Button>
          ))}
        </div>
      )}

      <form 
        className="p-2 border-t border-border"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about options, strategies, Greeks..."
            className="flex-1 h-8 text-sm"
            data-testid="input-ai-chat"
          />
          <Button
            type="submit"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={!input.trim() || isTyping}
            data-testid="button-send-message"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </form>
    </Card>
  );
}
