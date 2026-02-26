import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  Play, 
  Plus,
  Trash2,
  TrendingUp, 
  TrendingDown,
  BarChart3,
  Clock,
  DollarSign,
  Target,
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  FileText,
  History,
  RefreshCw,
  Settings,
  Info,
  X,
  Search,
  Loader2,
  CalendarIcon
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart,
  Legend,
  ComposedChart,
  Bar
} from "recharts";
import { apiRequest } from "@/lib/queryClient";
import type { 
  BacktestConfigData, 
  BacktestLegConfig,
  BacktestRunResult 
} from "@shared/schema";

type BacktestRunWithMeta = BacktestRunResult & {
  id: string;
  status: "pending" | "running" | "completed" | "error";
  progress: number;
  config: BacktestConfigData;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
};

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

function getDefaultLeg(): BacktestLegConfig {
  return {
    id: generateId(),
    direction: "sell",
    optionType: "put",
    quantity: 1,
    strikeSelection: "percentOTM",
    strikeValue: 5,
    dte: 45,
  };
}

function getDefaultConfig(): BacktestConfigData {
  // Use a reliable historical date range with known data availability
  // End date defaults to today
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  return {
    symbol: "AAPL",
    startDate: format(oneYearAgo, "yyyy-MM-dd"),
    endDate: format(today, "yyyy-MM-dd"),
    legs: [getDefaultLeg()],
    entryConditions: {
      frequency: "everyDay",
      maxActiveTrades: undefined,
      specificDays: [1, 2, 3, 4, 5],
    },
    exitConditions: {
      exitAtDTE: 21,
      stopLossPercent: 200,
      takeProfitPercent: 50,
    },
    capitalMethod: "auto",
    feePerContract: 0,
  };
}

interface SearchResult {
  symbol: string;
  name: string;
  displaySymbol: string;
}

