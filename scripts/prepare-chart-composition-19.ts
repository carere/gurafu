import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Mount the readable website source against installed core, with no website
// framework, UI dependency or alternate chart implementation in the consumer.
export async function prepareCompositionExamples(consumer: string) {
  for (const name of ["basics", "native-panes"]) {
    const source = await readFile(`src/components/examples/${name}.tsx`, "utf8");
    await writeFile(
      resolve(consumer, `src/${name}-example.tsx`),
      source.replaceAll("@/registry/kobalte/chart/chart", "~/components/gurafu/chart"),
    );
  }
}
