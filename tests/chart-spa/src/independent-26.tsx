import { onCleanup } from "solid-js";
import type * as Chart from "~/components/gurafu/chart";
import { IndependentCharts } from "./independent-charts";
import { createMarketApp } from "./services/market/app";
import { createMarketFixture, fixtureCandles } from "./services/market/fixture";

export function Independent26() {
  const fixture = createMarketFixture({ controlled: true });
  const app = createMarketApp(fixture.layer);
  window.independent26 = {
    fixture,
    fixtureCandles,
    app,
    charts: [],
    candles: [],
    models: [],
    commands: [],
    nativeMoves: [],
    observeChart(id, chart) {
      const f = window.independent26;
      f.charts[id] = chart;
      if (!chart) return;
      // Forward the real public command, recording only its public arguments.
      const place = chart.setCrosshairPosition.bind(chart);
      const clear = chart.clearCrosshairPosition.bind(chart);
      chart.setCrosshairPosition = (price, time, series) => {
        f.commands.push({ id, kind: "place", price, time, owned: series === f.candles[id] });
        place(price, time, series);
      };
      chart.clearCrosshairPosition = () => {
        f.commands.push({ id, kind: "clear" });
        clear();
      };
      chart.api.subscribeCrosshairMove((event) => {
        f.nativeMoves.push({ id, time: event.time, pointer: !!event.sourceEvent });
      });
    },
  };
  onCleanup(() => void app.dispose());
  return <IndependentCharts app={app} />;
}

declare global {
  interface Window {
    independent26: {
      fixture: ReturnType<typeof createMarketFixture>;
      fixtureCandles: typeof fixtureCandles;
      app: ReturnType<typeof createMarketApp>;
      observeChart(id: number, chart: Chart.ChartController | undefined): void;
      commands: {
        id: number;
        kind: "place" | "clear";
        time?: import("lightweight-charts").Time;
        price?: number;
        owned?: boolean;
      }[];
      nativeMoves: { id: number; time?: import("lightweight-charts").Time; pointer: boolean }[];
      charts: (Chart.ChartController | undefined)[];
      candles: (Chart.CandlestickSnapshotController | undefined)[];
      models: (() => Chart.LegendModel)[];
    };
  }
}
