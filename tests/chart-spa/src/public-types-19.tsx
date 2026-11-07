import type { ISeriesApi, Time, UTCTimestamp } from "lightweight-charts";
import * as Chart from "~/components/gurafu/chart";

export function StandardTypes19() {
  return (
    <Chart.Root>
      <Chart.Pane id="price">
        <Chart.BarSeries
          id="bar"
          data={Object.freeze([{ time: "2026-10-01", open: 1, high: 3, low: 0, close: 2 }])}
          options={{ thinBars: true }}
          apiRef={(c) => {
            const api: ISeriesApi<"Bar", Time> | undefined = c?.api;
            void api;
            // @ts-expect-error Snapshot controllers do not write data.
            c?.update({ time: "2026-10-02", open: 1, high: 3, low: 0, close: 2 });
          }}
        />
        <Chart.LineSeries
          id="line"
          data={[{ time: 1790812800 as UTCTimestamp, value: 2 }]}
          options={{ lineWidth: 3, pointMarkersVisible: true }}
          apiRef={(c) => {
            const api: ISeriesApi<"Line", Time> | undefined = c?.api;
            void api;
          }}
        />
        <Chart.AreaSeries
          id="area"
          data={[{ time: Object.freeze({ year: 2026, month: 10, day: 1 }), value: 2 }]}
          options={{ topColor: "red", invertFilledArea: true }}
          apiRef={(c) => {
            const api: ISeriesApi<"Area", Time> | undefined = c?.api;
            void api;
          }}
        />
        <Chart.BaselineSeries
          id="baseline"
          data={[{ time: "2026-10-01", value: 2 }]}
          options={{ baseValue: { type: "price", price: 0 }, topLineColor: "red" }}
          apiRef={(c) => {
            const api: ISeriesApi<"Baseline", Time> | undefined = c?.api;
            void api;
          }}
        />
        <Chart.HistogramSeries
          id="histogram"
          data={[{ time: "2026-10-01", value: 2, color: "red" }, { time: "2026-10-02" }]}
          options={{ base: 0, priceFormat: { type: "volume" } }}
          apiRef={(c) => {
            const api: ISeriesApi<"Histogram", Time> | undefined = c?.api;
            void api;
          }}
        />
        {/* @ts-expect-error Bar data needs OHLC. */}
        <Chart.BarSeries id="bad-bar" data={[{ time: "2026-10-01", value: 2 }]} />
        <Chart.LineSeries
          id="bad-line"
          data={[
            // @ts-expect-error A Line row requires value, not OHLC.
            { time: "2026-10-01", open: 1, high: 2, low: 0, close: 1 },
          ]}
        />
        <Chart.AreaSeries
          id="bad-area"
          data={[]}
          options={{
            // @ts-expect-error Area options are family-specific.
            baseValue: { type: "price", price: 0 },
          }}
        />
        {/* @ts-expect-error Baseline options are family-specific. */}
        <Chart.BaselineSeries id="bad-baseline" data={[]} options={{ upColor: "red" }} />
        {/* @ts-expect-error Histogram has no line width. */}
        <Chart.HistogramSeries id="bad-histogram" data={[]} options={{ lineWidth: 2 }} />
      </Chart.Pane>
    </Chart.Root>
  );
}
