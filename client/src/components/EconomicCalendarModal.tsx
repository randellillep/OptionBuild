import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, TrendingUp, TrendingDown, Minus, Globe } from "lucide-react";

interface EconomicEvent {
  country: string;
  event: string;
  time: string;
  impact: string;
  actual: string | null;
  estimate: string | null;
  prev: string | null;
  unit: string;
}

interface EconomicCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImpactFilter = "all" | "high" | "medium" | "low";
type CountryFilter = "all" | "US" | "EU" | "GB" | "JP" | "CN" | "other";

const impactColors: Record<string, string> = {
  high: "bg-red-500/20 text-red-500 border-red-500/30",
  medium: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  low: "bg-green-500/20 text-green-500 border-green-500/30",
};

function parseNumericValue(value: string | null): number | null {
  if (value === null || value === undefined) return null;
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

function formatTime(timeString: string): string {
  if (!timeString) return "TBD";
  try {
    const date = new Date(timeString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return timeString;
  }
}

function formatDate(timeString: string): string {
  if (!timeString) return "";
  try {
    const date = new Date(timeString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function CountryBadge({ country }: { country: string }) {
  return (
    <Badge 
      variant="outline" 
      className="text-[10px] font-mono px-1.5 py-0"
    >
      {country || "??"}
    </Badge>
  );
}

export function EconomicCalendarModal({ isOpen, onClose }: EconomicCalendarModalProps) {
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>("all");
  const [countryFilter, setCountryFilter] = useState<CountryFilter>("all");

  const { data, isLoading, error } = useQuery<{ events: EconomicEvent[]; updated: number }>({
    queryKey: ["/api/calendar/economic"],
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const filteredEvents = useMemo(() => {
    if (!data?.events) return [];

    return data.events.filter((event) => {
      if (impactFilter !== "all" && event.impact?.toLowerCase() !== impactFilter) {
        return false;
      }

      if (countryFilter !== "all") {
        if (countryFilter === "other") {
          return !["US", "EU", "GB", "JP", "CN"].includes(event.country);
        }
        return event.country === countryFilter;
      }

      return true;
    });
  }, [data?.events, impactFilter, countryFilter]);

  const groupedEvents = useMemo(() => {
    const groups: Record<string, EconomicEvent[]> = {};

    filteredEvents.forEach((event) => {
      const dateKey = formatDate(event.time);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    });

    return groups;
  }, [filteredEvents]);

  function renderActualComparison(actual: string | null, estimate: string | null) {
    if (actual === null) return null;
    
    const actualNum = parseNumericValue(actual);
    const estimateNum = parseNumericValue(estimate);
    
    if (actualNum === null || estimateNum === null) return null;
    
    if (actualNum > estimateNum) {
      return <TrendingUp className="h-3 w-3 text-green-500" />;
    } else if (actualNum < estimateNum) {
      return <TrendingDown className="h-3 w-3 text-red-500" />;
    } else {
      return <Minus className="h-3 w-3 text-muted-foreground" />;
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Economic Calendar
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 pb-3 border-b">
          <div className="flex gap-1">
            <span className="text-xs text-muted-foreground mr-1 self-center">Impact:</span>
            {(["all", "high", "medium", "low"] as ImpactFilter[]).map((impact) => (
              <Button
                key={impact}
                size="sm"
                variant={impactFilter === impact ? "default" : "outline"}
                onClick={() => setImpactFilter(impact)}
                className="h-6 text-xs px-2"
                data-testid={`filter-impact-${impact}`}
              >
                {impact.charAt(0).toUpperCase() + impact.slice(1)}
              </Button>
            ))}
          </div>
          <div className="flex gap-1">
            <span className="text-xs text-muted-foreground mr-1 self-center">Country:</span>
            {(["all", "US", "EU", "GB", "JP", "CN"] as CountryFilter[]).map((country) => (
              <Button
                key={country}
                size="sm"
                variant={countryFilter === country ? "default" : "outline"}
                onClick={() => setCountryFilter(country)}
                className="h-6 text-xs px-2"
                data-testid={`filter-country-${country}`}
              >
                {country === "all" ? "All" : country}
              </Button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1 pr-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Globe className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Failed to load economic calendar</p>
              <p className="text-xs">Please try again later</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Calendar className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No events found</p>
              <p className="text-xs">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedEvents).map(([date, events]) => (
                <div key={date}>
                  <div className="sticky top-0 bg-background py-1 mb-2">
                    <Badge variant="secondary" className="text-xs font-medium">
                      {date}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {events.map((event, idx) => (
                      <div
                        key={`${event.event}-${idx}`}
                        className="p-3 rounded-lg border bg-card hover-elevate"
                        data-testid={`event-${idx}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <CountryBadge country={event.country} />
                            <span className="font-medium text-sm">{event.event}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {event.impact && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${impactColors[event.impact?.toLowerCase()] || ""}`}
                              >
                                {event.impact}
                              </Badge>
                            )}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatTime(event.time)}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <div className="text-center p-1.5 rounded bg-muted/30">
                            <p className="text-[10px] text-muted-foreground mb-0.5">Previous</p>
                            <p className="text-xs font-mono font-medium">
                              {event.prev ?? "—"}{event.prev && event.unit ? ` ${event.unit}` : ""}
                            </p>
                          </div>
                          <div className="text-center p-1.5 rounded bg-muted/30">
                            <p className="text-[10px] text-muted-foreground mb-0.5">Forecast</p>
                            <p className="text-xs font-mono font-medium">
                              {event.estimate ?? "—"}{event.estimate && event.unit ? ` ${event.unit}` : ""}
                            </p>
                          </div>
                          <div className="text-center p-1.5 rounded bg-primary/10 border border-primary/20">
                            <p className="text-[10px] text-muted-foreground mb-0.5">Actual</p>
                            <p className="text-xs font-mono font-semibold flex items-center justify-center gap-1">
                              {event.actual !== null ? (
                                <>
                                  {event.actual}{event.unit ? ` ${event.unit}` : ""}
                                  {renderActualComparison(event.actual, event.estimate)}
                                </>
                              ) : (
                                <span className="text-muted-foreground">Pending</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {data?.updated && (
          <div className="pt-2 border-t text-xs text-muted-foreground text-center">
            Last updated: {new Date(data.updated).toLocaleTimeString()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
