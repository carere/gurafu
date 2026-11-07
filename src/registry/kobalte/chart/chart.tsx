import { configureStore, createEvent, createSlice } from "@carere/solux";
import {
  type ChartOptions,
  ColorType,
  createChart,
  type DataChangedHandler,
  type DeepPartial,
  type IChartApi,
  type IPaneApi,
  type ISeriesApi,
  type LogicalRangeChangeEventHandler,
  type MouseEventHandler,
  AreaSeries as NativeAreaSeries,
  BarSeries as NativeBarSeries,
  BaselineSeries as NativeBaselineSeries,
  CandlestickSeries as NativeCandlestickSeries,
  HistogramSeries as NativeHistogramSeries,
  LineSeries as NativeLineSeries,
  type SeriesDataItemTypeMap,
  type SeriesDefinition,
  type SeriesPartialOptionsMap,
  type SizeChangeEventHandler,
  type Time,
  type TimeRangeChangeEventHandler,
} from "lightweight-charts";
import {
  type Accessor,
  createContext,
  createEffect,
  createRoot,
  createSignal,
  getOwner,
  type JSX,
  onCleanup,
  onMount,
  splitProps,
  untrack,
  useContext,
} from "solid-js";
import { isServer } from "solid-js/web";

export type ApiRef<C> = (value: C | undefined) => void;
export interface ResourceController<A> {
  readonly api: A;
  readonly ready: Accessor<boolean>;
}
export interface SnapshotSeriesController<A> extends ResourceController<A> {
  readonly hasData: Accessor<boolean>;
}
export type StandardSeriesType = "Area" | "Bar" | "Baseline" | "Candlestick" | "Histogram" | "Line";
export type StandardSnapshotController<K extends StandardSeriesType> = SnapshotSeriesController<
  ISeriesApi<K, Time>
>;
export type CandlestickSnapshotController = StandardSnapshotController<"Candlestick">;
export type LineSnapshotController = StandardSnapshotController<"Line">;
export type AreaSnapshotController = StandardSnapshotController<"Area">;
export type BarSnapshotController = StandardSnapshotController<"Bar">;
export type BaselineSnapshotController = StandardSnapshotController<"Baseline">;
export type HistogramSnapshotController = StandardSnapshotController<"Histogram">;
export type CandlestickController = CandlestickSnapshotController;
export type LineController = LineSnapshotController;
export type AreaController = AreaSnapshotController;
export type BarController = BarSnapshotController;
export type BaselineController = BaselineSnapshotController;
export type HistogramController = HistogramSnapshotController;
export type PaneController = ResourceController<IPaneApi<Time>>;
export type ChartController = ResourceController<IChartApi>;
export type RootProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "onClick" | "onDblClick"> & {
  onCrosshairMove?: MouseEventHandler<Time>;
  onClick?: MouseEventHandler<Time>;
  onDblClick?: MouseEventHandler<Time>;
  onVisibleTimeRangeChange?: TimeRangeChangeEventHandler<Time>;
  onVisibleLogicalRangeChange?: LogicalRangeChangeEventHandler;
  onSizeChange?: SizeChangeEventHandler;
  /** Native patches. layout.colorSpace/colorParsers are read at creation only. */
  options?: DeepPartial<ChartOptions>;
  containerProps?: JSX.HTMLAttributes<HTMLDivElement>;
  apiRef?: ApiRef<ChartController>;
};
export type PaneProps = {
  id: string;
  children?: JSX.Element;
  apiRef?: ApiRef<PaneController>;
  stretchFactor?: number;
  height?: number;
};
export type StandardSeriesProps<K extends StandardSeriesType> = {
  pane?: string;
  onDataChange?: DataChangedHandler;
  id: string;
  data: readonly SeriesDataItemTypeMap<Time>[K][];
  options?: SeriesPartialOptionsMap[K];
  apiRef?: ApiRef<StandardSnapshotController<K>>;
  children?: JSX.Element;
};
export type CandlestickSeriesProps = StandardSeriesProps<"Candlestick">;
export type LineSeriesProps = StandardSeriesProps<"Line">;
export type AreaSeriesProps = StandardSeriesProps<"Area">;
export type BarSeriesProps = StandardSeriesProps<"Bar">;
export type BaselineSeriesProps = StandardSeriesProps<"Baseline">;
export type HistogramSeriesProps = StandardSeriesProps<"Histogram">;

