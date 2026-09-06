import * as vscode from "vscode";
import { toUserFacingGitError } from "../util/safeLog";
import { warnNoGitRepository } from "./gitMenuContext";
import {
  getGitCommandRuntime,
  refreshAfterGitMutation,
  resolveRepoRoot,
  type GitCommandRuntime,
} from "./gitMenuActionsHelpers";

async function assertPushSucceeded(
  repoRoot: string,
  runtime?: GitCommandRuntime,
): Promise<void> {
  const result = await getGitCommandRuntime(runtime).gitService.push(repoRoot);
  if (result.rejected || result.stderr) {
    throw new Error(
      toUserFacingGitError(result.stderr || "Git push was rejected."),
    );
  }
}

export async function gitFetch(
  resource?: vscode.Uri,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
): Promise<void> {
  try {
    const repoRoot = await resolveRepoRoot(resource, workspaceRoot, runtime);
    if (!repoRoot) {
      warnNoGitRepository("Fetch");
      return;
    }
    await getGitCommandRuntime(runtime).gitService.fetch(repoRoot);
    await refreshAfterGitMutation(runtime);
  } catch (err) {
    void vscode.window.showErrorMessage(
      toUserFacingGitError(err) || "The Git fetch operation failed.",
    );
  }
}

export async function gitPull(
  resource?: vscode.Uri,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
): Promise<void> {
  try {
    const repoRoot = await resolveRepoRoot(resource, workspaceRoot, runtime);
    if (!repoRoot) {
      warnNoGitRepository("Pull");
      return;
    }
    const resolved = getGitCommandRuntime(runtime);
    await resolved.gitService.pull(
      repoRoot,
      resolved.getUpdateStrategy?.() ?? "merge",
    );
    await refreshAfterGitMutation(runtime);
  } catch (err) {
    void vscode.window.showErrorMessage(
      toUserFacingGitError(err) || "The Git pull operation failed.",
    );
  }
}

export async function gitPush(
  resource?: vscode.Uri,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
): Promise<void> {
  try {
    const repoRoot = await resolveRepoRoot(resource, workspaceRoot, runtime);
    if (!repoRoot) {
      warnNoGitRepository("Push");
      return;
    }
    await assertPushSucceeded(repoRoot, runtime);
    await refreshAfterGitMutation(runtime);
  } catch (err) {
    void vscode.window.showErrorMessage(
      toUserFacingGitError(err) || "The Git operation failed.",
    );
  }
}

export async function gitSync(
  resource?: vscode.Uri,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
): Promise<void> {
  const repoRoot = await resolveRepoRoot(resource, workspaceRoot, runtime);
  if (!repoRoot) {
    warnNoGitRepository("Sync");
    return;
  }

  try {
    const resolved = getGitCommandRuntime(runtime);
    await resolved.gitService.pull(
      repoRoot,
      resolved.getUpdateStrategy?.() ?? "merge",
    );
    await refreshAfterGitMutation(runtime);
    await assertPushSucceeded(repoRoot, runtime);
    await refreshAfterGitMutation(runtime);
  } catch (err) {
    void vscode.window.showErrorMessage(
      toUserFacingGitError(err) || "The Git operation failed.",
    );
  }
}
