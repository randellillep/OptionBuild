import { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

interface LegExpirationInfo {
  date: string;
  days: number;
  isExpired: boolean;
  isToday?: boolean;
}

interface ExpirationTimelineProps {
  expirationDays: number[];
  selectedDays: number | null;
  onSelectDays: (days: number, date: string) => void;
  onAutoSelect?: (days: number, date: string) => void;
  symbol?: string;
  activeLegsExpirations?: number[]; // Unique expiration days from active legs
  expirationColorMap?: Map<number, string>; // Color mapping for multi-expiration visual coding
  legExpirationDates?: LegExpirationInfo[]; // Leg expiration dates to inject (including expired)
  suppressAutoSelect?: boolean; // Suppress auto-select during symbol transitions
}

interface OptionsExpirationsResponse {
  symbol: string;
  expirations: string[];
  updated: number;
}

// Calculate standard options expiration dates
// Options typically expire on the 3rd Friday of each month (monthly)
// Plus weekly Friday expirations
function getOptionsExpirationDates(): Date[] {
  const today = new Date();
  const expirations: Date[] = [];
  
  // Generate expirations for next 18 months
  for (let monthOffset = 0; monthOffset < 18; monthOffset++) {
    const targetMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    
    // Find all Fridays in this month
    const fridays: Date[] = [];
    const daysInMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), day);
      if (date.getDay() === 5) { // Friday = 5
        fridays.push(date);
      }
    }
    
    // Add weekly expirations (all Fridays that are in the future)
    fridays.forEach(friday => {
      if (friday > today) {
        expirations.push(friday);
      }
    });
  }
  
  // Sort by date and limit to next 20 expirations
  return expirations
    .sort((a, b) => a.getTime() - b.getTime())
    .slice(0, 20);
}

