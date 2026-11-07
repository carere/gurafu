import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

// Checks the output of the actual installer, before website deps are introduced.
export async function verifyRegistryBoundary(
  directory: string,
  expectedFiles: string[],
  ui: boolean,
  core: boolean,
) {
  const files = await readdir(resolve(directory, "src/components/gurafu"));
  if (JSON.stringify(files.sort()) !== JSON.stringify(expectedFiles.sort()))
    throw new Error(`Unexpected installed sources in ${directory}: ${files.join(", ")}`);
  const { dependencies } = JSON.parse(await readFile(resolve(directory, "package.json"), "utf8"));
  const expected = [
    "solid-js",
    ...(core ? ["@carere/solux", "lightweight-charts"] : []),
    ...(ui ? ["class-variance-authority", "clsx", "tailwind-merge"] : []),
  ];
  if (JSON.stringify(Object.keys(dependencies).sort()) !== JSON.stringify(expected.sort()))
    throw new Error(`Unexpected installed dependencies: ${Object.keys(dependencies).join(", ")}`);
  const process = Bun.spawn(["npm", "ls", "solid-js", "--parseable", "--all"], {
    cwd: directory,
    stdout: "pipe",
    stderr: "inherit",
  });
  const paths = (await new Response(process.stdout).text()).trim().split("\n").filter(Boolean);
  if ((await process.exited) || paths.length !== 1)
    throw new Error(`Expected a single Solid runtime in ${directory}`);
  console.log(`Installed source/dependency boundary and single Solid runtime PASS: ${directory}`);
}
