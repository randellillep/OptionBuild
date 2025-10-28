import { FeatureCard } from '../FeatureCard'
import { TrendingUp } from 'lucide-react'

export default function FeatureCardExample() {
  return (
    <FeatureCard
      icon={TrendingUp}
      title="Real-time P/L Charts"
      description="Visualize profit and loss across different price scenarios with interactive charts"
    />
  )
}
