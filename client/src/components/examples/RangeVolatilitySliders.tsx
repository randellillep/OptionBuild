import { RangeVolatilitySliders } from '../RangeVolatilitySliders'
import { useState } from 'react'

export default function RangeVolatilitySlidersExample() {
  const [range, setRange] = useState(14);
  const [volatility, setVolatility] = useState(30);

  return (
    <RangeVolatilitySliders
      range={range}
      onRangeChange={setRange}
      impliedVolatility={volatility}
      onVolatilityChange={setVolatility}
    />
  )
}
