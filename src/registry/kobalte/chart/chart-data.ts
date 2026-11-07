// Shared implementation for managed series. This module is not a public feed or archive.
import type { DataChangedHandler, IChartApi, Logical, Time } from "lightweight-charts";
import { type Accessor, createEffect, createSignal, onCleanup, untrack } from "solid-js";

export function copyRow<D extends { time: Time }>(row: D): D {
  return { ...row, time: typeof row.time === "object" ? { ...row.time } : row.time };
}
/** @internal Shared native Time identity for managed data and optional read models. */
export function timeKey(time: Time): number {
  if (typeof time === "number") return time;
  return typeof time === "string"
    ? Date.parse(time) / 1000
    : Date.UTC(time.year, time.month - 1, time.day) / 1000;
}

type Source = {
  reset(): void;
  reconcile(): void;
  ready: Accessor<boolean>;
  // Includes explicit whitespace, unlike native fulfilled-bar readback. Optional
  // features can observe this accessor without becoming a second data writer.
  displayed: Accessor<readonly { time: Time }[]>;
};
export function createDataCoordinator(
  api: IChartApi,
  readKey: Accessor<string | number>,
  clearSelection: () => void,
) {
  const [sources, setSources] = createSignal<ReadonlyMap<string, Source>>(new Map());
  const [generation, setGeneration] = createSignal(readKey());
  const [switching, setSwitching] = createSignal(false);
  let notifications: (() => void)[] = [];
  let epoch = 0;
  let viewport: ReturnType<typeof captureViewport>;
  let viewportFrame = 0;
  function clearViewport() {
    cancelAnimationFrame(viewportFrame);
    viewport = undefined;
  }
  function remember(view: ReturnType<typeof captureViewport>) {
    clearViewport();
    viewport = view;
    const generationEpoch = epoch;
    viewportFrame = requestAnimationFrame(() => {
      if (epoch === generationEpoch) viewport = undefined;
    });
  }
  function restore(view: ReturnType<typeof captureViewport>) {
    // Native range writes commit on the render frame. Consecutive synchronous
    // operations must share the intended time anchor, rather than recapture an
    // intermediate native logical range. This cache never queues a data write.
    clearViewport();
    if (!view || api.timeScale().timeToIndex(view.time, true) === null) return;
    remember(view);
    restoreViewport(api, view);
  }
  onCleanup(() => {
    clearViewport();
    notifications = [];
  });
  const current = () => !switching() && generation() === readKey();
  function sync() {
    const key = untrack(readKey);
    if (untrack(generation) === key) return;
    epoch++;
    clearViewport();
    setSwitching(true);
    setGeneration(key);
    clearSelection();
    api.clearCrosshairPosition();
    const entries = [...untrack(sources).values()];
    for (const source of entries) source.reset();
    for (const source of entries) source.reconcile();
    // Reset navigation is itself a pending native intent. Preserve it when the
    // application writes again before the first new-context render frame.
    const fresh = captureViewport(api);
    if (fresh) remember({ ...fresh, following: true });
    api.timeScale().resetTimeScale();
    api.timeScale().scrollToPosition(api.timeScale().options().rightOffset, false);
    setSwitching(false);
    const completed = notifications;
    notifications = [];
    for (const notify of completed) notify();
  }
  createEffect(() => {
    readKey();
    untrack(sync);
  });
  return {
    sources,
    capture: () => viewport ?? captureViewport(api),
    restore,
    generation,
    switching,
    current,
    notify(callback: () => void) {
      const currentEpoch = epoch;
      const notify = () => {
        if (epoch === currentEpoch) callback();
      };
      if (untrack(switching)) notifications.push(notify);
      else notify();
    },
    sync,
    ready: () => current() && [...sources().values()].every((s) => s.ready()),
    register(id: string, source: Source) {
      setSources((previous) => new Map(previous).set(id, source));
      return () =>
        setSources((previous) => {
          const next = new Map(previous);
          if (next.get(id) === source) next.delete(id);
          return next;
        });
    },
  };
}
export type DataCoordinator = ReturnType<typeof createDataCoordinator>;

// Use a time on the chart's UNION timeline, plus its fractional screen offset.
// Counts in one source cannot describe logical movement in sparse sibling data.
function captureViewport(api: IChartApi) {
  const scale = api.timeScale();
  const range = scale.getVisibleLogicalRange();
  if (!range || scale.width() <= 0) return;
  const last = Math.round(range.to - scale.scrollPosition());
  const center = Math.max(0, Math.min(last, (range.from + range.to) / 2));
  const coordinate = scale.logicalToCoordinate(center as Logical);
  const time = coordinate === null ? null : scale.coordinateToTime(coordinate);
  const index = time === null ? null : scale.timeToIndex(time);
  if (time === null || index === null) return;
  return {
    time,
    offset: index - range.from,
    span: range.to - range.from,
    following: scale.scrollPosition() >= -0.5,
  };
}
function restoreViewport(api: IChartApi, view: ReturnType<typeof captureViewport>) {
  if (!view) return;
  const scale = api.timeScale();
  const index = scale.timeToIndex(view.time, true);
  if (index === null) return; // Empty data has no anchor.
  const from = index - view.offset;
  scale.setVisibleLogicalRange({ from, to: from + view.span });
  if (view.following) scale.scrollToPosition(scale.options().rightOffset, false);
}

