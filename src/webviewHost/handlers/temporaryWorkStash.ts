import { createError } from "../../shared/errors/codes";
import { createHostError, createHostResponse } from "../../shared/protocol";
import type { StashFileOrigin } from "../../shared/types/stash";
import { validateRepoRelativePaths } from "../validatePaths";
import { gitCommandError, type TemporaryWorkContext } from "./temporaryWorkHelpers";

export function createStashHandlers(ctx: TemporaryWorkContext) {
  const { deps, stash, resolveRepo, validateRepo, emitStashSnapshot } = ctx;
  return {
    async listStashes(requestId: string, repoId: string) {
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
      const stashes = await stash.listStashes(repo.rootPath);
      const snapshot = emitStashSnapshot(repo.id, stashes);
      deps.postMessage(createHostResponse(requestId, "stash.list", snapshot));
    },

    async pushStash(
      requestId: string,
      repoId: string,
      opts?: {
        message?: string;
        paths?: string[];
        includeUntracked?: boolean;
        keepIndex?: boolean;
      },
    ) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      let paths: string[] | undefined;
      if (opts?.paths && opts.paths.length > 0) {
        const validated = validateRepoRelativePaths(repo.rootPath, opts.paths);
        if (!validated.ok) {
          deps.postMessage(
            createHostError(
              requestId,
              createError("INVALID_PATH", validated.message),
            ),
          );
          return;
        }
        paths = validated.paths;
      }
      try {
        await stash.push(repo.rootPath, { ...opts, paths });
        await deps.refreshCoordinator.refreshNow(repo.id);
        const snapshot = emitStashSnapshot(
          repo.id,
          await stash.listStashes(repo.rootPath),
        );
        deps.postMessage(createHostResponse(requestId, "stash.push", snapshot));
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", gitCommandError(err)),
          ),
        );
      }
    },

    /** Read-only: no mutation, so no refresh and no mutation preconditions. */
    async getStashDetail(requestId: string, repoId: string, index: number) {
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
      try {
        const detail = await stash.getStashDetail(
          repo.rootPath,
          repo.id,
          index,
          Date.now(),
        );
        deps.postMessage(
          createHostResponse(requestId, "stash.detail", detail),
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

    async getStashFileDiff(
      requestId: string,
      repoId: string,
      index: number,
      path: string,
      origin?: StashFileOrigin,
    ) {
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
      const validated = validateRepoRelativePaths(repo.rootPath, [path]);
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
        const document = await stash.buildStashFileDiff(
          repo.rootPath,
          repo.id,
          index,
          validated.paths[0]!,
          origin,
        );
        deps.postMessage(
          createHostResponse(requestId, "stash.fileDiff", document),
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

    async applyStash(
      requestId: string,
      repoId: string,
      index: number,
      opts?: { reinstateIndex?: boolean },
    ) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      try {
        await stash.apply(repo.rootPath, index, opts);
        await deps.refreshCoordinator.refreshNow(repo.id);
        const snapshot = emitStashSnapshot(
          repo.id,
          await stash.listStashes(repo.rootPath),
        );
        deps.postMessage(
          createHostResponse(requestId, "stash.apply", { index, snapshot }),
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

    async popStash(
      requestId: string,
      repoId: string,
      index: number,
      opts?: { reinstateIndex?: boolean },
    ) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      try {
        await stash.pop(repo.rootPath, index, opts);
        await deps.refreshCoordinator.refreshNow(repo.id);
        const snapshot = emitStashSnapshot(
          repo.id,
          await stash.listStashes(repo.rootPath),
        );
        deps.postMessage(createHostResponse(requestId, "stash.pop", snapshot));
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", gitCommandError(err)),
          ),
        );
      }
    },

    async dropStash(requestId: string, repoId: string, index: number) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      try {
        await stash.drop(repo.rootPath, index);
        const snapshot = emitStashSnapshot(
          repo.id,
          await stash.listStashes(repo.rootPath),
        );
        deps.postMessage(createHostResponse(requestId, "stash.drop", snapshot));
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", gitCommandError(err)),
          ),
        );
      }
    },

    async branchStash(
      requestId: string,
      repoId: string,
      index: number,
      branch: string,
    ) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      try {
        await stash.createBranch(repo.rootPath, index, branch);
        await deps.refreshCoordinator.refreshNow(repo.id);
        const snapshot = emitStashSnapshot(
          repo.id,
          await stash.listStashes(repo.rootPath),
        );
        deps.postMessage(
          createHostResponse(requestId, "stash.branch", snapshot),
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

    async clearStashes(requestId: string, repoId: string) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      try {
        await stash.clear(repo.rootPath);
        const snapshot = emitStashSnapshot(
          repo.id,
          await stash.listStashes(repo.rootPath),
        );
        deps.postMessage(createHostResponse(requestId, "stash.clear", snapshot));
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", gitCommandError(err)),
          ),
        );
      }
    },
  };
}
