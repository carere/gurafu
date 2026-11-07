# Website market services

This directory is application code, outside the installable chart registry.
`ServiceHistory` supplies ordinary snapshots to `Chart.CandlestickSeries`; the
registry never imports Effect, Query, Router, or exchange policy.

`createMarketApp(layer)` owns a QueryClient and lazy ManagedRuntime. Router context
carries both with a typed root route. The browser root disposes the app; a dataset
only aborts its own scoped work. `ClientOnly` around the network example prevents
server rendering and route preload from starting Binance requests. No proxy,
credentials, custom headers, workers or database are involved.

`ExchangeGateway` adapts Ashiso's fetch/livePrices/close-by-client-id boundary at
commit `1b716f85bea71a703330cdae74b83f82732812a9`. `ExchangeFacade.history`
adapts its collector with Spot's 1000-page size, a ten-page request budget,
empty/no-progress termination and open-time cursor advancement. The Layer registry
replaces a client's stream before subscribing and removes it on finalization;
an old scope cannot delete its replacement. The owned runtime/typed context and
abort-forwarding pattern follows Delimoov's storefront runtime and query wiring,
without its transport topology or patches.

The default Layer uses keyless Spot REST and raw kline WebSockets. Decimal wire
prices/volume become finite numbers and open-time milliseconds become UTC chart
seconds exactly once at this port. Stream closure flags remain intact. REST closure
is inferred from its close time and the current clock; incomplete bars are retained.
Minute/month interval case remains significant. Official contracts:

- [Binance REST klines](https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md#klinecandlestick-data)
- [Binance public market-data-only endpoints](https://github.com/binance/binance-spot-api-docs/blob/master/faqs/market_data_only.md)
- [Binance kline streams](https://github.com/binance/binance-spot-api-docs/blob/master/web-socket-streams.md#klinecandlestick-streams-for-utc)
- [Effect managed runtime](https://effect.website/docs/v3/runtime)
- [Solid Query](https://tanstack.com/query/latest/docs/framework/solid/overview)

Published dependencies are pinned to Effect 3.22.4 and Solid Query 5.107.1; the
existing newer Router/Start versions are retained. Strict installed-consumer
compilation checks their real declarations with `skipLibCheck: false`.

`createMarketDataset` gives each chart an independent Query key and generation.
Query owns history, request/error/loading state and recoverable rows. A bounded
1000-candle handoff journal protects concurrent live corrections while history is
pending; overflow fails history explicitly and retains displayed corrections.
Normal older-page merges preserve existing corrections. Reconnect cancels old
history without reverting live cache writes, fetches from the penultimate open
time, and lets newly received live rows win that fresh tail. All callbacks check
current owner/dataset lifetime. Removing a chart never disposes its sibling's
runtime. Older-history buttons request the immediately preceding page; explicit
bounded ranges can be collected by the same facade for later examples.

History requests time out after 20 seconds. HTTP retries are manual; readable
Retry-After values are respected. CORS-hidden failures do not claim a status or
response body. Sockets have a 15-second connect timeout and at most four automatic
reconnect delays (1, 2, 4, 8 seconds) per subscription, including open/close loops.
Users can explicitly reconnect after exhaustion. Disconnection retains usable
history and marks it potentially stale. The collector caps each request at ten
pages; it is not a complete-market archive or an unbounded gap-repair engine.

`createMarketFixture({ controlled: true })` injects a deterministic Layer at the
same port. Tests/future examples can resolve/reject pages in any order, inspect
abort/finalization at that boundary, and emit stream/connection events even after
closure to exercise stale-callback rejection. The automatic fixture mode supplies
illustrative calendar-aligned data and a connected, static stream; it never claims
live market prices. Instantiate a fixture/app per application owner and dispose it.

Run `bun run test:market` for service-boundary checks and `bun run test:chart` for
the installed-SPA browser checks. SPA preparation first installs/strictly checks
core and all public type examples without website dependencies, then installs the
pinned Effect/Query packages and compiles/mounts the actual website service source.
Deterministic acceptance does not depend on Binance availability. Live origin,
long-running reconnect and cross-region availability remain separate checks.

Replay adds an optional third argument to `createMarketDataset`: `{ active }`, a
Solid accessor defaulting to true. False disables automatic history fetching,
cancels this dataset's in-flight history without reverting live writes and
finalizes only its scoped stream. Recoverable rows remain in Query. `recoverLive()`
uses the existing bounded tail repair/journal and returns its completion; the
completion follows a replacement repair if the stream reconnects while recovery
is pending. The consumer supplies current live data only after that result
succeeds. Neither operation disposes the app runtime or sibling datasets. Existing callers retain
their original behavior. Replay seek requests use separate owner/generation Query
keys and the same ExchangeFacade/Effect abort boundary, with application-owned
cutoff and stale-result guards.
