import { SymbolSearchBar } from '../SymbolSearchBar'
import { useState } from 'react'

export default function SymbolSearchBarExample() {
  const [symbolInfo, setSymbolInfo] = useState({
    symbol: "SPY",
    price: 450.25,
  });

  return <SymbolSearchBar symbolInfo={symbolInfo} onSymbolChange={setSymbolInfo} />
}
