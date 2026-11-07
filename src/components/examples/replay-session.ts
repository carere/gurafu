import { Effect } from "effect";
import type { UTCTimestamp } from "lightweight-charts";
import {
  type Accessor,
  batch,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  onCleanup,
  untrack,
} from "solid-js";
import type { MarketApp } from "../../services/market/app";
import { createMarketDataset } from "../../services/market/dataset";
import { type Candle, ExchangeFacade, type Market } from "../../services/market/exchange";
import { partialFixtureCandle } from "./replay-evidence";

export type ReplayClock = { every(ms: number, tick: () => void): () => void };
export const browserReplayClock: ReplayClock = {
  every(ms, tick) {
    const timer = window.setInterval(tick, ms);
    return () => window.clearInterval(timer);
  },
};
// Website policy adapted from Ashiso's replay mode: consumer timer + forward
// position. No workers, app store, final-bar interpolation or chart-side archive.
export function createReplaySession(app: MarketApp, market: Accessor<Market>, clock: ReplayClock) {
  const [mode, setMode] = createSignal<"live" | "replay" | "restoring" | "partial">("live");
  const data = createMarketDataset(app, market, {
    active: () => mode() === "live" || mode() === "restoring",
  });
  const [playing, setPlaying] = createSignal(false),
    [speed, setSpeed] = createSignal(1);
  const [history, setHistory] = createSignal<readonly Candle[]>([]),
    [position, setPosition] = createSignal(0);
  const [loading, setLoading] = createSignal(false),
    [error, setError] = createSignal("");
  const [date, setDate] = createSignal<Date>();
  const [navigation, setNavigation] = createSignal<{ id: number; time: UTCTimestamp | "latest" }>();
  const owner = createUniqueId();
  let generation = 0,
    alive = true;
  let requestKey: readonly unknown[] | undefined;
  function invalidate() {
    generation++;
    if (requestKey) void app.queryClient.cancelQueries({ queryKey: requestKey, exact: true });
    requestKey = undefined;
    setPlaying(false);
    setLoading(false);
    setNavigation(undefined);
  }
  const rows = createMemo(() =>
    mode() === "live"
      ? data.rows()
      : mode() === "partial"
        ? partialFixtureCandle(1767225720)
        : history().slice(0, position()),
  );
  const canStep = () => mode() === "replay" && !loading() && position() < history().length;
  function step() {
    if (!canStep()) return;
    setPosition((n) => n + 1);
    if (position() >= history().length) setPlaying(false);
  }
  function enter() {
    if (loading() || !data.rows().some((row) => row.closed)) return;
    invalidate();
    batch(() => {
      setHistory(data.rows().filter((row) => row.closed));
      setPosition(1);
      setMode("replay");
      setError("");
    });
  }
  async function seekDate(selected: Date) {
    invalidate();
    const id = generation,
      selectedMarket = market();
    const utc = new Date(
      Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), selected.getUTCDate()),
    );
    const time = (utc.getTime() / 1000) as UTCTimestamp;
    batch(() => {
      setDate(utc);
      setMode("replay");
      setLoading(true);
      setError("");
      setHistory([]);
      setPosition(0);
    });
    const key = ["replay", owner, selectedMarket.symbol, selectedMarket.interval, id];
    requestKey = key;
    try {
      const result = await app.queryClient.fetchQuery({
        queryKey: key,
        queryFn: ({ signal }) =>
          app.runtime.runPromise(
            ExchangeFacade.history({
              ...selectedMarket,
              from: utc.getTime(),
              to: utc.getTime() + 86400000 - 1,
            }).pipe(Effect.timeout("20 seconds")),
            { signal },
          ),
        retry: false,
      });
      if (!alive || id !== generation) return;
      const completed = result.filter(
        (row) => row.closed && row.time >= time && row.time < time + 86400,
      );
      batch(() => {
        setHistory(completed);
        setPosition(completed.length ? 1 : 0);
        setLoading(false);
      });
      if (completed.length) setNavigation({ id, time: completed[0].time });
    } catch (cause) {
      if (alive && id === generation)
        batch(() => {
          setLoading(false);
          setError(
            cause instanceof Error ? cause.message : "History failed. Select the date to retry.",
          );
        });
    }
  }
  async function exit() {
    invalidate();
    const id = generation;
    // Keep the revealed snapshot while REST repairs the current live tail.
    if (mode() === "live") setHistory(data.rows());
    else setHistory(rows());
    setPosition(history().length);
    batch(() => {
      setMode("restoring");
      setLoading(true);
      setError("");
    });
    try {
      const result = await data.recoverLive();
      if (!alive || id !== generation) return;
      if (result?.isError) throw result.error;
      batch(() => {
        setMode("live");
        setDate(undefined);
        setLoading(false);
        setSpeed(1);
        setNavigation({ id, time: "latest" });
      });
    } catch (cause) {
      if (alive && id === generation)
        batch(() => {
          setLoading(false);
          setError(cause instanceof Error ? cause.message : "Live recovery failed. Retry latest.");
        });
    }
  }
  createEffect(() => {
    market();
    untrack(() => {
      invalidate();
      batch(() => {
        setMode("live");
        setHistory([]);
        setPosition(0);
        setDate(undefined);
        setError("");
        setSpeed(1);
      });
    });
  });
  createEffect(() => {
    if (!playing() || !canStep()) return;
    let current = true;
    const stop = clock.every(1000 / speed(), () => {
      if (current && alive) step();
    });
    onCleanup(() => {
      current = false;
      stop();
    });
  });
  onCleanup(() => {
    alive = false;
    invalidate();
  });
  return {
    data,
    mode,
    rows,
    playing,
    speed,
    date,
    navigation,
    loading,
    error,
    canStep,
    position,
    enter,
    step,
    seekDate,
    exit,
    requestPlaying(value: boolean) {
      if (!value || canStep()) setPlaying(value);
    },
    requestSpeed(value: number) {
      if ([0.5, 1, 2, 4].includes(value)) setSpeed(value);
    },
    rewind() {
      if (mode() === "replay" && !loading()) {
        setPlaying(false);
        setPosition(1);
      }
    },
    partial() {
      invalidate();
      batch(() => {
        setMode("partial");
        setError("");
      });
    },
    navigated(id: number) {
      if (navigation()?.id === id) setNavigation(undefined);
    },
    navigationFailed() {
      setNavigation(undefined);
      setError("Chart layout is unavailable. Show the chart and select the date or latest again.");
    },
  };
}
