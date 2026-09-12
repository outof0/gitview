import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { OperationState } from "../shared/types/operation";
import { NO_OPERATION } from "../shared/types/operation";
import type { Repository, RepositorySnapshot } from "../shared/types/repository";
import {
  deriveRepositoryHeadState,
  deriveRepositoryShellState,
} from "../shared/types/repositoryShell";
import type { GitFileStatus } from "../shared/types/status";
import { computeChangeDigest } from "./git/changeDigest";
import { createStatusApi, type ParsedBranchHeader } from "./git/status";
import { listRemotes } from "./git/upstream";
import type { GitExecFn } from "./git/types";
import type { Logger } from "../observability/logger";
import { NOOP_LOGGER, errorLogFields } from "../observability/logger";
import { mapPool } from "../util/mapPool";

const MAX_CONCURRENT_REPOSITORIES = 4;

export type RepositoryDiscoveryInput = {
  workspaceFolders: Array<{ uriPath: string; name: string }>;
  resourcePath?: string;
  explicitRepoId?: string;
  trusted: boolean;
  /** Re-scan repository roots after workspace topology changes. */
  forceTopologyRefresh?: boolean;
  /**
   * Recompute the working-tree content digest before returning. Mutation
   * confirmation paths set this so a cached status cannot validate stale
   * evidence after the user edits a dirty file.
   */
  freshChangeDigest?: boolean;
};

export type RepositoryStatus = {
  branch: ParsedBranchHeader | null;
  files: GitFileStatus[];
};

export type RepositoryServiceDeps = {
  execGit: GitExecFn;
  logger?: Logger;
  discoverGitRoots?: (folderPath: string) => Promise<string[]>;
  detectOperation?: (gitDirPath: string) => Promise<OperationState>;
  isProtectedBranch?: (branchName: string | null) => boolean;
};

export interface RepositoryService {
  discoverRepositories(input: RepositoryDiscoveryInput): Promise<Repository[]>;
  refreshRepository(repoId: string): Promise<Repository | null>;
  resolveRepositoryForResource(
    repos: Repository[],
    resourcePath?: string,
    explicitRepoId?: string,
  ): Repository | null;
  buildSnapshot(
    repos: Repository[],
    activeRepoId: string | null,
  ): RepositorySnapshot;
  invalidateTopology(folderPath?: string): void;
  getCached(repoId: string): Repository | null;
  getCachedStatus(repoId: string): RepositoryStatus | null;
  getCachedRepositories(): Repository[];
  stableRepoId(rootPath: string): string;
}

function stableRepoId(rootPath: string): string {
  return crypto
    .createHash("sha256")
    .update(normalizePath(rootPath))
    .digest("hex")
    .slice(0, 16);
}

function normalizePath(value: string): string {
  return path.resolve(value);
}

