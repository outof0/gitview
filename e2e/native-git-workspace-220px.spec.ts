import { expect, test } from "@playwright/test";
import {
  closeNativeVsCode,
  launchNativeVsCode,
  openGitWorkspace,
  prepareCleanGitRepo,
  TEST_WORKSPACE,
} from "./helpers/native-vscode";

test.describe.configure({ mode: "serial" });

test.describe("native Git Workspace 220px responsive layout", () => {
  test("renders the Git Bottom Panel log controls at 220px", async ({
    browserName: _browserName,
  }) => {
    test.setTimeout(120_000);
    await prepareCleanGitRepo();

    const session = await launchNativeVsCode(TEST_WORKSPACE, {
      settings: {
        "git.autofetch": false,
        "gitView.protectedBranchPatterns": [],
      },
      width: 220,
      height: 800,
    });
    try {
      const frame = await openGitWorkspace(session);
      const logTab = frame.getByTestId("workspace-tab-log");
      await expect(logTab).toBeVisible({ timeout: 15_000 });
      const addTab = frame.getByTestId("git-panel-add-tab");
      await expect(addTab).toBeVisible();
    } finally {
      await closeNativeVsCode(session);
      await prepareCleanGitRepo();
    }
  });
});
