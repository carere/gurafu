# Composable chart delivery audit

This is the acceptance map for [spec #17](https://github.com/carere/gurafu/issues/17)
and its final [handoff #28](https://github.com/carere/gurafu/issues/28).
The target is browser SPA delivery; dedicated component SSR/hydration is excluded.
No production deployment or upstream publication is part of this verification.

## Reproduce

From the repository root, with the pinned proto toolchain installed:

```sh
bun install --frozen-lockfile
bunx playwright install chromium
bun --bun moon run gurafu:check gurafu:tsc gurafu:knip gurafu:build gurafu:test-chart gurafu:test-solux gurafu:test-indicators gurafu:test-market
```

These eight targets resolve to ten Moon tasks, including catalog validation and
registry generation. Focused equivalent commands are `bun run test:indicators`,
`bun run test:market`, `bun run test:solux` and `bun run test:chart`.
`test:chart` prepares fresh temporary consumers before launching Chromium; do not
run another preparation concurrently against the same checkout-derived directory.
A subsequent focused run can use `bun --bun playwright test tests/chart-gallery-28.spec.ts`.

For a manual website pass, use `moon run gurafu:dev`. Follow the six Examples
links and use each destination's “Read the … source” disclosure. Native panes
belong to Basics; both history variants and shared service implementations belong
to Data and history. Replay also exposes its session/finer-observation helpers;
Extensions includes its actual custom renderer. The gallery is direct JSX,
without a configuration-driven demo framework.

For installation into your own aliased Solid SPA, follow the
[local registry commands](../../README.md#registry). They use generated JSON and
rewrite only Gurafu dependency origins. They do not depend on publication of this
branch's hosted endpoints. The clean consumer templates live in `tests/chart-spa`;
`strict: true` and `skipLibCheck: false` are enabled. Its `~/*` alias intentionally
differs from the repository's `@/*` alias.

For deterministic interactive gallery inspection after preparation:

```sh
# Prints the consumer directory and its matching browser port for this checkout.
bun -e 'import {chartSpaDirectory,chartSpaPort} from "./scripts/chart-spa-path.ts"; console.log({chartSpaDirectory,chartSpaPort})'
# In the printed directory; use the printed port.
npm run dev -- --port <chartSpaPort>
# Open http://127.0.0.1:<chartSpaPort>/?gallery28
```

That SPA renders the actual final gallery with the website's automatic fixture
Layer: illustrative calendar-aligned data, static connected streams and no
Binance requests. The harness owns mount/remount and the shared app lifetime.
Focused market/replay/independence scenarios use controlled completions through
the same ExchangeGateway boundary. The plain SPA fixture is functional acceptance,
not a reproduction of the website's Tailwind/Zaidan styling.

## Executed results — 2026-11-07

Frozen installation and all ten Moon tasks passed on the #28 implementation.
Chromium: **81 passed**, preserving all 80 earlier cases and adding the gallery
assembly case. Numerical: **16 tests / 147 assertions**. Market: **6 tests / 54
assertions**. Published Solux **4.1.0** passed. All seven generated registry items
validated/built; actual core/indicators/standalone-widget/assembled installations,
strict public typechecks, single-runtime checks and SPA builds passed. Repository
Biome, TypeScript, Knip and client/server website production build passed.
The first full attempt stopped on README table formatting; the corrected full run
passed. Initial gallery test failures also corrected a source-disclosure selector
(it selected the lifecycle log) and an incorrect test button name. Neither was a
chart behavior change. Feature implementations and all earlier suites are retained.

## Review maintenance — 2026-11-07

The two-axis review found no documented-standard violations and no spec findings.
Its three maintenance findings are addressed: native Time identity is shared from
the existing internal data helper, SMA/EMA share private single-line composition,
and Root's unused cleanup registry is removed. Public declarations, calculations,
defaults, native option patching and actual extension ownership remain unchanged.

Frozen installation and all ten Moon tasks passed again: Chromium **81 passed**,
numerical **16 tests / 147 assertions**, market **6 tests / 54 assertions**, and
published Solux **4.1.0**. Registry builds, strict installed consumer types and
independent dependency/single-runtime boundaries passed. No new manual run is
claimed; the recorded evidence and limits below remain applicable. Verification
after merging these fixes into the integration branch remains the parent handoff.

## Acceptance coverage

Earlier feature suites remain the source of truth; #28 adds one assembled-gallery
scenario and strengthens actual installed file/package boundaries. No private
chart store or native-rendering mock is used for browser claims.

| Spec acceptance area                                                                                                                                                  | Executable evidence                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Six families, appearance, scoped contexts, refs, events, readiness, immutable Time, hidden/manual/autosizing                                                          | `chart.spec.ts`, `chart-composition-19.spec.ts`; installed `public-types*.tsx`                                                                                                                      |
| Native pane order/movement, empty versus removed, fresh lifetimes, current indexes                                                                                    | `chart-composition-19.spec.ts`, `chart-extensions-27.spec.ts` in optional and core-only consumers                                                                                                   |
| Snapshot/incremental exclusivity, corrections/pop, dataset identity/defaultData reseeding, anchor/zoom/latest-follow                                                  | `chart-data.spec.ts`; installed `data-types.tsx`                                                                                                                                                    |
| Four calculations, defaults, warmup, gaps, extreme values, immutable inputs                                                                                           | `indicators-22.test.ts`, `indicators-23.test.ts`: 16 tests / 147 assertions                                                                                                                         |
| Fresh calculations after source/parameter/context/replay changes; equivalent supplied data; native appearance                                                         | `chart-indicators-22.spec.ts`, `chart-indicators-23.spec.ts`, `chart-replay-25.spec.ts`                                                                                                             |
| Exact-time legend/latest/leave/whitespace/zero/removal, no future/stale values, controlled authority/local defaults, localization/render hooks                        | `chart-legend-24.spec.ts`, `chart-devtools-24.spec.ts`                                                                                                                                              |
| Coherent replay cutoff, finer-source partial bars, consumer clock, date load-before-navigation, obsolete seeks, explicit live restoration/reconnect                   | `chart-replay-25.spec.ts`; actual `replay-date/session/evidence` sources                                                                                                                            |
| Four-chart isolation, ticker/timeframe switch/removal/re-add, missing time, pointer-only unchanged-seconds coordination, no feedback                                  | `chart-independent-26.spec.ts`; native 5.2.1 may position 00:31 on the receiver's 00:35 bar while exact-time legend values remain unavailable                                                       |
| Custom D/O/P, nonzero-pane rendering, owned markers/primitives, once-only live-handle cleanup, populated-pane removal with working neighbor                           | `chart-extensions-27.spec.ts` in both consumers; installed `extensions-types-27.tsx`                                                                                                                |
| Unit mapping, bounded pages, history/live races, reconnect repair, Query abort/Effect finalization, sibling runtime survival, loading/error/retry                     | `market-21.test.ts`: 6 tests / 54 assertions; `market-services-21.spec.ts`, replay/independence suites                                                                                              |
| Published Solux opt-in/browser-only behavior, detached construction/reset/init/send snapshots, repeated disposal and no late owned observers                          | `tests/solux-gate.mjs` using actual published 4.1.0; protocol browser tests complement actual extension UI observations below                                                                       |
| Six discoverable destinations/current complete source and keyboard focus, assembled mount/unmount/remount                                                             | `chart-gallery-28.spec.ts`, using the actual gallery copied with import roots rewritten                                                                                                             |
| All six public items plus internal shared helper, required sources only, aliases, strict positive/negative standard/custom/Time/data-mode types, single Solid runtime | `scripts/prepare-chart-spa.ts`, `prepare-indicators-22.ts`, `prepare-replay-25.ts`, `verify-registry-boundary.ts`; real shadcn installs, npm packages, strict compilation and production SPA builds |

Registry boundary checks run **before** adding website Effect/Query dependencies:
core-only has just two chart sources and Solid/Lightweight Charts/Solux; indicators
first adds only its two calculation/declaration sources. Selection-only, legend-only,
replay-only and date-only use separate fresh consumers. Legend adds core/shared UI;
selection/replay/date add only their own source and the shared button/class helpers.
The assembly has all six public items. Each installation checks exact source and
runtime dependency sets and one deduplicated Solid runtime. Existing public type
fixtures cover all six standard families, custom D/O/P, supported native Time
forms, wrong rows/options/custom fields and exclusive data/calculation modes.
No Start/Router, website, exchange service or global app-store requirement is
introduced into installed chart source. Website fixtures add only their own
Effect/Query dependencies after those checks.

## Observed manual evidence — 2026-11-07

The final local TanStack/Cloudflare Vite website was reviewed through the shared
T3 browser. Six navigation links resolve to matching headings and focusable
destinations. Basics includes native panes as a subordinate heading; service-backed
history remains subordinate to Data and history. All six source groups were
reviewed, including replay/session/evidence, extension renderer and shared market
services. Native `summary` disclosures and ordinary labels remain keyboard usable;
the new browser test exercises Enter on every destination and source disclosure.
Buttons have visible text or accessible labels. Optional legend, selection,
replay and date controls expose labels/formatting/render hooks for consumer
localization; the website itself is English, not a translated locale catalog.

At desktop 1280×800 and mobile 390×844 the six destination bounds fit the page;
opening every source group on mobile keeps horizontal overflow inside its `pre`.
The mobile Indicators form wraps into usable rows. The retained Zaidan tokens,
neutral typography/controls and Ashiso-derived price-overlay/volume/RSI native-pane
composition were preserved. Mechanical Impeccable detection of changed UI reports
no findings. This is a bounded visual/manual pass, not a broad screenshot suite,
screen-reader certification or benchmark.

Basics' clear action visibly removes candles and reports “No data displayed”;
restore returns eight daily Candlestick rows. A six-second H.264 MP4 records that
actual final website interaction, with the visible “Prices are illustrative”
provenance. The artifact is outside the repository; the parent handoff records its
absolute path for PR upload. Screenshots are inspection aids, not PR evidence
substitutes. Deterministic public suites cover empty/loading/error/disabled/retry
and replay restoration states; those suites are distinct from manual observation.

The local final implementation also displayed real browser-direct Binance data:
service history and independent charts showed 1000/1001 candles, connected state
and live close changes; replay's live view showed the matching price. This is
local smoke evidence, not deployed implementation/reconnect certification.

### Prior live and official extension evidence retained

The #21 deployed-origin browser probe on `gurafu.carere.dev` read a credentialless
REST 200/two klines and received an incomplete raw kline WebSocket event within
12 seconds. The socket/tab were closed. #26 separately observed the actual local
website loading 1000 real rows and live updates at desktop/mobile sizes. Those
checks establish their recorded reachability/local behavior; they do not establish
this implementation on the deployed origin, regional universality or long-running
rotation/reconnect. No new deployment was authorized or performed here.

The #24 integration review **verified actual official Redux DevTools 3.2.12 UI**
in an isolated temporary Chrome profile, using real installed charts/Solux and the
standalone extension panel. Application and two identically named charts appeared
as distinct connections. UI Jump restored private pointer/visibility/legend state;
UI Reset restored private defaults. Controlled inputs remained authoritative and
three consumer market rows stayed unchanged. After removing the first chart,
resetting its historical entry did not revive it; sibling and application actions
continued. Remount created another distinct connection. Historical unsubscribed
entries persist in the extension UI. Exact owned listener cleanup is established
by protocol/published-package tests, not inferred from disappearance of entries.
The panel was opened before fixture reload to obtain complete instance metadata.
No extension/global-profile modification, docked-panel certification or new repeat
of that UI exercise is claimed for #28.

## Scope limits

All delivery gates concern Chromium, pure calculations, actual published packages,
strict installed types and the repository website build. Deployed implementation
CSP/reconnect, cross-region/long-running availability, Firefox/WebKit, dedicated
component SSR/hydration and performance benchmarks remain unverified. Native
sorted-data/layout preconditions and missing-time placement limits still apply.
There is no generic demo framework, excluded indicator, library feed service,
workspace orchestration, publication or production deployment in this handoff.
