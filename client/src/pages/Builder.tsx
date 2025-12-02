import { useState, useEffect, useRef, useMemo } from "react";
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
import { SymbolSearchBar } from "@/components/SymbolSearchBar";
import { ExpirationTimeline } from "@/components/ExpirationTimeline";
import { StrikeLadder } from "@/components/StrikeLadder";
import { PLHeatmap } from "@/components/PLHeatmap";
import { AddLegDropdown } from "@/components/AddLegDropdown";
import { AnalysisTabs } from "@/components/AnalysisTabs";
import { TrendingUp, ChevronDown, BookOpen, FileText, User, LogOut, BarChart3 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { OptionLeg } from "@shared/schema";
import { strategyTemplates } from "@/lib/strategy-templates";
import { useLocation } from "wouter";
import { useStrategyEngine } from "@/hooks/useStrategyEngine";
import { useOptionsChain } from "@/hooks/useOptionsChain";
import { calculateImpliedVolatility } from "@/lib/options-pricing";
import { useAuth } from "@/hooks/useAuth";

export default function Builder() {
  const [, setLocation] = useLocation();
  const [range, setRange] = useState(14);
  const [activeTab, setActiveTab] = useState<"heatmap" | "chart">("heatmap");
  const prevSymbolRef = useRef<{ symbol: string; price: number } | null>(null);
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const {
    symbolInfo,
    setSymbolInfo,
    legs,
    setLegs,
    volatility,
    setVolatility,
    calculatedIV,
    totalGreeks,
    metrics,
    uniqueExpirationDays,
    strikeRange,
    scenarioGrid,
    selectedExpirationDays,
    selectedExpirationDate,
    setSelectedExpiration,
  } = useStrategyEngine(range);

  const volatilityPercent = Math.round(volatility * 100);
  const calculatedIVPercent = Math.round(calculatedIV * 100);
  
  const handleVolatilityChange = (percent: number) => {
    setVolatility(percent / 100);
  };
  
  const handleResetIV = () => {
    setVolatility(calculatedIV);
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
    
    console.log('[AUTO-ADJUST]', {
      prev: prev ? `${prev.symbol} $${prev.price}` : 'null',
      current: `${current.symbol} $${current.price}`,
    });
    
    // On initial mount, just store the current info
    if (!prev) {
      console.log('[AUTO-ADJUST] Initial mount, storing symbol');
      prevSymbolRef.current = current;
      return;
    }
    
    // If symbol hasn't changed, update price but don't adjust strikes
    if (prev.symbol === current.symbol) {
      console.log('[AUTO-ADJUST] Same symbol, skipping');
      prevSymbolRef.current = current;
      return;
    }
    
    // Symbol changed - but wait for valid price before adjusting
    // Don't update prevSymbolRef yet so we can retry when price arrives
    if (!prev.price || !current.price || prev.price <= 0 || current.price <= 0) {
      console.log('[AUTO-ADJUST] Waiting for valid price');
      return; // Don't update prevSymbolRef - wait for valid price
    }
    
    // Now we have: different symbol, valid prices, and legs to adjust
    // User wants strikes adjusted to be "close to current price" - not proportional
    const atmStrike = roundStrike(current.price, 'nearest');
    console.log('[AUTO-ADJUST] Adjusting strikes, ATM:', atmStrike);
    
    // IMPORTANT: Use setLegs with function form to get current legs
    // This avoids stale closure issues when legs is not in dependency array
    setLegs(currentLegs => {
      console.log('[AUTO-ADJUST] Current legs count:', currentLegs.length);
      // Skip if no legs to adjust
      if (currentLegs.length === 0) {
        console.log('[AUTO-ADJUST] No legs, skipping');
        return currentLegs;
      }
      
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

  // Auto-update leg premiums with market data when chain loads or refreshes
  useEffect(() => {
    if (!optionsChainData?.quotes || optionsChainData.quotes.length === 0) {
      return;
    }

    // Calculate days to expiration from selected date
    const calculateDTE = (): number => {
      if (!selectedExpirationDate) return 30;
      const expDate = new Date(selectedExpirationDate);
      const today = new Date();
      const expDateUTC = Date.UTC(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
      const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
      const diffTime = expDateUTC - todayUTC;
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(1, diffDays);
    };

    const daysToExpiration = calculateDTE();

    // Update legs with market prices - skip manually edited legs
    setLegs(currentLegs => {
      let updated = false;
      const newLegs = currentLegs.map(leg => {
        // Skip manually edited legs - respect user's custom price
        if (leg.premiumSource === 'manual') {
          return leg;
        }

        // Find matching market quote (same strike and type)
        const matchingQuote = optionsChainData.quotes.find(
          q => Math.abs(q.strike - leg.strike) < 0.01 && q.side.toLowerCase() === leg.type
        );

        if (matchingQuote) {
          const newPremium = Number(matchingQuote.mid.toFixed(2));
          
          // Only update if price actually changed (avoid unnecessary re-renders)
          if (leg.premium !== newPremium || leg.premiumSource !== 'market') {
            updated = true;
            
            // Calculate IV from market price if not provided by API
            let calculatedIV = matchingQuote.iv;
            if (!calculatedIV && matchingQuote.mid > 0 && symbolInfo?.price) {
              calculatedIV = calculateImpliedVolatility(
                matchingQuote.side as 'call' | 'put',
                symbolInfo.price,
                matchingQuote.strike,
                daysToExpiration,
                matchingQuote.mid
              );
            }
            
            return {
              ...leg,
              premium: newPremium,
              marketQuoteId: matchingQuote.optionSymbol,
              premiumSource: 'market' as const,
              impliedVolatility: calculatedIV,
              expirationDays: daysToExpiration,
            };
          }
        }
        
        return leg;
      });

      return updated ? newLegs : currentLegs;
    });
  }, [optionsChainData, selectedExpirationDate]);

  // Calculate available strikes from market data
  // Use minStrike/maxStrike from API (which includes extrapolated range)
  // and generate full strike array to fill the extrapolated range
  const availableStrikes = useMemo(() => {
    if (!optionsChainData?.quotes || optionsChainData.quotes.length === 0) return null;
    
    const actualStrikes = Array.from(new Set(optionsChainData.quotes.map((q: any) => q.strike))).sort((a, b) => a - b);
    const min = optionsChainData.minStrike;
    const max = optionsChainData.maxStrike;
    
    // If range is extrapolated beyond actual quotes, generate placeholder strikes
    if (actualStrikes.length > 10 && (min < actualStrikes[0] || max > actualStrikes[actualStrikes.length - 1])) {
      // Detect common interval from actual strikes
      const intervals = new Set<number>();
      for (let i = 1; i < Math.min(actualStrikes.length, 20); i++) {
        intervals.add(Number((actualStrikes[i] - actualStrikes[i-1]).toFixed(2)));
      }
      const commonInterval = Array.from(intervals).sort((a, b) => a - b)[0] || 2.5;
      
      // Generate full strike array from min to max
      const fullStrikes = new Set(actualStrikes); // Start with actual strikes
      for (let strike = Math.ceil(min / commonInterval) * commonInterval; strike <= max; strike += commonInterval) {
        fullStrikes.add(Number(strike.toFixed(2)));
      }
      
      return {
        min,
        max,
        strikes: Array.from(fullStrikes).sort((a, b) => a - b),
      };
    }
    
    // No extrapolation needed, use actual strikes
    return {
      min,
      max,
      strikes: actualStrikes,
    };
  }, [optionsChainData]);
  
  // Helper to constrain strike to market limits
  const constrainToMarketLimits = (strike: number): number => {
    if (!availableStrikes) return strike;
    
    // Clamp to min/max range
    if (strike < availableStrikes.min) return availableStrikes.min;
    if (strike > availableStrikes.max) return availableStrikes.max;
    
    // Find nearest available strike
    const nearest = availableStrikes.strikes.reduce((closest: number, current: number) => {
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
        <div className="container mx-auto px-4 md:px-6 flex h-10 items-center justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="flex items-center gap-1.5 cursor-pointer" 
              onClick={() => setLocation("/")}
            >
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold">OptionFlow</span>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-sm" data-testid="button-build-menu">
                    Build
                    <ChevronDown className="ml-1 h-3 w-3" />
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

              <Button variant="ghost" size="sm" className="h-7 px-2 text-sm" data-testid="button-optimize">
                Optimize
              </Button>

              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2 text-sm" 
                onClick={() => setLocation("/backtest")}
                data-testid="button-backtest"
              >
                <BarChart3 className="h-3 w-3 mr-1" />
                Backtest
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-sm" data-testid="button-market-trends">
                    Market Trends
                    <ChevronDown className="ml-1 h-3 w-3" />
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

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" data-testid="button-tutorials">
              <BookOpen className="h-3 w-3 mr-1" />
              Tutorials
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" data-testid="button-blog">
              <FileText className="h-3 w-3 mr-1" />
              Blog
            </Button>
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" data-testid="button-user-menu">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={user?.profileImageUrl ?? undefined} className="object-cover" />
                      <AvatarFallback className="text-[10px]">
                        {user?.firstName?.[0] ?? user?.email?.[0]?.toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline">{user?.firstName ?? "Account"}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                    {user?.email}
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="/api/logout" className="flex items-center" data-testid="button-logout">
                      <LogOut className="h-3 w-3 mr-2" />
                      Sign Out
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2 text-xs" 
                data-testid="button-sign-in"
                onClick={() => window.location.href = "/api/login"}
              >
                <User className="h-3 w-3 mr-1" />
                Sign In
              </Button>
            )}
            <AddLegDropdown 
              currentPrice={symbolInfo.price} 
              onAddLeg={addLeg}
              optionsChainData={optionsChainData}
            />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 md:px-4 py-2">
        <div className="space-y-2">
          <SymbolSearchBar 
            symbolInfo={symbolInfo} 
            onSymbolChange={setSymbolInfo} 
          />

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
            <div className="lg:col-span-3 space-y-2">
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
                volatility={volatility}
                onUpdateLeg={updateLeg}
                onRemoveLeg={removeLeg}
                optionsChainData={optionsChainData}
                availableStrikes={availableStrikes}
              />

              {activeTab === "heatmap" ? (
                <PLHeatmap
                  grid={scenarioGrid.grid}
                  strikes={scenarioGrid.strikes}
                  days={scenarioGrid.days}
                  currentPrice={symbolInfo.price}
                  useHours={scenarioGrid.useHours}
                  targetDays={scenarioGrid.targetDays}
                  dateGroups={scenarioGrid.dateGroups}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  range={range}
                  onRangeChange={setRange}
                  impliedVolatility={volatilityPercent}
                  onVolatilityChange={handleVolatilityChange}
                  calculatedIV={calculatedIVPercent}
                  onResetIV={handleResetIV}
                />
              ) : (
                <ProfitLossChart 
                  legs={legs} 
                  underlyingPrice={symbolInfo.price}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  range={range}
                  onRangeChange={setRange}
                  impliedVolatility={volatilityPercent}
                  onVolatilityChange={handleVolatilityChange}
                  calculatedIV={calculatedIVPercent}
                  onResetIV={handleResetIV}
                />
              )}

              <AnalysisTabs 
                greeks={totalGreeks}
                symbol={symbolInfo.symbol}
                currentPrice={symbolInfo.price}
                volatility={volatility}
                expirationDate={selectedExpirationDate}
                optionsChainData={optionsChainData}
              />
            </div>

            <div className="space-y-2">
              <StrategyMetricsCard metrics={metrics} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
