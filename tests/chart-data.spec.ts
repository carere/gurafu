import { expect, test } from "@playwright/test";
import type { CandlestickData, SeriesDataItemTypeMap, Time } from "lightweight-charts";
import type {
  CandlestickIncrementalController,
  CandlestickSnapshotController,
  ChartController,
} from "../src/registry/kobalte/chart/chart";

type Row = SeriesDataItemTypeMap<Time>["Candlestick"];
declare global {
  interface Window {
    dataTest: {
      chart: ChartController;
      incremental: CandlestickIncrementalController;
      snapshot: CandlestickSnapshotController;
      initial: readonly Row[];
      row(day: number, close?: number): CandlestickData;
      events: {
        ready: boolean;
        rootReady: boolean;
        hasData: boolean;
        scope: string;
        close: number[];
      }[];
      seed(rows: readonly Row[]): void;
      replaceSnapshot(rows: readonly Row[]): void;
      switch(key: string | number, seed: readonly Row[], snapshot?: readonly Row[]): void;
      unmount(): void;
    };
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/?data");
  await expect.poll(() => page.evaluate(() => window.dataTest.chart?.ready())).toBe(true);
});

test("incremental replacement, equal latest update, append, eligible sparse correction and pop preserve caller input", async ({
  page,
}) => {
  expect(
    await page.evaluate(() => {
      const s = window.dataTest,
        c = s.incremental;
      c.setData(Object.freeze([s.row(10), s.row(30), s.row(50)]));
      c.update(s.row(50, 150));
      c.update(s.row(70, 170));
      c.update(s.row(30, 130), true);
      const rows = c.api.data();
      const popped = c.pop(2);
      return {
        close: rows.map((r) => ("close" in r ? r.close : -1)),
        popped: popped.map((r) => ("close" in r ? r.close : -1)),
        remaining: c.api.data().map((r) => ("close" in r ? r.close : -1)),
        immutable: s.initial[0].time,
        event: s.events.at(-1),
        snapshotWriters: ["setData", "update", "pop"].some((k) => k in s.snapshot),
        conflation: s.chart.api.options().timeScale.enableConflation,
      };
    }),
  ).toMatchObject({
    close: [10, 130, 150, 170],
    popped: [170, 150],
    remaining: [10, 130],
    immutable: "2026-01-10",
    event: { ready: true, hasData: true, close: [10, 130] },
    snapshotWriters: false,
    conflation: false,
  });
});

test("dataset generations retain identities, clear old rows and initialize defaultData once per context", async ({
  page,
}) => {
  expect(
    await page.evaluate(() => {
      const s = window.dataTest,
        c = s.incremental,
        snap = s.snapshot,
        chart = s.chart;
      const native = c.api,
        snapApi = snap.api,
        root = chart.api;
      s.seed([s.row(1, 200)]);
      const ignored = c.api.data().length;
      s.switch(2, [s.row(10, 210)], [s.row(15, 215)]);
      const next = c.api.data();
      s.seed([s.row(20, 220)]);
      const noReseed = c.api.data();
      s.switch("empty", []);
      const empty = {
        root: chart.ready(),
        series: c.ready(),
        data: c.api.data(),
        hasData: c.hasData(),
        snapshot: snap.api.data(),
      };
      c.setData([s.row(30, 230)]);
      return {
        ignored,
        next,
        noReseed,
        empty,
        later: c.api.data(),
        retained:
          c === s.incremental &&
          snap === s.snapshot &&
          chart === s.chart &&
          native === c.api &&
          snapApi === snap.api &&
          root === chart.api,
        events: s.events
          .slice(-3)
          .map((e) => ({ ready: e.ready, rootReady: e.rootReady, close: e.close })),
      };
    }),
  ).toMatchObject({
    ignored: 10,
    next: [{ close: 210 }],
    noReseed: [{ close: 210 }],
    empty: { root: true, series: true, data: [], hasData: false, snapshot: [] },
    later: [{ close: 230 }],
    retained: true,
    events: [
      { ready: true, rootReady: true, close: [210] },
      { ready: true, rootReady: true, close: [] },
      { ready: true, rootReady: true, close: [230] },
    ],
  });
});

