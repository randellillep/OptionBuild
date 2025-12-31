import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, BarChart3, AlertTriangle, Users, History, Info } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Greeks, MarketOptionChainSummary, OptionLeg } from "@shared/schema";
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

interface AnalysisTabsProps {
  greeks: Greeks;
  symbol?: string;
  currentPrice?: number;
  volatility?: number;
  expirationDate?: string | null;
  optionsChainData?: MarketOptionChainSummary;
  legs?: OptionLeg[];
}

export function AnalysisTabs({ 
  greeks, 
  symbol = "AAPL",
  currentPrice = 185,
  volatility = 0.30,
  expirationDate,
  optionsChainData,
  legs = []
}: AnalysisTabsProps) {
  
  // Calculate expected move based on volatility and time to expiration
  const expectedMove = useMemo(() => {
    if (!expirationDate || !currentPrice) return null;
    
    const today = new Date();
    const expDate = new Date(expirationDate);
    const daysToExpiration = Math.max(1, Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Expected move = Price * IV * sqrt(DTE/365)
    const annualizedFactor = Math.sqrt(daysToExpiration / 365);
    const expectedMove1SD = currentPrice * volatility * annualizedFactor;
    const expectedMove2SD = expectedMove1SD * 2;
    
    // Calculate price range
    const lowerBound1SD = currentPrice - expectedMove1SD;
    const upperBound1SD = currentPrice + expectedMove1SD;
    const lowerBound2SD = currentPrice - expectedMove2SD;
    const upperBound2SD = currentPrice + expectedMove2SD;
    
    const movePercent = (expectedMove1SD / currentPrice) * 100;
    
    return {
      move1SD: expectedMove1SD,
      move2SD: expectedMove2SD,
      lowerBound1SD,
      upperBound1SD,
      lowerBound2SD,
      upperBound2SD,
      movePercent,
      daysToExpiration,
    };
  }, [currentPrice, volatility, expirationDate]);

  // Generate expected move projection data for chart
  const expectedMoveChartData = useMemo(() => {
    if (!expectedMove || !currentPrice) return [];
    
    const months = ['Jan 25', 'Apr 25', 'Jul 25', 'Oct 25', 'Jan 26', 'Apr 26', 'Jul 26', 'Oct 26', 'Jan 27'];
    
    return months.map((month, index) => {
      const timeMultiplier = Math.sqrt((index + 1) * 90 / 365);
      const projectedUpper = currentPrice * (1 + volatility * timeMultiplier);
      const projectedLower = currentPrice * (1 - volatility * timeMultiplier * 0.8); // Asymmetric for realism
      
      return {
        month,
        price: index === 0 ? currentPrice : undefined,
        upper: projectedUpper,
        lower: projectedLower,
      };
    });
  }, [currentPrice, volatility, expectedMove]);

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

  // Calculate risk metrics from current strategy
  const riskMetrics = useMemo(() => {
    const activeLegs = legs.filter(leg => !leg.isExcluded && leg.premium > 0);
    if (activeLegs.length === 0) return null;

    const totalPremium = activeLegs.reduce((sum, leg) => {
      const legPremium = leg.premium * leg.quantity * 100;
      return sum + (leg.position === 'long' ? -legPremium : legPremium);
    }, 0);

    const maxLoss = activeLegs.some(l => l.position === 'long' && l.type === 'call') 
      ? Math.abs(totalPremium)
      : activeLegs.some(l => l.position === 'short') 
        ? 'Unlimited' 
        : Math.abs(totalPremium);

    const breakevens = activeLegs.map(leg => {
      if (leg.type === 'call') {
        return leg.position === 'long' 
          ? leg.strike + leg.premium
          : leg.strike + leg.premium;
      } else {
        return leg.position === 'long'
          ? leg.strike - leg.premium
          : leg.strike - leg.premium;
      }
    });

    return {
      totalPremium,
      maxLoss,
      breakevens: Array.from(new Set(breakevens)).sort((a, b) => a - b),
      contractCount: activeLegs.reduce((sum, l) => sum + l.quantity, 0),
      hasShortPositions: activeLegs.some(l => l.position === 'short'),
      hasLongPositions: activeLegs.some(l => l.position === 'long'),
    };
  }, [legs]);

  return (
    <Tabs defaultValue="greeks" className="w-full">
      <TabsList className="grid w-full grid-cols-6 h-7">
        <TabsTrigger value="greeks" className="text-[10px] h-6" data-testid="tab-greeks">
          <Activity className="h-2.5 w-2.5 mr-0.5" />
          Greeks
        </TabsTrigger>
        <TabsTrigger value="backtest" className="text-[10px] h-6" data-testid="tab-backtest">
          <History className="h-2.5 w-2.5 mr-0.5" />
          Historical Price
        </TabsTrigger>
        <TabsTrigger value="expected-move" className="text-[10px] h-6" data-testid="tab-expected-move">
          <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
          Expected
        </TabsTrigger>
        <TabsTrigger value="volatility-skew" className="text-[10px] h-6" data-testid="tab-volatility-skew">
          <BarChart3 className="h-2.5 w-2.5 mr-0.5" />
          Vol Skew
        </TabsTrigger>
        <TabsTrigger value="risks" className="text-[10px] h-6" data-testid="tab-risks">
          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
          Risks
        </TabsTrigger>
        <TabsTrigger value="open-interest" className="text-[10px] h-6" data-testid="tab-open-interest">
          <Users className="h-2.5 w-2.5 mr-0.5" />
          OI
        </TabsTrigger>
      </TabsList>

      <TabsContent value="greeks" className="mt-2">
        <GreeksDashboard greeks={greeks} />
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
              Expected Stock Move
            </Badge>
            <UITooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" data-testid="icon-expected-move-info" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                <p>Based on implied volatility, this shows the expected price range for the underlying stock by expiration. There's a 68% probability the stock stays within 1 standard deviation, and 95% within 2 standard deviations.</p>
              </TooltipContent>
            </UITooltip>
          </div>
          
          {expectedMove ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Based on current implied volatility, <strong>{symbol}</strong> stock is expected to move{" "}
                <strong>±${expectedMove.move1SD.toFixed(2)} ({expectedMove.movePercent.toFixed(2)}%)</strong>{" "}
                by <strong>{formatDate(expirationDate)}</strong> ({expectedMove.daysToExpiration} days),{" "}
                with a projected price range of{" "}
                <strong>${expectedMove.lowerBound1SD.toFixed(2)} - ${expectedMove.upperBound1SD.toFixed(2)}</strong>.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <p className="text-xs text-muted-foreground mb-1">1 Standard Deviation (68%)</p>
                  <p className="text-xl font-bold font-mono text-primary">±${expectedMove.move1SD.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ${expectedMove.lowerBound1SD.toFixed(2)} - ${expectedMove.upperBound1SD.toFixed(2)}
                  </p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <p className="text-xs text-muted-foreground mb-1">2 Standard Deviations (95%)</p>
                  <p className="text-xl font-bold font-mono">±${expectedMove.move2SD.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ${expectedMove.lowerBound2SD.toFixed(2)} - ${expectedMove.upperBound2SD.toFixed(2)}
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

      <TabsContent value="risks" className="mt-2">
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold">Risk Analysis</h3>
          </div>
          
          {riskMetrics ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-muted/30 rounded-md">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Total Premium</p>
                  <p className={`text-lg font-bold font-mono ${riskMetrics.totalPremium >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {riskMetrics.totalPremium >= 0 ? '+' : ''}${riskMetrics.totalPremium.toFixed(0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {riskMetrics.totalPremium >= 0 ? 'Credit received' : 'Debit paid'}
                  </p>
                </div>
                <div className="p-2 bg-muted/30 rounded-md">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Max Loss</p>
                  <p className={`text-lg font-bold font-mono ${riskMetrics.maxLoss === 'Unlimited' ? 'text-loss' : ''}`}>
                    {riskMetrics.maxLoss === 'Unlimited' ? 'Unlimited' : `-$${(riskMetrics.maxLoss as number).toFixed(0)}`}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {riskMetrics.hasShortPositions ? 'Short exposure' : 'Limited risk'}
                  </p>
                </div>
              </div>

              <div className="p-2 bg-muted/30 rounded-md">
                <p className="text-[10px] text-muted-foreground mb-1">Breakeven Points</p>
                <div className="flex flex-wrap gap-2">
                  {riskMetrics.breakevens.map((be, i) => (
                    <Badge key={i} variant="outline" className="font-mono text-xs">
                      ${be.toFixed(2)}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div className="p-2 bg-muted/30 rounded-md text-center">
                  <p className="text-muted-foreground mb-0.5">Contracts</p>
                  <p className="font-bold font-mono">{riskMetrics.contractCount}</p>
                </div>
                <div className="p-2 bg-muted/30 rounded-md text-center">
                  <p className="text-muted-foreground mb-0.5">IV</p>
                  <p className="font-bold font-mono">{(volatility * 100).toFixed(0)}%</p>
                </div>
                <div className="p-2 bg-muted/30 rounded-md text-center">
                  <p className="text-muted-foreground mb-0.5">DTE</p>
                  <p className="font-bold font-mono">{expectedMove?.daysToExpiration || 'N/A'}</p>
                </div>
              </div>

              {riskMetrics.hasShortPositions && (
                <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-md">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      This strategy includes short positions with potentially unlimited risk.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-24 flex items-center justify-center bg-muted/30 rounded-md">
              <p className="text-xs text-muted-foreground">Add option legs to see risk analysis</p>
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
