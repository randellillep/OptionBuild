import { StrategyMetricsCard } from '../StrategyMetricsCard'

export default function StrategyMetricsCardExample() {
  const mockMetrics = {
    maxProfit: 500,
    maxLoss: -350,
    breakeven: [102.5, 107.5],
    netPremium: -150,
    riskRewardRatio: 1.43,
  };

  return <StrategyMetricsCard metrics={mockMetrics} />
}
