import { configureStore, createEvent, createSlice, devtools } from "@carere/solux";
import {
  type BusinessDay,
  type ChartOptions,
  ColorType,
  type CustomData,
  type CustomSeriesOptions,
  createChart,
  createSeriesMarkers,
  type DataChangedHandler,
  type DeepPartial,
  type IChartApi,
  type ICustomSeriesPaneView,
  type IPaneApi,
  type IPanePrimitive,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type ISeriesPrimitive,
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
  type SeriesMarker,
  type SeriesMarkersOptions,
  type SeriesPartialOptions,
  type SeriesPartialOptionsMap,
  type SizeChangeEventHandler,
  type Time,
  type TimeRangeChangeEventHandler,
  type UTCTimestamp,
  type WhitespaceData,
} from "lightweight-charts";
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
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
import { createDataCoordinator, createManagedData, type DataCoordinator } from "./chart-data";

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
export interface IncrementalSeriesController<A, D> extends SnapshotSeriesController<A> {
  setData(data: readonly D[]): void;
  update(item: D, historicalUpdate?: boolean): void;
  pop(count: number): D[];
}
export type SeriesDataProps<A, D> =
  | {
      data: readonly D[];
      defaultData?: never;
      apiRef?: ApiRef<SnapshotSeriesController<A>>;
    }
  | {
      data?: never;
      defaultData?: readonly D[];
      apiRef?: ApiRef<IncrementalSeriesController<A, D>>;
    };
export type StandardIncrementalController<K extends StandardSeriesType> =
  IncrementalSeriesController<ISeriesApi<K, Time>, SeriesDataItemTypeMap<Time>[K]>;
export type StandardController<K extends StandardSeriesType> =
  | StandardSnapshotController<K>
  | StandardIncrementalController<K>;
export type CandlestickIncrementalController = StandardIncrementalController<"Candlestick">;
export type CandlestickController = StandardController<"Candlestick">;
export type LineIncrementalController = StandardIncrementalController<"Line">;
export type LineController = StandardController<"Line">;
export type AreaIncrementalController = StandardIncrementalController<"Area">;
export type AreaController = StandardController<"Area">;
export type BarIncrementalController = StandardIncrementalController<"Bar">;
export type BarController = StandardController<"Bar">;
export type BaselineIncrementalController = StandardIncrementalController<"Baseline">;
export type BaselineController = StandardController<"Baseline">;
export type HistogramIncrementalController = StandardIncrementalController<"Histogram">;
export type HistogramController = StandardController<"Histogram">;
export type PaneController = ResourceController<IPaneApi<Time>>;
export interface ChartController extends ResourceController<IChartApi> {
  setCrosshairPosition(price: number, time: Time, series: SnapshotSeriesController<unknown>): void;
  clearCrosshairPosition(): void;
  goToTime(time: Time): void;
  goToLatest(): void;
  requestIndicatorVisibility(id: string, visible: boolean): void;
}
export type RootProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "onClick" | "onDblClick"> & {
  devtools?: false | { name: string };
  datasetKey?: string | number;
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
  options?: SeriesPartialOptionsMap[K];
  children?: JSX.Element;
} & SeriesDataProps<ISeriesApi<K, Time>, SeriesDataItemTypeMap<Time>[K]>;
export type CandlestickSeriesProps = StandardSeriesProps<"Candlestick">;
export type LineSeriesProps = StandardSeriesProps<"Line">;
export type AreaSeriesProps = StandardSeriesProps<"Area">;
export type BarSeriesProps = StandardSeriesProps<"Bar">;
export type BaselineSeriesProps = StandardSeriesProps<"Baseline">;
export type HistogramSeriesProps = StandardSeriesProps<"Histogram">;

export type CustomNativeApi<
  D extends CustomData<Time>,
  O extends CustomSeriesOptions,
  P extends SeriesPartialOptions<O> = SeriesPartialOptions<O>,
> = ISeriesApi<"Custom", Time, D | WhitespaceData<Time>, O, P>;
export type CustomSnapshotController<
  D extends CustomData<Time>,
  O extends CustomSeriesOptions,
  P extends SeriesPartialOptions<O> = SeriesPartialOptions<O>,
> = SnapshotSeriesController<CustomNativeApi<D, O, P>>;
export type CustomIncrementalController<
  D extends CustomData<Time>,
  O extends CustomSeriesOptions,
  P extends SeriesPartialOptions<O> = SeriesPartialOptions<O>,
