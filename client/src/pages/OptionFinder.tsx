import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SymbolSearchBar } from "@/components/SymbolSearchBar";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ArrowRight, 
  ArrowLeft,
  ChevronsDown,
  ChevronsUp,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Clock,
} from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { strategyTemplates, type ExtendedStrategy } from "@/lib/strategy-templates";
import { useQuery } from "@tanstack/react-query";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

type Sentiment = "very_bearish" | "bearish" | "neutral" | "directional" | "bullish" | "very_bullish";

const sentimentConfig: Record<Sentiment, { icon: React.ReactNode; label: string; selectedBg: string; selectedBorder: string; iconColor: string }> = {
  very_bearish: { 
    icon: <ChevronsDown className="h-6 w-6" />, 
    label: "Very Bearish", 
    selectedBg: "bg-[#8B1538]",
    selectedBorder: "border-[#8B1538]",
    iconColor: "text-white",
  },
  bearish: { 
    icon: <TrendingDown className="h-6 w-6" />, 
    label: "Bearish", 
    selectedBg: "bg-[#C2185B]",
    selectedBorder: "border-[#C2185B]",
    iconColor: "text-white",
  },
  neutral: { 
    icon: <ArrowRight className="h-6 w-6" />, 
    label: "Neutral", 
    selectedBg: "bg-slate-500 dark:bg-slate-600",
    selectedBorder: "border-slate-500 dark:border-slate-600",
    iconColor: "text-white",
  },
  directional: { 
    icon: <TrendingUp className="h-6 w-6 rotate-45" />, 
    label: "Directional", 
    selectedBg: "bg-[#9C27B0]",
    selectedBorder: "border-[#9C27B0]",
    iconColor: "text-white",
  },
  bullish: { 
    icon: <TrendingUp className="h-6 w-6" />, 
    label: "Bullish", 
    selectedBg: "bg-[#2E7D32]",
    selectedBorder: "border-[#2E7D32]",
    iconColor: "text-white",
  },
  very_bullish: { 
    icon: <ChevronsUp className="h-6 w-6" />, 
    label: "Very Bullish", 
    selectedBg: "bg-[#1B5E20]",
    selectedBorder: "border-[#1B5E20]",
    iconColor: "text-white",
  },
};

