import type { CandlestickData } from "lightweight-charts";
import { createSignal, Match, Switch } from "solid-js";
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

const buttonClass =
  "rounded-md border px-3 py-2 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2";

export function Basics() {
  const [display, setDisplay] = createSignal(history);
  const [family, setFamily] = createSignal("Candlestick");
  const [dark, setDark] = createSignal(false);
  const [grid, setGrid] = createSignal(true);
  const appearance = () => (dark() ? Chart.darkChartOptions : Chart.lightChartOptions);
  const values = () => display().map((bar) => ({ time: bar.time, value: bar.close }));
  return (
    <section aria-labelledby="basics-heading" class="space-y-4">
      <h2 id="basics-heading" class="text-2xl font-semibold tracking-tight">
        Basics
      </h2>
      <p class="max-w-prose text-muted-foreground">
        Six standard series with consumer-owned snapshots. Appearance patches keep the current chart
        and series; choosing a different series type creates a fresh series. Prices are
        illustrative.
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-sm">
          Series type
          <select
            class="rounded-md border bg-background px-3 py-2 focus-visible:outline-2"
            value={family()}
            onChange={(event) => setFamily(event.currentTarget.value)}
          >
            <option>Candlestick</option>
            <option>Bar</option>
            <option>Line</option>
            <option>Area</option>
            <option>Baseline</option>
            <option>Histogram</option>
          </select>
        </label>
        <button type="button" class={buttonClass} onClick={() => setDark(!dark())}>
          {dark() ? "Light appearance" : "Dark appearance"}
        </button>
        <button type="button" class={buttonClass} onClick={() => setGrid(!grid())}>
          {grid() ? "Hide grid" : "Show grid"}
        </button>
      </div>
      <Chart.Root
        class="w-full"
        style={{ height: "320px" }}
        role="region"
        aria-label="Illustrative daily price chart"
        options={{
          ...appearance(),
          autoSize: true,
          timeScale: { ...appearance().timeScale, barSpacing: 28 },
          grid: {
            vertLines: { ...appearance().grid.vertLines, visible: grid() },
            horzLines: { ...appearance().grid.horzLines, visible: grid() },
          },
        }}
      >
        <Chart.Pane id="price">
          <Switch>
            <Match when={family() === "Candlestick"}>
              <Chart.CandlestickSeries id="price" data={display()} />
            </Match>
            <Match when={family() === "Bar"}>
              <Chart.BarSeries id="price" data={display()} />
            </Match>
            <Match when={family() === "Line"}>
              <Chart.LineSeries id="price" data={values()} />
            </Match>
            <Match when={family() === "Area"}>
              <Chart.AreaSeries id="price" data={values()} />
            </Match>
            <Match when={family() === "Baseline"}>
              <Chart.BaselineSeries
                id="price"
                data={values()}
                options={{ baseValue: { type: "price", price: 108 } }}
              />
            </Match>
            <Match when={family() === "Histogram"}>
              <Chart.HistogramSeries id="price" data={values()} />
            </Match>
          </Switch>
        </Chart.Pane>
      </Chart.Root>
      <p role="status" class="text-sm text-muted-foreground">
        {display().length
          ? `${display().length} daily ${family()} rows displayed`
          : "No data displayed. Restore the snapshot to continue."}
      </p>
      <div class="flex flex-wrap gap-3">
        <button type="button" class={buttonClass} onClick={() => setDisplay(history.slice(-4))}>
          Show last four days
        </button>
        <button type="button" class={buttonClass} onClick={() => setDisplay([])}>
          Clear snapshot
        </button>
        <button type="button" class={buttonClass} onClick={() => setDisplay(history)}>
          Restore snapshot
        </button>
      </div>
    </section>
  );
}
