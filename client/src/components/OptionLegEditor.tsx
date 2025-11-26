import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { OptionLeg } from "@shared/schema";
import { Trash2, Edit2 } from "lucide-react";

interface OptionLegEditorProps {
  leg: OptionLeg;
  onUpdate: (leg: OptionLeg) => void;
  onRemove: () => void;
  underlyingPrice: number;
}

export function OptionLegEditor({ leg, onUpdate, onRemove, underlyingPrice }: OptionLegEditorProps) {
  const [costBasisOpen, setCostBasisOpen] = useState(false);
  const [editedCostBasis, setEditedCostBasis] = useState<string>(leg.premium.toFixed(2));

  // Sync editedCostBasis with leg.premium when it changes externally (e.g., from drag or market refresh)
  useEffect(() => {
    setEditedCostBasis(leg.premium.toFixed(2));
  }, [leg.premium]);
  
  const isCall = leg.type === "call";
  const isLong = leg.position === "long";
  
  const displayQuantity = isLong ? leg.quantity : -leg.quantity;
  
  const handleQuantityChange = (value: number) => {
    const absValue = Math.max(1, Math.abs(value || 1));
    const newPosition: "long" | "short" = value >= 0 ? "long" : "short";
    onUpdate({ ...leg, quantity: absValue, position: newPosition });
  };

  const handleCostBasisSave = () => {
    const newPremium = parseFloat(editedCostBasis);
    if (!isNaN(newPremium) && newPremium >= 0) {
      onUpdate({ ...leg, premium: newPremium, premiumSource: 'manual' as const });
      setCostBasisOpen(false);
    }
  };

  const handleCostBasisReset = () => {
    setEditedCostBasis(leg.premium.toFixed(2));
    onUpdate({ ...leg, premiumSource: 'market' as const });
    setCostBasisOpen(false);
  };

  const bgColor = isCall 
    ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50" 
    : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50";

  const premiumSourceLabel = leg.premiumSource === 'manual' ? 'Manual' : 
                             leg.premiumSource === 'market' ? 'Market' : 'Theo';

  return (
    <Card className={`p-4 ${bgColor}`} data-testid={`leg-card-${leg.id}`}>
      <div className="flex items-start justify-between mb-4">
        <Popover open={costBasisOpen} onOpenChange={setCostBasisOpen}>
          <PopoverTrigger asChild>
            <button
              className="text-left cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded-md p-1 -m-1 transition-colors"
              data-testid={`button-edit-leg-${leg.id}`}
            >
              <h4 className="font-semibold flex items-center gap-1" data-testid={`leg-title-${leg.id}`}>
                {isLong ? "Long" : "Short"} {isCall ? "Call" : "Put"}
                <Edit2 className="h-3 w-3 text-muted-foreground" />
              </h4>
              <p className="text-xs text-muted-foreground">
                Strike ${leg.strike} | {leg.expirationDays}d
              </p>
              <p className="text-xs font-mono text-foreground">
                Cost: ${leg.premium.toFixed(2)} 
                <span className="text-muted-foreground ml-1">({premiumSourceLabel})</span>
              </p>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="start">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Cost Basis Editor</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  {isLong ? "Long" : "Short"} {leg.quantity} {leg.strike} {isCall ? "Call" : "Put"} | {leg.expirationDays} DTE
                </p>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs font-medium">Cost Basis (per contract)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono">$</span>
                  <Input
                    type="number"
                    value={editedCostBasis}
                    onChange={(e) => setEditedCostBasis(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCostBasisSave();
                      if (e.key === 'Escape') setCostBasisOpen(false);
                    }}
                    className="h-9 font-mono"
                    step="0.01"
                    min="0"
                    data-testid={`input-cost-basis-${leg.id}`}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Total: ${(parseFloat(editedCostBasis) * leg.quantity * 100 || 0).toFixed(2)} ({leg.quantity} × 100 shares)
                </p>
              </div>

              <div className="flex justify-between gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCostBasisReset}
                  data-testid={`button-reset-cost-${leg.id}`}
                >
                  Reset to Market
                </Button>
                <Button
                  size="sm"
                  onClick={handleCostBasisSave}
                  data-testid={`button-save-cost-${leg.id}`}
                >
                  Save
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-8 w-8"
          data-testid={`button-remove-leg-${leg.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`type-${leg.id}`} className="text-xs">Type</Label>
          <Select
            value={leg.type}
            onValueChange={(value: "call" | "put") =>
              onUpdate({ ...leg, type: value })
            }
          >
            <SelectTrigger id={`type-${leg.id}`} className="h-9" data-testid={`select-type-${leg.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="call">Call</SelectItem>
              <SelectItem value="put">Put</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor={`position-${leg.id}`} className="text-xs">Position</Label>
          <Select
            value={leg.position}
            onValueChange={(value: "long" | "short") =>
              onUpdate({ ...leg, position: value })
            }
          >
            <SelectTrigger id={`position-${leg.id}`} className="h-9" data-testid={`select-position-${leg.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="long">Long</SelectItem>
              <SelectItem value="short">Short</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor={`strike-${leg.id}`} className="text-xs">Strike Price</Label>
          <Input
            id={`strike-${leg.id}`}
            type="number"
            value={leg.strike}
            onChange={(e) =>
              onUpdate({ ...leg, strike: Number(e.target.value) })
            }
            className="h-9 font-mono"
            step="0.5"
            data-testid={`input-strike-${leg.id}`}
          />
        </div>

        <div>
          <Label htmlFor={`quantity-${leg.id}`} className="text-xs">Quantity</Label>
          <Input
            id={`quantity-${leg.id}`}
            type="number"
            value={displayQuantity}
            onChange={(e) =>
              handleQuantityChange(Number(e.target.value))
            }
            className="h-9 font-mono"
            data-testid={`input-quantity-${leg.id}`}
          />
        </div>

        <div>
          <Label htmlFor={`premium-${leg.id}`} className="text-xs">Premium</Label>
          <Input
            id={`premium-${leg.id}`}
            type="number"
            value={leg.premium}
            onChange={(e) =>
              onUpdate({ ...leg, premium: Number(e.target.value), premiumSource: 'manual' as const })
            }
            className="h-9 font-mono"
            step="0.01"
            data-testid={`input-premium-${leg.id}`}
          />
        </div>

        <div>
          <Label htmlFor={`expiration-${leg.id}`} className="text-xs">Days to Expiration</Label>
          <Input
            id={`expiration-${leg.id}`}
            type="number"
            value={leg.expirationDays}
            onChange={(e) =>
              onUpdate({ ...leg, expirationDays: Number(e.target.value) })
            }
            className="h-9 font-mono"
            min="1"
            data-testid={`input-expiration-${leg.id}`}
          />
        </div>
      </div>
    </Card>
  );
}
