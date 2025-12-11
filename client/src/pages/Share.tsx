import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";

interface SharedTradeData {
  n: string;  // name
  d: string;  // description
  s: string;  // symbol
  p: number;  // price
  e: string | null;  // expiration date
  l: Array<{
    t: string;  // type
    pos: string;  // position
    st: number;  // strike
    q: number;  // quantity
    pr: number;  // premium
    expD: number;  // expirationDays
    expDt?: string;  // expirationDate
  }>;
}

export default function Share() {
  const { encoded } = useParams<{ encoded: string }>();
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!encoded) {
      setError("No strategy data found in the link.");
      setLoading(false);
      return;
    }

    try {
      const decoded = atob(encoded);
      const tradeData: SharedTradeData = JSON.parse(decoded);
      
      const legs = tradeData.l.map((leg, index) => ({
        id: `shared-${index}`,
        type: leg.t as 'call' | 'put',
        position: leg.pos as 'long' | 'short',
        strike: leg.st,
        quantity: leg.q,
        premium: leg.pr,
        expirationDays: leg.expD,
        expirationDate: leg.expDt,
      }));

      const sharedStrategy = {
        name: tradeData.n,
        description: tradeData.d,
        symbol: tradeData.s,
        price: tradeData.p,
        expirationDate: tradeData.e,
        legs,
      };

      sessionStorage.setItem('sharedStrategy', JSON.stringify(sharedStrategy));
      
      setLocation('/builder?shared=true');
    } catch (e) {
      console.error('Failed to decode shared strategy:', e);
      setError("Invalid or corrupted share link. The strategy could not be loaded.");
      setLoading(false);
    }
  }, [encoded, setLocation]);

  if (loading && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading shared strategy...</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
          <h2 className="text-xl font-semibold">Unable to Load Strategy</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => setLocation('/builder')}>
            Go to Strategy Builder
          </Button>
        </Card>
      </div>
    );
  }

  return null;
}
