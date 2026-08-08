import { validateMutationPreconditions } from "../../application/mutationPreconditions";
import type { ResetMode } from "../../services/git/history";
import { createError } from "../../shared/errors/codes";
import { createHostError, createHostResponse } from "../../shared/protocol";
import {
  confirmDestructiveEnabled,
  gitCommandError,
  resetProtectionAction,
  resetRequiresConfirmation,
  type LogHandlerApis,
} from "./logHelpers";

export function createLogRewriteHandlers(apis: LogHandlerApis) {
  const { deps, history, branchApi, rebase, extractChanges, resolveRepo } = apis;
  return {
    async reset(
      requestId: string,
      repoId: string,
      sha: string,
      mode: ResetMode,
      confirmed = false,
    ) {
      const repo = await resolveRepo(repoId);
      const protectedCheck = deps.protectionService.checkDestructiveAction(
        repo?.currentBranch ?? null,
        resetProtectionAction(mode),
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
      if (
        confirmDestructiveEnabled(deps) &&
        resetRequiresConfirmation(mode) &&
        !confirmed
      ) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "CONFIRMATION_REQUIRED",
              `Reset with --${mode} requires confirmation.`,
            ),
          ),
        );
        return;
      }
      try {
        await history.resetTo(repo.rootPath, sha.trim(), mode);
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "log.reset", {
            sha: sha.trim(),
            mode,
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

    async undoLastCommit(
      requestId: string,
      repoId: string,
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
      if (!repo) {
        return;
      }
      if (confirmDestructiveEnabled(deps) && !confirmed) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "CONFIRMATION_REQUIRED",
              "Undo last commit rewrites local history and requires confirmation.",
            ),
          ),
        );
        return;
      }
      try {
        await history.undoLastCommit(repo.rootPath);
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "log.undoLastCommit", { ok: true }),
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

    async createBranchFromCommit(
      requestId: string,
      repoId: string,
      name: string,
      sha: string,
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
      if (!repo || !name.trim() || !sha.trim()) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "INVALID_REQUEST",
              "Branch name and commit SHA are required.",
            ),
          ),
        );
        return;
      }
      if (deps.protectionService.isProtectedBranch(name.trim())) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "PROTECTED_BRANCH",
              "Cannot create a branch with a protected name.",
            ),
          ),
        );
        return;
      }
      try {
        await branchApi.createBranch(repo.rootPath, name.trim(), sha.trim());
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "log.createBranchFromCommit", {
            name: name.trim(),
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

    async dropCommit(
      requestId: string,
      repoId: string,
      sha: string,
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
              "Dropping a commit rewrites history and requires confirmation.",
            ),
          ),
        );
        return;
      }
      try {
        await rebase.dropCommit(repo.rootPath, sha.trim());
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "log.dropCommit", { sha: sha.trim() }),
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

    async editMessage(
      requestId: string,
      repoId: string,
      sha: string,
      message: string,
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
      if (!repo || !sha.trim() || !message.trim()) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "INVALID_REQUEST",
              "Commit SHA and message are required.",
            ),
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
              "Editing a commit message rewrites history and requires confirmation.",
            ),
          ),
        );
        return;
      }
      try {
        await rebase.editMessage(
          repo.rootPath,
          sha.trim(),
          message.trim(),
          repo.headSha,
        );
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "log.editMessage", { sha: sha.trim() }),
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

    async rewriteCommit(
      requestId: string,
      repoId: string,
      sha: string,
      action: "squash" | "fixup" | "drop",
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
              `${action} rewrites history and requires confirmation.`,
            ),
          ),
        );
        return;
      }
      try {
        await rebase.rewriteCommit(repo.rootPath, sha.trim(), action);
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "log.rewrite", {
            sha: sha.trim(),
            action,
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
    async extractChangesFromCommit(
      requestId: string,
      repoId: string,
      sha: string,
      paths?: string[],
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
      try {
        await extractChanges.extractFromCommit(
          repo.rootPath,
          sha.trim(),
          paths,
        );
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "log.extractChanges", {
            sha: sha.trim(),
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
