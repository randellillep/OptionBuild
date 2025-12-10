import { Card } from "@/components/ui/card";
import type { StrategyMetrics } from "@shared/schema";
import { TrendingUp, TrendingDown, Target, DollarSign } from "lucide-react";

interface StrategyMetricsCardProps {
  metrics: StrategyMetrics;
}

export function StrategyMetricsCard({ metrics }: StrategyMetricsCardProps) {
  return (
    <Card className="p-3">
      <h3 className="text-sm font-semibold mb-2">Strategy Metrics</h3>
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-500 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Max Profit</p>
            <p className="text-lg font-bold font-mono text-green-600 dark:text-green-500">
              {metrics.maxProfit !== null ? `$${metrics.maxProfit.toFixed(2)}` : "Unlimited"}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-500 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Max Loss</p>
            <p className="text-lg font-bold font-mono text-red-600 dark:text-red-500">
              {metrics.maxLoss !== null ? `$${metrics.maxLoss.toFixed(2)}` : "Unlimited"}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Target className="h-4 w-4 text-primary mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Breakeven Points</p>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {metrics.breakeven.length > 0 ? (
                metrics.breakeven.map((price, idx) => (
                  <span key={idx} className="text-sm font-semibold font-mono bg-secondary px-2 py-0.5 rounded">
                    ${price.toFixed(2)}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">None</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <DollarSign className="h-4 w-4 text-primary mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Net Premium</p>
            <p className={`text-lg font-bold font-mono ${metrics.netPremium >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
              ${metrics.netPremium.toFixed(2)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {metrics.netPremium >= 0 ? "Credit received" : "Debit paid"}
            </p>
          </div>
        </div>

      </div>
    </Card>
  );
}
