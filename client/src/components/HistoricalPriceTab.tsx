import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import type { OptionLeg } from "@shared/schema";
import { calculateOptionPrice } from "@/lib/options-pricing";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";

interface HistoricalPriceTabProps {
  symbol: string;
  currentPrice: number;
  legs: OptionLeg[];
  volatility: number;
}

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type TimeRange = "1D" | "1W" | "2W" | "1M" | "3M" | "ALL";
type ChartType = "line" | "candlestick";

const timeRangeOptions: { value: TimeRange; label: string; days: number }[] = [
  { value: "1D", label: "1 Day", days: 1 },
  { value: "1W", label: "1 Week", days: 7 },
  { value: "2W", label: "2 Weeks", days: 14 },
  { value: "1M", label: "1 Month", days: 30 },
  { value: "3M", label: "3 Months", days: 90 },
  { value: "ALL", label: "All Time", days: 365 },
];

function formatDate(timestamp: number, range: TimeRange): string {
  const date = new Date(timestamp);
  if (range === "1D") {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function HistoricalPriceTab({
  symbol,
  currentPrice,
  legs,
  volatility,
}: HistoricalPriceTabProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("1M");
  const [chartType, setChartType] = useState<ChartType>("candlestick");

  const selectedRange = timeRangeOptions.find((r) => r.value === timeRange)!;
  const resolution = timeRange === "1D" ? "5" : "D";

  const { data: candleData, isLoading } = useQuery({
    queryKey: ["/api/stock/candles", symbol, timeRange],
    queryFn: async () => {
      const toTimestamp = Math.floor(Date.now() / 1000);
      const fromTimestamp = toTimestamp - selectedRange.days * 24 * 60 * 60;
      const response = await fetch(
        `/api/stock/candles/${symbol}?resolution=${resolution}&from=${fromTimestamp}&to=${toTimestamp}`
      );
      if (!response.ok) throw new Error("Failed to fetch candles");
      return response.json();
    },
    enabled: !!symbol,
    staleTime: 60000,
  });

  const chartData = useMemo(() => {
    if (!candleData?.candles?.length) return [];

    const candles: Candle[] = candleData.candles;
    const today = new Date();

    return candles.map((candle, index) => {
      const stockPrice = candle.close;
      const candleDate = new Date(candle.timestamp);
      const daysDiff = Math.ceil((today.getTime() - candleDate.getTime()) / (1000 * 60 * 60 * 24));

      let strategyValue = 0;
      let hasValidLegs = false;

      legs.forEach((leg) => {
        if (leg.expirationDays <= 0) return;
        
        const daysRemainingAtCandle = leg.expirationDays + daysDiff;
        
        if (daysRemainingAtCandle <= 0) return;
        
        hasValidLegs = true;
        const legVolatility = leg.impliedVolatility ?? volatility;

        const optionValue = calculateOptionPrice(
          leg.type,
          stockPrice,
          leg.strike,
          daysRemainingAtCandle,
          legVolatility
        );

        const positionMultiplier = leg.position === "long" ? 1 : -1;
        strategyValue += optionValue * positionMultiplier * leg.quantity;
      });

      const historicalIV = volatility * 100;

      return {
        timestamp: candle.timestamp,
        date: formatDate(candle.timestamp, timeRange),
        stockOpen: candle.open,
        stockHigh: candle.high,
        stockLow: candle.low,
        stockClose: candle.close,
        strategyValue: hasValidLegs ? strategyValue : null,
        iv: historicalIV,
        volume: candle.volume,
      };
    });
  }, [candleData, legs, volatility, timeRange]);

  const latestData = chartData[chartData.length - 1];
  const firstData = chartData[0];

  const stockChange = latestData && firstData
    ? ((latestData.stockClose - firstData.stockClose) / firstData.stockClose) * 100
    : 0;

  const strategyChange = latestData?.strategyValue && firstData?.strategyValue
    ? ((latestData.strategyValue - firstData.strategyValue) / firstData.strategyValue) * 100
    : 0;

  const isNetCredit = useMemo(() => {
    let netPremium = 0;
    legs.forEach((leg) => {
      const positionMultiplier = leg.position === "long" ? -1 : 1;
      netPremium += leg.premium * positionMultiplier * leg.quantity;
    });
    return netPremium > 0;
  }, [legs]);

  const strategyLabel = useMemo(() => {
    if (legs.length === 0) return "No positions";
    if (legs.length === 1) {
      const leg = legs[0];
      return `${symbol} ${leg.strike}${leg.type === "call" ? "C" : "P"}`;
    }
    return `Strategy (${legs.length} legs)`;
  }, [legs, symbol]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[150px] w-full" />
        <Skeleton className="h-[100px] w-full" />
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        No historical data available for {symbol}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {timeRangeOptions.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={timeRange === option.value ? "default" : "outline"}
              onClick={() => setTimeRange(option.value)}
              className="text-xs px-2 py-1 h-7"
              data-testid={`button-range-${option.value}`}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={chartType === "line" ? "default" : "outline"}
            onClick={() => setChartType("line")}
            className="text-xs px-3 py-1 h-7"
            data-testid="button-chart-line"
          >
            Line
          </Button>
          <Button
            size="sm"
            variant={chartType === "candlestick" ? "default" : "outline"}
            onClick={() => setChartType("candlestick")}
            className="text-xs px-3 py-1 h-7"
            data-testid="button-chart-candlestick"
          >
            Candlestick
          </Button>
        </div>
      </div>

      {legs.length > 0 && (
        <Card className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{strategyLabel}</span>
              {isNetCredit && (
                <Badge variant="secondary" className="text-xs">
                  Net Credit
                </Badge>
              )}
            </div>
            {latestData?.strategyValue && (
              <div className="flex items-center gap-2">
                <span className="text-lg font-mono font-semibold">
                  ${latestData.strategyValue.toFixed(2)}
                </span>
                <Badge
                  variant={strategyChange >= 0 ? "default" : "destructive"}
                  className="text-xs"
                >
                  {strategyChange >= 0 ? "+" : ""}
                  {strategyChange.toFixed(1)}%
                </Badge>
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v.toFixed(0)}`}
                width={45}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, "Strategy"]}
                labelFormatter={(label) => label}
              />
              {chartType === "candlestick" ? (
                <>
                  <Bar
                    dataKey="strategyValue"
                    fill="hsl(var(--chart-2))"
                    opacity={0.3}
                    barSize={6}
                  />
                  <Line
                    type="monotone"
                    dataKey="strategyValue"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={false}
                  />
                </>
              ) : (
                <Line
                  type="monotone"
                  dataKey="strategyValue"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Underlying ({symbol})</span>
          {latestData && (
            <div className="flex items-center gap-2">
              <span className="text-lg font-mono font-semibold">
                ${latestData.stockClose.toFixed(2)}
              </span>
              <Badge
                variant={stockChange >= 0 ? "default" : "destructive"}
                className="text-xs"
              >
                {stockChange >= 0 ? "+" : ""}
                {stockChange.toFixed(1)}%
              </Badge>
            </div>
          )}
        </div>
        <ResponsiveContainer width="100%" height={150}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
              width={45}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              formatter={(value: number, name: string) => {
                if (name === "stockClose") return [`$${value.toFixed(2)}`, "Close"];
                if (name === "stockHigh") return [`$${value.toFixed(2)}`, "High"];
                if (name === "stockLow") return [`$${value.toFixed(2)}`, "Low"];
                return [`$${value.toFixed(2)}`, name];
              }}
            />
            {chartType === "candlestick" ? (
              <>
                <Area
                  type="monotone"
                  dataKey="stockHigh"
                  stroke="none"
                  fill="hsl(var(--chart-1))"
                  fillOpacity={0.1}
                />
                <Area
                  type="monotone"
                  dataKey="stockLow"
                  stroke="none"
                  fill="hsl(var(--background))"
                  fillOpacity={1}
                />
                <Line
                  type="monotone"
                  dataKey="stockClose"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={false}
                />
              </>
            ) : (
              <Line
                type="monotone"
                dataKey="stockClose"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                dot={false}
              />
            )}
            <ReferenceLine y={currentPrice} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Implied Volatility</span>
            <Badge variant="secondary" className="text-[9px]">Current IV</Badge>
          </div>
          <span className="text-lg font-mono font-semibold">
            {(volatility * 100).toFixed(1)}%
          </span>
        </div>
        <div className="text-xs text-muted-foreground mb-2">
          Historical IV data unavailable. Showing current IV as reference.
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[(volatility * 100) - 5, (volatility * 100) + 5]}
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v.toFixed(0)}%`}
              width={45}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              formatter={(value: number) => [`${value.toFixed(1)}%`, "IV"]}
            />
            <Area
              type="monotone"
              dataKey="iv"
              stroke="hsl(var(--chart-4))"
              fill="hsl(var(--chart-4))"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
