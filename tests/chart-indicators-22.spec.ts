import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    indicators22: ReturnTypeFixture;
  }
}
type ReturnTypeFixture = {
  chart: import("../src/registry/kobalte/chart/chart").ChartController;
  sibling: import("../src/registry/kobalte/chart/chart").ChartController;
  candles: import("../src/registry/kobalte/chart/chart").CandlestickIncrementalController;
  requests: boolean[];
  events: {
    ready: boolean;
    candles: number[];
    bands: number[];
    sma: number[];
    preceding: number[];
  }[];
  row(i: number, close?: number): import("lightweight-charts").CandlestickData;
  time(i: number): string;
  initial: import("lightweight-charts").CandlestickData[];
  calculateBollingerBands: typeof import("../src/registry/kobalte/chart/indicator-calculations").calculateBollingerBands;
  calculateSMA: typeof import("../src/registry/kobalte/chart/indicator-calculations").calculateSMA;
  line(title: string, sibling?: boolean): import("lightweight-charts").ISeriesApi<"Line">;
  setParameters(
    p: import("../src/registry/kobalte/chart/indicator-calculations").BollingerBandsParameters,
  ): void;
  setSource(source: string): void;
  setVisible(visible: boolean): void;
  setSupplied(
    data: readonly import("../src/registry/kobalte/chart/indicator-calculations").BollingerBandsValue[],
  ): void;
  setTarget(pane: string): void;
  setAppearance(value: boolean): void;
  setBands(value: boolean): void;
  switch(): void;
  unmount(): void;
};
test.beforeEach(async ({ page }) => {
  await page.goto("/?indicators22");
  await expect.poll(() => page.evaluate(() => window.indicators22?.chart?.ready())).toBe(true);
});
test("dataset-context completion callbacks observe current candles and calculated overlays together", async ({
  page,
}) => {
  const events = await page.evaluate(() => {
    const s = window.indicators22;
    s.events.length = 0;
    s.switch();
    return s.events;
  });
  expect(events.length).toBeGreaterThan(0);
  expect(events).toEqual(
    events.map(() => ({
      ready: true,
      candles: [10, 20, 30],
      bands: [20],
      sma: [20],
      preceding: [20],
    })),
  );
});
test("calculated and supplied Bands match; all displayed-source mutations match fresh batch without future history", async ({
  page,
}) => {
  expect(
    await page.evaluate(() => {
      const s = window.indicators22;
      return ["middle", "upper", "lower"].every(
        (k) =>
          JSON.stringify(s.line(`calc-${k}`).data()) ===
          JSON.stringify(s.line(`supplied-${k}`).data()),
      );
    }),
  ).toBe(true);
  const results = await page.evaluate(() => {
    const s = window.indicators22;
    const native = s.line("calc-middle");
    const strip = (line: ReturnType<ReturnTypeFixture["line"]>) =>
      line.data().map((r) => ("value" in r ? { time: r.time, value: r.value } : { time: r.time }));
    const check = () => {
      // These operations use populated source only; whitespace has its own case.
      const source = s.candles.api.data();
      const expected = s.calculateBollingerBands(source, { period: 3 });
      return (
        ["middle", "upper", "lower"].every(
          (k) =>
            JSON.stringify(strip(s.line(`calc-${k}`))) ===
            JSON.stringify(
              expected
                .filter((r) => r.middle !== undefined)
                .map((r) =>
                  r.middle !== undefined
                    ? { time: r.time, value: r[k as "middle" | "upper" | "lower"] }
                    : { time: r.time },
                ),
            ),
        ) &&
        JSON.stringify(strip(s.line("sma"))) ===
          JSON.stringify(s.calculateSMA(source, { period: 3 }).filter((r) => "value" in r))
      );
    };
    const checks = [check()];
    s.candles.update(s.row(5, 50));
    checks.push(check());
    s.candles.update(s.row(5, 5));
    checks.push(check());
    s.candles.update(s.row(2, 20), true);
    checks.push(check());
    s.candles.setData([s.row(1, 10), s.row(2, 20), s.row(3, 30), s.row(4, 40)]);
    checks.push(check());
    s.candles.pop(1);
    checks.push(check());
    s.candles.setData([s.row(1, -1), s.row(2, 0), s.row(3, 1)]);
    checks.push(check());
    s.candles.setData(s.initial);
    checks.push(check());
    return {
      checks,
      retained: native === s.line("calc-middle"),
      supplied: strip(s.line("supplied-middle")),
    };
  });
  expect(results.checks).toEqual(Array(8).fill(true));
  expect(results.retained).toBe(true);
  expect(results.supplied).toEqual([
    { time: "2026-01-03", value: 2 },
    { time: "2026-01-04", value: 3 },
  ]);
});

