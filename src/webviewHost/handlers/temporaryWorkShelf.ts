import { createError } from "../../shared/errors/codes";
import { createHostError, createHostResponse } from "../../shared/protocol";
import { validateRepoRelativePaths } from "../validatePaths";
import { gitCommandError, type TemporaryWorkContext } from "./temporaryWorkHelpers";

export function createShelfHandlers(ctx: TemporaryWorkContext) {
  const { deps, shelf, resolveRepo, validateRepo, emitShelfSnapshot } = ctx;
  return {
    async listShelves(requestId: string, repoId: string) {
      const repo = await resolveRepo(repoId);
      if (!repo?.trusted) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("REPOSITORY_NOT_FOUND", "Repository not found."),
          ),
        );
        return;
      }
      const shelves = await shelf.listShelves(repo.rootPath, repo.id);
      const snapshot = emitShelfSnapshot(repo.id, shelves);
      deps.postMessage(createHostResponse(requestId, "shelf.list", snapshot));
    },

    async shelveHunk(
      requestId: string,
      repoId: string,
      filePath: unknown,
      hunkIndex: number,
      opts?: { staged?: boolean; name?: string; changelistId?: string },
    ) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      const validated = validateRepoRelativePaths(repo.rootPath, [filePath]);
      if (!validated.ok) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_PATH", validated.message),
          ),
        );
        return;
      }
      if (!Number.isInteger(hunkIndex) || hunkIndex < 0) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Invalid hunk index."),
          ),
        );
        return;
      }
      try {
        const entry = await shelf.shelveHunk(repo.rootPath, {
          repoId: repo.id,
          path: validated.paths[0]!,
          hunkIndex,
          staged: opts?.staged,
          name: opts?.name,
          changelistId: opts?.changelistId,
        });
        await deps.refreshCoordinator.refreshNow(repo.id);
        const snapshot = emitShelfSnapshot(
          repo.id,
          await shelf.listShelves(repo.rootPath, repo.id),
        );
        deps.postMessage(
          createHostResponse(requestId, "shelf.hunk", { entry, snapshot }),
        );
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", gitCommandError(err)),
          ),
        );
      }
    },

    async shelveFiles(
      requestId: string,
      repoId: string,
      paths: unknown[],
      opts?: { name?: string; changelistId?: string },
    ) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      const validated = validateRepoRelativePaths(repo.rootPath, paths);
      if (!validated.ok) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_PATH", validated.message),
          ),
        );
        return;
      }
      try {
        const entry = await shelf.shelveFiles(repo.rootPath, {
          repoId: repo.id,
          paths: validated.paths,
          name: opts?.name,
          changelistId: opts?.changelistId,
        });
        await deps.refreshCoordinator.refreshNow(repo.id);
        const snapshot = emitShelfSnapshot(
          repo.id,
          await shelf.listShelves(repo.rootPath, repo.id),
        );
        deps.postMessage(
          createHostResponse(requestId, "shelf.files", { entry, snapshot }),
        );
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", gitCommandError(err)),
          ),
        );
      }
    },

    async unshelve(
      requestId: string,
      repoId: string,
      shelfId: string,
      deleteAfter?: boolean,
    ) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      try {
        const entry = await shelf.unshelve(
          repo.rootPath,
          shelfId,
          Boolean(deleteAfter),
        );
        await deps.refreshCoordinator.refreshNow(repo.id);
        const snapshot = emitShelfSnapshot(
          repo.id,
          await shelf.listShelves(repo.rootPath, repo.id),
        );
        deps.postMessage(
          createHostResponse(requestId, "shelf.unshelve", { entry, snapshot }),
        );
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", gitCommandError(err)),
          ),
        );
      }
    },

    async deleteShelf(requestId: string, repoId: string, shelfId: string) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      const removed = await shelf.deleteShelf(repo.rootPath, shelfId);
      const snapshot = emitShelfSnapshot(
        repo.id,
        await shelf.listShelves(repo.rootPath, repo.id),
      );
      deps.postMessage(
        createHostResponse(requestId, "shelf.delete", { removed, snapshot }),
      );
    },
  };
}
