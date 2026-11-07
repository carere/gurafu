import { configureStore, createEvent, createSlice } from "@carere/solux";
import {
  type ChartOptions,
  createChart,
  type DataChangedHandler,
  type DeepPartial,
  type IChartApi,
  type IPaneApi,
  type ISeriesApi,
  type LogicalRangeChangeEventHandler,
  type MouseEventHandler,
  CandlestickSeries as NativeCandlestickSeries,
  type SeriesDataItemTypeMap,
  type SeriesPartialOptionsMap,
  type SizeChangeEventHandler,
  type Time,
  type TimeRangeChangeEventHandler,
} from "lightweight-charts";
import {
  type Accessor,
  createContext,
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  onMount,
  splitProps,
  untrack,
  useContext,
} from "solid-js";
import { createDataCoordinator, createManagedData, type DataCoordinator } from "./chart-data";

export type ApiRef<C> = (value: C | undefined) => void;
export interface ResourceController<A> {
  readonly api: A;
  readonly ready: Accessor<boolean>;
}
export interface SnapshotSeriesController<A> extends ResourceController<A> {
  readonly hasData: Accessor<boolean>;
}
export type CandlestickSnapshotController = SnapshotSeriesController<
  ISeriesApi<"Candlestick", Time>
>;
export interface IncrementalSeriesController<A, D> extends SnapshotSeriesController<A> {
  setData(data: readonly D[]): void;
  update(item: D, historicalUpdate?: boolean): void;
  pop(count: number): D[];
}
export type CandlestickIncrementalController = IncrementalSeriesController<
  ISeriesApi<"Candlestick", Time>,
  SeriesDataItemTypeMap<Time>["Candlestick"]
>;
export type CandlestickController =
  | CandlestickSnapshotController
  | CandlestickIncrementalController;
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
export type PaneController = ResourceController<IPaneApi<Time>>;
export interface ChartController extends ResourceController<IChartApi> {
  goToTime(time: Time): void;
  goToLatest(): void;
}
export type RootProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "onClick" | "onDblClick"> & {
  datasetKey?: string | number;
  onCrosshairMove?: MouseEventHandler<Time>;
  onClick?: MouseEventHandler<Time>;
  onDblClick?: MouseEventHandler<Time>;
  onVisibleTimeRangeChange?: TimeRangeChangeEventHandler<Time>;
  onVisibleLogicalRangeChange?: LogicalRangeChangeEventHandler;
  onSizeChange?: SizeChangeEventHandler;
  options?: DeepPartial<ChartOptions>;
  containerProps?: JSX.HTMLAttributes<HTMLDivElement>;
  apiRef?: ApiRef<ChartController>;
};
export type PaneProps = {
  id: string;
  children?: JSX.Element;
  apiRef?: ApiRef<PaneController>;
};
export type CandlestickSeriesProps = {
  onDataChange?: DataChangedHandler;
  id: string;
  options?: SeriesPartialOptionsMap["Candlestick"];
  children?: JSX.Element;
} & SeriesDataProps<ISeriesApi<"Candlestick", Time>, SeriesDataItemTypeMap<Time>["Candlestick"]>;

