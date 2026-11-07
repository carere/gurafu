import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Serve the actual generated catalog locally. Only the hosted core dependency
// URL changes origin, so shadcn traverses the optional item's real dependency.
export async function installIndicators22(
  consumer: string,
  items = ["chart-indicators", "chart-legend", "chart-indicator-controls"],
) {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const name = new URL(request.url).pathname.split("/").pop();
      if (
        !name ||
        ![
          "chart.json",
          "chart-indicators.json",
          "chart-legend.json",
          "chart-indicator-controls.json",
          "chart-control-ui.json",
        ].includes(name)
      )
        return new Response("Not found", { status: 404 });
      const item = JSON.parse(await readFile(`public/r/kobalte/${name}`, "utf8"));
      if (item.registryDependencies)
        item.registryDependencies = item.registryDependencies.map((url: string) =>
          url.replace("https://gurafu.carere.dev", new URL(request.url).origin),
        );
      return Response.json(item);
    },
  });
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
  const files = await readdir(resolve(directory, "src/components/gurafu"));
  if (files.some((name) => name.includes("indicator")))
    throw new Error("Core installed optional indicators");
  console.log("Core-only installation, strict types and production build PASS");
}

// Each optional widget is also a usable first install. Selection stays entirely
// outside core; legend brings core, but never provisions indicator declarations.
export async function verifyOptionalWidgets24(consumer: string) {
  const directory = `${consumer}-widgets-only-24`;
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
  await installIndicators22(directory, ["chart-indicator-controls"]);
  await writeFile(
    resolve(directory, "src/main.tsx"),
    `import {render} from "solid-js/web";
import {ChartIndicatorControls} from "~/components/gurafu/chart-indicator-controls";
render(()=><ChartIndicatorControls items={[{value:"sma",label:"Price SMA"}]} defaultValue={["sma"]} />,document.getElementById("root")!);`,
  );
  await run(["npm", "run", "check"]);
  await run(["npm", "run", "build"]);
  let files = await readdir(resolve(directory, "src/components/gurafu"));
  if (files.some((name) => ["chart.tsx", "chart-data.ts", "indicators.tsx"].includes(name)))
    throw new Error("Standalone selection installed chart core");
  const manifest = JSON.parse(await readFile(resolve(directory, "package.json"), "utf8"));
  if (manifest.dependencies["@carere/solux"] || manifest.dependencies["lightweight-charts"])
    throw new Error("Standalone selection pulled chart dependencies");
  await installIndicators22(directory, ["chart-legend"]);
  await writeFile(
    resolve(directory, "src/main.tsx"),
    `import {render} from "solid-js/web";
import * as Chart from "~/components/gurafu/chart";
import {ChartLegend} from "~/components/gurafu/chart-legend";
render(()=><Chart.Root><Chart.Pane id="price"><Chart.CandlestickSeries id="price" data={[]} /></Chart.Pane><ChartLegend priceSeries="price" /></Chart.Root>,document.getElementById("root")!);`,
  );
  await run(["npm", "run", "check"]);
  await run(["npm", "run", "build"]);
  files = await readdir(resolve(directory, "src/components/gurafu"));
  if (files.includes("indicators.tsx"))
    throw new Error("Legend installed optional indicator declarations");
  await run(["npm", "ls", "solid-js"]);
  console.log(
    "Independent selection-first and legend-only published installs, strict types and SPA builds PASS",
  );
}
