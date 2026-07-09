import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "test",
  testMatch: "**/*.spec.ts",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:5174",
  },
  webServer: {
    command: "pnpm dev --port 5174",
    url: "http://localhost:5174",
    reuseExistingServer: !process.env["CI"],
  },
});
