import { HeroSection } from "@/components/HeroSection";
import { FeatureCard } from "@/components/FeatureCard";
import { StrategyTemplateCard } from "@/components/StrategyTemplateCard";
import { PricingCard } from "@/components/PricingCard";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { 
  TrendingUp, 
  Calculator, 
  BookOpen, 
  LineChart, 
  Shield, 
  Zap,
  Menu
} from "lucide-react";
import { strategyTemplates } from "@/lib/strategy-templates";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();

  const features = [
    {
      icon: TrendingUp,
      title: "Interactive P/L Charts",
      description: "Visualize profit and loss across different price scenarios with real-time interactive charts and breakeven analysis.",
    },
    {
      icon: Calculator,
      title: "Greeks Calculator",
      description: "Track delta, gamma, theta, vega, and rho for your entire position to understand risk exposure.",
    },
    {
      icon: BookOpen,
      title: "10+ Strategy Templates",
      description: "Pre-built strategies including spreads, straddles, condors, and butterflies ready to customize.",
    },
    {
      icon: LineChart,
      title: "Black-Scholes Pricing",
      description: "Accurate option pricing using industry-standard Black-Scholes model with customizable parameters.",
    },
    {
      icon: Shield,
      title: "Risk Analysis",
      description: "Understand max profit, max loss, and risk/reward ratios before entering any trade.",
    },
    {
      icon: Zap,
      title: "Real-time Updates",
      description: "See instant changes to P/L and Greeks as you adjust strikes, quantities, and expiration dates.",
    },
  ];

  const getRiskLevel = (legCount: number): "Low" | "Medium" | "High" => {
    if (legCount === 1) return "Medium";
    if (legCount === 2) return "Low";
    return "High";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 md:px-6 flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">OptionFlow</span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">
              Features
            </a>
            <a href="#strategies" className="text-sm font-medium hover:text-primary transition-colors">
              Strategies
            </a>
            <a href="#pricing" className="text-sm font-medium hover:text-primary transition-colors">
              Pricing
            </a>
            <button
              onClick={() => setLocation("/tutorial")}
              className="text-sm font-medium hover:text-primary transition-colors"
              data-testid="button-nav-tutorial"
            >
              Tutorial
            </button>
            <Button
              onClick={() => setLocation("/builder")}
              data-testid="button-nav-builder"
            >
              Launch Builder
            </Button>
            <ThemeToggle />
          </nav>

          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="icon" data-testid="button-menu">
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <HeroSection onGetStarted={() => setLocation("/builder")} />

      <section id="features" className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Professional Options Analysis Tools
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to build, analyze, and optimize options trading strategies
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <FeatureCard key={idx} {...feature} />
            ))}
          </div>
        </div>
      </section>

      <section id="strategies" className="py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Popular Strategy Templates
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Start with proven strategies and customize to your needs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {strategyTemplates.slice(0, 6).map((template, idx) => (
              <StrategyTemplateCard
                key={idx}
                name={template.name}
                description={template.description}
                legCount={template.legs.length}
                riskLevel={getRiskLevel(template.legs.length)}
                onSelect={() => setLocation("/builder")}
              />
            ))}
          </div>

          <div className="text-center">
            <Button
              size="lg"
              variant="outline"
              onClick={() => setLocation("/builder")}
              data-testid="button-view-all-strategies"
            >
              View All {strategyTemplates.length} Strategies
            </Button>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Start free and upgrade when you need more features
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <PricingCard
              name="Free"
              price="Free"
              features={[
                "Full strategy builder",
                "10+ strategy templates",
                "P/L chart visualization",
                "Basic Greeks calculator",
                "Unlimited strategies",
              ]}
              onSelect={() => setLocation("/builder")}
            />
            <PricingCard
              name="Pro"
              price="$25"
              period="month"
              isFeatured={true}
              features={[
                "Everything in Free",
                "Real-time market data",
                "Advanced Greeks analysis",
                "Strategy optimizer",
                "Export to PDF",
                "Priority support",
              ]}
              onSelect={() => console.log("Pro selected")}
            />
            <PricingCard
              name="Enterprise"
              price="$99"
              period="month"
              features={[
                "Everything in Pro",
                "API access",
                "Custom integrations",
                "White-label options",
                "Dedicated support",
                "SLA guarantee",
              ]}
              onSelect={() => console.log("Enterprise selected")}
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-12 bg-muted/20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-semibold mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Strategies
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Pricing
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Tutorials
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Blog
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Terms
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-8">
            <p className="text-sm text-muted-foreground text-center">
              © 2024 OptionFlow. All rights reserved. Options trading involves risk and is not suitable for all investors.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
