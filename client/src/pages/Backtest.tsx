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
    strikeSelection: "delta",
    strikeValue: 0.30,
    dte: 45,
  };
}

function getDefaultConfig(): BacktestConfigData {
  // Use a reliable historical date range with known data availability
  // Default to 2023-2024 period which should have complete data
  return {
    symbol: "AAPL",
    startDate: "2023-01-01",
    endDate: "2024-01-01",
    legs: [getDefaultLeg()],
    entryConditions: {
      frequency: "everyDay",
      maxActiveTrades: 1,
    },
    exitConditions: {
      exitAtDTE: 21,
      stopLossPercent: 200,
      takeProfitPercent: 50,
    },
    capitalMethod: "auto",
    feePerContract: 0.65,
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);
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
        setShowSuggestions(false);
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
    setShowSuggestions(false);
  };

  return (
    <div className="relative" ref={searchRef}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={value || "Search stock..."}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value.toUpperCase());
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          className="pl-8 h-9 text-sm"
          data-testid="input-backtest-symbol"
        />
        {isSearching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showSuggestions && searchTerm && (
        <Card className="absolute top-full mt-1 left-0 w-72 z-[100] max-h-64 overflow-y-auto shadow-lg">
          {isSearching ? (
            <div className="p-3 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
              Searching...
            </div>
          ) : searchResults?.results && searchResults.results.length > 0 ? (
            <div className="p-1.5">
              {searchResults.results.slice(0, 8).map((result) => (
                <button
                  key={result.symbol}
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

      {value && !searchTerm && (
        <div className="absolute inset-0 flex items-center pl-8 pointer-events-none">
          <span className="font-mono font-semibold text-sm">{value}</span>
        </div>
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
    <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Leg {index + 1}</h4>
        {canRemove && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onRemove}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            data-testid={`button-remove-leg-${index}`}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs">Direction</Label>
          <Select 
            value={leg.direction} 
            onValueChange={(v) => onChange({ ...leg, direction: v as "buy" | "sell" })}
          >
            <SelectTrigger className="h-9" data-testid={`select-leg-${index}-direction`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sell">Sell</SelectItem>
              <SelectItem value="buy">Buy</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label className="text-xs">Type</Label>
          <Select 
            value={leg.optionType} 
            onValueChange={(v) => onChange({ ...leg, optionType: v as "call" | "put" })}
          >
            <SelectTrigger className="h-9" data-testid={`select-leg-${index}-type`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="put">Put</SelectItem>
              <SelectItem value="call">Call</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs">Quantity</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={leg.quantity}
            onChange={(e) => onChange({ ...leg, quantity: parseInt(e.target.value) || 1 })}
            className="h-9"
            data-testid={`input-leg-${index}-quantity`}
          />
        </div>
        
        <div className="space-y-2">
          <Label className="text-xs">DTE (Days to Exp)</Label>
          <Input
            type="number"
            min={1}
            max={365}
            value={leg.dte}
            onChange={(e) => onChange({ ...leg, dte: parseInt(e.target.value) || 45 })}
            className="h-9"
            data-testid={`input-leg-${index}-dte`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs">Strike Selection</Label>
          <Select 
            value={leg.strikeSelection} 
            onValueChange={(v) => onChange({ ...leg, strikeSelection: v as any })}
          >
            <SelectTrigger className="h-9" data-testid={`select-leg-${index}-strike`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="delta">Delta</SelectItem>
              <SelectItem value="percentOTM">% OTM</SelectItem>
              <SelectItem value="priceOffset">Price Offset</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label className="text-xs">
            {leg.strikeSelection === "delta" ? "Delta Value" : 
             leg.strikeSelection === "percentOTM" ? "% OTM" : "$ Offset"}
          </Label>
          <Input
            type="number"
            step={leg.strikeSelection === "delta" ? 0.01 : 1}
            value={leg.strikeValue}
            onChange={(e) => onChange({ ...leg, strikeValue: parseFloat(e.target.value) || 0 })}
            className="h-9"
            data-testid={`input-leg-${index}-strike-value`}
          />
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Strategy Configuration
          </CardTitle>
          <CardDescription>
            Define your options strategy legs and parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Stock Symbol</Label>
              <StockSearchInput
                value={config.symbol}
                onChange={(symbol) => setConfig({ ...config, symbol })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-9 justify-start text-left font-normal"
                    data-testid="input-start-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {config.startDate ? format(new Date(config.startDate), "MM/dd/yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={config.startDate ? new Date(config.startDate) : undefined}
                    onSelect={(date) => date && setConfig({ ...config, startDate: format(date, "yyyy-MM-dd") })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-9 justify-start text-left font-normal"
                    data-testid="input-end-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {config.endDate ? format(new Date(config.endDate), "MM/dd/yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={config.endDate ? new Date(config.endDate) : undefined}
                    onSelect={(date) => date && setConfig({ ...config, endDate: format(date, "yyyy-MM-dd") })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Strategy Legs</CardTitle>
              <CardDescription>Configure up to 4 option legs</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLeg}
              disabled={config.legs.length >= 4}
              className="gap-1"
              data-testid="button-add-leg"
            >
              <Plus className="h-4 w-4" />
              Add Leg
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Entry Conditions</CardTitle>
            <CardDescription>When to enter new trades</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Entry Frequency</Label>
              <Select 
                value={config.entryConditions.frequency} 
                onValueChange={(v) => setConfig({ 
                  ...config, 
                  entryConditions: { ...config.entryConditions, frequency: v as any } 
                })}
              >
                <SelectTrigger className="h-9" data-testid="select-entry-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyDay">Every Trading Day</SelectItem>
                  <SelectItem value="specificDays">Specific Days of Week</SelectItem>
                  <SelectItem value="exactDTE">Only at Exact DTE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Max Active Trades</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={config.entryConditions.maxActiveTrades || 1}
                onChange={(e) => setConfig({ 
                  ...config, 
                  entryConditions: { 
                    ...config.entryConditions, 
                    maxActiveTrades: parseInt(e.target.value) || 1 
                  } 
                })}
                className="h-9"
                data-testid="input-max-trades"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Exit Conditions</CardTitle>
            <CardDescription>When to close positions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Exit at DTE</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={config.exitConditions.exitAtDTE ?? ""}
                onChange={(e) => setConfig({ 
                  ...config, 
                  exitConditions: { 
                    ...config.exitConditions, 
                    exitAtDTE: e.target.value ? parseInt(e.target.value) : undefined 
                  } 
                })}
                placeholder="e.g., 21"
                className="h-9"
                data-testid="input-exit-dte"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Stop Loss %</Label>
                <Input
                  type="number"
                  min={0}
                  max={500}
                  value={config.exitConditions.stopLossPercent ?? ""}
                  onChange={(e) => setConfig({ 
                    ...config, 
                    exitConditions: { 
                      ...config.exitConditions, 
                      stopLossPercent: e.target.value ? parseFloat(e.target.value) : undefined 
                    } 
                  })}
                  placeholder="200"
                  className="h-9"
                  data-testid="input-stop-loss"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Take Profit %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={config.exitConditions.takeProfitPercent ?? ""}
                  onChange={(e) => setConfig({ 
                    ...config, 
                    exitConditions: { 
                      ...config.exitConditions, 
                      takeProfitPercent: e.target.value ? parseFloat(e.target.value) : undefined 
                    } 
                  })}
                  placeholder="50"
                  className="h-9"
                  data-testid="input-take-profit"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Capital & Fees</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Capital Method</Label>
              <Select 
                value={config.capitalMethod} 
                onValueChange={(v) => setConfig({ ...config, capitalMethod: v as "auto" | "manual" })}
              >
                <SelectTrigger className="h-9" data-testid="select-capital-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-calculate</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {config.capitalMethod === "manual" && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Starting Capital</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min={1000}
                    value={config.manualCapital || 10000}
                    onChange={(e) => setConfig({ ...config, manualCapital: parseFloat(e.target.value) })}
                    className="h-9 pl-8"
                    data-testid="input-capital"
                  />
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label className="text-xs font-medium">Fee per Contract</Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step={0.01}
                  min={0}
                  value={config.feePerContract || 0.65}
                  onChange={(e) => setConfig({ ...config, feePerContract: parseFloat(e.target.value) })}
                  className="h-9 pl-8"
                  data-testid="input-fee"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3" />
          Uses historical stock prices from Finnhub + Black-Scholes option simulation
        </div>
        <Button 
          type="submit" 
          size="lg" 
          className="gap-2 px-8"
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
              Run Backtest
            </>
          )}
        </Button>
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
                      {leg.strikeSelection === "delta" ? `${(leg.strikeValue * 100).toFixed(0)} \u0394` :
                       leg.strikeSelection === "percentOTM" ? `${leg.strikeValue}% OTM` :
                       `$${leg.strikeValue}`}
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
              <CardTitle className="text-base">Trade Details</CardTitle>
              <CardDescription>Individual trade performance</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {trades.length > 0 ? trades.map((trade, i) => (
                    <div 
                      key={i}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          {trade.profitLoss >= 0 ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-xs text-muted-foreground">
                            #{trade.tradeNumber}
                          </span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Entry: </span>
                          <span>{new Date(trade.openedDate).toLocaleDateString()}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Exit: </span>
                          <span>{new Date(trade.closedDate).toLocaleDateString()}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {trade.closeReason}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-xs">
                          <span className="text-muted-foreground">Premium: </span>
                          <span className="font-mono">{formatCurrency(trade.premium)}</span>
                        </div>
                        <span className={`font-mono font-semibold ${trade.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {trade.profitLoss >= 0 ? '+' : ''}{formatCurrency(trade.profitLoss)}
                        </span>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No trade data available
                    </div>
                  )}
                </div>
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
