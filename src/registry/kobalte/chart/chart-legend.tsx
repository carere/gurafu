import {
  createEffect,
  createMemo,
  createUniqueId,
  For,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  untrack,
} from "solid-js";
import {
  type LegendIndicator,
  type LegendModel,
  type LegendOptions,
  type LegendValue,
  useChart,
  useIndicatorHost,
  useLegend,
} from "./chart";
import { Button } from "./chart-control-button";

export type { LegendIndicator, LegendModel, LegendOptions, LegendValue } from "./chart";
export { useLegend } from "./chart";

export type ChartLegendProps = LegendOptions &
  Omit<JSX.HTMLAttributes<HTMLElement>, "children"> & {
    expanded?: boolean;
    defaultExpanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    labels?: Partial<
      Record<
        "open" | "high" | "low" | "close" | "volume" | "indicators" | "show" | "hide" | "empty",
        string
      >
    > & { indicatorsById?: Readonly<Record<string, string>> };
    formatValue?: (value: number, field: string) => string;
    renderOHLC?: (model: LegendModel) => JSX.Element;
    renderIndicator?: (
      indicator: LegendIndicator,
      requestVisibility: (visible: boolean) => void,
    ) => JSX.Element;
  };
export function ChartLegend(props: ChartLegendProps) {
  const [local, dom] = splitProps(props, [
    "priceSeries",
    "volumeSeries",
    "expanded",
    "defaultExpanded",
    "onExpandedChange",
    "labels",
    "formatValue",
    "renderOHLC",
    "renderIndicator",
  ]);
  const model = useLegend(local),
    chart = useChart(),
    host = useIndicatorHost();
  const id = createUniqueId();
  const initialExpanded = untrack(() => local.defaultExpanded ?? false);
  createEffect(() => {
    const interaction = host.interaction();
    if (!interaction) return;
    interaction.expand(id, initialExpanded);
    onCleanup(() => interaction.expand(id, undefined));
  });
  const expanded = () => local.expanded ?? host.interaction()?.expanded()[id] ?? initialExpanded;
  function request(value: boolean) {
    if (local.expanded === undefined) host.interaction()?.expand(id, value);
    local.onExpandedChange?.(value);
  }
  const label = (field: "open" | "high" | "low" | "close" | "volume") =>
    local.labels?.[field] ??
    { open: "O", high: "H", low: "L", close: "C", volume: "Volume" }[field];
  const format = (value: number | undefined, field: string) =>
    value === undefined ? "—" : (local.formatValue?.(value, field) ?? String(value));
  const name = (row: LegendIndicator) => local.labels?.indicatorsById?.[row.id] ?? row.label;
  const value = (row: LegendValue | null, field: string) => (
    <span style={{ color: row?.color }}>{format(row?.value, field)}</span>
  );
  return (
    <section
      {...dom}
      style={
        typeof dom.style === "string"
          ? `position:absolute;top:8px;left:8px;right:8px;z-index:2;${dom.style}`
          : {
              position: "absolute",
              top: "8px",
              left: "8px",
              right: "8px",
              "z-index": 2,
              ...dom.style,
            }
      }
      class={`flex flex-wrap items-center gap-x-4 gap-y-2 py-2 text-sm tabular-nums ${dom.class ?? ""}`}
    >
      <Show
        when={local.renderOHLC}
        fallback={
          <div class="flex flex-wrap gap-x-3 gap-y-1">
            <For each={["open", "high", "low", "close"] as const}>
              {(field) => (
                <span>
                  {label(field)}{" "}
                  <span style={{ color: model().ohlc?.color }}>
                    {format(model().ohlc?.[field], field)}
                  </span>
                </span>
              )}
            </For>
            <Show when={local.volumeSeries}>
              <span>
                {label("volume")} {value(model().volume, "volume")}
              </span>
            </Show>
          </div>
        }
      >
        {local.renderOHLC?.(model())}
      </Show>
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={expanded()}
        aria-controls={id}
        onClick={() => request(!expanded())}
      >
        {local.labels?.indicators ?? "Indicators"} ({model().count})
      </Button>
      <Show when={expanded()}>
        <ul id={id} class="m-0 flex w-full list-none flex-wrap gap-x-5 gap-y-2 p-0">
          <For
            each={model().indicators.map((row) => row.id)}
            fallback={<li>{local.labels?.empty ?? "No indicators"}</li>}
          >
            {(id) => {
              const initial = untrack(() => model().indicators.find((row) => row.id === id));
              if (!initial) return null;
              const row = createMemo<LegendIndicator>(
                (previous) => model().indicators.find((row) => row.id === id) ?? previous,
                initial,
              );
              return (
                <li>
                  <Show
                    when={local.renderIndicator}
                    fallback={
                      <div class="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-pressed={row().visible}
                          aria-label={`${row().visible ? (local.labels?.hide ?? "Hide") : (local.labels?.show ?? "Show")} ${name(row())}`}
                          onClick={() =>
                            chart()?.requestIndicatorVisibility(row().id, !row().visible)
                          }
                        >
                          {name(row())}
                        </Button>
                        <For each={Object.entries(row().values)}>
                          {([field, v]) => value(v, field)}
                        </For>
                      </div>
                    }
                  >
                    {local.renderIndicator?.(row(), (visible) =>
                      chart()?.requestIndicatorVisibility(row().id, visible),
                    )}
                  </Show>
                </li>
              );
            }}
          </For>
        </ul>
      </Show>
    </section>
  );
}
