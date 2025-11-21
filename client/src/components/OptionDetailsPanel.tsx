import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Minus, Plus, X, RotateCcw } from "lucide-react";
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

  const formatStrike = (strike: number) => {
    return strike % 1 === 0 ? strike.toFixed(0) : strike.toFixed(2).replace(/\.?0+$/, '');
  };
  
  const title = `${symbol.toUpperCase()} ${formatStrike(leg.strike)}${leg.type === "call" ? "C" : "P"} ${formatDate(expirationDate)}`;
  const positionText = leg.position === "long" ? "Buy" : "Sell";
  const oppositePosition = leg.position === "long" ? "Sell" : "Buy";
  
  const displayQuantity = leg.position === "long" ? leg.quantity : -leg.quantity;
  
  // Calculate average of bid/ask for cost basis
  const calculateAverageCost = () => {
    if (marketData?.bid !== undefined && marketData?.ask !== undefined) {
      return (marketData.bid + marketData.ask) / 2;
    }
    return leg.premium;
  };
  
  const [costBasis, setCostBasis] = useState<number>(leg.premium);
  // Check if this leg has a manually edited premium (persisted in leg data)
  const isManuallyEdited = leg.premiumSource === "manual";
  
  // Sync local state with leg premium when leg changes
  useEffect(() => {
    setCostBasis(leg.premium);
  }, [leg.premium]);
  
  // Update cost basis when market data changes (only if not manually edited)
  useEffect(() => {
    if (!isManuallyEdited && marketData?.bid !== undefined && marketData?.ask !== undefined) {
      const avgCost = calculateAverageCost();
      setCostBasis(avgCost);
      // Update leg premium to match the calculated average
      if (onUpdateLeg) {
        onUpdateLeg({ premium: avgCost, premiumSource: "market" });
      }
    }
  }, [marketData?.bid, marketData?.ask, isManuallyEdited]);
  
  const handleCostBasisChange = (value: number) => {
    // Allow zero for worthless options, but prevent negative values
    // Round to 2 decimal places
    const newCost = Math.max(0, Math.round((value || 0) * 100) / 100);
    setCostBasis(newCost);
    // Mark as manually edited by setting premiumSource
    if (onUpdateLeg) onUpdateLeg({ premium: newCost, premiumSource: "manual" });
  };
  
  const handleResetCostBasis = () => {
    const avgCost = calculateAverageCost();
    setCostBasis(avgCost);
    // Reset to market-based pricing
    if (onUpdateLeg) onUpdateLeg({ premium: avgCost, premiumSource: "market" });
  };
  
  const handleQuantityDecrease = () => {
    if (leg.position === "long") {
      // Long position: decrease from positive (2 → 1)
      const newQuantity = Math.max(1, leg.quantity - 1);
      if (onUpdateQuantity) onUpdateQuantity(newQuantity);
      if (onUpdateLeg) onUpdateLeg({ quantity: newQuantity });
    } else {
      // Short position: increase magnitude (-1 → -2)
      const newQuantity = leg.quantity + 1;
      if (onUpdateQuantity) onUpdateQuantity(newQuantity);
      if (onUpdateLeg) onUpdateLeg({ quantity: newQuantity });
    }
  };
  
  const handleQuantityIncrease = () => {
    if (leg.position === "long") {
      // Long position: increase to positive (1 → 2)
      const newQuantity = leg.quantity + 1;
      if (onUpdateQuantity) onUpdateQuantity(newQuantity);
      if (onUpdateLeg) onUpdateLeg({ quantity: newQuantity });
    } else {
      // Short position: decrease magnitude (but keep at least -1) (-2 → -1)
      const newQuantity = Math.max(1, leg.quantity - 1);
      if (onUpdateQuantity) onUpdateQuantity(newQuantity);
      if (onUpdateLeg) onUpdateLeg({ quantity: newQuantity });
    }
  };

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

      {/* Quantity and Cost Basis - Side by Side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Quantity Controls */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Quantity</label>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              onClick={handleQuantityDecrease}
              className="h-8 w-8"
              data-testid="button-decrease-quantity"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <div className="flex-1 text-center font-mono font-semibold" data-testid="text-quantity">
              {displayQuantity}
            </div>
            <Button
              size="icon"
              variant="outline"
              onClick={handleQuantityIncrease}
              className="h-8 w-8"
              data-testid="button-increase-quantity"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Cost Basis */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Cost Basis</label>
          <div className="flex items-center gap-1">
            <div className="text-sm font-semibold">$</div>
            <Input
              type="number"
              value={costBasis}
              onChange={(e) => handleCostBasisChange(Number(e.target.value))}
              onBlur={(e) => {
                // Round to 2 decimals when user finishes editing
                const rounded = Math.round(Number(e.target.value) * 100) / 100;
                if (rounded !== costBasis) {
                  handleCostBasisChange(rounded);
                }
              }}
              className="h-8 font-mono text-center"
              step="0.01"
              min="0"
              data-testid="input-cost-basis"
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={handleResetCostBasis}
              disabled={!marketData?.bid || !marketData?.ask}
              className="h-8 w-8"
              title={marketData?.bid && marketData?.ask ? "Reset to market average" : "No market data available"}
              aria-label="Reset cost basis"
              data-testid="button-reset-cost-basis"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bid/Ask and Volume */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Bid</span>
          <span className="font-mono font-semibold text-green-600 dark:text-green-400">{formatPrice(marketData?.bid)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Ask</span>
          <span className="font-mono font-semibold text-red-600 dark:text-red-400">{formatPrice(marketData?.ask)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Volume</span>
          <span className="font-mono font-semibold">{marketData?.volume?.toLocaleString() || "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">OI</span>
          <span className="font-mono font-semibold">—</span>
        </div>
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
