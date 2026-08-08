import { type WebviewToHost } from "../shared/protocol";
import type { MessageRouterContext } from "./messageRouterContext";

export async function dispatchLog(
  request: WebviewToHost,
  ctx: MessageRouterContext,
): Promise<boolean> {
  const { logHandlers } = ctx;
  switch (request.type) {
      case "log.query":
        await logHandlers.query(request.requestId, request.payload.repoId, {
          branch: request.payload.branch,
          limit: request.payload.limit,
          author: request.payload.author,
          since: request.payload.since,
          until: request.payload.until,
          path: request.payload.path,
          isFolder: request.payload.isFolder,
          scope: request.payload.scope,
          grep: request.payload.grep,
          range: request.payload.range,
          noMerges: request.payload.noMerges,
          firstParent: request.payload.firstParent,
          collapseLinear: request.payload.collapseLinear,
          graphSort: request.payload.graphSort,
          highlightCurrentBranch: request.payload.highlightCurrentBranch,
          compactRows: request.payload.compactRows,
        });
        return true;

      case "log.fileDiff":
        await logHandlers.fileDiff(
          request.requestId,
          request.payload.repoId,
          request.payload.sha,
          request.payload.path,
          request.payload.status,
        );
        return true;

      case "log.commitDetail":
        await logHandlers.commitDetail(
          request.requestId,
          request.payload.repoId,
          request.payload.sha,
        );
        return true;

      case "log.fileAtRevision":
        await logHandlers.fileAtRevision(
          request.requestId,
          request.payload.repoId,
          request.payload.sha,
          request.payload.path,
        );
        return true;

      case "log.cherryPick":
        await logHandlers.cherryPick(
          request.requestId,
          request.payload.repoId,
          request.payload.sha,
        );
        return true;

      case "log.cherryPickMultiple":
        await logHandlers.cherryPickMultiple(
          request.requestId,
          request.payload.repoId,
          request.payload.shas,
        );
        return true;

      case "log.cherryPickSelected":
        await logHandlers.cherryPickSelected(
          request.requestId,
          request.payload.repoId,
          request.payload.sha,
          request.payload.path,
          request.payload.hunkIndexes,
          request.payload.lines,
          request.payload.checkOnly,
        );
        return true;

      case "log.revert":
        await logHandlers.revert(
          request.requestId,
          request.payload.repoId,
          request.payload.sha,
        );
        return true;

      case "log.revertMultiple":
        await logHandlers.revertMultiple(
          request.requestId,
          request.payload.repoId,
          request.payload.shas,
        );
        return true;

      case "log.revertSelected":
        await logHandlers.revertSelected(
          request.requestId,
          request.payload.repoId,
          request.payload.sha,
          request.payload.path,
          request.payload.hunkIndexes,
          request.payload.lines,
          request.payload.checkOnly,
        );
        return true;

      case "log.dropSelectedChanges":
        await logHandlers.dropSelectedChanges(
          request.requestId,
          request.payload.repoId,
          request.payload.sha,
          request.payload.path,
          request.payload.hunkIndexes,
          request.payload.lines,
          request.payload.confirmed,
        );
        return true;

      case "log.reset":
        await logHandlers.reset(
          request.requestId,
          request.payload.repoId,
          request.payload.sha,
          request.payload.mode,
          request.payload.confirmed,
        );
        return true;

      case "log.undoLastCommit":
        await logHandlers.undoLastCommit(
          request.requestId,
          request.payload.repoId,
          request.payload.confirmed,
        );
        return true;

      case "log.createBranchFromCommit":
        await logHandlers.createBranchFromCommit(
          request.requestId,
          request.payload.repoId,
          request.payload.name,
          request.payload.sha,
        );
        return true;

      case "log.dropCommit":
        await logHandlers.dropCommit(
          request.requestId,
          request.payload.repoId,
          request.payload.sha,
          request.payload.confirmed,
        );
        return true;

      case "log.editMessage":
        await logHandlers.editMessage(
          request.requestId,
          request.payload.repoId,
          request.payload.sha,
          request.payload.message,
          request.payload.confirmed,
        );
        return true;

      case "log.rewrite":
        await logHandlers.rewriteCommit(
          request.requestId,
          request.payload.repoId,
          request.payload.sha,
          request.payload.action,
          request.payload.confirmed,
        );
        return true;

      case "log.extractChanges":
        await logHandlers.extractChangesFromCommit(
          request.requestId,
          request.payload.repoId,
          request.payload.sha,
          request.payload.paths,
        );
        return true;
    default:
      return false;
  }
}
