import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Calculator, BookOpen } from "lucide-react";
import heroImage from "@assets/generated_images/Trading_workspace_hero_image_f5851d25.png";

interface HeroSectionProps {
  onGetStarted: () => void;
}

export function HeroSection({ onGetStarted }: HeroSectionProps) {
  return (
    <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${heroImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/70 to-black/60" />
      </div>

      <div className="container relative z-10 mx-auto px-4 md:px-6 py-20">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Build & Visualize Options Strategies
          </h1>
          <p className="text-xl md:text-2xl text-gray-200 mb-8">
            Professional options analysis with real-time P/L charts, Greeks calculator, and 10+ strategy templates. Free to start.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8"
              onClick={onGetStarted}
              data-testid="button-get-started"
            >
              Build Strategy Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-8 bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
              data-testid="button-view-templates"
            >
              View Templates
            </Button>
          </div>

          <div className="flex flex-wrap gap-6 text-white/90">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              <span className="text-sm">Real-time P/L Charts</span>
            </div>
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-blue-400" />
              <span className="text-sm">Greeks Analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-purple-400" />
              <span className="text-sm">10+ Strategy Templates</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
