import { expect, test } from "@playwright/test";
import type {
  IPanePrimitive,
  ISeriesMarkersPluginApi,
  ISeriesPrimitive,
  Time,
} from "lightweight-charts";
import type { DensityOptions, DensityRow } from "../src/components/examples/extensions-view";
import type {
  ChartController,
  CustomIncrementalController,
  ExtensionController,
  LineIncrementalController,
  PaneController,
} from "../src/registry/kobalte/chart/chart";

type Counts27 = {
  create: number;
  attach: number;
  detach: number;
  dispose: number;
  ticks: number;
  clicks: number;
  live: boolean[];
};
type Refs27 = {
  series: ExtensionController<ISeriesPrimitive<Time>>;
  pane: ExtensionController<IPanePrimitive<Time>>;
  markers: ExtensionController<ISeriesMarkersPluginApi<Time>>;
};
type Custom27 = CustomIncrementalController<DensityRow, DensityOptions>;
declare global {
  interface Window {
    extensions27: {
      stats: Record<"custom" | "series" | "pane" | "markers", Counts27>;
      refs: Refs27;
      refLog: string[];
      observations: unknown[];
      saved: Refs27 & { custom: Custom27; native: Custom27["api"] };
      chart(): ChartController;
      custom(): Custom27;
      neighbor(): LineIncrementalController;
      pane(): PaneController;
      save(): void;
      move(): void;
      reorder(): void;
      dataset(): void;
      patch(): void;
      empty(): void;
      whitespace(): void;
      replace(): void;
      switchRef(): void;
      remove(): void;
      restore(): void;
      removePane(): void;
      moveAndRemove(): void;
      unmount(): void;
      remount(): void;
      addCompanion(): void;
      removeCompanion(): void;
      changePaneId(): void;
    };
  }
}

test("owned custom series renders its actual custom values on nonzero native pane and retains all extensions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?extensions27");
  await expect.poll(() => page.evaluate(() => window.extensions27?.custom()?.hasData())).toBe(true);
  expect(await page.evaluate(() => window.extensions27.custom().api.getPane().paneIndex())).toBe(1);
  // Observe actual canvas pixels within the custom pane, not just model placement.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const pane = window.extensions27.custom().api.getPane().getHTMLElement();
        if (!pane) return false;
        return [...pane.querySelectorAll("canvas")].some((canvas: HTMLCanvasElement) => {
          const context = canvas.getContext("2d");
          if (!context) return false;
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          for (let i = 0; i < pixels.length; i += 4)
            if (
              pixels[i] === 208 &&
              pixels[i + 1] === 0 &&
              pixels[i + 2] === 208 &&
              pixels[i + 3] === 255
            )
              return true;
          return false;
        });
      }),
    )
    .toBe(true);
  // Custom fields have no native value/OHLC interpretation. Use the native
  // explicit-price marker form and prove its pixels surround that price.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const f = window.extensions27,
          pane = f.custom().api.getPane().getHTMLElement();
        const x = f.chart().api.timeScale().timeToCoordinate("2026-10-02");
        const y = f.custom().api.priceToCoordinate(40);
        if (!pane || x === null || y === null) return false;
        return [...pane.querySelectorAll("canvas")].some((canvas) => {
          const context = canvas.getContext("2d");
          if (!context) return false;
          const ratio = canvas.width / canvas.clientWidth;
          const pixels = context.getImageData(
            Math.round(x * ratio) - 8,
            Math.round(y * ratio) - 8,
            16,
            16,
          ).data;
          for (let i = 0; i < pixels.length; i += 4)
            if (
              pixels[i] === 0 &&
              pixels[i + 1] === 0 &&
              pixels[i + 2] === 255 &&
              pixels[i + 3] === 255
            )
              return true;
          return false;
        });
      }),
    )
    .toBe(true);
  await page.evaluate(() => {
    const f = window.extensions27;
    f.save();
    f.patch();
    f.move();
    f.reorder();
    f.dataset();
  });
  await expect
    .poll(() => page.evaluate(() => window.extensions27.custom().api.getPane().paneIndex()))
    .toBe(1);
  expect(
    await page.evaluate(() => {
      const f = window.extensions27;
      return {
        same:
          f.custom() === f.saved.custom &&
          f.custom().api === f.saved.native &&
          f.refs.series === f.saved.series &&
          f.refs.pane === f.saved.pane &&
          f.refs.markers === f.saved.markers,
        rows: f.custom().api.data(),
        markers: f.refs.markers.api.markers(),
        ink: f.custom().api.options().ink,
        counts: [
          f.stats.custom.create,
          f.stats.series.attach,
          f.stats.pane.attach,
          f.stats.markers.create,
        ],
      };
    }),
  ).toMatchObject({
    same: true,
    rows: [{ intensity: 20 }, { intensity: 40 }, { intensity: 30 }],
    markers: [],
    ink: "#008800",
    counts: [1, 1, 1, 1],
  });
  await page.evaluate(() => window.extensions27.switchRef());
  await expect
    .poll(() => page.evaluate(() => window.extensions27.refLog))
    .toEqual(["0:set", "0:clear", "1:set"]);
  await page.evaluate(() => window.extensions27.whitespace());
  expect(
    await page.evaluate(() => [
      window.extensions27.custom().ready(),
      window.extensions27.custom().hasData(),
    ]),
  ).toEqual([true, false]);
  await page.evaluate(() => window.extensions27.replace());
  expect(await page.evaluate(() => window.extensions27.custom().hasData())).toBe(true);
  expect(
    await page.evaluate(() => {
      const f = window.extensions27;
      const row = Object.freeze({ time: "2026-10-04", intensity: 50 });
      f.custom().update(row);
      return { popped: f.custom().pop(1), input: row, hasData: f.custom().hasData() };
    }),
  ).toMatchObject({
    popped: [{ intensity: 50 }],
    input: { time: "2026-10-04", intensity: 50 },
    hasData: true,
  });
  expect(errors).toEqual([]);
});

