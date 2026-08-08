import { createError } from "../../shared/errors/codes";
import { createHostError, createHostResponse } from "../../shared/protocol";
import type {
  MergeBranchOptions,
  RebaseOntoOptions,
} from "../../services/git/integration";
import { gitCommandError, type BranchHandlerContext } from "./branchHelpers";

export function createBranchIntegrationHandlers(ctx: BranchHandlerContext) {
  const { deps, integration, validateRepo } = ctx;
  return {
    async merge(
      requestId: string,
      repoId: string,
      ref: string,
      opts?: MergeBranchOptions,
    ) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      const trimmed = ref.trim();
      if (!trimmed) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Branch ref is required."),
          ),
        );
        return;
      }
      try {
        await integration.mergeBranch(repo.rootPath, trimmed, opts);
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "branch.merge", { ref: trimmed }),
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

    async rebaseOnto(
      requestId: string,
      repoId: string,
      onto: string,
      opts?: RebaseOntoOptions,
    ) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      const trimmed = onto.trim();
      if (!trimmed) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Rebase target is required."),
          ),
        );
        return;
      }
      try {
        await integration.rebaseOnto(repo.rootPath, trimmed, opts);
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "branch.rebaseOnto", { onto: trimmed }),
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
