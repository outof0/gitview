import { validateMutationPreconditions } from "../../application/mutationPreconditions";
import { createBranchApi } from "../../services/git/branch";
import { createSyncBranchOperationApi } from "../../services/git/syncBranchOperation";
import { createBranchCompareApi } from "../../services/git/branchCompare";
import { createMergeApi } from "../../services/git/merge";
import { createSyncApi } from "../../services/git/sync";
import { createIntegrationApi } from "../../services/git/integration";
import {
  createHostError,
  createHostResponse,
  type HostToWebview,
} from "../../shared/protocol";
import type { ProtectionService } from "../../services/protectionService";
import type { RepositoryService } from "../../services/repositoryService";
import type { RefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import type { BranchFavoriteStorage } from "../../storage/branchFavoriteStorage";
import type { GitExecFn } from "../../services/git/types";
import { gitCommandError } from "../../util/safeLog";
import { isGitErrorCode } from "../../shared/errors/classifyGitError";

export type BranchHandlerDeps = {
  execGit: GitExecFn;
  repositoryService: RepositoryService;
  protectionService: ProtectionService;
  refreshCoordinator: RefreshCoordinator;
  branchFavoriteStorage?: BranchFavoriteStorage;
  trusted: boolean;
  workspaceFolders: Array<{ uriPath: string; name: string }>;
  postMessage: (message: HostToWebview) => void;
};

export { gitCommandError };

export function isUnmergedDeleteError(err: unknown): boolean {
  return isGitErrorCode(err, "BRANCH_NOT_FULLY_MERGED");
}

export function createBranchHandlerContext(deps: BranchHandlerDeps) {
  const branches = createBranchApi(deps.execGit);
  const syncBranchOperation = createSyncBranchOperationApi(deps.execGit);
  const merge = createMergeApi(deps.execGit);
  const branchCompare = createBranchCompareApi(deps.execGit, merge.isBinaryFile);
  const sync = createSyncApi(deps.execGit);
  const integration = createIntegrationApi(deps.execGit);

  async function discoverRepos(explicitRepoId?: string) {
    return deps.repositoryService.discoverRepositories({
      workspaceFolders: deps.workspaceFolders,
      explicitRepoId,
      trusted: deps.trusted,
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

  async function validateRepo(requestId: string, repoId: string, force = false) {
    const repo = await resolveRepo(repoId);
    const protectedCheck = force
      ? deps.protectionService.checkDestructiveAction(
          repo?.currentBranch ?? null,
          "force_checkout",
        )
      : undefined;
    const check = validateMutationPreconditions({
      trusted: deps.trusted,
      repository: repo,
      protectedCheck,
    });
    if (!check.ok) {
      deps.postMessage(createHostError(requestId, check.error));
      return null;
    }
    return check.repository;
  }

  async function buildBranchSnapshot(repo: {
    id: string;
    rootPath: string;
    currentBranch: string | null;
  }) {
    const entries = await branches.listBranchEntries(repo.rootPath, repo.id);
    const favorites = deps.branchFavoriteStorage?.load(repo.id) ?? new Set<string>();
    const enriched = entries.map((entry) => ({
      ...entry,
      protected: deps.protectionService.isProtectedBranch(entry.name),
      favorite: favorites.has(entry.name),
    }));
    enriched.sort((a, b) => {
      if (a.favorite !== b.favorite) {
        return a.favorite ? -1 : 1;
      }
      return a.fullName.localeCompare(b.fullName);
    });
    return {
      repoId: repo.id,
      branches: enriched,
      refreshedAt: Date.now(),
    };
  }

  async function emitBranchSnapshot(
    repo: { id: string; rootPath: string; currentBranch: string | null },
    requestId?: string,
    responseType?: "branch.list" | "branch.favorite",
  ) {
    const snapshot = await buildBranchSnapshot(repo);
    deps.postMessage({
      protocolVersion: 1,
      type: "branch.snapshot",
      payload: snapshot,
    });
    if (requestId && responseType) {
      deps.postMessage(createHostResponse(requestId, responseType, snapshot));
    }
    return snapshot;
  }

  return {
    deps,
    branches,
    syncBranchOperation,
    merge,
    branchCompare,
    sync,
    integration,
    discoverRepos,
    resolveRepo,
    validateRepo,
    emitBranchSnapshot,
  };
}

export type BranchHandlerContext = ReturnType<typeof createBranchHandlerContext>;
