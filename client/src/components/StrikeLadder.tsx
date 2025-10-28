import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OptionLeg } from "@shared/schema";

interface StrikeLadderProps {
  legs: OptionLeg[];
  currentPrice: number;
  strikeRange: { min: number; max: number };
}

export function StrikeLadder({ legs, currentPrice, strikeRange }: StrikeLadderProps) {
  const strikeCount = 20;
  const strikeStep = (strikeRange.max - strikeRange.min) / (strikeCount - 1);
  const strikes = Array.from({ length: strikeCount }, (_, i) => 
    strikeRange.min + i * strikeStep
  );

  const getStrikeInfo = (strike: number) => {
    const tolerance = strikeStep / 2;
    const legsAtStrike = legs.filter(
      leg => Math.abs(leg.strike - strike) < tolerance
    );
    
    return {
      hasLegs: legsAtStrike.length > 0,
      calls: legsAtStrike.filter(l => l.type === "call").length,
      puts: legsAtStrike.filter(l => l.type === "put").length,
    };
  };

  const currentPricePercent = 
    ((currentPrice - strikeRange.min) / (strikeRange.max - strikeRange.min)) * 100;

  return (
    <Card className="p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold mb-1">Strike Prices</h3>
        <p className="text-xs text-muted-foreground">
          Visual representation of strike price range
        </p>
      </div>

      <div className="relative h-20 bg-muted/30 rounded-md overflow-hidden">
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
                  <div className="absolute -bottom-2 flex gap-1">
                    {info.calls > 0 && (
                      <Badge 
                        className="text-[8px] h-4 px-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      >
                        C
                      </Badge>
                    )}
                    {info.puts > 0 && (
                      <Badge 
                        className="text-[8px] h-4 px-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      >
                        P
                      </Badge>
                    )}
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
