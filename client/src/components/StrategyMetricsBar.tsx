import type { StrategyMetrics } from "@shared/schema";
import { TrendingUp, TrendingDown, Target, DollarSign, CheckCircle, Clock } from "lucide-react";

interface StrategyMetricsBarProps {
  metrics: StrategyMetrics;
  realizedPL?: number;
  unrealizedPL?: number;
}

export function StrategyMetricsBar({ metrics, realizedPL = 0, unrealizedPL = 0 }: StrategyMetricsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 py-1.5 text-xs" data-testid="strategy-metrics-bar">
      <div className="flex items-center gap-1">
        <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
        <span className="text-muted-foreground">Max Profit:</span>
        <span className="font-bold font-mono text-foreground" data-testid="text-max-profit">
          {metrics.maxProfit !== null ? `$${Math.abs(metrics.maxProfit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Unlimited"}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
        <span className="text-muted-foreground">Max Loss:</span>
        <span className="font-bold font-mono text-foreground" data-testid="text-max-loss">
          {metrics.maxLoss !== null ? `$${Math.abs(metrics.maxLoss).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Unlimited"}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Target className="h-3.5 w-3.5 text-blue-500" />
        <span className="text-muted-foreground">Breakeven:</span>
        <span className="font-semibold font-mono text-foreground" data-testid="text-breakeven">
          {metrics.breakeven.length > 0 
            ? metrics.breakeven.map(p => `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`).join(', ')
            : "N/A"
          }
        </span>
      </div>

      <div className="flex items-center gap-1">
        <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Net Premium:</span>
        <span className="font-bold font-mono text-foreground" data-testid="text-net-premium">
          ${Math.abs(metrics.netPremium).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="text-muted-foreground/70">
          {metrics.netPremium >= 0 ? "(credit)" : "(debit)"}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
        <span className="text-muted-foreground">Realized:</span>
        <span className={`font-bold font-mono ${realizedPL >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`} data-testid="text-realized-pl">
          {realizedPL >= 0 ? '+' : '-'}${Math.abs(realizedPL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Clock className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-muted-foreground">Unrealized:</span>
        <span className={`font-bold font-mono ${unrealizedPL >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`} data-testid="text-unrealized-pl">
          {unrealizedPL >= 0 ? '+' : '-'}${Math.abs(unrealizedPL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}
