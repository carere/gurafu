import type { ISeriesApi, Time } from "lightweight-charts";
import * as Chart from "~/components/gurafu/chart";

export function DataTypes() {
  return (
    <Chart.Root
      datasetKey={42}
      apiRef={(chart) => {
        chart?.goToTime("2026-10-01");
        chart?.goToLatest();
      }}
    >
      <Chart.Pane id="price">
        <Chart.CandlestickSeries
          id="empty"
          apiRef={(series) => {
            const native: ISeriesApi<"Candlestick", Time> | undefined = series?.api;
            void native;
            series?.setData([]);
            series?.update({ time: "2026-10-01", open: 1, high: 2, low: 0, close: 1 });
            const popped:
              | import("lightweight-charts").SeriesDataItemTypeMap<Time>["Candlestick"][]
              | undefined = series?.pop(1);
            void popped;
            // @ts-expect-error Incremental writers retain the candlestick row type.
            series?.update({ time: "2026-10-01", value: 1 });
            // @ts-expect-error Replacement must also have candlestick rows.
            series?.setData([{ time: "2026-10-01", value: 1 }]);
          }}
        />
        <Chart.CandlestickSeries
          id="seeded"
          defaultData={Object.freeze([
            Object.freeze({ time: "2026-10-01", open: 1, high: 2, low: 0, close: 1 }),
          ])}
          apiRef={(series) => series?.setData([])}
        />
        <Chart.CandlestickSeries
          id="snapshot"
          data={[]}
          apiRef={(series) => {
            // @ts-expect-error Snapshot has no replacement writer.
            series?.setData([]);
            // @ts-expect-error Snapshot has no live writer.
            series?.update({ time: "2026-10-01" });
            // @ts-expect-error Snapshot has no rewind writer.
            series?.pop(1);
          }}
        />
        <Chart.LineSeries
          id="incremental-line"
          apiRef={(series) => {
            const native: ISeriesApi<"Line", Time> | undefined = series?.api;
            void native;
            series?.setData([{ time: "2026-10-01", value: 0 }]);
            series?.update({ time: "2026-10-02", value: 1 });
            // @ts-expect-error Incremental Line writers cannot accept OHLC rows.
            series?.update({ time: "2026-10-01", open: 1, high: 2, low: 0, close: 1 });
          }}
        />
        {/* @ts-expect-error Snapshot and incremental authority are exclusive. */}
        <Chart.CandlestickSeries id="both" data={[]} defaultData={[]} />
        {/* @ts-expect-error Invalid seed rows must be rejected too. */}
        <Chart.CandlestickSeries id="bad-seed" defaultData={[{ time: "2026-10-01", value: 2 }]} />
      </Chart.Pane>
    </Chart.Root>
  );
}