test("controlled visibility requests can be declined or delayed; uncontrolled defaults stay chart-local", async ({
  page,
}) => {
  expect(
    await page.evaluate(() => {
      const s = window.indicators22,
        before = s.line("calc-middle");
      s.chart.requestIndicatorVisibility("calc", false);
      const declined = before.options().visible;
      s.chart.requestIndicatorVisibility("local", true);
      const local = s.line("local").options().visible;
      const sibling = s.line("local", true).options().visible;
      s.sibling.requestIndicatorVisibility("local", false);
      s.setVisible(false);
      const delayed = before.options().visible;
      s.setVisible(true);
      return {
        declined,
        delayed,
        local,
        sibling,
        siblingAfter: s.line("local", true).options().visible,
        localAfter: s.line("local").options().visible,
        retained: before === s.line("calc-middle"),
        requests: s.requests,
      };
    }),
  ).toEqual({
    declined: true,
    delayed: false,
    local: true,
    sibling: true,
    siblingAfter: false,
    localAfter: true,
    retained: true,
    requests: [false],
  });
});

test("source, parameters, dataset, appearance and native pane movement retain compatible resources", async ({
  page,
}) => {
  expect(
    await page.evaluate(() => {
      const s = window.indicators22,
        native = s.line("calc-middle"),
        candles = s.candles;
      s.setSource("single");
      const source = native.data().map((r) => ("value" in r ? r.value : null));
      s.setParameters({ period: 1, multiplier: 0 });
      const parameters = native.data().map((r) => ("value" in r ? r.value : null));
      let presentationDataChanges = 0;
      const changed = () => presentationDataChanges++;
      native.subscribeDataChanged(changed);
      s.setAppearance(true);
      native.unsubscribeDataChanged(changed);
      const appearance = native.options();
      s.setSource("candles");
      s.switch();
      return {
        source,
        parameters,
        final: native.data().map((r) => ("value" in r ? r.value : null)),
        retained: s.line("calc-middle") === native && s.candles === candles,
        presentationDataChanges,
        appearance: [appearance.lineWidth, appearance.lineStyle, appearance.priceLineVisible],
      };
    }),
  ).toEqual({
    source: [20, 30],
    parameters: [10, 20, 30, 40],
    final: [10, 20, 30],
    retained: true,
    presentationDataChanges: 0,
    appearance: [3, 2, false],
  });
  await page.evaluate(() => window.indicators22.setTarget("other"));
  await expect
    .poll(() => page.evaluate(() => window.indicators22.line("calc-middle").getPane().paneIndex()))
    .toBe(1);
  expect(
    await page.evaluate(() => {
      const s = window.indicators22;
      s.setBands(false);
      let error = "";
      try {
        s.chart.requestIndicatorVisibility("calc", false);
      } catch (e) {
        error = (e as Error).message;
      }
      return error;
    }),
  ).toMatch(/unknown|removed/i);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.indicators22.chart.api
            .panes()
            .flatMap((p) => p.getSeries())
            .filter((s) => s.options().title.startsWith("calc-")).length,
      ),
    )
    .toBe(0);
});

test("displayed whitespace restarts warmup; prepends, parameter/input changes and missing sources replace old analysis", async ({
  page,
}) => {
  expect(
    await page.evaluate(() => {
      const s = window.indicators22;
      s.candles.setData([
        s.row(1),
        s.row(2),
        s.row(3),
        { time: s.time(4) },
        s.row(5, 7),
        s.row(6, 8),
        s.row(7, 9),
      ]);
      const whitespace = s
        .line("calc-middle")
        .data()
        .map((r) => ("value" in r ? r.value : null));
      s.candles.setData([{ ...s.row(1, 0), time: "2025-12-31" }, ...s.initial]);
      const prepend = s
        .line("calc-middle")
        .data()
        .map((r) => ("value" in r ? r.value : null));
      s.setParameters({ period: 1, priceInput: "high" });
      const selector = s
        .line("calc-middle")
        .data()
        .map((r) => ("value" in r ? r.value : null));
      s.setSource("not-mounted");
      const missing = s.line("calc-middle").data();
      s.setSource("candles");
      const restored = s
        .line("calc-middle")
        .data()
        .map((r) => ("value" in r ? r.value : null));
      return { whitespace, prepend, selector, missing, restored };
    }),
  ).toEqual({
    whitespace: [2, 8],
    prepend: [1, 2, 3],
    selector: [1, 2, 3, 4, 5],
    missing: [],
    restored: [1, 2, 3, 4, 5],
  });
});

