import { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

interface ExpirationTimelineProps {
  expirationDays: number[];
  selectedDays: number | null;
  onSelectDays: (days: number, date: string) => void;
  onAutoSelect?: (days: number, date: string) => void;
  symbol?: string;
  activeLegsExpirations?: number[]; // Unique expiration days from active legs
  expirationColorMap?: Map<number, string>; // Color mapping for multi-expiration visual coding
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
    
    return { apiExpirationDays: days, daysToDateMap: mapping };
  }, [apiExpirations, today]);
  
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
  // Uses onAutoSelect (which only updates global selection) to avoid overriding per-leg expirations
  useEffect(() => {
    if (allDays.length === 0) return;
    
    const firstDays = allDays[0];
    const firstDateStr = activeDaysToDateMap.get(firstDays) || '';
    
    const shouldAutoSelect = 
      selectedDays === null || 
      (selectedDays !== null && !allDays.includes(selectedDays));
    
    if (shouldAutoSelect) {
      const handler = onAutoSelect || onSelectDays;
      handler(firstDays, firstDateStr);
    }
  }, [allDays, activeDaysToDateMap, selectedDays, onSelectDays, onAutoSelect]);

  // Format expirations label: "2d, 11d" for multiple, or "30d" for single
  const expirationsLabel = useMemo(() => {
    if (activeLegsExpirations.length === 0) {
      return `${selectedExpirationDays}d`;
    }
    const sorted = [...activeLegsExpirations].sort((a, b) => a - b);
    return sorted.map(d => `${d}d`).join(', ');
  }, [activeLegsExpirations, selectedExpirationDays]);

  // Check if a date has an active leg
  const hasActiveLeg = (days: number) => activeLegsExpirations.includes(days);

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
                const isSelected = selectedDays === days || (selectedDays === null && days === allDays[0]);
                const hasLeg = hasActiveLeg(days);
                
                const expirationColor = expirationColorMap?.get(days);
                
                return (
                  <button
                    key={`${days}-${idx}`}
                    onClick={() => {
                      const dateStr = activeDaysToDateMap.get(days) || '';
                      onSelectDays(days, dateStr);
                    }}
                    className={`relative flex items-center justify-center min-w-[24px] px-1.5 py-0.5 text-[10px] font-semibold transition-colors border-r border-border last:border-r-0 ${
                      hasLeg && expirationColor
                        ? ''
                        : hasLeg
                        ? 'bg-primary text-primary-foreground'
                        : isSelected
                        ? 'ring-1 ring-inset ring-primary text-foreground'
                        : 'hover:bg-muted/60 active:bg-muted'
                    }`}
                    style={hasLeg && expirationColor ? {
                      backgroundColor: expirationColor,
                      color: 'white',
                    } : undefined}
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
