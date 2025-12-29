import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus } from "lucide-react";
import type { OptionLeg, MarketOptionChainSummary } from "@shared/schema";

interface AddLegDropdownProps {
  currentPrice: number;
  onAddLeg: (leg: Omit<OptionLeg, "id">) => void;
  optionsChainData?: MarketOptionChainSummary;
}

export function AddLegDropdown({ currentPrice, onAddLeg, optionsChainData }: AddLegDropdownProps) {
  const legTemplates = [
    {
      label: "Buy Call",
      type: "call" as const,
      position: "long" as const,
    },
    {
      label: "Buy Put",
      type: "put" as const,
      position: "long" as const,
    },
    {
      label: "Sell Call",
      type: "call" as const,
      position: "short" as const,
    },
    {
      label: "Sell Put",
      type: "put" as const,
      position: "short" as const,
    },
  ];

  // Helper to round strike with directional bias
  const roundStrike = (strike: number, direction: 'up' | 'down' = 'up'): number => {
    let increment: number;
    if (strike < 25) increment = 0.5;
    else if (strike < 100) increment = 1;
    else if (strike < 200) increment = 2.5;
    else increment = 5;
    
    return direction === 'up' 
      ? Math.ceil(strike / increment) * increment
      : Math.floor(strike / increment) * increment;
  };

  const handleAddLeg = (template: typeof legTemplates[0]) => {
    let strike: number;
    
    // If we have options chain data, find the nearest available strike for this option type
    if (optionsChainData && optionsChainData.quotes && optionsChainData.quotes.length > 0) {
      // Filter options by type (call or put) - normalize to lowercase for matching
      const optionsOfType = optionsChainData.quotes.filter(
        (opt: any) => opt.side.toLowerCase() === template.type
      );
      
      if (optionsOfType.length > 0) {
        // Find the strike closest to current price (absolute nearest)
        const nearestOption = optionsOfType.reduce((closest: any, current: any) => {
          const closestDiff = Math.abs(closest.strike - currentPrice);
          const currentDiff = Math.abs(current.strike - currentPrice);
          return currentDiff < closestDiff ? current : closest;
        });
        
        // Check if the nearest option is too far from ATM (>20% away)
        // If so, use calculated strike so it appears on the ladder
        const distancePercent = Math.abs(nearestOption.strike - currentPrice) / currentPrice;
        if (distancePercent > 0.20) {
          // Too far - find the closest rounded strike to current price
          strike = roundStrike(currentPrice, 'up');
          const strikeDown = roundStrike(currentPrice, 'down');
          // Pick whichever is closer to current price
          if (Math.abs(strikeDown - currentPrice) < Math.abs(strike - currentPrice)) {
            strike = strikeDown;
          }
        } else {
          // Close enough - use market strike
          strike = nearestOption.strike;
        }
      } else {
        // Fallback to calculated strike - find closest to current price
        strike = roundStrike(currentPrice, 'up');
        const strikeDown = roundStrike(currentPrice, 'down');
        if (Math.abs(strikeDown - currentPrice) < Math.abs(strike - currentPrice)) {
          strike = strikeDown;
        }
      }
    } else {
      // Fallback to calculated strike - find closest to current price
      strike = roundStrike(currentPrice, 'up');
      const strikeDown = roundStrike(currentPrice, 'down');
      if (Math.abs(strikeDown - currentPrice) < Math.abs(strike - currentPrice)) {
        strike = strikeDown;
      }
    }
    
    onAddLeg({
      type: template.type,
      position: template.position,
      strike,
      quantity: 1,
      premium: 3.5,
      expirationDays: 30,
      premiumSource: 'theoretical' as const,
      entryUnderlyingPrice: currentPrice,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="bg-sky-100 dark:bg-sky-900/30 border-sky-200 dark:border-sky-800 hover:bg-sky-200 dark:hover:bg-sky-800/50 text-foreground" 
          data-testid="button-add-dropdown"
        >
          <Plus className="h-3 w-3 mr-1.5" />
          Add
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {legTemplates.map((template) => (
          <DropdownMenuItem
            key={template.label}
            onClick={() => handleAddLeg(template)}
            data-testid={`dropdown-${template.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                template.type === "call" 
                  ? "bg-green-500" 
                  : "bg-red-500"
              }`} />
              {template.label}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