test("same-context history changes preserve a time anchor and zoom in a sparse union timeline", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.dataTest.chart.api.timeScale().setVisibleLogicalRange({ from: 2.25, to: 12.25 }),
  );
  // Native viewport changes are applied on the next render frame.
  await page.waitForTimeout(40);
  const before = await page.evaluate(() => {
    const s = window.dataTest,
      scale = s.chart.api.timeScale();
    const time = s.row(50).time;
    const coordinate = scale.timeToCoordinate(time);
    const range = scale.getVisibleLogicalRange();
    s.replaceSnapshot([
      s.row(2),
      s.row(4),
      s.row(6),
      s.row(8),
      s.row(15),
      s.row(25),
      s.row(35),
      s.row(45),
      s.row(55),
      s.row(65),
      s.row(75),
      s.row(85),
      s.row(95),
    ]);
    s.incremental.setData([s.row(1), s.row(3), s.row(5), ...s.initial]);
    return { coordinate, span: range ? range.to - range.from : 0 };
  });
  await page.waitForTimeout(40);
  const after = await page.evaluate(() => {
    const s = window.dataTest,
      scale = s.chart.api.timeScale(),
      range = scale.getVisibleLogicalRange();
    return {
      coordinate: scale.timeToCoordinate(s.row(50).time),
      span: range ? range.to - range.from : 0,
    };
  });
  expect(after.coordinate).toBeCloseTo(before.coordinate ?? 0, 4);
  expect(after.span).toBeCloseTo(before.span, 4);
});

test("following latest is explicit; history inspection survives new bars and navigation retains zoom", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.dataTest.chart.api.timeScale().setVisibleLogicalRange({ from: 1, to: 9 }),
  );
  await page.waitForTimeout(40);
  const before = await page.evaluate(() =>
    window.dataTest.chart.api.timeScale().timeToCoordinate(window.dataTest.row(30).time),
  );
  await page.evaluate(() => window.dataTest.incremental.update(window.dataTest.row(110)));
  await page.waitForTimeout(40);
  expect(
    await page.evaluate(() =>
      window.dataTest.chart.api.timeScale().timeToCoordinate(window.dataTest.row(30).time),
    ),
  ).toBeCloseTo(before ?? 0, 4);
  await page.evaluate(() => window.dataTest.chart.goToTime(window.dataTest.row(60).time));
  await page.waitForTimeout(40);
  expect(
    await page.evaluate(() => {
      const s = window.dataTest,
        scale = s.chart.api.timeScale(),
        r = scale.getVisibleLogicalRange();
      if (!r) throw new Error("Expected a laid-out fixture range");
      return {
        span: r.to - r.from,
        centered: (scale.timeToIndex(s.row(60).time) ?? Number.NaN) - (r.to + r.from) / 2,
      };
    }),
  ).toMatchObject({ span: 8, centered: 0 });
  await page.evaluate(() => window.dataTest.chart.goToLatest());
  await page.waitForTimeout(40);
  await page.evaluate(() => window.dataTest.incremental.update(window.dataTest.row(120)));
  await page.waitForTimeout(40);
  expect(
    await page.evaluate(() => window.dataTest.chart.api.timeScale().scrollPosition()),
  ).toBeCloseTo(0, 4);
});

