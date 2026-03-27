import { useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link, useLocation } from "wouter";

const sections = [
  {
    id: "terms",
    title: "Terms of Service",
    paragraphs: [
      "By using OptionBuild you agree to these terms. OptionBuild provides options strategy analysis tools for informational and educational purposes only. We are not a broker, financial advisor, or investment advisor and do not provide investment recommendations. All trading decisions are your own responsibility.",
      "You may connect third-party brokerage accounts (e.g. Alpaca) through the platform. OptionBuild acts only as a technical interface — all trades are executed by your broker under their terms. We do not execute trades, hold funds, or manage accounts, and are not responsible for order execution, pricing, or slippage.",
      "All charts, backtests, and strategy outputs are hypothetical. Simulated results may not reflect real market conditions such as liquidity or execution speed. Past performance does not guarantee future results. Options trading involves substantial risk and may not be suitable for all investors — losses can exceed your initial investment.",
      "All platform content, software, and materials are the intellectual property of OptionBuild. Personal, non-commercial use only. You may not reverse engineer, scrape, or misuse the Service. We may suspend access for violations at our discretion.",
      "To the fullest extent permitted by law, OptionBuild is not liable for any indirect, incidental, or consequential damages including trading losses. We may update these terms at any time — continued use constitutes acceptance. This agreement is governed by the laws of the State of New York. Disputes shall be resolved through binding arbitration.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    paragraphs: [
      "We collect personal information (email, account credentials, usage data, device info) to operate and improve the platform. Cookies may be used for session management, personalization, and analytics.",
      "OptionBuild does not sell your personal data. Data is shared only with service providers necessary to operate the platform. We use reasonable security measures to protect your information. EU users have GDPR rights to access, correct, delete, or restrict processing of their data — contact support@optionbuild.com to exercise these rights.",
    ],
  },
  {
    id: "disclaimers",
    title: "Risk and Data Disclaimers",
    paragraphs: [
      "Options trading carries significant risk and may not be suitable for all investors. Losses can exceed initial investments. All tools, charts, strategies, and backtests are for informational purposes only and do not guarantee trading success. Users are solely responsible for their trading decisions.",
      "Market data may be sourced from third-party vendors. OptionBuild does not guarantee the accuracy, timeliness, or completeness of such data. Users should independently verify all information before making trading or investment decisions. OptionBuild is not liable for any losses resulting from reliance on market data.",
    ],
  },
];

export default function Terms() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        setTimeout(() => {
          const headerOffset = 80;
          const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
          window.scrollTo({ top, behavior: "smooth" });
        }, 100);
      }
    }
  }, []);

  const handleTocClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      const headerOffset = 80;
      const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

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
              <h1 className="text-3xl md:text-4xl font-bold mb-3" data-testid="text-terms-title">
                Terms & Privacy
              </h1>
              <p className="text-muted-foreground">
                By using OptionBuild, you agree to the following.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Last updated: March 2026
              </p>
            </div>

            <nav className="mb-8">
              <Card className="p-4">
                <ul className="flex flex-wrap items-center gap-x-6 gap-y-1">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        onClick={(e) => handleTocClick(e, section.id)}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        data-testid={`link-toc-${section.id}`}
                      >
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
            </nav>

            <div className="space-y-10">
              {sections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-24" data-testid={`section-${section.id}`}>
                  <h2 className="text-xl font-bold mb-4 pb-2 border-b border-border">
                    {section.title}
                  </h2>
                  <div className="space-y-3">
                    {section.paragraphs.map((text, idx) => (
                      <p key={idx} className="text-sm text-muted-foreground leading-relaxed">
                        {text}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-10 pt-6 border-t border-border text-center">
              <p className="text-sm text-muted-foreground">
                Questions? Contact{" "}
                <a
                  href="mailto:support@optionbuild.com"
                  className="text-primary font-medium hover:underline"
                  data-testid="link-contact-terms"
                >
                  support@optionbuild.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
