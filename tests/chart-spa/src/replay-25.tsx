import { createSignal, onCleanup, Show } from "solid-js";
import * as Chart from "~/components/gurafu/chart";
import { ChartDateControls } from "~/components/gurafu/chart-date-controls";
import { useLegend } from "~/components/gurafu/chart-legend";
import { ChartReplayControls } from "~/components/gurafu/chart-replay-controls";
import { ReplayDateNavigation } from "./replay-date";
import { ServiceHistory } from "./service-history";
import { createMarketApp } from "./services/market/app";
import { createMarketFixture, fixtureCandles } from "./services/market/fixture";

export function Replay25() {
  const fixture = createMarketFixture({ controlled: true }),
    app = createMarketApp(fixture.layer);
  const [mounted, setMounted] = createSignal(true),
    [disabled, setDisabled] = createSignal(false);
  const savedTicks: (() => void)[] = [];
  let tick: (() => void) | undefined,
    duration = 0,
    stopped = 0;
  let chart: ReturnType<typeof Chart.useChart> | undefined,
    legend: ReturnType<typeof useLegend> | undefined;
  const requests: unknown[] = [];
  function Probe() {
    chart = Chart.useChart();
    legend = useLegend({ priceSeries: "candles", volumeSeries: "volume" });
    return null;
  }
  const navigationLog: unknown[] = [];
  const api = {
    navigationLog,
    recordNavigation() {
      const controller = chart?.();
      if (!controller) throw new Error("Not ready");
      const original = controller.goToTime;
      controller.goToTime = (time) => {
        navigationLog.push({
          time,
          length: controller.api.panes()[0].getSeries()[0].data().length,
        });
        original(time);
      };
    },
    tick() {
      tick?.();
    },
    lateTick(index: number) {
      savedTicks[index]?.();
    },
    clock: () => ({ active: !!tick, duration, stopped }),
    requests: () =>
      fixture.requests
        .filter((r) => r.page.symbol === "BTCUSDT")
        .map((r) => ({ page: r.page, aborted: r.aborted })),
    resolve(index: number, indexes: number[], close?: number) {
      const request = fixture.requests.filter((r) => r.page.symbol === "BTCUSDT")[index];
      request.resolve(
        indexes.map((i) => {
          const row = fixtureCandles(request.page)[i];
          return close === undefined ? row : { ...row, close, high: Math.max(row.high, close) };
        }),
      );
    },
    reject(index: number) {
      fixture.requests.filter((r) => r.page.symbol === "BTCUSDT")[index].reject();
    },
    live(index: number, close: number) {
      const stream = fixture.streams.filter((s) => s.market.symbol === "BTCUSDT")[index];
      const row = fixtureCandles(stream.market)[3];
      stream.emit({
        type: "candle",
        candle: { ...row, close, high: Math.max(close, row.high), volume: 77, closed: false },
      });
    },
    streams: () =>
      fixture.streams
        .filter((s) => s.market.symbol === "BTCUSDT")
        .map((s) => ({ closed: s.closed })),
    reconnect(index: number) {
      fixture.streams
        .filter((s) => s.market.symbol === "BTCUSDT")
        [index].emit({ type: "connection", state: "connected", reconnected: true });
    },
    state: () => ({
      ready: chart?.()?.ready() ?? false,
      legend: legend?.(),
      series: chart?.()?.ready()
        ? chart()
            ?.api.panes()
            .flatMap((p) => p.getSeries())
            .map((s) => ({ type: s.seriesType(), data: s.data() }))
        : [],
    }),
    liveSibling() {
      const stream = fixture.streams.find((s) => s.market.symbol === "ETHUSDT");
      if (stream)
        stream.emit({
          type: "candle",
          candle: { ...fixtureCandles(stream.market)[1], close: 888, high: 888, closed: false },
        });
    },
    sibling() {
      const request = fixture.requests.find((r) => r.page.symbol === "ETHUSDT");
      if (request) request.resolve(fixtureCandles(request.page).slice(0, 2));
    },
    events: () => requests,
  };
  Object.assign(window, { replay25: api });
  onCleanup(() => {
    void app.dispose();
  });
  return (
    <>
      <fieldset aria-label="Declined requests">
        <ChartReplayControls
          playing={false}
          speed={1}
          speeds={[1, 2]}
          disabled={disabled()}
          canStep={!disabled()}
          onPlayingChange={(v) => requests.push(v)}
          onSpeedChange={(v) => requests.push(v)}
          onStep={() => requests.push("step")}
          onExit={() => requests.push("exit")}
        />
        <ChartDateControls
          value={new Date("2026-01-01T23:00:00-05:00")}
          minDate={new Date("2026-01-01Z")}
          maxDate={new Date("2026-02-01Z")}
          disabled={disabled()}
          onValueChange={(v) => requests.push(v.toISOString())}
          onGoToLatest={() => requests.push("latest")}
          formatDate={(d) => `UTC ${d.toISOString().slice(0, 10)}`}
        />
      </fieldset>
      <button type="button" onClick={() => setDisabled(true)}>
        Disable standalone controls
      </button>
      <button type="button" onClick={() => setMounted(false)}>
        Remove replay chart
      </button>
      <Show when={mounted()}>
        <ReplayDateNavigation
          app={app}
          clock={{
            every(ms, callback) {
              savedTicks.push(callback);
              duration = ms;
              tick = callback;
              return () => {
                tick = undefined;
                stopped++;
              };
            },
          }}
        >
          <Probe />
        </ReplayDateNavigation>
      </Show>
      <ServiceHistory app={app} symbol="ETHUSDT" />
    </>
  );
}
