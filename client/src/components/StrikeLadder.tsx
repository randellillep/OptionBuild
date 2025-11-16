import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { OptionDetailsPanel } from "@/components/OptionDetailsPanel";
import type { OptionLeg } from "@shared/schema";

interface StrikeLadderProps {
  legs: OptionLeg[];
  currentPrice: number;
  strikeRange: { min: number; max: number };
  symbol: string;
  expirationDate: string | null;
  onUpdateLeg: (legId: string, updates: Partial<OptionLeg>) => void;
  onRemoveLeg: (legId: string) => void;
  optionsChainData?: any;
}

export function StrikeLadder({ 
  legs, 
  currentPrice, 
  strikeRange,
  symbol,
  expirationDate,
  onUpdateLeg,
  onRemoveLeg,
  optionsChainData,
}: StrikeLadderProps) {
  const [selectedLeg, setSelectedLeg] = useState<OptionLeg | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [draggedLeg, setDraggedLeg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const ladderRef = useRef<HTMLDivElement>(null);

  const range = strikeRange.max - strikeRange.min;
  
  // Determine strike interval based on range
  const getStrikeInterval = () => {
    if (range <= 50) return 5;
    if (range <= 100) return 10;
    if (range <= 200) return 20;
    if (range <= 500) return 50;
    return 100;
  };

  const strikeInterval = getStrikeInterval();
  
  // Generate labeled strikes at regular intervals
  const generateLabeledStrikes = () => {
    const strikes: number[] = [];
    const start = Math.ceil(strikeRange.min / strikeInterval) * strikeInterval;
    for (let strike = start; strike <= strikeRange.max; strike += strikeInterval) {
      strikes.push(strike);
    }
    return strikes;
  };

  const labeledStrikes = generateLabeledStrikes();

  const getMarketDataForLeg = (leg: OptionLeg) => {
    if (!optionsChainData || !optionsChainData.quotes) return undefined;
    
    const option = optionsChainData.quotes.find((opt: any) => 
      Math.abs(opt.strike - leg.strike) < 0.01 && opt.side.toLowerCase() === leg.type
    );
    
    if (!option) return undefined;
    
    return {
      bid: option.bid || 0,
      ask: option.ask || 0,
      iv: option.iv || 0,
      delta: option.delta || 0,
      gamma: option.gamma || 0,
      theta: option.theta || 0,
      vega: option.vega || 0,
      rho: option.rho || 0,
      volume: option.volume || 0,
    };
  };

  // Calculate position percentage for a given strike
  const getStrikePosition = (strike: number) => {
    return ((strike - strikeRange.min) / range) * 100;
  };

  // Calculate strike from x position
  const getStrikeFromPosition = (clientX: number) => {
    if (!ladderRef.current) return null;
    
    const rect = ladderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = (x / rect.width) * 100;
    const strike = strikeRange.min + (percent / 100) * range;
    
    // Snap to nearest valid strike interval
    const snapped = Math.round(strike / strikeInterval) * strikeInterval;
    return Math.max(strikeRange.min, Math.min(strikeRange.max, snapped));
  };

  const handleBadgeMouseDown = (leg: OptionLeg, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedLeg(leg.id);
    setIsDragging(true);
  };

  const handleBadgeClick = (leg: OptionLeg, e: React.MouseEvent) => {
    // Only open popover if we didn't just finish dragging
    if (!isDragging) {
      setSelectedLeg(leg);
      setPopoverOpen(true);
    }
  };

  useEffect(() => {
    if (!isDragging || !draggedLeg) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newStrike = getStrikeFromPosition(e.clientX);
      if (newStrike !== null) {
        onUpdateLeg(draggedLeg, { strike: newStrike });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // Small delay to prevent popover from opening immediately after drag
      setTimeout(() => {
        setDraggedLeg(null);
      }, 100);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, draggedLeg, onUpdateLeg]);

  const currentPricePercent = getStrikePosition(currentPrice);

  // Render a draggable badge
  const renderBadge = (leg: OptionLeg, position: 'long' | 'short') => {
    const isCall = leg.type === "call";
    const bgClass = isCall ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600";
    const testId = `badge-${leg.type}${position === 'short' ? '-short' : ''}-${leg.strike.toFixed(0)}`;
    const positionPercent = getStrikePosition(leg.strike);
    const isBeingDragged = draggedLeg === leg.id;

    return (
      <Popover 
        key={leg.id} 
        open={popoverOpen && selectedLeg?.id === leg.id && !isBeingDragged} 
        onOpenChange={(open) => {
          if (!open && selectedLeg?.id === leg.id) {
            setPopoverOpen(false);
            setSelectedLeg(null);
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            onMouseDown={(e) => handleBadgeMouseDown(leg, e)}
            onClick={(e) => handleBadgeClick(leg, e)}
            data-testid={testId}
            className={`absolute ${position === 'long' ? '-top-8' : '-bottom-8'} text-[10px] h-6 px-2 ${bgClass} text-white font-bold whitespace-nowrap ${isBeingDragged ? 'cursor-grabbing scale-110 z-50' : 'cursor-grab'} rounded transition-all border-0`}
            style={{ 
              left: `${positionPercent}%`, 
              transform: 'translateX(-50%)',
              boxShadow: isBeingDragged ? '0 4px 12px rgba(0,0,0,0.3)' : undefined
            }}
          >
            {leg.strike.toFixed(0)}{isCall ? 'C' : 'P'}
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-auto" align="center" side="bottom" sideOffset={10}>
          <OptionDetailsPanel
            leg={leg}
            symbol={symbol}
            expirationDate={expirationDate}
            marketData={getMarketDataForLeg(leg)}
            onUpdateLeg={(updates) => {
              onUpdateLeg(leg.id, updates);
            }}
            onUpdateQuantity={(quantity) => {
              onUpdateLeg(leg.id, { quantity });
            }}
            onSwitchType={() => {
              onUpdateLeg(leg.id, { type: leg.type === "call" ? "put" : "call" });
              setPopoverOpen(false);
              setSelectedLeg(null);
            }}
            onChangePosition={() => {
              onUpdateLeg(leg.id, { position: leg.position === "long" ? "short" : "long" });
            }}
            onRemove={() => {
              onRemoveLeg(leg.id);
              setPopoverOpen(false);
              setSelectedLeg(null);
            }}
            onClose={() => {
              setPopoverOpen(false);
              setSelectedLeg(null);
            }}
          />
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <Card className="p-4 pb-6">
      <div className="mb-3">
        <h3 className="text-sm font-semibold mb-1">STRIKE:</h3>
        <p className="text-xs text-muted-foreground">
          Drag badges to adjust strike prices
        </p>
      </div>

      <div ref={ladderRef} className="relative h-32 bg-muted/20 rounded-md overflow-visible px-4">
        {/* Strike price labels and tick marks */}
        <div className="absolute inset-0">
          {labeledStrikes.map((strike) => {
            const position = getStrikePosition(strike);
            return (
              <div
                key={strike}
                className="absolute top-0 bottom-0"
                style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
              >
                {/* Tick mark */}
                <div className="w-0.5 h-3 bg-border/60" />
                {/* Strike label */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                  {strike}
                </div>
              </div>
            );
          })}
        </div>

        {/* Main horizontal line */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border/40" />

        {/* Current price indicator */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-primary z-10"
          style={{ left: `${currentPricePercent}%`, transform: 'translateX(-50%)' }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded whitespace-nowrap font-mono">
            ${currentPrice.toFixed(2)}
          </div>
        </div>

        {/* Render all option leg badges */}
        {legs.filter(l => l.position === "long").map(leg => renderBadge(leg, 'long'))}
        {legs.filter(l => l.position === "short").map(leg => renderBadge(leg, 'short'))}
      </div>

      <div className="flex justify-between mt-2 text-xs text-muted-foreground font-mono">
        <span>${strikeRange.min.toFixed(2)}</span>
        <span>${strikeRange.max.toFixed(2)}</span>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-primary rounded-sm"></div>
          <span className="text-muted-foreground">Current Price</span>
        </div>
        <div className="flex items-center gap-1">
          <Badge className="text-[8px] h-4 px-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">C</Badge>
          <span className="text-muted-foreground">Calls</span>
        </div>
        <div className="flex items-center gap-1">
          <Badge className="text-[8px] h-4 px-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">P</Badge>
          <span className="text-muted-foreground">Puts</span>
        </div>
      </div>
    </Card>
  );
}
