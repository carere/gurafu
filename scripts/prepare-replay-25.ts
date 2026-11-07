import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function prepareReplay25(consumer: string) {
  for (const name of ["replay-date", "replay-session", "replay-evidence"]) {
    const extension = name === "replay-date" ? "tsx" : "ts";
    await writeFile(
      resolve(consumer, `src/${name}.${extension}`),
      (await readFile(`src/components/examples/${name}.${extension}`, "utf8"))
        .replaceAll("@/registry/kobalte/chart/", "~/components/gurafu/")
        .replaceAll('"../../services/', '"./services/'),
    );
  }
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const name = new URL(request.url).pathname.split("/").pop();
      if (
        !name ||
        ![
          "chart-replay-controls.json",
          "chart-date-controls.json",
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
  async function run(command: string[], cwd: string) {
    const child = Bun.spawn(command, { cwd, stdout: "inherit", stderr: "inherit" });
    if (await child.exited) throw new Error("Replay/date installed consumer failed");
  }
  async function install(directory: string, item: string) {
    await run(
      [
        "bun",
        "--bun",
        resolve("node_modules/shadcn/dist/index.js"),
        "add",
        `http://127.0.0.1:${server.port}/r/kobalte/${item}.json`,
        "--cwd",
        directory,
        "--yes",
      ],
      directory,
    );
  }
  try {
    for (const item of ["chart-replay-controls", "chart-date-controls"]) {
      const directory = `${consumer}-${item}-25`;
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
      const code =
        item === "chart-replay-controls"
          ? `import {ChartReplayControls} from "~/components/gurafu/chart-replay-controls";
const widget = <ChartReplayControls playing={false} speed={1} speeds={[1,2]} />;
// @ts-expect-error controlled playing required
const missing = <ChartReplayControls speed={1} speeds={[1]} />;
// @ts-expect-error explicit speeds required
const missingSpeeds = <ChartReplayControls playing={false} speed={1} />;
// @ts-expect-error speed is numeric
const wrong = <ChartReplayControls playing={false} speed="1" speeds={[1]} />;`
          : `import {ChartDateControls} from "~/components/gurafu/chart-date-controls";
const widget = <ChartDateControls value={new Date()} minDate={new Date(0)} maxDate={new Date()} onValueChange={(date:Date)=>{}} formatDate={d=>d.toISOString()} />;
// @ts-expect-error native chart time is not a Date
const wrong = <ChartDateControls value={1767225600} />;`;
      await writeFile(
        resolve(directory, "src/main.tsx"),
        `import {render} from "solid-js/web";\n${code}\nrender(()=>widget,document.getElementById("root")!);`,
      );
      await run(["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund"], directory);
      await install(directory, item);
      await run(["npm", "run", "check"], directory);
      await run(["npm", "run", "build"], directory);
      const files = await readdir(resolve(directory, "src/components/gurafu"));
      if (files.some((name) => ["chart.tsx", "chart-data.ts", "indicators.tsx"].includes(name)))
        throw new Error("Standalone widget installed core");
      const manifest = JSON.parse(await readFile(resolve(directory, "package.json"), "utf8"));
      if (
        ["lightweight-charts", "@carere/solux", "effect", "@tanstack/solid-query"].some(
          (name) => manifest.dependencies[name],
        )
      )
        throw new Error("Widget pulled application/chart dependencies");
      const paths = Bun.spawn(["npm", "ls", "solid-js", "--parseable", "--all"], {
        cwd: directory,
        stdout: "pipe",
      });
      if (
        (await new Response(paths.stdout).text()).trim().split("\n").length !== 1 ||
        (await paths.exited)
      )
        throw new Error("Multiple Solid runtimes");
      await install(consumer, item);
    }
  } finally {
    await server.stop(true);
  }
}
