import { expect, test } from "@playwright/test";
import type * as Chart from "../src/registry/kobalte/chart/chart";
import type { MarketApp } from "../src/services/market/app";
import type { createMarketFixture, fixtureCandles } from "../src/services/market/fixture";

declare global {
  interface Window {
    independent26: {
      fixture: ReturnType<typeof createMarketFixture>;
      fixtureCandles: typeof fixtureCandles;
      app: MarketApp;
      observeChart(id: number, chart: Chart.ChartController | undefined): void;
      commands: {
        id: number;
        kind: "place" | "clear";
        time?: import("lightweight-charts").Time;
        price?: number;
        owned?: boolean;
      }[];
      nativeMoves: { id: number; time?: import("lightweight-charts").Time; pointer: boolean }[];
      charts: (Chart.ChartController | undefined)[];
      candles: (Chart.CandlestickSnapshotController | undefined)[];
      models: (() => Chart.LegendModel)[];
    };
  }
}

test("the readable example starts with independent timeframes and expands to four scoped datasets", async ({
  page,
}) => {
  await page.goto("/?independent26");
  await expect(page.getByRole("region", { name: /^Chart \d+$/ })).toHaveCount(2);
  await expect
    .poll(() =>
      page.evaluate(() => window.independent26.fixture.requests.map((r) => r.page.interval).sort()),
    )
    .toEqual(["1m", "5m"]);
  await page.getByRole("button", { name: "Add chart" }).click();
  await page.getByRole("button", { name: "Add chart" }).click();
  await expect(page.getByRole("region", { name: /^Chart \d+$/ })).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Add chart" })).toBeDisabled();
  await expect
    .poll(() => page.evaluate(() => window.independent26.fixture.requests.length))
    .toBe(4);
  await page.evaluate(() => {
    const { fixture, fixtureCandles } = window.independent26;
    for (const request of fixture.requests) request.resolve(fixtureCandles(request.page));
  });
  await expect(page.getByText("96 candles", { exact: false })).toHaveCount(4);
  expect(
    await page.evaluate(() =>
      window.independent26.charts.filter((c) => c?.ready()).map((c) => c?.api.panes().length),
    ),
  ).toEqual([3, 3, 3, 3]);
});

const browserErrors = new WeakMap<import("@playwright/test").Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
});

const start = 1767225600;

test("candle, volume and exact-time legend colors agree for rising, falling and doji history and live replacements", async ({
  page,
}) => {
  await page.goto("/?independent26");
  await expect
    .poll(() => page.evaluate(() => window.independent26.fixture.requests.length))
    .toBe(2);
  await page.evaluate(() => {
    const f = window.independent26;
    for (const request of f.fixture.requests)
      request.resolve(
        f.fixtureCandles(request.page).map((row, index) => ({
          ...row,
          close: index === 1 ? row.open - 1 : index === 2 ? row.open : row.close,
        })),
      );
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => window.independent26.candles.filter((c) => c?.ready() && c.hasData()).length,
      ),
    )
    .toBe(2);
  const history = await page.evaluate(() => {
    const f = window.independent26;
    return [0, 1].map((id) => {
      const chart = f.charts[id];
      const candles = f.candles[id];
      if (!chart || !candles) throw new Error("Missing chart resources");
      const options = candles.api.options();
      const volume = chart.api.panes()[1].getSeries()[0];
      const expected = [options.upColor, options.downColor, options.upColor];
      const readings = candles.api
        .data()
        .slice(0, 3)
        .map((row) => {
          chart.setCrosshairPosition(0, row.time, candles);
          const bar = volume.data().find((value) => value.time === row.time);
          const model = f.models[id]();
          return {
            volume: bar && "color" in bar ? bar.color : null,
            ohlc: model.ohlc?.color,
            legendVolume: model.volume?.color,
          };
        });
      return { expected, readings };
    });
  });
  for (const { expected, readings } of history)
    expect(readings).toEqual(
      expected.map((color) => ({ volume: color, ohlc: color, legendVolume: color })),
    );
  for (const close of [194, 195]) {
    await page.evaluate((close) => {
      const f = window.independent26;
      const stream = f.fixture.streams.find((s) => s.market.interval === "1m" && !s.closed);
      if (!stream) throw new Error("Source stream is absent");
      stream.emit({ type: "candle", candle: { ...f.fixtureCandles(stream.market)[95], close } });
    }, close);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const f = window.independent26;
          const chart = f.charts[0];
          const candles = f.candles[0];
          if (!chart || !candles) throw new Error("Missing chart resources");
          const row = candles.api.data().at(-1);
          if (!row || !("close" in row)) throw new Error("Missing latest candle");
          chart.setCrosshairPosition(0, row.time, candles);
          const volume = chart.api.panes()[1].getSeries()[0].data().at(-1);
          const options = candles.api.options();
          const expected = row.close >= row.open ? options.upColor : options.downColor;
          const model = f.models[0]();
          return {
            close: row.close,
            matches:
              volume &&
              "color" in volume &&
              volume.color === expected &&
              model.ohlc?.color === expected &&
              model.volume?.color === expected,
          };
        }),
      )
      .toEqual({ close, matches: true });
  }
});