test("raw-value Bands colors retain flat direction, reset at whitespace and survive scale inversion", async ({
  page,
}) => {
  await page.evaluate(() => {
    const s = window.indicators22;
    for (const p of s.chart.api.panes())
      for (const line of p.getSeries()) line.applyOptions({ visible: false });
    s.setSupplied(
      [10, 12, 12, 9, 9, null, 7, 7, 10].map((middle, i) =>
        middle === null
          ? { time: s.time(i + 1) }
          : { time: s.time(i + 1), middle, upper: middle + 2, lower: middle - 2 },
      ),
    );
    for (const k of ["middle", "upper", "lower"])
      s.line(`supplied-${k}`).applyOptions({
        visible: true,
        priceLineVisible: false,
        lastValueVisible: false,
      });
    s.chart.api.timeScale().fitContent();
  });
  const colors = await page.evaluate(() => {
    const s = window.indicators22;
    return {
      upper: s
        .line("supplied-upper")
        .data()
        .map((r) => ("color" in r ? r.color : null)),
      defaults: [s.line("supplied-middle").options(), s.line("sma").options()].map((o) => [
        o.lineWidth,
        o.lineStyle,
        o.color,
      ]),
    };
  });
  // Native simple-line colors apply to the outgoing segment.
  expect(colors.upper).toEqual([
    "#2196F3",
    "#2196F3",
    "#F55253",
    "#F55253",
    "transparent",
    "#2196F3",
    "#2196F3",
    "#2196F3",
  ]);
  expect(colors.defaults).toEqual([
    [1, 0, "#4CAF50"],
    [2, 0, "#2196F3"],
  ]);
  async function painted() {
    await page.waitForTimeout(60);
    return page.evaluate(() => {
      const s = window.indicators22,
        line = s.line("supplied-upper"),
        scale = s.chart.api.timeScale();
      const pane = line.getPane().getHTMLElement();
      if (!pane) throw new Error("No pane layout");
      const canvases = [...pane.querySelectorAll("canvas")];
      const segment = (a: number, av: number, b: number, bv: number) => {
        const ax = scale.timeToCoordinate(s.time(a)),
          bx = scale.timeToCoordinate(s.time(b));
        const ay = line.priceToCoordinate(av),
          by = line.priceToCoordinate(bv);
        if (ax === null || bx === null || ay === null || by === null)
          throw new Error("No native segment coordinates");
        const x = (ax + bx) / 2,
          y = (ay + by) / 2;
        const found = new Set<string>();
        for (const canvas of canvases) {
          // Pane chart canvas shares the timeline's x origin; axis canvases have different widths.
          if (canvas.clientWidth !== scale.width()) continue;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          const px = canvas.width / canvas.clientWidth,
            py = canvas.height / canvas.clientHeight;
          const data = ctx.getImageData(Math.round(x * px) - 2, Math.round(y * py) - 2, 5, 5).data;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] > data[i + 2] + 40 && data[i] > data[i + 1] + 40) found.add("red");
            if (data[i + 2] > data[i] + 40 && data[i + 2] > data[i + 1] + 20) found.add("blue");
          }
        }
        return [...found].sort();
      };
      return {
        rising: segment(1, 12, 2, 14),
        falling: segment(3, 14, 4, 11),
        flatFalling: segment(4, 11, 5, 11),
        resetFlat: segment(7, 9, 8, 9),
        gap: segment(5, 11, 7, 9),
      };
    });
  }
  expect(await painted()).toEqual({
    rising: ["blue"],
    falling: ["red"],
    flatFalling: ["red"],
    resetFlat: ["blue"],
    gap: [],
  });
  await page.evaluate(() =>
    window.indicators22.line("supplied-upper").priceScale().applyOptions({ invertScale: true }),
  );
  expect(await painted()).toEqual({
    rising: ["blue"],
    falling: ["red"],
    flatFalling: ["red"],
    resetFlat: ["blue"],
    gap: [],
  });
});

test("readable Indicators and panes source uses working labelled parameter and visibility controls", async ({
  page,
}) => {
  await page.goto("/?indicators-example22");
  await expect(page.getByRole("heading", { name: "Indicators and panes" })).toBeVisible();
  await page.getByRole("combobox", { name: "Bands period", exact: true }).selectOption("3");
  await page.getByRole("combobox", { name: "Standard deviations", exact: true }).selectOption("0");
  await page.getByRole("combobox", { name: "SMA period", exact: true }).selectOption("10");
  await page.getByRole("combobox", { name: "Price input", exact: true }).selectOption("hl2");
  await page.getByLabel("Show Bollinger Bands", { exact: true }).uncheck();
  await page.getByLabel("Supply precomputed Bands", { exact: true }).check();
  await expect(page.getByRole("status")).toHaveText(
    "Application-calculated snapshot · Bands 3/0 · SMA 10 · HL2",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
