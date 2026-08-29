import * as vscode from "vscode";
import type { GitViewContext } from "../application/gitViewContext";
import type { GitMenuPresentation } from "../commands/gitMenuPresentation";
import { openGitCreateBranchPanel } from "./gitCreateBranchPanel";
import { openGitCommitPanel } from "./gitCommitPanel";
import { openGitBranchesPanel } from "./gitBranchesPanel";
import { openGitHistoryPanel } from "./GitHistoryWebviewPanel";
import { openGitWorkspaceDialog } from "./gitWorkspacePanel";
import { openGitViewBlamePanel, openGitViewPanel } from "./gitViewPresentation";
import { resolveRepoIdForResource } from "./gitViewPanelRouter";

/** Composition-root adapter from command presentation requests to VS Code panels. */
export function createGitMenuPresentation(
  context: vscode.ExtensionContext,
  getGitView: () => GitViewContext,
): GitMenuPresentation {
  return {
    async openHistory(request) {
      await openGitHistoryPanel(
        context,
        getGitView(),
        request.relativePath,
        request.isFolder,
        request.workspaceRoot,
      );
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
      await openGitViewBlamePanel(
        context,
        getGitView(),
        {
          relativePath: request.relativePath,
          lines: [],
          loading: true,
          focusLine: request.focusLine,
        },
        request.workspaceRoot,
        request.repoRoot,
      );
    },
    async openPanelDialog(request) {
      await openGitWorkspaceDialog(context, getGitView(), request);
    },
    async openCreateBranchDialog(request) {
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
      await openGitBranchesPanel(context, gitView, {
        repoId,
        workspaceRoot: request.workspaceRoot,
      });
    },
  };
}
