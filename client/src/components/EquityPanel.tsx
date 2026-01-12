import { useState, useEffect } from "react";
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

export function EquityPanel({
  legs,
  currentPrice,
  symbol,
  onUpdateLeg,
  onRemoveLeg,
}: EquityPanelProps) {
  const [selectedLegId, setSelectedLegId] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [editQuantity, setEditQuantity] = useState("100");
  const [editEntryPrice, setEditEntryPrice] = useState("");
  const [showSellToClose, setShowSellToClose] = useState(false);
  const [closingPrice, setClosingPrice] = useState("");
  const [closingQuantity, setClosingQuantity] = useState("0");
  const [isExcluded, setIsExcluded] = useState(false);

  const stockLegs = legs.filter((leg) => leg.type === "stock");
  const selectedLeg = stockLegs.find(l => l.id === selectedLegId) || null;

  // Only sync state when the selected leg changes, NOT when price updates
  // This prevents the sell-to-close form from disappearing on price updates
  useEffect(() => {
    if (selectedLeg) {
      setEditQuantity(selectedLeg.quantity.toString());
      setEditEntryPrice(selectedLeg.premium.toFixed(2));
      setIsExcluded(selectedLeg.isExcluded || false);
      // Only set showSellToClose based on existing closing transaction when opening popover
      // Don't reset it on every render
      if (selectedLeg.closingTransaction?.isEnabled) {
        setShowSellToClose(true);
      }
      setClosingQuantity((selectedLeg.closingTransaction?.quantity || selectedLeg.quantity).toString());
    }
  }, [selectedLeg?.id, selectedLeg?.quantity, selectedLeg?.premium, selectedLeg?.isExcluded, selectedLeg?.closingTransaction?.isEnabled]);

  if (stockLegs.length === 0) {
    return null;
  }

  // Helper to check if all shares are sold
  const isFullyClosed = (leg: OptionLeg) => {
    if (!leg.closingTransaction?.isEnabled) return false;
    const closedQty = leg.closingTransaction.entries?.reduce((sum, e) => sum + e.quantity, 0) 
      || leg.closingTransaction.quantity || 0;
    return closedQty >= leg.quantity;
  };

  // Get remaining shares after closing
  const getRemainingShares = (leg: OptionLeg) => {
    if (!leg.closingTransaction?.isEnabled) return leg.quantity;
    const closedQty = leg.closingTransaction.entries?.reduce((sum, e) => sum + e.quantity, 0) 
      || leg.closingTransaction.quantity || 0;
    return Math.max(0, leg.quantity - closedQty);
  };

  const handleOpenPopover = (leg: OptionLeg) => {
    setSelectedLegId(leg.id);
    setEditQuantity(leg.quantity.toString());
    setEditEntryPrice(leg.premium.toFixed(2));
    setIsExcluded(leg.isExcluded || false);
    setShowSellToClose(leg.closingTransaction?.isEnabled || false);
    setClosingPrice(leg.closingTransaction?.closingPrice?.toFixed(2) || currentPrice.toFixed(2));
    const remainingQty = getRemainingShares(leg);
    setClosingQuantity(remainingQty.toString());
    setPopoverOpen(true);
  };

  const handleClosePopover = () => {
    setPopoverOpen(false);
    setSelectedLegId(null);
    setShowSellToClose(false);
  };

  const handleQuantityStep = (delta: number) => {
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

  const hasQuantityChanged = () => {
    if (!selectedLeg) return false;
    const qty = parseInt(editQuantity);
    return !isNaN(qty) && qty >= 1 && qty !== selectedLeg.quantity;
  };

  const hasEntryPriceChanged = () => {
    if (!selectedLeg) return false;
    const price = parseFloat(editEntryPrice);
    return !isNaN(price) && price > 0 && Math.abs(price - selectedLeg.premium) > 0.001;
  };

  const handleSaveChanges = () => {
    if (!selectedLeg) return;
    
    const updates: Partial<OptionLeg> = {};
    
    const qty = parseInt(editQuantity);
    if (!isNaN(qty) && qty >= 1 && qty !== selectedLeg.quantity) {
      updates.quantity = qty;
    }
    
    const price = parseFloat(editEntryPrice);
    if (!isNaN(price) && price > 0 && Math.abs(price - selectedLeg.premium) > 0.001) {
      updates.premium = price;
    }
    
    if (Object.keys(updates).length > 0) {
      onUpdateLeg(selectedLeg.id, updates);
    }
  };

  const handleExcludeChange = (checked: boolean) => {
    if (!selectedLeg) return;
    setIsExcluded(checked);
    onUpdateLeg(selectedLeg.id, { isExcluded: checked });
  };

  const handleSellToCloseToggle = () => {
    setShowSellToClose(true);
    if (selectedLeg) {
      const remainingQty = getRemainingShares(selectedLeg);
      setClosingQuantity(remainingQty.toString());
      setClosingPrice(currentPrice.toFixed(2));
    }
  };

  const handleSellToClose = () => {
    if (!selectedLeg) return;
    
    const price = parseFloat(closingPrice);
    const qty = parseInt(closingQuantity);
    if (isNaN(price) || price <= 0 || isNaN(qty) || qty <= 0) return;
    
    // Get existing entries
    const existingEntries = selectedLeg.closingTransaction?.entries || [];
    const existingClosedQty = existingEntries.reduce((sum, e) => sum + e.quantity, 0);
    
    // Add new entry
    const newEntry = {
      id: Date.now().toString(),
      quantity: qty,
      closingPrice: price,
      openingPrice: selectedLeg.premium,
      strike: 0,
      closedAt: new Date().toISOString(),
    };
    
    const allEntries = [...existingEntries, newEntry];
    const totalClosedQty = existingClosedQty + qty;
    
    // Calculate weighted average closing price
    const weightedAvgPrice = allEntries.reduce((sum, e) => sum + e.closingPrice * e.quantity, 0) / totalClosedQty;
    
    onUpdateLeg(selectedLeg.id, {
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

  const handleRemove = () => {
    if (!selectedLeg) return;
    onRemoveLeg(selectedLeg.id);
    handleClosePopover();
  };

  const handleUndoClose = () => {
    if (!selectedLeg) return;
    onUpdateLeg(selectedLeg.id, {
      closingTransaction: undefined,
    });
    setShowSellToClose(false);
  };

  const handleClosingQtyStep = (delta: number) => {
    if (!selectedLeg) return;
    const currentQty = parseInt(closingQuantity) || 0;
    const remainingShares = getRemainingShares(selectedLeg);
    const newQty = Math.max(1, Math.min(remainingShares, currentQty + delta));
    setClosingQuantity(newQty.toString());
  };

  const handleClosingQtyInputChange = (value: string) => {
    if (!selectedLeg) return;
    if (value === "" || /^\d+$/.test(value)) {
      const num = parseInt(value) || 0;
      const remainingShares = getRemainingShares(selectedLeg);
      if (num <= remainingShares) {
        setClosingQuantity(value);
      }
    }
  };

  const handleSetAllClosingQty = () => {
    if (!selectedLeg) return;
    const remainingShares = getRemainingShares(selectedLeg);
    setClosingQuantity(remainingShares.toString());
  };

  const showUpdateButton = hasQuantityChanged() || hasEntryPriceChanged();

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        EQUITY:
      </span>
      
      {stockLegs.map((leg) => {
        const entryPrice = leg.premium;
        const positionLabel = leg.position === "long" ? "Long" : "Short";
        const fullyClosed = isFullyClosed(leg);
        const remainingShares = getRemainingShares(leg);
        const closedShares = leg.quantity - remainingShares;
        
        // Calculate P/L for closed shares
        const closingTx = leg.closingTransaction;
        const closedPL = closingTx?.entries?.reduce((sum, entry) => {
          const entryBasis = entry.openingPrice ?? entryPrice;
          return sum + (leg.position === "long" 
            ? (entry.closingPrice - entryBasis) * entry.quantity
            : (entryBasis - entry.closingPrice) * entry.quantity);
        }, 0) || 0;
        
        return (
          <Popover
            key={leg.id}
            open={popoverOpen && selectedLegId === leg.id}
            onOpenChange={(open) => {
              if (!open) {
                handleClosePopover();
              }
            }}
          >
            <PopoverTrigger asChild>
              <button
                onClick={() => handleOpenPopover(leg)}
                className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                  fullyClosed
                    ? "border-muted-foreground/30 bg-muted/50 text-muted-foreground"
                    : leg.isExcluded
                    ? "opacity-50 border-dashed border-muted-foreground/50 text-muted-foreground line-through"
                    : "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/50"
                }`}
                data-testid={`equity-leg-${leg.id}`}
              >
                {fullyClosed ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    <span className="line-through">{positionLabel} {leg.quantity} shares</span>
                    <span className={closedPL >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                      {closedPL >= 0 ? "+" : ""}${closedPL.toFixed(0)}
                    </span>
                  </span>
                ) : closedShares > 0 ? (
                  <span>
                    {positionLabel} {remainingShares} shares at ${entryPrice.toFixed(2)}
                    <span className="text-muted-foreground ml-1">({closedShares} sold)</span>
                  </span>
                ) : (
                  <span>{positionLabel} {leg.quantity} shares at ${entryPrice.toFixed(2)}</span>
                )}
              </button>
            </PopoverTrigger>
            
            <PopoverContent className="w-72 p-3" align="start">
              <div className="space-y-3">
                <div className="text-center font-medium text-sm">
                  {fullyClosed ? (
                    <span className="text-muted-foreground">Closed Position</span>
                  ) : (
                    <span>{editQuantity || "0"}x {symbol}</span>
                  )}
                </div>
                
                {fullyClosed ? (
                  <div className="space-y-2">
                    <div className="text-center text-sm text-muted-foreground">
                      Sold {leg.quantity} shares at ${closingTx?.closingPrice?.toFixed(2)}
                    </div>
                    <div className={`text-center text-lg font-bold ${closedPL >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {closedPL >= 0 ? "+" : ""}${closedPL.toFixed(2)}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={handleUndoClose}
                      data-testid="button-undo-close"
                    >
                      Undo Close
                    </Button>
                    <button
                      onClick={handleRemove}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive w-full pt-2 border-t"
                      data-testid="button-remove-equity"
                    >
                      <X className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs block">Quantity</Label>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={() => handleQuantityStep(-100)}
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
                            onClick={() => handleQuantityStep(100)}
                            data-testid="button-qty-increase"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs block">Entry Price</Label>
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
                    
                    {showUpdateButton && (
                      <Button
                        size="sm"
                        variant="default"
                        className="w-full"
                        onClick={handleSaveChanges}
                        data-testid="button-save-equity-changes"
                      >
                        Update
                      </Button>
                    )}
                    
                    <div className="border-t pt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id={`exclude-equity-${leg.id}`}
                          checked={isExcluded}
                          onCheckedChange={(checked) => handleExcludeChange(checked === true)}
                          data-testid="checkbox-exclude-equity"
                        />
                        <label htmlFor={`exclude-equity-${leg.id}`} className="text-sm cursor-pointer">
                          Exclude
                        </label>
                      </div>
                      
                      {!showSellToClose ? (
                        <>
                          <button
                            onClick={handleSellToCloseToggle}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full"
                            data-testid="button-sell-to-close-toggle"
                          >
                            <span className="text-muted-foreground">$</span>
                            Sell to Close
                          </button>
                          
                          <button
                            onClick={handleRemove}
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
                                  onClick={() => handleClosingQtyStep(-100)}
                                  data-testid="button-closing-qty-decrease"
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Input
                                  value={closingQuantity}
                                  onChange={(e) => handleClosingQtyInputChange(e.target.value)}
                                  className="h-8 text-sm text-center font-mono"
                                  type="text"
                                  inputMode="numeric"
                                  data-testid="input-closing-quantity"
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 shrink-0"
                                  onClick={() => handleClosingQtyStep(100)}
                                  data-testid="button-closing-qty-increase"
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="text-xs text-center text-muted-foreground">
                                <button 
                                  onClick={handleSetAllClosingQty}
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
                              onClick={handleSellToClose}
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
                            onClick={handleRemove}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive w-full pt-2 border-t"
                            data-testid="button-remove-equity"
                          >
                            <X className="h-4 w-4" />
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
