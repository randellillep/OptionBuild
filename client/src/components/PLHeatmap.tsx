import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  rangePercent?: number;
  useHours?: boolean;
  targetDays?: number;
  dateGroups?: DateGroup[];
}

export function PLHeatmap({ 
  grid, 
  strikes, 
  days, 
  currentPrice, 
  rangePercent = 14,
  useHours = false,
  targetDays = 30,
  dateGroups = [],
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
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-end gap-3">
        <Badge variant="outline" className="text-xs font-semibold">
          RANGE: ±{rangePercent}%
        </Badge>
        <Badge variant="secondary" className="text-xs">
          <span className="text-green-600 dark:text-green-500 mr-1">■</span>
          Profit
        </Badge>
        <Badge variant="secondary" className="text-xs">
          <span className="text-red-600 dark:text-red-500 mr-1">■</span>
          Loss
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            {/* Date group row (only shown when useHours is true) */}
            {dateGroups.length > 0 && (
              <tr>
                <th 
                  colSpan={2} 
                  rowSpan={1}
                  className="text-xs font-semibold text-center p-2 border-b border-border bg-background"
                />
                {dateGroups.map((group, idx) => (
                  <th
                    key={idx}
                    colSpan={group.count}
                    scope="colgroup"
                    className="text-sm font-bold text-center p-2 border-b border-border bg-muted/50"
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
                className="text-xs font-semibold text-left p-2 border-b border-border sticky left-0 bg-background z-10 w-[100px]"
                scope="col"
              >
                Strike
              </th>
              <th 
                className="text-xs font-semibold text-right p-2 border-b border-border bg-background w-[60px]"
                scope="col"
              >
                %
              </th>
              {days.map((day, idx) => (
                <th
                  key={idx}
                  scope="col"
                  className={`text-xs font-semibold text-center p-2 border-b border-border min-w-[80px] ${
                    isDateGroupStart(idx) ? 'border-l-2 border-l-border' : ''
                  }`}
                  data-testid={`header-time-${idx}`}
                >
                  <div>{getTimeLabel(day)}</div>
                  <div className="text-[10px] text-muted-foreground font-normal">
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
                    className={`text-xs font-mono font-semibold p-2 border-b border-border sticky left-0 bg-background z-10 ${
                      isNearCurrent ? 'text-primary' : ''
                    }`}
                    data-testid={`strike-${strike.toFixed(2)}`}
                  >
                    ${strike.toFixed(2)}
                    {isNearCurrent && (
                      <Badge className="ml-2 text-[8px] h-4 px-1">ATM</Badge>
                    )}
                  </td>
                  <td
                    className={`text-xs font-mono text-right p-2 border-b border-border bg-background ${
                      percentChange > 0 ? 'text-green-600 dark:text-green-400' : 
                      percentChange < 0 ? 'text-red-600 dark:text-red-400' : 
                      'text-muted-foreground'
                    }`}
                    data-testid={`percent-${strike.toFixed(2)}`}
                  >
                    {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(1)}%
                  </td>
                  {row.map((cell, colIdx) => (
                    <td
                      key={colIdx}
                      className={`text-xs font-mono text-center p-2 border-b border-border transition-colors ${getPnlColor(cell.pnl)} ${
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

      <div className="mt-4 text-xs text-muted-foreground">
        <p>
          Values represent profit (+) or loss (-) at expiration. 
          Color intensity indicates magnitude of P/L.
        </p>
      </div>
    </Card>
  );
}
