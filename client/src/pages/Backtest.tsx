import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Play, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  Clock,
  DollarSign,
  Target,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart
} from "recharts";

// Sample backtest results data
const sampleEquityCurve = [
  { date: "Jan 1", equity: 10000, benchmark: 10000 },
  { date: "Jan 8", equity: 10250, benchmark: 10100 },
  { date: "Jan 15", equity: 10180, benchmark: 10050 },
  { date: "Jan 22", equity: 10500, benchmark: 10200 },
  { date: "Jan 29", equity: 10800, benchmark: 10150 },
  { date: "Feb 5", equity: 10650, benchmark: 10300 },
  { date: "Feb 12", equity: 11200, benchmark: 10400 },
  { date: "Feb 19", equity: 11500, benchmark: 10350 },
  { date: "Feb 26", equity: 11300, benchmark: 10500 },
  { date: "Mar 5", equity: 11800, benchmark: 10600 },
  { date: "Mar 12", equity: 12200, benchmark: 10550 },
  { date: "Mar 19", equity: 12500, benchmark: 10700 },
];

const sampleTrades = [
  { id: 1, date: "2024-01-05", symbol: "AAPL", strategy: "Long Call", entry: 2.50, exit: 3.80, pnl: 130, status: "win" },
  { id: 2, date: "2024-01-12", symbol: "TSLA", strategy: "Bull Call Spread", entry: 1.20, exit: 2.10, pnl: 90, status: "win" },
  { id: 3, date: "2024-01-18", symbol: "NVDA", strategy: "Long Call", entry: 3.40, exit: 2.80, pnl: -60, status: "loss" },
  { id: 4, date: "2024-01-25", symbol: "SPY", strategy: "Iron Condor", entry: 0.80, exit: 0.40, pnl: 40, status: "win" },
  { id: 5, date: "2024-02-01", symbol: "AAPL", strategy: "Long Put", entry: 1.90, exit: 3.20, pnl: 130, status: "win" },
  { id: 6, date: "2024-02-08", symbol: "MSFT", strategy: "Bear Put Spread", entry: 1.50, exit: 2.20, pnl: 70, status: "win" },
];

