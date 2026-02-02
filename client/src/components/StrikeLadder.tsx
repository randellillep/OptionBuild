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
  onAddLeg: (leg: Omit<OptionLeg, "id">, preserveOrderFromId?: string) => void;
  optionsChainData?: any;
  availableStrikes?: {
    min: number;
    max: number;
    strikes: number[];
  } | null;
  allAvailableExpirations?: string[];
  onChangeGlobalExpiration?: (days: number, date: string) => void;
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
  allAvailableExpirations = [],
  onChangeGlobalExpiration,
}: StrikeLadderProps) {
  const [selectedLeg, setSelectedLeg] = useState<OptionLeg | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isClosedBadgeClick, setIsClosedBadgeClick] = useState(false);
  const [draggedLeg, setDraggedLeg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedStrikePosition, setDraggedStrikePosition] = useState<number | null>(null);
  const [rawDragPosition, setRawDragPosition] = useState<number | null>(null); // Unsnapped position for smooth overlap detection
  const [lastMovedLeg, setLastMovedLeg] = useState<string | null>(null); // Track which leg was last moved for stacking priority
  const draggedLegRef = useRef<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState(0);
  const [panStartX, setPanStartX] = useState(0);
  const [panStartOffset, setPanStartOffset] = useState(0);
  const ladderRef = useRef<HTMLDivElement>(null);
  const prevSymbolRef = useRef<string>(symbol);

  // Calculate pan offset needed to center on current price
  const calculateCenterPanOffset = (minStrike: number, maxStrike: number, price: number) => {
    const fullRangeCalc = maxStrike - minStrike;
    if (fullRangeCalc <= 0) return 0;
    const zoomFactorCalc = 0.5;
    const baseRangeCalc = fullRangeCalc * zoomFactorCalc;
    // Default center (when panOffset = 0) is the middle of the strike range
    const defaultCenter = (minStrike + maxStrike) / 2;
    // We want the center to be at currentPrice
    // panAdjustment = (panOffset / 100) * baseRange
    // newCenter = defaultCenter + panAdjustment = currentPrice
    // panOffset = (currentPrice - defaultCenter) / baseRange * 100
    const offset = ((price - defaultCenter) / baseRangeCalc) * 100;
    return offset;
  };

  // Track when we need to recenter (symbol change or first data load)
  const prevDataKeyRef = useRef<string>("");
  
  // Recenter on current price when symbol changes OR when strike data loads
  useEffect(() => {
    // Create a key that changes when symbol or strike range significantly changes
    const dataKey = `${symbol}-${strikeRange.min.toFixed(0)}-${strikeRange.max.toFixed(0)}`;
    
    if (dataKey !== prevDataKeyRef.current) {
      const centerOffset = calculateCenterPanOffset(strikeRange.min, strikeRange.max, currentPrice);
      setPanOffset(centerOffset);
      setLastMovedLeg(null);
      prevDataKeyRef.current = dataKey;
      prevSymbolRef.current = symbol;
    }
  }, [symbol, strikeRange.min, strikeRange.max, currentPrice]);

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
  
  // Determine which strikes should show labels (every Nth strike from available strikes)
  const labeledStrikes = useMemo(() => {
    if (!availableStrikes || availableStrikes.strikes.length === 0) {
      // Fallback: use modulo-based labeling
      return null;
    }
    
    // Determine how many strikes to skip between labels based on total visible
    const visibleStrikes = availableStrikes.strikes.filter(s => s >= adjustedMin && s <= adjustedMax);
    const targetLabels = Math.min(12, Math.max(5, Math.floor(visibleStrikes.length / 3)));
    const skipInterval = Math.max(1, Math.floor(visibleStrikes.length / targetLabels));
    
    // Select strikes to label at regular intervals
    const labeled = new Set<number>();
    for (let i = 0; i < visibleStrikes.length; i += skipInterval) {
      labeled.add(visibleStrikes[i]);
    }
    return labeled;
  }, [availableStrikes, adjustedMin, adjustedMax]);

  const shouldShowLabel = (strike: number) => {
    if (labeledStrikes) {
      return labeledStrikes.has(strike);
    }
    // Fallback for generated strikes
    return strike % labelInterval === 0;
  };

  const getStrikePosition = (strike: number) => {
    return ((strike - adjustedMin) / range) * 100;
  };

  const getStrikeFromPosition = (clientX: number): { snapped: number; raw: number } | null => {
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
      return { snapped: nearest, raw: clampedStrike };
    }
    
    const clampedRaw = Math.max(strikeRange.min, Math.min(strikeRange.max, rawStrike));
    const snapped = Math.round(clampedRaw / strikeIncrement) * strikeIncrement;
    const snappedValue = Math.max(strikeRange.min, Math.min(strikeRange.max, Number(snapped.toFixed(2))));
    return { snapped: snappedValue, raw: clampedRaw };
  };

  const pendingDragRef = useRef<{ legId: string; startX: number; pointerId: number; target: HTMLElement } | null>(null);
  const dragThreshold = 5; // pixels before drag starts

  const handleBadgePointerDown = (leg: OptionLeg, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Don't start drag immediately - wait for movement
    pendingDragRef.current = {
      legId: leg.id,
      startX: e.clientX,
      pointerId: e.pointerId,
      target: e.target as HTMLElement,
    };
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {
      console.warn('Failed to capture pointer:', err);
    }
  };

  const handleBadgeClick = (leg: OptionLeg, e: React.MouseEvent, isClosedBadge: boolean = false, entryId?: string) => {
    // Only open popover if we didn't drag
    if (!isDragging && !draggedLegRef.current) {
      setSelectedLeg(leg);
      setIsClosedBadgeClick(isClosedBadge);
      setSelectedEntryId(entryId || null);
      setPopoverOpen(true);
    }
  };

  // Helper to get current stacking level for a leg
  const getCurrentStackLevel = (legId: string): number => {
    const leg = legs.find(l => l.id === legId);
    if (!leg || leg.type === "stock") return 0;
    
    const samePositionLegs = legs
      .filter(l => l.type !== "stock" && l.position === leg.position && l.id !== legId)
      .sort((a, b) => a.strike - b.strike);
    
    const badgeWidthInStrikes = 12;
    for (const otherLeg of samePositionLegs) {
      if (Math.abs(leg.strike - otherLeg.strike) < badgeWidthInStrikes) {
        return 1; // If overlapping with any same-position leg, we're elevated
      }
    }
    return 0;
  };

  // Handle pending drag detection - only start drag after movement threshold
  useEffect(() => {
    const handlePendingMove = (e: PointerEvent) => {
      if (!pendingDragRef.current) return;
      
      const distance = Math.abs(e.clientX - pendingDragRef.current.startX);
      if (distance >= dragThreshold) {
        const legId = pendingDragRef.current.legId;
        
        // Start actual drag
        draggedLegRef.current = legId;
        setDraggedLeg(legId);
        setIsDragging(true);
        pendingDragRef.current = null;
      }
    };

    const handlePendingUp = () => {
      // Click without drag - just clear pending
      pendingDragRef.current = null;
    };

    document.addEventListener('pointermove', handlePendingMove);
    document.addEventListener('pointerup', handlePendingUp);

    return () => {
      document.removeEventListener('pointermove', handlePendingMove);
      document.removeEventListener('pointerup', handlePendingUp);
    };
  }, [dragThreshold, legs]);

  // Handle active dragging
  useEffect(() => {
    if (!isDragging || !draggedLeg) return;

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      const strikeResult = getStrikeFromPosition(e.clientX);
      if (strikeResult !== null) {
        const { snapped: newStrike, raw: rawPosition } = strikeResult;
        setDraggedStrikePosition(newStrike);
        setRawDragPosition(rawPosition); // Track raw position for smooth overlap detection
        
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
      // Remember which leg was just moved for stacking priority (only if there are other legs to overlap with)
      const optionLegs = legs.filter(l => l.type !== "stock");
      if (draggedLeg && optionLegs.length > 1) {
        setLastMovedLeg(draggedLeg);
      } else {
        // Clear lastMovedLeg for single badges to ensure consistent positioning
        setLastMovedLeg(null);
      }
      setIsDragging(false);
      draggedLegRef.current = null;
      setDraggedLeg(null);
      setDraggedStrikePosition(null);
      setRawDragPosition(null);
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
    // verticalOffset is now a cumulative pixel offset from the tick mark
    // Unified stacking: all badges at a strike use the same coordinate system
    // For LONG: badges stack ABOVE the upper tick (50% - 18px is the tick, badges go up from there)
    // For SHORT: badges stack BELOW the lower tick (50% + 18px is the tick, badges go down from there)
    
    // Badge bottom at tick means top at: 50% - 18px - badgeHeight = 50% - 46px
    // With offset, top at: 50% - 46px - verticalOffset
    const topPosition = position === 'long' 
      ? `calc(50% - ${46 + verticalOffset}px)`  // Stack up from tick
      : `calc(50% + ${18 + verticalOffset}px)`; // Stack down from tick

    const strikeText = `${leg.strike % 1 === 0 ? leg.strike.toFixed(0) : leg.strike.toFixed(2).replace(/\.?0+$/, '')}${isCall ? 'C' : 'P'}`;
    
    // Check if leg is expired (expirationDays < 0 means past expiration)
    // Also derive from expirationDate as fallback if expirationDays is undefined/stale
    const isExpired = (() => {
      if (leg.expirationDays !== undefined && leg.expirationDays < 0) {
        return true;
      }
      // Fallback: compare expirationDate to today
      if (leg.expirationDate) {
        const expDate = new Date(leg.expirationDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expDate.setHours(0, 0, 0, 0);
        return expDate < today;
      }
      return false;
    })();
    
    const isPopoverOpenForThis = popoverOpen && selectedLeg?.id === leg.id && !isClosedBadgeClick;
    // Level 0 (original) should render on top of level 1 (newer positions)
    // Open badges should always be on top of closed badges (z-index 5)
    // Base z-index: offset 0 gets z-index 30, higher offsets get lower z-index
    // Divide offset by 16 to get approximate level, cap at reasonable range
    const approximateLevel = Math.floor(verticalOffset / 16);
    const baseZIndex = Math.max(10, 30 - approximateLevel);
    const badgeZIndex = isBeingDragged ? 9999 : (isPopoverOpenForThis ? 100 : baseZIndex);

    return (
      <Popover 
        key={`open-${leg.id}`} 
        open={isPopoverOpenForThis && !isBeingDragged} 
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
              transform: `translateX(-50%) ${isBeingDragged ? 'scale(1.1)' : ''}`,
              top: topPosition,
              opacity: isExcluded ? 0.5 : (isOutOfView ? 0.7 : 1),
              zIndex: badgeZIndex,
              pointerEvents: (isDragging || draggedLegRef.current) && !isBeingDragged ? 'none' : 'auto',
            }}
          >
            <button
              onPointerDown={(e) => {
                if (canDrag && !isDragging && !draggedLegRef.current) {
                  handleBadgePointerDown(leg, e);
                }
              }}
              onClick={(e) => handleBadgeClick(leg, e, false)}
              data-testid={testId}
              className={`relative flex flex-col items-center ${canDrag && !isDragging ? 'cursor-grab' : 'cursor-pointer'}`}
              style={{ touchAction: 'none' }}
            >
              {(hasClosing ? remainingQty : quantity) > 1 && (
                <div 
                  className={`absolute text-[8px] font-semibold text-white bg-gray-500 px-1 py-0.5 rounded-sm z-[100] ${position === 'long' ? '-top-2.5 -right-2.5' : '-bottom-2.5 -right-2.5'}`}
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
                className={`text-[14px] h-6 min-h-6 max-h-6 px-2 text-white font-bold whitespace-nowrap rounded flex items-center gap-0.5 ${isExcluded ? 'line-through bg-slate-500' : ''}`}
                style={{ 
                  backgroundColor: isExcluded ? undefined : openBgColor,
                  boxShadow: isBeingDragged ? '0 4px 12px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.2)',
                }}
              >
                {strikeText}
                {isExpired && <Check className="w-3.5 h-3.5" />}
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
            availableExpirations={allAvailableExpirations}
            onChangeGlobalExpiration={onChangeGlobalExpiration}
            isClosedView={false}
            onUpdateLeg={(updates) => onUpdateLeg(leg.id, updates)}
            onUpdateQuantity={(quantity) => onUpdateLeg(leg.id, { quantity })}
            onReopenAsNewLeg={onAddLeg}
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

  const renderClosedEntryBadge = (leg: OptionLeg, entry: ClosingEntry, position: 'long' | 'short', closedIndex: number = 0) => {
    const isCall = leg.type === "call";
    const isExcluded = entry.isExcluded;
    
    const entryStrike = entry.strike;
    const rawPositionPercent = getStrikePosition(entryStrike);
    const positionPercent = Math.max(3, Math.min(97, rawPositionPercent));
    const isOutOfView = rawPositionPercent < 0 || rawPositionPercent > 100;
    
    const closedBgColor = isCall ? '#1a5a15' : '#6a211c';
    
    const badgeHeight = 24; // h-6 = 24px
    const arrowHeight = 4;
    const closedStackGap = 2;
    
    // Closed badges should have bottom edge at the UPPER tick mark (50% - 18px)
    // For a badge with height 24px, bottom at tick means top at 50% - 18px - 24px = 50% - 42px
    const closedEntryOffset = closedIndex * (badgeHeight + closedStackGap);
    
    // For LONG: first closed badge bottom at upper tick (top at 50% - 42px), stacking UP (away from center)
    // For SHORT: first closed badge top at lower tick (50% + 18px), stacking DOWN (away from center)
    const topPosition = position === 'long'
      ? `calc(50% - 42px - ${closedEntryOffset}px)` // Bottom at upper tick, stack up
      : `calc(50% + 18px + ${closedEntryOffset}px)`; // Top at lower tick, stack down

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
              transition: 'top 0.15s ease-out',
              zIndex: 5, // Closed badges always below open badges
            }}
          >
            <button
              onClick={(e) => handleBadgeClick(leg, e, true, entry.id)}
              className="relative flex flex-col items-center cursor-pointer"
              data-testid={`badge-closed-${entry.id}`}
              style={{ pointerEvents: (isDragging || draggedLegRef.current) ? 'none' : 'auto' }}
            >
              {entry.quantity > 1 && (
                <div 
                  className={`absolute text-[8px] font-semibold text-white bg-gray-500 px-1 py-0.5 rounded-sm z-[100] ${position === 'long' ? '-top-2.5 -right-2.5' : '-bottom-2.5 -right-2.5'}`}
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
                className={`text-[14px] h-6 min-h-6 max-h-6 px-2 text-white font-bold whitespace-nowrap rounded flex items-center gap-1 ${isExcluded ? 'line-through bg-slate-500' : ''}`}
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
            availableExpirations={allAvailableExpirations}
            onChangeGlobalExpiration={onChangeGlobalExpiration}
            isClosedView={true}
            selectedEntryId={entry.id}
            onUpdateLeg={(updates) => onUpdateLeg(leg.id, updates)}
            onUpdateQuantity={(quantity) => onUpdateLeg(leg.id, { quantity })}
            onReopenAsNewLeg={onAddLeg}
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

  // Unified version of closed entry badge that uses cumulative stackOffset
  const renderClosedEntryBadgeUnified = (leg: OptionLeg, entry: ClosingEntry, position: 'long' | 'short', verticalOffset: number = 0) => {
    const isCall = leg.type === "call";
    const isExcluded = entry.isExcluded;
    
    const entryStrike = entry.strike;
    const rawPositionPercent = getStrikePosition(entryStrike);
    const positionPercent = Math.max(3, Math.min(97, rawPositionPercent));
    const isOutOfView = rawPositionPercent < 0 || rawPositionPercent > 100;
    
    const closedBgColor = isCall ? '#1a5a15' : '#6a211c';
    
    const badgeHeight = 24; // h-6 = 24px
    
    // Unified stacking: same coordinate system as open badges
    // For LONG: badge bottom at tick means top at 50% - 18px - 24px = 50% - 42px, then stack up with offset
    // For SHORT: badge top at tick means top at 50% + 18px, then stack down with offset
    const topPosition = position === 'long'
      ? `calc(50% - ${42 + verticalOffset}px)` // Stack up from tick
      : `calc(50% + ${18 + verticalOffset}px)`; // Stack down from tick

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
              zIndex: 5, // Closed badges always below open badges
            }}
          >
            <button
              onClick={(e) => handleBadgeClick(leg, e, true, entry.id)}
              className="relative flex flex-col items-center cursor-pointer"
              data-testid={`badge-closed-${entry.id}`}
              style={{ pointerEvents: (isDragging || draggedLegRef.current) ? 'none' : 'auto' }}
            >
              {entry.quantity > 1 && (
                <div 
                  className={`absolute text-[8px] font-semibold text-white bg-gray-500 px-1 py-0.5 rounded-sm z-[100] ${position === 'long' ? '-top-2.5 -right-2.5' : '-bottom-2.5 -right-2.5'}`}
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
                className={`text-[14px] h-6 min-h-6 max-h-6 px-2 text-white font-bold whitespace-nowrap rounded flex items-center gap-1 ${isExcluded ? 'line-through bg-slate-500' : ''}`}
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
            availableExpirations={allAvailableExpirations}
            onChangeGlobalExpiration={onChangeGlobalExpiration}
            isClosedView={true}
            selectedEntryId={entry.id}
            onUpdateLeg={(updates) => onUpdateLeg(leg.id, updates)}
            onUpdateQuantity={(quantity) => onUpdateLeg(leg.id, { quantity })}
            onReopenAsNewLeg={onAddLeg}
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
  
  // Calculate the visual height of a leg's badges (open + all closed entries)
  const getLegBadgeHeight = (leg: OptionLeg): number => {
    const openBadgeHeight = 28;
    const closedBadgeHeight = 24;
    const closedStackGap = 2;
    const gapBetweenOpenAndClosed = 2;
    
    const hasOpenBadge = leg.quantity > 0;
    const numClosedEntries = leg.closingTransaction?.entries?.length || 0;
    const hasClosedBadges = leg.closingTransaction?.isEnabled && numClosedEntries > 0;
    
    let totalHeight = 0;
    if (hasOpenBadge) {
      totalHeight += openBadgeHeight;
    }
    if (hasClosedBadges) {
      if (hasOpenBadge) totalHeight += gapBetweenOpenAndClosed;
      totalHeight += numClosedEntries * closedBadgeHeight + (numClosedEntries - 1) * closedStackGap;
    }
    
    return totalHeight || openBadgeHeight; // Default to open badge height
  };
  
  // Returns pixel offsets for each leg (not just level numbers)
  const badgeStackOffsets = useMemo(() => {
    const optionLegs = legs.filter(leg => leg.type !== "stock");
    // Create a map of leg ID to original array index to preserve creation order
    const legIndexMap = new Map(legs.map((leg, idx) => [leg.id, idx]));
    // Sort by strike, then by array index DESCENDING so newer legs (reopened) stay at base position (where sold was)
    // and original legs stay at higher positions (further from center line)
    const longLegs = optionLegs.filter(leg => leg.position === 'long').sort((a, b) => 
      a.strike - b.strike || (legIndexMap.get(b.id) ?? 0) - (legIndexMap.get(a.id) ?? 0)
    );
    const shortLegs = optionLegs.filter(leg => leg.position === 'short').sort((a, b) => 
      a.strike - b.strike || (legIndexMap.get(b.id) ?? 0) - (legIndexMap.get(a.id) ?? 0)
    );
    
    const offsets: { [legId: string]: number } = {};
    
    // For single badges, always assign offset 0 for consistent positioning
    if (optionLegs.length === 1) {
      offsets[optionLegs[0].id] = 0;
      return offsets;
    }
    
    // Badge width is ~55px, ladder is typically ~900px wide
    const badgeWidthInStrikes = Math.max(3, Math.round(range * 0.06));
    
    const draggedLegData = draggedLeg ? legs.find(l => l.id === draggedLeg) : null;
    const draggedLegPosition = draggedLegData?.position;
    const effectiveDragStrike = rawDragPosition ?? draggedStrikePosition ?? draggedLegData?.strike;
    
    const priorityLegId = draggedLeg || lastMovedLeg;
    const priorityLegData = priorityLegId ? legs.find(l => l.id === priorityLegId) : null;
    const priorityLegPosition = priorityLegData?.position;
    const priorityLegStrike = draggedLeg ? effectiveDragStrike : priorityLegData?.strike;
    
    const assignOffsets = (sortedLegs: OptionLeg[], positionType: 'long' | 'short') => {
      if (sortedLegs.length <= 1) {
        if (sortedLegs.length === 1) {
          offsets[sortedLegs[0].id] = 0;
        }
        return;
      }
      
      // Track occupied positions: strike -> list of {offset, height, legId}
      const occupiedStrikes: { center: number; offset: number; height: number; legId: string }[] = [];
      const stackGap = 4; // Gap between stacked leg groups
      
      // First pass: assign offsets to non-priority badges
      sortedLegs.forEach(leg => {
        if (leg.id === priorityLegId) return;
        
        const legHeight = getLegBadgeHeight(leg);
        
        // Find overlapping legs and calculate cumulative offset
        const overlapping = occupiedStrikes.filter(occ => 
          Math.abs(leg.strike - occ.center) < badgeWidthInStrikes
        );
        
        let offset = 0;
        if (overlapping.length > 0) {
          // Stack above the highest existing badge
          offset = Math.max(...overlapping.map(o => o.offset + o.height)) + stackGap;
        }
        
        offsets[leg.id] = offset;
        occupiedStrikes.push({ center: leg.strike, offset, height: legHeight, legId: leg.id });
      });
      
      // Second pass: priority badge always at base (offset 0)
      if (priorityLegId && priorityLegPosition === positionType && priorityLegStrike !== undefined) {
        offsets[priorityLegId] = 0;
      }
    };
    
    assignOffsets(longLegs, 'long');
    assignOffsets(shortLegs, 'short');
    
    return offsets;
  }, [legs, strikesKey, draggedLeg, draggedStrikePosition, rawDragPosition, lastMovedLeg, range]);
  
  // Keep badgeStackLevels for backward compatibility (convert offsets to approximate levels)
  const badgeStackLevels = useMemo(() => {
    const levels: { [legId: string]: number } = {};
    for (const [legId, offset] of Object.entries(badgeStackOffsets)) {
      levels[legId] = offset; // Now passing pixel offset directly
    }
    return levels;
  }, [badgeStackOffsets]);

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

        {(() => {
          const optionLegs = legs.filter(leg => leg.type !== "stock");
          
          // Build unified badge list for each position type
          // Each badge gets a sequential stackIndex for its strike group
          type BadgeItem = {
            type: 'open' | 'closed';
            leg: OptionLeg;
            entry?: ClosingEntry;
            strike: number;
            position: 'long' | 'short';
            visualOrder: number; // Stable visual position - NEVER changes
          };
          
          const allBadges: BadgeItem[] = [];
          
          optionLegs.forEach((leg) => {
            const position = leg.position as 'long' | 'short';
            // Use leg's stable visualOrder (falls back to 0 for legacy legs)
            const legVisualOrder = leg.visualOrder ?? 0;
            
            // Add closed entry badges - ALWAYS show these, even if leg.quantity is 0
            const entries = leg.closingTransaction?.entries || [];
            entries.forEach((entry) => {
              // Use entry's visualOrder if it exists, otherwise leg's
              const entryVisualOrder = entry.visualOrder ?? legVisualOrder;
              allBadges.push({
                type: 'closed',
                leg,
                entry,
                strike: entry.strike,
                position,
                visualOrder: entryVisualOrder, // Use entry's unique visualOrder
              });
            });
            
            // Skip legs with quantity 0 for OPEN badges only
            // (closed entries were already added above)
            if (leg.quantity <= 0) return;
            
            // Add open badge if leg has remaining quantity
            const closingQty = leg.closingTransaction?.isEnabled 
              ? entries.reduce((sum, e) => sum + e.quantity, 0)
              : 0;
            const remainingQty = leg.quantity - closingQty;
            if (remainingQty > 0) {
              allBadges.push({
                type: 'open',
                leg,
                strike: leg.strike,
                position,
                visualOrder: legVisualOrder, // Same as closed badges for stable positioning
              });
            }
          });
          
          // Group badges by strike and position
          const badgeGroups = new Map<string, BadgeItem[]>();
          allBadges.forEach(badge => {
            const key = `${badge.strike}-${badge.position}`;
            if (!badgeGroups.has(key)) {
              badgeGroups.set(key, []);
            }
            badgeGroups.get(key)!.push(badge);
          });
          
          // Sort each group: original open badges first (top), then closed/reopened (bottom)
          // Within each tier, sort by visualOrder for stable positioning
          badgeGroups.forEach(group => {
            group.sort((a, b) => {
              // Determine tier: 0 = original open badges (top), 1 = closed and reopened (bottom)
              const getTier = (badge: BadgeItem): number => {
                if (badge.type === 'closed') return 1; // Closed always at bottom
                if (badge.type === 'open' && badge.leg.isFromReopened) return 1; // Reopened stays at bottom
                return 0; // Original open badges at top
              };
              
              const tierA = getTier(a);
              const tierB = getTier(b);
              
              // First sort by tier (top vs bottom)
              if (tierA !== tierB) return tierA - tierB;
              
              // Within same tier, sort by visualOrder for stable positioning
              return a.visualOrder - b.visualOrder;
            });
          });
          
          // Render all badges with unified stacking
          const renderedBadges: React.ReactNode[] = [];
          
          badgeGroups.forEach((group, key) => {
            let stackOffset = 0;
            const badgeHeight = 28; // Open badge height
            const closedBadgeHeight = 24;
            const stackGap = 2;
            
            group.forEach((badge, index) => {
              const height = badge.type === 'open' ? badgeHeight : closedBadgeHeight;
              
              if (badge.type === 'open') {
                renderedBadges.push(renderOpenBadge(badge.leg, badge.position, stackOffset));
              } else if (badge.entry) {
                renderedBadges.push(renderClosedEntryBadgeUnified(badge.leg, badge.entry, badge.position, stackOffset));
              }
              
              // Add height + gap for next badge
              stackOffset += height + stackGap;
            });
          });
          
          return renderedBadges;
        })()}
      </div>
    </div>
  );
}
