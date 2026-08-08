import { validateMutationPreconditions } from "../../application/mutationPreconditions";
import type { CommitCheckService } from "../../services/commitCheckService";
import { createCommitApi } from "../../services/git/commit";
import { createStagingApi } from "../../services/git/staging";
import { createSyncApi } from "../../services/git/sync";
import type { GitFileStatus } from "../../shared/types/status";
import {
  createHostError,
  type HostToWebview,
} from "../../shared/protocol";
import type { ProtectionService } from "../../services/protectionService";
import type { RepositoryService } from "../../services/repositoryService";
import type { RefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import type { GitExecFn } from "../../services/git/types";
import { gitCommandError } from "../../util/safeLog";
import { isWorkspaceTrusted } from "../messageRouterTrust";

export type MutationHandlerDeps = {
  execGit: GitExecFn;
  repositoryService: RepositoryService;
  protectionService: ProtectionService;
  refreshCoordinator: RefreshCoordinator;
  commitCheckService?: CommitCheckService;
  trusted?: boolean;
  getTrusted?: () => boolean;
  /** When true (default), destructive rollbacks require a confirmed flag. */
  getConfirmDestructiveActions?: () => boolean;
  workspaceFolders: Array<{ uriPath: string; name: string }>;
  postMessage: (message: HostToWebview) => void;
};

export function createMutationHandlerContext(deps: MutationHandlerDeps) {
  const staging = createStagingApi(deps.execGit);
  const commitApi = createCommitApi(deps.execGit);
  const sync = createSyncApi(deps.execGit);

  async function discoverRepos(explicitRepoId?: string) {
    return deps.repositoryService.discoverRepositories({
      workspaceFolders: deps.workspaceFolders,
      explicitRepoId,
      trusted: isWorkspaceTrusted(deps),
    });
  }

  async function resolveRepo(repoId: string) {
    const repos = await discoverRepos(repoId);
    return deps.repositoryService.resolveRepositoryForResource(
      repos,
      undefined,
      repoId,
    );
  }

  function preconditionError(requestId: string, error: { code: string; message: string; recoverable?: boolean }) {
    deps.postMessage(
      createHostError(requestId, {
        code: error.code as never,
        message: error.message,
        recoverable: error.recoverable ?? true,
      }),
    );
  }

  async function validateRepoMutation(
    requestId: string,
    repoId: string,
    protectedAction?: Parameters<ProtectionService["checkDestructiveAction"]>[1],
  ) {
    const repo = await resolveRepo(repoId);
    const protectedCheck = protectedAction
      ? deps.protectionService.checkDestructiveAction(
          repo?.currentBranch ?? null,
          protectedAction,
        )
      : undefined;
    const check = validateMutationPreconditions({
      trusted: isWorkspaceTrusted(deps),
      repository: repo,
      protectedCheck,
    });
    if (!check.ok) {
      preconditionError(requestId, check.error);
      return null;
    }
    return check.repository;
  }

  async function refreshAfterMutation(repoId?: string) {
    await deps.refreshCoordinator.refreshNow(repoId);
  }

  function splitPathsByKind(
    files: GitFileStatus[],
    paths: string[],
  ): { tracked: string[]; unversioned: string[] } {
    const byPath = new Map(files.map((f) => [f.path, f]));
    const tracked: string[] = [];
    const unversioned: string[] = [];
    for (const p of paths) {
      const file = byPath.get(p);
      if (file?.kind === "unversioned") {
        unversioned.push(p);
      } else {
        tracked.push(p);
      }
    }
    return { tracked, unversioned };
  }

  return {
    deps,
    staging,
    commitApi,
    sync,
    discoverRepos,
    resolveRepo,
    preconditionError,
    validateRepoMutation,
    refreshAfterMutation,
    splitPathsByKind,
  };
}

export type MutationHandlerContext = ReturnType<typeof createMutationHandlerContext>;

export { gitCommandError };
