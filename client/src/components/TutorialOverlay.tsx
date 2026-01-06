import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Search,
  Target,
  Grid3X3,
  Activity,
  Settings,
  Save,
  Lightbulb,
  BookOpen,
} from "lucide-react";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  targetSelector?: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
  tip?: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to OptionBuild",
    description: "This quick tour will help you understand the key features of the options strategy builder. You can exit anytime by clicking the X button.",
    icon: <BookOpen className="h-6 w-6" />,
    position: "center",
  },
  {
    id: "symbol-search",
    title: "1. Search for a Stock",
    description: "Start by entering a stock symbol (like AAPL or SPY) in the search bar. The app will fetch real-time price data and available options for your selected stock.",
    icon: <Search className="h-6 w-6" />,
    targetSelector: "[data-testid='symbol-search']",
    position: "bottom",
    tip: "Try popular stocks like AAPL, TSLA, SPY, or QQQ",
  },
  {
    id: "strategy-selector",
    title: "2. Choose a Strategy",
    description: "Select from pre-built strategy templates like Long Call, Put Spread, or Iron Condor. Each template is optimized for different market conditions.",
    icon: <Target className="h-6 w-6" />,
    targetSelector: "[data-testid='strategy-selector']",
    position: "bottom",
    tip: "Start with simple strategies like Long Call or Long Put before trying complex ones",
  },
  {
    id: "strike-ladder",
    title: "3. Select Strike Prices",
    description: "Use the strike ladder to choose your option strike prices. Green rows are calls, red rows are puts. Click to add or modify legs in your strategy.",
    icon: <Activity className="h-6 w-6" />,
    targetSelector: "[data-testid='strike-ladder']",
    position: "left",
    tip: "ATM (At-The-Money) strikes are highlighted and have the most liquidity",
  },
  {
    id: "heatmap",
    title: "4. Analyze the P/L Heatmap",
    description: "The heatmap shows your potential profit (green) and loss (red) across different stock prices and dates. Hover over cells to see exact values.",
    icon: <Grid3X3 className="h-6 w-6" />,
    targetSelector: "[data-testid='pl-heatmap']",
    position: "top",
    tip: "Watch how the colors change as you approach expiration - this is time decay (theta)",
  },
  {
    id: "iv-slider",
    title: "5. Adjust Implied Volatility",
    description: "Use the IV slider to simulate 'what-if' scenarios. See how changes in market volatility affect your position - crucial for understanding IV crush risk.",
    icon: <Settings className="h-6 w-6" />,
    targetSelector: "[data-testid='slider-volatility']",
    position: "top",
    tip: "IV typically drops after earnings announcements, reducing option values",
  },
  {
    id: "save-trade",
    title: "6. Save & Share Your Trade",
    description: "When you're happy with your strategy, save it to track performance over time or share it with others using a unique link.",
    icon: <Save className="h-6 w-6" />,
    targetSelector: "[data-testid='button-save-trade']",
    position: "left",
    tip: "Saved trades update in real-time so you can monitor your P/L",
  },
];

interface TutorialOverlayProps {
  onClose: () => void;
  isOpen: boolean;
}