> = IncrementalSeriesController<CustomNativeApi<D, O, P>, D | WhitespaceData<Time>>;
export type CustomController<
  D extends CustomData<Time>,
  O extends CustomSeriesOptions,
  P extends SeriesPartialOptions<O> = SeriesPartialOptions<O>,
> = CustomSnapshotController<D, O, P> | CustomIncrementalController<D, O, P>;
export type CustomSeriesProps<
  D extends CustomData<Time>,
  O extends CustomSeriesOptions,
  P extends SeriesPartialOptions<O> = SeriesPartialOptions<O>,
> = {
  id: string;
  pane?: string;
  children?: JSX.Element;
  create: () => ICustomSeriesPaneView<Time, D, O>;
  onDispose?: (view: ICustomSeriesPaneView<Time, D, O>) => void;
  options?: P;
  onDataChange?: DataChangedHandler;
} & SeriesDataProps<CustomNativeApi<D, O, P>, NoInfer<D> | WhitespaceData<Time>>;

// Internal ownership registration, shared by native hosts and their extensions.
type ExtensionOwner = Set<() => void>;
function disposeExtensions(extensions: ExtensionOwner) {
  for (const dispose of [...extensions]) dispose();
}
export type LegendValue = Readonly<{ value: number; color: string }>;
export type LegendIndicator = Readonly<{
  id: string;
  label: string;
  visible: boolean;
  values: Readonly<Record<string, LegendValue | null>>;
}>;
export type LegendModel = Readonly<{
  time: string | UTCTimestamp | Readonly<BusinessDay> | null;
  ohlc: Readonly<{ open: number; high: number; low: number; close: number; color: string }> | null;
  volume: LegendValue | null;
  indicators: readonly LegendIndicator[];
  count: number;
}>;
export type LegendOptions = { priceSeries: string; volumeSeries?: string };
type IndicatorEntry = {
  request(visible: boolean): void;
  read?: (time: Time | null) => LegendIndicator;
};
type SeriesReader = {
  controller: ResourceController<unknown>;
  options: () => Record<string, unknown>;
};
type IndicatorInteraction = {
  time: Accessor<Time | null>;
  expanded: Accessor<Readonly<Record<string, boolean>>>;
  expand(id: string, expanded: boolean | undefined): void;
  visibility: Accessor<Readonly<Record<string, boolean>>>;
  set(id: string, visible: boolean | undefined): void;
};
type ChartScope = {
  indicatorInteraction: Accessor<IndicatorInteraction | undefined>;
  indicators: Map<string, IndicatorEntry>;
  indicatorVersion: Accessor<number>;
  changedIndicators(): void;
  readers: Accessor<ReadonlyMap<string, SeriesReader>>;
  setReader(id: string, reader: SeriesReader | undefined): void;
  data: Accessor<DataCoordinator | undefined>;
  controller: Accessor<ChartController | undefined>;
  api: Accessor<IChartApi | undefined>;
  own: (dispose: () => void) => () => void;
  withoutEvents: (dispose: () => void) => void;
  panes: Set<PaneDeclaration>;
  series: Set<SeriesDeclaration>;
  schedule: () => void;
};
const ChartContext = createContext<ChartScope>();
type PaneScope = {
  controller: Accessor<PaneController | undefined>;
  id: Accessor<string>;
  extensions: ExtensionOwner;
};
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
  api?: Pick<
    ISeriesApi<StandardSeriesType, Time>,
    "getPane" | "moveToPane" | "seriesOrder" | "setSeriesOrder"
  >;
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
type SeriesHost = Pick<ISeriesApi<StandardSeriesType, Time>, "attachPrimitive" | "detachPrimitive">;
const SeriesContext = createContext<{
  controller: Accessor<ResourceController<SeriesHost> | undefined>;
  extensions: ExtensionOwner;
}>();
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
/** Supply the known controller type when capturing a custom-series scope. */
export function useSeries<
  C extends SnapshotSeriesController<unknown> = StandardController<StandardSeriesType>,
>(): Accessor<C | undefined> {
  return required(useContext(SeriesContext), "useSeries").controller as Accessor<C | undefined>;
}

