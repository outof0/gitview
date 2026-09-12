import * as vscode from "vscode";
import * as path from "node:path";
import type { GitViewContext } from "../application/gitViewContext";
import type { GitMenuPresentation } from "../commands/gitMenuPresentation";
import { createHostEvent } from "../shared/protocol";
import { openGitCreateBranchPanel } from "./gitCreateBranchPanel";
import { openGitCommitPanel } from "./gitCommitPanel";
import { openGitBranchesPanel } from "./gitBranchesPanel";
import {
  openGitWorkspaceDialog,
  openGitWorkspaceContentDialog,
  openGitWorkspaceHistory,
  openGitWorkspaceRollback,
  selectGitWorkspaceCommit,
} from "./gitWorkspacePanel";
import {
  getGitViewOverlayTarget,
  openGitViewBlamePanel,
  openGitViewPanel,
} from "./gitViewPresentation";
import { resolveRepoIdForResource } from "./gitViewPanelRouter";

function repoRelativeHistoryPath(
  repository: { rootPath: string } | null | undefined,
  workspaceRoot: string,
  relativePath: string,
): string {
  if (!repository) {
    return relativePath;
  }
  const resourcePath =
    !relativePath || relativePath === "."
      ? workspaceRoot
      : path.join(workspaceRoot, relativePath);
  const repoPath = path.relative(repository.rootPath, resourcePath);
  if (
    !repoPath ||
    repoPath === "."
  ) {
    return ".";
  }
  if (
    path.isAbsolute(repoPath) ||
    repoPath === ".." ||
    repoPath.startsWith(`..${path.sep}`)
  ) {
    return relativePath;
  }
  return repoPath.replace(/\\/g, "/");
}

