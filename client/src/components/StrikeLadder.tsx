import { useState, useRef, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { OptionDetailsPanel } from "@/components/OptionDetailsPanel";
import type { OptionLeg } from "@shared/schema";
import { calculateOptionPrice } from "@/lib/options-pricing";
import { Check, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface StrikeLadderProps {
  legs: OptionLeg[];
  currentPrice: number;
  strikeRange: { min: number; max: number };
  symbol: string;
  expirationDate: string | null;
  volatility?: number;
  onUpdateLeg: (legId: string, updates: Partial<OptionLeg>) => void;
  onRemoveLeg: (legId: string) => void;
  optionsChainData?: any;
  availableStrikes?: {
    min: number;
    max: number;
    strikes: number[];
  } | null;
}

// Interface for tracking sold portions
interface SoldPortion {
  legId: string;
  quantity: number;
  price: number;
  soldAt: Date;
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
  
  // Two-click sell functionality state
  const [sellMode, setSellMode] = useState<string | null>(null); // legId in sell mode
  const [sellQuantity, setSellQuantity] = useState(1);
  const [sellPrice, setSellPrice] = useState("");
  
  // Store original strikes when legs are added (for panning stability)
  const [originalStrikes] = useState<Map<string, number>>(new Map());

  // Detect the actual strike increment from market data
  const strikeIncrement = useMemo(() => {
    if (availableStrikes && availableStrikes.strikes.length > 1) {
      // Find the most common interval between consecutive strikes
      const intervals: number[] = [];
      for (let i = 1; i < availableStrikes.strikes.length; i++) {
        const diff = Number((availableStrikes.strikes[i] - availableStrikes.strikes[i - 1]).toFixed(2));
        if (diff > 0) intervals.push(diff);
      }
      if (intervals.length > 0) {
        // Find most frequent interval
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
    // Default increments based on price level
    if (currentPrice < 25) return 0.5;
    if (currentPrice < 100) return 1;
    if (currentPrice < 200) return 2.5;
    if (currentPrice < 500) return 5;
    return 10;
  }, [availableStrikes, currentPrice]);

  const baseRange = strikeRange.max - strikeRange.min;
  
  // Apply pan offset to adjust visible range (pan offset is in percentage)
  const panAdjustment = (panOffset / 100) * baseRange;
  const adjustedMin = strikeRange.min + panAdjustment;
  const adjustedMax = strikeRange.max + panAdjustment;
  const range = adjustedMax - adjustedMin;
  
  // Determine how many strikes to show as labels - fewer labels to prevent overlap
  const getLabelInterval = () => {
    const strikesInView = range / strikeIncrement;
    // Show fewer labels to prevent overlapping - aim for 8-12 visible labels
    if (strikesInView <= 10) return 1;
    if (strikesInView <= 20) return 2;
    if (strikesInView <= 40) return 4;
    if (strikesInView <= 80) return 8;
    return Math.ceil(strikesInView / 10);
  };

  const labelInterval = getLabelInterval();
  
  // Generate strike labels based on actual increments
  const generateLabeledStrikes = () => {
    if (availableStrikes && availableStrikes.strikes.length > 0) {
      // Filter strikes in visible range
      const strikesInRange = availableStrikes.strikes.filter(
        s => s >= adjustedMin && s <= adjustedMax
      );
      // Thin out for readability
      if (labelInterval > 1) {
        return strikesInRange.filter((_, i) => i % labelInterval === 0);
      }
      return strikesInRange;
    }
    
    // Fallback: generate based on increment
    const strikes: number[] = [];
    const displayIncrement = strikeIncrement * labelInterval;
    const start = Math.ceil(adjustedMin / displayIncrement) * displayIncrement;
    for (let strike = start; strike <= adjustedMax; strike += displayIncrement) {
      strikes.push(Number(strike.toFixed(2)));
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

  // Calculate strike from x position - ALWAYS snap to available strikes only
  const getStrikeFromPosition = (clientX: number) => {
    if (!ladderRef.current) return null;
    
    const rect = ladderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = (x / rect.width) * 100;
    const rawStrike = adjustedMin + (percent / 100) * range;
    
    // If we have market data, MUST snap to nearest available strike
    if (availableStrikes && availableStrikes.strikes.length > 0) {
      // First clamp to market bounds
      const clampedStrike = Math.max(
        availableStrikes.min, 
        Math.min(availableStrikes.max, rawStrike)
      );
      
      // Find nearest available strike from the full list
      const nearest = availableStrikes.strikes.reduce((prev, curr) => 
        Math.abs(curr - clampedStrike) < Math.abs(prev - clampedStrike) ? curr : prev
      );
      return nearest;
    }
    
    // Fallback: snap to increment-based strikes within strikeRange bounds
    const clampedRaw = Math.max(strikeRange.min, Math.min(strikeRange.max, rawStrike));
    const snapped = Math.round(clampedRaw / strikeIncrement) * strikeIncrement;
    return Math.max(strikeRange.min, Math.min(strikeRange.max, Number(snapped.toFixed(2))));
  };

  const handleBadgePointerDown = (leg: OptionLeg, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedLeg(leg.id);
    setIsDragging(true);
    // Capture pointer for smooth dragging
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {
      // Pointer capture may fail in some cases, continue without it
      console.warn('Failed to capture pointer:', err);
    }
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
        // Find the dragged leg to get its type
        const leg = legs.find(l => l.id === draggedLeg);
        if (!leg) return;

        // Only update if strike actually changed
        if (leg.strike === newStrike) return;

        // Look up market price and IV for the new strike
        let marketPrice: number | undefined;
        let marketIV: number | undefined;
        if (optionsChainData?.quotes) {
          const matchingQuote = optionsChainData.quotes.find(
            (q: any) => q.strike === newStrike && q.side.toLowerCase() === leg.type
          );
          if (matchingQuote) {
            // Use mid if available, otherwise calculate from bid/ask
            if (matchingQuote.mid !== undefined && matchingQuote.mid > 0) {
              marketPrice = matchingQuote.mid;
            } else if (matchingQuote.bid !== undefined && matchingQuote.ask !== undefined) {
              marketPrice = (matchingQuote.bid + matchingQuote.ask) / 2;
            }
            // Get IV from the quote if available
            if (matchingQuote.iv !== undefined && matchingQuote.iv > 0) {
              marketIV = matchingQuote.iv;
            }
          }
        }

        // Always update strike and reset premium (market or theoretical)
        if (marketPrice !== undefined && marketPrice > 0) {
          // Market data available - reset to market price and IV
          onUpdateLeg(draggedLeg, { 
            strike: newStrike, 
            premium: marketPrice,
            premiumSource: "market",
            impliedVolatility: marketIV
          });
        } else {
          // No market data - calculate theoretical premium using Black-Scholes
          const theoreticalPremium = calculateOptionPrice(
            leg.type,
            currentPrice,
            newStrike,
            leg.expirationDays,
            volatility
          );
          
          onUpdateLeg(draggedLeg, { 
            strike: newStrike,
            premium: theoreticalPremium,
            premiumSource: "theoretical",
            impliedVolatility: undefined
          });
        }
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
  }, [isDragging, draggedLeg, legs, optionsChainData, onUpdateLeg]);

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

  // Handle two-click sell: first click enters sell mode, second click confirms
  const handleSellModeClick = (e: React.MouseEvent, leg: OptionLeg) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (sellMode === leg.id) {
      // Second click - confirm the sell
      const price = parseFloat(sellPrice);
      if (!isNaN(price) && price > 0 && sellQuantity > 0) {
        // Create/update closing transaction
        const currentClosing = leg.closingTransaction;
        const newClosingQty = (currentClosing?.isEnabled ? currentClosing.quantity : 0) + sellQuantity;
        
        onUpdateLeg(leg.id, {
          closingTransaction: {
            quantity: Math.min(newClosingQty, leg.quantity),
            closingPrice: price,
            isEnabled: true,
          }
        });
      }
      // Exit sell mode
      setSellMode(null);
      setSellQuantity(1);
      setSellPrice("");
    } else {
      // First click - enter sell mode
      setSellMode(leg.id);
      setSellQuantity(1);
      // Default to market price
      const marketData = getMarketDataForLeg(leg);
      const defaultPrice = marketData?.ask || leg.premium;
      setSellPrice(defaultPrice.toFixed(2));
    }
  };
  
  // Cancel sell mode when clicking elsewhere
  const handleCancelSellMode = () => {
    if (sellMode) {
      setSellMode(null);
      setSellQuantity(1);
      setSellPrice("");
    }
  };

  // Render a draggable badge with quantity indicator
  // When there's a closing transaction, render stacked badges (closed below, open above)
  const renderBadge = (leg: OptionLeg, position: 'long' | 'short', verticalOffset: number = 0) => {
    const isCall = leg.type === "call";
    const isExcluded = leg.isExcluded;
    const hasClosing = leg.closingTransaction?.isEnabled;
    const closingQty = hasClosing ? (leg.closingTransaction?.quantity || 0) : 0;
    const quantity = leg.quantity || 1;
    const remainingQty = quantity - closingQty;
    
    const testId = `badge-${leg.type}${position === 'short' ? '-short' : ''}-${leg.strike.toFixed(0)}`;
    const rawPositionPercent = getStrikePosition(leg.strike);
    
    // BUGFIX: Clamp badge position to stay within the visible ladder (3-97%)
    // This prevents badges from being "thrown out" when panning
    const positionPercent = Math.max(3, Math.min(97, rawPositionPercent));
    const isOutOfView = rawPositionPercent < 0 || rawPositionPercent > 100;
    
    const isBeingDragged = draggedLeg === leg.id;
    const isInSellMode = sellMode === leg.id;
    
    // Determine if this leg can be dragged (not sold portions)
    const canDrag = !hasClosing || remainingQty > 0;
    
    // Badge styling
    const openBgClass = isCall ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600";
    const closedBgClass = "bg-cyan-600 hover:bg-cyan-700"; // Blue/teal for closed positions
    const excludedBgClass = "bg-gray-400 hover:bg-gray-500";
    const sellModeBgClass = "bg-orange-500 ring-2 ring-orange-300"; // Highlight in sell mode
    
    // Calculate vertical position accounting for stacking
    const badgeHeight = 24; // h-6 = 24px
    const stackOffset = verticalOffset * (badgeHeight + 2);
    
    // Calculate extra offset for stacked closed badge
    const closedBadgeOffset = hasClosing && closingQty > 0 ? (badgeHeight + 2) : 0;
    
    const topPosition = position === 'long' 
      ? `calc(50% - ${badgeHeight}px - ${stackOffset}px)`
      : `calc(50% + ${stackOffset}px)`;
    
    const closedBadgeTopPosition = position === 'long'
      ? `calc(50% - ${stackOffset}px)` // Below open badge (closer to center)
      : `calc(50% + ${stackOffset + badgeHeight + 2}px)`; // Below open badge

    // Strike display text
    const strikeText = `${leg.strike % 1 === 0 ? leg.strike.toFixed(0) : leg.strike.toFixed(2).replace(/\.?0+$/, '')}${isCall ? 'C' : 'P'}`;

    return (
      <Popover 
        key={leg.id} 
        open={popoverOpen && selectedLeg?.id === leg.id && !isBeingDragged && !isInSellMode} 
        onOpenChange={(open) => {
          if (!open && selectedLeg?.id === leg.id) {
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
            {/* Two-click sell popup UI */}
            {isInSellMode && (
              <div 
                className="absolute -top-20 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-orange-400 p-2 z-[100] min-w-[140px]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-[9px] font-semibold text-orange-600 dark:text-orange-400 mb-1">
                  Quick Sell {leg.position === 'long' ? '(Sell to Close)' : '(Buy to Close)'}
                </div>
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[9px] text-muted-foreground">Qty:</span>
                  <button
                    className="h-5 w-5 text-xs bg-slate-200 dark:bg-slate-600 rounded hover:bg-slate-300"
                    onClick={(e) => { e.stopPropagation(); setSellQuantity(Math.max(1, sellQuantity - 1)); }}
                  >-</button>
                  <span className="text-xs font-mono min-w-[16px] text-center">{sellQuantity}</span>
                  <button
                    className="h-5 w-5 text-xs bg-slate-200 dark:bg-slate-600 rounded hover:bg-slate-300"
                    onClick={(e) => { e.stopPropagation(); setSellQuantity(Math.min(remainingQty, sellQuantity + 1)); }}
                  >+</button>
                </div>
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-[9px] text-muted-foreground">$</span>
                  <input
                    type="text"
                    value={sellPrice}
                    onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && setSellPrice(e.target.value)}
                    className="h-5 w-16 text-xs font-mono px-1 border rounded bg-background"
                    onClick={(e) => e.stopPropagation()}
                    data-testid="input-sell-price"
                  />
                </div>
                <div className="flex gap-1">
                  <button
                    className="flex-1 h-5 text-[9px] bg-orange-500 hover:bg-orange-600 text-white rounded font-semibold"
                    onClick={(e) => handleSellModeClick(e, leg)}
                    data-testid="button-confirm-sell"
                  >
                    Confirm
                  </button>
                  <button
                    className="h-5 px-2 text-[9px] bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 rounded"
                    onClick={(e) => { e.stopPropagation(); handleCancelSellMode(); }}
                    data-testid="button-cancel-sell"
                  >
                    X
                  </button>
                </div>
              </div>
            )}
            
            {/* Main open position badge */}
            <button
              onPointerDown={(e) => canDrag && handleBadgePointerDown(leg, e)}
              onClick={(e) => handleBadgeClick(leg, e)}
              data-testid={testId}
              className={`relative text-[10px] h-6 px-2 ${isInSellMode ? sellModeBgClass : (isExcluded ? excludedBgClass : openBgClass)} text-white font-bold whitespace-nowrap ${canDrag && isBeingDragged ? 'cursor-grabbing scale-110 z-50' : (canDrag ? 'cursor-grab' : 'cursor-pointer')} rounded transition-all border-0 ${isExcluded ? 'line-through' : ''}`}
              style={{ 
                boxShadow: isBeingDragged ? '0 4px 12px rgba(0,0,0,0.3)' : undefined,
                touchAction: 'none'
              }}
            >
              {strikeText}
              
              {/* Quantity badge - clickable for two-click sell (black with white text) */}
              <span 
                className={`absolute -top-1 -right-1 text-white text-[8px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5 border cursor-pointer transition-all ${isInSellMode ? 'bg-orange-600 border-orange-400 ring-1 ring-orange-300' : 'bg-black border-slate-700 hover:bg-slate-700'}`}
                data-testid={`quantity-${leg.id}`}
                onClick={(e) => {
                  if (remainingQty > 0) {
                    handleSellModeClick(e, leg);
                  }
                }}
                title="Click to sell"
              >
                {hasClosing ? remainingQty : (leg.position === 'short' ? `-${quantity}` : `+${quantity}`)}
              </span>
            </button>
            
            {/* Closed position badge - stacked below (NOT draggable) */}
            {hasClosing && closingQty > 0 && (
              <div 
                className="absolute left-0"
                style={{ top: `${badgeHeight + 2}px` }}
              >
                <button
                  onClick={(e) => handleBadgeClick(leg, e)}
                  className={`relative text-[10px] h-6 px-2 ${closedBgClass} text-white font-bold whitespace-nowrap cursor-pointer rounded transition-all border-0`}
                  data-testid={`badge-closed-${leg.id}`}
                >
                  {strikeText}
                  <Check className="inline-block h-3 w-3 ml-0.5" />
                  
                  {/* Closed quantity badge - black with white text */}
                  <span 
                    className="absolute -top-1 -right-1 bg-black text-white text-[8px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5 border border-slate-700"
                  >
                    {closingQty}
                  </span>
                </button>
              </div>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="p-0 w-auto z-[9999]" 
          align="center" 
          side="bottom" 
          sideOffset={10}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            // Don't close if clicking inside the popover content
            const target = e.target as HTMLElement;
            if (target.closest('[data-testid="option-details-panel"]')) {
              e.preventDefault();
            }
          }}
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

  // Format strike number for display
  const formatStrike = (strike: number) => {
    if (strike % 1 === 0) return strike.toFixed(0);
    if (strike % 0.5 === 0) return strike.toFixed(1);
    return strike.toFixed(2).replace(/\.?0+$/, '');
  };

  return (
    <Card className="p-2">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[10px] font-semibold text-muted-foreground">STRIKES:</h3>
        <div className="flex items-center gap-2 text-[9px]">
          <div className="flex items-center gap-0.5">
            <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
            <span className="text-muted-foreground">Price</span>
          </div>
          <div className="flex items-center gap-0.5">
            <div className="w-2 h-2 rounded-sm bg-green-500"></div>
            <span className="text-muted-foreground">Calls</span>
          </div>
          <div className="flex items-center gap-0.5">
            <div className="w-2 h-2 rounded-sm bg-red-500"></div>
            <span className="text-muted-foreground">Puts</span>
          </div>
        </div>
      </div>

      {/* Main ladder container with strike numbers below */}
      <div className="relative">
        <div 
          ref={ladderRef} 
          className={`relative h-12 bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-t-md overflow-visible border border-slate-300 dark:border-slate-600 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{ userSelect: 'none', touchAction: 'none' }}
          onPointerDown={handleLadderPointerDown}
          data-testid="strike-ladder-container"
        >
          {/* Tick marks on ladder - extend from bottom like reference image */}
          <div className="absolute inset-0 pointer-events-none">
            {labeledStrikes.map((strike) => {
              const position = getStrikePosition(strike);
              if (position < 0 || position > 100) return null;
              return (
                <div
                  key={strike}
                  className="absolute bottom-0 w-px h-3 bg-slate-400 dark:bg-slate-500"
                  style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
                />
              );
            })}
          </div>

          {/* Main horizontal line */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border/40 pointer-events-none" />

          {/* Current price indicator */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 pointer-events-none"
            style={{ left: `${currentPricePercent}%`, transform: 'translateX(-50%)' }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap font-mono">
              ${currentPrice.toFixed(2)}
            </div>
          </div>

          {/* Render all option leg badges - group by strike and stack vertically */}
          {(() => {
            // Group long legs by strike for vertical stacking
            const longLegs = legs.filter(l => l.position === "long");
            const longByStrike = new Map<number, OptionLeg[]>();
            longLegs.forEach(leg => {
              const key = Math.round(leg.strike * 100) / 100;
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

        {/* Strike numbers row below the ladder - centered like in reference */}
        <div className="relative h-5 bg-slate-100 dark:bg-slate-800 rounded-b-md overflow-hidden border-x border-b border-slate-300 dark:border-slate-600">
          {labeledStrikes.map((strike) => {
            const position = getStrikePosition(strike);
            if (position < 2 || position > 98) return null; // More margin at edges
            return (
              <span
                key={strike}
                className="absolute top-1 text-[10px] text-slate-700 dark:text-slate-200 font-mono font-medium"
                style={{ 
                  left: `${position}%`, 
                  transform: 'translateX(-50%)',
                  textAlign: 'center',
                }}
              >
                {formatStrike(strike)}
              </span>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
