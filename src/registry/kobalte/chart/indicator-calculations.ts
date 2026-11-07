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
  scale(factor: number) {
    this.values = this.values.map((value) => value * factor);
  }
  push(value: number) {
    this.values[this.pointer] = value;
    this.pointer = (this.pointer + 1) % this.period;
    this.count++;
    if (this.count < this.period) return;
    const origin = this.values[0];
    // Divide offsets before summing so a representable mean does not require
    // an overflowing window total. Centering retains small baseline spreads.
    const offset = sum(this.values.map((v) => (v - origin) / this.period));
    const mean = origin + offset;
    const centered = this.values.map((value) => value - origin - offset);
    if (!Number.isFinite(mean) || centered.some((value) => !Number.isFinite(value))) {
      // Opposite extreme prices can overflow even the centered difference.
      const scale = this.values.reduce((largest, value) => Math.max(largest, Math.abs(value)), 0);
      const normalized = this.values.map((value) => value / scale);
      const center = sum(normalized) / this.period;
      return {
        mean: center * scale,
        deviation:
          Math.sqrt(sum(normalized.map((value) => (value - center) ** 2)) / this.period) * scale,
      };
    }
    const scale = centered.reduce((largest, value) => Math.max(largest, Math.abs(value)), 0);
    return {
      mean,
      // Scale BEFORE squaring; finite spreads can have unrepresentable squares.
      deviation:
        scale === 0
          ? 0
          : Math.sqrt(sum(centered.map((value) => (value / scale) ** 2)) / this.period) * scale,
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
  result: (time: T, mean: number, deviation: number) => R,
): (R | { time: T })[] {
  let window = new PriceWindow(period);
  return rows.map((row) => {
    const value = price(row, parameters.priceInput ?? "close");
    if (value === undefined) {
      window = new PriceWindow(period);
      return { time: row.time };
    }
    const moments = window.push(value);
    return moments ? result(row.time, moments.mean, moments.deviation) : { time: row.time };
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
  return windows(rows, parameters, parameters.period ?? 18, (time, middle, deviation) => {
    const width = (parameters.multiplier ?? 2) * deviation;
    return { time, middle, upper: middle + width, lower: middle - width };
  });
}

export type EMAParameters = { period?: number; priceInput?: PriceInput };
export type RSIParameters = { period?: number; priceInput?: PriceInput };

export function calculateEMA<T extends Time>(
  rows: readonly PriceRow<T>[],
  parameters: EMAParameters = {},
): IndicatorValue<T>[] {
  const period = parameters.period ?? 20;
  const alpha = 2 / (period + 1);
  let window = new PriceWindow(period);
  let previous: number | undefined;
  return rows.map((row) => {
    const value = price(row, parameters.priceInput ?? "close");
    if (value === undefined) {
      window = new PriceWindow(period);
      previous = undefined;
      return { time: row.time };
    }
    previous =
      previous === undefined ? window.push(value)?.mean : alpha * value + (1 - alpha) * previous;
    return previous === undefined ? { time: row.time } : { time: row.time, value: previous };
  });
}

// Changes, not prices, form the seed. A whitespace row also forgets the
// preceding price, so no change crosses an explicitly unavailable observation.
export function calculateRSI<T extends Time>(
  rows: readonly PriceRow<T>[],
  parameters: RSIParameters = {},
): IndicatorValue<T>[] {
  const period = parameters.period ?? 14;
  const retainedWeight = (period - 1) / period;
  let gains = new PriceWindow(period);
  let losses = new PriceWindow(period);
  let previous: number | undefined;
  let averageGain: number | undefined;
  let averageLoss: number | undefined;
  let halved = false;
  return rows.map((row) => {
    const value = price(row, parameters.priceInput ?? "close");
    if (value === undefined) {
      gains = new PriceWindow(period);
      losses = new PriceWindow(period);
      previous = averageGain = averageLoss = undefined;
      halved = false;
      return { time: row.time };
    }
    if (previous === undefined) {
      previous = value;
      return { time: row.time };
    }
    const preceding = previous;
    previous = value;
    // N=1 retains no preceding average and requires only the change's sign.
    if (period === 1)
      return { time: row.time, value: value > preceding ? 100 : value < preceding ? 0 : 50 };
    let change = value - preceding;
    const overflowing = !Number.isFinite(change);
    if (overflowing && !halved) {
      // RSI is invariant to a common positive gain/loss scale. Halve the
      // existing seed/averages before representing an otherwise infinite delta.
      gains.scale(0.5);
      losses.scale(0.5);
      if (averageGain !== undefined) averageGain /= 2;
      if (averageLoss !== undefined) averageLoss /= 2;
      halved = true;
    } else if (
      halved &&
      !overflowing &&
      averageGain !== undefined &&
      averageLoss !== undefined &&
      averageGain <= Number.MAX_VALUE / 2 &&
      averageLoss <= Number.MAX_VALUE / 2
    ) {
      // Return to original units when safe, retaining later subnormal changes.
      averageGain *= 2;
      averageLoss *= 2;
      halved = false;
    }
    if (halved) change = overflowing ? value / 2 - preceding / 2 : change / 2;
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    averageGain =
      averageGain === undefined
        ? gains.push(gain)?.mean
        : averageGain * retainedWeight + gain / period;
    averageLoss =
      averageLoss === undefined
        ? losses.push(loss)?.mean
        : averageLoss * retainedWeight + loss / period;
    if (averageGain === undefined || averageLoss === undefined) return { time: row.time };
    // Normalize the ratio before multiplying by 100. Valid finite prices can
    // produce gains large enough for 100 * averageGain to overflow.
    const scale = Math.max(averageGain, averageLoss);
    const result =
      averageGain === 0
        ? averageLoss === 0
          ? 50
          : 0
        : averageLoss === 0
          ? 100
          : (100 * (averageGain / scale)) / (averageGain / scale + averageLoss / scale);
    return { time: row.time, value: result };
  });
}