async function load(page: import("@playwright/test").Page, four = false) {
  await page.goto("/?independent26");
  if (four) {
    await page.getByRole("button", { name: "Add chart" }).click();
    await page.getByRole("button", { name: "Add chart" }).click();
  }
  await expect
    .poll(() => page.evaluate(() => window.independent26.fixture.requests.length))
    .toBe(four ? 4 : 2);
  await page.evaluate(() => {
    const f = window.independent26;
    for (const request of f.fixture.requests) request.resolve(f.fixtureCandles(request.page));
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => window.independent26.candles.filter((c) => c?.ready() && c.hasData()).length,
      ),
    )
    .toBe(four ? 4 : 2);
  await page.evaluate(() => {
    for (const chart of window.independent26.charts) chart?.api.timeScale().fitContent();
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => window.independent26.charts[0]?.api.timeScale().getVisibleLogicalRange()?.from,
      ),
    )
    .toBe(0);
}

async function point(page: import("@playwright/test").Page, id: number, time: number, y = 125) {
  const surface = page
    .getByRole("region", { name: `Chart ${id + 1}`, exact: true })
    .locator("canvas")
    .first();
  await surface.scrollIntoViewIfNeeded();
  const box = await surface.boundingBox();
  if (!box) throw new Error("Native surface is absent");
  const x = await page.evaluate(
    ({ id, time }) =>
      window.independent26.charts[id]?.api
        .timeScale()
        .timeToCoordinate(time as import("lightweight-charts").UTCTimestamp),
    { id, time },
  );
  if (x == null) throw new Error("Native time is unavailable");
  await page.mouse.move(box.x + x, box.y + y);
}

test("pointer intent shares unchanged seconds, missing native time keeps an exact unavailable legend and leave is local", async ({
  page,
}) => {
  await load(page);
  await point(page, 0, start + 30 * 60);
  await expect(page.getByLabel("Shared pointer time")).toHaveText(
    `Chart 1 · ${start + 30 * 60} seconds UTC`,
  );
  await expect
    .poll(() => page.evaluate(() => window.independent26.models[1]()))
    .toMatchObject({ time: start + 30 * 60, ohlc: { close: 110 } });
  await page.evaluate(() => {
    window.independent26.nativeMoves.length = 0;
    window.independent26.commands.length = 0;
  });
  await point(page, 0, start + 31 * 60);
  await expect(page.getByLabel("Shared pointer time")).toHaveText(
    `Chart 1 · ${start + 31 * 60} seconds UTC`,
  );
  await expect
    .poll(() => page.evaluate(() => window.independent26.models[1]()))
    .toMatchObject({ time: start + 31 * 60, ohlc: null, volume: null });
  expect(
    await page.evaluate(() => window.independent26.commands.filter((c) => c.kind === "place")),
  ).toEqual([{ id: 1, kind: "place", time: start + 31 * 60, price: 0, owned: true }]);
  // Native 5.2.1's public lookup resolves minute 31 to the next five-minute bar.
  // The consumer command and exact-time legend above still retain minute 31.
  expect(
    await page.evaluate(
      (time) => {
        const scale = window.independent26.charts[1]?.api.timeScale();
        const index = scale?.timeToIndex(time as import("lightweight-charts").UTCTimestamp, true);
        return index == null ? null : window.independent26.candles[1]?.api.dataByIndex(index)?.time;
      },
      start + 31 * 60,
    ),
  ).toBe(start + 35 * 60);
  expect(
    await page.evaluate(() => window.independent26.nativeMoves.filter((e) => e.id === 1)),
  ).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath("missing-native-time.png"),
    fullPage: true,
  });
  await page.getByRole("heading", { name: "Independent charts", exact: true }).hover();
  expect(await page.evaluate(() => window.independent26.models[0]())).toMatchObject({
    time: start + 95 * 60,
    ohlc: { close: 199 },
  });
  await expect(page.getByLabel("Shared pointer time")).toHaveText(
    `Chart 1 · ${start + 31 * 60} seconds UTC`,
  );
  await point(page, 1, start + 30 * 60);
  await expect(page.getByLabel("Shared pointer time")).toHaveText(
    `Chart 2 · ${start + 30 * 60} seconds UTC`,
  );
  await expect
    .poll(() => page.evaluate(() => window.independent26.models[0]()))
    .toMatchObject({ time: start + 30 * 60, ohlc: { close: 134 } });
});

