import { createMemo, createSignal, Show } from "solid-js";
import * as Chart from "@/registry/kobalte/chart/chart";
import type { MarketApp } from "../../services/market/app";
import { createMarketDataset } from "../../services/market/dataset";
import type { Interval } from "../../services/market/exchange";

const buttonClass =
  "rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

export function ServiceHistory(props: { app: MarketApp; symbol?: string }) {
  const [interval, setInterval] = createSignal<Interval>("1m");
  const market = createMemo(() => ({ symbol: props.symbol ?? "BTCUSDT", interval: interval() }));
  const data = createMarketDataset(props.app, market);
  return (
    <section aria-label="Service history" class="space-y-4">
      <h3 class="text-xl font-semibold">Service-backed history</h3>
      <p class="max-w-prose text-sm text-muted-foreground">
        {data.provenance() === "fixture"
          ? "Deterministic fixture · illustrative prices, not live market data."
          : "Binance Spot · browser-direct public market data. Availability depends on connectivity and region."}{" "}
        Query owns the history cache; the application owns the stream and merges corrections before
        supplying the chart.
      </p>
      <label class="flex flex-wrap items-center gap-2 text-sm">
        {market().symbol} · Interval
        <select
          aria-label="Interval"
          class="rounded-md border border-input bg-background px-3 py-2 focus-visible:outline-2"
          value={interval()}
          onChange={(event) => setInterval(event.currentTarget.value as Interval)}
        >
          <option value="1m">1 minute</option>
          <option value="1h">1 hour</option>
          <option value="1M">1 month</option>
        </select>
      </label>
      <Chart.Root
        datasetKey={data.key()}
        class="h-80 w-full"
        aria-label={`Service-backed ${market().symbol} chart`}
        role="region"
        options={{ autoSize: true }}
      >
        <Chart.Pane id="price">
          <Chart.CandlestickSeries id="candles" data={data.rows()} />
        </Chart.Pane>
      </Chart.Root>
      <p role="status" aria-live="polite" class="text-sm tabular-nums">
        {data.rows().length
          ? `${data.rows().length} candles · latest close ${data.rows().at(-1)?.close}`
          : "No candles. Load or retry history."}
        {data.query.isFetching ? " · Loading history" : ""} · {data.connection()}
        {data.connection() === "disconnected" || data.connection() === "exhausted"
          ? " · Displayed history may be stale. Reconnect live or retry history."
          : ""}
        {data.rows().at(-1)?.closed === false ? " · Latest interval is incomplete" : ""}
      </p>
      <Show when={data.query.error ?? data.query.failureReason}>
        <p role="alert" class="text-sm text-destructive">
          {(data.query.error ?? data.query.failureReason)?.message}{" "}
          {data.retryAt() > Date.now()
            ? `Retry after ${new Date(data.retryAt()).toISOString()}.`
            : "Displayed history is retained."}
        </p>
      </Show>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class={buttonClass}
          disabled={data.query.isFetching || !data.rows().length}
          onClick={() => void data.loadOlder()}
        >
          Load older history
        </button>
        <button
          type="button"
          class={buttonClass}
          disabled={data.query.isFetching}
          onClick={() => void data.retryHistory()}
        >
          Retry history
        </button>
        <button type="button" class={buttonClass} onClick={data.reconnect}>
          Reconnect live
        </button>
      </div>
    </section>
  );
}
