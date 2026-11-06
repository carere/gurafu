import type { ISeriesApi, Time } from "lightweight-charts";
import * as Chart from "~/components/gurafu/chart";

export function PublicTypes() {
  return (
    <Chart.Root
      options={{ layout: { fontFamily: "serif" }, timeScale: { secondsVisible: true } }}
      onClick={(event) => {
        const map: Map<unknown, unknown> = event.seriesData;
        void map;
      }}
    >
      <Chart.Pane
        id="price"
        apiRef={(pane) => {
          pane?.api.paneIndex();
        }}
      >
        <Chart.CandlestickSeries
          id="candles"
          data={Object.freeze([
            Object.freeze({
              time: Object.freeze({ year: 2026, month: 10, day: 1 }),
              open: 1,
              high: 3,
              low: 0,
              close: 2,
            }),
            { time: "2026-10-02" },
          ])}
          options={{
            upColor: "red",
            priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
          }}
          apiRef={(controller) => {
            const native: ISeriesApi<"Candlestick", Time> | undefined = controller?.api;
            void native;
            // @ts-expect-error Snapshot controllers have no competing data writer.
            controller?.setData([]);
          }}
        />
        <Chart.CandlestickSeries
          id="timestamps"
          data={[
            {
              time: 1790812800 as import("lightweight-charts").UTCTimestamp,
              open: 1,
              high: 2,
              low: 0,
              close: 1,
            },
          ]}
        />
        <Chart.CandlestickSeries
          id="unbranded"
          data={[
            // @ts-expect-error Timestamps require the upstream seconds brand.
            { time: 1790812800000, open: 1, high: 2, low: 0, close: 1 },
          ]}
        />
        {/* @ts-expect-error Candlesticks need OHLC rather than line values. */}
        <Chart.CandlestickSeries id="wrong-data" data={[{ time: "2026-10-01", value: 42 }]} />
        {/* @ts-expect-error Line-only options are not candlestick options. */}
        <Chart.CandlestickSeries id="wrong-options" data={[]} options={{ lineWidth: 2 }} />
        {/* @ts-expect-error This slice only ships snapshot composition. */}
        <Chart.CandlestickSeries id="wrong-mode" data={[]} defaultData={[]} />
      </Chart.Pane>
    </Chart.Root>
  );
}
