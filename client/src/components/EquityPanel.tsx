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
import { ChevronLeft, ChevronRight, X } from "lucide-react";
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
  const [editQuantity, setEditQuantity] = useState(100);
  const [showSellToClose, setShowSellToClose] = useState(false);
  const [closingPrice, setClosingPrice] = useState("");
  const [closingQuantity, setClosingQuantity] = useState(0);
  const [isExcluded, setIsExcluded] = useState(false);

  const stockLegs = legs.filter((leg) => leg.type === "stock");
  const selectedLeg = stockLegs.find(l => l.id === selectedLegId) || null;

  useEffect(() => {
    if (selectedLeg) {
      setEditQuantity(selectedLeg.quantity);
      setIsExcluded(selectedLeg.isExcluded || false);
      setShowSellToClose(selectedLeg.closingTransaction?.isEnabled || false);
      setClosingPrice(selectedLeg.closingTransaction?.closingPrice?.toFixed(2) || currentPrice.toFixed(2));
      setClosingQuantity(selectedLeg.closingTransaction?.quantity || selectedLeg.quantity);
    }
  }, [selectedLeg, currentPrice]);

  if (stockLegs.length === 0) {
    return null;
  }

  const handleOpenPopover = (leg: OptionLeg) => {
    setSelectedLegId(leg.id);
    setEditQuantity(leg.quantity);
    setIsExcluded(leg.isExcluded || false);
    setShowSellToClose(leg.closingTransaction?.isEnabled || false);
    setClosingPrice(leg.closingTransaction?.closingPrice?.toFixed(2) || currentPrice.toFixed(2));
    setClosingQuantity(leg.closingTransaction?.quantity || leg.quantity);
    setPopoverOpen(true);
  };

  const handleClosePopover = () => {
    setPopoverOpen(false);
    setSelectedLegId(null);
    setShowSellToClose(false);
  };

  const handleQuantityChange = (delta: number) => {
    const newQty = Math.max(1, editQuantity + delta);
    setEditQuantity(newQty);
  };

  const handleSaveQuantity = () => {
    if (!selectedLeg) return;
    onUpdateLeg(selectedLeg.id, { quantity: editQuantity });
  };

  const handleExcludeChange = (checked: boolean) => {
    if (!selectedLeg) return;
    setIsExcluded(checked);
    onUpdateLeg(selectedLeg.id, { isExcluded: checked });
  };

  const handleSellToCloseToggle = () => {
    setShowSellToClose(true);
  };

  const handleSellToClose = () => {
    if (!selectedLeg) return;
    
    const price = parseFloat(closingPrice);
    if (isNaN(price) || price <= 0) return;
    
    onUpdateLeg(selectedLeg.id, {
      closingTransaction: {
        isEnabled: true,
        closingPrice: price,
        quantity: closingQuantity,
        entries: [{
          id: Date.now().toString(),
          quantity: closingQuantity,
          closingPrice: price,
          openingPrice: selectedLeg.premium,
          strike: 0, // Stock legs have no strike
          closedAt: new Date().toISOString(),
        }],
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

  const handleClosingQtyChange = (delta: number) => {
    if (!selectedLeg) return;
    const maxQty = selectedLeg.quantity;
    const newQty = Math.max(1, Math.min(maxQty, closingQuantity + delta));
    setClosingQuantity(newQty);
  };

  const handleSetAllClosingQty = () => {
    if (!selectedLeg) return;
    setClosingQuantity(selectedLeg.quantity);
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        EQUITY:
      </span>
      
      {stockLegs.map((leg) => {
        const entryPrice = leg.premium;
        const positionLabel = leg.position === "long" ? "Long" : "Short";
        
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
                  leg.isExcluded
                    ? "opacity-50 border-dashed border-muted-foreground/50 text-muted-foreground line-through"
                    : "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/50"
                }`}
                data-testid={`equity-leg-${leg.id}`}
              >
                {positionLabel} {leg.quantity} shares at ${entryPrice.toFixed(2)}
              </button>
            </PopoverTrigger>
            
            <PopoverContent className="w-64 p-3" align="start">
              <div className="space-y-3">
                <div className="text-center font-medium text-sm">
                  {editQuantity}x {symbol}
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-center block">Quantity</Label>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleQuantityChange(-100)}
                        data-testid="button-qty-decrease"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="font-mono text-sm min-w-[40px] text-center">{editQuantity}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleQuantityChange(100)}
                        data-testid="button-qty-increase"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    {editQuantity !== selectedLeg?.quantity && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-6 text-xs"
                        onClick={handleSaveQuantity}
                        data-testid="button-save-qty"
                      >
                        Update
                      </Button>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-center block">Price</Label>
                    <div className="text-center font-mono text-sm py-1">
                      ${currentPrice.toFixed(2)}
                    </div>
                  </div>
                </div>
                
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
                        <span className="text-muted-foreground">✓</span>
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
                          <Label className="text-xs">Closing Price:</Label>
                          <Input
                            value={closingPrice}
                            onChange={(e) => setClosingPrice(e.target.value)}
                            className="h-8 text-sm"
                            type="number"
                            step="0.01"
                            data-testid="input-closing-price"
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <Label className="text-xs">Closing Quantity:</Label>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleClosingQtyChange(-100)}
                              data-testid="button-closing-qty-decrease"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-xs"
                              onClick={handleSetAllClosingQty}
                              data-testid="button-closing-qty-all"
                            >
                              All
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleClosingQtyChange(100)}
                              data-testid="button-closing-qty-increase"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="text-xs text-center text-muted-foreground">
                            {closingQuantity} of {selectedLeg?.quantity || 0}
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
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
