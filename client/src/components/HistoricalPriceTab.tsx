import { useState, useMemo, useRef, useCallback } from "react";
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
  ReferenceArea,
  Area,
  AreaChart,
  Cell,
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

interface CandlestickShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: any;
  yAxisScale?: any;
}

function CandlestickShape({ x, y, width, height, payload, yAxisScale }: CandlestickShapeProps) {
  if (!payload || x === undefined || width === undefined || !yAxisScale) {
    return null;
  }

  const { stockOpen, stockHigh, stockLow, stockClose } = payload;
  if (!stockOpen || !stockHigh || !stockLow || !stockClose) return null;

  const isBullish = stockClose >= stockOpen;
  const bodyColor = isBullish ? "#22c55e" : "#ef4444";
  const wickColor = isBullish ? "#16a34a" : "#dc2626";

  const bodyTop = yAxisScale(Math.max(stockOpen, stockClose));
  const bodyBottom = yAxisScale(Math.min(stockOpen, stockClose));
  const bodyHeight = Math.max(1, bodyBottom - bodyTop);

  const wickTop = yAxisScale(stockHigh);
  const wickBottom = yAxisScale(stockLow);

  const candleWidth = Math.max(3, width * 0.7);
  const candleX = x + (width - candleWidth) / 2;
  const wickX = x + width / 2;

  return (
    <g>
      <line
        x1={wickX}
        y1={wickTop}
        x2={wickX}
        y2={bodyTop}
        stroke={wickColor}
        strokeWidth={1}
      />
      <line
        x1={wickX}
        y1={bodyBottom}
        x2={wickX}
        y2={wickBottom}
        stroke={wickColor}
        strokeWidth={1}
      />
      <rect
        x={candleX}
        y={bodyTop}
        width={candleWidth}
        height={bodyHeight}
        fill={bodyColor}
        stroke={wickColor}
        strokeWidth={0.5}
      />
    </g>
  );
}

