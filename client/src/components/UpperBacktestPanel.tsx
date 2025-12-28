import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, BarChart3, History, TrendingUp, TrendingDown, Target, DollarSign } from "lucide-react";
import { BacktestPanel } from "./BacktestPanel";
import type { OptionLeg, StrategyMetrics } from "@shared/schema";

interface UpperBacktestPanelProps {
  symbol: string;
  currentPrice: number;
  legs: OptionLeg[];
  volatility: number;
  expirationDate: string | null;
  activeTab: "heatmap" | "chart" | "backtest";
  onTabChange: (tab: "heatmap" | "chart" | "backtest") => void;
  metrics?: StrategyMetrics;
}

export function UpperBacktestPanel({
  symbol,
  currentPrice,
  legs,
  volatility,
  expirationDate,
  activeTab,
  onTabChange,
  metrics,
}: UpperBacktestPanelProps) {
  return (
    <Card className="p-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-4" data-testid="strategy-metrics-bar">
          {metrics && metrics.maxProfit === null && metrics.maxLoss === null && metrics.netPremium === 0 ? (
            <span className="text-sm text-muted-foreground italic">
              This strategy has no enabled items (add options from the Add button)
            </span>
          ) : metrics ? (
            <>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs text-muted-foreground">Max Profit:</span>
                <span className="text-base font-bold font-mono text-foreground" data-testid="text-max-profit">
                  {metrics.maxProfit !== null ? `$${Math.abs(metrics.maxProfit).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : "∞"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                <span className="text-xs text-muted-foreground">Max Loss:</span>
                <span className="text-base font-bold font-mono text-foreground" data-testid="text-max-loss">
                  {metrics.maxLoss !== null ? `$${Math.abs(metrics.maxLoss).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : "∞"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Target className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs text-muted-foreground">Breakeven:</span>
                <span className="text-base font-semibold font-mono text-foreground" data-testid="text-breakeven">
                  {metrics.breakeven.length > 0 
                    ? metrics.breakeven.slice(0, 2).map(p => `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`).join(', ')
                    : "N/A"
                  }
                </span>
              </div>
              <div className="flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Net:</span>
                <span className={`text-base font-bold font-mono ${metrics.netPremium >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`} data-testid="text-net-premium">
                  {metrics.netPremium >= 0 ? '' : '-'}${Math.abs(metrics.netPremium).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
                <span className="text-xs text-muted-foreground/70">
                  {metrics.netPremium >= 0 ? "(credit)" : "(debit)"}
                </span>
              </div>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant={activeTab === "heatmap" ? "secondary" : "ghost"}
            size="sm"
            className="h-5 px-1.5 text-[10px]"
            onClick={() => onTabChange("heatmap")}
            data-testid="tab-heatmap-view"
          >
            <Table className="h-2.5 w-2.5 mr-0.5" />
            Heatmap
          </Button>
          <Button
            variant={activeTab === "chart" ? "secondary" : "ghost"}
            size="sm"
            className="h-5 px-1.5 text-[10px]"
            onClick={() => onTabChange("chart")}
            data-testid="tab-chart-view"
          >
            <BarChart3 className="h-2.5 w-2.5 mr-0.5" />
            P/L Chart
          </Button>
          <Button
            variant={activeTab === "backtest" ? "secondary" : "ghost"}
            size="sm"
            className="h-5 px-1.5 text-[10px]"
            onClick={() => onTabChange("backtest")}
            data-testid="tab-backtest-view"
          >
            <History className="h-2.5 w-2.5 mr-0.5" />
            Backtest
          </Button>
        </div>
      </div>

      <div className="mt-2">
        <BacktestPanel
          symbol={symbol}
          currentPrice={currentPrice}
          legs={legs}
          volatility={volatility}
          expirationDate={expirationDate}
        />
      </div>
    </Card>
  );
}
