/**
 * Native E2E — Git Blame screen from VS Code Explorer (real Electron).
 */
import { test, expect } from "@playwright/test";
import {
  closeNativeVsCode,
  launchNativeVsCode,
  prepareCleanGitRepo,
  TEST_WORKSPACE,
} from "./helpers/native-vscode";
import {
  countBlameAnnotations,
  expectBlameCommitHistoryPanel,
  expectBlameCompactBlockLayout,
  expectGitLogGraphFitsCommitList,
  expectBlameWebviewTab,
  expectGitViewBlameScreen,
  openExplorerGitAction,
  waitForGitViewBlameFrame,
} from "./helpers/git-screen-parity";
import { createGitService } from "../out/services/gitService";
import { expectUiSurfaceAccessible } from "./helpers/ui-system-contracts";

const TARGET = "file.txt";
const MULTI_LINE_TARGET = "services.ts";
const git = createGitService();

test.describe.configure({ mode: "serial" });

test.describe("Native — Git Blame screen", () => {
  test("Annotate opens editor tab with Git Log below", async ({
    browserName: _browserName,
  }, testInfo) => {
    await prepareCleanGitRepo();
    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, TARGET, "Annotate with Git Blame");
      await expectBlameWebviewTab(session.page, TARGET);

      const repoRoot = (await git.findRepoRoot(TEST_WORKSPACE))!;
      const blame = await git.blameFile(repoRoot, "HEAD", TARGET);
      expect(blame.ok).toBe(true);
      const sample = blame.lines[0]!;

      const frame = await waitForGitViewBlameFrame(session.app);
      await expectGitViewBlameScreen(frame, {
        relativePath: TARGET,
        authorSample: sample.author,
      });
      await expectUiSurfaceAccessible(frame, "git-blame-app");
      await expectBlameCompactBlockLayout(frame, blame.lines);
      await expect(frame.getByTestId(/^blame-sha-/)).toHaveCount(
        blame.lines.length,
      );
      const annotation = frame.getByTestId("blame-sha-1");
      await expect(annotation).toContainText(sample.author);
      await expect(annotation).not.toContainText(sample.summary);
      await annotation.hover();
      await expect(frame.getByTestId("blame-commit-hover-card")).toContainText(
        sample.summary,
      );
      await expectGitLogGraphFitsCommitList(frame);
      await frame.locator('[data-graph-row="true"]').first().hover();
      await expect(frame.getByTestId("blame-commit-hover-card")).toHaveCount(0);
      await session.page.screenshot({
        path: testInfo.outputPath("git-blame-native.png"),
        animations: "disabled",
      });
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("multi-line file repeats annotation on every line", async () => {
    await prepareCleanGitRepo();
    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(
        session,
        MULTI_LINE_TARGET,
        "Annotate with Git Blame",
      );
      const repoRoot = (await git.findRepoRoot(TEST_WORKSPACE))!;
      const blame = await git.blameFile(repoRoot, "HEAD", MULTI_LINE_TARGET);
      expect(blame.ok).toBe(true);

      const frame = await waitForGitViewBlameFrame(session.app);
      await expectBlameCompactBlockLayout(frame, blame.lines);
      await expect(frame.getByTestId(/^blame-sha-/)).toHaveCount(
        blame.lines.length,
      );
      await expect(frame.locator("[data-block-lines]")).toHaveCount(
        countBlameAnnotations(blame.lines),
      );
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Clicking blame annotation focuses Git Log commit list", async () => {
    await prepareCleanGitRepo();
    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, TARGET, "Annotate with Git Blame");
      const frame = await waitForGitViewBlameFrame(session.app);
      await frame
        .getByTestId(/^blame-sha-/)
        .first()
        .click();
      await expectBlameCommitHistoryPanel(frame);
    } finally {
      await closeNativeVsCode(session);
    }
  });
});
