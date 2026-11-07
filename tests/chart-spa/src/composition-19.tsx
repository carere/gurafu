import { createSignal } from "solid-js";
import * as Chart from "~/components/gurafu/chart";

const points = Object.freeze([
  Object.freeze({ time: "2026-10-01", value: 10 }),
  Object.freeze({ time: "2026-10-02", value: 20 }),
]);
const bars = Object.freeze([
  Object.freeze({ time: "2026-10-01", open: 10, high: 14, low: 9, close: 12 }),
  Object.freeze({ time: "2026-10-02", open: 12, high: 22, low: 11, close: 20 }),
]);
const series: Record<
  string,
  | Chart.SnapshotSeriesController<
      import("lightweight-charts").ISeriesApi<
        import("lightweight-charts").SeriesType,
        import("lightweight-charts").Time
      >
    >
  | undefined
> = {};
const [patch, setPatch] = createSignal(false);
const [dark, setDark] = createSignal(false);
const [swapped, setSwapped] = createSignal(false);
const [changed, setChanged] = createSignal(false);
const eventCounts = { old: 0, current: 0 };
let lastChange: import("lightweight-charts").DataChangedScope | undefined;
const callbacks = [
  (scope: import("lightweight-charts").DataChangedScope) => {
    eventCounts.old++;
    lastChange = scope;
  },
  (scope: import("lightweight-charts").DataChangedScope) => {
    eventCounts.current++;
    lastChange = scope;
  },
];
let event:
  | import("lightweight-charts").MouseEventParams<import("lightweight-charts").Time>
  | undefined;
let chart: Chart.ChartController | undefined;
Object.assign(window, {
  composition19: {
    series,
    chart: () => chart,
    eventCounts,
    event: () => event,
    change: () => lastChange,
    patch: () => setPatch(true),
    theme: () => setDark(true),
    swap: () => setSwapped(true),
    replace: () => setChanged(true),
  },
});

export function Composition19() {
  return (
    <Chart.Root
      style={{ height: "500px" }}
      onClick={(native) => {
        event = native;
      }}
      apiRef={(c) => {
        chart = c;
      }}
      options={{
        ...(dark() ? Chart.darkChartOptions : Chart.lightChartOptions),
        autoSize: true,
        layout: {
          ...(dark() ? Chart.darkChartOptions.layout : Chart.lightChartOptions.layout),
          fontSize: patch() ? 16 : 12,
          colorSpace: patch() ? "display-p3" : "srgb",
          colorParsers: patch() ? [() => null] : [],
        },
      }}
    >
      <Chart.Pane id="price">
        <Chart.CandlestickSeries
          id="candles"
          data={changed() ? bars.slice(-1) : bars}
          onDataChange={callbacks[swapped() ? 1 : 0]}
          apiRef={(c) => {
            series.candles = c;
          }}
        />
        <Chart.BarSeries
          id="bar"
          data={changed() ? bars.slice(-1) : bars}
          onDataChange={callbacks[swapped() ? 1 : 0]}
          apiRef={(c) => {
            series.bar = c;
          }}
        />
        <Chart.LineSeries
          id="line"
          data={changed() ? points.slice(-1) : points}
          onDataChange={callbacks[swapped() ? 1 : 0]}
          options={patch() ? { lineWidth: 4 } : { color: "#123456" }}
          apiRef={(c) => {
            series.line = c;
          }}
        />
        <Chart.AreaSeries
          id="area"
          data={changed() ? points.slice(-1) : points}
          onDataChange={callbacks[swapped() ? 1 : 0]}
          apiRef={(c) => {
            series.area = c;
          }}
        />
        <Chart.BaselineSeries
          id="baseline"
          data={changed() ? points.slice(-1) : points}
          onDataChange={callbacks[swapped() ? 1 : 0]}
          apiRef={(c) => {
            series.baseline = c;
          }}
        />
      </Chart.Pane>
      <Chart.Pane id="volume">
        <Chart.HistogramSeries
          id="volume"
          data={changed() ? points.slice(-1) : points}
          onDataChange={callbacks[swapped() ? 1 : 0]}
          apiRef={(c) => {
            series.volume = c;
          }}
        />
      </Chart.Pane>
    </Chart.Root>
  );
}
