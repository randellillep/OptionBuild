import { TrendingUp } from "lucide-react";
import { SiDiscord, SiX, SiYoutube, SiGithub } from "react-icons/si";

export function Footer() {
  return (
    <footer className="w-full border-t border-border bg-card/50 mt-8">
      <div className="container mx-auto px-4 md:px-6 py-8">
        <div className="flex flex-col md:flex-row justify-between gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">OptionFlow</span>
            </div>
            
            <div className="flex items-center gap-3">
              <a 
                href="#" 
                className="w-8 h-8 rounded-md bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="Discord"
              >
                <SiDiscord className="h-4 w-4 text-muted-foreground" />
              </a>
              <a 
                href="#" 
                className="w-8 h-8 rounded-md bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="X (Twitter)"
              >
                <SiX className="h-4 w-4 text-muted-foreground" />
              </a>
              <a 
                href="#" 
                className="w-8 h-8 rounded-md bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="YouTube"
              >
                <SiYoutube className="h-4 w-4 text-muted-foreground" />
              </a>
              <a 
                href="#" 
                className="w-8 h-8 rounded-md bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="GitHub"
              >
                <SiGithub className="h-4 w-4 text-muted-foreground" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="flex flex-col gap-2">
              <h4 className="font-semibold text-sm mb-1">Tools</h4>
              <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Strategy Builder
              </a>
              <a href="/option-finder" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Option Finder
              </a>
              <a href="/backtest" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Backtest
              </a>
            </div>

            <div className="flex flex-col gap-2">
              <h4 className="font-semibold text-sm mb-1">Resources</h4>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Tutorials
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Blog
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                FAQ
              </a>
            </div>

            <div className="flex flex-col gap-2">
              <h4 className="font-semibold text-sm mb-1">Company</h4>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                About
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Contact
              </a>
            </div>

            <div className="flex flex-col gap-2">
              <h4 className="font-semibold text-sm mb-1">Legal</h4>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-6">
          <p className="text-xs text-muted-foreground text-center leading-relaxed max-w-4xl mx-auto">
            Options involve a high degree of risk and are not suitable for all investors. OptionFlow is not an investment advisor. 
            The calculations, information, and opinions on this site are for educational purposes only and are not investment advice. 
            Calculations are estimates and do not account for all market conditions and events.
          </p>
          <p className="text-xs text-muted-foreground text-center mt-4">
            &copy; {new Date().getFullYear()} OptionFlow. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
