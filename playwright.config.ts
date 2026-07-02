// playwright.config.ts - Playwright Test configuration for browser smoke tests.
//
// The webServer command builds dist/ fresh before serving it, so the smoke
// test can never run against stale build output. A random port in the 8xxx
// range is chosen per run (same scheme as run_web_server.sh) so a stray
// leftover server on any single fixed port cannot block the suite.
/// <reference types="node" />
import { env } from "node:process";
import { defineConfig, devices } from "@playwright/test";

// Pick a random port in [8000, 8999] once per run. Playwright re-imports this
// config in each worker process, so a bare Math.random() would pick a different
// port in the worker than the one the webServer (started by the main process)
// bound to. Pin the chosen port into the environment on first load; workers are
// spawned as children of the main process and inherit PW_PORT, so every process
// in the run resolves the same port. baseURL and the http.server command share it.
const port = Number(env["PW_PORT"]) || 8000 + Math.floor(Math.random() * 1000);
env["PW_PORT"] = String(port);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "tests/playwright",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `./build_github_pages.sh && python3 -m http.server ${port} --directory dist`,
    url: `${baseURL}/index.html`,
    reuseExistingServer: false,
    timeout: 120000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
