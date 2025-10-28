import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ExpirationTimelineProps {
  expirationDays: number[];
  selectedDays: number | null;
  onSelectDays: (days: number) => void;
}

export function ExpirationTimeline({
  expirationDays,
  selectedDays,
  onSelectDays,
}: ExpirationTimelineProps) {
  const today = new Date();
  
  const getDaysLabel = (days: number) => {
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + days);
    
    const month = targetDate.toLocaleString('default', { month: 'short' });
    const day = targetDate.getDate();
    
    return { month, day, days };
  };

  const allDays = [...expirationDays];
  if (allDays.length === 0) {
    allDays.push(30);
  }

  return (
    <Card className="p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold mb-1">Expiration</h3>
        <p className="text-xs text-muted-foreground">
          Select expiration date to analyze
        </p>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {allDays.map((days) => {
          const { month, day } = getDaysLabel(days);
          const isSelected = selectedDays === days || (selectedDays === null && days === allDays[0]);
          
          return (
            <button
              key={days}
              onClick={() => onSelectDays(days)}
              className={`flex flex-col items-center min-w-[60px] p-3 rounded-md border transition-all ${
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary-border'
                  : 'bg-card hover-elevate active-elevate-2 border-border'
              }`}
              data-testid={`button-expiration-${days}`}
            >
              <div className="text-xs font-medium">{month}</div>
              <div className="text-2xl font-bold">{day}</div>
              <div className="text-xs opacity-75">{days}d</div>
            </button>
          );
        })}
      </div>

      {allDays.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {allDays.length} expiration{allDays.length !== 1 ? 's' : ''} available
          </Badge>
        </div>
      )}
    </Card>
  );
}
