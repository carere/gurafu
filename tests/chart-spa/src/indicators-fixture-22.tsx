import type { ISeriesApi, Time } from "lightweight-charts";
import { createSignal, Show } from "solid-js";
import { render } from "solid-js/web";
import * as Chart from "~/components/gurafu/chart";
import * as Indicators from "~/components/gurafu/indicators";

const time = (i: number) => `2026-01-${String(i).padStart(2, "0")}`;
const row = (i: number, close = i) => ({
  time: time(i),
  open: close,
  high: close + 1,
  low: close - 1,
  close,
});
const initial = [1, 2, 3, 4].map((i) => row(i));
export function mountIndicators22(host: HTMLElement) {
  const [key, setKey] = createSignal("first");
  const [seed, setSeed] = createSignal<readonly Indicators.PriceRow[]>(initial);
  const [source, setSource] = createSignal("candles");
  const [parameters, setParameters] = createSignal<Indicators.BollingerBandsParameters>({
    period: 3,
  });
  const [supplied, setSupplied] = createSignal<readonly Indicators.BollingerBandsValue[]>(
    Indicators.calculateBollingerBands(initial, { period: 3 }),
  );
  const [visible, setVisible] = createSignal(true);
  const [target, setTarget] = createSignal("price");
  const [appearance, setAppearance] = createSignal(false);
  const [bands, setBands] = createSignal(true);
  const [mounted, setMounted] = createSignal(true);
  const state = {
    chart: undefined as Chart.ChartController | undefined,
    sibling: undefined as Chart.ChartController | undefined,
    candles: undefined as Chart.CandlestickIncrementalController | undefined,
    requests: [] as boolean[],
    row,
    time,
    initial,
    calculateBollingerBands: Indicators.calculateBollingerBands,
    calculateSMA: Indicators.calculateSMA,
    setParameters,
    setSource,
    setVisible,
    setSupplied,
    setTarget,
    setAppearance,
    setBands,
    switch() {
      setSeed([row(1, 10), row(2, 20), row(3, 30)]);
      setKey("next");
    },
    unmount: () => setMounted(false),
    line(title: string, sibling = false) {
      const chart = sibling ? state.sibling : state.chart;
      const line = chart?.api
        .panes()
        .flatMap((p) => p.getSeries())
        .find((s) => s.options().title === title);
      if (!line) throw new Error(`Missing line ${title}`);
      return line as ISeriesApi<"Line", Time>;
    },
  };
  Object.assign(window, { indicators22: state });
  const options = (title: string) => ({
    title,
    ...(appearance()
      ? { lineWidth: 3 as const, lineStyle: 2 as const, priceLineVisible: false }
      : {}),
  });
  render(
    () => (
      <Show when={mounted()}>
        <Chart.Root
          datasetKey={key()}
          apiRef={(v) => {
            state.chart = v;
          }}
          options={{ autoSize: true }}
          style={{ height: "360px" }}
        >
          <Chart.Pane id="price">
            <Chart.CandlestickSeries
              id="candles"
              defaultData={seed() as readonly import("lightweight-charts").CandlestickData[]}
              apiRef={(v) => {
                state.candles = v;
              }}
            />
            <Indicators.BollingerBands
              id="supplied"
              data={supplied()}
              options={{
                middle: { title: "supplied-middle" },
                upper: { title: "supplied-upper" },
                lower: { title: "supplied-lower" },
              }}
            />
            <Indicators.SMA
              id="sma"
              source={source()}
              parameters={{ period: parameters().period ?? 20 }}
              options={{ title: "sma" }}
            />
            <Indicators.SMA
              id="local"
              source="candles"
              defaultVisible={false}
              options={{ title: "local" }}
            />
          </Chart.Pane>
          <Chart.Pane id="other">
            <Chart.LineSeries
              id="single"
              data={[1, 2, 3, 4].map((i) => ({ time: time(i), value: 10 * i }))}
            />
          </Chart.Pane>
          <Show when={bands()}>
            <Indicators.BollingerBands
              id="calc"
              pane={target()}
              source={source()}
              parameters={parameters()}
              visible={visible()}
              onVisibleChange={(v) => state.requests.push(v)}
              options={{
                middle: options("calc-middle"),
                upper: options("calc-upper"),
                lower: options("calc-lower"),
              }}
            />
          </Show>
        </Chart.Root>
        <Chart.Root
          apiRef={(v) => {
            state.sibling = v;
          }}
          options={{ autoSize: true }}
          style={{ height: "180px" }}
        >
          <Chart.Pane id="price">
            <Indicators.SMA id="local" data={[]} defaultVisible options={{ title: "local" }} />
          </Chart.Pane>
        </Chart.Root>
      </Show>
    ),
    host,
  );
}
