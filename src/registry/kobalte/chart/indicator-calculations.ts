import type { Time } from "lightweight-charts";

export type PriceInput = "open" | "high" | "low" | "close" | "hl2" | "hlc3" | "ohlc4";
export type SMAParameters = { period?: number; priceInput?: PriceInput };
export type BollingerBandsParameters = SMAParameters & { multiplier?: number };
export type IndicatorValue<T extends Time = Time> = { time: T; value: number } | { time: T };
export type BollingerBandsValue<T extends Time = Time> =
  | { time: T; middle: number; upper: number; lower: number }
  | { time: T; middle?: never; upper?: never; lower?: never };
export type PriceRow<T extends Time = Time> =
  | { time: T; open: number; high: number; low: number; close: number }
  | IndicatorValue<T>;

// Adapted from Ashiso's CircularBuffer/SmallMovingAverage at 1b716f85.
// Retain the bounded ring and full-window gate, but calculate both moments from
// the SAME populated window (including its first N observations and zero mean).
// No public continuation state: each call owns a fresh, disposable calculation.
class PriceWindow {
  private values: number[];
  private pointer = 0;
  private count = 0;
  constructor(private period: number) {
    this.values = new Array(period);
  }
  push(value: number) {
    this.values[this.pointer] = value;
    this.pointer = (this.pointer + 1) % this.period;
    this.count++;
    if (this.count < this.period) return;
    const origin = this.values[0];
    const offset = sum(this.values.map((v) => v - origin)) / this.period;
    return {
      mean: origin + offset,
      // Center BEFORE squaring; E[x²] - E[x]² loses small spreads at large baselines.
      variance: sum(this.values.map((v) => (v - origin - offset) ** 2)) / this.period,
    };
  }
}
function sum(values: readonly number[]) {
  let total = 0;
  let correction = 0;
  for (const value of values) {
    const adjusted = value - correction;
    const next = total + adjusted;
    correction = next - total - adjusted;
    total = next;
  }
  return total;
}
function price(row: PriceRow, input: PriceInput): number | undefined {
  if ("value" in row) return row.value;
  if (!("close" in row)) return;
  switch (input) {
    case "hl2":
      return row.high / 2 + row.low / 2;
    case "hlc3":
      return row.high / 3 + row.low / 3 + row.close / 3;
    case "ohlc4":
      return row.open / 4 + row.high / 4 + row.low / 4 + row.close / 4;
    default:
      return row[input];
  }
}
function windows<T extends Time, R>(
  rows: readonly PriceRow<T>[],
  parameters: SMAParameters,
  period: number,
  result: (time: T, mean: number, variance: number) => R,
): (R | { time: T })[] {
  let window = new PriceWindow(period);
  return rows.map((row) => {
    const value = price(row, parameters.priceInput ?? "close");
    if (value === undefined) {
      window = new PriceWindow(period);
      return { time: row.time };
    }
    const moments = window.push(value);
    return moments ? result(row.time, moments.mean, moments.variance) : { time: row.time };
  });
}
export function calculateSMA<T extends Time>(
  rows: readonly PriceRow<T>[],
  parameters: SMAParameters = {},
): IndicatorValue<T>[] {
  return windows(rows, parameters, parameters.period ?? 20, (time, value) => ({ time, value }));
}
export function calculateBollingerBands<T extends Time>(
  rows: readonly PriceRow<T>[],
  parameters: BollingerBandsParameters = {},
): BollingerBandsValue<T>[] {
  return windows(rows, parameters, parameters.period ?? 18, (time, middle, variance) => {
    const width = (parameters.multiplier ?? 2) * Math.sqrt(variance);
    return { time, middle, upper: middle + width, lower: middle - width };
  });
}
