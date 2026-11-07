import { createEffect, createMemo, createSignal, type JSX, onCleanup, Show } from "solid-js";
import * as Chart from "@/registry/kobalte/chart/chart";
import { ChartDateControls } from "@/registry/kobalte/chart/chart-date-controls";
import { ChartLegend } from "@/registry/kobalte/chart/chart-legend";
import { ChartReplayControls } from "@/registry/kobalte/chart/chart-replay-controls";
import * as Indicators from "@/registry/kobalte/chart/indicators";
import type { MarketApp } from "../../services/market/app";
import type { Interval } from "../../services/market/exchange";
import { browserReplayClock, createReplaySession, type ReplayClock } from "./replay-session";

const fieldClass =
  "rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";
export function ReplayDateNavigation(props: {
  app: MarketApp;
  clock?: ReplayClock;
  children?: JSX.Element;
}) {
  const [interval, setInterval] = createSignal<Interval>("1h");
  const market = createMemo(() => ({ symbol: "BTCUSDT", interval: interval() }));
  const replay = createReplaySession(props.app, market, props.clock ?? browserReplayClock);
  const [chart, setChart] = createSignal<Chart.ChartController>();
  const [price, setPrice] = createSignal<Chart.StandardSnapshotController<"Candlestick">>();
  const volume = createMemo(() =>
    replay.rows().map((row) => ({
      time: row.time,
      value: row.volume,
      color: row.close >= row.open ? "#26a69a" : "#ef5350",
    })),
  );
  const supplied = createMemo(() => Indicators.calculateSMA(replay.rows(), { period: 3 }));
  createEffect(() => {
    const target = replay.navigation(),
      controller = chart(),
      series = price(),
      rows = replay.rows();
    if (!target || !controller?.ready() || !series?.ready() || !rows.length) return;
    let frame = 0,
      disposed = false;
    // Wait for Solid's current snapshot/model and a real native layout. This is
    // consumer work, canceled on any new intent/context/removal; never queued in Root.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (disposed || replay.navigation() !== target || !controller.ready() || !series.ready())
          return;
        const displayed = series.api.data();
        const time = target.time === "latest" ? rows[rows.length - 1].time : target.time;
        if (
          displayed.length !== rows.length ||
          displayed.at(-1)?.time !== rows.at(-1)?.time ||
          controller.api.timeScale().width() <= 0 ||
          controller.api.timeScale().timeToCoordinate(time) === null
        ) {
          replay.navigationFailed();
          return;
        }
        if (target.time === "latest") controller.goToLatest();
        else controller.goToTime(target.time);
      });
    });
    onCleanup(() => {
      disposed = true;
      cancelAnimationFrame(frame);
    });
  });
  return (
    <section aria-label="Replay and date navigation" class="space-y-4">
      <h2 class="text-2xl font-semibold tracking-tight">Replay and date navigation</h2>
      <p class="max-w-prose text-sm text-muted-foreground">
        {replay.data.provenance() === "fixture"
          ? "Deterministic fixture · illustrative historical prices."
          : "Binance Spot · browser-direct history; completed bars only in replay."}{" "}
        The application owns the clock, cutoff and Query recovery data. Replay suspends this chart’s
        live input. Conflation is off.
      </p>
      <label class="flex items-center gap-2 text-sm">
        Replay interval
        <select
          class={fieldClass}
          value={interval()}
          onChange={(event) => setInterval(event.currentTarget.value as Interval)}
        >
          <option value="1h">1 hour</option>
          <option value="1d">1 day</option>
        </select>
      </label>
      <ChartDateControls
        value={replay.date()}
        minDate={new Date("2020-01-01T00:00:00Z")}
        maxDate={new Date()}
        onValueChange={(date) => void replay.seekDate(date)}
        onGoToLatest={() => void replay.exit()}
        formatDate={(date) =>
          date.toLocaleDateString(undefined, {
            timeZone: "UTC",
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        }
      />
      <div class="flex flex-wrap gap-2">
        <button
          class={fieldClass}
          type="button"
          disabled={replay.loading() || !replay.rows().length || replay.mode() !== "live"}
          onClick={replay.enter}
        >
          Start replay
        </button>
        <button
          class={fieldClass}
          type="button"
          disabled={replay.mode() !== "replay" || replay.loading() || !replay.rows().length}
          onClick={replay.rewind}
        >
          Rewind to start
        </button>
        <button
          class={fieldClass}
          type="button"
          disabled={replay.loading()}
          onClick={replay.partial}
        >
          Show finer-observation fixture
        </button>
      </div>
      <ChartReplayControls
        playing={replay.playing()}
        speed={replay.speed()}
        speeds={[0.5, 1, 2, 4]}
        canStep={replay.canStep()}
        disabled={replay.loading() || replay.mode() !== "replay"}
        onPlayingChange={replay.requestPlaying}
        onSpeedChange={replay.requestSpeed}
        onStep={replay.step}
        onExit={() => void replay.exit()}
      />
      <Show when={replay.mode() === "partial"}>
        <p class="max-w-prose text-sm">
          Fixture provenance: a 1-hour candle at 2026-01-01 00:00 UTC, revealed at 00:02 UTC,
          aggregated only from completed 00:00 and 00:01 minute observations: O 10, H 14, L 9, C 11,
          volume 7. The later minute (H 99, volume 100) is excluded. This is illustrative finer
          evidence, never interpolation from a final hourly bar. Use Go to latest to restore the
          market dataset.
        </p>
      </Show>
      <Chart.Root
        apiRef={setChart}
        datasetKey={`${replay.data.key()}:${replay.mode() === "partial" ? "finer-fixture" : "market"}`}
        class="h-96 w-full"
        role="region"
        aria-label="Replay chart"
        options={{ ...Chart.lightChartOptions, autoSize: true }}
      >
        <Chart.Pane id="price">
          <Chart.CandlestickSeries id="candles" data={replay.rows()} apiRef={setPrice} />
          <Indicators.SMA id="calculated" source="candles" parameters={{ period: 3 }} />
          <Indicators.SMA id="supplied" data={supplied()} />
        </Chart.Pane>
        <Chart.Pane id="volume" stretchFactor={0.25}>
          <Chart.HistogramSeries
            id="volume"
            data={volume()}
            options={{ priceFormat: { type: "volume" } }}
          />
        </Chart.Pane>
        <ChartLegend
          priceSeries="candles"
          volumeSeries="volume"
          defaultExpanded={true}
          labels={{
            indicatorsById: { calculated: "Calculated SMA (3)", supplied: "Supplied SMA (3)" },
          }}
          class="bg-background/95 px-2"
        />
        {props.children}
      </Chart.Root>
      <p role="status" aria-live="polite" class="text-sm tabular-nums">
        {replay.mode()} · {replay.rows().length} revealed candles · latest close{" "}
        {replay.rows().at(-1)?.close ?? "unavailable"}
        {replay.loading() || (replay.mode() === "live" && replay.data.query.isFetching)
          ? " · Loading history"
          : ""}
        {!replay.rows().length && !replay.loading()
          ? " · No completed candles. Select another date or retry latest."
          : ""}
        {replay.mode() === "replay" &&
        !replay.loading() &&
        !replay.canStep() &&
        replay.rows().length
          ? " · End of replay. Rewind, select a date or exit."
          : ""}
        {replay.mode() === "live" ? ` · ${replay.data.connection()}` : ""}
      </p>
      <Show
        when={
          replay.error() ||
          (replay.mode() === "live" && (replay.data.query.error ?? replay.data.query.failureReason))
        }
      >
        <p role="alert" class="text-sm text-destructive">
          {replay.error() || (replay.data.query.error ?? replay.data.query.failureReason)?.message}{" "}
          Select a date or Go to latest to retry.
        </p>
      </Show>
    </section>
  );
}
