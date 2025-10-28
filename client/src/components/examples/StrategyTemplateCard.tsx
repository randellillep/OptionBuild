import { StrategyTemplateCard } from '../StrategyTemplateCard'

export default function StrategyTemplateCardExample() {
  return (
    <StrategyTemplateCard
      name="Bull Call Spread"
      description="Buy lower strike call, sell higher strike call. Limited risk and profit."
      legCount={2}
      riskLevel="Low"
      onSelect={() => console.log('Strategy selected')}
    />
  )
}
