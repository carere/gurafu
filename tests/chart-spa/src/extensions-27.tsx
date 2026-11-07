import type {
  IChartApi,
  IPanePrimitive,
  ISeriesPrimitive,
  MouseEventHandler,
  PaneAttachedParameter,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import { createEffect, createSignal, For, Show } from "solid-js";
import * as Chart from "~/components/gurafu/chart";
import { type DensityOptions, type DensityRow, DensityView, densityRows } from "./extensions-view";

type Count = {
  create: number;
  attach: number;
  detach: number;
  dispose: number;
  ticks: number;
  clicks: number;
  live: boolean[];
};
const count = (): Count => ({
  create: 0,
  attach: 0,
  detach: 0,
  dispose: 0,
  ticks: 0,
  clicks: 0,
  live: [],
});
function createExtensions27() {
  const [paneId, setPaneId] = createSignal("custom");
  const [companion, setCompanion] = createSignal(false);
  const stats = { custom: count(), series: count(), pane: count(), markers: count() };
  const [mounted, setMounted] = createSignal(true),
    [owner, setOwner] = createSignal(true),
    [present, setPresent] = createSignal(true);
  const [target, setTarget] = createSignal("custom"),
    [key, setKey] = createSignal(0),
    [reverse, setReverse] = createSignal(false);
  const [empty, setEmpty] = createSignal(false),
    [patch, setPatch] = createSignal(false),
    [refVersion, setRefVersion] = createSignal(false);
  const [chart, setChart] = createSignal<Chart.ChartController>();
  const [custom, setCustom] =
    createSignal<Chart.CustomIncrementalController<DensityRow, DensityOptions>>();
  const [neighbor, setNeighbor] = createSignal<Chart.LineIncrementalController>();
  const [pane, setPane] = createSignal<Chart.PaneController>();
  const refs: {
    series?: Chart.ExtensionController<ISeriesPrimitive<Time>>;
    pane?: Chart.ExtensionController<IPanePrimitive<Time>>;
    markers?: Chart.ExtensionController<import("lightweight-charts").ISeriesMarkersPluginApi<Time>>;
  } = {};
  let rawChart: IChartApi;
  const refLog: string[] = [],
    observations: unknown[] = [];
  const seriesRefs = [0, 1].map(
    (n) => (c: Chart.ExtensionController<ISeriesPrimitive<Time>> | undefined) => {
      refs.series = c;
      refLog.push(`${n}:${c ? "set" : "clear"}`);
    },
  );
  class View extends DensityView {
    private timer: ReturnType<typeof setInterval>;
    constructor() {
      super();
      stats.custom.create++;
      this.timer = setInterval(() => stats.custom.ticks++, 10);
    }
    destroy() {
      clearInterval(this.timer);
      stats.custom.detach++;
      stats.custom.live.push(
        !!rawChart?.panes().some((p) => p.getSeries().some((s) => s.seriesType() === "Custom")),
      );
      super.destroy();
    }
  }
  function callbacks(s: Count, api: IChartApi) {
    const click: MouseEventHandler<Time> = () => s.clicks++;
    api.subscribeClick(click);
    const timer = setInterval(() => s.ticks++, 10);
    return () => {
      api.unsubscribeClick(click);
      clearInterval(timer);
    };
  }
  function seriesPrimitive(): ISeriesPrimitive<Time> {
    stats.series.create++;
    let stop = () => {},
      native: SeriesAttachedParameter<Time>["series"];
    return {
      attached(p) {
        stats.series.attach++;
        native = p.series;
        stop = callbacks(stats.series, p.chart);
      },
      detached() {
        stats.series.detach++;
        stats.series.live.push(native.data().length >= 0);
        stop();
      },
      paneViews: () => [],
    };
  }
  function panePrimitive(): IPanePrimitive<Time> {
    stats.pane.create++;
    let stop = () => {},
      native: IChartApi;
    return {
      attached(p: PaneAttachedParameter<Time>) {
        stats.pane.attach++;
        native = p.chart;
        stop = callbacks(stats.pane, p.chart);
      },
      detached() {
        stats.pane.detach++;
        stats.pane.live.push(native.panes().length > 0);
        stop();
      },
      paneViews: () => [],
    };
  }
  const saved: {
    custom?: ReturnType<typeof custom>;
    series?: typeof refs.series;
    pane?: typeof refs.pane;
    markers?: typeof refs.markers;
    native?: ReturnType<typeof custom> extends infer C
      ? C extends { api: infer A }
        ? A
        : never
      : never;
  } = {};
  const save = () => {
    saved.custom = custom();
    saved.native = custom()?.api;
    Object.assign(saved, refs);
  };
  const remove = () => {
    save();
    setPresent(false);
  };
  const rejected = (c: Chart.ResourceController<unknown> | undefined) => {
    try {
      c?.api;
      return false;
    } catch {
      return true;
    }
  };
  createEffect(() => {
    if (!present() && saved.custom)
      observations.push({
        seriesRefCleared: !custom(),
        extensionRefsCleared: !refs.series && !refs.markers,
        customReady: saved.custom.ready(),
        primitiveReady: saved.series?.ready(),
        markerReady: saved.markers?.ready(),
        primitiveApiRejected: rejected(saved.series),
        markerApiRejected: rejected(saved.markers),
        customApiRejected: rejected(saved.custom),
      });
  });
  const fixture = {
    addCompanion: () => setCompanion(true),
    removeCompanion: () => setCompanion(false),
    changePaneId: () => setPaneId("renamed"),
    stats,
    refs,
    refLog,
    observations,
    saved,
    chart,
    custom,
    neighbor,
    pane,
    save,
    move: () => setTarget(target() === "custom" ? "price" : "custom"),
    reorder: () => setReverse(!reverse()),
    dataset: () => setKey(key() + 1),
    patch: () => setPatch(!patch()),
    empty: () => {
      setEmpty(true);
      custom()?.setData([]);
    },
    whitespace: () => custom()?.setData([{ time: "2026-10-02" }]),
    replace: () => custom()?.setData(densityRows),
    switchRef: () => setRefVersion(true),
    remove,
    restore: () => {
      setOwner(true);
      setPresent(true);
      setTarget("custom");
    },
    removePane: () => setOwner(false),
    moveAndRemove: () => {
      setTarget("price");
      setOwner(false);
    },
    unmount: () => setMounted(false),
    remount: () => setMounted(true),
  };
  return {
    fixture,
    element: (
      <Show when={mounted()}>
        <Chart.Root
          style={{ height: "500px" }}
          options={{ autoSize: true, timeScale: { barSpacing: 80 } }}
          datasetKey={key()}
          apiRef={(c) => {
            if (c) rawChart = c.api;
            setChart(c);
          }}
        >
          <For each={reverse() ? ["custom", "price"] : ["price", "custom"]}>
            {(id) => (
              <Show when={id === "price" || owner()}>
                <Chart.Pane
                  id={id === "custom" ? paneId() : id}
                  apiRef={id === "custom" ? setPane : undefined}
                >
                  {id === "custom" && (
                    <Chart.PanePrimitive
                      create={panePrimitive}
                      apiRef={(c) => {
                        refs.pane = c;
                      }}
                      onDispose={() => stats.pane.dispose++}
                    />
                  )}
                </Chart.Pane>
              </Show>
            )}
          </For>
          <Show when={companion() && owner()}>
            <Chart.LineSeries
              id="companion"
              pane={paneId()}
              data={densityRows.map((r) => ({ time: r.time, value: r.intensity + 5 }))}
            />
          </Show>
          <Chart.LineSeries
            options={{ color: "#0044ee" }}
            id="neighbor"
            pane="price"
            defaultData={densityRows.map((r) => ({ time: r.time, value: r.intensity + 100 }))}
            apiRef={setNeighbor}
          />
          <Show when={present()}>
            <Chart.CustomSeries
              id="density"
              pane={target() === "custom" ? paneId() : target()}
              create={() => new View()}
              defaultData={empty() ? [] : densityRows}
              options={{ ink: patch() ? "#008800" : "#d000d0" }}
              apiRef={setCustom}
              onDispose={() => stats.custom.dispose++}
            >
              <Chart.SeriesPrimitive
                create={seriesPrimitive}
                apiRef={seriesRefs[refVersion() ? 1 : 0]}
                onDispose={() => stats.series.dispose++}
              />
              <Chart.Markers
                data={
                  patch()
                    ? []
                    : [
                        {
                          time: "2026-10-02",
                          position: "atPriceMiddle",
                          price: 40,
                          color: "blue",
                          shape: "circle",
                        },
                      ]
                }
                options={{ autoScale: !patch(), zOrder: patch() ? "top" : "normal" }}
                apiRef={(c) => {
                  refs.markers = c;
                  if (c) stats.markers.create++;
                }}
                onDispose={() => stats.markers.dispose++}
              />
            </Chart.CustomSeries>
          </Show>
        </Chart.Root>
      </Show>
    ),
  };
}
export function Extensions27() {
  const mounted = createExtensions27();
  window.extensions27 = mounted.fixture;
  return mounted.element;
}
declare global {
  interface Window {
    extensions27: ReturnType<typeof createExtensions27>["fixture"];
  }
}
