import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// Only dependency origins change. Source, targets and package declarations stay
// exactly as generated, so local installs traverse the real registry graph.
export function serveLocalRegistry(port = 0) {
  const root = resolve("public/r/kobalte");
  return Bun.serve({
    hostname: "127.0.0.1",
    port,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (!/^\/r\/kobalte\/[a-z-]+\.json$/.test(path))
        return new Response("Not found", { status: 404 });
      try {
        const item = JSON.parse(
          await readFile(resolve(root, path.slice("/r/kobalte/".length)), "utf8"),
        );
        if (item.registryDependencies)
          item.registryDependencies = item.registryDependencies.map((url: string) =>
            url.replace("https://gurafu.carere.dev", new URL(request.url).origin),
          );
        return Response.json(item);
      } catch {
        return new Response("Generated item not found. Build the registry first.", { status: 404 });
      }
    },
  });
}

if (import.meta.main) {
  const port = Number(process.argv[2] ?? 4280);
  const server = serveLocalRegistry(port);
  console.log(`Local generated registry: http://127.0.0.1:${server.port}/r/kobalte/{name}.json`);
}