type ChartScope = {
  controller: Accessor<ChartController | undefined>;
  api: Accessor<IChartApi | undefined>;
  own: (dispose: () => void) => () => void;
  withoutEvents: (dispose: () => void) => void;
  panes: Set<PaneDeclaration>;
  series: Set<SeriesDeclaration>;
  schedule: () => void;
};
const ChartContext = createContext<ChartScope>();
type PaneScope = { controller: Accessor<PaneController | undefined>; id: Accessor<string> };
type PaneDeclaration = {
  id: string;
  marker: Comment | undefined;
  active: boolean;
  api?: IPaneApi<Time>;
  create: (chart: IChartApi) => void;
  dispose: () => void;
};
type SeriesDeclaration = {
  id: string;
  marker: Comment | undefined;
  active: boolean;
  target: string;
  api?: ISeriesApi<StandardSeriesType, Time>;
  create: (chart: IChartApi, pane: IPaneApi<Time>) => void;
  dispose: () => void;
};
function declarationOrder(a: { marker?: Comment }, b: { marker?: Comment }) {
  if (!a.marker || !b.marker) return 0;
  const position = a.marker.compareDocumentPosition(b.marker);
  return position & Node.DOCUMENT_POSITION_FOLLOWING
    ? -1
    : position & Node.DOCUMENT_POSITION_PRECEDING
      ? 1
      : 0;
}
const PaneContext = createContext<PaneScope>();
const SeriesContext =
  createContext<Accessor<StandardSnapshotController<StandardSeriesType> | undefined>>();
function resource<A>(api: A, ready: Accessor<boolean>): ResourceController<A> {
  return {
    get api() {
      if (!ready()) throw new Error("Chart resource is not ready or has been disposed");
      return api;
    },
    ready,
  };
}
function required<T>(value: T | undefined, name: string): T {
  if (!value) throw new Error(`${name} requires its Chart scope`);
  return value;
}
export function useChart(): Accessor<ChartController | undefined> {
  return required(useContext(ChartContext), "useChart").controller;
}
export function usePane(): Accessor<PaneController | undefined> {
  return required(useContext(PaneContext), "usePane").controller;
}
export function useSeries(): Accessor<StandardSnapshotController<StandardSeriesType> | undefined> {
  return required(useContext(SeriesContext), "useSeries");
}

// Clear refs synchronously before native removal, also when the callback changes.
function bindRef<C>(readRef: Accessor<ApiRef<C> | undefined>, readValue: Accessor<C | undefined>) {
  let clear = () => {};
  createEffect(() => {
    const ref = readRef();
    const value = readValue();
    clear();
    clear = () => {};
    if (ref && value) {
      clear = () => {
        clear = () => {};
        untrack(() => ref(undefined));
      };
      untrack(() => ref(value));
    }
  });
  onCleanup(() => clear());
  return () => clear();
}

