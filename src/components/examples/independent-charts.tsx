import type { MouseEventParams, Time, UTCTimestamp } from "lightweight-charts";
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
  untrack,
} from "solid-js";
import * as Chart from "@/registry/kobalte/chart/chart";
import { ChartLegend } from "@/registry/kobalte/chart/chart-legend";
import * as Indicators from "@/registry/kobalte/chart/indicators";
import type { MarketApp } from "../../services/market/app";
import { createMarketDataset } from "../../services/market/dataset";
import type { Interval, Market } from "../../services/market/exchange";

type SharedTime = { sender: number; time: UTCTimestamp };
const intervals: readonly Interval[] = ["1m", "5m", "15m", "1h"];
const controlClass =
  "rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

// This parent owns consumer coordination. Each child owns its dataset subscription
// and controllers; neither the signal nor any chart-private setting is global.
export function IndependentCharts(props: { app: MarketApp }) {
  const [ids, setIds] = createSignal([0, 1]);
  const [focused, setFocused] = createSignal<number>();
  const [sharedTime, setSharedTime] = createSignal<SharedTime>();
  let nextId = 2;
  function invalidate(id: number) {
    if (focused() === id) setFocused(undefined);
    if (sharedTime()?.sender === id) setSharedTime(undefined);
  }
  function publish(sender: number, event: MouseEventParams<Time>) {
    // Commands and native recalculations are not pointer intent. Pass the source
    // seconds unchanged: no timeframe rounding, nearest lookup or derived price.
    if (focused() !== sender || !event.sourceEvent || typeof event.time !== "number") return;
    const previous = sharedTime();
    if (previous?.sender === sender && previous.time === event.time) return;
    setSharedTime({ sender, time: event.time });
  }
  return (
    <section aria-label="Independent charts" class="space-y-4">
      <h2 class="text-2xl font-semibold tracking-tight">Independent charts</h2>
      <p class="max-w-prose text-muted-foreground">
        Start with two timeframes of BTCUSDT; add up to four charts. Each has its own dataset,
        price, volume and RSI panes, indicator visibility and legend expansion. Only pointer time is
        shared. Panning and zooming stay local; native panes already share their chart’s timeline.
      </p>
      <p class="max-w-prose text-sm text-muted-foreground">
        A receiver uses the original seconds at price zero when its visible range contains them.
        Missing timestamps keep exact-time legend values unavailable. Lightweight Charts 5.2.1 can
        position the native crosshair on a neighboring bar; this is not exact cross-timeframe
        alignment. Empty or out-of-range targets clear. Leaving a source restores its latest local
        legend without broadcasting a clear.
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class={controlClass}
          disabled={ids().length >= 4}
          onClick={() => setIds((current) => [...current, nextId++])}
        >
          Add chart
        </button>
        <output aria-label="Shared pointer time" class="text-sm tabular-nums">
          {sharedTime()
            ? `Chart ${(sharedTime()?.sender ?? 0) + 1} · ${sharedTime()?.time} seconds UTC`
            : "No shared pointer time"}
        </output>
      </div>
      <div class="grid min-w-0 gap-6">
        <For each={ids()}>
          {(id) => (
            <IndependentChart
              app={props.app}
              id={id}
              initialInterval={intervals[id % 4]}
              sharedTime={sharedTime}
              focused={focused}
              focus={() => setFocused(id)}
              leave={() => {
                if (focused() === id) setFocused(undefined);
              }}
              publish={(event) => publish(id, event)}
              invalidate={() => invalidate(id)}
              remove={() => {
                invalidate(id);
                setIds((current) => current.filter((value) => value !== id));
              }}
            />
          )}
        </For>
      </div>
    </section>
  );
}