function isPathWithin(candidate: string, parent: string): boolean {
  const relative = path.relative(normalizePath(parent), normalizePath(candidate));
  return (
    relative === "" ||
    (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`))
  );
}

function workspaceFolderForRoot(
  rootPath: string,
  folders: RepositoryDiscoveryInput["workspaceFolders"],
): string | null {
  const matches = folders
    .map((folder) => normalizePath(folder.uriPath))
    .filter((folderPath) => isPathWithin(rootPath, folderPath))
    .sort((a, b) => b.length - a.length);
  return matches[0] ?? null;
}

async function findDeepestRepo(
  execGit: GitExecFn,
  startPath: string,
): Promise<string | null> {
  try {
    const { stdout } = await execGit(startPath, ["rev-parse", "--show-toplevel"]);
    return stdout.trim() ? normalizePath(stdout.trim()) : null;
  } catch {
    return null;
  }
}

async function defaultDiscoverGitRoots(
  execGit: GitExecFn,
  folderPath: string,
): Promise<string[]> {
  const root = await findDeepestRepo(execGit, folderPath);
  return root ? [root] : [];
}

async function resolveGitDir(
  execGit: GitExecFn,
  repoRoot: string,
): Promise<string> {
  try {
    const { stdout } = await execGit(repoRoot, ["rev-parse", "--git-dir"]);
    const gitDir = stdout.trim();
    return normalizePath(path.isAbsolute(gitDir) ? gitDir : path.join(repoRoot, gitDir));
  } catch {
    return normalizePath(path.join(repoRoot, ".git"));
  }
}

async function resolveHeadSha(
  execGit: GitExecFn,
  repoRoot: string,
): Promise<string | null> {
  try {
    const { stdout } = await execGit(repoRoot, ["rev-parse", "HEAD"]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectOperation(gitDirPath: string): Promise<OperationState> {
  if (await exists(path.join(gitDirPath, "MERGE_HEAD"))) {
    return { type: "merge", canContinue: false, canAbort: true };
  }
  if (
    (await exists(path.join(gitDirPath, "rebase-merge"))) ||
    (await exists(path.join(gitDirPath, "rebase-apply"))) ||
    (await exists(path.join(gitDirPath, "REBASE_HEAD")))
  ) {
    return {
      type: "rebase",
      canContinue: true,
      canSkip: true,
      canAbort: true,
    };
  }
  if (await exists(path.join(gitDirPath, "CHERRY_PICK_HEAD"))) {
    return {
      type: "cherry_pick",
      canContinue: true,
      canSkip: true,
      canAbort: true,
    };
  }
  if (await exists(path.join(gitDirPath, "REVERT_HEAD"))) {
    return {
      type: "revert",
      canContinue: true,
      canSkip: true,
      canAbort: true,
    };
  }
  return NO_OPERATION;
}

export function createRepositoryService(
  deps: RepositoryServiceDeps,
): RepositoryService {
  const logger = deps.logger ?? NOOP_LOGGER;
  const readOperation = deps.detectOperation ?? detectOperation;
  const statusApi = createStatusApi(deps.execGit);
  const discover =
    deps.discoverGitRoots ??
    ((folderPath: string) => defaultDiscoverGitRoots(deps.execGit, folderPath));

  const cache = new Map<string, Repository>();
  const statusCache = new Map<string, RepositoryStatus>();
  const topologyByFolder = new Map<string, string[]>();
  const topologyInFlight = new Map<string, Promise<string[]>>();
  const gitDirByRoot = new Map<string, string>();
  const refreshGenerationByRepo = new Map<string, number>();
  let topologyGeneration = 0;

  function rememberRepository(repo: Repository): Repository {
    cache.set(repo.id, repo);
    return repo;
  }

  async function rootsForFolder(folderPath: string): Promise<string[]> {
    const key = normalizePath(folderPath);
    const cached = topologyByFolder.get(key);
    if (cached) {
      return cached;
    }
    const pending = topologyInFlight.get(key);
    if (pending) {
      return pending;
    }

    const generation = topologyGeneration;
    let discovery!: Promise<string[]>;
    discovery = discover(key)
      .then((roots) => [...new Set(roots.map(normalizePath))])
      .catch((error) => {
        logger.warn("repository.discovery.failed", {
          folderPath: key,
          ...errorLogFields(error),
        });
        return topologyByFolder.get(key) ?? [];
      })
      .then((roots) => {
        if (generation === topologyGeneration) {
          topologyByFolder.set(key, roots);
        }
        return roots;
      })
      .finally(() => {
        if (topologyInFlight.get(key) === discovery) {
          topologyInFlight.delete(key);
        }
      });
    topologyInFlight.set(key, discovery);
    return discovery;
  }

  async function buildRepository(
    rootPath: string,
    workspaceFolderPath: string | null,
    trusted: boolean,
    freshChangeDigest = false,
  ): Promise<Repository> {
    const normalizedRoot = normalizePath(rootPath);
    const id = stableRepoId(normalizedRoot);
    const generation = (refreshGenerationByRepo.get(id) ?? 0) + 1;
    refreshGenerationByRepo.set(id, generation);
    let gitDirPath = gitDirByRoot.get(normalizedRoot);
    if (!gitDirPath) {
      gitDirPath = await resolveGitDir(deps.execGit, normalizedRoot);
      gitDirByRoot.set(normalizedRoot, gitDirPath);
    }

    const [headSha, operation, status, remotes] = await Promise.all([
      resolveHeadSha(deps.execGit, normalizedRoot),
      readOperation(gitDirPath),
      statusApi.getStatus(normalizedRoot, id).catch((error) => {
        logger.warn("repository.status.failed", {
          repoId: id,
          ...errorLogFields(error),
        });
        return null;
      }),
      listRemotes(deps.execGit, normalizedRoot),
    ]);
    if (status) {
      statusCache.set(id, status);
    } else {
      statusCache.delete(id);
    }

    const statusBranch = status?.branch ?? null;
    const files = status?.files ?? [];
    const currentBranch = statusBranch?.currentBranch ?? null;
    const dirty = files.some((file) => file.kind !== "ignored");
    const previous = cache.get(id);
    const changeDigest = dirty
      ? freshChangeDigest
        ? await computeChangeDigest(normalizedRoot, files)
        : (previous?.changeDigest ?? null)
      : null;
    const repository: Repository = {
      id,
      rootPath: normalizedRoot,
      workspaceFolderPath,
      gitDirPath,
      name: path.basename(normalizedRoot),
      currentBranch,
      headSha,
      upstream: statusBranch?.upstream ?? null,
      isDetached: statusBranch?.isDetached ?? false,
      isBare: false,
      isWorktree: normalizePath(gitDirPath) !== normalizePath(path.join(normalizedRoot, ".git")),
      operation,
      ahead: statusBranch?.ahead ?? null,
      behind: statusBranch?.behind ?? null,
      conflictCount: files.filter((file) => file.conflicted).length,
      dirty,
      changeDigest,
      trusted,
      protectedBranch: deps.isProtectedBranch?.(currentBranch) ?? false,
      lastRefreshAt: Date.now(),
      remoteState:
        remotes.length === 0
          ? { kind: "none" }
          : {
              kind: "available",
              remotes,
              upstream: statusBranch?.upstream ?? null,
            },
    };
    const headState = deriveRepositoryHeadState(repository);
    const resolved = headState ? { ...repository, headState } : repository;
    if (refreshGenerationByRepo.get(id) === generation) {
      rememberRepository(resolved);
    }
    if (dirty && !freshChangeDigest) {
      void computeChangeDigest(normalizedRoot, files)
        .then((digest) => {
          if (refreshGenerationByRepo.get(id) !== generation) {
            return;
          }
          const current = cache.get(id);
          if (!current || current.changeDigest === digest || !current.dirty) {
            return;
          }
          cache.set(id, { ...current, changeDigest: digest });
        })
        .catch((error) => {
          logger.warn("repository.changeDigest.failed", {
            repoId: id,
            ...errorLogFields(error),
          });
        });
    }
    return resolved;
  }

  async function discoverRepositories(
    input: RepositoryDiscoveryInput,
  ): Promise<Repository[]> {
    const activeFolderKeys = new Set(
      input.workspaceFolders.map((folder) => normalizePath(folder.uriPath)),
    );
    const explicit = input.explicitRepoId
      ? cache.get(input.explicitRepoId)
      : undefined;
    if (explicit && !input.forceTopologyRefresh) {
      // A cached repoId must still be validated against the current workspace
      // topology: after its folder is removed, a late panel request carrying
      // the stale id must not rebuild and mutate the detached repository.
      const folderKey =
        explicit.workspaceFolderPath ?
          normalizePath(explicit.workspaceFolderPath)
        : null;
      const folderActive = folderKey ? activeFolderKeys.has(folderKey) : false;
      const rootInsideActiveFolder = [...activeFolderKeys].some((folder) =>
        isPathWithin(explicit.rootPath, folder),
      );
      if (!folderActive && !rootInsideActiveFolder) {
        cache.delete(explicit.id);
        statusCache.delete(explicit.id);
      } else {
        const refreshed = await buildRepository(
          explicit.rootPath,
          explicit.workspaceFolderPath,
          input.trusted,
          input.freshChangeDigest,
        );
        return [refreshed];
      }
    }
    if (input.forceTopologyRefresh) {
      invalidateTopology();
    }

    for (const folderKey of topologyByFolder.keys()) {
      if (!activeFolderKeys.has(folderKey)) {
        topologyByFolder.delete(folderKey);
      }
    }

    const roots = new Set<string>();
    const discoveredByFolder = await Promise.all(
      input.workspaceFolders.map(async (folder) => ({
        folder,
        roots: await rootsForFolder(folder.uriPath),
      })),
    );
    for (const result of discoveredByFolder) {
      for (const root of result.roots) {
        roots.add(root);
      }
    }

    if (input.resourcePath) {
      const cachedMatch = resolveRepositoryForResource(
        [...cache.values()],
        input.resourcePath,
      );
      const deepest =
        cachedMatch?.rootPath ??
        (await findDeepestRepo(deps.execGit, input.resourcePath));
      if (deepest) {
        roots.add(normalizePath(deepest));
      }
    }

    const rootList = [...roots];
    const repos: Repository[] = [];
    await mapPool(
      rootList,
      MAX_CONCURRENT_REPOSITORIES,
      async (rootPath) => {
        try {
          repos.push(
            await buildRepository(
              rootPath,
              workspaceFolderForRoot(rootPath, input.workspaceFolders),
              input.trusted,
              input.freshChangeDigest,
            ),
          );
        } catch (error) {
          logger.warn("repository.refresh.failed", {
            rootPath,
            ...errorLogFields(error),
          });
        }
      },
    );
    repos.sort((a, b) => a.rootPath.localeCompare(b.rootPath));

    const liveIds = new Set(repos.map((repo) => repo.id));
    for (const [repoId, repo] of cache) {
      if (
        repo.workspaceFolderPath &&
        activeFolderKeys.has(normalizePath(repo.workspaceFolderPath)) &&
        !liveIds.has(repoId)
      ) {
        cache.delete(repoId);
        statusCache.delete(repoId);
      }
    }
    return repos;
  }

  async function refreshRepository(repoId: string): Promise<Repository | null> {
    const existing = cache.get(repoId);
    if (!existing) {
      return null;
    }
    return rememberRepository(
      await buildRepository(
        existing.rootPath,
        existing.workspaceFolderPath,
        existing.trusted,
        true,
      ),
    );
  }

  function resolveRepositoryForResource(
    repos: Repository[],
    resourcePath?: string,
    explicitRepoId?: string,
  ): Repository | null {
    if (explicitRepoId) {
      return repos.find((repo) => repo.id === explicitRepoId) ?? null;
    }
    if (!resourcePath) {
      return repos[0] ?? null;
    }
    const matches = repos.filter((repo) => isPathWithin(resourcePath, repo.rootPath));
    return matches.sort((a, b) => b.rootPath.length - a.rootPath.length)[0] ?? null;
  }

  function buildSnapshot(
    repos: Repository[],
    activeRepoId: string | null,
  ): RepositorySnapshot {
    const resolvedActiveRepoId =
      repos.some((repo) => repo.id === activeRepoId)
        ? activeRepoId
        : repos[0]?.id ?? null;
    const branches = new Set(
      repos.map((repo) => repo.currentBranch).filter((branch): branch is string => Boolean(branch)),
    );
    return {
      repositories: repos,
      activeRepoId: resolvedActiveRepoId,
      multiRootDiverged: repos.length > 1 && branches.size > 1,
      shellState: deriveRepositoryShellState(repos, resolvedActiveRepoId),
    };
  }

  function invalidateTopology(folderPath?: string): void {
    topologyGeneration++;
    if (!folderPath) {
      topologyByFolder.clear();
      topologyInFlight.clear();
      gitDirByRoot.clear();
      return;
    }
    const key = normalizePath(folderPath);
    const roots = topologyByFolder.get(key) ?? [];
    topologyByFolder.delete(key);
    topologyInFlight.delete(key);
    for (const root of roots) {
      gitDirByRoot.delete(root);
    }
  }

  return {
    discoverRepositories,
    refreshRepository,
    resolveRepositoryForResource,
    buildSnapshot,
    invalidateTopology,
    getCached: (repoId: string) => cache.get(repoId) ?? null,
    getCachedStatus: (repoId: string) => statusCache.get(repoId) ?? null,
    getCachedRepositories: () => [...cache.values()],
    stableRepoId,
  };
}