test("receiver clears outside its native range or with an empty/absent timeline without moving sibling viewports", async ({
  page,
}) => {
  await load(page);
  const before = await page.evaluate(() =>
    window.independent26.charts[0]?.api.timeScale().getVisibleLogicalRange(),
  );
  await page.evaluate((time) => {
    const target = window.independent26.charts[1];
    target?.api.timeScale().setVisibleRange({
      from: time as import("lightweight-charts").UTCTimestamp,
      to: (time + 1800) as import("lightweight-charts").UTCTimestamp,
    });
    window.independent26.commands.length = 0;
  }, start + 7200);
  await point(page, 0, start + 1800);
  await expect
    .poll(() =>
      page.evaluate(() => window.independent26.commands.filter((c) => c.id === 1).at(-1)?.kind),
    )
    .toBe("clear");
  expect(await page.evaluate(() => window.independent26.models[1]().time)).toBe(start + 95 * 300);
  expect(
    await page.evaluate(() =>
      window.independent26.charts[0]?.api.timeScale().getVisibleLogicalRange(),
    ),
  ).toEqual(before);
  // Moving only the receiver's viewport back into range reapplies the last time.
  await page.evaluate(() => window.independent26.charts[1]?.api.timeScale().fitContent());
  await expect
    .poll(() => page.evaluate(() => window.independent26.models[1]().time))
    .toBe(start + 1800);
  const chart = page.getByRole("region", { name: "Chart 2", exact: true });
  await chart.getByRole("button", { name: "Retry history" }).click();
  await expect
    .poll(() => page.evaluate(() => window.independent26.fixture.requests.length))
    .toBe(3);
  await page.evaluate(() => {
    const f = window.independent26;
    f.fixture.requests[2].resolve([]);
    // Same-context history is merged, so change assignment for a genuinely empty dataset.
  });
  await chart.getByRole("combobox", { name: "Ticker" }).selectOption("ETHUSDT");
  await expect
    .poll(() => page.evaluate(() => window.independent26.fixture.requests.length))
    .toBe(4);
  await page.evaluate(() => window.independent26.fixture.requests[3].resolve([]));
  await expect(chart.getByRole("status")).toContainText("Empty target");
  await point(page, 0, start + 1860);
  expect(
    await page.evaluate(() => ({
      data: window.independent26.candles[1]?.hasData(),
      range: window.independent26.charts[1]?.api.timeScale().getVisibleRange(),
      model: window.independent26.models[1](),
      command: window.independent26.commands.filter((c) => c.id === 1).at(-1),
    })),
  ).toMatchObject({
    data: false,
    range: null,
    model: { time: null, ohlc: null },
    command: { kind: "clear" },
  });
});

test("legend and control focus, repeated pointer time and programmatic commands cannot become new broadcasts", async ({
  page,
}) => {
  await load(page);
  await point(page, 0, start + 1800);
  const text = `Chart 1 · ${start + 1800} seconds UTC`;
  const commandCount = await page.evaluate(() => window.independent26.commands.length);
  const pointerCount = await page.evaluate(
    () => window.independent26.nativeMoves.filter((e) => e.id === 0 && e.pointer).length,
  );
  await point(page, 0, start + 1800, 135);
  expect(await page.evaluate(() => window.independent26.commands.length)).toBe(commandCount);
  expect(
    await page.evaluate(
      () => window.independent26.nativeMoves.filter((e) => e.id === 0 && e.pointer).length,
    ),
  ).toBeGreaterThan(pointerCount);
  const first = page.getByRole("region", { name: "Chart 1", exact: true });
  await first.getByRole("button", { name: "Indicators (2)" }).click();
  await first.getByRole("button", { name: "Hide Price SMA" }).focus();
  await page.evaluate((time) => {
    const f = window.independent26;
    for (const id of [0, 1]) {
      const series = f.candles[id];
      if (!series) throw new Error("Missing candle controller");
      f.charts[id]?.setCrosshairPosition(
        0,
        time as import("lightweight-charts").UTCTimestamp,
        series,
      );
    }
  }, start + 2400);
  await expect(page.getByLabel("Shared pointer time")).toHaveText(text);
  await point(page, 1, start + 1800);
  await expect(page.getByLabel("Shared pointer time")).toHaveText(
    `Chart 2 · ${start + 1800} seconds UTC`,
  );
  await point(page, 0, start + 1800);
  await expect(page.getByLabel("Shared pointer time")).toHaveText(text);
});