export function TutorialOverlay({ onClose, isOpen }: TutorialOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  const step = tutorialSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tutorialSteps.length - 1;

  useEffect(() => {
    if (!isOpen) return;

    let pollInterval: NodeJS.Timeout | null = null;
    let pollAttempts = 0;
    const maxPollAttempts = 20;

    const updateHighlight = () => {
      if (step.targetSelector) {
        const element = document.querySelector(step.targetSelector);
        if (element) {
          const rect = element.getBoundingClientRect();
          setHighlightRect(rect);
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          setTimeout(() => {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 100);
        } else {
          setHighlightRect(null);
        }
      } else {
        setHighlightRect(null);
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      }
    };

    updateHighlight();

    if (step.targetSelector && !document.querySelector(step.targetSelector)) {
      pollInterval = setInterval(() => {
        pollAttempts++;
        const element = document.querySelector(step.targetSelector!);
        if (element || pollAttempts >= maxPollAttempts) {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          if (element) {
            updateHighlight();
          }
        }
      }, 200);
    }

    const handleScroll = () => updateHighlight();
    const handleResize = () => updateHighlight();

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [currentStep, step.targetSelector, isOpen]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (isLastStep) {
      onClose();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const getCardPosition = () => {
    if (!highlightRect || step.position === "center") {
      return {
        position: "fixed" as const,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const padding = 16;
    const cardWidth = 380;
    const cardHeight = 250;

    switch (step.position) {
      case "bottom":
        return {
          position: "fixed" as const,
          top: Math.min(highlightRect.bottom + padding, window.innerHeight - cardHeight - padding),
          left: Math.max(padding, Math.min(highlightRect.left, window.innerWidth - cardWidth - padding)),
        };
      case "top":
        return {
          position: "fixed" as const,
          top: Math.max(padding, highlightRect.top - cardHeight - padding),
          left: Math.max(padding, Math.min(highlightRect.left, window.innerWidth - cardWidth - padding)),
        };
      case "left":
        return {
          position: "fixed" as const,
          top: Math.max(padding, Math.min(highlightRect.top, window.innerHeight - cardHeight - padding)),
          left: Math.max(padding, highlightRect.left - cardWidth - padding),
        };
      case "right":
        return {
          position: "fixed" as const,
          top: Math.max(padding, Math.min(highlightRect.top, window.innerHeight - cardHeight - padding)),
          left: Math.min(highlightRect.right + padding, window.innerWidth - cardWidth - padding),
        };
      default:
        return {
          position: "fixed" as const,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        };
    }
  };

  return (
    <div className="fixed inset-0 z-[100]" data-testid="tutorial-overlay">
      <div 
        className="absolute inset-0 bg-black/60 transition-opacity duration-300"
        onClick={handleSkip}
      />

      {highlightRect && (
        <div
          className="absolute border-2 border-primary rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] pointer-events-none transition-all duration-300"
          style={{
            top: highlightRect.top - 4,
            left: highlightRect.left - 4,
            width: highlightRect.width + 8,
            height: highlightRect.height + 8,
          }}
        />
      )}

      <Card
        className="w-[380px] max-w-[calc(100vw-32px)] shadow-2xl border-primary/20 z-[101]"
        style={getCardPosition()}
        data-testid="tutorial-card"
      >
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                {step.icon}
              </div>
              <div>
                <Badge variant="secondary" className="mb-1">
                  Step {currentStep + 1} of {tutorialSteps.length}
                </Badge>
                <h3 className="font-semibold text-lg">{step.title}</h3>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 -mt-2 -mr-2"
              onClick={handleSkip}
              data-testid="button-tutorial-close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            {step.description}
          </p>

          {step.tip && (
            <div className="flex items-start gap-2 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4">
              <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <span className="text-muted-foreground">{step.tip}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              data-testid="button-tutorial-skip"
            >
              Skip Tour
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={isFirstStep}
                data-testid="button-tutorial-prev"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={handleNext}
                data-testid="button-tutorial-next"
              >
                {isLastStep ? "Finish" : "Next"}
                {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </div>

          <div className="flex justify-center gap-1.5 mt-4">
            {tutorialSteps.map((_, idx) => (
              <button
                key={idx}
                className={`w-2 h-2 rounded-full transition-colors ${
                  idx === currentStep ? "bg-primary" : "bg-muted-foreground/30"
                }`}
                onClick={() => setCurrentStep(idx)}
                data-testid={`button-tutorial-dot-${idx}`}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function useTutorial() {
  const [showTutorial, setShowTutorial] = useState(false);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(() => {
    return localStorage.getItem("optionbuild-tutorial-seen") === "true";
  });

  const startTutorial = () => {
    setShowTutorial(true);
  };

  const closeTutorial = () => {
    setShowTutorial(false);
    setHasSeenTutorial(true);
    localStorage.setItem("optionbuild-tutorial-seen", "true");
  };

  const resetTutorial = () => {
    localStorage.removeItem("optionbuild-tutorial-seen");
    setHasSeenTutorial(false);
  };

  return {
    showTutorial,
    hasSeenTutorial,
    startTutorial,
    closeTutorial,
    resetTutorial,
  };
}
