import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function prepareIndependent26(consumer: string) {
  let source = (await readFile("src/components/examples/independent-charts.tsx", "utf8"))
    .replaceAll('"@/registry/kobalte/chart/', '"~/components/gurafu/')
    .replaceAll('"../../services/', '"./services/');
  // Observe only approved public composition seams in the actual example.
  // No alternate coordination implementation or private store inspection.
  source = source.replace(
    "apiRef={setChart}",
    "apiRef={(value) => { setChart(value); window.independent26.observeChart(props.id, value); }}",
  );
  source = source.replace(
    "apiRef={setCandles}",
    "apiRef={(value) => { setCandles(value); window.independent26.candles[props.id] = value; }}",
  );
  source = source.replace("<ChartLegend", "<LegendProbe id={props.id} /><ChartLegend");
  source += `\nfunction LegendProbe(props: { id: number }) {
    const model = Chart.useLegend({ priceSeries: "candles", volumeSeries: "volume" });
    window.independent26.models[props.id] = model;
    return null;
  }\n`;
  await writeFile(resolve(consumer, "src/independent-charts.tsx"), source);
}
