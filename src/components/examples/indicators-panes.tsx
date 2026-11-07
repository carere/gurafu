import type { CandlestickData } from "lightweight-charts";
import { createMemo, createSignal, For } from "solid-js";
import * as Chart from "@/registry/kobalte/chart/chart";
import * as Indicators from "@/registry/kobalte/chart/indicators";

// Illustrative daily prices, supplied by the application. There is no feed or
// hidden archive: calculated overlays see exactly these displayed observations.
const candles: readonly CandlestickData[] = Array.from({ length: 48 }, (_, i) => {
  const close = 100 + i / 3 + Math.sin(i / 3) * 4;
  return {
    time: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10),
    open: close - 1,
    high: close + 2,
    low: close - 2,
    close,
  };
});
const volume = candles.map((bar, i) => ({
  time: bar.time,
  value: 100 + (i % 7) * 20,
  color: "#15803d",
}));
const fieldClass =
  "rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2";
const inputs: readonly Indicators.PriceInput[] = [
  "open",
  "high",
  "low",
  "close",
  "hl2",
  "hlc3",
  "ohlc4",
];

export function IndicatorsPanes() {
  const [period, setPeriod] = createSignal(18);
  const [multiplier, setMultiplier] = createSignal(2);
  const [smaPeriod, setSmaPeriod] = createSignal(20);
  const [emaPeriod, setEmaPeriod] = createSignal(20);
  const [rsiPeriod, setRsiPeriod] = createSignal(14);
  const [emaVisible, setEmaVisible] = createSignal(true);
  const [rsiVisible, setRsiVisible] = createSignal(true);
  const [suppliedAnalysis, setSuppliedAnalysis] = createSignal(false);
  const [priceInput, setPriceInput] = createSignal<Indicators.PriceInput>("close");
  const [visible, setVisible] = createSignal(true);
  const [supplied, setSupplied] = createSignal(false);
  const bandsParameters = () => ({
    period: period(),
    multiplier: multiplier(),
    priceInput: priceInput(),
  });
  const bandsInput = createMemo(() =>
    supplied()
      ? { data: Indicators.calculateBollingerBands(candles, bandsParameters()) }
      : { source: "candles", parameters: bandsParameters() },
  );
  const smaParameters = () => ({ period: smaPeriod(), priceInput: priceInput() });
  const emaParameters = () => ({ period: emaPeriod(), priceInput: priceInput() });
  const rsiParameters = () => ({ period: rsiPeriod(), priceInput: priceInput() });
  const smaInput = createMemo(() =>
    suppliedAnalysis()
      ? { data: Indicators.calculateSMA(candles, smaParameters()) }
      : { source: "candles", parameters: smaParameters() },
  );
  const emaInput = createMemo(() =>
    suppliedAnalysis()
      ? { data: Indicators.calculateEMA(candles, emaParameters()) }
      : { source: "candles", parameters: emaParameters() },
  );
  const rsiInput = createMemo(() =>
    suppliedAnalysis()
      ? { data: Indicators.calculateRSI(candles, rsiParameters()) }
      : { source: "candles", parameters: rsiParameters() },
  );
  return (
    <section aria-labelledby="indicators-heading" class="space-y-4">
      <h2 id="indicators-heading" class="text-2xl font-semibold tracking-tight">
        Indicators and panes
      </h2>
      <p class="max-w-prose text-muted-foreground">
        Bollinger Bands, price SMA and EMA share the price pane. Traded volume and RSI each have a
        native pane on the same timeline. Bands default to 18/2; SMA and EMA to 20. RSI needs 14
        price changes and uses a 0–100 scale with 30/70 guides. Each calculation waits for its full
        seed. Hiding an indicator keeps it mounted.
      </p>
      <fieldset class="flex flex-wrap items-end gap-4">
        <legend class="mb-3 font-medium">Indicator parameters</legend>
        <label class="grid gap-1 text-sm">
          Bands period
          <select
            class={fieldClass}
            value={period()}
            onChange={(e) => setPeriod(Number(e.currentTarget.value))}
          >
            <For each={[3, 10, 18, 20]}>{(n) => <option value={n}>{n}</option>}</For>
          </select>
        </label>
        <label class="grid gap-1 text-sm">
          Standard deviations
          <select
            class={fieldClass}
            value={multiplier()}
            onChange={(e) => setMultiplier(Number(e.currentTarget.value))}
          >
            <For each={[0, 1, 2, 3]}>{(n) => <option value={n}>{n}</option>}</For>
          </select>
        </label>
        <label class="grid gap-1 text-sm">
          SMA period
          <select
            class={fieldClass}
            value={smaPeriod()}
            onChange={(e) => setSmaPeriod(Number(e.currentTarget.value))}
          >
            <For each={[3, 10, 20]}>{(n) => <option value={n}>{n}</option>}</For>
          </select>
        </label>
        <label class="grid gap-1 text-sm">
          EMA period
          <select
            class={fieldClass}
            value={emaPeriod()}
            onChange={(e) => setEmaPeriod(Number(e.currentTarget.value))}
          >
            <For each={[3, 10, 20]}>{(n) => <option value={n}>{n}</option>}</For>
          </select>
        </label>
        <label class="grid gap-1 text-sm">
          RSI period
          <select
            class={fieldClass}
            value={rsiPeriod()}
            onChange={(e) => setRsiPeriod(Number(e.currentTarget.value))}
          >
            <For each={[3, 7, 14]}>{(n) => <option value={n}>{n}</option>}</For>
          </select>
        </label>
        <label class="grid gap-1 text-sm">
          Price input
          <select
            class={fieldClass}
            value={priceInput()}
            onChange={(e) => setPriceInput(e.currentTarget.value as Indicators.PriceInput)}
          >
            <For each={inputs}>
              {(input) => <option value={input}>{input.toUpperCase()}</option>}
            </For>
          </select>
        </label>
      </fieldset>
      <div class="flex flex-wrap gap-5 text-sm">
        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            checked={visible()}
            onChange={(e) => setVisible(e.currentTarget.checked)}
          />
          Show Bollinger Bands
        </label>
        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            checked={supplied()}
            onChange={(e) => setSupplied(e.currentTarget.checked)}
          />
          Supply precomputed Bands
        </label>
        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            checked={emaVisible()}
            onChange={(e) => setEmaVisible(e.currentTarget.checked)}
          />
          Show EMA
        </label>
        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            checked={rsiVisible()}
            onChange={(e) => setRsiVisible(e.currentTarget.checked)}
          />
          Show RSI
        </label>
        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            checked={suppliedAnalysis()}
            onChange={(e) => setSuppliedAnalysis(e.currentTarget.checked)}
          />
          Supply precomputed SMA, EMA and RSI
        </label>
      </div>
      <Chart.Root
        class="w-full"
        style={{ height: "480px" }}
        role="region"
        aria-label="Bollinger Bands, price SMA, EMA, volume and RSI"
        options={{
          ...Chart.lightChartOptions,
          autoSize: true,
          layout: { ...Chart.lightChartOptions.layout, panes: { enableResize: true } },
        }}
      >
        <Chart.Pane id="price">
          <Chart.CandlestickSeries id="candles" data={candles} />
          <Indicators.BollingerBands
            id="bands"
            {...bandsInput()}
            visible={visible()}
            onVisibleChange={setVisible}
          />
          <Indicators.SMA id="sma" {...smaInput()} />
          <Indicators.EMA
            id="ema"
            {...emaInput()}
            visible={emaVisible()}
            onVisibleChange={setEmaVisible}
          />
        </Chart.Pane>
        <Chart.Pane id="volume" stretchFactor={0.25}>
          <Chart.HistogramSeries
            id="volume"
            data={volume}
            options={{ priceFormat: { type: "volume" } }}
          />
        </Chart.Pane>
        <Chart.Pane id="rsi" stretchFactor={0.4}>
          <Indicators.RSI
            id="rsi"
            {...rsiInput()}
            visible={rsiVisible()}
            onVisibleChange={setRsiVisible}
          />
        </Chart.Pane>
      </Chart.Root>
      <p role="status" class="text-sm text-muted-foreground">
        {supplied() ? "Application-calculated snapshot" : "Chart-local displayed source"} · Bands{" "}
        {period()}/{multiplier()} · SMA {smaPeriod()} · {priceInput().toUpperCase()}
      </p>
      <p class="text-sm text-muted-foreground" aria-live="polite">
        EMA {emaPeriod()} · RSI {rsiPeriod()} · SMA/EMA/RSI:{" "}
        {suppliedAnalysis() ? "Application-calculated snapshot" : "Chart-local displayed source"}
      </p>
    </section>
  );
}
