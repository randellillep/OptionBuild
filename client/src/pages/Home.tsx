import { useState } from "react";
import { HeroSection } from "@/components/HeroSection";
import { FeatureCard } from "@/components/FeatureCard";
import { StrategyTemplateCard } from "@/components/StrategyTemplateCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import {
  TrendingUp,
  Calculator,
  Search,
  LineChart,
  BarChart3,
  Layers,
  ArrowRight,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { strategyTemplates } from "@/lib/strategy-templates";
import { useLocation } from "wouter";

import heatmapImg from "@assets/product_heatmap.png";
import greeksImg from "@assets/product_greeks.png";
import backtestImg from "@assets/product_backtest.png";
import strategiesImg from "@assets/product_strategies.png";
import plChartImg from "@assets/product_pl_chart.png";

export default function Home() {
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: BarChart3,
      title: "P/L Heatmap",
      description: "Visualize profit and loss across price and time with a color-coded grid. See exactly how your position performs at every price level.",
      image: heatmapImg,
    },
    {
      icon: Calculator,
      title: "Options Greeks",
      description: "Track delta, gamma, theta, vega, and rho for your entire position. Understand exactly how your strategy responds to market changes.",
      image: greeksImg,
    },
    {
      icon: Layers,
      title: "30+ Strategy Templates",
      description: "Pre-built strategies including spreads, straddles, condors, and butterflies. Select a template and customize it to your needs.",
      image: strategiesImg,
    },
    {
      icon: BarChart3,
      title: "Backtesting",
      description: "Test your strategies against historical data. See win rates, drawdowns, and performance metrics before risking real capital.",
      image: backtestImg,
    },
    {
      icon: LineChart,
      title: "P/L Chart",
      description: "Interactive payoff diagrams showing breakeven points, max profit, and max loss zones with real-time updates as you adjust positions.",
      image: plChartImg,
    },
    {
      icon: Search,
      title: "Option Finder",
      description: "Search and filter options chains by strike, expiration, and Greeks. Find the best contracts for your strategy quickly.",
      image: null,
    },
  ];

  const getRiskLevel = (legCount: number): "Low" | "Medium" | "High" => {
    if (legCount === 1) return "Medium";
    if (legCount === 2) return "Low";
    return "High";
  };

  const getSentiment = (template: typeof strategyTemplates[0]): string => {
    const meta = template.metadata;
    if (!meta) return "neutral";
    if (meta.category === "bullish") return "bullish";
    if (meta.category === "bearish") return "bearish";
    return "neutral";
  };

  const featuredStrategies = [
    0,  // Long Call
    1,  // Long Put
    6,  // Bull Call Spread
    10, // Bear Put Spread
    16, // Iron Condor
    22, // Long Straddle
    26, // Long Call Butterfly
    4,  // Protective Put
    2,  // Covered Call
  ].filter(i => i < strategyTemplates.length);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 md:px-6 flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold">OptionBuild</span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-features">
              Features
            </a>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-nav-strategies"
            >
              Strategies
            </button>
            <button
              onClick={() => setLocation("/tutorial")}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-nav-tutorial"
            >
              Tutorial
            </button>
            <button
              onClick={() => setLocation("/blog")}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-nav-blog"
            >
              Blog
            </button>
            <Button
              onClick={() => setLocation("/builder")}
              data-testid="button-nav-builder"
            >
              Launch Builder
            </Button>
          </nav>

          <div className="flex md:hidden items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background px-4 py-3 space-y-1">
            <a href="#features" className="block py-2 text-sm font-medium text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <button onClick={() => { setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="block py-2 text-sm font-medium text-muted-foreground w-full text-left">Strategies</button>
            <button onClick={() => { setMobileMenuOpen(false); setLocation("/tutorial"); }} className="block py-2 text-sm font-medium text-muted-foreground w-full text-left">Tutorial</button>
            <button onClick={() => { setMobileMenuOpen(false); setLocation("/blog"); }} className="block py-2 text-sm font-medium text-muted-foreground w-full text-left">Blog</button>
            <Button className="w-full mt-2" onClick={() => { setMobileMenuOpen(false); setLocation("/builder"); }}>Launch Builder</Button>
          </div>
        )}
      </header>

      <HeroSection
        onGetStarted={() => setLocation("/builder")}
        onBuildStrategy={(symbol, strategyIndex) => {
          setLocation(`/builder?symbol=${encodeURIComponent(symbol)}&strategy=${strategyIndex}`);
        }}
      />

      <section id="features" className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Professional Options Analysis Tools
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to build, analyze, and optimize options trading strategies
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, idx) => (
              <FeatureCard
                key={idx}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                image={feature.image || undefined}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
            <div className="flex-1 max-w-lg">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                Trade Directly From the Builder
              </h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Connect your brokerage account and execute trades without leaving OptionBuild. 
                Build your strategy, analyze the risk, and place the order — all in one workflow.
              </p>
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                    <Layers className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="text-sm font-medium">Alpaca</span>
                    <span className="text-xs text-muted-foreground ml-2">Paper + Live Trading</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="text-sm font-medium">tastytrade</span>
                    <span className="text-xs text-muted-foreground ml-2">Sandbox + Live Trading</span>
                  </div>
                </div>
              </div>
              <Button variant="outline" onClick={() => setLocation("/builder?tab=trade")} data-testid="button-connect-brokerage">
                Connect Your Broker
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <div className="flex-1 w-full max-w-md">
              <Card className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Account Status</span>
                    <span className="text-xs text-green-500 font-medium">Connected</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Buying Power</p>
                      <p className="text-lg font-semibold font-mono">$25,430</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Portfolio Value</p>
                      <p className="text-lg font-semibold font-mono">$52,180</p>
                    </div>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Last Order: AAPL 260C Mar 11</span>
                    <span className="text-xs text-green-500">Filled</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section id="strategies" className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Popular Strategy Templates
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Start with proven strategies and customize to your needs. Click any template to open it in the builder.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {featuredStrategies.map((templateIdx) => {
              const template = strategyTemplates[templateIdx];
              return (
                <StrategyTemplateCard
                  key={templateIdx}
                  name={template.name}
                  description={template.description}
                  legCount={template.legs.length}
                  riskLevel={getRiskLevel(template.legs.length)}
                  sentiment={getSentiment(template)}
                  onSelect={() => setLocation(`/builder?strategy=${templateIdx}`)}
                />
              );
            })}
          </div>

          <div className="text-center">
            <Button
              size="lg"
              variant="outline"
              onClick={() => setLocation("/builder?openStrategies=1")}
              data-testid="button-view-all-strategies"
            >
              View All {strategyTemplates.length} Strategies
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Start Building Strategies
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            Free to use. No account required to get started. Real-time market data, 
            30+ strategy templates, and professional analysis tools.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" onClick={() => setLocation("/builder")} data-testid="button-cta-launch">
              Launch Builder
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => setLocation("/tutorial")} data-testid="button-cta-tutorial">
              Watch Tutorial
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10 bg-muted/20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-semibold mb-3 text-sm">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-foreground transition-colors">Strategies</button></li>
                <li><button onClick={() => setLocation("/builder")} className="hover:text-foreground transition-colors">Builder</button></li>
                <li><button onClick={() => setLocation("/backtest")} className="hover:text-foreground transition-colors">Backtest</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><button onClick={() => setLocation("/tutorial")} className="hover:text-foreground transition-colors">Tutorial</button></li>
                <li><button onClick={() => setLocation("/faq")} className="hover:text-foreground transition-colors">FAQ</button></li>
                <li><button onClick={() => setLocation("/blog")} className="hover:text-foreground transition-colors">Blog</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="mailto:support@optionbuild.com" className="hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <p className="text-xs text-muted-foreground text-center">
              Options trading involves risk and is not suitable for all investors. OptionBuild provides analysis tools only and does not provide investment advice.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
