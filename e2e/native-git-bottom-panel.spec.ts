import { expect, test } from "@playwright/test";
import {
  closeNativeVsCode,
  launchNativeVsCode,
  openGitWorkspace,
  prepareCleanGitRepo,
  TEST_WORKSPACE,
} from "./helpers/native-vscode";

test.describe.configure({ mode: "serial" });

test("Git Bottom Panel opens as the log-only design", async ({
  browserName: _browserName,
}, testInfo) => {
  test.setTimeout(120_000);
  await prepareCleanGitRepo();

  const session = await launchNativeVsCode(TEST_WORKSPACE, {
    settings: {
      "git.autofetch": false,
      "gitView.protectedBranchPatterns": [],
    },
    width: 1400,
    height: 900,
  });
  try {
    const frame = await openGitWorkspace(session);
    const logTab = frame.getByTestId("workspace-tab-log");

    await expect(logTab).toBeVisible({ timeout: 30_000 });
    await expect(logTab).toHaveAttribute("aria-current", "page");
    await expect(frame.getByTestId("log-filters")).toBeVisible();
    await expect(frame.getByTestId("workspace-tab-changes")).toHaveCount(0);
    await expect(frame.getByTestId("gitview-git-widget")).toHaveCount(0);
    await expect(frame.getByTestId("operation-recovery-bar")).toHaveCount(0);

    await session.page.screenshot({
      path: testInfo.outputPath("git-bottom-panel-native.png"),
      animations: "disabled",
    });
  } finally {
    await closeNativeVsCode(session);
    await prepareCleanGitRepo();
  }
});
