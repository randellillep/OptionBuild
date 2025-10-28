import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface PricingCardProps {
  name: string;
  price: string;
  period?: string;
  features: string[];
  isFeatured?: boolean;
  onSelect: () => void;
}

export function PricingCard({
  name,
  price,
  period = "month",
  features,
  isFeatured = false,
  onSelect,
}: PricingCardProps) {
  return (
    <Card
      className={`p-6 ${isFeatured ? "border-primary border-2 relative" : ""}`}
    >
      {isFeatured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
            Most Popular
          </span>
        </div>
      )}

      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold mb-2">{name}</h3>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-4xl font-bold">{price}</span>
          {price !== "Free" && (
            <span className="text-muted-foreground">/{period}</span>
          )}
        </div>
      </div>

      <ul className="space-y-3 mb-6">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <Check className="h-5 w-5 text-green-600 dark:text-green-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        className="w-full"
        variant={isFeatured ? "default" : "outline"}
        onClick={onSelect}
        data-testid={`button-select-${name.toLowerCase()}`}
      >
        Get Started
      </Button>
    </Card>
  );
}
