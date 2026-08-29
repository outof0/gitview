import { requireRollbackConfirmation } from "../../application/mutationPreconditions";
import { createError } from "../../shared/errors/codes";
import { createHostError, createHostResponse } from "../../shared/protocol";
import type { ConfirmationSubmission } from "../../shared/types/confirmation";
import type { GitFileStatus } from "../../shared/types/status";
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
      confirmation: ConfirmationSubmission | undefined,
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
      if (needsConfirm || confirmation) {
        const confirmationCheck = requireRollbackConfirmation(
          repo,
          validated.paths,
          unversioned,
          confirmation,
        );
        if (!confirmationCheck.ok) {
          deps.postMessage(
            createHostError(requestId, confirmationCheck.error),
          );
          return;
        }
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

      if (!checkPaths?.length) {
        try {
          checkPaths = await staging.listStagedPaths(repo.rootPath);
        } catch (err) {
          deps.postMessage(
            createHostError(
              requestId,
              createError("GIT_COMMAND_FAILED", gitCommandError(err)),
            ),
          );
          return;
        }
      }

      const result = await deps.commitCheckService.runChecks(
        repo.rootPath,
        checkPaths,
        { kinds, applyFixes: false },
      );
      deps.postMessage(createHostResponse(requestId, "commit.checks", result));
    },
  };
}
