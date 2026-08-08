/**
 * Visual baselines for the webview Git context menu (compact density).
 * Runs only under E2E_MOCK=1 (Vite preview of webview dist).
 *
 * Update baselines: pnpm run test:e2e:visual:update
 */
import { test, expect } from "@playwright/test";

test.describe("Visual — Git context menu", () => {
  test.skip(
    process.env.E2E_MOCK !== "1",
    "Visual suite requires E2E_MOCK=1 (mock webview preview)",
  );

  test("Git submenu dense layout (dark)", async ({ page }) => {
    await page.addInitScript(() => {
      document.documentElement.classList.add("vscode-dark");
      document.body.classList.add("vscode-dark");
    });
    await page.goto("/?app=gitMenu&theme=dark", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByTestId("git-menu-visual")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("git-menu-show-history")).toBeVisible();

    await expect(page.getByTestId("git-menu-visual-root")).toHaveScreenshot(
      "git-context-menu-dark.png",
      {
        animations: "disabled",
        caret: "hide",
      },
    );
  });
});
