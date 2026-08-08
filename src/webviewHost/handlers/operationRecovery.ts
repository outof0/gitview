import { validateMutationPreconditions } from "../../application/mutationPreconditions";
import { createHistoryApi } from "../../services/git/history";
import { createMergeApi } from "../../services/git/merge";
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


export type OperationRecoveryHandlerDeps = {
  execGit: GitExecFn;
  repositoryService: RepositoryService;
  refreshCoordinator: RefreshCoordinator;
  trusted: boolean;
  workspaceFolders: Array<{ uriPath: string; name: string }>;
  postMessage: (message: HostToWebview) => void;
};

export function createOperationRecoveryHandlers(deps: OperationRecoveryHandlerDeps) {
  const history = createHistoryApi(deps.execGit);
  const rebase = createRebaseApi(deps.execGit);
  const merge = createMergeApi(deps.execGit);

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

  async function run(
    requestId: string,
    repoId: string,
    responseType: string,
    action: (rootPath: string) => Promise<void>,
  ) {
    const repo = await validateRepo(requestId, repoId);
    if (!repo) {
      return;
    }
    try {
      await action(repo.rootPath);
      await deps.refreshCoordinator.refreshNow(repo.id);
      deps.postMessage(
        createHostResponse(requestId, responseType as never, { ok: true }),
      );
    } catch (err) {
      deps.postMessage(
        createHostError(
          requestId,
          createError("GIT_COMMAND_FAILED", gitCommandError(err)),
        ),
      );
    }
  }

  return {
    continue(requestId: string, repoId: string) {
      return run(requestId, repoId, "operation.continue", async (root) => {
        const op = (await resolveRepo(repoId))?.operation.type;
        if (op === "merge") {
          await merge.continueMerge(root);
        } else if (op === "rebase") {
          await rebase.continueRebase(root);
        } else if (op === "cherry_pick") {
          await history.cherryPickContinue(root);
        } else if (op === "revert") {
          await history.revertContinue(root);
        } else {
          throw new Error("No recoverable operation is in progress.");
        }
      });
    },

    skip(requestId: string, repoId: string) {
      return run(requestId, repoId, "operation.skip", async (root) => {
        const op = (await resolveRepo(repoId))?.operation.type;
        if (op === "rebase") {
          await rebase.skipRebase(root);
        } else if (op === "cherry_pick") {
          await history.cherryPickSkip(root);
        } else {
          throw new Error("Skip is not supported for the current operation.");
        }
      });
    },

    abort(requestId: string, repoId: string) {
      return run(requestId, repoId, "operation.abort", async (root) => {
        const op = (await resolveRepo(repoId))?.operation.type;
        if (op === "merge") {
          await merge.abortMerge(root);
        } else if (op === "rebase") {
          await rebase.abortRebase(root);
        } else if (op === "cherry_pick") {
          await history.cherryPickAbort(root);
        } else if (op === "revert") {
          await history.revertAbort(root);
        } else {
          throw new Error("No recoverable operation is in progress.");
        }
      });
    },
  };
}
