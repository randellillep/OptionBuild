import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { OptionDetailsPanel } from "@/components/OptionDetailsPanel";
import type { OptionLeg } from "@shared/schema";

interface StrikeLadderProps {
  legs: OptionLeg[];
  currentPrice: number;
  strikeRange: { min: number; max: number };
  symbol: string;
  expirationDate: string | null;
  onUpdateLeg: (legId: string, updates: Partial<OptionLeg>) => void;
  onRemoveLeg: (legId: string) => void;
  optionsChainData?: any; // TODO: type this properly
}

export function StrikeLadder({ 
  legs, 
  currentPrice, 
  strikeRange,
  symbol,
  expirationDate,
  onUpdateLeg,
  onRemoveLeg,
  optionsChainData,
}: StrikeLadderProps) {
  const [selectedLeg, setSelectedLeg] = useState<OptionLeg | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const strikeCount = 20;
  const strikeStep = (strikeRange.max - strikeRange.min) / (strikeCount - 1);
  const baseStrikes = Array.from({ length: strikeCount }, (_, i) => 
    strikeRange.min + i * strikeStep
  );
  
  // Add actual leg strikes to ensure they appear on the ladder
  const legStrikes = legs.map(leg => leg.strike);
  const allStrikes = Array.from(new Set([...baseStrikes, ...legStrikes]))
    .filter(s => s >= strikeRange.min && s <= strikeRange.max)
    .sort((a, b) => a - b);
  
  const strikes = allStrikes;

  const getStrikeInfo = (strike: number) => {
    const legsAtStrike = legs.filter(
      leg => Math.abs(leg.strike - strike) < 0.01
    );
    
    return {
      hasLegs: legsAtStrike.length > 0,
      calls: legsAtStrike.filter(l => l.type === "call").length,
      puts: legsAtStrike.filter(l => l.type === "put").length,
      legs: legsAtStrike,
    };
  };

  const currentPricePercent = 
    ((currentPrice - strikeRange.min) / (strikeRange.max - strikeRange.min)) * 100;

  const getMarketDataForLeg = (leg: OptionLeg) => {
    if (!optionsChainData || !optionsChainData.quotes) return undefined;
    
    // Find option with matching strike and type
    const option = optionsChainData.quotes.find((opt: any) => 
      Math.abs(opt.strike - leg.strike) < 0.01 && opt.side.toLowerCase() === leg.type
    );
    
    if (!option) return undefined;
    
    return {
      bid: option.bid || 0,
      ask: option.ask || 0,
      iv: option.iv || 0,
      delta: option.delta || 0,
      gamma: option.gamma || 0,
      theta: option.theta || 0,
      vega: option.vega || 0,
      rho: option.rho || 0,
      volume: option.volume || 0,
    };
  };

  const handleBadgeClick = (leg: OptionLeg) => {
    setSelectedLeg(leg);
    setPopoverOpen(true);
  };

  return (
    <Card className="p-4 pb-6">
      <div className="mb-3">
        <h3 className="text-sm font-semibold mb-1">STRIKE:</h3>
        <p className="text-xs text-muted-foreground">
          Visual representation of strike price range
        </p>
      </div>

      <div className="relative h-24 bg-muted/30 rounded-md overflow-visible">
        <div className="absolute inset-0 flex items-center justify-between px-2">
          {strikes.map((strike, idx) => {
            const info = getStrikeInfo(strike);
            const position = (idx / (strikes.length - 1)) * 100;
            
            return (
              <div
                key={idx}
                className="relative flex flex-col items-center"
                style={{ position: 'absolute', left: `${position}%`, transform: 'translateX(-50%)' }}
              >
                <div 
                  className={`w-0.5 h-12 transition-all ${
                    info.hasLegs 
                      ? 'bg-primary h-16' 
                      : 'bg-border'
                  }`}
                />
                {info.hasLegs && (
                  <div className="absolute -top-7 flex gap-1 flex-col items-center">
                    {info.calls > 0 && info.legs.filter(l => l.type === "call").map(leg => (
                      <Popover key={leg.id} open={popoverOpen && selectedLeg?.id === leg.id} onOpenChange={(open) => {
                        if (!open && selectedLeg?.id === leg.id) {
                          setPopoverOpen(false);
                          setSelectedLeg(null);
                        }
                      }}>
                        <PopoverTrigger asChild>
                          <button
                            onClick={() => handleBadgeClick(leg)}
                            data-testid={`badge-call-${strike.toFixed(0)}`}
                            className="text-[10px] h-5 px-2 bg-green-500 text-white hover:bg-green-600 font-bold whitespace-nowrap cursor-pointer rounded-md border-0"
                          >
                            {strike.toFixed(0)}C
                          </button>
                        </PopoverTrigger>
                        {selectedLeg?.id === leg.id && (
                          <PopoverContent className="p-0 w-auto" align="center" side="bottom" sideOffset={10}>
                            <OptionDetailsPanel
                              leg={leg}
                              symbol={symbol}
                              expirationDate={expirationDate}
                              marketData={getMarketDataForLeg(leg)}
                              onUpdateQuantity={(quantity) => {
                                onUpdateLeg(leg.id, { quantity });
                              }}
                              onSwitchType={() => {
                                onUpdateLeg(leg.id, { type: leg.type === "call" ? "put" : "call" });
                                setPopoverOpen(false);
                                setSelectedLeg(null);
                              }}
                              onChangePosition={() => {
                                onUpdateLeg(leg.id, { position: leg.position === "long" ? "short" : "long" });
                              }}
                              onRemove={() => {
                                onRemoveLeg(leg.id);
                                setPopoverOpen(false);
                                setSelectedLeg(null);
                              }}
                              onClose={() => {
                                setPopoverOpen(false);
                                setSelectedLeg(null);
                              }}
                            />
                          </PopoverContent>
                        )}
                      </Popover>
                    ))}
                    {info.puts > 0 && info.legs.filter(l => l.type === "put").map(leg => (
                      <Popover key={leg.id} open={popoverOpen && selectedLeg?.id === leg.id} onOpenChange={(open) => {
                        if (!open && selectedLeg?.id === leg.id) {
                          setPopoverOpen(false);
                          setSelectedLeg(null);
                        }
                      }}>
                        <PopoverTrigger asChild>
                          <button
                            onClick={() => handleBadgeClick(leg)}
                            data-testid={`badge-put-${strike.toFixed(0)}`}
                            className="text-[10px] h-5 px-2 bg-red-500 text-white hover:bg-red-600 font-bold whitespace-nowrap cursor-pointer rounded-md border-0"
                          >
                            {strike.toFixed(0)}P
                          </button>
                        </PopoverTrigger>
                        {selectedLeg?.id === leg.id && (
                          <PopoverContent className="p-0 w-auto" align="center" side="bottom" sideOffset={10}>
                            <OptionDetailsPanel
                              leg={leg}
                              symbol={symbol}
                              expirationDate={expirationDate}
                              marketData={getMarketDataForLeg(leg)}
                              onUpdateQuantity={(quantity) => {
                                onUpdateLeg(leg.id, { quantity });
                              }}
                              onSwitchType={() => {
                                onUpdateLeg(leg.id, { type: leg.type === "call" ? "put" : "call" });
                                setPopoverOpen(false);
                                setSelectedLeg(null);
                              }}
                              onChangePosition={() => {
                                onUpdateLeg(leg.id, { position: leg.position === "long" ? "short" : "long" });
                              }}
                              onRemove={() => {
                                onRemoveLeg(leg.id);
                                setPopoverOpen(false);
                                setSelectedLeg(null);
                              }}
                              onClose={() => {
                                setPopoverOpen(false);
                                setSelectedLeg(null);
                              }}
                            />
                          </PopoverContent>
                        )}
                      </Popover>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="absolute top-0 bottom-0 w-1 bg-primary z-10"
          style={{ left: `${currentPricePercent}%`, transform: 'translateX(-50%)' }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-md whitespace-nowrap font-mono">
            ${currentPrice.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="flex justify-between mt-2 text-xs text-muted-foreground font-mono">
        <span>${strikeRange.min.toFixed(2)}</span>
        <span>${strikeRange.max.toFixed(2)}</span>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-primary rounded-sm"></div>
          <span className="text-muted-foreground">Current Price</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-border rounded-sm"></div>
          <span className="text-muted-foreground">Strike Levels</span>
        </div>
        <div className="flex items-center gap-1">
          <Badge className="text-[8px] h-4 px-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">C</Badge>
          <span className="text-muted-foreground">Calls</span>
        </div>
        <div className="flex items-center gap-1">
          <Badge className="text-[8px] h-4 px-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">P</Badge>
          <span className="text-muted-foreground">Puts</span>
        </div>
      </div>
    </Card>
  );
}
