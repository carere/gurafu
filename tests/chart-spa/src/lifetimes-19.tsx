import { createSignal, For, Match, Show, Switch } from "solid-js";
import * as Chart from "~/components/gurafu/chart";

const [owner, setOwner] = createSignal(0);
const [bar, setBar] = createSignal(false);
const [panes, setPanes] = createSignal(true);
const [paneId, setPaneId] = createSignal("price");
const charts: (Chart.ChartController | undefined)[] = [];
const series: (Chart.LineSnapshotController | Chart.BarSnapshotController | undefined)[] = [];
const pane: (Chart.PaneController | undefined)[] = [];
Object.assign(window, {
  lifetimes19: {
    charts,
    series,
    pane,
    type: () => setBar(true),
    transfer: () => setOwner(1),
    remove: () => setPanes(false),
    restore: () => setPanes(true),
    changePaneId: () => setPaneId("new-price"),
  },
});
export function Lifetimes19() {
  return (
    <For each={[0, 1]}>
      {(index) => (
        <Chart.Root
          style={{ height: "260px" }}
          options={{ autoSize: true }}
          apiRef={(c) => {
            charts[index] = c;
          }}
        >
          <Show when={panes()}>
            <Chart.Pane
              id={paneId()}
              apiRef={(c) => {
                pane[index] = c;
              }}
            >
              <Show when={owner() === index}>
                <Switch>
                  <Match when={!bar()}>
                    <Chart.LineSeries
                      id="price"
                      data={[{ time: "2026-10-01", value: 10 }]}
                      apiRef={(c) => {
                        series[index] = c;
                      }}
                    />
                  </Match>
                  <Match when={bar()}>
                    <Chart.BarSeries
                      id="price"
                      data={[{ time: "2026-10-01", open: 10, high: 15, low: 9, close: 12 }]}
                      apiRef={(c) => {
                        series[index] = c;
                      }}
                    />
                  </Match>
                </Switch>
              </Show>
            </Chart.Pane>
          </Show>
        </Chart.Root>
      )}
    </For>
  );
}
