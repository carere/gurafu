import type { ISeriesApi, SeriesType, Time } from "lightweight-charts";
import { batch, createSignal, For, Show } from "solid-js";
import * as Chart from "~/components/gurafu/chart";

const rows = Object.freeze([
  { time: "2026-10-01", value: 10 },
  { time: "2026-10-02", value: 20 },
]);
const [panes, setPanes] = createSignal(["price", "volume", "empty"]);
const [order, setOrder] = createSignal(["a", "b"]);
const [target, setTarget] = createSignal("price");
const [id, setId] = createSignal("movable");
const [shown, setShown] = createSignal(true);
const [empty, setEmpty] = createSignal(false);
const [hidden, setHidden] = createSignal(location.search.includes("hidden"));
const [manual, setManual] = createSignal(false);
const [height, setHeight] = createSignal<number>();
const [stretch, setStretch] = createSignal(0.25);
const controllers: Record<string, Chart.PaneController | undefined> = {};
const series: Record<
  string,
  Chart.SnapshotSeriesController<ISeriesApi<SeriesType, Time>> | undefined
> = {};
let chart: Chart.ChartController | undefined;
Object.assign(window, {
  panes19: {
    controllers,
    series,
    chart: () => chart,
    reorder: () => {
      setPanes(["empty", "volume", "price"]);
      setOrder(["b", "a"]);
    },
    // This immediate mount/reorder happens before native pane widgets have painted.
    immediate: () => setPanes(["volume", "price", "empty"]),
    moveAndRemove: () =>
      batch(() => {
        setTarget("volume");
        setPanes(["volume", "empty"]);
      }),
    removeVolume: () => setPanes(["empty"]),
    restore: () => {
      setPanes(["price", "volume", "empty"]);
      setTarget("price");
    },
    changeId: () => setId("replacement"),
    hideSeries: () => setShown(false),
    showSeries: () => setShown(true),
    empty: () => setEmpty(true),
    show: () => setHidden(false),
    manual: () => setManual(true),
    auto: () => setManual(false),
    resize: () => {
      setHeight(140);
      setStretch(0.5);
    },
  },
});

export function Panes19() {
  // Called at setup to exercise immediate native assembly as well as later reorder.
  queueMicrotask(() => setPanes(["volume", "price", "empty"]));
  return (
    <Chart.Root
      style={{ height: "600px", display: hidden() ? "none" : undefined }}
      options={{
        autoSize: !manual(),
        ...(manual() ? { width: 640, height: 420 } : {}),
        layout: { panes: { enableResize: true } },
      }}
      apiRef={(c) => {
        chart = c;
      }}
    >
      <For each={panes()}>
        {(pane) => (
          <Chart.Pane
            id={pane}
            stretchFactor={pane === "volume" ? stretch() : 1}
            height={pane === "volume" ? height() : undefined}
            apiRef={(c) => {
              controllers[pane] = c;
            }}
          >
            <Show when={pane === "price"}>
              <For each={order()}>
                {(key) => (
                  <Chart.AreaSeries
                    id={key}
                    data={rows}
                    apiRef={(c) => {
                      series[key] = c;
                    }}
                  />
                )}
              </For>
            </Show>
            <Show when={pane === "volume"}>
              <Chart.HistogramSeries
                id="volume"
                data={rows}
                apiRef={(c) => {
                  series.volume = c;
                }}
              />
            </Show>
          </Chart.Pane>
        )}
      </For>
      <Show when={shown()}>
        <Chart.LineSeries
          id={id()}
          pane={target()}
          data={empty() ? [] : rows}
          apiRef={(c) => {
            series.movable = c;
          }}
        />
      </Show>
    </Chart.Root>
  );
}
