import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Table, BarChart3, RotateCcw, TrendingUp, TrendingDown, Target, DollarSign, CheckCircle, Clock } from "lucide-react";
import type { ScenarioPoint } from "@/hooks/useStrategyEngine";
import type { StrategyMetrics } from "@shared/schema";

interface DateGroup {
  dateLabel: string;
  startIdx: number;
  count: number;
}

interface CommissionSettings {
  perTrade: number;
  perContract: number;
  roundTrip: boolean;
}

interface PLHeatmapProps {
  grid: ScenarioPoint[][];
  strikes: number[];
  days: number[];
  currentPrice: number;
  useHours?: boolean;
  targetDays?: number;
  dateGroups?: DateGroup[];
  activeTab: "heatmap" | "chart";
  onTabChange: (tab: "heatmap" | "chart") => void;
  range: number;
  onRangeChange: (value: number) => void;
  impliedVolatility: number;
  onVolatilityChange: (value: number) => void;
  calculatedIV: number;
  onResetIV: () => void;
  metrics?: StrategyMetrics;
  commissionSettings?: CommissionSettings;
  numTrades?: number;
  totalContracts?: number;
  realizedPL?: number;
  unrealizedPL?: number;
  hasRealizedPL?: boolean;
  hasUnrealizedPL?: boolean;
}

