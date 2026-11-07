import type {
  CandlestickData,
  CreatePriceLineOptions,
  DeepPartial,
  ISeriesApi,
  LineSeriesPartialOptions,
  PriceScaleOptions,
  WhitespaceData,
} from "lightweight-charts";
import { batch, createSignal, Show } from "solid-js";
import { render } from "solid-js/web";
import * as Chart from "~/components/gurafu/chart";
import * as Indicators from "~/components/gurafu/indicators";

const time = (i: number) => `2026-01-${String(i).padStart(2, "0")}`;
const row = (i: number, close = i) => ({
  time: time(i),
  open: close,
  high: close + 2,
  low: close - 1,
  close,
});
const initial = [1, 2, 1, 2, 3, 2].map((v, i) => row(i + 1, v));
export function mountIndicators23(host: HTMLElement) {
  const [key, setKey] = createSignal("first");
  const [seed, setSeed] = createSignal<readonly (CandlestickData | WhitespaceData)[]>(initial);
  const [parameters, setParameters] = createSignal<Indicators.EMAParameters>({ period: 3 });
  const [source, setSource] = createSignal("candles");
  const [visible, setVisible] = createSignal(true);
  const [target, setTarget] = createSignal("rsi");
  const [appearance, setAppearance] = createSignal(false);
  const [mounted, setMounted] = createSignal(true);
  const [pane, setPane] = createSignal(true);
  const [options, setOptions] = createSignal<LineSeriesPartialOptions>({});
  const [scaleOptions, setScaleOptions] = createSignal<DeepPartial<PriceScaleOptions>>({});
  const [references, setReferences] = createSignal<readonly CreatePriceLineOptions[]>();
  const state = {
    chart: undefined as Chart.ChartController | undefined,
    sibling: undefined as Chart.ChartController | undefined,
    candles: undefined as Chart.CandlestickIncrementalController | undefined,
    requests: [] as boolean[],
    events: [] as { ready: boolean; ema: number[]; rsi: number[] }[],
    initial,
    time,
    row,
    setParameters,
    setSource,
    setVisible,
    setTarget,
    setAppearance,
    setMounted,
    setPane,
    setOptions,
    setScaleOptions,
    setReferences,
    calculateEMA: Indicators.calculateEMA,
    calculateRSI: Indicators.calculateRSI,
    switch(empty = false) {
      batch(() => {
        setSeed(empty ? [] : [row(1, 10), row(2, 20), row(3, 10), row(4, 20)]);
        setKey(empty ? "empty" : "next");
      });
    },
    line(title: string, sibling = false) {
      const c = sibling ? state.sibling : state.chart;
      const found = c?.api
        .panes()
        .flatMap((p) => p.getSeries())
        .find((s) => s.options().title === title);
      if (!found) throw new Error(`Missing ${title}`);
      return found as ISeriesApi<"Line">;
    },
  };
  Object.assign(window, { indicators23: state });
  render(
    () => (
      <>
        <Chart.Root
          datasetKey={key()}
          apiRef={(v) => {
            state.chart = v;
          }}
          options={{ autoSize: true }}
          style={{ height: "520px" }}
        >
          <Chart.Pane id="price">
            <Indicators.EMA
              id="ema"
              source={source()}
              parameters={parameters()}
              visible={visible()}
              onVisibleChange={(v) => state.requests.push(v)}
              options={{
                title: "ema",
                ...options(),
                ...(appearance() ? { lineWidth: 3 as const, lineStyle: 2 as const } : {}),
              }}
            />
            <Indicators.SMA
              id="sma"
              source="candles"
              parameters={parameters()}
              options={{ title: "sma", ...options() }}
            />
            <Indicators.BollingerBands
              id="bands"
              source="candles"
              parameters={parameters()}
              options={{
                middle: { title: "bands-middle", ...options() },
                upper: { title: "bands-upper", ...options() },
                lower: { title: "bands-lower", ...options() },
              }}
            />
            <Chart.CandlestickSeries
              id="candles"
              defaultData={seed()}
              apiRef={(v) => {
                state.candles = v;
              }}
              onDataChange={() => {
                if (!state.chart || !state.candles) return;
                const ready = state.chart.ready();
                const values = (name: string) =>
                  state
                    .line(name)
                    .data()
                    .flatMap((r) => ("value" in r ? [r.value] : []));
                state.events.push({
                  ready,
                  ema: ready ? values("ema") : [],
                  rsi: ready ? values("rsi") : [],
                });
              }}
            />
            <Indicators.EMA
              id="supplied-ema"
              data={Indicators.calculateEMA(initial, { period: 3 })}
              options={{ title: "supplied-ema" }}
            />
          </Chart.Pane>
          <Chart.Pane id="volume" stretchFactor={0.25}>
            <Chart.HistogramSeries
              id="volume"
              data={initial.map((r) => ({ time: r.time, value: 10 }))}
            />
            <Chart.LineSeries
              id="single"
              data={[0, 3, 0, 3, 6, 3].map((value, i) => ({ time: time(i + 1), value }))}
            />
          </Chart.Pane>
          <Show when={pane()}>
            <Chart.Pane id="rsi" stretchFactor={0.4} />
          </Show>
          <Chart.Pane id="other" stretchFactor={0.4}>
            <Indicators.RSI
              id="supplied-rsi"
              data={Indicators.calculateRSI(initial, { period: 3 })}
              options={{ title: "supplied-rsi" }}
            />
          </Chart.Pane>
          <Show when={mounted()}>
            <Indicators.RSI
              id="rsi"
              pane={target()}
              source={source()}
              parameters={parameters()}
              defaultVisible
              options={{
                title: "rsi",
                ...options(),
                ...(appearance()
                  ? {
                      lineWidth: 3 as const,
                      lineStyle: 2 as const,
                      autoscaleInfoProvider: () => ({ priceRange: { minValue: 10, maxValue: 90 } }),
                    }
                  : {}),
              }}
              priceScaleOptions={
                appearance()
                  ? { mode: 0, invertScale: true, scaleMargins: { top: 0, bottom: 0 } }
                  : scaleOptions()
              }
              referenceLines={
                appearance()
                  ? [
                      {
                        price: 25,
                        color: "#123456",
                        lineWidth: 3,
                        lineStyle: 2,
                        axisLabelVisible: false,
                      },
                    ]
                  : references()
              }
            />
          </Show>
        </Chart.Root>
        <Chart.Root
          apiRef={(v) => {
            state.sibling = v;
          }}
          options={{ autoSize: true }}
          style={{ height: "160px" }}
        >
          <Chart.Pane id="rsi">
            <Indicators.RSI id="rsi" data={[]} defaultVisible options={{ title: "rsi" }} />
          </Chart.Pane>
        </Chart.Root>
      </>
    ),
    host,
  );
}
