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
  availableStrikes?: {
    min: number;
    max: number;
    strikes: number[];
  } | null;
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
  availableStrikes,
}: StrikeLadderProps) {
  const [selectedLeg, setSelectedLeg] = useState<OptionLeg | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [draggedLeg, setDraggedLeg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState(0); // Percentage offset for horizontal panning
  const [panStartX, setPanStartX] = useState(0);
  const [panStartOffset, setPanStartOffset] = useState(0);
  const ladderRef = useRef<HTMLDivElement>(null);

  const baseRange = strikeRange.max - strikeRange.min;
  
  // Apply pan offset to adjust visible range (pan offset is in percentage)
  const panAdjustment = (panOffset / 100) * baseRange;
  const adjustedMin = strikeRange.min + panAdjustment;
  const adjustedMax = strikeRange.max + panAdjustment;
  const range = adjustedMax - adjustedMin;
  
  // Determine strike interval based on range
  const getStrikeInterval = () => {
    if (range <= 50) return 5;
    if (range <= 100) return 10;
    if (range <= 200) return 20;
    if (range <= 500) return 50;
    return 100;
  };

  const strikeInterval = getStrikeInterval();
  
  // Generate labeled strikes - use actual strikes when available, otherwise use intervals
  const generateLabeledStrikes = () => {
    // If we have market data, use actual available strikes (including decimals)
    if (availableStrikes && availableStrikes.strikes.length > 0) {
      // Filter strikes within adjusted display range and pick ~10-15 evenly spaced for labels
      const strikesInRange = availableStrikes.strikes.filter(
        s => s >= adjustedMin && s <= adjustedMax
      );
      
      // If we have many strikes, thin them out for readability
      if (strikesInRange.length > 15) {
        const step = Math.ceil(strikesInRange.length / 12);
        return strikesInRange.filter((_, i) => i % step === 0);
      }
      
      return strikesInRange;
    }
    
    // Otherwise, use interval-based strikes
    const strikes: number[] = [];
    const start = Math.ceil(adjustedMin / strikeInterval) * strikeInterval;
    for (let strike = start; strike <= adjustedMax; strike += strikeInterval) {
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

  // Calculate position percentage for a given strike (relative to adjusted range)
  const getStrikePosition = (strike: number) => {
    return ((strike - adjustedMin) / range) * 100;
  };

  // Calculate strike from x position
  const getStrikeFromPosition = (clientX: number) => {
    if (!ladderRef.current) return null;
    
    const rect = ladderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = (x / rect.width) * 100;
    const strike = adjustedMin + (percent / 100) * range;
    
    // If we have market data, snap to nearest available strike
    if (availableStrikes && availableStrikes.strikes.length > 0) {
      // Find nearest available strike
      const nearest = availableStrikes.strikes.reduce((prev, curr) => 
        Math.abs(curr - strike) < Math.abs(prev - strike) ? curr : prev
      );
      return nearest;
    }
    
    // Otherwise, snap to nearest valid strike interval and constrain
    const snapped = Math.round(strike / strikeInterval) * strikeInterval;
    return Math.max(adjustedMin, Math.min(adjustedMax, snapped));
  };

  const handleBadgePointerDown = (leg: OptionLeg, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedLeg(leg.id);
    setIsDragging(true);
    // Capture pointer for smooth dragging
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleBadgeClick = (leg: OptionLeg, e: React.MouseEvent) => {
    // Only open popover if we didn't just finish dragging
    if (!isDragging) {
      setSelectedLeg(leg);
      setPopoverOpen(true);
    }
  };

  // Handle badge dragging
  useEffect(() => {
    if (!isDragging || !draggedLeg) return;

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      const newStrike = getStrikeFromPosition(e.clientX);
      if (newStrike !== null) {
        onUpdateLeg(draggedLeg, { strike: newStrike });
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      setIsDragging(false);
      // Small delay to prevent popover from opening immediately after drag
      setTimeout(() => {
        setDraggedLeg(null);
      }, 100);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, draggedLeg, onUpdateLeg]);

  // Handle ladder panning
  useEffect(() => {
    if (!isPanning) return;

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      if (!ladderRef.current) return;
      
      const rect = ladderRef.current.getBoundingClientRect();
      const deltaX = e.clientX - panStartX;
      const deltaPercent = (deltaX / rect.width) * 100;
      
      // Pan moves opposite to drag direction (like dragging a map)
      const newOffset = panStartOffset - deltaPercent;
      
      // Clamp pan offset to reasonable limits (allow panning ±50% of range)
      const maxPanPercent = 50;
      setPanOffset(Math.max(-maxPanPercent, Math.min(maxPanPercent, newOffset)));
    };

    const handlePointerUp = () => {
      setIsPanning(false);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isPanning, panStartX, panStartOffset]);

  const currentPricePercent = getStrikePosition(currentPrice);

  // Handle panning on ladder background
  const handleLadderPointerDown = (e: React.PointerEvent) => {
    // Only start panning if not clicking on a badge
    if ((e.target as HTMLElement).closest('button')) {
      return; // Let badge handle its own dragging
    }
    
    e.preventDefault();
    setIsPanning(true);
    setPanStartX(e.clientX);
    setPanStartOffset(panOffset);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Render a draggable badge with quantity indicator
  const renderBadge = (leg: OptionLeg, position: 'long' | 'short', verticalOffset: number = 0) => {
    const isCall = leg.type === "call";
    const bgClass = isCall ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600";
    const testId = `badge-${leg.type}${position === 'short' ? '-short' : ''}-${leg.strike.toFixed(0)}`;
    const positionPercent = getStrikePosition(leg.strike);
    const isBeingDragged = draggedLeg === leg.id;
    const quantity = leg.quantity || 1;
    const quantityDisplay = leg.position === 'short' ? `-${quantity}` : `+${quantity}`;

    // Calculate vertical position accounting for stacking
    const baseOffset = position === 'long' ? -8 : -8;
    const stackOffset = verticalOffset * 28; // 28px per badge (height + gap)
    const topPosition = position === 'long' 
      ? `${baseOffset - stackOffset}px`
      : `auto`;
    const bottomPosition = position === 'short'
      ? `${baseOffset - stackOffset}px` 
      : `auto`;

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
          <div
            className="absolute"
            style={{
              left: `${positionPercent}%`,
              transform: 'translateX(-50%)',
              top: topPosition,
              bottom: bottomPosition,
            }}
          >
            <button
              onPointerDown={(e) => handleBadgePointerDown(leg, e)}
              onClick={(e) => handleBadgeClick(leg, e)}
              data-testid={testId}
              className={`relative text-[10px] h-6 px-2 ${bgClass} text-white font-bold whitespace-nowrap ${isBeingDragged ? 'cursor-grabbing scale-110 z-50' : 'cursor-grab'} rounded transition-all border-0`}
              style={{ 
                boxShadow: isBeingDragged ? '0 4px 12px rgba(0,0,0,0.3)' : undefined,
                touchAction: 'none'
              }}
            >
              {leg.strike % 1 === 0 ? leg.strike.toFixed(0) : leg.strike.toFixed(2).replace(/\.?0+$/, '')}{isCall ? 'C' : 'P'}
              
              {/* Quantity badge overlay - always visible */}
              <span 
                className="absolute -top-1 -right-1 bg-white text-black text-[8px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5 border border-gray-300"
                data-testid={`quantity-${leg.id}`}
              >
                {quantityDisplay}
              </span>
            </button>
          </div>
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
          Drag badges to adjust strike prices, or drag background to pan view
        </p>
      </div>

      <div 
        ref={ladderRef} 
        className={`relative h-32 bg-muted/20 rounded-md overflow-visible px-4 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ userSelect: 'none', touchAction: 'none' }}
        onPointerDown={handleLadderPointerDown}
        data-testid="strike-ladder-container"
      >
        {/* Strike price labels and tick marks */}
        <div className="absolute inset-0 pointer-events-none">
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
                  {strike % 1 === 0 ? strike.toFixed(0) : strike.toFixed(2).replace(/\.?0+$/, '')}
                </div>
              </div>
            );
          })}
        </div>

        {/* Main horizontal line */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border/40 pointer-events-none" />

        {/* Current price indicator */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-primary z-10 pointer-events-none"
          style={{ left: `${currentPricePercent}%`, transform: 'translateX(-50%)' }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded whitespace-nowrap font-mono">
            ${currentPrice.toFixed(2)}
          </div>
        </div>

        {/* Render all option leg badges - group by strike and stack vertically */}
        {(() => {
          // Group long legs by strike for vertical stacking
          const longLegs = legs.filter(l => l.position === "long");
          const longByStrike = new Map<number, OptionLeg[]>();
          longLegs.forEach(leg => {
            const key = Math.round(leg.strike * 100) / 100; // Round to avoid float issues
            if (!longByStrike.has(key)) longByStrike.set(key, []);
            longByStrike.get(key)!.push(leg);
          });

          // Group short legs by strike for vertical stacking
          const shortLegs = legs.filter(l => l.position === "short");
          const shortByStrike = new Map<number, OptionLeg[]>();
          shortLegs.forEach(leg => {
            const key = Math.round(leg.strike * 100) / 100;
            if (!shortByStrike.has(key)) shortByStrike.set(key, []);
            shortByStrike.get(key)!.push(leg);
          });

          return (
            <>
              {/* Render long badges with vertical offsets */}
              {Array.from(longByStrike.values()).flatMap(legsAtStrike =>
                legsAtStrike.map((leg, index) => renderBadge(leg, 'long', index))
              )}
              {/* Render short badges with vertical offsets */}
              {Array.from(shortByStrike.values()).flatMap(legsAtStrike =>
                legsAtStrike.map((leg, index) => renderBadge(leg, 'short', index))
              )}
            </>
          );
        })()}
      </div>

      <div className="flex justify-between mt-2 text-xs text-muted-foreground font-mono">
        <span>${adjustedMin.toFixed(2)}</span>
        <span>${adjustedMax.toFixed(2)}</span>
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
