import { expect, test } from "@playwright/test";
import type { ProtocolConnection24 } from "./legend-contract-24";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const connections: ProtocolConnection24[] = [];
    Object.assign(window, {
      protocol24: connections,
      __REDUX_DEVTOOLS_EXTENSION__: {
        connect(options: ProtocolConnection24["options"]) {
          const c: ProtocolConnection24 = {
            options,
            inits: [],
            sent: [],
            closed: 0,
            removed: 0,
            listener: () => {},
            init(s: Parameters<ProtocolConnection24["init"]>[0]) {
              c.inits.push(s);
            },
            send(e: unknown, s: Parameters<ProtocolConnection24["send"]>[1]) {
              c.sent.push({ event: e, state: s });
            },
            subscribe(fn: ProtocolConnection24["listener"]) {
              c.listener = fn;
              return () => c.removed++;
            },
            unsubscribe() {
              c.closed++;
            },
          };
          connections.push(c);
          return c;
        },
        disconnect() {
          throw new Error("Global disconnect would break siblings");
        },
      },
    });
  });
});
test("off by default, identical names get unique connections, restore honors authority and cleanup isolates owners", async ({
  page,
}) => {
  await page.goto("/?legend24");
  await page.waitForFunction(() => window.legend24?.chart.ready());
  expect(await page.evaluate(() => window.protocol24.length)).toBe(0);
  await page.goto("/?legend24&debug");
  await page.waitForFunction(() => window.legend24?.chart.ready());
  const options = await page.evaluate(() => window.protocol24.map((c) => c.options));
  expect(options.map((o) => o.name)).toEqual(["Application", "Repeated", "Repeated"]);
  expect(new Set(options.map((o) => o.instanceId)).size).toBe(3);
  const baseline = await page.evaluate(() => window.protocol24[1].inits[0]);
  expect(baseline).toEqual({
    pointer: { time: null, seriesId: null, hadPoint: false },
    indicatorVisibility: {},
    legendExpansion: {},
  });
  await page.getByLabel("Default legend").getByRole("button").click();
  await page.evaluate(() => {
    const f = window.legend24;
    f.chart.requestIndicatorVisibility("sma", true);
    f.chart.setCrosshairPosition(0, "2026-01-02", f.price);
  });
  expect(await page.evaluate(() => window.protocol24[1].inits[0])).toEqual(baseline);
  const captured = await page.evaluate(() => {
    const last = window.protocol24[1].sent.at(-1);
    if (!last) throw new Error("Missing extension snapshot");
    return last.state;
  });
  expect(Object.keys(captured).sort()).toEqual([
    "indicatorVisibility",
    "legendExpansion",
    "pointer",
  ]);
  await page.evaluate(() => {
    const c = window.protocol24[1];
    const last = c.sent.at(-1);
    if (!last) throw new Error("Missing extension snapshot");
    const state = last.state;
    c.listener({
      type: "DISPATCH",
      payload: { type: "JUMP_TO_STATE" },
      state: JSON.stringify({
        ...state,
        pointer: { ...state.pointer, time: "2026-01-01" },
        indicatorVisibility: { bands: false, sma: true },
        legendExpansion: Object.fromEntries(
          Object.keys(state.legendExpansion).map((k) => [k, true]),
        ),
      }),
    });
  });
  expect(await page.evaluate(() => window.legend24.model())).toMatchObject({
    time: "2026-01-01",
    count: 2,
  });
  await expect(page.getByLabel("Controlled legend").getByRole("button").first()).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(page.getByLabel("Default legend").getByRole("button").first()).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(
    await page.evaluate(
      () =>
        window.legend24.chart.api
          .panes()[0]
          .getSeries()
          .find((s) => s.data().some((r) => "value" in r && r.value === 2))
          ?.options().visible,
    ),
  ).toBe(true);
  await page.evaluate(() => window.legend24.setDefaults(true));
  // Reset is detached and repeatable; private defaults return, controlled values stay applied.
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => {
      const c = window.protocol24[1];
      c.listener({ type: "DISPATCH", payload: { type: "RESET" } });
    });
    expect(await page.evaluate(() => window.legend24.model())).toMatchObject({
      time: "2026-01-03",
      count: 1,
    });
    await expect(page.getByLabel("Default legend").getByRole("button").first()).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await page.evaluate(() => window.legend24.chart.requestIndicatorVisibility("sma", true));
  }
  expect(await page.evaluate(() => window.protocol24[1].inits[0])).toEqual(baseline);
  await page.evaluate(() => window.legend24.setMounted(false));
  const before = await page.evaluate(() => {
    const c = window.protocol24[1];
    return { sent: c.sent.length, closed: c.closed, removed: c.removed };
  });
  expect(before.closed).toBe(1);
  expect(before.removed).toBe(1);
  await page.evaluate(() => {
    const w = window;
    w.protocol24[1].listener({ type: "DISPATCH", payload: { type: "RESET" } });
    w.protocol24[1].listener({
      type: "ACTION",
      payload: '{"type":"chart/indicatorVisibility","payload":{"id":"sma","visible":false}}',
    });
    w.legend24.appIncrement();
    w.legend24.sibling.requestIndicatorVisibility("sma", false);
  });
  expect(await page.evaluate(() => window.protocol24[1].sent.length)).toBe(before.sent);
  expect(await page.evaluate(() => window.protocol24.map((c) => c.closed))).toEqual([0, 1, 0]);
  expect(await page.evaluate(() => window.protocol24[0].sent.at(-1)?.state.app.value)).toBe(1);
  await page.evaluate(() => {
    window.legend24.setDefaults(false);
    window.legend24.setMounted(true);
  });
  await page.waitForFunction(() => window.protocol24.length === 4 && window.legend24.chart.ready());
  expect(await page.evaluate(() => window.protocol24[3].options.instanceId)).not.toBe(
    options[1].instanceId,
  );
  expect(await page.evaluate(() => window.legend24.model().count)).toBe(1);
  await page.evaluate(() => {
    const f = window.legend24;
    f.dispose();
    f.appDispose();
  });
  expect(await page.evaluate(() => window.protocol24.map((c) => [c.closed, c.removed]))).toEqual([
    [1, 1],
    [1, 1],
    [1, 1],
    [1, 1],
  ]);
});
