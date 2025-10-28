import { StrikeLadder } from '../StrikeLadder'

export default function StrikeLadderExample() {
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
    {
      id: "2",
      type: "put" as const,
      position: "long" as const,
      strike: 95,
      quantity: 1,
      premium: 2.8,
      expirationDays: 30,
    },
  ];

  return (
    <StrikeLadder
      legs={mockLegs}
      currentPrice={100}
      strikeRange={{ min: 85, max: 115 }}
    />
  )
}
