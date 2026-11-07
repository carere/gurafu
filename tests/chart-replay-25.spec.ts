import { expect, type Page, test } from "@playwright/test";

test.use({ timezoneId: "America/Los_Angeles" });
const region = (page: Page) =>
  page.getByRole("region", { name: "Replay and date navigation", exact: true });
async function boot(page: Page) {
  await page.goto("/?replay25");
  await expect.poll(() => page.evaluate(() => window.replay25.requests().length)).toBe(1);
  await page.evaluate(() => window.replay25.resolve(0, [0, 1, 2, 3]));
  await expect(region(page).getByRole("status")).toContainText("4 revealed candles");
}
async function state(page: Page) {
  return page.evaluate(() => window.replay25.state());
}

test("controlled standalone widgets emit requests, retain declined state and respect UTC/bounds/disabled keyboard controls", async ({
  page,
}) => {
  await page.goto("/?replay25");
  const controls = page.getByRole("group", { name: "Declined requests" });
  await controls.getByRole("button", { name: "Play", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(controls.getByRole("button", { name: "Play", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await controls.getByRole("combobox").selectOption("2");
  await expect(controls.getByRole("combobox")).toHaveValue("1");
  const date = controls.getByLabel("UTC date");
  await expect(date).toHaveValue("2026-01-02");
  await date.fill("2026-01-05");
  await date.press("Tab");
  await expect(date).toHaveValue("2026-01-02");
  await controls.getByRole("button", { name: "Step forward" }).click();
  await controls.getByRole("button", { name: "Exit replay" }).click();
  await controls.getByRole("button", { name: "Go to latest" }).click();
  await expect
    .poll(() => page.evaluate(() => window.replay25.events()))
    .toEqual([true, 2, "2026-01-05T00:00:00.000Z", "step", "exit", "latest"]);
  await page.getByRole("button", { name: "Disable standalone controls" }).click();
  await expect(controls.getByRole("button", { name: "Play", exact: true })).toBeDisabled();
  await expect(date).toBeDisabled();
});

test("consumer clock drives coherent revealed candles, volume, calculated/supplied values, rewind, speed and end without live leakage", async ({
  page,
}) => {
  await boot(page);
  const replay = region(page);
  await replay.getByRole("button", { name: "Start replay" }).click();
  await expect.poll(() => page.evaluate(() => window.replay25.streams()[0]?.closed)).toBe(true);
  await page.evaluate(() => window.replay25.live(0, 999));
  await expect(replay.getByRole("status")).toContainText("1 revealed candles · latest close 104");
  await replay.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.replay25.clock().active)).toBe(true);
  await page.evaluate(() => window.replay25.tick());
  await expect(replay.getByRole("status")).toContainText("2 revealed candles");
  await replay.getByRole("button", { name: "Pause", exact: true }).click();
  await page.evaluate(() => window.replay25.tick());
  await expect(replay.getByRole("status")).toContainText("2 revealed candles");
  await replay.getByRole("combobox", { name: "Replay speed" }).selectOption("2");
  await replay.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.replay25.clock().duration)).toBe(500);
  await page.evaluate(() => window.replay25.tick());
  await expect
    .poll(() => state(page))
    .toMatchObject({
      legend: {
        ohlc: { close: 106 },
        volume: { value: 14.5 },
        indicators: [
          { id: "calculated", values: { value: { value: 105 } } },
          { id: "supplied", values: { value: { value: 105 } } },
        ],
      },
    });
  await page.evaluate(() => window.replay25.tick());
  await expect(replay.getByRole("status")).toContainText("End of replay");
  await expect(replay.getByRole("button", { name: "Step forward" })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.replay25.clock().active)).toBe(false);
  await replay.getByRole("button", { name: "Rewind to start" }).click();
  await expect
    .poll(() => state(page))
    .toMatchObject({
      legend: {
        ohlc: { close: 104 },
        volume: { value: 12.5 },
        indicators: [{ values: { value: null } }, { values: { value: null } }],
      },
    });
  await replay.getByRole("button", { name: "Step forward" }).click();
  await expect(replay.getByRole("status")).toContainText("2 revealed candles");
});

