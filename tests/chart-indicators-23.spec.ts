import { expect, test } from "@playwright/test";

type Fixture = {
  chart: import("../src/registry/kobalte/chart/chart").ChartController;
  sibling: import("../src/registry/kobalte/chart/chart").ChartController;
  candles: import("../src/registry/kobalte/chart/chart").CandlestickIncrementalController;
  line(title: string, sibling?: boolean): import("lightweight-charts").ISeriesApi<"Line">;
  row(i: number, close?: number): import("lightweight-charts").CandlestickData;
  time(i: number): string;
  initial: import("lightweight-charts").CandlestickData[];
  requests: boolean[];
  events: { ready: boolean; ema: number[]; rsi: number[] }[];
  calculateEMA: typeof import("../src/registry/kobalte/chart/indicator-calculations").calculateEMA;
  calculateRSI: typeof import("../src/registry/kobalte/chart/indicator-calculations").calculateRSI;
  setParameters(
    p: import("../src/registry/kobalte/chart/indicator-calculations").EMAParameters,
  ): void;
  setSource(s: string): void;
  setVisible(v: boolean): void;
  setAppearance(v: boolean): void;
  setTarget(s: string): void;
  setMounted(v: boolean): void;
  setPane(v: boolean): void;
  switch(empty?: boolean): void;
};
const near = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
    1e-10 + 1e-10 * Math.max(Math.abs(actual), Math.abs(expected)),
  );
function equivalent(actual: unknown, expected: unknown) {
  if (typeof expected === "number") {
    near(actual as number, expected);
    return;
  }
  if (Array.isArray(expected)) {
    expect(actual).toHaveLength(expected.length);
    expected.forEach((v, i) => {
      equivalent((actual as unknown[])[i], v);
    });
    return;
  }
  if (expected && typeof expected === "object") {
    expect(Object.keys(actual as object)).toEqual(Object.keys(expected));
    for (const [key, value] of Object.entries(expected))
      equivalent((actual as Record<string, unknown>)[key], value);
    return;
  }
  expect(actual).toEqual(expected);
}
declare global {
  interface Window {
    indicators23: Fixture;
  }
}
test.beforeEach(async ({ page }) => {
  await page.goto("/?indicators23");
  await expect.poll(() => page.evaluate(() => window.indicators23?.chart?.ready())).toBe(true);
});
test("EMA and RSI defaults use native overlays/panes, linear bounds and dashed references", async ({
  page,
}) => {
  await page.evaluate(() => window.indicators23.chart.api.timeScale().fitContent());
  await expect
    .poll(() =>
      page.evaluate(() => {
        const s = window.indicators23,
          r = s.line("rsi");
        const zero = r.priceToCoordinate(0),
          hundred = r.priceToCoordinate(100);
        return (
          zero !== null &&
          hundred !== null &&
          Math.abs(Math.abs(zero - hundred) - r.getPane().getHeight()) < 2
        );
      }),
    )
    .toBe(true);
  expect(
    await page.evaluate(() => {
      const s = window.indicators23;
      return {
        panes: s.chart.api.panes().length,
        emaPane: s.line("ema").getPane().paneIndex(),
        rsiPane: s.line("rsi").getPane().paneIndex(),
        styles: ["ema", "rsi"].map((n) => {
          const o = s.line(n).options();
          return [o.lineWidth, o.lineStyle, o.color];
        }),
        scale: s.line("rsi").priceScale().options().mode,
        references: s
          .line("rsi")
          .priceLines()
          .map((l) => {
            const o = l.options();
            return [o.price, o.lineWidth, o.lineStyle, o.lineVisible];
          }),
        supplied: ["ema", "rsi"].map(
          (n) =>
            JSON.stringify(s.line(n).data()) === JSON.stringify(s.line(`supplied-${n}`).data()),
        ),
      };
    }),
  ).toEqual({
    panes: 4,
    emaPane: 0,
    rsiPane: 2,
    styles: [
      [2, 0, "#FF9800"],
      [2, 0, "#9C27B0"],
    ],
    scale: 0,
    references: [
      [30, 1, 2, true],
      [70, 1, 2, true],
    ],
    supplied: [true, true],
  });
});