export function Root(props: RootProps) {
  const [local, dom] = splitProps(props, [
    "children",
    "options",
    "containerProps",
    "apiRef",
    "onCrosshairMove",
    "onClick",
    "onDblClick",
    "onVisibleTimeRangeChange",
    "onVisibleLogicalRangeChange",
    "onSizeChange",
  ]);
  let surface!: HTMLDivElement;
  let outer!: HTMLDivElement;
  const [controller, setController] = createSignal<ChartController>();
  const [nativeApi, setNativeApi] = createSignal<IChartApi>();
  const clearRef = bindRef(() => local.apiRef, controller);
  const owned = new Set<() => void>();
  let silencing = 0;
  let scheduled = false;
  let alive = true;
  let layoutFrame = 0;
  const panes = new Set<PaneDeclaration>();
  const series = new Set<SeriesDeclaration>();
  function reconcile() {
    const chart = nativeApi();
    if (!chart || !alive) return;
    const desiredPanes = [...panes].filter((p) => p.active).sort(declarationOrder);
    const desiredSeries = [...series].filter((s) => s.active).sort(declarationOrder);
    for (const declarations of [desiredPanes, desiredSeries]) {
      const ids = new Set<string>();
      for (const declaration of declarations) {
        if (ids.has(declaration.id)) throw new Error(`Duplicate chart-local id: ${declaration.id}`);
        ids.add(declaration.id);
      }
    }
    for (const pane of desiredPanes) if (!pane.api) pane.create(chart);
    for (const declaration of series) {
      const target = desiredPanes.find((p) => p.id === declaration.target)?.api;
      if (!declaration.active || !target) {
        declaration.dispose();
        if (!declaration.active) series.delete(declaration);
      } else if (!declaration.api) declaration.create(chart, target);
      else if (declaration.api.getPane().paneIndex() !== target.paneIndex()) {
        declaration.api.moveToPane(target.paneIndex());
      }
    }
    // Retained series have moved before their previous pane owner is removed.
    for (const pane of panes)
      if (!pane.active) {
        pane.dispose();
        panes.delete(pane);
      }
    for (const pane of desiredPanes) {
      desiredSeries
        .filter((s) => s.api && s.target === pane.id)
        .forEach((s, index) => {
          if (s.api && s.api.seriesOrder() !== index) s.api.setSeriesOrder(index);
        });
    }
    // Native moveTo validates against rendered widget count, not model count.
    // Creation, hidden mounts and immediate keyed reorder can precede widgets.
    const orderPanes = () => {
      if (!alive) return;
      if (desiredPanes.some((p) => !p.api?.getHTMLElement())) {
        layoutFrame = requestAnimationFrame(orderPanes);
        return;
      }
      desiredPanes.forEach((p, index) => {
        if (p.api && p.api.paneIndex() !== index) p.api.moveTo(index);
      });
      layoutFrame = 0;
    };
    cancelAnimationFrame(layoutFrame);
    orderPanes();
  }
  function schedule() {
    if (scheduled || !alive) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      untrack(reconcile);
    });
  }
  const scope: ChartScope = {
    controller,
    api: nativeApi,
    panes,
    series,
    schedule,
    withoutEvents(dispose) {
      silencing++;
      try {
        dispose();
      } finally {
        silencing--;
      }
    },
    own(dispose) {
      owned.add(dispose);
      return () => owned.delete(dispose);
    },
  };
  onMount(() => {
    const api = createChart(surface, local.options);
    const [ready, setReady] = createSignal(true);
    // Fresh slice and nested graph per chart. No Solux provider shadows the app.
    const selectTime = createEvent<Time | null>("chart/pointerTime");
    const store = configureStore({
      rootSlice: createSlice({
        initialState: { pointer: { time: null as Time | null } },
        handlers: (builder) =>
          builder.addHandler(selectTime, (state, event) => {
            state.pointer.time = event.payload;
          }),
      }),
    });
    let active = true;
    const crosshair: MouseEventHandler<Time> = (event) => {
      if (!active || silencing) return;
      const time = event.time;
      store.dispatch(selectTime(time && typeof time === "object" ? { ...time } : (time ?? null)));
      untrack(() => local.onCrosshairMove?.(event));
    };
    const click: MouseEventHandler<Time> = (event) => {
      if (active && !silencing) untrack(() => local.onClick?.(event));
    };
    const dblClick: MouseEventHandler<Time> = (event) => {
      if (active && !silencing) untrack(() => local.onDblClick?.(event));
    };
    const timeRange: TimeRangeChangeEventHandler<Time> = (range) => {
      if (active && !silencing) untrack(() => local.onVisibleTimeRangeChange?.(range));
    };
    const logicalRange: LogicalRangeChangeEventHandler = (range) => {
      if (active && !silencing) untrack(() => local.onVisibleLogicalRangeChange?.(range));
    };
    const size: SizeChangeEventHandler = (width, height) => {
      if (active && !silencing) untrack(() => local.onSizeChange?.(width, height));
    };
    const scale = api.timeScale();
    api.subscribeCrosshairMove(crosshair);
    api.subscribeClick(click);
    api.subscribeDblClick(dblClick);
    scale.subscribeVisibleTimeRangeChange(timeRange);
    scale.subscribeVisibleLogicalRangeChange(logicalRange);
    scale.subscribeSizeChange(size);
    setNativeApi(api);
    const observer = new MutationObserver((changes) => {
      if (changes.some((change) => !surface.contains(change.target))) schedule();
    });
    observer.observe(outer, { childList: true, subtree: true });
    // Assembly uses the private native handle. Expose public readiness only
    // after Solid has reconciled the declared panes and their initial snapshots.
    queueMicrotask(() => {
      if (active) {
        reconcile();
        setController(resource(api, ready));
      }
    });
    onCleanup(() => {
      active = false;
      alive = false;
      observer.disconnect();
      cancelAnimationFrame(layoutFrame);
      setReady(false);
      clearRef();
      api.unsubscribeCrosshairMove(crosshair);
      api.unsubscribeClick(click);
      api.unsubscribeDblClick(dblClick);
      scale.unsubscribeVisibleTimeRangeChange(timeRange);
      scale.unsubscribeVisibleLogicalRangeChange(logicalRange);
      scale.unsubscribeSizeChange(size);
      store.dispose();
      for (const declaration of series) declaration.dispose();
      for (const declaration of panes) declaration.dispose();
      for (const dispose of [...owned].reverse()) dispose();
      setController(undefined);
      setNativeApi(undefined);
      api.remove();
    });
  });
  createEffect(() => {
    const chart = nativeApi();
    const options = local.options;
    if (chart && options) {
      const { layout, ...patch } = options;
      if (layout) {
        const { colorSpace: _colorSpace, colorParsers: _colorParsers, ...appearance } = layout;
        chart.applyOptions({ ...patch, layout: appearance });
      } else chart.applyOptions(patch);
    }
  });
  return (
    <ChartContext.Provider value={scope}>
      <div
        {...dom}
        ref={(el) => {
          outer = el;
          if (typeof dom.ref === "function") dom.ref(el);
        }}
      >
        <div
          {...local.containerProps}
          ref={(el) => {
            surface = el;
            const ref = local.containerProps?.ref;
            if (typeof ref === "function") ref(el);
          }}
          style={
            typeof local.containerProps?.style === "string"
              ? `width:100%;height:100%;${local.containerProps.style}`
              : { width: "100%", height: "100%", ...local.containerProps?.style }
          }
        />
        {local.children}
      </div>
    </ChartContext.Provider>
  );
}

