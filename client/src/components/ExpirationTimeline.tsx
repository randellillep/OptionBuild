import { useMemo } from "react";

interface ExpirationTimelineProps {
  expirationDays: number[];
  selectedDays: number | null;
  onSelectDays: (days: number) => void;
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
}: ExpirationTimelineProps) {
  const today = new Date();
  
  // Generate standard options expiration dates
  const expirationDates = useMemo(() => getOptionsExpirationDates(), []);
  
  // Convert dates to days from today
  const calculatedExpirationDays = useMemo(() => {
    return expirationDates.map(date => {
      const diffTime = date.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    });
  }, [expirationDates, today]);
  
  // Always use calculated standard Friday expirations for the timeline
  // The expirationDays prop is kept for future API integration
  const allDays = calculatedExpirationDays;
  
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
    
    allDays.forEach(days => {
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

  return (
    <div className="bg-muted/30 rounded-lg p-4 border border-border">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-foreground">EXPIRATION:</span>
        <span className="text-sm font-bold text-foreground">{selectedExpirationDays}d</span>
      </div>

      <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
        {groupedDates.map((group, groupIdx) => (
          <div key={`${group.month}-${group.year}-${groupIdx}`} className="flex flex-col">
            {/* Month label row */}
            <div className="flex items-center justify-center bg-muted/50 px-2 py-1 border-r border-border min-w-fit">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                {group.month}{group.year}
              </span>
            </div>
            
            {/* Date buttons row */}
            <div className="flex items-stretch border-r border-border">
              {group.dates.map(({ day, days }, idx) => {
                const isSelected = selectedDays === days || (selectedDays === null && days === allDays[0]);
                
                return (
                  <button
                    key={`${days}-${idx}`}
                    onClick={() => onSelectDays(days)}
                    className={`flex items-center justify-center min-w-[40px] px-3 py-2 text-sm font-semibold transition-colors border-r border-border last:border-r-0 ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted/60 active:bg-muted'
                    }`}
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
