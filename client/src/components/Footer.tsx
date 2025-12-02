import { TrendingUp } from "lucide-react";
import { SiDiscord, SiX, SiYoutube, SiGithub } from "react-icons/si";
import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="w-full mt-8 relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222,47%,8%)] via-[hsl(200,50%,10%)] to-[hsl(168,40%,12%)]" />
      
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `radial-gradient(circle at 25% 25%, hsl(168, 76%, 42%) 1px, transparent 1px)`,
        backgroundSize: '24px 24px'
      }} />
      
      {/* Top border glow */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      
      <div className="relative container mx-auto px-4 md:px-6 py-10">
        <div className="flex flex-col md:flex-row justify-between gap-8">
          <div className="flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="p-1.5 rounded-lg bg-primary/20 group-hover:bg-primary/30 transition-colors">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-primary/80 bg-clip-text text-transparent">
                OptionFlow
              </span>
            </Link>
            
            <div className="flex items-center gap-2">
              <a 
                href="https://discord.com" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#5865F2]/20 hover:border-[#5865F2]/50 hover:text-[#5865F2] transition-all duration-200"
                aria-label="Discord"
                data-testid="link-discord"
              >
                <SiDiscord className="h-4 w-4" />
              </a>
              <a 
                href="https://x.com" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/30 transition-all duration-200"
                aria-label="X (Twitter)"
                data-testid="link-twitter"
              >
                <SiX className="h-4 w-4" />
              </a>
              <a 
                href="https://youtube.com" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#FF0000]/20 hover:border-[#FF0000]/50 hover:text-[#FF0000] transition-all duration-200"
                aria-label="YouTube"
                data-testid="link-youtube"
              >
                <SiYoutube className="h-4 w-4" />
              </a>
              <a 
                href="https://github.com" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/30 transition-all duration-200"
                aria-label="GitHub"
                data-testid="link-github"
              >
                <SiGithub className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            <div className="flex flex-col gap-2">
              <h4 className="font-semibold text-sm mb-1 text-primary">Tools</h4>
              <Link href="/" className="text-sm text-white/70 hover:text-primary transition-colors" data-testid="link-builder">
                Strategy Builder
              </Link>
              <Link href="/option-finder" className="text-sm text-white/70 hover:text-primary transition-colors" data-testid="link-finder">
                Option Finder
              </Link>
              <Link href="/backtest" className="text-sm text-white/70 hover:text-primary transition-colors" data-testid="link-backtest">
                Backtest
              </Link>
            </div>

            <div className="flex flex-col gap-2">
              <h4 className="font-semibold text-sm mb-1 text-primary">Learn</h4>
              <span className="text-sm text-white/40 cursor-default">
                Tutorials (Coming Soon)
              </span>
              <span className="text-sm text-white/40 cursor-default">
                Blog (Coming Soon)
              </span>
              <span className="text-sm text-white/40 cursor-default">
                FAQ (Coming Soon)
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <h4 className="font-semibold text-sm mb-1 text-primary">Legal</h4>
              <span className="text-sm text-white/40 cursor-default">
                Privacy (Coming Soon)
              </span>
              <span className="text-sm text-white/40 cursor-default">
                Terms (Coming Soon)
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-6">
          <p className="text-xs text-white/50 text-center leading-relaxed max-w-4xl mx-auto">
            Options involve a high degree of risk and are not suitable for all investors. OptionFlow is not an investment advisor. 
            The calculations, information, and opinions on this site are for educational purposes only and are not investment advice. 
            Calculations are estimates and do not account for all market conditions and events.
          </p>
          <p className="text-xs text-white/40 text-center mt-4">
            &copy; {new Date().getFullYear()} OptionFlow. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
