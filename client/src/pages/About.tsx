import { TrendingUp, BarChart3, LineChart, Calculator, Layers, Search, ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link, useLocation } from "wouter";

export default function About() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 md:px-6 flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2" data-testid="link-home">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">OptionBuild</span>
          </Link>

          <div className="flex items-center gap-4 flex-wrap">
            <Button
              variant="ghost"
              onClick={() => setLocation("/builder")}
              data-testid="button-nav-builder"
            >
              Builder
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 md:px-6 py-12 md:py-16">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <h1 className="text-3xl md:text-4xl font-bold mb-3" data-testid="text-about-title">
                About OptionBuild
              </h1>
              <p className="text-muted-foreground text-lg">
                Professional options analysis tools, free and accessible to everyone.
              </p>
            </div>

            <div className="space-y-6 mb-12">
              <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-about-intro">
                OptionBuild is an options strategy builder and analysis platform designed for traders who want to understand their positions before placing a trade. Whether you're learning options for the first time or managing complex multi-leg strategies, our tools help you visualize risk, model scenarios, and make more informed decisions.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The platform is built around the Black-Scholes pricing model and provides real-time P/L heatmaps, payoff charts, Greeks calculations, and a backtesting engine — all running directly in your browser with live market data.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                OptionBuild is free to use. No account is required to access the strategy builder, and there are no paywalls or feature restrictions. We believe every trader should have access to the same quality of analysis tools regardless of account size.
              </p>
            </div>

            <h2 className="text-xl font-bold mb-4" data-testid="text-about-features-heading">
              What you can do
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-12">
              {[
                { icon: BarChart3, label: "P/L Heatmap", desc: "Visualize profit and loss across price and time" },
                { icon: LineChart, label: "Payoff Charts", desc: "Interactive breakeven and max P/L diagrams" },
                { icon: Calculator, label: "Greeks Analysis", desc: "Delta, gamma, theta, vega, rho for any position" },
                { icon: Layers, label: "30+ Templates", desc: "Pre-built strategies from spreads to condors" },
                { icon: BarChart3, label: "Backtesting", desc: "Test strategies against historical data" },
                { icon: Search, label: "Option Finder", desc: "Search and filter options chains quickly" },
              ].map((item) => (
                <Card key={item.label} className="p-4" data-testid={`card-about-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <item.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <h2 className="text-xl font-bold mb-4" data-testid="text-about-broker-heading">
              Brokerage integration
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
              OptionBuild supports connecting your Alpaca or tastytrade account so you can build a strategy, review the analysis, and place the trade — all without leaving the platform. Both paper trading and live trading are supported. Your credentials are stored securely on the server and are never exposed to the browser.
            </p>

            <div className="text-center pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground mb-4">
                Ready to get started?
              </p>
              <Button onClick={() => setLocation("/builder")} data-testid="button-about-launch">
                Launch Builder
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
