import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, TrendingUp, BarChart3, FileText, PieChart, Users, Building2, ExternalLink } from "lucide-react";
import type { Greeks, MarketOptionChainSummary } from "@shared/schema";
import { GreeksDashboard } from "./GreeksDashboard";
import { useQuery } from "@tanstack/react-query";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine,
  Area,
  AreaChart,
  ComposedChart,
  Bar
} from "recharts";
import { useMemo } from "react";

interface CompanyFundamentals {
  symbol: string;
  name: string;
  logo?: string;
  exchange?: string;
  industry?: string;
  marketCap?: number;
  currency?: string;
  country?: string;
  weburl?: string;
  ipo?: string;
  shareOutstanding?: number;
  peRatio?: number;
  eps?: number;
  epsGrowth?: number;
  revenueGrowth?: number;
  profitMargin?: number;
  roe?: number;
  roa?: number;
  debtToEquity?: number;
  currentRatio?: number;
  quickRatio?: number;
  dividendYield?: number;
  beta?: number;
  high52Week?: number;
  low52Week?: number;
  priceToBook?: number;
  priceToSales?: number;
}

interface StockCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandleResponse {
  symbol: string;
  resolution: string;
  candles: StockCandle[];
}

interface AnalysisTabsProps {
  greeks: Greeks;
  symbol?: string;
  currentPrice?: number;
  volatility?: number;
  expirationDate?: string | null;
  optionsChainData?: MarketOptionChainSummary;
}

