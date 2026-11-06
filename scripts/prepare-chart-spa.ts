import { createHash } from "node:crypto";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const consumer = resolve(
  tmpdir(),
  `gurafu-chart-spa-${createHash("sha256").update(process.cwd()).digest("hex").slice(0, 12)}`,
);
await rm(consumer, { recursive: true, force: true });
await mkdir(consumer, { recursive: true });
await cp("tests/chart-spa", consumer, { recursive: true });
await mkdir(".moon/cache", { recursive: true });
await writeFile(".moon/cache/chart-spa-path", consumer);
async function run(cmd: string[], cwd: string) {
  const child = Bun.spawn(cmd, { cwd, stdout: "inherit", stderr: "inherit" });
  if (await child.exited) throw new Error(`${cmd.join(" ")} failed`);
}
await run(["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund"], consumer);
await run(
  [
    "bun",
    "--bun",
    resolve("node_modules/shadcn/dist/index.js"),
    "add",
    resolve("public/r/kobalte/chart.json"),
    "--cwd",
    consumer,
    "--yes",
  ],
  process.cwd(),
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
