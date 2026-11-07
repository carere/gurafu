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
  goToTime(time: Time): void;
  goToLatest(): void;
  requestIndicatorVisibility(id: string, visible: boolean): void;
}
export type RootProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "onClick" | "onDblClick"> & {
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

type IndicatorInteraction = {
  visibility: Accessor<Readonly<Record<string, boolean>>>;
  set(id: string, visible: boolean | undefined): void;
};
type ChartScope = {
  indicatorInteraction: Accessor<IndicatorInteraction | undefined>;
  indicators: Map<string, { request(visible: boolean): void }>;
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
const SeriesContext = createContext<Accessor<StandardController<StandardSeriesType> | undefined>>();
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
export function useSeries(): Accessor<StandardController<StandardSeriesType> | undefined> {
  return required(useContext(SeriesContext), "useSeries");
}

// Internal optional-item bridge, carrying no native handles or private store.
// Optional declarations only observe managed display and visibility.
/** @internal Shared with the optional registry item; not a consumer state API. */
export function useIndicatorHost() {
  const scope = required(useContext(ChartContext), "Indicator");
  return {
    displayed: (id: string) => scope.data()?.sources().get(id)?.displayed() ?? [],
    interaction: scope.indicatorInteraction,
    register(id: string, request: (visible: boolean) => void) {
      if (scope.indicators.has(id)) throw new Error(`Duplicate chart-local indicator id: ${id}`);
      const entry = { request };
      scope.indicators.set(id, entry);
      return () => {
        if (scope.indicators.get(id) === entry) scope.indicators.delete(id);
      };
    },
  };
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
  const indicators = new Map<string, { request(visible: boolean): void }>();
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
    const selectTime = createEvent<Time | null>("chart/pointerTime");
    const indicatorVisibility = createEvent<{ id: string; visible: boolean | undefined }>(
      "chart/indicatorVisibility",
    );
    const store = configureStore({
      rootSlice: createSlice({
        initialState: {
          pointer: { time: null as Time | null },
          indicatorVisibility: {} as Record<string, boolean>,
        },
        handlers: (builder) =>
          builder
            .addHandler(selectTime, (state, event) => {
              state.pointer.time = event.payload;
            })
            .addHandler(indicatorVisibility, (state, event) => {
              const { id, visible } = event.payload;
              if (visible === undefined) delete state.indicatorVisibility[id];
              else state.indicatorVisibility[id] = visible;
            }),
      }),
    });
    setIndicatorInteraction({
      visibility: () => store.state.indicatorVisibility,
      set: (id, visible) => {
        store.dispatch(indicatorVisibility({ id, visible }));
      },
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
    const coordinator = createDataCoordinator(
      api,
      () => local.datasetKey ?? "default",
      () => {
        store.dispatch(selectTime(null));
      },
    );
    setData(coordinator);
    const chartReady = () => ready() && coordinator.ready();
    const managed: ChartController = {
      ready: chartReady,
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
    const invalidate = () => {
      setLive?.(false);
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
  const [controller, setController] = createSignal<StandardController<K>>();
  const clearRef = bindRef(
    () => props.apiRef as ApiRef<StandardController<K>> | undefined,
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
          const api = chartApi.addSeries(
            definition,
            untrack(() => props.options),
            target.paneIndex(),
          );
          declaration.api = api;
          let active = true;
          const data = createManagedData({
            chart: chartApi,
            api,
            coordinator: required(untrack(scope.data), "StandardSeries data"),
            id,
            snapshot,
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
          createEffect(() => {
            const options = props.options;
            if (options) api.applyOptions(options);
          });
          invalidate = () => {
            if (!active) return;
            active = false;
            disposeRoot();
            data.dispose();
            if (untrack(controller) === managed) {
              clearRef();
              setController(undefined);
            }
          };
          release = () => {
            release = () => {};
            invalidate();
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
      // Managed handles/effects end with their owner. Native removal remains
      // deferred so retained sibling series can move before a pane is removed.
      invalidate();
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
