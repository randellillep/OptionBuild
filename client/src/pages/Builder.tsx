import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfitLossChart } from "@/components/ProfitLossChart";
import { GreeksDashboard } from "@/components/GreeksDashboard";
import { StrategyMetricsCard } from "@/components/StrategyMetricsCard";
import { OptionLegEditor } from "@/components/OptionLegEditor";
import { StrategyTemplateCard } from "@/components/StrategyTemplateCard";
import { SymbolSearchBar } from "@/components/SymbolSearchBar";
import { ExpirationTimeline } from "@/components/ExpirationTimeline";
import { StrikeLadder } from "@/components/StrikeLadder";
import { PLHeatmap } from "@/components/PLHeatmap";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Plus, Home, BarChart3, Table } from "lucide-react";
import type { OptionLeg } from "@shared/schema";
import { strategyTemplates } from "@/lib/strategy-templates";
import { useLocation } from "wouter";
import { useStrategyEngine } from "@/hooks/useStrategyEngine";

export default function Builder() {
  const [, setLocation] = useLocation();
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  
  const {
    symbolInfo,
    setSymbolInfo,
    legs,
    setLegs,
    totalGreeks,
    metrics,
    uniqueExpirationDays,
    strikeRange,
    scenarioGrid,
    selectedExpirationDays,
    setSelectedExpirationDays,
  } = useStrategyEngine();

  const addLeg = () => {
    const newLeg: OptionLeg = {
      id: Date.now().toString(),
      type: "call",
      position: "long",
      strike: symbolInfo.price,
      quantity: 1,
      premium: 5.0,
      expirationDays: uniqueExpirationDays[0] || 30,
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
        <div className="space-y-6">
          <SymbolSearchBar 
            symbolInfo={symbolInfo} 
            onSymbolChange={setSymbolInfo} 
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <ExpirationTimeline
                expirationDays={uniqueExpirationDays}
                selectedDays={selectedExpirationDays}
                onSelectDays={setSelectedExpirationDays}
              />

              <StrikeLadder
                legs={legs}
                currentPrice={symbolInfo.price}
                strikeRange={strikeRange}
              />

              <Tabs defaultValue="chart" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="chart" data-testid="tab-chart">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    P/L Chart
                  </TabsTrigger>
                  <TabsTrigger value="heatmap" data-testid="tab-heatmap">
                    <Table className="h-4 w-4 mr-2" />
                    Heatmap
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="chart" className="mt-4">
                  <ProfitLossChart legs={legs} underlyingPrice={symbolInfo.price} />
                </TabsContent>
                <TabsContent value="heatmap" className="mt-4">
                  <PLHeatmap
                    grid={scenarioGrid.grid}
                    strikes={scenarioGrid.strikes}
                    days={scenarioGrid.days}
                    currentPrice={symbolInfo.price}
                  />
                </TabsContent>
              </Tabs>

              <GreeksDashboard greeks={totalGreeks} />
            </div>

            <div className="space-y-6">
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
                  underlyingPrice={symbolInfo.price}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
