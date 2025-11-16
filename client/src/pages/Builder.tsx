import { useState, useEffect, useRef } from "react";
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
  const prevSymbolRef = useRef<{ symbol: string; price: number } | null>(null);
  
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

  // Helper to round strike to valid increments
  const roundStrike = (strike: number, direction: 'up' | 'down' | 'nearest' = 'nearest'): number => {
    let increment: number;
    if (strike < 25) increment = 0.5;
    else if (strike < 100) increment = 1;
    else if (strike < 200) increment = 2.5;
    else increment = 5;
    
    if (direction === 'up') {
      return Math.ceil(strike / increment) * increment;
    } else if (direction === 'down') {
      return Math.floor(strike / increment) * increment;
    } else {
      return Math.round(strike / increment) * increment;
    }
  };

  // Auto-adjust strategy strikes when symbol changes
  useEffect(() => {
    const prev = prevSymbolRef.current;
    const current = symbolInfo;
    
    // On initial mount, just store the current info
    if (!prev) {
      prevSymbolRef.current = current;
      return;
    }
    
    // If symbol hasn't changed, update price but don't adjust strikes
    if (prev.symbol === current.symbol) {
      prevSymbolRef.current = current;
      return;
    }
    
    // Symbol changed - but wait for valid price before adjusting
    // Don't update prevSymbolRef yet so we can retry when price arrives
    if (!prev.price || !current.price || prev.price <= 0 || current.price <= 0) {
      return; // Don't update prevSymbolRef - wait for valid price
    }
    
    // Now we have: different symbol, valid prices, and legs to adjust
    // User wants strikes adjusted to be "close to current price" - not proportional
    const atmStrike = roundStrike(current.price, 'nearest');
    
    // IMPORTANT: Use setLegs with function form to get current legs
    // This avoids stale closure issues when legs is not in dependency array
    setLegs(currentLegs => {
      // Skip if no legs to adjust
      if (currentLegs.length === 0) return currentLegs;
      
      const adjustedLegs = currentLegs.map((leg, index) => {
        // Reset all strikes to be close to the new ATM price
        // Spread them slightly based on their relative position in the original strategy
        let newStrike: number;
        
        if (currentLegs.length === 1) {
          // Single leg - just use ATM
          newStrike = atmStrike;
        } else {
          // Multiple legs - maintain relative spacing
          // Determine if this was a higher or lower strike in the original strategy
          const avgStrike = currentLegs.reduce((sum, l) => sum + l.strike, 0) / currentLegs.length;
          const relativePosition = (leg.strike - avgStrike) / prev.price; // as percentage
          
          // Apply small offset from ATM
          const offset = relativePosition * current.price;
          const targetStrike = atmStrike + offset;
          
          // Round based on option type for proper spacing
          const direction = leg.type === 'call' && offset > 0 ? 'up' : 
                           leg.type === 'put' && offset < 0 ? 'down' : 'nearest';
          newStrike = roundStrike(targetStrike, direction);
        }
        
        return {
          ...leg,
          strike: newStrike,
          // Reset premium source to theoretical since we changed the strike
          premiumSource: 'theoretical' as const,
        };
      });
      
      return adjustedLegs;
    });
    
    // Only update prevSymbolRef after successful adjustment
    prevSymbolRef.current = current;
  }, [symbolInfo.symbol, symbolInfo.price]);

  const { data: optionsChainData, isLoading: isLoadingChain, error: chainError } = useOptionsChain({
    symbol: symbolInfo.symbol,
    expiration: selectedExpirationDate || undefined,
    enabled: !!symbolInfo.symbol && !!selectedExpirationDate,
  });

  // Calculate available strikes from market data
  const availableStrikes = (optionsChainData?.quotes && optionsChainData.quotes.length > 0)
    ? {
        min: Math.min(...optionsChainData.quotes.map((q: any) => q.strike)),
        max: Math.max(...optionsChainData.quotes.map((q: any) => q.strike)),
        strikes: Array.from(new Set(optionsChainData.quotes.map((q: any) => q.strike))).sort((a, b) => a - b),
      }
    : null;
  
  // Helper to constrain strike to market limits
  const constrainToMarketLimits = (strike: number): number => {
    if (!availableStrikes) return strike;
    
    // Clamp to min/max range
    if (strike < availableStrikes.min) return availableStrikes.min;
    if (strike > availableStrikes.max) return availableStrikes.max;
    
    // Find nearest available strike
    const nearest = availableStrikes.strikes.reduce((closest, current) => {
      return Math.abs(current - strike) < Math.abs(closest - strike) ? current : closest;
    });
    
    return nearest;
  };
  
  // Constrain existing strikes when new options chain data loads
  useEffect(() => {
    if (!availableStrikes || legs.length === 0) return;
    
    // Check if any strikes are outside market limits
    const hasOutOfBoundsStrikes = legs.some(
      leg => leg.strike < availableStrikes.min || leg.strike > availableStrikes.max
    );
    
    if (hasOutOfBoundsStrikes) {
      const constrainedLegs = legs.map(leg => ({
        ...leg,
        strike: constrainToMarketLimits(leg.strike),
        // Reset premium source since we changed the strike
        premiumSource: 'theoretical' as const,
      }));
      setLegs(constrainedLegs);
    }
  }, [availableStrikes?.min, availableStrikes?.max, legs.length]);

  // Constrain strike range to available strikes when market data exists
  const displayStrikeRange = availableStrikes
    ? {
        min: availableStrikes.min,
        max: availableStrikes.max,
      }
    : strikeRange;

  const addLeg = (legTemplate: Omit<OptionLeg, "id">) => {
    const newLeg: OptionLeg = {
      ...legTemplate,
      id: Date.now().toString(),
    };
    setLegs([...legs, newLeg]);
  };

  const updateLeg = (id: string, updates: Partial<OptionLeg>) => {
    setLegs(legs.map((leg) => (leg.id === id ? { ...leg, ...updates } : leg)));
  };

  const removeLeg = (id: string) => {
    if (legs.length > 1) {
      setLegs(legs.filter((leg) => leg.id !== id));
    }
  };

  const loadTemplate = (templateIndex: number) => {
    const template = strategyTemplates[templateIndex];
    const currentPrice = symbolInfo.price;
    
    // Validate price before proceeding
    if (!currentPrice || !isFinite(currentPrice) || currentPrice <= 0) {
      // Fallback to template's original strikes if no valid price
      setLegs(template.legs.map(leg => ({ ...leg, id: Date.now().toString() + leg.id })));
      return;
    }
    
    // Calculate ATM strike
    const atmStrike = roundStrike(currentPrice, 'nearest');
    
    // Map template legs to current price-relative strikes
    const adjustedLegs = template.legs.map((leg, index) => {
      let newStrike = atmStrike;
      
      // Strategy-specific strike adjustments
      switch (template.name) {
        case "Long Call":
          newStrike = atmStrike; // ATM
          break;
        case "Long Put":
          newStrike = atmStrike; // ATM
          break;
        case "Covered Call":
          newStrike = roundStrike(currentPrice * 1.05, 'up'); // 5% OTM (round up)
          break;
        case "Protective Put":
          newStrike = roundStrike(currentPrice * 0.95, 'down'); // 5% OTM (round down)
          break;
        case "Bull Call Spread":
          newStrike = index === 0 ? atmStrike : roundStrike(currentPrice * 1.05, 'up'); // ATM + 5% OTM
          break;
        case "Bear Put Spread":
          newStrike = index === 0 ? atmStrike : roundStrike(currentPrice * 0.95, 'down'); // ATM + 5% OTM (matched to bull spread)
          break;
        case "Long Straddle":
          newStrike = atmStrike; // Both at ATM
          break;
        case "Long Strangle":
          newStrike = leg.type === "call" ? roundStrike(currentPrice * 1.05, 'up') : roundStrike(currentPrice * 0.95, 'down');
          break;
        case "Iron Condor":
          // Short put, long put, short call, long call
          if (index === 0) newStrike = roundStrike(currentPrice * 0.95, 'down'); // Short put -5%
          else if (index === 1) newStrike = roundStrike(currentPrice * 0.90, 'down'); // Long put -10%
          else if (index === 2) newStrike = roundStrike(currentPrice * 1.05, 'up'); // Short call +5%
          else if (index === 3) newStrike = roundStrike(currentPrice * 1.10, 'up'); // Long call +10%
          break;
        case "Butterfly Spread":
          // Low wing, body (2x), high wing
          if (index === 0) newStrike = roundStrike(currentPrice * 0.95, 'down'); // -5%
          else if (index === 1) newStrike = atmStrike; // ATM
          else if (index === 2) newStrike = roundStrike(currentPrice * 1.05, 'up'); // +5%
          break;
      }
      
      return {
        ...leg,
        strike: newStrike,
        id: Date.now().toString() + leg.id + index,
      };
    });
    
    setLegs(adjustedLegs);
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
            <AddLegDropdown 
              currentPrice={symbolInfo.price} 
              onAddLeg={addLeg}
              optionsChainData={optionsChainData}
            />
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
                strikeRange={displayStrikeRange}
                symbol={symbolInfo.symbol}
                expirationDate={selectedExpirationDate}
                onUpdateLeg={updateLeg}
                onRemoveLeg={removeLeg}
                optionsChainData={optionsChainData}
                availableStrikes={availableStrikes}
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
