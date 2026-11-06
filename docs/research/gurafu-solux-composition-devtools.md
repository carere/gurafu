# Solux composition and unified devtools tracing

Research for [Investigate Solux store composition and unified devtools tracing](https://github.com/carere/gurafu/issues/14), supporting [Choose Solux’s role and chart state ownership](https://github.com/carere/gurafu/issues/8). Investigated 2026-11-06. **Feasibility evidence, not an architecture choice or a product implementation.**

## Answer

**Yes, Gurafu can retain isolated per-chart Solux stores and make their dispatched events/state inspectable. A unified application/chart timeline is feasible through explicit observation, without imposing an application-wide state owner. That unified tracing bridge does not exist in the examined Solux releases.** A single composed Solux root is another feasible option, but requires deliberate routing and lifecycle design; nested providers alone do not create it. [S-config], [S-combine], [S-context], [S-enh], [D-api]

Solid’s ability to share or nest reactive state **does not establish safe Solux composition**. It can share the underlying state while leaving separate dispatcher, middleware and subscription pipelines. A child dispatch can change what the parent sees without producing a parent event. Probes reproduced this in both published and local Solux. Combining slices before store creation is a different operation, with one root dispatch pipeline; it broadcasts each event to all slice handlers unless those handlers filter it. [S-config], [S-combine], [Solid-stores], [Solid-runtime]

“Every interaction” needs an explicit coverage contract. Solux’s base subscription observes events that reach its core dispatch, including middleware-produced events that an outer dispatch wrapper can miss. It does not automatically observe application prop changes, external Solid mutations, chart API calls, DOM gestures, cancelled middleware inputs, devtools state writes or successful chart effects. Those need instrumentation at their actual boundaries. **Log/state inspection is attainable; reproducing chart effects, authoritative external inputs and cross-store time travel is a separate, substantially larger contract.** [S-config], [S-enh], [S-mw]

This preserves the accepted constraints: automatic isolated chart scopes; application-authoritative supplied data/theme/replay; controlled/uncontrolled reusable UI; consumer coordination between separate chart instances. This report neither selects Solux over native Solid nor reopens those ownership constraints. [Context]

## Versions and evidence

| Input | Exact evidence examined |
| --- | --- |
| Gurafu checkout | Base `efc017386a1c19f9325f7e03058c891753568899`; repository/domain guidance and ticket context. Only this Markdown artifact is changed. |
| Prior research | [Solid chart API patterns and Solux state-model research](https://github.com/carere/gurafu/blob/a7e14e866b14c5edee70af166fcf951c980cd9f4/docs/research/gurafu-solid-api-and-solux.md), read in full; previous v3 evidence is background, not a new v3 test here. |
| Published `@carere/solux` | **`4.0.1`**, also registry `latest` when queried. Tarball SHA-1 `11357526f2d5951004e29e8c842e7a949bed3db6`; SHA-512 `gvBdl1gtL2WyhuVNtlDr7Qq2slGZD6y4cCFAgUQAnfg7UC2jORKAMNaYWA93602/jvsgZNm6Uwcs4oqroqGFPw==`. Both hashes verified. Metadata has no `gitHead`; do not assign it the local commit. Examined manifest, declarations, ESM and embedded original sources. [P-meta], [P-map], [P-dist], [P-types] |
| Local Solux | `/Users/carere/Projects/oss/solux`, clean at **`f872304ccc2c453d8e7db2454a06f2fdff43c0ab`**, manifest `4.0.1`. Read-only inspection and temporary transpilation. Composition, slice, event, middleware and devtools source files match published source-map contents byte-for-byte. `configureStore` instead imports `clone`/`omit` from **Remeda**, where the release imports **Radash**. [S-package], [S-config], [P-map] |
| Solid | Published **`1.9.18`** browser reactive/store runtime and default server exports; official store documentation pinned to docs commit `9a9d77a75642f6e2ab68d80b0081d45ad3424b13`. [Solid-package], [Solid-runtime], [Solid-server], [Solid-stores] |
| Redux DevTools | Official repository at **`0f17f157868defa9e1190ae4c60edc6a1f9fd047`**: direct connection API, monitor/background/content-script routing, instance identity and feature options. This is source evidence, **not the identity of an installed browser extension tested here**. [D-api], [D-id], [D-methods], [D-options], [D-monitor], [D-relay] |
| Ashiso context | Read-only store factory at `1b716f85bea71a703330cdae74b83f82732812a9`: v3-style `rootEpic`/`container`/`devtools` options and explicit exclusion of current-candle/current-replay-time events. It is neither a v4 integration example nor complete interaction logging. [A-store] |

Runtime tools: Node **`24.22.1`**, npm **`11.19.1`**; exact probe dependencies Solux `4.0.1`, Solid `1.9.18`, RxJS `7.8.2`, Radash `12.1.0`, Remeda `2.32.0`, ts-pattern `5.9.0`, esbuild `0.25.12`, esbuild-plugin-solid `0.6.0`. Dependencies and generated probe output lived in an OS temporary directory, outside Gurafu and the source repositories. Browser-condition Node execution selects Solid’s client reactivity; it does **not** run a browser.

The local manifest changes dependency ranges too: published Solid dependency/peer `^1.9.5`, local dependency `^1.9.10` and peer `^1.9.9`; local ts-pattern `^5.9.0` versus published `^5.6.2`. Published declarations import `EnhancerOptions` from `@redux-devtools/extension`, although its manifest lists that package only in dev dependencies. Clean consumer declaration checking remains unverified. Equal manifest version strings do not make the source checkout a published patch. [S-package], [P-package], [P-types]

## Four operations that must stay distinct

| Operation | What exists now | Consequence |
| --- | --- | --- |
| Nested `SoluxProvider`s | One context token per loaded Solux module; `useSolux` resolves the nearest supplied store. | Changes dependency lookup. No state merge, action forwarding, inherited middleware, lifecycle registration or devtools grouping. |
| `combineSlices({ app, charts, … })`, before `configureStore` | Returns a slice whose state nests child initial states and whose handler invokes each child handler for every event. It accepts **slices**, not stores. | One root dispatcher/subject and one devtools connection can observe root dispatches. Chart targeting is application logic, not implicit in a slice key. |
| Wrapping **already-live** stores or their `.state` | No exported `combineStores`/store-adoption utility. Shared Solid proxies/raw objects can be placed under another state tree. | Reactive aliasing does not join existing subjects, middleware or epics. Dispatching through one pipeline leaves other pipelines uninformed. Passing a store to `combineSlices` fails at runtime (`getInitialState` missing). |
| Aggregating observations of independent stores | Public `.state` plus `.subscribe()` are sufficient building blocks; the extension supports manually sent action/state pairs. | A custom, log-only bridge can retain isolation and publish a detached aggregate projection. It creates an observer, not a new authority or transactional root. |

These distinctions follow from the actual exports and closures, not from the package’s Flux terminology. [S-index], [S-types], [S-config], [S-combine], [S-context], [D-methods]

### Why shared Solid stores are insufficient

Official Solid documentation explicitly permits `createStore(store.users)` as a nested setter/view of an existing store. Its runtime unwraps supplied proxies and caches proxies on raw objects. That is useful intentional shared reactivity. It supplies no Solux event ownership or middleware routing. [Solid-stores], [Solid-runtime]

In the probe, a parent slice used `{ child: childStore.state }` as initial state. `childStore.dispatch(inc())` changed `parent.state.child.n`, but the parent’s Solux subscriber received **zero** events. Dispatching a parent handler that changed that child changed `childStore.state.n`, but the child subscriber received no corresponding new event. Existing reactive readers can react in both cases; event histories diverge. Merely adding parent devtools cannot recover the missing dispatch history. [S-config]; Probe A below.

Isolation also needs **fresh nested state graphs**. `createSlice().getInitialState()` returns its original object; `combineSlices` reuses an accumulator and child initial objects; `configureStore` gives the initial graph directly to Solid. The enhancer’s `clone(initialState)` snapshot is created afterward and does not isolate live state. Shared slices produced identical live store references in the probe; shallow preloaded copies still shared nested state. Fresh per-instance slice/state factories isolated stores. A fresh `combineSlices` around the same reused child slices is insufficient. Apply this per chart instance and per server request. [S-slice], [S-combine], [S-config], [P-map]

**Published/local difference with observable consequences:** Radash `12.1.0` clones own properties shallowly; Remeda `2.32.0` deep-clones supported nested data. After incrementing both a top-level and nested counter, devtools `RESET` returned published state to `{n:0,nested:{n:1}}`, but local state to `{n:0,nested:{n:0}}`. The published enhancer’s supposed initial nested snapshot had already been mutated. This does not fix live-store aliasing in either implementation. [Radash-clone], [Remeda-clone], [S-config], [P-map]; Probe D.

Do not turn imperative chart/series/native-pane/plugin handles into serializable state to make them appear under a common root. Keep handles, subscriptions, disposers and DOM objects in a per-instance controller/container; expose stable IDs and descriptive status. Serialization can describe such resources but cannot recreate their identity or canvas behavior. Extension serialization support does not change that. [D-options], [S-types]

### Single-root action routing and dynamic charts

`combineSlices({ a: chartSliceA, b: chartSliceB })` does not interpret `chartId: "a"`: the probe incremented **both** slices when both handled the same event type. Each independent store may safely use the same local event type because dispatch selects a store. Once combined into a root, either slice handlers explicitly filter an envelope’s instance ID, or an explicit root handler routes into `state.charts[id]`. The same rule must apply to outputs of asynchronous work; a completion without its chart identity can target the wrong instance. [S-combine], [S-slice], [S-mw]

The slice map’s keys are captured by `Object.keys` when `combineSlices` runs. Adding `map.b` later did not add a slice to its initial state or traversal. There is no dynamic reducer-injection/store-adoption API in the examined exports. Existing slice definitions are read by their captured keys, but mutating that map is not a documented lifecycle facility. [S-combine], [S-index]

**Feasible custom design, not a supplied feature:** a root slice with serializable `charts: Record<ChartId, ChartState>` and explicit register/update/remove handlers. Probe A implemented a small router that added A/B, updated only A and ignored A after removal. That proves this can be authored with the `Slice` contract; it does not solve chart-controller creation, ID reuse, epic routing, teardown, controlled inputs or restoring a removed chart. Use mount-generation IDs or an equivalent stale-result guard if logical IDs can be reused. Keep handles in a separate registry. [S-types], [S-config]

This option can compose with a consumer’s application root **only if that consumer elects to integrate the slices/routing before creating that root**. It cannot transparently graft isolated, already-running chart stores into an existing application dispatcher. Making it mandatory would change the accepted automatic-scope/no-required-application-root constraint; choosing such a public integration belongs to the decision ticket.

### Existing application providers

An internal `<SoluxProvider store={chartStore}>` shadows an existing application provider for every descendant using the same Solux context token, including consumer-provided UI. `useSolux<S>()` supplies a type cast, not runtime validation of which shape was found; outside a provider it can return `undefined`. Multiple installed copies can instead have different context tokens. Probe A verified nearest-provider lookup and restoration after leaving the inner provider, without rendering DOM. [S-context], [P-map]

**Possible integration seam, not implemented here:** a Gurafu-owned chart context carrying a controller/explicit chart store, while leaving the application’s Solux provider visible. Alternatively accept an explicit store/adapter and document provider precedence. An isolated chart store does not require exposing a nested public Solux provider. The bridge can register store references explicitly; provider ancestry is not an observation registry.

## Concrete observability options

These are alternatives for the human decision, not a ranking.

| Option | Available building blocks / added work | Visibility and limits |
| --- | --- | --- |
| Independent chart Solux stores, built-in enhancer per chart | Exists today; fresh state factories; browser-only enhancer selection. Unique `name` and `instanceId` per mount. | Per-instance action/state inspection in separate extension instances. No unified timeline; current enhancer has teardown and command limitations below. |
| Independent stores, custom observation bridge | Public subscriptions and extension `connect/init/send` exist. **Gurafu-owned design/code required** for registry, snapshots, lifecycle, ordering, coverage and feature restriction. | One observer connection can show `{ application, charts: { … } }` and scoped event envelopes without owning those stores. App events require app opt-in/adapter. Start log-only; no automatic coordinated replay. |
| One Solux root with composed slices or a chart registry | Static `combineSlices` exists. **Custom routing/registry and controller adapters required** for dynamic charts and external inputs. | Root dispatches share a stream; direct writes and imperative effects still need coverage. Changes ownership and consumers’ integration obligations; it is not a transparent composition of live stores. |
| Native Solid chart controllers plus the same tracing boundary | Solid and extension direct API exist. **Custom semantic event instrumentation/bridge required**. | Can offer the same log/state inspection if commands, external inputs and results are instrumented. There is no intrinsic requirement that the observed engine be Solux. Solux additionally supplies its core event stream and optional epics. |

[S-config], [S-combine], [S-enh], [S-types], [D-api], [D-methods]

### What a log-only aggregation bridge would need

The following is a **hypothetical production contract**. Probe B exercises only the minimal fan-in and controlled-input mechanisms.

1. **Explicit registration:** one entry per mount-generation ID, containing an observer-safe state projection and an owned RxJS subscription. Record scope registered/removed events. Include application state/events only through consumer registration; never appropriate consumer coordination. A shared debug service may observe several charts without sharing their state authority.
2. **Snapshots at observation time:** Solux subscriptions emit the live proxy, not immutable history. Project to plain data and detach each snapshot before retaining/sending it. `unwrap` alone exposes raw live data, not a historical copy. Register a baseline snapshot, then suppress/mark the synchronous `ReplaySubject(1)` replay as a baseline rather than mislabelling an old action as a new interaction. Only the last dispatch is retained by Solux; earlier actions cannot be recovered on late attachment. [S-config], [Solid-runtime]
3. **Identity and ordering:** observer-local sequence, scope/mount ID, source event type, origin and optional interaction/parent correlation IDs. A sequence describes callback arrival order, not atomic cross-store transactions or global causal order. Snapshotting all stores after each callback can expose intermediate coordination states; reentrant dispatches and async outputs need causality metadata if required.
4. **Coverage boundaries:** capture dispatch outcomes using the base `.subscribe` path; separately capture user intent, accepted external inputs and chart effect completion/error/cancellation when those are part of “every interaction.” A rejected request can be observable without changing state. Sampling/throttling crosshair/move/tick events or omitting large data must be an explicit debug policy, not a claim of exhaustive capture.
5. **Safe observation:** avoid forwarding an observed event back into its originating store. Keep observation subscribers passive and non-throwing, and avoid retaining chart handles. Bound history/payload sizes and redact consumer data where needed. Derived indicators/series data can use IDs, revisions, hashes and counts for ordinary inspection; those summaries are not replay inputs.
6. **Read-only monitor contract:** disable dispatch/jump/skip/reorder/import/lock features that the bridge cannot honor; implement only documented observer behavior. Restrict the extension feature UI **and** validate/ignore incoming commands in the bridge. No claim of distributed restore or replay.
7. **Owned teardown:** unregister a chart before callbacks can target removed resources, unsubscribe its Solux listener, cancel owned async work and release references. Release the bridge’s own connection listener when its lifetime ends. Do not call the extension’s global `disconnect()` from a chart and disrupt a consumer’s unrelated connection. [D-api], [D-methods]

Probe B registered two independent chart stores and an application store, suppressed a pre-registration replay, captured detached combined snapshots, and stopped observation after unregister. It did **not** implement a reusable Gurafu bridge or test a browser monitor.

### Middleware-generated actions and completeness

Enhancers apply in array order. `applyMiddlewares` uses a left reduction: later middleware entries wrap earlier entries. The middleware API captures the incoming store’s dispatch before that chain is assembled; it is not rebound to final dispatch. `epicMiddleware` subscribes its output to its own dispatch closure, which calls its captured `next` and then its event subject. It does not route all output through every later wrapper. [S-config], [S-enh], [S-mw]

Reproduced in both implementations:

- `[logger, epic]`: logger saw trigger and epic output; `[epic, logger]`: logger saw only trigger. The core subscription saw both in either case.
- A middleware calling `api.dispatch(inc())` updated state and reached the core subscription but bypassed its own logger wrapper.
- Installing devtools **before** middleware caused devtools `ACTION` to bypass that later middleware. Installing it after middleware included that chain for the same JSON action.
- A root epic synchronously emitting two events while middleware was installed before devtools left only the **last** startup event available for replay; the devtools enhancer then sent `init(initialState)`, although current state had already advanced.

Thus a wrapper around final `store.dispatch` is insufficient for complete committed-event observation. A core subscription is stronger, but misses events that middleware swallows before `next`, handler failures before publication, pre-attachment history, shared-state writes through another store, and devtools `setState` operations. Subscribe before activating external sources when possible; a custom enhancer can install observation before subsequent middleware, but a production startup/initialization protocol remains to be specified. This is not Redux’s fully rebound dispatch contract. [S-config], [S-enh], [S-mw]

## What the current devtools enhancer actually supports

The README’s feature checklist is broader than a verified chart debugging contract. The enhancer talks to the extension’s **direct connection API**, not the Redux store instrumentation enhancer. The table records Solux behavior under a mocked extension plus official extension source tracing. **No actual extension UI was exercised.** [S-readme], [S-enh], [D-api]

| Message / facility | Examined behavior and practical limit |
| --- | --- |
| Initial state and dispatch logging | Calls `connect(options)`, subscribes to Solux and sends each core event/state, then `init(store.initialState)`. State arguments are live proxies; no Solux-owned history/snapshot or late-attach full-history recovery. |
| Names, grouping and IDs | Passes options through. `name` labels a connection, not a hierarchy. Extension `connect` uses `instanceId` as a listener/connection key. Reusing it is not safe grouping: source assigns `listeners[id] = [rootListener]`, replacing that key’s listeners. Unique names/IDs create separate instances, not one aggregate timeline. One bridge connection is needed for one aggregate history. [D-api], [D-id] |
| `ACTION` | `JSON.parse(payload)` then dispatches through the store captured at enhancer application time. Strict JSON event worked; `{type:'inc'}` threw `SyntaxError`. No action schema validation or catch/error response is installed. The extension Dispatcher can also supply action-creator descriptor objects, which this handler does not evaluate. [D-dispatcher], [D-relay] |
| `COMMIT` | Calls `init(store.state)`. Does not replace the enhancer’s construction-time `initialState`. Probe’s later `RESET` returned to construction state. |
| `RESET` | Calls Solid `setState(initialState)`, then `init(initialState)`. Published shallow snapshots may already contain mutated nested state (Probe D). No Solux dispatch or subscriber/epic notification. |
| `ROLLBACK`, `JUMP_TO_ACTION`, `JUMP_TO_STATE` | Parses `message.state`, calls `setState` directly. Solid reactive effects reran in the probe; Solux event subscribers did not. Root object updates merge supplied top-level keys: a key omitted from the requested historical state remained present. This is not exact root replacement/reconciliation. |
| `IMPORT_STATE` | Selects `computedStates.at(-1).state` regardless of `currentStateIndex`, calls `setState`, then `send(null, nextLiftedState)`. Probe imported the last state even with index zero selected, preserved an omitted extra top-level key and threw on an empty computed-state array. No restore of chart resources or epic history. |
| `TOGGLE_ACTION`, `LOCK_CHANGES`, `REORDER_ACTION` | No handling branch; ignored in the mock. There is no Solux action recomputation/skip engine or effect lock. Extension can adjust monitor history/display independently; that does not implement the corresponding application behavior. [D-monitor] |
| Pause/filters/export | The **extension** connection handles recording pause and filtering; pausing a log does not stop app dispatch/effects. Monitor-side history export is distinct from a custom state/effect replay implementation. No Solux custom `EXPORT` handler exists. Do not extrapolate Redux-only options to this integration. [D-api], [D-options], [D-instances] |
| Serialization and traces | Options are forwarded to the extension, which can sanitize/serialize and capture a call stack when sending. That stack does not automatically encode async cause chains or original chart intent. Solux incoming commands use plain `JSON.parse`, not a matching JSAN/custom-reviver round trip. Handles/functions are not restored as live resources. [D-api], [D-options] |
| Disposal / SSR | Discards store and connection unsubscribe handles; no disposer. `window?.…` still raises `ReferenceError` where `window` is undeclared. Guard enhancer invocation on the client or replace it with an owned safe observer; optional chaining is insufficient. |

All Solux behavior above follows the same enhancer source in the release and local revision. [P-map], [S-enh], [Solid-runtime]; Probe A.

The official protocol and one additional **source-derived risk**, not browser-test results:

- When configured with a nonzero `latency`, extension `connect.send` queues state references in `delayedStates` before serialization. Solux repeatedly sends a mutable proxy, so queued state snapshots can reflect later mutations. An observer should send detached projections or explicitly verify a safe serialization/latency strategy; copied action names alone do not preserve history. [D-api]
- For an ordinary non-Redux direct connection, the extension’s `nonReduxDispatch` supplies the selected serialized snapshot for jumps and rollback; the content script forwards it as `message.state`. This matches Solux’s direct state-write handler. It does not re-execute Solux events or epics. Import transports a lifted history back to the monitor with `send(null, …)`; that mock interaction alone does not certify end-to-end import → jump. Feature availability is initialized when the monitor first sees an instance, so it must be evaluated with its real connection lifecycle. [D-api], [D-instances], [D-monitor], [D-relay], [S-enh]

### Inspecting state versus reproducing a chart

There are at least four separate capabilities:

1. **Inspect a log:** see an intent/event, scope and state projection. This is the feasible baseline.
2. **Inspect a past snapshot:** view stored JSON in the monitor. It need not mutate application state.
3. **Restore declarative model state:** apply a selected snapshot with deliberate exact reconciliation, controlled ownership, dynamic-instance rules and effect suppression/reapplication. Current direct `setState` does not provide this complete contract.
4. **Reproduce chart behavior:** recreate original data revisions, input order, asynchronous completion/cancellation, chart viewport/crosshair, native pane/series/plugin lifetimes and imperative calls. Neither Solux state composition nor its devtools enhancer supplies such a replay engine.

A jump can rerun a Solid effect and cause some chart API calls, while bypassing epics and preserving already-running work. That is an uncontrolled mix of restoring state and producing new effects, not a deterministic replay guarantee. A removed chart is not remounted by restoring its old JSON record. Side effects outside the chart (feeds, persistence, application callbacks) also require explicit replay rules. [S-enh], [S-mw], [Solid-reactive]

For controlled data/theme/replay, the application remains authoritative. A useful trace separates `ui/replay-position-requested` from `external/replay-position-applied`, with optional accepted/rejected/result events. A request may be rejected, delayed, or replaced by the consumer. A chart should not fake acceptance by mutating an authoritative prop mirror. Prop effects can publish applied-input events; store reads inside that instrumentation need suitable tracking boundaries to prevent accidental feedback. Probe B used a Solid signal as authority: request 9 left applied time at 7, then the supplied input changed to 9 and emitted a separate applied event.

Similarly, replacing external data requires provenance/revision and a debug projection policy. Full reproduction needs the actual historical inputs, not just their counts or hashes. Devtools import/jump cannot rewrite consumer-owned signals by itself; any supported command must ask the authority to change, use an explicitly isolated debug sandbox, or be disabled. The same caveat applies regardless of native Solid versus Solux.

## SSR, lifetime and possible upstream work

Plain Node server imports of published Solux and transpiled local modules succeeded, and basic core stores could be constructed with fresh graphs. Invoking built-in devtools without `window` failed in both. This verifies import/core behavior only: **no SSR component rendering, hydration, browser bundle, or TanStack integration test was run**. Never put a mutable chart/app store in a server module singleton or create a browser debug registry across requests. [S-config], [S-context], [S-enh], [Solid-server]; Probe C.

Listener subscriptions return RxJS `Subscription`s and can be `.unsubscribe()`d today. The core has no aggregate `dispose`, but a passive unreferenced store is not proven to leak merely for that reason. Active epics are different: `epicMiddleware` subscribes and discards that subscription, and providers register no cleanup. Disposing a Solid owner did not stop a Subject-backed epic. Wrapping the entire root output in `takeUntil(destroy$)` and **emitting** on that notifier stopped it; completing the notifier alone is not cancellation. Errors and late callbacks still need a policy. Cancelling a subscription does not magically abort non-cancellable external work; teardown must use the appropriate underlying API. [S-types], [S-mw], [S-context], [Rx-cancel]; Probe A.

Built-in devtools also remained subscribed after Solid root disposal; a later dispatch still sent a log, and the mock connection’s unsubscribe handle had never been called. A chart cannot reclaim that discarded handle through the public `Store` API. A custom bridge can own its listener subscriptions and connection teardown instead. [S-config], [S-enh], [D-methods]

**Possible upstream improvements, not current features and not changes made by this research:** guaranteed fresh initial-state factories/cloning; an exposed aggregate disposer/epic cancellation; final-dispatch rebinding and a specified middleware order; an SSR-safe, disposable devtools enhancer; exact snapshot reconciliation and validated command/serialization semantics; package declaration-dependency cleanup. Publishing local Remeda/dependency changes also requires a new release. If Gurafu chooses to rely on those guarantees from Solux itself, it needs an upstream released version and re-verification. [S-package], [S-config], [S-enh], [S-mw], [P-package], [P-types]

**No upstream release is inherently required for log-only observation** using current core subscriptions, fresh state factories, explicit cancellation and a custom owned extension bridge. That work could be Gurafu-owned. Conversely, no published/local evidence supports advertising automatic nested-store aggregation, universal middleware traversal or deterministic chart time travel today.

## Targeted verification

All assertions below passed against **both** exact published `4.0.1` and the temporary build of local `f872304…`.

| Probe | Observed result |
| --- | --- |
| Reuse one slice; shallow preloaded nested state; fresh factories | Reused live state identical; nested alias survived shallow copy; fresh graphs isolated A/B. |
| Combined slices and `chartId`; mutate slice map after combination | Both slices handled the targeted event; new key absent. |
| Pass live store to `combineSlices`; wrap its `.state` in parent | Missing `getInitialState` error; shared changes visible without matching other-store events. |
| Nested providers | Nearest chart lookup; outer app lookup restored; missing provider returned `undefined`. Non-DOM execution. |
| Explicit custom root chart registry | Add A/B, target A only, remove A, ignore later A update. Probe-owned implementation. |
| Middleware wrapper order, epic output, `api.dispatch` | Wrapper coverage varied; core subscriber saw trigger and produced event. |
| Mock `ACTION`, enhancer order | JSON event dispatched; later-installed middleware was bypassed when enhancer captured earlier dispatch. |
| Mock commit/reset/rollback/jumps/import | Direct mutations, no Solux event notifications; reactive readings `[0,1,5,0,3]`; omitted extra key preserved; import chose last state. |
| Mock unsupported commands / malformed inputs | Toggle/lock/reorder ignored; non-JSON action and empty lifted import threw. |
| Startup epic emits twice before devtools | Only last event replayed, followed by construction-state initialization. |
| Disposal and explicit epic cancellation | Solid owner disposal stopped its reactive effects, but epic/log subscriber stayed active; notifier emission stopped epic output. |
| Custom fan-in observer | Independent app + two charts, detached snapshots, baseline replay suppression, unregister stopped observation. No extension UI. |
| Controlled input adapter | Requested time 9 left state 7 until authority changed; applied 9 logged separately; fake imperative sink recorded `[7,9]`. No real chart effects. |
| Nested reset snapshot, published versus local | Published reset left nested counter at 1; local reset restored it to 0. Top-level counter returned to 0 in both. |
| Default Node server import/core creation; built-in devtools | Import/core creation passed; unguarded enhancer raised `ReferenceError`. |

No browser/extension UI, chart/canvas, production bundle-size/performance, memory benchmark, full upstream test suite, production build, declaration typecheck, SSR render or hydration checks are claimed. Temporary transpilation made the local source executable for behavioral comparison; it is not a release build or a consumer bundle audit. No changes to Solux, Ashiso or production Gurafu code; no PR or merge.

## Remaining human decisions

1. What does “every interaction” include: committed Solux events, attempted user intents, controlled prop applications, effect completion/error/cancellation, chart-native events, or all of them? What data/trace retention, sampling and redaction are acceptable?
2. Is the desired UX separate named chart connections, one observer timeline, or one state owner? The first two preserve automatic independent chart state without requiring an application root.
3. Should Solux be internal, optional through an adapter, or public? Should Gurafu expose a chart-owned context/controller and preserve existing application Solux lookup?
4. Is read-only log/state inspection sufficient? If restore/replay is required, who owns authoritative input changes, exact restore, missing/remounted charts, pending effects and effect suppression?
5. Which exact published dependency contract is acceptable, and are Gurafu-owned mitigations acceptable or should specific upstream fixes precede adoption? The local `4.0.1` checkout cannot be selected as though it were npm `4.0.1`.

These decisions belong in [Choose Solux’s role and chart state ownership](https://github.com/carere/gurafu/issues/8) and the parent map. This investigation changes neither.

## Reproducing the probes

Run in a fresh temporary directory. Keep the referenced local repository read-only at the stated revision. The code below is research scaffolding, not a proposed Gurafu implementation. It has no browser or chart dependency. Install the exact versions listed, save the build script and four probes below, and run:

```sh
npm install --ignore-scripts --no-audit --no-fund \
  @carere/solux@4.0.1 solid-js@1.9.18 rxjs@7.8.2 \
  radash@12.1.0 remeda@2.32.0 ts-pattern@5.9.0 \
  esbuild@0.25.12 esbuild-plugin-solid@0.6.0
node build-local.mjs
node --conditions=browser probe.mjs
node --conditions=browser bridge-probe.mjs
node ssr-probe.mjs
node --conditions=browser clone-probe.mjs
```

`build-local.mjs` (local modules bundled solely to execute these probes; runtime packages stay external):

```js
import { build } from 'esbuild';
import { solidPlugin } from 'esbuild-plugin-solid';
await build({
  entryPoints: ['/Users/carere/Projects/oss/solux/src/index.ts'],
  outfile: new URL('./local.mjs', import.meta.url).pathname,
  bundle: true, packages: 'external', format: 'esm', platform: 'neutral',
  plugins: [solidPlugin()],
});
```


### Probe A: composition, event routing, lifecycle and mocked devtools

```js
import assert from 'node:assert/strict';
import * as published from '@carere/solux';
import * as local from './local.mjs';
import {createRoot, createEffect} from 'solid-js';
import {createStore} from 'solid-js/store';
import {Subject, filter, map, takeUntil, of} from 'rxjs';
const snapshot = x => JSON.parse(JSON.stringify(x));
function mockExtension() {
  const connections=[];
  globalThis.window={__REDUX_DEVTOOLS_EXTENSION__:{connect(options){
    const c={options, sent:[], inits:[], unsubscribed:0, listeners:[],
      init(s){c.inits.push(snapshot(s));},send(e,s){c.sent.push([snapshot(e),snapshot(s)]);},
      subscribe(fn){c.listeners.push(fn);return ()=>{c.unsubscribed++;}},
      emit(m){c.listeners.forEach(fn=>fn(m));}};
    connections.push(c);return c;
  }}};
  return connections;
}
const reports=[];
for(const [version,S] of [['published',published],['local',local]]) {
  const {configureStore,createSlice,combineSlices,createEvent,applyMiddlewares,epicMiddleware,devtools,SoluxProvider,useSolux}=S;
  const inc=createEvent('inc'),trigger=createEvent('trigger'),set=createEvent('set'),add=createEvent('add');
  const fresh=()=>createSlice({initialState:{n:0,nested:{n:0}},handlers:b=>b.addHandler(inc,s=>{s.n++;s.nested.n++;})});
  const store=()=>configureStore({rootSlice:fresh()});
  const findings={version};
  const shared=fresh(),a=configureStore({rootSlice:shared}),b=configureStore({rootSlice:shared});
  a.dispatch(inc());assert.equal(a.state,b.state);assert.equal(b.state.n,1);
  const sh1=configureStore({rootSlice:fresh(),preloadedState:{n:0,nested:shared.getInitialState().nested}});
  const sh2=configureStore({rootSlice:fresh(),preloadedState:{n:0,nested:shared.getInitialState().nested}});
  sh1.dispatch(inc());assert.equal(sh2.state.n,0);assert.equal(sh2.state.nested.n,2);
  findings.aliasing='shared slice aliases entire store; shallow preload aliases nested state';
  const ca=store(), cb=store();
  ca.dispatch(inc());assert.equal(cb.state.n,0);
  const root=configureStore({rootSlice:combineSlices({a:fresh(),b:fresh()})});
  root.dispatch({...inc(),chartId:'a'});assert.deepEqual([root.state.a.n,root.state.b.n],[1,1]);
  const mapSlices={a:fresh()}, staticCombined=combineSlices(mapSlices);mapSlices.b=fresh();
  assert.deepEqual(Object.keys(staticCombined.getInitialState()),['a']);
  findings.slices='chartId ignored without handler gate; added slice-map key not captured';
  assert.throws(()=>configureStore({rootSlice:combineSlices({a:ca})}),/getInitialState/);
  const child=store(), outer=configureStore({rootSlice:createSlice({
    initialState:{child:child.state},handlers:builder=>builder.addHandler(inc,s=>{s.child.n++;})
  })});
  let childCount=0,outerCount=0;
  const childSub=child.subscribe(()=>childCount++),outerSub=outer.subscribe(()=>outerCount++);
  child.dispatch(inc());assert.equal(outer.state.child.n,1);assert.equal(outerCount,0);
  outer.dispatch(inc());assert.equal(child.state.n,2);assert.equal(childCount,1);
  childSub.unsubscribe();outerSub.unsubscribe();
  findings.live='shared raw state, separate event streams; both mutation directions miss other store notifications';
  const [solid,setSolid]=createStore({chart:{n:0}}),[nested,setNested]=createStore(solid.chart);
  setNested('n',1);assert.equal(solid.chart.n,1);setSolid('chart','n',2);assert.equal(nested.n,2);
  const seen=[];
  const app=store(),chart=store();
  const dispose=createRoot(dispose=>{
    assert.equal(useSolux(),undefined);
    SoluxProvider({store:app,get children(){
      seen.push(useSolux()===app);
      SoluxProvider({store:chart,get children(){seen.push(useSolux()===chart);return null;}});
      seen.push(useSolux()===app);return null;
    }});return dispose;
  });
  dispose();assert.deepEqual(seen,[true,true,true]);
  findings.provider='nearest provider shadows and then restores outer lookup';
  // Custom single-root router feasibility; this is probe-owned code, not a Solux API.
  const router={getInitialState:()=>({charts:{}}),handler(s,e){
    if(e.type==='add')s.charts[e.chartId]={n:0};
    if(e.type==='remove')delete s.charts[e.chartId];
    if(e.type==='inc' && s.charts[e.chartId])s.charts[e.chartId].n++;
  }};
  const routed=configureStore({rootSlice:router});
  routed.dispatch({...add(),chartId:'a'});routed.dispatch({...add(),chartId:'b'});
  routed.dispatch({...inc(),chartId:'a'});
  assert.deepEqual(snapshot(routed.state),{charts:{a:{n:1},b:{n:0}}});
  routed.dispatch({type:'remove',chartId:'a'});routed.dispatch({...inc(),chartId:'a'});
  assert.equal(routed.state.charts.a,undefined);
  findings.customRouter='manual add/route/remove works; removed ID ignored by explicit guard';
  // Wrapper order versus base subscriptions.
  for(const order of ['logger-first','epic-first']){
    const logged=[],events=[];
    const logger=()=>next=>e=>{logged.push(e.type);next(e);};
    const epic=epicMiddleware({rootEpic:input=>input.pipe(filter(trigger.match),map(()=>inc()))});
    const c=configureStore({rootSlice:fresh(),enhancers:[applyMiddlewares(order==='logger-first'?[logger,epic]:[epic,logger])]});
    c.subscribe(({event})=>events.push(event.type));c.dispatch(trigger());
    assert.deepEqual(events,['trigger','inc']);
    assert.deepEqual(logged,order==='logger-first'?['trigger','inc']:['trigger']);
  }
  const logged=[],events=[];
  const mw=api=>next=>e=>{logged.push(e.type);next(e);if(e.type==='trigger')api.dispatch(inc());};
  const viaApi=configureStore({rootSlice:fresh(),enhancers:[applyMiddlewares([mw])]});
  viaApi.subscribe(({event})=>events.push(event.type));viaApi.dispatch(trigger());
  assert.deepEqual(logged,['trigger']);assert.deepEqual(events,['trigger','inc']);
  findings.middleware='base stream sees epic + api.dispatch outputs missed by outer wrapper';
  let replayCount=0; const last=viaApi.subscribe(()=>replayCount++);assert.equal(replayCount,1);
  last.unsubscribe();viaApi.dispatch(inc());assert.equal(replayCount,1);
  // Devtools ACTION route is fixed by enhancer order.
  for(const order of ['dev-first','dev-last']){
    const cs=mockExtension(),mwSeen=[];
    const log=()=>next=>e=>{mwSeen.push(e.type);next(e);};
    const dev=devtools({name:'Chart a',instanceId:'chart-a'}),m=applyMiddlewares([log]);
    configureStore({rootSlice:fresh(),enhancers:order==='dev-first'?[dev,m]:[m,dev]});
    cs[0].emit({type:'ACTION',payload:'{"type":"inc"}'});
    assert.deepEqual(mwSeen,order==='dev-first'?[]:['inc']);
  }
  const connections=mockExtension();let devStore,disposeDev;
  const reactive=[];
  createRoot(d=>{disposeDev=d;
    devStore=configureStore({rootSlice:createSlice({initialState:{n:0,extra:true},handlers:b=>b.addHandler(inc,s=>s.n++)}),enhancers:[devtools({name:'Gurafu / a',instanceId:'a'})]});
    createEffect(()=>reactive.push(devStore.state.n));
  });
  const conn=connections[0];let deliveries=0;devStore.subscribe(()=>deliveries++);
  conn.emit({type:'ACTION',payload:'{"type":"inc"}'});
  assert.equal(devStore.state.n,1);assert.equal(deliveries,1);
  conn.emit({type:'DISPATCH',payload:{type:'COMMIT'}});
  assert.deepEqual(conn.inits.at(-1),{n:1,extra:true});
  for(const command of ['JUMP_TO_STATE','JUMP_TO_ACTION','ROLLBACK']){
    conn.emit({type:'DISPATCH',payload:{type:command},state:'{"n":5}'});
    assert.equal(devStore.state.n,5);assert.equal(devStore.state.extra,true);
  }
  assert.equal(deliveries,1);
  conn.emit({type:'DISPATCH',payload:{type:'RESET'}});
  assert.equal(devStore.state.n,0); // RESET returns construction state despite prior COMMIT
  for(const command of ['TOGGLE_ACTION','LOCK_CHANGES','REORDER_ACTION']){
    conn.emit({type:'DISPATCH',payload:{type:command},state:'{"n":99}'});
    assert.equal(devStore.state.n,0);
  }
  const lifted={computedStates:[{state:{n:2}},{state:{n:3}}],currentStateIndex:0};
  conn.emit({type:'DISPATCH',payload:{type:'IMPORT_STATE',nextLiftedState:lifted}});
  assert.equal(devStore.state.n,3);assert.equal(devStore.state.extra,true);
  assert.equal(conn.sent.at(-1)[0],null);assert.deepEqual(conn.sent.at(-1)[1],lifted);
  assert.throws(()=>conn.emit({type:'ACTION',payload:"{type:'inc'}"}),SyntaxError);
  assert.throws(()=>conn.emit({type:'DISPATCH',payload:{type:'IMPORT_STATE',nextLiftedState:{computedStates:[]}}}),TypeError);
  disposeDev();devStore.dispatch(inc());assert.equal(conn.sent.at(-1)[1].n,4);assert.equal(conn.unsubscribed,0);
  findings.devtools={partialJumpPreservesExtra:true,commandsDoNotPublish:true,resetAfterCommit:0,importChoosesLastNotCurrentIndex:true,ignored:['TOGGLE_ACTION','LOCK_CHANGES','REORDER_ACTION'],strictJsonOnly:true,unsubscribedAfterRootDisposal:conn.unsubscribed,reactive};
  // Synchronous middleware setup emits twice before devtools is installed: only last event replayed.
  const startup=mockExtension();
  configureStore({rootSlice:fresh(),enhancers:[
    applyMiddlewares([epicMiddleware({rootEpic:()=>of(inc(),inc())})]),
    devtools({name:'startup',instanceId:'startup'})
  ]});
  assert.equal(startup[0].sent.length,1);assert.equal(startup[0].sent[0][1].n,2);
  assert.equal(startup[0].inits[0].n,0);
  findings.startup='late enhancer sees only last startup action, then init(initial state)';
  // Active epic outlives Solid owner; explicit cancellation stops later output.
  const source=new Subject(), done=new Subject();let active;
  const disposeActive=createRoot(d=>{active=configureStore({rootSlice:fresh(),enhancers:[applyMiddlewares([epicMiddleware({rootEpic:()=>source.pipe(takeUntil(done))})])]});return d;});
  disposeActive();source.next(inc());assert.equal(active.state.n,1);
  done.next();source.next(inc());assert.equal(active.state.n,1);source.complete();done.complete();
  findings.epic='owner disposal leaves active; takeUntil notifier emission stops';
  delete globalThis.window;
  assert.throws(()=>configureStore({rootSlice:fresh(),enhancers:[devtools({instanceId:'ssr'})]}),/window is not defined/);
  findings.ssr='devtools invocation without window throws';
  reports.push(findings);
}
console.log(JSON.stringify(reports,null,2));
```

### Probe B: independent observation and controlled inputs

```js
import assert from 'node:assert/strict';
import * as published from '@carere/solux';
import * as local from './local.mjs';
import {createRoot,createSignal,createEffect,untrack} from 'solid-js';
const snap=x=>JSON.parse(JSON.stringify(x));
for(const [label,S] of [['published',published],['local',local]]){
  const {configureStore,createSlice,createEvent}=S;
  const inc=createEvent('inc'),applied=createEvent('external/applied');
  const fresh=()=>configureStore({rootSlice:createSlice({
    initialState:{n:0,time:0},handlers:b=>b.addHandler(inc,s=>s.n++).addHandler(applied,(s,e)=>s.time=e.payload)
  })});
  // Probe-owned log-only fan-in; no shared live state or commands back into stores.
  const registry=new Map(),log=[];let seq=0;
  const all=()=>Object.fromEntries([...registry].map(([id,r])=>[id,snap(r.store.state)]));
  const send=(type,data={})=>log.push({seq:++seq,type,...data,state:all()});
  const register=(id,store)=>{
    assert(!registry.has(id));const record={store};registry.set(id,record);
    send('scope/registered',{id});let baseline=true;
    record.sub=store.subscribe(({event})=>{if(!baseline)send('store/event',{id,event:snap(event)});});
    baseline=false; // suppress synchronous ReplaySubject baseline, not a new action
    return ()=>{record.sub.unsubscribe();registry.delete(id);send('scope/removed',{id});};
  };
  const a=fresh(),b=fresh();a.dispatch(inc()); // past event must not be misreported as new
  const removeA=register('chart:a:mount1',a),removeB=register('chart:b:mount1',b);
  const app=fresh(),removeApp=register('application',app);
  assert.equal(log.filter(e=>e.type==='store/event').length,0);
  a.dispatch(inc());b.dispatch(inc());app.dispatch(inc());
  assert.equal(log.filter(e=>e.type==='store/event').length,3);
  assert.equal(log[2].state['chart:a:mount1'].n,1); // detached historical registration snapshot
  assert.equal(log.at(-1).state['chart:a:mount1'].n,2);
  removeA();const count=log.length;a.dispatch(inc());assert.equal(log.length,count);
  assert.equal(log.at(-1).state['chart:a:mount1'],undefined);
  // Controlled prop adapter in probe: request and authoritative application are distinct.
  let setTime,request,dispose;const imperativeCalls=[];
  const controller=fresh(),removeControl=register('chart:controlled:mount1',controller);
  createRoot(d=>{
    dispose=d;const [time,set]=createSignal(7);setTime=set;
    request=value=>controller.dispatch({type:'ui/time-requested',payload:value});
    createEffect(()=>{const value=time();untrack(()=>controller.dispatch(applied(value)));});
    createEffect(()=>imperativeCalls.push(controller.state.time)); // fake effect sink only
  });
  assert.equal(controller.state.time,7);
  request(9);assert.equal(controller.state.time,7); // consumer has not accepted request
  setTime(9);assert.equal(controller.state.time,9);
  assert.deepEqual(log.slice(-2).map(x=>x.event.type),['ui/time-requested','external/applied']);
  dispose();setTime(11);assert.equal(controller.state.time,9);
  removeControl();removeB();removeApp();
  console.log(JSON.stringify({label,fanIn:'independent application + charts; snapshots detached; replay baseline suppressed; unregister unsubscribes',controlled:'request does not override supplied input; subsequent authoritative update logged',imperativeCalls}));
}
```

### Probe C: default server import and enhancer invocation

```js
import assert from 'node:assert/strict';
for(const spec of ['@carere/solux','./local.mjs']){
  const S=await import(spec);
  assert.equal(typeof globalThis.window,'undefined');
  const slice=()=>S.createSlice({initialState:{n:0},handlers:()=>{}});
  const a=S.configureStore({rootSlice:slice()}),b=S.configureStore({rootSlice:slice()});
  assert.notEqual(a.state,b.state);
  assert.throws(()=>S.configureStore({rootSlice:slice(),enhancers:[S.devtools({instanceId:'ssr'})]}),ReferenceError);
  console.log(spec+': server import + core creation PASS; built-in devtools ReferenceError reproduced');
}
```

### Probe D: published shallow reset snapshot versus local deep snapshot

```js
import assert from 'node:assert/strict';
import * as pub from '@carere/solux';
import * as local from './local.mjs';
for(const [label,S] of [['published',pub],['local',local]]){
 let cb;globalThis.window={__REDUX_DEVTOOLS_EXTENSION__:{connect(){return{subscribe(fn){cb=fn;},send(){},init(){}}}}};
 const inc=S.createEvent('inc');
 const store=S.configureStore({rootSlice:S.createSlice({initialState:{n:0,nested:{n:0}},handlers:b=>b.addHandler(inc,s=>{s.n++;s.nested.n++;})}),enhancers:[S.devtools({instanceId:label})]});
 store.dispatch(inc());cb({type:'DISPATCH',payload:{type:'RESET'}});
 assert.equal(store.state.n,0);assert.equal(store.state.nested.n,label==='published'?1:0);
 console.log(label,JSON.stringify(store.state));
}
```

## Primary source references

Solux GitHub links pin the exact **local** source revision. Published behavior is independently attributed to the versioned package/source map and verified probes; the local commit is not presented as the release commit. Package URLs name exact versions; the Solux tarball hashes above identify the bytes examined. Tracker links record the question and user constraints rather than immutable software facts.

[Context]: https://github.com/carere/gurafu/issues/8#issuecomment-6689611295
[S-package]: https://github.com/carere/solux/blob/f872304ccc2c453d8e7db2454a06f2fdff43c0ab/package.json
[S-index]: https://github.com/carere/solux/blob/f872304ccc2c453d8e7db2454a06f2fdff43c0ab/src/index.ts
[S-config]: https://github.com/carere/solux/blob/f872304ccc2c453d8e7db2454a06f2fdff43c0ab/src/configureStore.ts
[S-combine]: https://github.com/carere/solux/blob/f872304ccc2c453d8e7db2454a06f2fdff43c0ab/src/combineSlices.ts
[S-slice]: https://github.com/carere/solux/blob/f872304ccc2c453d8e7db2454a06f2fdff43c0ab/src/createSlice.ts
[S-context]: https://github.com/carere/solux/blob/f872304ccc2c453d8e7db2454a06f2fdff43c0ab/src/context.tsx
[S-enh]: https://github.com/carere/solux/blob/f872304ccc2c453d8e7db2454a06f2fdff43c0ab/src/enhancers.ts
[S-mw]: https://github.com/carere/solux/blob/f872304ccc2c453d8e7db2454a06f2fdff43c0ab/src/middlewares.ts
[S-types]: https://github.com/carere/solux/blob/f872304ccc2c453d8e7db2454a06f2fdff43c0ab/src/types.ts
[S-readme]: https://github.com/carere/solux/blob/f872304ccc2c453d8e7db2454a06f2fdff43c0ab/README.md
[P-meta]: https://registry.npmjs.org/@carere%2Fsolux/4.0.1
[P-package]: https://unpkg.com/@carere/solux@4.0.1/package.json
[P-map]: https://unpkg.com/@carere/solux@4.0.1/dist/index.js.map
[P-dist]: https://unpkg.com/@carere/solux@4.0.1/dist/index.js
[P-types]: https://unpkg.com/@carere/solux@4.0.1/dist/index.d.ts
[Radash-clone]: https://unpkg.com/radash@12.1.0/dist/esm/object.mjs
[Remeda-clone]: https://github.com/remeda/remeda/blob/v2.32.0/packages/remeda/src/clone.ts
[Solid-package]: https://unpkg.com/solid-js@1.9.18/package.json
[Solid-runtime]: https://unpkg.com/solid-js@1.9.18/store/dist/store.js
[Solid-reactive]: https://unpkg.com/solid-js@1.9.18/dist/solid.js
[Solid-server]: https://unpkg.com/solid-js@1.9.18/dist/server.js
[Solid-stores]: https://github.com/solidjs/solid-docs/blob/9a9d77a75642f6e2ab68d80b0081d45ad3424b13/src/routes/%280%29concepts/%285%29stores.mdx
[D-api]: https://github.com/reduxjs/redux-devtools/blob/0f17f157868defa9e1190ae4c60edc6a1f9fd047/extension/src/pageScript/api/index.ts
[D-id]: https://github.com/reduxjs/redux-devtools/blob/0f17f157868defa9e1190ae4c60edc6a1f9fd047/extension/src/pageScript/api/generateInstanceId.ts
[D-methods]: https://github.com/reduxjs/redux-devtools/blob/0f17f157868defa9e1190ae4c60edc6a1f9fd047/extension/docs/API/Methods.md
[D-options]: https://github.com/reduxjs/redux-devtools/blob/0f17f157868defa9e1190ae4c60edc6a1f9fd047/extension/docs/API/Arguments.md
[D-monitor]: https://github.com/reduxjs/redux-devtools/blob/0f17f157868defa9e1190ae4c60edc6a1f9fd047/packages/redux-devtools-app/src/utils/monitorActions.ts
[D-relay]: https://github.com/reduxjs/redux-devtools/blob/0f17f157868defa9e1190ae4c60edc6a1f9fd047/extension/src/contentScript/index.ts
[D-instances]: https://github.com/reduxjs/redux-devtools/blob/0f17f157868defa9e1190ae4c60edc6a1f9fd047/packages/redux-devtools-app-core/src/reducers/instances.ts
[D-dispatcher]: https://github.com/reduxjs/redux-devtools/blob/0f17f157868defa9e1190ae4c60edc6a1f9fd047/packages/redux-devtools-app-core/src/containers/monitors/Dispatcher.tsx
[Rx-cancel]: https://unpkg.com/rxjs@7.8.2/dist/esm/internal/operators/takeUntil.js
[A-store]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/store/index.ts
