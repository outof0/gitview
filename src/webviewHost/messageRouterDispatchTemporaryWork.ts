import { createError } from "../shared/errors/codes";
import { createHostError, type WebviewToHost } from "../shared/protocol";
import type { MessageRouterContext } from "./messageRouterContext";

export async function dispatchTemporaryWork(
  request: WebviewToHost,
  ctx: MessageRouterContext,
): Promise<boolean> {
  const { deps, temporaryWork } = ctx;
  switch (request.type) {
      case "stash.list":
        if (!temporaryWork) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError("NOT_IMPLEMENTED", "Stash is not available."),
            ),
          );
          return true;
        }
        await temporaryWork.listStashes(
          request.requestId,
          request.payload.repoId,
        );
        return true;

      case "stash.push":
        if (!temporaryWork) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError("NOT_IMPLEMENTED", "Stash is not available."),
            ),
          );
          return true;
        }
        await temporaryWork.pushStash(
          request.requestId,
          request.payload.repoId,
          {
            message: request.payload.message,
            paths: request.payload.paths,
            includeUntracked: request.payload.includeUntracked,
            keepIndex: request.payload.keepIndex,
          },
        );
        return true;

      case "stash.detail":
        if (!temporaryWork) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError("NOT_IMPLEMENTED", "Stash is not available."),
            ),
          );
          return true;
        }
        await temporaryWork.getStashDetail(
          request.requestId,
          request.payload.repoId,
          request.payload.index,
        );
        return true;

      case "stash.fileDiff":
        if (!temporaryWork) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError("NOT_IMPLEMENTED", "Stash is not available."),
            ),
          );
          return true;
        }
        await temporaryWork.getStashFileDiff(
          request.requestId,
          request.payload.repoId,
          request.payload.index,
          request.payload.path,
          request.payload.origin,
        );
        return true;

      case "stash.apply":
        if (!temporaryWork) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError("NOT_IMPLEMENTED", "Stash is not available."),
            ),
          );
          return true;
        }
        await temporaryWork.applyStash(
          request.requestId,
          request.payload.repoId,
          request.payload.index,
          { reinstateIndex: request.payload.reinstateIndex },
        );
        return true;

      case "stash.pop":
        if (!temporaryWork) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError("NOT_IMPLEMENTED", "Stash is not available."),
            ),
          );
          return true;
        }
        await temporaryWork.popStash(
          request.requestId,
          request.payload.repoId,
          request.payload.index,
          { reinstateIndex: request.payload.reinstateIndex },
        );
        return true;

      case "stash.drop":
        if (!temporaryWork) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError("NOT_IMPLEMENTED", "Stash is not available."),
            ),
          );
          return true;
        }
        await temporaryWork.dropStash(
          request.requestId,
          request.payload.repoId,
          request.payload.index,
        );
        return true;

      case "stash.branch":
        if (!temporaryWork) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError("NOT_IMPLEMENTED", "Stash is not available."),
            ),
          );
          return true;
        }
        await temporaryWork.branchStash(
          request.requestId,
          request.payload.repoId,
          request.payload.index,
          request.payload.branch,
        );
        return true;

      case "stash.clear":
        if (!temporaryWork) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError("NOT_IMPLEMENTED", "Stash is not available."),
            ),
          );
          return true;
        }
        await temporaryWork.clearStashes(
          request.requestId,
          request.payload.repoId,
        );
        return true;

      case "shelf.list":
        if (!temporaryWork) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError("NOT_IMPLEMENTED", "Shelf is not available."),
            ),
          );
          return true;
        }
        await temporaryWork.listShelves(
          request.requestId,
          request.payload.repoId,
        );
        return true;

      case "shelf.files":
        if (!temporaryWork) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError("NOT_IMPLEMENTED", "Shelf is not available."),
            ),
          );
          return true;
        }
        await temporaryWork.shelveFiles(
          request.requestId,
          request.payload.repoId,
          request.payload.paths,
          {
            name: request.payload.name,
            changelistId: request.payload.changelistId,
          },
        );
        return true;

      case "shelf.hunk":
        if (!temporaryWork) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError("NOT_IMPLEMENTED", "Shelf is not available."),
            ),
          );
          return true;
        }
        await temporaryWork.shelveHunk(
          request.requestId,
          request.payload.repoId,
          request.payload.path,
          request.payload.hunkIndex,
          {
            staged: request.payload.staged,
            name: request.payload.name,
            changelistId: request.payload.changelistId,
          },
        );
        return true;

      case "shelf.unshelve":
        if (!temporaryWork) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError("NOT_IMPLEMENTED", "Shelf is not available."),
            ),
          );
          return true;
        }
        await temporaryWork.unshelve(
          request.requestId,
          request.payload.repoId,
          request.payload.shelfId,
          request.payload.deleteAfter,
        );
        return true;

      case "shelf.delete":
        if (!temporaryWork) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError("NOT_IMPLEMENTED", "Shelf is not available."),
            ),
          );
          return true;
        }
        await temporaryWork.deleteShelf(
          request.requestId,
          request.payload.repoId,
          request.payload.shelfId,
        );
        return true;

      case "shelf.importPatch":
        if (!temporaryWork) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError("NOT_IMPLEMENTED", "Shelf is not available."),
            ),
          );
          return true;
        }
        await temporaryWork.importShelfPatch(
          request.requestId,
          request.payload.repoId,
          request.payload.patch,
          request.payload.name,
        );
        return true;

      case "patch.create":
        if (!temporaryWork) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError("NOT_IMPLEMENTED", "Patch is not available."),
            ),
          );
          return true;
        }
        await temporaryWork.createPatch(
          request.requestId,
          request.payload.repoId,
          request.payload.paths ?? [],
        );
        return true;

      case "patch.apply":
        if (!temporaryWork) {
          deps.postMessage(
            createHostError(
              request.requestId,
              createError("NOT_IMPLEMENTED", "Patch is not available."),
            ),
          );
          return true;
        }
        await temporaryWork.applyPatch(
          request.requestId,
          request.payload.repoId,
          request.payload.patch,
          {
            checkOnly: request.payload.checkOnly,
            confirmed: request.payload.confirmed,
            strip: request.payload.strip,
            directory: request.payload.directory,
          },
        );
        return true;
    default:
      return false;
  }
}