export function Pane(props: PaneProps) {
  const scope = required(useContext(ChartContext), "Pane");
  const marker = isServer ? undefined : document.createComment("Chart.Pane");
  const [controller, setController] = createSignal<PaneController>();
  const clearRef = bindRef(() => props.apiRef, controller);
  createEffect(() => {
    const id = props.id;
    let setLive: ((value: boolean) => void) | undefined;
    let managed: PaneController | undefined;
    const declaration: PaneDeclaration = {
      id,
      marker,
      active: true,
      create(chart) {
        const api =
          chart.panes().find((p) => !p.preserveEmptyPane() && p.getSeries().length === 0) ??
          chart.addPane(true);
        api.setPreserveEmptyPane(true);
        declaration.api = api;
        const [ready, setReady] = createSignal(true);
        setLive = setReady;
        managed = resource(api, ready);
        setController(managed);
      },
      dispose() {
        const api = declaration.api;
        if (!api) return;
        setLive?.(false);
        // An id change can create the replacement before removing this pane.
        // Never clear the replacement's ref/controller while releasing the old.
        if (untrack(controller) === managed) {
          clearRef();
          setController(undefined);
        }
        declaration.api = undefined;
        const chart = scope.api();
        if (chart) scope.withoutEvents(() => chart.removePane(api.paneIndex()));
      },
    };
    scope.panes.add(declaration);
    scope.schedule();
    onCleanup(() => {
      declaration.active = false;
      scope.schedule();
    });
  });
  createEffect(() => {
    const pane = controller();
    const stretch = props.stretchFactor;
    if (pane && stretch !== undefined) pane.api.setStretchFactor(stretch);
  });
  // Native heights are constrained by chart size and neighboring panes. Apply
  // after widget creation; do not repeatedly override a user's separator drag.
  createEffect(() => {
    const pane = controller();
    const height = props.height;
    if (!pane || height === undefined) return;
    let frame = 0;
    const apply = () => {
      if (!pane.ready()) return;
      if (!pane.api.getHTMLElement()) {
        frame = requestAnimationFrame(apply);
        return;
      }
      pane.api.setHeight(height);
    };
    frame = requestAnimationFrame(apply);
    onCleanup(() => cancelAnimationFrame(frame));
  });
  return (
    <PaneContext.Provider value={{ controller, id: () => props.id }}>
      {marker}
      {props.children}
    </PaneContext.Provider>
  );
}

