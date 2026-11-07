import {
  type LineData,
  type LineSeriesPartialOptions,
  LineStyle,
  LineType,
  type WhitespaceData,
} from "lightweight-charts";
import { createEffect, createMemo, onCleanup, untrack } from "solid-js";
import { LineSeries, useIndicatorHost } from "./chart";
import {
  type BollingerBandsParameters,
  type BollingerBandsValue,
  calculateBollingerBands,
  calculateSMA,
  type IndicatorValue,
  type PriceRow,
  type SMAParameters,
} from "./indicator-calculations";

export * from "./indicator-calculations";

type Input<R, P> =
  | { source: string; data?: never; parameters?: P }
  | { source?: never; data: readonly R[]; parameters?: never };
type Declaration = {
  id: string;
  pane?: string;
  visible?: boolean;
  defaultVisible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
};
export type SMAProps = Declaration &
  Input<IndicatorValue, SMAParameters> & {
    options?: LineSeriesPartialOptions;
  };
export type BollingerBandsProps = Declaration &
  Input<BollingerBandsValue, BollingerBandsParameters> & {
    options?: {
      middle?: LineSeriesPartialOptions;
      upper?: LineSeriesPartialOptions;
      lower?: LineSeriesPartialOptions;
      risingColor?: string;
      fallingColor?: string;
    };
  };
function visibility(props: Declaration, host: ReturnType<typeof useIndicatorHost>) {
  createEffect(() => {
    const id = props.id;
    const release = host.register(id, (value) => {
      if (props.visible === undefined) host.interaction()?.set(id, value);
      props.onVisibleChange?.(value);
    });
    onCleanup(release);
    createEffect(() => {
      const interaction = host.interaction();
      if (!interaction) return;
      interaction.set(
        id,
        untrack(() => props.defaultVisible ?? true),
      );
      onCleanup(() => interaction.set(id, undefined));
    });
  });
  return () =>
    props.visible ?? host.interaction()?.visibility()[props.id] ?? props.defaultVisible ?? true;
}
const lineDefaults = {
  lineStyle: LineStyle.Solid,
  lineType: LineType.Simple,
  lineWidth: 1 as const,
};

// Ashiso's raw-sequence direction helper adapted to native lines: flat retains
// direction, whitespace restarts it, and coordinates never determine direction.
// Native simple-line colors belong to the OUTGOING segment, so write its color
// onto the previous populated row. A transparent outgoing segment breaks gaps.
function lineRows(
  rows: readonly IndicatorValue[],
  color: string,
  direction?: { rising: string; falling: string },
): (LineData | WhitespaceData)[] {
  let previous: LineData | undefined;
  let currentColor = direction?.rising ?? color;
  return rows.map((row) => {
    if (!("value" in row)) {
      if (previous) previous.color = "transparent";
      previous = undefined;
      currentColor = direction?.rising ?? color;
      return { time: row.time };
    }
    if (previous) {
      if (direction && row.value !== previous.value)
        currentColor = row.value > previous.value ? direction.rising : direction.falling;
      previous.color = currentColor;
    }
    const result = { time: row.time, value: row.value, color: currentColor };
    previous = result;
    return result;
  });
}
export function SMA(props: SMAProps) {
  const host = useIndicatorHost();
  const visible = visibility(props, host);
  const values = createMemo(
    () =>
      props.data ??
      calculateSMA(host.displayed(props.source) as readonly PriceRow[], props.parameters),
  );
  const color = createMemo(() => props.options?.color ?? "#2196F3");
  const rows = createMemo(() => lineRows(values(), color()));
  return (
    <LineSeries
      id={`${props.id}/sma`}
      pane={props.pane}
      data={rows()}
      options={{
        ...lineDefaults,
        lineWidth: 2,
        color: "#2196F3",
        ...props.options,
        visible: visible(),
      }}
    />
  );
}
export function BollingerBands(props: BollingerBandsProps) {
  const host = useIndicatorHost();
  const visible = visibility(props, host);
  const values = createMemo(
    () =>
      props.data ??
      calculateBollingerBands(
        host.displayed(props.source) as readonly PriceRow[],
        props.parameters,
      ),
  );
  const rising = createMemo(() => props.options?.risingColor ?? "#2196F3");
  const falling = createMemo(() => props.options?.fallingColor ?? "#F55253");
  const rows = (kind: "middle" | "upper" | "lower") => {
    const color = createMemo(() => props.options?.[kind]?.color);
    return createMemo(() =>
      lineRows(
        values().map((row) =>
          row.middle !== undefined ? { time: row.time, value: row[kind] } : { time: row.time },
        ),
        color() ?? (kind === "middle" ? "#4CAF50" : "#2196F3"),
        kind === "middle" || color() ? undefined : { rising: rising(), falling: falling() },
      ),
    );
  };
  const middle = rows("middle"),
    upper = rows("upper"),
    lower = rows("lower");
  return (
    <>
      <LineSeries
        id={`${props.id}/middle`}
        pane={props.pane}
        data={middle()}
        options={{
          ...lineDefaults,
          color: "#4CAF50",
          ...props.options?.middle,
          visible: visible(),
        }}
      />
      <LineSeries
        id={`${props.id}/upper`}
        pane={props.pane}
        data={upper()}
        options={{ ...lineDefaults, color: "#2196F3", ...props.options?.upper, visible: visible() }}
      />
      <LineSeries
        id={`${props.id}/lower`}
        pane={props.pane}
        data={lower()}
        options={{ ...lineDefaults, color: "#2196F3", ...props.options?.lower, visible: visible() }}
      />
    </>
  );
}
