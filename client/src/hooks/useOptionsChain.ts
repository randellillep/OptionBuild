import { useQuery } from "@tanstack/react-query";
import type { MarketOptionChainSummary } from "@shared/schema";

interface UseOptionsChainParams {
  symbol: string;
  expiration?: string;
  strike?: number;
  side?: "call" | "put";
  enabled?: boolean;
}

export function useOptionsChain({
  symbol,
  expiration,
  strike,
  side,
  enabled = true,
}: UseOptionsChainParams) {
  // Build a compact key — omit undefined params so that queries for the same
  // symbol+expiration share a single TanStack Query cache entry whether they
  // come from Builder, SavedTrades, or any other component.
  const queryKey = [
    "/api/options/chain",
    symbol,
    ...(expiration !== undefined ? [expiration] : []),
    ...(strike !== undefined ? [strike] : []),
    ...(side !== undefined ? [side] : []),
  ] as const;

  return useQuery<MarketOptionChainSummary>({
    queryKey,
    queryFn: async () => {
      if (!symbol) {
        throw new Error("Symbol is required");
      }

      const params = new URLSearchParams();
      if (expiration) params.append("expiration", expiration);
      if (strike !== undefined) params.append("strike", strike.toString());
      if (side) params.append("side", side);

      const queryString = params.toString();
      const url = `/api/options/chain/${encodeURIComponent(symbol)}${queryString ? `?${queryString}` : ""}`;

      const response = await fetch(url, { credentials: "include" });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch options chain: ${response.status} ${errorText}`);
      }

      return await response.json();
    },
    enabled: enabled && !!symbol,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    refetchInterval: 30000,
  });
}
