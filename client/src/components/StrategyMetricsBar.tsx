import type { StrategyMetrics } from "@shared/schema";
import { TrendingUp, TrendingDown, Target, DollarSign } from "lucide-react";

interface StrategyMetricsBarProps {
  metrics: StrategyMetrics;
}

export function StrategyMetricsBar({ metrics }: StrategyMetricsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 py-1.5 text-xs" data-testid="strategy-metrics-bar">
      <div className="flex items-center gap-1.5">
        <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-500" />
        <span className="text-muted-foreground">Max Profit:</span>
        <span className="font-bold font-mono text-emerald-600 dark:text-emerald-500" data-testid="text-max-profit">
          {metrics.maxProfit !== null ? `$${Math.abs(metrics.maxProfit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Unlimited"}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <TrendingDown className="h-3.5 w-3.5 text-rose-600 dark:text-rose-500" />
        <span className="text-muted-foreground">Max Loss:</span>
        <span className="font-bold font-mono text-rose-600 dark:text-rose-500" data-testid="text-max-loss">
          {metrics.maxLoss !== null ? `$${Math.abs(metrics.maxLoss).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Unlimited"}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Target className="h-3.5 w-3.5 text-primary" />
        <span className="text-muted-foreground">Breakeven:</span>
        <span className="font-semibold font-mono" data-testid="text-breakeven">
          {metrics.breakeven.length > 0 
            ? metrics.breakeven.map(p => `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`).join(', ')
            : "N/A"
          }
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <DollarSign className="h-3.5 w-3.5 text-primary" />
        <span className="text-muted-foreground">Net Premium:</span>
        <span className="font-bold font-mono text-foreground" data-testid="text-net-premium">
          ${Math.abs(metrics.netPremium).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="text-muted-foreground/70">
          {metrics.netPremium >= 0 ? "(credit)" : "(debit)"}
        </span>
      </div>
    </div>
  );
}
