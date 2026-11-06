import { expect, test } from "@playwright/test";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import type {
  CandlestickSnapshotController,
  ChartController,
} from "../src/registry/kobalte/chart/chart";

// Browser fixture bridge. Tests acquire handles after mount and explicitly check
// that the same slots clear on removal; there is no native or store mock here.
interface Smoke {
  charts: ChartController[];
  series: CandlestickSnapshotController[];
  oldSeries: CandlestickSnapshotController[];
  rootReadyBeforeData: boolean[];
  outer: HTMLDivElement[];
  inner: HTMLDivElement[];
  refLog: string[];
  callbackEvents: {
    old: Record<"move" | "double" | "time" | "logical" | "size", number>;
    current: Record<"move" | "double" | "time" | "logical" | "size", number>;
  };
  events: {
    oldClicks: number;
    newClicks: number;
    oldData: number;
    newData: number;
    focus: number;
    nativeMap: boolean;
    dataReady: boolean;
    dataPopulated: boolean;
  };
  before: {
    charts: IChartApi[];
    series: ISeriesApi<"Candlestick", Time>[];
    controllers: CandlestickSnapshotController[];
  };
  peer: { chart: IChartApi; series: ISeriesApi<"Candlestick", Time> };
  scopeState(): { app: boolean; chart: boolean; pane: boolean; series: boolean };
  initiallyUnavailable(): boolean;
  replace(): void;
  empty(): void;
  mount(): void;
  unmount(): void;
  swap(): void;
  patch(): void;
  changeRef(): void;
  removeFirst(): void;
  removePane(): void;
  removeSeries(): void;
  show(): void;
}
declare global {
  interface Window {
    smoke: Smoke;
  }
}

test("installed core renders isolated snapshot charts and releases native resources", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("canvas")).not.toHaveCount(0);
  expect(
    await page.evaluate(() => {
      const s = window.smoke;
      return {
        ready: s.charts.map((c) => c.ready()),
        data: s.series.map((c) => c.api.data()),
        distinct: s.charts[0].api !== s.charts[1].api,
        hasData: s.series.map((c) => c.hasData()),
        rootReadyBeforeData: s.rootReadyBeforeData,
      };
    }),
  ).toMatchObject({
    ready: [true, true],
    distinct: true,
    hasData: [true, true],
    rootReadyBeforeData: [false, false],
    data: [[{ close: 105 }], [{ close: 105 }]],
  });
});

test("snapshot replacement, empty display and disposal retain the right native lifetimes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("canvas")).not.toHaveCount(0);
  await page.evaluate(() => {
    const s = window.smoke;
    s.before = {
      charts: s.charts.map((c) => c.api),
      series: s.series.map((c) => c.api),
      controllers: [...s.series],
    };
    s.replace();
  });
  expect(
    await page.evaluate(() => {
      const s = window.smoke;
      return {
        retained: s.series.every(
          (c, i) => c.api === s.before.series[i] && c === s.before.controllers[i],
        ),
        close: (s.series[0].api.data()[0] as import("lightweight-charts").CandlestickData).close,
      };
    }),
  ).toEqual({ retained: true, close: 210 });
  await page.evaluate(() => window.smoke.empty());
  expect(
    await page.evaluate(() => {
      const s = window.smoke;
      return {
        ready: s.series[0].ready(),
        hasData: s.series[0].hasData(),
        rows: s.series[0].api.data(),
        panes: s.charts[0].api.panes().length,
      };
    }),
  ).toEqual({ ready: true, hasData: false, rows: [], panes: 1 });
  await page.evaluate(() => window.smoke.unmount());
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(
    await page.evaluate(() => {
      const s = window.smoke;
      let message = "";
      try {
        s.before.controllers[0].api;
      } catch (error) {
        message = (error as Error).message;
      }
      return {
        cleared: s.charts.every((c) => !c) && s.series.every((c) => !c),
        ready: s.before.controllers[0].ready(),
        hasData: s.before.controllers[0].hasData(),
        message,
      };
    }),
  ).toMatchObject({
    cleared: true,
    ready: false,
    hasData: false,
    message: expect.stringMatching(/not ready|disposed/i),
  });
  await page.evaluate(() => window.smoke.mount());
  await expect(page.locator("canvas")).not.toHaveCount(0);
  expect(
    await page.evaluate(() => {
      const s = window.smoke;
      return s.series[0].api !== s.before.series[0];
    }),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("native callback replacement and DOM surface refs stay owned", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).not.toHaveCount(0);
  expect(
    await page.evaluate(() => {
      const s = window.smoke;
      return s.outer[0] !== s.inner[0] && s.outer[0].contains(s.inner[0]);
    }),
  ).toBe(true);
  const canvas = page.locator("canvas").nth(1);
  await canvas.click({ position: { x: 100, y: 100 } });
  await expect.poll(() => page.evaluate(() => window.smoke.events.oldClicks)).toBe(1);
  const old = await page.evaluate(() => ({ ...window.smoke.events }));
  await page.evaluate(() => window.smoke.swap());
  // Native 5.2.1 coalesces clicks inside its 500ms double-click interval.
  await page.waitForTimeout(550);
  await canvas.click({ position: { x: 300, y: 100 } });
  await expect.poll(() => page.evaluate(() => window.smoke.events.newClicks)).toBe(1);
  await page.evaluate(() => window.smoke.replace());
  const current = await page.evaluate(() => ({ ...window.smoke.events }));
  expect(current.oldClicks).toBe(old.oldClicks);
  expect(current.newClicks).toBe(1);
  expect(current.oldData).toBe(old.oldData);
  expect(current.newData).toBe(2);
  expect(current.nativeMap).toBe(true);
  expect(current.dataReady).toBe(true);
  expect(current.dataPopulated).toBe(true);
  expect(current.focus).toBeGreaterThan(0);
  await page.waitForTimeout(550);
  await canvas.dblclick({ position: { x: 200, y: 100 } });
  await page.evaluate(() =>
    window.smoke.charts[0].api.timeScale().setVisibleLogicalRange({ from: -5, to: 5 }),
  );
  await page.setViewportSize({ width: 800, height: 700 });
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.values(window.smoke.callbackEvents.current).every((count) => count > 0),
      ),
    )
    .toBe(true);
  const beforeDisposal = await page.evaluate(() => ({ ...window.smoke.callbackEvents.current }));
  await page.evaluate(() => window.smoke.unmount());
  await page.setViewportSize({ width: 900, height: 700 });
  expect(await page.evaluate(() => window.smoke.callbackEvents.current)).toEqual(beforeDisposal);
});

