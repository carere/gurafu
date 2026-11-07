import { configureStore, createEvent, createSlice, devtools } from "@carere/solux";
import { createSignal, Show } from "solid-js";
import { render } from "solid-js/web";
import * as Chart from "~/components/gurafu/chart";
import { ChartIndicatorControls } from "~/components/gurafu/chart-indicator-controls";
import { ChartLegend, useLegend } from "~/components/gurafu/chart-legend";
import * as Indicators from "~/components/gurafu/indicators";

export function mountLegend24(host: HTMLElement) {
  const [mounted, setMounted] = createSignal(true),
    [indicator, setIndicator] = createSignal(true);
  const [visible, setVisible] = createSignal(true),
    [expanded, setExpanded] = createSignal(false);
  const [key, setKey] = createSignal(0),
    [choices, setChoices] = createSignal<readonly string[]>(["bands"]);
  const [defaults, setDefaults] = createSignal(false);
  const custom = location.search.includes("custom");
  const requests: unknown[] = [];
  const increment = createEvent("app/increment");
  const application = configureStore({
    rootSlice: createSlice({
      initialState: { app: { value: 0 } },
      handlers: (b) =>
        b.addHandler(increment, (state) => {
          state.app.value++;
        }),
    }),
    enhancers: location.search.includes("debug")
      ? [devtools({ name: "Application", instanceId: "application" })]
      : [],
  });
  let chart!: Chart.ChartController, sibling!: Chart.ChartController;
  let price!: Chart.CandlestickIncrementalController,
    other!: Chart.CandlestickIncrementalController;
  let model!: ReturnType<typeof useLegend>;
  let moves = 0,
    focus = 0;
  const rows = [
    { time: "2026-01-01", open: 1, high: 3, low: 0, close: 2 },
    { time: "2026-01-02", open: 0, high: 2, low: -1, close: 0 },
    { time: "2026-01-03", open: 3, high: 4, low: 0, close: 1 },
  ];
  function Probe() {
    model = useLegend({ priceSeries: "price", volumeSeries: "volume" });
    return null;
  }
  const dispose = render(
    () => (
      <>
        <ChartIndicatorControls
          aria-label="Uncontrolled selection"
          items={[{ value: "sma", label: "SMA" }]}
          defaultValue={[]}
        />
        <ChartIndicatorControls
          aria-label="Standalone"
          items={[
            { value: "bands", label: "Bands" },
            { value: "ema", label: "EMA" },
          ]}
          value={choices()}
          onValueChange={(v) => requests.push(v)}
        />
        <Show when={mounted()}>
          <Chart.Root
            datasetKey={key()}
            devtools={location.search.includes("debug") ? { name: "Repeated" } : false}
            apiRef={(v) => {
              if (v) chart = v;
            }}
            style={{ height: "260px" }}
            containerProps={{ onPointerEnter: () => focus++ }}
            onCrosshairMove={() => moves++}
          >
            <Chart.Pane id="price">
              <Chart.CandlestickSeries
                id="price"
                defaultData={rows}
                apiRef={(v) => {
                  if (v) price = v;
                }}
                options={{ upColor: "#123456", downColor: "#654321" }}
              />
              <Chart.HistogramSeries
                id="volume"
                data={[{ time: "2026-01-02", value: 0, color: "#abcdef" }]}
              />
              <Chart.HistogramSeries id="unrelated" data={[{ time: "2026-01-03", value: 999 }]} />
              <Show when={indicator()}>
                <Indicators.BollingerBands
                  id="bands"
                  source="price"
                  parameters={{ period: 1 }}
                  visible={visible()}
                  onVisibleChange={(v) => requests.push(v)}
                />
              </Show>
              <Indicators.SMA
                id="sma"
                source="price"
                parameters={{ period: 1 }}
                defaultVisible={defaults()}
              />
            </Chart.Pane>
            <Probe />
            <ChartLegend
              priceSeries="price"
              volumeSeries="volume"
              expanded={expanded()}
              onExpandedChange={(v) => requests.push(v)}
              aria-label="Controlled legend"
              renderOHLC={
                custom
                  ? (model) => (
                      <output aria-label="Custom OHLC">{model.ohlc?.close ?? "missing"}</output>
                    )
                  : undefined
              }
              renderIndicator={
                custom
                  ? (row, request) => (
                      <button type="button" onClick={() => request(!row.visible)}>
                        Toggle {row.id}
                      </button>
                    )
                  : undefined
              }
            />
            <ChartLegend
              priceSeries="price"
              defaultExpanded={defaults()}
              aria-label="Default legend"
              labels={custom ? { open: "Ouverture", indicators: "Analyses" } : undefined}
              formatValue={custom ? (value) => (value === 0 ? "zero" : String(value)) : undefined}
              style={{ top: "100px" }}
            />
          </Chart.Root>
        </Show>
        <Chart.Root
          devtools={location.search.includes("debug") ? { name: "Repeated" } : false}
          apiRef={(v) => {
            if (v) sibling = v;
          }}
          style={{ height: "200px" }}
        >
          <Chart.Pane id="price">
            <Chart.CandlestickSeries
              id="price"
              defaultData={rows}
              apiRef={(v) => {
                if (v) other = v;
              }}
            />
            <Indicators.SMA id="sma" source="price" parameters={{ period: 1 }} />
          </Chart.Pane>
          <ChartLegend priceSeries="price" aria-label="Sibling legend" />
        </Chart.Root>
      </>
    ),
    host,
  );
  Object.assign(window, {
    legend24: {
      get chart() {
        return chart;
      },
      get sibling() {
        return sibling;
      },
      get price() {
        return price;
      },
      get other() {
        return other;
      },
      model: () => model(),
      requests,
      moves: () => moves,
      focus: () => focus,
      setMounted,
      setIndicator,
      setVisible,
      setExpanded,
      setKey,
      setChoices,
      setDefaults,
      appIncrement: () => application.dispatch(increment()),
      appDispose: () => application.dispose(),
      dispose,
    },
  });
}
