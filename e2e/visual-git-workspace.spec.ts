import { expect, test, type Page } from "@playwright/test";

const stateMarkers: Record<string, string> = {
  loading: "repository-state-loading",
  "no-repository": "repository-state-none",
  "repository-error": "repository-state-error",
  clean: "workspace-tab-log",
  changed: "workspace-tab-log",
  untrusted: "repository-state-untrusted",
  "unborn-no-remote": "workspace-tab-log",
  detached: "workspace-tab-log",
  "no-remote": "workspace-tab-log",
  "no-upstream": "workspace-tab-log",
  protected: "workspace-tab-log",
  "merge-conflict": "workspace-tab-log",
  "sync-fetch-running": "workspace-tab-log",
  "sync-fetch-cancelling": "workspace-tab-log",
  "sync-fetch-offline": "workspace-tab-log",
  "sync-pull-conflicts": "workspace-tab-log",
  "sync-update-all-running": "workspace-tab-log",
};

async function openState(
  page: Page,
  state: string,
  width = 1440,
  height = 900,
  theme: "dark" | "high-contrast" = "dark",
): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.addInitScript((requestedTheme) => {
    const themeClass =
      requestedTheme === "high-contrast"
        ? "vscode-high-contrast"
        : "vscode-dark";
    document.documentElement.classList.add(themeClass);
    document.body.classList.add(themeClass);
  }, theme);
  await page.goto(`/?app=gitWorkspaceVisual&state=${state}&theme=${theme}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("git-workspace-app")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId(stateMarkers[state]!)).toBeVisible();
}

test.describe("Visual — Git Workspace repository states", () => {
  test.skip(
    process.env.E2E_MOCK !== "1",
    "Visual suite requires E2E_MOCK=1 (mock webview preview)",
  );

  for (const state of Object.keys(stateMarkers)) {
    test(`${state} at desktop width`, async ({ page }) => {
      await openState(page, state);
      await expect(page).toHaveScreenshot(`git-workspace-${state}-dark.png`, {
        animations: "disabled",
        caret: "hide",
      });
    });
  }

  for (const [state, width] of [
    ["changed", 600],
    ["unborn-no-remote", 600],
    ["merge-conflict", 600],
    ["sync-fetch-running", 600],
    ["changed", 220],
    ["no-repository", 220],
    ["unborn-no-remote", 220],
    ["merge-conflict", 220],
    ["sync-fetch-running", 220],
    ["sync-fetch-offline", 220],
    ["sync-pull-conflicts", 220],
    ["sync-update-all-running", 220],
  ] as const) {
    test(`${state} at ${width}px`, async ({ page }) => {
      await openState(page, state, width, 900);
      if (state === "changed" && width === 220) {
        await expect(page.getByTestId("workspace-tab-log")).toBeVisible();
        await expect(page.getByTestId("workspace-tab-log")).toBeInViewport();
        await expect(page.getByTestId("git-panel-add-tab")).toBeVisible();
        await expect(page.getByTestId("git-panel-add-tab")).toBeInViewport();
      }
      await expect(page).toHaveScreenshot(
        `git-workspace-${state}-${width}-dark.png`,
        {
          animations: "disabled",
          caret: "hide",
        },
      );
    });
  }

  for (const state of [
    "no-repository",
    "merge-conflict",
    "sync-fetch-offline",
    "sync-pull-conflicts",
    "sync-update-all-running",
  ] as const) {
    test(`${state} in high contrast`, async ({ page }) => {
      await openState(page, state, 1440, 900, "high-contrast");
      await expect(page).toHaveScreenshot(
        `git-workspace-${state}-high-contrast.png`,
        {
          animations: "disabled",
          caret: "hide",
        },
      );
    });
  }
});
