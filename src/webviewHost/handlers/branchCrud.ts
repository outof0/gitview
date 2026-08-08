import { createError } from "../../shared/errors/codes";
import { createHostError, createHostResponse } from "../../shared/protocol";
import type { CreateBranchOptions } from "../../services/git/branch";
import { gitCommandError, isUnmergedDeleteError, type BranchHandlerContext } from "./branchHelpers";

export function createBranchCrudHandlers(ctx: BranchHandlerContext) {
  const {
    deps,
    branches,
    sync,
    resolveRepo,
    validateRepo,
    emitBranchSnapshot,
  } = ctx;
  return {
    async create(
      requestId: string,
      repoId: string,
      name: string,
      startPoint?: string,
      opts?: CreateBranchOptions,
    ) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      if (!name.trim()) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Branch name is required."),
          ),
        );
        return;
      }
      try {
        await branches.createBranch(repo.rootPath, name.trim(), startPoint, opts);
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "branch.create", { name: name.trim() }),
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

    async rename(
      requestId: string,
      repoId: string,
      oldName: string,
      newName: string,
    ) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      const trimmedOld = oldName.trim();
      const trimmedNew = newName.trim();
      if (!trimmedOld || !trimmedNew) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Branch names are required."),
          ),
        );
        return;
      }
      if (
        deps.protectionService.isProtectedBranch(trimmedOld) ||
        deps.protectionService.isProtectedBranch(trimmedNew)
      ) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "PROTECTED_BRANCH",
              "Cannot rename a protected branch or use a protected branch name.",
            ),
          ),
        );
        return;
      }
      try {
        await branches.renameBranch(
          repo.rootPath,
          trimmedOld,
          trimmedNew,
          repo.currentBranch,
        );
        if (deps.branchFavoriteStorage) {
          const favorites = deps.branchFavoriteStorage.load(repo.id);
          if (favorites.has(trimmedOld)) {
            favorites.delete(trimmedOld);
            favorites.add(trimmedNew);
            await deps.branchFavoriteStorage.save(repo.id, favorites);
          }
        }
        await deps.refreshCoordinator.refreshNow(repo.id);
        await emitBranchSnapshot(repo);
        deps.postMessage(
          createHostResponse(requestId, "branch.rename", { name: trimmedNew }),
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

    async delete(
      requestId: string,
      repoId: string,
      name: string,
      force = false,
    ) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      const trimmed = name.trim();
      if (!trimmed) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Branch name is required."),
          ),
        );
        return;
      }
      if (trimmed === repo.currentBranch) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "INVALID_REQUEST",
              "Cannot delete the currently checked out branch.",
            ),
          ),
        );
        return;
      }
      if (deps.protectionService.isProtectedBranch(trimmed)) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("PROTECTED_BRANCH", "Cannot delete a protected branch."),
          ),
        );
        return;
      }
      const protectedCheck = force
        ? deps.protectionService.checkDestructiveAction(
            trimmed,
            "branch_delete_force",
          )
        : undefined;
      if (protectedCheck && !protectedCheck.allowed) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("PROTECTED_BRANCH", protectedCheck.reason),
          ),
        );
        return;
      }
      try {
        await branches.deleteBranch(repo.rootPath, trimmed, force);
        if (deps.branchFavoriteStorage) {
          const favorites = deps.branchFavoriteStorage.load(repo.id);
          if (favorites.has(trimmed)) {
            favorites.delete(trimmed);
            await deps.branchFavoriteStorage.save(repo.id, favorites);
          }
        }
        await deps.refreshCoordinator.refreshNow(repo.id);
        await emitBranchSnapshot(repo);
        deps.postMessage(
          createHostResponse(requestId, "branch.delete", { name: trimmed }),
        );
      } catch (err) {
        if (!force && isUnmergedDeleteError(err)) {
          deps.postMessage(
            createHostError(
              requestId,
              createError(
                "BRANCH_NOT_FULLY_MERGED",
                "Branch is not fully merged. Use force delete to remove it anyway.",
              ),
            ),
          );
          return;
        }
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", gitCommandError(err)),
          ),
        );
      }
    },

    async push(
      requestId: string,
      repoId: string,
      name: string,
      opts?: { remote?: string; setUpstream?: boolean },
    ) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      const trimmed = name.trim();
      if (!trimmed) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Branch name is required."),
          ),
        );
        return;
      }
      try {
        const result = await sync.push(repo.rootPath, {
          remote: opts?.remote ?? "origin",
          branch: trimmed,
          setUpstream: opts?.setUpstream ?? true,
        });
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "branch.push", {
            ok: !result.rejected,
            rejected: result.rejected,
            message: result.rejected ? result.stderr : undefined,
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

    async favorite(requestId: string, repoId: string, name: string) {
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
      if (!deps.branchFavoriteStorage) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("NOT_IMPLEMENTED", "Branch favorites are not available."),
          ),
        );
        return;
      }
      const trimmed = name.trim();
      if (!trimmed) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Branch name is required."),
          ),
        );
        return;
      }
      await deps.branchFavoriteStorage.toggle(repo.id, trimmed);
      await emitBranchSnapshot(repo, requestId, "branch.favorite");
    },
  };
}