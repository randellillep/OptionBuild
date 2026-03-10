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
    content: [
      {
        heading: "Use of the Service",
        text: "OptionBuild provides tools and features for analyzing options strategies, including strategy builders, profit/loss charts, Greeks analysis, backtesting, strategy templates, and other educational and analytical tools. The Service is intended solely for informational and educational purposes. You acknowledge that OptionBuild is not a broker, broker-dealer, financial advisor, or investment advisor, and the Service does not provide investment recommendations or financial advice. Any trading decisions made by users are their own responsibility, and OptionBuild does not guarantee the outcome of any trades, simulated or actual.",
      },
      {
        heading: "Broker Integration and Trade Execution",
        text: "The Service may allow users to connect their brokerage accounts through supported third-party brokers. OptionBuild acts solely as a technical interface, enabling users to send orders to their connected broker for execution. OptionBuild does not execute trades, hold funds, or manage accounts. All trades submitted through the Service are executed directly by the connected broker and are governed by the broker's terms and policies. You acknowledge that OptionBuild is not responsible for trade execution, order pricing, slippage, or any losses resulting from trading activity. By connecting your brokerage account, you authorize OptionBuild to communicate with the broker's systems for the purpose of facilitating user-initiated trades only.",
      },
      {
        heading: "Simulation and Strategy Disclaimers",
        text: "All charts, backtests, strategy outputs, and other analytical tools provided by the Service are hypothetical and for informational purposes only. Results derived from simulations may not reflect actual market conditions, including but not limited to liquidity, slippage, or execution speed. Past performance of any strategy or analytical output does not guarantee future results, and you should not rely solely on simulations or analysis provided by the Service when making trading decisions.",
      },
      {
        heading: "Risk Disclosure",
        text: "Options trading and other derivative instruments involve substantial risk and may not be suitable for all investors. You may incur significant financial losses, and the use of the Service does not mitigate this risk. You should have a thorough understanding of the characteristics, risks, and potential losses associated with trading options before using the Service. OptionBuild assumes no responsibility for any financial losses, direct or indirect, resulting from trading or relying on the Service.",
      },
      {
        heading: "Market Data Disclaimer",
        text: "Market data displayed or made available through the Service may be obtained from third-party vendors. OptionBuild does not guarantee the accuracy, timeliness, completeness, or reliability of such data. Data may be delayed, incomplete, or otherwise inaccurate. Users should independently verify all data before making trading or investment decisions. OptionBuild is not responsible for errors, omissions, or delays in market data provided by third-party sources.",
      },
      {
        heading: "Intellectual Property",
        text: "All content, software, algorithms, charts, graphics, icons, logos, designs, and other materials available through the Service are the intellectual property of OptionBuild or its licensors. You may access, view, download, or print materials for personal, non-commercial use only, provided you do not modify, distribute, sell, or create derivative works from such content without prior written permission. All rights not expressly granted are reserved.",
      },
      {
        heading: "Acceptable Use",
        text: "You may not reverse engineer, scrape, or otherwise attempt to extract data from the Service, interfere with platform functionality, share your account with others, or otherwise misuse the Service. OptionBuild reserves the right to monitor usage and suspend or terminate access for violations at its discretion.",
      },
      {
        heading: "Limitation of Liability",
        text: "To the fullest extent permitted by law, OptionBuild and its affiliates, officers, employees, agents, or licensors shall not be liable for any indirect, incidental, consequential, or special damages, including but not limited to trading losses, lost profits, loss of data, or business interruption, arising from or related to your use of or inability to use the Service. Your sole remedy is limited to the Service's functionality, and OptionBuild's liability shall not exceed the fees paid by you in the six months preceding any claim.",
      },
      {
        heading: "Termination",
        text: "OptionBuild may suspend or terminate your access at any time, with or without notice, for violation of these Terms, misuse of the Service, or any legal or security reason. Users may terminate by discontinuing use of the Service.",
      },
      {
        heading: "Amendments",
        text: "OptionBuild may revise these Terms at any time. The latest version will be posted on the website. Continued use constitutes acceptance of updated Terms. If you do not agree, you must immediately stop using the Service.",
      },
      {
        heading: "No Fiduciary Relationship",
        text: "Use of the Service does not create any fiduciary or advisory relationship between OptionBuild and the user. All decisions and actions taken by the user are at their sole risk.",
      },
      {
        heading: "Governing Law and Dispute Resolution",
        text: "This Agreement is governed by applicable federal law and the laws of the State of New York, without regard to conflict of law principles. Any disputes arising from this Agreement shall be resolved through binding arbitration under the rules of the American Arbitration Association, except as otherwise required by law. Arbitration shall be conducted in English and any decision shall be final and binding. Users retain the right to seek injunctive relief in a court of competent jurisdiction for intellectual property or confidentiality matters.",
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    content: [
      {
        heading: "Data Collection and Use",
        text: "OptionBuild collects and uses personal information to operate and improve the Service. Data collected may include your email address, account credentials, usage statistics, device and browser information, and other analytics. This information is used to provide platform functionality, monitor usage, prevent abuse, and improve user experience.",
      },
      {
        heading: "Cookies and Tracking",
        text: "Cookies and similar technologies may be used for session management, personalization, and analytics. You can manage cookie preferences through your browser settings, though disabling cookies may affect Service functionality.",
      },
      {
        heading: "Data Protection",
        text: "Personal data is protected with reasonable security measures. OptionBuild does not sell your personal data to third parties. Data is only shared with service providers necessary to operate the platform, and only to the extent required.",
      },
      {
        heading: "Your Rights",
        text: "Users in the European Economic Area have rights under GDPR to access, correct, delete, or restrict the processing of their personal information. To exercise these rights, contact us at support@optionbuild.com.",
      },
    ],
  },
  {
    id: "risk-disclosure",
    title: "Options Trading Risk Disclosure",
    content: [
      {
        heading: "",
        text: "Options trading carries significant risk and may not be suitable for all investors. Losses can exceed initial investments. Users should understand the mechanics, risks, and characteristics of trading options before engaging. All tools, charts, strategies, and backtests provided by OptionBuild are for informational purposes only and are not a guarantee of trading success or profit. Users are solely responsible for their trading decisions.",
      },
    ],
  },
  {
    id: "market-data",
    title: "Market Data Disclaimer",
    content: [
      {
        heading: "",
        text: "Market data provided by OptionBuild may be sourced from third-party vendors. OptionBuild does not guarantee the accuracy, timeliness, or completeness of such data. Delays, errors, or omissions may occur. Users should independently verify all information before executing trades or making investment decisions. OptionBuild is not liable for any losses resulting from reliance on such data.",
      },
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
        setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 100);
      }
    }
  }, []);

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
            <div className="text-center mb-12">
              <h1 className="text-3xl md:text-4xl font-bold mb-3" data-testid="text-terms-title">
                Terms and Legal
              </h1>
              <p className="text-muted-foreground text-lg">
                By using OptionBuild, you agree to the following terms and policies.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Last updated: March 2026
              </p>
            </div>

            <nav className="mb-10">
              <Card className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  On this page
                </p>
                <ul className="space-y-1.5">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
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

            <div className="space-y-14">
              {sections.map((section) => (
                <section key={section.id} id={section.id} data-testid={`section-${section.id}`}>
                  <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-border">
                    {section.title}
                  </h2>
                  <div className="space-y-6">
                    {section.content.map((item, idx) => (
                      <div key={idx}>
                        {item.heading && (
                          <h3 className="text-base font-semibold mb-2">{item.heading}</h3>
                        )}
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {item.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-14 pt-8 border-t border-border text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Questions about these terms?
              </p>
              <a
                href="mailto:support@optionbuild.com"
                className="text-primary text-sm font-medium hover:underline"
                data-testid="link-contact-terms"
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
