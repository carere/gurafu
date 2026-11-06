import { readFileSync } from "node:fs";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.ts",
  use: { baseURL: "http://127.0.0.1:4178" },
  webServer: {
    command: "npm run dev",
    cwd: readFileSync(".moon/cache/chart-spa-path", "utf8").trim(),
    url: "http://127.0.0.1:4178",
    reuseExistingServer: false,
  },
  reporter: "list",
});
