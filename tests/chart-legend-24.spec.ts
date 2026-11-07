import { expect, test } from "@playwright/test";

test("legend reads exact displayed time, zero and optional volume; requests keep authority", async ({
  page,
}) => {
  await page.goto("/?legend24");
  await page.waitForFunction(() => window.legend24?.chart.ready());
  const model = () => page.evaluate(() => window.legend24.model());
  expect(await model()).toMatchObject({
    time: "2026-01-03",
    ohlc: { open: 3, close: 1 },
    volume: null,
    count: 1,
  });
  await page.evaluate(() => {
    const f = window.legend24;
    f.chart.setCrosshairPosition(0, "2026-01-02", f.price);
  });
  expect(await model()).toMatchObject({
    time: "2026-01-02",
    ohlc: { close: 0 },
    volume: { value: 0, color: "#abcdef" },
  });
  await expect(page.getByLabel("Controlled legend")).toContainText("C 0");
  expect(await page.evaluate(() => window.legend24.moves())).toBe(0);
  await page.getByRole("button", { name: "Indicators (1)" }).first().click();
  await expect(
    page.getByLabel("Controlled legend").getByRole("button", { name: "Hide Bollinger Bands" }),
  ).toHaveCount(0);
  await page.evaluate(() => window.legend24.setExpanded(true));
  await page.getByRole("button", { name: "Hide Bollinger Bands" }).click();
  expect((await model()).count).toBe(1);
  await page.evaluate(() => window.legend24.setVisible(false));
  expect((await model()).count).toBe(0);
  await expect(page.getByRole("button", { name: "Show Bollinger Bands" })).toHaveCount(1);
});

test("missing/whitespace/future values never borrow, removal and context reset to displayed data", async ({
  page,
}) => {
  await page.goto("/?legend24");
  await page.waitForFunction(() => window.legend24?.chart.ready());
  const read = () => page.evaluate(() => window.legend24.model());
  await page.evaluate(() => {
    const f = window.legend24;
    f.chart.setCrosshairPosition(0, "2026-01-04", f.price);
  });
  expect(await read()).toMatchObject({ time: "2026-01-04", ohlc: null, volume: null });
  expect((await read()).indicators[0].values).toEqual({ middle: null, upper: null, lower: null });
  await page.evaluate(() => {
    const f = window.legend24;
    f.chart.setCrosshairPosition(0, "2026-01-02", f.price);
    f.price.setData([f.price.api.data()[0], f.price.api.data()[2]]);
  });
  expect(await read()).toMatchObject({ time: "2026-01-03", ohlc: { close: 1 } });
  await page.evaluate(() => {
    const f = window.legend24;
    f.price.setData([
      { time: "2026-01-01", open: 0, high: 0, low: 0, close: 0 },
      { time: "2026-01-02" },
    ]);
    f.chart.setCrosshairPosition(0, "2026-01-02", f.price);
  });
  expect(await read()).toMatchObject({ time: "2026-01-02", ohlc: null, volume: { value: 0 } });
  expect((await read()).indicators[0].values.middle).toBeNull();
  await page.evaluate(() => {
    const f = window.legend24;
    f.price.setData([{ time: "2026-01-01", open: 0, high: 0, low: 0, close: 0 }]);
  });
  expect(await read()).toMatchObject({ time: "2026-01-01", ohlc: { close: 0 }, volume: null });
  await page.evaluate(() => window.legend24.setKey(1));
  expect(await read()).toMatchObject({ time: "2026-01-03", ohlc: { close: 1 } });
  await page.evaluate(() => window.legend24.price.setData([]));
  expect(await read()).toMatchObject({ time: null, ohlc: null, volume: null });
});

