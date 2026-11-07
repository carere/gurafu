import {
  type CreatePriceLineOptions,
  type DeepPartial,
  type IPaneApi,
  type IPriceLine,
  type LineData,
  type LineSeriesPartialOptions,
  LineStyle,
  LineType,
  PriceScaleMode,
  type PriceScaleOptions,
  type Time,
  type WhitespaceData,
} from "lightweight-charts";
import { createEffect, createMemo, createSignal, onCleanup, untrack } from "solid-js";
import {
  type LegendIndicator,
  LineSeries,
  type LineSnapshotController,
  useIndicatorHost,
} from "./chart";
import { timeKey } from "./chart-data";
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
function visibility(
  props: Declaration,
  host: ReturnType<typeof useIndicatorHost>,
  read: (time: Time | null) => LegendIndicator,
) {
  const initialVisible = createMemo(() => {
    props.id;
    return untrack(() => props.defaultVisible ?? true);
  });
  createEffect(() => {
    const id = props.id;
    const release = host.register(
      id,
      (value) => {
        if (props.visible === undefined) host.interaction()?.set(id, value);
        props.onVisibleChange?.(value);
      },
      read,
    );
    onCleanup(release);
    createEffect(() => {
      const interaction = host.interaction();
      if (!interaction) return;
      interaction.set(id, untrack(initialVisible));
      onCleanup(() => interaction.set(id, undefined));
    });
  });
  return () => props.visible ?? host.interaction()?.visibility()[props.id] ?? initialVisible();
}
const lineDefaults = {
  lineStyle: LineStyle.Solid,
  lineType: LineType.Simple,
  lineWidth: 1 as const,
};

