import type { CandlestickData } from "lightweight-charts";
import { createSignal } from "solid-js";
import { Button } from "@/components/ui/button";
import * as Chart from "@/registry/kobalte/chart/chart";

// Illustrative UTC daily bars. The application owns the displayed snapshot.
const history: readonly CandlestickData[] = [
  { time: "2026-10-01", open: 100, high: 108, low: 96, close: 105 },
  { time: "2026-10-02", open: 105, high: 112, low: 102, close: 110 },
  { time: "2026-10-03", open: 110, high: 113, low: 103, close: 106 },
  { time: "2026-10-04", open: 106, high: 109, low: 98, close: 101 },
  { time: "2026-10-05", open: 101, high: 111, low: 99, close: 108 },
  { time: "2026-10-06", open: 108, high: 116, low: 106, close: 114 },
  { time: "2026-10-07", open: 114, high: 119, low: 110, close: 112 },
  { time: "2026-10-08", open: 112, high: 121, low: 111, close: 118 },
];

export function Basics() {
  const [display, setDisplay] = createSignal(history);
  return (
    <section aria-labelledby="basics-heading" class="space-y-4">
      <h2 id="basics-heading" class="text-2xl font-semibold tracking-tight">
        Basics
      </h2>
      <p class="max-w-prose text-muted-foreground">
        An explicit price pane and a supplied candlestick snapshot. Drag to pan and scroll to zoom.
        These prices are illustrative.
      </p>
      <Chart.Root
        class="h-80 w-full"
        role="region"
        aria-label="Illustrative daily price chart"
        options={{ autoSize: true, timeScale: { barSpacing: 28 } }}
      >
        <Chart.Pane id="price">
          <Chart.CandlestickSeries id="candles" data={display()} />
        </Chart.Pane>
      </Chart.Root>
      <p role="status" class="text-sm text-muted-foreground">
        {display().length
          ? `${display().length} daily candles displayed`
          : "No candles displayed. Restore the snapshot to continue."}
      </p>
      <div class="flex flex-wrap gap-3">
        <Button onClick={() => setDisplay(history.slice(-4))} variant="outline">
          Show last four days
        </Button>
        <Button onClick={() => setDisplay([])} variant="outline">
          Clear candles
        </Button>
        <Button onClick={() => setDisplay(history)}>Restore snapshot</Button>
      </div>
    </section>
  );
}
