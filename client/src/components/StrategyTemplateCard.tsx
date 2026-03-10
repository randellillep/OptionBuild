import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";

interface StrategyTemplateCardProps {
  name: string;
  description: string;
  legCount: number;
  riskLevel: "Low" | "Medium" | "High";
  sentiment?: string;
  onSelect: () => void;
}

export function StrategyTemplateCard({
  name,
  description,
  legCount,
  riskLevel,
  sentiment,
  onSelect,
}: StrategyTemplateCardProps) {
  const riskColors = {
    Low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    Medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    High: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  const sentimentIcon = sentiment === "bearish" ? TrendingDown : sentiment === "neutral" ? Minus : TrendingUp;
  const SentimentIcon = sentimentIcon;

  return (
    <Card className="p-5 hover-elevate active-elevate-2 transition-all cursor-pointer flex flex-col" onClick={onSelect}>
      <div className="flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-base">{name}</h3>
          <SentimentIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {description}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            {legCount} {legCount === 1 ? "Leg" : "Legs"}
          </Badge>
          <Badge className={`text-xs ${riskColors[riskLevel]}`}>
            {riskLevel} Risk
          </Badge>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    </Card>
  );
}
