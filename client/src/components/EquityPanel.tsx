import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingUp, TrendingDown, X, ChevronDown, ChevronUp } from "lucide-react";
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
  onAddStockLeg,
}: EquityPanelProps) {
  const [selectedLeg, setSelectedLeg] = useState<OptionLeg | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [editQuantity, setEditQuantity] = useState("");
  const [editPrice, setEditPrice] = useState("");

  // Filter only stock legs
  const stockLegs = legs.filter((leg) => leg.type === "stock");

  if (stockLegs.length === 0) {
    return null;
  }

  const handleOpenPopover = (leg: OptionLeg) => {
    setSelectedLeg(leg);
    setEditQuantity(leg.quantity.toString());
    setEditPrice(leg.premium.toFixed(2));
    setPopoverOpen(true);
  };

  const handleSaveChanges = () => {
    if (!selectedLeg) return;
    
    const qty = parseInt(editQuantity);
    const price = parseFloat(editPrice);
    
    if (!isNaN(qty) && qty > 0 && !isNaN(price) && price > 0) {
      onUpdateLeg(selectedLeg.id, {
        quantity: qty,
        premium: price,
      });
    }
    
    setPopoverOpen(false);
    setSelectedLeg(null);
  };

  const handlePositionChange = (position: "long" | "short") => {
    if (!selectedLeg) return;
    onUpdateLeg(selectedLeg.id, { position });
  };

  const handleExclude = () => {
    if (!selectedLeg) return;
    onUpdateLeg(selectedLeg.id, { isExcluded: !selectedLeg.isExcluded });
  };

  const handleRemove = () => {
    if (!selectedLeg) return;
    onRemoveLeg(selectedLeg.id);
    setPopoverOpen(false);
    setSelectedLeg(null);
  };

  return (
    <Card className="p-3 bg-card/50">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          EQUITY:
        </span>
        
        {stockLegs.map((leg) => {
          const entryPrice = leg.premium;
          const pnl = leg.position === "long" 
            ? (currentPrice - entryPrice) * leg.quantity
            : (entryPrice - currentPrice) * leg.quantity;
          // Position-aware percentage: for short positions, profit when price goes down
          const pnlPercent = leg.position === "long"
            ? ((currentPrice - entryPrice) / entryPrice) * 100
            : ((entryPrice - currentPrice) / entryPrice) * 100;
          const isProfit = pnl >= 0;
          const positionLabel = leg.position === "long" ? "Long" : "Short";
          
          return (
            <Popover
              key={leg.id}
              open={popoverOpen && selectedLeg?.id === leg.id}
              onOpenChange={(open) => {
                if (!open) {
                  setPopoverOpen(false);
                  setSelectedLeg(null);
                }
              }}
            >
              <PopoverTrigger asChild>
                <button
                  onClick={() => handleOpenPopover(leg)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors cursor-pointer ${
                    leg.isExcluded
                      ? "opacity-50 border-dashed"
                      : isProfit
                      ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/30"
                      : "border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/50 dark:hover:bg-rose-950/30"
                  }`}
                  data-testid={`equity-leg-${leg.id}`}
                >
                  <span className={`text-sm font-medium ${
                    leg.position === "long" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  }`}>
                    {positionLabel} {leg.quantity} share{leg.quantity !== 1 ? "s" : ""} at ${entryPrice.toFixed(2)}
                  </span>
                  
                  <span className={`text-xs font-mono ${
                    isProfit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  }`}>
                    {isProfit ? "+" : ""}${pnl.toFixed(2)} ({isProfit ? "+" : ""}{pnlPercent.toFixed(1)}%)
                  </span>
                  
                  {isProfit ? (
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                  )}
                </button>
              </PopoverTrigger>
              
              <PopoverContent className="w-72" align="start">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{symbol} Shares</h4>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleRemove}
                      className="h-6 w-6"
                      data-testid="button-remove-equity"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Quantity</Label>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => setEditQuantity((prev) => String(Math.max(1, parseInt(prev) - 100)))}
                          data-testid="button-qty-decrease"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Input
                          value={editQuantity}
                          onChange={(e) => setEditQuantity(e.target.value)}
                          className="h-8 text-center"
                          type="number"
                          min="1"
                          data-testid="input-equity-quantity"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => setEditQuantity((prev) => String(parseInt(prev) + 100))}
                          data-testid="button-qty-increase"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label className="text-xs">Entry Price</Label>
                      <Input
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="h-8"
                        type="number"
                        step="0.01"
                        min="0"
                        data-testid="input-equity-price"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs">Position</Label>
                    <Select
                      value={selectedLeg?.position || "long"}
                      onValueChange={(v) => handlePositionChange(v as "long" | "short")}
                    >
                      <SelectTrigger className="h-8" data-testid="select-equity-position">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="long">Long (Buy)</SelectItem>
                        <SelectItem value="short">Short (Sell)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Current: </span>
                      <span className="font-mono font-medium">${currentPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleExclude}
                        data-testid="button-exclude-equity"
                      >
                        {selectedLeg?.isExcluded ? "Include" : "Exclude"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveChanges}
                        data-testid="button-save-equity"
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </Card>
  );
}
