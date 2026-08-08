import { createError } from "../shared/errors/codes";
import { createHostError, type WebviewToHost } from "../shared/protocol";
import type { MessageRouterContext } from "./messageRouterContext";

export async function dispatchDiff(
  request: WebviewToHost,
  ctx: MessageRouterContext,
): Promise<boolean> {
  const { deps, operationRecovery, diff, diffHunk, changelists } = ctx;
  switch (request.type) {
      case "operation.continue":
        await operationRecovery.continue(
          request.requestId,
          request.payload.repoId,
        );
        return true;

      case "operation.skip":
        await operationRecovery.skip(request.requestId, request.payload.repoId);
        return true;

      case "operation.abort":
        await operationRecovery.abort(request.requestId, request.payload.repoId);
        return true;

      case "diff.open":
        await diff.open(
          request.requestId,
          request.payload.repoId,
          request.payload.path,
          request.payload.staged,
        );
        return true;

      case "changelist.create":
        if (!changelists) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError("NOT_IMPLEMENTED", "Changelists are not available."),
            ),
          );
          return true;
        }
        await changelists.create(
          request.requestId,
          request.payload.repoId,
          request.payload.name,
        );
        return true;

      case "changelist.activate":
        if (!changelists) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError("NOT_IMPLEMENTED", "Changelists are not available."),
            ),
          );
          return true;
        }
        await changelists.activate(
          request.requestId,
          request.payload.repoId,
          request.payload.listId,
        );
        return true;

      case "changelist.moveFiles":
        if (!changelists) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError("NOT_IMPLEMENTED", "Changelists are not available."),
            ),
          );
          return true;
        }
        await changelists.moveFiles(
          request.requestId,
          request.payload.repoId,
          request.payload.listId,
          request.payload.paths,
        );
        return true;

      case "diff.stageHunk":
        await diffHunk.stageHunk(
          request.requestId,
          request.payload.repoId,
          request.payload.path,
          request.payload.hunkIndex,
        );
        return true;

      case "diff.unstageHunk":
        await diffHunk.unstageHunk(
          request.requestId,
          request.payload.repoId,
          request.payload.path,
          request.payload.hunkIndex,
        );
        return true;

      case "diff.stageLines":
        await diffHunk.stageLines(
          request.requestId,
          request.payload.repoId,
          request.payload.path,
          request.payload.lines,
        );
        return true;

      case "diff.unstageLines":
        await diffHunk.unstageLines(
          request.requestId,
          request.payload.repoId,
          request.payload.path,
          request.payload.lines,
        );
        return true;
    default:
      return false;
  }
}
