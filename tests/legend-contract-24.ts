import type { Time } from "lightweight-charts";
import type {
  CandlestickIncrementalController,
  ChartController,
  LegendModel,
} from "../src/registry/kobalte/chart/chart";

type Fixture = {
  chart: ChartController;
  sibling: ChartController;
  price: CandlestickIncrementalController;
  other: CandlestickIncrementalController;
  model(): LegendModel;
  moves(): number;
  focus(): number;
  requests: unknown[];
  setDefaults(v: boolean): void;
  setMounted(v: boolean): void;
  setIndicator(v: boolean): void;
  setVisible(v: boolean): void;
  setExpanded(v: boolean): void;
  setKey(v: number): void;
  setChoices(v: readonly string[]): void;
  appIncrement(): void;
  appDispose(): void;
  dispose(): void;
};
// External extension-protocol test messages; this is not a chart API/schema.
type Snapshot = {
  pointer: { time: Time | null; seriesId: string | null; hadPoint: boolean };
  indicatorVisibility: Record<string, boolean>;
  legendExpansion: Record<string, boolean>;
  app: { value: number };
};
export type ProtocolConnection24 = {
  options: { name: string; instanceId: string };
  inits: Snapshot[];
  sent: { event: unknown; state: Snapshot }[];
  closed: number;
  removed: number;
  listener(message: { type: string; payload: unknown; state?: string }): void;
  init(state: Snapshot): void;
  send(event: unknown, state: Snapshot): void;
  subscribe(fn: ProtocolConnection24["listener"]): () => void;
  unsubscribe(): void;
};
declare global {
  interface Window {
    legend24: Fixture;
    protocol24: ProtocolConnection24[];
  }
}
