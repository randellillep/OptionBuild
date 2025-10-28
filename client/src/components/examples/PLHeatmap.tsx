import { PLHeatmap } from '../PLHeatmap'

export default function PLHeatmapExample() {
  const strikes = [95, 97.5, 100, 102.5, 105, 107.5, 110];
  const days = [1, 7, 14, 21, 30];
  
  const grid = strikes.map(strike => 
    days.map(day => ({
      strike,
      daysToExpiration: day,
      pnl: (strike - 100) * 10 + Math.random() * 100 - 50,
    }))
  );

  return (
    <PLHeatmap
      grid={grid}
      strikes={strikes}
      days={days}
      currentPrice={100}
    />
  )
}