export function AnalysisTabs({ 
  greeks, 
  symbol = "AAPL",
  currentPrice = 185,
  volatility = 0.30,
  expirationDate,
  optionsChainData
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

  // Fetch company fundamentals for Financials tab
  const effectiveSymbol = symbol || 'AAPL';
  const { data: fundamentals, isLoading: fundamentalsLoading } = useQuery<CompanyFundamentals>({
    queryKey: [`/api/stock/fundamentals/${effectiveSymbol}`],
    enabled: !!effectiveSymbol && effectiveSymbol.length > 0,
  });

  // Fetch historical candle data for stock chart
  const { data: candleData, isLoading: candlesLoading } = useQuery<CandleResponse>({
    queryKey: [`/api/stock/candles/${effectiveSymbol}`],
    enabled: !!effectiveSymbol && effectiveSymbol.length > 0,
  });

  // Prepare chart data from candles
  const chartData = useMemo(() => {
    if (!candleData?.candles || candleData.candles.length === 0) return [];
    return candleData.candles.map(candle => ({
      date: new Date(candle.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      timestamp: candle.timestamp,
      price: candle.close,
      volume: candle.volume,
    }));
  }, [candleData]);

  const formatMarketCap = (value?: number) => {
    if (!value) return 'N/A';
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toLocaleString()}`;
  };

  const formatPercent = (value?: number) => {
    if (value === undefined || value === null) return 'N/A';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const formatNumber = (value?: number, decimals = 2) => {
    if (value === undefined || value === null || isNaN(value)) return 'N/A';
    return value.toFixed(decimals);
  };

  return (
    <Tabs defaultValue="greeks" className="w-full">
      <TabsList className="grid w-full grid-cols-7 h-7">
        <TabsTrigger value="greeks" className="text-[10px] h-6" data-testid="tab-greeks">
          <Activity className="h-2.5 w-2.5 mr-0.5" />
          Greeks
        </TabsTrigger>
        <TabsTrigger value="expected-move" className="text-[10px] h-6" data-testid="tab-expected-move">
          <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
          Expected
        </TabsTrigger>
        <TabsTrigger value="volatility-skew" className="text-[10px] h-6" data-testid="tab-volatility-skew">
          <BarChart3 className="h-2.5 w-2.5 mr-0.5" />
          Vol Skew
        </TabsTrigger>
        <TabsTrigger value="financials" className="text-[10px] h-6" data-testid="tab-financials">
          <Building2 className="h-2.5 w-2.5 mr-0.5" />
          Financials
        </TabsTrigger>
        <TabsTrigger value="option-overview" className="text-[10px] h-6" data-testid="tab-option-overview">
          <FileText className="h-2.5 w-2.5 mr-0.5" />
          Overview
        </TabsTrigger>
        <TabsTrigger value="analysis" className="text-[10px] h-6" data-testid="tab-analysis">
          <PieChart className="h-2.5 w-2.5 mr-0.5" />
          Analysis
        </TabsTrigger>
        <TabsTrigger value="open-interest" className="text-[10px] h-6" data-testid="tab-open-interest">
          <Users className="h-2.5 w-2.5 mr-0.5" />
          OI
        </TabsTrigger>
      </TabsList>

      <TabsContent value="greeks" className="mt-2">
        <GreeksDashboard greeks={greeks} />
      </TabsContent>

      <TabsContent value="expected-move" className="mt-2">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="bg-primary/10 text-primary">
              Expected Move
            </Badge>
          </div>
          
          {expectedMove ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                The expected move for <strong>{symbol}</strong> options expiring on{" "}
                <strong>{formatDate(expirationDate)}</strong> ({expectedMove.daysToExpiration} days) is{" "}
                <strong>±${expectedMove.move1SD.toFixed(2)} ({expectedMove.movePercent.toFixed(2)}%)</strong>,{" "}
                with a price range of{" "}
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
                      formatter={(value: number, name: string) => [
                        `$${value.toFixed(2)}`,
                        name === 'upper' ? 'Upper Bound' : 'Lower Bound'
                      ]}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '11px'
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

      <TabsContent value="financials" className="mt-2">
        <div className="max-h-[400px] overflow-y-auto space-y-3 pr-1">
          <Card className="p-3">
            {fundamentalsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-2 gap-2">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              </div>
            ) : fundamentals ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  {fundamentals.logo && (
                    <img 
                      src={fundamentals.logo} 
                      alt={fundamentals.name} 
                      className="h-8 w-8 rounded object-contain"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{fundamentals.name}</h3>
                      <Badge variant="outline" className="text-[10px]">{fundamentals.symbol}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {fundamentals.exchange && <span>{fundamentals.exchange}</span>}
                      {fundamentals.industry && <span>• {fundamentals.industry}</span>}
                      {fundamentals.weburl && (
                        <a 
                          href={fundamentals.weburl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-0.5 text-primary hover:underline"
                        >
                          Website <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3">
                  <div className="p-2 bg-muted/30 rounded-md">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Market Cap</p>
                    <p className="text-sm font-bold font-mono">{formatMarketCap(fundamentals.marketCap)}</p>
                  </div>
                  <div className="p-2 bg-muted/30 rounded-md">
                    <p className="text-[10px] text-muted-foreground mb-0.5">P/E Ratio</p>
                    <p className="text-sm font-bold font-mono">{formatNumber(fundamentals.peRatio)}</p>
                  </div>
                  <div className="p-2 bg-muted/30 rounded-md">
                    <p className="text-[10px] text-muted-foreground mb-0.5">EPS</p>
                    <p className="text-sm font-bold font-mono">${formatNumber(fundamentals.eps)}</p>
                  </div>
                  <div className="p-2 bg-muted/30 rounded-md">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Dividend</p>
                    <p className="text-sm font-bold font-mono">
                      {fundamentals.dividendYield ? `${formatNumber(fundamentals.dividendYield, 2)}%` : 'N/A'}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-16 flex items-center justify-center bg-muted/30 rounded-md">
                <p className="text-xs text-muted-foreground">No fundamentals data available for {symbol}</p>
              </div>
            )}
          </Card>

          <Card className="p-3">
            <p className="text-xs font-semibold mb-2">6-Month Price Chart</p>
            {candlesLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : chartData.length > 0 ? (
              <div className="h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <defs>
                      <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(168 76% 42%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(168 76% 42%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 9 }} 
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      tick={{ fontSize: 9 }} 
                      tickLine={false}
                      axisLine={false}
                      domain={['auto', 'auto']}
                      tickFormatter={(value) => `$${value}`}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{ 
                        background: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '4px',
                        fontSize: '10px'
                      }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="hsl(168 76% 42%)"
                      strokeWidth={2}
                      fill="url(#priceGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-28 flex items-center justify-center bg-muted/30 rounded-md">
                <p className="text-xs text-muted-foreground">No chart data available</p>
              </div>
            )}
          </Card>

          <Card className="p-3">
            <p className="text-xs font-semibold mb-2">Key Ratios</p>
            {fundamentals ? (
              <div className="grid grid-cols-4 gap-x-3 gap-y-1.5 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">P/E</span>
                  <span className="font-mono">{formatNumber(fundamentals.peRatio)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">P/B</span>
                  <span className="font-mono">{formatNumber(fundamentals.priceToBook)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">P/S</span>
                  <span className="font-mono">{formatNumber(fundamentals.priceToSales)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Beta</span>
                  <span className="font-mono">{formatNumber(fundamentals.beta)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ROE</span>
                  <span className="font-mono">{formatNumber(fundamentals.roe)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ROA</span>
                  <span className="font-mono">{formatNumber(fundamentals.roa)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Margin</span>
                  <span className="font-mono">{formatNumber(fundamentals.profitMargin)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">D/E</span>
                  <span className="font-mono">{formatNumber(fundamentals.debtToEquity)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No data available</p>
            )}
          </Card>

          <Card className="p-3">
            <p className="text-xs font-semibold mb-2">52-Week Range</p>
            {fundamentals && fundamentals.low52Week && fundamentals.high52Week ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-loss font-mono">${formatNumber(fundamentals.low52Week, 2)}</span>
                  <span className="text-muted-foreground">52W Range</span>
                  <span className="text-profit font-mono">${formatNumber(fundamentals.high52Week, 2)}</span>
                </div>
                <div className="relative h-2 bg-muted/50 rounded-full">
                  {(() => {
                    const rangeWidth = fundamentals.high52Week - fundamentals.low52Week;
                    const position = currentPrice && rangeWidth > 0
                      ? Math.min(100, Math.max(0, ((currentPrice - fundamentals.low52Week) / rangeWidth) * 100))
                      : 50;
                    return (
                      <>
                        <div 
                          className="absolute h-full bg-gradient-to-r from-loss/50 via-primary/50 to-profit/50 rounded-full"
                          style={{ width: `${position}%` }}
                        />
                        <div 
                          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full border-2 border-background"
                          style={{ left: `${position}%` }}
                        />
                      </>
                    );
                  })()}
                </div>
                <p className="text-[10px] text-muted-foreground text-center">
                  Current: <span className="font-mono font-medium">${currentPrice?.toFixed(2) || 'N/A'}</span>
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">52-week range data not available</p>
            )}
          </Card>

          <Card className="p-3">
            <p className="text-xs font-semibold mb-2">Liquidity Ratios</p>
            {fundamentals ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-muted/30 rounded-md">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Current Ratio</p>
                  <p className="text-sm font-bold font-mono">{formatNumber(fundamentals.currentRatio)}</p>
                </div>
                <div className="p-2 bg-muted/30 rounded-md">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Quick Ratio</p>
                  <p className="text-sm font-bold font-mono">{formatNumber(fundamentals.quickRatio)}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No data available</p>
            )}
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="option-overview" className="mt-2">
        <Card className="p-3">
          <h3 className="text-sm font-semibold mb-2">Option Overview</h3>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center p-2 bg-muted/30 rounded-md">
              <span className="text-xs font-medium">Total Contracts</span>
              <span className="text-xs font-mono font-semibold">2</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted/30 rounded-md">
              <span className="text-xs font-medium">Total Premium</span>
              <span className="text-xs font-mono font-semibold">$350.00</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted/30 rounded-md">
              <span className="text-xs font-medium">Margin Requirement</span>
              <span className="text-xs font-mono font-semibold">$2,500.00</span>
            </div>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="analysis" className="mt-2">
        <Card className="p-3">
          <h3 className="text-sm font-semibold mb-2">Strategy Analysis</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-muted/30 rounded-md">
              <p className="text-[10px] text-muted-foreground mb-0.5">Win Rate</p>
              <p className="text-lg font-bold">68%</p>
            </div>
            <div className="p-2 bg-muted/30 rounded-md">
              <p className="text-[10px] text-muted-foreground mb-0.5">Average Return</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-500">+12.3%</p>
            </div>
          </div>
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
