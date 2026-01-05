import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RotateCcw, TrendingUp, TrendingDown, Minus, Info, Zap } from "lucide-react";
import type { OptionLeg, Greeks, StrategyMetrics } from "@shared/schema";
import { calculateProfitLossAtDate, calculateGreeks, calculateStrategyMetrics } from "@/lib/options-pricing";

function calculateTotalGreeks(legs: OptionLeg[], underlyingPrice: number, volatility: number): Greeks {
  return legs.reduce(
    (acc, leg) => {
      const legGreeks = calculateGreeks(leg, underlyingPrice, volatility);
      return {
        delta: acc.delta + legGreeks.delta,
        gamma: acc.gamma + legGreeks.gamma,
        theta: acc.theta + legGreeks.theta,
        vega: acc.vega + legGreeks.vega,
        rho: acc.rho + legGreeks.rho,
      };
    },
    { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 }
  );
}

interface WhatIfScenarioProps {
  legs: OptionLeg[];
  currentPrice: number;
  volatility: number;
  greeks: Greeks;
  metrics: StrategyMetrics | null;
}

export function WhatIfScenario({
  legs,
  currentPrice,
  volatility,
  greeks,
  metrics,
}: WhatIfScenarioProps) {
  const [priceChange, setPriceChange] = useState(0);
  const [ivChange, setIvChange] = useState(0);
  const [daysForward, setDaysForward] = useState(0);

  const hasLegs = legs.length > 0 && legs.some(leg => !leg.isExcluded);
  const maxDays = useMemo(() => {
    if (!hasLegs) return 30;
    const maxExp = Math.max(...legs.filter(l => !l.isExcluded).map(l => l.expirationDays));
    return Math.max(1, maxExp);
  }, [legs, hasLegs]);

  const scenarioPrice = currentPrice * (1 + priceChange / 100);
  const scenarioIV = Math.max(0.01, volatility * (1 + ivChange / 100));

  const currentPL = useMemo(() => {
    if (!hasLegs) return 0;
    return calculateProfitLossAtDate(legs, currentPrice, currentPrice, 0, volatility);
  }, [legs, currentPrice, volatility, hasLegs]);

  const scenarioPL = useMemo(() => {
    if (!hasLegs) return 0;
    return calculateProfitLossAtDate(legs, currentPrice, scenarioPrice, daysForward, scenarioIV);
  }, [legs, currentPrice, scenarioPrice, daysForward, scenarioIV, hasLegs]);

  const scenarioGreeks = useMemo(() => {
    if (!hasLegs) return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
    const adjustedLegs = legs.map(leg => ({
      ...leg,
      expirationDays: Math.max(0, leg.expirationDays - daysForward),
    }));
    return calculateTotalGreeks(adjustedLegs, scenarioPrice, scenarioIV);
  }, [legs, scenarioPrice, scenarioIV, daysForward, hasLegs]);

  const scenarioMetrics = useMemo(() => {
    if (!hasLegs) return null;
    const adjustedLegs = legs.map(leg => ({
      ...leg,
      expirationDays: Math.max(0, leg.expirationDays - daysForward),
    }));
    return calculateStrategyMetrics(adjustedLegs, scenarioPrice, scenarioIV);
  }, [legs, scenarioPrice, scenarioIV, daysForward, hasLegs]);

  const plChange = scenarioPL - currentPL;
  const deltaChange = scenarioGreeks.delta - greeks.delta;
  const thetaChange = scenarioGreeks.theta - greeks.theta;
  const vegaChange = scenarioGreeks.vega - greeks.vega;
  const gammaChange = scenarioGreeks.gamma - greeks.gamma;

  const resetScenario = () => {
    setPriceChange(0);
    setIvChange(0);
    setDaysForward(0);
  };

  const hasChanges = priceChange !== 0 || ivChange !== 0 || daysForward !== 0;

  const formatChange = (value: number, prefix: string = "") => {
    if (value === 0) return <Minus className="h-3 w-3 text-muted-foreground" />;
    const formatted = `${prefix}${value > 0 ? "+" : ""}${value.toFixed(2)}`;
    return value > 0 ? (
      <span className="text-green-500 flex items-center gap-0.5">
        <TrendingUp className="h-3 w-3" />
        {formatted}
      </span>
    ) : (
      <span className="text-red-500 flex items-center gap-0.5">
        <TrendingDown className="h-3 w-3" />
        {formatted}
      </span>
    );
  };

  const formatPLChange = (value: number) => {
    if (Math.abs(value) < 0.01) return <Minus className="h-3 w-3 text-muted-foreground" />;
    const formatted = `$${Math.abs(value).toFixed(0)}`;
    return value > 0 ? (
      <span className="text-green-500 font-semibold flex items-center gap-0.5">
        <TrendingUp className="h-3 w-3" />
        +{formatted}
      </span>
    ) : (
      <span className="text-red-500 font-semibold flex items-center gap-0.5">
        <TrendingDown className="h-3 w-3" />
        -{formatted}
      </span>
    );
  };

  if (!hasLegs) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">What-If Scenario</h3>
        </div>
        <div className="h-24 flex items-center justify-center bg-muted/30 rounded-md">
          <p className="text-xs text-muted-foreground">Add options legs to explore scenarios</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4" data-testid="what-if-scenario">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">What-If Scenario</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              Explore how your strategy performs under different market conditions.
              Adjust price, volatility, and time to see the projected impact.
            </TooltipContent>
          </Tooltip>
        </div>
        {hasChanges && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetScenario}
            className="h-7 text-xs"
            data-testid="button-reset-scenario"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Price Change</label>
              <Badge variant="outline" className="text-[10px] h-5 font-mono">
                {priceChange > 0 ? "+" : ""}{priceChange.toFixed(1)}%
              </Badge>
            </div>
            <Slider
              value={[priceChange]}
              onValueChange={([v]) => setPriceChange(v)}
              min={-30}
              max={30}
              step={0.5}
              className="w-full"
              data-testid="slider-price-change"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>${(currentPrice * 0.7).toFixed(0)}</span>
              <span className="font-medium text-foreground">${scenarioPrice.toFixed(2)}</span>
              <span>${(currentPrice * 1.3).toFixed(0)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">IV Change</label>
              <Badge variant="outline" className="text-[10px] h-5 font-mono">
                {ivChange > 0 ? "+" : ""}{ivChange.toFixed(0)}%
              </Badge>
            </div>
            <Slider
              value={[ivChange]}
              onValueChange={([v]) => setIvChange(v)}
              min={-50}
              max={100}
              step={5}
              className="w-full"
              data-testid="slider-iv-change"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{((volatility * 0.5) * 100).toFixed(0)}%</span>
              <span className="font-medium text-foreground">{(scenarioIV * 100).toFixed(1)}%</span>
              <span>{((volatility * 2) * 100).toFixed(0)}%</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Days Forward</label>
              <Badge variant="outline" className="text-[10px] h-5 font-mono">
                +{daysForward}d
              </Badge>
            </div>
            <Slider
              value={[daysForward]}
              onValueChange={([v]) => setDaysForward(v)}
              min={0}
              max={maxDays}
              step={1}
              className="w-full"
              data-testid="slider-days-forward"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Today</span>
              <span className="font-medium text-foreground">{daysForward === 0 ? "Now" : `+${daysForward}d`}</span>
              <span>Exp</span>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="text-center p-2 bg-muted/30 rounded-md">
              <p className="text-[10px] text-muted-foreground mb-1">P/L Impact</p>
              <div className={`text-lg font-bold ${plChange >= 0 ? "text-green-500" : "text-red-500"}`}>
                {plChange >= 0 ? "+" : "-"}${Math.abs(plChange).toFixed(0)}
              </div>
              <p className="text-[10px] text-muted-foreground">
                from ${currentPL.toFixed(0)} → ${scenarioPL.toFixed(0)}
              </p>
            </div>

            <div className="text-center p-2 bg-muted/30 rounded-md">
              <p className="text-[10px] text-muted-foreground mb-1">Delta</p>
              <div className="text-sm font-semibold">{scenarioGreeks.delta.toFixed(2)}</div>
              <div className="text-[10px]">{formatChange(deltaChange)}</div>
            </div>

            <div className="text-center p-2 bg-muted/30 rounded-md">
              <p className="text-[10px] text-muted-foreground mb-1">Theta</p>
              <div className="text-sm font-semibold">${scenarioGreeks.theta.toFixed(2)}</div>
              <div className="text-[10px]">{formatChange(thetaChange, "$")}</div>
            </div>

            <div className="text-center p-2 bg-muted/30 rounded-md">
              <p className="text-[10px] text-muted-foreground mb-1">Vega</p>
              <div className="text-sm font-semibold">{scenarioGreeks.vega.toFixed(2)}</div>
              <div className="text-[10px]">{formatChange(vegaChange)}</div>
            </div>

            <div className="text-center p-2 bg-muted/30 rounded-md">
              <p className="text-[10px] text-muted-foreground mb-1">Gamma</p>
              <div className="text-sm font-semibold">{scenarioGreeks.gamma.toFixed(4)}</div>
              <div className="text-[10px]">{formatChange(gammaChange)}</div>
            </div>
          </div>
        </div>

        {hasChanges && scenarioMetrics && (
          <div className="border-t pt-3">
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Max Profit:</span>{" "}
                <span className="font-medium">
                  {scenarioMetrics.maxProfit === Infinity
                    ? "Unlimited"
                    : scenarioMetrics.maxProfit !== null
                    ? `$${scenarioMetrics.maxProfit.toFixed(0)}`
                    : "N/A"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Max Loss:</span>{" "}
                <span className="font-medium">
                  {scenarioMetrics.maxLoss === -Infinity
                    ? "Unlimited"
                    : scenarioMetrics.maxLoss !== null
                    ? `$${Math.abs(scenarioMetrics.maxLoss).toFixed(0)}`
                    : "N/A"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Breakeven:</span>{" "}
                <span className="font-medium">
                  {scenarioMetrics.breakeven && scenarioMetrics.breakeven.length > 0
                    ? scenarioMetrics.breakeven.map(b => `$${b.toFixed(0)}`).join(", ")
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
