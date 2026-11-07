import { expect, test } from "bun:test";
import { Effect, ManagedRuntime } from "effect";
import type { UTCTimestamp } from "lightweight-charts";
import { binanceLayer } from "../src/services/market/binance";
import { ExchangeGateway } from "../src/services/market/exchange";

test("Spot port preserves minute/month case, decimals, UTC seconds and an incomplete latest bar", async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const runtime = ManagedRuntime.make(
    binanceLayer({
      fetch: async (url, init) => {
        requests.push({ url: String(url), init });
        return new Response(
          JSON.stringify([
            [
              1704067200000,
              "42000.25",
              "42010.50",
              "41990.10",
              "42001.75",
              "12.125",
              9999999999999,
              "0",
              7,
            ],
          ]),
        );
      },
    }),
  );
  try {
    for (const interval of ["1m", "1M"] as const) {
      const rows = await runtime.runPromise(
        Effect.flatMap(ExchangeGateway, (g) =>
          g.fetch({ symbol: "BTCUSDT", interval, limit: 1500 }),
        ),
      );
      expect([...rows]).toEqual([
        {
          time: 1704067200 as UTCTimestamp,
          open: 42000.25,
          high: 42010.5,
          low: 41990.1,
          close: 42001.75,
          volume: 12.125,
          closed: false,
          trades: 7,
        },
      ]);
      expect(requests.at(-1)?.url).toBe(
        `https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=1000`,
      );
      expect(requests.at(-1)?.init).toMatchObject({ credentials: "omit" });
      expect(requests.at(-1)?.init?.headers).toBeUndefined();
    }
  } finally {
    await runtime.dispose();
  }
});

test("fixture and real adapters share bounded collection, cancellation and scoped client replacement", async () => {
  const { createMarketFixture } = await import("../src/services/market/fixture");
  const { ExchangeFacade } = await import("../src/services/market/exchange");
  const fixture = createMarketFixture({ controlled: true });
  const runtime = ManagedRuntime.make(fixture.layer);
  const market = { symbol: "BTCUSDT", interval: "1m" as const };
  const abort = new AbortController();
  const work = runtime.runPromise(ExchangeFacade.history({ ...market, from: 0, to: 999999999 }), {
    signal: abort.signal,
  });
  await new Promise((r) => setTimeout(r, 0));
  expect(fixture.requests).toHaveLength(1);
  abort.abort();
  await expect(work).rejects.toThrow();
  expect(fixture.requests[0].aborted).toBe(true);
  const events: string[] = [];
  const scopes = [new AbortController(), new AbortController()];
  const subscribe = (id: string, index: number) =>
    runtime
      .runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const gateway = yield* ExchangeGateway;
            yield* gateway.livePrices(market, id, () => events.push(String(index)));
            yield* Effect.never;
          }),
        ),
        { signal: scopes[index].signal },
      )
      .catch((error) => {
        if (!scopes[index].signal.aborted) console.error(error);
      });
  const first = subscribe("same", 0);
  await new Promise((r) => setTimeout(r, 0));
  const old = fixture.streams[0];
  const second = subscribe("same", 1);
  await new Promise((r) => setTimeout(r, 0));
  expect(old.closed).toBe(true);
  old.emit({ type: "connection", state: "connected" });
  scopes[0].abort();
  await first;
  fixture.streams[1].emit({ type: "connection", state: "connected" });
  expect(events).toEqual(["1"]);
  scopes[1].abort();
  await second;
  expect(fixture.streams.every((s) => s.closed)).toBe(true);
  // Canceling either chart has not disposed the shared runtime.
  expect(await runtime.runPromise(Effect.map(ExchangeGateway, (g) => g.provenance))).toBe(
    "fixture",
  );
  await runtime.dispose();
});

async function until(check: () => boolean) {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 1));
  expect(check()).toBe(true);
}

test("history collection stops on no progress and empty pages and caps work at ten Spot pages", async () => {
  const { createMarketFixture, fixtureCandles } = await import("../src/services/market/fixture");
  const { ExchangeFacade } = await import("../src/services/market/exchange");
  const fixture = createMarketFixture({ controlled: true });
  const runtime = ManagedRuntime.make(fixture.layer);
  const market = { symbol: "BTCUSDT", interval: "1M" as const };
  const base = fixtureCandles(market)[0];
  const page = Array.from({ length: 1000 }, (_, i) => ({
    ...base,
    time: (100 + i) as UTCTimestamp,
  }));
  try {
    const stalled = runtime.runPromise(ExchangeFacade.history({ ...market, from: 0 }));
    await until(() => fixture.requests.length === 1);
    fixture.requests[0].resolve(page);
    await until(() => fixture.requests.length === 2);
    expect(fixture.requests[1].page.from).toBe(1099001);
    fixture.requests[1].resolve(page);
    expect((await stalled).length).toBe(1000);
    expect(fixture.requests).toHaveLength(2);
    const bounded = runtime.runPromise(ExchangeFacade.history({ ...market, from: 0 }, 50));
    for (let i = 0; i < 10; i++) {
      await until(() => fixture.requests.length === 3 + i);
      fixture.requests[2 + i].resolve(
        page.map((row) => ({ ...row, time: (row.time + 1000 * i) as UTCTimestamp })),
      );
    }
    expect((await bounded).length).toBe(10000);
    expect(fixture.requests).toHaveLength(12);
    const empty = runtime.runPromise(ExchangeFacade.history({ ...market, from: 0 }));
    await until(() => fixture.requests.length === 13);
    fixture.requests[12].resolve([]);
    expect(await empty).toEqual([]);
  } finally {
    await runtime.dispose();
  }
});

