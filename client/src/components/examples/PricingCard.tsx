import { PricingCard } from '../PricingCard'

export default function PricingCardExample() {
  return (
    <PricingCard
      name="Pro"
      price="$25"
      period="month"
      features={[
        "Real-time market data",
        "Unlimited strategies",
        "Advanced Greeks analysis",
        "Strategy optimizer",
        "Export to PDF",
      ]}
      isFeatured={true}
      onSelect={() => console.log('Plan selected')}
    />
  )
}
