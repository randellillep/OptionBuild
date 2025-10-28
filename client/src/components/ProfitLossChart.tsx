import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { OptionLeg } from "@shared/schema";
import { calculateProfitLoss } from "@/lib/options-pricing";
import { Card } from "@/components/ui/card";

interface ProfitLossChartProps {
  legs: OptionLeg[];
  underlyingPrice: number;
}

export function ProfitLossChart({ legs, underlyingPrice }: ProfitLossChartProps) {
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
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Profit/Loss at Expiration</h3>
        <p className="text-sm text-muted-foreground">
          Chart shows P/L across different stock prices
        </p>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="price"
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: "hsl(var(--foreground))", fontSize: 12, fontFamily: "var(--font-mono)" }}
            tickFormatter={(value) => `$${value}`}
            label={{ value: "Stock Price", position: "insideBottom", offset: -5, style: { fill: "hsl(var(--foreground))" } }}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: "hsl(var(--foreground))", fontSize: 12, fontFamily: "var(--font-mono)" }}
            tickFormatter={(value) => `$${value}`}
            label={{ value: "Profit/Loss", angle: -90, position: "insideLeft", style: { fill: "hsl(var(--foreground))" } }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
          <ReferenceLine x={underlyingPrice} stroke="hsl(var(--primary))" strokeDasharray="5 5" label={{ value: "Current", position: "top", fill: "hsl(var(--primary))" }} />
          <Line
            type="monotone"
            dataKey="pnl"
            stroke="hsl(var(--chart-1))"
            strokeWidth={3}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
