import { expect, test } from "bun:test";
import {
  calculateBollingerBands,
  calculateSMA,
} from "../src/registry/kobalte/chart/indicator-calculations";

const prices = [1, 2, 3, 4].map((value, index) => ({ time: `2026-01-0${index + 1}`, value }));
const near = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
    1e-10 + 1e-10 * Math.max(Math.abs(actual), Math.abs(expected)),
  );
test("N=3 hand-worked population bands include the complete first variance window", () => {
  const rows = calculateBollingerBands(prices, { period: 3 });
  expect(rows.slice(0, 2)).toEqual([{ time: "2026-01-01" }, { time: "2026-01-02" }]);
  const first = rows[2];
  if (first.middle === undefined) throw new Error("Missing full window");
  expect(first.middle).toBe(2);
  near(first.upper, 3.632993161855452);
  near(first.lower, 0.36700683814454793);
  const next = rows[3];
  if (next.middle === undefined) throw new Error("Missing next window");
  expect(next.middle).toBe(3);
  near(next.upper, 4.632993161855452);
  near(next.lower, 1.367006838144548);
  expect(calculateSMA(prices, { period: 3 })).toEqual([
    { time: "2026-01-01" },
    { time: "2026-01-02" },
    { time: "2026-01-03", value: 2 },
    { time: "2026-01-04", value: 3 },
  ]);
});

test("defaults warm up at Bands 18/2 and price SMA 20; short/empty runs stay unavailable", () => {
  const constant = Array.from({ length: 20 }, (_, i) => ({ time: `day-${i}`, value: 5 }));
  expect(calculateSMA([])).toEqual([]);
  expect(calculateBollingerBands([])).toEqual([]);
  expect(calculateSMA(constant).filter((r) => "value" in r)).toEqual([
    { time: "day-19", value: 5 },
  ]);
  expect(calculateBollingerBands(constant).filter((r) => "middle" in r)).toEqual([
    { time: "day-17", middle: 5, lower: 5, upper: 5 },
    { time: "day-18", middle: 5, lower: 5, upper: 5 },
    { time: "day-19", middle: 5, lower: 5, upper: 5 },
  ]);
  expect(calculateBollingerBands(prices).every((r) => !("middle" in r))).toBe(true);
});

test("zero, constant, cross-zero and multiplier zero are populated without truthiness gates", () => {
  const input = [-1, 0, 1, 0, 0, 0].map((value, i) => ({ time: `${i}`, value }));
  const bands = calculateBollingerBands(input, { period: 3 });
  expect(bands[2]).toEqual({
    time: "2",
    middle: 0,
    lower: -1.632993161855452,
    upper: 1.632993161855452,
  });
  expect(bands[5]).toEqual({ time: "5", middle: 0, lower: 0, upper: 0 });
  expect(calculateBollingerBands(input, { period: 1 })).toEqual([
    { time: "0", middle: -1, upper: -1, lower: -1 },
    { time: "1", middle: 0, upper: 0, lower: 0 },
    { time: "2", middle: 1, upper: 1, lower: 1 },
    { time: "3", middle: 0, upper: 0, lower: 0 },
    { time: "4", middle: 0, upper: 0, lower: 0 },
    { time: "5", middle: 0, upper: 0, lower: 0 },
  ]);
  expect(calculateSMA(input, { period: 3 })[2]).toEqual({ time: "2", value: 0 });
  expect(calculateBollingerBands(input, { period: 3, multiplier: 0 })[3]).toEqual({
    time: "3",
    middle: 0.3333333333333333,
    lower: 0.3333333333333333,
    upper: 0.3333333333333333,
  });
});

test("OHLC selectors and single-value input preserve caller-owned business-day and UTC time", () => {
  const time = Object.freeze({ year: 2026, month: 1, day: 1 });
  const input = Object.freeze([Object.freeze({ time, open: 2, high: 10, low: -2, close: 4 })]);
  const expected = { open: 2, high: 10, low: -2, close: 4, hl2: 4, hlc3: 4, ohlc4: 3.5 };
  for (const [priceInput, value] of Object.entries(expected)) {
    expect(
      calculateSMA(input, { period: 1, priceInput: priceInput as keyof typeof expected }),
    ).toEqual([{ time, value }]);
    expect(
      calculateBollingerBands(input, {
        period: 1,
        priceInput: priceInput as keyof typeof expected,
      }),
    ).toEqual([{ time, middle: value, upper: value, lower: value }]);
    expect(
      calculateSMA([{ time, value: 0 }], {
        period: 1,
        priceInput: priceInput as keyof typeof expected,
      }),
    ).toEqual([{ time, value: 0 }]);
  }
  expect(calculateSMA(input, { period: 1 })).toEqual([{ time, value: 4 }]);
  expect(input[0]).toEqual({ time, open: 2, high: 10, low: -2, close: 4 });
});

test("timestamp gaps continue the window; explicit whitespace restarts full warmup", () => {
  const rows = [
    { time: "2026-01-01", value: 1 },
    { time: "2026-05-01", value: 2 },
    { time: "2026-09-01", value: 3 },
    { time: "2026-09-02" },
    { time: "2026-09-03", value: 7 },
    { time: "2026-09-04", value: 8 },
    { time: "2026-09-05", value: 9 },
  ];
  expect(calculateSMA(rows, { period: 3 })).toEqual([
    { time: "2026-01-01" },
    { time: "2026-05-01" },
    { time: "2026-09-01", value: 2 },
    { time: "2026-09-02" },
    { time: "2026-09-03" },
    { time: "2026-09-04" },
    { time: "2026-09-05", value: 8 },
  ]);
  expect(calculateBollingerBands(rows, { period: 3 })[4]).toEqual({ time: "2026-09-03" });
});

test("large baselines retain small-spread population variance without cancellation", () => {
  const rows = [1000000000000, 1000000000001, 1000000000002, 1000000000003].map((value, i) => ({
    time: `${i}`,
    value,
  }));
  const bands = calculateBollingerBands(rows, { period: 3 });
  for (const [index, middle] of [
    [2, 1000000000001],
    [3, 1000000000002],
  ]) {
    const result = bands[index];
    if (result.middle === undefined) throw new Error("Missing result");
    expect(result.middle).toBe(middle);
    // Absolute spread checks also catch cancellation hidden by relative baseline tolerance.
    near(result.upper - middle, 1.6329345703125);
    near(middle - result.lower, 1.6329345703125);
  }
});