function MiniPLChart({ strategy, currentPrice = 100 }: { strategy: ExtendedStrategy; currentPrice?: number }) {
  const chartData = useMemo(() => {
    const points = [];
    const minPrice = currentPrice * 0.85;
    const maxPrice = currentPrice * 1.15;
    const step = (maxPrice - minPrice) / 40;
    const contractMultiplier = 100;

    for (let price = minPrice; price <= maxPrice; price += step) {
      let pl = 0;
      
      for (const leg of strategy.legs) {
        const quantity = leg.quantity || 1;
        const isLong = leg.position === "long";
        const premium = leg.premium * contractMultiplier * quantity;
        
        let intrinsicValue = 0;
        if (leg.type === "call") {
          intrinsicValue = Math.max(0, price - leg.strike) * contractMultiplier * quantity;
        } else {
          intrinsicValue = Math.max(0, leg.strike - price) * contractMultiplier * quantity;
        }
        
        if (isLong) {
          pl += intrinsicValue - premium;
        } else {
          pl += premium - intrinsicValue;
        }
      }
      
      points.push({ price, pl });
    }
    
    return points;
  }, [strategy, currentPrice]);

  const maxProfit = Math.max(...chartData.map(d => d.pl));
  const maxLoss = Math.min(...chartData.map(d => d.pl));

  return (
    <div className="h-24 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id={`profit-${strategy.name}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id={`loss-${strategy.name}`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="5%" stopColor="hsl(0 72% 51%)" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="hsl(0 72% 51%)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="price" hide />
          <YAxis hide domain={[maxLoss * 1.2, maxProfit * 1.2]} />
          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" strokeOpacity={0.3} />
          <Area
            type="monotone"
            dataKey="pl"
            stroke="hsl(142 71% 45%)"
            strokeWidth={1.5}
            fill={`url(#profit-${strategy.name})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface StrategyCardProps {
  strategy: ExtendedStrategy;
  currentPrice: number;
  targetPrice: number;
  onOpenInBuilder: () => void;
}

function StrategyCard({ strategy, currentPrice, targetPrice, onOpenInBuilder }: StrategyCardProps) {
  const metrics = useMemo(() => {
    const contractMultiplier = 100;
    let netDebit = 0;
    
    for (const leg of strategy.legs) {
      const quantity = leg.quantity || 1;
      const premium = leg.premium * contractMultiplier * quantity;
      if (leg.position === "long") {
        netDebit += premium;
      } else {
        netDebit -= premium;
      }
    }

    let plAtTarget = 0;
    for (const leg of strategy.legs) {
      const quantity = leg.quantity || 1;
      const isLong = leg.position === "long";
      const premium = leg.premium * contractMultiplier * quantity;
      
      let intrinsicValue = 0;
      if (leg.type === "call") {
        intrinsicValue = Math.max(0, targetPrice - leg.strike) * contractMultiplier * quantity;
      } else {
        intrinsicValue = Math.max(0, leg.strike - targetPrice) * contractMultiplier * quantity;
      }
      
      if (isLong) {
        plAtTarget += intrinsicValue - premium;
      } else {
        plAtTarget += premium - intrinsicValue;
      }
    }

    const risk = Math.max(Math.abs(netDebit), 1);
    const returnOnRisk = (plAtTarget / risk) * 100;
    const chance = Math.random() * 40 + 30;

    return {
      returnOnRisk,
      profit: plAtTarget,
      risk,
      chance,
      collateral: risk,
    };
  }, [strategy, currentPrice, targetPrice]);

  const legDescription = strategy.legs.map(leg => 
    `${leg.position === "long" ? "Buy" : "Sell"} ${leg.strike}${leg.type === "call" ? "C" : "P"}`
  ).join(", ");

  return (
    <Card className="p-4 hover-elevate transition-all">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-sm">{strategy.name}</h3>
          <p className="text-xs text-muted-foreground">{legDescription}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
        <div className="flex justify-between">
          <span className={metrics.returnOnRisk >= 0 ? "text-profit" : "text-loss"}>
            {metrics.returnOnRisk.toFixed(0)}%
          </span>
          <span className="text-muted-foreground">Return on risk</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{metrics.chance.toFixed(0)}%</span>
          <span className="text-muted-foreground">Chance</span>
        </div>
        <div className="flex justify-between">
          <span className={metrics.profit >= 0 ? "text-profit" : "text-loss"}>
            ${Math.abs(metrics.profit).toLocaleString()}
          </span>
          <span className="text-muted-foreground">Profit</span>
        </div>
        <div className="flex justify-between">
          <span>${metrics.collateral.toLocaleString()}</span>
          <span className="text-muted-foreground">Collateral</span>
        </div>
      </div>

      <MiniPLChart strategy={strategy} currentPrice={currentPrice} />

      <Button 
        size="sm" 
        variant="outline" 
        className="w-full mt-3 text-xs"
        onClick={onOpenInBuilder}
        data-testid={`button-open-${strategy.name.toLowerCase().replace(/\s+/g, "-")}`}
      >
        Open in Builder
      </Button>
    </Card>
  );
}

export default function OptionFinder() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [symbolInfo, setSymbolInfo] = useState({ symbol: "AAPL", price: 185.00 });
  const [targetPrice, setTargetPrice] = useState<string>("195.00");
  const [budget, setBudget] = useState<string>("");
  const [selectedSentiment, setSelectedSentiment] = useState<Sentiment | null>("bullish");

  // Fetch stock price for symbol from URL
  const { data: quoteData, refetch: refetchQuote } = useQuery<{ price: number; symbol: string; change?: number; changePercent?: number }>({
    queryKey: ['/api/stock/quote', symbolInfo.symbol],
    enabled: !!symbolInfo.symbol,
  });

  // Load symbol from URL params
  useEffect(() => {
    if (!searchString) return;
    
    const params = new URLSearchParams(searchString);
    const urlSymbol = params.get('symbol');
    
    if (urlSymbol && urlSymbol !== symbolInfo.symbol) {
      setSymbolInfo(prev => ({ ...prev, symbol: urlSymbol }));
    }
  }, [searchString]);

  // Update price when quote data arrives
  useEffect(() => {
    if (quoteData?.price && quoteData.price > 0) {
      setSymbolInfo(prev => ({ ...prev, price: quoteData.price }));
      // Update target price to be slightly above current price if it's the default
      if (targetPrice === "195.00" || parseFloat(targetPrice) <= 0) {
        setTargetPrice((quoteData.price * 1.05).toFixed(2));
      }
    }
  }, [quoteData]);

  const targetPriceNum = parseFloat(targetPrice) > 0 ? parseFloat(targetPrice) : symbolInfo.price;
  const budgetNum = parseFloat(budget) > 0 ? parseFloat(budget) : null;
  const changePercent = symbolInfo.price > 0 
    ? ((targetPriceNum - symbolInfo.price) / symbolInfo.price * 100).toFixed(1)
    : "0.0";

  const filteredStrategies = useMemo(() => {
    let strategies = strategyTemplates;
    
    // Filter by sentiment
    if (selectedSentiment) {
      strategies = strategies.filter(strategy => 
        strategy.metadata.sentiment.includes(selectedSentiment)
      );
    }
    
    // Filter by budget if provided
    if (budgetNum !== null && budgetNum > 0) {
      strategies = strategies.filter(strategy => {
        let totalCost = 0;
        for (const leg of strategy.legs) {
          const premium = leg.premium * 100 * leg.quantity;
          if (leg.position === "long") {
            totalCost += premium;
          } else {
            totalCost -= premium;
          }
        }
        return Math.abs(totalCost) <= budgetNum;
      });
    }
    
    return strategies;
  }, [selectedSentiment, budgetNum]);

  const handleOpenInBuilder = (strategyIndex: number) => {
    // Navigate to builder with strategy index and symbol
    setLocation(`/?strategy=${strategyIndex}&symbol=${symbolInfo.symbol}`);
  };

  // Calculate price change display
  const priceChange = quoteData?.change ?? 0;
  const priceChangePercent = quoteData?.changePercent ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 md:px-6 flex h-12 items-center justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="flex items-center gap-1.5 cursor-pointer" 
              onClick={() => setLocation("/")}
            >
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold">OptionFlow</span>
            </div>
            <span className="text-sm text-muted-foreground">Option Finder</span>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setLocation("/")}
              data-testid="button-back-builder"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Builder
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 md:px-6 py-6">
        {/* Top Control Panel - Matching OptionStrat Design */}
        <div className="bg-slate-50 dark:bg-card rounded-xl border border-slate-200 dark:border-border p-6 mb-8">
          {/* Symbol & Price Row */}
          <div className="flex items-center justify-center gap-4 mb-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600 dark:text-muted-foreground">Symbol:</span>
              <div className="w-28">
                <SymbolSearchBar 
                  symbolInfo={symbolInfo} 
                  onSymbolChange={setSymbolInfo} 
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-bold text-slate-900 dark:text-foreground">
                {symbolInfo.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-sm font-medium ${priceChangePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
                <br />
                <span className="text-xs">{priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-500 dark:text-muted-foreground">
              <button 
                onClick={() => refetchQuote()} 
                className="p-1 hover:bg-slate-200 dark:hover:bg-muted rounded transition-colors"
                data-testid="button-refresh-quote"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <Clock className="h-4 w-4" />
              <span className="text-xs">Delayed</span>
            </div>
          </div>

          {/* Sentiment Icons Row */}
          <div className="flex items-center justify-center gap-4 md:gap-6 mb-6">
            {(Object.keys(sentimentConfig) as Sentiment[]).map((sentiment) => {
              const config = sentimentConfig[sentiment];
              const isSelected = selectedSentiment === sentiment;
              
              return (
                <button
                  key={sentiment}
                  onClick={() => setSelectedSentiment(isSelected ? null : sentiment)}
                  className="flex flex-col items-center gap-2 group"
                  data-testid={`sentiment-${sentiment}`}
                >
                  <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all duration-200 border-2 ${
                    isSelected 
                      ? `${config.selectedBg} ${config.selectedBorder} shadow-lg scale-110` 
                      : "bg-slate-100 dark:bg-muted border-slate-300 dark:border-border hover:border-slate-400 dark:hover:border-muted-foreground/50"
                  }`}>
                    <span className={isSelected ? config.iconColor : "text-slate-600 dark:text-muted-foreground"}>
                      {config.icon}
                    </span>
                  </div>
                  <span className={`text-xs font-medium transition-colors ${
                    isSelected 
                      ? "text-slate-900 dark:text-foreground" 
                      : "text-slate-500 dark:text-muted-foreground group-hover:text-slate-700 dark:group-hover:text-foreground"
                  }`}>
                    {config.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Target Price & Budget Row */}
          <div className="flex items-center justify-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600 dark:text-muted-foreground">Target Price:</span>
              <div className="relative">
                <Input
                  type="number"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="w-28 h-9 text-center bg-white dark:bg-background border-slate-300 dark:border-border"
                  data-testid="input-target-price"
                />
              </div>
              <Badge 
                variant="secondary"
                className={`text-xs px-2 py-0.5 ${
                  parseFloat(changePercent) >= 0 
                    ? "bg-green-100 text-green-700 dark:bg-profit/20 dark:text-profit border-green-200 dark:border-profit/30" 
                    : "bg-red-100 text-red-700 dark:bg-loss/20 dark:text-loss border-red-200 dark:border-loss/30"
                }`}
              >
                ({parseFloat(changePercent) >= 0 ? "+" : ""}{changePercent}%)
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600 dark:text-muted-foreground">Budget: $</span>
              <Input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="None"
                className="w-24 h-9 text-center bg-white dark:bg-background border-slate-300 dark:border-border"
                data-testid="input-budget"
              />
            </div>
          </div>

          {/* Date Timeline - Simplified */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-border">
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-1 overflow-x-auto py-2 px-4">
                {generateExpirationDates().map((date, index) => (
                  <button
                    key={index}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                      index === 0 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-slate-100 dark:bg-muted text-slate-600 dark:text-muted-foreground hover:bg-slate-200 dark:hover:bg-muted/80"
                    }`}
                    data-testid={`date-${date.day}`}
                  >
                    {date.day}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Strategy Sorting Indicator */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mb-6">
          <span>← Max Return</span>
          <div className="w-64 h-1.5 bg-slate-200 dark:bg-muted rounded-full overflow-hidden">
            <div className="w-1/2 h-full bg-gradient-to-r from-primary to-primary/60 rounded-full" />
          </div>
          <span>Max Chance →</span>
        </div>

        {/* Strategy Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStrategies.map((strategy, index) => (
            <StrategyCard
              key={strategy.name}
              strategy={strategy}
              currentPrice={symbolInfo.price}
              targetPrice={targetPriceNum}
              onOpenInBuilder={() => handleOpenInBuilder(strategyTemplates.indexOf(strategy))}
            />
          ))}
        </div>

        {filteredStrategies.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No strategies found for the selected sentiment. Try selecting a different outlook.
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to generate expiration dates
function generateExpirationDates() {
  const dates = [];
  const today = new Date();
  
  // Generate dates for the next 4 weeks
  for (let i = 0; i < 20; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push({
      day: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      year: date.getFullYear().toString().slice(-2),
    });
  }
  
  return dates;
}
