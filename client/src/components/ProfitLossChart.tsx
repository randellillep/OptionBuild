import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { OptionLeg, StrategyMetrics } from "@shared/schema";
import { calculateProfitLoss } from "@/lib/options-pricing";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Table, BarChart3, RotateCcw } from "lucide-react";

interface ProfitLossChartProps {
  legs: OptionLeg[];
  underlyingPrice: number;
  activeTab: "heatmap" | "chart";
  onTabChange: (tab: "heatmap" | "chart") => void;
  range: number;
  onRangeChange: (value: number) => void;
  impliedVolatility: number;
  onVolatilityChange: (value: number) => void;
  calculatedIV: number;
  onResetIV: () => void;
  isManualVolatility?: boolean;
  metrics?: StrategyMetrics;
}

export function ProfitLossChart({ 
  legs, 
  underlyingPrice,
  activeTab,
  onTabChange,
  range,
  onRangeChange,
  impliedVolatility,
  onVolatilityChange,
  calculatedIV,
  onResetIV,
  isManualVolatility = false,
  metrics,
}: ProfitLossChartProps) {
  const [isDraggingIV, setIsDraggingIV] = useState(false);
  const handlePointerUp = useCallback(() => setIsDraggingIV(false), []);
  useEffect(() => {
    if (isDraggingIV) {
      window.addEventListener("pointerup", handlePointerUp);
      return () => window.removeEventListener("pointerup", handlePointerUp);
    }
  }, [isDraggingIV, handlePointerUp]);
  const ivShift = calculatedIV ? impliedVolatility - calculatedIV : 0;
  const ivShiftText = ivShift > 0 ? `+${ivShift.toFixed(1)}%` : `${ivShift.toFixed(1)}%`;
  const ivSliderPercent = ((impliedVolatility - 5) / (150 - 5)) * 100;

  const minPrice = underlyingPrice * 0.7;
  const maxPrice = underlyingPrice * 1.3;
  const points = 100;

  const data = Array.from({ length: points }, (_, i) => {
    const price = minPrice + (maxPrice - minPrice) * (i / (points - 1));
    const pnl = calculateProfitLoss(legs, underlyingPrice, price);
    return {
      price: Number(price.toFixed(2)),
      pnl: Number(pnl.toFixed(2)),
    };
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const isProfit = payload[0].value >= 0;
      return (
        <div className="bg-popover border border-popover-border rounded-md p-3 shadow-md">
          <p className="text-sm font-medium mb-1">
            Stock Price: <span className="font-mono">${payload[0].payload.price}</span>
          </p>
          <p className={`text-sm font-semibold font-mono ${isProfit ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
            P/L: ${payload[0].value.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-3">
      {/* Header with metrics and tab buttons */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-4" data-testid="strategy-metrics-bar">
          {metrics && metrics.maxProfit === null && metrics.maxLoss === null && metrics.netPremium === 0 ? (
            <span className="text-sm text-muted-foreground italic">
              This strategy has no enabled items (add options from the Add button)
            </span>
          ) : metrics ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Max Profit:</span>
                <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-500" data-testid="text-max-profit">
                  {metrics.maxProfit !== null ? `$${metrics.maxProfit.toFixed(0)}` : "∞"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Max Loss:</span>
                <span className="text-base font-bold font-mono text-rose-600 dark:text-rose-500" data-testid="text-max-loss">
                  {metrics.maxLoss !== null ? `$${metrics.maxLoss.toFixed(0)}` : "∞"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Breakeven:</span>
                <span className="text-base font-semibold font-mono" data-testid="text-breakeven">
                  {metrics.breakeven.length > 0 
                    ? metrics.breakeven.slice(0, 2).map(p => `$${p.toFixed(0)}`).join(', ')
                    : "N/A"
                  }
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Net:</span>
                <span className={`text-base font-bold font-mono ${metrics.netPremium >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`} data-testid="text-net-premium">
                  ${metrics.netPremium.toFixed(0)}
                </span>
                <span className="text-xs text-muted-foreground/70">
                  {metrics.netPremium >= 0 ? "(credit)" : "(debit)"}
                </span>
              </div>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={activeTab === "heatmap" ? "secondary" : "ghost"}
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => onTabChange("heatmap")}
            data-testid="tab-heatmap-view"
          >
            <Table className="h-3 w-3 mr-1" />
            Heatmap
          </Button>
          <Button
            variant={activeTab === "chart" ? "secondary" : "ghost"}
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => onTabChange("chart")}
            data-testid="tab-chart-view"
          >
            <BarChart3 className="h-3 w-3 mr-1" />
            P/L Chart
          </Button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="price"
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: "hsl(var(--foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickFormatter={(value) => `$${value}`}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: "hsl(var(--foreground))", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
          <ReferenceLine x={underlyingPrice} stroke="hsl(var(--primary))" strokeDasharray="5 5" label={{ value: "Current", position: "top", fill: "hsl(var(--primary))", fontSize: 10 }} />
          <Line
            type="monotone"
            dataKey="pnl"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Range and IV sliders */}
      <div className="mt-2 flex items-center gap-4 text-[10px]">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-muted-foreground whitespace-nowrap">Range</span>
          <Slider
            value={[range]}
            onValueChange={(v) => onRangeChange(v[0])}
            min={5}
            max={50}
            step={1}
            className="flex-1"
            data-testid="slider-range"
          />
          <span className="font-mono w-8 text-right">±{range}%</span>
        </div>
        <div className="flex items-center gap-2 flex-1">
          <span className="text-muted-foreground whitespace-nowrap">IV</span>
          <div className="relative flex-1">
            <Slider
              value={[impliedVolatility]}
              onValueChange={(v) => onVolatilityChange(v[0])}
              onPointerDown={() => setIsDraggingIV(true)}
              min={5}
              max={150}
              step={0.1}
              className="flex-1"
              data-testid="slider-volatility"
            />
            {calculatedIV > 0 && (
              <div className="absolute left-0 right-0" style={{ top: '100%', overflow: 'visible' }}>
                {[1, 2, 3].map((multiplier) => {
                  const markerValue = calculatedIV * multiplier;
                  if (markerValue < 5 || markerValue > 150) return null;
                  const markerPercent = ((markerValue - 5) / (150 - 5)) * 100;
                  return (
                    <button
                      key={multiplier}
                      className="absolute -translate-x-1/2 flex flex-col items-center cursor-pointer group"
                      style={{ left: `${markerPercent}%`, top: 0 }}
                      onClick={() => onVolatilityChange(markerValue)}
                      data-testid={`button-iv-${multiplier}x`}
                    >
                      <span className="block w-px h-1.5 bg-muted-foreground/50 group-hover:bg-foreground transition-colors" />
                      <span className="text-[9px] leading-tight text-muted-foreground group-hover:text-foreground transition-colors mt-px">
                        x{multiplier}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {isDraggingIV && calculatedIV > 0 && ivShift !== 0 && (
              <div
                className="absolute -translate-x-1/2 px-2 py-1 rounded text-xs font-bold text-white bg-primary whitespace-nowrap pointer-events-none shadow-md"
                style={{ left: `${ivSliderPercent}%`, top: '100%', marginTop: '16px', zIndex: 9999, overflow: 'visible' }}
                data-testid="tooltip-iv-shift"
              >
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-primary" />
                {ivShiftText}
              </div>
            )}
          </div>
          <span className="font-mono w-10 text-right">{impliedVolatility.toFixed(1)}%</span>
          <Button
            variant="ghost"
            size="sm"
            className={`h-5 w-5 p-0 ${isManualVolatility ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={onResetIV}
            title="Reset to market IV"
            data-testid="button-reset-iv"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