/** Composition-root adapter from command presentation requests to VS Code panels. */
export function createGitMenuPresentation(
  context: vscode.ExtensionContext,
  getGitView: () => GitViewContext,
): GitMenuPresentation {
  return {
    async openHistory(request) {
      const gitView = getGitView();
      const repoId = await resolveRepoIdForResource(
        gitView,
        request.workspaceRoot,
        request.relativePath,
      );
      if (!repoId) {
        void vscode.window.showErrorMessage(
          "GitView could not find a Git repository for this resource.",
        );
        return;
      }
      const repository = gitView.repositoryService?.getCached?.(repoId);
      await openGitWorkspaceHistory(context, gitView, {
        repoId,
        path: repoRelativeHistoryPath(
          repository,
          request.workspaceRoot,
          request.relativePath,
        ),
        isFolder: request.isFolder,
      });
    },
    async openDiff(request) {
      const gitView = getGitView();
      await openGitViewPanel(
        context,
        request.preview,
        request.workspaceRoot,
        {
          reusePanel: request.reusePanel,
          openInActiveColumn: request.openInActiveColumn,
          logger: gitView.logger,
          getGitView,
        },
      );
    },
    async openBlame(request) {
      const gitView = getGitView();
      await openGitViewBlamePanel(
        context,
        gitView,
        {
          relativePath: request.relativePath,
          lines: [],
          loading: true,
          focusLine: request.focusLine,
        },
        request.workspaceRoot,
        request.repoRoot,
      );
      const repoId = await resolveRepoIdForResource(
        gitView,
        request.repoRoot,
        request.relativePath,
      );
      if (!repoId) {
        void vscode.window.showErrorMessage(
          "GitView could not find a Git repository for this resource.",
        );
        return;
      }
      const repository = gitView.repositoryService?.getCached?.(repoId);
      await openGitWorkspaceHistory(context, gitView, {
        repoId,
        path: repoRelativeHistoryPath(
          repository,
          // Annotate passes a repository-relative path, so resolve it from
          // the repository root even when that repository is nested in the
          // workspace. A normal Show History request remains workspace-based.
          request.repoRoot ?? request.workspaceRoot,
          request.relativePath,
        ),
        isFolder: false,
        showDiff: false,
      });
    },
    async selectCommit(request) {
      await selectGitWorkspaceCommit(context, getGitView(), request);
    },
    async openPanelDialog(request) {
      const gitView = getGitView();
      if (request.dialog === "stash" || request.dialog === "unstash") {
        let repoId: string | undefined;
        const resolveRoot = request.repoRoot ?? request.workspaceRoot;
        if (resolveRoot) {
          repoId =
            (await resolveRepoIdForResource(gitView, resolveRoot, ".")) ??
            undefined;
          if (!repoId) {
            void vscode.window.showErrorMessage(
              "Could not find a Git repository for this action.",
            );
            return;
          }
        }
        await openGitWorkspaceContentDialog(context, gitView, {
          dialog: request.dialog,
          ...(request.index !== undefined ? { index: request.index } : {}),
          ...(repoId ? { repoId } : {}),
        });
        return;
      }
      await openGitWorkspaceDialog(context, gitView, request);
    },
    async openRollbackConfirmation(request) {
      const gitView = getGitView();
      // `gitRollback` has already resolved the Git toplevel and its
      // `relativePath` is relative to that repository (not necessarily to the
      // VS Code workspace folder when a nested repository is open). Resolve
      // the id from the same root so the content dialog cannot target the
      // parent repository by accident.
      const repoId = await resolveRepoIdForResource(
        gitView,
        request.repoRoot,
        request.relativePath,
      );
      if (!repoId) {
        void vscode.window.showErrorMessage(
          "Could not find a Git repository for this action.",
        );
        return;
      }
      await openGitWorkspaceRollback(context, gitView, {
        repoId,
        path: request.relativePath,
        ...(request.selectedPaths
          ? { selectedPaths: request.selectedPaths }
          : {}),
      });
    },
    async openCreateBranchDialog(request) {
      const gitView = getGitView();
      // The command already resolved the repository from the clicked
      // resource; re-resolving from the workspace root would land on the
      // parent of a nested repository. Without an explicit root the legacy
      // workspace-root resolution applies unchanged.
      const resolveRoot = request.repoRoot ?? request.workspaceRoot;
      let repoId = request.repoId;
      if (!repoId) {
        repoId =
          (await resolveRepoIdForResource(
            gitView,
            resolveRoot,
            ".",
          )) ?? undefined;
      }
      if (!repoId) {
        void vscode.window.showErrorMessage(
          "Could not find a Git repository for this action.",
        );
        return;
      }
      if (await postBranchOverlay("createBranch", repoId, request.startPoint)) {
        return;
      }
      await openGitCreateBranchPanel(context, gitView, {
        repoId,
        workspaceRoot: request.workspaceRoot,
        startPoint: request.startPoint,
      });
    },
    async openCommitDialog(request) {
      const gitView = getGitView();
      let repoId = request.repoId;
      if (!repoId) {
        repoId =
          (await resolveRepoIdForResource(
            gitView,
            request.workspaceRoot,
            ".",
          )) ?? undefined;
      }
      if (!repoId) {
        void vscode.window.showErrorMessage(
          "Could not find a Git repository for this action.",
        );
        return;
      }
      await openGitCommitPanel(context, gitView, {
        repoId,
        workspaceRoot: request.workspaceRoot,
      });
    },
    async openBranchesDialog(request) {
      const gitView = getGitView();
      // The command already resolved the repository from the clicked
      // resource; re-resolving from the workspace root would land on the
      // parent of a nested repository. Without an explicit root the legacy
      // workspace-root resolution applies unchanged.
      const resolveRoot = request.repoRoot ?? request.workspaceRoot;
      let repoId = request.repoId;
      if (!repoId) {
        repoId =
          (await resolveRepoIdForResource(
            gitView,
            resolveRoot,
            ".",
          )) ?? undefined;
      }
      if (!repoId) {
        void vscode.window.showErrorMessage(
          "Could not find a Git repository for this action.",
        );
        return;
      }
      if (await postBranchOverlay("branches", repoId)) {
        return;
      }
      await openGitBranchesPanel(context, gitView, {
        repoId,
        workspaceRoot: request.workspaceRoot,
      });
    },
  };
}

/**
 * Render New Branch / Branches on a GitView editor tab that is already open
 * instead of opening a new one. Resolves true only when a tab registered for
 * this repository acknowledged the message; anything else falls through to a
 * dedicated panel. The caller must not treat an unacknowledged post as shown.
 */
async function postBranchOverlay(
  surface: "createBranch" | "branches",
  repoId: string,
  startPoint?: string,
): Promise<boolean> {
  const target = getGitViewOverlayTarget(repoId);
  if (!target) {
    return false;
  }
  target.reveal();
  return target.deliver(
    createHostEvent("git.openOverlay", { surface, repoId, startPoint }),
  );
}
