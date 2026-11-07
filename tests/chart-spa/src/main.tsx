import { configureStore, createSlice, SoluxProvider, useSolux } from "@carere/solux";
import { createSignal, Show } from "solid-js";
import { render } from "solid-js/web";
import * as Chart from "~/components/gurafu/chart";
import { Independent26 } from "./independent-26";
import { mountLegend24 } from "./legend-fixture-24";
import { Services21 } from "./services-21";
import "./style.css";
import { Basics } from "./basics-example";
import { Composition19 } from "./composition-19";
import { mountDataFixture } from "./data-fixture";
import { DataHistory } from "./data-history";
import { Extensions27 } from "./extensions-27";
import { ExtensionsLifecycle } from "./extensions-example";
import { IndicatorsPanes } from "./indicators-example-22";
import { mountIndicators22 } from "./indicators-fixture-22";
import { mountIndicators23 } from "./indicators-fixture-23";
import { Lifetimes19 } from "./lifetimes-19";
import { NativePanes } from "./native-panes-example";
import { Panes19 } from "./panes-19";

const initial = Object.freeze([
  Object.freeze({ time: "2026-10-01", open: 100, high: 110, low: 90, close: 105 }),
]);
const [data, setData] = createSignal(
  initial as readonly import("lightweight-charts").CandlestickData[],
);
const [hidden, setHidden] = createSignal(location.search.includes("hidden"));
const [mounted, setMounted] = createSignal(true);
const [first, setFirst] = createSignal(true);
const [paneVisible, setPaneVisible] = createSignal(true);
const [seriesVisible, setSeriesVisible] = createSignal(true);
const [patch, setPatch] = createSignal(false);
const [alternateRef, setAlternateRef] = createSignal(false);
const refLog: string[] = [];
const app = location.search.includes("standalone")
  ? undefined
  : configureStore({
      rootSlice: createSlice({ initialState: { app: { name: "consumer" } }, handlers: () => {} }),
    });
let scopeState = () => ({ app: false, chart: false, pane: false, series: false });
let initiallyUnavailable = false;
function Probe() {
  const chart = Chart.useChart(),
    pane = Chart.usePane(),
    series = Chart.useSeries();
  const application = useSolux();
  initiallyUnavailable = !chart() && !pane() && !series();
  scopeState = () => ({
    app: application === app,
    chart: chart() === charts[0],
    pane: pane()?.ready() ?? false,
    series: series()?.ready() ?? false,
  });
  return <span>Consumer content</span>;
}
const [swapped, setSwapped] = createSignal(false);
const events = {
  oldClicks: 0,
  newClicks: 0,
  oldData: 0,
  newData: 0,
  focus: 0,
  nativeMap: false,
  dataReady: false,
  dataPopulated: false,
};
const callbackEvents = {
  old: { move: 0, double: 0, time: 0, logical: 0, size: 0 },
  current: { move: 0, double: 0, time: 0, logical: 0, size: 0 },
};
const handlers = [callbackEvents.old, callbackEvents.current].map((group) => ({
  move: () => group.move++,
  double: () => group.double++,
  time: () => group.time++,
  logical: () => group.logical++,
  size: () => group.size++,
}));
const outer: HTMLDivElement[] = [],
  inner: HTMLDivElement[] = [];
