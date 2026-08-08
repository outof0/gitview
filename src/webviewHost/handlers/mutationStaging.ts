import type { GitFileStatus } from "../../shared/types/status";
import { createError } from "../../shared/errors/codes";
import { createHostError, createHostResponse } from "../../shared/protocol";
import type { CommitCheckKind } from "../../shared/types/commitCheck";
import { validateRepoRelativePaths } from "../validatePaths";
import { gitCommandError, type MutationHandlerContext } from "./mutationHelpers";

export function createStagingMutationHandlers(ctx: MutationHandlerContext) {
  const { deps, staging, validateRepoMutation, refreshAfterMutation, splitPathsByKind, preconditionError } = ctx;
  return {
    async stage(requestId: string, repoId: string, paths: unknown) {
      const repo = await validateRepoMutation(requestId, repoId);
      if (!repo) {
        return;
      }
      const validated = validateRepoRelativePaths(repo.rootPath, paths);
      if (!validated.ok) {
        preconditionError(requestId, {
          code: "INVALID_PATH",
          message: validated.message,
        });
        return;
      }
      try {
        await staging.stageFiles(repo.rootPath, validated.paths);
        await refreshAfterMutation(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "changes.stage", {
            staged: validated.paths,
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

    async unstage(requestId: string, repoId: string, paths: unknown) {
      const repo = await validateRepoMutation(requestId, repoId);
      if (!repo) {
        return;
      }
      const validated = validateRepoRelativePaths(repo.rootPath, paths);
      if (!validated.ok) {
        preconditionError(requestId, {
          code: "INVALID_PATH",
          message: validated.message,
        });
        return;
      }
      try {
        await staging.unstageFiles(repo.rootPath, validated.paths);
        await refreshAfterMutation(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "changes.unstage", {
            unstaged: validated.paths,
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

    async rollback(
      requestId: string,
      repoId: string,
      paths: unknown,
      confirmed: boolean,
      statusFiles: GitFileStatus[],
    ) {
      const repo = await validateRepoMutation(requestId, repoId);
      if (!repo) {
        return;
      }
      const validated = validateRepoRelativePaths(repo.rootPath, paths);
      if (!validated.ok) {
        preconditionError(requestId, {
          code: "INVALID_PATH",
          message: validated.message,
        });
        return;
      }

      const { tracked, unversioned } = splitPathsByKind(
        statusFiles,
        validated.paths,
      );
      const confirmDestructive =
        deps.getConfirmDestructiveActions?.() !== false;
      const needsConfirm =
        unversioned.length > 0 ||
        (confirmDestructive && tracked.length > 0);
      if (needsConfirm && !confirmed) {
        const kind =
          unversioned.length > 0 && tracked.length === 0
            ? "unversioned files"
            : unversioned.length > 0
              ? "local changes (including unversioned files)"
              : "tracked local changes";
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "DESTRUCTIVE_ACTION_DENIED",
              `Rollback of ${kind} requires confirmation.`,
              { details: { paths: validated.paths } },
            ),
          ),
        );
        return;
      }

      try {
        if (tracked.length > 0) {
          await staging.rollbackTrackedFiles(repo.rootPath, tracked);
        }
        if (unversioned.length > 0) {
          await staging.removeUnversionedFiles(repo.rootPath, unversioned);
        }
        await refreshAfterMutation(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "changes.rollback", {
            rolledBack: validated.paths,
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

    async runCommitChecks(
      requestId: string,
      repoId: string,
      paths?: string[],
      kinds?: CommitCheckKind[],
    ) {
      const repo = await validateRepoMutation(requestId, repoId);
      if (!repo) {
        return;
      }
      if (!deps.commitCheckService) {
        deps.postMessage(
          createHostResponse(requestId, "commit.checks", { ok: true, issues: [] }),
        );
        return;
      }

      let checkPaths = paths;
      if (checkPaths) {
        const validated = validateRepoRelativePaths(repo.rootPath, checkPaths);
        if (!validated.ok) {
          preconditionError(requestId, {
            code: "INVALID_PATH",
            message: validated.message,
          });
          return;
        }
        checkPaths = validated.paths;
      }

      const result = await deps.commitCheckService.runChecks(
        repo.rootPath,
        checkPaths ?? [],
        { kinds, applyFixes: false },
      );
      deps.postMessage(createHostResponse(requestId, "commit.checks", result));
    },
  };
}
