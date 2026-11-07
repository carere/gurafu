import { expect, test } from "@playwright/test";
import type { ISeriesApi, SeriesType, Time } from "lightweight-charts";
import type {
  ChartController,
  PaneController,
  SnapshotSeriesController,
} from "../src/registry/kobalte/chart/chart";

declare global {
  interface Window {
    lifetimes19: {
      charts: ChartController[];
      pane: PaneController[];
      series: SnapshotSeriesController<ISeriesApi<SeriesType, Time>>[];
      type(): void;
      transfer(): void;
      remove(): void;
      restore(): void;
      changePaneId(): void;
      saved?: {
        chart: ChartController;
        pane: PaneController;
        series: SnapshotSeriesController<ISeriesApi<SeriesType, Time>>;
      };
    };
    panes19: {
      controllers: Record<string, PaneController>;
      series: Record<string, SnapshotSeriesController<ISeriesApi<SeriesType, Time>>>;
      chart(): ChartController;
      reorder(): void;
      immediate(): void;
      moveAndRemove(): void;
      removeVolume(): void;
      restore(): void;
      changeId(): void;
      hideSeries(): void;
      showSeries(): void;
      empty(): void;
      show(): void;
      resize(): void;
      manual(): void;
      auto(): void;
      saved?: {
        pane: PaneController;
        series: SnapshotSeriesController<ISeriesApi<SeriesType, Time>>;
        native: ISeriesApi<SeriesType, Time>;
        scale: import("lightweight-charts").IPriceScaleApi;
      };
    };
    composition19: {
      series: Record<string, SnapshotSeriesController<ISeriesApi<SeriesType, Time>>>;
      chart(): ChartController;
      eventCounts: { old: number; current: number };
      event(): import("lightweight-charts").MouseEventParams<Time> | undefined;
      change(): import("lightweight-charts").DataChangedScope | undefined;
      patch(): void;
      theme(): void;
      swap(): void;
      replace(): void;
    };
  }
}

test("all installed standard families render immutable snapshots and retain appearance patches", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?composition19");
  await expect
    .poll(() =>
      page.evaluate(() => Object.values(window.composition19?.series ?? {}).filter(Boolean).length),
    )
    .toBe(6);
  expect(
    await page.evaluate(() =>
      Object.values(window.composition19.series).map((s) => [
        s.api.seriesType(),
        s.hasData(),
        s.api.data().length,
      ]),
    ),
  ).toEqual([
    ["Candlestick", true, 2],
    ["Bar", true, 2],
    ["Line", true, 2],
    ["Area", true, 2],
    ["Baseline", true, 2],
    ["Histogram", true, 2],
  ]);
  expect(
    await page.evaluate(() => {
      const f = window.composition19,
        before = f.series.line,
        api = before.api;
      f.patch();
      return {
        identity: before === f.series.line && api === f.series.line.api,
        options: api.options(),
        data: api.data(),
      };
    }),
  ).toMatchObject({
    identity: true,
    options: { color: "#123456", lineWidth: 4 },
    data: [{ value: 10 }, { value: 20 }],
  });
  expect(errors).toEqual([]);
});