test("Spot socket maps monthly live closure, reconnects within budget and ignores old callbacks", async () => {
  const sockets: { url: string; socket: WebSocket; closed: boolean }[] = [];
  const events: import("../src/services/market/exchange").LiveEvent[] = [];
  const runtime = ManagedRuntime.make(
    binanceLayer({
      reconnectDelays: [1],
      socket: (url) => {
        const record = {
          url,
          closed: false,
          socket: {
            onopen: null,
            onmessage: null,
            onerror: null,
            onclose: null,
            close() {
              record.closed = true;
            },
          } as unknown as WebSocket,
        };
        sockets.push(record);
        return record.socket;
      },
    }),
  );
  const abort = new AbortController();
  const task = runtime
    .runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* (yield* ExchangeGateway).livePrices(
            { symbol: "BTCUSDT", interval: "1M" },
            "monthly",
            (event) => events.push(event),
          );
          yield* Effect.never;
        }),
      ),
      { signal: abort.signal },
    )
    .catch((error) => {
      if (!abort.signal.aborted) throw error;
    });
  try {
    await until(() => sockets.length === 1);
    expect(sockets[0].url).toBe("wss://data-stream.binance.vision:443/ws/btcusdt@kline_1M");
    const first = sockets[0].socket;
    first.onopen?.call(first, {} as Event);
    const oldMessage = first.onmessage;
    const message = {
      data: JSON.stringify({
        k: {
          t: 1704067200000,
          o: "1.25",
          h: "3.5",
          l: "1.1",
          c: "2.75",
          v: "10.125",
          x: false,
          n: 11,
        },
      }),
    } as MessageEvent;
    first.onmessage?.call(first, message);
    expect(events.at(-1)).toEqual({
      type: "candle",
      candle: {
        time: 1704067200 as UTCTimestamp,
        open: 1.25,
        high: 3.5,
        low: 1.1,
        close: 2.75,
        volume: 10.125,
        closed: false,
        trades: 11,
      },
    });
    first.onclose?.call(first, {} as CloseEvent);
    await until(() => sockets.length === 2);
    const count = events.length;
    oldMessage?.call(first, message);
    expect(events).toHaveLength(count);
    const second = sockets[1].socket;
    second.onopen?.call(second, {} as Event);
    expect(events.at(-1)).toEqual({ type: "connection", state: "connected", reconnected: true });
    second.onclose?.call(second, {} as CloseEvent);
    expect(events.at(-1)).toEqual({ type: "connection", state: "exhausted" });
    abort.abort();
    await task;
    const finalCount = events.length;
    oldMessage?.call(first, message);
    expect(events).toHaveLength(finalCount);
    expect(sockets.every((s) => s.closed)).toBe(true);
  } finally {
    abort.abort();
    await runtime.dispose();
  }
});

test("unreadable fetch failures do not invent HTTP details and readable Retry-After is preserved", async () => {
  for (const readable of [false, true]) {
    const runtime = ManagedRuntime.make(
      binanceLayer({
        fetch: async () => {
          if (!readable) throw new TypeError("Failed to fetch");
          return new Response("Rate limited", { status: 429, headers: { "Retry-After": "12" } });
        },
      }),
    );
    try {
      const result = await runtime.runPromise(
        Effect.either(
          Effect.flatMap(ExchangeGateway, (g) => g.fetch({ symbol: "BTCUSDT", interval: "1m" })),
        ),
      );
      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(result.left.retryAfterMs).toBe(readable ? 12000 : 0);
        expect(result.left.message).toContain(
          readable ? "HTTP 429" : "browser may hide the HTTP response",
        );
        if (!readable) expect(result.left.message).not.toMatch(/403|429|451/);
      }
    } finally {
      await runtime.dispose();
    }
  }
});

test("canceling real-port history forwards AbortSignal to fetch without ending sibling work", async () => {
  let transportSignal: AbortSignal | undefined;
  const runtime = ManagedRuntime.make(
    binanceLayer({
      fetch: async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          transportSignal = init.signal as AbortSignal;
          transportSignal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    }),
  );
  const abort = new AbortController();
  const task = runtime.runPromise(
    Effect.flatMap(ExchangeGateway, (g) => g.fetch({ symbol: "BTCUSDT", interval: "1m" })),
    { signal: abort.signal },
  );
  await until(() => transportSignal !== undefined);
  abort.abort();
  await expect(task).rejects.toThrow();
  expect(transportSignal?.aborted).toBe(true);
  expect(await runtime.runPromise(Effect.map(ExchangeGateway, (g) => g.provenance))).toBe(
    "Binance Spot",
  );
  await runtime.dispose();
});