test("empty and removed custom resources differ; cleanup invalidates refs before effects and stops owned callbacks", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?extensions27");
  await expect
    .poll(() => page.evaluate(() => window.extensions27?.stats.series.ticks))
    .toBeGreaterThan(0);
  await page.mouse.click(200, 100);
  await expect.poll(() => page.evaluate(() => window.extensions27.stats.series.clicks)).toBe(1);
  await page.evaluate(() => {
    const f = window.extensions27;
    f.save();
    f.empty();
  });
  expect(
    await page.evaluate(() => {
      const f = window.extensions27;
      return [
        f.custom().ready(),
        f.custom().hasData(),
        f.custom() === f.saved.custom,
        f.refs.pane === f.saved.pane,
        f.stats.custom.detach,
        f.stats.pane.detach,
      ];
    }),
  ).toEqual([true, false, true, true, 0, 0]);
  await page.evaluate(() => window.extensions27.remove());
  expect(await page.evaluate(() => window.extensions27.observations)).toEqual([
    {
      seriesRefCleared: true,
      extensionRefsCleared: true,
      customReady: false,
      primitiveReady: false,
      markerReady: false,
      primitiveApiRejected: true,
      markerApiRejected: true,
      customApiRejected: true,
    },
  ]);
  await expect.poll(() => page.evaluate(() => window.extensions27.stats.custom.detach)).toBe(1);
  expect(
    await page.evaluate(() => {
      const f = window.extensions27;
      return [
        f.stats.custom.dispose,
        f.stats.custom.live,
        f.stats.series.detach,
        f.stats.series.dispose,
        f.stats.series.live,
        f.stats.markers.dispose,
        f.stats.pane.detach,
        f.refs.pane.ready(),
      ];
    }),
  ).toEqual([1, [true], 1, 1, [true], 1, 0, true]);
  const ticks = await page.evaluate(() => window.extensions27.stats.series.ticks);
  await page.mouse.click(200, 100);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(
    await page.evaluate(() => [
      window.extensions27.stats.series.ticks,
      window.extensions27.stats.series.clicks,
    ]),
  ).toEqual([ticks, 1]);
  await page.evaluate(() => window.extensions27.restore());
  await expect.poll(() => page.evaluate(() => window.extensions27?.stats.series.attach)).toBe(2);
  expect(
    await page.evaluate(() => {
      const f = window.extensions27;
      return [
        f.custom() !== f.saved.custom,
        f.refs.series !== f.saved.series,
        f.refs.markers !== f.saved.markers,
        f.refs.pane === f.saved.pane,
      ];
    }),
  ).toEqual([true, true, true, true]);
  await page.evaluate(() => window.extensions27.unmount());
  await expect.poll(() => page.evaluate(() => window.extensions27.stats.pane.dispose)).toBe(1);
  expect(
    await page.evaluate(() => {
      const f = window.extensions27;
      return [
        f.stats.custom.detach,
        f.stats.custom.dispose,
        f.stats.series.detach,
        f.stats.series.dispose,
        f.stats.markers.dispose,
        f.stats.pane.detach,
        f.stats.pane.live,
        !f.refs.pane,
        !f.refs.series,
        !f.refs.markers,
        !f.chart(),
      ];
    }),
  ).toEqual([2, 2, 2, 2, 2, 1, [true], true, true, true, true]);
  const stopped = await page.evaluate(() => [
    window.extensions27.stats.series.ticks,
    window.extensions27.stats.pane.ticks,
    window.extensions27.stats.custom.ticks,
  ]);
  await page.evaluate(() => {
    window.extensions27.unmount();
    return new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  expect(
    await page.evaluate(() => [
      window.extensions27.stats.series.ticks,
      window.extensions27.stats.pane.ticks,
      window.extensions27.stats.custom.ticks,
    ]),
  ).toEqual(stopped);
  await page.evaluate(() => window.extensions27.remount());
  await expect.poll(() => page.evaluate(() => window.extensions27.stats.series.attach)).toBe(3);
  await page.evaluate(() => window.extensions27.unmount());
  expect(
    await page.evaluate(() => {
      const s = window.extensions27.stats;
      return [s.custom.dispose, s.series.dispose, s.markers.dispose, s.pane.dispose];
    }),
  ).toEqual([3, 3, 3, 2]);

  expect(errors).toEqual([]);
});

test("managed populated-pane removal releases extensions before native removal and leaves neighboring rendering and timeline usable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?extensions27");
  await expect.poll(() => page.evaluate(() => window.extensions27?.custom()?.ready())).toBe(true);
  await page.evaluate(() => {
    const f = window.extensions27;
    f.save();
    f.removePane();
  });
  await expect
    .poll(() => page.evaluate(() => window.extensions27.chart().api.panes().length))
    .toBe(1);
  expect(
    await page.evaluate(() => {
      const f = window.extensions27;
      return [
        !f.custom(),
        !f.saved.custom.ready(),
        f.stats.custom.detach,
        f.stats.series.detach,
        f.stats.pane.detach,
        f.stats.markers.dispose,
        f.stats.custom.live,
      ];
    }),
  ).toEqual([true, true, 1, 1, 1, 1, [true]]);
  await page.evaluate(() => {
    const f = window.extensions27;
    f.neighbor().update({ time: "2026-10-04", value: 180 });
    f.chart().api.timeScale().fitContent();
  });
  await expect
    .poll(() => page.evaluate(() => window.extensions27.neighbor().api.priceToCoordinate(180)))
    .not.toBeNull();
  expect(
    await page.evaluate(() => {
      const f = window.extensions27;
      return {
        data: f.neighbor().api.data(),
        time: f.chart().api.timeScale().timeToIndex("2026-10-04"),
        ready: f.chart().ready(),
      };
    }),
  ).toMatchObject({
    data: [{ value: 120 }, { value: 140 }, { value: 130 }, { value: 180 }],
    time: 3,
    ready: true,
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const pane = window.extensions27.neighbor().api.getPane().getHTMLElement();
        if (!pane) return false;
        return [...pane.querySelectorAll("canvas")].some((canvas: HTMLCanvasElement) => {
          const context = canvas.getContext("2d");
          if (!context) return false;
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          for (let i = 0; i < pixels.length; i += 4)
            if (
              pixels[i] === 0 &&
              pixels[i + 1] === 68 &&
              pixels[i + 2] === 238 &&
              pixels[i + 3] === 255
            )
              return true;
          return false;
        });
      }),
    )
    .toBe(true);
  await page.evaluate(() => window.extensions27.restore());
  await expect.poll(() => page.evaluate(() => window.extensions27.custom()?.hasData())).toBe(true);
  await page.evaluate(() => {
    const f = window.extensions27;
    f.save();
    f.moveAndRemove();
  });
  await expect
    .poll(() => page.evaluate(() => window.extensions27.chart().api.panes().length))
    .toBe(1);
  expect(
    await page.evaluate(() => {
      const f = window.extensions27;
      return [
        f.custom() === f.saved.custom,
        f.refs.series === f.saved.series,
        f.refs.markers === f.saved.markers,
        !f.saved.pane.ready(),
        f.stats.custom.create,
        f.stats.custom.detach,
        f.stats.pane.detach,
        f.custom().api.getPane().paneIndex(),
        f.neighbor().api.data().length,
      ];
    }),
  ).toEqual([true, true, true, true, 2, 1, 2, 0, 4]);
  expect(errors).toEqual([]);
});

