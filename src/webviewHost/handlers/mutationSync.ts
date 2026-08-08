import { hasUpstream, resolveDefaultRemote } from "../../services/git/upstream";
import { createError } from "../../shared/errors/codes";
import { createHostError, createHostResponse } from "../../shared/protocol";
import { gitCommandError, type MutationHandlerContext } from "./mutationHelpers";

export function createSyncMutationHandlers(ctx: MutationHandlerContext) {
  const { deps, sync, discoverRepos, validateRepoMutation, refreshAfterMutation, preconditionError } = ctx;
  return {
    async fetchRepo(requestId: string, repoId: string) {
      const repo = await validateRepoMutation(requestId, repoId);
      if (!repo) {
        return;
      }
      try {
        await sync.fetch(repo.rootPath);
        await refreshAfterMutation(repo.id);
        deps.postMessage(createHostResponse(requestId, "sync.fetch", { ok: true }));
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", gitCommandError(err)),
          ),
        );
      }
    },

    async pullRepo(
      requestId: string,
      repoId: string,
      strategy?: "merge" | "rebase" | "ff_only",
    ) {
      const repo = await validateRepoMutation(requestId, repoId);
      if (!repo) {
        return;
      }
      try {
        await sync.pull(repo.rootPath, strategy ?? "merge");
        await refreshAfterMutation(repo.id);
        deps.postMessage(createHostResponse(requestId, "sync.pull", { ok: true }));
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", gitCommandError(err)),
          ),
        );
      }
    },

    async pushRepo(
      requestId: string,
      repoId: string,
      opts?: { setUpstream?: boolean; remote?: string },
    ) {
      const repo = await validateRepoMutation(requestId, repoId);
      if (!repo) {
        return;
      }
      const remote = opts?.remote ?? (await resolveDefaultRemote(deps.execGit, repo.rootPath));
      const needsUpstream = !(await hasUpstream(deps.execGit, repo.rootPath));
      if (needsUpstream && !opts?.setUpstream) {
        deps.postMessage(
          createHostResponse(requestId, "sync.push", {
            ok: false,
            upstreamRequired: true,
            branch: repo.currentBranch ?? "HEAD",
            remote,
          }),
        );
        return;
      }
      try {
        const result = await sync.push(repo.rootPath, {
          setUpstream: opts?.setUpstream ?? needsUpstream,
          remote,
          branch: repo.currentBranch ?? undefined,
        });
        await refreshAfterMutation(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "sync.push", {
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

    async updateAllRoots(
      requestId: string,
      strategy?: "merge" | "rebase" | "ff_only",
    ) {
      if (!deps.trusted) {
        preconditionError(requestId, {
          code: "WORKSPACE_UNTRUSTED",
          message: "Git mutations are disabled in untrusted workspaces.",
        });
        return;
      }
      try {
        const repos = await discoverRepos();
        const results = await sync.updateAllRoots(
          repos.map((repo) => ({
            id: repo.id,
            name: repo.name,
            rootPath: repo.rootPath,
          })),
          strategy ?? "merge",
        );
        await refreshAfterMutation();
        deps.postMessage(
          createHostResponse(requestId, "sync.updateAllRoots", { results }),
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