test("live replacement, equal-time update, corrections, prepend, rewind and restoration match fresh displayed calculations", async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const s = window.indicators23,
      ema = s.line("ema"),
      rsi = s.line("rsi");
    const strip = (n: string) =>
      s
        .line(n)
        .data()
        .flatMap((r) => ("value" in r ? [{ time: r.time, value: r.value }] : []));
    const check = () => {
      const rows = s.candles.api.data();
      return [s.calculateEMA, s.calculateRSI].every(
        (calculate, i) =>
          JSON.stringify(strip(i ? "rsi" : "ema")) ===
          JSON.stringify(calculate(rows, { period: 3 }).filter((r) => "value" in r)),
      );
    };
    const checks = [check()];
    s.candles.update(s.row(7, 20));
    checks.push(check());
    s.candles.update(s.row(7, 3));
    checks.push(check());
    s.candles.update(s.row(2, 4), true);
    checks.push(check());
    const corrected = [strip("ema"), strip("rsi")];
    s.candles.setData([{ ...s.row(1, -5), time: "2025-12-31" }, ...s.initial]);
    checks.push(check());
    s.candles.pop(2);
    checks.push(check());
    s.candles.setData(s.initial.slice(0, 4));
    checks.push(check());
    const rewind = [strip("ema"), strip("rsi")];
    s.candles.setData(s.initial);
    checks.push(check());
    return {
      checks,
      corrected,
      rewind,
      retained: ema === s.line("ema") && rsi === s.line("rsi"),
      supplied: [strip("supplied-ema"), strip("supplied-rsi")],
    };
  });
  expect(result.checks).toEqual(Array(8).fill(true));
  expect(result.retained).toBe(true);
  equivalent(result.supplied, [
    [4 / 3, 5 / 3, 7 / 3, 13 / 6].map((value, i) => ({ time: `2026-01-0${i + 3}`, value })),
    [200 / 3, 700 / 9, 1400 / 27].map((value, i) => ({ time: `2026-01-0${i + 4}`, value })),
  ]);
  result.rewind[0].forEach((r, i) => {
    near(r.value, [4 / 3, 5 / 3][i]);
  });
  near(result.rewind[1][0].value, 200 / 3);
  // Literal values independently catch double-counted ticks or a stale chain.
  const expectedEMA = [2, 2, 2.5, 2.25, 2.625];
  const expectedRSI = [400 / 7, 1100 / 17, 2200 / 43, 7100 / 113];
  for (const [i, expected] of [expectedEMA, expectedRSI].entries()) {
    expect(result.corrected[i]).toHaveLength(expected.length);
    result.corrected[i].forEach((r, j) => {
      near(r.value, expected[j]);
    });
  }
});

test("whitespace, input/period/source changes and forward-source context callbacks remove stale and future analysis", async ({
  page,
}) => {
  equivalent(
    await page.evaluate(() => {
      const s = window.indicators23;
      const values = (n: string) =>
        s
          .line(n)
          .data()
          .flatMap((r) => ("value" in r ? [r.value] : []));
      s.candles.setData([
        s.row(1, 1),
        s.row(2, 2),
        s.row(3, 1),
        s.row(4, 2),
        { time: s.time(5) },
        s.row(6, 50),
        s.row(7, 51),
        s.row(8, 50),
        s.row(9, 51),
      ]);
      const whitespace = [values("ema"), values("rsi")];
      s.setParameters({ period: 1, priceInput: "high" });
      const high = values("ema");
      s.setSource("single");
      const single = [values("ema"), values("rsi")];
      s.setSource("missing");
      const missing = [values("ema"), values("rsi")];
      s.setSource("candles");
      s.setParameters({ period: 3 });
      s.events.length = 0;
      s.switch();
      const context = s.events.slice();
      s.switch(true);
      return { whitespace, high, single, missing, context, empty: [values("ema"), values("rsi")] };
    }),
    {
      whitespace: [
        [4 / 3, 5 / 3, 151 / 3, 152 / 3],
        [200 / 3, 200 / 3],
      ],
      high: [3, 4, 3, 4, 52, 53, 52, 53],
      single: [
        [0, 3, 0, 3, 6, 3],
        [100, 0, 100, 100, 0],
      ],
      missing: [[], []],
      context: [{ ready: true, ema: [40 / 3, 50 / 3], rsi: [200 / 3] }],
      empty: [[], []],
    },
  );
});

