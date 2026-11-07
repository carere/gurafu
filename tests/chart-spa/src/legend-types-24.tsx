import type { Time, UTCTimestamp } from "lightweight-charts";
import * as Chart from "~/components/gurafu/chart";
import { ChartIndicatorControls } from "~/components/gurafu/chart-indicator-controls";
import { ChartLegend, useLegend } from "~/components/gurafu/chart-legend";

function contract(
  chart: Chart.ChartController,
  series: Chart.CandlestickController,
  pane: Chart.PaneController,
) {
  for (const time of [
    "2026-01-01",
    { year: 2026, month: 1, day: 1 },
    1 as UTCTimestamp,
  ] satisfies Time[])
    chart.setCrosshairPosition(0, time, series);
  chart.clearCrosshairPosition();
  // @ts-expect-error native Time numbers remain branded
  chart.setCrosshairPosition(0, 123, series);
  // @ts-expect-error a pane is not a series controller
  chart.setCrosshairPosition(0, "2026-01-01", pane);
  const legend = useLegend({ priceSeries: "candles" });
  // @ts-expect-error accessor is read only
  legend({ time: null });
  // @ts-expect-error read model properties are readonly
  legend().count = 5;
  if (legend().time && typeof legend().time === "object") {
    const time = legend().time;
    if (time && typeof time === "object") {
      // @ts-expect-error calendar time in the read model is readonly too
      time.year = 2030;
    }
  }
  // @ts-expect-error rows are readonly
  legend().indicators.push({});
  return (
    <>
      <Chart.Root devtools={{ name: "Inspector" }} />
      <ChartLegend
        priceSeries="candles"
        labels={{ hide: "Masquer", indicatorsById: { sma: "Moyenne" } }}
        renderOHLC={(model) => model.ohlc?.close}
        renderIndicator={(row, request) => (
          <button type="button" onClick={() => request(!row.visible)}>
            {row.label}
          </button>
        )}
      />
      <ChartIndicatorControls items={[]} defaultValue={["sma"]} />
    </>
  );
}
void contract;
// @ts-expect-error debugger opt-in requires a name
const invalidDebug = <Chart.Root devtools={true} />;
// @ts-expect-error selection cannot have competing controlled/default authority
const invalidSelection = <ChartIndicatorControls items={[]} value={[]} defaultValue={[]} />;
void [invalidDebug, invalidSelection];
