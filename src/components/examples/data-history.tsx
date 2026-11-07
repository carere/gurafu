import type { CandlestickData, Time } from "lightweight-charts";
import { createSignal, For, onCleanup, Show } from "solid-js";
import * as Chart from "@/registry/kobalte/chart/chart";

// Website-owned deterministic fixture. No feed, paging or stale-work policy is
// part of the registry. The complete recoverable history stays in this example.
function fixture(market: number): readonly CandlestickData[] {
  return Object.freeze(
    Array.from({ length: 48 }, (_, i) =>
      Object.freeze({
        time: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10),
        open: 100 + market * 100 + i,
        high: 108 + market * 100 + i,
        low: 96 + market * 100 + i,
        close: 104 + market * 100 + i,
      }),
    ),
  );
}
type Request = { id: number; key: number; kind: "recent" | "older" | "date"; target?: string };
const buttonClass =
  "rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

function HistoryVariant(props: { incremental: boolean }) {
  const mode = props.incremental ? "Incremental" : "Snapshot";
  const [model, setModel] = createSignal<{ key: number; rows: readonly CandlestickData[] }>({
    key: 0,
    rows: [],
  });
  const [chart, setChart] = createSignal<Chart.ChartController>();
  const [series, setSeries] = createSignal<Chart.CandlestickIncrementalController>();
  const [snapshot, setSnapshot] = createSignal<Chart.CandlestickSnapshotController>();
  const [observed, setObserved] = createSignal<readonly CandlestickData[]>([]);
  const [pending, setPending] = createSignal<readonly Request[]>([]);
  const [error, setError] = createSignal("");
  const [ignored, setIgnored] = createSignal(0);
  const [date, setDate] = createSignal("2026-01-08");
  const [navigation, setNavigation] = createSignal("");
  let latestRequest = 0;
  let alive = true;
  let frame = 0;
  let revision = 0;
  const usable = () => chart()?.ready() && (!props.incremental || series()?.ready());
  const loading = () => pending().some((r) => r.id === latestRequest && r.key === model().key);

  function observe() {
    const current = props.incremental ? series() : snapshot();
    if (current?.ready()) setObserved(current.api.data() as CandlestickData[]);
  }
  function replace(rows: readonly CandlestickData[]) {
    // Matching key and snapshot are supplied atomically. Imperative writers are
    // used only in the incremental variant after current-model readiness.
    setModel((current) => ({ ...current, rows }));
    if (props.incremental) series()?.setData(rows);
    revision++;
    setError("");
  }
  function navigate(target?: Time) {
    cancelAnimationFrame(frame);
    const key = model().key,
      requestedRevision = revision;
    // The application waits for layout after supplying matching history. This
    // work is canceled/guarded by its owner, not queued on a retained handle.
    frame = requestAnimationFrame(() => {
      if (!alive || model().key !== key || revision !== requestedRevision || !usable()) return;
      const c = chart();
      if (!c?.api.timeScale().getVisibleLogicalRange()) return;
      if (target === undefined) c.goToLatest();
      else c.goToTime(target);
      setNavigation(target === undefined ? "Following latest" : `Centered on ${target}`);
    });
  }
  function request(kind: Request["kind"]) {
    const id = ++latestRequest;
    setError("");
    setPending((jobs) => [
      ...jobs,
      { id, key: model().key, kind, target: kind === "date" ? date() : undefined },
    ]);
  }
  function settle(job: Request, fail = false) {
    setPending((jobs) => jobs.filter((j) => j !== job));
    // A ready retained controller cannot validate an application response.
    if (!alive) return;
    if (job.key !== model().key || job.id !== latestRequest) {
      setIgnored((n) => n + 1);
      return;
    }
    if (fail) {
      setError("Fixture request failed. Retry loading history; displayed candles are retained.");
      return;
    }
    if (!usable()) {
      setError("Chart is not ready. Retry loading history.");
      return;
    }
    const archive = fixture(job.key % 2);
    const incoming = job.kind === "recent" ? archive.slice(-16) : archive;
    // Application merge: preserve current live corrections on page overlap.
    const merged = new Map(incoming.map((r) => [String(r.time), r]));
    for (const row of model().rows) merged.set(String(row.time), row);
    replace([...merged.values()].sort((a, b) => String(a.time).localeCompare(String(b.time))));
    if (job.target) navigate(job.target);
  }
  function switchContext() {
    cancelAnimationFrame(frame);
    latestRequest++;
    revision++;
    setError("");
    setNavigation("");
    setModel((current) => ({ key: current.key + 1, rows: [] }));
  }
  function tick(append: boolean) {
    const rows = model().rows,
      last = rows.at(-1);
    if (!last || !usable()) return;
    const updated = Object.freeze(
      append
        ? {
            ...last,
            time: new Date(Date.parse(String(last.time)) + 86400000).toISOString().slice(0, 10),
          }
        : { ...last, close: last.close + 1, high: Math.max(last.high, last.close + 1) },
    );
    if (props.incremental) series()?.update(updated);
    setModel((current) => ({
      ...current,
      rows: append ? [...rows, updated] : [...rows.slice(0, -1), updated],
    }));
    revision++;
  }
  function correct() {
    const rows = model().rows,
      first = rows[0];
    if (!first || !usable()) return;
    const updated = Object.freeze({
      ...first,
      close: first.close + 1,
      high: Math.max(first.high, first.close + 1),
    });
    // Existing populated target-series bar: never use historical update to
    // insert unseen/sparse history. Full replacement handles that case above.
    if (props.incremental) series()?.update(updated, true);
    setModel((current) => ({ ...current, rows: [updated, ...rows.slice(1)] }));
    revision++;
  }
  function pop() {
    if (!usable()) return;
    if (props.incremental) series()?.pop(1);
    setModel((current) => ({ ...current, rows: current.rows.slice(0, -1) }));
    revision++;
  }
  onCleanup(() => {
    alive = false;
    latestRequest++;
    cancelAnimationFrame(frame);
  });
  return (
    <section aria-label={`${mode} history`} class="space-y-4">
      <h3 class="text-xl font-semibold">{mode}</h3>
      <p class="text-sm text-muted-foreground">
        Fixture {model().key % 2 ? "B" : "A"} · context {model().key}.{" "}
        {props.incremental
          ? "Starts empty, then uses setData, update and pop."
          : "The application supplies each full displayed snapshot."}
      </p>
      <Chart.Root
        datasetKey={model().key}
        apiRef={setChart}
        class="h-80 w-full"
        aria-label={`${mode} fixture chart`}
        role="region"
        options={{ autoSize: true, timeScale: { barSpacing: 16 } }}
      >
        <Chart.Pane id="price">
          <Show
            when={props.incremental}
            fallback={
              <Chart.CandlestickSeries
                id="candles"
                data={model().rows}
                apiRef={setSnapshot}
                onDataChange={observe}
              />
            }
          >
            <Chart.CandlestickSeries
              id="candles"
              defaultData={[]}
              apiRef={setSeries}
              onDataChange={observe}
            />
          </Show>
        </Chart.Pane>
      </Chart.Root>
      <p role="status" class="text-sm tabular-nums" aria-live="polite">
        {observed().length} candles · latest close {observed().at(-1)?.close ?? "unavailable"}
        {loading() ? " · Loading fixture history" : ""} · {ignored()} obsolete results ignored
        {navigation() ? ` · ${navigation()}` : ""}
      </p>
      <Show when={error()}>
        <p role="alert" class="text-sm text-destructive">
          {error()}
        </p>
      </Show>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class={buttonClass}
          disabled={!usable()}
          onClick={() => request("recent")}
        >
          Load recent history
        </button>
        <button
          type="button"
          class={buttonClass}
          disabled={!usable()}
          onClick={() => request("older")}
        >
          Load older history
        </button>
        <button type="button" class={buttonClass} onClick={switchContext}>
          Switch dataset
        </button>
        <button
          type="button"
          class={buttonClass}
          disabled={!model().rows.length || !usable()}
          onClick={() => tick(false)}
        >
          Replace latest bar
        </button>
        <button
          type="button"
          class={buttonClass}
          disabled={!model().rows.length || !usable()}
          onClick={() => tick(true)}
        >
          Append bar
        </button>
        <button
          type="button"
          class={buttonClass}
          disabled={!model().rows.length || !usable()}
          onClick={correct}
        >
          Correct first bar
        </button>
        <button
          type="button"
          class={buttonClass}
          disabled={!model().rows.length || !usable()}
          onClick={pop}
        >
          Pop latest bar
        </button>
        <button type="button" class={buttonClass} disabled={!usable()} onClick={() => replace([])}>
          Clear display
        </button>
        <button
          type="button"
          class={buttonClass}
          disabled={!usable()}
          onClick={() => replace(fixture(model().key % 2))}
        >
          Restore fixture
        </button>
        <button
          type="button"
          class={buttonClass}
          disabled={!model().rows.length || !usable()}
          onClick={() => navigate()}
        >
          Go to latest
        </button>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <label class="flex flex-col gap-1 text-sm">
          UTC date
          <input
            type="date"
            value={date()}
            min="2026-01-01"
            max="2026-02-17"
            class="rounded-md border border-input bg-background px-3 py-2 focus-visible:outline-2"
            onInput={(e) => setDate(e.currentTarget.value)}
          />
        </label>
        <button
          type="button"
          class={buttonClass}
          disabled={!date() || !usable()}
          onClick={() => request("date")}
        >
          Load date and navigate
        </button>
      </div>
      <Show when={pending().length}>
        <p class="text-sm text-muted-foreground">
          Requests wait here. Resolve them in any order, including after a dataset switch.
        </p>
        <ul class="space-y-2">
          <For each={pending()}>
            {(job) => (
              <li class="flex flex-wrap items-center gap-2 text-sm">
                <span>
                  Request {job.id}: {job.kind}, context {job.key}
                </span>
                <button type="button" class={buttonClass} onClick={() => settle(job)}>
                  Resolve request {job.id}
                </button>
                <button type="button" class={buttonClass} onClick={() => settle(job, true)}>
                  Fail request {job.id}
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  );
}

export function DataHistory() {
  return (
    <section aria-labelledby="data-history-heading" class="space-y-8">
      <div class="space-y-3">
        <h2 id="data-history-heading" class="text-2xl font-semibold tracking-tight">
          Data and history
        </h2>
        <p class="max-w-prose text-muted-foreground">
          Two independent charts with illustrative daily prices. Load history, pan into the past,
          then append a bar. Loading and failure leave the current display intact. The application
          retains its fixture history and rejects obsolete requests.
        </p>
      </div>
      <HistoryVariant incremental={false} />
      <HistoryVariant incremental />
    </section>
  );
}
