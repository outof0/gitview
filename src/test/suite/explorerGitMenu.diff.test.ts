/**
 * VS Code integration: Explorer / Editor / SCM right-click → Git submenu.
 */
import * as assert from "assert";
import * as fs from "fs/promises";
import * as vscode from "vscode";
import {
  executeGitMenuCommand,
  isTestDialogRefusal,
  findExtension,
  uri,
  git,
  waitFor,
  hasDiffTabFor,
  hasGitViewPanelFor,
  tabLabels,
  acceptQuickPickUntil,
  closeAllEditors,
} from "./explorerGitMenu.helpers";

suite("Explorer Git context menu (integration)", () => {
  suiteSetup(async function () {
    this.timeout(60_000);
    const ext = findExtension();
    assert.ok(ext, "gitview extension should be loaded");
    await ext!.activate();
  });

  test("Add and Unstage mutate the Git index for the right-clicked file", async function () {
    this.timeout(20_000);
    const relativePath = "submenu-functional-stage.txt";
    const fileUri = uri(relativePath);

    try {
      await fs.writeFile(fileUri.fsPath, "submenu e2e staging\n", "utf8");

      await vscode.commands.executeCommand("gitView.gitAdd", fileUri);
      await waitFor(async () => {
        const indexed = await git([
          "diff",
          "--cached",
          "--name-only",
          "--",
          relativePath,
        ]);
        return indexed.trim() === relativePath;
      }, "gitAdd should stage the right-clicked file");

      await vscode.commands.executeCommand("gitView.gitUnstage", fileUri);
      await waitFor(async () => {
        const indexed = await git([
          "diff",
          "--cached",
          "--name-only",
          "--",
          relativePath,
        ]);
        return indexed.trim() === "";
      }, "gitUnstage should remove the right-clicked file from the index");
    } finally {
      await git(["reset", "--", relativePath]).catch(() => "");
      await fs.rm(fileUri.fsPath, { force: true });
    }
  });

  test("Show Diff opens a GitView diff panel for the right-clicked file", async function () {
    this.timeout(20_000);
    const relativePath = ".github/workflows/ci.yml";
    const fileUri = uri(relativePath);

    try {
      await closeAllEditors();
      await fs.appendFile(fileUri.fsPath, "\n# submenu diff e2e\n", "utf8");
      await vscode.commands.executeCommand("gitView.gitShowDiff", fileUri);
      await waitFor(
        () =>
          hasGitViewPanelFor(fileUri) || hasDiffTabFor(fileUri),
        "gitShowDiff should open a GitView diff panel for the right-clicked file",
      );
    } finally {
      await git(["checkout", "--", relativePath]).catch(() => "");
    }
  });

  test("Show Diff accepts serialized submenu resource args", async function () {
    this.timeout(20_000);
    const relativePath = ".github/workflows/ci.yml";
    const fileUri = uri(relativePath);
    const serializedResource = {
      scheme: fileUri.scheme,
      authority: fileUri.authority,
      path: fileUri.path,
      fsPath: fileUri.fsPath,
    };

    try {
      await closeAllEditors();
      await fs.appendFile(fileUri.fsPath, "\n# submenu serialized diff e2e\n", "utf8");
      await vscode.commands.executeCommand(
        "gitView.gitShowDiff",
        serializedResource,
      );
      await waitFor(
        () =>
          hasGitViewPanelFor(fileUri) || hasDiffTabFor(fileUri),
        "gitShowDiff should coerce serialized submenu args into a GitView diff panel",
      );
    } finally {
      await git(["checkout", "--", relativePath]).catch(() => "");
    }
  });

  test("Compare with Revision selects a revision and opens a diff panel", async function () {
    this.timeout(20_000);
    const relativePath = ".github/workflows/ci.yml";
    const fileUri = uri(relativePath);

    await closeAllEditors();
    await acceptQuickPickUntil(
      vscode.commands.executeCommand(
        "gitView.gitCompareWithRevision",
        fileUri,
      ),
    );
    await waitFor(
      () =>
        hasGitViewPanelFor(fileUri) || hasDiffTabFor(fileUri),
      "gitCompareWithRevision should open a diff panel for the right-clicked file",
    );
  });

  test("Compare with Branch selects a branch and opens a comparison diff panel", async function () {
    this.timeout(20_000);
    const relativePath = ".github/workflows/ci.yml";
    const fileUri = uri(relativePath);

    await closeAllEditors();
    await acceptQuickPickUntil(
      vscode.commands.executeCommand("gitView.gitCompareWithBranch", fileUri),
    );
    await waitFor(
      () =>
        hasGitViewPanelFor(fileUri) || hasDiffTabFor(fileUri),
      "gitCompareWithBranch should open a diff panel for the right-clicked file",
    );
  });

  test("Rollback reaches confirmation and leaves disk unchanged when blocked", async function () {
    this.timeout(20_000);
    const relativePath = ".github/workflows/ci.yml";
    const fileUri = uri(relativePath);
    const before = await fs.readFile(fileUri.fsPath, "utf8");
    const edited = `${before}\n# rollback blocked e2e\n`;

    try {
      await fs.writeFile(fileUri.fsPath, edited, "utf8");
      try {
        await executeGitMenuCommand("gitView.gitRollback", fileUri, {
          timeoutMs: 5_000,
        });
      } catch (err) {
        assert.ok(
          isTestDialogRefusal(err),
          `unexpected rollback error: ${err instanceof Error ? err.message : err}`,
        );
      }
      assert.strictEqual(
        await fs.readFile(fileUri.fsPath, "utf8"),
        edited,
        "rollback must not discard edits unless the user confirms",
      );
    } finally {
      await git(["checkout", "--", relativePath]).catch(() => "");
    }
  });

  test("gitView.open from Git submenu opens merge resolver during active merge", async function () {
    this.timeout(30_000);
    const fileUri = uri("file.txt");
    await vscode.commands.executeCommand("gitView.open", fileUri);
    await waitFor(
      () => tabLabels().includes("GitView"),
      "gitView.open from context menu should create the merge resolver panel",
    );
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });
});
