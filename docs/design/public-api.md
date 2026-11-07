# Gurafu public API design

Accepted interface examples from [Choose Gurafu’s public API through concrete usage sketches](https://github.com/carere/gurafu/issues/10#issuecomment-6697354760). That resolved ticket is the canonical decision record; these notes preserve the approved usage and type relationships for implementation and later wayfinding.

The full API below is the accepted target, not a list of currently shipped exports.
The `chart` item implements Root, explicit Pane, all six standard snapshot/incremental series,
pane movement/order, dataset generations, time navigation, native appearance presets,
scoped accessors and lifecycle-aware controller types; see the [README](../../README.md)
for installation and supported behavior. The optional `chart-indicators` item implements Bollinger Bands and SMA declarations,
pure calculations and visibility requests; see the README for defaults and options.
Other examples illustrate later slices of
[spec #17](https://github.com/carere/gurafu/issues/17), which resolves numerical,
website and acceptance decisions. Its SPA-first amendment supersedes the dedicated
SSR/hydration requirements preserved in these earlier design notes.

## Composition

```tsx
import * as Chart from "~/components/gurafu/chart";

<Chart.Root class="h-96" options={chartOptions()}>
  <Chart.Pane id="price">
    <Chart.CandlestickSeries id="candles" data={candles()} />
  </Chart.Pane>
  <Chart.Pane id="volume" stretchFactor={0.25}>
    <Chart.HistogramSeries id="volume" data={volume()} />
  </Chart.Pane>
</Chart.Root>;
```

Solid owns conditional mounting and reactive inputs. Pane and series `id` values are stable chart-local identities, independent of numeric positions. Typed standard-series components infer native data/options without a string discriminator. An explicit pane costs one nesting level but makes native-pane ownership visible.

A one-pane chart still declares its pane explicitly. Root-level series require an explicit `pane` target.

## Data inputs

### Snapshot

```tsx
<Chart.CandlestickSeries id="candles" data={displayedCandles()} />;
```

`data` is a reactive full snapshot. Replacing it replaces the displayed dataset. There is no second imperative data writer for this series. Changing a row in place without notifying Solid is not an input channel.

### Initial replacement followed by live updates

```tsx
const [candlesController, setCandlesController] = createSignal<CandlestickIncrementalController>();

createEffect(() => {
  const series = candlesController();
  if (!series?.ready()) return;
  const unsubscribe = feed.subscribe((bar) => series.update(bar));
  onCleanup(unsubscribe);
});

<Chart.CandlestickSeries id="candles" defaultData={history} apiRef={setCandlesController} />;
```

`defaultData` seeds an incremental series once per dataset context. Its controller exposes `setData`, `update` and `pop` with native meanings. History loading/replay seek calls `setData` on that same controller; live updates can then continue. Do not key/remount the series just to replace history. `data` and `defaultData` are mutually exclusive. Disposal clears the observed controller so the consumer-owned effect unsubscribes. This is usage notation, not executable implementation code.

The consumer retains its recoverable dataset and owns the feed subscription. No feed adapter, merging policy or replay scheduler is hidden here. Both paths use the same chart-side viewport and input-isolation contract.

A consumer-owned history-loading handler can replace history on that same incremental series:

```tsx
async function loadOlderHistory(range: LogicalRange | null) {
  if (!range || !applicationNeedsOlderData(range)) return;
  const requestedKey = dataset().key;
  const page = await applicationFetchOlderPage(requestedKey, range);
  if (requestedKey !== dataset().key) return; // Consumer rejects stale work.

  const target = candlesController();
  if (!target?.ready()) return;
  const merged = applicationMergePageWithCurrentHistoryAndLiveBar(page);
  applicationStore.replaceHistory(merged);
  target.setData(merged); // Same context: preserve the time anchor and zoom.
}
```

Bind this handler through Root `onVisibleLogicalRangeChange`. The application owns fetch deduplication, request identity/cancellation, chronological normalization, overlap merging and retention of live corrections. A loading/error UI changes presentation, not the supplied dataset. Live callbacks update the application's recoverable current-bar state and then call the same controller's `update`; they do not repeatedly replace full history.

Rejected alternative: make both modes use an initial `data` prop plus an explicit `dataMode="incremental"` marker. Avoid an implicit mode switch triggered by the first `update` call.

## Pane ownership, handles and dataset contexts

### Explicit panes and stable declarations

Keep `Chart.Pane` explicit, even for a single price pane. Require stable chart-local `id` values for panes and series. The native position is not an id. Ordinary nesting selects the containing pane; an explicit `pane` prop targets a declared pane by id when movement is needed.

```tsx
<Chart.Root class="h-96">
  <Chart.Pane id="price" />
  <Chart.Pane id="analysis" />
  <Chart.LineSeries id="signal" pane={targetPane()} data={values()} />
</Chart.Root>;
```

For dynamic movement, keep the series component mounted and change `pane`. Moving JSX between conditional branches can unmount/remount it and therefore create a new resource; an id does not revive an unmounted resource. Reorder mounted declarations with Solid's keyed `For` and stable item references. Changes to an `id` replace that logical declaration. All target panes belong to this chart instance. Normal chart-side commands do not expose a second declarative-layout writer.

The series targets a live declared pane. When removing the old pane, move retained series to another live pane first, as in the resolved lifecycle contract. Declaring a movable series at Root avoids tying its Solid owner to a pane that will unmount. A direct child series without `pane` has no implicit default pane under this contract.

### DOM refs, controller refs and context

```tsx
const [chart, setChart] = createSignal<ChartController>();
const [candles, setCandles] = createSignal<CandlestickIncrementalController>();

<Chart.Root ref={setContainer} apiRef={setChart} class="h-96">
  <Chart.Pane id="price">
    <Chart.CandlestickSeries id="candles" defaultData={history} apiRef={setCandles} />
  </Chart.Pane>
</Chart.Root>;
```

`ref` on Root is the ordinary Solid container DOM ref. `apiRef` is a callback receiving a live Gurafu controller and `undefined` on removal; controllers expose `.api` for the underlying native handle. On callback replacement, clear the old callback and supply the current controller to the new callback. Keep pointer/event callback replacement equally reactive without accumulating native subscriptions.

Chart-local commands live on the controller; native option/data/event types remain upstream-derived. Gurafu controllers guard premature/disposed operations and expose data writes only for incremental series. Native `.api` is the escape hatch with upstream preconditions; native writes to Gurafu-managed data/layout bypass the agreed model and are not another supported managed-data path. Reacquire native price-scale handles after moves.

Optional feature components use Gurafu-owned `useChart`, `usePane`, and `useSeries` context helpers. These return readiness accessors rather than pretending DOM mount implies a native handle is ready. A helper outside its required scope fails clearly. Context never exposes the private Solux store or shadows an application provider.

Native resources are created only after browser mounting. Ref availability does not promise data or layout coordinates. Cleanup clears lifecycle-aware refs before later consumer effects can use disposed resources. Actual SSR/import/hydration checks remain implementation acceptance work.

### Dataset contexts

```tsx
<Chart.Root datasetKey={dataset().key} class="h-96">
  <Chart.Pane id="price">
    <Chart.CandlestickSeries id="candles" data={dataset().candles} />
  </Chart.Pane>
</Chart.Root>;
```

Use an optional reactive `datasetKey: string | number` on Root, constant by default. A new key starts a new dataset generation without remounting compatible native resources. Invalidate Gurafu-owned pending work/selection for the old context, clear old managed data, supply the current snapshot and reset navigation by default. Matching inputs should be supplied together from consumer-owned state; stale response rejection remains external. The key is not a feed manager or a command token.

`defaultData` initializes an incremental series once per dataset generation, rather than once for the entire retained native lifetime. Subsequent same-generation `defaultData` changes are ignored; use `setData` for history replacement followed by `update` for live bars. An async context switch can supply an empty initial dataset and later `setData` after readiness. Keep chart/series native handles when compatible; controllers remain live for those retained resources. The consumer cancels or rejects stale external feed/request work; an old captured live handle is not proof that data belongs to the current context.

Same-key replacement/prepend preserves the agreed viewport anchor. A new key resets navigation/selection even if timestamps overlap with the prior symbol/timeframe. Empty data never inherits old bars. Replay seek generally keeps the same dataset key and supplies the intended revealed data. Changing native series type recreates that series, as previously agreed; changing a creation-only chart configuration can use an intentional keyed Root remount.

Chart reuse is a performance-oriented design choice, not a measured fastest-approach guarantee. The [source and performance fact check](https://github.com/carere/gurafu/issues/10#issuecomment-6697048733) records Ashiso’s behavior and the limits of the available evidence.

## Native options, events and optional indicators

### Native-derived options and events

```tsx
<Chart.Root
  datasetKey={dataset().key}
  options={chartOptions()}
  onCrosshairMove={handleCrosshairMove}
  onVisibleLogicalRangeChange={maybeLoadHistory}
>
  <Chart.Pane id="price">
    <Chart.CandlestickSeries id="candles" data={dataset().candles} options={candleOptions()} />
  </Chart.Pane>
</Chart.Root>;
```

`options` keeps upstream partial-option types and `applyOptions` patch semantics. A reactive change applies a patch; omitted properties are not a request to restore defaults. Use upstream `DeepPartial<ChartOptions>` for chart options and `SeriesPartialOptionsMap[T]`/`SeriesDataItemTypeMap<Time>[T]` relationships for standard series. Supply explicit values to reset a previously applied property. Live appearance/theme updates preserve native resources. Creation-only properties cannot pretend to be reactive patch options.

Root event props: `onCrosshairMove`, `onClick`, `onDblClick`, `onVisibleTimeRangeChange`, `onVisibleLogicalRangeChange`, `onSizeChange`; series `onDataChange` retains the native data-change callback type. Native mouse payloads retain `Time`, Maps and native series keys rather than inventing normalized payloads or placing raw handles in serializable Solux state. Keep callback replacement reactive and subscriptions owned. Ordinary container pointer/focus events retain DOM semantics on the dedicated chart container.

### Indicators as optional chart-local declarations

```tsx
import * as Indicators from "~/components/gurafu/indicators";

<Chart.Root datasetKey={dataset().key}>
  <Chart.Pane id="price">
    <Chart.CandlestickSeries id="candles" data={dataset().candles} />
    <Indicators.BollingerBands id="bb" source="candles" parameters={bbParameters()} />
    <Indicators.SMA id="sma" source="candles" parameters={smaParameters()} />
    <Indicators.EMA id="ema" source="candles" parameters={emaParameters()} />
  </Chart.Pane>
  <Chart.Pane id="rsi">
    <Indicators.RSI id="rsi" source="candles" parameters={rsiParameters()} />
  </Chart.Pane>
</Chart.Root>;
```

`source` identifies a chart-local price series, while nesting or `pane` selects the output pane. Calculated indicators consume only their source's supplied displayed data, including incremental replacements/updates and replay cutoff. Their parameters are typed per indicator; defaults/formulas/price-input rules are resolved in spec #17.

The same visual declaration accepts mutually exclusive precomputed `data` instead of `source`, following exact-time/missing-value rules:

```tsx
<Indicators.BollingerBands id="bb" data={suppliedBands()} />;
```

No competing calculation runs in supplied-data mode. Snapshot precomputed indicator data is sufficient for the first interface; consumers wanting native incremental drawing can instead compose standard series/primitives. Spec #17 specifies exported result-row types, formulas and defaults. Bollinger Bands and SMA are implemented; EMA and RSI remain later slices.

Indicator identity is chart-local and stable. `visible`, `defaultVisible`, and `onVisibleChange` follow conventional controlled/uncontrolled ownership. Hiding preserves the mounted indicator and its logical identity; removing its declaration disposes it. Volume remains `Chart.HistogramSeries` in an explicit native pane. This contract does not introduce an automatic indicator-owned pane in addition to explicitly declared panes.

## Legends, controls and extensions

### Ready-to-use legend and separate indicator selection

```tsx
<Chart.Root datasetKey={dataset().key} class="h-96">
  <Chart.Pane id="price">
    <Chart.CandlestickSeries id="candles" data={dataset().candles} />
    <Indicators.BollingerBands
      id="bb"
      source="candles"
      parameters={bbParameters()}
      visible={bbVisible()}
      onVisibleChange={setBbVisible}
    />
  </Chart.Pane>
  <ChartLegend
    priceSeries="candles"
    defaultExpanded={false}
    labels={legendLabels}
    formatValue={formatLegendValue}
  />
</Chart.Root>

<ChartIndicatorControls
  items={availableIndicators}
  value={enabledIndicators()}
  onValueChange={setEnabledIndicators}
/>
```

`ChartLegend` ships the agreed OHLC preview, initially collapsed indicator rows, enabled-indicator count and visibility requests for mounted chart-local indicators. It reads exact-time displayed values through Gurafu's chart scope. `expanded`/`defaultExpanded`/`onExpandedChange` allow controlled or private uncontrolled expansion. Indicator `visible`/`defaultVisible`/`onVisibleChange` remain the authoritative visibility interface; legend clicks request changes through that interface. Controlled input is not optimistically shadowed. Hiding preserves mounted logical identity; unmounting removes it.

the default count is visible logical indicators (Bollinger Bands counts once, not once per rendered line). Hidden mounted indicators keep their toggle rows; unmounted indicators leave the list. Optional `volumeSeries="volume"` adds an exact-time volume value beside OHLC without assuming every histogram is volume. Volume stays a standard series; this read-only value is excluded from the logical-indicator count, and its mounting/visibility remains consumer-controlled. Consumers can customize the displayed count/content through the read model and render callbacks.

Expose labels, formatting and `renderOHLC`/`renderIndicator` render callbacks, plus `useLegend({ priceSeries: "candles" })` returning a read-only accessor for custom presentation. Custom controls still issue visibility requests through the chart-owned interface rather than editing private Solux slices. Keep native handles out of serializable legend state.

`ChartIndicatorControls` is a reusable selection widget, with `items: readonly { value: string; label: string; disabled?: boolean }[]`, controlled `value` or uncontrolled `defaultValue`, and `onValueChange`. Its values name consumer choices. The consumer declares/mounts corresponding indicators with Solid; the widget does not automatically create series or infer source/parameter configuration. Standalone selection UI can live outside the chart. Mounted indicator visibility and selected-to-mount indicator choices are distinct.

Root owns an outer container and a dedicated inner native chart container. Render legend/other HTML UI as siblings of the native surface, with explicit classes/slots for positioning, rather than inside native-managed canvas DOM. Root `ref` refers to the outer DOM element. Optional `containerProps` passes ordinary DOM props/ref to the inner chart container, needed for pointer-focus coordination that excludes legend/control interactions. Nonvisual declarations render no DOM. JSX nesting alone does not position an overlay; the default legend composition supplies usable placement with class/render customization.

### Consumer-driven replay and date controls

```tsx
<ChartReplayControls
  playing={replay().playing}
  speed={replay().speed}
  speeds={availableSpeeds}
  onPlayingChange={requestPlaying}
  onSpeedChange={requestSpeed}
  onStep={stepForward}
  onExit={returnToLive}
/>

<ChartDateControls
  value={selectedDate()}
  minDate={firstAvailableDate()}
  maxDate={lastAvailableDate()}
  onValueChange={requestDate}
  onGoToLatest={requestLatest}
/>
```

replay controls take required consumer-controlled `playing: boolean` and `speed: number`; explicit `speeds` configures choices. They emit play/pause, speed, forward-step and exit requests. `disabled` and `canStep` reflect consumer readiness/end-of-data. They never own a timer or mutate displayed data. Seeking/clock/cutoff and live restoration stay consumer-owned.

Date controls use `Date` values and `minDate`/`maxDate`, with UTC calendar-day semantics. Calendar selection emits UTC midnight of the chosen day; they do not infer trading sessions or missing-history policy. Supply labels and formatting hooks for consumer localization. The application converts the selected date to native `Time` (for example UTC timestamp seconds) and loads/selects appropriate history. Replay/date controls can be outside Root; they do not require a chart scope.

Public chart-controller commands: `goToTime(time: Time)`, `goToLatest()`, `setCrosshairPosition(price: number, time: Time, series: SeriesController)`, and `clearCrosshairPosition()`. Native `.api.timeScale()` remains available for advanced reads/native navigation. `goToTime` follows the agreed centering/current-zoom behavior; commands require the matching live chart/data/layout and do not queue across generations.

For date navigation, the consumer's handler supplies matching loaded data, waits for its reconciliation/readiness, then calls `goToTime`. In replay, the consumer supplies coherent candle/volume/analysis replacements for backward seeks and return-to-live; forward progression may use incremental updates. Gurafu-calculated indicators use displayed source data; supplied analysis obeys the same application cutoff. Merely changing a `playing` or replay-mode value never reveals/restores hidden data.

A concrete snapshot integration keeps the Root and dataset context stable while the application changes revealed data:

```tsx
const [display, setDisplay] = createSignal(applicationInitialDisplay());

function seekReplay(position: Time) {
  // Application policy supplies only revealed bars, partial higher-timeframe
  // candles and analysis computed without future data.
  setDisplay(applicationBuildReplayDisplay(position));
}

function returnToLive() {
  setDisplay(applicationBuildCurrentLiveDisplay());
}

<Chart.Root datasetKey={dataset().key}>
  <Chart.Pane id="price">
    <Chart.CandlestickSeries id="candles" data={display().candles} />
    <Indicators.BollingerBands id="bb" source="candles" parameters={bbParameters()} />
  </Chart.Pane>
  <Chart.Pane id="volume">
    <Chart.HistogramSeries id="volume" data={display().volume} />
  </Chart.Pane>
</Chart.Root>;
```

The illustrative `application*` functions belong to the consumer, not Gurafu. Preparing one display snapshot keeps related supplied inputs coherent without promising a native multi-series transaction. Precomputed indicator `data` can be part of that same snapshot instead of a calculated `source` declaration. The application owns replay controls, timing and late-response guards; incremental consumers use `setData` for rewind/live restoration and can resume `update` afterwards.

### Owned custom series, primitives and markers

```tsx
<Chart.CustomSeries
  id="profile"
  pane="analysis"
  create={() => new ProfileSeriesView()}
  data={profileRows()}
  options={profileOptions()}
  onDispose={releaseProfileResources}
/>

<Chart.CandlestickSeries id="candles" data={candles()}>
  <Chart.SeriesPrimitive
    create={() => new AnnotationPrimitive()}
    onDispose={releaseAnnotationResources}
  />
  <Chart.Markers data={markers()} options={markerOptions()} />
</Chart.CandlestickSeries>

<Chart.Pane id="analysis">
  <Chart.PanePrimitive create={() => new WatermarkPrimitive()} />
</Chart.Pane>
```

extension `create` is construction-only and invoked once per owned native-resource lifetime. Each mounted declaration gets a distinct instance; never share an attached primitive/view between mounts. Intentional recreation uses Solid ownership. Props such as marker data/options update the existing owned plugin. Optional `apiRef` exposes the lifecycle-aware extension controller and `.api` instance for consumer-specific updates, with consumer effects owning their subscriptions.

Gurafu detaches/removes what it owns and handles native lifecycle cleanup exactly once according to the pinned contract. `onDispose(instance)` is for additional consumer resource cleanup and does not independently call native detach/destroy hooks already owned by Gurafu. Do not rely on upstream destruction to invoke every cleanup hook at 5.2.1. Series/pane movement preserves compatible owned series extensions; removed/recreated parents invalidate handles. Pane primitives remain owned by the target pane, not attached once per contained series. Use chart-level `addCustomSeries` with the resolved current pane index and remove series/extensions before removing a populated pane.

Custom-series public type relationships preserve upstream inference:

```ts
type CustomSeriesProps<
  D extends CustomData<Time>,
  O extends CustomSeriesOptions,
  P extends SeriesPartialOptions<O> = SeriesPartialOptions<O>,
> = {
  id: string;
  pane?: string;
  create: () => ICustomSeriesPaneView<Time, D, O>;
  options?: P;
  // data/defaultData are mutually exclusive as for standard series.
  // Their row type is D | WhitespaceData<Time>.
  // apiRef retains the corresponding snapshot/incremental controller.
};

type CustomNativeApi<
  D extends CustomData<Time>,
  O extends CustomSeriesOptions,
  P extends SeriesPartialOptions<O> = SeriesPartialOptions<O>,
> = ISeriesApi<"Custom", Time, D | WhitespaceData<Time>, O, P>;
```

Keep D/O/P through create/data/options/handle relationships; do not erase custom fields to a base CustomData/CustomSeriesOptions type. Ordinary chart time is upstream `Time`; a fully custom horizontal-scale behavior is not silently promised by this design. Consumer import/render/type checks must exercise custom data fields, custom option fields and nonzero native panes.

## Readiness, consumer coordination and distribution

### Controller surface and context

Keep the managed controller small:

```ts
type ApiRef<C> = (value: C | undefined) => void;

interface ResourceController<A> {
  readonly api: A;
  readonly ready: Accessor<boolean>;
}

interface SnapshotSeriesController<A> extends ResourceController<A> {
  readonly hasData: Accessor<boolean>;
}

interface IncrementalSeriesController<A, D> extends SnapshotSeriesController<A> {
  setData(data: readonly D[]): void;
  update(item: D, historicalUpdate?: boolean): void;
  pop(count: number): D[];
}

interface ChartController extends ResourceController<IChartApi> {
  goToTime(time: Time): void;
  goToLatest(): void;
  setCrosshairPosition(
    price: number,
    time: Time,
    series: SnapshotSeriesController<NativeSeriesApi>,
  ): void;
  clearCrosshairPosition(): void;
  requestIndicatorVisibility(id: string, visible: boolean): void;
}
```

`NativeSeriesApi` above is notation for the relevant retained upstream series type, including custom generics; it is not a request to erase those generic parameters. Standard public aliases such as `CandlestickSnapshotController` and `CandlestickIncrementalController` retain `ISeriesApi<"Candlestick", Time>` and its matching data row type. `CandlestickController` may be the corresponding union when a consumer genuinely accepts either path. Preserve the same pattern for Line, Area, Bar, Baseline, Histogram and Custom.

The `data`/`defaultData` prop union contextually types `apiRef` as snapshot or incremental. An omitted `data` selects an empty incremental series unless `defaultData` seeds it; supplied snapshot `data` must be an array, using `[]` for empty/loading. Keep the selected data mode stable for the mounted declaration; intentional mode changes recreate that declaration. Expose no competing imperative data methods on the managed snapshot controller. Raw `.api` remains an escape hatch whose direct managed-data/layout mutations are outside the reconciliation contract.

`ready()` means the resource exists and its current desired model/data generation is reconciled. It can become false during a context change and stays false after disposal. It is not a promise of visible layout or non-null coordinates. `hasData()` reports whether that series currently has displayed populated data, not whether the application has a recoverable archive. Query the native visible range/coordinates when needed and handle null. `apiRef` becomes undefined on native removal, not merely because native layout is temporarily unavailable; retained resources keep their controller/native identity across compatible dataset switches. Managed commands fail clearly when not ready/disposed. An external stale callback still belongs to its application owner.

`useChart()` returns `Accessor<ChartController | undefined>`; `usePane()` returns a similarly readiness-aware pane-controller accessor; `useSeries()` returns the nearest series accessor. Hooks capture the scoped accessor during setup, never unwrap a transient handle as an enduring global. Pane/series controls do not expose layout mutations that compete with `pane`/declaration order; use the props. Pane controllers retain native `IPaneApi<Time>` through `.api`, observing current position and layout readiness. An optional `apiRef` is supported on Pane as on owned extensions.

`useLegend({ priceSeries })` exposes a read-only public model accessor; custom controls call `chart.requestIndicatorVisibility(id, visible)`. It emits the mounted indicator's controlled change request or applies its private uncontrolled state. Unknown/removed indicator ids fail clearly; it cannot provision an unmounted indicator. No private Solux dispatch/state/schema is public.

### Consumer-owned crosshair time broadcast

This coordination example intentionally uses timestamp-second datasets in every chart. It does not introduce business-day conversion, bucketing, nearest-bar lookup or target-price derivation.

```tsx
const [sharedTime, setSharedTime] = createSignal<{
  sender: string;
  time: UTCTimestamp;
}>();

function TimeframeChart(props: {
  chartId: string;
  dataset: { key: string; candles: readonly CandlestickData[] };
}) {
  const [chart, setChart] = createSignal<ChartController>();
  const [candles, setCandles] = createSignal<CandlestickSnapshotController>();
  const [focused, setFocused] = createSignal(false);

  const broadcast: MouseEventHandler<Time> = (event) => {
    if (!focused() || typeof event.time !== "number") return;
    const previous = untrack(sharedTime);
    if (!previous || previous.time !== event.time) {
      setSharedTime({ sender: props.chartId, time: event.time });
    }
  };

  createEffect(() => {
    const shared = sharedTime();
    const owner = chart();
    const target = candles();
    if (!shared || shared.sender === props.chartId) return;
    if (!owner?.ready() || !target?.ready() || !target.hasData()) return;

    const range = owner.api.timeScale().getVisibleRange();
    if (
      range &&
      typeof range.from === "number" &&
      typeof range.to === "number" &&
      shared.time >= range.from &&
      shared.time <= range.to
    ) {
      owner.setCrosshairPosition(0, shared.time, target);
    } else {
      owner.clearCrosshairPosition();
    }
  });

  return (
    <Chart.Root
      datasetKey={props.dataset.key}
      apiRef={setChart}
      onCrosshairMove={broadcast}
      containerProps={{
        onPointerEnter: () => setFocused(true),
        onPointerLeave: () => setFocused(false),
      }}
    >
      <Chart.Pane id="price">
        <Chart.CandlestickSeries id="candles" data={props.dataset.candles} apiRef={setCandles} />
      </Chart.Pane>
    </Chart.Root>
  );
}
```

One parent-owned signal is passed/closed over by one to four independent chart instances. Each has a stable consumer sender identity and its own dataset key/resources/private chart store. The parent clears shared time on symbol/assignment changes as appropriate. Native programmatic positioning does not become another user-pointer intent; retain focus/sender/equality guards. Source leave updates local pointer focus and native local legend state; it does not broadcast a clear. Missing timestamps retain native positioning limitations. Cleanup of each chart remains independent; neither chart subscribes to another chart's private store. Runtime verification of the exact cross-timeframe visual result remains in the website acceptance ticket.

### Registry items and imports

Separately installable items:

- `chart`: Root, Pane, six typed standard-series components, CustomSeries, owned primitives/Markers, controller/context/types and light/dark chart-option presets. Includes the private state core and explicit runtime dependencies; no optional control UI dependencies.
- `chart-indicators`: optional visual declarations plus exported pure calculation functions (`calculateBollingerBands`, `calculateSMA`, `calculateEMA`, `calculateRSI`) and their parameter/result types. Depends on `chart` and its shared source helpers. Formula/default/result-row details are resolved in spec #17. The current optional item implements Bollinger Bands and SMA only.
- `chart-legend`: the ready-to-use legend, public read model helper and customization hooks.
- `chart-indicator-controls`, `chart-replay-controls`, `chart-date-controls`: independently optional ready-to-use UI widgets.

Registry item names identify installation; they need not all become one module filename. These examples use installed local imports under `~/components/gurafu/`; actual installation resolves the consumer's configured aliases. Item dependencies install shared helpers and required Zaidan UI sources only where used. No `@gurafu/*` namespace/hosted endpoint is claimed to exist yet; registering/publishing the catalog is implementation work. No giant mandatory barrel import should drag website/framework/control modules into a basic chart.

Retain the pinned Lightweight Charts 5.2.1. Adopt only the verified newly published/pinned Solux v4 release required by the state-ownership resolution; its version remains a release prerequisite, not an invented number. Core registry dependencies include whatever runtime/transitive declaration packages the verified release actually requires. Consumers need not write Solux/RxJS application code or provide a global store.

Per-chart debugging uses `devtools={false | { name: string }}`, disabled by default. Explicit names label the existing Redux DevTools integration, and an automatic unique identity prevents same-name chart connections colliding. Use supported browser-only initialization and disposal. Application-controlled state remains in the application; no automatic shared timeline or deterministic effect/data replay is promised.

### Theme and DOM interface

```tsx
<Chart.Root
  ref={setOuterElement}
  class="relative h-96"
  options={dark() ? darkChartOptions : lightChartOptions}
  devtools={development() ? { name: "Ashiso / 1h" } : false}
  containerProps={{ class: "h-full w-full" }}
>
  {/* Explicit panes, series, optional indicator declarations and legend. */}
</Chart.Root>;
```

Use the same complete chart and series appearance option types that TradingView provides. Add no theme schema, restricted color interface, theme manager or theme-state prop. `lightChartOptions`/`darkChartOptions`, if supplied, are optional plain native-option objects for convenience. Consumer theme choice/system detection/persistence stays external. Presets provide explicit values for appearance fields they own, so switching themes does not depend on omitted partial options restoring defaults. Indicator visual `options`, legend labels/formatting/render callbacks, widget labels/classes and Zaidan tokens remain configurable. Numerical/visual indicator defaults belong to the numerical-compatibility ticket.

Root owns the stable outer container and inner native surface described above. `class`/ordinary Root DOM props style the outer shell; `containerProps` styles/observes the inner chart surface. Consumer dimensions and native autosizing govern layout. Empty/loading/error presentation can be ordinary child HTML; loading/error inputs do not implicitly fetch or substitute datasets. Optional UI uses keyboard-accessible Zaidan/Kobalte conventions, explicit labels and formatting/localization hooks; no new visual world is being designed in this API decision.

### Server import, rendering and hydration

- Server import may evaluate types/component definitions/pure helpers but must not create browser chart resources, global live model graphs or DevTools connections.
- Server rendering produces stable outer/inner shells and appropriate ordinary optional UI, with fresh isolated per-request model state. It does not serialize native handles/canvases.
- Hydration reuses the shell. Create native chart resources after browser mount, reconcile desired declarations/data and expose controllers at their actual readiness stage. Zero-size/hidden surfaces still have native layout limitations.
- Implementation must verify framework compatibility on installed source in both the current Solid/TanStack consumer and a clean non-TanStack Solid SSR consumer. No route imports, server-only code, hosted data dependencies, or global application provider are required by distributed source.
- Browser behavior, cleanup, declarations with `skipLibCheck: false`, fresh-store/request isolation, runtime dependency installation, Solux published-version guarantees and negative custom-type examples remain implementation acceptance work. These design notes do not establish browser, production or clean-consumer compile verification.

## Remaining specification and verification

- [Define indicator numerical and visual compatibility with Ashiso](https://github.com/carere/gurafu/issues/12) owns numerical/visual defaults, parameter fields and result-row definitions.
- [Specify website examples and implementation acceptance criteria](https://github.com/carere/gurafu/issues/11) owns exact website examples and executable acceptance coverage.

These notes document the accepted interface. They do not implement the chart or establish benchmark, browser or clean-consumer typecheck results. The implementation must verify the signatures, lifecycle behavior and installed-source compatibility described above before claiming those guarantees.
