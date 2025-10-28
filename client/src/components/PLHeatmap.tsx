import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ScenarioPoint } from "@/hooks/useStrategyEngine";

interface PLHeatmapProps {
  grid: ScenarioPoint[][];
  strikes: number[];
  days: number[];
  currentPrice: number;
}

export function PLHeatmap({ grid, strikes, days, currentPrice }: PLHeatmapProps) {
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

  const getDaysLabel = (daysValue: number) => {
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysValue);
    
    const month = targetDate.toLocaleString('default', { month: 'short' });
    const day = targetDate.getDate();
    
    return `${month} ${day}`;
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold mb-1">Profit/Loss Heatmap</h3>
          <p className="text-sm text-muted-foreground">
            P/L across different strike prices and expiration dates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            <span className="text-green-600 dark:text-green-500 mr-1">■</span>
            Profit
          </Badge>
          <Badge variant="secondary" className="text-xs">
            <span className="text-red-600 dark:text-red-500 mr-1">■</span>
            Loss
          </Badge>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-xs font-semibold text-left p-2 border-b border-border sticky left-0 bg-background z-10">
                Strike
              </th>
              {days.map((day) => (
                <th
                  key={day}
                  className="text-xs font-semibold text-center p-2 border-b border-border min-w-[80px]"
                  data-testid={`header-days-${day}`}
                >
                  <div>{getDaysLabel(day)}</div>
                  <div className="text-[10px] text-muted-foreground font-normal">
                    {day}d
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, rowIdx) => {
              const strike = strikes[rowIdx];
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
                      <Badge className="ml-2 text-[8px] h-4 px-1">Current</Badge>
                    )}
                  </td>
                  {row.map((cell, colIdx) => (
                    <td
                      key={colIdx}
                      className={`text-xs font-mono text-center p-2 border-b border-border transition-colors ${getPnlColor(cell.pnl)}`}
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
