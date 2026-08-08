import { createError } from "../shared/errors/codes";
import {
  createHostError,
  type WebviewToHost,
} from "../shared/protocol";
import type { MessageRouterContext } from "./messageRouterContext";

export async function dispatchMerge(
  request: WebviewToHost,
  ctx: MessageRouterContext,
): Promise<boolean> {
  if (!ctx.mergeHandlers) {
    return false;
  }

  const { mergeHandlers } = ctx;
  switch (request.type) {
    case "conflict.refresh":
      await mergeHandlers.refreshConflicts(
        request.requestId,
        request.payload.repoId,
      );
      return true;

    case "merge.openFile":
      await mergeHandlers.openFile(
        request.requestId,
        request.payload.repoId,
        request.payload.path,
      );
      return true;

    case "merge.save":
      await mergeHandlers.saveFile(
        request.requestId,
        request.payload.repoId,
        request.payload.path,
        request.payload.content,
      );
      return true;

    case "merge.markResolved":
      await mergeHandlers.markResolved(
        request.requestId,
        request.payload.repoId,
        request.payload.path,
        request.payload.content,
      );
      return true;

    case "merge.confirmDiscard":
      await mergeHandlers.confirmDiscard(
        request.requestId,
        request.payload.action,
      );
      return true;

    case "merge.close":
      mergeHandlers.closePanel(request.requestId);
      return true;

    case "log.changesFromSide":
      await mergeHandlers.changesFromSide(
        request.requestId,
        request.payload.repoId,
        request.payload,
      );
      return true;

    default:
      return false;
  }
}

export function assertMergePanelConfigured(
  ctx: MessageRouterContext,
  requestId: string,
): boolean {
  if (ctx.mergeHandlers) {
    return true;
  }
  ctx.deps.postMessage(
    createHostError(
      requestId,
      createError(
        "NOT_IMPLEMENTED",
        "Merge panel handlers are not configured for this surface.",
      ),
    ),
  );
  return false;
}