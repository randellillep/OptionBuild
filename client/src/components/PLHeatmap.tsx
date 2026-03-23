import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Table, BarChart3, RotateCcw, Lock, TrendingDown } from "lucide-react";
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
  savedTradeMode?: 'live' | 'expired' | 'closed';
  entryUnderlyingPrice?: number;
  exitUnderlyingPrice?: number;
  selectedExpirationDate?: string;
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
  savedTradeMode,
  entryUnderlyingPrice,
  exitUnderlyingPrice,
  selectedExpirationDate,
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

  // Historical trade mode flags
  const isHistoricalClosed = savedTradeMode === 'closed';
  const isHistoricalExpired = savedTradeMode === 'expired';
  const isHistorical = isHistoricalClosed || isHistoricalExpired;

  // Compute how many days from TODAY the actual expiration date is (negative = past).
  // Used to show the correct date label in the single historical column.
  const expiryDaysFromNow: number = (() => {
    if (!selectedExpirationDate) return 0;
    const [y, m, d] = selectedExpirationDate.split('-').map(Number);
    const expDate = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  })();

  // For historical trades, show only a single column filled with the fixed realized P/L.
  // The P/L is realized and doesn't depend on underlying price, so every row has the same value.
  const displayGrid = isHistorical && grid.length > 0
    ? grid.map(row => [{ strike: row[0]?.strike ?? 0, daysToExpiration: 0, pnl: realizedPL }])
    : grid;
  const displayDays = isHistorical && days.length > 0
    ? [expiryDaysFromNow]
    : days;

  // Find the row index closest to the entry underlying price (for the "Entry" marker)
  let entryRowIdx = -1;
  if (isHistorical && entryUnderlyingPrice != null) {
    let minDiff = Infinity;
    strikes.forEach((strike, idx) => {
      const diff = Math.abs(strike - entryUnderlyingPrice);
      if (diff < minDiff) { minDiff = diff; entryRowIdx = idx; }
    });
  }

  // Find the row index closest to the exit underlying price (for the "Exit" marker on closed trades)
  let exitRowIdx = -1;
  if (isHistoricalClosed && exitUnderlyingPrice != null) {
    let minDiff = Infinity;
    strikes.forEach((strike, idx) => {
      const diff = Math.abs(strike - exitUnderlyingPrice);
      if (diff < minDiff) { minDiff = diff; exitRowIdx = idx; }
    });
  }

  // Calculate total commissions to subtract from P&L
  const multiplier = commissionSettings.roundTrip ? 2 : 1;
  const totalCommissions = (numTrades * commissionSettings.perTrade + totalContracts * commissionSettings.perContract) * multiplier;

  // Adjust P&L values by subtracting commissions
  const adjustPnl = (pnl: number) => pnl - totalCommissions;
  
  const formatPnl = (value: number): string => {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1_000_000) {
      const m = abs / 1_000_000;
      return sign + (m >= 100 ? `${Math.round(m)}M` : m >= 10 ? `${m.toFixed(1).replace(/\.0$/, '')}M` : `${m.toFixed(2).replace(/\.?0+$/, '')}M`);
    }
    if (abs >= 10_000) {
      const k = abs / 1000;
      return sign + (k >= 100 ? `${Math.round(k)}k` : `${k.toFixed(1).replace(/\.0$/, '')}k`);
    }
    return Math.round(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  // For historical trades, all cells have the same realized P/L so use it directly.
  // This ensures full color saturation (not washed out).
  const allPnlValues = isHistorical
    ? [adjustPnl(realizedPL)]
    : grid.flatMap(row => row.map(cell => adjustPnl(cell.pnl)));
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
    if (useHours) {
      if (idx === 0) return '';
      if (isDateGroupStart(idx)) return 'border-l border-l-slate-300 dark:border-l-slate-600';
      return '';
    }
    if (isNewMonth(idx)) return 'border-l border-l-slate-300 dark:border-l-slate-600';
    if (isNewWeek(idx)) return 'border-l border-l-slate-300 dark:border-l-slate-600';
    return '';
  };

  const isDateGroupStart = (colIdx: number) => {
    if (colIdx === 0) return false;
    return dateGroups.some(group => group.startIdx === colIdx);
  };

  const getTimeLabel = (daysValue: number) => {
    if (useHours) {
      const now = new Date();
      if (targetDays <= 0) {
        const marketCloseET = 16;
        const remainingHours = daysValue * 24;
        const clockHoursET = marketCloseET - remainingHours;
        
        const etNowFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false });
        const etNowParts = etNowFormatter.formatToParts(now);
        const etNowHour = parseInt(etNowParts.find(p => p.type === 'hour')?.value || '0');
        const etNowMin = parseInt(etNowParts.find(p => p.type === 'minute')?.value || '0');
        const etNowHours = etNowHour + etNowMin / 60;
        
        const offsetFromNowHours = clockHoursET - etNowHours;
        const targetTime = new Date(now.getTime() + offsetFromNowHours * 3600000);
        
        return targetTime.toLocaleString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true 
        }).toLowerCase();
      }
      
      const targetTime = new Date(now.getTime() + daysValue * 24 * 60 * 60 * 1000);
      
      return targetTime.toLocaleString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      }).toLowerCase();
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


  return (
    <Card className="p-2" data-testid="pl-heatmap">
      {/* Historical trade banner — shown for closed/expired saved trades */}
      {isHistoricalClosed && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300" data-testid="banner-historical-closed">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          <span className="text-[11px] font-medium">Historical — Closed Trade.</span>
          <span className="text-[11px] text-amber-700 dark:text-amber-400">Realized P/L is fixed and does not depend on current market conditions.</span>
        </div>
      )}
      {isHistoricalExpired && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-blue-800 dark:text-blue-300" data-testid="banner-historical-expired">
          <TrendingDown className="h-3.5 w-3.5 shrink-0" />
          <span className="text-[11px] font-medium">Historical — Expired Trade.</span>
          <span className="text-[11px] text-blue-700 dark:text-blue-400">Showing payoff at expiry across price levels. Time dimension is not applicable.</span>
        </div>
      )}
      {/* Header with metrics and tab buttons */}
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-4" data-testid="strategy-metrics-bar">
          {isHistorical ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Realized P/L:</span>
              <span className={`text-base font-bold font-mono ${realizedPL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} data-testid="text-realized-pl-header">
                {realizedPL >= 0 ? '+' : '-'}${Math.abs(Math.round(realizedPL)).toLocaleString()}
              </span>
            </div>
          ) : metrics && metrics.maxProfit === null && metrics.maxLoss === null && metrics.netPremium === 0 ? (
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
            {/* Month group row — shown for both hourly and daily modes */}
            {(() => {
              const now = new Date();
              const monthGroups: Array<{ label: string; count: number }> = [];
              let lastMonth = '';

              if (isHistorical) {
                return null;
              } else if (useHours) {
                displayDays.forEach((daysValue) => {
                  const targetTime = new Date(now.getTime() + daysValue * 24 * 60 * 60 * 1000);
                  const monthLabel = targetTime.toLocaleString('default', { month: 'short' });
                  if (monthLabel !== lastMonth) {
                    monthGroups.push({ label: monthLabel, count: 1 });
                    lastMonth = monthLabel;
                  } else {
                    monthGroups[monthGroups.length - 1].count++;
                  }
                });
              } else {
                displayDays.forEach((day) => {
                  const targetDate = new Date(now);
                  targetDate.setDate(targetDate.getDate() + day);
                  const monthLabel = targetDate.toLocaleString('default', { month: 'short' });
                  if (monthLabel !== lastMonth) {
                    monthGroups.push({ label: monthLabel, count: 1 });
                    lastMonth = monthLabel;
                  } else {
                    monthGroups[monthGroups.length - 1].count++;
                  }
                });
              }
              
              return (
                <tr>
                  <th colSpan={2} className="border-b border-border bg-slate-100 dark:bg-slate-800/50" style={{ width: '97px' }} />
                  {monthGroups.map((group, idx) => (
                    <th
                      key={idx}
                      colSpan={group.count}
                      className={`text-[10px] font-bold text-center p-1 border-b border-border bg-slate-200/70 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 ${
                        idx > 0 ? 'border-l border-l-slate-300 dark:border-l-slate-600' : ''
                      }`}
                    >
                      {group.label}
                    </th>
                  ))}
                </tr>
              );
            })()}
            {/* Date group row (only shown when useHours is true and NOT in historical mode) */}
            {useHours && !isHistorical && dateGroups.length > 0 && (
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
                    className={`text-[10px] font-bold text-center p-1 border-b border-border bg-slate-200/70 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 ${
                      idx > 0 ? 'border-l border-l-slate-300 dark:border-l-slate-600' : ''
                    }`}
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
              {isHistorical ? (
                <th
                  scope="col"
                  className={`text-[9px] font-semibold text-center px-0.5 py-1 border-b border-border ${
                    isHistoricalExpired
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                  }`}
                  data-testid="header-at-expiry"
                >
                  <div className="whitespace-nowrap">{getTimeLabel(expiryDaysFromNow)}</div>
                  <div className="text-[8px] font-normal opacity-75">{isHistoricalExpired ? 'Expired' : 'Closed'}</div>
                </th>
              ) : (
                displayDays.map((day, idx) => {
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
                })
              )}
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
              
              return displayGrid.map((row, rowIdx) => {
              const strike = strikes[rowIdx];
              const percentChange = ((strike - currentPrice) / currentPrice) * 100;
              // For historical trades, don't highlight the "current price" row since market
              // conditions are irrelevant — use entry price row instead
              const isClosestToCurrentPrice = !isHistorical && rowIdx === closestRowIdx;
              const isEntryRow = rowIdx === entryRowIdx;
              const isExitRow = rowIdx === exitRowIdx;
              
              // Format strike price: show 2 decimals if value has meaningful decimals, otherwise show whole number
              const hasDecimals = strike % 1 !== 0;
              const strikeDisplay = hasDecimals || strike < 10 
                ? strike.toFixed(2) 
                : strike.toFixed(0);
              
              // Row border styles: current price (live), entry price (historical), exit price (closed)
              const rowBorderStyle = isClosestToCurrentPrice
                ? 'border-b-2 border-b-black/70 dark:border-b-white/70 border-dashed'
                : isEntryRow
                  ? 'border-b-2 border-b-amber-500/80 dark:border-b-amber-400/80 border-dashed'
                  : isExitRow
                    ? 'border-b-2 border-b-blue-500/80 dark:border-b-blue-400/80 border-dashed'
                    : '';
              
              return (
                <tr key={rowIdx} className={`h-[24px] heatmap-row ${rowBorderStyle}`}>
                  <td
                    className={`text-[10px] font-mono font-semibold px-1.5 py-1 border-b border-border sticky left-0 z-10 whitespace-nowrap bg-slate-50 dark:bg-slate-900/70 heatmap-price-label transition-colors ${
                      isClosestToCurrentPrice ? 'text-foreground dark:text-white font-bold' :
                      isEntryRow ? 'text-amber-700 dark:text-amber-400 font-bold' :
                      isExitRow ? 'text-blue-700 dark:text-blue-400 font-bold' : ''
                    }`}
                    data-testid={`strike-${strike.toFixed(2)}`}
                  >
                    ${strikeDisplay}
                    {isEntryRow && <span className="text-[8px] ml-0.5 opacity-70">↑entry</span>}
                    {isExitRow && !isEntryRow && <span className="text-[8px] ml-0.5 opacity-70">↓exit</span>}
                  </td>
                  <td
                    className={`text-[10px] font-mono text-right pl-2 pr-1.5 py-1 border-b border-border bg-slate-50 dark:bg-slate-900/70 heatmap-price-label transition-colors ${
                      percentChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : 
                      percentChange < 0 ? 'text-red-500 dark:text-red-400' : 
                      'text-muted-foreground'
                    }`}
                    data-testid={`percent-${strike.toFixed(2)}`}
                  >
                    {Math.abs(percentChange) < 1 ? percentChange.toFixed(2) : percentChange.toFixed(1)}%
                  </td>
                  {row.map((cell, colIdx) => {
                    const adjustedPnl = adjustPnl(cell.pnl);
                    const displayValue = formatPnl(adjustedPnl);
                    return (
                      <td
                        key={colIdx}
                        className="text-[10px] font-mono text-center px-0 py-1 border-b border-border/20 text-white heatmap-cell"
                        style={getPnlStyle(cell.pnl)}
                        data-testid={`cell-${strike.toFixed(2)}-${displayDays[colIdx]}`}
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
        <div className={`flex items-center gap-1.5 flex-1 ${isHistorical ? 'opacity-40 pointer-events-none' : ''}`}>
          <span className="text-muted-foreground whitespace-nowrap w-10 sm:w-auto">IV</span>
          <div className="relative flex-1">
            <Slider
              value={[impliedVolatility]}
              onValueChange={(v) => !isHistorical && onVolatilityChange(v[0])}
              onPointerDown={() => !isHistorical && setIsDraggingIV(true)}
              min={5}
              max={150}
              step={0.1}
              className="flex-1"
              disabled={isHistorical}
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
