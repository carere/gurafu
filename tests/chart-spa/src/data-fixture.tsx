import type { CandlestickData, SeriesDataItemTypeMap, Time } from "lightweight-charts";
import { createSignal, Show } from "solid-js";
import { render } from "solid-js/web";
import * as Chart from "~/components/gurafu/chart";

type Row = SeriesDataItemTypeMap<Time>["Candlestick"];
export const row = (day: number, close = day): CandlestickData =>
  Object.freeze({
    time: new Date(Date.UTC(2026, 0, day)).toISOString().slice(0, 10),
    open: 100,
    high: 300,
    low: 0,
    close,
  });
const initial = Object.freeze([10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((d) => row(d)));
const sibling = Object.freeze([15, 25, 35, 45, 55, 65, 75, 85, 95].map((d) => row(d)));
export function mountDataFixture(host: HTMLElement) {
  const [mounted, setMounted] = createSignal(true);
  const [dataset, setDataset] = createSignal<{
    key: string | number;
    data: readonly Row[];
    seed: readonly Row[];
  }>({ key: "first", data: sibling, seed: initial });
  const state = {
    chart: undefined as Chart.ChartController | undefined,
    incremental: undefined as Chart.CandlestickIncrementalController | undefined,
    snapshot: undefined as Chart.CandlestickSnapshotController | undefined,
    events: [] as {
      ready: boolean;
      rootReady: boolean;
      hasData: boolean;
      scope: string;
      close: number[];
    }[],
    initial,
    row,
    replaceSnapshot(data: readonly Row[]) {
      setDataset((d) => ({ ...d, data }));
    },
    seed(seed: readonly Row[]) {
      setDataset((d) => ({ ...d, seed }));
    },
    switch(key: string | number, seed: readonly Row[], data: readonly Row[] = []) {
      setDataset({ key, seed, data });
    },
    unmount() {
      setMounted(false);
    },
  };
  Object.assign(window, { dataTest: state });
  render(
    () => (
      <Show when={mounted()}>
        <Chart.Root
          datasetKey={dataset().key}
          apiRef={(v) => {
            state.chart = v;
          }}
          options={{ autoSize: true, timeScale: { barSpacing: 24, minBarSpacing: 0.1 } }}
          style={{ height: "400px" }}
        >
          <Chart.Pane id="price">
            <Chart.CandlestickSeries
              id="live"
              defaultData={dataset().seed}
              apiRef={(v) => {
                state.incremental = v;
              }}
              onDataChange={(scope) => {
                const c = state.incremental;
                if (c)
                  state.events.push({
                    ready: c.ready(),
                    rootReady: state.chart?.ready() ?? false,
                    hasData: c.hasData(),
                    scope,
                    close: c.ready() ? c.api.data().map((d) => ("close" in d ? d.close : -1)) : [],
                  });
              }}
            />
            <Chart.CandlestickSeries
              id="sparse"
              data={dataset().data}
              apiRef={(v) => {
                state.snapshot = v;
              }}
            />
          </Chart.Pane>
        </Chart.Root>
      </Show>
    ),
    host,
  );
}
