# Gurafu

A shadcn-compatible registry for SolidJS trading charts, built on
[Zaidan](https://zaidan.carere.dev) and
[TradingView Lightweight Charts v5](https://tradingview.github.io/lightweight-charts/).

The foundation is a single TanStack Start application using Solid, Vite,
and Tailwind CSS, targeting Cloudflare Workers at <https://gurafu.carere.dev>.
Bun manages dependencies and runs the tooling; development and preview use
Cloudflare's local Workers runtime through its Vite plugin.

## Development

Install [proto](https://moonrepo.dev/proto) and [Cocogitto](https://docs.cocogitto.io/)
(`cog`, used by the conventional commit hook), then run:

```sh
proto trust .prototools
proto install
bun install
moon run gurafu:dev
```

The application runs at <http://localhost:3000>. Runtime and Moon versions are
pinned in `.prototools`. `bun install` installs the Lefthook Git hooks.

## Commands

Moon owns the project tasks; focused acceptance scripts also run directly through Bun.

| Command                              | Purpose                                              |
| ------------------------------------ | ---------------------------------------------------- |
| `moon run gurafu:dev`                | Build the registry and start development             |
| `moon run gurafu:check`              | Check formatting, imports, and lint rules with Biome |
| `moon run gurafu:fix`                | Apply Biome fixes                                    |
| `moon run gurafu:tsc`                | Check TypeScript                                     |
| `moon run gurafu:knip`               | Find unused code and dependencies                    |
| `moon run gurafu:r-validate-kobalte` | Validate the registry catalog                        |
| `moon run gurafu:r-build-kobalte`    | Validate and generate registry JSON                  |
| `moon run gurafu:build`              | Build the registry and production application        |
| `moon run gurafu:preview`            | Preview the production build locally                 |
| `moon run gurafu:deploy`             | Build and deploy to Cloudflare Workers               |
| `moon run gurafu:deploy-preview`     | Build and publish a Cloudflare Worker Preview        |

To run the same checks as CI:

```sh
moon run gurafu:check gurafu:tsc gurafu:knip gurafu:build
```

Build before running `preview`. `GET /api/health` returns `{ "status": "ok" }`
through a TanStack Start server route.

## Hosting

`wrangler.jsonc` configures the `gurafu` Worker and the custom domain
`gurafu.carere.dev`. The Cloudflare Vite plugin builds the server and static
assets into `dist/` and generates the deployment configuration.

Cloudflare Workers Builds connects directly to `carere/gurafu` through the
Cloudflare GitHub App, as in Zaidan. Pushes to `main` deploy production to
`gurafu.carere.dev`; pushes to other branches create or update Cloudflare Worker
Previews. Cloudflare reports build and deployment status on GitHub PRs.
GitHub Actions runs formatting, type, dependency, registry, and build checks;
it does not deploy and needs no Cloudflare credentials.

Manage the repository connection and build settings under Cloudflare's
Workers & Pages → `gurafu` → Settings → Builds. The Cloudflare Workers and Pages
GitHub App must include `carere/gurafu` in its repository access.

The Cloudflare build settings are:

| Setting         | Production                                  | Branch previews                    |
| --------------- | ------------------------------------------- | ---------------------------------- |
| Branch          | `main`                                      | All other branches                 |
| Root directory  | `/`                                         | `/`                                |
| Build command   | `bash scripts/build-cloudflare.sh`          | `bash scripts/build-cloudflare.sh` |
| Deploy command  | `bunx wrangler deploy`                      | `bunx wrangler preview`            |
| Build variables | `BUN_VERSION=1.4.4`, `NODE_VERSION=24.22.1` | Same as production                 |

The build helper makes Moon's base branch available in preview checkouts. Moon
is installed as a pinned project dependency so the Cloudflare build image can
run it. Deployment authentication is managed by Cloudflare's build token.

For a manual production deployment, authenticate Wrangler and run
`moon run gurafu:deploy`. For a manual preview, run
`moon run gurafu:deploy-preview -- --name <preview-name>`. Worker Previews use
Cloudflare's open-beta Preview deployment feature; their configuration and
resources are separate from production. Remove a finished preview with
`bun wrangler preview delete --name <preview-name>`.

Keep local Worker secrets in a gitignored `.dev.vars` file. Set production
secrets with Wrangler when provider integrations are added.

## Logo assets

`public/logo-light.svg` and `public/logo-dark.svg` are fixed Market logo variants.
The homepage selects between them using the application's `.dark` theme class.
`public/logo.svg` and `public/favicon.svg` adapt to the system color scheme through
an embedded SVG media query. All versions share the same candlestick geometry.

## Registry

`components.json` configures the upstream `@zaidan` registry and its `kobalte`
style. Website UI lives in `src/components/ui`; shared styling is installed from
Zaidan. Add upstream components with:

```sh
bun --bun shadcn add @zaidan/button
```

Gurafu's own catalog lives at `src/registry/kobalte/registry.json`. The build
validates it before generating static JSON in `public/r/kobalte`, which is
served at `/r/kobalte/registry.json`. Generated registry files are ignored by Git
and rebuilt before development and production builds.

The `chart` item installs `Root`, `Pane`, snapshot/incremental `CandlestickSeries`, `BarSeries`,
`LineSeries`, `AreaSeries`, `BaselineSeries` and `HistogramSeries`, scoped
`useChart` / `usePane` / `useSeries` accessors, matching native controller/prop
types, and plain `lightChartOptions` / `darkChartOptions` presets.
It pins Lightweight Charts **5.2.1**, published **@carere/solux 4.1.0**, and Solid
**1.9.18**. Core has no Zaidan, Kobalte, TanStack or Effect dependency.

Build locally, then install the generated item in a Solid SPA configured with
shadcn aliases:

```sh
bun --bun shadcn add /absolute/path/to/gurafu/public/r/kobalte/chart.json
```

With a `~/*` source alias, the installed composition is:

```tsx
import * as Chart from "~/components/gurafu/chart";

<Chart.Root style={{ height: "320px" }} options={{ autoSize: true }}>
  <Chart.Pane id="price">
    <Chart.CandlestickSeries id="candles" data={displayedCandles()} />
  </Chart.Pane>
</Chart.Root>;
```

Supply an ascending, unique readonly snapshot (including `[]` for empty data).
Native partial-option patches preserve omitted settings. Root exposes complete
native chart options; `layout.colorSpace` and `layout.colorParsers` are read only
at chart creation, as required by upstream. Presets own explicit appearance
values; the consumer chooses themes and persistence. Core copies row/time
objects before normalization; arbitrary metadata is not deep-cloned. Controllers
expose native `.api`, `ready()` and series `hasData()`. Hooks capture accessors
before mounting; check readiness before accessing the native handle. API refs
clear on removal and callback replacement. Raw native writes bypass managed data
and layout reconciliation. Model readiness does not promise usable coordinates
for hidden or zero-size containers. Consumers own dimensions and data recovery.

Pane and series ids are chart-local identities. Nesting selects the declared
pane; root-level series require `pane="id"`. Reactive pane targets and Solid
keyed declaration reorder retain compatible series/controller/data identity.
Changing an id/type, removing and reintroducing a declaration, or transferring
it to another chart creates a fresh resource. Old managed handles stay disposed.
Retained series move before former panes are removed; remaining children are
removed before their pane. Empty declared panes persist, including with `[]`.
The final native empty layout pane does not keep a removed declaration alive.

Pane `stretchFactor` and `height` use native sizing constraints. Consumers own
chart dimensions; native separators support user resizing. Initial creation and
keyed order reconcile before native widgets are necessarily laid out. Reacquire
native `series.api.priceScale()` after movement or price-scale changes: cached
native scale handles stay bound to their former pane/scale.

The homepage's [Basics example](src/components/examples/basics.tsx) demonstrates
all six standard families, snapshot replacement/empty display, autosizing and
appearance controls. The [native panes example](src/components/examples/native-panes.tsx)
defaults to a separate native volume pane and includes an intentional overlay
alternative and keyed pane reorder. Supplied volume/candle colors count dojis
as up (`close >= open`); core does not generate volume. Both readable sources
also mount in the installed non-TanStack SPA acceptance harness.

[Data and history](src/components/examples/data-history.tsx) demonstrates separate
snapshot/incremental charts, explicitly resolved fixture requests, out-of-order
completion, failures/retry, context switching, updates, correction, pop and
load-before-date navigation. The application retains recoverable history, merges
pages with current live corrections and rejects obsolete results before writing.
These fixtures do not claim live-network integration. Custom extensions and
other optional UI remain in [spec #17](https://github.com/carere/gurafu/issues/17).

### Data authority and navigation

An array `data` selects snapshot authority. Omit `data` for incremental authority,
initially empty or seeded by `defaultData`. The two props are exclusive, and the
snapshot controller has no managed data writer. Recreate the declaration to change
modes intentionally. Incremental controllers retain each family's native and row types and
expose `setData(readonlyRows)`, `update(row, historicalUpdate?)` and `pop(count)`.
Equal latest time replaces the complete bar; newer time appends. `setData([])`
clears display while retaining resources. Each completed managed operation updates
the private observable displayed source before notifying `onDataChange`, with the
native scope (`pop` emits `update` only when it removes fulfilled bars).

Historical `update(row, true)` requires an **existing populated bar in that target
series**. A time present only in a sibling series or at target whitespace is
insufficient: Lightweight Charts 5.2.1 can overwrite a following target bar in
these sparse cases. Use replacement to insert unseen history. Gurafu does not
validate membership, sort, deduplicate or repair caller data. Native
`pop(count)` returns fulfilled bars newest first; whitespace/timeline points are
not counted or necessarily removed. Native readback is not a lossless archive.
Conflation stays off by default; opt-in active native conflation rejects
historical correction, without an automatic option switch or fallback.

`Root.datasetKey` accepts a reactive string/number, constant when omitted. A new
key clears managed display and selection, reconciles current supplied inputs,
and resets navigation while retaining compatible chart/pane/series/controller
identities. `defaultData` seeds once per dataset context; later same-context seed
changes are ignored. Supply matching keys/snapshots together. For async incremental
initialization, seed empty and call `setData` once matching data and controllers
are ready. Retained handles do not validate delayed responses: cancel or reject
obsolete application work before invoking them.

Same-context history replacement preserves a time anchor and zoom on the chart's
union timeline, including sparse sibling data; removed anchors clamp to remaining
data and empty data has no anchor. New bars follow latest only when already
following. `chart.goToTime(time)` centers the native target (nearest native index
when absent) at current zoom; `chart.goToLatest()` resumes latest navigation
immediately. Both require current model readiness and non-null native layout/data
ranges. They never queue across contexts. Native viewport bounds still apply.
`ready()` can be false during generation reconciliation and remains false after
disposal; `hasData()` describes populated display, including zero values.

### Optional price overlays

The separately installed `chart-indicators` item depends on `chart` and adds
`BollingerBands`, `SMA`, `calculateBollingerBands`, `calculateSMA` and their public
parameter/result types. It adds no Effect, Query, TanStack or optional control UI.
The generated item is `/r/kobalte/chart-indicators.json`; its core dependency uses
the registry's hosted URL. Local acceptance serves both generated items together.

```tsx
import * as Indicators from "~/components/gurafu/indicators";

<Chart.Pane id="price">
  <Chart.CandlestickSeries id="candles" data={displayedCandles()} />
  <Indicators.BollingerBands id="bands" source="candles" />
  <Indicators.SMA id="sma" source="candles" />
</Chart.Pane>;
```

Bands default to period **18**, multiplier **2**, population variance; SMA defaults
to **20**. Both require a full uninterrupted window. OHLC defaults to close, with
open/high/low/close/hl2/hlc3/ohlc4 selectors; single-value inputs use their value.
Zero is populated, timestamp gaps continue, and explicit whitespace restarts
warmup. Pure functions preserve one result timestamp per input and do not mutate
inputs. Bands return a complete middle/upper/lower triple or whitespace.

Instead of `source`, supply an exclusive readonly `data` snapshot using the pure
result shapes. Supplied mode runs no calculation. Calculated mode sees only the
chart-local managed display, including whitespace and live/replay changes; the
application keeps recoverable history. Both modes retain compatible native lines
through source/parameter/appearance changes. Nest inside an explicit Pane or set
`pane` at Root. Logical ids count once per indicator; internal line ids reserve
`<id>/middle`, `/upper`, `/lower` or `/sma` in the chart's series namespace.

`visible` is authoritative. `chart.requestIndicatorVisibility(id, visible)` emits
`onVisibleChange` and waits for a controlled value; a request may be declined or
delayed. Otherwise `defaultVisible` initializes independent private per-chart
visibility. Hiding keeps resources; unmounting removes them. Unknown/removed ids
and disposed controllers fail clearly. No private store is a consumer API.

Bands draw three solid 1px lines, green middle and raw-value rising blue/falling
red outer segments. Flats retain direction (initially blue); whitespace breaks
lines and resets direction. Scale inversion does not reverse colors. SMA is blue
2px. `SMA.options` accepts native line options. Bands accepts native options under
`options.middle/upper/lower`, plus `risingColor`/`fallingColor`; an explicit outer
`color` selects a uniform color. Logical visibility takes precedence over native
`options.visible`. Presentation changes do not recalculate numerical values.

The readable [Indicators and panes example](src/components/examples/indicators-panes.tsx)
shows parameter/price selectors, calculated/supplied Bands, visibility and a native
volume pane. EMA, RSI, legends and selection widgets remain later spec tickets.

### Acceptance checks

```sh
bunx playwright install chromium
bun run test:indicators
moon run gurafu:test-solux gurafu:test-chart
```

`test-solux` probes the published package's opt-in DevTools protocol, detached
nested RESET snapshots and repeated disposal. Its extension fake does not certify
the actual Redux extension UI. `test-chart` generates registry JSON, uses the
actual shadcn installer for separate core-only and optional-first consumers in OS
temporary directories outside the repository,
installs declared published dependencies, compiles positive/negative public types
with `skipLibCheck: false`, builds a non-TanStack Solid SPA, reports the single
Solid runtime and runs Chromium browser checks against that installed source.
No local Solux build or application-wide provider is required. Dedicated component
SSR/hydration and later spec features are outside this slice.

## Source layout

```text
src/
  components/ui/      Website components installed from Zaidan
  lib/               Website utilities
  registry/kobalte/  Source code and catalog for distribution
  routes/            Application pages and server routes
  styles/            Styles installed from Zaidan
  router.tsx         TanStack router configuration
  styles.css         Tailwind and theme entry point
```

Keep distributed registry code independent of application routes and server
implementations. Consumers should be able to install the components into other
Solid applications without adopting TanStack Start or using Gurafu's hosted
services. Provider integrations and credentials will be added with the data
integration work.