test("UTC selection loads matching history before native navigation, rejects superseded seeks and restores coherent live data", async ({
  page,
}) => {
  await boot(page);
  const replay = region(page);
  await page.evaluate(() => {
    const chart = window.replay25;
    chart.recordNavigation();
  });
  const date = replay.getByLabel("UTC date");
  await date.fill("2026-01-02");
  await date.press("Tab");
  await expect.poll(() => page.evaluate(() => window.replay25.requests().length)).toBe(2);
  await expect
    .poll(() => page.evaluate(() => window.replay25.requests()[1].page.from))
    .toBe(1767312000000);
  await expect.poll(() => page.evaluate(() => window.replay25.navigationLog)).toEqual([]);
  await date.fill("2026-01-01");
  await date.press("Tab");
  await expect.poll(() => page.evaluate(() => window.replay25.requests().length)).toBe(3);
  await expect.poll(() => page.evaluate(() => window.replay25.requests()[1].aborted)).toBe(true);
  await page.evaluate(() => {
    window.replay25.resolve(1, [24, 25, 26]);
    window.replay25.resolve(2, [0, 1, 2, 3]);
  });
  await expect
    .poll(() => page.evaluate(() => window.replay25.navigationLog))
    .toEqual([{ time: 1767225600, length: 1 }]);
  await expect(replay.getByRole("status")).toContainText("1 revealed candles");
  await replay.getByRole("button", { name: "Step forward" }).click();
  await expect(replay.getByRole("status")).toContainText("2 revealed candles");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(await page.evaluate(() => window.replay25.navigationLog)).toEqual([
    { time: 1767225600, length: 1 },
  ]);
  await replay.getByRole("button", { name: "Exit replay" }).click();
  await expect.poll(() => page.evaluate(() => window.replay25.requests().length)).toBe(4);
  await page.evaluate(() => {
    window.replay25.live(1, 777);
    window.replay25.resolve(3, [2, 3]);
  });
  await expect(replay.getByRole("status")).toContainText(
    "live · 4 revealed candles · latest close 777",
  );
  await expect
    .poll(() => state(page))
    .toMatchObject({ legend: { ohlc: { close: 777 }, volume: { value: 77 } } });
  const restored = (await page.evaluate(() => window.replay25.state())) as {
    legend: { indicators: { values: { value: { value: number } } }[] };
  };
  for (const indicator of restored.legend.indicators)
    expect(indicator.values.value.value).toBeCloseTo(329.3333333333333, 9);
});

test("partial higher timeframe fixture uses finer observations and excludes later high/volume", async ({
  page,
}) => {
  await boot(page);
  await region(page).getByRole("button", { name: "Show finer-observation fixture" }).click();
  await expect(region(page)).toContainText("completed 00:00 and 00:01 minute observations");
  await expect
    .poll(() => state(page))
    .toMatchObject({
      legend: {
        ohlc: { open: 10, high: 14, low: 9, close: 11 },
        volume: { value: 7 },
        indicators: [{ values: { value: null } }, { values: { value: null } }],
      },
    });
});

test("seek errors/empty results, context changes and removal cancel only owned work and clock", async ({
  page,
}) => {
  await boot(page);
  const replay = region(page);
  const date = replay.getByLabel("UTC date");
  await date.fill("2026-01-02");
  await date.press("Tab");
  await expect.poll(() => page.evaluate(() => window.replay25.requests().length)).toBe(2);
  await page.evaluate(() => window.replay25.reject(1));
  await expect(replay.getByRole("alert")).toContainText("Fixture history failed");
  await date.fill("2026-01-03");
  await date.press("Tab");
  await expect.poll(() => page.evaluate(() => window.replay25.requests().length)).toBe(3);
  await page.evaluate(() => window.replay25.resolve(2, []));
  await expect(replay.getByRole("status")).toContainText("No completed candles");
  await date.fill("2026-01-01");
  await date.press("Tab");
  await expect.poll(() => page.evaluate(() => window.replay25.requests().length)).toBe(4);
  await replay.getByRole("combobox", { name: "Replay interval" }).selectOption("1d");
  await expect.poll(() => page.evaluate(() => window.replay25.requests()[3].aborted)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.replay25.requests().length)).toBe(5);
  await page.evaluate(() => {
    window.replay25.resolve(3, [1, 2]);
    window.replay25.resolve(4, [0, 1, 2, 3]);
  });
  await expect(replay.getByRole("status")).toContainText("live · 4 revealed candles");
  await replay.getByRole("button", { name: "Start replay" }).click();
  await replay.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Remove replay chart" }).click();
  await expect.poll(() => page.evaluate(() => window.replay25.clock().active)).toBe(false);
  await page.evaluate(() => {
    window.replay25.live(0, 999);
    window.replay25.sibling();
  });
  await expect(
    page.getByRole("region", { name: "Service history" }).getByRole("status"),
  ).toContainText("2 candles");
  await expect(
    page.getByRole("region", { name: "Service history" }).locator("canvas").first(),
  ).toBeVisible();
});

