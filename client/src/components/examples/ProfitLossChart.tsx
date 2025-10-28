import { ProfitLossChart } from '../ProfitLossChart'

export default function ProfitLossChartExample() {
  const mockLegs = [
    {
      id: "1",
      type: "call" as const,
      position: "long" as const,
      strike: 105,
      quantity: 1,
      premium: 3.5,
      expirationDays: 30,
    },
  ];

  return <ProfitLossChart legs={mockLegs} underlyingPrice={100} />
}
