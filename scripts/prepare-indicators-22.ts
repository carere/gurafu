import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { serveLocalRegistry } from "./local-registry";
import { verifyRegistryBoundary } from "./verify-registry-boundary";

// Serve the actual generated catalog locally. Only the hosted core dependency
// URL changes origin, so shadcn traverses the optional item's real dependency.
export async function installIndicators22(
  consumer: string,
  items = ["chart-indicators", "chart-legend", "chart-indicator-controls"],
) {
  const server = serveLocalRegistry();
  try {
    const child = Bun.spawn(
      [
        "bun",
        "--bun",
        resolve("node_modules/shadcn/dist/index.js"),
        "add",
        ...items.map((name) => `http://127.0.0.1:${server.port}/r/kobalte/${name}.json`),
        "--cwd",
        consumer,
        "--yes",
      ],
      { stdout: "inherit", stderr: "inherit" },
    );
    if (await child.exited) throw new Error("Optional registry installation failed");
  } finally {
    await server.stop(true);
  }
}

// A separate consumer proves core still installs without optional declarations.
export async function verifyCoreOnly22(consumer: string) {
  const directory = `${consumer}-core-only-22`;
  await rm(directory, { recursive: true, force: true });
  await mkdir(resolve(directory, "src"), { recursive: true });
  for (const file of [
    "package.json",
    "components.json",
    "tsconfig.json",
    "vite.config.ts",
    "index.html",
    "src/style.css",
    "src/public-types.tsx",
    "src/public-types-19.tsx",
    "src/data-types.tsx",
    "src/extensions-types-27.tsx",
    "src/extensions-27.tsx",
  ])
    await cp(resolve("tests/chart-spa", file), resolve(directory, file));
  for (const file of ["extensions-view.ts", "extensions-example.tsx"])
    await cp(resolve(consumer, "src", file), resolve(directory, "src", file));
  await writeFile(
    resolve(directory, "src/main.tsx"),
    `import { render } from "solid-js/web";
import * as Chart from "~/components/gurafu/chart";
import { Extensions27 } from "./extensions-27";
import { ExtensionsLifecycle } from "./extensions-example";
import "./style.css";
if (location.search.includes("extensions27")) render(() => <Extensions27 />, document.getElementById("root")!);
else if (location.search.includes("extensions-example")) render(() => <ExtensionsLifecycle />, document.getElementById("root")!);
else render(() => <Chart.Root><Chart.Pane id="price"><Chart.LineSeries id="price" data={[]} /></Chart.Pane></Chart.Root>, document.getElementById("root")!);`,
  );
  const commands = [
    ["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund"],
    [
      "bun",
      "--bun",
      resolve("node_modules/shadcn/dist/index.js"),
      "add",
      resolve("public/r/kobalte/chart.json"),
      "--cwd",
      directory,
      "--yes",
    ],
    ["npm", "run", "check"],
    ["npm", "run", "build"],
  ];
  for (const command of commands) {
    const child = Bun.spawn(command, { cwd: directory, stdout: "inherit", stderr: "inherit" });
    if (await child.exited) throw new Error("Core-only installed check failed");
  }
  await verifyRegistryBoundary(directory, ["chart.tsx", "chart-data.ts"], false, true);
  console.log("Core-only installation, strict types and production build PASS");
}

// Each optional widget is also a usable first install. Selection stays entirely
// outside core; legend brings core, but never provisions indicator declarations.
export async function verifyOptionalWidgets24(consumer: string) {
  for (const item of ["chart-indicator-controls", "chart-legend"]) {
    const directory = `${consumer}-${item}-only-28`;
    await rm(directory, { recursive: true, force: true });
    await mkdir(resolve(directory, "src"), { recursive: true });
    for (const file of [
      "package.json",
      "components.json",
      "tsconfig.json",
      "vite.config.ts",
      "index.html",
      "src/style.css",
    ])
      await cp(resolve("tests/chart-spa", file), resolve(directory, file));
    async function run(command: string[]) {
      const process = Bun.spawn(command, { cwd: directory, stdout: "inherit", stderr: "inherit" });
      if (await process.exited) throw new Error("Independent optional consumer failed");
    }
    await run(["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund"]);
    await installIndicators22(directory, [item]);
    const selection = item === "chart-indicator-controls";
    await writeFile(
      resolve(directory, "src/main.tsx"),
      selection
        ? `import {render} from "solid-js/web";
import {ChartIndicatorControls} from "~/components/gurafu/chart-indicator-controls";
render(()=><ChartIndicatorControls items={[{value:"sma",label:"Price SMA"}]} defaultValue={["sma"]} />,document.getElementById("root")!);`
        : `import {render} from "solid-js/web";
import * as Chart from "~/components/gurafu/chart";
import {ChartLegend} from "~/components/gurafu/chart-legend";
render(()=><Chart.Root><Chart.Pane id="price"><Chart.CandlestickSeries id="price" data={[]} /></Chart.Pane><ChartLegend priceSeries="price" /></Chart.Root>,document.getElementById("root")!);`,
    );
    await run(["npm", "run", "check"]);
    await run(["npm", "run", "build"]);
    await verifyRegistryBoundary(
      directory,
      [
        `${item}.tsx`,
        "chart-control-button.tsx",
        "chart-control-utils.ts",
        ...(selection ? [] : ["chart.tsx", "chart-data.ts"]),
      ],
      true,
      !selection,
    );
  }
  console.log(
    "Independent selection-only and legend-only published installs, strict types and SPA builds PASS",
  );
}
