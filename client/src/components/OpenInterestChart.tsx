import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Loader2 } from "lucide-react";

interface OpenInterestData {
  symbol: string;
  expiration: string | null;
  availableExpirations: string[];
  strikes: Array<{ strike: number; callOI: number; putOI: number }>;
  stats: {
    totalCallOI: number;
    totalPutOI: number;
    totalOI: number;
    putCallRatio: number;
  };
}

interface OpenInterestChartProps {
  symbol: string;
  currentPrice?: number;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function formatExpDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const formatted = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${formatted} (${diff}d)`;
}

export function OpenInterestChart({ symbol, currentPrice }: OpenInterestChartProps) {
  const [selectedExpiration, setSelectedExpiration] = useState<string | null>(null);
  const [strikeRange, setStrikeRange] = useState<string>("20");

  useEffect(() => {
    setSelectedExpiration(null);
  }, [symbol]);

  const { data, isLoading, error } = useQuery<OpenInterestData>({
    queryKey: ["/api/options/open-interest", symbol, selectedExpiration],
    queryFn: async () => {
      let url = `/api/options/open-interest/${symbol}`;
      if (selectedExpiration) {
        url += `?expiration=${selectedExpiration}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch open interest");
      return res.json();
    },
    enabled: !!symbol,
    staleTime: 60000,
  });

  const filteredStrikes = useMemo(() => {
    if (!data?.strikes) return [];
    if (!currentPrice || strikeRange === "all") return data.strikes;

    const rangePercent = parseInt(strikeRange) / 100;
    const lower = currentPrice * (1 - rangePercent);
    const upper = currentPrice * (1 + rangePercent);
    return data.strikes.filter(s => s.strike >= lower && s.strike <= upper);
  }, [data?.strikes, currentPrice, strikeRange]);

  const chartData = useMemo(() => {
    return filteredStrikes.map(s => ({
      strike: s.strike,
      callOI: s.callOI,
      putOI: s.putOI,
      label: s.strike.toString(),
    }));
  }, [filteredStrikes]);

  const maxOI = useMemo(() => {
    if (!chartData.length) return 100;
    return Math.max(...chartData.map(d => Math.max(d.callOI, d.putOI)));
  }, [chartData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Loading open interest data...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        <p className="text-sm">Unable to load open interest data for {symbol}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={selectedExpiration || data.expiration || ""}
            onValueChange={(val) => setSelectedExpiration(val)}
          >
            <SelectTrigger className="h-7 text-xs w-auto min-w-[160px]" data-testid="select-oi-expiration">
              <SelectValue placeholder="Select expiration" />
            </SelectTrigger>
            <SelectContent>
              {data.availableExpirations.map((exp) => (
                <SelectItem key={exp} value={exp} data-testid={`option-exp-${exp}`}>
                  {formatExpDate(exp)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-1">
            {[
              { label: "10%", value: "10" },
              { label: "20%", value: "20" },
              { label: "50%", value: "50" },
              { label: "All", value: "all" },
            ].map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={strikeRange === opt.value ? "default" : "outline"}
                onClick={() => setStrikeRange(opt.value)}
                className="text-xs"
                data-testid={`button-oi-range-${opt.value}`}
              >
                {opt.label === "All" ? opt.label : `±${opt.label}`}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            <span className="text-[10px] text-muted-foreground">Calls</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
            <span className="text-[10px] text-muted-foreground">Puts</span>
          </div>
        </div>
      </div>

      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={0} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis
              dataKey="strike"
              tick={{ fontSize: 10 }}
              tickFormatter={(val) => val.toString()}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(val) => formatNumber(val)}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              formatter={(value: number, name: string) => [
                value.toLocaleString(),
                name === "callOI" ? "Call OI" : "Put OI",
              ]}
              labelFormatter={(label) => `Strike: $${label}`}
            />
            {currentPrice && (
              <ReferenceLine
                x={chartData.reduce((closest, d) =>
                  Math.abs(d.strike - currentPrice) < Math.abs(closest.strike - currentPrice) ? d : closest,
                  chartData[0] || { strike: 0 }
                ).strike}
                stroke="hsl(var(--foreground))"
                strokeDasharray="3 3"
                strokeWidth={1.5}
                opacity={0.5}
                label={{
                  value: `$${currentPrice.toFixed(0)}`,
                  position: "top",
                  fontSize: 10,
                  fill: "hsl(var(--foreground))",
                }}
              />
            )}
            <Bar dataKey="callOI" fill="#10b981" radius={[2, 2, 0, 0]} />
            <Bar dataKey="putOI" fill="#f43f5e" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">Call OI</p>
          <p className="text-sm font-mono font-semibold text-emerald-500" data-testid="text-call-oi">
            {formatNumber(data.stats.totalCallOI)}
          </p>
        </Card>
        <Card className="p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">Put OI</p>
          <p className="text-sm font-mono font-semibold text-rose-500" data-testid="text-put-oi">
            {formatNumber(data.stats.totalPutOI)}
          </p>
        </Card>
        <Card className="p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">Total OI</p>
          <p className="text-sm font-mono font-semibold" data-testid="text-total-oi">
            {formatNumber(data.stats.totalOI)}
          </p>
        </Card>
        <Card className="p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">P/C Ratio</p>
          <p className="text-sm font-mono font-semibold" data-testid="text-pc-ratio">
            {data.stats.putCallRatio.toFixed(2)}
          </p>
        </Card>
      </div>

      {data.expiration && (
        <p className="text-[10px] text-muted-foreground text-center">
          Showing {selectedExpiration || data.expiration} expiration
          {data.stats.totalOI === 0 && " — OI data may be delayed or unavailable for this date"}
        </p>
      )}
    </div>
  );
}
