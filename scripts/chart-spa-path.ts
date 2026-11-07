import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

// Config readers (including Knip) can resolve this before the fixture exists.
export const chartSpaDirectory = resolve(
  tmpdir(),
  `gurafu-chart-spa-${createHash("sha256").update(process.cwd()).digest("hex").slice(0, 12)}`,
);

// Isolate concurrent ticket worktrees on the same machine.
export const chartSpaPort =
  20000 +
  (Number.parseInt(createHash("sha256").update(process.cwd()).digest("hex").slice(0, 4), 16) %
    30000);