test("keyed declaration order and pane movement preserve identity at current native positions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?panes19&hidden");
  await expect.poll(() => page.evaluate(() => window.panes19?.series.movable?.ready())).toBe(true);
  await page.evaluate(() => {
    const f = window.panes19;
    f.saved = {
      pane: f.controllers.price,
      series: f.series.movable,
      native: f.series.movable.api,
      scale: f.series.movable.api.priceScale(),
    };
    f.reorder();
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const f = window.panes19;
        return [
          f.controllers.empty.api.paneIndex(),
          f.controllers.volume.api.paneIndex(),
          f.controllers.price.api.paneIndex(),
        ];
      }),
    )
    .toEqual([0, 1, 2]);
  expect(
    await page.evaluate(() => {
      const f = window.panes19;
      return {
        pane: f.saved?.pane === f.controllers.price,
        series: f.saved?.series === f.series.movable,
        native: f.saved?.native === f.series.movable.api,
        order: f.controllers.price.api
          .getSeries()
          .map((s) => (s === f.series.a.api ? "a" : s === f.series.b.api ? "b" : "movable")),
      };
    }),
  ).toEqual({ pane: true, series: true, native: true, order: ["b", "a", "movable"] });
  await page.evaluate(() => window.panes19.moveAndRemove());
  await expect
    .poll(() => page.evaluate(() => window.panes19.series.movable.api.getPane().paneIndex()))
    .toBe(0);
  expect(
    await page.evaluate(() => {
      const f = window.panes19;
      f.series.movable.api.priceScale().applyOptions({ scaleMargins: { top: 0.2, bottom: 0.3 } });
      return {
        retained: f.saved?.series === f.series.movable && f.saved?.native === f.series.movable.api,
        removed: !f.controllers.price && !f.series.a && !f.series.b,
        ready: f.saved?.pane.ready(),
        data: f.series.movable.api.data(),
        scale: f.controllers.volume.api.priceScale("right").options().scaleMargins,
      };
    }),
  ).toMatchObject({
    retained: true,
    removed: true,
    ready: false,
    data: [{ value: 10 }, { value: 20 }],
    scale: { top: 0.2, bottom: 0.3 },
  });
  await page.evaluate(() => window.panes19.show());
  await expect
    .poll(() => page.evaluate(() => window.panes19.chart().api.paneSize().width))
    .toBeGreaterThan(500);
  expect(errors).toEqual([]);
});

test("presets are native patches; construction-only layout stays fixed and data handlers replace", async ({
  page,
}) => {
  await page.goto("/?composition19");
  await expect
    .poll(() => page.evaluate(() => window.composition19?.series.line?.ready()))
    .toBe(true);
  const old = await page.evaluate(() => window.composition19.eventCounts.old);
  expect(
    await page.evaluate(() => {
      const f = window.composition19,
        chart = f.chart(),
        series = f.series.line;
      f.theme();
      f.patch();
      f.swap();
      f.replace();
      return {
        retained: f.chart() === chart && f.series.line === series,
        layout: chart.api.options().layout,
        events: f.eventCounts,
      };
    }),
  ).toMatchObject({
    retained: true,
    layout: {
      background: { type: "solid", color: "#161616" },
      textColor: "#e5e5e5",
      fontSize: 16,
      colorSpace: "srgb",
      colorParsers: [],
    },
    events: { old, current: 6 },
  });
});

test("empty declarations persist; id changes, removal and populated-pane teardown invalidate old handles", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?panes19");
  await expect.poll(() => page.evaluate(() => window.panes19?.series.movable?.ready())).toBe(true);
  await page.evaluate(() => {
    const f = window.panes19;
    f.saved = {
      pane: f.controllers.price,
      series: f.series.movable,
      native: f.series.movable.api,
      scale: f.series.movable.api.priceScale(),
    };
    f.empty();
  });
  expect(
    await page.evaluate(() => {
      const f = window.panes19;
      return [
        f.series.movable.hasData(),
        f.series.movable.ready(),
        f.series.movable === f.saved?.series,
        f.chart().api.panes().length,
      ];
    }),
  ).toEqual([false, true, true, 3]);
  await page.evaluate(() => window.panes19.changeId());
  await expect
    .poll(() =>
      page.evaluate(() => {
        const f = window.panes19;
        return f.series.movable !== f.saved?.series && !f.saved?.series.ready();
      }),
    )
    .toBe(true);
  await page.evaluate(() => {
    const f = window.panes19;
    f.saved = {
      pane: f.controllers.price,
      series: f.series.movable,
      native: f.series.movable.api,
      scale: f.series.movable.api.priceScale(),
    };
    f.hideSeries();
  });
  await expect.poll(() => page.evaluate(() => !window.panes19.series.movable)).toBe(true);
  await page.evaluate(() => window.panes19.showSeries());
  await expect
    .poll(() =>
      page.evaluate(() => {
        const f = window.panes19;
        return (
          f.series.movable?.ready() &&
          f.series.movable !== f.saved?.series &&
          !f.saved?.series.ready()
        );
      }),
    )
    .toBe(true);
  await page.evaluate(() => {
    window.panes19.moveAndRemove();
  });
  await expect.poll(() => page.evaluate(() => !window.panes19.controllers.price)).toBe(true);
  await page.evaluate(() => window.panes19.removeVolume());
  await expect
    .poll(() =>
      page.evaluate(() => !window.panes19.series.volume && !window.panes19.series.movable),
    )
    .toBe(true);
  expect(await page.evaluate(() => window.panes19.controllers.empty.ready())).toBe(true);
  await page.evaluate(() => window.panes19.restore());
  await expect
    .poll(() =>
      page.evaluate(
        () => window.panes19.series.volume?.hasData() && window.panes19.series.movable?.ready(),
      ),
    )
    .toBe(true);
  expect(await page.evaluate(() => window.panes19.series.volume.api.data())).toMatchObject([
    { value: 10 },
    { value: 20 },
  ]);
  expect(errors).toEqual([]);
});