test("hidden rows, independent defaults and standalone request-only selection never provision series", async ({
  page,
}) => {
  await page.goto("/?legend24");
  await page.waitForFunction(() => window.legend24?.chart.ready());
  await page.getByLabel("Default legend").getByRole("button", { name: "Indicators (1)" }).click();
  await expect(
    page.getByLabel("Default legend").getByRole("button", { name: "Show Price SMA" }),
  ).toBeVisible();
  await page.getByLabel("Default legend").getByRole("button", { name: "Show Price SMA" }).click();
  expect(await page.evaluate(() => window.legend24.model().count)).toBe(2);
  await page.getByLabel("Default legend").getByRole("button", { name: "Hide Price SMA" }).focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByLabel("Default legend").getByRole("button", { name: "Show Price SMA" }),
  ).toBeFocused();
  await page.keyboard.press("Space");
  expect(await page.evaluate(() => window.legend24.model().count)).toBe(2);
  await expect(page.getByLabel("Sibling legend").getByRole("button")).toHaveText("Indicators (1)");
  await page.getByLabel("Standalone", { exact: true }).getByRole("button", { name: "EMA" }).click();
  await expect(
    page.getByLabel("Standalone", { exact: true }).getByRole("button", { name: "EMA" }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.evaluate(() => window.legend24.setChoices(["ema"]));
  await expect(
    page.getByLabel("Standalone", { exact: true }).getByRole("button", { name: "EMA" }),
  ).toHaveAttribute("aria-pressed", "true");
  const select = page.getByLabel("Uncontrolled selection").getByRole("button", { name: "SMA" });
  await select.focus();
  await page.keyboard.press("Space");
  await expect(select).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => window.legend24.setIndicator(false));
  await expect(page.getByRole("button", { name: "Hide Bollinger Bands" })).toHaveCount(0);
  expect(
    await page.evaluate(() => {
      try {
        window.legend24.chart.requestIndicatorVisibility("bands", true);
        return "";
      } catch (e) {
        return String(e);
      }
    }),
  ).toContain("Unknown or removed indicator");
  expect(
    await page.evaluate(() =>
      window.legend24.chart.api
        .panes()[0]
        .getSeries()
        .map((s) => s.options().title),
    ),
  ).not.toContain("EMA");
});

test("native hover/leave and local commands preserve exact time, incoming Bands direction and ownership", async ({
  page,
}) => {
  await page.goto("/?legend24");
  await page.waitForFunction(() => window.legend24?.chart.ready());
  const result = await page.evaluate(() => {
    const f = window.legend24;
    const readings = [];
    for (const time of ["2026-01-01", "2026-01-02", "2026-01-03"]) {
      f.chart.setCrosshairPosition(0, time, f.price);
      readings.push(f.model());
    }
    return readings;
  });
  expect(result[0].indicators[0].values.upper?.color).toBe("#2196F3");
  expect(result[1].indicators[0].values.upper?.color).toBe("#F55253");
  expect(result[2].indicators[0].values.upper?.color).toBe("#2196F3");
  expect(result[1].ohlc?.color).toBe("#123456"); // Native doji uses upColor.
  expect(
    await page.evaluate(() => {
      const f = window.legend24;
      try {
        f.chart.setCrosshairPosition(1, "2026-01-01", f.other);
        return "";
      } catch (e) {
        return String(e);
      }
    }),
  ).toContain("owned by this chart");
  await page.evaluate(() => {
    const f = window.legend24;
    f.chart.clearCrosshairPosition();
    f.chart.api.timeScale().fitContent();
  });
  await page.waitForTimeout(80);
  const x = await page.evaluate(() =>
    window.legend24.chart.api.timeScale().timeToCoordinate("2026-01-01"),
  );
  const surface = page.locator(".tv-lightweight-charts").first();
  const bounds = await surface.boundingBox();
  if (x === null || !bounds) throw new Error("Missing native surface");
  await page.mouse.move(bounds.x + x, bounds.y + 190);
  await expect.poll(() => page.evaluate(() => window.legend24.model().time)).toBe("2026-01-01");
  expect(await page.evaluate(() => window.legend24.moves())).toBeGreaterThan(0);
  await page.mouse.move(bounds.x + bounds.width + 10, bounds.y + 190);
  await expect.poll(() => page.evaluate(() => window.legend24.model().time)).toBe("2026-01-03");
  await page.getByLabel("Default legend").getByRole("button").click();
  const before = await page.evaluate(() => window.legend24.focus());
  await page.getByLabel("Default legend").getByRole("button", { name: "Show Price SMA" }).focus();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => window.legend24.focus())).toBe(before);
  await page.evaluate(() => window.legend24.setMounted(false));
  expect(
    await page.evaluate(() => {
      const f = window.legend24;
      try {
        f.chart.clearCrosshairPosition();
        return "";
      } catch (e) {
        return String(e);
      }
    }),
  ).toContain("disposed");
});

