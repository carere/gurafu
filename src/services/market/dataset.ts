import { createQuery, type QueryObserverResult, queryOptions } from "@tanstack/solid-query";
import { Effect, Either } from "effect";
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  onCleanup,
  untrack,
} from "solid-js";
import type { MarketApp } from "./app";
import {
  type Candle,
  type Connection,
  ExchangeFacade,
  ExchangeGateway,
  type Market,
  MarketError,
  mergeCandles,
  type Page,
} from "./exchange";

export function createMarketDataset(
  app: MarketApp,
  market: Accessor<Market>,
  lifecycle: { active?: Accessor<boolean> } = {},
) {
  const enabled = () => lifecycle.active?.() ?? true;
  const owner = createUniqueId();
  const [connection, setConnection] = createSignal<Connection>("connecting");
  const [retryAt, setRetryAt] = createSignal(0);
  const [provenance, setProvenance] = createSignal("");
  let alive = true;
  const session = createMemo(() => {
    const selected = market();
    return {
      market: selected,
      key: ["market", owner, selected.symbol, selected.interval],
      handoff: undefined as { changes: Map<number, Candle>; overflow: boolean } | undefined,
      repair: false,
      pendingRepair: undefined as
        | Promise<QueryObserverResult<readonly Candle[], Error> | undefined>
        | undefined,
      range: {} as Pick<Page, "from" | "to">,
    };
  });
  const options = () => {
    const current = session();
    return queryOptions({
      queryKey: current.key,
      enabled: typeof window !== "undefined" && enabled(),
      queryFn: async ({ signal }) => {
        const remaining = retryAt() - Date.now();
        if (remaining > 0)
          throw new MarketError(
            "Spot history is rate limited. Wait until the displayed retry time.",
            remaining,
          );
        // Reconnect opens its journal before cancellation settles, since live
        // corrections can arrive before Query starts this replacement request.
        const handoff =
          current.repair && current.handoff
            ? current.handoff
            : { changes: new Map<number, Candle>(), overflow: false };
        current.handoff = handoff;
        const repair = current.repair;
        current.repair = false;
        const result = await app.runtime.runPromise(
          ExchangeFacade.history({ ...current.market, ...current.range }).pipe(
            Effect.timeoutFail({
              duration: "20 seconds",
              onTimeout: () => new MarketError("History timed out. Retry history."),
            }),
            Effect.either,
          ),
          { signal },
        );
        if (Either.isLeft(result)) {
          if (alive && session() === current) setRetryAt(Date.now() + result.left.retryAfterMs);
          throw result.left;
        }
        if (!alive || session() !== current || signal.aborted)
          throw new MarketError("Obsolete history request canceled.");
        // Query owns the recoverable dataset. The bounded journal protects stream
        // corrections that arrive before/during REST. No second chart-side cache.
        const existing = app.queryClient.getQueryData<readonly Candle[]>(current.key) ?? [];
        if (handoff.overflow)
          throw new MarketError(
            "Live handoff exceeded 1000 candles. Displayed corrections were retained; retry history.",
          );
        if (current.handoff === handoff) current.handoff = undefined;
        setRetryAt(0);
        const changes = [...handoff.changes.values()];
        return repair
          ? mergeCandles(existing, result.right, changes)
          : mergeCandles(result.right, existing, changes);
      },
      retry: false,
    });
  };
  const query = createQuery(options, () => app.queryClient);
  const [retries, setRetries] = createSignal(0);
  function refetchTail(current: ReturnType<typeof session>) {
    const rows = app.queryClient.getQueryData<readonly Candle[]>(current.key);
    current.range = { from: rows?.at(-2)?.time ? (rows.at(-2)?.time ?? 0) * 1000 : undefined };
    current.repair = true;
    current.handoff = { changes: new Map<number, Candle>(), overflow: false };
    // Explicit cancellation also replaces an initial, still-empty Query fetch.
    // Do not revert live cache writes made while that request was in flight.
    const pending: NonNullable<typeof current.pendingRepair> = app.queryClient
      .cancelQueries({ queryKey: current.key, exact: true }, { revert: false })
      .then(() => {
        if (alive && session() === current && enabled() && current.pendingRepair === pending)
          return query.refetch();
      })
      // Reconnect may replace this repair while a consumer awaits live recovery.
      // Only the latest repair can complete that restoration, never its cancellation.
      .then((result) => (current.pendingRepair === pending ? result : current.pendingRepair));
    current.pendingRepair = pending;
    return pending;
  }
  createEffect(() => {
    const current = session();
    onCleanup(() => {
      void app.queryClient.cancelQueries({ queryKey: current.key, exact: true }, { revert: false });
    });
  });
  createEffect(() => {
    if (!enabled()) {
      const current = untrack(session);
      void app.queryClient.cancelQueries({ queryKey: current.key, exact: true }, { revert: false });
    }
  });
  createEffect(() => {
    const current = session();
    retries();
    if (!enabled()) return;
    setConnection("connecting");
    const abort = new AbortController();
    let active = true;
    void app.runtime
      .runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const gateway = yield* ExchangeGateway;
            if (active) setProvenance(gateway.provenance);
            yield* gateway.livePrices(current.market, owner, (event) => {
              if (!alive || !active || session() !== current) return;
              if (event.type === "connection") {
                setConnection(event.state);
                if (event.reconnected) {
                  // Tail REST repairs the disconnect gap; only subsequent live updates
                  // win overlap against that fresh response.
                  refetchTail(current);
                }
              } else {
                const handoff = current.handoff;
                if (handoff && !handoff.overflow) {
                  handoff.changes.set(event.candle.time, event.candle);
                  if (handoff.changes.size > 1000) {
                    handoff.overflow = true;
                    handoff.changes.clear();
                  }
                }
                app.queryClient.setQueryData<readonly Candle[]>(current.key, (rows) =>
                  mergeCandles(rows ?? [], [event.candle]),
                );
              }
            });
            yield* Effect.never;
          }),
        ),
        { signal: abort.signal },
      )
      .catch(() => {
        if (active && alive) setConnection("exhausted");
      });
    onCleanup(() => {
      active = false;
      abort.abort();
    });
  });
  onCleanup(() => {
    alive = false;
  });
  return {
    query,
    connection,
    provenance,
    key: () => session().key.join(":"),
    rows: () => query.data ?? [],
    retryAt,
    recoverLive() {
      // Repair from the retained tail after suspension; live corrections received
      // during recovery win REST overlap through the existing bounded journal.
      return refetchTail(session());
    },
    loadOlder() {
      const first = query.data?.[0];
      session().range = first ? { to: first.time * 1000 - 1 } : {};
      return query.refetch({ cancelRefetch: true });
    },
    retryHistory() {
      if (Date.now() >= retryAt()) return query.refetch({ cancelRefetch: true });
    },
    reconnect() {
      setRetries((n) => n + 1);
      refetchTail(session());
    },
  };
}
