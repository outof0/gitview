import * as vscode from "vscode";
import { warnNoGitRepository } from "./gitMenuContext";
import {
  getGitCommandRuntime,
  promptCommitMessage,
  refreshAfterGitMutation,
  repoRelativePath,
  resolveCommitMessage,
  resolveRepoRoot,
  resolveResourceUri,
  type GitCommandRuntime,
} from "./gitMenuActionsHelpers";
import type { GitMenuPresentation } from "./gitMenuPresentation";

export async function gitAdd(
  resource?: vscode.Uri,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
): Promise<void> {
  const uri = resolveResourceUri(undefined, resource, workspaceRoot);
  const repoRoot = await resolveRepoRoot(resource, workspaceRoot, runtime);
  if (!repoRoot) {
    warnNoGitRepository("Add");
    return;
  }

  try {
    const service = getGitCommandRuntime(runtime).gitService;
    if (!uri) {
      await service.stageAll(repoRoot);
    } else {
      const rel = repoRelativePath(uri, repoRoot);
      if (!rel) {
        void vscode.window.showWarningMessage(
          "Could not resolve path inside repository.",
        );
        return;
      }
      await service.stageFiles(repoRoot, [rel]);
    }
    await refreshAfterGitMutation(runtime);
  } catch (err) {
    void vscode.window.showErrorMessage(
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function gitUnstage(
  resource?: vscode.Uri,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
): Promise<void> {
  const uri = resolveResourceUri(undefined, resource, workspaceRoot);
  const repoRoot = await resolveRepoRoot(resource, workspaceRoot, runtime);
  if (!repoRoot) {
    warnNoGitRepository("Unstage");
    return;
  }

  try {
    const service = getGitCommandRuntime(runtime).gitService;
    if (!uri) {
      await service.unstageAll(repoRoot);
    } else {
      const rel = repoRelativePath(uri, repoRoot);
      if (!rel) {
        void vscode.window.showWarningMessage(
          "Could not resolve path inside repository.",
        );
        return;
      }
      await service.unstageFiles(repoRoot, [rel]);
    }
    await refreshAfterGitMutation(runtime);
  } catch (err) {
    void vscode.window.showErrorMessage(
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function gitCommit(
  resource?: vscode.Uri,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
  presentation?: GitMenuPresentation,
): Promise<void> {
  const repoRoot = await resolveRepoRoot(resource, workspaceRoot, runtime);
  if (!repoRoot) {
    warnNoGitRepository("Commit");
    return;
  }

  if (presentation?.openPanelDialog) {
    await presentation.openPanelDialog({ dialog: "commit" });
    return;
  }

  let message = await resolveCommitMessage(resource, workspaceRoot);
  if (!message) {
    message = await promptCommitMessage("Commit");
  }
  if (!message) {
    return;
  }

  try {
    const resolved = getGitCommandRuntime(runtime);
    await resolved.gitService.commit(repoRoot, {
      message,
      gpgSign: resolved.getGpgSigningDefault?.() ?? false,
    });
    await refreshAfterGitMutation(runtime);
  } catch (err) {
    void vscode.window.showErrorMessage(
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function gitCommitAndPush(
  resource?: vscode.Uri,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
  presentation?: GitMenuPresentation,
): Promise<void> {
  const repoRoot = await resolveRepoRoot(resource, workspaceRoot, runtime);
  if (!repoRoot) {
    warnNoGitRepository("Commit and Push");
    return;
  }

  if (presentation?.openPanelDialog) {
    await presentation.openPanelDialog({ dialog: "commit" });
    return;
  }

  let message = await resolveCommitMessage(resource, workspaceRoot);
  if (!message) {
    message = await promptCommitMessage("Commit and Push");
  }
  if (!message) {
    return;
  }

  try {
    const resolved = getGitCommandRuntime(runtime);
    await resolved.gitService.commit(repoRoot, {
      message,
      gpgSign: resolved.getGpgSigningDefault?.() ?? false,
    });
    await refreshAfterGitMutation(runtime);
    const pushed = await resolved.gitService.push(repoRoot);
    if (pushed.rejected || pushed.stderr) {
      throw new Error(pushed.stderr || "Git push was rejected.");
    }
    await refreshAfterGitMutation(runtime);
  } catch (err) {
    void vscode.window.showErrorMessage(
      err instanceof Error ? err.message : String(err),
    );
  }
}
