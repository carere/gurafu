import { defineConfig } from "@playwright/test";
import { chartCoreSpaPort, chartSpaDirectory, chartSpaPort } from "./scripts/chart-spa-path";
export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.ts",
  use: { baseURL: `http://127.0.0.1:${chartSpaPort}` },
  projects: [
    { name: "optional-first" },
    {
      name: "core-only",
      testMatch: "chart-extensions-27.spec.ts",
      use: { baseURL: `http://127.0.0.1:${chartCoreSpaPort}` },
    },
  ],
  webServer: [
    {
      command: `npm run dev -- --port ${chartSpaPort}`,
      cwd: chartSpaDirectory,
      url: `http://127.0.0.1:${chartSpaPort}`,
      reuseExistingServer: false,
    },
    {
      command: `npm run dev -- --port ${chartCoreSpaPort}`,
      cwd: `${chartSpaDirectory}-core-only-22`,
      url: `http://127.0.0.1:${chartCoreSpaPort}`,
      reuseExistingServer: false,
    },
  ],
  reporter: "list",
});
