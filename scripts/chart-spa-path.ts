import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

// Config readers (including Knip) can resolve this before the fixture exists.
export const chartSpaDirectory = resolve(
  tmpdir(),
  `gurafu-chart-spa-${createHash("sha256").update(process.cwd()).digest("hex").slice(0, 12)}`,
);

// Independent worktrees may verify installed consumers concurrently.
export const chartSpaPort =
  42000 +
  (Number.parseInt(createHash("sha256").update(process.cwd()).digest("hex").slice(0, 6), 16) %
    10000);

export const chartCoreSpaPort = chartSpaPort + 10000;
