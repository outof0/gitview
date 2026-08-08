import * as vscode from "vscode";
import { warnNoGitRepository } from "./gitMenuContext";
import {
  confirmRepositoryMutation,
  execGit,
  fileExistsOnDisk,
  refreshAfterGitMutation,
  resolveRepoFileUri,
  resolveRepoRootFromRelative,
  resolveWorkspaceRoot,
  toRepoRelativePath,
  type GitCommandRuntime,
} from "./gitMenuActionsHelpers";

export async function gitCherryPick(
  commitSha: string,
  workspaceRoot?: string,
  relativePath?: string,
  runtime?: GitCommandRuntime,
): Promise<void> {
  const repoRoot = await resolveRepoRootFromRelative(
    workspaceRoot,
    relativePath,
    undefined,
    runtime,
  );
  if (!repoRoot) {
    warnNoGitRepository("Cherry-Pick");
    return;
  }

  const confirmed = await confirmRepositoryMutation(
    repoRoot,
    "Cherry-Pick",
    `Cherry-pick commit ${commitSha.slice(0, 7)} into the current branch?`,
    runtime,
  );
  if (!confirmed) {
    return;
  }

  try {
    await execGit("git", ["--no-pager", "cherry-pick", commitSha], {
      cwd: repoRoot,
    }, runtime);
    await refreshAfterGitMutation(runtime);
    void vscode.window.showInformationMessage(
      `Cherry-picked commit ${commitSha.slice(0, 7)}.`,
    );
  } catch (err) {
    void vscode.window.showErrorMessage(
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function gitRevertCommit(
  commitSha: string,
  workspaceRoot?: string,
  relativePath?: string,
  runtime?: GitCommandRuntime,
): Promise<void> {
  const repoRoot = await resolveRepoRootFromRelative(
    workspaceRoot,
    relativePath,
    undefined,
    runtime,
  );
  if (!repoRoot) {
    warnNoGitRepository("Revert");
    return;
  }

  const confirmed = await confirmRepositoryMutation(
    repoRoot,
    "Revert",
    `Revert commit ${commitSha.slice(0, 7)} with a new commit?`,
    runtime,
  );
  if (!confirmed) {
    return;
  }

  try {
    await execGit("git", ["--no-pager", "revert", "--no-edit", commitSha], {
      cwd: repoRoot,
    }, runtime);
    await refreshAfterGitMutation(runtime);
    void vscode.window.showInformationMessage(
      `Reverted commit ${commitSha.slice(0, 7)}.`,
    );
  } catch (err) {
    void vscode.window.showErrorMessage(
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function gitCheckoutRevision(
  commitSha: string,
  workspaceRoot?: string,
  relativePath?: string,
  runtime?: GitCommandRuntime,
): Promise<void> {
  const repoRoot = await resolveRepoRootFromRelative(
    workspaceRoot,
    relativePath,
    undefined,
    runtime,
  );
  if (!repoRoot) {
    warnNoGitRepository("Checkout Revision");
    return;
  }

  const confirmed = await confirmRepositoryMutation(
    repoRoot,
    "Checkout Revision",
    `Checkout revision ${commitSha.slice(0, 7)} in detached HEAD?`,
    runtime,
  );
  if (!confirmed) {
    return;
  }

  try {
    await execGit("git", ["--no-pager", "checkout", "--detach", commitSha], {
      cwd: repoRoot,
    }, runtime);
    await refreshAfterGitMutation(runtime);
    void vscode.window.showInformationMessage(
      `Checked out revision ${commitSha.slice(0, 7)}.`,
    );
  } catch (err) {
    void vscode.window.showErrorMessage(
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function gitCopyCommitId(commitSha: string): Promise<void> {
  await vscode.env.clipboard.writeText(commitSha);
  void vscode.window.showInformationMessage(
    `Copied revision ${commitSha.slice(0, 7)} to clipboard.`,
  );
}

export async function gitCopyCommitMessage(message: string): Promise<void> {
  await vscode.env.clipboard.writeText(message);
  void vscode.window.showInformationMessage(
    "Copied commit message to clipboard.",
  );
}

export async function gitGetFromRevision(
  commitSha: string,
  relativePath: string,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
): Promise<void> {
  const choice = await vscode.window.showWarningMessage(
    `Replace ${relativePath} with the version from ${commitSha.slice(0, 7)}?`,
    { modal: true },
    "Get from Revision",
  );
  if (choice !== "Get from Revision") {
    return;
  }

  const root = resolveWorkspaceRoot(workspaceRoot);
  if (!root) {
    return;
  }
  const repoRoot = await resolveRepoRootFromRelative(
    workspaceRoot,
    relativePath,
    undefined,
    runtime,
  );
  if (!repoRoot) {
    warnNoGitRepository("Get from Revision");
    return;
  }
  const repoRel = toRepoRelativePath(root, repoRoot, relativePath);

  try {
    await execGit("git", ["--no-pager", "checkout", commitSha, "--", repoRel], {
      cwd: repoRoot,
    }, runtime);
    await refreshAfterGitMutation(runtime);
    void vscode.window.showInformationMessage(
      `Restored ${repoRel} from ${commitSha.slice(0, 7)}.`,
    );
  } catch (err) {
    void vscode.window.showErrorMessage(
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function gitOpenFile(
  relativePath: string,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
): Promise<void> {
  const uri = await resolveRepoFileUri(relativePath, workspaceRoot, runtime);
  if (!uri) {
    void vscode.window.showWarningMessage(
      "Could not resolve the file inside the Git repository.",
    );
    return;
  }
  if (!(await fileExistsOnDisk(uri))) {
    void vscode.window.showWarningMessage(
      `${relativePath} is not present on disk. Use Get from Revision to restore it, or open a diff instead.`,
    );
    return;
  }
  try {
    await vscode.window.showTextDocument(uri, { preview: false });
  } catch (err) {
    void vscode.window.showErrorMessage(
      err instanceof Error ? err.message : String(err),
    );
  }
}