function IndependentChart(props: {
  app: MarketApp;
  id: number;
  initialInterval: Interval;
  sharedTime: Accessor<SharedTime | undefined>;
  focused: Accessor<number | undefined>;
  focus(): void;
  leave(): void;
  publish(event: MouseEventParams<Time>): void;
  invalidate(): void;
  remove(): void;
}) {
  const [market, setMarket] = createSignal<Market>({
    symbol: "BTCUSDT",
    interval: props.initialInterval,
  });
  const dataset = createMarketDataset(props.app, market);
  // Stable snapshots also cover the loading/empty interval between assignments.
  const rows = createMemo(() => dataset.rows());
  const [chart, setChart] = createSignal<Chart.ChartController>();
  const [candles, setCandles] = createSignal<Chart.CandlestickSnapshotController>();
  const [revision, setRevision] = createSignal(0);
  const refresh = () => setRevision((value) => value + 1);
  const volume = createMemo(() => rows().map((row) => ({ time: row.time, value: row.volume })));
  function assign(next: Market) {
    props.invalidate();
    setMarket(next);
  }
  onCleanup(props.invalidate);
  createEffect(() => {
    const shared = props.sharedTime();
    const target = chart();
    const series = candles();
    dataset.key();
    rows();
    revision();
    if (!target?.ready() || !series?.ready() || shared?.sender === props.id) return;
    const hasData = series.hasData();
    const range = target.api.timeScale().getVisibleRange();
    const inRange =
      shared &&
      hasData &&
      range &&
      typeof range.from === "number" &&
      typeof range.to === "number" &&
      Number.isFinite(range.from) &&
      Number.isFinite(range.to) &&
      range.from <= shared.time &&
      shared.time <= range.to;
    untrack(() => {
      if (inRange) target.setCrosshairPosition(0, shared.time, series);
      else if (shared || props.focused() !== props.id) target.clearCrosshairPosition();
    });
  });
  return (
    <section aria-label={`Chart ${props.id + 1}`} class="min-w-0 space-y-3">
      <div class="flex flex-wrap items-end gap-3">
        <h3 class="self-center font-semibold">Chart {props.id + 1}</h3>
        <label class="grid gap-1 text-sm">
          Ticker
          <select
            class={controlClass}
            value={market().symbol}
            onChange={(event) => assign({ ...market(), symbol: event.currentTarget.value })}
          >
            <For each={["BTCUSDT", "ETHUSDT"]}>
              {(symbol) => (
                <option value={symbol} selected={symbol === market().symbol}>
                  {symbol}
                </option>
              )}
            </For>
          </select>
        </label>
        <label class="grid gap-1 text-sm">
          Timeframe
          <select
            class={controlClass}
            value={market().interval}
            onChange={(event) =>
              assign({ ...market(), interval: event.currentTarget.value as Interval })
            }
          >
            <For each={intervals}>
              {(interval) => (
                <option value={interval} selected={interval === market().interval}>
                  {interval}
                </option>
              )}
            </For>
          </select>
        </label>
        <button type="button" class={controlClass} onClick={props.remove}>
          Remove chart {props.id + 1}
        </button>
      </div>
      <Chart.Root
        apiRef={setChart}
        datasetKey={dataset.key()}
        style={{ height: "360px" }}
        role="region"
        aria-label={`${market().symbol} ${market().interval} native chart`}
        options={{ ...Chart.lightChartOptions, autoSize: true, timeScale: { timeVisible: true } }}
        containerProps={{ onPointerEnter: props.focus, onPointerLeave: props.leave }}
        onCrosshairMove={props.publish}
        onVisibleTimeRangeChange={refresh}
      >
        <Chart.Pane id="price">
          <Chart.CandlestickSeries
            id="candles"
            data={rows()}
            apiRef={setCandles}
            onDataChange={refresh}
          />
          <Indicators.SMA id="sma" source="candles" />
        </Chart.Pane>
        <Chart.Pane id="volume" stretchFactor={0.25}>
          <Chart.HistogramSeries
            id="volume"
            data={volume()}
            options={{ priceFormat: { type: "volume" } }}
          />
        </Chart.Pane>
        <Chart.Pane id="rsi" stretchFactor={0.35}>
          <Indicators.RSI id="rsi" source="candles" />
        </Chart.Pane>
        <ChartLegend
          priceSeries="candles"
          volumeSeries="volume"
          class="rounded-md bg-background/95 px-2"
        />
      </Chart.Root>
      <p role="status" class="text-sm tabular-nums">
        {dataset.provenance() === "fixture"
          ? "Fixture · illustrative prices"
          : "Binance Spot · browser-direct"}
        {" · "}
        {rows().length} candles · latest close {rows().at(-1)?.close ?? "—"}
        {dataset.query.isFetching ? " · Loading history" : ""} · {dataset.connection()}
        {!rows().length && !dataset.query.isFetching ? " · Empty target" : ""}
        {dataset.connection() === "disconnected" || dataset.connection() === "exhausted"
          ? " · History may be stale"
          : ""}
      </p>
      <Show when={dataset.query.error ?? dataset.query.failureReason}>
        <p role="alert" class="text-sm text-destructive">
          {(dataset.query.error ?? dataset.query.failureReason)?.message} Displayed history is
          retained.
        </p>
      </Show>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class={controlClass}
          disabled={dataset.query.isFetching}
          onClick={() => void dataset.retryHistory()}
        >
          Retry history
        </button>
        <button type="button" class={controlClass} onClick={dataset.reconnect}>
          Reconnect live
        </button>
      </div>
    </section>
  );
}
