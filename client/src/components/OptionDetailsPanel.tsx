import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, X } from "lucide-react";
import type { OptionLeg, MarketOptionChainSummary } from "@shared/schema";

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
  optionsChainData?: MarketOptionChainSummary;
  onUpdateLeg?: (updates: Partial<OptionLeg>) => void;
  onAddToStrategy?: () => void;
  onClose: () => void;
  // Legacy props for backward compatibility
  symbol?: string;
  expirationDate?: string | null;
  marketData?: OptionMarketData;
  onUpdateQuantity?: (quantity: number) => void;
  onSwitchType?: () => void;
  onChangePosition?: () => void;
  onRemove?: () => void;
}

export function OptionDetailsPanel({
  leg,
  optionsChainData,
  onUpdateLeg,
  onAddToStrategy,
  onClose,
  // Legacy props
  symbol: legacySymbol,
  expirationDate: legacyExpirationDate,
  marketData: legacyMarketData,
  onUpdateQuantity,
  onSwitchType,
  onChangePosition,
  onRemove,
}: OptionDetailsPanelProps) {
  // Extract market data from optionsChainData if available
  const getMarketData = (): OptionMarketData | undefined => {
    if (legacyMarketData) {
      // Legacy market data - apply position multiplier for Greeks
      const multiplier = leg.position === "long" ? 1 : -1;
      return {
        ...legacyMarketData,
        delta: legacyMarketData.delta !== undefined ? legacyMarketData.delta * multiplier : undefined,
        gamma: legacyMarketData.gamma !== undefined ? legacyMarketData.gamma * multiplier : undefined,
        theta: legacyMarketData.theta !== undefined ? legacyMarketData.theta * multiplier : undefined,
        vega: legacyMarketData.vega !== undefined ? legacyMarketData.vega * multiplier : undefined,
        rho: legacyMarketData.rho !== undefined ? legacyMarketData.rho * multiplier : undefined,
      };
    }
    if (!optionsChainData || !optionsChainData.quotes) return undefined;
    
    const option = optionsChainData.quotes.find((opt: any) => 
      Math.abs(opt.strike - leg.strike) < 0.01 && opt.side.toLowerCase() === leg.type
    );
    
    if (!option) return undefined;
    
    // Market data Greeks are always for long positions
    // Invert them for short positions
    const multiplier = leg.position === "long" ? 1 : -1;
    
    return {
      bid: option.bid || 0,
      ask: option.ask || 0,
      iv: option.iv || 0,
      delta: (option.delta || 0) * multiplier,
      gamma: (option.gamma || 0) * multiplier,
      theta: (option.theta || 0) * multiplier,
      vega: (option.vega || 0) * multiplier,
      rho: (option.rho || 0) * multiplier,
      volume: option.volume || 0,
    };
  };

  const marketData = getMarketData();
  const symbol = legacySymbol || optionsChainData?.symbol || "N/A";
  const expirationDate = legacyExpirationDate || (optionsChainData?.expirations?.[0] || null);
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
            onClick={() => {
              const newQuantity = Math.max(1, leg.quantity - 1);
              if (onUpdateQuantity) onUpdateQuantity(newQuantity);
              if (onUpdateLeg) onUpdateLeg({ quantity: newQuantity });
            }}
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
            onClick={() => {
              const newQuantity = leg.quantity + 1;
              if (onUpdateQuantity) onUpdateQuantity(newQuantity);
              if (onUpdateLeg) onUpdateLeg({ quantity: newQuantity });
            }}
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
        {onAddToStrategy ? (
          // Add mode - show "Add to Strategy" button
          <Button
            variant="default"
            size="sm"
            className="w-full text-xs"
            onClick={onAddToStrategy}
            data-testid="button-add-to-strategy"
          >
            Add to Strategy
          </Button>
        ) : (
          // Edit mode - show edit/remove actions
          <>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => {
                if (onSwitchType) onSwitchType();
                if (onUpdateLeg) onUpdateLeg({ type: leg.type === "call" ? "put" : "call" });
              }}
              data-testid="button-switch-type"
            >
              Switch to {leg.type === "call" ? "Put" : "Call"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => {
                if (onChangePosition) onChangePosition();
                if (onUpdateLeg) onUpdateLeg({ position: leg.position === "long" ? "short" : "long" });
              }}
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
          </>
        )}
      </div>
    </div>
  );
}
