import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X, AlertTriangle, CheckCircle2, ArrowUpDown, ExternalLink } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { OptionLeg } from "@shared/schema";

interface ExecuteTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  legs: OptionLeg[];
  symbol: string;
  currentPrice: number;
}

interface BrokerageConnection {
  id: string;
  broker: string;
  isPaper: number;
  label: string;
  apiKeyLast4: string;
}

export function ExecuteTradeModal({ isOpen, onClose, legs, symbol, currentPrice }: ExecuteTradeModalProps) {
  const [orderType, setOrderType] = useState<"limit" | "market">("limit");
  const [timeInForce, setTimeInForce] = useState<"day" | "gtc">("day");
  const [limitPrice, setLimitPrice] = useState<string>("");
  const [limitPriceInitialized, setLimitPriceInitialized] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");
  const [orderResult, setOrderResult] = useState<{ success: boolean; message: string; orderId?: string } | null>(null);

  const { data: statusData, isLoading: isLoadingStatus } = useQuery<{ connections: BrokerageConnection[] }>({
    queryKey: ['/api/brokerage/status'],
    enabled: isOpen,
  });

  const connections = statusData?.connections || [];
  const activeConnection = connections.find(c => c.id === selectedConnectionId) || connections[0];

  const optionLegs = legs.filter(l => l.type !== "stock" && !l.isExcluded);

  const netPremium = optionLegs.reduce((sum, leg) => {
    const val = leg.premium * leg.quantity * 100;
    return leg.position === "short" ? sum + val : sum - val;
  }, 0);

  if (isOpen && !limitPriceInitialized && optionLegs.length > 0) {
    const perContractPremium = Math.abs(netPremium) / (optionLegs.reduce((sum, l) => sum + l.quantity, 0) * 100);
    if (perContractPremium > 0) {
      setLimitPrice(perContractPremium.toFixed(2));
    }
    setLimitPriceInitialized(true);
  }

  const hasInvalidLegs = optionLegs.some(leg => !leg.expirationDate || leg.strike <= 0);

  const submitOrder = useMutation({
    mutationFn: async () => {
      if (!activeConnection) throw new Error("No broker connected");
      if (hasInvalidLegs) throw new Error("All legs must have valid expiration dates and strike prices");

      const orderLegs = optionLegs.map(leg => ({
        symbol,
        expirationDate: leg.expirationDate!,
        optionType: leg.type as "call" | "put",
        strike: leg.strike,
        side: (leg.position === "short" ? "sell" : "buy") as "buy" | "sell",
        quantity: leg.quantity,
      }));

      const body: any = {
        legs: orderLegs,
        type: orderType,
        timeInForce,
      };
      if (orderType === "limit" && limitPrice) {
        body.limitPrice = parseFloat(limitPrice);
      }

      const res = await apiRequest("POST", `/api/brokerage/orders/${activeConnection.id}`, body);
      return await res.json();
    },
    onSuccess: (data) => {
      setOrderResult({
        success: true,
        message: `Order submitted successfully`,
        orderId: data.order?.id,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/brokerage/orders'] });
    },
    onError: (error: Error) => {
      setOrderResult({
        success: false,
        message: error.message || "Failed to submit order",
      });
    },
  });

  if (!isOpen) return null;

  const handleClose = () => {
    setOrderResult(null);
    setLimitPriceInitialized(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <Card className="w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Execute Trade</h2>
          </div>
          <Button size="icon" variant="ghost" onClick={handleClose} data-testid="button-close-execute">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {isLoadingStatus ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : connections.length === 0 ? (
            <div className="text-center py-6 space-y-3">
              <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
              <p className="text-sm text-muted-foreground">
                No broker connected. Connect your brokerage account in the Trade tab to start executing trades.
              </p>
              <Button variant="outline" size="sm" onClick={handleClose} data-testid="button-go-to-trade-tab">
                Go to Trade Tab
              </Button>
            </div>
          ) : orderResult ? (
            <div className="text-center py-6 space-y-3">
              {orderResult.success ? (
                <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
              )}
              <p className="text-sm font-medium">{orderResult.message}</p>
              {orderResult.orderId && (
                <p className="text-xs text-muted-foreground font-mono">Order ID: {orderResult.orderId}</p>
              )}
              <Button variant="outline" size="sm" onClick={handleClose} data-testid="button-done">
                Done
              </Button>
            </div>
          ) : (
            <>
              {connections.length > 1 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Broker Account</Label>
                  <Select
                    value={selectedConnectionId || activeConnection?.id || ""}
                    onValueChange={setSelectedConnectionId}
                  >
                    <SelectTrigger data-testid="select-broker-account">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {connections.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label} (****{c.apiKeyLast4})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {activeConnection && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {activeConnection.broker.toUpperCase()}
                  </Badge>
                  <Badge variant={activeConnection.isPaper === 1 ? "secondary" : "destructive"} className="text-xs">
                    {activeConnection.isPaper === 1 ? "Paper" : "Live"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">****{activeConnection.apiKeyLast4}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Order Preview</Label>
                <Card className="p-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    {symbol} @ ${currentPrice.toFixed(2)}
                  </div>
                  <div className="space-y-1.5">
                    {optionLegs.map((leg, i) => (
                      <div key={leg.id || i} className="flex items-center justify-between text-xs" data-testid={`text-order-leg-${i}`}>
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 border-0 ${leg.position === "short" ? "bg-red-500/15 text-red-500" : "bg-green-500/15 text-green-500"}`}
                          >
                            {leg.position === "short" ? "SELL" : "BUY"}
                          </Badge>
                          <span className="font-mono">
                            {leg.quantity}x ${leg.strike} {leg.type.toUpperCase()}
                          </span>
                          {leg.expirationDate && (
                            <span className="text-muted-foreground">
                              {new Date(leg.expirationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <span className="font-mono">${leg.premium.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border mt-2 pt-2 flex justify-between text-xs font-medium">
                    <span>Net {netPremium >= 0 ? "Credit" : "Debit"}</span>
                    <span className={netPremium >= 0 ? "text-green-500" : "text-red-500"}>
                      ${Math.abs(netPremium).toFixed(2)}
                    </span>
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Order Type</Label>
                  <Select value={orderType} onValueChange={(v) => setOrderType(v as "limit" | "market")}>
                    <SelectTrigger data-testid="select-order-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="limit">Limit</SelectItem>
                      <SelectItem value="market">Market</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Time in Force</Label>
                  <Select value={timeInForce} onValueChange={(v) => setTimeInForce(v as "day" | "gtc")}>
                    <SelectTrigger data-testid="select-tif">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Day</SelectItem>
                      <SelectItem value="gtc">GTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {orderType === "market" && (
                <p className="text-[10px] text-amber-500">Market orders for options are only accepted during market hours (9:30 AM - 4:00 PM ET). Use Limit orders to submit anytime.</p>
              )}

              {orderType === "limit" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Limit Price (per contract)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    placeholder="0.00"
                    data-testid="input-limit-price"
                  />
                  <p className="text-[10px] text-muted-foreground">Pre-filled with the current mid-price. Adjust as needed.</p>
                </div>
              )}

              {optionLegs.length === 0 && (
                <div className="text-center py-3">
                  <p className="text-xs text-muted-foreground">No option legs to execute. Add legs to your strategy first.</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={handleClose} data-testid="button-cancel-order">
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={optionLegs.length === 0 || hasInvalidLegs || submitOrder.isPending || (orderType === "limit" && !limitPrice)}
                  onClick={() => submitOrder.mutate()}
                  data-testid="button-submit-order"
                >
                  {submitOrder.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : null}
                  {activeConnection?.isPaper === 1 ? "Submit Paper Order" : "Submit Live Order"}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
