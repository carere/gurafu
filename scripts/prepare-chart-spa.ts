import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chartSpaDirectory as consumer } from "./chart-spa-path";
import { prepareCompositionExamples } from "./prepare-chart-composition-19";
import { prepareIndependent26 } from "./prepare-independent-26";
import {
  installIndicators22,
  verifyCoreOnly22,
  verifyOptionalWidgets24,
} from "./prepare-indicators-22";
import { prepareReplay25 } from "./prepare-replay-25";

await rm(consumer, { recursive: true, force: true });
await mkdir(consumer, { recursive: true });
await cp("tests/chart-spa", consumer, { recursive: true });
await prepareCompositionExamples(consumer);
await prepareIndependent26(consumer);
await cp("src/components/examples/extensions-view.ts", resolve(consumer, "src/extensions-view.ts"));
await writeFile(
  resolve(consumer, "src/extensions-example.tsx"),
  (await readFile("src/components/examples/extensions.tsx", "utf8")).replaceAll(
    "@/registry/kobalte/chart/chart",
    "~/components/gurafu/chart",
  ),
);
await writeFile(
  resolve(consumer, "src/indicators-example-22.tsx"),
  (await readFile("src/components/examples/indicators-panes.tsx", "utf8")).replaceAll(
    "@/registry/kobalte/chart/",
    "~/components/gurafu/",
  ),
);
// Compile and mount the actual website example against the installed registry.
await writeFile(
  resolve(consumer, "src/data-history.tsx"),
  (await readFile("src/components/examples/data-history.tsx", "utf8")).replace(
    '"@/registry/kobalte/chart/chart"',
    '"~/components/gurafu/chart"',
  ),
);
// #21 exercises the website service Layer with actual Effect/Query dependencies.
await cp("src/services/market", resolve(consumer, "src/services/market"), { recursive: true });
await writeFile(
  resolve(consumer, "src/service-history.tsx"),
  (await readFile("src/components/examples/service-history.tsx", "utf8"))
    .replace('"@/registry/kobalte/chart/chart"', '"~/components/gurafu/chart"')
    .replaceAll('"../../services/', '"./services/'),
);
async function run(cmd: string[], cwd: string) {
  const child = Bun.spawn(cmd, { cwd, stdout: "inherit", stderr: "inherit" });
  if (await child.exited) throw new Error(`${cmd.join(" ")} failed`);
}
await run(["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund"], consumer);
await verifyCoreOnly22(consumer);
await installIndicators22(consumer);
await verifyOptionalWidgets24(consumer);
await prepareReplay25(consumer);
// These belong to the website example, never the registry dependency manifest.
await run(
  [
    "npm",
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--save-exact",
    "effect@3.22.4",
    "@tanstack/solid-query@5.107.1",
  ],
  consumer,
);
await run(["npm", "run", "check"], consumer);
await run(["npm", "run", "build"], consumer);
await run(["npm", "ls", "solid-js"], consumer);

const solidPaths = Bun.spawn(["npm", "ls", "solid-js", "--parseable", "--all"], {
  cwd: consumer,
  stdout: "pipe",
  stderr: "inherit",
});
const paths = (await new Response(solidPaths.stdout).text()).trim().split("\n").filter(Boolean);
if ((await solidPaths.exited) || paths.length !== 1)
  throw new Error(`Expected one installed Solid runtime, got ${paths.length}`);
