import { Effect } from "effect";
import type { UTCTimestamp } from "lightweight-charts";
import { type Candle, gatewayLayer, MarketError } from "./exchange";

type Wire = [number, string, string, string, string, string, number, string, number, ...unknown[]];
type Kline = {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
  x: boolean;
  n: number;
};
export type SpotTransport = {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  socket: (url: string) => WebSocket;
  now: () => number;
  reconnectDelays: readonly number[];
};
function candle(
  t: number,
  o: string,
  h: string,
  l: string,
  c: string,
  v: string,
  closed: boolean,
  trades: number,
): Candle {
  const values = [o, h, l, c, v].map(Number);
  if (!Number.isFinite(t) || values.some((n) => !Number.isFinite(n)))
    throw new MarketError("Invalid Spot candle values. Retry history.");
  return {
    time: (t / 1000) as UTCTimestamp,
    open: values[0],
    high: values[1],
    low: values[2],
    close: values[3],
    volume: values[4],
    closed,
    trades,
  };
}

export function binanceLayer(overrides: Partial<SpotTransport> = {}) {
  // Browser globals are resolved only when the service actually performs I/O.
  const transport: SpotTransport = {
    fetch: (url, init) => window.fetch(url, init),
    socket: (url) => new WebSocket(url),
    now: Date.now,
    reconnectDelays: [1000, 2000, 4000, 8000],
    ...overrides,
  };
  return gatewayLayer(
    "Binance Spot",
    (page) =>
      Effect.tryPromise({
        try: async (signal) => {
          const params = new URLSearchParams({
            symbol: page.symbol,
            interval: page.interval,
            limit: String(Math.min(1000, Math.max(1, page.limit ?? 1000))),
          });
          if (page.from !== undefined) params.set("startTime", String(page.from));
          if (page.to !== undefined) params.set("endTime", String(page.to));
          const response = await transport.fetch(
            `https://data-api.binance.vision/api/v3/klines?${params}`,
            { signal, credentials: "omit" },
          );
          if (!response.ok) {
            const retry = response.headers.get("Retry-After");
            const delay = retry
              ? /^\d+$/.test(retry)
                ? Number(retry) * 1000
                : Date.parse(retry) - transport.now()
              : 0;
            throw new MarketError(
              `Spot history HTTP ${response.status}. Retry history when access is available.`,
              Number.isFinite(delay) ? Math.max(0, delay) : 0,
            );
          }
          const wire: Wire[] = await response.json();
          return wire.map((row) =>
            candle(
              row[0],
              row[1],
              row[2],
              row[3],
              row[4],
              row[5],
              row[6] < transport.now(),
              row[8],
            ),
          );
        },
        catch: (error) =>
          error instanceof MarketError
            ? error
            : new MarketError(
                "Spot history could not be reached. Check connectivity or regional access, then retry. The browser may hide the HTTP response.",
              ),
      }),
    (market, receive) => {
      let alive = true;
      let socket: WebSocket | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let attempt = 0;
      let opened = false;
      const emit = (event: Parameters<typeof receive>[0]) => {
        if (alive) receive(event);
      };
      const connect = () => {
        if (!alive) return;
        emit({ type: "connection", state: "connecting" });
        let current: WebSocket | undefined;
        let ended = false;
        const retry = () => {
          if (!alive || ended) return;
          ended = true;
          clearTimeout(timeout);
          socket = undefined;
          if (current) {
            current.onopen = current.onmessage = current.onclose = current.onerror = null;
            current.close();
          }
          emit({ type: "connection", state: "disconnected" });
          const delay = transport.reconnectDelays[attempt++];
          if (delay === undefined) emit({ type: "connection", state: "exhausted" });
          else timer = setTimeout(connect, delay);
        };
        try {
          current = transport.socket(
            `wss://data-stream.binance.vision:443/ws/${market.symbol.toLowerCase()}@kline_${market.interval}`,
          );
          socket = current;
        } catch {
          retry();
          return;
        }
        timeout = setTimeout(retry, 15000);
        current.onopen = () => {
          if (!alive || socket !== current) return;
          clearTimeout(timeout);
          emit({ type: "connection", state: "connected", reconnected: opened });
          opened = true;
          // Retry budget is per subscription, including short-lived open/close loops.
        };
        current.onmessage = (event) => {
          if (!alive || socket !== current) return;
          try {
            const { k } = JSON.parse(String(event.data)) as { k: Kline };
            emit({ type: "candle", candle: candle(k.t, k.o, k.h, k.l, k.c, k.v, k.x, k.n) });
          } catch {
            retry();
          }
        };
        current.onclose = current.onerror = retry;
      };
      connect();
      return () => {
        alive = false;
        clearTimeout(timer);
        clearTimeout(timeout);
        if (socket) {
          socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
          socket.close();
        }
      };
    },
  );
}
