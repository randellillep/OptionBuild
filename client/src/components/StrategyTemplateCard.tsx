import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StrategyTemplateCardProps {
  name: string;
  description: string;
  legCount: number;
  riskLevel: "Low" | "Medium" | "High";
  onSelect: () => void;
}

export function StrategyTemplateCard({
  name,
  description,
  legCount,
  riskLevel,
  onSelect,
}: StrategyTemplateCardProps) {
  const riskColors = {
    Low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    Medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    High: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  const icons = {
    Low: Minus,
    Medium: TrendingUp,
    High: TrendingUp,
  };

  const Icon = icons[riskLevel];

  return (
    <Card className="p-6 hover-elevate active-elevate-2 transition-all cursor-pointer" onClick={onSelect}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-1">{name}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Badge variant="secondary" className="text-xs">
          {legCount} {legCount === 1 ? "Leg" : "Legs"}
        </Badge>
        <Badge className={`text-xs ${riskColors[riskLevel]}`}>
          <Icon className="h-3 w-3 mr-1" />
          {riskLevel} Risk
        </Badge>
      </div>

      <Button
        className="w-full"
        variant="outline"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        data-testid={`button-select-${name.toLowerCase().replace(/\s+/g, "-")}`}
      >
        Build This Strategy
      </Button>
    </Card>
  );
}
