import { defineConfig } from "@playwright/test";
import { chartSpaDirectory, chartSpaPort } from "./scripts/chart-spa-path";
export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.ts",
  use: { baseURL: `http://127.0.0.1:${chartSpaPort}` },
  webServer: {
    command: `npm run dev -- --port ${chartSpaPort}`,
    cwd: chartSpaDirectory,
    url: `http://127.0.0.1:${chartSpaPort}`,
    reuseExistingServer: false,
  },
  reporter: "list",
});
