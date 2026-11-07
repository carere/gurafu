import {
  type CreatePriceLineOptions,
  type DeepPartial,
  type IPriceLine,
  type LineData,
  type LineSeriesPartialOptions,
  LineStyle,
  LineType,
  PriceScaleMode,
  type PriceScaleOptions,
  type WhitespaceData,
} from "lightweight-charts";
import { createEffect, createMemo, createSignal, onCleanup, untrack } from "solid-js";
import { LineSeries, type LineSnapshotController, useIndicatorHost } from "./chart";
import {
  type BollingerBandsParameters,
  type BollingerBandsValue,
  calculateBollingerBands,
  calculateEMA,
  calculateRSI,
  calculateSMA,
  type EMAParameters,
  type IndicatorValue,
  type PriceRow,
  type RSIParameters,
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
export type EMAProps = Declaration &
  Input<IndicatorValue, EMAParameters> & {
    options?: LineSeriesPartialOptions;
  };
export type RSIProps = Declaration &
  Input<IndicatorValue, RSIParameters> & {
    options?: LineSeriesPartialOptions;
    priceScaleOptions?: DeepPartial<PriceScaleOptions>;
    referenceLines?: readonly CreatePriceLineOptions[];
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

// Optional calculations always start from the managed displayed history, just
// like SMA/Bands: corrections, rewind and context changes retain no future seed.
export function EMA(props: EMAProps) {
  const host = useIndicatorHost();
  const visible = visibility(props, host);
  const values = createMemo(
    () =>
      props.data ??
      calculateEMA(host.displayed(props.source) as readonly PriceRow[], props.parameters),
  );
  const color = createMemo(() => props.options?.color ?? "#FF9800");
  const rows = createMemo(() => lineRows(values(), color()));
  return (
    <LineSeries
      id={`${props.id}/ema`}
      pane={props.pane}
      data={rows()}
      options={{
        ...lineDefaults,
        lineWidth: 2,
        color: "#FF9800",
        ...props.options,
        visible: visible(),
      }}
    />
  );
}

const rsiRange: NonNullable<LineSeriesPartialOptions["autoscaleInfoProvider"]> = () => ({
  priceRange: { minValue: 0, maxValue: 100 },
});
const rsiReferences: readonly CreatePriceLineOptions[] = [{ price: 30 }, { price: 70 }];

export function RSI(props: RSIProps) {
  const host = useIndicatorHost();
  const visible = visibility(props, host);
  const values = createMemo(
    () =>
      props.data ??
      calculateRSI(host.displayed(props.source) as readonly PriceRow[], props.parameters),
  );
  const color = createMemo(() => props.options?.color ?? "#9C27B0");
  const rows = createMemo(() => lineRows(values(), color()));
  const [controller, setController] = createSignal<LineSnapshotController>();
  // Price-line ownership follows the native series lifetime. Presentation
  // patches keep retained lines and never write data or restart calculation.
  createEffect(() => {
    const current = controller();
    if (!current) return;
    // Capture while ready; managed accessors deliberately reject after
    // invalidation, but owned references must still detach during cleanup.
    const api = untrack(() => current.api);
    const lines: IPriceLine[] = [];
    createEffect(() => {
      const references = props.referenceLines ?? rsiReferences;
      while (lines.length > references.length) {
        const line = lines.pop();
        if (line) api.removePriceLine(line);
      }
      references.forEach((reference, index) => {
        const options = {
          color: "#9C27B0",
          lineWidth: 1 as const,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "",
          axisLabelColor: "",
          axisLabelTextColor: "",
          ...reference,
          lineVisible: visible() && (reference.lineVisible ?? true),
        };
        if (lines[index]) lines[index].applyOptions(options);
        else lines.push(api.createPriceLine(options));
      });
    });
    onCleanup(() => {
      for (const line of lines) api.removePriceLine(line);
    });
  });
  createEffect(() => {
    const current = controller();
    if (!current?.ready()) return;
    const options = props.priceScaleOptions;
    // A native scale handle retains its original pane. Reacquire after the
    // core's queued pane movement, including when the old pane is removed.
    props.pane;
    const apply = () => {
      if (current.ready())
        current.api.priceScale().applyOptions({
          mode: PriceScaleMode.Normal,
          autoScale: true,
          scaleMargins: { top: 0, bottom: 0 },
          ...options,
        });
    };
    apply();
    const frame = requestAnimationFrame(apply);
    onCleanup(() => cancelAnimationFrame(frame));
  });
  return (
    <LineSeries
      id={`${props.id}/rsi`}
      pane={props.pane}
      data={rows()}
      apiRef={setController}
      options={{
        ...lineDefaults,
        lineWidth: 2,
        color: "#9C27B0",
        autoscaleInfoProvider: rsiRange,
        ...props.options,
        visible: visible(),
      }}
    />
  );
}
