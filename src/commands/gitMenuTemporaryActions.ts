import * as vscode from "vscode";
import { createStashApi } from "../services/git/stash";
import type { StashEntry } from "../shared/types/stash";
import { formatGitCommandError } from "../util/gitCommandError";
import { diffPreviewTitle } from "../util/gitDiffPreview";
import { shelveChanges, unshelveLatest } from "../util/gitShelves";
import { warnNoGitRepository } from "./gitMenuContext";
import {
  confirmRepositoryMutation,
  countWorktreeChanges,
  currentBranchName,
  getGitCommandRuntime,
  refreshAfterGitMutation,
  resolveRepoRoot,
  resolveResourceUri,
  scopePathForResource,
  type GitCommandRuntime,
} from "./gitMenuActionsHelpers";
import type { GitMenuPresentation } from "./gitMenuPresentation";
import {
  promptStashAction,
  promptStashBranchName,
  promptStashFile,
  promptStashPush,
  promptStashSelection,
} from "./stashPrompts";

function showGitActionError(actionLabel: string, err: unknown): void {
  void vscode.window.showErrorMessage(
    formatGitCommandError(err, actionLabel),
  );
}

type StashApi = ReturnType<typeof createStashApi>;

function stashApiFor(runtime?: GitCommandRuntime): StashApi {
  return createStashApi(getGitCommandRuntime(runtime).gitService.execGit);
}

export async function gitStash(
  resource?: vscode.Uri,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
  presentation?: GitMenuPresentation,
): Promise<void> {
  const repoRoot = await resolveRepoRoot(resource, workspaceRoot, runtime);
  if (!repoRoot) {
    warnNoGitRepository("Stash");
    return;
  }

  try {
    const changedCount = await countWorktreeChanges(repoRoot, runtime);
    if (changedCount === 0) {
      void vscode.window.showInformationMessage("No local changes to stash.");
      return;
    }

    const uri = resolveResourceUri(undefined, resource, workspaceRoot);

    if (presentation?.openPanelDialog) {
      await presentation.openPanelDialog({
        dialog: "stash",
        relativePath: scopePathForResource(uri, repoRoot) ?? undefined,
      });
      return;
    }

    const choice = await promptStashPush({
      branch: await currentBranchName(repoRoot, runtime),
      changedCount,
      scopePath: scopePathForResource(uri, repoRoot),
    });
    if (!choice) {
      return;
    }

    await stashApiFor(runtime).push(repoRoot, choice);
    await refreshAfterGitMutation(runtime);
  } catch (err) {
    showGitActionError("Stash", err);
  }
}

async function openStashFileDiff(
  stash: StashApi,
  repoRoot: string,
  entry: StashEntry,
  presentation: GitMenuPresentation,
  workspaceRoot?: string,
): Promise<void> {
  const { files } = await stash.listStashFiles(repoRoot, entry.index);
  if (files.length === 0) {
    void vscode.window.showInformationMessage(
      `${entry.ref} does not contain any files.`,
    );
    return;
  }

  const file = await promptStashFile(files, entry);
  if (!file) {
    return;
  }

  const document = await stash.buildStashFileDiff(
    repoRoot,
    repoRoot,
    entry.index,
    file.path,
    file.origin,
  );
  await presentation.openDiff({
    preview: {
      relativePath: file.path,
      title: diffPreviewTitle(file.path, `${entry.ref}^`, entry.ref),
      diff: {
        layout: document.layout,
        status: document.status,
        left: document.left,
        right: document.right,
        binary: document.binary,
      },
    },
    workspaceRoot,
  });
}