test("assignment, removal and fresh re-add preserve three sibling resources/settings and reject late service work", async ({
  page,
}) => {
  await load(page, true);
  const first = page.getByRole("region", { name: "Chart 1", exact: true });
  const sibling = page.getByRole("region", { name: "Chart 2", exact: true });
  await sibling.getByRole("button", { name: "Indicators (2)" }).click();
  await sibling.getByRole("button", { name: "Hide Price SMA" }).click();
  const saved = await page.evaluateHandle(() => {
    const f = window.independent26;
    return {
      app: f.app,
      first: f.charts[0],
      firstSeries: f.candles[0],
      siblings: [1, 2, 3].map((id) => ({
        id,
        chart: f.charts[id],
        series: f.candles[id],
        native: f.charts[id]?.api,
        panes: f.charts[id]?.api.panes(),
        data: f.candles[id]?.api.data(),
      })),
      oldStream: f.fixture.streams.find((s) => s.market.interval === "1m"),
    };
  });
  await point(page, 0, start + 1800);
  await first.getByRole("combobox", { name: "Ticker" }).selectOption("ETHUSDT");
  await expect(page.getByLabel("Shared pointer time")).toHaveText("No shared pointer time");
  await expect
    .poll(() => page.evaluate(() => window.independent26.fixture.requests.length))
    .toBe(5);
  // Replace a still-pending assignment; both its page and stream must finalize.
  await first.getByRole("combobox", { name: "Timeframe" }).selectOption("15m");
  await expect
    .poll(() => page.evaluate(() => window.independent26.fixture.requests[4].aborted))
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.independent26.fixture.requests.length))
    .toBe(6);
  await page.evaluate(() => {
    const f = window.independent26;
    f.fixture.requests[4].resolve(f.fixtureCandles(f.fixture.requests[4].page));
    f.fixture.requests[5].resolve(f.fixtureCandles(f.fixture.requests[5].page).slice(0, 3));
    for (const stream of f.fixture.streams.filter((s) => s.closed)) {
      stream.emit({
        type: "candle",
        candle: { ...f.fixtureCandles(stream.market)[0], close: 999 },
      });
    }
  });
  await expect(first.getByRole("status")).toContainText("3 candles · latest close 106");
  expect(
    await page.evaluate((old) => {
      const f = window.independent26;
      return {
        sameApp: old.app === f.app,
        retained: old.first === f.charts[0] && old.firstSeries === f.candles[0],
        siblings: old.siblings.every(
          (s) =>
            s.chart === f.charts[s.id] &&
            s.series === f.candles[s.id] &&
            s.native === f.charts[s.id]?.api &&
            s.panes?.every((pane, i) => pane === f.charts[s.id]?.api.panes()[i]) &&
            JSON.stringify(s.data) === JSON.stringify(f.candles[s.id]?.api.data()),
        ),
        oldClosed: old.oldStream?.closed,
      };
    }, saved),
  ).toEqual({ sameApp: true, retained: true, siblings: true, oldClosed: true });
  await expect(sibling.getByRole("button", { name: "Indicators (1)" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(sibling.getByRole("button", { name: "Show Price SMA" })).toBeVisible();
  await first.getByRole("button", { name: "Retry history" }).click();
  await expect
    .poll(() => page.evaluate(() => window.independent26.fixture.requests.length))
    .toBe(7);
  await first.getByRole("button", { name: "Remove chart 1" }).click();
  await expect
    .poll(() => page.evaluate(() => window.independent26.fixture.requests[6].aborted))
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        chart: !!window.independent26.charts[0],
        series: !!window.independent26.candles[0],
      })),
    )
    .toEqual({ chart: false, series: false });
  expect(
    await page.evaluate(
      (old) => ({ chart: old.first?.ready(), series: old.firstSeries?.ready() }),
      saved,
    ),
  ).toEqual({ chart: false, series: false });
  await page.evaluate(() => {
    const f = window.independent26;
    f.fixture.requests[6].resolve(f.fixtureCandles(f.fixture.requests[6].page));
    for (const stream of f.fixture.streams.filter((s) => s.closed))
      stream.emit({
        type: "candle",
        candle: { ...f.fixtureCandles(stream.market)[0], close: 999 },
      });
    const live = f.fixture.streams.find((s) => s.market.interval === "5m" && !s.closed);
    if (!live) throw new Error("Surviving stream is absent");
    live.emit({ type: "candle", candle: { ...f.fixtureCandles(live.market)[95], close: 777 } });
  });
  await expect(sibling.getByRole("status")).toContainText("latest close 777");
  await page.getByRole("button", { name: "Add chart" }).click();
  const fresh = page.getByRole("region", { name: "Chart 5", exact: true });
  await expect
    .poll(() => page.evaluate(() => window.independent26.fixture.requests.length))
    .toBe(8);
  await page.evaluate(() => {
    const f = window.independent26,
      request = f.fixture.requests[7];
    request.resolve(f.fixtureCandles(request.page));
  });
  await expect(fresh.getByRole("status")).toContainText("96 candles");
  await expect(fresh.getByRole("button", { name: "Indicators (2)" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  expect(
    await page.evaluate((old) => {
      const f = window.independent26;
      return (
        f.charts[4]?.ready() &&
        f.candles[4]?.hasData() &&
        f.charts[4] !== old.first &&
        f.candles[4] !== old.firstSeries &&
        f.app === old.app &&
        f.fixture.streams.filter((s) => !s.closed).length === 4
      );
    }, saved),
  ).toBe(true);
  await point(page, 4, start + 1800);
  await expect(page.getByLabel("Shared pointer time")).toHaveText(
    `Chart 5 · ${start + 1800} seconds UTC`,
  );
  await fresh.getByRole("button", { name: "Remove chart 5" }).click();
  await expect(page.getByLabel("Shared pointer time")).toHaveText("No shared pointer time");
  await expect(sibling.getByRole("button", { name: "Show Price SMA" })).toBeVisible();
  await saved.dispose();
});

test("a pending target waits for current data, then joins the last signal; removal releases its references", async ({
  page,
}) => {
  await page.goto("/?independent26");
  await expect
    .poll(() => page.evaluate(() => window.independent26.fixture.requests.length))
    .toBe(2);
  await page.evaluate(() => {
    const f = window.independent26;
    const request = f.fixture.requests.find((r) => r.page.interval === "1m");
    if (!request) throw new Error("Source request is absent");
    request.resolve(f.fixtureCandles(request.page));
  });
  await expect
    .poll(() => page.evaluate(() => window.independent26.candles[0]?.hasData()))
    .toBe(true);
  await page.evaluate(() => window.independent26.charts[0]?.api.timeScale().fitContent());
  await expect
    .poll(() =>
      page.evaluate(
        () => window.independent26.charts[0]?.api.timeScale().getVisibleLogicalRange()?.from,
      ),
    )
    .toBe(0);
  await point(page, 0, start + 1800);
  await expect(page.getByLabel("Shared pointer time")).toHaveText(
    `Chart 1 · ${start + 1800} seconds UTC`,
  );
  expect(
    await page.evaluate(() => ({
      ready: window.independent26.charts[1]?.ready(),
      series: window.independent26.candles[1]?.ready(),
      data: window.independent26.candles[1]?.hasData(),
      range: window.independent26.charts[1]?.api.timeScale().getVisibleRange(),
      commands: window.independent26.commands.filter((c) => c.id === 1 && c.kind === "place"),
    })),
  ).toEqual({ ready: true, series: true, data: false, range: null, commands: [] });
  await page.evaluate(() => {
    const f = window.independent26;
    const request = f.fixture.requests.find((r) => r.page.interval === "5m");
    if (!request) throw new Error("Target request is absent");
    request.resolve(f.fixtureCandles(request.page).slice(0, 20));
  });
  await expect
    .poll(() => page.evaluate(() => window.independent26.models[1]().time))
    .toBe(start + 1800);
  await page.getByRole("button", { name: "Remove chart 2", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => window.independent26.fixture.streams.filter((s) => s.closed).length),
    )
    .toBe(1);
  const removed = await page.evaluate(
    () => window.independent26.commands.filter((c) => c.id === 1).length,
  );
  await page.evaluate(() => {
    const f = window.independent26;
    const stream = f.fixture.streams.find((s) => s.closed);
    if (!stream) throw new Error("Removed stream is absent");
    stream.emit({ type: "candle", candle: { ...f.fixtureCandles(stream.market)[20], close: 999 } });
  });
  await point(page, 0, start + 1860);
  await expect(page.getByLabel("Shared pointer time")).toHaveText(
    `Chart 1 · ${start + 1860} seconds UTC`,
  );
  expect(
    await page.evaluate(() => ({
      chart: window.independent26.charts[1],
      series: window.independent26.candles[1],
      commands: window.independent26.commands.filter((c) => c.id === 1).length,
    })),
  ).toEqual({ chart: undefined, series: undefined, commands: removed });
});