type ChartScope = {
  data: Accessor<DataCoordinator | undefined>;
  controller: Accessor<ChartController | undefined>;
  api: Accessor<IChartApi | undefined>;
  own: (dispose: () => void) => () => void;
  withoutEvents: (dispose: () => void) => void;
};
const ChartContext = createContext<ChartScope>();
type PaneScope = {
  controller: Accessor<PaneController | undefined>;
  own: (dispose: () => void) => () => void;
};
const PaneContext = createContext<PaneScope>();
const SeriesContext = createContext<Accessor<CandlestickController | undefined>>();
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
export function useSeries(): Accessor<CandlestickController | undefined> {
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
  const [controller, setController] = createSignal<ChartController>();
  const [nativeApi, setNativeApi] = createSignal<IChartApi>();
  const [data, setData] = createSignal<DataCoordinator>();
  const clearRef = bindRef(() => local.apiRef, controller);
  const owned = new Set<() => void>();
  let silencing = 0;
  const scope: ChartScope = {
    data,
    controller,
    api: nativeApi,
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
    // Assembly uses the private native handle. Expose public readiness only
    // after Solid has reconciled the declared panes and their initial snapshots.
    queueMicrotask(() => {
      if (active) setController(managed);
    });
    onCleanup(() => {
      active = false;
      setReady(false);
      clearRef();
      api.unsubscribeCrosshairMove(crosshair);
      api.unsubscribeClick(click);
      api.unsubscribeDblClick(dblClick);
      scale.unsubscribeVisibleTimeRangeChange(timeRange);
      scale.unsubscribeVisibleLogicalRangeChange(logicalRange);
      scale.unsubscribeSizeChange(size);
      store.dispose();
      for (const dispose of [...owned].reverse()) dispose();
      setController(undefined);
      setNativeApi(undefined);
      api.remove();
    });
  });
  createEffect(() => {
    const chart = nativeApi();
    const options = local.options;
    if (chart && options) chart.applyOptions(options);
  });
  return (
    <ChartContext.Provider value={scope}>
      <div {...dom}>
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
  const [controller, setController] = createSignal<PaneController>();
  const children = new Set<() => void>();
  const paneScope: PaneScope = {
    controller,
    own(dispose) {
      children.add(dispose);
      return () => children.delete(dispose);
    },
  };
  const clearRef = bindRef(() => props.apiRef, controller);
  createEffect(() => {
    const chartApi = scope.api();
    const id = props.id;
    if (!chartApi) return;
    // v5 starts with an empty native pane; the first declaration claims it.
    const api =
      chartApi.panes().find((pane) => pane.getSeries().length === 0 && !pane.preserveEmptyPane()) ??
      chartApi.addPane(true);
    api.setPreserveEmptyPane(true);
    const [ready, setReady] = createSignal(true);
    setController(resource(api, ready));
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      for (const disposeChild of [...children].reverse()) disposeChild();
      setReady(false);
      clearRef();
      setController(undefined);
      scope.withoutEvents(() => chartApi.removePane(api.paneIndex()));
    };
    const release = scope.own(dispose);
    onCleanup(() => {
      dispose();
      release();
    });
    void id;
  });
  return <PaneContext.Provider value={paneScope}>{props.children}</PaneContext.Provider>;
}

type CandlestickComponent = {
  (props: Extract<CandlestickSeriesProps, { data: readonly unknown[] }>): JSX.Element;
  (props: Extract<CandlestickSeriesProps, { data?: never }>): JSX.Element;
};
export const CandlestickSeries: CandlestickComponent = (props: CandlestickSeriesProps) => {
  const scope = required(useContext(ChartContext), "CandlestickSeries");
  const paneScope = required(useContext(PaneContext), "CandlestickSeries");
  const pane = paneScope.controller;
  const [controller, setController] = createSignal<CandlestickController>();
  const clearRef = bindRef(
    () => props.apiRef as ApiRef<CandlestickController> | undefined,
    controller,
  );
  const snapshot = props.data !== undefined;
  createEffect(() => {
    const chartApi = scope.api();
    const target = pane();
    const id = props.id;
    if (!chartApi || !target) return;
    const api = chartApi.addSeries(
      NativeCandlestickSeries,
      untrack(() => props.options),
      target.api.paneIndex(),
    );
    const data = createManagedData({
      chart: chartApi,
      api,
      coordinator: required(untrack(scope.data), "CandlestickSeries data"),
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
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      data.dispose();
      clearRef();
      setController(undefined);
      scope.withoutEvents(() => chartApi.removeSeries(api));
    };
    const release = scope.own(dispose);
    const releasePane = paneScope.own(dispose);
    onCleanup(() => {
      dispose();
      release();
      releasePane();
    });
    void id;
  });
  return <SeriesContext.Provider value={controller}>{props.children}</SeriesContext.Provider>;
};