// Internal optional-item bridge, carrying no native handles or private store.
// Optional declarations only observe managed display and visibility.
/** @internal Shared with the optional registry item; not a consumer state API. */
export function useIndicatorHost() {
  const scope = required(useContext(ChartContext), "Indicator");
  return {
    displayed(id: string) {
      const coordinator = scope.data();
      const source = coordinator?.sources().get(id);
      // Declarations may precede their source. During a context switch, resolve
      // that source before deriving a snapshot, rather than publish a ready
      // empty/old result until Solid's later effects reconcile it again.
      if (coordinator?.switching()) untrack(() => source?.reconcile());
      return source?.displayed() ?? [];
    },
    interaction: scope.indicatorInteraction,
    register(id: string, request: (visible: boolean) => void, read?: IndicatorEntry["read"]) {
      if (scope.indicators.has(id)) throw new Error(`Duplicate chart-local indicator id: ${id}`);
      const entry = { request, read };
      scope.indicators.set(id, entry);
      scope.changedIndicators();
      return () => {
        if (scope.indicators.get(id) === entry) {
          scope.indicators.delete(id);
          scope.changedIndicators();
        }
      };
    },
  };
}

// Calendar representations compare by native UTC identity, without nearest-bar lookup.
function sameTime(a: Time, b: Time) {
  const key = (t: Time) =>
    typeof t === "number"
      ? t
      : typeof t === "string"
        ? Date.parse(t) / 1000
        : Date.UTC(t.year, t.month - 1, t.day) / 1000;
  return key(a) === key(b);
}
export function useLegend(options: LegendOptions): Accessor<LegendModel> {
  const scope = required(useContext(ChartContext), "useLegend");
  return createMemo(() => {
    const sources = scope.data()?.sources();
    const rows = sources?.get(options.priceSeries)?.displayed() ?? [];
    const selected = scope.indicatorInteraction()?.time();
    const time = selected ?? rows.at(-1)?.time ?? null;
    const exact = (id: string | undefined) =>
      id && time !== null
        ? (sources
            ?.get(id)
            ?.displayed()
            .find((r) => sameTime(r.time, time)) as Record<string, unknown> | undefined)
        : undefined;
    const row = exact(options.priceSeries);
    const priceOptions = scope.readers().get(options.priceSeries)?.options();
    const ohlc =
      row &&
      typeof row.open === "number" &&
      typeof row.high === "number" &&
      typeof row.low === "number" &&
      typeof row.close === "number"
        ? {
            open: row.open,
            high: row.high,
            low: row.low,
            close: row.close,
            color: String(
              row.color ??
                (row.close >= row.open ? priceOptions?.upColor : priceOptions?.downColor) ??
                "currentColor",
            ),
          }
        : null;
    const volumeRow = exact(options.volumeSeries);
    const volume =
      volumeRow && typeof volumeRow.value === "number"
        ? {
            value: volumeRow.value,
            color: String(
              volumeRow.color ??
                scope
                  .readers()
                  .get(options.volumeSeries ?? "")
                  ?.options().color ??
                "currentColor",
            ),
          }
        : null;
    scope.indicatorVersion();
    const indicators = [...scope.indicators.values()].flatMap((entry) =>
      entry.read ? [entry.read(time)] : [],
    );
    return {
      time: time && typeof time === "object" ? { ...time } : time,
      ohlc,
      volume,
      indicators,
      count: indicators.filter((i) => i.visible).length,
    };
  });
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
    "datasetKey",
    "devtools",
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
  const [data, setData] = createSignal<DataCoordinator>();
  const [indicatorInteraction, setIndicatorInteraction] = createSignal<IndicatorInteraction>();
  const indicators = new Map<string, IndicatorEntry>();
  const [indicatorVersion, setIndicatorVersion] = createSignal(0);
  const [readers, setReaders] = createSignal<ReadonlyMap<string, SeriesReader>>(new Map());
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
    indicatorInteraction,
    indicators,
    indicatorVersion,
    changedIndicators: () => setIndicatorVersion((v) => v + 1),
    readers,
    setReader(id, reader) {
      setReaders((prior) => {
        const next = new Map(prior);
        if (reader) next.set(id, reader);
        else next.delete(id);
        return next;
      });
    },
    data,
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
    const selectTime = createEvent<{
      time: Time | null;
      seriesId: string | null;
      hadPoint: boolean;
    }>("chart/pointerTime");
    const indicatorVisibility = createEvent<{ id: string; visible: boolean | undefined }>(
      "chart/indicatorVisibility",
    );
    const legendExpansion = createEvent<{ id: string; expanded: boolean | undefined }>(
      "chart/legendExpansion",
    );
    const store = configureStore({
      enhancers: local.devtools
        ? [devtools({ name: local.devtools.name, instanceId: `gurafu:${crypto.randomUUID()}` })]
        : [],
      rootSlice: createSlice({
        initialState: {
          pointer: { time: null as Time | null, seriesId: null as string | null, hadPoint: false },
          indicatorVisibility: {} as Record<string, boolean>,
          legendExpansion: {} as Record<string, boolean>,
        },
        handlers: (builder) =>
          builder
            .addHandler(legendExpansion, (state, event) => {
              const { id, expanded } = event.payload;
              if (expanded === undefined) delete state.legendExpansion[id];
              else state.legendExpansion[id] = expanded;
            })
            .addHandler(selectTime, (state, event) => {
              state.pointer = event.payload;
            })
            .addHandler(indicatorVisibility, (state, event) => {
              const { id, visible } = event.payload;
              if (visible === undefined) delete state.indicatorVisibility[id];
              else state.indicatorVisibility[id] = visible;
            }),
      }),
    });
    function select(time: Time | null, seriesId: string | null = null) {
      const rows = seriesId ? data()?.sources().get(seriesId)?.displayed() : undefined;
      store.dispatch(
        selectTime({
          time: time && typeof time === "object" ? { ...time } : time,
          seriesId,
          hadPoint: time !== null && (rows?.some((r) => sameTime(r.time, time)) ?? false),
        }),
      );
    }
    setIndicatorInteraction({
      time: () => store.state.pointer.time,
      expanded: () => store.state.legendExpansion,
      expand: (id, expanded) => {
        store.dispatch(legendExpansion({ id, expanded }));
      },
      visibility: () => store.state.indicatorVisibility,
      set: (id, visible) => {
        store.dispatch(indicatorVisibility({ id, visible }));
      },
    });
    let active = true;
    const crosshair: MouseEventHandler<Time> = (event) => {
      if (!active || silencing) return;
      // Native data/appearance recomputation also emits crosshair notifications.
      // Only an actual pointer event (or leave) owns pointer intent; restoring
      // private settings must not feed the prior native position back into it.
      if (event.time !== undefined && !event.sourceEvent) return;
      const time = event.time;
      const seriesId =
        [...readers()].find(
          ([, reader]) =>
            reader.controller.ready() &&
            event.seriesData.has(reader.controller.api as ISeriesApi<StandardSeriesType, Time>),
        )?.[0] ?? null;
      select(time ?? null, seriesId);
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
    const coordinator = createDataCoordinator(
      api,
      () => local.datasetKey ?? "default",
      () => {
        select(null);
      },
    );
    setData(coordinator);
    createEffect(() => {
      const { time, seriesId, hadPoint } = store.state.pointer;
      const rows = seriesId ? coordinator.sources().get(seriesId)?.displayed() : undefined;
      if (
        time !== null &&
        hadPoint &&
        !rows?.some((row) => sameTime(row.time, time)) &&
        !coordinator.switching()
      ) {
        scope.withoutEvents(() => api.clearCrosshairPosition());
        select(null);
      }
    });
    const chartReady = () => ready() && coordinator.ready();
    const managed: ChartController = {
      ready: chartReady,
      setCrosshairPosition(price, time, seriesController) {
        if (!chartReady()) throw new Error("Chart resource is not ready or has been disposed");
        const entry = [...readers()].find(([, r]) => r.controller === seriesController);
        const reader = entry?.[1];
        if (!reader || !seriesController.ready())
          throw new Error("Crosshair target is not a live series owned by this chart");
        scope.withoutEvents(() =>
          api.setCrosshairPosition(
            price,
            time,
            seriesController.api as ISeriesApi<StandardSeriesType, Time>,
          ),
        );
        select(time, entry?.[0] ?? null);
      },
      clearCrosshairPosition() {
        if (!chartReady()) throw new Error("Chart resource is not ready or has been disposed");
        scope.withoutEvents(() => api.clearCrosshairPosition());
        select(null);
      },
      requestIndicatorVisibility(id, visible) {
        if (!chartReady()) throw new Error("Chart resource is not ready or has been disposed");
        const indicator = indicators.get(id);
        if (!indicator) throw new Error(`Unknown or removed indicator: ${id}`);
        indicator.request(visible);
      },
      get api() {
        if (!chartReady()) throw new Error("Chart resource is not ready or has been disposed");
        return api;
      },
      goToTime(time) {
        if (!chartReady()) throw new Error("Chart resource is not ready or has been disposed");
        const scale = api.timeScale();
        const range = scale.getVisibleLogicalRange();
        const index = scale.timeToIndex(time, true);
        if (!range || index === null || scale.width() <= 0)
          throw new Error("Chart navigation requires data and a visible native layout");
        const half = (range.to - range.from) / 2;
        coordinator.restore({ time, offset: half, span: half * 2, following: false });
      },
      goToLatest() {
        if (!chartReady()) throw new Error("Chart resource is not ready or has been disposed");
        const scale = api.timeScale();
        if (!scale.getVisibleLogicalRange() || scale.width() <= 0)
          throw new Error("Chart navigation requires data and a visible native layout");
        const view = coordinator.capture();
        if (view) coordinator.restore({ ...view, following: true });
      },
    };
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
        setController(managed);
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
      setIndicatorInteraction(undefined);
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
        style={
          typeof dom.style === "string"
            ? `position:relative;${dom.style}`
            : { position: "relative", ...dom.style }
        }
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
  const extensions: ExtensionOwner = new Set();
  const scope = required(useContext(ChartContext), "Pane");
  const marker = isServer ? undefined : document.createComment("Chart.Pane");
  const [controller, setController] = createSignal<PaneController>();
  const clearRef = bindRef(() => props.apiRef, controller);
  createEffect(() => {
    const id = props.id;
    let setLive: ((value: boolean) => void) | undefined;
    let managed: PaneController | undefined;
    let invalidated = false;
    const invalidate = () => {
      if (invalidated) return;
      invalidated = true;
      setLive?.(false);
      disposeExtensions(extensions);
      // An id change can create the replacement before removing this pane.
      // Never clear the replacement's ref/controller while releasing the old.
      if (untrack(controller) === managed) {
        clearRef();
        setController(undefined);
      }
    };
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
        invalidate();
        declaration.api = undefined;
        const chart = scope.api();
        if (chart) scope.withoutEvents(() => chart.removePane(api.paneIndex()));
      },
    };
    scope.panes.add(declaration);
    scope.schedule();
    onCleanup(() => {
      declaration.active = false;
      invalidate();
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
    <PaneContext.Provider value={{ controller, id: () => props.id, extensions }}>
      {marker}
      {props.children}
    </PaneContext.Provider>
  );
}

type ManagedNative<D, O> = SeriesHost & {
  getPane(): IPaneApi<Time>;
  moveToPane(index: number): void;
  seriesOrder(): number;
  setSeriesOrder(index: number): void;
  setData(rows: D[]): void;
  update(row: D, historical?: boolean): void;
  pop(count: number): D[];
  subscribeDataChanged(handler: DataChangedHandler): void;
  unsubscribeDataChanged(handler: DataChangedHandler): void;
  applyOptions(options: O): void;
};
function ManagedSeries<D extends { time: Time }, O, A extends ManagedNative<D, O>>(
  props: {
    id: string;
    pane?: string;
    children?: JSX.Element;
    options?: O;
    onDataChange?: DataChangedHandler;
  } & SeriesDataProps<A, D>,
  create: (
    chart: IChartApi,
    pane: IPaneApi<Time>,
  ) => { api: A; populated?: (row: D) => boolean; dispose?: () => void },
) {
  const scope = required(useContext(ChartContext), "Series");
  const extensions: ExtensionOwner = new Set();
  const paneScope = useContext(PaneContext);
  const marker = isServer ? undefined : document.createComment("Chart.Series");
  const owner = getOwner();
  const [controller, setController] = createSignal<
    SnapshotSeriesController<A> | IncrementalSeriesController<A, D>
  >();
  const clearRef = bindRef(
    () =>
      props.apiRef as
        | ApiRef<SnapshotSeriesController<A> | IncrementalSeriesController<A, D>>
        | undefined,
    controller,
  );
  const snapshot = props.data !== undefined;
  createEffect(() => {
    const id = props.id;
    let release = () => {};
    let invalidate = () => {};
    const declaration: SeriesDeclaration = {
      id,
      marker,
      active: true,
      target: "",
      create(chartApi, target) {
        createRoot((disposeRoot) => {
          const owned = untrack(() => create(chartApi, target));
          const api = owned.api;
          declaration.api = api;
          let active = true;
          const data = createManagedData({
            chart: chartApi,
            api,
            coordinator: required(untrack(scope.data), "Series data"),
            id,
            snapshot,
            populated: owned.populated,
            data: () => props.data,
            defaultData: () => props.defaultData,
            changed: () => props.onDataChange,
          });
          const managed = Object.assign(resource(api, data.ready), { hasData: data.hasData });
          setController(
            snapshot
              ? managed
              : Object.assign(managed, {
                  setData: data.setData,
                  update: data.update,
                  pop: data.pop,
                }),
          );
          scope.setReader(id, {
            controller: managed,
            options: () => {
              // Track native patch requests, then read retained native appearance.
              const patch = props.options;
              return {
                ...(api as unknown as ISeriesApi<StandardSeriesType, Time>).options(),
                ...patch,
              };
            },
          });
          createEffect(() => {
            const options = props.options;
            if (options) api.applyOptions(options);
          });
          invalidate = () => {
            if (!active) return;
            active = false;
            disposeRoot();
            data.dispose();
            scope.setReader(id, undefined);
            disposeExtensions(extensions);
            owned.dispose?.();
            if (untrack(controller) === managed) {
              clearRef();
              setController(undefined);
            }
          };
          release = () => {
            release = () => {};
            invalidate();
            declaration.api = undefined;
            scope.withoutEvents(() =>
              chartApi.removeSeries(api as unknown as ISeriesApi<StandardSeriesType, Time>),
            );
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
      // Managed handles/effects end with their owner. Native removal remains
      // deferred so retained sibling series can move before a pane is removed.
      invalidate();
      scope.schedule();
    });
  });
  return (
    <SeriesContext.Provider value={{ controller, extensions }}>
      {marker}
      {props.children}
    </SeriesContext.Provider>
  );
}

function StandardSeries<K extends StandardSeriesType>(
  props: StandardSeriesProps<K>,
  definition: SeriesDefinition<K>,
) {
  return ManagedSeries<
    SeriesDataItemTypeMap<Time>[K],
    SeriesPartialOptionsMap[K],
    ISeriesApi<K, Time>
  >(props, (chart, pane) => ({
    api: chart.addSeries(definition, props.options, pane.paneIndex()),
  }));
}
type CustomComponent = {
  <
    D extends CustomData<Time>,
    O extends CustomSeriesOptions,
    P extends SeriesPartialOptions<O> = SeriesPartialOptions<O>,
  >(
    props: Extract<CustomSeriesProps<D, O, P>, { data: readonly unknown[] }>,
  ): JSX.Element;
  <
    D extends CustomData<Time>,
    O extends CustomSeriesOptions,
    P extends SeriesPartialOptions<O> = SeriesPartialOptions<O>,
  >(
    props: Extract<CustomSeriesProps<D, O, P>, { data?: never }>,
  ): JSX.Element;
};
export const CustomSeries: CustomComponent = <
  D extends CustomData<Time>,
  O extends CustomSeriesOptions,
  P extends SeriesPartialOptions<O> = SeriesPartialOptions<O>,
>(
  props: CustomSeriesProps<D, O, P>,
) => {
  return ManagedSeries<D | WhitespaceData<Time>, P, CustomNativeApi<D, O, P>>(
    props,
    (chart, pane) => {
      const view = props.create();
      return {
        // Pinned pane.addCustomSeries incorrectly forwards pane index zero.
        api: chart.addCustomSeries<D, O, P>(view, props.options, pane.paneIndex()),
        populated: (row) => !view.isWhitespace(row),
        dispose: () => {
          // 5.2.1 removeSeries does not call the custom view's destroy hook.
          view.destroy?.();
          untrack(() => props.onDispose?.(view));
        },
      };
    },
  );
};

type StandardComponent<K extends StandardSeriesType> = {
  (props: Extract<StandardSeriesProps<K>, { data: readonly unknown[] }>): JSX.Element;
  (props: Extract<StandardSeriesProps<K>, { data?: never }>): JSX.Element;
};
export const CandlestickSeries: StandardComponent<"Candlestick"> = (
  props: CandlestickSeriesProps,
) => StandardSeries(props, NativeCandlestickSeries);
export const LineSeries: StandardComponent<"Line"> = (props: LineSeriesProps) =>
  StandardSeries(props, NativeLineSeries);
export const AreaSeries: StandardComponent<"Area"> = (props: AreaSeriesProps) =>
  StandardSeries(props, NativeAreaSeries);
export const BarSeries: StandardComponent<"Bar"> = (props: BarSeriesProps) =>
  StandardSeries(props, NativeBarSeries);
export const BaselineSeries: StandardComponent<"Baseline"> = (props: BaselineSeriesProps) =>
  StandardSeries(props, NativeBaselineSeries);
export const HistogramSeries: StandardComponent<"Histogram"> = (props: HistogramSeriesProps) =>
  StandardSeries(props, NativeHistogramSeries);

export type ExtensionController<A> = ResourceController<A>;
export type PrimitiveProps<A> = {
  create: () => A;
  apiRef?: ApiRef<ExtensionController<A>>;
  onDispose?: (instance: A) => void;
};
export type MarkersProps = {
  data: readonly SeriesMarker<Time>[];
  options?: DeepPartial<SeriesMarkersOptions>;
  apiRef?: ApiRef<ExtensionController<ISeriesMarkersPluginApi<Time>>>;
  onDispose?: (instance: ISeriesMarkersPluginApi<Time>) => void;
};
function OwnedExtension<H, A>(
  props: { apiRef?: ApiRef<ExtensionController<A>>; onDispose?: (instance: A) => void },
  host: { controller: Accessor<ResourceController<H> | undefined>; extensions: ExtensionOwner },
  attach: (api: H) => { instance: A; detach: () => void; update?: () => void },
) {
  const [controller, setController] = createSignal<ExtensionController<A>>();
  const clearRef = bindRef(() => props.apiRef, controller);
  const owner = getOwner();
  createEffect(() => {
    const parent = host.controller();
    if (!parent) return;
    const dispose = untrack(() =>
      createRoot((disposeRoot) => {
        const owned = attach(parent.api);
        const [live, setLive] = createSignal(true);
        const managed = resource(owned.instance, live);
        setController(managed);
        let active = true;
        const dispose = () => {
          if (!active) return;
          active = false;
          setLive(false);
          clearRef();
          setController(undefined);
          disposeRoot();
          host.extensions.delete(dispose);
          owned.detach();
          untrack(() => props.onDispose?.(owned.instance));
        };
        host.extensions.add(dispose);
        if (owned.update) createEffect(owned.update);
        // Register with the declaration owner as well as the native host. Both
        // paths share one guard; native detach is deliberately never repeated.
        return dispose;
      }, owner),
    );
    onCleanup(dispose);
  });
  return null;
}
export function SeriesPrimitive<A extends ISeriesPrimitive<Time>>(props: PrimitiveProps<A>) {
  const host = required(useContext(SeriesContext), "SeriesPrimitive");
  return OwnedExtension(props, host, (api) => {
    const instance = props.create();
    api.attachPrimitive(instance);
    return { instance, detach: () => api.detachPrimitive(instance) };
  });
}
export function PanePrimitive<A extends IPanePrimitive<Time>>(props: PrimitiveProps<A>) {
  const host = required(useContext(PaneContext), "PanePrimitive");
  return OwnedExtension(props, host, (api) => {
    const instance = props.create();
    api.attachPrimitive(instance);
    return { instance, detach: () => api.detachPrimitive(instance) };
  });
}
export function Markers(props: MarkersProps) {
  const host = required(useContext(SeriesContext), "Markers");
  return OwnedExtension(props, host, (api) => {
    const instance = createSeriesMarkers(
      api as ISeriesApi<StandardSeriesType, Time>,
      [],
      props.options,
    );
    return {
      instance,
      detach: () => instance.detach(),
      update: () => {
        instance.setMarkers(
          props.data.map((row) => ({
            ...row,
            time: typeof row.time === "object" ? { ...row.time } : row.time,
          })),
        );
        if (props.options) instance.applyOptions?.(props.options);
      },
    };
  });
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