test("readable installed Basics and native panes examples expose working consumer controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?basics19");
  const family = page.getByRole("combobox", { name: "Series type" });
  await expect(family).toBeVisible();
  for (const type of ["Line", "Area", "Bar", "Baseline", "Histogram", "Candlestick"]) {
    await family.selectOption(type);
    await expect(page.getByRole("status").first()).toContainText(type);
  }
  await page.getByRole("button", { name: "Dark appearance" }).click();
  await page.getByRole("button", { name: "Hide grid" }).click();
  await page.getByRole("button", { name: "Clear snapshot" }).click();
  await expect(page.getByRole("status").first()).toContainText("No data");
  await page.getByRole("button", { name: "Restore snapshot" }).click();
  const panes = page.getByRole("region", { name: "Price and volume composition" });
  const initialCanvases = await panes.locator("canvas").count();
  await page.getByRole("button", { name: "Overlay volume on price" }).click();
  await expect.poll(() => panes.locator("canvas").count()).toBeLessThan(initialCanvases);
  await page.getByRole("button", { name: "Use native volume pane" }).click();
  await expect.poll(() => panes.locator("canvas").count()).toBe(initialCanvases);
  await page.getByRole("button", { name: "Volume above price" }).click();
  await page.setViewportSize({ width: 390, height: 800 });
  expect(errors).toEqual([]);
});

test("type changes and transfers create new resources; removed final native layout is not a live declaration", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?lifetimes19");
  await expect.poll(() => page.evaluate(() => window.lifetimes19?.series[0]?.ready())).toBe(true);
  await page.evaluate(() => {
    const f = window.lifetimes19;
    f.saved = { chart: f.charts[0], pane: f.pane[0], series: f.series[0] };
    f.type();
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const f = window.lifetimes19;
        return (
          f.series[0]?.api.seriesType() === "Bar" &&
          f.series[0] !== f.saved?.series &&
          !f.saved?.series.ready() &&
          f.saved?.chart === f.charts[0]
        );
      }),
    )
    .toBe(true);
  await page.evaluate(() => {
    const f = window.lifetimes19;
    f.saved = { chart: f.charts[0], pane: f.pane[0], series: f.series[0] };
    f.transfer();
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const f = window.lifetimes19;
        return (
          !f.series[0] &&
          f.series[1]?.ready() &&
          f.series[1] !== f.saved?.series &&
          !f.saved?.series.ready()
        );
      }),
    )
    .toBe(true);
  await page.evaluate(() => {
    const f = window.lifetimes19;
    f.saved = { chart: f.charts[1], pane: f.pane[1], series: f.series[1] };
    f.changePaneId();
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const f = window.lifetimes19;
        return (
          f.pane[1]?.ready() &&
          f.pane[1] !== f.saved?.pane &&
          !f.saved?.pane.ready() &&
          f.series[1] === f.saved?.series
        );
      }),
    )
    .toBe(true);
  await page.evaluate(() => {
    const f = window.lifetimes19;
    f.saved = { chart: f.charts[1], pane: f.pane[1], series: f.series[1] };
    f.remove();
  });
  await expect
    .poll(() => page.evaluate(() => !window.lifetimes19.pane[1] && !window.lifetimes19.series[1]))
    .toBe(true);
  expect(
    await page.evaluate(() => {
      const f = window.lifetimes19;
      let failure = "";
      try {
        f.saved?.series.api;
      } catch (e) {
        failure = (e as Error).message;
      }
      return {
        removed: !f.saved?.pane.ready() && !f.saved?.series.ready(),
        failure,
        live: f.charts[1].ready(),
      };
    }),
  ).toMatchObject({
    removed: true,
    failure: expect.stringMatching(/disposed|not ready/),
    live: true,
  });
  await page.evaluate(() => window.lifetimes19.restore());
  await expect.poll(() => page.evaluate(() => window.lifetimes19.series[1]?.hasData())).toBe(true);
  expect(errors).toEqual([]);
});

