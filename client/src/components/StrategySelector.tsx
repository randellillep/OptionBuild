import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, Check, TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import { 
  strategyTemplates, 
  categoryLabels,
  type ExtendedStrategy, 
  type StrategyCategory 
} from "@/lib/strategy-templates";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  ReferenceLine,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

interface StrategySelectorProps {
  onSelectStrategy: (strategyIndex: number) => void;
}

function MiniPLChart({ strategy, currentPrice = 100 }: { strategy: ExtendedStrategy; currentPrice?: number }) {
  const chartData = useMemo(() => {
    const points = [];
    const minPrice = currentPrice * 0.85;
    const maxPrice = currentPrice * 1.15;
    const step = (maxPrice - minPrice) / 50;
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
      
      points.push({
        price: price.toFixed(0),
        pl: pl,
      });
    }
    
    return points;
  }, [strategy, currentPrice]);

  const maxProfit = Math.max(...chartData.map(d => d.pl));
  const maxLoss = Math.min(...chartData.map(d => d.pl));

  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="lossGradient" x1="0" y1="1" x2="0" y2="0">
              <stop offset="5%" stopColor="hsl(0 72% 51%)" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="hsl(0 72% 51%)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="price" 
            hide 
          />
          <YAxis hide domain={[maxLoss * 1.1, maxProfit * 1.1]} />
          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.5} />
          <Area
            type="monotone"
            dataKey="pl"
            stroke="hsl(142 71% 45%)"
            strokeWidth={2}
            fill="url(#profitGradient)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function StrategyIcon({ sentiment }: { sentiment: string[] }) {
  if (sentiment.includes("very_bullish") || sentiment.includes("bullish")) {
    return <TrendingUp className="h-4 w-4 text-profit" />;
  }
  if (sentiment.includes("very_bearish") || sentiment.includes("bearish")) {
    return <TrendingDown className="h-4 w-4 text-loss" />;
  }
  if (sentiment.includes("directional")) {
    return <ArrowRight className="h-4 w-4 text-primary" />;
  }
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export function StrategySelector({ onSelectStrategy }: StrategySelectorProps) {
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const displayedIndex = hoveredIndex ?? selectedIndex ?? 0;
  const displayedStrategy = strategyTemplates[displayedIndex];

  const categorizedStrategies = useMemo(() => {
    const categories: Record<StrategyCategory, { index: number; strategy: ExtendedStrategy }[]> = {
      basic: [],
      credit_spreads: [],
      debit_spreads: [],
      volatility: [],
      neutral: [],
    };

    strategyTemplates.forEach((strategy, index) => {
      categories[strategy.metadata.category].push({ index, strategy });
    });

    return categories;
  }, []);

  const handleSelect = () => {
    if (selectedIndex !== null) {
      onSelectStrategy(selectedIndex);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-sm" data-testid="strategy-selector">
          Build
          <ChevronDown className="ml-1 h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="text-base">Select strategy to calculate and visualize the expected profit and loss.</DialogTitle>
        </DialogHeader>
        
        <div className="flex h-[600px]">
          <ScrollArea className="w-72 border-r">
            <div className="p-2">
              {(Object.keys(categorizedStrategies) as StrategyCategory[]).map((category) => {
                const strategies = categorizedStrategies[category];
                if (strategies.length === 0) return null;
                
                return (
                  <div key={category} className="mb-4">
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {categoryLabels[category]}
                    </div>
                    {strategies.map(({ index, strategy }) => (
                      <button
                        key={index}
                        className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-left text-sm transition-colors ${
                          selectedIndex === index
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => setSelectedIndex(index)}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        data-testid={`strategy-item-${strategy.name.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <StrategyIcon sentiment={strategy.metadata.sentiment} />
                        <span className="flex-1">{strategy.name}</span>
                        {selectedIndex === index && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          
          <ScrollArea className="flex-1">
            <div className="p-6 flex flex-col">
              <div className="mb-4">
                <h3 className="text-xl font-semibold mb-2">{displayedStrategy.name}</h3>
                <div className="flex gap-2 flex-wrap">
                  {displayedStrategy.metadata.tags.map((tag) => (
                    <Badge 
                      key={tag} 
                      variant="outline" 
                      className={`text-xs ${
                        tag.includes("Bullish") ? "border-profit text-profit" :
                        tag.includes("Bearish") ? "border-loss text-loss" :
                        tag.includes("Profit") ? "border-primary text-primary" :
                        tag.includes("Loss") ? "border-muted-foreground" :
                        ""
                      }`}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex-1 bg-card rounded-lg border p-4 mb-4">
                <MiniPLChart strategy={displayedStrategy} />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>Profit</span>
                  <span>Loss</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                {displayedStrategy.description}
              </p>

              <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                <div className="p-2 bg-muted/30 rounded-md">
                  <div className="text-muted-foreground mb-1">Max Profit</div>
                  <div className="font-medium text-profit">{displayedStrategy.metadata.maxProfit}</div>
                </div>
                <div className="p-2 bg-muted/30 rounded-md">
                  <div className="text-muted-foreground mb-1">Max Loss</div>
                  <div className="font-medium text-loss">{displayedStrategy.metadata.maxLoss}</div>
                </div>
                <div className="p-2 bg-muted/30 rounded-md">
                  <div className="text-muted-foreground mb-1">Breakeven</div>
                  <div className="font-medium">{displayedStrategy.metadata.breakeven}</div>
                </div>
              </div>

              <Button 
                onClick={handleSelect}
                disabled={selectedIndex === null}
                className="w-full"
                data-testid="button-select-strategy"
              >
                Select a strategy
              </Button>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
