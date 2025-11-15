import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, X } from "lucide-react";
import type { OptionLeg } from "@shared/schema";

interface OptionMarketData {
  bid?: number;
  ask?: number;
  iv?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
  volume?: number;
}

interface OptionDetailsPanelProps {
  leg: OptionLeg;
  symbol: string;
  expirationDate: string | null;
  marketData?: OptionMarketData;
  onUpdateQuantity: (quantity: number) => void;
  onSwitchType: () => void;
  onChangePosition: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export function OptionDetailsPanel({
  leg,
  symbol,
  expirationDate,
  marketData,
  onUpdateQuantity,
  onSwitchType,
  onChangePosition,
  onRemove,
  onClose,
}: OptionDetailsPanelProps) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });
  };

  const formatGreek = (value: number | undefined, decimals: number = 4) => {
    if (value === undefined) return "—";
    return value.toFixed(decimals);
  };

  const formatPrice = (value: number | undefined) => {
    if (value === undefined) return "—";
    return `$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number | undefined) => {
    if (value === undefined) return "—";
    return `${(value * 100).toFixed(1)}%`;
  };

  const title = `${symbol.toUpperCase()} ${leg.strike.toFixed(0)}${leg.type === "call" ? "C" : "P"} ${formatDate(expirationDate)}`;
  const positionText = leg.position === "long" ? "Buy" : "Sell";
  const oppositePosition = leg.position === "long" ? "Sell" : "Buy";

  return (
    <div className="w-80 p-4 space-y-3 bg-background border border-border rounded-lg shadow-lg" data-testid="option-details-panel">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-sm">{title}</h3>
          <Badge variant="outline" className="mt-1 text-xs">
            {positionText} {leg.type === "call" ? "Call" : "Put"}
          </Badge>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          className="h-6 w-6"
          data-testid="button-close-details"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Separator />

      {/* Quantity Controls */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Quantity</label>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={() => onUpdateQuantity(Math.max(1, leg.quantity - 1))}
            className="h-8 w-8"
            data-testid="button-decrease-quantity"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <div className="flex-1 text-center font-mono font-semibold">
            {leg.quantity}
          </div>
          <Button
            size="icon"
            variant="outline"
            onClick={() => onUpdateQuantity(leg.quantity + 1)}
            className="h-8 w-8"
            data-testid="button-increase-quantity"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Price Section */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Price</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Bid</div>
            <div className="text-sm font-semibold font-mono">{formatPrice(marketData?.bid)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Ask</div>
            <div className="text-sm font-semibold font-mono">{formatPrice(marketData?.ask)}</div>
          </div>
        </div>
        {marketData?.volume !== undefined && (
          <div className="text-xs text-muted-foreground">
            Volume: <span className="font-mono">{marketData.volume}</span>
          </div>
        )}
      </div>

      {/* Greeks Section */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Greeks</label>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">IV</span>
            <span className="font-mono font-semibold">{formatPercent(marketData?.iv)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delta</span>
            <span className="font-mono font-semibold">{formatGreek(marketData?.delta)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Gamma</span>
            <span className="font-mono font-semibold">{formatGreek(marketData?.gamma)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Theta</span>
            <span className="font-mono font-semibold">{formatGreek(marketData?.theta)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Vega</span>
            <span className="font-mono font-semibold">{formatGreek(marketData?.vega)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rho</span>
            <span className="font-mono font-semibold">{formatGreek(marketData?.rho)}</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Actions */}
      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start text-xs"
          onClick={onSwitchType}
          data-testid="button-switch-type"
        >
          Switch to {leg.type === "call" ? "Put" : "Call"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start text-xs"
          onClick={onChangePosition}
          data-testid="button-change-position"
        >
          {oppositePosition} to Close
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start text-xs text-destructive hover:text-destructive"
          onClick={onRemove}
          data-testid="button-remove-leg"
        >
          Remove
        </Button>
      </div>
    </div>
  );
}