export default function Backtest() {
  const [, setLocation] = useLocation();
  const [symbol, setSymbol] = useState("AAPL");
  const [strategy, setStrategy] = useState("long_call");
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("2024-12-31");
  const [capital, setCapital] = useState("10000");
  const [isRunning, setIsRunning] = useState(false);
  const [hasResults, setHasResults] = useState(true); // Show sample results

  const handleRunBacktest = () => {
    setIsRunning(true);
    // Simulate backtest running
    setTimeout(() => {
      setIsRunning(false);
      setHasResults(true);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/builder">
              <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back-builder">
                <ArrowLeft className="h-4 w-4" />
                Back to Builder
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span className="font-semibold">Options Backtester</span>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            Powered by Alpaca
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Configuration Panel */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Backtest Configuration</CardTitle>
              <CardDescription>Configure your options strategy backtest</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Symbol */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Symbol</Label>
                <Input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="AAPL"
                  className="h-9"
                  data-testid="input-backtest-symbol"
                />
              </div>

              {/* Strategy */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Strategy</Label>
                <Select value={strategy} onValueChange={setStrategy}>
                  <SelectTrigger className="h-9" data-testid="select-strategy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="long_call">Long Call</SelectItem>
                    <SelectItem value="long_put">Long Put</SelectItem>
                    <SelectItem value="covered_call">Covered Call</SelectItem>
                    <SelectItem value="cash_secured_put">Cash Secured Put</SelectItem>
                    <SelectItem value="bull_call_spread">Bull Call Spread</SelectItem>
                    <SelectItem value="bear_put_spread">Bear Put Spread</SelectItem>
                    <SelectItem value="iron_condor">Iron Condor</SelectItem>
                    <SelectItem value="straddle">Straddle</SelectItem>
                    <SelectItem value="strangle">Strangle</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9"
                  data-testid="input-start-date"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9"
                  data-testid="input-end-date"
                />
              </div>

              {/* Starting Capital */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Starting Capital</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    value={capital}
                    onChange={(e) => setCapital(e.target.value)}
                    className="h-9 pl-8"
                    data-testid="input-capital"
                  />
                </div>
              </div>

              <Separator />

              {/* Run Button */}
              <Button
                className="w-full gap-2"
                onClick={handleRunBacktest}
                disabled={isRunning}
                data-testid="button-run-backtest"
              >
                {isRunning ? (
                  <>
                    <Clock className="h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Run Backtest
                  </>
                )}
              </Button>

              {/* Info */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Historical data from Alpaca
                </p>
                <p>Results are simulated and may not reflect actual trading conditions.</p>
              </div>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <div className="lg:col-span-3 space-y-6">
            {hasResults ? (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Total Return</p>
                          <p className="text-2xl font-bold text-green-600">+25.0%</p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Win Rate</p>
                          <p className="text-2xl font-bold">83.3%</p>
                        </div>
                        <Target className="h-8 w-8 text-primary opacity-50" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Max Drawdown</p>
                          <p className="text-2xl font-bold text-red-600">-8.2%</p>
                        </div>
                        <TrendingDown className="h-8 w-8 text-red-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Sharpe Ratio</p>
                          <p className="text-2xl font-bold">1.85</p>
                        </div>
                        <BarChart3 className="h-8 w-8 text-primary opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts and Trade History */}
                <Tabs defaultValue="equity" className="w-full">
                  <TabsList className="grid w-full max-w-md grid-cols-3">
                    <TabsTrigger value="equity" data-testid="tab-equity">Equity Curve</TabsTrigger>
                    <TabsTrigger value="trades" data-testid="tab-trades">Trade History</TabsTrigger>
                    <TabsTrigger value="stats" data-testid="tab-stats">Statistics</TabsTrigger>
                  </TabsList>

                  <TabsContent value="equity" className="mt-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Equity Curve</CardTitle>
                        <CardDescription>Portfolio value over time vs benchmark</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={sampleEquityCurve}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis dataKey="date" className="text-xs" />
                              <YAxis className="text-xs" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                              <Tooltip 
                                formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                                contentStyle={{ 
                                  backgroundColor: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px'
                                }}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="equity" 
                                stroke="hsl(var(--primary))" 
                                fill="hsl(var(--primary) / 0.2)"
                                strokeWidth={2}
                                name="Strategy"
                              />
                              <Line 
                                type="monotone" 
                                dataKey="benchmark" 
                                stroke="hsl(var(--muted-foreground))" 
                                strokeDasharray="5 5"
                                strokeWidth={1}
                                dot={false}
                                name="Benchmark"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="trades" className="mt-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Trade History</CardTitle>
                        <CardDescription>Individual trades executed during backtest</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {sampleTrades.map((trade) => (
                            <div 
                              key={trade.id}
                              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                            >
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  {trade.status === "win" ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <AlertTriangle className="h-4 w-4 text-red-500" />
                                  )}
                                  <span className="font-mono font-semibold">{trade.symbol}</span>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {trade.strategy}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{trade.date}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right text-xs">
                                  <span className="text-muted-foreground">Entry: </span>
                                  <span className="font-mono">${trade.entry.toFixed(2)}</span>
                                  <span className="mx-1">→</span>
                                  <span className="font-mono">${trade.exit.toFixed(2)}</span>
                                </div>
                                <span className={`font-mono font-semibold ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(0)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="stats" className="mt-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Detailed Statistics</CardTitle>
                        <CardDescription>Performance metrics and risk analysis</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Total Trades</p>
                            <p className="text-lg font-semibold">6</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Winning Trades</p>
                            <p className="text-lg font-semibold text-green-600">5</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Losing Trades</p>
                            <p className="text-lg font-semibold text-red-600">1</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Avg Win</p>
                            <p className="text-lg font-semibold text-green-600">+$92.00</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Avg Loss</p>
                            <p className="text-lg font-semibold text-red-600">-$60.00</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Profit Factor</p>
                            <p className="text-lg font-semibold">7.67</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Expectancy</p>
                            <p className="text-lg font-semibold">$66.67</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Avg Hold Time</p>
                            <p className="text-lg font-semibold">5.2 days</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Max Consecutive Wins</p>
                            <p className="text-lg font-semibold">4</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <Card className="lg:col-span-3">
                <CardContent className="flex flex-col items-center justify-center py-20">
                  <BarChart3 className="h-16 w-16 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-semibold text-muted-foreground">No Results Yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure your backtest parameters and click "Run Backtest" to see results.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
