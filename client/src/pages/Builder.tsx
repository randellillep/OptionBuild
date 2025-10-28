import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfitLossChart } from "@/components/ProfitLossChart";
import { GreeksDashboard } from "@/components/GreeksDashboard";
import { StrategyMetricsCard } from "@/components/StrategyMetricsCard";
import { OptionLegEditor } from "@/components/OptionLegEditor";
import { StrategyTemplateCard } from "@/components/StrategyTemplateCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TrendingUp, Plus, Home } from "lucide-react";
import type { OptionLeg, Greeks } from "@shared/schema";
import { calculateGreeks, calculateStrategyMetrics } from "@/lib/options-pricing";
import { strategyTemplates } from "@/lib/strategy-templates";
import { useLocation } from "wouter";

export default function Builder() {
  const [, setLocation] = useLocation();
  const [underlyingPrice, setUnderlyingPrice] = useState(100);
  const [legs, setLegs] = useState<OptionLeg[]>([
    {
      id: "1",
      type: "call",
      position: "long",
      strike: 105,
      quantity: 1,
      premium: 3.5,
      expirationDays: 30,
    },
  ]);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  const addLeg = () => {
    const newLeg: OptionLeg = {
      id: Date.now().toString(),
      type: "call",
      position: "long",
      strike: underlyingPrice,
      quantity: 1,
      premium: 5.0,
      expirationDays: 30,
    };
    setLegs([...legs, newLeg]);
  };

  const updateLeg = (id: string, updatedLeg: OptionLeg) => {
    setLegs(legs.map((leg) => (leg.id === id ? updatedLeg : leg)));
  };

  const removeLeg = (id: string) => {
    if (legs.length > 1) {
      setLegs(legs.filter((leg) => leg.id !== id));
    }
  };

  const loadTemplate = (templateIndex: number) => {
    const template = strategyTemplates[templateIndex];
    setLegs(template.legs.map(leg => ({ ...leg, id: Date.now().toString() + leg.id })));
    setTemplateDialogOpen(false);
  };

  const totalGreeks: Greeks = legs.reduce(
    (acc, leg) => {
      const legGreeks = calculateGreeks(leg, underlyingPrice);
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

  const metrics = calculateStrategyMetrics(legs, underlyingPrice);

  const getRiskLevel = (legCount: number): "Low" | "Medium" | "High" => {
    if (legCount === 1) return "Medium";
    if (legCount === 2) return "Low";
    return "High";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 md:px-6 flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-home"
            >
              <Home className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">OptionFlow Builder</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-load-template">
                  Load Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Choose a Strategy Template</DialogTitle>
                  <DialogDescription>
                    Select from {strategyTemplates.length} pre-built options strategies
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {strategyTemplates.map((template, idx) => (
                    <StrategyTemplateCard
                      key={idx}
                      name={template.name}
                      description={template.description}
                      legCount={template.legs.length}
                      riskLevel={getRiskLevel(template.legs.length)}
                      onSelect={() => loadTemplate(idx)}
                    />
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ProfitLossChart legs={legs} underlyingPrice={underlyingPrice} />

            <GreeksDashboard greeks={totalGreeks} />
          </div>

          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Underlying Asset</h3>
              <div>
                <Label htmlFor="underlying-price">Current Price</Label>
                <Input
                  id="underlying-price"
                  type="number"
                  value={underlyingPrice}
                  onChange={(e) => setUnderlyingPrice(Number(e.target.value))}
                  className="font-mono"
                  step="0.5"
                  data-testid="input-underlying-price"
                />
              </div>
            </Card>

            <StrategyMetricsCard metrics={metrics} />
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Option Legs</h3>
            <Button onClick={addLeg} data-testid="button-add-leg">
              <Plus className="h-4 w-4 mr-2" />
              Add Leg
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {legs.map((leg) => (
              <OptionLegEditor
                key={leg.id}
                leg={leg}
                onUpdate={(updatedLeg) => updateLeg(leg.id, updatedLeg)}
                onRemove={() => removeLeg(leg.id)}
                underlyingPrice={underlyingPrice}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
