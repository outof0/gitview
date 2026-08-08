import { defineConfig } from "@playwright/test";

/**
 * Default: native VS Code + Electron (real webview CSP, vscode-resource://, extension host).
 * Mock Vite preview only when E2E_MOCK=1 — does not reproduce manual VS Code behavior.
 */
const useMockPreview = process.env.E2E_MOCK === "1";

export default defineConfig({
  testDir: "e2e",
  timeout: useMockPreview ? 60_000 : 180_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  fullyParallel: false,
  testMatch: useMockPreview ? /.*\.spec\.ts/ : /native-.*\.spec\.ts/,
  testIgnore: useMockPreview ? /native-.*\.spec\.ts/ : undefined,
  use: {
    baseURL: "http://127.0.0.1:5199",
    headless: process.env.HEADED ? false : true,
    launchOptions: {
      slowMo: process.env.HEADED ? 400 : 0,
    },
    viewport: { width: 1400, height: 900 },
    screenshot: "on",
    trace: "on-first-retry",
  },
  outputDir: "e2e-results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],
  webServer: useMockPreview
    ? {
        command:
          "node webview/node_modules/vite/bin/vite.js preview webview --host 127.0.0.1 --port 5199 --strictPort",
        url: "http://127.0.0.1:5199",
        // Never reuse: a long-lived preview keeps serving `webview/dist` while
        // `pnpm run build` rewrites it, so a run can hit a truncated bundle (the
        // page stalls on the boot placeholder) or silently test a stale one.
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
});
