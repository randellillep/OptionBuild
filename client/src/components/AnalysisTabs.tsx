import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, BarChart3, Users, History, Info } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Greeks, MarketOptionChainSummary, OptionLeg, StrategyMetrics } from "@shared/schema";
import { GreeksDashboard } from "./GreeksDashboard";
import { HistoricalPriceTab } from "./HistoricalPriceTab";
import { 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine,
  Area,
  AreaChart,
  ComposedChart
} from "recharts";
import { useMemo } from "react";

// Frozen expected move data passed from parent (calculated ONCE from market data)
// This is NEVER affected by IV slider or strategy changes
interface FrozenExpectedMove {
  expectedMove: number;
  atmStrike: number;
  atmCall: number;
  atmPut: number;
  otm1Strangle: number | null;
  otm2Strangle: number | null;
  lowerBound: number;
  upperBound: number;
  movePercent: number;
  currentPrice: number;
  daysToExpiration: number;
  expirationDate: string;
}

interface AnalysisTabsProps {
  greeks: Greeks;
  symbol?: string;
  currentPrice?: number;
  volatility?: number;
  expirationDate?: string | null;
  optionsChainData?: MarketOptionChainSummary;
  legs?: OptionLeg[];
  metrics?: StrategyMetrics | null;
  frozenExpectedMove?: FrozenExpectedMove | null;
}

