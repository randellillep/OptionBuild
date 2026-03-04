import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Search,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  Clock,
  DollarSign,
  Activity,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Lightbulb,
  AlertTriangle,
  ArrowRight,
  Layers,
  Grid3X3,
  LineChart,
  Settings,
  Save,
  Share2,
  Zap,
  Home,
} from "lucide-react";

interface TutorialStep {
  id: number;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

function OptionBasicsSection() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Call Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A call option gives you the <strong>right to buy</strong> a stock at a specific price (strike price) before a certain date (expiration).
            </p>
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">Profit when:</p>
              <p className="text-sm">Stock price goes UP above your strike price</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Profit:</span>
                <span className="font-mono">Unlimited</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Loss:</span>
                <span className="font-mono">Premium Paid</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Put Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A put option gives you the <strong>right to sell</strong> a stock at a specific price (strike price) before a certain date (expiration).
            </p>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">Profit when:</p>
              <p className="text-sm">Stock price goes DOWN below your strike price</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Profit:</span>
                <span className="font-mono">Strike - Premium</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Loss:</span>
                <span className="font-mono">Premium Paid</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layers className="h-5 w-5 text-primary" />
            Long vs Short Positions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Long</Badge>
                <span className="font-medium">Buying Options</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Pay premium upfront</li>
                <li>Limited risk (max loss = premium)</li>
                <li>Potentially unlimited reward (calls)</li>
                <li>Time decay works against you</li>
              </ul>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">Short</Badge>
                <span className="font-medium">Selling Options</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Receive premium upfront</li>
                <li>Potentially unlimited risk (naked)</li>
                <li>Limited reward (max = premium)</li>
                <li>Time decay works in your favor</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StrategyBuilderSection() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5 text-primary" />
            Step 1: Choose a Stock Symbol
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Start by entering a stock symbol in the search bar. You can search by ticker symbol (like AAPL) or company name (like Apple).
          </p>
          <div className="bg-muted/50 rounded-lg p-4 border">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 bg-background border rounded-md flex items-center px-3 flex-1">
                <Search className="h-4 w-4 text-muted-foreground mr-2" />
                <span className="text-muted-foreground">AAPL</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The app will fetch real-time price data and available options for your selected stock.
            </p>
          </div>
          <div className="flex items-start gap-2 text-sm bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <span>Only stocks with tradeable options are available. Most large-cap stocks and ETFs have options.</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            Step 2: Select Strategy Template
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose from pre-built strategy templates or build your own custom strategy. Each template is designed for specific market conditions.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { name: "Long Call", outlook: "Bullish", icon: TrendingUp, color: "green" },
              { name: "Long Put", outlook: "Bearish", icon: TrendingDown, color: "red" },
              { name: "Iron Condor", outlook: "Neutral", icon: BarChart3, color: "blue" },
              { name: "Straddle", outlook: "High Vol", icon: Activity, color: "purple" },
            ].map((strategy) => (
              <div key={strategy.name} className="border rounded-lg p-3 text-center hover-elevate cursor-pointer">
                <strategy.icon className={`h-6 w-6 mx-auto mb-2 text-${strategy.color}-500`} />
                <p className="text-sm font-medium">{strategy.name}</p>
                <Badge variant="secondary" className="text-xs mt-1">{strategy.outlook}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-primary" />
            Step 3: Choose Expiration Date
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select when your options will expire. Shorter expirations have faster time decay but cost less. Longer expirations give more time for your thesis to play out.
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Weekly Options</p>
                <p className="text-xs text-muted-foreground">1-7 days to expiration</p>
              </div>
              <Badge variant="outline" className="text-orange-500 border-orange-500/30">High Risk</Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
              <div>
                <p className="font-medium">Monthly Options</p>
                <p className="text-xs text-muted-foreground">30-60 days to expiration</p>
              </div>
              <Badge variant="outline" className="text-green-500 border-green-500/30">Recommended</Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">LEAPS</p>
                <p className="text-xs text-muted-foreground">6+ months to expiration</p>
              </div>
              <Badge variant="outline" className="text-blue-500 border-blue-500/30">Long-term</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-primary" />
            Step 4: Select Strike Price
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The strike price determines the price at which you can exercise your option. Use the strike ladder to visualize available strikes relative to the current stock price.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 border space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">In-The-Money (ITM)</span>
              <span>Higher premium, higher probability</span>
            </div>
            <div className="flex items-center justify-between text-sm bg-primary/10 rounded p-2">
              <span className="font-medium">At-The-Money (ATM)</span>
              <span>Strike ≈ Current Price</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Out-of-The-Money (OTM)</span>
              <span>Lower premium, lower probability</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PLHeatmapSection() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Grid3X3 className="h-5 w-5 text-primary" />
            Understanding the P/L Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The Profit/Loss heatmap shows how your strategy performs across different stock prices (rows) and dates (columns).
          </p>
          <div className="bg-muted/50 rounded-lg p-4 border">
            <div className="grid grid-cols-5 gap-1 text-xs text-center mb-3">
              <div className="text-muted-foreground">Price</div>
              <div className="text-muted-foreground">Today</div>
              <div className="text-muted-foreground">+7 days</div>
              <div className="text-muted-foreground">+14 days</div>
              <div className="text-muted-foreground">Expiry</div>
            </div>
            <div className="grid grid-cols-5 gap-1 text-xs font-mono">
              <div className="p-2 bg-background border rounded">$155</div>
              <div className="p-2 bg-green-500/30 rounded text-green-600">+$420</div>
              <div className="p-2 bg-green-500/40 rounded text-green-600">+$380</div>
              <div className="p-2 bg-green-500/50 rounded text-green-600">+$320</div>
              <div className="p-2 bg-green-500/60 rounded text-green-600">+$250</div>
              
              <div className="p-2 bg-background border rounded">$150</div>
              <div className="p-2 bg-green-500/20 rounded text-green-600">+$180</div>
              <div className="p-2 bg-green-500/10 rounded text-green-600">+$120</div>
              <div className="p-2 bg-background border rounded">+$50</div>
              <div className="p-2 bg-red-500/20 rounded text-red-600">-$50</div>
              
              <div className="p-2 bg-background border rounded">$145</div>
              <div className="p-2 bg-red-500/20 rounded text-red-600">-$80</div>
              <div className="p-2 bg-red-500/30 rounded text-red-600">-$150</div>
              <div className="p-2 bg-red-500/40 rounded text-red-600">-$220</div>
              <div className="p-2 bg-red-500/50 rounded text-red-600">-$300</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500/50"></div>
              <span>Profit</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500/50"></div>
              <span>Loss</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted border"></div>
              <span>Breakeven</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <LineChart className="h-5 w-5 text-primary" />
            Reading the Chart
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">1</span>
              </div>
              <div>
                <p className="font-medium">Rows = Stock Prices</p>
                <p className="text-sm text-muted-foreground">Each row shows P/L at a different potential stock price</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">2</span>
              </div>
              <div>
                <p className="font-medium">Columns = Time</p>
                <p className="text-sm text-muted-foreground">See how P/L changes as time passes toward expiration</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">3</span>
              </div>
              <div>
                <p className="font-medium">Color Intensity</p>
                <p className="text-sm text-muted-foreground">Darker colors = larger profit or loss amounts</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">4</span>
              </div>
              <div>
                <p className="font-medium">Current Price Line</p>
                <p className="text-sm text-muted-foreground">A highlighted row shows where the stock is trading now</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-amber-600 dark:text-amber-400">Time Decay Warning</p>
          <p className="text-muted-foreground">Notice how long option positions typically lose value as you move right (toward expiration) - this is theta decay eating away at your premium.</p>
        </div>
      </div>
    </div>
  );
}

