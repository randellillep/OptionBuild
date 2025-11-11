import { useMemo } from "react";
import type { MarketOptionQuote } from "@shared/schema";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface OptionsChainTableProps {
  quotes: MarketOptionQuote[];
  onSelectOption?: (quote: MarketOptionQuote) => void;
  showCalls?: boolean;
  showPuts?: boolean;
}

export function OptionsChainTable({
  quotes,
  onSelectOption,
  showCalls = true,
  showPuts = true,
}: OptionsChainTableProps) {
  const { calls, puts, atmStrike } = useMemo(() => {
    if (quotes.length === 0) {
      return { calls: [], puts: [], atmStrike: 0 };
    }

    const underlyingPrice = quotes[0]?.underlyingPrice || 0;
    const callQuotes = quotes.filter(q => q.side === "call").sort((a, b) => a.strike - b.strike);
    const putQuotes = quotes.filter(q => q.side === "put").sort((a, b) => a.strike - b.strike);

    const atmStrike = callQuotes.reduce((closest, quote) => {
      return Math.abs(quote.strike - underlyingPrice) < Math.abs(closest - underlyingPrice)
        ? quote.strike
        : closest;
    }, callQuotes[0]?.strike || 0);

    return { calls: callQuotes, puts: putQuotes, atmStrike };
  }, [quotes]);

  if (quotes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Options Chain</CardTitle>
          <CardDescription>No options data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const renderOptionRow = (quote: MarketOptionQuote) => {
    const isAtm = Math.abs(quote.strike - atmStrike) < 0.01;
    const spread = quote.ask - quote.bid;
    const spreadPercent = quote.mid > 0 ? (spread / quote.mid) * 100 : 0;

    return (
      <TableRow 
        key={quote.optionSymbol}
        className={isAtm ? "bg-primary/5" : ""}
        data-testid={`option-row-${quote.side}-${quote.strike}`}
      >
        <TableCell className="font-mono" data-testid={`strike-${quote.strike}`}>
          {quote.strike.toFixed(2)}
          {isAtm && <Badge variant="outline" className="ml-2 text-xs">ATM</Badge>}
        </TableCell>
        <TableCell className="text-right font-mono" data-testid={`bid-${quote.strike}`}>
          ${quote.bid.toFixed(2)}
        </TableCell>
        <TableCell className="text-right font-mono" data-testid={`ask-${quote.strike}`}>
          ${quote.ask.toFixed(2)}
        </TableCell>
        <TableCell className="text-right font-mono">
          ${quote.mid.toFixed(2)}
        </TableCell>
        <TableCell className="text-right text-muted-foreground text-sm">
          ${spread.toFixed(2)} ({spreadPercent.toFixed(1)}%)
        </TableCell>
        <TableCell className="text-right font-mono">
          {(quote.iv * 100).toFixed(1)}%
        </TableCell>
        <TableCell className="text-right font-mono text-sm" data-testid={`delta-${quote.strike}`}>
          {quote.delta.toFixed(3)}
        </TableCell>
        <TableCell className="text-right font-mono text-sm">
          {quote.gamma.toFixed(4)}
        </TableCell>
        <TableCell className="text-right font-mono text-sm">
          {quote.theta.toFixed(3)}
        </TableCell>
        <TableCell className="text-right font-mono text-sm">
          {quote.vega.toFixed(3)}
        </TableCell>
        {onSelectOption && (
          <TableCell>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSelectOption(quote)}
              data-testid={`button-select-${quote.side}-${quote.strike}`}
            >
              Select
            </Button>
          </TableCell>
        )}
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      {showCalls && calls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600 dark:text-green-400">Call Options</CardTitle>
            <CardDescription>{calls.length} available strikes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Strike</TableHead>
                    <TableHead className="text-right">Bid</TableHead>
                    <TableHead className="text-right">Ask</TableHead>
                    <TableHead className="text-right">Mid</TableHead>
                    <TableHead className="text-right">Spread</TableHead>
                    <TableHead className="text-right">IV</TableHead>
                    <TableHead className="text-right">Delta</TableHead>
                    <TableHead className="text-right">Gamma</TableHead>
                    <TableHead className="text-right">Theta</TableHead>
                    <TableHead className="text-right">Vega</TableHead>
                    {onSelectOption && <TableHead>Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calls.map(renderOptionRow)}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {showPuts && puts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400">Put Options</CardTitle>
            <CardDescription>{puts.length} available strikes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Strike</TableHead>
                    <TableHead className="text-right">Bid</TableHead>
                    <TableHead className="text-right">Ask</TableHead>
                    <TableHead className="text-right">Mid</TableHead>
                    <TableHead className="text-right">Spread</TableHead>
                    <TableHead className="text-right">IV</TableHead>
                    <TableHead className="text-right">Delta</TableHead>
                    <TableHead className="text-right">Gamma</TableHead>
                    <TableHead className="text-right">Theta</TableHead>
                    <TableHead className="text-right">Vega</TableHead>
                    {onSelectOption && <TableHead>Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {puts.map(renderOptionRow)}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
