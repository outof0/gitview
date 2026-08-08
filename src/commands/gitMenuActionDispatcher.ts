import * as vscode from "vscode";
import type { GitViewContext } from "../application/gitViewContext";
import type { GitMenuActionPayload } from "../types/gitMenu";
import {
  gitAdd,
  gitCommit,
  gitCommitAndPush,
  gitUnstage,
} from "./gitMenuStagingActions";
import {
  gitFetch,
  gitPull,
  gitPush,
  gitSync,
} from "./gitMenuSyncActions";
import {
  gitShelve,
  gitStash,
  gitUnshelve,
  gitUnstash,
} from "./gitMenuTemporaryActions";
import {
  gitCheckoutBranch,
  gitCreateBranch,
  gitMerge,
  gitRebase,
} from "./gitMenuBranchActions";
import {
  gitCherryPick,
  gitCheckoutRevision,
  gitCopyCommitId,
  gitCopyCommitMessage,
  gitGetFromRevision,
  gitOpenFile,
  gitRevertCommit,
} from "./gitMenuHistoryActions";
import {
  gitAnnotateBlame,
  gitCompareWithBranch,
  gitCompareWithLocal,
  gitCompareWithRevision,
  gitRollback,
  gitShowDiff,
  gitShowHistory,
  gitShowRevisionDiff,
  type DiffPreviewPoster,
} from "./gitMenuDiffActions";
import {
  resolveRepoFileUri,
  resolveResourceUri,
} from "./gitMenuActionsHelpers";

export type { DiffPreviewPoster };

/** Central dispatcher for webview git:menuAction messages. */
export async function runGitMenuAction(
  context: vscode.ExtensionContext,
  payload: GitMenuActionPayload,
  workspaceRoot?: string,
  postDiffPreview?: DiffPreviewPoster,
  gitView?: GitViewContext,
): Promise<void> {
  const runtime = gitView?.commandRuntime;
  const presentation = gitView?.gitMenuPresentation;
  let uri = resolveResourceUri(payload.relativePath, undefined, workspaceRoot);
  if (!uri && payload.relativePath) {
    uri = await resolveRepoFileUri(payload.relativePath, workspaceRoot, runtime);
  }
  const { action, commitSha, commitMessage, isFolder } = payload;

  switch (action) {
    case "showHistory":
    case "showHistoryForFile":
      if (!gitView) {
        break;
      }
      if (payload.relativePath) {
        if (!workspaceRoot) {
          throw new Error("Git history requires a workspace root.");
        }
        await gitView.gitMenuPresentation.openHistory({
          relativePath: payload.relativePath,
          isFolder: isFolder ?? false,
          workspaceRoot,
        });
      } else if (uri) {
        await gitShowHistory(context, gitView, uri);
      }
      break;
    case "compareWithRevision":
      await gitCompareWithRevision(
        context,
        uri,
        workspaceRoot,
        postDiffPreview,
        runtime,
        presentation,
      );
      break;
    case "compareWithBranch":
      await gitCompareWithBranch(
        context,
        uri,
        workspaceRoot,
        postDiffPreview,
        runtime,
        presentation,
      );
      break;
    case "showDiff":
      await gitShowDiff(
        context,
        uri,
        workspaceRoot,
        postDiffPreview,
        runtime,
        presentation,
      );
      break;
    case "annotateBlame":
      if (!gitView) {
        break;
      }
      await gitAnnotateBlame(context, gitView, uri, workspaceRoot);
      break;
    case "rollback":
      await gitRollback(uri, workspaceRoot, runtime);
      break;
    case "add":
      await gitAdd(uri, workspaceRoot, runtime);
      break;
    case "unstage":
      await gitUnstage(uri, workspaceRoot, runtime);
      break;
    case "commit":
      await gitCommit(uri, workspaceRoot, runtime, presentation);
      break;
    case "commitAndPush":
      await gitCommitAndPush(uri, workspaceRoot, runtime, presentation);
      break;
    case "fetch":
      await gitFetch(uri, workspaceRoot, runtime);
      break;
    case "pull":
      await gitPull(uri, workspaceRoot, runtime);
      break;
    case "push":
      await gitPush(uri, workspaceRoot, runtime);
      break;
    case "sync":
      await gitSync(uri, workspaceRoot, runtime);
      break;
    case "checkoutBranch":
      await gitCheckoutBranch(uri, workspaceRoot, runtime, presentation);
      break;
    case "createBranch":
      await gitCreateBranch(uri, workspaceRoot, runtime, presentation);
      break;
    case "stash":
      await gitStash(uri, workspaceRoot, runtime, presentation);
      break;
    case "unstash":
      await gitUnstash(uri, workspaceRoot, runtime, presentation);
      break;
    case "shelve":
      await gitShelve(uri, workspaceRoot, runtime);
      break;
    case "unshelve":
      await gitUnshelve(uri, workspaceRoot, runtime);
      break;
    case "openConflictResolver":
      await vscode.commands.executeCommand("gitView.open");
      break;
    case "merge":
      await gitMerge(uri, workspaceRoot, runtime, presentation);
      break;
    case "rebase":
      await gitRebase(uri, workspaceRoot, runtime, presentation);
      break;
    case "cherryPick":
      if (commitSha) {
        await gitCherryPick(
          commitSha,
          workspaceRoot,
          payload.relativePath,
          runtime,
        );
      }
      break;
    case "revertCommit":
      if (commitSha) {
        await gitRevertCommit(
          commitSha,
          workspaceRoot,
          payload.relativePath,
          runtime,
        );
      }
      break;
    case "checkoutRevision":
      if (commitSha) {
        await gitCheckoutRevision(
          commitSha,
          workspaceRoot,
          payload.relativePath,
          runtime,
        );
      }
      break;
    case "copyCommitId":
      if (commitSha) {
        await gitCopyCommitId(commitSha);
      }
      break;
    case "copyCommitMessage":
      if (commitMessage) {
        await gitCopyCommitMessage(commitMessage);
      }
      break;
    case "getFromRevision":
      if (commitSha && payload.relativePath) {
        await gitGetFromRevision(
          commitSha,
          payload.relativePath,
          workspaceRoot,
          runtime,
        );
      }
      break;
    case "openFile":
      if (payload.relativePath) {
        await gitOpenFile(payload.relativePath, workspaceRoot, runtime);
      }
      break;
    case "compareWithLocal":
      if (commitSha && payload.relativePath) {
        await gitCompareWithLocal(
          context,
          commitSha,
          payload.relativePath,
          workspaceRoot,
          postDiffPreview,
          runtime,
          presentation,
        );
      }
      break;
    case "showRevisionDiff":
      if (commitSha && payload.relativePath) {
        await gitShowRevisionDiff(
          context,
          commitSha,
          payload.relativePath,
          workspaceRoot,
          postDiffPreview,
          payload.reuseDiffPanel,
          payload.openInActiveColumn,
          runtime,
          presentation,
        );
      }
      break;
    default:
      break;
  }
}
