import { Card } from "@/components/ui/card";
import type { Greeks } from "@shared/schema";
import { TrendingUp, TrendingDown, Activity, Zap, DollarSign } from "lucide-react";

interface GreeksDashboardProps {
  greeks: Greeks;
}

export function GreeksDashboard({ greeks }: GreeksDashboardProps) {
  const greekCards = [
    {
      name: "Delta",
      value: greeks.delta,
      icon: TrendingUp,
      description: "Price sensitivity",
      color: "text-blue-600 dark:text-blue-500",
    },
    {
      name: "Gamma",
      value: greeks.gamma,
      icon: Activity,
      description: "Delta change rate",
      color: "text-purple-600 dark:text-purple-500",
    },
    {
      name: "Theta",
      value: greeks.theta,
      icon: TrendingDown,
      description: "Time decay",
      color: "text-orange-600 dark:text-orange-500",
    },
    {
      name: "Vega",
      value: greeks.vega,
      icon: Zap,
      description: "Volatility sensitivity",
      color: "text-green-600 dark:text-green-500",
    },
    {
      name: "Rho",
      value: greeks.rho,
      icon: DollarSign,
      description: "Interest rate sensitivity",
      color: "text-red-600 dark:text-red-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {greekCards.map((greek) => (
        <Card key={greek.name} className="p-4">
          <div className="flex items-start justify-between mb-2">
            <greek.icon className={`h-5 w-5 ${greek.color}`} />
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold font-mono tabular-nums">
              {greek.value.toFixed(3)}
            </p>
            <p className="text-sm font-semibold">{greek.name}</p>
            <p className="text-xs text-muted-foreground">{greek.description}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
