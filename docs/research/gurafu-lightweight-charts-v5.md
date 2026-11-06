# Lightweight Charts 5.2.1: pane, data, extension, and lifecycle constraints

Research for [Establish Lightweight Charts v5 pane, data, and lifecycle constraints](https://github.com/carere/gurafu/issues/5), under [Map the Gurafu component API and Ashiso-to-v5 specification](https://github.com/carere/gurafu/issues/3). Researched 2026-11-06. This is evidence for later specification decisions; it does not select Gurafu's API, state library, feature ownership, or implementation.

## Baseline and evidence boundary

- Gurafu baseline: `39fe95bf`, whose package and lockfile pin `lightweight-charts` to **5.2.1**, Solid to **1.9.18**, and the Solid source-registry foundation. [Gurafu package][gurafu-package], [lockfile][gurafu-lock], [README][gurafu-readme].
- Upstream release: annotated tag `v5.2.1`, tag object `bf4bdc64e1ac5d6dc8a1c01e1340cc1cb25ca695`, resolves to commit **`b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1`**. Unless explicitly marked otherwise, source links below pin that commit. [Tag resolution][tag].
- Independently inspected the published npm tarball and `dist/typings.d.ts`. npm `gitHead` is the same commit; SHA-512 matches both npm metadata and Gurafu's lockfile: `sha512-IVwoK1RLFiLPubaKIjNbtjWLnpPMqiABSrTay6whmNa8L1+19292VtHJ+BWyPUuLCwF0tcQlhEWd1CLB2a1nsQ==`. Source findings below were also checked against the published development standalone bundle. [npm metadata][npm], [tarball][tarball], [lockfile][gurafu-lock].
- Migration comparison: v4.2.1 source at **`6902233ee34e2f2f697f713d4b7f1d8b4656faae`**. Ashiso's inspected checkout is **`1b716f85bea71a703330cdae74b83f82732812a9`**; its manifest requests `^4.2.1`, which is a range, not proof of its installed version. [v4 series API][v4-series], [Ashiso manifest][ashiso-package].
- Official live docs identify themselves as **5.2**, not a patch-specific snapshot. Prefer the pinned source/types for exact signatures. Even pinned release notes say `hoveredItem`/`hoveredTarget`, while the shipped interface actually has `hoveredInfo` and deprecated `hoveredSeries`/`hoveredObjectId`. This is a documentation discrepancy, not evidence those release-note field names work in 5.2.1. [Live docs][live-notes], [pinned notes][notes], [mouse event interface][chart-api-type].
- Later upstream was sampled at **`d9878ed0a60c5f145d87e2e040358bc58084b8f8`**. The pane custom-series forwarding, series destruction, historical-update checks/helper, and pane-removal model method discussed below still have the same relevant behavior in that sampled source. This is a targeted comparison, not certification of all later upstream or preview packages. No later upstream feature is assumed available in Gurafu. [Later pane API][later-pane], [later series][later-series], [later data layer][later-data], [later chart model][later-model].

Method: GitHub connector fetched upstream source read-only; official documentation was read without browser UI; npm archive was downloaded to temporary storage without installing dependencies. Local Ashiso source was read only. Existing repository guidance was read before exploration. The only repository deliverable is this Markdown file.

## Findings that most affect the later specification

1. **A native pane is part of one chart instance.** Its series share that chart's time scale/data timeline; pane order and series order are mutable positions. API handles preserve underlying object identity while it remains attached, but numerical pane indexes are not durable identities. [Chart API implementation][chart-api], [pane API implementation][pane-api], [chart model][model], [data layer][data].
2. **Historical correction is not history insertion.** `update(item, true)` supports an already existing series bar. The implementation's initial existence check is chart-wide; using a timestamp belonging only to another series can overwrite the target's following row. Older unseen history needs consumer assembly plus `setData`. [Series contract][series-type], [data layer][data], [history example][history].
3. **Lifecycle ownership needs explicit specification.** `removeSeries` and `remove` are terminal; they do not promise disposal of consumer effects, feeds, DOM listeners, timers, or every extension hook. In particular, the pinned series destruction path does not call attached primitives' `detached()` or a custom view's advertised `destroy()`. [Chart contract][chart-api-type], [series API][series-api], [series destruction][series-model], [custom-series contract][custom].
4. **Some convenience APIs need verification or a documented workaround at this pin.** `pane.addCustomSeries(view, options)` forwards index 0 rather than the receiving pane's index. `removePane` does not use the series-removal/data-layer cleanup path. These are source findings, not reasons to silently change the dependency or make product decisions. [Pane implementation][pane-api], [chart API][chart-api], [chart model][model].

## Native panes: identity, order, sizing, and removal

| Concern | Facts at 5.2.1 | Specification consequence to discuss |
| --- | --- | --- |
| Creation | Chart starts with a pane unless created with `addDefaultPane: false`. `chart.addPane(preserveEmptyPane?)` defaults to `false`. `addSeries(definition, options?, paneIndex?)` defaults to index 0. Asking for an index beyond the current count appends one pane: `_getOrCreatePane` clamps to `panes.length`, rather than filling all intermediate indexes. [Defaults][chart-defaults], [chart API][chart-api], [model][model]. | Define readiness and empty-container behavior; do not imply that index 9 creates ten panes. |
| Handle identity | `chart.panes()` returns an array whose handles are cached in a `WeakMap` keyed by internal Pane. `pane.paneIndex()` looks up that Pane's current position. `series.getPane()` obtains the same mapped handle. After removal, the retained pane's lookup can return `-1`; the interface advertises only attached-pane indexes. [Chart API][chart-api], [pane API][pane-api], [series API][series-api]. | An application key and a current pane index serve different purposes. A removed handle must not be treated as live. |
| Pane order | `pane.moveTo(index)` moves within the existing range; `chart.swapPanes(a, b)` swaps. Other panes' indexes change. `moveTo` validates against pane-widget count, which can lag model changes before the next GUI update. [Pane API][pane-api], [model][model], [widget rendering][widget]. | Test immediate reorder after creation; do not assume every operation is safe before layout catches up. |
| Series movement | `series.moveToPane(index)` moves the existing Series object, retaining its data/API identity. A high target index appends one pane. The target is chosen before an empty source pane is removed, so its final index can shift. Source preservation can prevent that removal. [Series API][series-api], [model][model]. | Re-read `series.getPane().paneIndex()` after movement rather than remembering the requested index. |
| Series order | `seriesOrder()` / `setSeriesOrder(number)` order series within a pane; requested order is clamped. Removing or moving series can change indexes. The lowest-index series can determine price-scale formatting. `hoveredSeriesOnTop` defaults to true, so hover can temporarily change visual stacking. [Series contract][series-type], [pane model][pane-model], [chart defaults][chart-defaults]. | Pane position, series order, and hover stacking are separate concerns. |
| Empty pane | Removing/moving the last **data source** removes the pane only if it is not preserved and another pane remains. A series with `setData([])` still exists as a data source, so clearing data does not itself remove its pane. Pane primitives live in a separate collection and do not satisfy the data-source count. `setPreserveEmptyPane` only changes a flag; it does not immediately run empty-pane cleanup. [Model][model], [pane model][pane-model], [data layer][data]. | Clarify whether empty means no series or no bars, and whether a decorative pane must be preserved. |
| Explicit removal | `chart.removePane(index)` is a no-op when exactly one pane remains. For multiple panes, the model method splices its pane array and requests a full update; it does not call `removeSeries`, clean the DataLayer, or delete chart series maps. GUI synchronization destroys excess pane widgets separately. [Chart API][chart-api], [model][model], [widget][widget], [pane widget][pane-widget]. | Do not assume removing a populated pane equals removing each of its series. Full public/browser behavior needs a focused verification before promising such a contract. |
| Height | `getHeight()` reports current layout height. `setHeight(px)` changes relative stretch factors across panes; it is a no-op with fewer than two panes, and the requested height is constrained by space for other panes and `MIN_PANE_HEIGHT = 30`. Pixel allocations are subsequently rounded for device pixel ratio. [Pane API][pane-api], [model][model], [pane constants][pane-model], [widget][widget]. | A requested pixel height is not an immutable height independent of container size. |
| Relative size | `getStretchFactor` / `setStretchFactor` control proportions; initial factor is 1. Layout uses `factor * availableHeight / totalFactors`, reserving time-axis/separator space. The type comment's “2000” and reversed “50 times smaller” examples contradict this calculation; use the source formula. There is no positive/finite guard in `setStretchFactor`. [Pane contract][pane-type], [pane model][pane-model], [widget][widget]. | Verify factors 2:1:1; define treatment of zero/negative/NaN inputs if surfaced. |
| DOM and interaction | `getHTMLElement(): HTMLElement | null` can return null before a widget exists. `layout.panes` offers `enableResize`, `separatorColor`, `separatorHoverColor`. [Pane contract][pane-type], [pane implementation][pane-api], [layout types][layout]. | DOM availability follows client layout; resizing policy and persistence remain choices. |

Price-scale IDs are scoped to a pane: `chart.priceScale(id, paneIndex?)`, `pane.priceScale(id)`, and `series.priceScale()` are available. A returned PriceScaleApi stores a numeric pane index and scale ID; it does not follow a series to another pane/scale. Reacquiring after reorder/removal is also prudent because the stored numerical position can now refer to another pane. `setVisibleRange` on a price scale disables autoscale; `getVisibleRange` can be null; `setAutoScale` is public. [Series contract][series-type], [price-scale implementation][price-api].

**Confirmed forwarding mismatch:** the public `IPaneApi.addCustomSeries` has only `(view, options?)`, but the class implementation has a third parameter defaulting to 0 and forwards it to the chart. In contrast, `pane.addSeries` forwards `this.paneIndex()`. The explicit chart-level `chart.addCustomSeries(view, options, pane.paneIndex())` avoids this specific convenience-path mismatch. This is a possible implementation technique for a later decision, not a selected Gurafu API. [Pane types][pane-type], [pane implementation][pane-api], [chart creation signatures][chart-api-type].

## Series and extensions

The six built-in price-series definitions are `LineSeries`, `AreaSeries`, `BaselineSeries`, `BarSeries`, `CandlestickSeries`, and `HistogramSeries`. In ESM, import the definition and call `chart.addSeries(definition, options?, paneIndex?)`; the definition drives `ISeriesApi<T, HorzScaleItem>`'s data and options types. Line-like/histogram data has `value`; bar/candlestick data has OHLC fields; whitespace has time without a plotted value. Series type is chosen at creation; there is no public operation to mutate a line series into a candlestick series. [Migration guide][migration], [data type map][data-types], [series interface][series-type], [chart interface][chart-api-type].

| Extension | Contract and ownership facts |
| --- | --- |
| Custom series | `addCustomSeries` accepts `ICustomSeriesPaneView<HorzScaleItem, TData, TOptions>` and returns a typed custom SeriesApi, including whitespace in the public return type. The view supplies `renderer`, `update`, `priceValueBuilder`, `isWhitespace`, and `defaultOptions`. Price values provide scale extrema/current value; the final array value is the current value. Renderer receives canvas target and a nullable price-coordinate converter. Optional `hitTest` and `conflationReducer` exist at this pin. Its renderer data has logical indexes and `originalData`; its `time` number is not a UTC timestamp. [Custom series][custom], [chart types][chart-api-type]. |
| Series primitive | `series.attachPrimitive` / `detachPrimitive` add graphics associated with a series. Optional pane/axis views, hit testing, autoscale info, update hooks, and attached/detached hooks are available. `attached` receives chart, series, `requestUpdate`, and horizontal-scale behavior. Autoscale hooks are called frequently; upstream advises simple/cached computation. A primitive is not an independently managed data series. [Primitive contract][series-primitive], [attached types][series-primitive-api], [series implementation][series-api]. |
| Pane primitive | `pane.attachPrimitive` / `detachPrimitive` attaches graphics to a pane without requiring a series. Attached context contains chart and `requestUpdate`, without a series or pane handle. The attaching owner must retain any extra pane reference needed. Pane and series primitive hooks are distinct contracts. [Pane primitive contract][pane-primitive], [attached context][pane-primitive-api], [pane API][pane-api]. |
| Bundled plugins | Markers are managed through `createSeriesMarkers(series, markers?, options?)` and a returned plugin with `setMarkers`, `markers`, `detach`. Text/image watermarks attach to panes through their factory functions and detachable wrappers. Clearing markers and detaching a plugin are distinct operations. [Migration guide][migration], [markers source][markers], [wrapper contract][primitive-wrapper]. |
| Price lines | `series.createPriceLine`, `removePriceLine`, and `priceLines` provide separate line ownership; keep the returned handle for explicit removal. [Series contract][series-type], [series implementation][series-api]. |

**Lifecycle caveat:** custom-series types advertise optional `destroy()` on removal, but the inspected `Series.destroy()` only clears its animation timeout, and the custom pane-view implementation supplies no route to that user hook. Series primitives' `detached()` is called by explicit `series.detachPrimitive`, not by that series destruction method. Pane destruction does iterate pane primitives and call their detached hooks, so it is unsafe to generalize series-primitive behavior to pane primitives or assume every removal calls hooks exactly once. [Custom contract][custom], [Series.destroy][series-model], [custom pane view][custom-pane], [explicit series detach][series-api], [Pane.destroy][pane-model], [pane-widget destruction][pane-widget].

## Data mechanisms and exact limits

| Operation | Supported mechanism at 5.2.1 | Limit |
| --- | --- | --- |
| `setData(items)` | Fully replaces that series' data with an ascending, unique-time array; `[]` clears data. Time points are merged across all series in the chart and indexes are recalculated when their union changes. [Series contract][series-type], [data layer][data]. | Not append, automatic merge, network fetch, or a transaction across multiple series. Preserve/merge the authoritative dataset outside the chart when needed. |
| `update(item)` | A newer time appends; an equal latest time replaces the complete last item. The normal path rejects a time older than that series' last supplied time, including a last whitespace time. [Series contract][series-type], [data layer][data]. | Does not aggregate trades into OHLC, merge partial fields, sort a feed, deduplicate arbitrary history, or update older points by default. |
| `update(item, true)` | Allows older-bar correction without full replacement; slower than the latest-bar path. The time must already exist in the chart timeline; the safe intended use is replacement of an existing fulfilled bar in the target series. [Series contract][series-type], [data layer][data]. | Cannot prepend unseen history; rejects while that series is actively conflated. Sparse/whitespace insertions are unsafe, as explained below. |
| `pop(count)` | Removes up to count fulfilled bars from the tail, returns them **newest first**; count <= 0/empty data gives `[]`. The public type requires count even though implementation defaults to 1. Time points remain if another series references them. [Series types][series-type], [series implementation][series-api], [data layer][data]. | Not arbitrary deletion, replay storage, or atomic rewind across candles/volume/indicators. Whitespace is not a fulfilled bar; do not assume pop count equals all timeline entries removed. |
| `data()` / `dataByIndex(index, mismatchDirection?)` | Public readback and optional nearest-left/right lookup. `data()` maps fulfilled stored rows into a new array; whitespace rows are not included. `dataByIndex` can return null. [Series implementation][series-api], [data layer filtering][data]. | Chart readback is not a lossless application database or a view of all whitespace. Indexes are positions on the shared chart timeline, not stable row IDs or timestamps. |
| Data-change notification | Subscribe/unsubscribe with `DataChangedHandler(scope)`, where scope is `'full'` or `'update'`; `setData` emits full, `update` emits update, and a nonempty `pop` emits update. [Series types][series-type], [series implementation][series-api]. | No delta payload, reason enum distinguishing pop/correction/append, feed status, cancellation, or multi-series transaction completion. |

### Historical corrections and sparse data

The guard for `historicalUpdate` checks the chart-wide `_pointDataByTimePoint`. The target row helper then finds the lower-bound position and assigns `seriesData[index] = plotRow` without requiring a matching target-series row. In an isolated probe of the published DataLayer, A with times `[10, 30]`, B with `[20]`, then A's `update({time: 20, value: 2}, true)` left A's fulfilled rows `[10, 20]`, losing its row at 30. Using an existing chart time is therefore insufficient validation. A whitespace-only target time can have the same missing-fulfilled-row hazard. Treat historical mode as correction of an existing fulfilled target-series bar; use full replacement for insertions unless a later verified fix changes this evidence. [Pinned data layer][data].

This is a reproduced internal data-path behavior; the experiment did not render a chart. It supports a verification requirement and a possible restriction, not a claim about the exact visual symptom or permission to patch upstream.

### Time, order, whitespace, and input mutation

- Default time axis uses `Time = UTCTimestamp | BusinessDay | string`. `UTCTimestamp` is a branded **seconds** number, not JavaScript milliseconds; strings represent business days in `YYYY-MM-DD` form. `BusinessDay` is `{year, month, day}`. Type assertions do not convert units or validate dates. [Time types][time-types], [converters][time-utils].
- The array converter is chosen from its first item. Numeric and business-day representations cannot be freely mixed within a dataset: the selected converter rejects the other category. Business-day strings and objects use the business-day converter, and normalize to UTC-midnight timestamps. Normalized duplicate times remain duplicates even if the input representations differ. [Converters][time-utils], [time behavior][time-behavior], [ordering validator][validators].
- `setData` requires strictly ascending times with no duplicate normalized keys. Development checks enforce order and built-in value types/ranges, but these checks return early in production; custom-data validation is empty. Invalid data is not made valid by a production bundle accepting it. [Validators][validators], [series implementation][series-api].
- Whitespace gives a time position without a price. The chart timeline is the union of series' time points, including whitespace mappings; filled-data readback filters whitespace. `ignoreWhitespaceIndices` controls selected grid/tick/crosshair behavior, not consumer session calendars. [Data types][data-types], [data layer][data], [time-scale types][time-scale].
- `update` saves original-time metadata on the supplied object and preprocesses a string time into a BusinessDay in place. A probe confirmed caller-object mutation. There is no general frozen-input/immutable-object guarantee; later wrapper decisions should consider copying boundary items, especially from a store. [Data update path][data], [time preprocessing][time-behavior], [converters][time-utils].
- Lightweight Charts does not natively manage time zones; upstream documents data-side conversion workarounds. Display formatting, actual timestamp identity, DST changes, bar interval alignment, missing sessions, and exchange calendars are separate concerns. Feed/session policy stays application-owned by the map's standing scope. [Pinned timezone guidance][timezones], [map](https://github.com/carere/gurafu/issues/3).

### What v5 improves in data management

Compared specifically with v4.2.1, `setData`, normal latest-bar `update`, `data`, `dataByIndex`, data-change subscriptions, and logical-range history triggers already existed. They must not be sold as v5 additions. The v5.2.1 interface adds the historical-update argument; `pop` arrived in 5.0.9; 5.1 introduced optional conflation. Native panes also let related series use one chart timeline without a consumer coordinating separate time scales. [v4 interface][v4-series], [v5 interface][series-type], [version history][notes], [chart model][model].

Conflation reduces rendered detail when zoomed out; it does not become a feed, database cache, candle-interval aggregator, or pagination service. `timeScale.enableConflation` defaults to false. Threshold controls exist globally and per series; precomputation is separately opt-in, trading initialization work/memory for later zoom work, and custom series can supply a reducer. Exact activation is device-pixel-ratio/spacing/factor dependent; do not treat the prose threshold as a universal fixed CSS-pixel cutoff. [Time-scale defaults][time-defaults], [time-scale calculation][time-scale], [series calculation][series-model], [custom reducer contract][custom].

Crucially, historical mode checks `series.isConflationEnabled()`, whose result requires both the global flag and a calculated factor > 1. A correction can therefore succeed at one zoom level and reject at another. There is no throughput or memory benchmark in this research; upstream documentation's performance estimates are not Gurafu guarantees. [Data-layer guard][data], [series conflation check][series-model].

Consumer/wrapper work still includes authoritative datasets, old-page merging, overlap resolution, sorting/deduplication, units/validation, race/cancellation policy, series-to-series consistency, replay cursor/snapshots, indicator computations, and feed error/loading state. The exposed mutation/event APIs supply no application protocol for those jobs; their exact ownership within Gurafu versus the consumer remains for later decisions, with feeds/cache/trading sessions already application-owned. [Public series interface][series-type], [chart interface][chart-api-type], [official history example][history], [map](https://github.com/carere/gurafu/issues/3).

## Loading older history and date navigation

The official infinite-history example listens to `timeScale().subscribeVisibleLogicalRangeChange`, decides when the left edge is near, loads/assembles data in a separate Datafeed, and passes the combined result to `setData`. The series API also documents `barsInLogicalRange(range)` with `barsBefore` / `barsAfter` for history triggers. Both the range event and bars lookup can be null. These are visibility signals, not a built-in datafeed contract. [History example][history], [series API][series-type], [time-scale events][time-api-type].

Recommendations for later specifications, not selected behavior:

- Define who merges overlapping pages and live updates before replacement. Guard repeated range events, in-flight work, exhausted history, failures, and stale responses after symbol/timeframe change or unmount.
- Keep a viewport anchor when prepending. Logical indexes shift when the union timeline gains earlier points; adding N input rows does not necessarily mean N new chart indexes if they overlap existing series. The model contains right-offset compensation, but this does not settle replay/date-navigation UX or guarantee an unchanged viewport for all multi-series replacements. [Timeline merge][data], [time-scale update compensation][model].
- Avoid unconditional `fitContent()` on every data change if users can inspect older history: it explicitly fits all series' data. Choose and verify follow-latest versus preserve-view behavior separately. `shiftVisibleRangeOnNewBar` defaults true and `allowShiftVisibleRangeOnWhitespaceReplacement` defaults false. [Time API][time-api-type], [defaults][time-defaults].
- For date navigation, `setVisibleRange({from,to})` uses existing data and clamps to available history; it does not fetch missing dates. `setVisibleLogicalRange`, `timeToIndex(time, findNearest?)`, and coordinate conversion are available when a consumer needs explicit navigation. Nearest lookup selects an available point; it does not know exchange/session intent. [Time API][time-api-type], [time-scale lookup][time-scale].

## Public escape hatches for consumer coordination and legends

Native panes already share a time scale. The following APIs also enable the **example-only**, consumer-owned coordination between separate chart instances requested by the map; no built-in Gurafu synchronization contract is proposed. [Model][model], [map](https://github.com/carere/gurafu/issues/3).

| Need | Public mechanisms and limits |
| --- | --- |
| Crosshair/legend input | `subscribeCrosshairMove` / `unsubscribeCrosshairMove`; `MouseEventParams` has optional `time`, `logical`, `point`, `paneIndex`, `hoveredInfo`, and a `seriesData` Map keyed by actual SeriesApi instances. Read OHLC versus single-value fields by series type. Mouse leave/out-of-data can omit fields, and missing/sparse series need absence handling. [Event types][chart-api-type], [event conversion][chart-api]. |
| Programmatic crosshair | `chart.setCrosshairPosition(price, time, targetSeries)` and `clearCrosshairPosition()`. These synthetic operations suppress their own direct move-event emission. Invalid/foreign series is ignored; an empty pane/time scale can fail underlying non-null assumptions, so data readiness matters. The implementation uses the target pane's default price scale for coordinate conversion, which needs verification when targetSeries uses an overlay/left scale. [Chart implementation][chart-api], [synthetic model positioning][model]. |
| Time window | `get/setVisibleLogicalRange`, `subscribe/unsubscribeVisibleLogicalRangeChange`; corresponding visible-time range APIs are also available. Logical range can include fractional/negative indexes; a chart's timeline is derived from its own data, so equal indexes in different datasets/timeframes need not mean equal times. Time-range get/set does not extrapolate beyond data. [Time API][time-api-type], [data timeline][data]. |
| Coordinates and navigation | `timeToIndex`, `timeToCoordinate`, `coordinateToTime`, `logicalToCoordinate`, `coordinateToLogical`, `scrollToPosition`, `scrollToRealTime`, `fitContent`, `resetTimeScale`. Series offers price/coordinate conversion and formatter access. Conversions can return null. [Time interface][time-api-type], [series interface][series-type]. |
| Size/DOM | `timeScale().subscribe/unsubscribeSizeChange`, `chart.paneSize(index?)`, `pane.getHTMLElement`, `chart.chartElement`. External listeners remain owned by whoever installs them. [Time interface][time-api-type], [chart interface][chart-api-type], [pane interface][pane-type]. |

The official separate-chart example wires both time-scale and crosshair events in application code. Its generated datasets line up; it does not establish behavior for differing intervals, missing times, unrelated price units, null ranges, cleanup, or async feedback. A Gurafu example should explicitly choose target-time/value mapping, equality/reentrancy guards, clearing behavior, and disposal. [Pinned example][crosshair-example].

## Creation, subscriptions, and disposal

Chart creation needs a mounted browser container. Series belong to their creating chart; primitives/price lines belong to the series or pane to which they were attached. `chart.removeSeries(series)` and `chart.remove()` are documented terminal operations; neither is documented as idempotent. Chart removal clears internal event delegates, data maps, time-scale subscriptions, the resize observer, DOM, and scheduled animation-frame work. Do not keep issuing calls through captured handles afterward. [Creation][create], [chart contract][chart-api-type], [chart implementation][chart-api], [widget cleanup][widget], [time-scale cleanup][time-api].

Subscribe methods return `void`, not disposer callbacks. Matching unsubscribe needs the **same callback function**. Delegate implementation stores duplicate subscriptions and an unsubscribe removes one matching entry; recreating an arrow closure at cleanup does not match the original callback. Chart/time-scale teardown destroys their delegates, but consumer timers, async work, feed subscriptions, and framework effects are outside that ownership. [Public event signatures][chart-api-type], [time API][time-api-type], [delegate implementation][delegate], [series event interface][series-type].

Additional pin-specific caveats:

- `ChartApi.removeSeries` removes model/data-layer/map entries but does not call `SeriesApi.destroy()` to empty its data-change delegate. A retained SeriesApi can therefore retain its handler closures. Explicit unsubscription matters even if no more legitimate updates should occur. [Chart removal path][chart-api], [SeriesApi.destroy][series-api].
- `detachPrimitive` is documented as doing nothing for an unattached primitive, but the series API invokes `primitive.detached()` unconditionally, and pane-model detach does likewise. Repeated detach can repeat hooks. Owner cleanup should track attachment and be safe against repeat calls; do not infer upstream idempotency from that type comment. [Series contract][series-type], [series implementation][series-api], [pane model][pane-model].
- Removing the whole chart traverses both model panes and widget teardown paths. Given the extension-hook differences above, an exactly-once extension cleanup contract requires explicit ownership/testing rather than assumptions about destruction traversal. [Widget cleanup][widget], [model destruction][model], [pane destruction][pane-model], [pane-widget cleanup][pane-widget].

A candidate lifecycle verification order is: stop external async producers and callbacks, unsubscribe registered handlers, detach owned plugins/primitives and dispose custom resources while their handles are live, remove owned series as applicable, then remove the chart once. This is a **recommendation for later design**, not a mandate for a particular Solid or Solux abstraction. It must accommodate child-first/parent-first framework teardown and cancellation of delayed history callbacks. [Terminal-operation contract][chart-api-type], [explicit detach path][series-api], [creation boundary][create].

## Resize, theming, and SSR

`autoSize: true` installs a `ResizeObserver` when available. While active, public `resize(width,height,forceRepaint?)` ignores external sizes; `autoSizeActive()` reports whether it is active. Without observer support, upstream warns and falls back to manual/detected dimensions. A container still needs layout dimensions. Turning autoSize off explicitly permits manual sizes; the observer callback repaints synchronously at this pin. [Chart resize implementation][chart-api], [widget observer/size code][widget], [chart types][chart-api-type].

Theming is expressed through `chart.applyOptions(DeepPartial<ChartOptions>)`, series `applyOptions`, price-scale/time-scale options, and plugin-specific `applyOptions`. Chart-level layout, grid, crosshair, and pane-separator settings do not magically restyle every series, primitive, or external legend/control. `layout.colorSpace` and `layout.colorParsers` are creation-only in the source's development guard; do not promise all creation options are reactively mutable. [Chart applyOptions][chart-api], [series options][series-type], [layout types][layout], [plugin wrapper][primitive-wrapper].

SSR distinction: upstream explicitly guards browser globals used at module evaluation so imports can be usable in server contexts, but `createChart` resolves DOM elements and its widget creates DOM/canvases, uses window, observes size, and schedules animation frames. A Node 24.22.1 probe successfully imported the **published standalone development ESM** and returned version 5.2.1 without window/document; calling `createChart('missing')` then failed with `ReferenceError: document is not defined`. This is not an SSR render of a chart, nor verification of Gurafu's bundled package-import path. [Client guard][client-guard], [creation][create], [widget][widget], [published bundle][tarball].

For the TanStack Start/Solid environment, later verification should render the component shell on the server, create the imperative chart after client mount, and dispose it on cleanup. Whether the standard package import can remain static or should be client-loaded must be checked in that actual bundler/SSR path; this research did not run the website build or add a component. [Gurafu baseline][gurafu-package], [browser creation requirements][create].

## v4 migration and relevance to Ashiso's reusable experience

| Area | Verified migration constraint / available mechanism |
| --- | --- |
| Series creation | Ashiso calls `addCandlestickSeries` and `addHistogramSeries`; v5 uses imported definitions with `addSeries`. Overlay volume is currently a histogram using a `volume` scale plus margins, not a native-pane policy to preserve automatically. [Ashiso candles][ashiso-candles], [Ashiso volumes][ashiso-volumes], [migration][migration]. |
| Indicators | Ashiso uses Bollinger bands, volatility-cycle, and volume-MA series primitives, with consumer-supplied indicator data. v4 primitive view/renderer type names become `IPrimitivePaneView`, `IPrimitivePaneRenderer`, and `PrimitivePaneViewZOrder`; the v5 extension types/lifecycle need inspection during a port. No built-in computation of those indicators follows from adding panes/custom series. [Ashiso indicator][ashiso-indicator], [Ashiso primitive owner][ashiso-primitive], [migration][migration], [primitive interface][series-primitive]. |
| Markers/watermarks | If used by future controls/examples, replace v4 series marker methods and chart watermark options with separately owned v5 plugin instances. This is an upstream migration requirement, not a claim that the inspected Ashiso chart uses those features. [Migration][migration]. |
| Replay | Ashiso filters candle/volume datasets by replay time and handles click selection separately. `setData`, forward `update`, `pop`, and correction APIs are useful ingredients, but v5 supplies no replay cursor, play/pause rate, authoritative history, indicator consistency, or multi-series rewind transaction. [Ashiso candles][ashiso-candles], [volumes][ashiso-volumes], [replay controller][ashiso-replay], [series contract][series-type]. |
| Legends and controls | Ashiso renders `GraphLegend` outside the chart and handles chart/store/color-mode events. Crosshair data/formatter APIs can drive such views; selection/date controls are consumer UI layered around public chart mechanisms. The exact reusable UI boundary is still a later product decision. [Ashiso chart][ashiso-chart], [legend][ashiso-legend], [event interface][chart-api-type], [series formatter contract][series-type]. |
| Date navigation/history | Ashiso maps application milliseconds to chart seconds, listens for logical-range changes, and sends worker requests. Retain the unit distinction and history/navigation scenarios; v5 does not take ownership of those workers, caches, or sessions. [Ashiso candles][ashiso-candles], [time types][time-types], [map](https://github.com/carere/gurafu/issues/3). |
| Packaging | Upstream v5 drops CommonJS and targets ES2020; published 5.2.1 package exports ESM development/production entrypoints and typings. This affects bundling, not an automatic grant of SSR chart rendering. [Release technical notes][notes], [npm metadata][npm], [creation][create]. |

Solux is an open evaluation, not required by Lightweight Charts' imperative API. The facts above do not establish its version, lifecycle semantics, or suitability. A later state-management decision must preserve chart-local ownership, mutable external-object handles, explicit subscriptions, and cancellation independently of how consumer data is stored. This ticket does not resolve Solux or fully audit Ashiso's feature/product boundaries. [Chart/series interfaces][chart-api-type], [series interface][series-type], [map's open scope](https://github.com/carere/gurafu/issues/3).

## Verification scenarios for the later implementation/specification

These are concrete acceptance/prototype scenarios, **not tests added to the repository**. Expected upstream facts cite the relevant source; policy-dependent outcomes remain questions.

| Scenario | Verify |
| --- | --- |
| Two panes A/B, move A to index 1 | Retained PaneApi identity stays the same; `paneIndex()` changes; cached price-scale handle must be reacquired to address the intended pane. [Pane API][pane-api], [price API][price-api]. |
| Create pane and reorder in the same tick | Compare model-pane versus widget readiness; `getHTMLElement()` can be null and `moveTo` uses widget count. [Pane API][pane-api]. |
| One series in pane 0, another pane at 1; move the only first-pane series to 1 | Source pane may disappear, making the final target index 0. Repeat with preserved source and confirm it remains empty. [Move/cleanup][model]. |
| Add a series at index 99 to a chart with one pane | Only one new pane is appended, rather than 98 empty gaps. [Get-or-create][model]. |
| Empty data versus no series | `setData([])` leaves the series/pane; removing the last series can remove a non-preserved nonfinal pane. Repeat with only a pane primitive and with `preserveEmptyPane: true`. [Data layer][data], [cleanup][model]. |
| Remove final/populated/middle pane | Final pane removal is a no-op; for populated/middle pane record retained series APIs, chart timeline, subscriptions, primitives, and neighboring pane rendering. Do not promise cascading cleanup before this check. [Model][model], [GUI synchronization][widget]. |
| Custom series on pane 2 | Contrast `pane.addCustomSeries(view)` with `chart.addCustomSeries(view, {}, pane.paneIndex())`; the former forwards 0 at this pin. [Pane API][pane-api]. |
| Pane sizing | Exercise ratios 2:1:1, constrained `setHeight(10)`, single-pane height, user drag, zero-size container, and later resize. Distinguish pane plot height from chart height and axes/separators. [Height model][model], [widget allocation][widget]. |
| Latest updates | `[10,20]` then `update(20)` replaces, `update(30)` appends, `update(15)` rejects. Repeat after a later whitespace time. [Data layer][data]. |
| Historical correction | `[10,20,30]` correct 20 with `true`; preserve neighbors. An absent chart time must reject. For A `[10,30]`, B `[20]`, observe the reproduced unsafe replacement when correcting A at 20. Repeat with A whitespace at 20. [Data layer][data]. |
| Conflation plus correction | Enable conflation, then change bar spacing/threshold/DPR until factor > 1; historical update must reject while active. Compare zoomed-in correction. [Data guard][data], [series activation][series-model]. |
| Rewind with `pop` | Pop 2 from `[10,20,30]`: return `[30,20]`; repeat count 0, over-count, shared timestamps in another series, trailing whitespace, and reappend. Decide candle/volume/indicator coordination outside this operation. [Pop/filtering][data]. |
| Data validation | Reject descending/duplicate normalized times, NaN/Infinity built-in values, and mixed numeric/business-day arrays at the appropriate input boundary. Compare dev versus production; include duplicate string/object business days. [Validators][validators], [converters][time-utils]. |
| Input ownership | Pass a copied daily-string update, inspect mutation; separately try frozen/store-derived inputs. Ensure chart-side mutation cannot corrupt consumer state. [Data layer][data], [time preprocessing][time-behavior]. |
| History request race | Scroll left twice, receive overlapping pages out of order while a latest-bar update arrives; merge without duplicates or dropping live state. Switch symbol/unmount before completion and ensure stale responses do not touch disposed handles. [Visibility mechanism][history], [terminal contract][chart-api-type]. |
| History viewport | Prepend candles and sparse indicators with partially overlapping times; preserve a chosen visible anchor; compare native offset compensation and explicit logical/time anchors. [Union indexes][data], [compensation][model]. |
| Crosshair and legend | Leave chart, hover whitespace, hover a sparse indicator, then programmatically set/clear. Handle missing `time`, missing series data, OHLC versus value, and changing `paneIndex`; verify overlay-scale price placement. [Mouse interface][chart-api-type], [synthetic position][model]. |
| Separate-chart example | Use different intervals, missing target times, different prices/scales, empty target chart, and reciprocal subscriptions. Define mapping/feedback guards explicitly; dispose both directions on unmount. [Public coordination example][crosshair-example], [time API][time-api-type]. |
| Extension cleanup | Record attach/detach/custom-destroy calls on explicit detach, repeated detach, removeSeries, pane removal, chart removal, and repeated owner cleanup. Verify external timers/listeners stop despite the pinned missing hooks. [Series API][series-api], [series destruction][series-model], [pane destruction][pane-model]. |
| Reactive lifecycle | Toggle a series/indicator repeatedly, change callbacks, and remove the parent before child cleanup. One active instance/handler should remain per intended owner; ensure no double remove or stale async callbacks. [Delegate behavior][delegate], [terminal APIs][chart-api-type]. |
| Resize/theme/SSR | SSR shell without DOM, hydrate/mount/unmount/remount; ResizeObserver present/absent; toggle auto/manual size; switch theme with custom primitives and external controls. Verify the actual TanStack Start bundle and retained resources. [Creation][create], [widget][widget], [applyOptions][chart-api], [Gurafu package][gurafu-package]. |
| Type-level contract | Confirm Candlestick data/options inference and negative cases for value-only candles, missing custom fields, wrong option enums, unbranded numeric timestamps, null coordinate results, omitted `pop` count, and renamed v4 types. `Time` permits arbitrary strings structurally, so runtime string validation still matters. [Series interface][series-type], [custom types][custom], [time types][time-types], [migration][migration]. |

## Probe evidence and limitations

Executed in Node **24.22.1**, without a browser, dependency installation, or upstream writes:

1. Verified npm archive integrity/gitHead and inspected its declarations.
2. Imported the published standalone development ESM without DOM globals; `version()` returned `5.2.1`; chart creation failed at `document` as expected.
3. Evaluated the same bundle in an isolated VM with its final export declaration replaced by a test-only exposure of internal classes. Actual compiled method bodies were unchanged. Pane/series/model probes used minimal stand-ins for collaborators; DataLayer probes used the real `HorzScaleBehaviorTime` and stub series metadata. Confirmed: custom-pane forwarding to index 0; removePane model method retaining its series array; Series.destroy not invoking primitive/custom cleanup; latest/older/historical update checks; sparse cross-series historical overwrite; active-conflation rejection; pop return order; string-update mutation.

A compact reproducer of the most consequential data result, after downloading and verifying the published archive, is below. It intentionally reaches internal compiled classes **only for research**; those names are not public escape hatches and must not enter Gurafu's production API.

```js
// Node .cjs; BUNDLE points to the verified standalone development .mjs.
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync(process.env.BUNDLE, 'utf8')
  .replace(/^export \{[^\n]+\};\s*$/m, '');
const context = vm.createContext({ console, setTimeout, clearTimeout });
vm.runInContext(code +
  '\nglobalThis.probe = { DataLayer, HorzScaleBehaviorTime };', context);
const { DataLayer, HorzScaleBehaviorTime } = context.probe;
const makeSeries = () => ({
  _internal_seriesType: () => 'Line',
  _internal_customSeriesPlotValuesBuilder: () => undefined,
  _internal_customSeriesWhitespaceCheck: () => undefined,
  _internal_isConflationEnabled: () => false,
});
const layer = new DataLayer(new HorzScaleBehaviorTime());
const a = makeSeries(), b = makeSeries();
layer._internal_setSeriesData(a, [{time:10,value:1}, {time:30,value:3}]);
layer._internal_setSeriesData(b, [{time:20,value:20}]);
const result = layer._internal_updateSeriesData(a, {time:20,value:2}, true);
console.log(Array.from(result._internal_series.get(a)._internal_data,
  row => row._internal_originalTime)); // [10, 20], not [10, 20, 30]
```

No browser rendering, memory profiling, complete custom-series teardown, public-chart populated-pane removal, actual Solid type-check suite, or TanStack Start SSR build was executed. Those remain explicit verification scenarios, not hidden assumptions. The internal-method checks do not establish GUI symptoms, framework cleanup ordering, or end-to-end correctness. No exhaustive later-upstream audit, Solux evaluation, or full Ashiso feature audit is claimed.

## Recommendations and questions for later decisions

Recommendations derived from the evidence, **not approved product decisions**:

- Separate logical identity from current numerical pane/series position; acquire current handles/scale locations at the point of use.
- State explicit input/mutation modes and callback/extension ownership. Consider historical mode restricted to known fulfilled target-series rows, and treat unseen history as assembled replacement.
- Verify or avoid the pinned pane-custom-series convenience path and cascading-populated-pane-removal assumption; do not silently upgrade or patch dependencies to erase the constraint.
- Keep browser creation/readiness and terminal disposal visible in lifecycle semantics; make repeat owner cleanup safe without assuming upstream removal is repeatable.
- Exercise replay/history/conflation together before promising performance or consistency. Demonstrate coordination of separate charts only in consumer example code, as already scoped by the map.

Questions left to the humans/later decision tickets:

1. How should public pane identity, ordering, optional/preserved empty panes, user resize, and persisted heights be represented, given mutable indexes and constrained sizes?
2. Which data modes should the fresh API expose, and who reconciles reactive snapshots with imperative updates, historical corrections, replay rewinds, and sparse indicator history?
3. Which chart/series/pane/time-scale handles are public escape hatches, when are they ready, and what is the contract after unmount/replacement?
4. Who owns each custom-series view/plugin instance and its cleanup? Should the specification account explicitly for the pinned missing hooks and pane-removal behavior?
5. How much reusable indicator presentation, legends, replay controls, date navigation, and theming belongs to Gurafu versus companion UI/examples, while feeds/cache/sessions remain application-owned?
6. Should conflation be exposed, and what happens when a consumer wants historical corrections or replay while it is active?
7. Can a proposed Solid/Solux state design express these lifetimes and async cancellation without making chart handles or consumer services global? Solux selection/version remains undecided.

Suggested factual map gist: **5.2.1 provides native panes, typed series/extensions, historical corrections, tail pop, and opt-in conflation; data loading/merging/replay policy remains external. Pane indexes move, cleanup hooks need explicit ownership, and pinned custom-pane forwarding/sparse historical-update/populated-pane-removal paths require verification or constraints.**

## Primary sources

All `b2ce010…` links are the 5.2.1 release revision, not the moving upstream branch. Primary-source code is the authority where prose and signatures disagree.

[gurafu-package]: https://github.com/carere/gurafu/blob/39fe95bf/package.json
[gurafu-lock]: https://github.com/carere/gurafu/blob/39fe95bf/bun.lock
[gurafu-readme]: https://github.com/carere/gurafu/blob/39fe95bf/README.md
[tag]: https://api.github.com/repos/tradingview/lightweight-charts/git/tags/bf4bdc64e1ac5d6dc8a1c01e1340cc1cb25ca695
[npm]: https://registry.npmjs.org/lightweight-charts/5.2.1
[tarball]: https://registry.npmjs.org/lightweight-charts/-/lightweight-charts-5.2.1.tgz
[live-notes]: https://tradingview.github.io/lightweight-charts/docs/release-notes
[notes]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/website/docs/release-notes.md
[migration]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/website/docs/migrations/from-v4-to-v5.md
[chart-api-type]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/api/ichart-api.ts
[chart-api]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/api/chart-api.ts
[pane-type]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/api/ipane-api.ts
[pane-api]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/api/pane-api.ts
[model]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/model/chart-model.ts
[pane-model]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/model/pane.ts
[chart-defaults]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/api/options/chart-options-defaults.ts
[widget]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/gui/chart-widget.ts
[pane-widget]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/gui/pane-widget.ts
[series-type]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/api/iseries-api.ts
[series-api]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/api/series-api.ts
[series-model]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/model/series.ts
[data]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/model/data-layer.ts
[data-types]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/model/data-consumer.ts
[validators]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/model/data-validators.ts
[custom]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/model/icustom-series.ts
[custom-pane]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/model/series/custom-pane-view.ts
[series-primitive]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/model/iseries-primitive.ts
[series-primitive-api]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/api/iseries-primitive-api.ts
[pane-primitive]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/model/ipane-primitive.ts
[pane-primitive-api]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/api/ipane-primitive-api.ts
[markers]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/plugins/series-markers/wrapper.ts
[primitive-wrapper]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/plugins/primitive-wrapper-base.ts
[price-api]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/api/price-scale-api.ts
[time-types]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/model/horz-scale-behavior-time/types.ts
[time-utils]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/model/horz-scale-behavior-time/time-utils.ts
[time-behavior]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/model/horz-scale-behavior-time/horz-scale-behavior-time.ts
[timezones]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/website/docs/time-zones.md
[time-defaults]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/api/options/time-scale-options-defaults.ts
[time-scale]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/model/time-scale.ts
[time-api-type]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/api/itime-scale-api.ts
[time-api]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/api/time-scale-api.ts
[history]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/website/tutorials/demos/infinite-history.js
[crosshair-example]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/website/tutorials/how_to/set-crosshair-position-syncing.js
[delegate]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/helpers/delegate.ts
[create]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/api/create-chart.ts
[client-guard]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/helpers/is-running-on-client-side.ts
[layout]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/model/layout-options.ts
[v4-series]: https://github.com/tradingview/lightweight-charts/blob/6902233ee34e2f2f697f713d4b7f1d8b4656faae/src/api/iseries-api.ts
[ashiso-package]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/package.json
[ashiso-chart]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/index.tsx
[ashiso-candles]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/series/candles.tsx
[ashiso-volumes]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/series/volumes.tsx
[ashiso-indicator]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/indicators/bollinger-bands.ts
[ashiso-primitive]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/primitives/bollinger-bands-primitive.ts
[ashiso-replay]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/mode/replay.ts
[ashiso-legend]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/legend/graph-legend.tsx
[later-pane]: https://github.com/tradingview/lightweight-charts/blob/d9878ed0a60c5f145d87e2e040358bc58084b8f8/src/api/pane-api.ts
[later-series]: https://github.com/tradingview/lightweight-charts/blob/d9878ed0a60c5f145d87e2e040358bc58084b8f8/src/model/series.ts
[later-data]: https://github.com/tradingview/lightweight-charts/blob/d9878ed0a60c5f145d87e2e040358bc58084b8f8/src/model/data-layer.ts
[later-model]: https://github.com/tradingview/lightweight-charts/blob/d9878ed0a60c5f145d87e2e040358bc58084b8f8/src/model/chart-model.ts
