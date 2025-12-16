import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import type { OptionLeg, ClosingEntry } from "@shared/schema";

export interface CommissionSettings {
  perTrade: number;
  perContract: number;
  roundTrip: boolean;
}

interface PositionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  legs: OptionLeg[];
  symbol: string;
  currentPrice: number;
  commissionSettings?: CommissionSettings;
  onCommissionChange?: (settings: CommissionSettings) => void;
}

interface OpenPosition {
  leg: OptionLeg;
  remainingQty: number;
  action: string; // BTO or STO
  costBasis: number;
  symbol: string;
}

interface ClosedPosition {
  leg: OptionLeg;
  entry: ClosingEntry;
  action: string; // STC or BTC
  realizedGain: number;
  symbol: string;
}

export function PositionsModal({ 
  isOpen, 
  onClose, 
  legs, 
  symbol, 
  currentPrice,
  commissionSettings = { perTrade: 0, perContract: 0, roundTrip: false },
  onCommissionChange
}: PositionsModalProps) {
  const [activeTab, setActiveTab] = useState<"open" | "closed">("open");
  const [perTrade, setPerTrade] = useState(commissionSettings.perTrade.toString());
  const [perContract, setPerContract] = useState(commissionSettings.perContract.toString());
  const [roundTrip, setRoundTrip] = useState(commissionSettings.roundTrip);

  // Update local state when props change
  useEffect(() => {
    setPerTrade(commissionSettings.perTrade.toString());
    setPerContract(commissionSettings.perContract.toString());
    setRoundTrip(commissionSettings.roundTrip);
  }, [commissionSettings]);

  // Notify parent of commission changes
  const handleCommissionChange = (field: 'perTrade' | 'perContract' | 'roundTrip', value: string | boolean) => {
    if (field === 'perTrade') {
      setPerTrade(value as string);
    } else if (field === 'perContract') {
      setPerContract(value as string);
    } else if (field === 'roundTrip') {
      setRoundTrip(value as boolean);
    }

    const newSettings: CommissionSettings = {
      perTrade: field === 'perTrade' ? parseFloat(value as string) || 0 : parseFloat(perTrade) || 0,
      perContract: field === 'perContract' ? parseFloat(value as string) || 0 : parseFloat(perContract) || 0,
      roundTrip: field === 'roundTrip' ? value as boolean : roundTrip
    };
    
    onCommissionChange?.(newSettings);
  };

  // Calculate open positions (excluding excluded legs)
  const openPositions: OpenPosition[] = legs
    .filter(leg => !leg.isExcluded)
    .map(leg => {
      // Use absolute quantities for calculation (leg.quantity is always positive in practice)
      const totalQty = Math.abs(leg.quantity);
      
      // Calculate closed quantity from entries, excluding entries marked as isExcluded
      const closedQty = leg.closingTransaction?.isEnabled 
        ? (leg.closingTransaction.entries?.filter(e => !e.isExcluded).reduce((sum, e) => sum + e.quantity, 0) || 
           leg.closingTransaction.quantity || 0)
        : 0;
      const remainingQty = totalQty - closedQty;
      
      // Only include if there's remaining open quantity
      if (remainingQty <= 0) return null;

      // BTO = Buy To Open (long position)
      // STO = Sell To Open (short position)
      const action = leg.position === "long" ? "BTO" : "STO";
      
      // Cost basis for open positions
      const costBasis = leg.premium * remainingQty * 100;

      return {
        leg,
        remainingQty,
        action,
        costBasis,
        symbol // Use the passed symbol for now
      };
    })
    .filter((p): p is OpenPosition => p !== null);

  // Calculate closed positions from all closing entries (excluding entries marked as isExcluded)
  const closedPositions: ClosedPosition[] = legs
    .flatMap(leg => {
      if (!leg.closingTransaction?.isEnabled || !leg.closingTransaction.entries) {
        return [];
      }
      
      // Filter out excluded entries
      return leg.closingTransaction.entries.filter(e => !e.isExcluded).map(entry => {
        // STC = Sell To Close (closing a long position)
        // BTC = Buy To Close (closing a short position)
        const action = leg.position === "long" ? "STC" : "BTC";
        
        // Calculate realized gain per contract
        // For long: (closing price - opening price) * quantity * 100
        // For short: (opening price - closing price) * quantity * 100
        // Use entry.openingPrice (immutable) if available, fallback to leg.premium for legacy entries
        const costBasisPerContract = entry.openingPrice ?? leg.premium;
        const openCost = costBasisPerContract * entry.quantity * 100;
        const closeCost = entry.closingPrice * entry.quantity * 100;
        const realizedGain = leg.position === "long" 
          ? closeCost - openCost 
          : openCost - closeCost;

        return {
          leg,
          entry,
          action,
          realizedGain,
          symbol
        };
      });
    });

  // Calculate total realized gain
  const totalRealizedGain = closedPositions.reduce((sum, p) => sum + p.realizedGain, 0);

  // Calculate total commissions
  const numTrades = openPositions.length;
  const totalContracts = openPositions.reduce((sum, p) => sum + p.remainingQty, 0);
  const perTradeValue = parseFloat(perTrade) || 0;
  const perContractValue = parseFloat(perContract) || 0;
  const multiplier = roundTrip ? 2 : 1;
  const totalCommissions = (numTrades * perTradeValue + totalContracts * perContractValue) * multiplier;

  const formatStrike = (strike: number) => {
    return strike % 1 === 0 ? strike.toFixed(0) : strike.toFixed(2).replace(/\.?0+$/, '');
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
  };

  const formatGain = (gain: number) => {
    const prefix = gain >= 0 ? '+' : '';
    return `${prefix}$${Math.abs(gain).toFixed(0)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 top-[35%] translate-y-[-50%]">
        <DialogHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">Positions</DialogTitle>
          </div>
        </DialogHeader>

        <div className="px-4 pb-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "open" | "closed")}>
            <TabsList className="w-full grid grid-cols-2 mb-3">
              <TabsTrigger 
                value="open" 
                className="data-[state=active]:bg-sky-500 data-[state=active]:text-white"
                data-testid="tab-open-positions"
              >
                Open ({openPositions.length})
              </TabsTrigger>
              <TabsTrigger 
                value="closed"
                data-testid="tab-closed-positions"
              >
                Closed ({closedPositions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="open" className="mt-0">
              {/* Total unrealized gain - placeholder since we don't have live pricing */}
              <div className="mb-3 text-sm">
                <span className="text-muted-foreground">Total unrealized gain: </span>
                <span className="text-muted-foreground font-semibold">
                  (requires live pricing)
                </span>
              </div>

              {/* Open positions list */}
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {openPositions.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No open positions
                  </div>
                ) : (
                  openPositions.map((pos) => (
                    <div 
                      key={pos.leg.id} 
                      className="flex items-center gap-2 py-2 px-2 rounded-md hover:bg-muted/50"
                      data-testid={`open-position-${pos.leg.id}`}
                    >
                      <div className="flex-1 text-sm">
                        <span className="font-semibold">{symbol}</span>
                        <span className="ml-1">
                          {formatStrike(pos.leg.strike)}{pos.leg.type === 'call' ? 'C' : 'P'}
                        </span>
                        {pos.leg.expirationDate && (
                          <span className="text-muted-foreground ml-1">
                            {formatDate(pos.leg.expirationDate)}
                          </span>
                        )}
                        <span className={`ml-2 font-medium ${pos.action === 'BTO' ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                          {pos.action}
                        </span>
                        <span className="ml-1">
                          {pos.leg.position === 'short' ? '-' : '+'}{pos.remainingQty}×
                        </span>
                        <span className="text-muted-foreground ml-1">
                          at {pos.leg.premium.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Commissions Section */}
              <div className="mt-4 pt-3 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm text-muted-foreground">Commissions:</span>
                  <span className={`text-sm font-medium ${totalCommissions > 0 ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500'}`}>
                    ${totalCommissions.toFixed(0)}
                  </span>
                </div>

                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      value={perTrade}
                      onChange={(e) => handleCommissionChange('perTrade', e.target.value)}
                      className="w-20 h-8 text-sm"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      data-testid="input-per-trade"
                    />
                    <span className="text-sm text-muted-foreground">per trade</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      value={perContract}
                      onChange={(e) => handleCommissionChange('perContract', e.target.value)}
                      className="w-20 h-8 text-sm"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      data-testid="input-per-contract"
                    />
                    <span className="text-sm text-muted-foreground">per contract</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="round-trip"
                    checked={roundTrip}
                    onCheckedChange={(checked) => handleCommissionChange('roundTrip', checked === true)}
                    data-testid="checkbox-round-trip"
                  />
                  <label htmlFor="round-trip" className="text-sm text-muted-foreground cursor-pointer">
                    Round-Trip
                  </label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p>When enabled, commissions are calculated for both opening and closing trades (doubled).</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="closed" className="mt-0">
              {/* Total realized gain for closed positions */}
              {closedPositions.length > 0 && (
                <div className="mb-3 text-sm">
                  <span className="text-muted-foreground">Total realized gain: </span>
                  <span className={totalRealizedGain >= 0 ? 'text-green-600 dark:text-green-500 font-semibold' : 'text-red-600 dark:text-red-500 font-semibold'}>
                    {formatGain(totalRealizedGain)}
                  </span>
                </div>
              )}

              {/* Closed positions list */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {closedPositions.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No closed positions
                  </div>
                ) : (
                  closedPositions.map((pos) => (
                    <div 
                      key={pos.entry.id} 
                      className="flex items-center gap-2 py-2 px-2 rounded-md hover:bg-muted/50"
                      data-testid={`closed-position-${pos.entry.id}`}
                    >
                      <div className="flex-1 text-sm">
                        <span className="font-semibold">{symbol}</span>
                        <span className="ml-1">
                          {/* Use entry.strike (immutable at time of close), not leg.strike */}
                          {formatStrike(pos.entry.strike)}{pos.leg.type === 'call' ? 'C' : 'P'}
                        </span>
                        {pos.leg.expirationDate && (
                          <span className="text-muted-foreground ml-1">
                            {formatDate(pos.leg.expirationDate)}
                          </span>
                        )}
                        <span className={`ml-2 font-medium ${pos.action === 'BTC' ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                          {pos.action}
                        </span>
                        <span className="ml-1">
                          {pos.leg.position === 'short' ? '-' : '+'}{pos.entry.quantity}×
                        </span>
                        <span className="text-muted-foreground ml-1">
                          at {pos.entry.closingPrice.toFixed(2)}
                        </span>
                      </div>
                      <span className={pos.realizedGain >= 0 ? 'text-green-600 dark:text-green-500 text-sm font-medium' : 'text-red-600 dark:text-red-500 text-sm font-medium'}>
                        {formatGain(pos.realizedGain)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