export function ExpirationTimeline({
  expirationDays,
  selectedDays,
  onSelectDays,
  onAutoSelect,
  symbol = "SPY",
  activeLegsExpirations = [],
  expirationColorMap,
  legExpirationDates = [],
  suppressAutoSelect = false,
}: ExpirationTimelineProps) {
  const today = new Date();
  
  // Fetch real options expiration dates from API
  const { data: apiExpirations, isLoading } = useQuery<OptionsExpirationsResponse>({
    queryKey: ["/api/options/expirations", symbol],
    enabled: !!symbol,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour (expirations don't change frequently)
  });
  
  // Generate standard options expiration dates as fallback
  const expirationDates = useMemo(() => getOptionsExpirationDates(), []);
  
  // Track which day counts are expired (from leg dates)
  const expiredDaysSet = useMemo(() => {
    const set = new Set<number>();
    legExpirationDates.forEach(info => {
      if (info.isExpired) {
        const dayCount = Math.ceil((new Date(info.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        set.add(dayCount);
      }
    });
    return set;
  }, [legExpirationDates, today]);
  
  // Convert API expiration dates to days from today and create mapping
  const { apiExpirationDays, daysToDateMap } = useMemo(() => {
    if (!apiExpirations?.expirations) return { apiExpirationDays: [], daysToDateMap: new Map<number, string>() };
    
    const mapping = new Map<number, string>();
    const days = apiExpirations.expirations
      .map((dateStr: string) => {
        const expirationDate = new Date(dateStr);
        const diffTime = expirationDate.getTime() - today.getTime();
        const dayCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (dayCount >= 0) {
          mapping.set(dayCount, dateStr);
          return dayCount;
        }
        return -1;
      })
      .filter((days: number) => days >= 0);
    
    // Inject expired/today leg dates that aren't in the API list
    legExpirationDates.forEach(info => {
      if (info.isExpired || info.isToday) {
        const dayCount = Math.ceil((new Date(info.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (!days.includes(dayCount)) {
          mapping.set(dayCount, info.date);
          days.push(dayCount);
        }
      }
    });
    
    // Re-sort after injecting expired dates
    days.sort((a: number, b: number) => a - b);
    
    return { apiExpirationDays: days, daysToDateMap: mapping };
  }, [apiExpirations, today, legExpirationDates]);
  
  // Convert calculated dates to days from today (fallback) and create mapping
  const { calculatedExpirationDays, calculatedDaysToDateMap } = useMemo(() => {
    const mapping = new Map<number, string>();
    const days = expirationDates.map(date => {
      const diffTime = date.getTime() - today.getTime();
      const dayCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      mapping.set(dayCount, date.toISOString().split('T')[0]);
      return dayCount;
    });
    return { calculatedExpirationDays: days, calculatedDaysToDateMap: mapping };
  }, [expirationDates, today]);
  
  // Use API data if available, otherwise use calculated Friday expirations
  const allDays = apiExpirationDays.length > 0 ? apiExpirationDays : calculatedExpirationDays;
  const activeDaysToDateMap = apiExpirationDays.length > 0 ? daysToDateMap : calculatedDaysToDateMap;
  
  const getDaysLabel = (days: number) => {
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + days);
    
    const month = targetDate.toLocaleString('default', { month: 'short' });
    const day = targetDate.getDate();
    const year = targetDate.getFullYear();
    const showYear = year !== today.getFullYear();
    
    return { month, day, days, year: showYear ? `'${year.toString().slice(-2)}` : '' };
  };

  // Group dates by month for display
  const groupedDates = useMemo(() => {
    const groups: { month: string; year: string; dates: Array<{ day: number; days: number }> }[] = [];
    let currentMonth = '';
    let currentYear = '';
    
    allDays.forEach((days: number) => {
      const { month, day, year } = getDaysLabel(days);
      const monthYear = `${month}${year}`;
      
      if (monthYear !== currentMonth + currentYear) {
        groups.push({ month, year, dates: [] });
        currentMonth = month;
        currentYear = year;
      }
      
      groups[groups.length - 1].dates.push({ day, days });
    });
    
    return groups;
  }, [allDays]);

  const selectedExpirationDays = selectedDays ?? (allDays.length > 0 ? allDays[0] : 0);

  // Auto-select expiration when:
  // 1. Nothing is currently selected
  // 2. The currently selected expiration is not in the available list
  // Snaps to nearest available date (not just first) to preserve user intent on symbol change
  // Uses onAutoSelect (which only updates global selection) to avoid overriding per-leg expirations
  useEffect(() => {
    if (allDays.length === 0) return;
    if (suppressAutoSelect) return;
    
    const roundedSelected = selectedDays !== null ? Math.round(selectedDays) : null;
    const shouldAutoSelect = 
      selectedDays === null || 
      (roundedSelected !== null && !allDays.includes(roundedSelected));
    
    if (shouldAutoSelect) {
      // Prefer first non-expired date when auto-selecting
      const nonExpiredDays = allDays.filter((d: number) => !expiredDaysSet.has(d));
      const defaultDays = nonExpiredDays.length > 0 ? nonExpiredDays[0] : allDays[0];
      let targetDays = defaultDays;
      
      if (selectedDays !== null) {
        const searchPool = nonExpiredDays.length > 0 ? nonExpiredDays : allDays;
        let minDiff = Math.abs(searchPool[0] - selectedDays);
        targetDays = searchPool[0];
        for (const d of searchPool) {
          const diff = Math.abs(d - selectedDays);
          if (diff < minDiff) {
            minDiff = diff;
            targetDays = d;
          }
        }
      }
      
      const targetDateStr = activeDaysToDateMap.get(targetDays) || '';
      const handler = onAutoSelect || onSelectDays;
      handler(targetDays, targetDateStr);
    }
  }, [allDays, activeDaysToDateMap, selectedDays, onSelectDays, onAutoSelect, suppressAutoSelect]);

  // Format expirations label: "2d, 11d" for multiple, or "30d" for single
  // Show "0d" for expired legs (they have expirationDays capped at 0)
  const expirationsLabel = useMemo(() => {
    if (activeLegsExpirations.length === 0) {
      return `${Math.round(selectedExpirationDays)}d`;
    }
    const sorted = [...activeLegsExpirations].sort((a, b) => a - b);
    return sorted.map(d => {
      const rounded = Math.round(d);
      return rounded <= 0 ? '0d' : `${rounded}d`;
    }).join(', ');
  }, [activeLegsExpirations, selectedExpirationDays]);

  // Check if a date has an active leg (rounded comparison to handle fractional vs integer days)
  // Also check injected expired leg dates by matching the date string
  const hasActiveLeg = (days: number) => {
    if (activeLegsExpirations.some(d => Math.round(d) === days)) return true;
    const dateStr = activeDaysToDateMap.get(days);
    if (dateStr && legExpirationDates.some(info => info.date === dateStr)) return true;
    return false;
  };

  return (
    <div className="bg-muted/30 rounded-md px-2 py-1.5 border border-border">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-semibold text-muted-foreground">
          {activeLegsExpirations.length > 1 ? 'EXPIRATIONS:' : 'EXPIRATION:'}
        </span>
        <span className="text-[10px] font-bold text-foreground">{expirationsLabel}</span>
        {isLoading && (
          <span className="text-[10px] text-muted-foreground">(Loading...)</span>
        )}
      </div>

      <div className="flex items-stretch gap-0 overflow-x-auto">
        {groupedDates.map((group, groupIdx) => (
          <div key={`${group.month}-${group.year}-${groupIdx}`} className="flex flex-col">
            {/* Month label row */}
            <div className="flex items-center justify-center bg-muted/50 px-1 py-0 border-r border-border min-w-fit">
              <span className="text-[9px] font-medium text-muted-foreground whitespace-nowrap">
                {group.month}{group.year}
              </span>
            </div>
            
            {/* Date buttons row */}
            <div className="flex items-stretch border-r border-border">
              {group.dates.map(({ day, days }, idx) => {
                const isSelected = (selectedDays !== null && Math.round(selectedDays) === days) || (selectedDays === null && days === allDays[0]);
                const hasLeg = hasActiveLeg(days);
                const isExpiredDate = expiredDaysSet.has(days);
                
                let expirationColor: string | undefined;
                if (expirationColorMap) {
                  expirationColorMap.forEach((color, key) => {
                    if (Math.round(key) === days) {
                      expirationColor = color;
                    }
                  });
                }
                
                return (
                  <button
                    key={`${days}-${idx}`}
                    onClick={() => {
                      const dateStr = activeDaysToDateMap.get(days) || '';
                      onSelectDays(days, dateStr);
                    }}
                    className={`relative flex items-center justify-center min-w-[24px] px-1.5 py-0.5 text-[10px] font-semibold transition-colors border-r border-border last:border-r-0 ${
                      isExpiredDate && hasLeg
                        ? 'bg-muted-foreground/60 text-muted line-through'
                        : hasLeg && expirationColor
                        ? ''
                        : hasLeg
                        ? 'bg-slate-500 dark:bg-slate-400 text-white dark:text-slate-900'
                        : isSelected
                        ? 'bg-slate-500 dark:bg-slate-400 text-white dark:text-slate-900'
                        : 'hover:bg-muted/60 active:bg-muted'
                    }`}
                    style={
                      isExpiredDate && hasLeg
                        ? { opacity: 0.8 }
                        : hasLeg && expirationColor
                        ? { backgroundColor: expirationColor, color: 'white' }
                        : undefined
                    }
                    data-testid={`button-expiration-${days}`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
