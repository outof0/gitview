import { validateMutationPreconditions } from "../../application/mutationPreconditions";
import { createError } from "../../shared/errors/codes";
import { createHostError, createHostResponse } from "../../shared/protocol";
import { gitCommandError, type LogHandlerApis } from "./logHelpers";

export function createLogCherryPickHandlers(apis: LogHandlerApis) {
  const { deps, history, resolveRepo } = apis;
  return {
    async cherryPick(requestId: string, repoId: string, sha: string) {
      const repo = await resolveRepo(repoId);
      const check = validateMutationPreconditions({
        trusted: deps.trusted,
        repository: repo,
      });
      if (!check.ok) {
        deps.postMessage(createHostError(requestId, check.error));
        return;
      }
      if (!repo || !sha.trim()) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Commit SHA is required."),
          ),
        );
        return;
      }
      try {
        await history.cherryPick(repo.rootPath, sha.trim());
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "log.cherryPick", { sha: sha.trim() }),
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
    async cherryPickMultiple(
      requestId: string,
      repoId: string,
      shas: string[],
    ) {
      const repo = await resolveRepo(repoId);
      const check = validateMutationPreconditions({
        trusted: deps.trusted,
        repository: repo,
      });
      if (!check.ok) {
        deps.postMessage(createHostError(requestId, check.error));
        return;
      }
      const trimmed = shas.map((sha) => sha.trim()).filter(Boolean);
      if (!repo || trimmed.length === 0) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "At least one commit SHA is required."),
          ),
        );
        return;
      }
      try {
        await history.cherryPickMultiple(repo.rootPath, trimmed);
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "log.cherryPickMultiple", {
            shas: trimmed,
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

    async revertMultiple(requestId: string, repoId: string, shas: string[]) {
      const repo = await resolveRepo(repoId);
      // git revert creates a new commit; it does not rewrite history, so it is
      // allowed on protected branches (unlike reset/drop/amend).
      const check = validateMutationPreconditions({
        trusted: deps.trusted,
        repository: repo,
      });
      if (!check.ok) {
        deps.postMessage(createHostError(requestId, check.error));
        return;
      }
      const trimmed = shas.map((sha) => sha.trim()).filter(Boolean);
      if (!repo || trimmed.length === 0) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "At least one commit SHA is required."),
          ),
        );
        return;
      }
      try {
        await history.revertMultiple(repo.rootPath, trimmed);
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "log.revertMultiple", { shas: trimmed }),
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

    async revert(requestId: string, repoId: string, sha: string) {
      const repo = await resolveRepo(repoId);
      // git revert creates a new commit; it does not rewrite history, so it is
      // allowed on protected branches (unlike reset/drop/amend).
      const check = validateMutationPreconditions({
        trusted: deps.trusted,
        repository: repo,
      });
      if (!check.ok) {
        deps.postMessage(createHostError(requestId, check.error));
        return;
      }
      if (!repo || !sha.trim()) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Commit SHA is required."),
          ),
        );
        return;
      }
      try {
        await history.revertCommit(repo.rootPath, sha.trim());
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "log.revert", { sha: sha.trim() }),
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