type NativeData<D> = {
  setData(rows: D[]): void;
  update(row: D, historical?: boolean): void;
  pop(count: number): D[];
  subscribeDataChanged(handler: DataChangedHandler): void;
  unsubscribeDataChanged(handler: DataChangedHandler): void;
};
export function createManagedData<D extends { time: Time }>(config: {
  chart: IChartApi;
  api: NativeData<D>;
  coordinator: DataCoordinator;
  id: string;
  snapshot: boolean;
  populated?: (row: D) => boolean;
  data: Accessor<readonly D[] | undefined>;
  defaultData: Accessor<readonly D[] | undefined>;
  changed: Accessor<DataChangedHandler | undefined>;
}) {
  const { api, coordinator } = config;
  const [displayed, setDisplayed] = createSignal<readonly D[]>([]);
  const [reconciled, setReconciled] = createSignal(false);
  let active = true;
  let initialized = false;
  let previous: readonly D[] | undefined;
  const ready = () =>
    active &&
    reconciled() &&
    coordinator.current() &&
    coordinator.generation() === sourceGeneration;
  // Retained resources become unavailable until the current generation is reconciled.
  let sourceGeneration = untrack(coordinator.generation);
  let collecting = false;
  let pendingScope: "full" | "update" | undefined;
  const changed: DataChangedHandler = (scope) => {
    if (!active) return;
    if (collecting) pendingScope = scope;
    else untrack(() => config.changed()?.(scope));
  };
  api.subscribeDataChanged(changed);
  function perform<R>(operation: () => R, next: (result: R) => readonly D[], preserve = true): R {
    const view =
      preserve && !untrack(coordinator.switching) ? untrack(coordinator.capture) : undefined;
    setReconciled(false);
    collecting = true;
    pendingScope = undefined;
    try {
      const result = operation();
      setDisplayed(() => next(result));
      setReconciled(true);
      coordinator.restore(view);
      // Deliberately after native completion and displayed-source publication.
      const scope = pendingScope;
      collecting = false;
      if (scope)
        coordinator.notify(() => {
          if (active) untrack(() => config.changed()?.(scope));
        });
      return result;
    } catch (error) {
      collecting = false;
      // Preserve native errors/preconditions. There is no repair or fallback.
      setReconciled(true);
      throw error;
    }
  }
  function replace(rows: readonly D[], preserve = true) {
    const owned = rows.map(copyRow);
    perform(
      () => api.setData(owned.map(copyRow)),
      () => owned,
      preserve,
    );
  }
  function reconcile() {
    const rows = untrack(config.snapshot ? config.data : config.defaultData);
    if (initialized && (!config.snapshot || previous === rows)) return;
    initialized = true;
    previous = rows;
    sourceGeneration = untrack(coordinator.generation);
    replace(rows ?? [], false);
  }
  const release = coordinator.register(config.id, {
    ready,
    displayed,
    reset() {
      initialized = false;
      previous = undefined;
      setReconciled(false);
      collecting = true;
      api.setData([]);
      collecting = false;
      pendingScope = undefined;
      setDisplayed([]);
    },
    reconcile,
  });
  createEffect(() => {
    const rows = config.snapshot ? config.data() : undefined;
    untrack(() => {
      coordinator.sync();
      if (!initialized) reconcile();
      else if (config.snapshot && previous !== rows) {
        previous = rows;
        replace(rows ?? []);
      }
    });
  });
  function requireReady() {
    if (!ready() || !coordinator.ready())
      throw new Error("Chart resource is not ready or has been disposed");
  }
  return {
    ready,
    hasData: () =>
      displayed().some(config.populated ?? ((row) => "close" in row || "value" in row)),
    setData(rows: readonly D[]) {
      requireReady();
      replace(rows);
    },
    update(row: D, historical = false) {
      requireReady();
      const owned = copyRow(row);
      perform(
        () => api.update(copyRow(owned), historical),
        () => {
          const rows = untrack(displayed);
          const key = timeKey(owned.time);
          // Maintaining the displayed source is not a membership validator: the
          // caller guarantees an eligible populated historical target.
          const index = rows.findIndex((item) => timeKey(item.time) >= key);
          if (index < 0) return [...rows, owned];
          // Keep explicit whitespace at other times, including trailing timeline
          // points left by native pop. This maintains source order; it never sorts
          // or validates the caller's replacement dataset.
          return [
            ...rows.slice(0, index),
            owned,
            ...rows.slice(index + (timeKey(rows[index].time) === key ? 1 : 0)),
          ];
        },
      );
    },
    pop(count: number) {
      requireReady();
      return perform(
        () => api.pop(count),
        (popped) => {
          const removed = new Set(popped.map((row) => timeKey(row.time)));
          return untrack(displayed).filter((row) => !removed.has(timeKey(row.time)));
        },
      );
    },
    dispose() {
      active = false;
      api.unsubscribeDataChanged(changed);
      setReconciled(false);
      setDisplayed([]);
      release();
    },
  };
}
