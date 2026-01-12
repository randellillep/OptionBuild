import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, X, RefreshCw, CheckCircle } from "lucide-react";
import type { OptionLeg } from "@shared/schema";

interface EquityPanelProps {
  legs: OptionLeg[];
  currentPrice: number;
  symbol: string;
  onUpdateLeg: (legId: string, updates: Partial<OptionLeg>) => void;
  onRemoveLeg: (legId: string) => void;
  onAddStockLeg: () => void;
}

// Segment types for displaying stock positions
interface StockSegment {
  segmentId: string;
  type: 'closed' | 'open';
  legId: string;
  position: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  closingPrice?: number;
  realizedPL?: number;
  entryId?: string;
}

// Helper to derive display segments from a stock leg
function getStockSegments(leg: OptionLeg): StockSegment[] {
  const segments: StockSegment[] = [];
  const entryPrice = leg.premium;
  const position = leg.position as 'long' | 'short';
  
  // Get closed portions from closing transactions
  const closing = leg.closingTransaction;
  if (closing?.isEnabled && closing.entries && closing.entries.length > 0) {
    for (const entry of closing.entries) {
      const entryBasis = entry.openingPrice ?? entryPrice;
      const realizedPL = position === 'long'
        ? (entry.closingPrice - entryBasis) * entry.quantity
        : (entryBasis - entry.closingPrice) * entry.quantity;
      
      segments.push({
        segmentId: `closed-${leg.id}-${entry.id}`,
        type: 'closed',
        legId: leg.id,
        position,
        quantity: entry.quantity,
        entryPrice: entryBasis,
        closingPrice: entry.closingPrice,
        realizedPL,
        entryId: entry.id,
      });
    }
  }
  
  // Calculate remaining open shares
  const closedQty = closing?.entries?.reduce((sum, e) => sum + e.quantity, 0) || 0;
  const remainingQty = leg.quantity - closedQty;
  
  if (remainingQty > 0 && !leg.isExcluded) {
    segments.push({
      segmentId: `open-${leg.id}`,
      type: 'open',
      legId: leg.id,
      position,
      quantity: remainingQty,
      entryPrice,
    });
  }
  
  return segments;
}

