import { validateMutationPreconditions } from "../../application/mutationPreconditions";
import { createRebaseApi } from "../../services/git/rebase";
import { createError } from "../../shared/errors/codes";
import {
  createHostError,
  createHostResponse,
  type HostToWebview,
} from "../../shared/protocol";
import type { RepositoryService } from "../../services/repositoryService";
import type { RefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import type { GitExecFn } from "../../services/git/types";
import { gitCommandError } from "../../util/safeLog";


export type RebaseHandlerDeps = {
  execGit: GitExecFn;
  repositoryService: RepositoryService;
  refreshCoordinator: RefreshCoordinator;
  trusted: boolean;
  workspaceFolders: Array<{ uriPath: string; name: string }>;
  postMessage: (message: HostToWebview) => void;
};

export function createRebaseHandlers(deps: RebaseHandlerDeps) {
  const rebase = createRebaseApi(deps.execGit);

  async function resolveRepo(repoId: string) {
    const repos = await deps.repositoryService.discoverRepositories({
      workspaceFolders: deps.workspaceFolders,
      explicitRepoId: repoId,
      trusted: deps.trusted,
    });
    return deps.repositoryService.resolveRepositoryForResource(
      repos,
      undefined,
      repoId,
    );
  }

  async function validateRepo(requestId: string, repoId: string) {
    const repo = await resolveRepo(repoId);
    const check = validateMutationPreconditions({
      trusted: deps.trusted,
      repository: repo,
    });
    if (!check.ok) {
      deps.postMessage(createHostError(requestId, check.error));
      return null;
    }
    return check.repository;
  }

  return {
    async continueRebase(requestId: string, repoId: string) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      try {
        await rebase.continueRebase(repo.rootPath);
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(createHostResponse(requestId, "rebase.continue", { ok: true }));
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", gitCommandError(err)),
          ),
        );
      }
    },

    async skipRebase(requestId: string, repoId: string) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      try {
        await rebase.skipRebase(repo.rootPath);
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(createHostResponse(requestId, "rebase.skip", { ok: true }));
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", gitCommandError(err)),
          ),
        );
      }
    },

    async abortRebase(requestId: string, repoId: string) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      try {
        await rebase.abortRebase(repo.rootPath);
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(createHostResponse(requestId, "rebase.abort", { ok: true }));
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
