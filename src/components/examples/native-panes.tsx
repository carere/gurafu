import type { CandlestickData } from "lightweight-charts";
import { createEffect, createSignal, For, onCleanup } from "solid-js";
import * as Chart from "@/registry/kobalte/chart/chart";

// Application-supplied illustrative bars and traded volume, not a feed service.
const candles: readonly CandlestickData[] = [
  { time: "2026-10-01", open: 100, high: 108, low: 96, close: 105 },
  { time: "2026-10-02", open: 105, high: 112, low: 102, close: 110 },
  { time: "2026-10-03", open: 110, high: 113, low: 103, close: 106 },
  { time: "2026-10-04", open: 106, high: 109, low: 98, close: 106 },
];
const tradedVolume = [120, 185, 90, 145];
const volume = candles.map((bar, index) => ({
  time: bar.time,
  value: tradedVolume[index],
  color: bar.close >= bar.open ? "#15803d" : "#dc2626",
}));
const buttonClass =
  "rounded-md border px-3 py-2 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2";

export function NativePanes() {
  const [overlay, setOverlay] = createSignal(false);
  const [volumeController, setVolumeController] = createSignal<Chart.HistogramSnapshotController>();
  createEffect(() => {
    const controller = volumeController();
    const isOverlay = overlay();
    if (!controller) return;
    // Reconcile the declaration's pane/priceScaleId first, then reacquire the
    // native price scale. An old scale handle stays bound to its former pane.
    const frame = requestAnimationFrame(() => {
      if (controller.ready())
        controller.api
          .priceScale()
          .applyOptions({ scaleMargins: { top: isOverlay ? 0.8 : 0.1, bottom: 0 } });
    });
    onCleanup(() => cancelAnimationFrame(frame));
  });
  const [volumeFirst, setVolumeFirst] = createSignal(false);
  const panes = () =>
    overlay() ? ["price"] : volumeFirst() ? ["volume", "price"] : ["price", "volume"];
  return (
    <section aria-labelledby="panes-heading" class="space-y-4">
      <h2 id="panes-heading" class="text-2xl font-semibold tracking-tight">
        Native panes
      </h2>
      <p class="max-w-prose text-muted-foreground">
        Price and volume share one timeline. Drag the separator to resize the native panes. Moving
        volume or reordering panes retains their compatible resources and data. The overlay is an
        intentional alternative; volume colors count dojis as up.
      </p>
      <Chart.Root
        class="w-full"
        style={{ height: "384px" }}
        role="region"
        aria-label="Price and volume composition"
        options={{
          ...Chart.lightChartOptions,
          autoSize: true,
          timeScale: { ...Chart.lightChartOptions.timeScale, barSpacing: 70 },
          layout: {
            ...Chart.lightChartOptions.layout,
            panes: { ...Chart.lightChartOptions.layout.panes, enableResize: true },
          },
        }}
      >
        <For each={panes()}>
          {(id) => <Chart.Pane id={id} stretchFactor={id === "volume" ? 0.25 : 1} />}
        </For>
        <Chart.CandlestickSeries
          id="candles"
          pane="price"
          data={candles}
          options={{
            upColor: "#15803d",
            wickUpColor: "#15803d",
            borderUpColor: "#15803d",
            downColor: "#dc2626",
            wickDownColor: "#dc2626",
            borderDownColor: "#dc2626",
          }}
        />
        <Chart.HistogramSeries
          id="volume"
          pane={overlay() ? "price" : "volume"}
          data={volume}
          options={{
            priceFormat: { type: "volume" },
            priceScaleId: overlay() ? "volume-overlay" : "right",
          }}
          apiRef={setVolumeController}
        />
      </Chart.Root>
      <div class="flex flex-wrap gap-3">
        <button type="button" class={buttonClass} onClick={() => setOverlay(!overlay())}>
          {overlay() ? "Use native volume pane" : "Overlay volume on price"}
        </button>
        <button
          type="button"
          class={buttonClass}
          disabled={overlay()}
          classList={{ "opacity-50 cursor-not-allowed": overlay() }}
          onClick={() => setVolumeFirst(!volumeFirst())}
        >
          {volumeFirst() ? "Volume below price" : "Volume above price"}
        </button>
      </div>
    </section>
  );
}
