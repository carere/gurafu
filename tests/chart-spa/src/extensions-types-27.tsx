import type {
  CustomData,
  CustomSeriesOptions,
  ICustomSeriesPaneView,
  ISeriesApi,
  SeriesPartialOptions,
  Time,
  UTCTimestamp,
  WhitespaceData,
} from "lightweight-charts";
import * as Chart from "~/components/gurafu/chart";

type Row = CustomData<Time> & { intensity: number; label: string };
type Options = CustomSeriesOptions & { ink: string; weight: number };
type Patch = SeriesPartialOptions<Options> & { weight?: 1 | 2 | 3 };
declare const create: () => ICustomSeriesPaneView<Time, Row, Options>;
const rows: readonly Row[] = [{ time: "2026-10-01", intensity: 12, label: "first" }];

export function CustomTypes27() {
  return (
    <Chart.Root>
      <Chart.Pane id="custom">
        <Chart.CustomSeries
          create={create}
          id="snapshot"
          data={rows}
          options={{ ink: "red" }}
          apiRef={(c) => {
            const native:
              | ISeriesApi<
                  "Custom",
                  Time,
                  Row | WhitespaceData<Time>,
                  Options,
                  SeriesPartialOptions<Options>
                >
              | undefined = c?.api;
            const ink: string | undefined = c?.api.options().ink;
            void native;
            void ink;
            // @ts-expect-error Snapshot has no managed writer.
            c?.update(rows[0]);
            // @ts-expect-error Native custom options retain field types.
            c?.api.applyOptions({ ink: 123 });
          }}
        />
        <Chart.CustomSeries
          create={create}
          id="incremental"
          defaultData={rows}
          apiRef={(c) => {
            c?.update({ time: { year: 2026, month: 10, day: 2 }, intensity: 2, label: "next" });
            c?.setData([{ time: "2026-10-03" }]);
            c?.update({ time: 1790812800 as UTCTimestamp, intensity: 0, label: "branded" });
            // @ts-expect-error Ordinary native time requires branded timestamps.
            c?.update({ time: 1790812800, intensity: 0, label: "unbranded" });
            const popped: (Row | WhitespaceData<Time>)[] | undefined = c?.pop(1);
            void popped;
            // @ts-expect-error Custom fields are preserved for updates.
            c?.update({ time: "2026-10-03", intensity: "bad", label: "bad" });
          }}
        />
        <Chart.CustomSeries<Row, Options, Patch>
          create={create}
          id="patch"
          defaultData={rows}
          options={{ weight: 2 }}
          apiRef={(c) => {
            c?.api.applyOptions({ weight: 3 });
            // @ts-expect-error Explicit partial options survive into native handle.
            c?.api.applyOptions({ weight: 4 });
          }}
        />
        {/* @ts-expect-error Snapshot and incremental seeds are exclusive. */}
        <Chart.CustomSeries create={create} id="two" data={rows} defaultData={rows} />
        <Chart.CustomSeries
          create={create}
          id="bad-row"
          // @ts-expect-error Inferred custom fields cannot change shape.
          data={[{ time: "2026-10-01", intensity: "bad", label: "x" }]}
        />
        {/* @ts-expect-error Custom options retain their shape. */}
        <Chart.CustomSeries create={create} id="bad-option" options={{ ink: 123 }} />
      </Chart.Pane>
    </Chart.Root>
  );
}

export function PrimitiveTypes27() {
  return (
    <Chart.Root>
      <Chart.Pane id="p">
        <Chart.PanePrimitive
          create={() => ({ paneViews: () => [], caption: "pane" })}
          apiRef={(c) => {
            const caption: string | undefined = c?.api.caption;
            void caption;
            // @ts-expect-error Instance fields are preserved.
            c?.api.missing;
          }}
        />
        <Chart.LineSeries id="line">
          <Chart.SeriesPrimitive
            create={() => ({ paneViews: () => [], annotation: 12 })}
            apiRef={(c) => {
              const annotation: number | undefined = c?.api.annotation;
              void annotation;
            }}
            onDispose={(p) => {
              const n: number = p.annotation;
              void n;
            }}
          />
          <Chart.Markers
            data={[{ time: "2026-10-01", position: "aboveBar", shape: "circle", color: "red" }]}
            apiRef={(c) => {
              c?.api.markers();
            }}
          />
        </Chart.LineSeries>
      </Chart.Pane>
    </Chart.Root>
  );
}

export function CustomScopeTypes27() {
  const scope = Chart.useSeries<Chart.CustomIncrementalController<Row, Options, Patch>>();
  const options: Options | undefined = scope()?.api.options();
  void options;
  scope()?.update({ time: "2026-10-04", intensity: 2, label: "scoped" });
  // @ts-expect-error The scoped native handle retains partial-options constraints.
  scope()?.api.applyOptions({ weight: 4 });
  return null;
}
