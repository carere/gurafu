import { Effect } from "effect";
import type { UTCTimestamp } from "lightweight-charts";
import {
  type Candle,
  gatewayLayer,
  type LiveEvent,
  type Market,
  MarketError,
  type Page,
} from "./exchange";

export type FixtureRequest = {
  page: Page;
  aborted: boolean;
  resolve(rows: readonly Candle[]): void;
  reject(message?: string): void;
};
export type FixtureStream = { market: Market; closed: boolean; emit(event: LiveEvent): void };
export function fixtureCandles(market: Market): readonly Candle[] {
  const steps = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1h": 3600,
    "4h": 14400,
    "1d": 86400,
    "1w": 604800,
  };
  const time = (index: number) =>
    market.interval === "1M"
      ? Date.UTC(2026, index, 1) / 1000
      : 1767225600 + index * steps[market.interval];
  return Array.from({ length: 96 }, (_, i) => ({
    time: time(i) as UTCTimestamp,
    open: 100 + i,
    high: 108 + i,
    low: 96 + i,
    close: 104 + i,
    volume: 12.5 + i,
    trades: i + 2,
    closed: i < 95,
  }));
}

// Controllable completions are intentionally public at this application port.
// Future replay/independent-chart examples can inject the same Layer, with no
// browser globals or dependency on the installed registry's private state.
export function createMarketFixture(options: { controlled?: boolean } = {}) {
  const requests: FixtureRequest[] = [];
  const streams: FixtureStream[] = [];
  const layer = gatewayLayer(
    "fixture",
    (page) =>
      Effect.async<readonly Candle[], MarketError>((resume) => {
        let settled = false;
        const request: FixtureRequest = {
          page,
          aborted: false,
          resolve(rows) {
            if (!settled) {
              settled = true;
              resume(Effect.succeed(rows));
            }
          },
          reject(message = "Fixture history failed. Retry history.") {
            if (!settled) {
              settled = true;
              resume(Effect.fail(new MarketError(message)));
            }
          },
        };
        requests.push(request);
        if (!options.controlled) {
          const rows = fixtureCandles(page).filter(
            (row) =>
              (page.from === undefined || row.time * 1000 >= page.from) &&
              (page.to === undefined || row.time * 1000 <= page.to),
          );
          request.resolve(
            page.from === undefined ? rows.slice(-32) : rows.slice(0, page.limit ?? 1000),
          );
        }
        return Effect.sync(() => {
          request.aborted = true;
          settled = true;
        });
      }),
    (market, receive) => {
      const stream: FixtureStream = { market, closed: false, emit: (event) => receive(event) };
      streams.push(stream);
      if (!options.controlled)
        queueMicrotask(() => {
          if (!stream.closed) receive({ type: "connection", state: "connected" });
        });
      return () => {
        stream.closed = true;
      };
    },
  );
  return { layer, requests, streams };
}
