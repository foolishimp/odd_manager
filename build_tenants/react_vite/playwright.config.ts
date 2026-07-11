import { defineConfig } from "@playwright/test";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const apiPort = Number(process.env.OMAN_E2E_API_PORT ?? 4173);
const clientPort = Number(process.env.OMAN_E2E_CLIENT_PORT ?? 5173);
const tenantRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(tenantRoot, "../..");
const e2eStateRoot = resolve(process.env.OMAN_E2E_STATE_ROOT ?? join(tenantRoot, "tests", "artifacts", "e2e-manager-state"));
const registryRelativePath = join(".ai-workspace", "runtime", "odd_manager", "projects.local.json");
const sourceRegistry = join(repoRoot, registryRelativePath);
const e2eRegistry = join(e2eStateRoot, registryRelativePath);
const reuseExistingServer = process.env.OMAN_E2E_REUSE_SERVER === "1";

rmSync(e2eStateRoot, { recursive: true, force: true });
mkdirSync(dirname(e2eRegistry), { recursive: true });
if (existsSync(sourceRegistry)) copyFileSync(sourceRegistry, e2eRegistry);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  outputDir: "tests/artifacts/test-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "tests/artifacts/playwright-report", open: "never" }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${clientPort}`,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: {
      width: 1600,
      height: 1100,
    },
    permissions: ["clipboard-read", "clipboard-write"],
  },
  webServer: [
    {
      command: `OMAN_API_PORT=${apiPort} OMAN_MANAGER_STATE_ROOT=${JSON.stringify(e2eStateRoot)} OMAN_PORTFOLIO_BROWSE_ROOT=${JSON.stringify(join(tenantRoot, "tests", "artifacts", "fixtures"))} OMAN_PROPOSAL_FIXTURE_MODE=1 OMAN_BUILD_FIXTURE_MODE=1 node src/server/index.mjs`,
      url: `http://127.0.0.1:${apiPort}/api/health`,
      reuseExistingServer,
      timeout: 60_000,
    },
    {
      command: `OMAN_API_TARGET=http://127.0.0.1:${apiPort} npm run dev:client -- --host 127.0.0.1 --port ${clientPort}`,
      url: `http://127.0.0.1:${clientPort}`,
      reuseExistingServer,
      timeout: 60_000,
    },
  ],
});