test("pane primitive owns one lifetime with several or no series and id replacement cannot dispose its replacement", async ({
  page,
}) => {
  await page.goto("/?extensions27");
  await expect.poll(() => page.evaluate(() => window.extensions27?.refs.pane?.ready())).toBe(true);
  await page.evaluate(() => window.extensions27.addCompanion());
  await expect
    .poll(() => page.evaluate(() => window.extensions27.pane()?.api.getSeries().length))
    .toBe(2);
  expect(await page.evaluate(() => window.extensions27.stats.pane.create)).toBe(1);
  await page.evaluate(() => {
    window.extensions27.removeCompanion();
    window.extensions27.move();
  });
  await expect
    .poll(() => page.evaluate(() => window.extensions27.pane()?.api.getSeries().length))
    .toBe(0);
  expect(
    await page.evaluate(() => [
      window.extensions27.stats.pane.create,
      window.extensions27.stats.pane.detach,
    ]),
  ).toEqual([1, 0]);
  await page.evaluate(() => {
    window.extensions27.save();
    window.extensions27.changePaneId();
  });
  await expect.poll(() => page.evaluate(() => window.extensions27.refs.pane?.ready())).toBe(true);
  expect(
    await page.evaluate(() => {
      const f = window.extensions27;
      return [
        f.refs.pane !== f.saved.pane,
        f.saved.pane?.ready(),
        f.stats.pane.create,
        f.stats.pane.detach,
        f.stats.pane.dispose,
      ];
    }),
  ).toEqual([true, false, 2, 1, 1]);
});