function GreeksSection() {
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        The "Greeks" are measurements that tell you how sensitive your option position is to various factors. Understanding Greeks helps you manage risk effectively.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="text-2xl font-serif">Δ</span>
              Delta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              How much the option price changes for a $1 move in the stock.
            </p>
            <div className="bg-muted/50 rounded-lg p-3 border">
              <div className="flex justify-between text-sm">
                <span>Delta of 0.50:</span>
                <span className="font-mono">+$0.50 per $1 stock move</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Also approximates the probability of finishing in-the-money.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="text-2xl font-serif">Γ</span>
              Gamma
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              How fast Delta changes as the stock moves.
            </p>
            <div className="bg-muted/50 rounded-lg p-3 border">
              <div className="flex justify-between text-sm">
                <span>High Gamma:</span>
                <span className="font-mono">Delta changes quickly</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Highest for at-the-money options near expiration.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="text-2xl font-serif">Θ</span>
              Theta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              How much value the option loses each day (time decay).
            </p>
            <div className="bg-muted/50 rounded-lg p-3 border">
              <div className="flex justify-between text-sm">
                <span>Theta of -0.05:</span>
                <span className="font-mono text-red-500">-$5/day (per contract)</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Negative for long options, positive for short options.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="text-2xl font-serif">V</span>
              Vega
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              How much option price changes for a 1% change in implied volatility.
            </p>
            <div className="bg-muted/50 rounded-lg p-3 border">
              <div className="flex justify-between text-sm">
                <span>Vega of 0.10:</span>
                <span className="font-mono">+$10 per 1% IV increase</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Critical around earnings when IV can crush.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="text-2xl font-serif">ρ</span>
            Rho
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sensitivity to interest rate changes. Generally less important for short-term trades but can matter for LEAPS (long-dated options). Higher rates increase call values and decrease put values.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function IVSection() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" />
            What is Implied Volatility (IV)?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Implied Volatility represents the market's expectation of how much a stock will move. It's "implied" by option prices - when options are expensive, IV is high.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg bg-orange-500/5 border-orange-500/20">
              <p className="font-medium text-orange-600 dark:text-orange-400 mb-2">High IV Environment</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Options are expensive</li>
                <li>Market expects big moves</li>
                <li>Often before earnings</li>
                <li>Good for selling premium</li>
              </ul>
            </div>
            <div className="p-4 border rounded-lg bg-blue-500/5 border-blue-500/20">
              <p className="font-medium text-blue-600 dark:text-blue-400 mb-2">Low IV Environment</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Options are cheap</li>
                <li>Market expects small moves</li>
                <li>Quiet periods</li>
                <li>Good for buying options</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5 text-primary" />
            Using the IV Slider
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The IV slider lets you simulate "what-if" scenarios to see how changes in volatility affect your position.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 border space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Current IV:</span>
              <Badge>32%</Badge>
            </div>
            <div className="h-2 bg-muted rounded-full">
              <div className="h-2 bg-primary rounded-full w-1/3"></div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <span>Drag the slider to see how your P/L heatmap changes with different volatility levels. This is crucial for understanding IV crush risk after earnings.</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            IV Crush Explained
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            IV typically spikes before uncertain events (earnings, FDA decisions) and drops sharply after the event - even if the stock moves in your favor!
          </p>
          <div className="p-4 border rounded-lg bg-amber-500/5 border-amber-500/20">
            <p className="font-medium mb-2">Example:</p>
            <p className="text-sm text-muted-foreground">
              You buy a call before earnings. Stock rises 5% but IV drops from 80% to 40%. Your option could still lose money because the IV crush destroyed more value than the stock move created.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SavingShareSection() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Save className="h-5 w-5 text-primary" />
            Saving Your Trades
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Save your strategies to track their performance over time. Saved trades update with real-time market data so you can monitor unrealized P/L.
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Track Open Positions</p>
                <p className="text-sm text-muted-foreground">See real-time unrealized gains/losses</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Review Past Trades</p>
                <p className="text-sm text-muted-foreground">Learn from your trading history</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Quick Resume</p>
                <p className="text-sm text-muted-foreground">Load any saved trade back into the builder</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Share2 className="h-5 w-5 text-primary" />
            Sharing Strategies
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Share your strategies with others using a unique link. Recipients can view your strategy setup, P/L projections, and Greeks - perfect for discussing trades.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 border">
            <p className="text-xs text-muted-foreground mb-2">Shareable Link:</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-background px-2 py-1 rounded border flex-1 truncate">
                optionbuild.app/share/xyz123...
              </code>
              <Button size="sm" variant="outline">Copy</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TutorialHeader() {
  const [, setLocation] = useLocation();
  
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 md:px-6 flex h-16 items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">OptionBuild</span>
          </Link>
          <Badge variant="secondary" className="hidden sm:flex">
            <BookOpen className="h-3 w-3 mr-1" />
            Tutorial
          </Badge>
        </div>

        <nav className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            data-testid="button-nav-home"
          >
            <Home className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Home</span>
          </Button>
          <Button
            onClick={() => setLocation("/builder")}
            size="sm"
            data-testid="button-nav-builder"
          >
            Launch Builder
          </Button>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

export default function Tutorial() {
  const [currentStep, setCurrentStep] = useState(0);

  const tutorialSteps: TutorialStep[] = [
    {
      id: 1,
      title: "Option Basics",
      icon: <BookOpen className="h-5 w-5" />,
      content: <OptionBasicsSection />,
    },
    {
      id: 2,
      title: "Building Strategies",
      icon: <Layers className="h-5 w-5" />,
      content: <StrategyBuilderSection />,
    },
    {
      id: 3,
      title: "Reading the P/L Heatmap",
      icon: <Grid3X3 className="h-5 w-5" />,
      content: <PLHeatmapSection />,
    },
    {
      id: 4,
      title: "Understanding Greeks",
      icon: <Activity className="h-5 w-5" />,
      content: <GreeksSection />,
    },
    {
      id: 5,
      title: "Implied Volatility",
      icon: <Zap className="h-5 w-5" />,
      content: <IVSection />,
    },
    {
      id: 6,
      title: "Saving & Sharing",
      icon: <Save className="h-5 w-5" />,
      content: <SavingShareSection />,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <TutorialHeader />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <ChevronRight className="h-4 w-4" />
            <span>Tutorials</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Options Builder Tutorial</h1>
          <p className="text-lg text-muted-foreground">
            Learn how to build, analyze, and manage options strategies like a pro.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-6">
          {tutorialSteps.map((step, index) => (
            <Button
              key={step.id}
              variant={currentStep === index ? "default" : "outline"}
              size="sm"
              className="flex-col h-auto py-2 gap-1"
              onClick={() => setCurrentStep(index)}
              data-testid={`button-tutorial-step-${step.id}`}
            >
              {step.icon}
              <span className="text-xs text-center leading-tight">{step.title}</span>
            </Button>
          ))}
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            {tutorialSteps[currentStep].content}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            data-testid="button-tutorial-prev-bottom"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          {currentStep === tutorialSteps.length - 1 ? (
            <Link href="/builder">
              <Button data-testid="button-start-building">
                Start Building
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          ) : (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              data-testid="button-tutorial-next-bottom"
            >
              Next Step
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>

      </main>
    </div>
  );
}