export async function gitUnstash(
  resource?: vscode.Uri,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
  presentation?: GitMenuPresentation,
): Promise<void> {
  const repoRoot = await resolveRepoRoot(resource, workspaceRoot, runtime);
  if (!repoRoot) {
    warnNoGitRepository("Unstash");
    return;
  }

  // Ahead of the emptiness check: the dialog renders its own empty state, so
  // returning a toast here would make the menu entry look like it did nothing.
  if (presentation?.openPanelDialog) {
    await presentation.openPanelDialog({ dialog: "unstash" });
    return;
  }

  try {
    const stash = stashApiFor(runtime);
    const stashes = await stash.listStashes(repoRoot);
    if (stashes.length === 0) {
      void vscode.window.showInformationMessage(
        "No stashed changes to restore.",
      );
      return;
    }

    const selection = await promptStashSelection(
      stashes,
      await currentBranchName(repoRoot, runtime),
    );
    if (!selection) {
      return;
    }

    if (selection.kind === "clear") {
      const confirmed = await confirmRepositoryMutation(
        repoRoot,
        "Clear Stashes",
        `Delete all ${stashes.length} stashes without restoring them? This cannot be undone.`,
        runtime,
      );
      if (confirmed) {
        await stash.clear(repoRoot);
        await refreshAfterGitMutation(runtime);
      }
      return;
    }

    const entry = selection.entry;
    const action = await promptStashAction(entry, {
      canView: Boolean(presentation),
    });
    if (!action) {
      return;
    }

    switch (action) {
      case "apply":
        await stash.apply(repoRoot, entry.index);
        break;
      case "applyReinstateIndex":
        await stash.apply(repoRoot, entry.index, { reinstateIndex: true });
        break;
      case "pop":
        await stash.pop(repoRoot, entry.index);
        break;
      case "popReinstateIndex":
        await stash.pop(repoRoot, entry.index, { reinstateIndex: true });
        break;
      case "branch": {
        const branch = await promptStashBranchName(entry);
        if (!branch) {
          return;
        }
        await stash.createBranch(repoRoot, entry.index, branch);
        break;
      }
      case "view":
        // Read-only: no mutation, so no refresh.
        await openStashFileDiff(
          stash,
          repoRoot,
          entry,
          presentation!,
          workspaceRoot,
        );
        return;
      case "drop": {
        const confirmed = await confirmRepositoryMutation(
          repoRoot,
          "Drop Stash",
          `Delete ${entry.ref} ("${entry.message}") without restoring it? This cannot be undone.`,
          runtime,
        );
        if (!confirmed) {
          return;
        }
        await stash.drop(repoRoot, entry.index);
        break;
      }
    }

    await refreshAfterGitMutation(runtime);
  } catch (err) {
    showGitActionError("Unstash", err);
  }
}

export async function gitShelve(
  resource?: vscode.Uri,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
): Promise<void> {
  const uri = resolveResourceUri(undefined, resource, workspaceRoot);
  const repoRoot = await resolveRepoRoot(resource, workspaceRoot, runtime);
  if (!repoRoot) {
    warnNoGitRepository("Shelve");
    return;
  }

  try {
    const scopePath = scopePathForResource(uri, repoRoot);
    const resolved = getGitCommandRuntime(runtime);
    const shelfRuntime =
      runtime && resolved.shelfStorage
        ? {
            execGit: resolved.gitService.execGit,
            shelfStorage: resolved.shelfStorage,
            refresh: resolved.refresh,
          }
        : undefined;
    const shelved = shelfRuntime
      ? await shelveChanges(repoRoot, scopePath, shelfRuntime)
      : await shelveChanges(repoRoot, scopePath);
    if (!shelved) {
      void vscode.window.showInformationMessage("No changes to shelve.");
      return;
    }
  } catch (err) {
    showGitActionError("Shelve", err);
  }
}

export async function gitUnshelve(
  resource?: vscode.Uri,
  workspaceRoot?: string,
  runtime?: GitCommandRuntime,
): Promise<void> {
  const repoRoot = await resolveRepoRoot(resource, workspaceRoot, runtime);
  if (!repoRoot) {
    warnNoGitRepository("Unshelve");
    return;
  }

  try {
    const resolved = getGitCommandRuntime(runtime);
    const shelfRuntime =
      runtime && resolved.shelfStorage
        ? {
            execGit: resolved.gitService.execGit,
            shelfStorage: resolved.shelfStorage,
            refresh: resolved.refresh,
          }
        : undefined;
    const restored = shelfRuntime
      ? await unshelveLatest(repoRoot, shelfRuntime)
      : await unshelveLatest(repoRoot);
    if (!restored) {
      void vscode.window.showInformationMessage("No shelved changes to restore.");
      return;
    }
  } catch (err) {
    showGitActionError("Unshelve", err);
  }
}
