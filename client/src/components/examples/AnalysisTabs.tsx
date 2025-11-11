import { AnalysisTabs } from '../AnalysisTabs'

export default function AnalysisTabsExample() {
  const mockGreeks = {
    delta: 0.523,
    gamma: 0.042,
    theta: -0.125,
    vega: 0.187,
    rho: 0.034,
  };

  return <AnalysisTabs greeks={mockGreeks} />
}