test("installed Extensions and lifecycle example exposes readable empty, movement and removal controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?extensions-example");
  const status = page.getByRole("status");
  await expect(status).toContainText("Custom series populated in analysis.");
  await expect(
    page.getByRole("region", { name: "Extensions and lifecycle chart" }).locator("canvas").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Empty custom data", exact: true }).click();
  await expect(status).toContainText("Custom series empty; resources retained.");
  await page.getByRole("button", { name: "Restore custom data", exact: true }).click();
  await page.getByRole("button", { name: "Analysis above price", exact: true }).click();
  await page.getByRole("button", { name: "Move custom to price", exact: true }).click();
  await expect(status).toContainText("populated in price");
  await page
    .getByRole("button", { name: "Change custom and marker appearance", exact: true })
    .click();
  await page.getByRole("button", { name: "Change dataset context", exact: true }).click();
  await expect(status).toContainText("populated in price");
  await page.getByRole("button", { name: "Remove custom series", exact: true }).click();
  await expect(status).toContainText("Custom series removed.");
  await page.getByRole("button", { name: "Restore composition", exact: true }).click();
  await expect(status).toContainText("populated in analysis");
  await page.getByRole("button", { name: "Remove analysis pane", exact: true }).click();
  await expect(status).toContainText("Custom series removed. Analysis pane removed.");
  await page.getByRole("button", { name: "Restore composition", exact: true }).click();
  await page
    .getByRole("button", { name: "Move custom, then remove analysis", exact: true })
    .click();
  await expect(status).toContainText("Custom series populated in price. Analysis pane removed.");
  await page.getByRole("button", { name: "Restore composition", exact: true }).click();
  await page.screenshot({ path: "/tmp/gurafu-spec-17/27-extensions-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({ path: "/tmp/gurafu-spec-17/27-extensions-mobile.png", fullPage: true });
  expect(errors).toEqual([]);
});