test("native pop removes fulfilled bars newest first, leaves whitespace, and emits only completed native changes", async ({
  page,
}) => {
  expect(
    await page.evaluate(() => {
      const s = window.dataTest,
        c = s.incremental;
      const a = Object.freeze({
        time: Object.freeze({ year: 2026, month: 1, day: 1 }),
        open: 1,
        high: 4,
        low: 0,
        close: 2,
      });
      const b = Object.freeze({ time: "2026-01-03", open: 2, high: 4, low: 0, close: 3 });
      c.setData(
        Object.freeze([
          a,
          Object.freeze({ time: "2026-01-02" }),
          b,
          Object.freeze({ time: "2026-01-04" }),
        ]),
      );
      const popped = c.pop(50);
      const at = s.events.length;
      const noMore = c.pop(1);
      return {
        popped,
        noMore,
        hasData: c.hasData(),
        ready: c.ready(),
        remaining: c.api.data(),
        emittedOnNoop: s.events.length - at,
        lastScope: s.events.at(-1)?.scope,
        original: [a, b],
      };
    }),
  ).toMatchObject({
    popped: [{ close: 3 }, { close: 2 }],
    noMore: [],
    hasData: false,
    ready: true,
    remaining: [],
    emittedOnNoop: 0,
    lastScope: "update",
    original: [{ time: { year: 2026, month: 1, day: 1 } }, { time: "2026-01-03" }],
  });
});

test("Data and history uses matching installed data, keeps live corrections across paging, and rejects obsolete results", async ({
  page,
}) => {
  await page.goto("/?history");
  for (const mode of ["Snapshot", "Incremental"]) {
    const variant = page.getByRole("region", { name: `${mode} history`, exact: true });
    await expect(variant.getByRole("status")).toContainText("0 candles");
    await variant.getByRole("button", { name: "Load recent history", exact: true }).click();
    await variant.getByRole("button", { name: "Resolve request 1", exact: true }).click();
    await expect(variant.getByRole("status")).toContainText("16 candles · latest close 151");
    await variant.getByRole("button", { name: "Load older history", exact: true }).click();
    await variant.getByRole("button", { name: "Replace latest bar", exact: true }).click();
    await variant.getByRole("button", { name: "Load older history", exact: true }).click();
    await variant.getByRole("button", { name: "Resolve request 3", exact: true }).click();
    await variant.getByRole("button", { name: "Resolve request 2", exact: true }).click();
    await expect(variant.getByRole("status")).toContainText("48 candles · latest close 152");
    await expect(variant.getByRole("status")).toContainText("1 obsolete results ignored");
    await variant.getByRole("button", { name: "Load recent history", exact: true }).click();
    await variant.getByRole("button", { name: "Fail request 4", exact: true }).click();
    await expect(variant.getByRole("alert")).toContainText("Retry loading history");
    await expect(variant.getByRole("status")).toContainText("48 candles");
    await variant.getByRole("button", { name: "Load older history", exact: true }).click();
    await variant.getByRole("button", { name: "Switch dataset", exact: true }).click();
    await variant.getByRole("button", { name: "Resolve request 5", exact: true }).click();
    await expect(variant.getByRole("status")).toContainText("0 candles");
    await expect(variant.getByRole("status")).toContainText("2 obsolete results ignored");
    await variant.getByRole("button", { name: "Load date and navigate", exact: true }).click();
    await variant.getByRole("button", { name: "Resolve request 7", exact: true }).click();
    await expect(variant.getByRole("status")).toContainText("Centered on 2026-01-08");
    await expect(variant.getByRole("status")).toContainText("48 candles · latest close 251");
    await variant.getByRole("button", { name: "Append bar", exact: true }).click();
    await expect(variant.getByRole("status")).toContainText("49 candles");
    await variant.getByRole("button", { name: "Correct first bar", exact: true }).click();
    await variant.getByRole("button", { name: "Pop latest bar", exact: true }).click();
    await expect(variant.getByRole("status")).toContainText("48 candles");
  }
});