export function HistoricalPriceTab({
  symbol,
  currentPrice,
  legs,
  volatility,
}: HistoricalPriceTabProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("1M");
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  
  // Range selection state for percentage calculation
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const selectionStartRef = useRef<number | null>(null);

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

  const isSingleLeg = legs.length === 1;

  // Calculate GCD-based scale factor for normalizing multi-leg strategy quantities
  // This ensures proportional quantity changes (2+2 -> 20+20) don't change the displayed price
  const quantityScaleFactor = useMemo(() => {
    if (isSingleLeg || legs.length === 0) return 1;
    
    // Helper function to calculate GCD of two numbers
    const gcd = (a: number, b: number): number => {
      a = Math.abs(Math.round(a));
      b = Math.abs(Math.round(b));
      while (b > 0) {
        const temp = b;
        b = a % b;
        a = temp;
      }
      return a || 1;
    };
    
    // Get absolute quantities from all legs
    const absQuantities = legs.map(leg => Math.abs(leg.quantity)).filter(q => q > 0);
    if (absQuantities.length === 0) return 1;
    
    // Calculate GCD of all quantities
    return absQuantities.reduce((acc, qty) => gcd(acc, qty), absQuantities[0]);
  }, [legs, isSingleLeg]);

  const chartData = useMemo(() => {
    if (!candleData?.candles?.length) return [];

    const candles: Candle[] = candleData.candles;
    const today = new Date();

    return candles.map((candle, index) => {
      const candleDate = new Date(candle.timestamp);
      const daysDiff = Math.ceil((today.getTime() - candleDate.getTime()) / (1000 * 60 * 60 * 24));

      let strategyValue = 0;
      let hasValidLegs = false;
      
      let optionOpen: number | null = null;
      let optionHigh: number | null = null;
      let optionLow: number | null = null;
      let optionClose: number | null = null;

      legs.forEach((leg) => {
        if (leg.expirationDays <= 0) return;
        
        const daysRemainingAtCandle = leg.expirationDays + daysDiff;
        
        if (daysRemainingAtCandle <= 0) return;
        
        hasValidLegs = true;
        const legVolatility = leg.impliedVolatility ?? volatility;
        const positionMultiplier = leg.position === "long" ? 1 : -1;

        const valueAtClose = calculateOptionPrice(
          leg.type,
          candle.close,
          leg.strike,
          daysRemainingAtCandle,
          legVolatility
        );

        // For single legs: show per-contract price
        // For multi-leg strategies: normalize by GCD so proportional scaling doesn't change the value
        const normalizedQuantity = isSingleLeg ? 1 : leg.quantity / quantityScaleFactor;
        strategyValue += valueAtClose * positionMultiplier * normalizedQuantity;

        if (isSingleLeg) {
          const valueAtOpen = calculateOptionPrice(
            leg.type,
            candle.open,
            leg.strike,
            daysRemainingAtCandle,
            legVolatility
          );
          const valueAtHigh = calculateOptionPrice(
            leg.type,
            candle.high,
            leg.strike,
            daysRemainingAtCandle,
            legVolatility
          );
          const valueAtLow = calculateOptionPrice(
            leg.type,
            candle.low,
            leg.strike,
            daysRemainingAtCandle,
            legVolatility
          );

          const allValues = [valueAtOpen, valueAtClose, valueAtHigh, valueAtLow];
          // Show per-contract price, not multiplied by quantity
          optionOpen = valueAtOpen;
          optionClose = valueAtClose;
          optionHigh = Math.max(...allValues);
          optionLow = Math.min(...allValues);
        }
      });

      const historicalIV = volatility * 100;
      const isBullish = candle.close >= candle.open;
      
      const optionIsBullish = optionClose !== null && optionOpen !== null ? optionClose >= optionOpen : isBullish;

      return {
        timestamp: candle.timestamp,
        date: formatDate(candle.timestamp, timeRange),
        stockOpen: candle.open,
        stockHigh: candle.high,
        stockLow: candle.low,
        stockClose: candle.close,
        strategyValue: hasValidLegs ? strategyValue : null,
        optionOpen: hasValidLegs ? optionOpen : null,
        optionHigh: hasValidLegs ? optionHigh : null,
        optionLow: hasValidLegs ? optionLow : null,
        optionClose: hasValidLegs ? optionClose : null,
        optionIsBullish,
        optionCandleBody: hasValidLegs && optionOpen !== null && optionClose !== null
          ? [Math.min(optionOpen, optionClose), Math.max(optionOpen, optionClose)]
          : null,
        iv: historicalIV,
        volume: candle.volume,
        isBullish,
        candleBody: [Math.min(candle.open, candle.close), Math.max(candle.open, candle.close)],
      };
    });
  }, [candleData, legs, volatility, timeRange, isSingleLeg, quantityScaleFactor]);

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

  const priceRange = useMemo(() => {
    if (!chartData.length) return { min: 0, max: 100 };
    const lows = chartData.map((d) => d.stockLow);
    const highs = chartData.map((d) => d.stockHigh);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const padding = (max - min) * 0.05;
    return { min: min - padding, max: max + padding };
  }, [chartData]);

  const optionPriceRange = useMemo(() => {
    if (!chartData.length || !isSingleLeg) return { min: 0, max: 10 };
    const lows: number[] = [];
    const highs: number[] = [];
    chartData.forEach((d) => {
      if (d.optionLow !== null) lows.push(d.optionLow);
      if (d.optionHigh !== null) highs.push(d.optionHigh);
    });
    if (!lows.length || !highs.length) return { min: 0, max: 10 };
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const padding = (max - min) * 0.1;
    return { min: Math.max(0, min - padding), max: max + padding };
  }, [chartData, isSingleLeg]);

  // Calculate percentage change for selected range
  const selectionPercentage = useMemo(() => {
    if (selectionStart === null || selectionEnd === null || !chartData.length) return null;
    
    const startIdx = Math.min(selectionStart, selectionEnd);
    const endIdx = Math.max(selectionStart, selectionEnd);
    
    if (startIdx < 0 || endIdx >= chartData.length) return null;
    
    const startPrice = chartData[startIdx]?.stockClose;
    const endPrice = chartData[endIdx]?.stockClose;
    
    if (!startPrice || !endPrice) return null;
    
    const percentChange = ((endPrice - startPrice) / startPrice) * 100;
    return {
      startDate: chartData[startIdx]?.date,
      endDate: chartData[endIdx]?.date,
      startPrice,
      endPrice,
      percentChange,
    };
  }, [selectionStart, selectionEnd, chartData]);

  // Mouse event handlers for range selection
  const handleMouseDown = useCallback((e: any) => {
    if (e && e.activeTooltipIndex !== undefined) {
      const index = e.activeTooltipIndex;
      selectionStartRef.current = index;
      setSelectionStart(index);
      setSelectionEnd(index);
      setIsSelecting(true);
    }
  }, []);

  const handleMouseMove = useCallback((e: any) => {
    if (isSelecting && e && e.activeTooltipIndex !== undefined) {
      setSelectionEnd(e.activeTooltipIndex);
    }
  }, [isSelecting]);

  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (isSelecting) {
      setIsSelecting(false);
    }
  }, [isSelecting]);

  // Clear selection when clicking outside the selected range
  const handleChartClick = useCallback((e: any) => {
    if (!isSelecting && selectionStart !== null && selectionEnd !== null) {
      // Clear selection if clicking outside the current selection
      setSelectionStart(null);
      setSelectionEnd(null);
    }
  }, [isSelecting, selectionStart, selectionEnd]);

  // Reset selection when time range changes
  const handleTimeRangeChange = useCallback((value: TimeRange) => {
    setTimeRange(value);
    setSelectionStart(null);
    setSelectionEnd(null);
    setIsSelecting(false);
  }, []);

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
              onClick={() => handleTimeRangeChange(option.value)}
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
              {!isSingleLeg && legs.length > 1 && (
                <Badge variant="outline" className="text-[9px]">Combined</Badge>
              )}
            </div>
            {latestData?.strategyValue !== null && latestData?.strategyValue !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-lg font-mono font-semibold">
                  {latestData.strategyValue < 0 ? "-" : ""}${Math.abs(latestData.strategyValue).toFixed(2)}
                </span>
                <Badge
                  variant={
                    // For net credit strategies (negative value), a decrease in absolute value is profitable
                    // strategyChange shows the direction: negative strategyChange means value became more negative OR less positive
                    latestData.strategyValue < 0
                      ? (strategyChange <= 0 ? "default" : "destructive")
                      : (strategyChange >= 0 ? "default" : "destructive")
                  }
                  className="text-xs"
                >
                  {strategyChange >= 0 ? "+" : ""}
                  {strategyChange.toFixed(1)}%
                </Badge>
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={200}>
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
                domain={isSingleLeg && chartType === "candlestick" 
                  ? [optionPriceRange.min, optionPriceRange.max] 
                  : ["auto", "auto"]}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => {
                  // Display the actual value (positive or negative)
                  if (v < 0) {
                    return `-$${Math.abs(v).toFixed(0)}`;
                  }
                  return `$${v.toFixed(0)}`;
                }}
                width={50}
                yAxisId="option"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0]?.payload;
                  if (!data) return null;
                  
                  if (isSingleLeg && chartType === "candlestick" && data.optionOpen !== null) {
                    return (
                      <div className="bg-card border rounded-md p-2 shadow-lg">
                        <div className="text-xs font-medium mb-1">{label}</div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                          <span className="text-muted-foreground">Open:</span>
                          <span className="font-mono">${Math.abs(data.optionOpen)?.toFixed(2)}</span>
                          <span className="text-muted-foreground">High:</span>
                          <span className="font-mono">${Math.abs(data.optionHigh)?.toFixed(2)}</span>
                          <span className="text-muted-foreground">Low:</span>
                          <span className="font-mono">${Math.abs(data.optionLow)?.toFixed(2)}</span>
                          <span className="text-muted-foreground">Close:</span>
                          <span className="font-mono">${Math.abs(data.optionClose)?.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="bg-card border rounded-md p-2 shadow-lg">
                      <div className="text-xs font-medium mb-1">{label}</div>
                      <div className="text-xs">
                        <span className="text-muted-foreground">{data.strategyValue < 0 ? "Cost to Close: " : "Value: "}</span>
                        <span className="font-mono">
                          {data.strategyValue < 0 ? "-" : ""}${Math.abs(data.strategyValue)?.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
              {isSingleLeg && chartType === "candlestick" ? (
                <>
                  {chartData.map((entry, index) => {
                    if (entry.optionLow === null || entry.optionHigh === null) return null;
                    return (
                      <ReferenceLine
                        key={`option-wick-${index}`}
                        yAxisId="option"
                        segment={[
                          { x: entry.date, y: entry.optionLow },
                          { x: entry.date, y: entry.optionHigh },
                        ]}
                        stroke={entry.optionIsBullish ? "#16a34a" : "#dc2626"}
                        strokeWidth={1}
                      />
                    );
                  })}
                  <Bar
                    dataKey="optionCandleBody"
                    yAxisId="option"
                    barSize={Math.max(3, Math.min(12, 300 / chartData.length))}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`option-cell-${index}`}
                        fill={entry.optionIsBullish ? "#22c55e" : "#ef4444"}
                        stroke={entry.optionIsBullish ? "#16a34a" : "#dc2626"}
                        strokeWidth={0.5}
                      />
                    ))}
                  </Bar>
                </>
              ) : (
                <Line
                  type="monotone"
                  dataKey="strategyValue"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={false}
                  yAxisId="option"
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
        <ResponsiveContainer width="100%" height={200}>
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
              domain={[priceRange.min, priceRange.max]}
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
              width={45}
              yAxisId="price"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0]?.payload;
                if (!data) return null;
                return (
                  <div className="bg-card border rounded-md p-2 shadow-lg">
                    <div className="text-xs font-medium mb-1">{label}</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                      <span className="text-muted-foreground">Open:</span>
                      <span className="font-mono">${data.stockOpen?.toFixed(2)}</span>
                      <span className="text-muted-foreground">High:</span>
                      <span className="font-mono">${data.stockHigh?.toFixed(2)}</span>
                      <span className="text-muted-foreground">Low:</span>
                      <span className="font-mono">${data.stockLow?.toFixed(2)}</span>
                      <span className="text-muted-foreground">Close:</span>
                      <span className="font-mono">${data.stockClose?.toFixed(2)}</span>
                    </div>
                  </div>
                );
              }}
            />
            {chartType === "candlestick" ? (
              <>
                {chartData.map((entry, index) => {
                  const isBullish = entry.stockClose >= entry.stockOpen;
                  return (
                    <ReferenceLine
                      key={`wick-${index}`}
                      yAxisId="price"
                      segment={[
                        { x: entry.date, y: entry.stockLow },
                        { x: entry.date, y: entry.stockHigh },
                      ]}
                      stroke={isBullish ? "#16a34a" : "#dc2626"}
                      strokeWidth={1}
                    />
                  );
                })}
                <Bar
                  dataKey="candleBody"
                  yAxisId="price"
                  barSize={Math.max(3, Math.min(12, 300 / chartData.length))}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isBullish ? "#22c55e" : "#ef4444"}
                      stroke={entry.isBullish ? "#16a34a" : "#dc2626"}
                      strokeWidth={0.5}
                    />
                  ))}
                </Bar>
              </>
            ) : (
              <Line
                type="monotone"
                dataKey="stockClose"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                dot={false}
                yAxisId="price"
              />
            )}
            <ReferenceLine y={currentPrice} yAxisId="price" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

    </div>
  );
}
