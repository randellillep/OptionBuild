import { Card } from "@/components/ui/card";
import type { StrategyMetrics } from "@shared/schema";
import { TrendingUp, TrendingDown, Target, DollarSign } from "lucide-react";

interface StrategyMetricsCardProps {
  metrics: StrategyMetrics;
}

export function StrategyMetricsCard({ metrics }: StrategyMetricsCardProps) {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Strategy Metrics</h3>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-500 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Max Profit</p>
            <p className="text-2xl font-bold font-mono text-green-600 dark:text-green-500">
              {metrics.maxProfit !== null ? `$${metrics.maxProfit.toFixed(2)}` : "Unlimited"}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-500 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Max Loss</p>
            <p className="text-2xl font-bold font-mono text-red-600 dark:text-red-500">
              {metrics.maxLoss !== null ? `$${metrics.maxLoss.toFixed(2)}` : "Unlimited"}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Target className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Breakeven Points</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {metrics.breakeven.length > 0 ? (
                metrics.breakeven.map((price, idx) => (
                  <span key={idx} className="text-lg font-semibold font-mono bg-secondary px-3 py-1 rounded-md">
                    ${price.toFixed(2)}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">None</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <DollarSign className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Net Premium</p>
            <p className={`text-2xl font-bold font-mono ${metrics.netPremium >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
              ${metrics.netPremium.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.netPremium >= 0 ? "Credit received" : "Debit paid"}
            </p>
          </div>
        </div>

        {metrics.riskRewardRatio !== null && (
          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">Risk/Reward Ratio</p>
            <p className="text-xl font-bold font-mono">
              1:{metrics.riskRewardRatio.toFixed(2)}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