declare global {
  interface Window {
    replay25: {
      tick(): void;
      lateTick(index: number): void;
      clock(): { active: boolean; duration: number; stopped: number };
      requests(): { page: { from?: number }; aborted: boolean }[];
      resolve(index: number, indexes: number[], close?: number): void;
      reject(index: number): void;
      live(index: number, close: number): void;
      streams(): { closed: boolean }[];
      state(): unknown;
      sibling(): void;
      liveSibling(): void;
      events(): unknown[];
      recordNavigation(): void;
      navigationLog: unknown[];
    };
  }
}

test("a canceled clock callback cannot advance a paused or restarted replay", async ({ page }) => {
  await boot(page);
  const replay = region(page);
  await replay.getByRole("button", { name: "Start replay" }).click();
  await replay.getByRole("button", { name: "Play", exact: true }).click();
  await replay.getByRole("button", { name: "Pause", exact: true }).click();
  await page.evaluate(() => window.replay25.lateTick(0));
  await expect(replay.getByRole("status")).toContainText("1 revealed candles");
  await replay.getByRole("button", { name: "Play", exact: true }).click();
  await page.evaluate(() => window.replay25.lateTick(0));
  await expect(replay.getByRole("status")).toContainText("1 revealed candles");
  await page.evaluate(() => window.replay25.tick());
  await expect(replay.getByRole("status")).toContainText("2 revealed candles");
});

test("historical replay excludes incomplete bars and removal aborts a pending seek while sibling live input survives", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 850 });
  await page.goto("/?replay25");
  await expect.poll(() => page.evaluate(() => window.replay25.requests().length)).toBe(1);
  await page.evaluate(() => window.replay25.resolve(0, [0, 1, 95]));
  const replay = region(page);
  await expect(replay.getByRole("status")).toContainText("3 revealed candles");
  await expect(replay.getByRole("region", { name: "Replay chart", exact: true })).toHaveCSS(
    "height",
    "384px",
  );
  await replay.getByRole("button", { name: "Start replay" }).click();
  await replay.getByRole("button", { name: "Step forward" }).click();
  await expect(replay.getByRole("status")).toContainText(
    "2 revealed candles · latest close 105 · End of replay",
  );
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  const date = replay.getByLabel("UTC date");
  await date.fill("2026-01-02");
  await date.press("Tab");
  await expect.poll(() => page.evaluate(() => window.replay25.requests().length)).toBe(2);
  await expect(replay.getByRole("button", { name: "Step forward" })).toBeDisabled();
  await page.getByRole("button", { name: "Remove replay chart" }).click();
  await expect.poll(() => page.evaluate(() => window.replay25.requests()[1].aborted)).toBe(true);
  await page.evaluate(() => {
    window.replay25.resolve(1, [24, 25]);
    window.replay25.live(0, 999);
    window.replay25.sibling();
  });
  const sibling = page.getByRole("region", { name: "Service history" });
  await expect(sibling.getByRole("status")).toContainText("latest close 105");
  await page.evaluate(() => window.replay25.liveSibling());
  await expect(sibling.getByRole("status")).toContainText("latest close 888");
  await expect
    .poll(() => page.evaluate(() => window.replay25.state()))
    .toMatchObject({ ready: false });
});