test("active native conflation rejects historical correction without a fallback or option switch", async ({
  page,
}) => {
  await page.evaluate(() => {
    const s = window.dataTest;
    s.chart.api.applyOptions({
      timeScale: { enableConflation: true, minBarSpacing: 0.001, barSpacing: 0.01 },
    });
    s.chart.api.timeScale().setVisibleLogicalRange({ from: -10000, to: 10000 });
  });
  await page.waitForTimeout(40);
  expect(
    await page.evaluate(() => {
      const s = window.dataTest,
        before = s.incremental.api.data(),
        events = s.events.length;
      let error = "";
      try {
        s.incremental.update(s.row(30, 230), true);
      } catch (e) {
        error = (e as Error).message;
      }
      return {
        error,
        unchanged: JSON.stringify(before) === JSON.stringify(s.incremental.api.data()),
        option: s.chart.api.options().timeScale.enableConflation,
        ready: s.incremental.ready(),
        events: s.events.length - events,
      };
    }),
  ).toEqual({
    error: expect.stringMatching(/historical.*conflation/i),
    unchanged: true,
    option: true,
    ready: true,
    events: 0,
  });
});

test("removed time anchors clamp to remaining data and empty or disposed navigation fails without queued work", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.dataTest.chart.api.timeScale().setVisibleLogicalRange({ from: 4, to: 12 }),
  );
  await page.waitForTimeout(40);
  const span = await page.evaluate(() => {
    const s = window.dataTest,
      r = s.chart.api.timeScale().getVisibleLogicalRange();
    if (!r) throw new Error("Expected a laid-out fixture range");
    s.replaceSnapshot([]);
    s.incremental.setData([s.row(150), s.row(160), s.row(170), s.row(180)]);
    return r.to - r.from;
  });
  await page.waitForTimeout(40);
  expect(
    await page.evaluate(() => {
      const s = window.dataTest,
        scale = s.chart.api.timeScale(),
        r = scale.getVisibleLogicalRange();
      if (!r) throw new Error("Expected a laid-out fixture range");
      return { span: r.to - r.from, center: (r.from + r.to) / 2 };
    }),
  ).toEqual({ span, center: 0 });
  expect(
    await page.evaluate(() => {
      const s = window.dataTest,
        c = s.incremental,
        chart = s.chart;
      c.setData([]);
      const errors: string[] = [];
      for (const op of [() => chart.goToTime("2026-01-01"), () => chart.goToLatest()]) {
        try {
          op();
        } catch (e) {
          errors.push((e as Error).message);
        }
      }
      const before = s.events.length;
      s.unmount();
      for (const op of [
        () => c.setData([]),
        () => c.update(s.row(1)),
        () => c.pop(1),
        () => chart.goToLatest(),
      ]) {
        try {
          op();
        } catch (e) {
          errors.push((e as Error).message);
        }
      }
      return { errors, events: s.events.length - before, ready: c.ready(), hasData: c.hasData() };
    }),
  ).toEqual({
    errors: [
      expect.stringMatching(/data.*layout/i),
      expect.stringMatching(/data.*layout/i),
      ...Array.from({ length: 4 }, () => expect.stringMatching(/not ready|disposed/i)),
    ],
    events: 0,
    ready: false,
    hasData: false,
  });
});

test("a new generation drops an old pending viewport intent before immediate incremental writes", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.dataTest.chart.api.timeScale().setVisibleLogicalRange({ from: 2, to: 10 }),
  );
  await page.waitForTimeout(40);
  await page.evaluate(() => {
    const s = window.dataTest;
    s.chart.goToTime(s.row(30).time);
    s.incremental.setData([s.row(1), ...s.initial]);
    s.switch("next", [s.row(200), s.row(210), s.row(220)]);
    s.incremental.update(s.row(230));
  });
  await page.waitForTimeout(40);
  expect(
    await page.evaluate(() => {
      const s = window.dataTest;
      return {
        following: s.chart.api.timeScale().scrollPosition(),
        ready: s.chart.ready(),
        rows: s.incremental.api.data().map((r) => ("close" in r ? r.close : -1)),
      };
    }),
  ).toEqual({ following: 0, ready: true, rows: [200, 210, 220, 230] });
});
