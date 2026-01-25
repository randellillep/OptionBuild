import { useState, useRef, useEffect, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { OptionDetailsPanel } from "@/components/OptionDetailsPanel";
import type { OptionLeg, ClosingEntry } from "@shared/schema";
import { calculateOptionPrice, calculateImpliedVolatility } from "@/lib/options-pricing";
import { Check } from "lucide-react";

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
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState(0);
  const [panStartX, setPanStartX] = useState(0);
  const [panStartOffset, setPanStartOffset] = useState(0);
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

  const fullRange = strikeRange.max - strikeRange.min;
  const zoomFactor = 0.5;
  const baseRange = fullRange * zoomFactor;
  const centerOffset = (fullRange - baseRange) / 2;
  const panAdjustment = (panOffset / 100) * baseRange;
  const adjustedMin = strikeRange.min + centerOffset + panAdjustment;
  const adjustedMax = strikeRange.max - centerOffset + panAdjustment;
  const range = adjustedMax - adjustedMin;

  const getLabelInterval = () => {
    if (currentPrice < 50) return 5;
    if (currentPrice < 100) return 10;
    if (currentPrice < 500) return 10;
    return 20;
  };

  const labelInterval = getLabelInterval();

  const generateAllStrikes = () => {
    if (availableStrikes && availableStrikes.strikes.length > 0) {
      return availableStrikes.strikes.filter(
        s => s >= adjustedMin && s <= adjustedMax
      );
    }
    
    const strikes: number[] = [];
    const start = Math.ceil(adjustedMin / strikeIncrement) * strikeIncrement;
    for (let strike = start; strike <= adjustedMax; strike += strikeIncrement) {
      strikes.push(Number(strike.toFixed(2)));
    }
    return strikes;
  };

  const allStrikes = generateAllStrikes();
  
  const shouldShowLabel = (strike: number) => {
    return strike % labelInterval === 0;
  };

  const getStrikePosition = (strike: number) => {
    return ((strike - adjustedMin) / range) * 100;
  };

  const getStrikeFromPosition = (clientX: number) => {
    if (!ladderRef.current) return null;
    
    const rect = ladderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = (x / rect.width) * 100;
    const rawStrike = adjustedMin + (percent / 100) * range;
    
    if (availableStrikes && availableStrikes.strikes.length > 0) {
      const clampedStrike = Math.max(
        availableStrikes.min, 
        Math.min(availableStrikes.max, rawStrike)
      );
      const nearest = availableStrikes.strikes.reduce((prev, curr) => 
        Math.abs(curr - clampedStrike) < Math.abs(prev - clampedStrike) ? curr : prev
      );
      return nearest;
    }
    
    const clampedRaw = Math.max(strikeRange.min, Math.min(strikeRange.max, rawStrike));
    const snapped = Math.round(clampedRaw / strikeIncrement) * strikeIncrement;
    return Math.max(strikeRange.min, Math.min(strikeRange.max, Number(snapped.toFixed(2))));
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
      const newStrike = getStrikeFromPosition(e.clientX);
      if (newStrike !== null) {
        const leg = legs.find(l => l.id === draggedLeg);
        if (!leg) return;
        if (leg.type === "stock") return;
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
              marketIV = calculateImpliedVolatility(
                optionType,
                currentPrice,
                newStrike,
                effectiveDTE,
                marketPrice
              );
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
          const theoreticalPremium = calculateOptionPrice(
            optionType,
            currentPrice,
            newStrike,
            leg.expirationDays,
            volatility
          );
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
  }, [isDragging, draggedLeg, legs, optionsChainData, onUpdateLeg, currentPrice, volatility]);

  useEffect(() => {
    if (!isPanning) return;

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      if (!ladderRef.current) return;
      
      const rect = ladderRef.current.getBoundingClientRect();
      const deltaX = e.clientX - panStartX;
      const deltaPercent = (deltaX / rect.width) * 100;
      const newOffset = panStartOffset - deltaPercent;
      
      const edgeMargin = 10;
      const maxPan = ((currentPrice - strikeRange.min) / baseRange - edgeMargin/100) * 100;
      const minPan = ((currentPrice - strikeRange.max) / baseRange + edgeMargin/100) * 100;
      
      setPanOffset(Math.max(minPan, Math.min(maxPan, newOffset)));
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
  }, [isPanning, panStartX, panStartOffset, currentPrice, strikeRange, baseRange]);

  const currentPricePercent = getStrikePosition(currentPrice);

  const handleLadderPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    e.preventDefault();
    setIsPanning(true);
    setPanStartX(e.clientX);
    setPanStartOffset(panOffset);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const renderOpenBadge = (leg: OptionLeg, position: 'long' | 'short', verticalOffset: number = 0) => {
    if (leg.quantity <= 0) return null;
    
    const isCall = leg.type === "call";
    const isExcluded = leg.isExcluded;
    const hasClosing = leg.closingTransaction?.isEnabled;
    const closingQty = hasClosing 
      ? (leg.closingTransaction?.entries && leg.closingTransaction.entries.length > 0
          ? leg.closingTransaction.entries.reduce((sum, e) => sum + e.quantity, 0)
          : (leg.closingTransaction?.quantity || 0))
      : 0;
    const quantity = leg.quantity;
    const remainingQty = quantity - closingQty;
    
    if (hasClosing && remainingQty <= 0) return null;
    
    const testId = `badge-${leg.type}${position === 'short' ? '-short' : ''}-${leg.strike.toFixed(0)}`;
    const rawPositionPercent = getStrikePosition(leg.strike);
    const positionPercent = Math.max(3, Math.min(97, rawPositionPercent));
    const isOutOfView = rawPositionPercent < 0 || rawPositionPercent > 100;
    const isBeingDragged = draggedLeg === leg.id;
    const canDrag = !isExcluded;
    
    const openBgColor = isCall ? '#35B534' : '#B5312B';
    
    const badgeHeight = 28;
    const stackOffset = verticalOffset * (badgeHeight + 4);
    const topPosition = position === 'long' 
      ? `calc(50% - ${badgeHeight + 18}px - ${stackOffset}px)`
      : `calc(50% + 18px + ${stackOffset}px)`;

    const strikeText = `${leg.strike % 1 === 0 ? leg.strike.toFixed(0) : leg.strike.toFixed(2).replace(/\.?0+$/, '')}${isCall ? 'C' : 'P'}`;

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
          <div
            className="absolute"
            style={{
              left: `${positionPercent}%`,
              transform: 'translateX(-50%)',
              top: topPosition,
              opacity: isExcluded ? 0.5 : (isOutOfView ? 0.7 : 1),
            }}
          >
            <button
              onPointerDown={(e) => canDrag && !isDragging && handleBadgePointerDown(leg, e)}
              onClick={(e) => handleBadgeClick(leg, e, false)}
              data-testid={testId}
              className={`relative flex flex-col items-center ${isBeingDragged ? 'scale-110 z-50' : ''} ${canDrag && !isDragging ? 'cursor-grab' : 'cursor-pointer'}`}
              style={{ touchAction: 'none', pointerEvents: isDragging && !isBeingDragged ? 'none' : 'auto' }}
            >
              {(hasClosing ? remainingQty : quantity) > 1 && (
                <div 
                  className={`absolute text-[8px] font-semibold text-white bg-gray-500 px-1 py-0.5 rounded-sm z-10 ${position === 'long' ? '-top-2.5 -right-2.5' : '-bottom-2.5 -right-2.5'}`}
                >
                  x{hasClosing ? remainingQty : quantity}
                </div>
              )}
              {position === 'short' && (
                <div 
                  className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[4px] border-l-transparent border-r-transparent"
                  style={{ borderBottomColor: isExcluded ? '#64748b' : openBgColor }}
                />
              )}
              <div
                className={`text-[14px] h-6 px-2 text-white font-bold whitespace-nowrap rounded flex items-center ${isExcluded ? 'line-through bg-slate-500' : ''}`}
                style={{ 
                  backgroundColor: isExcluded ? undefined : openBgColor,
                  boxShadow: isBeingDragged ? '0 4px 12px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.2)',
                }}
              >
                {strikeText}
              </div>
              {position === 'long' && (
                <div 
                  className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent"
                  style={{ borderTopColor: isExcluded ? '#64748b' : openBgColor }}
                />
              )}
            </button>
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="p-0 w-auto z-[9999]" 
          align="center" 
          side="bottom" 
          sideOffset={10}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          style={{ pointerEvents: 'auto' }}
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

  const renderClosedEntryBadge = (leg: OptionLeg, entry: ClosingEntry, position: 'long' | 'short', verticalOffset: number = 0) => {
    const isCall = leg.type === "call";
    const isExcluded = entry.isExcluded;
    
    const entryStrike = entry.strike;
    const rawPositionPercent = getStrikePosition(entryStrike);
    const positionPercent = Math.max(3, Math.min(97, rawPositionPercent));
    const isOutOfView = rawPositionPercent < 0 || rawPositionPercent > 100;
    
    const closedBgColor = isCall ? '#1a5a15' : '#6a211c';
    
    const badgeHeight = 28;
    const stackOffset = verticalOffset * (badgeHeight + 4);
    const topPosition = position === 'long'
      ? `calc(50% - ${badgeHeight + 18}px - ${stackOffset}px)`
      : `calc(50% + 18px + ${stackOffset}px)`;

    const strikeText = `${entryStrike % 1 === 0 ? entryStrike.toFixed(0) : entryStrike.toFixed(2).replace(/\.?0+$/, '')}${isCall ? 'C' : 'P'}`;

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
          <div
            className="absolute"
            style={{
              left: `${positionPercent}%`,
              transform: 'translateX(-50%)',
              top: topPosition,
              opacity: isExcluded ? 0.5 : (isOutOfView ? 0.7 : 1),
            }}
          >
            <button
              onClick={(e) => handleBadgeClick(leg, e, true, entry.id)}
              className="relative flex flex-col items-center cursor-pointer"
              data-testid={`badge-closed-${entry.id}`}
              style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
            >
              {entry.quantity > 1 && (
                <div 
                  className={`absolute text-[8px] font-semibold text-white bg-gray-500 px-1 py-0.5 rounded-sm z-10 ${position === 'long' ? '-top-2.5 -right-2.5' : '-bottom-2.5 -right-2.5'}`}
                >
                  x{entry.quantity}
                </div>
              )}
              {position === 'short' && (
                <div 
                  className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[4px] border-l-transparent border-r-transparent"
                  style={{ borderBottomColor: isExcluded ? '#64748b' : closedBgColor }}
                />
              )}
              <div
                className={`text-[14px] h-6 px-2 text-white font-bold whitespace-nowrap rounded flex items-center gap-1 ${isExcluded ? 'line-through bg-slate-500' : ''}`}
                style={{ 
                  backgroundColor: isExcluded ? undefined : closedBgColor,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
              >
                {strikeText}
                <Check className="h-3 w-3" />
              </div>
              {position === 'long' && (
                <div 
                  className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent"
                  style={{ borderTopColor: isExcluded ? '#64748b' : closedBgColor }}
                />
              )}
            </button>
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="p-0 w-auto z-[9999]" 
          align="center" 
          side="bottom"
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

  const strikesKey = legs.filter(l => l.type !== "stock").map(l => `${l.id}:${l.strike}:${l.position}`).join(',');
  
  const badgeStackLevels = useMemo(() => {
    const optionLegs = legs.filter(leg => leg.type !== "stock");
    const longLegs = optionLegs.filter(leg => leg.position === 'long').sort((a, b) => a.strike - b.strike);
    const shortLegs = optionLegs.filter(leg => leg.position === 'short').sort((a, b) => a.strike - b.strike);
    
    const levels: { [legId: string]: number } = {};
    const badgeWidthPercent = 8;
    
    const assignLevels = (sortedLegs: OptionLeg[]) => {
      const occupiedRanges: { left: number; right: number; level: number }[] = [];
      
      sortedLegs.forEach(leg => {
        const percent = ((leg.strike - strikeRange.min) / (strikeRange.max - strikeRange.min)) * 100;
        const left = percent - badgeWidthPercent / 2;
        const right = percent + badgeWidthPercent / 2;
        
        let level = 0;
        let foundLevel = false;
        
        while (!foundLevel) {
          const hasOverlap = occupiedRanges.some(range => 
            range.level === level && !(right < range.left || left > range.right)
          );
          
          if (!hasOverlap) {
            foundLevel = true;
          } else {
            level++;
          }
        }
        
        levels[leg.id] = level;
        occupiedRanges.push({ left, right, level });
      });
    };
    
    assignLevels(longLegs);
    assignLevels(shortLegs);
    
    return levels;
  }, [legs, strikesKey, strikeRange.min, strikeRange.max]);

  return (
    <div className="w-full select-none relative">
      <div className="absolute top-0 right-0 flex items-center gap-3 text-[9px] text-muted-foreground z-10">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#B5312B' }} />
          <span>Puts</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#35B534' }} />
          <span>Calls</span>
        </div>
      </div>

      <div 
        ref={ladderRef}
        className="relative h-28 cursor-grab active:cursor-grabbing mt-4"
        onPointerDown={handleLadderPointerDown}
      >
        {currentPricePercent >= 0 && currentPricePercent <= 100 && (
          <div 
            className="absolute w-px bg-primary"
            style={{ left: `${currentPricePercent}%`, top: '25%', bottom: '25%' }}
          />
        )}

        {allStrikes.map(strike => {
          const percent = getStrikePosition(strike);
          if (percent < 0 || percent > 100) return null;
          
          const isLabeled = shouldShowLabel(strike);
          
          return (
            <div 
              key={strike}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `${percent}%` }}
            >
              <div 
                className="absolute -translate-x-1/2 w-px bg-foreground"
                style={{ top: '-18px', height: isLabeled ? '6px' : '4px' }}
              />
              <div 
                className="absolute -translate-x-1/2 w-px bg-foreground"
                style={{ bottom: '-18px', height: isLabeled ? '6px' : '4px' }}
              />
              {isLabeled && (
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-[13px] font-normal text-foreground whitespace-nowrap">
                  {strike % 1 === 0 ? strike.toFixed(0) : strike.toFixed(1)}
                </div>
              )}
            </div>
          );
        })}

        {legs.filter(leg => leg.type !== "stock").map(leg => {
          const position = leg.position as 'long' | 'short';
          const stackLevel = badgeStackLevels[leg.id] || 0;
          return (
            <div key={leg.id}>
              {renderOpenBadge(leg, position, stackLevel)}
              {leg.closingTransaction?.entries?.map((entry, i) => 
                renderClosedEntryBadge(leg, entry, position, stackLevel + i)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
