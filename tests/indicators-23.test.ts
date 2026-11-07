import { expect, test } from "bun:test";
import type { BusinessDay } from "lightweight-charts";
import { calculateEMA, calculateRSI } from "../src/registry/kobalte/chart/indicator-calculations";

test("N=3 EMA seeds from the full first SMA and then smooths", () => {
  const rows = [1, 2, 3, 4].map((value, i) => ({ time: `2026-01-0${i + 1}`, value }));
  expect(calculateEMA(rows, { period: 3 })).toEqual([
    { time: "2026-01-01" },
    { time: "2026-01-02" },
    { time: "2026-01-03", value: 2 },
    { time: "2026-01-04", value: 3 },
  ]);
});

const near = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
    1e-10 + 1e-10 * Math.max(Math.abs(actual), Math.abs(expected)),
  );
test("N=3 RSI seeds the first three changes and applies Wilder smoothing", () => {
  const rows = [1, 2, 1, 2, 3].map((value, i) => ({ time: `day-${i}`, value }));
  const result = calculateRSI(rows, { period: 3 });
  expect(result.slice(0, 3)).toEqual([{ time: "day-0" }, { time: "day-1" }, { time: "day-2" }]);
  expect(result.map((r) => r.time)).toEqual(rows.map((r) => r.time));
  for (const [i, value] of [
    [3, 200 / 3],
    [4, 700 / 9],
  ]) {
    const row = result[i];
    if (!("value" in row)) throw new Error("Missing complete RSI window");
    near(row.value, value);
  }
});

test("default periods, empty and short inputs have exact availability; period one retains zero", () => {
  const rows = Array.from({ length: 21 }, (_, i) => ({ time: `day-${i}`, value: 0 }));
  expect(calculateEMA([])).toEqual([]);
  expect(calculateRSI([])).toEqual([]);
  expect(calculateEMA(rows.slice(0, 19)).every((r) => !("value" in r))).toBe(true);
  expect(calculateRSI(rows.slice(0, 14)).every((r) => !("value" in r))).toBe(true);
  expect(calculateEMA(rows).filter((r) => "value" in r)).toEqual([
    { time: "day-19", value: 0 },
    { time: "day-20", value: 0 },
  ]);
  expect(calculateRSI(rows).filter((r) => "value" in r)).toEqual(
    rows.slice(14).map((r) => ({ time: r.time, value: 50 })),
  );
  expect(calculateEMA(rows.slice(0, 2), { period: 1 })).toEqual(rows.slice(0, 2));
  expect(calculateRSI(rows.slice(0, 2), { period: 1 })).toEqual([
    { time: "day-0" },
    { time: "day-1", value: 50 },
  ]);
});

test("RSI exact flat, rising, falling and tiny changes use no epsilon gate", () => {
  for (const [values, expected] of [
    [[0, 0, 0, 0, 0], 50],
    [[0, 1, 2, 3, 4], 100],
    [[0, -1, -2, -3, -4], 0],
    [[0, 1e-20, 2e-20, 3e-20, 4e-20], 100],
  ] as const) {
    const rows = values.map((value, i) => ({ time: `day-${i}`, value }));
    expect(calculateRSI(rows, { period: 3 }).slice(3)).toEqual([
      { time: "day-3", value: expected },
      { time: "day-4", value: expected },
    ]);
  }
  expect(
    calculateRSI(
      [1, 2, 1, 1].map((value, i) => ({ time: `${i}`, value })),
      { period: 1 },
    ),
  ).toEqual([
    { time: "0" },
    { time: "1", value: 100 },
    { time: "2", value: 0 },
    { time: "3", value: 50 },
  ]);
});

test("gaps preserve observations; whitespace restarts EMA seed and RSI preceding price", () => {
  const rows = [1, 2, 1, 2, null, 50, 51, 50, 51, 52].map((value, i) =>
    value === null
      ? { time: `2026-${String(i + 1).padStart(2, "0")}-01` }
      : { time: `2026-${String(i + 1).padStart(2, "0")}-01`, value },
  );
  const ema = calculateEMA(rows, { period: 3 });
  expect(ema.slice(0, 3)).toEqual([
    { time: rows[0].time },
    { time: rows[1].time },
    { time: rows[2].time, value: 4 / 3 },
  ]);
  expect(ema.slice(4, 7)).toEqual(rows.slice(4, 7).map((r) => ({ time: r.time })));
  near("value" in ema[7] ? ema[7].value : NaN, 151 / 3);
  const rsi = calculateRSI(rows, { period: 3 });
  expect(rsi.slice(4, 8)).toEqual(rows.slice(4, 8).map((r) => ({ time: r.time })));
  near("value" in rsi[8] ? rsi[8].value : NaN, 200 / 3);
  near("value" in rsi[9] ? rsi[9].value : NaN, 700 / 9);
});

test("all OHLC selectors and direct values preserve immutable inputs, parameters and native time", () => {
  const time: BusinessDay = Object.freeze({ year: 2026, month: 1, day: 1 });
  const nextTime: BusinessDay = Object.freeze({ year: 2026, month: 1, day: 2 });
  const input = Object.freeze([
    Object.freeze({ time, open: 2, high: 10, low: -2, close: 4 }),
    Object.freeze({ time: nextTime, open: 4, high: 8, low: 0, close: 2 }),
  ]);
  const selectors = {
    open: [2, 100],
    high: [10, 0],
    low: [-2, 100],
    close: [4, 0],
    hl2: [4, 50],
    hlc3: [4, 0],
    ohlc4: [3.5, 50],
  };
  for (const [priceInput, [first, rsi]] of Object.entries(selectors)) {
    const parameters = Object.freeze({
      period: 1,
      priceInput: priceInput as keyof typeof selectors,
    });
    expect(calculateEMA(input, parameters)[0]).toEqual({ time, value: first });
    expect(calculateRSI(input, parameters)).toEqual([{ time }, { time: nextTime, value: rsi }]);
    const direct = Object.freeze([
      Object.freeze({ time, value: 0 }),
      Object.freeze({ time: nextTime, value: 0 }),
    ]);
    expect(calculateEMA(direct, parameters)).toEqual([...direct]);
    expect(calculateRSI(direct, parameters)).toEqual([{ time }, { time: nextTime, value: 50 }]);
  }
  expect(calculateEMA(input, { period: 1 })[0]).toEqual({ time, value: 4 });
  expect(input[0]).toEqual({ time, open: 2, high: 10, low: -2, close: 4 });
  expect(calculateEMA(input, { period: 1 })[0].time).toBe(time);
});
