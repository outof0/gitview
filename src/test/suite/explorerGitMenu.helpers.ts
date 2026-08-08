/**
 * Shared helpers for Explorer Git context menu integration tests.
 */
import * as assert from "assert";
import { execFile } from "child_process";
import * as path from "path";
import { promisify } from "util";
import * as vscode from "vscode";

import {
  tabLabels,
} from "../helpers/gitMenuIntegration";

export {
  executeGitMenuCommand,
  isTestDialogRefusal,
  tabLabels,
} from "../helpers/gitMenuIntegration";

const exec = promisify(execFile);

export function findExtension(): vscode.Extension<unknown> | undefined {
  return vscode.extensions.all.find(
    (e) => (e.packageJSON as { name?: string })?.name === "gitview",
  );
}

export function workspaceRoot(): string {
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder, "expected test-conflict-repo workspace folder");
  return folder.uri.fsPath;
}

export function uri(...segments: string[]): vscode.Uri {
  return vscode.Uri.file(path.join(workspaceRoot(), ...segments));
}

export async function git(args: string[]): Promise<string> {
  return gitAt(workspaceRoot(), args);
}

export async function gitAt(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await exec("git", args, { cwd });
  return stdout;
}

export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  message: string,
  timeoutMs = 5_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) {
        return;
      }
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  const suffix =
    lastError instanceof Error ? ` Last error: ${lastError.message}` : "";
  assert.fail(`${message}.${suffix}`);
}

export function hasDiffTabFor(resource: vscode.Uri): boolean {
  return vscode.window.tabGroups.all.some((group) =>
    group.tabs.some((tab) => {
      const input = tab.input;
      return (
        input instanceof vscode.TabInputTextDiff &&
        input.modified.scheme === "file" &&
        input.modified.fsPath === resource.fsPath
      );
    }),
  );
}

/** GitView diff panel (git CLI) — primary surface when built-in git diff is unavailable. */
export function hasGitViewPanelFor(resource: vscode.Uri): boolean {
  const base = path.basename(resource.fsPath);
  return tabLabels().some(
    (label) => label.includes(base) && /↔|Working Tree|HEAD/.test(label),
  );
}

export function hasGitViewBlamePanelFor(relativePath: string): boolean {
  const fileName = path.basename(relativePath);
  return tabLabels().some((label) => label.trim() === fileName);
}

export function hasEditorTabFor(resource: vscode.Uri): boolean {
  return vscode.window.tabGroups.all.some((group) =>
    group.tabs.some((tab) => {
      const input = tab.input;
      return (
        input instanceof vscode.TabInputText &&
        input.uri.fsPath === resource.fsPath
      );
    }),
  );
}

export async function acceptQuickPickUntil<T>(thenable: Thenable<T>): Promise<T> {
  let settled = false;
  const promise = Promise.resolve(thenable);
  const acceptLoop = (async () => {
    while (!settled) {
      await new Promise((r) => setTimeout(r, 100));
      await vscode.commands
        .executeCommand("workbench.action.acceptSelectedQuickOpenItem")
        .then(
          () => undefined,
          () => undefined,
        );
    }
  })();

  try {
    return await promise;
  } finally {
    settled = true;
    await acceptLoop;
  }
}

export async function closeAllEditors(): Promise<void> {
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
}

export async function vscodeGitRepository(): Promise<{
  inputBox: { value: string };
}> {
  const extension = vscode.extensions.getExtension("vscode.git");
  assert.ok(extension, "built-in vscode.git extension should be available");
  const exports = await extension.activate();
  const api = (exports as { getAPI(version: 1): { repositories: unknown[] } })
    .getAPI(1);
  const repository = api.repositories.find((repo) => {
    const rootUri = (repo as { rootUri?: vscode.Uri }).rootUri;
    return rootUri?.fsPath === workspaceRoot();
  });
  assert.ok(repository, "vscode.git should track the test workspace repository");
  return repository as { inputBox: { value: string } };
}

export const FUNCTIONAL_COVERAGE = new Map<string, string[]>([
  ["gitView.showGitHistory", ["opens file history", "opens folder history"]],
  ["gitView.gitCompareWithRevision", ["selects revision and opens diff editor"]],
  ["gitView.gitCompareWithBranch", ["selects branch and opens comparison diff"]],
  ["gitView.gitShowDiff", ["opens working-tree diff editor"]],
  ["gitView.gitAnnotateBlame", ["opens single GitView blame panel without editor tab"]],
  ["gitView.gitRollback", ["blocked confirmation does not mutate disk"]],
  ["gitView.gitAdd", ["stages right-clicked file in Git index"]],
  ["gitView.gitUnstage", ["unstages right-clicked file in Git index"]],
  ["gitView.gitCommit", ["creates commit from staged Explorer repository"]],
  ["gitView.gitCommitAndPush", ["creates commit and pushes it to remote"]],
  ["gitView.gitFetch", ["fetches from configured remote"]],
  ["gitView.gitPull", ["fast-forwards from configured remote"]],
  ["gitView.gitPush", ["pushes local commit to configured remote"]],
  ["gitView.gitSync", ["syncs local commit to configured remote"]],
  ["gitView.gitCheckoutBranch", ["opens branch checkout workflow safely"]],
  ["gitView.gitCreateBranch", ["opens branch creation workflow safely"]],
  ["gitView.gitStash", ["opens stash workflow safely"]],
  ["gitView.gitUnstash", ["opens unstash workflow safely"]],
  ["gitView.gitShelve", ["shelves working tree changes outside Git stash"]],
  ["gitView.gitUnshelve", ["restores the latest shelved change"]],
  ["gitView.gitMerge", ["opens merge workflow safely"]],
  ["gitView.gitRebase", ["opens rebase workflow safely"]],
  ["gitView.open", ["opens merge resolver panel during active merge"]],
]);
