import { createError } from "../../shared/errors/codes";
import { createHostError, createHostResponse } from "../../shared/protocol";
import { validateRepoRelativePaths } from "../validatePaths";
import { gitCommandError, type TemporaryWorkContext } from "./temporaryWorkHelpers";

export function createPatchHandlers(ctx: TemporaryWorkContext) {
  const { deps, patch, shelf, resolveRepo, validateRepo, emitShelfSnapshot } = ctx;
  return {
    async createPatch(requestId: string, repoId: string, paths: unknown[]) {
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
      const validated = validateRepoRelativePaths(
        repo.rootPath,
        paths.length > 0 ? paths : ["."],
      );
      if (!validated.ok) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_PATH", validated.message),
          ),
        );
        return;
      }
      const patchContent = await patch.createFromPaths(
        repo.rootPath,
        validated.paths,
      );
      const preview = {
        repoId: repo.id,
        patch: patchContent,
        paths: validated.paths,
        createdAt: Date.now(),
      };
      deps.postMessage(
        createHostResponse(requestId, "patch.create", preview),
      );
    },

    async importShelfPatch(
      requestId: string,
      repoId: string,
      patchContent: string,
      name?: string,
    ) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      if (!patchContent.trim()) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Patch content is required."),
          ),
        );
        return;
      }
      try {
        const entry = await shelf.importPatch(repo.rootPath, {
          repoId: repo.id,
          patch: patchContent,
          name,
        });
        const snapshot = emitShelfSnapshot(
          repo.id,
          await shelf.listShelves(repo.rootPath, repo.id),
        );
        deps.postMessage(
          createHostResponse(requestId, "shelf.importPatch", { entry, snapshot }),
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

    async applyPatch(
      requestId: string,
      repoId: string,
      patchContent: string,
      opts?: {
        checkOnly?: boolean;
        confirmed?: boolean;
        strip?: number;
        directory?: string;
      },
    ) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      if (!patchContent.trim()) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Patch content is required."),
          ),
        );
        return;
      }
      try {
        const applyOpts = {
          strip: opts?.strip,
          directory: opts?.directory,
        };
        if (!opts?.confirmed && !opts?.checkOnly) {
          await patch.applyPatch(repo.rootPath, patchContent, {
            checkOnly: true,
            ...applyOpts,
          });
        }
        if (!opts?.checkOnly) {
          await patch.applyPatch(repo.rootPath, patchContent, applyOpts);
          await deps.refreshCoordinator.refreshNow(repo.id);
        }
        deps.postMessage(
          createHostResponse(requestId, "patch.apply", {
            applied: !opts?.checkOnly,
            checked: true,
          }),
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
  };
}