test("controlled and private visibility have one authority and keep RSI references coherent", async ({
  page,
}) => {
  expect(
    await page.evaluate(() => {
      const s = window.indicators23;
      const ema = s.line("ema"),
        rsi = s.line("rsi");
      s.chart.requestIndicatorVisibility("ema", false);
      const declined = ema.options().visible;
      s.setVisible(false);
      s.chart.requestIndicatorVisibility("rsi", false);
      const hidden = {
        line: rsi.options().visible,
        refs: rsi.priceLines().map((l) => l.options().lineVisible),
      };
      const sibling = s.line("rsi", true).options().visible;
      s.chart.requestIndicatorVisibility("rsi", true);
      return {
        declined,
        delayed: ema.options().visible,
        requests: s.requests,
        hidden,
        sibling,
        restored: rsi.priceLines().map((l) => l.options().lineVisible),
        retained: rsi === s.line("rsi"),
      };
    }),
  ).toEqual({
    declined: true,
    delayed: false,
    requests: [false],
    hidden: { line: false, refs: [false, false] },
    sibling: true,
    restored: [true, true],
    retained: true,
  });
});

test("native appearance patches, pane moves/removal and declaration reintroduction preserve supported identities", async ({
  page,
}) => {
  expect(
    await page.evaluate(() => {
      const s = window.indicators23;
      const ema = s.line("ema"),
        rsi = s.line("rsi"),
        reference = rsi.priceLines()[0];
      let changes = 0;
      const changed = () => changes++;
      ema.subscribeDataChanged(changed);
      rsi.subscribeDataChanged(changed);
      s.setAppearance(true);
      ema.unsubscribeDataChanged(changed);
      rsi.unsubscribeDataChanged(changed);
      return {
        changes,
        retained:
          ema === s.line("ema") && rsi === s.line("rsi") && reference.options().price === 25,
        styles: [ema.options().lineWidth, rsi.options().lineStyle],
        refs: rsi.priceLines().map((l) => {
          const o = l.options();
          return [o.price, o.color, o.lineWidth, o.lineStyle, o.axisLabelVisible];
        }),
      };
    }),
  ).toEqual({ changes: 0, retained: true, styles: [3, 2], refs: [[25, "#123456", 3, 2, false]] });
  await page.evaluate(() => {
    const s = window.indicators23;
    s.setTarget("other");
    s.setPane(false);
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const s = window.indicators23,
          r = s.line("rsi");
        return [
          s.chart.api.panes().length,
          r.getPane().paneIndex(),
          r.priceScale().options().invertScale,
        ];
      }),
    )
    .toEqual([3, 2, true]);
  expect(
    await page.evaluate(() => {
      const s = window.indicators23;
      const r = s.line("rsi");
      s.setMounted(false);
      try {
        s.chart.requestIndicatorVisibility("rsi", false);
        return false;
      } catch {
        return r.priceLines().length === 0;
      }
    }),
  ).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.indicators23.chart.api
            .panes()
            .flatMap((p) => p.getSeries())
            .filter((s) => s.options().title === "rsi").length,
      ),
    )
    .toBe(0);
  await page.evaluate(() => window.indicators23.setMounted(true));
  await expect
    .poll(() => page.evaluate(() => window.indicators23.line("rsi").priceLines().length))
    .toBe(1);
});

test("readable optional set supports configurable EMA/RSI and equivalent supplied snapshots on mobile", async ({
  page,
}) => {
  await page.goto("/?indicators-example22");
  await page.getByRole("combobox", { name: "EMA period", exact: true }).selectOption("3");
  await page.getByRole("combobox", { name: "RSI period", exact: true }).selectOption("7");
  await page.getByLabel("Supply precomputed SMA, EMA and RSI", { exact: true }).check();
  await page.getByLabel("Show EMA", { exact: true }).uncheck();
  await page.getByLabel("Show RSI", { exact: true }).uncheck();
  await expect(
    page.getByText("EMA 3 · RSI 7 · SMA/EMA/RSI: Application-calculated snapshot", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Show RSI", { exact: true }).check();
  await page.getByLabel("Supply precomputed SMA, EMA and RSI", { exact: true }).uncheck();
  await expect(
    page.getByText("EMA 3 · RSI 7 · SMA/EMA/RSI: Chart-local displayed source", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
