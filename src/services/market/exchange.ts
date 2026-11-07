import { Context, Effect, Layer, type Scope } from "effect";
import type { CandlestickData, UTCTimestamp } from "lightweight-charts";

export type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w" | "1M";
export type Market = { symbol: string; interval: Interval };
export type Candle = CandlestickData<UTCTimestamp> & {
  volume: number;
  closed: boolean;
  trades: number;
};
export type Page = Market & { from?: number; to?: number; limit?: number };
export type Connection = "connecting" | "connected" | "disconnected" | "exhausted";
export type LiveEvent =
  | { type: "candle"; candle: Candle }
  | { type: "connection"; state: Connection; reconnected?: boolean };
export class MarketError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs = 0,
  ) {
    super(message);
  }
}

// Adapted from Ashiso's ExchangeGateway/ExchangeFacade: no contract discovery,
// Future/Result transport, workers or application graph crosses this boundary.
export interface Gateway {
  readonly provenance: "fixture" | "Binance Spot";
  fetch(page: Page): Effect.Effect<readonly Candle[], MarketError>;
  livePrices(
    market: Market,
    clientId: string,
    receive: (event: LiveEvent) => void,
  ): Effect.Effect<void, MarketError, Scope.Scope>;
}
export class ExchangeGateway extends Context.Tag("website/ExchangeGateway")<
  ExchangeGateway,
  Gateway
>() {}

export function mergeCandles(...sources: readonly (readonly Candle[])[]): readonly Candle[] {
  const rows = new Map<number, Candle>();
  for (const source of sources) for (const row of source) rows.set(row.time, row);
  return [...rows.values()].sort((a, b) => a.time - b.time);
}

export const ExchangeFacade = {
  // Advance by open-time + 1 ms: works for monthly intervals without guessing
  // month lengths. Both bounds are milliseconds; chart identity is seconds.
  history: (page: Page, maxPages = 10) =>
    Effect.gen(function* () {
      const gateway = yield* ExchangeGateway;
      let from = page.from;
      let rows: readonly Candle[] = [];
      for (let i = 0; i < Math.min(10, Math.max(1, maxPages)); i++) {
        const batch = yield* gateway.fetch({ ...page, from, limit: 1000 });
        rows = mergeCandles(rows, batch);
        const next = batch.at(-1)?.time;
        if (next === undefined || batch.length < 1000 || from === undefined) break;
        const cursor = next * 1000 + 1;
        if (cursor <= from || (page.to !== undefined && cursor > page.to)) break;
        from = cursor;
      }
      return rows;
    }),
};

// Registry lifetime belongs to each Layer, never to the module or a chart.
// A stale finalizer cannot remove a replacement using the same client id.
export function gatewayLayer(
  provenance: Gateway["provenance"],
  fetch: Gateway["fetch"],
  subscribe: (market: Market, receive: (event: LiveEvent) => void) => () => void,
) {
  return Layer.scoped(
    ExchangeGateway,
    Effect.gen(function* () {
      const clients = new Map<string, () => void>();
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          for (const stop of clients.values()) stop();
          clients.clear();
        }),
      );
      return {
        provenance,
        fetch,
        livePrices: (market, id, receive) =>
          Effect.acquireRelease(
            Effect.sync(() => {
              clients.get(id)?.();
              let active = true;
              const unsubscribe = subscribe(market, (event) => {
                if (active) receive(event);
              });
              const stop = () => {
                if (active) {
                  active = false;
                  unsubscribe();
                }
              };
              clients.set(id, stop);
              return stop;
            }),
            (stop) =>
              Effect.sync(() => {
                stop();
                if (clients.get(id) === stop) clients.delete(id);
              }),
          ).pipe(Effect.asVoid),
      } satisfies Gateway;
    }),
  );
}
