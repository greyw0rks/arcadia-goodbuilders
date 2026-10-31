import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const origin = "http://127.0.0.1:3046";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  use: {
    baseURL: origin,
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      // Diagnostic override for broken workstation DNS; never used by the app.
      args: process.env.PLAYWRIGHT_HOST_RESOLVER_RULES ? [`--host-resolver-rules=${process.env.PLAYWRIGHT_HOST_RESOLVER_RULES}`] : [],
    },
  },
  webServer: [{ command: "node tests/fixtures/celo-rpc.mjs", url: "http://127.0.0.1:18546", reuseExistingServer: false }, {
    command: "pnpm exec tsx tests/fixtures/prepare-db.ts && pnpm exec next start --hostname 127.0.0.1 --port 3046",
    url: `${origin}/api/challenge`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      ARCADIA_DATABASE_URL: `file:${join(tmpdir(), `arcadia-wallet-e2e-${Date.now()}.db`)}`,
      ARCADIA_DATABASE_AUTH_TOKEN: "",
      ARCADIA_AUTH_ORIGIN: origin,
      ARCADIA_CELO_RPC_URL: "http://127.0.0.1:18546",
      TURSO_DATABASE_URL: "",
      TURSO_AUTH_TOKEN: "",
      ARCADIA_TOURNAMENT_ID: "browser-test",
      CRON_SECRET: "arcadia-e2e-maintenance-only",
    },
  }],
});
