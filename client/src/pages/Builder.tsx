import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfitLossChart } from "@/components/ProfitLossChart";
import { StrategyMetricsCard } from "@/components/StrategyMetricsCard";
import { OptionLegEditor } from "@/components/OptionLegEditor";
import { SymbolSearchBar } from "@/components/SymbolSearchBar";
import { ExpirationTimeline } from "@/components/ExpirationTimeline";
import { StrikeLadder } from "@/components/StrikeLadder";
import { PLHeatmap } from "@/components/PLHeatmap";
import { AddLegDropdown } from "@/components/AddLegDropdown";
import { RangeVolatilitySliders } from "@/components/RangeVolatilitySliders";
import { AnalysisTabs } from "@/components/AnalysisTabs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, ChevronDown, BarChart3, Table, BookOpen, FileText, User, DollarSign } from "lucide-react";
import type { OptionLeg } from "@shared/schema";
import { strategyTemplates } from "@/lib/strategy-templates";
import { useLocation } from "wouter";
import { useStrategyEngine } from "@/hooks/useStrategyEngine";
import { useOptionsChain } from "@/hooks/useOptionsChain";
import { OptionsChainTable } from "@/components/OptionsChainTable";

export default function Builder() {
  const [, setLocation] = useLocation();
  const [range, setRange] = useState(14);
  
  const {
    symbolInfo,
    setSymbolInfo,
    legs,
    setLegs,
    volatility,
    setVolatility,
    totalGreeks,
    metrics,
    uniqueExpirationDays,
    strikeRange,
    scenarioGrid,
    selectedExpirationDays,
    selectedExpirationDate,
    setSelectedExpiration,
  } = useStrategyEngine();

  const volatilityPercent = Math.round(volatility * 100);
  const handleVolatilityChange = (percent: number) => {
    setVolatility(percent / 100);
  };

  const { data: optionsChainData, isLoading: isLoadingChain, error: chainError } = useOptionsChain({
    symbol: symbolInfo.symbol,
    expiration: selectedExpirationDate || undefined,
    enabled: !!symbolInfo.symbol && !!selectedExpirationDate,
  });

  const addLeg = (legTemplate: Omit<OptionLeg, "id">) => {
    const newLeg: OptionLeg = {
      ...legTemplate,
      id: Date.now().toString(),
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
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 md:px-6 flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <div 
              className="flex items-center gap-2 cursor-pointer" 
              onClick={() => setLocation("/")}
            >
              <TrendingUp className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">OptionFlow</span>
            </div>

            <nav className="hidden md:flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" data-testid="button-build-menu">
                    Build
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {strategyTemplates.slice(0, 10).map((template, idx) => (
                    <DropdownMenuItem
                      key={idx}
                      onClick={() => loadTemplate(idx)}
                      data-testid={`menu-strategy-${template.name.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <div>
                        <div className="font-medium">{template.name}</div>
                        <div className="text-xs text-muted-foreground">{template.description.substring(0, 50)}...</div>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="ghost" data-testid="button-optimize">
                Optimize
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" data-testid="button-market-trends">
                    Market Trends
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem data-testid="menu-market-movers">
                    Market Movers
                  </DropdownMenuItem>
                  <DropdownMenuItem data-testid="menu-earnings-calendar">
                    Earnings Calendar
                  </DropdownMenuItem>
                  <DropdownMenuItem data-testid="menu-volatility-leaders">
                    Volatility Leaders
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" data-testid="button-tutorials">
              <BookOpen className="h-4 w-4 mr-2" />
              Tutorials
            </Button>
            <Button variant="ghost" size="sm" data-testid="button-blog">
              <FileText className="h-4 w-4 mr-2" />
              Blog
            </Button>
            <Button variant="ghost" size="sm" data-testid="button-my-account">
              <User className="h-4 w-4 mr-2" />
              My Account
            </Button>
            <AddLegDropdown currentPrice={symbolInfo.price} onAddLeg={addLeg} />
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
                onSelectDays={setSelectedExpiration}
                symbol={symbolInfo.symbol}
              />

              <StrikeLadder
                legs={legs}
                currentPrice={symbolInfo.price}
                strikeRange={strikeRange}
              />

              <Tabs defaultValue="heatmap" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="heatmap" data-testid="tab-heatmap-view">
                    <Table className="h-4 w-4 mr-2" />
                    Heatmap
                  </TabsTrigger>
                  <TabsTrigger value="chart" data-testid="tab-chart-view">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    P/L Chart
                  </TabsTrigger>
                  <TabsTrigger value="chain" data-testid="tab-chain-view">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Options Chain
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="heatmap" className="mt-4 space-y-6">
                  <PLHeatmap
                    grid={scenarioGrid.grid}
                    strikes={scenarioGrid.strikes}
                    days={scenarioGrid.days}
                    currentPrice={symbolInfo.price}
                    rangePercent={range}
                  />
                  
                  <RangeVolatilitySliders
                    range={range}
                    onRangeChange={setRange}
                    impliedVolatility={volatilityPercent}
                    onVolatilityChange={handleVolatilityChange}
                  />

                  <AnalysisTabs greeks={totalGreeks} />
                </TabsContent>
                <TabsContent value="chart" className="mt-4 space-y-6">
                  <ProfitLossChart legs={legs} underlyingPrice={symbolInfo.price} />
                  
                  <RangeVolatilitySliders
                    range={range}
                    onRangeChange={setRange}
                    impliedVolatility={volatilityPercent}
                    onVolatilityChange={handleVolatilityChange}
                  />

                  <AnalysisTabs greeks={totalGreeks} />
                </TabsContent>
                <TabsContent value="chain" className="mt-4 space-y-6">
                  {!selectedExpirationDate ? (
                    <div className="flex items-center justify-center p-12">
                      <div className="text-center space-y-2">
                        <div className="text-lg font-semibold">Select an expiration date</div>
                        <div className="text-sm text-muted-foreground">
                          Choose an expiration date above to view real market options data
                        </div>
                      </div>
                    </div>
                  ) : chainError ? (
                    <div className="flex items-center justify-center p-12">
                      <div className="text-center space-y-2">
                        <div className="text-lg font-semibold text-destructive">Error loading options chain</div>
                        <div className="text-sm text-muted-foreground">
                          {chainError instanceof Error ? chainError.message : 'Failed to fetch market data'}
                        </div>
                      </div>
                    </div>
                  ) : isLoadingChain ? (
                    <div className="flex items-center justify-center p-12">
                      <div className="text-center space-y-2">
                        <div className="text-lg font-semibold">Loading market data...</div>
                        <div className="text-sm text-muted-foreground">Fetching real options prices and Greeks for {symbolInfo.symbol}</div>
                      </div>
                    </div>
                  ) : optionsChainData && optionsChainData.quotes.length > 0 ? (
                    <OptionsChainTable
                      quotes={optionsChainData.quotes}
                      onSelectOption={(quote) => {
                        const newLeg: OptionLeg = {
                          id: Date.now().toString(),
                          type: quote.side,
                          position: "long",
                          strike: quote.strike,
                          quantity: 1,
                          premium: quote.mid,
                          expirationDays: quote.dte,
                          marketQuoteId: quote.optionSymbol,
                          premiumSource: "market",
                          impliedVolatility: quote.iv,
                        };
                        setLegs([...legs, newLeg]);
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center p-12">
                      <div className="text-center space-y-2">
                        <div className="text-lg font-semibold">No options data available</div>
                        <div className="text-sm text-muted-foreground">
                          No options contracts found for {symbolInfo.symbol} expiring on {selectedExpirationDate}
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            <div className="space-y-6">
              <StrategyMetricsCard metrics={metrics} />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Option Legs</h3>
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
    </div>
  );
}
