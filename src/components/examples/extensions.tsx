import type { IPanePrimitive, ISeriesPrimitive, Time } from "lightweight-charts";
import { createSignal, For, Show } from "solid-js";
import * as Chart from "@/registry/kobalte/chart/chart";
import { type DensityOptions, type DensityRow, DensityView, densityRows } from "./extensions-view";

const buttonClass =
  "rounded-md border px-3 py-2 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function ExtensionsLifecycle() {
  const [order, setOrder] = createSignal(false);
  const [analysis, setAnalysis] = createSignal(true);
  const [mounted, setMounted] = createSignal(true);
  const [target, setTarget] = createSignal("analysis");
  const [empty, setEmpty] = createSignal(false);
  const [alternate, setAlternate] = createSignal(false);
  const [dataset, setDataset] = createSignal(0);
  const [series, setSeries] =
    createSignal<Chart.CustomSnapshotController<DensityRow, DensityOptions>>();
  const [events, setEvents] = createSignal<readonly string[]>([]);
  const record = (event: string) => setEvents((previous) => [...previous, event].slice(-8));
  function annotation(): ISeriesPrimitive<Time> {
    record("Annotation constructed");
    return {
      attached: () => record("Annotation attached"),
      detached: () => record("Annotation detached"),
      paneViews: () => [
        {
          renderer: () => ({
            draw: (target) =>
              target.useMediaCoordinateSpace(({ context }) => {
                context.fillStyle = "#6b21a8";
                context.font = "14px sans-serif";
                context.fillText("Owned series annotation", 16, 26);
              }),
          }),
        },
      ],
    };
  }
  function watermark(): IPanePrimitive<Time> {
    record("Watermark constructed");
    return {
      attached: () => record("Watermark attached"),
      detached: () => record("Watermark detached"),
      paneViews: () => [
        {
          renderer: () => ({
            draw: (target) =>
              target.useMediaCoordinateSpace(({ context }) => {
                context.fillStyle = "#525252";
                context.font = "14px sans-serif";
                context.fillText("Analysis pane · retained when empty", 16, 52);
              }),
          }),
        },
      ],
    };
  }
  const panes = () => (order() ? ["analysis", "price"] : ["price", "analysis"]);
  return (
    <section aria-labelledby="extensions-heading" class="space-y-4">
      <h2 id="extensions-heading" class="text-2xl font-semibold tracking-tight">
        Extensions and lifecycle
      </h2>
      <p class="max-w-prose text-muted-foreground">
        Illustrative density values use a custom renderer. Its annotation and markers travel with
        the series; the watermark belongs to the analysis pane. Empty data retains resources.
        Removal releases them, while the neighboring price series keeps its timeline.
      </p>
      <Chart.Root
        style={{ height: "420px" }}
        class="w-full"
        role="region"
        aria-label="Extensions and lifecycle chart"
        datasetKey={dataset()}
        options={{ ...Chart.lightChartOptions, autoSize: true, timeScale: { barSpacing: 80 } }}
      >
        <For each={panes()}>
          {(id) => (
            <Show when={id === "price" || analysis()}>
              <Chart.Pane id={id} stretchFactor={1}>
                {id === "analysis" && (
                  <Chart.PanePrimitive
                    create={watermark}
                    onDispose={() => record("Watermark released")}
                  />
                )}
              </Chart.Pane>
            </Show>
          )}
        </For>
        <Chart.LineSeries
          id="price"
          pane="price"
          data={densityRows.map((row) => ({ time: row.time, value: row.intensity + 100 }))}
          options={{ color: "#15803d" }}
        />
        <Show when={mounted()}>
          <Chart.CustomSeries
            id="density"
            pane={target()}
            create={() => {
              record("Custom view constructed");
              return new DensityView();
            }}
            data={empty() ? [] : densityRows}
            options={{ ink: alternate() ? "#0369a1" : "#d000d0" }}
            apiRef={setSeries}
            onDispose={() => record("Custom view released")}
          >
            <Chart.SeriesPrimitive
              create={annotation}
              onDispose={() => record("Annotation released")}
            />
            <Chart.Markers
              data={
                empty()
                  ? []
                  : [
                      {
                        time: "2026-10-02",
                        position: "atPriceMiddle",
                        price: 40,
                        shape: "circle",
                        color: alternate() ? "#0369a1" : "#d000d0",
                        text: "Peak",
                      },
                    ]
              }
              options={{ autoScale: true }}
              onDispose={() => record("Markers released")}
            />
          </Chart.CustomSeries>
        </Show>
      </Chart.Root>
      <p role="status" class="text-sm text-muted-foreground">
        {series()
          ? empty()
            ? "Custom series empty; resources retained."
            : `Custom series populated in ${target()}.`
          : "Custom series removed."}{" "}
        {analysis() ? "Analysis pane declared." : "Analysis pane removed."}
      </p>
      <div class="flex flex-wrap gap-3">
        <button
          type="button"
          class={buttonClass}
          disabled={!series()}
          onClick={() => setEmpty(!empty())}
        >
          {empty() ? "Restore custom data" : "Empty custom data"}
        </button>
        <button
          type="button"
          class={buttonClass}
          disabled={!series() || !analysis()}
          onClick={() => setTarget(target() === "analysis" ? "price" : "analysis")}
        >
          {target() === "analysis" ? "Move custom to price" : "Move custom to analysis"}
        </button>
        <button
          type="button"
          class={buttonClass}
          disabled={!analysis()}
          onClick={() => setOrder(!order())}
        >
          {order() ? "Analysis below price" : "Analysis above price"}
        </button>
        <button
          type="button"
          class={buttonClass}
          disabled={!series()}
          onClick={() => setAlternate(!alternate())}
        >
          Change custom and marker appearance
        </button>
        <button type="button" class={buttonClass} onClick={() => setDataset(dataset() + 1)}>
          Change dataset context
        </button>
        <button
          type="button"
          class={buttonClass}
          disabled={!series()}
          onClick={() => setMounted(false)}
        >
          Remove custom series
        </button>
        <button
          type="button"
          class={buttonClass}
          disabled={!analysis()}
          onClick={() => setAnalysis(false)}
        >
          Remove analysis pane
        </button>
        <button
          type="button"
          class={buttonClass}
          disabled={!analysis() || !series()}
          onClick={() => {
            setTarget("price");
            setAnalysis(false);
          }}
        >
          Move custom, then remove analysis
        </button>
        <button
          type="button"
          class={buttonClass}
          onClick={() => {
            setAnalysis(true);
            setMounted(true);
            setEmpty(false);
            setTarget("analysis");
          }}
        >
          Restore composition
        </button>
      </div>
      <details class="text-sm">
        <summary class="cursor-pointer underline-offset-4 hover:underline focus-visible:outline-2">
          Recent resource lifecycle
        </summary>
        <ol class="mt-3 list-inside list-decimal space-y-1 text-muted-foreground">
          <For each={events()}>{(event) => <li>{event}</li>}</For>
        </ol>
      </details>
    </section>
  );
}
