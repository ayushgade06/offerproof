import { defineConfig } from "@playwright/test";

// Run against a running server: BASE_URL=https://… npx playwright test (default: local dev on :3417)
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  use: { baseURL: process.env.BASE_URL || "http://localhost:3417" },
  reporter: "list",
});
