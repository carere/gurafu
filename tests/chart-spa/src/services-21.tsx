import { createSignal, onCleanup, Show } from "solid-js";
import { ServiceHistory } from "./service-history";
import { createMarketApp } from "./services/market/app";
import { createMarketFixture, fixtureCandles } from "./services/market/fixture";

export function Services21() {
  const fixture = createMarketFixture({ controlled: true });
  const app = createMarketApp(fixture.layer);
  const [first, setFirst] = createSignal(true);
  window.market21 = {
    resolve(index, indexes) {
      const request = fixture.requests.filter((r) => r.page.symbol === "BTCUSDT")[index];
      request.resolve(indexes.map((i) => fixtureCandles(request.page)[i]));
    },
    reject(index) {
      fixture.requests.filter((r) => r.page.symbol === "BTCUSDT")[index].reject();
    },
    tick(index, i, close) {
      const stream = fixture.streams.filter((s) => s.market.symbol === "BTCUSDT")[index];
      const row = fixtureCandles(stream.market)[i];
      stream.emit({
        type: "candle",
        candle: { ...row, close, high: Math.max(row.high, close), closed: false },
      });
    },
    disconnect(index) {
      fixture.streams
        .filter((s) => s.market.symbol === "BTCUSDT")
        [index].emit({ type: "connection", state: "disconnected" });
    },
    reconnect(index) {
      fixture.streams
        .filter((s) => s.market.symbol === "BTCUSDT")
        [index].emit({ type: "connection", state: "connected", reconnected: true });
    },
    requests: () => fixture.requests.filter((r) => r.page.symbol === "BTCUSDT").length,
    resolveSibling() {
      const request = fixture.requests.find((r) => r.page.symbol === "ETHUSDT");
      if (!request) throw new Error("Sibling request has not started");
      request.resolve(fixtureCandles(request.page).slice(0, 2));
    },
    state: () => ({
      aborted: fixture.requests.filter((r) => r.aborted).length,
      closed: fixture.streams.filter((s) => s.closed).length,
    }),
  };
  onCleanup(() => {
    void app.dispose();
  });
  return (
    <>
      <button type="button" onClick={() => setFirst(false)}>
        Remove first chart
      </button>
      <Show when={first()}>
        <ServiceHistory app={app} />
      </Show>
      <ServiceHistory app={app} symbol="ETHUSDT" />
    </>
  );
}

declare global {
  interface Window {
    market21: {
      resolve(request: number, indexes: number[]): void;
      reject(request: number): void;
      tick(stream: number, index: number, close: number): void;
      disconnect(stream: number): void;
      reconnect(stream: number): void;
      requests(): number;
      state(): unknown;
      resolveSibling(): void;
    };
  }
}
