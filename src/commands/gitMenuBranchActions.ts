import * as vscode from "vscode";
import { validateBranchName } from "../shared/lib/branchName";
import type { GitMenuPresentation } from "./gitMenuPresentation";
import { warnNoGitRepository } from "./gitMenuContext";
import {
  createAndSwitchBranch,
  execGitInRepo,
  pickBranch,
  refreshAfterGitMutation,
  resolveRepoRoot,
  switchBranch,
  type GitCommandRuntime,
} from "./gitMenuActionsHelpers";

export async function gitMerge(
  resource?: vscode.Uri,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
  presentation?: GitMenuPresentation,
): Promise<void> {
  const repoRoot = await resolveRepoRoot(resource, workspaceRoot, runtime);
  if (!repoRoot) {
    warnNoGitRepository("Merge");
    return;
  }

  if (presentation?.openPanelDialog) {
    await presentation.openPanelDialog({ dialog: "merge" });
    return;
  }

  const branch = await pickBranch(
    repoRoot,
    "Merge",
    { excludeCurrent: true },
    runtime,
  );
  if (!branch) {
    return;
  }

  try {
    await execGitInRepo(repoRoot, ["merge", branch], runtime);
    await refreshAfterGitMutation(runtime);
  } catch (err) {
    void vscode.window.showErrorMessage(
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function gitRebase(
  resource?: vscode.Uri,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
  presentation?: GitMenuPresentation,
): Promise<void> {
  const repoRoot = await resolveRepoRoot(resource, workspaceRoot, runtime);
  if (!repoRoot) {
    warnNoGitRepository("Rebase");
    return;
  }

  if (presentation?.openPanelDialog) {
    await presentation.openPanelDialog({ dialog: "rebase" });
    return;
  }

  const branch = await pickBranch(
    repoRoot,
    "Rebase",
    { excludeCurrent: true },
    runtime,
  );
  if (!branch) {
    return;
  }

  try {
    await execGitInRepo(repoRoot, ["rebase", branch], runtime);
    await refreshAfterGitMutation(runtime);
  } catch (err) {
    void vscode.window.showErrorMessage(
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function gitCreateBranch(
  resource?: vscode.Uri,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
  presentation?: GitMenuPresentation,
): Promise<void> {
  const repoRoot = await resolveRepoRoot(resource, workspaceRoot, runtime);
  if (!repoRoot) {
    warnNoGitRepository("New Branch");
    return;
  }

  if (presentation?.openPanelDialog) {
    await presentation.openPanelDialog({ dialog: "createBranch" });
    return;
  }

  const branch = (
    await vscode.window.showInputBox({
      title: "New Branch",
      prompt: "Enter a branch name",
      placeHolder: "feature/name",
      validateInput: validateBranchName,
    })
  )?.trim();
  if (!branch) {
    return;
  }

  try {
    await createAndSwitchBranch(repoRoot, branch, runtime);
    await refreshAfterGitMutation(runtime);
  } catch (err) {
    void vscode.window.showErrorMessage(
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function gitCheckoutBranch(
  resource?: vscode.Uri,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
  presentation?: GitMenuPresentation,
): Promise<void> {
  const repoRoot = await resolveRepoRoot(resource, workspaceRoot, runtime);
  if (!repoRoot) {
    warnNoGitRepository("Branches");
    return;
  }

  if (presentation?.openPanelDialog) {
    await presentation.openPanelDialog({ dialog: "branches" });
    return;
  }

  const branch = await pickBranch(repoRoot, "Branches", undefined, runtime);
  if (!branch) {
    return;
  }

  try {
    await switchBranch(repoRoot, branch, runtime);
    await refreshAfterGitMutation(runtime);
  } catch (err) {
    void vscode.window.showErrorMessage(
      err instanceof Error ? err.message : String(err),
    );
  }
}
