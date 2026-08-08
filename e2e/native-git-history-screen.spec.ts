/**
 * Native E2E — Git History screen from VS Code Explorer (real Electron).
 */
import { test, expect } from "@playwright/test";
import {
  closeNativeVsCode,
  launchNativeVsCode,
  prepareCleanGitRepo,
} from "./helpers/native-vscode";
import {
  expectHistoryWebviewTab,
  expectGitViewHistoryScreen,
  openExplorerGitAction,
  waitForGitViewHistoryFrame,
} from "./helpers/git-screen-parity";
import { createGitService } from "../out/services/gitService";
import { TEST_WORKSPACE } from "./helpers/native-vscode";

const TARGET = "README.md";
const git = createGitService();

test.describe.configure({ mode: "serial" });

test.describe("Native — Git History screen", () => {
  test("Show History opens scoped history with commits", async () => {
    await prepareCleanGitRepo();
    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, TARGET, "Show History");
      await expectHistoryWebviewTab(session.page, "README.md");

      const frame = await waitForGitViewHistoryFrame(session.app);
      await expectGitViewHistoryScreen(frame, TARGET);

      const repoRoot = (await git.findRepoRoot(TEST_WORKSPACE))!;
      const log = await git.logFile(repoRoot, TARGET, { limit: 5 });
      if (log.ok && log.commits[0]) {
        await expect(frame.getByTestId("git-commit-list")).toContainText(
          log.commits[0].subject,
        );
      }
    } finally {
      await closeNativeVsCode(session);
    }
  });
});