import { validateMutationPreconditions } from "../../application/mutationPreconditions";
import { createError } from "../../shared/errors/codes";
import {
  createHostError,
  createHostResponse,
} from "../../shared/protocol";
import { validateRepoRelativePaths } from "../validatePaths";
import {
  confirmDestructiveEnabled,
  gitCommandError,
  parseSelectedChangeInput,
  type LogHandlerApis,
} from "./logHelpers";

export function createLogSelectedChangesHandlers(apis: LogHandlerApis) {
  const { deps, selectedChanges, resolveRepo } = apis;
  return {
    async cherryPickSelected(
      requestId: string,
      repoId: string,
      sha: string,
      filePath: unknown,
      hunkIndexes?: number[],
      lines?: unknown[],
      checkOnly = false,
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
      if (!repo || !sha.trim()) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Commit SHA is required."),
          ),
        );
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
      const selection = parseSelectedChangeInput(hunkIndexes, lines);
      if ("error" in selection) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", selection.error),
          ),
        );
        return;
      }
      const path = validated.paths[0]!;
      try {
        if (!checkOnly) {
          await selectedChanges.cherryPickSelected(
            repo.rootPath,
            sha.trim(),
            path,
            selection,
            { checkOnly: true },
          );
          await selectedChanges.cherryPickSelected(
            repo.rootPath,
            sha.trim(),
            path,
            selection,
          );
        } else {
          await selectedChanges.cherryPickSelected(
            repo.rootPath,
            sha.trim(),
            path,
            selection,
            { checkOnly: true },
          );
        }
        if (!checkOnly) {
          await deps.refreshCoordinator.refreshNow(repo.id);
        }
        deps.postMessage(
          createHostResponse(requestId, "log.cherryPickSelected", {
            sha: sha.trim(),
            path,
            checked: true,
            applied: !checkOnly,
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

    async revertSelected(
      requestId: string,
      repoId: string,
      sha: string,
      filePath: unknown,
      hunkIndexes?: number[],
      lines?: unknown[],
      checkOnly = false,
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
      if (!repo || !sha.trim()) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Commit SHA is required."),
          ),
        );
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
      const selection = parseSelectedChangeInput(hunkIndexes, lines);
      if ("error" in selection) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", selection.error),
          ),
        );
        return;
      }
      const path = validated.paths[0]!;
      try {
        if (!checkOnly) {
          await selectedChanges.revertSelected(
            repo.rootPath,
            sha.trim(),
            path,
            selection,
            { checkOnly: true },
          );
          await selectedChanges.revertSelected(
            repo.rootPath,
            sha.trim(),
            path,
            selection,
          );
        } else {
          await selectedChanges.revertSelected(
            repo.rootPath,
            sha.trim(),
            path,
            selection,
            { checkOnly: true },
          );
        }
        if (!checkOnly) {
          await deps.refreshCoordinator.refreshNow(repo.id);
        }
        deps.postMessage(
          createHostResponse(requestId, "log.revertSelected", {
            sha: sha.trim(),
            path,
            checked: true,
            applied: !checkOnly,
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

    async dropSelectedChanges(
      requestId: string,
      repoId: string,
      sha: string,
      filePath: unknown,
      hunkIndexes?: number[],
      lines?: unknown[],
      confirmed = false,
    ) {
      const repo = await resolveRepo(repoId);
      const protectedCheck = deps.protectionService.checkDestructiveAction(
        repo?.currentBranch ?? null,
        "history_rewrite",
      );
      const check = validateMutationPreconditions({
        trusted: deps.trusted,
        repository: repo,
        protectedCheck,
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
      if (confirmDestructiveEnabled(deps) && !confirmed) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "CONFIRMATION_REQUIRED",
              "Dropping selected changes rewrites HEAD and requires confirmation.",
            ),
          ),
        );
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
      const selection = parseSelectedChangeInput(hunkIndexes, lines);
      if ("error" in selection) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", selection.error),
          ),
        );
        return;
      }
      const path = validated.paths[0]!;
      try {
        await selectedChanges.dropSelectedFromHead(
          repo.rootPath,
          sha.trim(),
          path,
          selection,
          repo.headSha,
        );
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "log.dropSelectedChanges", {
            sha: sha.trim(),
            path,
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
