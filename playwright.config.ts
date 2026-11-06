import { defineConfig } from "@playwright/test";
import { chartSpaDirectory } from "./scripts/chart-spa-path";
export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.ts",
  use: { baseURL: "http://127.0.0.1:4178" },
  webServer: {
    command: "npm run dev",
    cwd: chartSpaDirectory,
    url: "http://127.0.0.1:4178",
    reuseExistingServer: false,
  },
  reporter: "list",
});
