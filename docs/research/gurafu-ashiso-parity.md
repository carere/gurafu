# Ashiso chart behavior and application boundaries

Research for [Inventory Ashiso’s reusable chart behavior and application boundaries](https://github.com/carere/gurafu/issues/4), under [Map the Gurafu component API and Ashiso-to-v5 specification](https://github.com/carere/gurafu/issues/3). Inspected 2026-11-06. This is evidence for later specification decisions, not approval of a component API or of feature inclusion.

## Scope, revisions, and confidence

- **Reference:** `/Users/carere/Projects/oss/ashiso`, clean checkout at [`1b716f85bea71a703330cdae74b83f82732812a9`](https://github.com/carere/ashiso/tree/1b716f85bea71a703330cdae74b83f82732812a9) (commit dated 2024-11-18). All `A-*` citations below pin this revision. No tracked `AGENTS.md`, `CLAUDE.md`, domain context, or ADR files were found in that tree; no applicable ancestor `AGENTS.md` was found in `/Users`, `/Users/carere`, `/Users/carere/Projects`, or `/Users/carere/Projects/oss`.
- **Versions:** Ashiso declares `solid-js: ^1.9.3`, `lightweight-charts: ^4.2.1`, and `@carere/solux: ^3.3.2`. Its committed binary lock contains the package tarball URLs for **1.9.3, 4.2.1, and 3.3.2**, respectively. These are locked reference versions, not claims about today's latest releases. `bun.lockb` SHA-256: `1cefbaa794ceffe0d24d2b7cd817c37c009d6fec073f37d8354191c3219d4b29`. The lock was read without installing or rewriting it. [A-package][A-lock]
- **Target baseline:** Gurafu [`39fe95bf83e76f825a57c3b00de3d745a3ed15bc`](https://github.com/carere/gurafu/tree/39fe95bf83e76f825a57c3b00de3d745a3ed15bc) pins Lightweight Charts **5.2.1** and Solid **1.9.18**; its registry starts empty and distributed code must be independent of application routes/server implementations. [G-package][G-readme]
- **Upstream comparison:** Lightweight Charts tag `v5.2.1` resolves through annotated tag `bf4bdc64e1ac5d6dc8a1c01e1340cc1cb25ca695` to commit **`b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1`**. Only the pane/series API distinction needed here was checked; the full v5 lifecycle investigation belongs to the other research ticket. [L5-tag][L5-chart][L5-pane]
- **Method:** static source tracing of chart/layout/control/legend/indicator modules through selectors, reducers, workers, adapters, and app bootstrap; whole-tree searches for chart creation, range subscriptions/setters, crosshair sharing, and phase rendering. Upstream source was read through the GitHub source-fetch plugin. No browser work, builds, dependency changes, production component work, external-source writes, or live exchange calls were performed. Runtime-dependent observations below are explicitly limitations or verification scenarios.

## Findings at a glance

1. A reference chart is one v4 chart instance containing one candlestick series, optional volume histogram, and attached custom canvas primitives. The volume scale occupies the lower 15% of the same plot; volatility paints into the lower 10% of that plot. Neither is a separate native pane. [A-chart][A-candles][A-volumes][A-vol-render]
2. There are four toggles/legend entries: **Volume**, **Bollinger Bands**, **Volatility Cycle**, **Bollinger Bands Phases**. Phases are calculated and displayed numerically in the legend; no phase drawing primitive or separate phase series was found. [A-legend][A-phase][A-worker-analysis]
3. Separate charts share crosshair **time**, session selected date, replay state/clock, and application layout/data infrastructure. There is **no observed viewport synchronization**: the only visible-logical-range subscription requests history for its own chart; the visible-logical-range setter centers a requested date locally. [A-layout][A-chart][A-candles][A-graph]
4. Solux owns application/session state and dependency injection. Lightweight Charts objects and several UI/analysis signals stay local to Solid owners. Ashiso's usage establishes no requirement to expose Solux publicly in Gurafu. [A-store][A-app][A-utils][A-types][A-chart]
5. Reference behaviors include useful reusable seams, but also unverified replay transitions, missing stale-response protection, and mismatches between live series state and legend/history state. These must be resolved explicitly in later decisions rather than silently copied. [A-candles][A-replay][A-session][A-worker-candles]

## Composition, interactions, appearance, and lifetime

| Capability | Observed behavior and owning code | Application dependency / candidate reusable seam |
| --- | --- | --- |
| Chart creation | `Chart` creates `createChart(container, { autoSize: true, grid: { horzLines: { visible: false }, vertLines: { visible: false } }, timeScale: { secondsVisible: false } })`. The full-size container sits inside a bordered, rounded, clipped wrapper with an absolute DOM legend. Cleanup removes worker listeners, crosshair subscription, and chart. [A-chart] | Requires Kobalte color mode and app store/container today. Chart mount/removal, chart options, event subscriptions, and a DOM overlay are separable behaviors; their future API is undecided. |
| Price series | One `addCandlestickSeries`; rising `#4ADE80`, falling `#7F1D1D` for body/border/wick, hidden price line. Price format uses contract `pricePrecision` and `tickSize`. Data is adapted from app milliseconds to chart seconds; `setData` replaces historical arrays, `update` changes the current candle. [A-candles] | Contract lookup/ticker/resolution are application concepts. Numeric format, normalized series data, replacement/incremental updates, and series cleanup are reusable seams. |
| Pan/zoom | Ashiso does not override `handleScroll`/`handleScale`. v4.2.1 defaults enable mouse-wheel scrolling/scaling, pressed-mouse scrolling, horizontal/vertical touch dragging, axis drag scaling, axis double-click reset, pinch, and touch kinetic scroll; these are inherited library behaviors, not custom Ashiso controls. [A-chart][L4-defaults] | Later parity checks should exercise inherited interaction defaults deliberately. No custom zoom toolbar, drawing-tool suite, order-entry behavior, or screenshot UI appears in the inspected chart/control modules. [A-chart][A-controls] |
| Volume | Toggle creates/removes `addHistogramSeries` with `priceScaleId: "volume"`; scale margins `{ top: 0.85, bottom: 0 }`, ticks hidden, no last-value label or price line, baseline enabled. Format is `type: "volume"`, contract `volumePrecision` and `tickSize`. Bar is dark red if `open > close`, green otherwise. It attaches a volume MA primitive. [A-volumes] | This is an overlay scale in the candle chart, not a separately resizable pane or a chart instance. Data/format/visibility and primitive attachment are separable from feed/session state. |
| Theme | Reactive `applyOptions`: transparent solid background; text, axis borders, crosshair label/lines use `#1D283A` in dark mode, `#0F172A` otherwise. Normal crosshair mode. Horizontal line is visible only during replay selection; vertical line becomes solid red `#F35758`, width 3 during selection, otherwise large-dashed width 1. Minute/hour time labels show time; seconds remain hidden. Candle/indicator palettes do not change with theme. [A-chart][A-candles][A-band-render][A-vol-render][A-ma-render] | Kobalte provider/menu supplies light/dark/system preference; theme state and cookies are application-owned. Chart options/palettes can be driven independently. Contrast/readability was not visually verified. [A-app][A-theme] |
| Resize and layouts | Chart `autoSize` follows its full-size container. Corvu resizable layouts host **separate chart instances**: 1 chart fallback; 2–4 horizontal/vertical panels with minimum size `0.1`; grid of 2 uses horizontal layout, 3 uses one top chart and two below, 4 uses two rows of two. Sizes persist under the same `resizable-sizes` key in flex and grid modules. [A-chart][A-layout][A-flex][A-grid] | Splitters, persistence/key policy, visibility and layout selection belong to the session workspace. Do not confuse those panels with native chart panes. Shared persistence key is a reference limitation to test across sessions/layouts. |

### Native v5 panes are additional scope, not reference parity

At v5.2.1, `addSeries(definition, options, paneIndex?)`, `addPane`, `panes`, `removePane`, and `swapPanes` exist. A pane exposes height, position, series, price scales, empty-pane preservation, primitives, and stretch-factor operations. Thus candle/volume in separate native panes is a distinct scenario from Ashiso's overlay and from its multi-chart layout. This inventory does not decide whether volume or volatility should migrate into a pane, or what Gurafu's pane API should be. [L5-chart][L5-pane]

## Indicators: computation, rendering, and visibility

Calculation and drawing are already distinct layers: an analyzer worker produces arrays plus serialized analysis state; app reducers store these by timeframe and timestamp; Solid wrappers attach/detach `ISeriesPrimitive` classes and pass their arrays/visibility. The worker calculates all indicators regardless of whether the legend toggle is enabled. `timeFrame` and `frequency` travel in the request, but the worker constructs `new Analyzer(18, previousAnalysis)` without using either to select parameters. [A-worker-analysis][A-analyzer][A-session][A-band-wrapper][A-vol-wrapper][A-ma-wrapper]

| Indicator | Calculation facts | Drawing / toggle facts |
| --- | --- | --- |
| Volume moving average | Analyzer constructs `VolumeMovingAverage(200)`, an SMA of candle volume with export/restore state. A zero MA is omitted by the truthy `ma ? ... : undefined` return. [A-analyzer][A-ma-calc][A-sma] | Orange `#f97316`, width 2 canvas line attached to the histogram. Uses histogram price-to-coordinate and visible-time filtering. There is no separate MA toggle; it follows Volume's histogram lifetime. [A-volumes][A-ma-wrapper][A-ma-render] |
| Bollinger Bands | Worker uses period **18**, despite calculator default **20**; standard-deviation multiplier defaults to **2**. Middle is SMA of close, lower/upper are middle ± 2×SD. State export includes moving-average and deviation buffers. [A-worker-analysis][A-analyzer][A-band-calc][A-sma][A-sd] | Primitive attached to candle series; green `#4CAF50` middle; upper/lower segments colored by slope. **Renderer maps rising/equal to red `#F55253`, falling to blue `#2196F3`**. Visible points map through chart time and candle price coordinates and draw in the background. Visibility hides lines; wrapper cleanup detaches. [A-band-wrapper][A-band-render] |
| Volatility Cycle | From Bollinger width `bbw = (upper-lower)/middle`, rolling low/high width over the configured period, `d = nz((bbw-high)/(high-low))`; after a prior delta exists, result is `nz((previousDelta+d)/2)+1`. `nz` replaces NaN with zero, not infinity. [A-band-info][A-utils] | Candle-attached primitive paints teal `#00897B` into the **bottom 10%** of the chart plot, with dashed gray `#787B86` threshold lines at 0.8 and 0.2; it uses pixel height rather than a separate price scale. This can occupy the same area as the volume overlay. [A-vol-wrapper][A-vol-render] |
| Bollinger Bands Phases | State-machine output `1–4` or undefined. First discovery checks: 1 if volatility <0.2; else 2 if upper rises/equal and lower falls/equal; else 3 if both move together; else 4 if bands close. Subsequent permitted transitions are 1→2; 2→3; 3→4 or 2; 4→1, 2, or 3, otherwise retain prior phase. Requires two band results and defined volatility. [A-band-info] | Phase toggle controls its DOM legend preview only. Search found no phase series/primitive construction; `getBbPhaseData` exists but is not used to draw phases. [A-phase][A-legend][A-selectors][A-candles][A-chart] |

The primitives implement canvas rendering and attachment, not native indicator series with their own last-price labels or scales. Their `setData` stores an array without requesting repaint; only Bollinger/volatility visibility setters call `requestUpdate`. None defines an `autoscaleInfo` contribution. Consequently redraw timing and band values outside candle extremes require verification rather than assumed parity. [A-band-render][A-vol-render][A-ma-render]

**Numerical caveat:** the band calculator starts calling `StandardDeviation.nextValue` only once SMA yields a value; SD divides the currently held squared deviations by the configured period even while its buffer is still warming. This is the source's actual computation, not evidence of agreement with a conventional fully warmed Bollinger implementation. Zero/flat inputs, exported-state continuation, and the first several output bands deserve fixtures before choosing numerical compatibility. [A-band-calc][A-sma][A-sd][A-band-info]

## Complete legend inventory

`GraphLegend` is top-left DOM content, not a chart plugin. It starts collapsed (`show = false`), always displays the timeframe/OHLC preview, and has an expand/collapse button showing the **count of enabled indicators**, not the number with available data. New sessions initialize all four flags false. Expanded rows expose a label and eye/eye-slash toggle; disabled rows gray the label/icon and omit the numeric preview. Labels are hardcoded English. [A-legend][A-session]

The chart stores a local legend time initialized to **0**. Each crosshair event with a truthy time sets it to `event.time * 1000`; events without time return early. There is no explicit “latest candle” fallback or reset on mouse leave. Legend reads timestamp-indexed store entities, not `event.seriesData`. [A-chart][A-pair][A-volume-preview]

| Row / values (display order) | Formatting and color | Missing-data behavior |
| --- | --- | --- |
| Timeframe, **O, H, L, C** | Timeframe replaces `-` with a space; raw stored open/high/low/close values, no explicit fixed precision. All OHLC values red for `open >= close`, green otherwise. Despite the name `PairPreview`, no symbol/exchange name, percent change, trades, or date/time value is rendered here. [A-pair] | Question-circle icon independently for each missing OHLC; gray when candle absent. |
| **Volume:** MA, candle volume | MA first, orange; candle volume second, direction red/green; `Intl.NumberFormat("en-US", { notation: "compact" })`, independent of app language. Candle equality satisfies both `>=` and `<=` color class conditions. [A-volume-preview] | Separate question icons for missing MA/candle; parent candle collection is not optional-chained, so startup safety is not guaranteed. |
| **Bollinger Bands:** lower – middle – upper | Two decimals. Middle green. Lower/upper **blue for >= previous band value, red for <=**; equality sets both classes. Requires prior bar at exactly one resolution×multiplier earlier. This legend color rule differs from the renderer's rising=red mapping. [A-bollinger-preview][A-band-render] | One question icon for the entire preview unless both current and previous band entries exist. |
| **Volatility Cycle:** volatility | Two decimals, gray `#787B86`; zero is valid because the condition tests `!== undefined`. [A-volatility-preview] | Question icon if undefined. |
| **Bollinger Bands Phases:** phase | Integer 1–4, no additional prose or visual band/region. [A-phase] | Question icon when undefined/falsy. |

Legend components assume varying levels of collection readiness (e.g. `indicators?.[timeFrame].volume.entities` does not guard a missing timeframe entry). This should be treated as an initialization limitation, not a requirement that consumers pre-create Ashiso-shaped state. [A-volume-preview][A-bollinger-preview][A-volatility-preview][A-phase]

## Controls and date navigation

- **Session toolbar:** date picker; “go to now”; replay controls; grid/vertical/horizontal layout selection; buttons to show/hide the session's predefined timeframes (cannot hide the final visible chart). Desktop toolbar is collapsible and draggable horizontally within panel bounds; on small screens it is a vertical control rail and opens when the `(max-width: 768px)` media query matches. Panel resizing constrains toolbar position. These are workspace UI behaviors, not chart-native controls. [A-controls][A-panel]
- **Session creation:** choose pair and trading frequency; launch requires both. Frequency presets are scalping `[1m,5m,30m,4H]`, intra-day `[5m,30m,4H,1D]`, swing `[30m,4H,1D,1W]`; initial visible timeframe is respectively 5m, 30m, 4H. Symbol/frequency updates are accepted only while draft; toolbar visibility buttons do not replace an existing chart's instrument/resolution. [A-creator][A-utils][A-session]
- **Calendar:** AirDatepicker, English locale, minimum contract onboard date, maximum current date, disabled navigation outside range. Selection converts local calendar year/month/day into UTC midnight, writes a **session-wide** selected timestamp, and closes the popover. “Go to now” clears that timestamp; it is not a direct `scrollToRealTime()` call. [A-date-control][A-datepicker][A-session]
- **Navigation mechanics:** each candle module rounds session selection to its timeframe and clamps against contract onboard date, requests the surrounding history, and on the first populated load or changed selection calls `moveToTime`. That helper finds the selected time's coordinate/logical index and centers the current logical span around it; it does nothing if those conversions/range are unavailable. With no selected time, each historical `setData` path calls `resetTimeScale`. [A-candles][A-graph]
- **Ownership seam:** calendar UI, valid-date policy, UTC alignment, resolution presets, and shared date selection can be supplied by a consumer; chart navigation and data replacement remain reusable capabilities to account for. Whether Gurafu ships a calendar/replay toolbar is a later decision, not established by this inventory.

## Historical data and live updates

1. **Bootstrap:** the app creates one candles worker, one analysis worker, exchange facade, and crypto service in a container passed to the app-wide Solux store. The shell sends candle-worker initialization. The worker opens `ashiso.sqlite3` through SQLocal/Drizzle, runs migrations/WAL, and constructs its own Binance gateway using environment URLs. No chart-independent readiness/error protocol is visible beyond `initialized`. [A-app][A-shell][A-types][A-worker-candles]
2. **Initial/date request:** chart identity is `${sessionId}-${timeFrame}`; candle key is `${ticker}-${multiplier}-${resolution}`. Latest-history request spans about 3,000 intervals before aligned now; a historical selection generally spans ±1,500 intervals, with edge cases near onboarding/present clamped or shifted by the helper. Timestamps are application milliseconds. [A-chart][A-candles][A-graph]
3. **Scroll request:** 200 ms debounced `subscribeVisibleLogicalRangeChange` calls `barsInLogicalRange`; when fewer than 750 bars remain before the visible range, extend history by 3,000 intervals, clamped at onboarding. Forward extension by 3,000 intervals is allowed only outside live/replay and at least two intervals from aligned now, again with <750 bars after. A per-chart fetching flag suppresses scroll-triggered duplicates. These thresholds are app loading policy. [A-candles][A-graph]
4. **Cache and pagination:** worker queries stored timestamps for the requested key/range, analyzes interval gaps, collects missing exchange ranges, inserts rows keyed by `(candles_id,time)`, then returns the entire requested range sorted ascending. `collect` paginates via the facade and throws on fetch errors; Binance REST omits the current incomplete bar and maps completed OHLCV/trades. The chart dispatches replacement `setCandles`, not a generic prepend operation. [A-worker-candles][A-db][A-collect][A-binance][A-session]
5. **Analysis:** every nonempty historical values replacement posts `kind: "start"` with all candles. Result is routed by chart sender, stored as timeframe arrays/entities, and saved locally as analysis continuation state. Closed live candles also post `kind: "update"` with previous analysis when the plotted series is near present; reducers concatenate update arrays and merge entities. No worker request sequence/version token or deduplication appears. [A-chart][A-candles][A-worker-analysis][A-session]
6. **Live:** chart subscribes when last stored candle is near present and replay is off. `isFutureReached` compares aligned candle time with aligned now using an absolute difference <= one interval; it is an app time heuristic, not a market-session calendar. Binance adapter caches an RxJS WebSocket observable per candle key, subscriptions per chart client ID, retry delay 3 seconds; cleanup unsubscribes the chart client. Each message dispatches `updateCurrentCandle`; closed messages also dispatch `addNewCandle`. Candle and histogram series call `update`. [A-chart][A-utils][A-binance][A-candles][A-volumes]

**Data ownership conclusion:** feeds, metadata/onboard dates, exchange protocol/URLs, REST pagination, database cache/migrations, gap policy, retries, request scheduling, and trading-session state are application responsibilities under the standing map constraints. Reusable seams exposed by the source are normalized data/format inputs, replacement and incremental updates, range/event observation, navigation, primitive data/visibility, and cleanup. This identifies needs without choosing callback signatures or data ownership architecture. [Map][G-readme]

## Replay behavior and limits

| Stage | Observed code path |
| --- | --- |
| Enter/exit | Toggle creates `{ running:false, selecting:true, speed:"1" }`; toggling again or `stopBackTest` removes replay state. Live effect is gated off during replay. Selection changes crosshair styling. [A-session][A-chart] |
| Pick start | Chart click, only while selecting and with event time, dispatches `initBackTest`. It clears current replay time, stops running, exits selection, and writes the clicked time (seconds→milliseconds) to session selected date. Play/step are disabled until selected date or replay current time is truthy. [A-replay][A-session][A-back-controls][A-selectors] |
| Play/pause/speed | Only the **lowest currently visible** timeframe owns the timer; each tick adds one of that chart's intervals to current time, starting from selected date. Speeds `0.1/0.3/0.5/1/3/10` map to intervals `10000/3333/2000/1000/333/100 ms`. Toolbar labels describe update frequency. Pause changes `running`; manual step adds one lowest-visible interval through a separate control. [A-replay][A-back-controls][A-selectors] |
| Plot progression | Candle and histogram history memos filter at replay current time or selected date, but read those values and replay mode through `untrack`. Per-chart replay observer looks up **exact** current timestamp in its own candle entity map and dispatches that candle to `currentCandle`; no interpolation/partial higher-timeframe OHLC reconstruction is implemented. [A-candles][A-volumes][A-replay] |
| Fetch ahead / finish | On current-time changes, request ahead when <750 intervals remain in loaded data, up to 1,500 intervals after aligned replay time and capped at aligned now. Timer owner stops replay on `isFutureReached`. No error/retry/backpressure path is shown for this replay-specific request. [A-replay][A-graph] |

**Static limitations requiring explicit parity decisions:**

- Changing only replay clock/mode does not itself invalidate the historical filters, because these reads are untracked; series `update` is a separate path. Entering/exiting replay, cutting future bars, seeking backward, and returning live must be exercised rather than described as verified transitions. [A-candles][A-volumes][A-replay]
- Higher-timeframe lookup uses exact timestamp and full stored candles; a higher-timeframe candle can expose its eventual high/low/close as soon as its opening timestamp is selected. There is no source evidence of look-ahead-safe aggregation from lower-timeframe candles. Indicator arrays are computed from loaded raw history, and primitive selectors do not apply a replay cutoff. [A-replay][A-chart][A-selectors][A-worker-analysis]
- Timer ownership depends on the visible timeframe set. Hiding/showing the lowest chart mid-playback, or remounting a layout, can change the clock source; there is no independent session-clock service in this implementation. Replay helper captures `backTest` at creation, so replacement/reselection/lifetime behavior needs runtime verification. [A-replay][A-layout][A-controls]
- `addNewCandle` updates the candle **entity map** but does not append to historical `values`; `updateCurrentCandle` only updates a separate field. Thus plotted live/replay state, history arrays, analysis inputs, and entity-based legend values can differ. For example, an open live candle updates the series but the OHLC legend reads entities, not `currentCandle`. [A-session][A-chart][A-candles][A-pair][A-volume-preview]

## Exactly what is shared between separate charts

| Shared thing | Mechanism and boundary |
| --- | --- |
| Crosshair time | One `createSignal<CrossHair>()` per `GraphLayout`, passed to all its charts. Focused chart publishes `{ sender: timeFrame, time: seconds }` only for a changed truthy time. Local legend time updates before focus/publish checks. Recipient other timeframes compare time with their **own** visible time range: inside → `setCrosshairPosition(0, time, candleSeries)`; outside → clear. No price, pixel coordinates, or visible range is shared. Mouse leave only clears focus; no shared clear event is sent. Programmatic event/legend behavior and time snapping across unequal timeframes were not runtime-verified. [A-layout][A-chart][A-candles][A-types] |
| Selected date and replay | Session `selectedTime` drives independent history requests/centering in all timeframe charts; session replay state and clock drive exact-timestamp current-candle lookups. This is common application intent, not continuous pan/zoom synchronization. [A-session][A-candles][A-replay] |
| Workspace | Session chart flags and layout decide which separate instances mount; Corvu panel sizes persist under a common storage key. Each chart has its own chart API/series/visible range. [A-layout][A-flex][A-grid][A-chart] |
| Data infrastructure | App-wide workers/facade; worker responses broadcast with chart sender filtering. Per-session candles/indicators in Solux; persistent SQLite cache keyed by symbol/timeframe; adapter observable registry keyed by candle ID and subscriptions keyed by client. This is shared infrastructure, not a chart viewport bus. [A-app][A-chart][A-worker-candles][A-db][A-binance][A-session] |

**Negative finding, bounded to the recorded source:** whole-tree searches for `subscribeVisible*`, `setVisible*`, `getVisible*`, `scrollTo*`, `setCrosshair*`, and `createChart` found one range subscription in `series/candles.tsx` (fetching), and one `setVisibleLogicalRange` in `moveToTime` (date centering). Neither copies a source chart range into peers. There is no evidence of synchronized visible-range subscriptions. A shared date may orient charts similarly, but charts can pan/zoom independently. [A-candles][A-graph][A-layout]

The standing decision is that **coordination between separate chart instances remains consumer-owned and example-only**. Native panes belong to a single chart instance and stay in scope. The evidence above does not reopen either constraint. [Map]

## Solux and other application dependencies

`createStore` calls Solux `configureStore` with `rootSlice`, preloaded state, `saveStateEpic`, service/worker container, and Ashiso devtools filtering. `SoluxProvider` wraps the app and `useStore = useSolux<RootState, Container>` couples chart wrappers, controls, and legends to sessions/contracts and dispatch. Slices use `createSlice`/`createEntityAdapter`; IDs use `nanoid`. The persistence epic ignores transient data/fetch/clock events, debounces 3 seconds, saves session configuration to `localStorage("ashiso-state")` with candles/indicators cleared and fetching reset, then toasts. App bootstrap validates the saved shape with Valibot. [A-store][A-app][A-utils][A-session][A-epics]

Chart handles, focus, legend time, and exported analyzer continuation state are local Solid signals/variables; primitive rendering classes do not consume Solux directly, although their wrappers do. That separation is an existing extraction seam. It is not proof that Solux 3.3.2 should be reused, that a global store is appropriate for a registry component, or that the current local Solux source matches this older installed contract; those questions remain for the dedicated state investigation. [A-chart][A-band-render][A-band-wrapper][A-ma-render][A-ma-wrapper]

Other concrete coupling: Kobalte theme/primitive UI; Tailwind application CSS and `@/` aliases; i18next/tooltips/icons; Corvu layout; Solid DnD and resize-observer helper for toolbar positioning; AirDatepicker and its CSS; UTC/date-fns time alignment; RxJS/webSocket, Xior, SQLocal/Drizzle, browser storage, workers, and environment-configured exchange/crypto services. Their actual roles are visible in the cited modules; none should be presumed mandatory consumer infrastructure merely because Ashiso uses it. [A-package][A-app][A-panel][A-controls][A-date-control][A-datepicker][A-binance][A-worker-candles]

## Additional reference gaps

- History/analysis responses are checked by chart sender but lack request IDs, generation tokens, cancellation or stale-result rejection. Rapid date changes or chart remount with the same sender can accept an older response. Worker fetch has no catch/error response; empty history returns before the candle path clears fetching. These are source-level risks, not reproduced failures. [A-chart][A-candles][A-worker-candles]
- Historical replacement resets the time scale whenever no selected date exists. Preserving a scrolled viewport on prepends cannot be inferred from this code. [A-candles]
- Band renderer/legend slope colors disagree, equality can set competing legend classes, and different modules treat doji direction differently. Literal color parity needs a human choice about whether to preserve or correct these inconsistencies. [A-band-render][A-bollinger-preview][A-pair][A-volume-preview][A-volumes]
- Time handling assumes numeric UTC seconds in chart events and milliseconds in store; arbitrary business-day strings/custom horizontal scales are not handled. App resolution logic targets continuous crypto intervals rather than market holidays/gaps. [A-chart][A-candles][A-utils][A-types][A-graph]
- No executed accessibility, visual, SSR, disposal, numerical-accuracy, exchange-connectivity, throughput, or long-running memory checks support this inventory. The source uses browser globals/services in app bootstrap; this is not evidence that reusable Gurafu code must depend on that bootstrap. [A-app]

## Recommendations and questions for later decisions

These are **recommendations**, not decisions:

1. Use this inventory as a capability checklist across core chart behavior, optional recipes/controls, and consumer-owned application integration. Require an explicit owner for every legend, indicator, navigation, and replay behavior; do not equate complete accounting with built-in inclusion.
2. Specify data replacement/incremental update, event subscription, primitive attachment/cleanup, formatting, resize, and navigation behavior against v5.2.1 before selecting public signatures. Keep separate-chart coordination in a consumer example as already required. [G-readme][Map]
3. Separate intended experience from reference defects: validate indicator mathematics, define missing-data/leave semantics for legends, and define replay data visibility before declaring parity.

Decision questions surfaced by the evidence:

- Which indicator computations, primitive renderers, legend views and toolbars ship as reusable registry items versus documented consumer recipes? Is phase parity a numeric legend only, or is an additional visualization desired?
- For each overlay, preserve same-plot placement or demonstrate native v5 panes? How do native pane height/series movement/removal interact with optional indicators? (No answer selected here.)
- Are band computations and conflicting slope/doji colors required literally, or should the specification define corrected numeric/visual semantics? What is the intended band warmup and zero-value behavior?
- Does replay consume already-windowed application data, or does a reusable utility own cutoff/clock behavior? What prevents higher-timeframe and indicator look-ahead, handles gaps, and restores live mode? Trading-session ownership remains application-side regardless.
- What should legends display before hover, on mouse leave, for incomplete live bars, at absent timestamps across timeframes, or before analysis is ready? Should precision/compact notation/localization be consumer-supplied?
- What minimal range/data/event seams let the application own request identity, stale-response rejection, cache, pending/error state, and date policy? Should changing series input preserve viewport by default?
- Does Gurafu need per-chart local state only or an optional Solux store? How will store and imperative handles follow component lifetime without importing Ashiso session models? Ashiso's usage alone does not settle this.

## Concrete verification scenarios for a later implementation

These are proposed checks, **not tests executed during this research**. Each probes the cited behavior or risk.

| Scenario | Observable result to specify/verify |
| --- | --- |
| Mount → data → toggle each indicator twice → unmount/remount | Exactly one chart/series/primitive/subscription per owner; no detached-handle updates or duplicate worker handlers; all four legend labels and enabled count consistent. [A-chart][A-candles][A-volumes][A-legend] |
| Candle + volume overlay, then candle + native volume pane | Overlay remains a same-plot scale with independent numeric formatting; pane case has a distinct pane/height and series ownership. Test multiple panes' resize/reorder/remove separately from multi-chart layouts. [A-volumes][L5-chart][L5-pane] |
| <18 / 18 / >36 closes, <200 / 200 volumes; zero/flat data; export/restore and incremental continuation | Record exact band/MA/volatility/phase fixtures, warmup, undefined/zero handling, NaN/infinity policy, and start-vs-update equivalence; choose intended semantics before asserting conventional indicator accuracy. [A-worker-analysis][A-band-calc][A-sd][A-band-info][A-ma-calc] |
| Hover historical/live/doji bar; first hover absent; leave chart; analysis arrives late | Verify every OHLC/MA/volume/lower-middle-upper/volatility/phase value, precision, color and question fallback; ensure missing collections never crash. [A-chart][A-pair][A-volume-preview][A-bollinger-preview][A-volatility-preview][A-phase] |
| Two charts with different timeframes/ranges | In the consumer example, share time only, avoid feedback, test inside/outside receiver viewport and missing timestamp, then mouse leave. Pan/zoom one chart and confirm no unintended viewport synchronization. [A-layout][A-chart][A-candles] |
| Calendar before onboard date / near now / ordinary historic date; UTC vs DST locale; go-to-now | Specify rounding, clamping, centered range, fetching and current viewport; ensure go-to-now clears selection and replay/live transition is deliberate. [A-datepicker][A-date-control][A-candles][A-graph] |
| Scroll below 750 remaining bars, delayed/empty/error results, A→B→A date selection | Consumer chooses loading thresholds and handles duplicate/stale requests. Define prepend/replace viewport preservation and completion/error behavior, including zero bars. [A-candles][A-graph][A-worker-candles] |
| Open live candle → same-time changes → close → next timestamp → reconnect | Price/volume series, legend entities and analysis agree on the authoritative bar; prevent duplicate analysis and closed-bar loss in history values. Dispose all live clients on unmount. [A-chart][A-binance][A-session][A-candles] |
| Enter replay from already-loaded future data, select start, step/play/pause at every speed, seek backward, exit | Verify cutoff updates even without array replacement; no future candles/indicators leak; no update of an older bar into an incompatible series; explicit restoration to historical/live data. [A-replay][A-candles][A-volumes][A-selectors] |
| Replay with 1m and 5m charts, hide lowest timeframe, change layout, hit a data gap and present | Define single clock ownership, higher-timeframe partial-bar semantics, fetch backpressure, gap progression, and end-of-replay behavior. These are not established as safe by the reference. [A-replay][A-selectors][A-back-controls] |
| Light/dark/system, parent resize, 1–4 chart layouts, narrow toolbar, two sessions | Verify transparent chart/theme contrast, primitive DPR/resize alignment, controls and overlays, independent chart lifetimes, and splitter persistence key isolation. [A-chart][A-band-render][A-vol-render][A-ma-render][A-panel][A-flex][A-grid] |

## Source index

All Ashiso links pin the inspected commit. Line anchors identify entry points; file contents provide the surrounding paths described above.

[Map]: https://github.com/carere/gurafu/issues/3
[G-package]: https://github.com/carere/gurafu/blob/39fe95bf83e76f825a57c3b00de3d745a3ed15bc/package.json#L21-L22
[G-readme]: https://github.com/carere/gurafu/blob/39fe95bf83e76f825a57c3b00de3d745a3ed15bc/README.md#L102-L139
[A-package]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/package.json
[A-lock]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/bun.lockb
[A-chart]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/index.tsx#L48-L262
[A-candles]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/series/candles.tsx#L40-L279
[A-volumes]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/series/volumes.tsx#L11-L100
[A-layout]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/layouts/index.tsx#L7-L39
[A-flex]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/layouts/flex.tsx
[A-grid]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/layouts/grid.tsx
[A-panel]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/index.tsx
[A-controls]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/controls/index.tsx
[A-back-controls]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/controls/back-test.tsx
[A-date-control]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/controls/date-selector.tsx
[A-datepicker]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/atoms/date-picker.tsx
[A-creator]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/creator/index.tsx#L113-L147
[A-theme]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/atoms/toggle-theme.tsx
[A-legend]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/legend/graph-legend.tsx
[A-pair]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/legend/pair-preview.tsx
[A-volume-preview]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/legend/volume-preview.tsx
[A-bollinger-preview]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/legend/bollinger-preview.tsx
[A-volatility-preview]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/legend/volatility-preview.tsx
[A-phase]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/legend/phase-preview.tsx
[A-band-wrapper]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/primitives/bollinger-bands-primitive.ts
[A-vol-wrapper]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/primitives/volatility-cycle-primitive.ts
[A-ma-wrapper]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/primitives/volume-ma-primitive.ts
[A-band-render]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/indicators/bollinger-bands.ts
[A-vol-render]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/indicators/volatility-cycle.ts
[A-ma-render]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/indicators/volume-moving-average.ts
[A-analyzer]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/utils/analyzer/index.ts
[A-band-calc]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/utils/analyzer/indicators/bollinger-bands.ts
[A-band-info]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/utils/analyzer/indicators/bollinger-bands-info.ts
[A-ma-calc]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/utils/analyzer/indicators/volume-moving-average.ts
[A-sma]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/utils/analyzer/indicators/small-moving-average.ts
[A-sd]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/utils/analyzer/indicators/standard-deviation.ts
[A-replay]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/mode/replay.ts
[A-graph]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/utils/graph.ts
[A-utils]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/utils/index.ts
[A-types]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/types.ts
[A-store]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/store/index.ts
[A-selectors]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/store/selectors.ts
[A-session]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/store/slices/session.slice.ts
[A-epics]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/store/epics.ts
[A-app]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/app.tsx
[A-shell]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/routes/(shell).tsx
[A-worker-analysis]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/workers/indicators.worker.ts
[A-worker-candles]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/workers/candles.worker.ts
[A-db]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/db/schema.ts
[A-collect]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/utils/collect.ts
[A-binance]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/adapters/exchanges/binance/binance.ts
[L4-defaults]: https://github.com/tradingview/lightweight-charts/blob/v4.2.1/src/api/options/chart-options-defaults.ts
[L5-tag]: https://api.github.com/repos/tradingview/lightweight-charts/git/tags/bf4bdc64e1ac5d6dc8a1c01e1340cc1cb25ca695
[L5-chart]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/api/ichart-api.ts
[L5-pane]: https://github.com/tradingview/lightweight-charts/blob/b2ce010e4ad59f6556c9ed60e2b2b30feccdd2d1/src/api/ipane-api.ts