// Defaults belong to each native lifetime. Later options remain native patches;
// row colors retain explicit color changes when an unrelated field is patched.
function linePresentation(
  props: Declaration,
  options: () => LineSeriesPartialOptions | undefined,
  visible: () => boolean,
  defaults: LineSeriesPartialOptions & { color: string },
) {
  const chosenColor = createMemo<{ id: string; color: string | undefined }>((previous) => ({
    id: props.id,
    color: options()?.color ?? (previous?.id === props.id ? previous.color : undefined),
  }));
  return {
    customColor: createMemo(() => chosenColor().color),
    color: createMemo(() => chosenColor().color ?? defaults.color),
    initialize(current: LineSnapshotController | undefined) {
      if (current)
        current.api.applyOptions({
          ...lineDefaults,
          ...defaults,
          ...untrack(options),
          visible: untrack(visible),
        });
    },
  };
}

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
// Legend colors describe the INCOMING raw-value direction. Native rows carry
// outgoing segment colors and therefore cannot be used for this read model.
function exactValue(
  rows: readonly IndicatorValue[],
  time: Time | null,
  color: string,
  direction?: { rising: string; falling: string },
) {
  let previous: number | undefined;
  let incoming = direction?.rising ?? color;
  for (const row of rows) {
    if (!("value" in row)) {
      previous = undefined;
      incoming = direction?.rising ?? color;
    } else {
      if (direction && previous !== undefined && row.value !== previous)
        incoming = row.value > previous ? direction.rising : direction.falling;
      previous = row.value;
    }
    if (time !== null && timeKey(row.time) === timeKey(time))
      return !("value" in row) ? null : { value: row.value, color: incoming };
  }
  return null;
}
function singleLine<P>(
  props: Declaration & Input<IndicatorValue, P> & { options?: LineSeriesPartialOptions },
  calculate: (rows: readonly PriceRow[], parameters?: P) => readonly IndicatorValue[],
  config: {
    label: string;
    suffix: string;
    defaults: LineSeriesPartialOptions & { color: string };
  },
) {
  const host = useIndicatorHost();
  const visible = visibility(props, host, (time) => ({
    id: props.id,
    label: config.label,
    visible: visible(),
    values: { value: exactValue(values(), time, presentation.color()) },
  }));
  const values = createMemo(
    () =>
      props.data ??
      calculate(host.displayed(props.source) as readonly PriceRow[], props.parameters),
  );
  const presentation = linePresentation(props, () => props.options, visible, config.defaults);
  const rows = createMemo(() => lineRows(values(), presentation.color()));
  return (
    <LineSeries
      id={`${props.id}/${config.suffix}`}
      pane={props.pane}
      data={rows()}
      apiRef={presentation.initialize}
      options={{
        ...props.options,
        visible: visible(),
      }}
    />
  );
}
export function SMA(props: SMAProps) {
  return singleLine(props, calculateSMA, {
    label: "Price SMA",
    suffix: "sma",
    defaults: { lineWidth: 2, color: "#2196F3" },
  });
}
export function BollingerBands(props: BollingerBandsProps) {
  const host = useIndicatorHost();
  const visible = visibility(props, host, (time) => ({
    id: props.id,
    label: "Bollinger Bands",
    visible: visible(),
    values: Object.fromEntries(
      (["middle", "upper", "lower"] as const).map((kind) => [
        kind,
        exactValue(
          values().map((row) =>
            row.middle === undefined ? { time: row.time } : { time: row.time, value: row[kind] },
          ),
          time,
          presentations[kind].color(),
          kind === "middle" || presentations[kind].customColor()
            ? undefined
            : { rising: rising(), falling: falling() },
        ),
      ]),
    ),
  }));
  const values = createMemo(
    () =>
      props.data ??
      calculateBollingerBands(
        host.displayed(props.source) as readonly PriceRow[],
        props.parameters,
      ),
  );
  const rising = createMemo<string>(
    (previous) => props.options?.risingColor ?? previous,
    "#2196F3",
  );
  const falling = createMemo<string>(
    (previous) => props.options?.fallingColor ?? previous,
    "#F55253",
  );
  const presentations = {
    middle: linePresentation(props, () => props.options?.middle, visible, { color: "#4CAF50" }),
    upper: linePresentation(props, () => props.options?.upper, visible, { color: "#2196F3" }),
    lower: linePresentation(props, () => props.options?.lower, visible, { color: "#2196F3" }),
  };
  const rows = (kind: "middle" | "upper" | "lower") => {
    const presentation = presentations[kind];
    return createMemo(() =>
      lineRows(
        values().map((row) =>
          row.middle !== undefined ? { time: row.time, value: row[kind] } : { time: row.time },
        ),
        presentation.color(),
        kind === "middle" || presentation.customColor()
          ? undefined
          : { rising: rising(), falling: falling() },
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
        apiRef={presentations.middle.initialize}
        options={{
          ...props.options?.middle,
          visible: visible(),
        }}
      />
      <LineSeries
        id={`${props.id}/upper`}
        pane={props.pane}
        data={upper()}
        apiRef={presentations.upper.initialize}
        options={{ ...props.options?.upper, visible: visible() }}
      />
      <LineSeries
        id={`${props.id}/lower`}
        pane={props.pane}
        data={lower()}
        apiRef={presentations.lower.initialize}
        options={{ ...props.options?.lower, visible: visible() }}
      />
    </>
  );
}

// Optional calculations always start from the managed displayed history, just
// like SMA/Bands: corrections, rewind and context changes retain no future seed.
export function EMA(props: EMAProps) {
  return singleLine(props, calculateEMA, {
    label: "Price EMA",
    suffix: "ema",
    defaults: { lineWidth: 2, color: "#FF9800" },
  });
}

const rsiRange: NonNullable<LineSeriesPartialOptions["autoscaleInfoProvider"]> = () => ({
  priceRange: { minValue: 0, maxValue: 100 },
});
const rsiReferences: readonly CreatePriceLineOptions[] = [{ price: 30 }, { price: 70 }];

export function RSI(props: RSIProps) {
  const host = useIndicatorHost();
  const visible = visibility(props, host, (time) => ({
    id: props.id,
    label: "RSI",
    visible: visible(),
    values: { value: exactValue(values(), time, presentation.color()) },
  }));
  const values = createMemo(
    () =>
      props.data ??
      calculateRSI(host.displayed(props.source) as readonly PriceRow[], props.parameters),
  );
  const presentation = linePresentation(props, () => props.options, visible, {
    lineWidth: 2,
    color: "#9C27B0",
    autoscaleInfoProvider: rsiRange,
  });
  const rows = createMemo(() => lineRows(values(), presentation.color()));
  const [controller, setController] = createSignal<LineSnapshotController>();
  // Price-line ownership follows the native series lifetime. Presentation
  // patches keep retained lines and never write data or restart calculation.
  createEffect(() => {
    const current = controller();
    if (!current) return;
    // Capture while ready; managed accessors deliberately reject after
    // invalidation, but owned references must still detach during cleanup.
    const api = untrack(() => current.api);
    const lines: { api: IPriceLine; visible: boolean }[] = [];
    createEffect(() => {
      const references = props.referenceLines ?? rsiReferences;
      while (lines.length > references.length) {
        const line = lines.pop();
        if (line) api.removePriceLine(line.api);
      }
      references.forEach((reference, index) => {
        const lineVisible = reference.lineVisible ?? lines[index]?.visible ?? true;
        const options = { ...reference, lineVisible: visible() && lineVisible };
        if (lines[index]) {
          lines[index].visible = lineVisible;
          lines[index].api.applyOptions(options);
        } else
          lines.push({
            visible: lineVisible,
            api: api.createPriceLine({
              color: "#9C27B0",
              lineWidth: 1 as const,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: "",
              axisLabelColor: "",
              axisLabelTextColor: "",
              ...options,
            }),
          });
      });
    });
    onCleanup(() => {
      for (const line of lines) api.removePriceLine(line.api);
    });
  });
  createEffect(() => {
    const current = controller();
    if (!current) return;
    let pane: IPaneApi<Time> | undefined;
    let scaleId: string | undefined;
    let retained: DeepPartial<PriceScaleOptions> = {
      mode: PriceScaleMode.Normal,
      autoScale: true,
      scaleMargins: { top: 0, bottom: 0 },
    };
    createEffect(() => {
      if (!current.ready()) return;
      const options = props.priceScaleOptions;
      // A native scale handle retains its original pane. Reacquire after the
      // core's queued pane movement, including when the old pane is removed.
      props.pane;
      props.options?.priceScaleId;
      const apply = () => {
        if (!current.ready()) return;
        const currentPane = current.api.getPane();
        const scale = current.api.priceScale();
        const currentScaleId = current.api.options().priceScaleId;
        if (pane !== currentPane || scaleId !== currentScaleId) scale.applyOptions(retained);
        if (options) scale.applyOptions(options);
        const applied = scale.options();
        retained = { ...applied, scaleMargins: { ...applied.scaleMargins } };
        pane = currentPane;
        scaleId = currentScaleId;
      };
      apply();
      const frame = requestAnimationFrame(apply);
      onCleanup(() => cancelAnimationFrame(frame));
    });
  });
  return (
    <LineSeries
      id={`${props.id}/rsi`}
      pane={props.pane}
      data={rows()}
      apiRef={(current) => {
        presentation.initialize(current);
        setController(current);
      }}
      options={{
        ...props.options,
        visible: visible(),
      }}
    />
  );
}
