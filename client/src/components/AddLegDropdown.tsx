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
      // Filter options by type (call or put)
      const optionsOfType = optionsChainData.quotes.filter(
        (opt: any) => opt.side === template.type
      );
      
      if (optionsOfType.length > 0) {
        // Find the strike closest to ATM
        const targetStrike = currentPrice;
        const nearestOption = optionsOfType.reduce((closest: any, current: any) => {
          const closestDiff = Math.abs(closest.strike - targetStrike);
          const currentDiff = Math.abs(current.strike - targetStrike);
          return currentDiff < closestDiff ? current : closest;
        });
        strike = nearestOption.strike;
      } else {
        // Fallback to calculated strike if no options of this type found
        strike = template.type === "call" 
          ? roundStrike(currentPrice, 'up')
          : roundStrike(currentPrice, 'down');
      }
    } else {
      // Fallback to calculated strike if no options chain data
      strike = template.type === "call" 
        ? roundStrike(currentPrice, 'up')
        : roundStrike(currentPrice, 'down');
    }
    
    onAddLeg({
      type: template.type,
      position: template.position,
      strike,
      quantity: 1,
      premium: 3.5,
      expirationDays: 30,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button data-testid="button-add-dropdown">
          <Plus className="h-4 w-4 mr-2" />
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