export function AnalysisTabs({ 
  greeks, 
  symbol = "AAPL",
  currentPrice = 185,
  volatility = 0.30,
  expirationDate,
  optionsChainData,
  legs = [],
  metrics,
  frozenExpectedMove
}: AnalysisTabsProps) {
  
  // Expected Move is passed in as frozen data from Builder
  // It's calculated ONCE when options chain loads and NEVER changes with IV slider
  // No calculation here - just use the frozen data directly
  const expectedMove = frozenExpectedMove;

  // Generate expected move projection data for chart
  // Uses ONLY the frozen expected move data - never uses the IV slider value
  const expectedMoveChartData = useMemo(() => {
    if (!expectedMove) return [];
    
    // Use the frozen expected move's values (calculated from market data, never changes with IV slider)
    const frozenPrice = expectedMove.currentPrice;
    const frozenMovePercent = expectedMove.movePercent / 100; // Convert from percentage
    
    // Generate projections for the expiration period only (not multiple months)
    // This shows the expected range at expiration using FROZEN market data
    const daysToExp = expectedMove.daysToExpiration;
    const labels = ['Now', `+${Math.floor(daysToExp/2)}d`, `Exp (${daysToExp}d)`];
    
    return labels.map((label, index) => {
      // Scale the move based on time (square root of time)
      const timeRatio = index / (labels.length - 1); // 0 to 1
      const timeMultiplier = Math.sqrt(timeRatio);
      
      return {
        month: label,
        price: index === 0 ? frozenPrice : undefined,
        upper: frozenPrice * (1 + frozenMovePercent * timeMultiplier),
        lower: frozenPrice * (1 - frozenMovePercent * timeMultiplier),
      };
    });
  }, [expectedMove]); // Only depends on frozen expected move data - NOT volatility

  // Calculate volatility skew from options chain data
  const volatilitySkewData = useMemo(() => {
    if (!optionsChainData?.quotes || optionsChainData.quotes.length === 0) {
      // Generate sample skew data
      const atmStrike = currentPrice ? Math.round(currentPrice / 5) * 5 : 185;
      const strikes = [];
      for (let i = -10; i <= 10; i++) {
        const strike = atmStrike + i * 5;
        const moneyness = strike / currentPrice;
        // Typical volatility smile: higher IV for OTM puts and calls
        const skewFactor = Math.abs(moneyness - 1) * 0.3;
        const putIV = volatility * 100 * (1 + skewFactor + (moneyness < 1 ? 0.1 : 0));
        const callIV = volatility * 100 * (1 + skewFactor);
        strikes.push({
          strike,
          putIV,
          callIV,
          moneyness: ((moneyness - 1) * 100).toFixed(1) + '%'
        });
      }
      return strikes;
    }

    // Use real options chain data
    const strikeIVMap = new Map<number, { putIV?: number; callIV?: number }>();
    
    optionsChainData.quotes.forEach((quote: any) => {
      if (quote.iv && quote.iv > 0) {
        const existing = strikeIVMap.get(quote.strike) || {};
        if (quote.side.toLowerCase() === 'put') {
          existing.putIV = quote.iv * 100;
        } else {
          existing.callIV = quote.iv * 100;
        }
        strikeIVMap.set(quote.strike, existing);
      }
    });

    return Array.from(strikeIVMap.entries())
      .map(([strike, ivs]) => ({
        strike,
        putIV: ivs.putIV || null,
        callIV: ivs.callIV || null,
        moneyness: currentPrice ? (((strike / currentPrice) - 1) * 100).toFixed(1) + '%' : undefined
      }))
      .sort((a, b) => a.strike - b.strike)
      .slice(0, 20); // Limit to 20 strikes for readability
  }, [optionsChainData, currentPrice, volatility]);

  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Tabs defaultValue="greeks" className="w-full">
      {/* Scrollable tabs on mobile */}
      <div className="overflow-x-auto -mx-2 px-2 pb-1">
        <TabsList className="inline-flex w-auto min-w-full sm:grid sm:grid-cols-5 h-7">
          <TabsTrigger value="greeks" className="text-[10px] h-6 px-2 sm:px-1 whitespace-nowrap" data-testid="tab-greeks">
            <Activity className="h-2.5 w-2.5 mr-0.5" />
            Greeks
          </TabsTrigger>
          <TabsTrigger value="backtest" className="text-[10px] h-6 px-2 sm:px-1 whitespace-nowrap" data-testid="tab-backtest">
            <History className="h-2.5 w-2.5 mr-0.5" />
            Historical
          </TabsTrigger>
          <TabsTrigger value="expected-move" className="text-[10px] h-6 px-2 sm:px-1 whitespace-nowrap" data-testid="tab-expected-move">
            <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
            Expected
          </TabsTrigger>
          <TabsTrigger value="volatility-skew" className="text-[10px] h-6 px-2 sm:px-1 whitespace-nowrap" data-testid="tab-volatility-skew">
            <BarChart3 className="h-2.5 w-2.5 mr-0.5" />
            Vol Skew
          </TabsTrigger>
          <TabsTrigger value="open-interest" className="text-[10px] h-6 px-2 sm:px-1 whitespace-nowrap" data-testid="tab-open-interest">
            <Users className="h-2.5 w-2.5 mr-0.5" />
            OI
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="greeks" className="mt-2">
        <GreeksDashboard 
          greeks={greeks} 
          legs={legs}
          metrics={metrics}
          currentPrice={currentPrice}
          volatility={volatility}
        />
      </TabsContent>

      <TabsContent value="backtest" className="mt-2">
        <HistoricalPriceTab
          symbol={symbol}
          currentPrice={currentPrice}
          legs={legs}
          volatility={volatility}
        />
      </TabsContent>

      <TabsContent value="expected-move" className="mt-2">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="bg-primary/10 text-primary">
              Expected Move (1σ)
            </Badge>
            <UITooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" data-testid="icon-expected-move-info" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                <p>Expected Move represents the market's prediction of how far a stock's price might move by expiration. It's derived from ATM options prices using: 60% × ATM Straddle + 30% × 1st OTM Strangle + 10% × 2nd OTM Strangle. There's a 68% probability the stock stays within this range.</p>
              </TooltipContent>
            </UITooltip>
          </div>
          
          {expectedMove ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                <strong>{symbol}</strong> stock is expected to move{" "}
                <strong>±${expectedMove.expectedMove.toFixed(2)} ({expectedMove.movePercent.toFixed(2)}%)</strong>{" "}
                by <strong>{formatDate(expectedMove.expirationDate)}</strong> ({expectedMove.daysToExpiration} days),{" "}
                with a 68% probability of staying within{" "}
                <strong>${expectedMove.lowerBound.toFixed(2)} - ${expectedMove.upperBound.toFixed(2)}</strong>.
              </p>
              <p className="text-xs text-muted-foreground mb-2 italic">
                (Using nearest market expiration - independent of your strategy)
              </p>

              {/* Binary Expected Move Breakdown */}
              <div className="mb-4 p-3 bg-muted/20 rounded-lg border text-xs">
                <p className="font-medium mb-2">Calculation Breakdown</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-muted-foreground mb-2">
                  <div>
                    <span className="block text-[10px] uppercase">ATM Straddle (60%)</span>
                    <span className="font-mono text-foreground">${(expectedMove.atmCall + expectedMove.atmPut).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase">1st OTM Strangle (30%)</span>
                    <span className="font-mono text-foreground">
                      {expectedMove.otm1Strangle !== null ? `$${expectedMove.otm1Strangle.toFixed(2)}` : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase">2nd OTM Strangle (10%)</span>
                    <span className="font-mono text-foreground">
                      {expectedMove.otm2Strangle !== null ? `$${expectedMove.otm2Strangle.toFixed(2)}` : 'N/A'}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {expectedMove.otm1Strangle !== null && expectedMove.otm2Strangle !== null ? (
                    <>Formula: 0.6 × ${(expectedMove.atmCall + expectedMove.atmPut).toFixed(2)} + 0.3 × ${expectedMove.otm1Strangle.toFixed(2)} + 0.1 × ${expectedMove.otm2Strangle.toFixed(2)} = ${expectedMove.expectedMove.toFixed(2)}</>
                  ) : expectedMove.otm1Strangle !== null ? (
                    <>Formula: 0.7 × ${(expectedMove.atmCall + expectedMove.atmPut).toFixed(2)} + 0.3 × ${expectedMove.otm1Strangle.toFixed(2)} = ${expectedMove.expectedMove.toFixed(2)}</>
                  ) : expectedMove.otm2Strangle !== null ? (
                    <>Formula: 0.9 × ${(expectedMove.atmCall + expectedMove.atmPut).toFixed(2)} + 0.1 × ${expectedMove.otm2Strangle.toFixed(2)} = ${expectedMove.expectedMove.toFixed(2)}</>
                  ) : (
                    <>Formula: ATM Straddle = ${(expectedMove.atmCall + expectedMove.atmPut).toFixed(2)}</>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <p className="text-xs text-muted-foreground mb-1">Expected Move (1σ)</p>
                  <p className="text-xl font-bold font-mono text-primary">±${expectedMove.expectedMove.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ${expectedMove.lowerBound.toFixed(2)} - ${expectedMove.upperBound.toFixed(2)}
                  </p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <p className="text-xs text-muted-foreground mb-1">Current Price</p>
                  <p className="text-xl font-bold font-mono">${expectedMove.currentPrice.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {expectedMove.daysToExpiration} days to expiration
                  </p>
                </div>
              </div>

              {/* Expected Move Chart */}
              <div className="h-48 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={expectedMoveChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-[10px]" />
                    <YAxis 
                      className="text-[10px]" 
                      domain={['auto', 'auto']}
                      tickFormatter={(v) => `$${v.toFixed(0)}`}
                    />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        return (
                          <div className="bg-card border rounded-md p-2 shadow-lg text-xs">
                            <div className="font-medium mb-1">{label}</div>
                            {payload.map((entry: any, index: number) => {
                              const value = entry.value as number;
                              const percentDiff = ((value - currentPrice) / currentPrice) * 100;
                              const isUpper = entry.dataKey === 'upper';
                              return (
                                <div key={index} className="flex justify-between gap-3">
                                  <span className={isUpper ? "text-green-500" : "text-red-500"}>
                                    {isUpper ? 'Upper Bound' : 'Lower Bound'}:
                                  </span>
                                  <span className="font-mono">
                                    ${value.toFixed(2)}{" "}
                                    <span className={percentDiff >= 0 ? "text-green-500" : "text-red-500"}>
                                      ({percentDiff >= 0 ? "+" : ""}{percentDiff.toFixed(2)}%)
                                    </span>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="upper" 
                      stroke="hsl(142.1 76.2% 36.3%)" 
                      fill="hsl(142.1 76.2% 36.3% / 0.2)"
                      strokeWidth={2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="lower" 
                      stroke="hsl(0 84.2% 60.2%)" 
                      fill="hsl(0 84.2% 60.2% / 0.2)"
                      strokeWidth={2}
                    />
                    <ReferenceLine 
                      y={currentPrice} 
                      stroke="hsl(var(--primary))" 
                      strokeDasharray="5 5"
                      strokeWidth={1}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-green-500"></div>
                  <span>Upper Price</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-red-500"></div>
                  <span>Lower Price</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-primary border-dashed border-t"></div>
                  <span>Current Price</span>
                </div>
              </div>
            </>
          ) : (
            <div className="h-32 flex items-center justify-center bg-muted/30 rounded-md">
              <p className="text-xs text-muted-foreground">Select an expiration date to see expected move</p>
            </div>
          )}
        </Card>
      </TabsContent>

      <TabsContent value="volatility-skew" className="mt-2">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Volatility Skew</h3>
              <Badge variant="outline" className="text-xs">{symbol}</Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              ATM IV: {(volatility * 100).toFixed(1)}%
            </span>
          </div>
          
          {volatilitySkewData.length > 0 ? (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={volatilitySkewData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="strike" 
                      className="text-[10px]"
                      tickFormatter={(v) => `$${v}`}
                    />
                    <YAxis 
                      className="text-[10px]"
                      domain={['auto', 'auto']}
                      tickFormatter={(v) => `${v.toFixed(0)}%`}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        `${value.toFixed(1)}%`,
                        name === 'putIV' ? 'Put IV' : 'Call IV'
                      ]}
                      labelFormatter={(label) => `Strike: $${label}`}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '11px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="putIV" 
                      stroke="hsl(0 84.2% 60.2%)" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(0 84.2% 60.2%)', r: 3 }}
                      connectNulls
                    />
                    <Line 
                      type="monotone" 
                      dataKey="callIV" 
                      stroke="hsl(142.1 76.2% 36.3%)" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(142.1 76.2% 36.3%)', r: 3 }}
                      connectNulls
                    />
                    {currentPrice && (
                      <ReferenceLine 
                        x={Math.round(currentPrice / 5) * 5}
                        stroke="hsl(var(--primary))" 
                        strokeDasharray="5 5"
                        strokeWidth={1}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-red-500"></div>
                  <span>Put IV</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-green-500"></div>
                  <span>Call IV</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                The volatility skew shows how implied volatility varies across strike prices.
                OTM puts typically have higher IV (put skew).
              </p>
            </>
          ) : (
            <div className="h-32 flex items-center justify-center bg-muted/30 rounded-md">
              <p className="text-xs text-muted-foreground">Loading volatility skew data...</p>
            </div>
          )}
        </Card>
      </TabsContent>

      <TabsContent value="open-interest" className="mt-2">
        <Card className="p-3">
          <h3 className="text-sm font-semibold mb-2">Open Interest</h3>
          <div className="h-32 flex items-center justify-center bg-muted/30 rounded-md">
            <p className="text-xs text-muted-foreground">Open interest chart</p>
          </div>
        </Card>
      </TabsContent>

    </Tabs>
  );
}
