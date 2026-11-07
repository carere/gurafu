import type { UTCTimestamp } from "lightweight-charts";
import type { Candle } from "../../services/market/exchange";

// Explicit fixture evidence, independent of the final 1h bar. Observations are
// minute opens with their own OHLC/volume. At 00:02 only these two are known.
export const finerObservations: readonly Candle[] = [
  {
    time: 1767225600 as UTCTimestamp,
    open: 10,
    high: 13,
    low: 9,
    close: 12,
    volume: 2,
    trades: 3,
    closed: true,
  },
  {
    time: 1767225660 as UTCTimestamp,
    open: 12,
    high: 14,
    low: 11,
    close: 11,
    volume: 5,
    trades: 4,
    closed: true,
  },
  {
    time: 1767225720 as UTCTimestamp,
    open: 11,
    high: 99,
    low: 1,
    close: 80,
    volume: 100,
    trades: 50,
    closed: true,
  },
];
export function partialFixtureCandle(cutoff: number): readonly Candle[] {
  const known = finerObservations.filter((row) => row.time + 60 <= cutoff);
  if (!known.length) return [];
  return [
    {
      time: finerObservations[0].time,
      open: known[0].open,
      high: Math.max(...known.map((row) => row.high)),
      low: Math.min(...known.map((row) => row.low)),
      close: known[known.length - 1].close,
      volume: known.reduce((sum, row) => sum + row.volume, 0),
      trades: known.reduce((sum, row) => sum + row.trades, 0),
      closed: false,
    },
  ];
}
