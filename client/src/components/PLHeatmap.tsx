import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Table, BarChart3, RotateCcw } from "lucide-react";
import type { ScenarioPoint } from "@/hooks/useStrategyEngine";

interface DateGroup {
  dateLabel: string;
  startIdx: number;
  count: number;
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
}: PLHeatmapProps) {
  const allPnlValues = grid.flatMap(row => row.map(cell => cell.pnl));
  const maxAbsPnl = Math.max(...allPnlValues.map(Math.abs));

  const getPnlColor = (pnl: number) => {
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
    <Card className="p-3">
      {/* Header with tab buttons */}
      <div className="mb-2 flex items-center justify-between">
        <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0.5">
          ±{range}%
        </Badge>
        <div className="flex items-center gap-1">
          <Button
            variant={activeTab === "heatmap" ? "secondary" : "ghost"}
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => onTabChange("heatmap")}
            data-testid="tab-heatmap-view"
          >
            <Table className="h-3 w-3 mr-1" />
            Heatmap
          </Button>
          <Button
            variant={activeTab === "chart" ? "secondary" : "ghost"}
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => onTabChange("chart")}
            data-testid="tab-chart-view"
          >
            <BarChart3 className="h-3 w-3 mr-1" />
            P/L Chart
          </Button>
        </div>
      </div>

      <div className="overflow-auto max-h-[320px]">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-20">
            {/* Date group row (only shown when useHours is true) */}
            {dateGroups.length > 0 && (
              <tr>
                <th 
                  colSpan={2} 
                  rowSpan={1}
                  className="text-[10px] font-semibold text-center p-1 border-b border-border bg-background"
                />
                {dateGroups.map((group, idx) => (
                  <th
                    key={idx}
                    colSpan={group.count}
                    scope="colgroup"
                    className="text-[10px] font-bold text-center p-1 border-b border-border bg-muted/50"
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
                className="text-[10px] font-semibold text-left p-1 border-b border-border sticky left-0 bg-background z-10 min-w-[60px]"
                scope="col"
              >
                Strike
              </th>
              <th 
                className="text-[10px] font-semibold text-right p-1 border-b border-border bg-background min-w-[36px]"
                scope="col"
              >
                %
              </th>
              {days.map((day, idx) => (
                <th
                  key={idx}
                  scope="col"
                  className={`text-[10px] font-semibold text-center p-1 border-b border-border min-w-[48px] bg-background ${
                    isDateGroupStart(idx) ? 'border-l-2 border-l-border' : ''
                  }`}
                  data-testid={`header-time-${idx}`}
                >
                  <div className="text-[9px]">{getTimeLabel(day)}</div>
                  <div className="text-[8px] text-muted-foreground font-normal">
                    {getTimeSubLabel(day)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, rowIdx) => {
              const strike = strikes[rowIdx];
              const percentChange = ((strike - currentPrice) / currentPrice) * 100;
              const isNearCurrent = Math.abs(strike - currentPrice) < (currentPrice * 0.02);
              
              return (
                <tr key={rowIdx}>
                  <td
                    className={`text-[10px] font-mono font-semibold p-1 border-b border-border sticky left-0 bg-background z-10 whitespace-nowrap ${
                      isNearCurrent ? 'text-primary' : ''
                    }`}
                    data-testid={`strike-${strike.toFixed(2)}`}
                  >
                    ${strike.toFixed(0)}
                    {isNearCurrent && (
                      <span className="ml-1 text-[7px] text-primary font-bold">ATM</span>
                    )}
                  </td>
                  <td
                    className={`text-[10px] font-mono text-right p-1 border-b border-border bg-background ${
                      percentChange > 0 ? 'text-green-600 dark:text-green-400' : 
                      percentChange < 0 ? 'text-red-600 dark:text-red-400' : 
                      'text-muted-foreground'
                    }`}
                    data-testid={`percent-${strike.toFixed(2)}`}
                  >
                    {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(0)}%
                  </td>
                  {row.map((cell, colIdx) => (
                    <td
                      key={colIdx}
                      className={`text-[10px] font-mono text-center p-1 border-b border-border transition-colors ${getPnlColor(cell.pnl)} ${
                        isDateGroupStart(colIdx) ? 'border-l-2 border-l-border' : ''
                      }`}
                      data-testid={`cell-${strike.toFixed(2)}-${days[colIdx]}`}
                    >
                      {cell.pnl >= 0 ? '+' : ''}${cell.pnl.toFixed(0)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Range and IV sliders */}
      <div className="mt-2 flex items-center gap-4 text-[10px]">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-muted-foreground whitespace-nowrap">Range</span>
          <Slider
            value={[range]}
            onValueChange={(v) => onRangeChange(v[0])}
            min={5}
            max={50}
            step={1}
            className="flex-1"
            data-testid="slider-range"
          />
          <span className="font-mono w-8 text-right">±{range}%</span>
        </div>
        <div className="flex items-center gap-2 flex-1">
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
              className="h-5 w-5 p-0"
              onClick={onResetIV}
              title="Reset to calculated IV"
              data-testid="button-reset-iv"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
