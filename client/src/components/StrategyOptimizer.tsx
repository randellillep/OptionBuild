import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2,
  ArrowRight,
  Lightbulb,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Target,
  Shield,
  DollarSign
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import type { OptionLeg, Greeks, StrategyMetrics } from "@shared/schema";

interface StrategyOptimizerProps {
  symbol: string;
  currentPrice: number;
  volatility: number;
  legs: OptionLeg[];
  greeks: Greeks;
  metrics?: StrategyMetrics | null;
  expirationDate?: string | null;
}

interface OptimizationSuggestion {
  type: "adjustment" | "warning" | "opportunity";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  action?: string;
  impact?: string;
  riskChange?: "increase" | "decrease" | "neutral";
}

interface OptimizationResponse {
  suggestions: OptimizationSuggestion[];
  overallAssessment: string;
  riskScore: number;
  potentialImprovement: string;
}

export function StrategyOptimizer({ 
  symbol, 
  currentPrice, 
  volatility, 
  legs, 
  greeks,
  metrics,
  expirationDate 
}: StrategyOptimizerProps) {
  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<OptimizationResponse | null>(null);

  const optimizeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/optimize-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          currentPrice,
          volatility,
          legs: legs.map(leg => ({
            type: leg.type,
            strike: leg.strike,
            position: leg.position,
            quantity: leg.quantity,
            premium: leg.premium,
            expirationDate: leg.expirationDate || expirationDate,
          })),
          greeks,
          metrics: metrics ? {
            maxProfit: (metrics.maxProfit === Infinity || metrics.maxProfit === null) ? 999999999 : (metrics.maxProfit ?? 0),
            maxLoss: (metrics.maxLoss === -Infinity || metrics.maxLoss === null) ? -999999999 : (metrics.maxLoss ?? 0),
            breakevens: metrics.breakeven || [],
            netPremium: metrics.netPremium,
            isMaxProfitUnlimited: metrics.maxProfit === Infinity || metrics.maxProfit === null,
            isMaxLossUnlimited: metrics.maxLoss === -Infinity || metrics.maxLoss === null,
          } : null,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to analyze strategy");
      }
      
      return response.json() as Promise<OptimizationResponse>;
    },
    onSuccess: (data) => {
      setLastAnalysis(data);
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      case "medium": return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "low": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "adjustment": return <Target className="h-4 w-4" />;
      case "warning": return <AlertTriangle className="h-4 w-4" />;
      case "opportunity": return <Lightbulb className="h-4 w-4" />;
      default: return <Sparkles className="h-4 w-4" />;
    }
  };

  const getRiskIcon = (riskChange?: string) => {
    switch (riskChange) {
      case "increase": return <TrendingUp className="h-3.5 w-3.5 text-rose-500" />;
      case "decrease": return <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />;
      default: return <Shield className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  if (legs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <Sparkles className="h-12 w-12 mb-4 opacity-50" />
        <p>Add option legs to get AI-powered optimization suggestions</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Analyze Button */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            <Sparkles className="h-3 w-3 mr-1" />
            AI Strategy Optimizer
          </Badge>
        </div>
        <Button 
          size="sm" 
          onClick={() => optimizeMutation.mutate()}
          disabled={optimizeMutation.isPending}
          data-testid="button-analyze-strategy"
        >
          {optimizeMutation.isPending ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Analyze Strategy
            </>
          )}
        </Button>
      </div>

      {/* Current Strategy Summary */}
      <Card className="p-3 bg-muted/30">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground block">Legs</span>
            <span className="font-mono font-medium">{legs.length}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Net Delta</span>
            <span className={`font-mono font-medium ${greeks.delta > 0 ? 'text-emerald-600' : greeks.delta < 0 ? 'text-rose-600' : ''}`}>
              {greeks.delta >= 0 ? '+' : ''}{greeks.delta.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Max Profit</span>
            <span className="font-mono font-medium text-emerald-600">
              {metrics?.maxProfit === Infinity ? 'Unlimited' : `$${(metrics?.maxProfit || 0).toFixed(0)}`}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Max Loss</span>
            <span className="font-mono font-medium text-rose-600">
              {metrics?.maxLoss === -Infinity ? 'Unlimited' : `$${Math.abs(metrics?.maxLoss || 0).toFixed(0)}`}
            </span>
          </div>
        </div>
      </Card>

      {/* Loading State */}
      {optimizeMutation.isPending && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Error State */}
      {optimizeMutation.isError && (
        <Card className="p-4 border-rose-500/20 bg-rose-500/5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            <div>
              <p className="text-sm font-medium text-rose-600 dark:text-rose-400">Analysis Failed</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {optimizeMutation.error?.message || "Unable to analyze strategy. Please try again."}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Results */}
      {lastAnalysis && !optimizeMutation.isPending && (
        <>
          {/* Overall Assessment */}
          <Card className="p-4 border-primary/20 bg-primary/5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">Overall Assessment</span>
                  <Badge variant="outline" className="text-[10px]">
                    Risk Score: {lastAnalysis.riskScore}/10
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{lastAnalysis.overallAssessment}</p>
                {lastAnalysis.potentialImprovement && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-primary">
                    <DollarSign className="h-3 w-3" />
                    <span>Potential improvement: {lastAnalysis.potentialImprovement}</span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Suggestions List */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Suggestions ({lastAnalysis.suggestions.length})
            </p>
            {lastAnalysis.suggestions.map((suggestion, index) => (
              <Card 
                key={index} 
                className={`p-3 cursor-pointer transition-all hover-elevate ${expandedSuggestion === index ? 'ring-1 ring-primary/30' : ''}`}
                onClick={() => setExpandedSuggestion(expandedSuggestion === index ? null : index)}
                data-testid={`card-suggestion-${index}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-full ${getPriorityColor(suggestion.priority)}`}>
                    {getTypeIcon(suggestion.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{suggestion.title}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Badge variant="outline" className={`text-[9px] ${getPriorityColor(suggestion.priority)}`}>
                          {suggestion.priority}
                        </Badge>
                        {expandedSuggestion === index ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{suggestion.description}</p>
                    
                    {expandedSuggestion === index && (
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        {suggestion.action && (
                          <div className="flex items-start gap-2">
                            <ArrowRight className="h-3.5 w-3.5 mt-0.5 text-primary flex-shrink-0" />
                            <p className="text-xs"><strong>Action:</strong> {suggestion.action}</p>
                          </div>
                        )}
                        {suggestion.impact && (
                          <div className="flex items-start gap-2">
                            <DollarSign className="h-3.5 w-3.5 mt-0.5 text-emerald-500 flex-shrink-0" />
                            <p className="text-xs"><strong>Impact:</strong> {suggestion.impact}</p>
                          </div>
                        )}
                        {suggestion.riskChange && (
                          <div className="flex items-center gap-2">
                            {getRiskIcon(suggestion.riskChange)}
                            <p className="text-xs">
                              <strong>Risk:</strong> {suggestion.riskChange === "increase" ? "Increases risk exposure" : suggestion.riskChange === "decrease" ? "Reduces risk exposure" : "Neutral risk impact"}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Initial State - No Analysis Yet */}
      {!lastAnalysis && !optimizeMutation.isPending && !optimizeMutation.isError && (
        <Card className="p-6 border-dashed">
          <div className="text-center">
            <Sparkles className="h-10 w-10 mx-auto mb-3 text-primary/50" />
            <p className="text-sm font-medium mb-1">Get AI-Powered Suggestions</p>
            <p className="text-xs text-muted-foreground mb-4">
              Analyze your strategy to receive personalized optimization recommendations based on current market conditions, risk metrics, and potential improvements.
            </p>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => optimizeMutation.mutate()}
              data-testid="button-start-analysis"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Start Analysis
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
