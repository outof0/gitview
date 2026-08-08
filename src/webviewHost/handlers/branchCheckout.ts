import { readGitWorkspaceSettings } from "../../config/readGitWorkspaceSettings";
import { createError } from "../../shared/errors/codes";
import { createHostError, createHostResponse } from "../../shared/protocol";
import { gitCommandError, type BranchHandlerContext } from "./branchHelpers";

export function createBranchCheckoutHandlers(ctx: BranchHandlerContext) {
  const {
    deps,
    branches,
    syncBranchOperation,
    discoverRepos,
    resolveRepo,
    validateRepo,
    emitBranchSnapshot,
  } = ctx;
  return {
    async list(requestId: string, repoId: string) {
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
      await emitBranchSnapshot(repo, requestId, "branch.list");
    },

    async checkout(
      requestId: string,
      repoId: string,
      ref: string,
      opts?: { smart?: boolean; force?: boolean },
    ) {
      const repo = await validateRepo(requestId, repoId, Boolean(opts?.force));
      if (!repo) {
        return;
      }
      try {
        if (ref.includes("/")) {
          await branches.checkoutRemoteAsTracking(repo.rootPath, ref, opts);
        } else {
          await branches.checkout(repo.rootPath, ref, opts);
        }
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "branch.checkout", { ref }),
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

    async syncOperation(
      requestId: string,
      repoId: string,
      ref: string,
      opts?: { smart?: boolean; force?: boolean; confirmed?: boolean },
    ) {
      const settings = readGitWorkspaceSettings();
      const allRepos = await discoverRepos();
      const trimmed = ref.trim();
      if (allRepos.length <= 1 || !settings.synchronousBranchControl) {
        const repo = await validateRepo(requestId, repoId, Boolean(opts?.force));
        if (!repo) {
          return;
        }
        try {
          if (trimmed.includes("/")) {
            await branches.checkoutRemoteAsTracking(repo.rootPath, trimmed, opts);
          } else {
            await branches.checkout(repo.rootPath, trimmed, opts);
          }
          await deps.refreshCoordinator.refreshNow(repo.id);
          deps.postMessage(
            createHostResponse(requestId, "branch.syncOperation", {
              ref: trimmed,
              results: [{ repoId: repo.id, name: repo.name, ok: true }],
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
        return;
      }
      if (!trimmed) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Branch ref is required."),
          ),
        );
        return;
      }

      if (opts?.force) {
        const initiating = await validateRepo(requestId, repoId, true);
        if (!initiating) {
          return;
        }
      } else {
        const initiating = await validateRepo(requestId, repoId);
        if (!initiating) {
          return;
        }
      }

      const targets = await syncBranchOperation.planTargets(allRepos, trimmed);
      const applicable = targets.filter((target) => target.available);
      if (applicable.length === 0) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "INVALID_REF",
              `Branch "${trimmed}" is not available in any workspace repository.`,
              { details: { targets } },
            ),
          ),
        );
        return;
      }

      if (!opts?.confirmed) {
        deps.postMessage(
          createHostResponse(requestId, "branch.syncOperation", {
            confirmationRequired: true,
            ref: trimmed,
            targets,
          }),
        );
        return;
      }

      try {
        const results = await syncBranchOperation.execute(allRepos, trimmed, {
          smart: opts?.smart,
          force: opts?.force,
        });
        await deps.refreshCoordinator.refreshNow();
        deps.postMessage(
          createHostResponse(requestId, "branch.syncOperation", {
            ref: trimmed,
            results,
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