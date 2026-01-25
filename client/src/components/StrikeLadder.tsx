import { useState, useRef, useEffect, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { OptionDetailsPanel } from "@/components/OptionDetailsPanel";
import type { OptionLeg, ClosingEntry } from "@shared/schema";
import { calculateOptionPrice, calculateImpliedVolatility } from "@/lib/options-pricing";
import { Check, ChevronDown } from "lucide-react";

interface StrikeLadderProps {
  legs: OptionLeg[];
  currentPrice: number;
  strikeRange: { min: number; max: number };
  symbol: string;
  expirationDate: string | null;
  volatility?: number;
  onUpdateLeg: (legId: string, updates: Partial<OptionLeg>) => void;
  onRemoveLeg: (legId: string) => void;
  onAddLeg: (leg: Omit<OptionLeg, "id">) => void;
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
  volatility = 0.3,
  onUpdateLeg,
  onRemoveLeg,
  onAddLeg,
  optionsChainData,
  availableStrikes,
}: StrikeLadderProps) {
  const [selectedLeg, setSelectedLeg] = useState<OptionLeg | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isClosedBadgeClick, setIsClosedBadgeClick] = useState(false);
  const [draggedLeg, setDraggedLeg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isDraggingLadder, setIsDraggingLadder] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartOffset, setDragStartOffset] = useState(0);
  const ladderRef = useRef<HTMLDivElement>(null);

  const strikeIncrement = useMemo(() => {
    if (availableStrikes && availableStrikes.strikes.length > 1) {
      const intervals: number[] = [];
      for (let i = 1; i < availableStrikes.strikes.length; i++) {
        const diff = Number((availableStrikes.strikes[i] - availableStrikes.strikes[i - 1]).toFixed(2));
        if (diff > 0) intervals.push(diff);
      }
      if (intervals.length > 0) {
        const counts = new Map<number, number>();
        intervals.forEach(interval => {
          counts.set(interval, (counts.get(interval) || 0) + 1);
        });
        let maxCount = 0;
        let commonInterval = 5;
        counts.forEach((count, interval) => {
          if (count > maxCount) {
            maxCount = count;
            commonInterval = interval;
          }
        });
        return commonInterval;
      }
    }
    if (currentPrice < 25) return 0.5;
    if (currentPrice < 100) return 1;
    if (currentPrice < 200) return 2.5;
    if (currentPrice < 500) return 5;
    return 10;
  }, [availableStrikes, currentPrice]);

  const visibleStrikes = useMemo(() => {
    if (availableStrikes && availableStrikes.strikes.length > 0) {
      return availableStrikes.strikes.filter(
        s => s >= strikeRange.min && s <= strikeRange.max
      ).sort((a, b) => b - a);
    }
    
    const strikes: number[] = [];
    const start = Math.ceil(strikeRange.min / strikeIncrement) * strikeIncrement;
    for (let strike = start; strike <= strikeRange.max; strike += strikeIncrement) {
      strikes.push(Number(strike.toFixed(2)));
    }
    return strikes.sort((a, b) => b - a);
  }, [availableStrikes, strikeRange, strikeIncrement]);

  const displayStrikes = useMemo(() => {
    const totalStrikes = visibleStrikes.length;
    if (totalStrikes <= 15) return visibleStrikes;
    
    const interval = Math.ceil(totalStrikes / 15);
    return visibleStrikes.filter((_, i) => i % interval === 0);
  }, [visibleStrikes]);

  const getStrikeFromY = (clientY: number): number | null => {
    if (!ladderRef.current) return null;
    const rect = ladderRef.current.getBoundingClientRect();
    const y = clientY - rect.top + scrollOffset;
    const strikeHeight = 36;
    const index = Math.floor(y / strikeHeight);
    if (index >= 0 && index < displayStrikes.length) {
      return displayStrikes[index];
    }
    return null;
  };

  const handleBadgePointerDown = (leg: OptionLeg, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedLeg(leg.id);
    setIsDragging(true);
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {
      console.warn('Failed to capture pointer:', err);
    }
  };

  const handleBadgeClick = (leg: OptionLeg, e: React.MouseEvent, isClosedBadge: boolean = false, entryId?: string) => {
    if (!isDragging) {
      setSelectedLeg(leg);
      setIsClosedBadgeClick(isClosedBadge);
      setSelectedEntryId(entryId || null);
      setPopoverOpen(true);
    }
  };

  useEffect(() => {
    if (!isDragging || !draggedLeg) return;

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      const newStrike = getStrikeFromY(e.clientY);
      if (newStrike !== null) {
        const leg = legs.find(l => l.id === draggedLeg);
        if (!leg || leg.type === "stock") return;
        if (leg.strike === newStrike) return;

        const optionType = leg.type as "call" | "put";
        let marketPrice: number | undefined;
        let marketIV: number | undefined;
        
        if (optionsChainData?.quotes) {
          const matchingQuote = optionsChainData.quotes.find(
            (q: any) => q.strike === newStrike && q.side.toLowerCase() === optionType
          );
          if (matchingQuote) {
            if (matchingQuote.mid !== undefined && matchingQuote.mid > 0) {
              marketPrice = matchingQuote.mid;
            } else if (matchingQuote.bid !== undefined && matchingQuote.ask !== undefined) {
              marketPrice = (matchingQuote.bid + matchingQuote.ask) / 2;
            }
            const effectiveDTE = Math.max(0.5, leg.expirationDays || 1);
            if (marketPrice !== undefined && marketPrice > 0) {
              marketIV = calculateImpliedVolatility(optionType, currentPrice, newStrike, effectiveDTE, marketPrice);
            } else if (matchingQuote.iv !== undefined && matchingQuote.iv > 0) {
              marketIV = matchingQuote.iv;
            }
          }
        }

        if (marketPrice !== undefined && marketPrice > 0) {
          onUpdateLeg(draggedLeg, { 
            strike: newStrike, 
            premium: marketPrice,
            premiumSource: "market",
            impliedVolatility: marketIV,
            entryUnderlyingPrice: currentPrice,
            costBasisLocked: true,
          });
        } else {
          const theoreticalPremium = calculateOptionPrice(optionType, currentPrice, newStrike, leg.expirationDays, volatility);
          onUpdateLeg(draggedLeg, { 
            strike: newStrike,
            premium: theoreticalPremium,
            premiumSource: "theoretical",
            impliedVolatility: undefined,
            entryUnderlyingPrice: currentPrice,
            costBasisLocked: true,
          });
        }
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      setTimeout(() => setDraggedLeg(null), 100);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, draggedLeg, legs, optionsChainData, onUpdateLeg, currentPrice, volatility, displayStrikes]);

  useEffect(() => {
    if (!isDraggingLadder) return;

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      const deltaY = e.clientY - dragStartY;
      const newOffset = dragStartOffset - deltaY;
      const maxOffset = Math.max(0, displayStrikes.length * 36 - 300);
      setScrollOffset(Math.max(0, Math.min(maxOffset, newOffset)));
    };

    const handlePointerUp = () => {
      setIsDraggingLadder(false);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDraggingLadder, dragStartY, dragStartOffset, displayStrikes.length]);

  const handleLadderPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    setIsDraggingLadder(true);
    setDragStartY(e.clientY);
    setDragStartOffset(scrollOffset);
  };

  const callLegs = legs.filter(l => l.type === "call" && l.quantity > 0);
  const putLegs = legs.filter(l => l.type === "put" && l.quantity > 0);

  const getLegsAtStrike = (strike: number, type: "call" | "put") => {
    return legs.filter(l => l.type === type && l.strike === strike && l.quantity > 0);
  };

  const renderOptionBadge = (leg: OptionLeg, side: "call" | "put") => {
    const isExcluded = leg.isExcluded;
    const hasClosing = leg.closingTransaction?.isEnabled;
    const closingQty = hasClosing 
      ? (leg.closingTransaction?.entries?.reduce((sum, e) => sum + e.quantity, 0) || leg.closingTransaction?.quantity || 0)
      : 0;
    const remainingQty = leg.quantity - closingQty;
    
    if (hasClosing && remainingQty <= 0) return null;

    const isBeingDragged = draggedLeg === leg.id;
    const canDrag = !isExcluded;
    
    const bgColor = side === "call" 
      ? (leg.position === "long" ? "#35B534" : "#1a7a18")
      : (leg.position === "long" ? "#B5312B" : "#8a2420");

    return (
      <Popover 
        key={`open-${leg.id}`} 
        open={popoverOpen && selectedLeg?.id === leg.id && !isClosedBadgeClick && !isBeingDragged} 
        onOpenChange={(open) => {
          if (!open && selectedLeg?.id === leg.id && !isClosedBadgeClick) {
            setPopoverOpen(false);
            setSelectedLeg(null);
          }
        }}
        modal={false}
      >
        <PopoverTrigger asChild>
          <button
            onPointerDown={(e) => canDrag && handleBadgePointerDown(leg, e)}
            onClick={(e) => handleBadgeClick(leg, e, false)}
            data-testid={`badge-${leg.type}-${leg.position}-${leg.strike.toFixed(0)}`}
            className={`relative flex flex-col items-center ${isBeingDragged ? 'scale-110 z-50' : ''} ${canDrag ? 'cursor-grab' : 'cursor-pointer'} ${isExcluded ? 'opacity-50' : ''}`}
            style={{ touchAction: 'none' }}
          >
            <div 
              className={`px-2 py-1 rounded text-[10px] font-bold text-white shadow-sm ${isExcluded ? 'line-through' : ''}`}
              style={{ backgroundColor: isExcluded ? '#64748b' : bgColor }}
            >
              <span className="mr-1">{leg.position === "long" ? "+" : "-"}{hasClosing ? remainingQty : leg.quantity}</span>
              <span>{side === "call" ? "C" : "P"}</span>
            </div>
            <ChevronDown className="w-3 h-3 text-muted-foreground -mt-0.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="p-0 w-auto z-[9999]" 
          align="center" 
          side={side === "call" ? "right" : "left"}
          sideOffset={10}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <OptionDetailsPanel
            leg={leg}
            underlyingPrice={currentPrice}
            volatility={volatility}
            optionsChainData={optionsChainData}
            symbol={symbol}
            expirationDate={expirationDate}
            availableExpirations={optionsChainData?.expirations || []}
            isClosedView={false}
            onUpdateLeg={(updates) => onUpdateLeg(leg.id, updates)}
            onUpdateQuantity={(quantity) => onUpdateLeg(leg.id, { quantity })}
            onSwitchType={() => {
              onUpdateLeg(leg.id, { type: leg.type === "call" ? "put" : "call" });
              setPopoverOpen(false);
              setSelectedLeg(null);
            }}
            onChangePosition={() => onUpdateLeg(leg.id, { position: leg.position === "long" ? "short" : "long" })}
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

  const renderClosedBadge = (leg: OptionLeg, entry: ClosingEntry, side: "call" | "put") => {
    const isExcluded = entry.isExcluded;
    const bgColor = side === "call" ? "#0f3d0d" : "#4d1511";

    return (
      <Popover 
        key={`closed-${entry.id}`} 
        open={popoverOpen && selectedLeg?.id === leg.id && selectedEntryId === entry.id && isClosedBadgeClick} 
        onOpenChange={(open) => {
          if (!open && selectedEntryId === entry.id) {
            setPopoverOpen(false);
            setSelectedLeg(null);
            setSelectedEntryId(null);
            setIsClosedBadgeClick(false);
          }
        }}
        modal={false}
      >
        <PopoverTrigger asChild>
          <button
            onClick={(e) => handleBadgeClick(leg, e, true, entry.id)}
            data-testid={`badge-closed-${entry.id}`}
            className={`relative flex flex-col items-center cursor-pointer ${isExcluded ? 'opacity-50' : ''}`}
          >
            <div 
              className={`px-2 py-1 rounded text-[10px] font-bold text-white shadow-sm flex items-center gap-1 ${isExcluded ? 'line-through' : ''}`}
              style={{ backgroundColor: isExcluded ? '#64748b' : bgColor }}
            >
              <span>{entry.quantity}</span>
              <Check className="w-3 h-3" />
            </div>
            <ChevronDown className="w-3 h-3 text-muted-foreground -mt-0.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="p-0 w-auto z-[9999]" 
          align="center" 
          side={side === "call" ? "right" : "left"}
          sideOffset={10}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <OptionDetailsPanel
            leg={leg}
            underlyingPrice={currentPrice}
            volatility={volatility}
            optionsChainData={optionsChainData}
            symbol={symbol}
            expirationDate={expirationDate}
            availableExpirations={optionsChainData?.expirations || []}
            isClosedView={true}
            selectedEntryId={entry.id}
            onUpdateLeg={(updates) => onUpdateLeg(leg.id, updates)}
            onUpdateQuantity={(quantity) => onUpdateLeg(leg.id, { quantity })}
            onSwitchType={() => {}}
            onChangePosition={() => {}}
            onRemove={() => {
              onRemoveLeg(leg.id);
              setPopoverOpen(false);
              setSelectedLeg(null);
            }}
            onClose={() => {
              setPopoverOpen(false);
              setSelectedLeg(null);
              setSelectedEntryId(null);
              setIsClosedBadgeClick(false);
            }}
          />
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="w-full select-none">
      <div 
        ref={ladderRef}
        className="relative overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ height: '320px' }}
        onPointerDown={handleLadderPointerDown}
      >
        <div 
          className="absolute inset-x-0"
          style={{ 
            transform: `translateY(-${scrollOffset}px)`,
            transition: isDraggingLadder ? 'none' : 'transform 0.1s ease-out'
          }}
        >
          {displayStrikes.map((strike, index) => {
            const isCurrentPrice = Math.abs(strike - currentPrice) < strikeIncrement / 2;
            const putsAtStrike = getLegsAtStrike(strike, "put");
            const callsAtStrike = getLegsAtStrike(strike, "call");
            
            return (
              <div 
                key={strike}
                className={`flex items-center h-9 ${isCurrentPrice ? 'bg-accent/30' : ''}`}
              >
                <div className="flex-1 flex justify-end items-center gap-1 pr-2 min-w-0">
                  {putsAtStrike.map(leg => (
                    <div key={leg.id} className="flex flex-col items-center">
                      {renderOptionBadge(leg, "put")}
                      {leg.closingTransaction?.entries?.map(entry => 
                        entry.strike === strike && renderClosedBadge(leg, entry, "put")
                      )}
                    </div>
                  ))}
                </div>
                
                <div 
                  className={`w-16 text-center text-xs font-medium py-1 flex-shrink-0 ${
                    isCurrentPrice 
                      ? 'text-foreground font-bold' 
                      : 'text-muted-foreground'
                  }`}
                >
                  {strike % 1 === 0 ? strike.toFixed(0) : strike.toFixed(2)}
                  {isCurrentPrice && (
                    <div className="text-[9px] text-primary font-normal">SPOT</div>
                  )}
                </div>
                
                <div className="flex-1 flex justify-start items-center gap-1 pl-2 min-w-0">
                  {callsAtStrike.map(leg => (
                    <div key={leg.id} className="flex flex-col items-center">
                      {renderOptionBadge(leg, "call")}
                      {leg.closingTransaction?.entries?.map(entry => 
                        entry.strike === strike && renderClosedBadge(leg, entry, "call")
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-background to-transparent pointer-events-none z-10" />
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
      </div>
      
      <div className="flex justify-center gap-4 mt-2 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#B5312B' }} />
          <span>Puts</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#35B534' }} />
          <span>Calls</span>
        </div>
      </div>
    </div>
  );
}
