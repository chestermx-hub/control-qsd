import { defineConfig } from "@playwright/test";
import { execFileSync } from "node:child_process";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173";
const chromiumPath = process.env.E2E_CHROMIUM_PATH
  ?? execFileSync("which", ["chromium"], { encoding: "utf8" }).trim();

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.e2e.ts",
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: chromiumPath,
    },
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "PORT=5173 BASE_PATH=/ pnpm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});