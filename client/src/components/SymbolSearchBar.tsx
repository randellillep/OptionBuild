import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, TrendingUp, TrendingDown } from "lucide-react";
import type { SymbolInfo } from "@/hooks/useStrategyEngine";

interface SymbolSearchBarProps {
  symbolInfo: SymbolInfo;
  onSymbolChange: (info: SymbolInfo) => void;
}

const popularSymbols = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF", price: 450.25, change: 2.3 },
  { symbol: "AAPL", name: "Apple Inc.", price: 178.50, change: -1.2 },
  { symbol: "TSLA", name: "Tesla Inc.", price: 242.80, change: 5.6 },
  { symbol: "NVDA", name: "NVIDIA Corporation", price: 495.20, change: 3.8 },
  { symbol: "QQQ", name: "Invesco QQQ Trust", price: 385.60, change: 1.9 },
  { symbol: "MSFT", name: "Microsoft Corporation", price: 378.90, change: 0.8 },
];

export function SymbolSearchBar({ symbolInfo, onSymbolChange }: SymbolSearchBarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredSymbols = popularSymbols.filter(
    (s) =>
      s.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSymbolSelect = (symbol: typeof popularSymbols[0]) => {
    onSymbolChange({
      symbol: symbol.symbol,
      price: symbol.price,
    });
    setSearchTerm("");
    setShowSuggestions(false);
  };

  const currentSymbolData = popularSymbols.find(s => s.symbol === symbolInfo.symbol);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for a stock symbol..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              className="pl-9"
              data-testid="input-symbol-search"
            />
          </div>

          {showSuggestions && searchTerm && (
            <Card className="absolute top-full mt-2 w-full z-50 max-h-96 overflow-y-auto">
              {filteredSymbols.length > 0 ? (
                <div className="p-2">
                  {filteredSymbols.map((symbol) => (
                    <button
                      key={symbol.symbol}
                      onClick={() => handleSymbolSelect(symbol)}
                      className="w-full text-left p-3 hover-elevate active-elevate-2 rounded-md transition-colors"
                      data-testid={`button-symbol-${symbol.symbol.toLowerCase()}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold font-mono">{symbol.symbol}</div>
                          <div className="text-sm text-muted-foreground">{symbol.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold font-mono">${symbol.price.toFixed(2)}</div>
                          <div className={`text-sm flex items-center gap-1 ${symbol.change >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                            {symbol.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {symbol.change >= 0 ? '+' : ''}{symbol.change.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No symbols found
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="flex items-center gap-4 border-l border-border pl-4">
          <div>
            <div className="text-sm text-muted-foreground">Current Symbol</div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold font-mono">{symbolInfo.symbol}</span>
              <span className="text-xl font-semibold font-mono">${symbolInfo.price.toFixed(2)}</span>
              {currentSymbolData && (
                <span className={`text-sm flex items-center gap-1 ${currentSymbolData.change >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                  {currentSymbolData.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {currentSymbolData.change >= 0 ? '+' : ''}{currentSymbolData.change.toFixed(2)}%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-4 flex-wrap">
        <span className="text-sm text-muted-foreground self-center">Popular:</span>
        {popularSymbols.slice(0, 6).map((symbol) => (
          <Button
            key={symbol.symbol}
            variant="outline"
            size="sm"
            onClick={() => handleSymbolSelect(symbol)}
            data-testid={`button-quick-${symbol.symbol.toLowerCase()}`}
          >
            {symbol.symbol}
          </Button>
        ))}
      </div>
    </Card>
  );
}
