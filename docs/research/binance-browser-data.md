# Binance browser data: evidence for the website examples

Verified 2026-11-06 UTC for [Verify Binance market data for browser-based examples](https://github.com/carere/gurafu/issues/16), supporting [Specify website examples and implementation acceptance criteria](https://github.com/carere/gurafu/issues/11). Research only; preserve the approved six focused examples and fixed test fixtures.

**Finding:** adapt Ashiso's existing exchange port/adapter as the website-owned data boundary. Official Binance Spot market-data-only URLs support keyless candle history and optional live streams. Successful HTTP probes support simple cross-origin GETs today, but do not establish browser integration or universal availability. No new datafeed framework, service, proxy, database, credentials, or Gurafu feed API is needed by these findings.

## Ashiso reuse evidence — source inspection, not runtime verification

Inspected clean local checkout `/Users/carere/Projects/oss/ashiso` at GitHub commit [`1b716f85bea71a703330cdae74b83f82732812a9`](https://github.com/carere/ashiso/tree/1b716f85bea71a703330cdae74b83f82732812a9); that commit also resolves through GitHub. There is no `src/libs/ports` directory at this revision: the relevant typed contracts live with the facade.

- [Exchange contracts and facade][A1]: `ExchangeGateway` exposes `fetch`, `livePrices`, `closeLivePrices`, and `getMaxKlinesLimit`, plus metadata import. `ExchangeFacade` routes by exchange slug and accepts injected gateways. This is the existing port/adapter seam to reuse, keeping feed ownership in the website consumer.
- [App composition][A2] injects `binanceExchangeGateway(restApiUrl, wsApiUrl)` using public build-time URL settings; it also constructs candle/indicator workers. [Candle worker][A3] separately composes the facade for history collection and SQLite persistence. The URL values were not inspected and the configured production hosts were not verified. Reuse the exchange seam and suitable conversion/collection logic; the worker/database/session stack is unnecessary for six focused demos.
- [Binance adapter][A4] uses Xior for relative `/klines` requests, mapping ticker, interval, bounds and limit. REST decimal strings become numeric OHLC/volume; trade count comes from index 8. Timestamps stay in **milliseconds**. It filters out the current interval using local-clock/resolution calculations and labels retained candles closed. REST errors become `Future<Result<..., AppError>>` failures. This heuristic is source behavior, not proof of exchange-confirmed closure.
- The same [adapter][A4] constructs lowercase-symbol kline WebSocket URLs, maps `k.o/h/l/c/v`, `k.t`, `k.n`, `k.x`, and retries errors after 3 seconds. It caches an observable per candle identity and a subscription per client ID. `closeLivePrices` unsubscribes the stored client subscription. [Chart effect][A5] subscribes only in live, non-replay mode and registers cleanup. Registry entries are not deleted and an existing client subscription is not explicitly unsubscribed before replacement: verify repeated setup, ID reuse, reconnection and final disposal during adaptation; source inspection does not prove leak-free runtime behavior.
- Ashiso's [types/ticker helper][A6] use `MAX_KLINES = 1500`, perpetual metadata, and stripping of `BINANCE:` / `.P`. This is futures-shaped application code, not evidence that the inspected app already uses Spot market-data-only hosts. For the researched Spot host, adapt the limit to **1000** and choose Spot symbols directly; do not carry perpetual-contract discovery into the examples. Both adapter request paths lowercase the resolution, which turns monthly `M` into minute `m`; preserve Binance's case-sensitive intervals when adapting.
- [History collector][A7] pages forward through the facade, stops on a short page, and advances by one resolution after the last candle. Align its limit and termination behavior with the adapted adapter; do not infer history exhaustion just from a page shortened by filtering. Ashiso's chart [history mapping][A8] and [live update][A9] divide milliseconds by 1000 before passing data to Lightweight Charts. Preserve that conversion exactly once.

## Supplemental official endpoint facts

Binance's [market-data-only FAQ][B1] explicitly documents no authentication for `https://data-api.binance.vision`, including `GET /api/v3/klines`, `/api/v3/time` and `/api/v3/exchangeInfo`. The same FAQ provides `wss://data-stream.binance.vision:443/ws/btcusdt@kline_1m` for public market streams; user data streams are unavailable there. Use the REST factory base `https://data-api.binance.vision/api/v3` with Ashiso's relative `/klines` path. This research concerns **Spot**, not perpetual prices.

[REST kline documentation][B2] requires `symbol` and `interval`; limit defaults to 500, maximum 1000, weight 2. Intervals are case-sensitive (`1m` versus `1M`). Default `timeZone` is UTC; omit it for the examples. Bounds remain UTC even if a timezone is supplied. [General REST rules][B3] specify chronological results, latest items without bounds, earliest items from `startTime`, and latest items through `endTime`. Response times default to milliseconds; keep that default and avoid the optional microsecond header.

The [documented tuple][B2] has these relevant fields:

| Index | Meaning | Wire value |
| --- | --- | --- |
| 0 | Candle open time | Milliseconds, number |
| 1–4 | Open, high, low, close | Decimal strings |
| 5 | Base asset volume | Decimal string |
| 6 | Scheduled candle close time | Milliseconds, number |
| 7 / 8 | Quote volume / trade count | String / number |
| 9–11 | Taker volumes / unused field | Strings |

**Adaptation implications:** convert open time to UTC epoch seconds (`openTimeMs / 1000`), OHLC/volume to numbers, and request bounds back to milliseconds. Use open time as candle identity, not the request/event/close time. A TypeScript cast alone does not convert units. Keep rows ordered and unique after history/live merges; validate parsed numbers in the website adapter. JS numbers are suitable chart inputs, not a promise of exact decimal accounting.

For older history, use `endTime = earliestLoadedOpenTimeMs - 1`; for forward pages, use `startTime = lastReturnedOpenTimeMs + 1` with a fixed upper bound. These are client paging strategies inferred from the documented ordering and boundary probes below, not Binance cursor APIs. Stop on empty/no-progress responses; keep paging bounded and deduplicate overlaps. Do not assume every interval exists or promise unlimited retained history.

## HTTP observations and browser limits

Probed from this machine with Python's standard HTTPS client, no API key/signature/cookies, and `Origin: https://example.com`. These were **not browser fetches**. Requests completed at 22:49:39–22:50:32 UTC on 2026-11-06. All paths below use `https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1m` unless noted.

| Request suffix / method | Observed response |
| --- | --- |
| `&limit=2` GET | 200, JSON, 12-field rows; `Access-Control-Allow-Origin: *`; allowed methods `GET, HEAD, OPTIONS` |
| `&startTime=1704067200000&endTime=1704067319999&limit=2` GET | 200; opens `1704067200000`, `1704067260000`; same CORS headers |
| `&endTime=1704067200000&limit=2` GET | 200; opens `1704067140000`, `1704067200000`: boundary open included |
| `&startTime=1704067200001&endTime=1704067319999&limit=2` GET | 200; only `1704067260000` |
| `&endTime=1704067199999&limit=2` GET | 200; opens `1704067080000`, `1704067140000`: older page excluded the boundary |
| `&limit=2` OPTIONS with `Access-Control-Request-Method: GET` | 403 HTML; no allow-origin header |
| Same OPTIONS plus `Access-Control-Request-Headers: x-mbx-time-unit` | 403 HTML; no allow-origin header |
| `interval=invalid&limit=2` GET instead of `interval=1m` | 400 JSON, code `-1120`, message `Invalid interval.`; **no allow-origin header** |

The successful responses also contained used-weight headers, but **no `Access-Control-Expose-Headers`**. Reproduce a simple GET with:

```sh
curl -i --max-time 15 \
  -H 'Origin: https://example.com' \
  'https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=2'
```

**Documented versus observed:** the inspected Binance endpoint docs do not promise CORS. The observed wildcard supports credentialless simple cross-origin GETs under the [Fetch CORS standard][C1]. Keep requests free of custom headers/body and use `credentials: "omit"`; OPTIONS advertising alone does not establish a working preflight. Do not use `no-cors`, which makes JSON unreadable. The observed error would be hidden from cross-origin JavaScript without allow-origin; provide a generic fetch failure when status/body are unavailable. Used-weight and `Retry-After` headers are not automatically readable by page JS without exposure. These are protocol inferences, not browser test results.

## Latest bar, live data and replay

The latest GET at server `Date: Fri, 06 Nov 2026 22:49:39 GMT` included an open at `1794005340000` (22:49:00 UTC), closing at `1794005399999` (22:49:59.999 UTC): the response demonstrably included an **unfinished interval**. REST supplies no closed flag in its tuple. Do not treat every returned candle as final or simply label the last one closed; Ashiso's existing closed-history/current-live separation is the useful starting point.

[UTC kline streams][B4] carry `k.x` for closure and `k.t` for identity; documented update cadence is 1 second for `1s`, 2 seconds for other intervals. Map through the existing adapter; replace the same open-time candle while partial and append when a new interval starts. A REST snapshot and a WebSocket are not documented as atomic together: bound/buffer the handoff and merge by candle identity; refetch the tail after reconnect. No WebSocket handshake, message, or browser-Origin acceptance was tested here. General [stream rules][B5] describe 24-hour connections, server shutdown, ping/pong, 5 incoming control messages per second, 1024 streams per connection and 300 connection attempts per 5 minutes per IP; scope and disposal still matter for a small demo.

**Replay inference:** final OHLC/volume does not encode the order/time of intrabar trades. An `endTime` range selects candles; it is not a historical “what this unfinished candle looked like then” API. Full higher-timeframe bars can leak future highs/lows/close/volume when revealed before their close. Keep the simple replay example on completed-bar reveals, or explicitly withhold unfinished higher-timeframe bars. Exact historical intrabar partials would require finer-grained evidence and aggregation outside this research; never fabricate them from full OHLC. Pause/disconnect or quarantine live updates during replay and restore coherent live data on exit, using the existing ownership/cleanup pattern.

## Loading, failure and verification consequences

[Binance limits][B6] are per IP, with current rate-limit definitions in `exchangeInfo`, used-weight response headers, 429 for excess requests and 418 for continued violations. `Retry-After` is seconds. [HTTP documentation][B7] includes security/WAF 403 and server 5xx. Do not hardcode a permanent global quota or deliberately probe bans. Reuse one small website adapter/facade, bound page loading, avoid duplicate polling and retry storms, respect readable retry delays, and provide conservative backoff/manual retry when details are CORS-hidden. Retain history while live data is disconnected; present loading, empty history, stale/disconnected and failed/retry states distinctly. Cancel obsolete work or reject late results after dataset change/disposal.

These facts support the existing six-example plan, not extra pages or broader provider infrastructure. Keep deterministic fixtures behind the same website-owned seam for acceptance checks: units/numeric mapping, page boundaries/overlap, partial-to-closed updates, history/live handoff, stale responses, error/loading states, replay isolation and disposal. Live Binance availability should not gate repeatable tests. No production changes or runtime/browser tests were performed. The deployed origin's fetch/CSP behavior, WebSocket acceptance/reconnect, actual Ashiso execution, regional/network reachability and service uptime remain unverified. Keyless public access establishes neither unrestricted licensing nor universal regional availability; no license conclusion is made.

## Pinned primary sources

Binance documentation snapshot: [`2bae3f5bd622ebfdea593daed066df14dc7e7362`](https://github.com/binance/binance-spot-api-docs/tree/2bae3f5bd622ebfdea593daed066df14dc7e7362), fetched from official raw GitHub files. Official developer pages were also fetched: [market-data-only URLs](https://developers.binance.com/en/docs/products/spot/faqs/market_data_only), [REST market endpoints](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market), [REST general information](https://developers.binance.com/en/docs/products/spot/rest-api), and [WebSocket streams](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/ws-streams/~). Evidence is time-bound; probes cover only the requests recorded above, not every symbol, endpoint or error path.

[A1]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/adapters/exchange.facade.ts#L12-L80
[A2]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/app.tsx#L38-L53
[A3]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/workers/candles.worker.ts#L27-L85
[A4]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/adapters/exchanges/binance/binance.ts#L41-L160
[A5]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/index.tsx#L192-L204
[A6]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/adapters/exchanges/binance/types.ts#L1-L134
[A7]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/libs/utils/collect.ts#L6-L56
[A8]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/series/candles.tsx#L88-L104
[A9]: https://github.com/carere/ashiso/blob/1b716f85bea71a703330cdae74b83f82732812a9/src/components/organisms/session/panel/chart/series/candles.tsx#L248-L264
[B1]: https://github.com/binance/binance-spot-api-docs/blob/2bae3f5bd622ebfdea593daed066df14dc7e7362/faqs/market_data_only.md
[B2]: https://github.com/binance/binance-spot-api-docs/blob/2bae3f5bd622ebfdea593daed066df14dc7e7362/rest-api.md#klinecandlestick-data
[B3]: https://github.com/binance/binance-spot-api-docs/blob/2bae3f5bd622ebfdea593daed066df14dc7e7362/rest-api.md#general-api-information
[B4]: https://github.com/binance/binance-spot-api-docs/blob/2bae3f5bd622ebfdea593daed066df14dc7e7362/web-socket-streams.md#klinecandlestick-streams-for-utc
[B5]: https://github.com/binance/binance-spot-api-docs/blob/2bae3f5bd622ebfdea593daed066df14dc7e7362/web-socket-streams.md#general-wss-information
[B6]: https://github.com/binance/binance-spot-api-docs/blob/2bae3f5bd622ebfdea593daed066df14dc7e7362/rest-api.md#limits
[B7]: https://github.com/binance/binance-spot-api-docs/blob/2bae3f5bd622ebfdea593daed066df14dc7e7362/rest-api.md#http-return-codes
[C1]: https://fetch.spec.whatwg.org/#http-cors-protocol
