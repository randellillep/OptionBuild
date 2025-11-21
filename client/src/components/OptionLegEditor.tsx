import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OptionLeg } from "@shared/schema";
import { Trash2 } from "lucide-react";

interface OptionLegEditorProps {
  leg: OptionLeg;
  onUpdate: (leg: OptionLeg) => void;
  onRemove: () => void;
  underlyingPrice: number;
}

export function OptionLegEditor({ leg, onUpdate, onRemove, underlyingPrice }: OptionLegEditorProps) {
  const isCall = leg.type === "call";
  const isLong = leg.position === "long";
  
  const displayQuantity = isLong ? leg.quantity : -leg.quantity;
  
  const handleQuantityChange = (value: number) => {
    const absValue = Math.max(1, Math.abs(value || 1)); // Prevent zero/empty, minimum 1
    const newPosition: "long" | "short" = value >= 0 ? "long" : "short";
    onUpdate({ ...leg, quantity: absValue, position: newPosition });
  };

  const bgColor = isCall 
    ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50" 
    : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50";

  return (
    <Card className={`p-4 ${bgColor}`} data-testid="leg-card">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="font-semibold" data-testid={`leg-title-${leg.id}`}>
            {isLong ? "Long" : "Short"} {isCall ? "Call" : "Put"}
          </h4>
          <p className="text-xs text-muted-foreground">
            Strike ${leg.strike} • {leg.expirationDays}d
          </p>
        </div>
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
            onChange={(e) => {
              // Round to 2 decimal places
              const value = Math.max(0, Math.round(Number(e.target.value) * 100) / 100);
              onUpdate({ ...leg, premium: value, premiumSource: 'manual' as const });
            }}
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
