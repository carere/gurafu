import type { BusinessDay, UTCTimestamp } from "lightweight-charts";
import * as Chart from "~/components/gurafu/chart";
import * as Indicators from "~/components/gurafu/indicators";

const ts = 1700000000 as UTCTimestamp;
const emaParameters: Indicators.EMAParameters = { period: 3, priceInput: "ohlc4" };
const rsiParameters: Indicators.RSIParameters = { period: 3, priceInput: "hlc3" };
const ema: Indicators.IndicatorValue<UTCTimestamp>[] = Indicators.calculateEMA(
  [{ time: ts, value: 0 }],
  emaParameters,
);
const rsi = Indicators.calculateRSI(
  [{ time: { year: 2026, month: 1, day: 1 } as BusinessDay, value: 0 }],
  rsiParameters,
);
const exactTime: UTCTimestamp = ema[0].time;
const day: BusinessDay = rsi[0].time;
void exactTime;
void day;
<Chart.Root>
  <Chart.Pane id="price">
    <Indicators.EMA id="ema" data={ema} options={{ lineWidth: 3, lineType: 2 }} />
  </Chart.Pane>
  <Chart.Pane id="rsi">
    <Indicators.RSI
      id="rsi"
      source="prices"
      parameters={rsiParameters}
      priceScaleOptions={{ mode: 0, scaleMargins: { top: 0, bottom: 0 } }}
      referenceLines={[{ price: 25, color: "#123456", lineStyle: 2, lineWidth: 3 }]}
      options={{ autoscaleInfoProvider: () => ({ priceRange: { minValue: 10, maxValue: 90 } }) }}
    />
    <Indicators.RSI id="supplied" data={rsi} />
  </Chart.Pane>
</Chart.Root>;
// @ts-expect-error a single data writer: source and results cannot compete
<Indicators.EMA id="bad" source="prices" data={ema} />;
// @ts-expect-error supplied results do not take calculation parameters
<Indicators.RSI id="bad" data={rsi} parameters={rsiParameters} />;
// @ts-expect-error source or supplied results required
<Indicators.RSI id="missing" />;
// @ts-expect-error unknown price selector
<Indicators.EMA id="bad" source="prices" parameters={{ priceInput: "volume" }} />;
// @ts-expect-error numeric result required
<Indicators.RSI id="bad" data={[{ time: ts, value: "wrong" }]} />;
// @ts-expect-error native Time is branded
Indicators.calculateEMA([{ time: 1700000000, value: 1 }]);
// @ts-expect-error native Time is branded
Indicators.calculateRSI([{ time: 1700000000, value: 1 }]);