test("live partials and replay prefixes expose only displayed data; Bands flats and gaps use incoming raw direction", async ({
  page,
}) => {
  await page.goto("/?legend24");
  await page.waitForFunction(() => window.legend24?.chart.ready());
  await page.evaluate(() => {
    const f = window.legend24;
    const rows = f.price.api.data();
    f.chart.setCrosshairPosition(1, "2026-01-03", f.price);
    f.price.setData(rows.slice(0, 2));
  });
  expect(await page.evaluate(() => window.legend24.model())).toMatchObject({
    time: "2026-01-02",
    ohlc: { close: 0 },
  });
  await page.evaluate(() =>
    window.legend24.price.update({ time: "2026-01-02", open: 0, high: 9, low: -1, close: 9 }),
  );
  expect(await page.evaluate(() => window.legend24.model())).toMatchObject({
    ohlc: { close: 9 },
    indicators: [{ values: { upper: { value: 9 } } }, { values: { value: { value: 9 } } }],
  });
  const colors = await page.evaluate(() => {
    const f = window.legend24;
    f.price.setData(
      [3, 2, 2, null, 4, 3].map((close, i) =>
        close === null
          ? { time: `2026-01-0${i + 1}` }
          : { time: `2026-01-0${i + 1}`, open: close, close, high: close, low: close },
      ),
    );
    f.price.api.priceScale().applyOptions({ invertScale: true });
    return [1, 2, 3, 4, 5, 6].map((i) => {
      f.chart.setCrosshairPosition(0, `2026-01-0${i}`, f.price);
      return f.model().indicators[0].values.upper;
    });
  });
  expect(colors).toEqual([
    { value: 3, color: "#2196F3" },
    { value: 2, color: "#F55253" },
    { value: 2, color: "#F55253" },
    null,
    { value: 4, color: "#2196F3" },
    { value: 3, color: "#F55253" },
  ]);
});

test("calendar read models detach selected time from both private selection and consumer rows", async ({
  page,
}) => {
  await page.goto("/?legend24");
  await page.waitForFunction(() => window.legend24?.chart.ready());
  const result = await page.evaluate(() => {
    const f = window.legend24;
    const time = { year: 2026, month: 2, day: 1 };
    f.price.setData([{ time, open: 0, high: 0, low: 0, close: 0 }]);
    f.chart.setCrosshairPosition(0, time, f.price);
    const view = f.model();
    Object.assign(view.time as object, { year: 2030 });
    f.chart.requestIndicatorVisibility("sma", true);
    return { time: f.model().time, source: time };
  });
  expect(result).toEqual({
    time: { year: 2026, month: 2, day: 1 },
    source: { year: 2026, month: 2, day: 1 },
  });
});

test("localized formatting and custom render hooks retain exact values and request authority", async ({
  page,
}) => {
  await page.goto("/?legend24&custom");
  await page.waitForFunction(() => window.legend24?.chart.ready());
  await page.evaluate(() => {
    const f = window.legend24;
    f.chart.setCrosshairPosition(0, "2026-01-02", f.price);
    f.setExpanded(true);
  });
  await expect(page.getByLabel("Custom OHLC")).toHaveText("0");
  await expect(page.getByLabel("Default legend")).toContainText("Ouverture zero");
  await expect(page.getByLabel("Default legend").getByRole("button")).toHaveText("Analyses (1)");
  await page.getByLabel("Controlled legend").getByRole("button", { name: "Toggle bands" }).click();
  expect(await page.evaluate(() => window.legend24.requests)).toEqual([false]);
  expect(await page.evaluate(() => window.legend24.model().count)).toBe(1);
});

test("readable example starts with authoritative parameters and consumer selection owns mounting", async ({
  page,
}) => {
  await page.goto("/?indicators-example22");
  await expect(page.getByRole("button", { name: "Indicators (4)" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Bands period" })).toHaveValue("18");
  await expect(page.getByRole("combobox", { name: "SMA period" })).toHaveValue("20");
  await expect(page.getByRole("combobox", { name: "EMA period" })).toHaveValue("20");
  await expect(page.getByRole("combobox", { name: "RSI period" })).toHaveValue("14");
  await expect(page.getByRole("combobox", { name: "Price input" })).toHaveValue("close");
  await page
    .getByRole("group", { name: "Mounted indicators" })
    .getByRole("button", { name: "Price EMA" })
    .click();
  await expect(page.getByRole("button", { name: "Indicators (3)" })).toBeVisible();
  await page.getByRole("button", { name: "Indicators (3)" }).click();
  await expect(page.getByRole("button", { name: "Hide Price EMA" })).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: "Inspect this chart with Redux DevTools (remounts the chart)" })
    .check();
  await expect(page.getByRole("button", { name: "Indicators (3)" })).toBeVisible();
});
