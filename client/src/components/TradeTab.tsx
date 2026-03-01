import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plug, Unplug, RefreshCw, DollarSign, ShieldCheck, AlertTriangle, Trash2, Eye, EyeOff } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface BrokerageConnection {
  id: string;
  broker: string;
  isPaper: number;
  label: string;
  apiKeyLast4: string;
  createdAt: string;
}

interface AccountInfo {
  id: string;
  status: string;
  buyingPower: number;
  cash: number;
  equity: number;
  portfolioValue: number;
  patternDayTrader: boolean;
  tradingBlocked: boolean;
  accountBlocked: boolean;
  daytradeCount?: number;
  lastEquity?: number;
}

interface AlpacaOrder {
  id: string;
  symbol: string;
  qty: string;
  side: string;
  type: string;
  status: string;
  filled_qty: string;
  filled_avg_price: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  order_class: string;
  legs?: AlpacaOrder[];
}

export function TradeTab() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [isPaper, setIsPaper] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  const { data: statusData, isLoading: isLoadingStatus } = useQuery<{ connections: BrokerageConnection[] }>({
    queryKey: ['/api/brokerage/status'],
    enabled: isAuthenticated,
  });

  const connections = statusData?.connections || [];
  const activeConnection = selectedConnectionId
    ? connections.find(c => c.id === selectedConnectionId) || connections[0]
    : connections[0];

  const { data: accountData, isLoading: isLoadingAccount, refetch: refetchAccount } = useQuery<AccountInfo>({
    queryKey: ['/api/brokerage/account', activeConnection?.id],
    enabled: !!activeConnection,
  });

  const { data: ordersData, isLoading: isLoadingOrders, refetch: refetchOrders } = useQuery<{ orders: AlpacaOrder[] }>({
    queryKey: ['/api/brokerage/orders', activeConnection?.id],
    enabled: !!activeConnection,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/brokerage/connect", {
        broker: "alpaca",
        apiKey,
        apiSecret,
        isPaper: isPaper ? 1 : 0,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Broker connected", description: "Your Alpaca account has been linked." });
      setApiKey("");
      setApiSecret("");
      queryClient.invalidateQueries({ queryKey: ['/api/brokerage/status'] });
    },
    onError: (error: Error) => {
      toast({ title: "Connection failed", description: error.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (connId: string) => {
      await apiRequest("DELETE", `/api/brokerage/disconnect/${connId}`);
    },
    onSuccess: () => {
      toast({ title: "Disconnected", description: "Broker connection removed." });
      queryClient.invalidateQueries({ queryKey: ['/api/brokerage/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/brokerage/account'] });
      queryClient.invalidateQueries({ queryKey: ['/api/brokerage/orders'] });
    },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      if (!activeConnection) throw new Error("No connection");
      await apiRequest("DELETE", `/api/brokerage/orders/${activeConnection.id}/${orderId}`);
    },
    onSuccess: () => {
      toast({ title: "Order cancelled" });
      queryClient.invalidateQueries({ queryKey: ['/api/brokerage/orders'] });
    },
    onError: (error: Error) => {
      toast({ title: "Cancel failed", description: error.message, variant: "destructive" });
    },
  });

  if (!isAuthenticated) {
    return (
      <Card className="p-6 text-center">
        <ShieldCheck className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Sign in to connect your brokerage account and start trading.</p>
      </Card>
    );
  }

  const orders = ordersData?.orders || [];

  const formatOrderStatus = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      new: { label: "New", variant: "outline" },
      accepted: { label: "Accepted", variant: "outline" },
      pending_new: { label: "Pending", variant: "secondary" },
      partially_filled: { label: "Partial", variant: "default" },
      filled: { label: "Filled", variant: "default" },
      done_for_day: { label: "Done", variant: "secondary" },
      canceled: { label: "Canceled", variant: "secondary" },
      expired: { label: "Expired", variant: "secondary" },
      replaced: { label: "Replaced", variant: "secondary" },
      rejected: { label: "Rejected", variant: "destructive" },
    };
    return statusMap[status] || { label: status, variant: "outline" as const };
  };

  return (
    <div className="space-y-4">
      {connections.length > 0 && activeConnection && (
        <Card className="p-3">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Plug className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs font-medium">Connected</span>
              <Badge variant="outline" className="text-[10px]">
                {activeConnection.broker.toUpperCase()}
              </Badge>
              <Badge variant={activeConnection.isPaper === 1 ? "secondary" : "destructive"} className="text-[10px]">
                {activeConnection.isPaper === 1 ? "Paper" : "Live"}
              </Badge>
              <span className="text-[10px] text-muted-foreground font-mono">****{activeConnection.apiKeyLast4}</span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => disconnectMutation.mutate(activeConnection.id)}
              disabled={disconnectMutation.isPending}
              data-testid="button-disconnect-broker"
            >
              {disconnectMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5 text-muted-foreground" />}
            </Button>
          </div>

          {isLoadingAccount ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : accountData ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="text-[10px] text-muted-foreground">Buying Power</div>
                <div className="text-sm font-mono font-medium" data-testid="text-buying-power">
                  ${accountData.buyingPower.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">Cash</div>
                <div className="text-sm font-mono font-medium" data-testid="text-cash">
                  ${accountData.cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">Equity</div>
                <div className="text-sm font-mono font-medium" data-testid="text-equity">
                  ${accountData.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">Status</div>
                <div className="text-sm font-medium" data-testid="text-account-status">
                  <Badge variant={accountData.status === "ACTIVE" ? "default" : "destructive"} className="text-[10px]">
                    {accountData.status}
                  </Badge>
                </div>
              </div>
            </div>
          ) : null}
        </Card>
      )}

      {connections.length === 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Plug className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Connect Brokerage</span>
            <Badge variant="outline" className="text-[10px]">Alpaca</Badge>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">API Key</Label>
              <Input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="PKXXXXXXXXXXXXXXXX"
                data-testid="input-api-key"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">API Secret</Label>
              <div className="flex gap-1.5">
                <Input
                  type={showSecret ? "text" : "password"}
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="Your API secret key"
                  className="flex-1"
                  data-testid="input-api-secret"
                />
                <Button size="icon" variant="ghost" onClick={() => setShowSecret(!showSecret)} data-testid="button-toggle-secret">
                  {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={isPaper}
                onCheckedChange={setIsPaper}
                data-testid="switch-paper-trading"
              />
              <Label className="text-xs">{isPaper ? "Paper Trading" : "Live Trading"}</Label>
              {!isPaper && (
                <Badge variant="destructive" className="text-[10px]">
                  Real Money
                </Badge>
              )}
            </div>
            <Button
              className="w-full"
              size="sm"
              disabled={!apiKey || !apiSecret || connectMutation.isPending}
              onClick={() => connectMutation.mutate()}
              data-testid="button-connect-broker"
            >
              {connectMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Plug className="h-3.5 w-3.5 mr-1.5" />
              )}
              Connect {isPaper ? "Paper" : "Live"} Account
            </Button>
          </div>
        </Card>
      )}

      {activeConnection && (
        <Card className="p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-medium">Recent Orders</span>
            <Button size="icon" variant="ghost" onClick={() => refetchOrders()} data-testid="button-refresh-orders">
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
          {isLoadingOrders ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No recent orders</p>
          ) : (
            <ScrollArea className="h-[200px]">
              <div className="space-y-1.5">
                {orders.slice(0, 20).map((order) => {
                  const statusInfo = formatOrderStatus(order.status);
                  const orderDate = new Date(order.submitted_at || order.created_at);
                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/30 text-xs"
                      data-testid={`row-order-${order.id}`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Badge
                          variant={order.side === "sell" ? "destructive" : "default"}
                          className="text-[10px] px-1.5 py-0 shrink-0"
                        >
                          {order.side?.toUpperCase()}
                        </Badge>
                        <span className="font-mono truncate">{order.symbol}</span>
                        <span className="text-muted-foreground shrink-0">x{order.qty}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant={statusInfo.variant} className="text-[10px]">
                          {statusInfo.label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        {(order.status === "new" || order.status === "accepted" || order.status === "pending_new") && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => cancelOrderMutation.mutate(order.id)}
                            disabled={cancelOrderMutation.isPending}
                            data-testid={`button-cancel-order-${order.id}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </Card>
      )}
    </div>
  );
}
