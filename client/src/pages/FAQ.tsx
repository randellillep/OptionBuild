import { TrendingUp } from "lucide-react";

import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link, useLocation } from "wouter";

const faqItems = [
  {
    question: "What is OptionBuild?",
    answer:
      "OptionBuild is a professional options strategy building and analysis platform. It allows you to construct multi-leg options strategies, visualize profit and loss scenarios with interactive charts, calculate Greeks, and backtest strategies against historical data — all in one place.",
  },
  {
    question: "Is OptionBuild free?",
    answer:
      "Yes, OptionBuild is currently free to use. You get full access to the strategy builder, 30+ strategy templates, P/L chart visualization, Greeks calculator, and unlimited strategies at no cost.",
  },
  {
    question: "How do I build an options strategy?",
    answer:
      "Navigate to the Strategy Builder from the top menu. You can start from scratch by adding individual option legs (calls or puts, long or short) or choose from one of our 10+ pre-built strategy templates like bull call spreads, iron condors, and straddles. Adjust strike prices, expiration dates, and quantities to customize your strategy, then view the P/L chart and Greeks in real time.",
  },
  {
    question: "What is the Black-Scholes model?",
    answer:
      "The Black-Scholes model is an industry-standard mathematical model used for pricing European-style options. OptionBuild uses this model to calculate theoretical option prices and Greeks (Delta, Gamma, Theta, Vega, Rho). The model takes into account the underlying price, strike price, time to expiration, risk-free interest rate, and implied volatility to produce accurate pricing estimates.",
  },
  {
    question: "How does backtesting work?",
    answer:
      "The backtesting engine lets you test your options strategies against historical market data. Select a strategy, define entry and exit rules, choose a date range, and the engine simulates how your strategy would have performed. You can review trade-by-trade results, equity curves, and performance metrics to evaluate the strategy before risking real capital.",
  },
  {
    question: "Can I execute trades directly?",
    answer:
      "Yes, OptionBuild supports trade execution through Alpaca. Once you connect your brokerage account, you can execute trades directly from the strategy builder without leaving the platform.",
  },
  {
    question: "How do I connect my brokerage account?",
    answer:
      "Go to the Strategy Builder and look for the brokerage connection option. You can connect your Alpaca account by providing your API key and secret. Once connected, you can view positions and execute trades directly from the platform. Your credentials are securely stored and never shared.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Yes, we take security seriously. All data is transmitted over encrypted HTTPS connections. Brokerage API credentials are securely stored and never exposed. We do not sell or share your personal data or trading activity with third parties.",
  },
  {
    question: "How do I delete my account?",
    answer:
      "You can delete your account from the Account Settings page. Navigate to your account settings, scroll to the Account section, and click \"Delete Account.\" You will be asked to confirm the deletion via email. Once confirmed, your account and all associated data will be permanently removed.",
  },
  {
    question: "How can I contact support?",
    answer:
      "For any questions, issues, or feedback, please reach out to us at support@optionbuild.com. We aim to respond to all inquiries within 24 hours.",
  },
];

export default function FAQ() {
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
        <div className="container mx-auto px-4 md:px-6 py-12 md:py-20">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <h1 className="text-3xl md:text-4xl font-bold mb-3" data-testid="text-faq-title">
                Frequently Asked Questions
              </h1>
              <p className="text-muted-foreground text-lg">
                Everything you need to know about OptionBuild and options trading on our platform.
              </p>
            </div>

            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item, index) => (
                <AccordionItem key={index} value={`item-${index}`} data-testid={`accordion-item-${index}`}>
                  <AccordionTrigger
                    className="text-left text-base"
                    data-testid={`accordion-trigger-${index}`}
                  >
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent data-testid={`accordion-content-${index}`}>
                    <p className="text-muted-foreground leading-relaxed">
                      {item.answer}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <div className="mt-12 text-center">
              <p className="text-muted-foreground mb-4">
                Still have questions? We're here to help.
              </p>
              <a
                href="mailto:support@optionbuild.com"
                className="text-primary font-medium hover:underline"
                data-testid="link-contact-support"
              >
                support@optionbuild.com
              </a>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