const clicks = [
  () => events.oldClicks++,
  (event: import("lightweight-charts").MouseEventParams<import("lightweight-charts").Time>) => {
    events.newClicks++;
    events.nativeMap = event.seriesData instanceof Map;
  },
];
const changes = [
  () => events.oldData++,
  () => {
    events.newData++;
    events.dataReady = series.every((c) => c?.ready());
    events.dataPopulated = series.every((c) => c?.hasData());
  },
];
const charts: (Chart.ChartController | undefined)[] = [];
const series: (Chart.CandlestickSnapshotController | undefined)[] = [];
const oldSeries: Chart.CandlestickSnapshotController[] = [];
const rootReadyBeforeData: boolean[] = [];
const chartRefs = [0, 1].map((i) => (value: Chart.ChartController | undefined) => {
  charts[i] = value;
  if (value) {
    rootReadyBeforeData[i] =
      value.ready() &&
      !value.api.panes().some((pane) => pane.getSeries().some((s) => s.data().length));
  }
});
const alternateSeriesRef = (value: Chart.CandlestickSnapshotController | undefined) => {
  series[0] = value;
  refLog.push(value ? "new:set" : "new:clear");
};
const seriesRefs = [0, 1].map((i) => (value: Chart.CandlestickSnapshotController | undefined) => {
  series[i] = value;
  if (i === 0) refLog.push(value ? "old:set" : "old:clear");
  if (value) oldSeries.push(value);
});
Object.assign(window, {
  smoke: {
    charts,
    series,
    oldSeries,
    rootReadyBeforeData,
    events,
    callbackEvents,
    outer,
    inner,
    show: () => setHidden(false),
    scopeState: () => scopeState(),
    initiallyUnavailable: () => initiallyUnavailable,
    refLog,
    removeFirst: () => setFirst(false),
    removePane: () => setPaneVisible(false),
    removeSeries: () => setSeriesVisible(false),
    changeRef: () => setAlternateRef(true),
    patch: () => setPatch(true),
    swap: () => setSwapped(true),
    replace: () => setData([{ time: "2026-10-02", open: 200, high: 220, low: 180, close: 210 }]),
    empty: () => setData([]),
    unmount: () => setMounted(false),
    mount: () => setMounted(true),
  },
});
const host = document.getElementById("root");
if (!host) throw new Error("Missing SPA root");
function Composition() {
  return (
    <Show when={mounted()}>
      {[0, 1].map((i) => (
        <Show when={i === 1 || first()}>
          <Chart.Root
            ref={(el) => {
              outer[i] = el;
            }}
            containerProps={{
              ref: (el) => {
                inner[i] = el;
              },
              onPointerEnter: () => events.focus++,
            }}
            onClick={clicks[swapped() ? 1 : 0]}
            onCrosshairMove={handlers[swapped() ? 1 : 0].move}
            onDblClick={handlers[swapped() ? 1 : 0].double}
            onVisibleTimeRangeChange={handlers[swapped() ? 1 : 0].time}
            onVisibleLogicalRangeChange={handlers[swapped() ? 1 : 0].logical}
            onSizeChange={handlers[swapped() ? 1 : 0].size}
            apiRef={chartRefs[i]}
            style={{ height: "260px", display: hidden() ? "none" : undefined }}
            options={
              patch()
                ? { layout: { fontSize: 15 } }
                : { autoSize: true, layout: { textColor: "#123456" } }
            }
          >
            <Show when={paneVisible()}>
              <Chart.Pane id="price">
                <Show when={seriesVisible()}>
                  <Chart.CandlestickSeries
                    id="candles"
                    data={data()}
                    options={patch() ? { wickVisible: false } : { upColor: "#123456" }}
                    onDataChange={changes[swapped() ? 1 : 0]}
                    apiRef={i === 0 && alternateRef() ? alternateSeriesRef : seriesRefs[i]}
                  >
                    {i === 0 ? <Probe /> : null}
                  </Chart.CandlestickSeries>
                </Show>
              </Chart.Pane>
            </Show>
          </Chart.Root>
        </Show>
      ))}
    </Show>
  );
}
if (location.search.includes("independent26")) render(() => <Independent26 />, host);
else if (location.search.includes("legend24")) mountLegend24(host);
else if (location.search.includes("services21")) render(() => <Services21 />, host);
else if (location.search.includes("extensions-example"))
  render(() => <ExtensionsLifecycle />, host);
else if (location.search.includes("extensions27")) render(() => <Extensions27 />, host);
else if (location.search.includes("indicators-example22")) render(() => <IndicatorsPanes />, host);
else if (location.search.includes("indicators23")) mountIndicators23(host);
else if (location.search.includes("indicators22")) mountIndicators22(host);
else if (location.search.includes("history")) render(() => <DataHistory />, host);
else if (location.search.includes("data")) mountDataFixture(host);
else
  render(
    () =>
      location.search.includes("lifetimes19") ? (
        <Lifetimes19 />
      ) : location.search.includes("basics19") ? (
        <>
          <Basics />
          <NativePanes />
        </>
      ) : location.search.includes("panes19") ? (
        <Panes19 />
      ) : location.search.includes("composition19") ? (
        <Composition19 />
      ) : app ? (
        <SoluxProvider store={app}>
          <Composition />
        </SoluxProvider>
      ) : (
        <Composition />
      ),
    host,
  );
