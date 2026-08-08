import type { RepositorySnapshot } from "../../shared/types/repository";
import type { StatusSnapshot } from "../../shared/types/status";
import {
  DEFAULT_GIT_WORKSPACE_SETTINGS,
  type GitWorkspaceSettings,
} from "../../shared/types/gitWorkspaceSettings";
import type { ChangelistStorage } from "../../storage/changelistStorage";
import { createStatusApi } from "../git/status";
import type { GitExecFn } from "../git/types";
import type { RepositoryService, RepositoryStatus } from "../repositoryService";
import { buildRepoStatusSnapshot } from "../statusSnapshot";
import type { Logger } from "../../observability/logger";
import { NOOP_LOGGER, errorLogFields } from "../../observability/logger";
import { mapPool } from "../../util/mapPool";

const MAX_CONCURRENT_REPOSITORIES = 4;

export type WorkspaceFolderRef = { uriPath: string; name: string };

export type RefreshCoordinatorDeps = {
  logger?: Logger;
  execGit: GitExecFn;
  repositoryService: RepositoryService;
  changelistStorage?: ChangelistStorage;
  getWorkspaceFolders: () => WorkspaceFolderRef[];
  getTrusted: () => boolean;
  getSettings?: () => GitWorkspaceSettings;
  debounceMs?: number;
};

export type RefreshPayload = {
  repoSnapshot: RepositorySnapshot;
  // Readonly because one payload instance is handed to every listener and kept
  // as lastPayload; a mutating listener would corrupt the others' view.
  statusByRepoId: ReadonlyMap<string, StatusSnapshot>;
  /** Present for host refreshes; optional for backward-compatible test/adapters. */
  settings?: GitWorkspaceSettings;
  /**
   * Correlates this snapshot with the `refresh.*` log records that produced it,
   * so a stale panel can be traced back to the run that filled it.
   */
  traceId: string;
};

export type RefreshListener = (payload: RefreshPayload) => void;

export interface RefreshCoordinator {
  subscribe(listener: RefreshListener): () => void;
  refreshNow(activeRepoId?: string): Promise<RefreshPayload>;
  scheduleRefresh(activeRepoId?: string): void;
  dispose(): void;
}

const EMPTY_PAYLOAD: RefreshPayload = {
  repoSnapshot: {
    repositories: [],
    activeRepoId: null,
    multiRootDiverged: false,
  },
  statusByRepoId: new Map(),
  settings: DEFAULT_GIT_WORKSPACE_SETTINGS,
  traceId: "refresh-none",
};

export function createRefreshCoordinator(
  deps: RefreshCoordinatorDeps,
): RefreshCoordinator {
  const logger = deps.logger ?? NOOP_LOGGER;
  // Distinguishes runs from different coordinators (and window reloads) in a
  // log file that only shows a counter.
  const sessionId = Math.random().toString(36).slice(2, 8);
  let refreshCount = 0;
  const statusApi = createStatusApi(deps.execGit);
  const listeners = new Set<RefreshListener>();
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<RefreshPayload> | null = null;
  let trailingRefreshRequested = false;
  let requestedActiveRepoId: string | undefined;
  let lastActiveRepoId: string | null = null;
  let lastPayload = EMPTY_PAYLOAD;
  let disposed = false;

  function subscribe(listener: RefreshListener): () => void {
    if (disposed) {
      return () => undefined;
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function notify(payload: RefreshPayload): void {
    for (const listener of listeners) {
      try {
        listener(payload);
      } catch (error) {
        // A panel listener must not prevent other views from receiving state.
        logger.warn("refresh.listener.failed", errorLogFields(error));
      }
    }
  }

  async function buildStatusSnapshot(
    repo: RepositorySnapshot["repositories"][number],
    mode: StatusSnapshot["mode"],
  ): Promise<StatusSnapshot | null> {
    const optionalService = deps.repositoryService as RepositoryService & {
      getCachedStatus?: (repoId: string) => RepositoryStatus | null;
    };
    if (optionalService.getCachedStatus) {
      const status = optionalService.getCachedStatus(repo.id);
      if (!status) {
        return null;
      }
      return buildRepoStatusSnapshot(statusApi, repo.rootPath, repo.id, {
        changelistStorage: deps.changelistStorage,
        mode,
        status,
      });
    }
    return buildRepoStatusSnapshot(statusApi, repo.rootPath, repo.id, {
      changelistStorage: deps.changelistStorage,
      mode,
    });
  }

  async function performRefresh(activeRepoId?: string): Promise<RefreshPayload> {
    const traceId = `refresh-${sessionId}-${++refreshCount}`;
    const startedAt = Date.now();
    const settings = deps.getSettings?.() ?? DEFAULT_GIT_WORKSPACE_SETTINGS;
    const repos = await deps.repositoryService.discoverRepositories({
      workspaceFolders: deps.getWorkspaceFolders(),
      trusted: deps.getTrusted(),
    });
    const preferredActive = activeRepoId ?? lastActiveRepoId;
    const active =
      preferredActive && repos.some((repo) => repo.id === preferredActive)
        ? preferredActive
        : (repos[0]?.id ?? null);
    lastActiveRepoId = active;

    const repoSnapshot = deps.repositoryService.buildSnapshot(repos, active);
    const statusByRepoId = new Map<string, StatusSnapshot>();
    await mapPool(repos, MAX_CONCURRENT_REPOSITORIES, async (repo) => {
      try {
        const snapshot = await buildStatusSnapshot(repo, settings.mode);
        if (snapshot) {
          statusByRepoId.set(repo.id, snapshot);
        }
      } catch (error) {
        // One unavailable repository must not suppress the other roots.
        logger.warn("refresh.status.failed", {
          traceId,
          repoId: repo.id,
          ...errorLogFields(error),
        });
      }
    });

    const payload = {
      repoSnapshot,
      statusByRepoId,
      settings,
      traceId,
    };
    logger.debug("refresh.completed", {
      traceId,
      repoCount: repos.length,
      statusCount: statusByRepoId.size,
      activeRepoId: active,
      durationMs: Date.now() - startedAt,
    });
    lastPayload = payload;
    if (!disposed) {
      notify(payload);
    }
    return payload;
  }

  async function runRefreshLoop(): Promise<RefreshPayload> {
    let payload = lastPayload;
    do {
      trailingRefreshRequested = false;
      const activeRepoId = requestedActiveRepoId;
      requestedActiveRepoId = undefined;
      payload = await performRefresh(activeRepoId);
    } while (trailingRefreshRequested && !disposed);
    return payload;
  }

  function refreshNow(activeRepoId?: string): Promise<RefreshPayload> {
    if (activeRepoId) {
      requestedActiveRepoId = activeRepoId;
    }
    if (disposed) {
      return Promise.resolve(lastPayload);
    }
    if (inFlight) {
      trailingRefreshRequested = true;
      return inFlight;
    }

    const running = runRefreshLoop().finally(() => {
      if (inFlight === running) {
        inFlight = null;
      }
    });
    inFlight = running;
    return running;
  }

  function scheduleRefresh(activeRepoId?: string): void {
    if (activeRepoId) {
      requestedActiveRepoId = activeRepoId;
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      void refreshNow().catch((error) => {
        // Interactive callers receive errors directly; scheduled refreshes retry
        // on the next repository/workspace event.
        logger.error("refresh.scheduled.failed", errorLogFields(error));
      });
    }, deps.debounceMs ?? 300);
  }

  function dispose(): void {
    disposed = true;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    listeners.clear();
    trailingRefreshRequested = false;
  }

  return { subscribe, refreshNow, scheduleRefresh, dispose };
}
