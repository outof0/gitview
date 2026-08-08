import { createError } from "../shared/errors/codes";
import {
  createHostError,
  createHostResponse,
  type WebviewToHost,
} from "../shared/protocol";
import type { MessageRouterContext } from "./messageRouterContext";

export async function dispatchMisc(
  request: WebviewToHost,
  ctx: MessageRouterContext,
): Promise<boolean> {
  const { rebaseHandlers, blameHandlers, conflictHandlers } = ctx;
  switch (request.type) {
      case "rebase.continue":
        await rebaseHandlers.continueRebase(
          request.requestId,
          request.payload.repoId,
        );
        return true;

      case "rebase.skip":
        await rebaseHandlers.skipRebase(
          request.requestId,
          request.payload.repoId,
        );
        return true;

      case "rebase.abort":
        await rebaseHandlers.abortRebase(
          request.requestId,
          request.payload.repoId,
        );
        return true;

      case "blame.query":
        await blameHandlers.query(
          request.requestId,
          request.payload.repoId,
          request.payload.path,
          request.payload.ref,
        );
        return true;

      case "file.write":
        await blameHandlers.writeFile(
          request.requestId,
          request.payload.repoId,
          request.payload.path,
          request.payload.content,
        );
        return true;

      case "conflict.acceptLocal":
        await conflictHandlers.acceptLocal(
          request.requestId,
          request.payload.repoId,
          request.payload.paths,
        );
        return true;

      case "conflict.acceptIncoming":
        await conflictHandlers.acceptIncoming(
          request.requestId,
          request.payload.repoId,
          request.payload.paths,
        );
        return true;

      case "conflict.openMerge":
        await conflictHandlers.openMerge(
          request.requestId,
          request.payload.repoId,
          request.payload.path,
        );
        return true;

      case "conflict.applyNonConflicting":
        await conflictHandlers.applyNonConflictingFiles(
          request.requestId,
          request.payload.repoId,
        );
        return true;

      case "history.openPanel": {
        const { deps } = ctx;
        const handler = deps.onOpenGitHistory;
        if (!handler) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError(
                "NOT_IMPLEMENTED",
                "history.openPanel is not configured for this surface.",
              ),
            ),
          );
          return true;
        }
        try {
          await handler(
            request.payload.repoId,
            request.payload.path,
            request.payload.isFolder,
          );
          deps.postMessage(
            createHostResponse(request.requestId, "history.openPanel", {
              opened: true,
            }),
          );
        } catch (err) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError(
                "GIT_COMMAND_FAILED",
                err instanceof Error ? err.message : String(err),
              ),
            ),
          );
        }
        return true;
      }

      case "git.menuAction": {
        const { deps } = ctx;
        const handler = deps.onGitMenuAction;
        if (!handler) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError(
                "NOT_IMPLEMENTED",
                "git.menuAction is not configured for this surface.",
              ),
            ),
          );
          return true;
        }
        try {
          await handler(request.payload);
          deps.postMessage(
            createHostResponse(request.requestId, "git.menuAction", {
              ok: true as const,
            }),
          );
        } catch (err) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError(
                "GIT_COMMAND_FAILED",
                err instanceof Error ? err.message : String(err),
              ),
            ),
          );
        }
        return true;
      }
    default:
      return false;
  }
}
