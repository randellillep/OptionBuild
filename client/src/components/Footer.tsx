import { TrendingUp } from "lucide-react";
import { SiDiscord, SiX, SiYoutube, SiGithub } from "react-icons/si";
import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="w-full border-t border-border bg-card/50 mt-8">
      <div className="container mx-auto px-4 md:px-6 py-8">
        <div className="flex flex-col md:flex-row justify-between gap-8">
          <div className="flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <TrendingUp className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">OptionFlow</span>
            </Link>
            
            <div className="flex items-center gap-3">
              <a 
                href="https://discord.com" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-md bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="Discord"
                data-testid="link-discord"
              >
                <SiDiscord className="h-4 w-4 text-muted-foreground" />
              </a>
              <a 
                href="https://x.com" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-md bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="X (Twitter)"
                data-testid="link-twitter"
              >
                <SiX className="h-4 w-4 text-muted-foreground" />
              </a>
              <a 
                href="https://youtube.com" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-md bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="YouTube"
                data-testid="link-youtube"
              >
                <SiYoutube className="h-4 w-4 text-muted-foreground" />
              </a>
              <a 
                href="https://github.com" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-md bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="GitHub"
                data-testid="link-github"
              >
                <SiGithub className="h-4 w-4 text-muted-foreground" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            <div className="flex flex-col gap-2">
              <h4 className="font-semibold text-sm mb-1">Tools</h4>
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-builder">
                Strategy Builder
              </Link>
              <Link href="/option-finder" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-finder">
                Option Finder
              </Link>
              <Link href="/backtest" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-backtest">
                Backtest
              </Link>
            </div>

            <div className="flex flex-col gap-2">
              <h4 className="font-semibold text-sm mb-1">Learn</h4>
              <span className="text-sm text-muted-foreground/50 cursor-default">
                Tutorials (Coming Soon)
              </span>
              <span className="text-sm text-muted-foreground/50 cursor-default">
                Blog (Coming Soon)
              </span>
              <span className="text-sm text-muted-foreground/50 cursor-default">
                FAQ (Coming Soon)
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <h4 className="font-semibold text-sm mb-1">Legal</h4>
              <span className="text-sm text-muted-foreground/50 cursor-default">
                Privacy (Coming Soon)
              </span>
              <span className="text-sm text-muted-foreground/50 cursor-default">
                Terms (Coming Soon)
              </span>
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