function StockSearchInput({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (symbol: string) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: searchResults, isLoading: isSearching } = useQuery<{ results: SearchResult[] }>({
    queryKey: ["/api/stock/search", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch) return { results: [] };
      const response = await fetch(`/api/stock/search?q=${encodeURIComponent(debouncedSearch)}`);
      if (!response.ok) return { results: [] };
      return await response.json();
    },
    enabled: debouncedSearch.length > 0,
    staleTime: 60000,
  });

  const handleSymbolSelect = (symbol: string) => {
    onChange(symbol);
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleButtonClick = () => {
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="relative" ref={searchRef}>
      {!isOpen ? (
        <Button
          type="button"
          variant="outline"
          className="w-full h-9 justify-start font-mono font-semibold"
          onClick={handleButtonClick}
          data-testid="input-backtest-symbol"
        >
          {value}
        </Button>
      ) : (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search stocks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
            className="pl-8 h-9 text-sm"
            data-testid="input-backtest-symbol-search"
          />
          {isSearching && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      {isOpen && (
        <Card className="absolute top-full mt-1 left-0 w-72 z-[100] max-h-64 overflow-y-auto shadow-lg">
          {!searchTerm ? (
            <div className="p-3 text-center text-sm text-muted-foreground">
              Type to search stocks...
            </div>
          ) : isSearching ? (
            <div className="p-3 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
              Searching...
            </div>
          ) : searchResults?.results && searchResults.results.length > 0 ? (
            <div className="p-1.5">
              {searchResults.results.slice(0, 8).map((result) => (
                <button
                  key={result.symbol}
                  type="button"
                  onClick={() => handleSymbolSelect(result.symbol)}
                  className="w-full text-left p-2.5 hover:bg-muted rounded-md transition-colors"
                  data-testid={`button-symbol-${result.symbol.toLowerCase()}`}
                >
                  <div className="font-semibold font-mono text-sm">{result.displaySymbol || result.symbol}</div>
                  <div className="text-xs text-muted-foreground truncate">{result.name}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-3 text-center text-sm text-muted-foreground">
              No stocks found
            </div>
          )}
        </Card>
      )}

    </div>
  );
}

function LegConfig({ 
  leg, 
  index, 
  onChange, 
  onRemove, 
  canRemove,
  allLegs 
}: { 
  leg: BacktestLegConfig; 
  index: number; 
  onChange: (leg: BacktestLegConfig) => void; 
  onRemove: () => void;
  canRemove: boolean;
  allLegs: BacktestLegConfig[];
}) {
  return (
    <div className="p-3 border rounded-lg bg-muted/30">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider hidden sm:block w-16">Direction</div>
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider hidden sm:block w-16">Type</div>
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider hidden sm:block w-20">Quantity</div>
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider hidden sm:block flex-1">Strike Selection</div>
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider hidden sm:block w-20">Expiration</div>
        <div className="w-16"></div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <div className="flex gap-1">
          <button
            type="button"
            className={`h-8 px-3 text-xs font-medium rounded-md transition-colors ${
              leg.direction === "buy" 
                ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-secondary-border"
            }`}
            onClick={() => onChange({ ...leg, direction: "buy" })}
            data-testid={`button-leg-${index}-buy`}
          >
            Buy
          </button>
          <button
            type="button"
            className={`h-8 px-3 text-xs font-medium rounded-md transition-colors ${
              leg.direction === "sell" 
                ? "bg-red-600 text-white hover:bg-red-700" 
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-secondary-border"
            }`}
            onClick={() => onChange({ ...leg, direction: "sell" })}
            data-testid={`button-leg-${index}-sell`}
          >
            Sell
          </button>
        </div>
        
        <div className="flex gap-1">
          <button
            type="button"
            className={`h-8 px-3 text-xs font-medium rounded-md transition-colors ${
              leg.optionType === "call" 
                ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-secondary-border"
            }`}
            onClick={() => onChange({ ...leg, optionType: "call" })}
            data-testid={`button-leg-${index}-call`}
          >
            Call
          </button>
          <button
            type="button"
            className={`h-8 px-3 text-xs font-medium rounded-md transition-colors ${
              leg.optionType === "put" 
                ? "bg-red-600 text-white hover:bg-red-700" 
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-secondary-border"
            }`}
            onClick={() => onChange({ ...leg, optionType: "put" })}
            data-testid={`button-leg-${index}-put`}
          >
            Put
          </button>
        </div>
        
        <div className="flex items-center gap-1 bg-muted rounded-md px-2 h-8">
          <Input
            type="number"
            min={1}
            max={100}
            value={leg.quantity}
            onChange={(e) => onChange({ ...leg, quantity: parseInt(e.target.value) || 1 })}
            className="h-7 w-12 border-0 bg-transparent p-0 text-center text-sm font-medium"
            data-testid={`input-leg-${index}-quantity`}
          />
          <span className="text-xs text-muted-foreground">contract</span>
        </div>
        
        <div className="flex items-center gap-1 bg-muted rounded-md h-8">
          <Input
            type="number"
            step={leg.strikeSelection === "percentOTM" ? 0.5 : 1}
            value={leg.strikeValue}
            onChange={(e) => onChange({ ...leg, strikeValue: parseFloat(e.target.value) || 0 })}
            className="h-7 w-12 border-0 bg-transparent p-0 text-center text-sm font-medium"
            data-testid={`input-leg-${index}-strike-value`}
          />
          <Select 
            value={leg.strikeSelection} 
            onValueChange={(v) => onChange({ ...leg, strikeSelection: v as any })}
          >
            <SelectTrigger className="h-7 w-12 border-0 bg-transparent px-1" data-testid={`select-leg-${index}-strike`}>
              <span className="text-xs">
                {leg.strikeSelection === "percentOTM" ? "%" : "$"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentOTM">% OTM</SelectItem>
              <SelectItem value="priceOffset">$ Offset</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-1 bg-muted rounded-md px-2 h-8">
          <Input
            type="number"
            min={1}
            max={365}
            value={leg.dte}
            onChange={(e) => onChange({ ...leg, dte: parseInt(e.target.value) || 45 })}
            className="h-7 w-12 border-0 bg-transparent p-0 text-center text-sm font-medium"
            data-testid={`input-leg-${index}-dte`}
          />
          <span className="text-xs text-muted-foreground">DTE</span>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          {canRemove && (
            <Button 
              type="button"
              variant="ghost" 
              size="icon" 
              onClick={onRemove}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              data-testid={`button-remove-leg-${index}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function BacktestSetup({ 
  onSubmit, 
  isLoading 
}: { 
  onSubmit: (config: BacktestConfigData) => void; 
  isLoading: boolean;
}) {
  const [config, setConfig] = useState<BacktestConfigData>(getDefaultConfig());

  const updateLeg = (index: number, leg: BacktestLegConfig) => {
    const newLegs = [...config.legs];
    newLegs[index] = leg;
    setConfig({ ...config, legs: newLegs });
  };

  const addLeg = () => {
    if (config.legs.length < 4) {
      setConfig({ ...config, legs: [...config.legs, getDefaultLeg()] });
    }
  };

  const removeLeg = (index: number) => {
    if (config.legs.length > 1) {
      setConfig({ ...config, legs: config.legs.filter((_, i) => i !== index) });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(config);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-2">
          <StockSearchInput
            value={config.symbol}
            onChange={(symbol) => setConfig({ ...config, symbol })}
          />
        </div>
        <Separator orientation="vertical" className="h-6 hidden sm:block" />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-9 gap-2 text-sm"
              data-testid="input-date-range"
            >
              <CalendarIcon className="h-4 w-4" />
              {config.startDate && config.endDate ? (
                <span>
                  {format(new Date(config.startDate), "M/d/yyyy")} - {format(new Date(config.endDate), "M/d/yyyy")}
                </span>
              ) : "Select dates"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="start">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Start Date</Label>
                  <Calendar
                    mode="single"
                    selected={config.startDate ? new Date(config.startDate) : undefined}
                    onSelect={(date) => date && setConfig({ ...config, startDate: format(date, "yyyy-MM-dd") })}
                    data-testid="input-start-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">End Date</Label>
                  <Calendar
                    mode="single"
                    selected={config.endDate ? new Date(config.endDate) : undefined}
                    onSelect={(date) => date && setConfig({ ...config, endDate: format(date, "yyyy-MM-dd") })}
                    data-testid="input-end-date"
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-3">
        {config.legs.map((leg, index) => (
          <LegConfig
            key={leg.id}
            leg={leg}
            index={index}
            onChange={(updatedLeg) => updateLeg(index, updatedLeg)}
            onRemove={() => removeLeg(index)}
            canRemove={config.legs.length > 1}
            allLegs={config.legs}
          />
        ))}
        
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addLeg}
            disabled={config.legs.length >= 4}
            className="gap-1 text-muted-foreground hover:text-foreground"
            data-testid="button-add-leg"
          >
            <Plus className="h-4 w-4" />
            Add Another Leg
          </Button>
          <span className="text-xs text-muted-foreground">Select a different strategy</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Entry Conditions</h3>
          
          <div className="space-y-2">
            <div 
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${config.entryConditions.frequency === 'everyDay' ? 'bg-primary/10 border-primary' : 'bg-muted/30 hover:bg-muted/50'}`}
              onClick={() => setConfig({ ...config, entryConditions: { ...config.entryConditions, frequency: 'everyDay' }})}
              data-testid="option-entry-everyday"
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${config.entryConditions.frequency === 'everyDay' ? 'border-primary' : 'border-muted-foreground'}`}>
                  {config.entryConditions.frequency === 'everyDay' && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div>
                  <p className="text-sm font-medium">Every day</p>
                  <p className="text-xs text-muted-foreground">Enter a new trade every day and choose the closest expirations.</p>
                </div>
              </div>
            </div>
            
            <div 
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${config.entryConditions.frequency === 'specificDays' ? 'bg-primary/10 border-primary' : 'bg-muted/30 hover:bg-muted/50'}`}
              onClick={() => setConfig({ ...config, entryConditions: { ...config.entryConditions, frequency: 'specificDays' }})}
              data-testid="option-entry-specificdays"
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${config.entryConditions.frequency === 'specificDays' ? 'border-primary' : 'border-muted-foreground'}`}>
                  {config.entryConditions.frequency === 'specificDays' && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div>
                  <p className="text-sm font-medium">On specific days of the week</p>
                  <p className="text-xs text-muted-foreground">Enter a new trade on specific days and choose the closest expirations.</p>
                </div>
              </div>
              {config.entryConditions.frequency === 'specificDays' && (
                <div className="flex flex-wrap gap-2 mt-3 ml-7" onClick={(e) => e.stopPropagation()}>
                  {[
                    { day: 1, label: "Mon" },
                    { day: 2, label: "Tue" },
                    { day: 3, label: "Wed" },
                    { day: 4, label: "Thu" },
                    { day: 5, label: "Fri" },
                  ].map(({ day, label }) => {
                    const isSelected = config.entryConditions.specificDays?.includes(day) ?? false;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const currentDays = config.entryConditions.specificDays || [];
                          const newDays = isSelected
                            ? currentDays.filter(d => d !== day)
                            : [...currentDays, day].sort();
                          setConfig({
                            ...config,
                            entryConditions: { ...config.entryConditions, specificDays: newDays }
                          });
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          isSelected 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                        }`}
                        data-testid={`button-day-${label.toLowerCase()}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div 
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${config.entryConditions.frequency === 'exactDTE' ? 'bg-primary/10 border-primary' : 'bg-muted/30 hover:bg-muted/50'}`}
              onClick={() => setConfig({ ...config, entryConditions: { ...config.entryConditions, frequency: 'exactDTE' }})}
              data-testid="option-entry-exactdte"
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${config.entryConditions.frequency === 'exactDTE' ? 'border-primary' : 'border-muted-foreground'}`}>
                  {config.entryConditions.frequency === 'exactDTE' && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div>
                  <p className="text-sm font-medium">On exact DTE match</p>
                  <p className="text-xs text-muted-foreground">Enter a new trade only when the expiration date exactly matches the specified strategy DTEs.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Limit number of active trades</p>
                <p className="text-xs text-muted-foreground">Only have a certain number of trades open at the same time.</p>
              </div>
              <Switch 
                checked={config.entryConditions.maxActiveTrades !== undefined}
                onCheckedChange={(checked) => setConfig({ 
                  ...config, 
                  entryConditions: { ...config.entryConditions, maxActiveTrades: checked ? 1 : undefined } 
                })}
                data-testid="switch-limit-trades"
              />
            </div>
            {config.entryConditions.maxActiveTrades !== undefined && (
              <div className="mt-2">
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={config.entryConditions.maxActiveTrades}
                  onChange={(e) => setConfig({ 
                    ...config, 
                    entryConditions: { ...config.entryConditions, maxActiveTrades: parseInt(e.target.value) || 1 } 
                  })}
                  className="h-8 w-20"
                  data-testid="input-max-trades"
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Exit Conditions</h3>
          
          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Exit at a specific DTE</p>
                <p className="text-xs text-muted-foreground">Exit trades when there is a certain number of days left until expiration.</p>
              </div>
              <Switch 
                checked={config.exitConditions.exitAtDTE !== undefined}
                onCheckedChange={(checked) => setConfig({ 
                  ...config, 
                  exitConditions: { ...config.exitConditions, exitAtDTE: checked ? 21 : undefined } 
                })}
                data-testid="switch-exit-dte"
              />
            </div>
            {config.exitConditions.exitAtDTE !== undefined && (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={config.exitConditions.exitAtDTE}
                  onChange={(e) => setConfig({ 
                    ...config, 
                    exitConditions: { ...config.exitConditions, exitAtDTE: parseInt(e.target.value) || 0 } 
                  })}
                  className="h-8 w-20"
                  data-testid="input-exit-dte"
                />
                <span className="text-xs text-muted-foreground">DTE</span>
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Exit after days in trade</p>
                <p className="text-xs text-muted-foreground">Exit trades after being open for a certain number of days.</p>
              </div>
              <Switch 
                checked={config.exitConditions.exitAfterDays !== undefined}
                onCheckedChange={(checked) => setConfig({ 
                  ...config, 
                  exitConditions: { ...config.exitConditions, exitAfterDays: checked ? 7 : undefined } 
                })}
                data-testid="switch-exit-after-days"
              />
            </div>
            {config.exitConditions.exitAfterDays !== undefined && (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={config.exitConditions.exitAfterDays}
                  onChange={(e) => setConfig({ 
                    ...config, 
                    exitConditions: { ...config.exitConditions, exitAfterDays: parseInt(e.target.value) || 1 } 
                  })}
                  className="h-8 w-20"
                  data-testid="input-exit-after-days"
                />
                <span className="text-xs text-muted-foreground">days</span>
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Stop loss at % of premium</p>
                <p className="text-xs text-muted-foreground">Exit trades when the loss has exceeded a certain percentage of the initial premium.</p>
              </div>
              <Switch 
                checked={config.exitConditions.stopLossPercent !== undefined}
                onCheckedChange={(checked) => setConfig({ 
                  ...config, 
                  exitConditions: { ...config.exitConditions, stopLossPercent: checked ? 200 : undefined } 
                })}
                data-testid="switch-stop-loss"
              />
            </div>
            {config.exitConditions.stopLossPercent !== undefined && (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={500}
                  value={config.exitConditions.stopLossPercent}
                  onChange={(e) => setConfig({ 
                    ...config, 
                    exitConditions: { ...config.exitConditions, stopLossPercent: parseFloat(e.target.value) || 0 } 
                  })}
                  className="h-8 w-20"
                  data-testid="input-stop-loss"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Take profit at % of premium</p>
                <p className="text-xs text-muted-foreground">Exit trades when the profit has exceeded a certain percentage of the initial premium.</p>
              </div>
              <Switch 
                checked={config.exitConditions.takeProfitPercent !== undefined}
                onCheckedChange={(checked) => setConfig({ 
                  ...config, 
                  exitConditions: { ...config.exitConditions, takeProfitPercent: checked ? 50 : undefined } 
                })}
                data-testid="switch-take-profit"
              />
            </div>
            {config.exitConditions.takeProfitPercent !== undefined && (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={config.exitConditions.takeProfitPercent}
                  onChange={(e) => setConfig({ 
                    ...config, 
                    exitConditions: { ...config.exitConditions, takeProfitPercent: parseFloat(e.target.value) || 0 } 
                  })}
                  className="h-8 w-20"
                  data-testid="input-take-profit"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Starting Capital</h3>
        
        <div className="space-y-2">
          <div 
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${config.capitalMethod === 'auto' ? 'bg-primary/10 border-primary' : 'bg-muted/30 hover:bg-muted/50'}`}
            onClick={() => setConfig({ ...config, capitalMethod: 'auto' })}
            data-testid="option-capital-auto"
          >
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${config.capitalMethod === 'auto' ? 'border-primary' : 'border-muted-foreground'}`}>
                {config.capitalMethod === 'auto' && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <div>
                <p className="text-sm font-medium">Automatically calculated, based on the required buying power</p>
              </div>
            </div>
          </div>
          
          <div 
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${config.capitalMethod === 'manual' ? 'bg-primary/10 border-primary' : 'bg-muted/30 hover:bg-muted/50'}`}
            onClick={() => setConfig({ ...config, capitalMethod: 'manual' })}
            data-testid="option-capital-manual"
          >
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${config.capitalMethod === 'manual' ? 'border-primary' : 'border-muted-foreground'}`}>
                {config.capitalMethod === 'manual' && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Manual allocation to a specific amount</p>
                {config.capitalMethod === 'manual' && (
                  <div className="mt-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min={1000}
                      value={config.manualCapital || 10000}
                      onChange={(e) => setConfig({ ...config, manualCapital: parseFloat(e.target.value) })}
                      onClick={(e) => e.stopPropagation()}
                      className="h-8 w-32"
                      data-testid="input-capital"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center pt-4">
        <Button 
          type="submit" 
          size="lg" 
          className="gap-2 px-12"
          disabled={isLoading}
          data-testid="button-run-backtest"
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run backtest
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground mt-3">
          Uses historical stock prices + Black-Scholes option simulation
        </p>
      </div>
    </form>
  );
}

function BacktestProgress({ 
  progress, 
  status 
}: { 
  progress: number; 
  status: string;
}) {
  return (
    <Card className="max-w-xl mx-auto">
      <CardContent className="py-12">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <RefreshCw className="h-8 w-8 text-primary animate-spin" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">Running Backtest</h3>
            <p className="text-sm text-muted-foreground">
              {status === "pending" ? "Initializing..." : "Processing historical data..."}
            </p>
          </div>
          <div className="space-y-2">
            <Progress value={progress} className="h-3" />
            <p className="text-sm font-mono text-muted-foreground">{progress}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BacktestResults({ 
  result 
}: { 
  result: BacktestRunWithMeta;
}) {
  const summary = result.summary;
  const details = result.details;
  const trades = result.trades || [];
  const dailyLogs = result.dailyLogs || [];
  const pnlHistory = result.pnlHistory || [];

  if (!summary || !details) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p>No results available</p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Total P/L</p>
                <p className={`text-2xl font-bold ${summary.totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(summary.totalProfitLoss)}
                </p>
              </div>
              {summary.totalProfitLoss >= 0 ? (
                <TrendingUp className="h-8 w-8 text-green-500 opacity-50 shrink-0" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-500 opacity-50 shrink-0" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold">{details.profitRate.toFixed(1)}%</p>
              </div>
              <Target className="h-8 w-8 text-primary opacity-50 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Max Drawdown</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatPercent(-Math.abs(summary.maxDrawdown))}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-500 opacity-50 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Total Trades</p>
                <p className="text-2xl font-bold">{details.numberOfTrades}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-primary opacity-50 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="summary" className="gap-1" data-testid="tab-summary">
            <BarChart3 className="h-4 w-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="details" className="gap-1" data-testid="tab-details">
            <ListChecks className="h-4 w-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1" data-testid="tab-logs">
            <FileText className="h-4 w-4" />
            Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg border">
            <div className="space-y-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Underlying</p>
                <p className="text-lg font-bold font-mono">{result.config.symbol}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Dates</p>
                <p className="text-sm">
                  From: <span className="font-medium">{format(new Date(result.config.startDate), "M/d/yyyy")}</span>
                </p>
                <p className="text-sm">
                  To: <span className="font-medium">{format(new Date(result.config.endDate), "M/d/yyyy")}</span>
                </p>
              </div>
            </div>
            
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Legs</p>
              <div className="space-y-1">
                {result.config.legs.map((leg, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Badge variant={leg.direction === "buy" ? "default" : "secondary"} className="text-xs">
                      {leg.direction}
                    </Badge>
                    <span className="font-medium">{leg.quantity}</span>
                    <span>{leg.optionType}</span>
                    <span className="text-muted-foreground">
                      {leg.strikeSelection === "percentOTM" ? `${leg.strikeValue}% OTM` : `$${leg.strikeValue}`}
                    </span>
                    <span className="font-medium">{leg.dte} DTE</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Entry Conditions</p>
              <p className="text-sm">
                Enter: <span className="font-medium">
                  {result.config.entryConditions.frequency === "everyDay" ? "Every day" :
                   result.config.entryConditions.frequency === "specificDays" ? "Specific days" :
                   "Exact DTE"}
                </span>
              </p>
              {result.config.entryConditions.maxActiveTrades && (
                <p className="text-sm">
                  Max trades: <span className="font-medium">{result.config.entryConditions.maxActiveTrades}</span>
                </p>
              )}
              {result.config.exitConditions.takeProfitPercent && (
                <p className="text-sm text-green-600">
                  Take profit: <span className="font-medium">{result.config.exitConditions.takeProfitPercent}%</span>
                </p>
              )}
              {result.config.exitConditions.stopLossPercent && (
                <p className="text-sm text-red-600">
                  Stop loss: <span className="font-medium">{result.config.exitConditions.stopLossPercent}%</span>
                </p>
              )}
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">P/L Over Time</CardTitle>
              <CardDescription>Strategy performance vs underlying</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {pnlHistory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={pnlHistory} margin={{ top: 10, right: 60, left: 10, bottom: 10 }}>
                      <defs>
                        <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        className="text-xs" 
                        tick={{ fontSize: 10 }}
                        tickFormatter={(d) => {
                          const date = new Date(d);
                          return `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(-2)}`;
                        }}
                        interval="preserveStartEnd"
                        minTickGap={40}
                      />
                      <YAxis 
                        yAxisId="left"
                        className="text-xs" 
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => `$${v.toFixed(0)}`}
                        label={{ 
                          value: result.config.symbol, 
                          angle: -90, 
                          position: 'insideLeft',
                          style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' }
                        }}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        className="text-xs" 
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => {
                          if (Math.abs(v) >= 1000) return `$${(v/1000).toFixed(0)}k`;
                          return `$${v.toFixed(0)}`;
                        }}
                        label={{ 
                          value: 'Strategy P/L', 
                          angle: 90, 
                          position: 'insideRight',
                          style: { fontSize: 11, fill: '#f97316' }
                        }}
                      />
                      <Tooltip 
                        formatter={(value: number, name: string) => [
                          `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                          name
                        ]}
                        labelFormatter={(label) => new Date(label).toLocaleDateString()}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                      />
                      <Legend 
                        verticalAlign="top"
                        height={36}
                        iconType="circle"
                      />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="underlyingPrice" 
                        stroke="hsl(var(--foreground))" 
                        strokeWidth={1.5}
                        dot={false}
                        name={`${result.config.symbol} Price`}
                      />
                      <Area 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="cumulativePnL" 
                        stroke="#f97316" 
                        fill="url(#pnlGradient)"
                        strokeWidth={2}
                        name="Strategy P/L"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No chart data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 space-y-1">
                <p className="text-xs text-muted-foreground">Avg Win</p>
                <p className="text-lg font-semibold text-green-600">
                  {formatCurrency(details.avgWinSize)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 space-y-1">
                <p className="text-xs text-muted-foreground">Avg Loss</p>
                <p className="text-lg font-semibold text-red-600">
                  {formatCurrency(details.avgLossSize)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 space-y-1">
                <p className="text-xs text-muted-foreground">Largest Profit</p>
                <p className="text-lg font-semibold text-green-600">
                  {formatCurrency(details.largestProfit)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 space-y-1">
                <p className="text-xs text-muted-foreground">Largest Loss</p>
                <p className="text-lg font-semibold text-red-600">
                  {formatCurrency(details.largestLoss)}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Trade Log</CardTitle>
              <CardDescription>Individual trade performance</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <table className="w-full text-sm" data-testid="table-trade-log">
                  <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                    <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                      <th className="px-3 py-2 text-left font-medium">#</th>
                      <th className="px-3 py-2 text-left font-medium">Opened</th>
                      <th className="px-3 py-2 text-left font-medium">Closed</th>
                      <th className="px-3 py-2 text-right font-medium">Premium</th>
                      <th className="px-3 py-2 text-right font-medium">Buying Power</th>
                      <th className="px-3 py-2 text-right font-medium">Profit/Loss</th>
                      <th className="px-3 py-2 text-center font-medium">Close Reason</th>
                      <th className="px-3 py-2 text-right font-medium">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.length > 0 ? trades.map((trade, i) => {
                      const isProfit = trade.profitLoss >= 0;
                      const formattedDate = (dateStr: string) => {
                        const d = new Date(dateStr);
                        return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
                      };
                      return (
                        <tr
                          key={i}
                          className="border-b border-border/50 hover-elevate"
                          data-testid={`row-trade-${trade.tradeNumber}`}
                        >
                          <td className="px-3 py-2.5 font-mono text-muted-foreground">{trade.tradeNumber}</td>
                          <td className="px-3 py-2.5" data-testid={`text-opened-${trade.tradeNumber}`}>{formattedDate(trade.openedDate)}</td>
                          <td className="px-3 py-2.5" data-testid={`text-closed-${trade.tradeNumber}`}>{formattedDate(trade.closedDate)}</td>
                          <td className="px-3 py-2.5 text-right font-mono" data-testid={`text-premium-${trade.tradeNumber}`}>
                            ${Math.round(trade.premium)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono" data-testid={`text-bp-${trade.tradeNumber}`}>
                            ${trade.buyingPower.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </td>
                          <td className={`px-3 py-2.5 text-right font-mono font-semibold ${isProfit ? 'text-green-500' : 'text-red-500'}`} data-testid={`text-pnl-${trade.tradeNumber}`}>
                            ${trade.profitLoss.toFixed(2)}
                          </td>
                          <td className="px-3 py-2.5 text-center text-muted-foreground" data-testid={`text-reason-${trade.tradeNumber}`}>
                            {trade.closeReason}
                          </td>
                          <td className={`px-3 py-2.5 text-right font-mono ${isProfit ? 'text-green-500' : 'text-red-500'}`} data-testid={`text-roi-${trade.tradeNumber}`}>
                            {trade.roi.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-muted-foreground">
                          No trade data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Daily Logs</CardTitle>
              <CardDescription>Day-by-day activity log</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-1 font-mono text-xs">
                  {dailyLogs.length > 0 ? dailyLogs.map((log, i) => (
                    <div 
                      key={i}
                      className="p-2 rounded bg-muted/30 flex flex-wrap gap-2 items-center"
                    >
                      <span className="text-muted-foreground">
                        {new Date(log.date).toLocaleDateString()}
                      </span>
                      <span className="mx-1">|</span>
                      <span>Price: ${log.underlyingPrice.toFixed(2)}</span>
                      <span className="mx-1">|</span>
                      <span className={log.totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}>
                        P/L: {log.totalProfitLoss >= 0 ? '+' : ''}${log.totalProfitLoss.toFixed(2)}
                      </span>
                      <span className="mx-1">|</span>
                      <span>Active: {log.activeTrades}</span>
                      {log.drawdown > 0 && (
                        <>
                          <span className="mx-1">|</span>
                          <span className="text-red-500">DD: -{log.drawdown.toFixed(1)}%</span>
                        </>
                      )}
                    </div>
                  )) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No log data available
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BacktestError({ 
  message, 
  onRetry 
}: { 
  message: string; 
  onRetry: () => void;
}) {
  return (
    <Card className="max-w-xl mx-auto">
      <CardContent className="py-12">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">Backtest Failed</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {message || "An unexpected error occurred while running the backtest."}
            </p>
          </div>
          <Button onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Backtest() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [view, setView] = useState<"setup" | "running" | "results" | "error">("setup");

  const createBacktestMutation = useMutation({
    mutationFn: async (config: BacktestConfigData) => {
      const response = await apiRequest("POST", "/api/backtest/tastyworks", config);
      return response.json();
    },
    onSuccess: (data: { id: string }) => {
      setCurrentRunId(data.id);
      setView("running");
    },
    onError: (error: any) => {
      console.error("Failed to create backtest:", error);
      setView("error");
    },
  });

  const { data: currentRun, refetch: refetchRun } = useQuery<BacktestRunWithMeta>({
    queryKey: ["/api/backtest/tastyworks", currentRunId],
    queryFn: async () => {
      const response = await fetch(`/api/backtest/tastyworks/${currentRunId}`);
      if (!response.ok) throw new Error("Failed to fetch backtest");
      return response.json();
    },
    enabled: !!currentRunId && view !== "setup",
    refetchInterval: view === "running" ? 2000 : false,
  });

  useEffect(() => {
    if (currentRun) {
      const status = currentRun.status as string;
      if (status === "completed") {
        setView("results");
      } else if (status === "error") {
        setView("error");
      }
    }
  }, [currentRun]);

  const handleRunBacktest = (config: BacktestConfigData) => {
    createBacktestMutation.mutate(config);
  };

  const handleRetry = () => {
    setCurrentRunId(null);
    setView("setup");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <Link href="/builder">
              <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back-builder">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Builder</span>
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span className="font-semibold">Options Backtester</span>
            </div>
          </div>
          {view === "results" && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetry}
              className="gap-2"
              data-testid="button-new-backtest"
            >
              <Plus className="h-4 w-4" />
              New Backtest
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {view === "setup" && (
          <BacktestSetup 
            onSubmit={handleRunBacktest} 
            isLoading={createBacktestMutation.isPending} 
          />
        )}

        {view === "running" && currentRun && (
          <BacktestProgress 
            progress={currentRun.progress} 
            status={currentRun.status} 
          />
        )}

        {view === "running" && !currentRun && (
          <BacktestProgress progress={0} status="pending" />
        )}

        {view === "results" && currentRun && (
          <BacktestResults result={currentRun} />
        )}

        {view === "error" && (
          <BacktestError 
            message={currentRun?.errorMessage || "An error occurred"} 
            onRetry={handleRetry} 
          />
        )}
      </main>
    </div>
  );
}
