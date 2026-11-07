import type { BusinessDay, UTCTimestamp } from "lightweight-charts";
import * as Chart from "~/components/gurafu/chart";
import * as Indicators from "~/components/gurafu/indicators";

const ts = 1700000000 as UTCTimestamp;
const input = [{ time: ts, value: 0 }] as const;
const bands = Indicators.calculateBollingerBands(input);
const exactTime: UTCTimestamp = bands[0].time;
const sma = Indicators.calculateSMA([
  { time: { year: 2026, month: 1, day: 1 } as BusinessDay, value: 0 },
]);
const day: BusinessDay = sma[0].time;
void exactTime;
void day;
<Chart.Root apiRef={(c) => c?.requestIndicatorVisibility("bands", false)}>
  <Chart.Pane id="price">
    <Indicators.BollingerBands id="bands" data={bands} />
    <Indicators.SMA id="sma" source="prices" parameters={{ period: 3, priceInput: "hlc3" }} />
  </Chart.Pane>
</Chart.Root>;
// @ts-expect-error calculated source and supplied snapshot cannot compete
<Indicators.BollingerBands id="bad" source="prices" data={bands} />;
// @ts-expect-error complete triple or whitespace, never partial bands
<Indicators.BollingerBands id="partial" data={[{ time: ts, middle: 2 }]} />;
// @ts-expect-error unknown selectors are not price inputs
<Indicators.SMA id="bad-input" source="prices" parameters={{ priceInput: "volume" }} />;
// @ts-expect-error source or snapshot is required
<Indicators.SMA id="missing" />;
// @ts-expect-error raw numbers are not branded native UTC timestamps
Indicators.calculateSMA([{ time: 1700000000, value: 1 }]);
// @ts-expect-error supplied single-value results are numeric or whitespace
<Indicators.SMA id="wrong-result" data={[{ time: ts, value: "wrong" }]} />;
// @ts-expect-error supplied Bands preserve native Time branding too
<Indicators.BollingerBands
  id="wrong-time"
  data={[{ time: 1700000000, middle: 1, upper: 2, lower: 0 }]}
/>;
