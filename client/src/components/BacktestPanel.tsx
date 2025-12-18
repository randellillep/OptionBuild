import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from "recharts";
import { Play, TrendingUp, TrendingDown, Activity, Calendar, AlertCircle, Loader2 } from "lucide-react";
import type { OptionLeg, BacktestResult } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface BacktestPanelProps {
  symbol: string;
  currentPrice: number;
  legs: OptionLeg[];
  volatility: number;
  expirationDate: string | null;
}

interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  positive?: boolean;
  neutral?: boolean;
}

function MetricCard({ label, value, subValue, icon, positive, neutral }: MetricCardProps) {
  const colorClass = neutral 
    ? "text-foreground" 
    : positive 
      ? "text-green-600 dark:text-green-500" 
      : "text-red-600 dark:text-red-500";
  
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
      <div className="p-2 rounded-md bg-background">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-semibold ${colorClass}`}>{value}</p>
        {subValue && (
          <p className="text-xs text-muted-foreground">{subValue}</p>
        )}
      </div>
    </div>
  );
}

export function BacktestPanel({ symbol, currentPrice, legs, volatility, expirationDate }: BacktestPanelProps) {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const today = new Date();
  const defaultEndDate = today.toISOString().split('T')[0];
  const defaultStartDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [ivOverride, setIvOverride] = useState(Math.round(volatility * 100));

  const activeLegs = useMemo(() => {
    return legs.filter(leg => !leg.isExcluded && leg.premium > 0);
  }, [legs]);

  const canRunBacktest = activeLegs.length > 0 && startDate && endDate && currentPrice > 0;

  const runBacktest = async () => {
    if (!canRunBacktest) return;
    
    setIsRunning(true);
    setError(null);
    
    try {
      const response = await apiRequest("POST", "/api/backtest", {
        symbol,
        legs: activeLegs,
        startDate,
        endDate,
        initialVolatility: ivOverride / 100,
        entryPrice: currentPrice,
      });
      
      const data: BacktestResult = await response.json();
      
      setResult(data);
      toast({
        title: "Backtest Complete",
        description: `Analyzed ${data.dataPoints.length} trading days`,
      });
    } catch (err: any) {
      const errorMessage = err.message || "Failed to run backtest";
      setError(errorMessage);
      toast({
        title: "Backtest Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.dataPoints.map(dp => ({
      date: dp.date,
      pnl: dp.pnl,
      price: dp.underlyingPrice,
      dte: dp.daysToExpiration,
    }));
  }, [result]);

  const formatCurrency = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}$${Math.abs(value).toFixed(0)}`;
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start-date" className="text-sm">Start Date</Label>
          <Input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            max={endDate}
            data-testid="input-backtest-start-date"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="end-date" className="text-sm">End Date</Label>
          <Input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
            max={defaultEndDate}
            data-testid="input-backtest-end-date"
          />
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm">Implied Volatility: {ivOverride}%</Label>
          <Slider
            value={[ivOverride]}
            onValueChange={([val]) => setIvOverride(val)}
            min={10}
            max={150}
            step={1}
            className="mt-3"
            data-testid="slider-backtest-iv"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button
          onClick={runBacktest}
          disabled={!canRunBacktest || isRunning}
          data-testid="button-run-backtest"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run Backtest
            </>
          )}
        </Button>
        
        {activeLegs.length === 0 && (
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>Add option legs with prices to run backtest</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              label="Total Return"
              value={formatCurrency(result.metrics.totalReturn)}
              subValue={formatPercent(result.metrics.totalReturnPercent)}
              icon={result.metrics.totalReturn >= 0 ? 
                <TrendingUp className="h-4 w-4 text-green-600" /> : 
                <TrendingDown className="h-4 w-4 text-red-600" />
              }
              positive={result.metrics.totalReturn >= 0}
            />
            
            <MetricCard
              label="Max Drawdown"
              value={formatCurrency(-result.metrics.maxDrawdown)}
              subValue={formatPercent(-result.metrics.maxDrawdownPercent)}
              icon={<TrendingDown className="h-4 w-4 text-red-600" />}
              positive={false}
            />
            
            <MetricCard
              label="Max Gain"
              value={formatCurrency(result.metrics.maxGain)}
              icon={<TrendingUp className="h-4 w-4 text-green-600" />}
              positive={true}
            />
            
            <MetricCard
              label="Win Rate"
              value={`${result.metrics.winRate.toFixed(0)}%`}
              subValue={`${result.metrics.daysInTrade} days`}
              icon={<Activity className="h-4 w-4 text-primary" />}
              neutral={true}
            />
          </div>

          <Card className="p-4">
            <h4 className="text-sm font-medium mb-4">P/L Over Time</h4>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'pnl') return [`$${value.toFixed(2)}`, 'P/L'];
                      if (name === 'price') return [`$${value.toFixed(2)}`, 'Price'];
                      return [value, name];
                    }}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <Area
                    type="monotone"
                    dataKey="pnl"
                    stroke="hsl(var(--primary))"
                    fill="url(#pnlGradient)"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-muted-foreground text-xs">Sharpe Ratio</p>
              <p className="font-medium">{result.metrics.sharpeRatio.toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-muted-foreground text-xs">Avg Daily Return</p>
              <p className="font-medium">{formatPercent(result.metrics.avgDailyReturn)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-muted-foreground text-xs">Volatility (Ann.)</p>
              <p className="font-medium">{result.metrics.volatility.toFixed(1)}%</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-muted-foreground text-xs">Entry → Exit Price</p>
              <p className="font-medium">${result.entryPrice.toFixed(2)} → ${result.exitPrice.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
