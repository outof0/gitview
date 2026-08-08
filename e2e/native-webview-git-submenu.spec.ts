/**
 * E2E: Git submenu inside GitView webview panels — real VS Code + Electron.
 *
 * Unlike Playwright+Vite preview specs, these launch VS Code via
 * @vscode/test-electron and drive the embedded webview iframes.
 */
import { test, expect } from "@playwright/test";
import * as fs from "fs/promises";
import * as path from "path";
import {
  closeNativeVsCode,
  expectGitSubmenuInFrame,
  git,
  launchNativeVsCode,
  openConflictsDialog,
  openGitWorkspace,
  openMergeResolver,
  prepareCleanGitRepo,
  prepareMergeRepo,
  TEST_WORKSPACE,
} from "./helpers/native-vscode";
import { dispatchContextMenu } from "./helpers/native-merge";


const CONFLICT_FILE = "file.txt";

test.describe.configure({ mode: "serial" });

test.describe("Conflicts dialog — real VS Code webview", () => {
  test("opens the conflicts list from the command palette", async () => {
    await prepareMergeRepo();
    const session = await launchNativeVsCode();
    try {
      const frame = await openConflictsDialog(session);
      await expect(
        frame.getByTestId(`conflicts-file-row-${CONFLICT_FILE}`),
      ).toBeVisible();
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("file row context menu exposes the full Git submenu", async () => {
    await prepareMergeRepo();
    const session = await launchNativeVsCode();
    try {
      const frame = await openConflictsDialog(session);
      await frame
        .getByTestId(`conflicts-file-row-${CONFLICT_FILE}`)
        .click({ button: "right" });
      await expect(frame.getByTestId("conflicts-context-menu")).toBeVisible();
      await expect(frame.getByTestId("conflicts-menu-accept-yours")).toBeVisible();
      await expectGitSubmenuInFrame(frame, { isFolder: false });
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Add stages only the right-clicked conflict file", async () => {
    await prepareMergeRepo();
    const marker = "# e2e native conflicts add";
    const filePath = path.join(TEST_WORKSPACE, CONFLICT_FILE);
    await fs.appendFile(filePath, `\n${marker}\n`, "utf8");

    const session = await launchNativeVsCode();
    try {
      const frame = await openConflictsDialog(session);
      await frame
        .getByTestId(`conflicts-file-row-${CONFLICT_FILE}`)
        .click({ button: "right" });
      await frame.getByTestId("git-menu-add").click();
      await expect
        .poll(async () => git(["diff", "--cached", "--", CONFLICT_FILE]), {
          timeout: 10_000,
        })
        .toContain(marker);
    } finally {
      await closeNativeVsCode(session);
      await git(["reset", "HEAD", "--", CONFLICT_FILE]).catch(() => "");
      await git(["checkout", "HEAD", "--", CONFLICT_FILE]).catch(() => "");
    }
  });
});

test.describe("Merge resolver — real VS Code webview", () => {
  test("opens merge resolver from the conflicts dialog", async () => {
    await prepareMergeRepo();
    const session = await launchNativeVsCode();
    try {
      await openMergeResolver(session, CONFLICT_FILE);
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("conflict context menu exposes resolve actions and Git submenu", async () => {
    await prepareMergeRepo();
    const session = await launchNativeVsCode();
    try {
      const frame = await openMergeResolver(session, CONFLICT_FILE);
      await dispatchContextMenu(
        frame
          .locator(
            '[data-testid="pane-left"] .nx-block[data-type="conflict"] .nx-txt',
          )
          .first(),
      );
      await expect(frame.getByTestId("merge-context-menu")).toBeVisible();
      await expect(frame.getByTestId("merge-context-accept-local")).toBeVisible();
      await expectGitSubmenuInFrame(frame, { isFolder: false });
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Show Diff opens in-webview diff preview for the merge file", async () => {
    await prepareMergeRepo();
    const session = await launchNativeVsCode();
    try {
      const frame = await openMergeResolver(session, CONFLICT_FILE);
      await dispatchContextMenu(
        frame.locator('[data-testid="pane-left"] .nx-block .nx-txt').first(),
      );
      await frame.getByTestId("git-menu-show-diff").click();
      const overlay = frame.getByTestId("git-diff-preview-overlay");
      await expect(overlay).toBeVisible({ timeout: 15_000 });
      await expect(overlay).toContainText("HEAD");
      await expect(overlay).toContainText("line1");
    } finally {
      await closeNativeVsCode(session);
    }
  });
});

test.describe("Git Workspace — real VS Code webview", () => {
  test("changes panel exposes Git submenu on a dirty file", async () => {
    await prepareCleanGitRepo();
    const target = "native-workspace-dirty.txt";
    await fs.writeFile(path.join(TEST_WORKSPACE, target), "dirty\n", "utf8");

    const session = await launchNativeVsCode();
    try {
      const frame = await openGitWorkspace(session);
      const changeRow = frame.getByTestId(`change-row-${target}`);
      await expect(changeRow).toBeVisible({ timeout: 15_000 });
      // Commit panel / chrome can intercept geometric right-clicks in narrow layouts.
      await dispatchContextMenu(changeRow);
      await expectGitSubmenuInFrame(frame, { isFolder: false });
    } finally {
      await closeNativeVsCode(session);
      await fs
        .rm(path.join(TEST_WORKSPACE, target), { force: true })
        .catch(() => "");
    }
  });
});