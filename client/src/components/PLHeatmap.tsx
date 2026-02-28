import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Table, BarChart3, RotateCcw } from "lucide-react";
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
  isManualVolatility?: boolean;
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
  isManualVolatility = false,
  metrics,
  commissionSettings = { perTrade: 0, perContract: 0, roundTrip: false },
  numTrades = 0,
  totalContracts = 0,
  realizedPL = 0,
  unrealizedPL = 0,
  hasRealizedPL = false,
  hasUnrealizedPL = false,
}: PLHeatmapProps) {
  const [isDraggingIV, setIsDraggingIV] = useState(false);
  const handlePointerUp = useCallback(() => setIsDraggingIV(false), []);
  useEffect(() => {
    if (isDraggingIV) {
      window.addEventListener("pointerup", handlePointerUp);
      return () => window.removeEventListener("pointerup", handlePointerUp);
    }
  }, [isDraggingIV, handlePointerUp]);
  const ivShift = calculatedIV ? impliedVolatility - calculatedIV : 0;
  const ivShiftText = ivShift > 0 ? `+${ivShift.toFixed(1)}%` : `${ivShift.toFixed(1)}%`;
  const ivSliderPercent = ((impliedVolatility - 5) / (150 - 5)) * 100;

  // Calculate total commissions to subtract from P&L
  const multiplier = commissionSettings.roundTrip ? 2 : 1;
  const totalCommissions = (numTrades * commissionSettings.perTrade + totalContracts * commissionSettings.perContract) * multiplier;

  // Adjust P&L values by subtracting commissions
  const adjustPnl = (pnl: number) => pnl - totalCommissions;
  
  const allPnlValues = grid.flatMap(row => row.map(cell => adjustPnl(cell.pnl)));
  const maxAbsPnl = Math.max(...allPnlValues.map(Math.abs));

  const getPnlStyle = (rawPnl: number): React.CSSProperties => {
    const pnl = adjustPnl(rawPnl);
    if (maxAbsPnl === 0) return { backgroundColor: 'rgb(55, 55, 60)' };
    
    const intensity = Math.min(Math.abs(pnl) / maxAbsPnl, 1);
    
    if (intensity < 0.005) {
      return { backgroundColor: 'rgb(55, 55, 60)' };
    }
    
    if (pnl > 0) {
      const r = Math.round(15 + (1 - intensity) * 50);
      const g = Math.round(90 + intensity * 80);
      const b = Math.round(15 + (1 - intensity) * 45);
      return { backgroundColor: `rgb(${r}, ${g}, ${b})` };
    } else if (pnl < 0) {
      const curved = intensity * intensity;
      const r = Math.round(60 + curved * 175);
      const g = Math.round(30 * (1 - curved));
      const b = Math.round(30 * (1 - curved));
      return { backgroundColor: `rgb(${Math.min(r, 235)}, ${g}, ${b})` };
    }
    
    return { backgroundColor: 'rgb(55, 55, 60)' };
  };

  const isNewWeek = (idx: number): boolean => {
    if (idx === 0) return false;
    const today = new Date();
    const prevDate = new Date(today);
    prevDate.setDate(prevDate.getDate() + days[idx - 1]);
    const currDate = new Date(today);
    currDate.setDate(currDate.getDate() + days[idx]);
    const getWeek = (d: Date) => {
      const jan1 = new Date(d.getFullYear(), 0, 1);
      return Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    };
    return getWeek(prevDate) !== getWeek(currDate);
  };

  const isNewMonth = (idx: number): boolean => {
    if (idx === 0) return false;
    const today = new Date();
    const prevDate = new Date(today);
    prevDate.setDate(prevDate.getDate() + days[idx - 1]);
    const currDate = new Date(today);
    currDate.setDate(currDate.getDate() + days[idx]);
    return prevDate.getMonth() !== currDate.getMonth();
  };

  const getColumnSeparatorClass = (idx: number): string => {
    if (isNewMonth(idx)) return 'border-l-2 border-l-slate-400 dark:border-l-slate-500';
    if (isNewWeek(idx)) return 'border-l border-l-slate-300 dark:border-l-slate-600';
    return '';
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
      return '';
    } else {
      const today = new Date();
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysValue);
      const weekdays = ['Su', 'M', 'T', 'w', 'Th', 'F', 'Sa'];
      return weekdays[targetDate.getDay()];
    }
  };

  // Helper to check if a column index starts a new date group
  // Show separator for all date groups except the very first column
  const isDateGroupStart = (colIdx: number) => {
    if (colIdx === 0) return false;
    return dateGroups.some(group => group.startIdx === colIdx);
  };

  return (
    <Card className="p-2" data-testid="pl-heatmap">
      {/* Header with metrics and tab buttons */}
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-4" data-testid="strategy-metrics-bar">
          {metrics && metrics.maxProfit === null && metrics.maxLoss === null && metrics.netPremium === 0 ? (
            <span className="text-sm text-muted-foreground italic">
              This strategy has no enabled items (add options from the Add button)
            </span>
          ) : metrics ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Max Profit:</span>
                <span className="text-base font-bold font-mono text-emerald-500" data-testid="text-max-profit">
                  {metrics.maxProfit !== null ? `$${Math.abs(metrics.maxProfit).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : "∞"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Max Loss:</span>
                <span className="text-base font-bold font-mono text-rose-500" data-testid="text-max-loss">
                  {metrics.maxLoss !== null ? `$${Math.abs(metrics.maxLoss).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : "∞"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Breakeven:</span>
                <span className="text-base font-semibold font-mono text-foreground" data-testid="text-breakeven">
                  {metrics.breakeven.length > 0 
                    ? metrics.breakeven.slice(0, 2).map(p => `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`).join(', ')
                    : "N/A"
                  }
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Net:</span>
                <span className="text-base font-bold font-mono text-foreground" data-testid="text-net-premium">
                  ${Math.abs(metrics.netPremium).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[11px] text-muted-foreground/70">
                  {metrics.netPremium >= 0 ? "(credit)" : "(debit)"}
                </span>
              </div>
              {hasRealizedPL && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Realized:</span>
                  <span className={`text-base font-bold font-mono ${realizedPL >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`} data-testid="text-realized-pl">
                    {realizedPL >= 0 ? '' : '-'}${Math.abs(Math.round(realizedPL)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              )}
              {hasUnrealizedPL && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Unrealized:</span>
                  <span className={`text-base font-bold font-mono ${unrealizedPL >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`} data-testid="text-unrealized-pl">
                    {unrealizedPL >= 0 ? '' : '-'}${Math.abs(Math.round(unrealizedPL)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
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
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed', minWidth: 0 }}>
          <thead>
            {/* Month group row for non-hourly mode */}
            {!useHours && (() => {
              const today = new Date();
              const monthGroups: Array<{ label: string; count: number }> = [];
              let lastMonth = '';
              days.forEach((day) => {
                const targetDate = new Date(today);
                targetDate.setDate(targetDate.getDate() + day);
                const monthLabel = targetDate.toLocaleString('default', { month: 'short' });
                if (monthLabel !== lastMonth) {
                  monthGroups.push({ label: monthLabel, count: 1 });
                  lastMonth = monthLabel;
                } else {
                  monthGroups[monthGroups.length - 1].count++;
                }
              });
              return (
                <tr>
                  <th colSpan={2} className="border-b border-border bg-slate-100 dark:bg-slate-800/50" style={{ width: '97px' }} />
                  {monthGroups.map((group, idx) => (
                    <th
                      key={idx}
                      colSpan={group.count}
                      className={`text-[10px] font-bold text-center p-1 border-b border-border bg-slate-200/70 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 ${
                        idx > 0 ? 'border-l-2 border-l-slate-400 dark:border-l-slate-500' : ''
                      }`}
                    >
                      {group.label}
                    </th>
                  ))}
                </tr>
              );
            })()}
            {/* Date group row (only shown when useHours is true) */}
            {useHours && dateGroups.length > 0 && (
              <tr>
                <th 
                  colSpan={2} 
                  rowSpan={1}
                  className="text-[9px] font-semibold text-center p-1 border-b border-border bg-slate-100 dark:bg-slate-800/50"
                  style={{ width: '97px' }}
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
                className="text-[10px] font-semibold text-left px-1.5 py-1 border-b border-border sticky left-0 bg-slate-100 dark:bg-slate-800/50 z-10"
                scope="col"
                style={{ width: '55px' }}
              >
                Price
              </th>
              <th 
                className="text-[10px] font-semibold text-right pl-2 pr-1.5 py-1 border-b border-border bg-slate-100 dark:bg-slate-800/50"
                scope="col"
                style={{ width: '42px' }}
              >
                %
              </th>
              {days.map((day, idx) => {
                const today = new Date();
                const targetDate = new Date(today);
                targetDate.setDate(targetDate.getDate() + day);
                const dateDay = targetDate.getDate();
                const weekdayLabel = getTimeSubLabel(day);
                return (
                  <th
                    key={idx}
                    scope="col"
                    className={`text-[9px] font-normal text-center px-0.5 py-1 border-b border-border bg-slate-100 dark:bg-slate-800/50 ${
                      getColumnSeparatorClass(idx)
                    }`}
                    data-testid={`header-time-${idx}`}
                  >
                    {useHours ? (
                      <>
                        <div className="text-[9px] text-muted-foreground leading-tight whitespace-nowrap">{getTimeLabel(day)}</div>
                        {weekdayLabel && (
                          <div className="text-[8px] text-muted-foreground/60 font-normal leading-tight">{weekdayLabel}</div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="text-[9px] text-muted-foreground leading-tight whitespace-nowrap">{dateDay} {weekdayLabel}</div>
                      </>
                    )}
                  </th>
                );
              })}
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
                    className={`text-[10px] font-mono font-semibold px-1.5 py-1 border-b border-border sticky left-0 z-10 whitespace-nowrap bg-slate-50 dark:bg-slate-900/70 ${
                      isClosestToCurrentPrice ? 'text-foreground dark:text-white font-bold' : ''
                    }`}
                    data-testid={`strike-${strike.toFixed(2)}`}
                  >
                    ${strikeDisplay}
                  </td>
                  <td
                    className={`text-[10px] font-mono text-right pl-2 pr-1.5 py-1 border-b border-border bg-slate-50 dark:bg-slate-900/70 ${
                      percentChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : 
                      percentChange < 0 ? 'text-red-500 dark:text-red-400' : 
                      'text-muted-foreground'
                    }`}
                    data-testid={`percent-${strike.toFixed(2)}`}
                  >
                    {Math.abs(percentChange) < 1 ? percentChange.toFixed(2) : percentChange.toFixed(1)}%
                  </td>
                  {row.map((cell, colIdx) => {
                    // For the "current scenario" cell (current price row, day 0):
                    // - If IV slider is at original value: show actual Realized + Unrealized (matches header)
                    // - If IV slider has been adjusted: show theoretical P/L (what-if analysis)
                    // This gives users both actual P/L and IV what-if capability
                    const isCurrentScenarioCell = isClosestToCurrentPrice && colIdx === 0;
                    const ivIsAtOriginal = Math.abs(impliedVolatility - calculatedIV) < 0.5; // Within 0.5% tolerance
                    const useActualPL = isCurrentScenarioCell && hasUnrealizedPL && ivIsAtOriginal;
                    
                    const cellPnl = useActualPL
                      ? (realizedPL + unrealizedPL)  // Actual P/L from header (IV at original)
                      : cell.pnl;                     // Theoretical P/L with slider IV
                    // Don't apply commission adjustment when using actual P/L 
                    // (it already includes commissions in the realized/unrealized calculation)
                    const adjustedPnl = useActualPL
                      ? cellPnl
                      : adjustPnl(cellPnl);
                    const displayValue = Math.round(adjustedPnl).toLocaleString('en-US', { maximumFractionDigits: 0 });
                    return (
                      <td
                        key={colIdx}
                        className="text-[10px] font-mono text-center px-0.5 py-1 border-b border-border/20 text-white heatmap-cell"
                        style={getPnlStyle(cellPnl)}
                        data-testid={`cell-${strike.toFixed(2)}-${days[colIdx]}`}
                      >
                        {displayValue}
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

      {/* Range and IV sliders - responsive layout */}
      <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 text-[10px]">
        <div className="flex items-center gap-1.5 flex-1">
          <span className="text-muted-foreground whitespace-nowrap w-10 sm:w-auto">Range</span>
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
          <span className="text-muted-foreground whitespace-nowrap w-10 sm:w-auto">IV</span>
          <div className="relative flex-1">
            <Slider
              value={[impliedVolatility]}
              onValueChange={(v) => onVolatilityChange(v[0])}
              onPointerDown={() => setIsDraggingIV(true)}
              min={5}
              max={150}
              step={0.1}
              className="flex-1"
              data-testid="slider-volatility"
            />
            {calculatedIV > 0 && (
              <div className="absolute left-0 right-0" style={{ top: '100%', overflow: 'visible' }}>
                {[1, 2, 3].map((multiplier) => {
                  const markerValue = calculatedIV * multiplier;
                  if (markerValue < 5 || markerValue > 150) return null;
                  const markerPercent = ((markerValue - 5) / (150 - 5)) * 100;
                  return (
                    <button
                      key={multiplier}
                      className="absolute -translate-x-1/2 flex flex-col items-center cursor-pointer group px-2 py-0.5"
                      style={{ left: `${markerPercent}%`, top: 0 }}
                      onClick={() => onVolatilityChange(markerValue)}
                      data-testid={`button-iv-${multiplier}x`}
                    >
                      <span className="block w-px h-2 bg-muted-foreground/50 group-hover:bg-foreground transition-colors" />
                      <span className="text-[9px] leading-tight text-muted-foreground group-hover:text-foreground transition-colors mt-0.5">
                        x{multiplier}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {isDraggingIV && calculatedIV > 0 && ivShift !== 0 && (
              <div
                className="absolute -translate-x-1/2 px-2 py-1 rounded text-xs font-bold text-white bg-primary whitespace-nowrap pointer-events-none shadow-md"
                style={{ left: `${ivSliderPercent}%`, top: '100%', marginTop: '16px', zIndex: 9999, overflow: 'visible' }}
                data-testid="tooltip-iv-shift"
              >
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-primary" />
                {ivShiftText}
              </div>
            )}
          </div>
          <span className="font-mono w-10 text-right">{impliedVolatility.toFixed(1)}%</span>
          <Button
            variant="ghost"
            size="sm"
            className={`h-4 w-4 p-0 ${isManualVolatility ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={onResetIV}
            title="Reset to market IV"
            data-testid="button-reset-iv"
          >
            <RotateCcw className="h-2.5 w-2.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
