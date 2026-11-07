import { expect, test } from "@playwright/test";

test("Query/Effect history buffers live corrections, rejects obsolete pages and survives sibling removal", async ({
  page,
}) => {
  await page.goto("/?services21");
  const chart = page.getByRole("region", { name: "Service history" }).first();
  await expect(chart.getByRole("status")).toContainText("Loading history");
  await page.evaluate(() => window.market21.resolve(0, [0, 1]));
  await expect(chart.getByRole("status")).toContainText("2 candles");
  await chart.getByRole("button", { name: "Load older history" }).click();
  await page.evaluate(() => {
    window.market21.tick(0, 1, 999);
    window.market21.resolve(1, [0, 1]);
  });
  await expect(chart.getByRole("status")).toContainText("latest close 999");
  await chart.getByRole("combobox", { name: "Interval" }).selectOption("1M");
  await page.evaluate(() => window.market21.resolve(2, [3, 4]));
  await expect(chart.getByRole("status")).toContainText("latest close 108");
  await page.getByRole("button", { name: "Remove first chart" }).click();
  await page.evaluate(() => window.market21.resolveSibling());
  await expect(
    page.getByRole("region", { name: "Service history" }).getByRole("status"),
  ).toContainText("2 candles");
});

test("service errors retain history, expose retry and reconnect refetches the tail", async ({
  page,
}) => {
  await page.goto("/?services21");
  const chart = page.getByRole("region", { name: "Service history" }).first();
  await page.evaluate(() => window.market21.reject(0));
  await expect(chart.getByRole("alert")).toContainText("Fixture history failed");
  await chart.getByRole("button", { name: "Retry history" }).click();
  await page.evaluate(() => window.market21.resolve(1, []));
  await expect(chart.getByRole("status")).toContainText("No candles");
  await chart.getByRole("button", { name: "Retry history" }).click();
  await page.evaluate(() => window.market21.resolve(2, [0, 1]));
  await chart.getByRole("button", { name: "Load older history" }).click();
  await page.evaluate(() => window.market21.reject(3));
  await expect(chart.getByRole("alert")).toContainText("Displayed history is retained");
  await page.evaluate(() => window.market21.tick(0, 1, 777));
  await expect(chart.getByRole("alert")).toContainText("Fixture history failed");
  await expect(chart.getByRole("status")).toContainText("2 candles");
  await chart.getByRole("button", { name: "Retry history" }).click();
  await page.evaluate(() => window.market21.resolve(4, [0, 1]));
  await expect(chart.getByRole("button", { name: "Retry history" })).toBeEnabled();
  await page.evaluate(() => window.market21.disconnect(0));
  await expect(chart.getByRole("status")).toContainText("disconnected");
  await page.evaluate(() => window.market21.reconnect(0));
  await expect.poll(() => page.evaluate(() => window.market21.requests())).toBe(6);
  await page.evaluate(() => window.market21.resolve(5, [1, 2]));
  await expect(chart.getByRole("status")).toContainText("3 candles");
});

test("dataset changes and unmount abort pending port work and reject obsolete streams", async ({
  page,
}) => {
  await page.goto("/?services21");
  const chart = page.getByRole("region", { name: "Service history" }).first();
  await page.evaluate(() => window.market21.resolve(0, [0, 1]));
  await expect(chart.locator("canvas").first()).toBeVisible();
  await chart.getByRole("button", { name: "Load older history" }).click();
  await expect.poll(() => page.evaluate(() => window.market21.requests())).toBe(2);
  await chart.getByRole("combobox", { name: "Interval" }).selectOption("1M");
  await expect.poll(() => page.evaluate(() => window.market21.requests())).toBe(3);
  await expect
    .poll(() => page.evaluate(() => window.market21.state()))
    .toMatchObject({
      aborted: 1,
      closed: 1,
    });
  await page.evaluate(() => {
    window.market21.resolve(2, [3, 4]);
    window.market21.resolve(1, [0, 1]);
    window.market21.tick(0, 1, 999);
  });
  await expect(chart.getByRole("status")).toContainText("latest close 108");
  await chart.getByRole("button", { name: "Load older history" }).click();
  await expect.poll(() => page.evaluate(() => window.market21.requests())).toBe(4);
  await page.getByRole("button", { name: "Remove first chart" }).click();
  await page.evaluate(() => {
    window.market21.resolve(3, [0, 1]);
    window.market21.tick(1, 4, 999);
    window.market21.resolveSibling();
  });
  const sibling = page.getByRole("region", { name: "Service history" });
  await expect(sibling.getByRole("status")).toContainText("latest close 105");
  await expect(sibling.locator("canvas").first()).toBeVisible();
});

test("manual reconnect replaces an empty pending history request and buffers the new stream", async ({
  page,
}) => {
  await page.goto("/?services21");
  const chart = page.getByRole("region", { name: "Service history" }).first();
  await expect.poll(() => page.evaluate(() => window.market21.requests())).toBe(1);
  await chart.getByRole("button", { name: "Reconnect live" }).click();
  await expect.poll(() => page.evaluate(() => window.market21.requests())).toBe(2);
  await expect
    .poll(() => page.evaluate(() => window.market21.state()))
    .toMatchObject({ aborted: 1, closed: 1 });
  await page.evaluate(() => {
    window.market21.tick(1, 1, 777);
    window.market21.resolve(1, [0, 1]);
    window.market21.resolve(0, [5, 6]);
    window.market21.tick(0, 6, 999);
  });
  await expect(chart.getByRole("status")).toContainText("2 candles · latest close 777");
  await expect(chart.getByRole("button", { name: "Retry history" })).toBeEnabled();
});

test("a correction received immediately on reconnect survives the replacement tail response", async ({
  page,
}) => {
  await page.goto("/?services21");
  const chart = page.getByRole("region", { name: "Service history" }).first();
  await page.evaluate(() => window.market21.resolve(0, [0, 1]));
  await expect(chart.getByRole("status")).toContainText("2 candles");
  await page.evaluate(() => {
    window.market21.disconnect(0);
    window.market21.reconnect(0);
    // The socket can send a correction before Query starts the tail request.
    window.market21.tick(0, 1, 777);
  });
  await expect.poll(() => page.evaluate(() => window.market21.requests())).toBe(2);
  await page.evaluate(() => window.market21.resolve(1, [0, 1]));
  await expect(chart.getByRole("button", { name: "Retry history" })).toBeEnabled();
  await expect(chart.getByRole("status")).toContainText("2 candles · latest close 777");
});

declare global {
  interface Window {
    market21: {
      resolve(request: number, indexes: number[]): void;
      reject(request: number): void;
      tick(stream: number, index: number, close: number): void;
      disconnect(stream: number): void;
      reconnect(stream: number): void;
      requests(): number;
      state(): unknown;
      resolveSibling(): void;
    };
  }
}