function StandardSeries<K extends StandardSeriesType>(
  props: StandardSeriesProps<K>,
  definition: SeriesDefinition<K>,
) {
  const scope = required(useContext(ChartContext), definition.type);
  const paneScope = useContext(PaneContext);
  const marker = isServer ? undefined : document.createComment(`Chart.${definition.type}Series`);
  const owner = getOwner();
  const [controller, setController] = createSignal<StandardSnapshotController<K>>();
  const clearRef = bindRef(() => props.apiRef, controller);
  createEffect(() => {
    const id = props.id;
    let release = () => {};
    const declaration: SeriesDeclaration = {
      id,
      marker,
      active: true,
      target: "",
      create(chartApi, target) {
        createRoot((disposeRoot) => {
          const api = chartApi.addSeries(
            definition,
            untrack(() => props.options),
            target.paneIndex(),
          );
          declaration.api = api;
          const [ready, setReady] = createSignal(false);
          const [hasData, setHasData] = createSignal(false);
          const changed: DataChangedHandler = (change) => {
            setHasData(api.data().some((row) => "close" in row || "value" in row));
            setReady(true);
            untrack(() => props.onDataChange?.(change));
          };
          api.subscribeDataChanged(changed);
          setController(Object.assign(resource(api, ready), { hasData }));
          createEffect(() => {
            const rows = props.data;
            setReady(false);
            api.setData(
              rows.map((row) => ({
                ...row,
                time: typeof row.time === "object" ? { ...row.time } : row.time,
              })),
            );
          });
          createEffect(() => {
            const options = props.options;
            if (options) api.applyOptions(options);
          });
          release = () => {
            release = () => {};
            disposeRoot();
            api.unsubscribeDataChanged(changed);
            setReady(false);
            setHasData(false);
            clearRef();
            setController(undefined);
            declaration.api = undefined;
            scope.withoutEvents(() => chartApi.removeSeries(api));
          };
        }, owner);
      },
      dispose() {
        release();
      },
    };
    scope.series.add(declaration);
    createEffect(() => {
      const target = paneScope ? paneScope.id() : props.pane;
      if (!target) throw new Error("A root-level series requires an explicit pane target");
      declaration.target = target;
      scope.schedule();
    });
    onCleanup(() => {
      declaration.active = false;
      scope.schedule();
    });
  });
  return (
    <SeriesContext.Provider value={controller}>
      {marker}
      {props.children}
    </SeriesContext.Provider>
  );
}

export function CandlestickSeries(props: CandlestickSeriesProps) {
  return StandardSeries(props, NativeCandlestickSeries);
}
export function LineSeries(props: LineSeriesProps) {
  return StandardSeries(props, NativeLineSeries);
}
export function AreaSeries(props: AreaSeriesProps) {
  return StandardSeries(props, NativeAreaSeries);
}
export function BarSeries(props: BarSeriesProps) {
  return StandardSeries(props, NativeBarSeries);
}
export function BaselineSeries(props: BaselineSeriesProps) {
  return StandardSeries(props, NativeBaselineSeries);
}
export function HistogramSeries(props: HistogramSeriesProps) {
  return StandardSeries(props, NativeHistogramSeries);
}

// Optional plain native patches. Both presets specify every appearance field
// they own, so switching in either direction never relies on native defaults.
export const lightChartOptions = {
  layout: {
    background: { type: ColorType.Solid, color: "#ffffff" },
    textColor: "#262626",
    panes: { separatorColor: "#d4d4d4", separatorHoverColor: "#a3a3a3" },
  },
  grid: { vertLines: { color: "#f5f5f5" }, horzLines: { color: "#f5f5f5" } },
  crosshair: { vertLine: { color: "#737373" }, horzLine: { color: "#737373" } },
  leftPriceScale: { borderColor: "#d4d4d4" },
  rightPriceScale: { borderColor: "#d4d4d4" },
  timeScale: { borderColor: "#d4d4d4" },
} satisfies DeepPartial<ChartOptions>;
export const darkChartOptions = {
  layout: {
    background: { type: ColorType.Solid, color: "#161616" },
    textColor: "#e5e5e5",
    panes: { separatorColor: "#404040", separatorHoverColor: "#737373" },
  },
  grid: { vertLines: { color: "#262626" }, horzLines: { color: "#262626" } },
  crosshair: { vertLine: { color: "#a3a3a3" }, horzLine: { color: "#a3a3a3" } },
  leftPriceScale: { borderColor: "#404040" },
  rightPriceScale: { borderColor: "#404040" },
  timeScale: { borderColor: "#404040" },
} satisfies DeepPartial<ChartOptions>;
