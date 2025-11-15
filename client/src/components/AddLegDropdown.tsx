import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus } from "lucide-react";
import type { OptionLeg } from "@shared/schema";

interface AddLegDropdownProps {
  currentPrice: number;
  onAddLeg: (leg: Omit<OptionLeg, "id">) => void;
  onOpenDetails?: (leg: OptionLeg) => void;
}

export function AddLegDropdown({ currentPrice, onAddLeg, onOpenDetails }: AddLegDropdownProps) {
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
    // Calculate ATM strike with proper rounding
    const strike = template.type === "call" 
      ? roundStrike(currentPrice, 'up')
      : roundStrike(currentPrice, 'down');
    
    const newLeg: OptionLeg = {
      id: Date.now().toString(),
      type: template.type,
      position: template.position,
      strike,
      quantity: 1,
      premium: 3.5,
      expirationDays: 30,
    };

    // If onOpenDetails is provided, open the details panel instead of directly adding
    if (onOpenDetails) {
      onOpenDetails(newLeg);
    } else {
      // Fallback to direct add
      onAddLeg(newLeg);
    }
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