test("pane stretch, constrained height and native separator resizing stay usable after reorder", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?panes19");
  await expect
    .poll(() =>
      page.evaluate(() => window.panes19?.controllers.volume?.api.getHTMLElement()?.clientHeight),
    )
    .toBeGreaterThan(0);
  await page.evaluate(() => window.panes19.manual());
  await expect
    .poll(() => page.evaluate(() => window.panes19.chart().api.options().height))
    .toBe(420);
  expect(await page.evaluate(() => window.panes19.chart().api.options().autoSize)).toBe(false);
  await page.evaluate(() => window.panes19.auto());
  await expect
    .poll(() => page.evaluate(() => window.panes19.chart().api.takeScreenshot().height))
    .toBe(600);
  await page.evaluate(() => window.panes19.resize());
  await expect
    .poll(() => page.evaluate(() => window.panes19.controllers.volume.api.getHeight()))
    .toBeCloseTo(140, 0);
  const before = await page.evaluate(() => {
    const f = window.panes19;
    const element = f.controllers.volume.api.getHTMLElement();
    const box = element?.getBoundingClientRect();
    return {
      height: f.controllers.volume.api.getHeight(),
      x: (box?.left ?? 0) + 200,
      y: box?.bottom ?? 0,
    };
  });
  await page.mouse.move(before.x, before.y + 1);
  await page.mouse.down();
  await page.mouse.move(before.x, before.y + 50, { steps: 5 });
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => window.panes19.controllers.volume.api.getHeight()))
    .toBeGreaterThan(before.height + 20);
  await page.evaluate(() => window.panes19.moveAndRemove());
  await expect
    .poll(() => page.evaluate(() => window.panes19.series.volume.api.priceToCoordinate(10)))
    .not.toBeNull();
  expect(await page.evaluate(() => window.panes19.series.volume.api.data())).toMatchObject([
    { value: 10 },
    { value: 20 },
  ]);
  await page.setViewportSize({ width: 390, height: 800 });
  await expect
    .poll(() => page.evaluate(() => window.panes19.chart().api.paneSize().width))
    .toBeLessThan(390);
  expect(errors).toEqual([]);
});

test("native mouse payloads retain native series keys and data-change scope", async ({ page }) => {
  await page.goto("/?composition19");
  await expect
    .poll(() => page.evaluate(() => window.composition19?.series.line?.api.priceToCoordinate(20)))
    .not.toBeNull();
  const point = await page.evaluate(() => {
    const f = window.composition19;
    const pane = f.chart().api.panes()[0].getHTMLElement()?.getBoundingClientRect();
    return {
      x: (pane?.left ?? 0) + (f.chart().api.timeScale().timeToCoordinate("2026-10-02") ?? 0),
      y: (pane?.top ?? 0) + (f.series.line.api.priceToCoordinate(20) ?? 0),
    };
  });
  await page.mouse.click(point.x, point.y);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const f = window.composition19,
          e = f.event();
        return e?.seriesData instanceof Map && e.seriesData.has(f.series.line.api);
      }),
    )
    .toBe(true);
  expect(
    await page.evaluate(() => {
      const f = window.composition19;
      return { row: f.event()?.seriesData.get(f.series.line.api), scope: f.change() };
    }),
  ).toMatchObject({ row: { value: 20 }, scope: "full" });
});