export function EquityPanel({
  legs,
  currentPrice,
  symbol,
  onUpdateLeg,
  onRemoveLeg,
}: EquityPanelProps) {
  // Track which segment's popover is open by segmentId
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  
  // Edit state for open segments
  const [editQuantity, setEditQuantity] = useState("100");
  const [editEntryPrice, setEditEntryPrice] = useState("");
  const [showSellToClose, setShowSellToClose] = useState(false);
  const [closingPrice, setClosingPrice] = useState("");
  const [closingQuantity, setClosingQuantity] = useState("0");
  const [isExcluded, setIsExcluded] = useState(false);

  const stockLegs = legs.filter((leg) => leg.type === "stock");

  if (stockLegs.length === 0) {
    return null;
  }

  // Get remaining shares for a leg
  const getRemainingShares = (leg: OptionLeg) => {
    if (!leg.closingTransaction?.isEnabled) return leg.quantity;
    const closedQty = leg.closingTransaction.entries?.reduce((sum, e) => sum + e.quantity, 0) 
      || leg.closingTransaction.quantity || 0;
    return Math.max(0, leg.quantity - closedQty);
  };

  // Generate all segments from all stock legs
  const allSegments: Array<StockSegment & { leg: OptionLeg }> = [];
  for (const leg of stockLegs) {
    const segments = getStockSegments(leg);
    for (const segment of segments) {
      allSegments.push({ ...segment, leg });
    }
  }

  // Excluded legs that have no segments
  const excludedLegs = stockLegs.filter(leg => 
    leg.isExcluded && 
    (!leg.closingTransaction?.entries || leg.closingTransaction.entries.length === 0)
  );

  // Handlers for OPEN segment popover
  const handleOpenSegmentClick = (segment: StockSegment & { leg: OptionLeg }) => {
    setEditQuantity(segment.leg.quantity.toString());
    setEditEntryPrice(segment.leg.premium.toFixed(2));
    setIsExcluded(segment.leg.isExcluded || false);
    setShowSellToClose(false);
    setClosingPrice(currentPrice.toFixed(2));
    setClosingQuantity(getRemainingShares(segment.leg).toString());
    setOpenPopoverId(segment.segmentId);
  };

  const handleClosePopover = () => {
    setOpenPopoverId(null);
    setShowSellToClose(false);
  };

  const handleQuantityStep = (leg: OptionLeg, delta: number) => {
    const currentQty = parseInt(editQuantity) || 0;
    const newQty = Math.max(1, currentQty + delta);
    setEditQuantity(newQty.toString());
  };

  const handleQuantityInputChange = (value: string) => {
    if (value === "" || /^\d+$/.test(value)) {
      setEditQuantity(value);
    }
  };

  const handleEntryPriceChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setEditEntryPrice(value);
    }
  };

  const handleRefreshEntryPrice = () => {
    setEditEntryPrice(currentPrice.toFixed(2));
  };

  const hasQuantityChanged = (leg: OptionLeg) => {
    const qty = parseInt(editQuantity);
    return !isNaN(qty) && qty >= 1 && qty !== leg.quantity;
  };

  const hasEntryPriceChanged = (leg: OptionLeg) => {
    const price = parseFloat(editEntryPrice);
    return !isNaN(price) && price > 0 && Math.abs(price - leg.premium) > 0.001;
  };

  const handleSaveChanges = (leg: OptionLeg) => {
    const updates: Partial<OptionLeg> = {};
    
    const qty = parseInt(editQuantity);
    if (!isNaN(qty) && qty >= 1 && qty !== leg.quantity) {
      updates.quantity = qty;
    }
    
    const price = parseFloat(editEntryPrice);
    if (!isNaN(price) && price > 0 && Math.abs(price - leg.premium) > 0.001) {
      updates.premium = price;
    }
    
    if (Object.keys(updates).length > 0) {
      onUpdateLeg(leg.id, updates);
    }
  };

  const handleExcludeChange = (leg: OptionLeg, checked: boolean) => {
    setIsExcluded(checked);
    onUpdateLeg(leg.id, { isExcluded: checked });
  };

  const handleSellToCloseToggle = (leg: OptionLeg) => {
    setShowSellToClose(true);
    const remainingQty = getRemainingShares(leg);
    setClosingQuantity(remainingQty.toString());
    setClosingPrice(currentPrice.toFixed(2));
  };

  const handleSellToClose = (leg: OptionLeg) => {
    const price = parseFloat(closingPrice);
    const qty = parseInt(closingQuantity);
    if (isNaN(price) || price <= 0 || isNaN(qty) || qty <= 0) return;
    
    const existingEntries = leg.closingTransaction?.entries || [];
    const existingClosedQty = existingEntries.reduce((sum, e) => sum + e.quantity, 0);
    
    const newEntry = {
      id: Date.now().toString(),
      quantity: qty,
      closingPrice: price,
      openingPrice: leg.premium,
      strike: 0,
      closedAt: new Date().toISOString(),
    };
    
    const allEntries = [...existingEntries, newEntry];
    const totalClosedQty = existingClosedQty + qty;
    const weightedAvgPrice = allEntries.reduce((sum, e) => sum + e.closingPrice * e.quantity, 0) / totalClosedQty;
    
    onUpdateLeg(leg.id, {
      closingTransaction: {
        isEnabled: true,
        closingPrice: weightedAvgPrice,
        quantity: totalClosedQty,
        entries: allEntries,
      },
    });
    
    handleClosePopover();
  };

  const handleCancelSellToClose = () => {
    setShowSellToClose(false);
  };

  const handleRemove = (leg: OptionLeg) => {
    onRemoveLeg(leg.id);
    handleClosePopover();
  };

  const handleReOpen = (leg: OptionLeg) => {
    onUpdateLeg(leg.id, {
      closingTransaction: undefined,
    });
    handleClosePopover();
  };

  const handleClosingQtyStep = (leg: OptionLeg, delta: number) => {
    const currentQty = parseInt(closingQuantity) || 0;
    const remainingShares = getRemainingShares(leg);
    const newQty = Math.max(1, Math.min(remainingShares, currentQty + delta));
    setClosingQuantity(newQty.toString());
  };

  const handleClosingQtyInputChange = (leg: OptionLeg, value: string) => {
    if (value === "" || /^\d+$/.test(value)) {
      const num = parseInt(value) || 0;
      const remainingShares = getRemainingShares(leg);
      if (num <= remainingShares) {
        setClosingQuantity(value);
      }
    }
  };

  const handleSetAllClosingQty = (leg: OptionLeg) => {
    const remainingShares = getRemainingShares(leg);
    setClosingQuantity(remainingShares.toString());
  };

  // Separate closed and open segments
  const closedSegments = allSegments.filter(s => s.type === 'closed');
  const openSegments = allSegments.filter(s => s.type === 'open');

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-sm flex-wrap">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        EQUITY:
      </span>
      
      {/* Render closed segments first */}
      {closedSegments.map((segment) => {
        const positionLabel = segment.position === "long" ? "Long" : "Short";
        const pl = segment.realizedPL || 0;
        const plPercent = segment.entryPrice > 0 
          ? ((pl / (segment.entryPrice * segment.quantity)) * 100)
          : 0;
        
        return (
          <Popover
            key={segment.segmentId}
            open={openPopoverId === segment.segmentId}
            onOpenChange={(open) => {
              if (open) {
                setOpenPopoverId(segment.segmentId);
              } else {
                handleClosePopover();
              }
            }}
          >
            <PopoverTrigger asChild>
              <button
                className="px-2 py-0.5 rounded border border-muted-foreground/30 bg-muted/50 text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors"
                data-testid={`equity-closed-${segment.entryId}`}
              >
                <span className="flex items-center gap-1">
                  <span className="line-through">{positionLabel} {segment.quantity} shares at ${segment.entryPrice.toFixed(2)}</span>
                  <CheckCircle className="h-3 w-3 text-emerald-500" />
                </span>
              </button>
            </PopoverTrigger>
            
            <PopoverContent className="w-64 p-3" align="start">
              <div className="space-y-3">
                <div className="text-center font-medium text-sm">
                  {symbol}
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Open Price</div>
                    <div className="font-mono font-medium">${segment.entryPrice.toFixed(2)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Close Price</div>
                    <div className="font-mono font-medium">${segment.closingPrice?.toFixed(2)}</div>
                    <div className={`text-xs font-medium ${pl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {pl >= 0 ? "+" : ""}${pl.toFixed(2)} ({pl >= 0 ? "+" : ""}{plPercent.toFixed(0)}%)
                    </div>
                  </div>
                </div>
                
                <div className="border-t pt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id={`exclude-closed-${segment.segmentId}`}
                      checked={false}
                      onCheckedChange={() => {}}
                      data-testid="checkbox-exclude-closed"
                    />
                    <label htmlFor={`exclude-closed-${segment.segmentId}`} className="text-sm cursor-pointer">
                      Exclude
                    </label>
                  </div>
                  
                  <button
                    onClick={() => handleReOpen(segment.leg)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full"
                    data-testid="button-reopen"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Re-Open
                  </button>
                  
                  <button
                    onClick={() => handleRemove(segment.leg)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive w-full"
                    data-testid="button-remove-equity"
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
      
      {/* Render open segments */}
      {openSegments.map((segment) => {
        const positionLabel = segment.position === "long" ? "Long" : "Short";
        const remainingShares = getRemainingShares(segment.leg);
        const showUpdate = hasQuantityChanged(segment.leg) || hasEntryPriceChanged(segment.leg);
        
        return (
          <Popover
            key={segment.segmentId}
            open={openPopoverId === segment.segmentId}
            onOpenChange={(open) => {
              if (open) {
                handleOpenSegmentClick(segment);
              } else {
                handleClosePopover();
              }
            }}
          >
            <PopoverTrigger asChild>
              <button
                className="px-2 py-0.5 rounded border border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/50 cursor-pointer transition-colors"
                data-testid={`equity-open-${segment.legId}`}
              >
                {positionLabel} {segment.quantity} shares at ${segment.entryPrice.toFixed(2)}
              </button>
            </PopoverTrigger>
            
            <PopoverContent className="w-72 p-3" align="start">
              <div className="space-y-3">
                <div className="text-center font-medium text-sm">
                  {segment.quantity}× {symbol}
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs block text-center">Quantity</Label>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        onClick={() => handleQuantityStep(segment.leg, -100)}
                        data-testid="button-qty-decrease"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Input
                        value={editQuantity}
                        onChange={(e) => handleQuantityInputChange(e.target.value)}
                        className="h-8 text-sm text-center font-mono"
                        type="text"
                        inputMode="numeric"
                        data-testid="input-equity-quantity"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        onClick={() => handleQuantityStep(segment.leg, 100)}
                        data-testid="button-qty-increase"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs block text-center">Cost Basis</Label>
                    <div className="flex items-center gap-1">
                      <span className="text-sm">$</span>
                      <Input
                        value={editEntryPrice}
                        onChange={(e) => handleEntryPriceChange(e.target.value)}
                        className="h-8 text-sm font-mono"
                        type="text"
                        inputMode="decimal"
                        data-testid="input-equity-entry-price"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        onClick={handleRefreshEntryPrice}
                        title="Set to current market price"
                        data-testid="button-refresh-entry-price"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                {showUpdate && (
                  <Button
                    size="sm"
                    variant="default"
                    className="w-full"
                    onClick={() => handleSaveChanges(segment.leg)}
                    data-testid="button-save-equity-changes"
                  >
                    Update
                  </Button>
                )}
                
                <div className="border-t pt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id={`exclude-equity-${segment.legId}`}
                      checked={isExcluded}
                      onCheckedChange={(checked) => handleExcludeChange(segment.leg, checked === true)}
                      data-testid="checkbox-exclude-equity"
                    />
                    <label htmlFor={`exclude-equity-${segment.legId}`} className="text-sm cursor-pointer">
                      Exclude
                    </label>
                  </div>
                  
                  {!showSellToClose ? (
                    <>
                      <button
                        onClick={() => handleSellToCloseToggle(segment.leg)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full"
                        data-testid="button-sell-to-close-toggle"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Sell to Close
                      </button>
                      
                      <button
                        onClick={() => handleRemove(segment.leg)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive w-full"
                        data-testid="button-remove-equity"
                      >
                        <X className="h-4 w-4" />
                        Remove
                      </button>
                    </>
                  ) : (
                    <div className="space-y-3 pt-2 border-t">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Closing Price</Label>
                          <div className="flex items-center gap-1">
                            <span className="text-sm">$</span>
                            <Input
                              value={closingPrice}
                              onChange={(e) => setClosingPrice(e.target.value)}
                              className="h-8 text-sm"
                              type="number"
                              step="0.01"
                              data-testid="input-closing-price"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0"
                              onClick={() => setClosingPrice(currentPrice.toFixed(2))}
                              title="Set to current market price"
                              data-testid="button-refresh-closing-price"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <Label className="text-xs">Closing Qty</Label>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0"
                              onClick={() => handleClosingQtyStep(segment.leg, -100)}
                              data-testid="button-closing-qty-decrease"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Input
                              value={closingQuantity}
                              onChange={(e) => handleClosingQtyInputChange(segment.leg, e.target.value)}
                              className="h-8 text-sm text-center font-mono"
                              type="text"
                              inputMode="numeric"
                              data-testid="input-closing-quantity"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0"
                              onClick={() => handleClosingQtyStep(segment.leg, 100)}
                              data-testid="button-closing-qty-increase"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="text-xs text-center text-muted-foreground">
                            <button 
                              onClick={() => handleSetAllClosingQty(segment.leg)}
                              className="hover:underline"
                              data-testid="button-closing-qty-all"
                            >
                              All ({remainingShares})
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => handleSellToClose(segment.leg)}
                          data-testid="button-confirm-sell-to-close"
                        >
                          Sell to Close
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={handleCancelSellToClose}
                          data-testid="button-cancel-sell-to-close"
                        >
                          Cancel
                        </Button>
                      </div>
                      
                      <button
                        onClick={() => handleRemove(segment.leg)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive w-full pt-2 border-t"
                        data-testid="button-remove-equity"
                      >
                        <X className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
      
      {/* Render excluded legs */}
      {excludedLegs.map((leg) => {
        const positionLabel = leg.position === "long" ? "Long" : "Short";
        const segmentId = `excluded-${leg.id}`;
        
        return (
          <Popover
            key={segmentId}
            open={openPopoverId === segmentId}
            onOpenChange={(open) => {
              if (open) {
                setOpenPopoverId(segmentId);
                setIsExcluded(true);
              } else {
                handleClosePopover();
              }
            }}
          >
            <PopoverTrigger asChild>
              <button
                className="px-2 py-0.5 rounded border opacity-50 border-dashed border-muted-foreground/50 text-muted-foreground line-through cursor-pointer"
                data-testid={`equity-excluded-${leg.id}`}
              >
                {positionLabel} {leg.quantity} shares at ${leg.premium.toFixed(2)}
              </button>
            </PopoverTrigger>
            
            <PopoverContent className="w-72 p-3" align="start">
              <div className="space-y-3">
                <div className="text-center font-medium text-sm text-muted-foreground">
                  Excluded Position
                </div>
                
                <div className="border-t pt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id={`exclude-equity-${leg.id}`}
                      checked={true}
                      onCheckedChange={(checked) => handleExcludeChange(leg, checked === true)}
                      data-testid="checkbox-exclude-equity"
                    />
                    <label htmlFor={`exclude-equity-${leg.id}`} className="text-sm cursor-pointer">
                      Exclude
                    </label>
                  </div>
                  
                  <button
                    onClick={() => handleRemove(leg)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive w-full"
                    data-testid="button-remove-equity"
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