export function PLHeatmap({ 
  grid, 
  strikes, 
  days, 
  currentPrice, 
  useHours = false,
  targetDays = 30,
  dateGroups = [],
  activeTab,
  onTabChange,
  range,
  onRangeChange,
  impliedVolatility,
  onVolatilityChange,
  calculatedIV,
  onResetIV,
  metrics,
  commissionSettings = { perTrade: 0, perContract: 0, roundTrip: false },
  numTrades = 0,
  totalContracts = 0,
  realizedPL = 0,
  unrealizedPL = 0,
  hasRealizedPL = false,
  hasUnrealizedPL = false,
}: PLHeatmapProps) {
  // Calculate total commissions to subtract from P&L
  const multiplier = commissionSettings.roundTrip ? 2 : 1;
  const totalCommissions = (numTrades * commissionSettings.perTrade + totalContracts * commissionSettings.perContract) * multiplier;

  // Adjust P&L values by subtracting commissions
  const adjustPnl = (pnl: number) => pnl - totalCommissions;
  
  const allPnlValues = grid.flatMap(row => row.map(cell => adjustPnl(cell.pnl)));
  const maxAbsPnl = Math.max(...allPnlValues.map(Math.abs));

  // Calculate current position P/L (closest price row, first time column = now)
  const getCurrentPositionPL = () => {
    if (grid.length === 0 || strikes.length === 0) return null;
    
    let closestRowIdx = 0;
    let minDiff = Infinity;
    strikes.forEach((strike, idx) => {
      const diff = Math.abs(strike - currentPrice);
      if (diff < minDiff) {
        minDiff = diff;
        closestRowIdx = idx;
      }
    });
    
    if (grid[closestRowIdx] && grid[closestRowIdx][0]) {
      return adjustPnl(grid[closestRowIdx][0].pnl);
    }
    return null;
  };
  
  const currentPL = getCurrentPositionPL();

  const getPnlColor = (rawPnl: number) => {
    const pnl = adjustPnl(rawPnl);
    if (maxAbsPnl === 0) return 'bg-muted';
    
    const intensity = Math.abs(pnl) / maxAbsPnl;
    
    if (pnl > 0) {
      if (intensity > 0.7) return 'bg-green-600 text-white dark:bg-green-600';
      if (intensity > 0.4) return 'bg-green-500 text-white dark:bg-green-500';
      if (intensity > 0.2) return 'bg-green-400 text-white dark:bg-green-400';
      return 'bg-green-200 text-green-900 dark:bg-green-900/30 dark:text-green-300';
    } else if (pnl < 0) {
      if (intensity > 0.7) return 'bg-red-600 text-white dark:bg-red-600';
      if (intensity > 0.4) return 'bg-red-500 text-white dark:bg-red-500';
      if (intensity > 0.2) return 'bg-red-400 text-white dark:bg-red-400';
      return 'bg-red-200 text-red-900 dark:bg-red-900/30 dark:text-red-300';
    }
    
    return 'bg-muted text-foreground';
  };

  const getTimeLabel = (daysValue: number) => {
    if (useHours) {
      // Convert fractional days to hours
      const totalHours = Math.round(daysValue * 24);
      const now = new Date();
      const targetTime = new Date(now.getTime() + totalHours * 60 * 60 * 1000);
      
      // Format as time (e.g., "4:30pm")
      const hours = targetTime.getHours();
      const minutes = targetTime.getMinutes();
      const ampm = hours >= 12 ? 'pm' : 'am';
      const displayHours = hours % 12 || 12;
      const displayMinutes = minutes.toString().padStart(2, '0');
      
      return `${displayHours}:${displayMinutes}${ampm}`;
    } else {
      // Show date (e.g., "Nov 21")
      const today = new Date();
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysValue);
      
      const month = targetDate.toLocaleString('default', { month: 'short' });
      const day = targetDate.getDate();
      
      return `${month} ${day}`;
    }
  };

  const getTimeSubLabel = (daysValue: number) => {
    if (useHours) {
      const totalHours = Math.round(daysValue * 24);
      return `${totalHours}h`;
    } else {
      return `${Math.round(daysValue)}d`;
    }
  };

  // Helper to check if a column index starts a new date group
  // Show separator for all date groups except the very first column
  const isDateGroupStart = (colIdx: number) => {
    if (colIdx === 0) return false;
    return dateGroups.some(group => group.startIdx === colIdx);
  };

  return (
    <Card className="p-2">
      {/* Header with metrics and tab buttons */}
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
                <span className="text-base font-bold font-mono text-foreground" data-testid="text-net-premium">
                  ${Math.abs(metrics.netPremium).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
                <span className="text-xs text-muted-foreground/70">
                  {metrics.netPremium >= 0 ? "(credit)" : "(debit)"}
                </span>
              </div>
              {currentPL !== null && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Now:</span>
                  <span className={`text-base font-bold font-mono ${currentPL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} data-testid="text-current-pl">
                    {currentPL >= 0 ? '+' : '-'}${Math.abs(currentPL).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              )}
              {hasRealizedPL && (
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">Realized:</span>
                  <span className={`text-base font-bold font-mono ${realizedPL >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`} data-testid="text-realized-pl">
                    {realizedPL >= 0 ? '' : '-'}${Math.abs(realizedPL).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              )}
              {hasUnrealizedPL && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs text-muted-foreground">Unrealized:</span>
                  <span className={`text-base font-bold font-mono ${unrealizedPL >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`} data-testid="text-unrealized-pl">
                    {unrealizedPL >= 0 ? '' : '-'}${Math.abs(unrealizedPL).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              )}
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
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <thead>
            {/* Date group row (only shown when useHours is true) */}
            {dateGroups.length > 0 && (
              <tr>
                <th 
                  colSpan={2} 
                  rowSpan={1}
                  className="text-[10px] font-semibold text-center p-1 border-b border-border bg-slate-100 dark:bg-slate-800/50"
                  style={{ width: '105px' }}
                />
                {dateGroups.map((group, idx) => (
                  <th
                    key={idx}
                    colSpan={group.count}
                    scope="colgroup"
                    className="text-[10px] font-bold text-center p-1 border-b border-border bg-slate-200/70 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200"
                    data-testid={`header-dategroup-${idx}`}
                  >
                    {group.dateLabel}
                  </th>
                ))}
              </tr>
            )}
            {/* Time/day column row */}
            <tr>
              <th 
                className="text-[11px] font-semibold text-left px-2 py-1 border-b border-border sticky left-0 bg-slate-100 dark:bg-slate-800/50 z-10"
                scope="col"
                style={{ width: '60px' }}
              >
                Strike
              </th>
              <th 
                className="text-[11px] font-semibold text-right pl-3 pr-2 py-1 border-b border-border bg-slate-100 dark:bg-slate-800/50"
                scope="col"
                style={{ width: '45px' }}
              >
                %
              </th>
              {days.map((day, idx) => (
                <th
                  key={idx}
                  scope="col"
                  className={`text-[11px] font-semibold text-center p-1 border-b border-border bg-slate-100 dark:bg-slate-800/50 ${
                    isDateGroupStart(idx) ? 'border-l-2 border-l-border' : ''
                  }`}
                  data-testid={`header-time-${idx}`}
                >
                  <div className="text-[11px] leading-tight">{getTimeLabel(day)}</div>
                  <div className="text-[10px] text-muted-foreground font-normal leading-tight">
                    {getTimeSubLabel(day)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Find the single row closest to current price
              let closestRowIdx = 0;
              let minDiff = Infinity;
              strikes.forEach((strike, idx) => {
                const diff = Math.abs(strike - currentPrice);
                if (diff < minDiff) {
                  minDiff = diff;
                  closestRowIdx = idx;
                }
              });
              
              return grid.map((row, rowIdx) => {
              const strike = strikes[rowIdx];
              const percentChange = ((strike - currentPrice) / currentPrice) * 100;
              const isClosestToCurrentPrice = rowIdx === closestRowIdx;
              
              // Format strike price: show 2 decimals if value has meaningful decimals, otherwise show whole number
              const hasDecimals = strike % 1 !== 0;
              const strikeDisplay = hasDecimals || strike < 10 
                ? strike.toFixed(2) 
                : strike.toFixed(0);
              
              // Current price row gets a dashed border below it to mark it
              const currentPriceRowStyle = isClosestToCurrentPrice 
                ? 'border-b-2 border-b-black/70 dark:border-b-white/70 border-dashed' 
                : '';
              
              return (
                <tr key={rowIdx} className={`h-[24px] ${currentPriceRowStyle}`}>
                  <td
                    className={`text-[11px] font-mono font-semibold px-2 py-1 border-b border-border sticky left-0 z-10 whitespace-nowrap bg-slate-50 dark:bg-slate-900/70 ${
                      isClosestToCurrentPrice ? 'text-foreground dark:text-white font-bold' : ''
                    }`}
                    data-testid={`strike-${strike.toFixed(2)}`}
                  >
                    ${strikeDisplay}
                  </td>
                  <td
                    className={`text-[11px] font-mono text-right pl-3 pr-2 py-1 border-b border-border bg-slate-50 dark:bg-slate-900/70 ${
                      percentChange > 0 ? 'text-green-600 dark:text-green-400' : 
                      percentChange < 0 ? 'text-red-600 dark:text-red-400' : 
                      'text-muted-foreground'
                    }`}
                    data-testid={`percent-${strike.toFixed(2)}`}
                  >
                    {Math.abs(percentChange) < 1 ? percentChange.toFixed(2) : percentChange.toFixed(1)}%
                  </td>
                  {row.map((cell, colIdx) => {
                    const adjustedPnl = adjustPnl(cell.pnl);
                    // Check if this is the "current position" cell (closest price row + first time column = now)
                    const isCurrentPositionCell = isClosestToCurrentPrice && colIdx === 0;
                    
                    return (
                      <td
                        key={colIdx}
                        className={`text-[11px] font-mono text-center p-1 border-b border-border transition-colors ${getPnlColor(cell.pnl)} ${
                          isDateGroupStart(colIdx) ? 'border-l-2 border-l-border' : ''
                        } ${isCurrentPositionCell ? 'ring-2 ring-blue-500 ring-inset font-bold relative z-20' : ''}`}
                        data-testid={`cell-${strike.toFixed(2)}-${days[colIdx]}`}
                        title={isCurrentPositionCell ? `Current P/L: $${adjustedPnl.toFixed(0)}` : undefined}
                      >
                        {isCurrentPositionCell && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        )}
                        ${adjustedPnl.toFixed(0)}
                      </td>
                    );
                  })}
                </tr>
              );
            });
            })()}
          </tbody>
        </table>
      </div>

      {/* Range and IV sliders */}
      <div className="mt-2 flex items-center gap-4 text-[10px]">
        <div className="flex items-center gap-1.5 flex-1">
          <span className="text-muted-foreground whitespace-nowrap">Range</span>
          <Slider
            value={[range]}
            onValueChange={(v) => onRangeChange(v[0])}
            min={0.1}
            max={50}
            step={0.1}
            className="flex-1"
            data-testid="slider-range"
          />
          <span className="font-mono w-12 text-right">±{range.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-1.5 flex-1">
          <span className="text-muted-foreground whitespace-nowrap">IV</span>
          <Slider
            value={[impliedVolatility]}
            onValueChange={(v) => onVolatilityChange(v[0])}
            min={5}
            max={150}
            step={1}
            className="flex-1"
            data-testid="slider-volatility"
          />
          <span className="font-mono w-8 text-right">{impliedVolatility}%</span>
          {impliedVolatility !== calculatedIV && (
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0"
              onClick={onResetIV}
              title="Reset to calculated IV"
              data-testid="button-reset-iv"
            >
              <RotateCcw className="h-2.5 w-2.5" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