test("scoped controllers preserve app context, refs replace, and native appearance patches retain identity", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("canvas")).not.toHaveCount(0);
  await page.evaluate(() => {
    const s = window.smoke;
    s.before = {
      charts: s.charts.map((c) => c.api),
      series: s.series.map((c) => c.api),
      controllers: [...s.series],
    };
    s.patch();
    s.changeRef();
  });
  expect(
    await page.evaluate(() => {
      const s = window.smoke;
      return {
        context: s.scopeState(),
        initial: s.initiallyUnavailable(),
        refs: s.refLog,
        retained: s.before.charts[0] === s.charts[0].api && s.before.series[0] === s.series[0].api,
        chart: s.charts[0].api.options().layout,
        series: s.series[0].api.options(),
      };
    }),
  ).toMatchObject({
    context: { app: true, chart: true, pane: true, series: true },
    initial: true,
    refs: ["old:set", "old:clear", "new:set"],
    retained: true,
    chart: { textColor: "#123456", fontSize: 15 },
    series: { upColor: "#123456", wickVisible: false },
  });
  await page.evaluate(() => window.smoke.removeFirst());
  expect(await page.evaluate(() => window.smoke.refLog)).toEqual([
    "old:set",
    "old:clear",
    "new:set",
    "new:clear",
  ]);
});

test("child and sibling chart removal release only their own resources", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("canvas")).not.toHaveCount(0);
  await page.evaluate(() => {
    const s = window.smoke;
    s.peer = { chart: s.charts[1].api, series: s.series[1].api };
    s.removeFirst();
  });
  expect(
    await page.evaluate(() => {
      const s = window.smoke;
      return {
        gone: !s.charts[0] && !s.series[0],
        peer: s.peer.chart === s.charts[1].api && s.peer.series === s.series[1].api,
      };
    }),
  ).toEqual({ gone: true, peer: true });
  await page.evaluate(() => window.smoke.removePane());
  await page.evaluate(() => window.smoke.unmount());
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("hidden mounting reconciles the model and autosizing recovers when visible", async ({
  page,
}) => {
  await page.goto("/?hidden");
  await expect.poll(() => page.evaluate(() => window.smoke.series[0]?.ready())).toBe(true);
  expect(await page.evaluate(() => window.smoke.series[0].hasData())).toBe(true);
  await page.evaluate(() => window.smoke.show());
  await expect
    .poll(() => page.evaluate(() => window.smoke.charts[0].api.paneSize().width))
    .toBeGreaterThan(500);
  await page.setViewportSize({ width: 390, height: 800 });
  await expect
    .poll(() => page.evaluate(() => window.smoke.charts[0].api.paneSize().width))
    .toBeLessThan(390);
  expect(
    await page.evaluate(
      () =>
        (window.smoke.series[0].api.data()[0] as import("lightweight-charts").CandlestickData)
          .close,
    ),
  ).toBe(105);
});

test("core mounts without an application Solux provider", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?standalone");
  await expect(page.locator("canvas")).not.toHaveCount(0);
  expect(await page.evaluate(() => window.smoke.series[0].hasData())).toBe(true);
  await page.evaluate(() => window.smoke.unmount());
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(errors).toEqual([]);
});
