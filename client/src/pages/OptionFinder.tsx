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
  DollarSign,
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

const sentimentConfig: Record<Sentiment, { icon: React.ReactNode; label: string; color: string; bgColor: string }> = {
  very_bearish: { 
    icon: <ChevronsDown className="h-5 w-5" />, 
    label: "Very Bearish", 
    color: "text-loss",
    bgColor: "bg-loss/20 border-loss/30",
  },
  bearish: { 
    icon: <ChevronDown className="h-5 w-5" />, 
    label: "Bearish", 
    color: "text-loss",
    bgColor: "bg-loss/10 border-loss/20",
  },
  neutral: { 
    icon: <Minus className="h-5 w-5" />, 
    label: "Neutral", 
    color: "text-muted-foreground",
    bgColor: "bg-muted border-muted-foreground/20",
  },
  directional: { 
    icon: <ArrowRight className="h-5 w-5" />, 
    label: "Directional", 
    color: "text-primary",
    bgColor: "bg-primary/10 border-primary/20",
  },
  bullish: { 
    icon: <ChevronUp className="h-5 w-5" />, 
    label: "Bullish", 
    color: "text-profit",
    bgColor: "bg-profit/10 border-profit/20",
  },
  very_bullish: { 
    icon: <ChevronsUp className="h-5 w-5" />, 
    label: "Very Bullish", 
    color: "text-profit",
    bgColor: "bg-profit/20 border-profit/30",
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
  const { data: quoteData } = useQuery<{ price: number; symbol: string }>({
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
    setLocation(`/?strategy=${strategyIndex}&symbol=${symbolInfo.symbol}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 md:px-6 flex h-10 items-center justify-between">
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

      <div className="container mx-auto px-4 md:px-6 py-8">
        <Card className="p-6 mb-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-6">
            <div className="flex items-center gap-4 flex-wrap justify-center lg:justify-start">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Symbol</span>
                <div className="w-32">
                  <SymbolSearchBar 
                    symbolInfo={symbolInfo} 
                    onSymbolChange={setSymbolInfo} 
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 rounded-lg">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Current Price</span>
                  <span className="font-mono text-xl font-bold">${symbolInfo.price.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap justify-center">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Target</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className="w-28 pl-6"
                    data-testid="input-target-price"
                  />
                </div>
                <Badge 
                  variant={parseFloat(changePercent) >= 0 ? "default" : "destructive"} 
                  className={`text-xs ${parseFloat(changePercent) >= 0 ? "bg-profit/20 text-profit border-profit/30" : "bg-loss/20 text-loss border-loss/30"}`}
                >
                  {parseFloat(changePercent) >= 0 ? "+" : ""}{changePercent}%
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Budget</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="None"
                    className="w-28 pl-6"
                    data-testid="input-budget"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 md:gap-3 flex-wrap">
            {(Object.keys(sentimentConfig) as Sentiment[]).map((sentiment) => {
              const config = sentimentConfig[sentiment];
              const isSelected = selectedSentiment === sentiment;
              
              return (
                <button
                  key={sentiment}
                  onClick={() => setSelectedSentiment(isSelected ? null : sentiment)}
                  className={`flex flex-col items-center gap-1 p-2 md:p-3 rounded-lg border transition-all ${
                    isSelected 
                      ? `${config.bgColor} ${config.color}` 
                      : "border-transparent hover:bg-muted"
                  }`}
                  data-testid={`sentiment-${sentiment}`}
                >
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center ${
                    isSelected ? config.bgColor : "bg-muted"
                  }`}>
                    <span className={config.color}>{config.icon}</span>
                  </div>
                  <span className="text-xs">{config.label}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mb-6">
          <span>← Max Return</span>
          <div className="w-64 h-1 bg-muted rounded-full">
            <div className="w-1/2 h-full bg-primary rounded-full" />
          </div>
          <span>Max Chance →</span>
        </div>

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
