import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import type { OptionLeg } from "@shared/schema";

interface StrikePriceBarProps {
  legs: OptionLeg[];
  currentPrice: number;
  strikeRange: { min: number; max: number };
  onUpdateLeg: (legId: string, updates: Partial<OptionLeg>) => void;
  availableStrikes?: {
    min: number;
    max: number;
    strikes: number[];
  } | null;
}

export function StrikePriceBar({
  legs,
  currentPrice,
  strikeRange,
  onUpdateLeg,
  availableStrikes,
}: StrikePriceBarProps) {
  const [draggedLegId, setDraggedLegId] = useState<string | null>(null);
  const [shiftPressed, setShiftPressed] = useState(false);
  const barRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragStartStrikesRef = useRef<Map<string, number>>(new Map());

  // Track shift key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftPressed(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const snapToNearestStrike = (value: number): number => {
    if (availableStrikes && availableStrikes.strikes.length > 0) {
      const strikes = availableStrikes.strikes;
      return strikes.reduce((closest, strike) => {
        return Math.abs(strike - value) < Math.abs(closest - value) ? strike : closest;
      });
    }

    // Fallback to interval-based snapping
    let increment: number;
    if (value < 25) increment = 0.5;
    else if (value < 100) increment = 1;
    else if (value < 200) increment = 2.5;
    else increment = 5;

    return Math.round(value / increment) * increment;
  };

  const handleMouseDown = (legId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setDraggedLegId(legId);
    
    // Store initial strikes for all legs (for shift-drag)
    const initialStrikes = new Map<string, number>();
    legs.forEach(leg => initialStrikes.set(leg.id, leg.strike));
    dragStartStrikesRef.current = initialStrikes;

    // Get the correct bar element for this specific leg
    const currentBar = barRefs.current.get(legId);
    if (!currentBar) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!currentBar) return;

      const rect = currentBar.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const rawStrike = strikeRange.min + percentage * (strikeRange.max - strikeRange.min);
      const newStrike = snapToNearestStrike(rawStrike);

      if (shiftPressed && dragStartStrikesRef.current.size > 0) {
        // Shift+Drag: Move all strikes together maintaining spread
        const draggedLeg = legs.find(l => l.id === legId);
        if (!draggedLeg) return;

        const originalStrike = dragStartStrikesRef.current.get(legId);
        if (originalStrike === undefined) return;

        const offset = newStrike - originalStrike;
        console.log('[StrikePriceBar] Shift+Drag: offset=', offset, 'newStrike=', newStrike, 'originalStrike=', originalStrike);

        // Check if ALL legs would stay within bounds before applying any updates
        let allWithinBounds = true;
        const plannedUpdates: Array<{ legId: string; strike: number }> = [];

        legs.forEach(leg => {
          const originalLegStrike = dragStartStrikesRef.current.get(leg.id);
          if (originalLegStrike !== undefined) {
            const adjustedStrike = snapToNearestStrike(originalLegStrike + offset);
            
            // Check if this strike would be out of bounds
            if (adjustedStrike < strikeRange.min || adjustedStrike > strikeRange.max) {
              allWithinBounds = false;
              console.log('[StrikePriceBar] Strike out of bounds:', adjustedStrike, 'range:', strikeRange);
            } else {
              plannedUpdates.push({ legId: leg.id, strike: adjustedStrike });
            }
          }
        });

        console.log('[StrikePriceBar] Shift+Drag: allWithinBounds=', allWithinBounds, 'plannedUpdates=', plannedUpdates);

        // Only update if ALL legs stay within bounds (preserves spread)
        if (allWithinBounds && plannedUpdates.length > 0) {
          plannedUpdates.forEach(({ legId: id, strike }) => {
            onUpdateLeg(id, { 
              strike,
              premiumSource: 'theoretical',
            });
          });
          console.log('[StrikePriceBar] Shift+Drag: Applied updates');
        }
      } else {
        // Normal drag: Move only the dragged leg
        if (newStrike >= strikeRange.min && newStrike <= strikeRange.max) {
          onUpdateLeg(legId, { 
            strike: newStrike,
            premiumSource: 'theoretical',
          });
        }
      }
    };

    const handleMouseUp = () => {
      setDraggedLegId(null);
      dragStartStrikesRef.current.clear();
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const getPositionPercentage = (strike: number): number => {
    return ((strike - strikeRange.min) / (strikeRange.max - strikeRange.min)) * 100;
  };

  const formatStrike = (strike: number): string => {
    return strike % 1 === 0 ? strike.toFixed(0) : strike.toString();
  };

  if (legs.length === 0) return null;

  return (
    <Card className="p-6" data-testid="strike-price-bar">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Strike Price Controls</h3>
          {shiftPressed && (
            <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded">
              Shift: Move All
            </span>
          )}
        </div>

        <div className="space-y-6">
          {legs.map((leg) => {
            const position = getPositionPercentage(leg.strike);
            const isCall = leg.type === "call";
            const isBuy = leg.position === "long";
            const color = isCall ? "bg-green-500" : "bg-red-500";
            const isDragged = draggedLegId === leg.id;

            return (
              <div key={leg.id} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">
                    {isBuy ? "BUY" : "SELL"} {isCall ? "CALL" : "PUT"}
                  </span>
                  <span className="font-mono font-semibold text-foreground">
                    {formatStrike(leg.strike)}
                  </span>
                </div>

                <div
                  ref={(el) => {
                    if (el) barRefs.current.set(leg.id, el);
                    else barRefs.current.delete(leg.id);
                  }}
                  className="relative h-12 bg-muted/30 rounded-lg border border-border cursor-pointer"
                  data-testid={`strike-bar-${leg.id}`}
                >
                  {/* Current price marker */}
                  {currentPrice >= strikeRange.min && currentPrice <= strikeRange.max && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
                      style={{ left: `${getPositionPercentage(currentPrice)}%` }}
                    >
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[10px] font-mono text-primary whitespace-nowrap">
                        ${formatStrike(currentPrice)}
                      </div>
                    </div>
                  )}

                  {/* Draggable handle */}
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-16 h-8 ${color} rounded-md shadow-lg cursor-grab transition-transform hover:scale-110 active:cursor-grabbing active:scale-105 z-20 flex items-center justify-center`}
                    style={{ left: `${position}%` }}
                    onMouseDown={(e) => handleMouseDown(leg.id, e)}
                    data-testid={`strike-handle-${formatStrike(leg.strike)}-${leg.type}`}
                    role="slider"
                    aria-label={`${isBuy ? 'Buy' : 'Sell'} ${isCall ? 'Call' : 'Put'} strike ${formatStrike(leg.strike)}`}
                    aria-valuenow={leg.strike}
                    aria-valuemin={strikeRange.min}
                    aria-valuemax={strikeRange.max}
                  >
                    <span className="text-xs font-bold text-white font-mono">
                      {formatStrike(leg.strike)}
                    </span>
                  </div>

                  {/* Strike ticks */}
                  {availableStrikes?.strikes
                    .filter(s => s >= strikeRange.min && s <= strikeRange.max)
                    .filter((_, i, arr) => arr.length <= 20 || i % Math.ceil(arr.length / 20) === 0)
                    .map((strike) => (
                      <div
                        key={strike}
                        className="absolute top-0 bottom-0 w-px bg-border/50"
                        style={{ left: `${getPositionPercentage(strike)}%` }}
                      />
                    ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Call</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>Put</span>
          </div>
          <span className="ml-auto">Drag to adjust • Hold Shift to move all</span>
        </div>
      </div>
    </Card>
  );
}
