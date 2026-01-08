import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Greeks, OptionLeg, StrategyMetrics } from "@shared/schema";
import { TrendingUp, Activity, DollarSign, AlertTriangle, Shield, Clock, BarChart2 } from "lucide-react";
import { useMemo } from "react";

interface GreeksDashboardProps {
  greeks: Greeks;
  legs?: OptionLeg[];
  metrics?: StrategyMetrics | null;
  currentPrice?: number;
  volatility?: number;
}

type RiskLevel = 'Low' | 'Medium' | 'High';

export function GreeksDashboard({ greeks, legs = [], metrics, currentPrice = 0, volatility = 0.3 }: GreeksDashboardProps) {
  // Multiply all Greeks by 100 for display (industry standard for per-contract values)
  const greekCards = [
    {
      name: "Delta",
      value: greeks.delta * 100,
      icon: TrendingUp,
      description: "Price sensitivity",
      color: "text-blue-600 dark:text-blue-500",
    },
    {
      name: "Gamma",
      value: greeks.gamma * 100,
      icon: Activity,
      description: "Delta change rate",
      color: "text-purple-600 dark:text-purple-500",
    },
    {
      name: "Theta",
      value: greeks.theta * 100,
      icon: Clock,
      description: "Time decay",
      color: "text-orange-600 dark:text-orange-500",
    },
    {
      name: "Vega",
      value: greeks.vega * 100,
      icon: BarChart2,
      description: "Volatility sensitivity",
      color: "text-green-600 dark:text-green-500",
    },
    {
      name: "Rho",
      value: greeks.rho * 100,
      icon: DollarSign,
      description: "Interest rate sensitivity",
      color: "text-red-600 dark:text-red-500",
    },
  ];

  const riskAnalysis = useMemo(() => {
    const activeLegs = legs.filter(leg => !leg.isExcluded && leg.premium > 0);
    const hasPosition = activeLegs.length > 0;
    const hasShortPositions = activeLegs.some(l => l.position === 'short');
    const contractCount = activeLegs.reduce((sum, l) => sum + l.quantity, 0);

    // Risk thresholds are based on raw values (before 100x multiplier)
    const getDeltaRisk = (): RiskLevel => {
      const absDelta = Math.abs(greeks.delta);
      if (absDelta > 0.7) return 'High';
      if (absDelta > 0.3) return 'Medium';
      return 'Low';
    };

    const getThetaRisk = (): RiskLevel => {
      if (!hasPosition) return 'Low';
      if (greeks.theta < -0.15) return 'High';
      if (greeks.theta < -0.05) return 'Medium';
      return 'Low';
    };

    const getVegaRisk = (): RiskLevel => {
      const absVega = Math.abs(greeks.vega);
      if (volatility > 0.5 && absVega > 0.2) return 'High';
      if (absVega > 0.15) return 'Medium';
      return 'Low';
    };

    const getGammaRisk = (): RiskLevel => {
      const absGamma = Math.abs(greeks.gamma);
      if (hasShortPositions && absGamma > 0.03) return 'High';
      if (absGamma > 0.05) return 'Medium';
      return 'Low';
    };

    const maxLoss = metrics?.maxLoss != null 
      ? Math.abs(metrics.maxLoss)
      : hasShortPositions 
        ? 'Unlimited' as const
        : null;

    const maxProfit = metrics?.maxProfit ?? null;
    const breakevens = metrics?.breakeven ?? [];
    const netPremium = metrics?.netPremium ?? 0;

    return {
      hasPosition,
      hasShortPositions,
      contractCount,
      deltaRisk: getDeltaRisk(),
      thetaRisk: getThetaRisk(),
      vegaRisk: getVegaRisk(),
      gammaRisk: getGammaRisk(),
      maxLoss,
      maxProfit,
      breakevens,
      netPremium,
    };
  }, [greeks, legs, metrics, volatility]);

  const getRiskBadge = (level: RiskLevel) => {
    switch (level) {
      case 'High':
        return <Badge className="bg-red-500 text-white hover:bg-red-600 text-[10px] px-2">High</Badge>;
      case 'Medium':
        return <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-[10px] px-2">Medium</Badge>;
      case 'Low':
        return <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] px-2">Low</Badge>;
    }
  };

  const getDeltaInsight = () => {
    const delta = greeks.delta * 100;
    const direction = delta >= 0 ? 'gain' : 'lose';
    const opposite = delta >= 0 ? 'lose' : 'gain';
    return `For every $1 move in the underlying, this position will ${direction} approximately $${Math.abs(delta).toFixed(2)} (or ${opposite} $${Math.abs(delta).toFixed(2)} if price moves against you).`;
  };

  const getThetaInsight = () => {
    const theta = greeks.theta * 100;
    if (theta >= 0) {
      return `This position gains approximately $${theta.toFixed(2)} each day from time decay. Time is on your side.`;
    }
    return `This position loses approximately $${Math.abs(theta).toFixed(2)} in value each day from time decay.`;
  };

  const getVegaInsight = () => {
    const vega = greeks.vega * 100;
    const direction = vega >= 0 ? 'increase' : 'decrease';
    return `A 1% increase in implied volatility will ${direction} the position value by approximately $${Math.abs(vega).toFixed(2)}.`;
  };

  const getGammaInsight = () => {
    const gamma = greeks.gamma * 100;
    if (Math.abs(gamma) < 1) {
      return `Delta is relatively stable. Small price moves won't significantly change your directional exposure.`;
    }
    return `For every $1 move in the underlying, delta will change by ${gamma.toFixed(2)}. ${riskAnalysis.hasShortPositions && gamma > 3 ? 'High gamma with short positions can lead to rapid losses.' : ''}`;
  };

  const getOverallRiskSummary = () => {
    const { hasShortPositions, maxLoss, thetaRisk, deltaRisk, gammaRisk } = riskAnalysis;
    const warnings: string[] = [];

    if (maxLoss === 'Unlimited') {
      warnings.push('Position has unlimited loss potential due to short options.');
    }
    if (thetaRisk === 'High') {
      warnings.push('Significant daily time decay - consider managing before expiration.');
    }
    if (hasShortPositions && gammaRisk === 'High') {
      warnings.push('High gamma risk with short positions - rapid delta changes possible.');
    }
    if (deltaRisk === 'High') {
      warnings.push('High directional exposure - position is sensitive to price moves.');
    }

    if (warnings.length === 0) {
      return 'Position has manageable risk characteristics.';
    }
    return warnings.join(' ');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {greekCards.map((greek) => (
          <Card key={greek.name} className="p-3">
            <div className="flex items-start justify-between mb-1">
              <greek.icon className={`h-4 w-4 ${greek.color}`} />
            </div>
            <div className="space-y-0.5">
              <p className="text-xl font-bold font-mono tabular-nums">
                {greek.value.toFixed(2)}
              </p>
              <p className="text-xs font-semibold">{greek.name}</p>
              <p className="text-[10px] text-muted-foreground">{greek.description}</p>
            </div>
          </Card>
        ))}
      </div>

      {riskAnalysis.hasPosition && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Greeks Summary & Interpretation
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3 md:col-span-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Risk Metrics</h4>
              
              <div className="space-y-3">
                <div className="p-3 bg-muted/30 rounded-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 flex-1">
                      <TrendingUp className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Price Risk (Delta):</span>
                        <p className="text-xs text-muted-foreground mt-1">{getDeltaInsight()}</p>
                      </div>
                    </div>
                    {getRiskBadge(riskAnalysis.deltaRisk)}
                  </div>
                </div>

                <div className="p-3 bg-muted/30 rounded-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 flex-1">
                      <Clock className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">Time Risk (Theta):</span>
                        <p className="text-xs text-muted-foreground mt-1">{getThetaInsight()}</p>
                      </div>
                    </div>
                    {getRiskBadge(riskAnalysis.thetaRisk)}
                  </div>
                </div>

                <div className="p-3 bg-muted/30 rounded-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 flex-1">
                      <BarChart2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="text-sm font-semibold text-green-600 dark:text-green-400">Volatility Risk (Vega):</span>
                        <p className="text-xs text-muted-foreground mt-1">{getVegaInsight()}</p>
                      </div>
                    </div>
                    {getRiskBadge(riskAnalysis.vegaRisk)}
                  </div>
                </div>

                <div className="p-3 bg-muted/30 rounded-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 flex-1">
                      <Activity className="h-4 w-4 text-purple-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">Gamma Risk:</span>
                        <p className="text-xs text-muted-foreground mt-1">{getGammaInsight()}</p>
                      </div>
                    </div>
                    {getRiskBadge(riskAnalysis.gammaRisk)}
                  </div>
                </div>
              </div>

              {riskAnalysis.hasShortPositions && (
                <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-md">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      This strategy includes short positions. Monitor closely as short options carry additional risk.
                    </p>
                  </div>
                </div>
              )}

              {(riskAnalysis.maxLoss === 'Unlimited' || riskAnalysis.thetaRisk === 'High' || riskAnalysis.gammaRisk === 'High' || riskAnalysis.deltaRisk === 'High') && (
                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded-md">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {getOverallRiskSummary()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
