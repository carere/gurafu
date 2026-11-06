# Solid chart API patterns and Solux state-model research

Research for [Gurafu #6](https://github.com/carere/gurafu/issues/6), under [map #3](https://github.com/carere/gurafu/issues/3). Observed 2026-11-06. This is evidence for a later implementation-ready specification, **not an adoption decision or an implementation**.

## Scope and source ledger

The working baseline is Gurafu `39fe95bf83e76f825a57c3b00de3d745a3ed15bc`: a Solid source registry, TanStack Start website, Solid `1.9.18`, and Lightweight Charts **`5.2.1`**. Distributed sources must work independently of website routes, server code, and hosted services. [G-package], [G-readme]

The map authorizes a fresh API and requires accounting for Ashiso's reusable chart experience. Native panes within one chart instance are in scope. Coordination between separate chart instances is consumer-owned and example-only; feeds, caching, and trading-session management are application-owned. These are standing constraints, not conclusions of this research. [Map]

The findings that most affect the later specification are:

- The wrapper supplies useful chart-readiness, component composition and upstream type patterns, but its event replacement, pane/primitive ownership and marker lifecycle need further work. [W-time], [W-utils], [W-custom]
- Solux supports per-call stores, but shared slice initial objects can alias live state across chart instances. Fresh nested state is necessary; this was reproduced in v3, published v4 and local v4. [S-config], [S-slice], [S3-map], [S4-map]
- Root epics are not disposed with Solid owners. External cancellation is possible; no built-in aggregate store disposal is exposed. [S-mw], [S-context], [R-takeUntil]
- Ashiso's Solux v3 container/epic/devtools configuration is incompatible with the v4 configuration shape; local and published `4.0.1` also differ. [A-store], [S-types], [S-package], [S4-npm]
- Native Solid, internal Solux, an optional adapter, and public Solux integration remain viable design candidates with different contracts/costs. No choice is made here.

| Primary source | Recorded version/revision | What was actually examined |
| --- | --- | --- |
| `dsnchz/solid-lightweight-charts` | `8ba4d2a22d12a2b72297f3a353f8f6260e6d8970`, manifest `0.4.0` | README, manifest, lockfile, `TimeChart`, shared types/helpers, exports, build configuration, TimeChart tests. [W-package], [W-readme], [W-time], [W-tests] |
| Published `@dschz/solid-lightweight-charts` | `0.4.0`, npm `gitHead` `7e17f535fdd2ca1f286a302e6560522f14556936`; tarball SHA-1 `4a56b8c6b0c3cb0604409f9f02468f6f74061ddb` | Compiled entry and plain Node server import. Distinguish this release from the newer repository revision above. [W-npm], [W-dist] |
| Local `/Users/carere/Projects/oss/solux` | clean checkout at `f872304ccc2c453d8e7db2454a06f2fdff43c0ab`, manifest `4.0.1` | All core store/context/slice/middleware/enhancer sources, README, configuration/subscription tests, manifest and build. [S-package], [S-config], [S-context], [S-tests] |
| Published `@carere/solux` | `3.3.2`, npm `gitHead` `9f35eae7ffe3458b9b7a2ca36d6c48fe55ead546`; SHA-1 `2f57104d71911f9ad88a31c18b3d3f72bc569a06` | Registry metadata, tarball manifest, declarations, compiled ESM and embedded source map. [S3-npm], [S3-map], [S3-types] |
| Published `@carere/solux` | `4.0.1`, **no `gitHead` in metadata**; SHA-1 `11357526f2d5951004e29e8c842e7a949bed3db6` | Same package evidence; runtime probes. npm `latest` was `4.0.1` on observation date. [S4-npm], [S4-map], [S4-types], [S-npm] |
| Local `/Users/carere/Projects/oss/ashiso` | clean checkout at `1b716f85bea71a703330cdae74b83f82732812a9` | Store factory/provider, epic, chart lifecycle, legend, indicators, replay, date selector, controls, layout. Manifest requests Solux `^3.3.2`; that range is **not** proof of an installed version. [A-package], [A-store], [A-app], [A-chart] |
| TradingView Lightweight Charts | `5.2.1`; npm `gitHead` `b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1` | Versioned API/source for data, panes, chart/series removal, markers and primitive attachment. [L-npm], [L-series], [L-pane], [L-chart], [L-markers], [L-adapter] |
| Solid | published `1.9.18`, tarball SHA-1 `a26f33066c8877fabf7094dea092138eb0ae9b63` | Published browser store/reactivity and server runtime, used in probes. GitHub `v1.9.18` returned 404, so evidence links use exact published files rather than inventing a source tag. [D-npm], [D-store], [D-reactive], [D-server] |

Tarballs were read into an OS temporary directory and verified against registry SHA-1 metadata. Local source repos were read-only; local Solux modules were transpiled to temporary output for probes. No production components, dependency manifests, lockfiles, or upstream repositories were changed.

## Findings: transferable wrapper patterns and actual limits

### Composition, context, refs, options and types

- **Fact:** `TimeChart` owns a container and creates its API in `onMount`. A signal plus `<Show>` gates chart children until the API exists. Its private chart context carries an accessor; missing chart ancestry throws a descriptive error. `TimeChart.Series`, `.CustomSeries`, `.Pane`, and `.Tooltip` compose declaratively; a default pane context supplies index zero. This is a useful parent-readiness and nearest-chart ownership pattern. The context hook itself is not exported as a public extension API. [W-time], [W-index]
- **Fact:** `ref` is a **container DOM callback**, invoked at mount; `onCreateChart` exposes `IChartApi`, and `onCreateSeries` exposes `ISeriesApi` plus the pane index. They are different capabilities. There is no chart-destroy callback or ref-clearing protocol in the inspected component. Arbitrary children render as siblings of the chart container, so JSX nesting does not by itself establish an overlay positioning context. [W-time], [W-types]
- **Fact:** chart options derive from `Parameters<typeof createChart>[1]`; series options/data use upstream `SeriesPartialOptionsMap[T]` and `SeriesDataItemTypeMap<Time>[T]`. `mergeProps`/`splitProps` preserve reactive prop access, separate wrapper callbacks/container styling from chart options, and effects call `applyOptions`. The series `type` is chosen only when added, remains in the forwarded options object, and changing it does not recreate the series. [W-time], [W-types]
- **Fact:** custom series share a lifecycle helper and accept a renderer/pane view, data, markers and primitives. However, their exported types fix custom data/options to upstream `CustomData`/`CustomSeriesOptions`, rather than parameterizing the caller's richer custom shape; the helper also casts the chart to `never` for a callback. “Typed” does not mean every custom-series extension retains its exact type. [W-custom], [W-types]
- **Recommendation:** preserve explicit DOM/API distinctions and typed upstream option/data relationships in the later API design. Specify whether identity-changing inputs are immutable, trigger recreation, or are imperative operations. Decide whether custom extensions need a public chart/pane context and stronger custom-series generics. These are unresolved choices, not a proposal to clone this API.

### Data and event semantics

- **Fact:** built-in and custom series run `setData(local.data)` inside an effect; there is no declarative incremental `update` channel, data-operation discrimination, feed abstraction, or scheduling/backpressure contract. An API callback permits consumer imperative calls, but a later reactive `data` effect can replace their result. Lightweight Charts `5.2.1` distinguishes whole-array `setData` from `update(bar, historicalUpdate?)`; the wrapper does not specify how these ownership modes coexist. [W-time], [W-custom], [L-series]
- **Fact:** the same data effect runs the marker factory and calls `createSeriesMarkers` on every run, even with the empty default. It discards the returned marker-plugin handle. Upstream `5.2.1` constructs and attaches a **new primitive** per call and exposes `setMarkers` and `detach`. Thus repeated marker creation can leave earlier plugins attached while the series is alive; it is not equivalent to replacing one plugin's markers. This is a source-derived defect risk, not a measured rendering/memory benchmark. [W-time], [W-custom], [L-markers], [L-adapter]
- **Fact:** click, double-click and crosshair callbacks accept one function or an array and subscribe/unsubscribe symmetrically. But the helper is passed `local.onClick` etc. **as their current values**, not accessors; reading its closed-over parameter in an effect does not track replacement of the prop. A callback can read current state itself, but swapping the function/array is not reliably reactive. [W-time], [W-utils], [D-reactive]
- **Recommendation:** later specification should distinguish snapshot replacement, append/latest-bar updates, historical correction, and replay truncation/reset. It should also define whether declarative data and direct API mutation may mix. Keep data acquisition application-owned. For events, test handler replacement and choose an accessor or stable delegating listener contract; for markers, assign one owner and retain/update/detach its handle.

### Native pane identity and extension lifecycle

- **Fact:** `.Pane` provides an index; automatic indices come from a monotonically incremented counter added to the chart API. It does not explicitly create, remove or retain an empty pane. A series calls `addSeries(..., paneIdx())` only on mount and captures `seriesPane` once. Changing `index` does not call `moveToPane`, while subsequent callbacks/effects can read the changed index. No height, stretch, pane ref, reorder, or empty-pane preservation contract is exposed. [W-time], [W-types]
- **Fact:** `5.2.1` has native `addPane(preserveEmptyPane?)`, `removePane`, `swapPanes`, pane `moveTo`, `setHeight`, `setStretchFactor`, `setPreserveEmptyPane`, and series `moveToPane`. These operations act within one chart instance. The wrapper's index context is therefore inspiration, not a complete model of current native pane lifetime/identity. [L-chart], [L-pane], [L-series]
- **Fact:** pane primitives are attached from **each series' effect** to its captured pane, rather than from a single pane owner. The helper first detaches then reattaches the supplied primitives; each series cleanup detaches them. Two series sharing a pane primitive can therefore interfere when one unmounts. A pane with no series does not reach that attachment path. Series primitives have per-series effect cleanup. [W-time], [W-custom], [W-utils]
- **Fact:** chart removal, series removal, event unsubscription, primitive detachment, and tooltip render disposal are present. A JSX tooltip uses a crosshair subscription, its own signals and an imperative Solid `render` disposer. Its visibility test treats falsy `time` as absent (including numeric zero), and its default HTML id is shared unless overridden. Its separate render root also merits a test for access to caller contexts. [W-time], [W-custom], [W-tooltip]
- **Recommendation:** represent pane ownership independently from child-series count and distinguish stable pane identity from current numeric position. Later decisions should cover conditional panes, reordering, empty-pane retention, overlays, and destruction order. Treat “automatic cleanup” as individual source operations to verify together; this investigation did not prove all whole-chart teardown interleavings safe.

### Supported versions, sizing and SSR

- **Fact:** wrapper manifest peers declare Lightweight Charts `>=5.0.0` and Solid `>=1.6.0`, with no upper bound. Its lockfile resolves **Lightweight Charts `5.0.6` and Solid `1.9.6`**. That expresses a claimed peer range, not demonstrated testing against Gurafu's `5.2.1`/`1.9.18`. This is already a v5 wrapper; it is not evidence for copying a v4 wrapper migration. [W-package], [W-lock]
- **Fact:** `autoSize` defaults true; the README requires consumer-provided container dimensions and distinguishes CSS sizing from chart dimensions. With `autoSize` false, an effect calls `resize` and the wrapper's `onResize`; that callback is not a notification of every automatic resize. [W-readme], [W-time]
- **Fact:** source-level creation in `onMount` avoids creating a canvas chart during Solid server rendering, whose `onMount` is a no-op. [D-server-core] However, the wrapper build explicitly disables a server entry and its package has no server-specific export. Published `0.4.0` calls Solid's client `template` at module scope. A plain Node server import failed **before mounting any component**, with `Client-only API called on the server side`. Source-level mount guards alone do not establish package SSR safety. [W-build], [W-package], [W-dist], [D-server]
- **Recommendation:** for Gurafu's source registry, specify server-import safety, server placeholder output and client creation separately, and compile/test the distributed TSX through a consumer's SSR build. If evaluating the existing compiled wrapper package, evaluate a client-only dynamic import boundary or a proper server export; wrapping an already imported client-only module in `<Show>` is insufficient for the observed import failure. No TanStack-specific route dependency should enter distributed code. [G-readme]

## Findings: Solux, isolation and lifecycle

### Store creation is per call; independent backing state needs care

**Fact:** `configureStore` creates a dispatch closure and `ReplaySubject(1)` per call, with Solid `createStore`/`produce` state updates. It is not hardwired to a process-global store. However, both v3 and v4 `createSlice().getInitialState()` return the original initial-state object; `combineSlices` reuses its accumulator and child initial objects. `configureStore` passes that object directly to Solid. Solid caches its proxy on the raw object. Reusing a slice can consequently share backing state across charts despite separate dispatch and subscription closures. The v4 `clone(initialState)` populates an enhancer snapshot **after** live-state creation; it does not isolate live state. [S-config], [S-slice], [S-combine], [S3-map], [S4-map], [D-store]

**Observed:** with published v4 and the transpiled local revision, `a = configureStore({rootSlice})` and `b = configureStore({rootSlice})` produced `a.state === b.state`; incrementing A changed B. Published v3 showed the same result. A fresh slice factory per store isolated updates. Separate shallow copies of preloaded state isolated a top-level counter but still shared a nested counter. See the reproducible probe below. This refines, rather than rejects, the preliminary claim that stores are independent.

**Recommendation:** any per-chart design needs a fresh nested initial-state graph per chart and per server request. A fresh factory or genuinely independent preloaded state is a local mitigation. Merely creating multiple providers, reusing a shared slice, wrapping a shared slice in a new `combineSlices`, or spreading only the top level is insufficient. An upstream improvement could make initial-state factories/fresh cloning an explicit guaranteed contract. Do not clone chart handles as ordinary state.

### Provider and reactivity

- **Fact:** Solux has one module-level context token. Each provider supplies the store passed to it; it neither creates a store nor registers cleanup. Nearest-provider lookup supports nested scopes, but a nested chart provider using the same token shadows an application's Solux provider. `useSolux<S>()` is a caller-chosen cast, not runtime shape validation, and may return `undefined` outside a provider. Two installed copies of the package would have different context tokens. [S-context], [S3-map], [S4-map], [D-reactive]
- **Fact:** Solux state is Solid reactive state, not a replacement reactive engine. Reading properties in a tracking scope participates in Solid dependency tracking; copying a primitive out once does not stay reactive. Probes observed an effect update from `[0]` to `[0,1]` after dispatch and stop updating after root disposal. `subscribe`/`subscribeToEvent` instead return **RxJS `Subscription` objects**: call `.unsubscribe()`, not the object as a function. Subscribers replay the last dispatch immediately if one exists; it is not a new-change-only stream. The emitted `state` is the live store object, not an immutable historical snapshot. [S-config], [S-types], [S-tests], [S4-types], [D-store], [D-reactive]
- **Recommendation:** an internal Solux implementation can use a Gurafu-owned context carrying a narrow controller rather than expose Solux's context token. An optional adapter can accept explicit stores/selectors/commands. A public Solux contract would need provider precedence, missing-provider errors, version compatibility and event/state schema specified; types alone cannot prevent mixing the wrong state shape.

### Epics, middleware and disposal

**Fact:** v4 puts epics in `epicMiddleware({rootEpic, container?})`, installed through `applyMiddlewares`. It subscribes to the root epic during middleware setup and discards the returned subscription. `Store` exposes dispatch, state and listener subscriptions, but no `dispose`, epic subscription, or stream completion. The provider performs no cleanup. v3 similarly discards the root-epic subscription inside `configureStore`. Creating these inside a Solid owner does not automatically attach RxJS teardown to that owner. [S-mw], [S-enh], [S-context], [S-types], [S3-map], [S4-map]

**Observed:** disposing a Solid root and then emitting from a Subject-backed root epic still incremented its store and notified its listener, in published v4 and local source. Wrapping the root epic output with an externally owned `takeUntil(destroy$)` stopped later emissions after `destroy$.next()`. This is a real mitigation, not an exposed Solux disposer. [S-mw], [R-takeUntil]

**Important qualification:** the passive core without epics/devtools is not proven to leak merely because it lacks `dispose`. Once external references and subscriptions are dropped it can become unreachable. The demonstrated problem is active, uncancelled work and retained subscriptions; explicit consumer listener subscriptions *can* be unsubscribed today. [S-config], [S-mw]

**Fact:** middleware composition is a left reduction: later entries wrap earlier entries. The middleware API receives the dispatch available before that chain is built; it is not rebound to final dispatch. Epic outputs dispatch through the epic middleware's own closure. In probes, `[logger, epic]` logged the trigger and epic output; `[epic, logger]` logged only the trigger although the output still updated state. Logging, validation and instrumentation cannot assume Redux-style final-dispatch traversal. A single generic event type also permits middleware-originated dispatch; test its route explicitly. [S-enh], [S-mw]

**Fact:** neither the epic subscription nor `combineEpics` installs an error-recovery policy. `combineEpics` merges outputs; root errors require application-supplied RxJS handling. The built-in devtools enhancer discards both its store subscription and extension subscription; it has no disconnect/cleanup hook. Its `window?.__REDUX_DEVTOOLS_EXTENSION__` check accesses an undeclared identifier in Node; optional chaining does not make that SSR-safe. Invoking it without `window` reproduced `ReferenceError`. [S-epics], [S-enh], [S4-map]

**Recommendations and upstream candidates, conditional on the later choice:**

1. A plain internal Solux core can avoid built-in epics/devtools and own individual subscription cleanup without requiring an upstream change.
2. An epic-backed chart can supply a per-instance cancellation subject, wrap the entire output with `takeUntil`, signal cancellation on owner cleanup, and unsubscribe chart listeners. Every asynchronous source must honor teardown; unsubscribing a Promise-backed observable does not itself prove cancellation of its underlying work. Design an abort/teardown contract and protect against emissions after chart removal. [R-takeUntil], [R-subscription]
3. If relying on Solux-managed aggregate lifetime, upstream should expose an idempotent disposer that unsubscribes root epics/listeners, ends event streams, releases replayed references and defines post-disposal dispatch. This is especially useful for repeatedly mounted chart instances and SSR requests. Current public APIs do not provide it. [S-config], [S-mw], [S-types]
4. Built-in devtools needs an SSR `typeof window` guard and an owned unsubscribe/disconnect path, or the integration must avoid/replace that enhancer. Define middleware order/final-dispatch behavior and epic error policy before exposing them publicly. No upstream edits or issues were made here. [S-enh], [S-mw]

### Chart API lifetime is a separate ownership boundary

**Fact:** neither `configureStore` nor `SoluxProvider` creates/removes a chart; the inspected wrapper performs those operations in its own component lifecycle. Solux state/subscriptions can therefore outlive a chart API if they remain externally referenced or active. Ashiso likewise keeps application state in a provider while individual chart components create/remove their APIs. [S-config], [S-context], [W-time], [A-app], [A-chart]

**Recommendation:** the later contract should distinguish state lifetime from each concrete chart API lifetime. Define who creates the store/controller, whether it survives API recreation, when API refs become unavailable, and how late commands resolve or reject a removed handle. Native Solid and Solux both need explicit chart/plugin/event teardown; neither a provider nor store disposal is a substitute for `chart.remove()`. This does not choose whether Gurafu should recreate APIs or preserve them for particular prop changes.

### Solux 3 → 4 is a configuration migration

| Concern | Published `3.3.2` / Ashiso usage | Published `4.0.1` and inspected local v4 source |
| --- | --- | --- |
| Store configuration | `rootSlice`, `preloadedState`, top-level `rootEpic`, `container`, `devtools` | `rootSlice`, `preloadedState`, `enhancers`; root slice required even when using epics. [S3-map], [S-config], [S4-types] |
| Async setup | Root epic subscribed inside `configureStore` | `enhancers: [applyMiddlewares([epicMiddleware({rootEpic, container})])]`. [S3-map], [S-mw], [S-enh] |
| Dependency container | Returned as `store.container`; Ashiso destructures workers/facade from it | Container is injected into epic middleware; absent from `Store<S>`. No direct `useSolux().container` migration. [A-chart], [A-replay], [S3-types], [S-types] |
| Context generics | `SoluxProvider<S,C>`, `useSolux<S,C>()`, `Store<S,C>` | One state generic; container not in provider store type. [S3-map], [S-context], [S4-types] |
| Devtools | Top-level options and `filterEvent`; Ashiso excludes live-candle/replay-time events | Explicit `devtools({..., instanceId})` enhancer; no equivalent top-level `filterEvent` in inspected implementation. An added middleware cannot automatically filter an independently installed enhancer's subscription. [A-store], [S3-map], [S-enh], [S4-types] |
| Module distribution | ESM and CommonJS export targets | ESM import export only, one compiled entry and declarations. [S3-npm], [S4-npm], [S-package] |

Ashiso's `createStore` passes `saveStateEpic`, a dependency container, preloaded state and devtools configuration at the top level. Its `useStore = useSolux<RootState, Container>` helper and chart consumers depend on the returned container. Changing only the Solux package version would not preserve those contracts. Ashiso's epic also saves sessions to `localStorage` and displays a toast: it is evidence of application behavior, not a reusable chart persistence requirement. [A-store], [A-utils], [A-chart], [A-epic]

### Published v4 is not identical to local v4; dependencies and registry costs

| Package evidence | Runtime dependencies declared | Peer dependencies declared |
| --- | --- | --- |
| Published `3.3.2` | RxJS `^7.8.1`, Solid `^1.9.3` | RxJS `^7.8.1`. [S3-npm] |
| Published `4.0.1` | RxJS `^7.8.2`, Solid `^1.9.5`, Radash `^12.1.0`, ts-pattern `^5.6.2` | RxJS `^7.8.2`, Solid `^1.9.5`. [S4-npm] |
| Local manifest `4.0.1` at `f872304` | Remeda `^2.32.0` replaces Radash; RxJS `^7.8.2`, Solid `^1.9.10`, ts-pattern `^5.9.0` | RxJS `^7.8.2`, Solid `^1.9.9`. [S-package] |

**Fact:** core `configureStore` uses RxJS even without epic middleware. Utility cloning/omission also runs during store construction. Adding Solux is therefore a runtime/dependency choice even if its store is hidden; native Solid is already present in Gurafu. ts-pattern is used by devtools, whose actual retained cost depends on bundler tree shaking. No compressed bundle-size claim is established here. Both published/local v4 declarations expose `EnhancerOptions` from `@redux-devtools/extension`, while their manifests list that package only as a development dependency: verify declaration resolution in a clean consumer, especially with `skipLibCheck: false`. [S-config], [S-enh], [S-package], [S4-npm], [S4-types], [G-package]

**Fact:** published v4 takes the enhancer snapshot with Radash `clone`, whose `12.1.0` implementation copies own properties shallowly. Local code uses Remeda `clone`, documented to deep-copy supported data types but not arbitrary class instances. Neither fixes shared live initial-state identity, and neither is a chart-handle serialization contract. Devtools JSON state restoration is also unsuitable for reconstructing live chart APIs. [S4-map], [Radash-clone], [S-config], [Remeda-clone], [S-enh]

**Recommendation:** keep mutable `IChartApi`/`ISeriesApi`/pane/plugin handles in opaque signals or closures with explicit owner cleanup. Store serializable intent/read-model data separately: visibility, theme preferences, selection, replay intent/status as eventually specified. Solid stores deliberately wrap plain objects/arrays, so do not assume any arbitrary API object will remain untouched in a store. Native Solid needs this same boundary. [D-store], [L-chart-impl], [S-config]

**Recommendation:** if chosen for registry code, declare dependencies on the actual registry items that import them and verify a clean Solid consumer with one resolved Solid runtime, no app aliases/routes and no implicit app Solux provider. Do not copy current local source while claiming it is the published `4.0.1` artifact. A future upstream release would be needed to publish local changes and any fixes; exact version selection remains a human decision. [G-readme], [G-registry], [S-package], [S4-npm]

## Fair comparison for the later state-model decision

The options below are alternatives to evaluate, not a ranking or an adoption choice. Costs follow from the inspected store/context and dependency contracts above. [S-config], [S-context], [S-mw], [S-enh], [G-package]

| Candidate | What it offers | Cost / contract to settle |
| --- | --- | --- |
| Native Solid signals/store + chart-owned context | Existing reactive runtime; opaque handle signals; fine-grained state; owner-scoped effects/cleanup; can expose commands without exposing storage | Gurafu must design commands/transitions, event notifications and any async cancellation. Solid alone does not supply Solux's replaying event stream, epic pipeline, entity helpers or devtools integration. [D-store], [D-reactive], [S-index] |
| Internal Solux, public chart controller | Typed events/slices, dispatch subscriptions and optional epics; familiar relationship to Ashiso; consumers need not know Solux store shape | Adds runtime dependencies; factory isolation and teardown still necessary. Private Gurafu context can avoid shadowing consumer Solux context. Public controller hides storage but not installation/bundle cost. [S-config], [S-context], [S-mw], [S-package] |
| Optional Solux adapter/example around a native/controller API | Existing Solux applications map their state/events onto chart inputs and commands; non-Solux consumers can omit adapter | Adapter must define loop prevention, event directions and ownership of shared state. It is only truly optional if the core neither imports Solux nor exposes Solux-specific types/providers. [S-context], [S-types], [G-readme] |
| Public required Solux store/provider contract | Consumers can directly compose slices/events/middleware and observe the same model | Couples consumers to Solux version, state/event schema, context/provider precedence, RxJS types and dispatch/lifetime semantics. Requires migration policy and isolated stores; does not itself provide more charting capability. [S-types], [S-context], [S-mw], [S4-types] |

Solux is built on Solid state; adopting it does not inherently create a performance improvement or isolation guarantee. Native Solid can also use centralized transitions and explicit commands. Conversely, replacing an existing event/epic architecture with native primitives requires rebuilding or deliberately excluding those facilities. Neither alternative settles feature ownership. [S-config], [S-types], [D-store]

## Accounting for the reusable Ashiso experience

These observations identify API pressures only. They do not assign final ownership of features that other decision tickets must settle.

| Observed Ashiso behavior | Concrete state/API pressure for the later spec |
| --- | --- |
| Candle/volume series, attached indicator primitives, indicator toggles and legend previews | Addressable series/indicators; visibility, data and hover read models; extension lifecycle. A Solux `sessionId` is not intrinsically required. Ashiso includes Bollinger Bands, phases, volatility cycle and volume-related previews. [A-chart], [A-legend], [A-primitive] |
| Replay click selection, play/pause, speed, current time, latest-time stop | Explicit mode/selection/time commands and status; timer cancellation; data replacement versus latest-bar update. Ashiso elects the lowest timeframe to drive a session timer, which is application coordination rather than proof that a chart should own a global clock. [A-replay], [A-backtest] |
| Date picker and return-to-now control | Time-navigation intent, bounds supplied by the application, and handling data not yet available. Contract onboard date currently comes from application state. [A-date] |
| Reactive theming and crosshair presentation | Reactive chart/series options and a clear mapping from application theme to chart styles; no need to import Ashiso's color-mode provider. [A-chart] |
| Draggable/collapsible controls, chart visibility and layouts | Composable UI/read models; layout and separate-chart visibility must be distinguished from native pane visibility. [A-controls], [A-layout] |
| Crosshair sharing across timeframe charts | Access to events and chart commands can support a consumer example; no built-in multi-chart coordination belongs in Gurafu. [A-layout], [Map] |
| Worker analysis, live exchange subscriptions and saved sessions | Supply derived data and external commands; keep feeds, caches, workers and trading-session persistence application-owned. The chart's destruction must still release any consumer subscriptions it explicitly owns. [A-app], [A-chart], [A-epic], [Map] |

## Verification performed and reproducible evidence

Probes ran outside the repo on Node `26.13.0`; local Solux TypeScript modules were transpiled with Bun `1.4.4` to a temporary directory using `--external '*'`. Runtime dependencies were exact published Solid `1.9.18`, RxJS `7.8.2`, Radash `12.1.0` (published v4), Remeda `2.32.0` (local), ts-pattern `5.9.0`, and tslib `2.8.1`. These satisfy the v4 dependency ranges examined. No browser, canvas rendering, production component or repo dependency installation was involved.

| Probe | Result |
| --- | --- |
| Reuse slice across two stores; dispatch only A | Both counters became 1; both `state` references were identical. Reproduced in v3, published v4, local v4. |
| Fresh slice and nested state per store | A became 1, B stayed 0. Published/local v4. |
| Shallow-copy preloaded state twice | Other store's top-level counter stayed 0; nested counter became 1. Published/local v4. |
| Solid effect reads counter, then owner disposed | Observations `[0,1]`; further dispatch did not rerun disposed effect. Published/local v4. |
| Subscribe after prior dispatch, then `.unsubscribe()` | Immediate replay once; later dispatch produced no listener delivery. Published/local v4. |
| Subject-backed root epic, dispose Solid owner, emit | Store still updated and listener ran. Published/local v4. |
| Wrap epic output in `takeUntil(done$)`, signal done, emit | No state update after cancellation. Published/local v4. |
| `[logger, epic]` versus `[epic, logger]` | First logged trigger plus epic output; second logged only trigger. State updated in both. Published/local v4. |
| Invoke built-in devtools with no `window` | `ReferenceError`. Published/local v4. |
| Plain Node import of published wrapper `0.4.0` | Client-only API server error at module-level `template` in `dist/index.js:125`. Used Solid `1.9.18`, seroval `1.6.11`, seroval-plugins `1.6.8`, Lightweight Charts `5.2.1`, fancy-canvas `2.1.0`. |

Minimal reproduction of the two material Solux caveats, using the published v4 package in an isolated environment and `node --conditions=browser probe.mjs` (the browser condition selects Solid's reactive runtime without opening a browser):

```js
import assert from 'node:assert/strict';
import { createRoot } from 'solid-js';
import { Subject, takeUntil } from 'rxjs';
import {
  configureStore, createSlice, createEvent,
  applyMiddlewares, epicMiddleware,
} from '@carere/solux';

const inc = createEvent('inc');
const freshSlice = () => createSlice({
  initialState: { n: 0, nested: { n: 0 } },
  handlers: b => b.addHandler(inc, state => {
    state.n++;
    state.nested.n++;
  }),
});
const rootSlice = freshSlice();
const a = configureStore({ rootSlice });
const b = configureStore({ rootSlice });
a.dispatch(inc());
assert.equal(a.state, b.state);
assert.equal(b.state.n, 1);

const source = new Subject();
let store;
const dispose = createRoot(dispose => {
  store = configureStore({
    rootSlice: freshSlice(),
    enhancers: [applyMiddlewares([
      epicMiddleware({ rootEpic: () => source }),
    ])],
  });
  return dispose;
});
dispose();
source.next(inc());
assert.equal(store.state.n, 1); // Solid disposal did not stop the epic
source.complete();           // release the probe's external source

const done = new Subject();
const input = new Subject();
const guarded = configureStore({
  rootSlice: freshSlice(),
  enhancers: [applyMiddlewares([
    epicMiddleware({ rootEpic: () => input.pipe(takeUntil(done)) }),
  ])],
});
done.next(); // completion alone would not trigger takeUntil
done.complete();
input.next(inc());
assert.equal(guarded.state.n, 0);
input.complete();
```

The wrapper's existing tests cover mounting, options, resize, series/data, primitives, markers and cleanup. They do not establish the guarantees questioned here merely by passing; no upstream test suite was run in this investigation. [W-tests]

## Questions to hand to later decision tickets

1. Which reusable capabilities belong in chart primitives, optional composable UI, or application-owned adapters? Account for every Ashiso row above without importing its session model.
2. What is the public contract: controlled props/callbacks, imperative controller, public context, or a combination? What may consumers mutate directly, and how is later declarative data reconciled?
3. How are native panes identified, retained empty, reordered and destroyed? Does moving a series preserve its identity? Are indices exposed as positions or treated as identities?
4. Which data operations are explicit, and how are replay rewinds/resets, historical corrections, marker changes and indicator data kept coherent without full resets on every tick?
5. Is Solux internal, an optional adapter, or a public dependency? Which **published** version/release would be supported, and would upstream disposal/packaging changes precede adoption? No choice is made here.
6. Who owns store creation, fresh initial-state graphs, cancellation, devtools and post-destruction commands? Must the core be usable under an existing application Solux provider without shadowing it?
7. What server-import/render/hydration contract is promised to registry consumers, including fallback sizing? Will it be verified outside TanStack Start?
8. Are custom-series generics, marker plugins, pane primitives and indicator controllers public extension points? What handle/ref invalidation and event-handler replacement semantics must they honor?

## Concrete verification scenarios for the future specification

These are proposed acceptance scenarios, **not tests claimed to pass**:

1. **Isolation:** mount two chart instances from the same component definitions, plus two SSR requests. Change A's theme, pane/indicator visibility and replay intent; B and the other request stay unchanged. Repeat with shared slice definitions and nested preloaded state to catch aliasing.
2. **Provider composition:** place Gurafu beneath an application Solux provider; nest two chart scopes; omit the chart provider; test an adapter with incompatible store shape. Verify intentional scope, useful errors and no accidental application-store replacement.
3. **Lifetime:** mount/remove/recreate repeatedly while timers, chart callbacks, epics and a pending async result exist. After removal, no work targets removed APIs, all owned subscriptions/timers stop, and teardown is idempotent. Retained external controllers reject or safely ignore later commands according to the chosen spec.
4. **Reactive handlers/options:** replace callback functions and arrays after mount, remove them, update deep option fields and switch theme. Observe exactly the chosen callbacks and preserve chart identity when configuration does not require recreation.
5. **Data ownership:** snapshot → latest-bar update → append → historical correction → replay rewind → reset → return to live. Verify markers and every indicator use the intended data generation; replacing a callback/marker factory must not unexpectedly reset the full series.
6. **Pane identity:** put multiple series and one shared pane primitive in a native pane; remove one series, remove the last, retain an empty pane if requested, reorder panes, move a series and insert a new pane. Verify one attachment owner, current indices, stable intended identities and no detached primitive still receiving updates.
7. **Extensions/types:** compile valid candle/line/custom-series data with exact option types and reject mismatched types; test extended custom data/options, marker-handle update/detach and ref invalidation. A `type` or renderer change must follow the documented recreate/immutable contract.
8. **SSR and hydration:** import distributed sources server-side with no `window`/`document`; render fallback, hydrate and mount; enable/disable devtools; verify chart creation occurs only on the client and clean consumer declaration checking succeeds. Test separate Solid apps, including a non-TanStack consumer.
9. **UI behavior:** toggle each Ashiso indicator with legend hover values, select dates outside current loaded range, play/pause/change replay speed and return to now; supply bounds/data from a mock application adapter. Check no feed/cache/session dependency enters registry code.
10. **Consumer coordination example:** connect two separate charts through application callbacks/controllers, then unmount one. Verify loop prevention and cleanup in the example while each chart remains independently usable. Native pane operations must not be confused with this example.
11. **Cost and event ordering:** build minimal native/internal/optional-adapter consumers with a pinned bundler, record retained bytes/modules and dependency resolution; exercise emitted epic events, middleware `api.dispatch`, errors and cancellations. Assert actual traversal/error semantics rather than assuming Redux behavior.

## Limits

This is source/package inspection plus targeted non-DOM runtime evidence. It does not benchmark rendering, memory, replay throughput or bundle size; prove hydration, pane reorder correctness or tooltip context propagation; exhaustively inventory every Ashiso UX edge case; or certify the wrapper against `5.2.1`. The local and published Solux v4 implementations differ despite equal version strings. Future upstream updates require rechecking the exact chosen version. No product decision, production implementation, dependency modification, PR or upstream change is included.

## Primary references

[Map]: https://github.com/carere/gurafu/issues/3
[G-package]: https://github.com/carere/gurafu/blob/39fe95bf83e76f825a57c3b00de3d745a3ed15bc/package.json
[G-readme]: https://github.com/carere/gurafu/blob/39fe95bf83e76f825a57c3b00de3d745a3ed15bc/README.md
[G-registry]: https://github.com/carere/gurafu/blob/39fe95bf83e76f825a57c3b00de3d745a3ed15bc/src/registry/kobalte/registry.json
[W-package]: https://github.com/dsnchz/solid-lightweight-charts/blob/8ba4d2a22d12a2b72297f3a353f8f6260e6d8970/package.json
[W-readme]: https://github.com/dsnchz/solid-lightweight-charts/blob/8ba4d2a22d12a2b72297f3a353f8f6260e6d8970/README.md
[W-time]: https://github.com/dsnchz/solid-lightweight-charts/blob/8ba4d2a22d12a2b72297f3a353f8f6260e6d8970/src/charts/TimeChart.tsx
[W-tests]: https://github.com/dsnchz/solid-lightweight-charts/blob/8ba4d2a22d12a2b72297f3a353f8f6260e6d8970/src/__tests__/TimeChart.test.tsx
[W-index]: https://github.com/dsnchz/solid-lightweight-charts/blob/8ba4d2a22d12a2b72297f3a353f8f6260e6d8970/src/index.ts
[W-types]: https://github.com/dsnchz/solid-lightweight-charts/blob/8ba4d2a22d12a2b72297f3a353f8f6260e6d8970/src/types.ts
[W-custom]: https://github.com/dsnchz/solid-lightweight-charts/blob/8ba4d2a22d12a2b72297f3a353f8f6260e6d8970/src/helpers/createCustomSeries.ts
[W-utils]: https://github.com/dsnchz/solid-lightweight-charts/blob/8ba4d2a22d12a2b72297f3a353f8f6260e6d8970/src/helpers/utils.ts
[W-tooltip]: https://github.com/dsnchz/solid-lightweight-charts/blob/8ba4d2a22d12a2b72297f3a353f8f6260e6d8970/src/helpers/createTooltip.tsx
[W-build]: https://github.com/dsnchz/solid-lightweight-charts/blob/8ba4d2a22d12a2b72297f3a353f8f6260e6d8970/tsup.config.ts
[W-lock]: https://github.com/dsnchz/solid-lightweight-charts/blob/8ba4d2a22d12a2b72297f3a353f8f6260e6d8970/bun.lock
[S-package]: https://github.com/carere/solux/blob/f872304ccc2c453d8e7db2454a06f2fdff43c0ab/package.json
[S-config]: https://github.com/carere/solux/blob/f872304ccc2c453d8e7db2454a06f2fdff43c0ab/src/configureStore.ts
[S-context]: https://github.com/carere/solux/blob/f872304ccc2c453d8e7db2454a06f2fdff43c0ab/src/context.tsx
[S-tests]: https://github.com/carere/solux/blob/f872304ccc2c453d8e7db2454a06f2fdff43c0ab/test/unit/subscribingToStore.spec.ts
[S-slice]: https://github.com/carere/solux/blob/f872304ccc2c453d8e7db2454a06f2fdff43c0ab/src/createSlice.ts
[S-combine]: https://github.com/carere/solux/blob/f872304ccc2c453d8e7db2454a06f2fdff43c0ab/src/combineSlices.ts
[S-types]: https://github.com/carere/solux/blob/f872304ccc2c453d8e7db2454a06f2fdff43c0ab/src/types.ts
[S-mw]: https://github.com/carere/solux/blob/f872304ccc2c453d8e7db2454a06f2fdff43c0ab/src/middlewares.ts
[S-enh]: https://github.com/carere/solux/blob/f872304ccc2c453d8e7db2454a06f2fdff43c0ab/src/enhancers.ts
[S-epics]: https://github.com/carere/solux/blob/f872304ccc2c453d8e7db2454a06f2fdff43c0ab/src/combineEpics.ts
[S-index]: https://github.com/carere/solux/blob/f872304ccc2c453d8e7db2454a06f2fdff43c0ab/src/index.ts
[A-package]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/package.json
[A-store]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/store/index.ts
[A-app]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/app.tsx
[A-chart]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/index.tsx
[A-replay]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/mode/replay.ts
[A-utils]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/utils/index.ts
[A-epic]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/store/epics.ts
[A-legend]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/legend/graph-legend.tsx
[A-primitive]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/primitives/volume-ma-primitive.ts
[A-backtest]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/controls/back-test.tsx
[A-date]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/controls/date-selector.tsx
[A-controls]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/controls/index.tsx
[A-layout]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/layouts/index.tsx
[L-series]: https://github.com/tradingview/lightweight-charts/blob/v5.2.1/src/api/iseries-api.ts
[L-pane]: https://github.com/tradingview/lightweight-charts/blob/v5.2.1/src/api/ipane-api.ts
[L-chart]: https://github.com/tradingview/lightweight-charts/blob/v5.2.1/src/api/ichart-api.ts
[L-markers]: https://github.com/tradingview/lightweight-charts/blob/v5.2.1/src/plugins/series-markers/wrapper.ts
[L-adapter]: https://github.com/tradingview/lightweight-charts/blob/v5.2.1/src/plugins/series-primitive-adapter.ts
[L-chart-impl]: https://github.com/tradingview/lightweight-charts/blob/v5.2.1/src/api/chart-api.ts
[W-npm]: https://registry.npmjs.org/@dschz%2Fsolid-lightweight-charts/0.4.0
[W-dist]: https://unpkg.com/@dschz/solid-lightweight-charts@0.4.0/dist/index.js
[S3-npm]: https://registry.npmjs.org/@carere%2Fsolux/3.3.2
[S3-map]: https://unpkg.com/@carere/solux@3.3.2/dist/index.mjs.map
[S3-types]: https://unpkg.com/@carere/solux@3.3.2/dist/index.d.ts
[S4-npm]: https://registry.npmjs.org/@carere%2Fsolux/4.0.1
[S4-map]: https://unpkg.com/@carere/solux@4.0.1/dist/index.js.map
[S4-types]: https://unpkg.com/@carere/solux@4.0.1/dist/index.d.ts
[S-npm]: https://registry.npmjs.org/@carere%2Fsolux
[L-npm]: https://registry.npmjs.org/lightweight-charts/5.2.1
[D-npm]: https://registry.npmjs.org/solid-js/1.9.18
[D-store]: https://unpkg.com/solid-js@1.9.18/store/dist/store.js
[D-reactive]: https://unpkg.com/solid-js@1.9.18/dist/solid.js
[D-server]: https://unpkg.com/solid-js@1.9.18/web/dist/server.js
[R-takeUntil]: https://unpkg.com/rxjs@7.8.2/dist/esm/internal/operators/takeUntil.js
[R-subscription]: https://unpkg.com/rxjs@7.8.2/dist/esm/internal/Subscription.js
[Radash-clone]: https://unpkg.com/radash@12.1.0/dist/esm/object.mjs
[Remeda-clone]: https://github.com/remeda/remeda/blob/v2.32.0/packages/remeda/src/clone.ts
[D-server-core]: https://unpkg.com/solid-js@1.9.18/dist/server.js
