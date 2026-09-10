/**
 * Native E2E — Git History screen from VS Code Explorer (real Electron).
 */
import { test, expect } from "@playwright/test";
import {
  closeNativeVsCode,
  launchNativeVsCode,
  prepareCleanGitRepo,
  TEST_WORKSPACE,
  waitForWebviewFrame,
} from "./helpers/native-vscode";
import { openExplorerGitAction } from "./helpers/git-screen-parity";
import { createGitService } from "../out/services/gitService";
import { expectUiSurfaceAccessible } from "./helpers/ui-system-contracts";

const TARGET = "README.md";
const git = createGitService();

test.describe.configure({ mode: "serial" });

test.describe("Native — Git History screen", () => {
  test("Show History opens scoped history with commits", async () => {
    await prepareCleanGitRepo();
    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, TARGET, "Show History");
      const frame = await waitForWebviewFrame(session.app, "git-workspace-app");
      await expect(frame.getByText("History · README.md")).toBeVisible();
      await expectUiSurfaceAccessible(frame, "workspace-log-panel");
      await expect(frame.getByTestId("workspace-log-diff-pane")).toBeVisible();
      const preview = frame.getByTestId("git-diff-preview");
      await expect(preview).toBeVisible();
      const marker = preview.locator(
        ".nx-monaco-diff-host .cdr.char-insert, " +
          ".nx-monaco-diff-host .cdr.char-delete, " +
          ".nx-monaco-diff-host .cmdr.char-insert, " +
          ".nx-monaco-diff-host .cmdr.char-delete",
      ).first();
      await expect(marker).toBeVisible();
      const diffColors = await preview.evaluate((element) => {
        const code = element.querySelector<HTMLElement>(
          ".nx-monaco-diff-host .cdr.char-insert, " +
            ".nx-monaco-diff-host .cdr.char-delete, " +
            ".nx-monaco-diff-host .cmdr.char-insert, " +
            ".nx-monaco-diff-host .cmdr.char-delete",
        );
        if (!code) {
          return null;
        }
        const added = code.classList.contains("char-insert");
        const hostToken = getComputedStyle(document.body).getPropertyValue(
          added
            ? "--vscode-diffEditor-insertedTextBackground"
            : "--vscode-diffEditor-removedTextBackground",
        ).trim();
        return {
          codeBackground: getComputedStyle(code).backgroundColor,
          token:
            hostToken ||
            (added
              ? "rgba(46, 160, 67, 0.22)"
              : "rgba(248, 81, 73, 0.22)"),
        };
      });
      expect(diffColors).not.toBeNull();
      expect(diffColors?.codeBackground).toBe(diffColors?.token);
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

  test("folder history lists changed files and opens a selected file in a diff tab", async () => {
    await prepareCleanGitRepo();
    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, "edge", "Show History");
      const frame = await waitForWebviewFrame(session.app, "git-workspace-app");
      await expect(frame.getByText("History · edge/")).toBeVisible();
      await expect(frame.getByTestId("workspace-log-files-pane")).toBeVisible();
      await expect(frame.getByTestId("workspace-log-diff-pane")).toHaveCount(0);
      await expect(frame.getByTestId("workspace-log-open-diff")).toHaveCount(0);
      const file = frame.locator('[data-testid^="changed-files-file-"]').first();
      await expect(file).toBeVisible();
      const selectedPath = await file.getAttribute("data-testid");
      expect(selectedPath).toBeTruthy();
      await file.click();
      const diff = await waitForWebviewFrame(session.app, "git-diff-app");
      await expect(diff.getByTestId("git-diff-app")).toBeVisible();
      const selectedName = selectedPath!.replace("changed-files-file-", "").split("/").pop();
      expect(selectedName).toBeTruthy();
      await expect(diff.getByTestId("git-compare-toolbar")).toContainText(
        selectedName!,
      );
    } finally {
      await closeNativeVsCode(session);
    }
  });
});
