import { QueryClient } from "@tanstack/solid-query";
import type { Layer } from "effect";
import { ManagedRuntime } from "effect";
import { binanceLayer } from "./binance";
import type { ExchangeGateway } from "./exchange";

// One owner creates the shared browser runtime/cache. Dataset cleanup never
// calls dispose; the root application does, after canceling Query work.
export function createMarketApp(layer: Layer.Layer<ExchangeGateway> = binanceLayer()) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30000, gcTime: 60000, refetchOnWindowFocus: false },
    },
  });
  const runtime = ManagedRuntime.make(layer);
  return {
    queryClient,
    runtime,
    async dispose() {
      await queryClient.cancelQueries();
      queryClient.clear();
      await runtime.dispose();
    },
  };
}
export type MarketApp = ReturnType<typeof createMarketApp>;
